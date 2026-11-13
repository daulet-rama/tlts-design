// Хранилище матчей прототипа TLTS.
// Состояние — в localStorage под ключом 'tlts-live-v1'; вкладки синхронизируются
// через BroadcastChannel('tlts-live') и событие storage. Каждое изменение матча
// увеличивает его rev; при слиянии побеждает больший rev, при равном —
// более позднее updatedAt, затем больший updatedBy (id вкладки). Так все вкладки
// сходятся к одной версии сразу и одинаково. Слияния журналов нет: одно из двух
// одновременных событий теряется — в продукте это решает сервер (см. API.md).
// В Node (тесты) storage и channel передаются в createStore({ storage, channel }).

import { createScore, applyEvent, tryApply, upgradeScore, isScoreShape, view, makeFormat, FORMAT_LEAGUE, REASONS as SCORE_REASONS } from './score.js';
import { seedMatches as SEED } from './data.js';

export const STORAGE_KEY = 'tlts-live-v1';
export const BEATS_KEY = 'tlts-live-beats';   // пульс судей: { [matchId]: { owner, beat } }
export const CHANNEL_NAME = 'tlts-live';
export const SCHEMA = 1;

// Сколько живёт «судья держит матч» без пульса и как часто пульс обновляется.
export const CLAIM_TTL = 30000;
export const CLAIM_BEAT = 10000;

// Причины отказа хранилища (плюс причины движка счёта).
export const REASONS = Object.freeze({
  ...SCORE_REASONS,
  'no-match': 'Такого матча нет',
  'not-started': 'Матч ещё не начат: сначала выберите настройки (start)',
  'not-live': 'Матч не идёт',
  'claimed': 'Матч ведёт судья',
  'not-owner': 'Матч держит другая вкладка',
  'destroyed': 'Хранилище закрыто',
});
export function reasonText(code) { return REASONS[code] || code || ''; }

const FORBIDDEN_IDS = new Set(['__proto__', 'constructor', 'prototype']);
const STATUSES = ['upcoming', 'live', 'finished'];

// Демо-вечер начинается в 18:10 (часы пульта); стартовый матч длится 50 минут.
const DEMO_EVENING_START = 18 * 60 + 10;
const SEED_MATCH_MINUTES = 50;
function toMin(hhmm) {
  const r = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return r ? Number(r[1]) * 60 + Number(r[2]) : null;
}

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const own = (obj, id) => typeof id === 'string' && !FORBIDDEN_IDS.has(id) && !!obj && Object.prototype.hasOwnProperty.call(obj, id);
const dict = () => Object.create(null);

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => { m.clear(); },
  };
}

function defaultStorage() {
  try {
    const ls = globalThis.localStorage;
    const probe = '__tlts_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStorage();
  }
}

function defaultChannel() {
  try {
    if (typeof BroadcastChannel === 'function') return new BroadcastChannel(CHANNEL_NAME);
  } catch { /* нет канала — работаем без синхронизации */ }
  return null;
}

function randomId() {
  try { return globalThis.crypto.randomUUID().slice(0, 8); } catch { return Math.random().toString(36).slice(2, 10); }
}

// Какая из двух версий одного матча новее. true — a новее b.
// Порядок: сначала эпоха (сколько раз матч сбрасывали: всё, что сделано до сброса,
// проигрывает сбросу), затем rev; при равном rev запись одного захвата ('claim' —
// «судья держит матч») уступает записи счёта или сброса, чтобы захват по устаревшей
// копии не затёр более новое состояние; затем более позднее updatedAt и больший updatedBy.
export function isNewer(a, b) {
  if (!b) return !!a;
  if (!a) return false;
  const ea = a.epoch || 0, eb = b.epoch || 0;
  if (ea !== eb) return ea > eb;
  const ra = a.rev || 0, rb = b.rev || 0;
  if (ra !== rb) return ra > rb;
  const ca = a.change === 'claim', cb = b.change === 'claim';
  if (ca !== cb) return cb;
  const ta = a.updatedAt || 0, tb = b.updatedAt || 0;
  if (ta !== tb) return ta > tb;
  return String(a.updatedBy || '') > String(b.updatedBy || '');
}

// Пауза до следующего розыгрыша, мс при speed = 1.
const PACE = {
  point: [3500, 8000],     // между очками
  changeover: [7000, 11000], // после гейма (смена сторон через нечётный — чуть дольше, здесь не различаем)
  game: [14000, 26000],    // режим games: один гейм
  final: [20000, 30000],   // режим final: весь матч, потом итог
  startDelay: [1200, 2500],
};

/**
 * @param {object} [opts]
 * @param {Storage} [opts.storage]   — подмена localStorage (Node)
 * @param {object}  [opts.channel]   — подмена BroadcastChannel: { postMessage, onmessage | addEventListener, close }
 * @param {Array}   [opts.seed]      — стартовые матчи (по умолчанию seedMatches из data.js)
 * @param {Function}[opts.random]    — генератор случайных чисел [0, 1) для автоигры
 * @param {object}  [opts.timers]    — { setTimeout, clearTimeout, now } для тестов
 */
export function createStore(opts = {}) {
  const storage = opts.storage || defaultStorage();
  const channel = opts.channel === undefined ? defaultChannel() : opts.channel;
  const seed = clone(opts.seed || SEED);
  const seedById = dict();
  for (const m of seed) seedById[m.id] = m;
  const seedVersion = hashString(JSON.stringify(seed));
  const random = opts.random || Math.random;
  const T = {
    setTimeout: (opts.timers && opts.timers.setTimeout) || ((f, ms) => setTimeout(f, ms)),
    clearTimeout: (opts.timers && opts.timers.clearTimeout) || ((t) => clearTimeout(t)),
    now: (opts.timers && opts.timers.now) || (() => Date.now()),
  };
  const tabId = opts.tabId || randomId();
  const listeners = new Set();
  const timers = new Map(); // id → таймер автоигры
  const myClaims = new Set(); // матчи, которые держит эта вкладка
  let claimTimer = null;
  let destroyed = false;

  // ---------- проверка записей ----------

  // Исходный вид матча. У завершённых стартовых матчей демо-вечера (полуфиналы) ставим
  // время окончания: начало по расписанию плюс 50 минут. Время — настоящее (мс), как у
  // finishedAt живых матчей, отсчитанное так, чтобы на часах демо-вечера (он начинается
  // в 18:10, как часы пульта) матч закончился в scheduled + 50 мин: 16:00 → 16:50.
  function seedCopy(s) {
    const m = { ...clone(s), autoplay: null };
    if (m.status === 'finished' && m.finishedAt == null && m.dataset === 'demo') {
      const end = toMin(m.scheduled);
      if (end != null) m.finishedAt = T.now() - (DEMO_EVENING_START - (end + SEED_MATCH_MINUTES)) * 60000;
    }
    return m;
  }

  function fromSeed(id, broken) {
    const s = seedById[id];
    const brokenRev = broken && typeof broken === 'object' && Number.isFinite(broken.rev) ? broken.rev + 1 : 0;
    return { ...seedCopy(s), rev: Math.max(s.rev || 0, brokenRev) };
  }

  // Проверить один матч; испорченный заменить исходным; старую форму счёта обновить.
  // → { match | null, changed }
  function sanitizeMatch(id, m) {
    if (FORBIDDEN_IDS.has(id)) return { match: null, changed: true };
    const hasSeed = own(seedById, id);
    const shapeOk = m && typeof m === 'object' && !Array.isArray(m) && m.id === id
      && Array.isArray(m.pairs) && m.pairs.length === 2 && STATUSES.includes(m.status)
      && m.score && typeof m.score === 'object';
    if (!shapeOk) return { match: hasSeed ? fromSeed(id, m) : null, changed: true };
    try {
      let sc = upgradeScore(m.score);
      if (!isScoreShape(sc)) throw new Error('форма счёта');
      // старое «досрочно завершить» меняло только статус — записываем остановку
      if (m.status === 'finished' && !sc.finished) sc = tryApply(sc, { t: 'stop', reason: null }).state;
      if (sc === m.score) return { match: m, changed: false };
      return { match: { ...m, score: sc, mode: sc.mode }, changed: true };
    } catch {
      return { match: hasSeed ? fromSeed(id, m) : null, changed: true };
    }
  }

  // Проверить всё состояние. Недостающие исходные матчи добавляются.
  function sanitizeAll(matches) {
    const out = dict();
    let changed = false;
    if (matches && typeof matches === 'object') {
      for (const id of Object.keys(matches)) {
        const r = sanitizeMatch(id, matches[id]);
        if (r.changed) changed = true;
        if (r.match) out[id] = r.match;
      }
    }
    for (const id of Object.keys(seedById)) if (!own(out, id)) { out[id] = fromSeed(id, null); changed = true; }
    return { matches: out, changed };
  }

  // ---------- чтение и запись ----------

  function freshState() {
    const matches = dict();
    for (const m of seed) matches[m.id] = { ...seedCopy(m), rev: m.rev || 0 };
    return { schema: SCHEMA, seedVersion, matches };
  }

  let lastReadChanged = false;
  function readRaw() {
    lastReadChanged = false;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const st = JSON.parse(raw);
      if (!st || typeof st !== 'object' || st.schema !== SCHEMA || st.seedVersion !== seedVersion || !st.matches || typeof st.matches !== 'object') return null;
      const { matches, changed } = sanitizeAll(st.matches);
      lastReadChanged = changed;
      return { schema: SCHEMA, seedVersion, matches };
    } catch {
      return null;
    }
  }

  function write(st) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(st)); } catch { /* переполнение — живём в памяти */ }
  }

  const keyWasEmpty = (() => { try { return !storage.getItem(STORAGE_KEY); } catch { return true; } })();
  let cache = readRaw();
  if (!cache) {
    cache = freshState();
    write(cache);
  } else if (lastReadChanged) {
    write(cache); // починили испорченные записи — сохраняем
  }

  function get(id) { return own(cache.matches, id) ? cache.matches[id] : null; }

  function emit(type, id, source, extra) {
    const m = id ? clone(get(id)) : null;
    for (const fn of [...listeners]) {
      try { fn({ type, id, match: m, source, ...(extra || {}) }); } catch (e) { console.error('[tlts store] подписчик', e); }
    }
  }

  // Слить внешнее состояние; вернуть ids изменённых матчей.
  function mergeFrom(st) {
    if (!st || !st.matches) return [];
    const changed = [];
    for (const id of Object.keys(st.matches)) {
      if (FORBIDDEN_IDS.has(id)) continue;
      const m = st.matches[id];
      const mine = get(id);
      if (!mine || isNewer(m, mine)) {
        cache.matches[id] = m;
        changed.push(id);
      }
    }
    return changed;
  }

  // У этой вкладки есть версии новее, чем в st?
  function aheadOf(st) {
    if (!st || !st.matches) return true;
    for (const id of Object.keys(cache.matches)) {
      const theirs = own(st.matches, id) ? st.matches[id] : null;
      if (isNewer(cache.matches[id], theirs)) return true;
    }
    return false;
  }

  // Изменить матч: берём свежую копию из хранилища, меняем, пишем, рассылаем.
  // fn(next) может вернуть false (ничего не менять) или строку — код причины отказа.
  // → { match, reason } ; match — копия (новая или прежняя), null если матча нет.
  function change(id, fn, type = 'update') {
    if (destroyed) return { match: null, reason: 'destroyed' };
    const latest = readRaw();
    if (latest) mergeFrom(latest);
    const cur = get(id);
    if (!cur) return { match: null, reason: 'no-match' };
    const next = clone(cur);
    const res = fn(next);
    if (res === false || typeof res === 'string') return { match: clone(cur), reason: typeof res === 'string' ? res : 'unchanged' };
    next.rev = (cur.rev || 0) + 1;
    next.updatedAt = T.now();
    next.updatedBy = tabId;
    next.change = type; // вид последней записи: 'claim' уступает остальным при равном rev (см. isNewer)
    cache.matches[id] = next;
    write(cache);
    post({ type: 'match', id, match: next, from: tabId });
    emit(type, id, 'local');
    return { match: clone(next), reason: null };
  }
  const mutate = (id, fn, type) => change(id, fn, type).match;
  const result = (r) => ({ accepted: r.reason === null, match: r.match, reason: r.reason === 'unchanged' ? null : r.reason });

  function post(msg) {
    if (!channel) return;
    try { channel.postMessage(msg); } catch { /* канал закрыт */ }
  }

  function applyRemote(matches) {
    const { matches: clean } = sanitizeAll(matches);
    // sanitizeAll добавляет исходные матчи; чужие недостающие нам не нужны — сравниваем только присланные
    const only = dict();
    for (const id of Object.keys(matches || {})) if (own(clean, id)) only[id] = clean[id];
    const changed = mergeFrom({ matches: only });
    for (const id of changed) { emit('remote', id, 'remote'); afterRemote(id); }
    return changed;
  }

  function onRemoteMessage(msg) {
    if (destroyed || !msg || msg.from === tabId) return;
    if (msg.type === 'match' && msg.match && typeof msg.id === 'string') {
      applyRemote({ [msg.id]: msg.match });
    } else if (msg.type === 'sync') {
      const changed = mergeFrom(readRaw());
      for (const id of changed) { emit('remote', id, 'remote'); afterRemote(id); }
    } else if (msg.type === 'hello') {
      // новая вкладка открылась на пустом хранилище — отдаём своё состояние
      post({ type: 'state', matches: cache.matches, from: tabId });
    } else if (msg.type === 'state' && msg.matches) {
      const changed = applyRemote(msg.matches);
      if (changed.length) write(cache);
    }
  }

  const onChannel = (e) => onRemoteMessage(e && 'data' in e ? e.data : e);
  if (channel) {
    if (typeof channel.addEventListener === 'function') channel.addEventListener('message', onChannel);
    else channel.onmessage = onChannel;
  }

  // Событие storage (или ручная проверка). Если ключ стёрли — записываем своё обратно.
  function onStorage(e) {
    if (destroyed) return;
    if (e && e.key && e.key !== STORAGE_KEY) return;
    let raw = null;
    try { raw = storage.getItem(STORAGE_KEY); } catch { return; }
    if (!raw) {
      write(cache);
      post({ type: 'sync', from: tabId });
      return;
    }
    const st = readRaw();
    if (!st) return; // чужая версия данных — не трогаем
    const changed = mergeFrom(st);
    for (const id of changed) { emit('remote', id, 'remote'); afterRemote(id); }
    if (aheadOf(st)) write(cache); // кто-то записал более старое состояние — возвращаем своё
  }
  const hasWindow = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
  if (hasWindow && !opts.storage) window.addEventListener('storage', onStorage);

  // ---------- судья держит матч ----------

  function readBeats() {
    try { const b = JSON.parse(storage.getItem(BEATS_KEY) || '{}'); return b && typeof b === 'object' ? b : {}; } catch { return {}; }
  }
  function writeBeat(id, beat) {
    const b = readBeats();
    if (beat == null) delete b[id];
    else b[id] = { owner: tabId, beat };
    try { storage.setItem(BEATS_KEY, JSON.stringify(b)); } catch { /* живём без пульса */ }
  }

  // Действующий захват матча (или null): поле match.claim плюс свежий пульс.
  function activeClaim(m) {
    const c = m && m.claim;
    if (!c || !c.owner) return null;
    let beat = c.beat || 0;
    const b = readBeats();
    if (own(b, m.id) && b[m.id] && b[m.id].owner === c.owner) beat = b[m.id].beat || 0; // пульс главнее: 0 — вкладку закрыли
    if (T.now() - beat > CLAIM_TTL) return null;
    return { owner: c.owner, role: c.role || 'judge', since: c.since || null, beat, mine: c.owner === tabId };
  }
  const claimedByOther = (m) => { const c = activeClaim(m); return !!(c && !c.mine); };

  function beatClaims() {
    claimTimer = null;
    if (destroyed) return;
    const latest = readRaw();
    if (latest) mergeFrom(latest);
    for (const id of [...myClaims]) {
      const m = get(id);
      if (!m || !m.claim || m.claim.owner !== tabId) { myClaims.delete(id); writeBeat(id, null); continue; }
      writeBeat(id, T.now());
    }
    if (myClaims.size) claimTimer = T.setTimeout(beatClaims, CLAIM_BEAT);
  }
  function startClaimBeat() {
    if (claimTimer || destroyed || !myClaims.size) return;
    claimTimer = T.setTimeout(beatClaims, CLAIM_BEAT);
  }

  // ---------- автоигра ----------

  const STALE_MS = 45000;

  function ownsAutoplay(m) {
    return m && m.autoplay && m.autoplay.owner === tabId;
  }

  function isStale(m) {
    const a = m && m.autoplay;
    if (!a) return false;
    const speed = Math.max(0.1, a.speed || 1);
    return T.now() - (a.beat || 0) > Math.max(8000, STALE_MS / speed);
  }

  function range([a, b], speed) {
    return (a + random() * (b - a)) / Math.max(0.1, speed || 1);
  }

  function simulatePoint(sc) {
    const v = view(sc);
    const server = v.server == null ? 0 : v.server;
    const pServe = 0.62; // на любительском грунте подающие берут чуть больше
    return random() < pServe ? server : 1 - server;
  }

  function simulateGame(sc) {
    const v = view(sc);
    const server = v.server == null ? 0 : v.server;
    const pHold = v.inTiebreak ? 0.5 : 0.72;
    return random() < pHold ? server : 1 - server;
  }

  function simulateFinal(format) {
    let s = createScore({ format, mode: 'points', firstServer: random() < 0.5 ? 0 : 1 });
    for (let i = 0; i < 1000 && !s.finished; i++) s = applyEvent(s, { t: 'point', side: simulatePoint(s) });
    const v = view(s);
    return { t: 'final', games: v.games, tiebreak: v.tiebreak || undefined };
  }

  function schedule(id, delay) {
    clearTimer(id);
    timers.set(id, T.setTimeout(() => tick(id), delay));
  }

  function clearTimer(id) {
    if (timers.has(id)) { T.clearTimeout(timers.get(id)); timers.delete(id); }
  }

  function tick(id) {
    timers.delete(id);
    if (destroyed) return;
    const latest = readRaw();
    if (latest) mergeFrom(latest);
    const m = get(id);
    if (!m || !ownsAutoplay(m)) return;
    if (m.status === 'finished' || (m.score && m.score.finished) || claimedByOther(m)) {
      // матч окончен или его взял судья из другой вкладки — автоигра останавливается
      mutate(id, (x) => { x.autoplay = null; }, 'autoplay');
      return;
    }
    const speed = m.autoplay.speed || 1;
    let ev;
    if (m.mode === 'games') ev = { t: 'game', side: simulateGame(m.score) };
    else if (m.mode === 'final') ev = simulateFinal(makeFormat(m.format || FORMAT_LEAGUE));
    else ev = { t: 'point', side: simulatePoint(m.score) };
    const gamesBefore = m.score.games[0] + m.score.games[1];
    const res = mutate(id, (x) => {
      const ns = applyEvent(x.score, ev);
      if (ns === x.score) return false;
      x.score = ns;
      x.mode = ns.mode;
      if (ns.finished) { x.status = 'finished'; x.finishedAt = T.now(); x.autoplay = null; }
      else x.autoplay = { ...x.autoplay, beat: T.now() };
    }, 'event');
    if (!res || res.status === 'finished' || !res.autoplay) return;
    const gamesAfter = res.score.games[0] + res.score.games[1];
    let delay;
    if (m.mode === 'games') delay = range(PACE.game, speed);
    else if (m.mode === 'final') delay = range(PACE.final, speed);
    else delay = range(gamesAfter !== gamesBefore ? PACE.changeover : PACE.point, speed);
    schedule(id, delay);
  }

  // Матч поменялся из другой вкладки: если ведущий пропал — забираем автоигру.
  function afterRemote(id) {
    const m = get(id);
    if (!m) return;
    if (m.autoplay) startWatchdog();
    if (ownsAutoplay(m)) { if (!timers.has(id)) schedule(id, range(PACE.point, m.autoplay.speed)); return; }
    clearTimer(id);
  }

  let watchdog = null;
  function startWatchdog() {
    if (watchdog || destroyed || opts.watchdog === false) return;
    const loop = () => {
      watchdog = null;
      if (destroyed) return;
      const latest = readRaw();
      if (latest) mergeFrom(latest);
      let any = false;
      for (const m of Object.values(cache.matches)) {
        if (!m.autoplay) continue;
        any = true;
        if (!ownsAutoplay(m) && isStale(m) && m.status !== 'finished') {
          if (claimedByOther(m) && activeClaim(m).owner !== tabId) {
            // матч держит судья — не подхватываем, а гасим брошенную автоигру
            mutate(m.id, (x) => { x.autoplay = null; }, 'autoplay');
            continue;
          }
          mutate(m.id, (x) => { x.autoplay = { ...x.autoplay, owner: tabId, beat: T.now() }; }, 'autoplay');
          schedule(m.id, range(PACE.startDelay, m.autoplay.speed));
        } else if (ownsAutoplay(m) && !timers.has(m.id)) {
          schedule(m.id, range(PACE.startDelay, m.autoplay.speed));
        }
      }
      if (any) watchdog = T.setTimeout(loop, 5000);
    };
    watchdog = T.setTimeout(loop, 5000);
  }

  // Уходя со страницы, отдаём автоигру и захваты другим вкладкам.
  const onHide = () => {
    for (const m of Object.values(cache.matches)) {
      if (ownsAutoplay(m)) mutate(m.id, (x) => { x.autoplay = { ...x.autoplay, beat: 0 }; }, 'autoplay');
    }
    for (const id of myClaims) writeBeat(id, 0);
    if (claimTimer) { T.clearTimeout(claimTimer); claimTimer = null; }
  };
  // Страница вернулась из истории («Назад») — снова держим свои матчи.
  const onShow = (e) => {
    if (!e || !e.persisted) return;
    store.refresh();
    if (myClaims.size) { beatClaimsNow(); }
  };
  function beatClaimsNow() { if (claimTimer) { T.clearTimeout(claimTimer); claimTimer = null; } beatClaims(); }
  if (hasWindow && !opts.storage) {
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
  }

  // ---------- публичный интерфейс ----------

  function eventChange(id, event) {
    return change(id, (x) => {
      if (!x.score) return 'not-started';
      if (x.status === 'upcoming') {
        // До start принимается только неявка: остальное требует настроек матча.
        if (!event || event.t !== 'walkover') return 'not-started';
        x.score = createScore({ format: makeFormat(x.format), mode: x.mode, firstServer: 0 });
        x.status = 'live';
        x.startedAt = T.now();
      }
      const r = tryApply(x.score, event);
      if (!r.accepted) return r.reason;
      const ns = r.state;
      x.score = ns;
      x.mode = ns.mode;
      if (ns.finished && x.status !== 'finished') { x.status = 'finished'; x.finishedAt = T.now(); x.autoplay = null; }
      if (!ns.finished && x.status === 'finished') { x.status = 'live'; x.finishedAt = null; }
    }, 'event');
  }

  function resetChange(id, { force = false } = {}) {
    if (!own(seedById, id)) return { match: get(id) ? clone(get(id)) : null, reason: 'no-match' };
    const cur = get(id);
    if (cur && !force && claimedByOther(cur)) return { match: clone(cur), reason: 'claimed' };
    clearTimer(id);
    const s = seedById[id];
    const r = change(id, (x) => {
      const rev = x.rev;
      // эпоха растёт: запись, сделанная по копии до сброса (например, захват из вкладки,
      // которая ещё не видела сброс), сброс не перебьёт — см. isNewer
      const epoch = (x.epoch || 0) + 1;
      for (const k of Object.keys(x)) delete x[k];
      Object.assign(x, seedCopy(s), { rev, epoch });
    }, 'reset');
    if (myClaims.has(id)) { myClaims.delete(id); writeBeat(id, null); }
    return r;
  }

  function autoplayChange(id, { speed = 1, mode } = {}) {
    const m = get(id);
    if (!m) return { match: null, reason: 'no-match' };
    if (m.status === 'finished') return { match: clone(m), reason: 'finished' };
    if (claimedByOther(m)) return { match: clone(m), reason: 'claimed' };
    if (m.autoplay && !ownsAutoplay(m) && !isStale(m)) {
      // уже играет другая вкладка — меняем только скорость
      startWatchdog();
      return change(id, (x) => { x.autoplay = { ...x.autoplay, speed }; }, 'autoplay');
    }
    if (m.status === 'upcoming') store.start(id, { mode: mode || m.mode, format: m.format, firstServer: random() < 0.5 ? 0 : 1 });
    const res = change(id, (x) => { x.autoplay = { owner: tabId, speed, beat: T.now() }; }, 'autoplay');
    schedule(id, range(PACE.startDelay, speed));
    startWatchdog();
    return res;
  }

  const store = {
    tabId,

    matches() { return Object.values(cache.matches).map(clone); },
    match(id) { return clone(get(id)); },
    view(id) { const m = get(id); return m && m.score ? view(m.score) : null; },
    has(id) { return !!get(id); },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    start(id, { mode, format, firstServer } = {}) {
      return mutate(id, (x) => {
        if (x.status !== 'upcoming') return false;
        const f = makeFormat(format || x.format || FORMAT_LEAGUE);
        const md = mode || x.mode || 'points';
        x.format = { gamesToWin: f.gamesToWin, deuce: f.deuce };
        x.mode = md;
        x.score = createScore({ format: f, mode: md, firstServer: firstServer === 1 ? 1 : 0 });
        x.status = 'live';
        x.startedAt = T.now();
        x.finishedAt = null;
      }, 'start');
    },

    // Как раньше: возвращает матч (прежний, если событие не принято).
    event(id, event) { return eventChange(id, event).match; },
    // → { accepted, match, reason } — reason: код из REASONS, текст — reasonText(reason)
    tryEvent(id, event) { return result(eventChange(id, event)); },

    // Завершить вручную. Идущий матч, который движок не закончил, записывается
    // событием 'stop' (матч прерван, победителя нет). Несыгранный (upcoming) — не трогается.
    finish(id, { reason = null } = {}) {
      return mutate(id, (x) => {
        if (x.status === 'finished' || x.status === 'upcoming') return false;
        if (x.score && !x.score.finished) {
          const r = tryApply(x.score, { t: 'stop', reason });
          if (r.accepted) x.score = r.state;
        }
        x.status = 'finished';
        x.finishedAt = T.now();
        x.autoplay = null;
      }, 'finish');
    },

    // Продолжить: прерванный матч ('stop') — событием 'resume', очки и подача на месте.
    reopen(id) {
      return mutate(id, (x) => {
        if (x.status !== 'finished') return false;
        if (x.score && x.score.stopped) {
          const r = tryApply(x.score, { t: 'resume' });
          if (r.accepted) x.score = r.state;
        }
        x.status = 'live';
        x.finishedAt = null;
      }, 'reopen');
    },

    // Вернуть матч к исходному виду. Матч, который держит судья из другой вкладки,
    // не трогается без { force: true } — тогда возвращается прежний матч.
    reset(id, opts) { return resetChange(id, opts).match; },
    tryReset(id, opts) { return result(resetChange(id, opts)); },

    // → { reset: [ids], skipped: [ids] } — skipped: матчи, которые держит судья
    resetAll(opts = {}) {
      const out = { reset: [], skipped: [] };
      for (const m of seed) {
        const r = resetChange(m.id, opts);
        if (r.reason === 'claimed') out.skipped.push(m.id);
        else out.reset.push(m.id);
      }
      return out;
    },

    autoplay(id, opts) { return autoplayChange(id, opts).match; },
    tryAutoplay(id, opts) { return result(autoplayChange(id, opts)); },

    stopAutoplay(id) {
      clearTimer(id);
      return mutate(id, (x) => {
        if (!x.autoplay) return false;
        x.autoplay = null;
      }, 'autoplay');
    },

    isAutoplaying(id) { const m = get(id); return !!(m && m.autoplay); },

    // «Судья держит матч». Пока держит другая вкладка: autoplay() отказывает,
    // reset()/resetAll() без { force: true } матч не трогают.
    // → { accepted, match, reason }; reason 'claimed' — матч уже держит другая вкладка.
    claim(id, { role = 'judge', force = false } = {}) {
      const r = change(id, (x) => {
        const c = activeClaim(x);
        if (c && !c.mine && !force) return 'claimed';
        const since = x.claim && x.claim.owner === tabId ? x.claim.since : T.now();
        x.claim = { owner: tabId, role, since, beat: T.now() };
      }, 'claim');
      if (r.reason === null) {
        myClaims.add(id);
        writeBeat(id, T.now());
        startClaimBeat();
      }
      return result(r);
    },

    // Отпустить матч (только свой захват).
    release(id) {
      myClaims.delete(id);
      const r = change(id, (x) => {
        if (!x.claim) return false;
        if (x.claim.owner !== tabId) return 'not-owner';
        x.claim = null;
      }, 'claim');
      if (r.reason === null || r.reason === 'unchanged') writeBeat(id, null);
      return result(r);
    },

    // Действующий захват: { owner, role, since, beat, mine } или null (нет или истёк).
    claimOf(id) { return activeClaim(get(id)); },
    isClaimedByOther(id) { return claimedByOther(get(id)); },

    connection() { return 'local'; },

    // Принудительно перечитать хранилище (на случай пропущенных сообщений).
    refresh() { onStorage({ key: STORAGE_KEY }); },

    destroy() {
      destroyed = true;
      for (const id of [...timers.keys()]) clearTimer(id);
      if (watchdog) T.clearTimeout(watchdog);
      if (claimTimer) T.clearTimeout(claimTimer);
      listeners.clear();
      if (channel) {
        if (typeof channel.removeEventListener === 'function') channel.removeEventListener('message', onChannel);
        if (!opts.channel && typeof channel.close === 'function') channel.close();
      }
      if (hasWindow && !opts.storage) {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('pagehide', onHide);
        window.removeEventListener('pageshow', onShow);
      }
    },
  };

  // Хранилище было пустым (новая вкладка после очистки) — спросим состояние у открытых вкладок.
  if (keyWasEmpty) post({ type: 'hello', from: tabId });

  // Если в хранилище уже идёт автоигра без живого ведущего — подхватим.
  if (Object.values(cache.matches).some((m) => m.autoplay)) startWatchdog();

  return store;
}

// Общий канал для тестов в Node: несколько «вкладок» в одном процессе.
export function createMemoryBus() {
  const members = new Set();
  return {
    storage: memoryStorage(),
    channel() {
      const ch = {
        onmessage: null,
        postMessage(msg) {
          const data = JSON.parse(JSON.stringify(msg));
          for (const other of members) {
            if (other !== ch && typeof other.onmessage === 'function') queueMicrotask(() => other.onmessage({ data }));
          }
        },
        close() { members.delete(ch); },
      };
      members.add(ch);
      return ch;
    },
  };
}
