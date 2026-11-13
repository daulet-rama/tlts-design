// TLTS · desk.html — «Пульт турнирного дня» (экран с идеями: вызов на корт с часами; живое расписание и дождь).
// Данные — core/data.js, хранилище core/store.js и цифры архива ideas/desk.data.js; расчёты — ideas/desk.logic.js.
// Своё общее состояние (демо-время, вызовы, журнал) — localStorage 'tlts-desk-v1' + BroadcastChannel 'tlts-desk':
// вызов из вкладки директора сразу виден во вкладке игрока (desk.html?view=player) и наоборот.

import { pairOf, playersOfPair, pairs } from './core/data.js';
import { createStore } from './core/store.js';
import { pairPlateHTML, pairBallHTML } from './core/card.js';
import { mountProtoBar, mountIdeaNote } from './core/protobar.js';
import { playerId } from './core/identity.js';
import * as L from './ideas/desk.logic.js';
import { DESK_ARCHIVE as A } from './ideas/desk.data.js';

mountProtoBar({ current: 'desk', demo: true });
mountIdeaNote(null, {
  ideas: [
    { title: 'Вызов на корт с часами', score: 6.3, approvals: 3 },
    { title: 'Живое расписание и дождь', score: 6.3, approvals: 3 },
  ],
  why: 'Поражение 0:0 через 20 минут после вызова — серьёзное решение, а время вызова сегодня нигде не записано. При дожде у главного судьи есть право сократить регламент, но нет цифр.',
  changed: [
    'Игрок видит только вызов, корт и кнопки «Иду» и «Нужно 5 минут» — без крупного обратного отсчёта.',
    'Отсчёт 20 минут и журнал — только у директора и судьи. На табло строка без таймера.',
    'Кнопки «Неявка» здесь нет: неявку оформляет только судья. Связи с учётом отказов (пункт 3.2) нет.',
    'В журнале «отправлено» и «прочитано» — разные отметки. Голосовой вызов остаётся.',
    'Часы вызова идут, только когда свободны обе пары и корт: пока одна пара доигрывает, у второй «ждём соперников — часы стоят».',
    'Если вызов не прочитан, судья видит «вызовите голосом», а не «срок вышел»: запись — подсказка, а не доказательство.',
    'Вызывает человек кнопкой: без SMS, Telegram и без «сайт вызывает сам».',
    '«Впритык» видит только директор; порог отдыха не вводится, матчи сами не переставляются.',
    'Плитки дождя — подсказка: выбирает и подписывает главный судья.',
    'Никаких отметок о возрасте и здоровье игроков.',
  ],
  league: [
    'Нужен ли минимальный отдых между матчами одной пары, и какой? (решает Совет)',
    'Как считать процент геймов, если в одной группе матчи разной длины?',
    'Прерванный дождём матч доигрывается в старом формате или в сокращённом?',
    'Сет до 4 геймов: тай-брейк при 4:4?',
    'Есть ли на кортах освещение и до скольких можно играть?',
  ],
});

/* ------------------------------------------------------------------ утилиты */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtInt = (n) => Number(n).toLocaleString('ru-RU').replace(/\s/g, ' ');
const fmt1 = (x, d = 1) => Number(x).toFixed(d).replace('.', ',');
const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : iso; };
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}

// «33 минуты»; после «около» — родительный: «около 31 минуты», «около 25 минут»
function mins(x, after = '') {
  const n = Math.round(x);
  return after === 'minuty' ? `${n} ${plural(n, 'минуты', 'минут', 'минут')}` : `${n} ${plural(n, 'минута', 'минуты', 'минут')}`;
}
// творительный падеж имени для «в паре с …»: Виктор Савельев → Виктором Савельевым (демо-игроки — мужчины)
function instrMale(w) {
  if (!w) return '';
  if (/(ов|ев|ёв|ин|ын)$/.test(w)) return `${w}ым`;
  if (/(ий|ой)$/.test(w)) return `${w.slice(0, -2)}им`;
  if (/[йь]$/.test(w)) return `${w.slice(0, -1)}ем`;
  if (/[жшчщц]$/.test(w)) return `${w}ем`;
  if (/[бвгдзклмнпрстфх]$/.test(w)) return `${w}ом`;
  return w;
}
const withName = (p) => [instrMale(p.first), instrMale(p.last)].filter(Boolean).join(' ') || p.name;

const store = createStore();
const model = L.makeModel(A.scores);

/* ------------------------------------------------------------------ общее состояние пульта */

const KEY = 'tlts-desk-v1';
const START_CLOCK = L.toMin('18:10');
const fresh = () => ({
  v: 1,
  clock: { realAt: Date.now(), demoMin: START_CLOCK, jumps: [] },
  calls: {},
  log: [],
  noted: {},
  hint: 15,
  rain: { day: '2026-04-25', rainAt: '11:20', dryAt: '13:20', pick: 'po4' },
});
function load() {
  try {
    const s = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (s && s.v === 1 && s.clock && Number.isFinite(s.clock.demoMin)) {
      const f = fresh();
      return { ...f, ...s, rain: { ...f.rain, ...(s.rain || {}) }, calls: s.calls || {}, log: Array.isArray(s.log) ? s.log : [], noted: s.noted || {} };
    }
  } catch { /* хранилище недоступно или испорчено */ }
  return null;
}
function save(s) { try { window.localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; } }

let S = load();
if (!S) { S = fresh(); save(S); }

let bc = null;
try { bc = new BroadcastChannel('tlts-desk'); } catch { bc = null; }

function update(fn) {
  const cur = load() || S;
  fn(cur);
  S = cur;
  save(cur);
  try { bc && bc.postMessage({ t: 'changed' }); } catch { /* канал закрыт */ }
  renderAll();
}
function onRemote() { const s = load(); if (s) { S = s; renderAll(); } }
if (bc) bc.onmessage = onRemote;
window.addEventListener('storage', (e) => { if (e.key === KEY) { const s = load(); S = s || fresh(); if (!s) save(S); renderAll(); } });

// демо-время: старт 18:10 + прошедшее время + перемотки «+5 минут», сделанные до этого момента
// (перемотка не сдвигает то, что уже случилось: конец матча остаётся на своём месте)
const demoAt = (s, ts) => s.clock.demoMin + (ts - s.clock.realAt) / 60000
  + (s.clock.jumps || []).reduce((a, j) => a + (j.real <= ts ? j.add : 0), 0);
const nowOf = (s) => demoAt(s, Date.now());
const now = () => nowOf(S);
const demoOf = (ts) => (Number.isFinite(ts) ? demoAt(S, ts) : null);

function addLog(s, who, text, extra = {}) {
  s.log.unshift({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: nowOf(s), who, text, ...extra });
  if (s.log.length > 200) s.log.length = 200;
}

/* ------------------------------------------------------------------ вид (кто смотрит) */

const params = new URLSearchParams(location.search);
const VIEWS = {
  director: 'Директор видит всё: корты, «впритык», вызовы с часами, дождь и журнал.',
  judge: 'Судья видит то же, кроме «впритык»: корты, вызовы с часами, дождь и журнал.',
  player: 'Игрок видит только свой вызов, корт и две кнопки. Без отсчёта и без оценок.',
  board: 'Табло: строка вызова без таймера. Общий экран клуба.',
};
let view = VIEWS[params.get('view')] ? params.get('view') : 'director';
const whoLabel = () => (view === 'judge' ? 'Судья' : 'Директор');

function setView(v, push = true) {
  if (!VIEWS[v]) return;
  view = v;
  document.body.dataset.view = v;
  for (const b of document.querySelectorAll('#dk-view .seg__btn')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
  $('dk-view-note').textContent = VIEWS[v];
  if (push) {
    const u = new URL(location.href);
    if (v === 'director') u.searchParams.delete('view'); else u.searchParams.set('view', v);
    history.replaceState(null, '', u);
  }
  renderAll();
}

/* ------------------------------------------------------------------ пары, корты, матчи */

const pairNames = (id) => playersOfPair(id).map((p) => p.last).join(' / ');
const pairBall = (id, size = 22) => { const [a, b] = playersOfPair(id); return pairBallHTML(a?.kpr ?? null, b?.kpr ?? null, { size, decorative: true }); };
const pairChip = (id, size = 22) => `<span class="dk-pair">${pairBall(id, size)}<span>${esc(pairNames(id))}</span></span>`;
const courtTo = (c) => (c === 'Центральный корт' ? 'Центральный корт' : String(c).replace(/^Корт/, 'корт'));
const courtAt = (c) => (c === 'Центральный корт' ? 'Центральном корте' : String(c).replace(/^Корт/, 'корте'));
const courtNum = (c) => (c === 'Центральный корт' ? 0 : Number(String(c).replace(/\D/g, '')) || 99);

const demoMatches = () => store.matches().filter((m) => m.dataset === 'demo');
const isLive = (m) => m.status === 'live';
const livePairMatch = (pid, except) => demoMatches().find((m) => isLive(m) && m.id !== except && m.pairs.includes(pid));
function lastFinish(pid, except) {
  let t = null;
  for (const m of demoMatches()) {
    if (m.id === except || m.status !== 'finished' || !m.pairs.includes(pid) || !m.finishedAt) continue;
    // время окончания «в будущем» — не из этого демо-вечера (например, по программе другого дня): не учитываем
    const d = demoOf(m.finishedAt);
    if (!Number.isFinite(d) || d > now() + 0.01) continue;
    if (t === null || d > t) t = d;
  }
  return t;
}
const myPairOf = (pid) => pairs.find((p) => p.demo && p.players.includes(pid)) || null;

// прогноз по живому счёту
function forecasts() {
  const t = now();
  const ends = new Map();
  for (const m of demoMatches()) if (isLive(m)) ends.set(m.id, t + L.remainingMinutes(store.view(m.id), model));
  const pairFree = (pid, except) => {
    const lm = livePairMatch(pid, except);
    if (lm) return { at: ends.get(lm.id), court: lm.court, match: lm };
    return { at: lastFinish(pid, except) ?? -Infinity, court: null, match: null };
  };
  const starts = new Map();
  for (const m of demoMatches()) {
    if (m.status !== 'upcoming') continue;
    const busy = demoMatches().find((x) => isLive(x) && x.court === m.court);
    const pf = m.pairs.map((p) => pairFree(p, m.id));
    const at = L.forecastStart({ scheduled: L.toMin(m.scheduled), courtFree: busy ? ends.get(busy.id) : -Infinity, pairsFree: [...pf.map((x) => x.at), t] });
    starts.set(m.id, { at, pf, courtBusy: busy || null });
  }
  return { t, ends, starts, pairFree };
}
const about = (min) => `около ${L.hhmm(L.round5(min))}`;
const band = `<span class="dk-band">(±${L.FORECAST_BAND} минут)</span>`;

/* ------------------------------------------------------------------ вызовы */

const activeCalls = () => Object.values(S.calls).filter((c) => c && !c.closed).sort((a, b) => a.at - b.at);

// Когда освободился корт вызова: null — на нём ещё идёт другой матч.
function courtFreeAt(court, except) {
  if (demoMatches().some((m) => isLive(m) && m.id !== except && m.court === court)) return null;
  let t = -Infinity;
  for (const m of demoMatches()) {
    if (m.id === except || m.court !== court || m.status !== 'finished' || !m.finishedAt) continue;
    const d = demoOf(m.finishedAt);
    if (Number.isFinite(d) && d <= now() + 0.01 && d > t) t = d;
  }
  return t;
}

// Часы вызова идут, только когда свободны обе пары и корт (L.matchClocks); read — прочитан ли вызов.
function clocksOf(call) {
  const m = store.match(call.matchId);
  if (m && m.status !== 'upcoming') return call.pairs.map(() => ({ state: 'started', read: true }));
  const lms = call.pairs.map((pid) => livePairMatch(pid, call.matchId));
  const cs = L.matchClocks({
    calledAt: call.at,
    courtFreeAt: courtFreeAt(call.court, call.matchId),
    pairs: call.pairs.map((pid, i) => ({ freeAt: lms[i] ? null : (lastFinish(pid, call.matchId) ?? -Infinity), onCourtAt: call.onCourt?.[pid] ?? null })),
    now: now(),
  });
  return cs.map((c, i) => ({ ...c, read: !!call.reads?.[call.pairs[i]], court: lms[i] ? lms[i].court : null }));
}
const clockOf = (call, pid) => clocksOf(call)[Math.max(0, call.pairs.indexOf(pid))];

function doCall(mid) {
  const m = store.match(mid);
  if (!m || m.status !== 'upcoming') return;
  const who = whoLabel();
  update((s) => {
    s.calls[mid] = { matchId: mid, at: nowOf(s), by: who, court: m.court, stage: m.stage, pairs: m.pairs.slice(), reads: {}, replies: {}, onCourt: {}, closed: false };
    addLog(s, who, `Вызов на ${courtTo(m.court)}: ${m.stage} — ${pairNames(m.pairs[0])} и ${pairNames(m.pairs[1])}. Отправлено обеим парам.`, { kind: 'call' });
  });
}
function cancelCall(mid) {
  const who = whoLabel();
  update((s) => {
    const c = s.calls[mid];
    if (!c) return;
    delete s.calls[mid];
    for (const k of Object.keys(s.noted)) if (k.includes(`:${mid}`)) delete s.noted[k];
    addLog(s, who, `Вызов отменён: ${c.stage}, ${courtTo(c.court)}.`, { kind: 'cancel' });
  });
}
function reply(mid, pid, kind) {
  update((s) => {
    const c = s.calls[mid];
    if (!c || c.closed) return;
    const t = nowOf(s);
    if (!c.reads[pid]) c.reads[pid] = t;
    c.replies[pid] = { kind, at: t };
    addLog(s, `Игрок · ${pairNames(pid)}`, kind === 'go' ? 'Ответ на вызов: «Иду».' : `Ответ на вызов: «Нужно 5 минут» — будут около ${L.hhmm(t + 5)}.`, { kind: 'reply' });
  });
}
function markRead(mid, pid) {
  if (!S.calls[mid] || S.calls[mid].reads?.[pid]) return;
  update((s) => {
    const c = s.calls[mid];
    if (!c || c.reads[pid]) return;
    c.reads[pid] = nowOf(s);
    addLog(s, `Игрок · ${pairNames(pid)}`, 'Вызов прочитан на телефоне.', { kind: 'read' });
  });
}
function onCourt(mid, pid) {
  const call = S.calls[mid];
  if (!call) return;
  const c = clockOf(call, pid);
  const waited = c.from != null && Number.isFinite(c.from) ? now() - c.from : null;
  update((s) => {
    const x = s.calls[mid];
    if (!x || x.onCourt[pid] != null) return;
    x.onCourt[pid] = nowOf(s);
    addLog(s, 'Судья', `Пара ${pairNames(pid)} на корте${waited != null ? ` — через ${Math.max(0, Math.round(waited))} мин после начала часов` : ''}.`, { kind: 'oncourt', waited: waited != null ? Math.max(0, waited) : null });
  });
}

// события, которые замечает сам сайт: пара освободилась, прошло 20 минут, матч начался
function watchCalls() {
  const todo = [];
  for (const call of activeCalls()) {
    const m = store.match(call.matchId);
    if (m && m.status !== 'upcoming') {
      if (!S.noted[`start:${call.matchId}`]) todo.push((s) => {
        s.noted[`start:${call.matchId}`] = 1;
        if (s.calls[call.matchId]) s.calls[call.matchId].closed = true;
        addLog(s, 'Сайт', `Матч начался: ${call.stage}, ${courtTo(call.court)}. Вызов закрыт.`, { kind: 'start' });
      });
      continue;
    }
    const cs = clocksOf(call);
    const held = cs.some((c) => c.state === 'playing' || c.state === 'held');
    const run = cs.find((c) => c.state === 'waiting' || c.state === 'expired');
    const kf = `free:${call.matchId}`;
    if (held && !call.wasHeld) {
      todo.push((s) => { const x = s.calls[call.matchId]; if (x) x.wasHeld = 1; });
    }
    if (!held && run && run.from > call.at + 0.01 && call.wasHeld && !S.noted[kf]) {
      todo.push((s) => { s.noted[kf] = 1; addLog(s, 'Сайт', `Обе пары и корт свободны — часы вызова пошли с ${L.hhmm(run.from)}.`, { kind: 'free' }); });
    }
    call.pairs.forEach((pid, i) => {
      const c = cs[i];
      const ke = `exp:${pid}:${call.matchId}`;
      if (c.state === 'expired' && !S.noted[ke]) {
        const text = c.read
          ? `Прошло 20 минут после начала часов для пары ${pairNames(pid)}, на корте не отмечена. Решение — за судьёй.`
          : `Прошло 20 минут после начала часов для пары ${pairNames(pid)}. Вызов на телефоне не прочитан — вызовите голосом.`;
        todo.push((s) => { s.noted[ke] = 1; addLog(s, 'Сайт', text, { kind: 'expired' }); });
      }
    });
  }
  if (todo.length) update((s) => todo.forEach((f) => f(s)));
}

/* ------------------------------------------------------------------ шапка */

function renderClock() {
  $('dk-now').textContent = L.hhmm(now());
  const playing = demoMatches().some((m) => store.isAutoplaying(m.id));
  $('dk-play').textContent = playing ? 'Остановить игру на кортах' : 'Запустить игру на кортах';
}

/* ------------------------------------------------------------------ 01 · корты */

function scoreWord(m) {
  const v = store.view(m.id);
  if (!v) return '';
  if (v.outcome && v.outcome !== 'played') return v.outcomeText;
  return v.scoreLong || `${v.games[0]}:${v.games[1]}`;
}

function renderCourts() {
  const F = forecasts();
  const byCourt = new Map();
  for (const m of demoMatches()) {
    if (!byCourt.has(m.court)) byCourt.set(m.court, []);
    byCourt.get(m.court).push(m);
  }
  const courts = [...byCourt.keys()].sort((a, b) => courtNum(a) - courtNum(b));
  const liveN = demoMatches().filter(isLive).length;
  $('dk-courts-meta').textContent = `${courts.length} ${plural(courts.length, 'корт', 'корта', 'кортов')} · идёт ${liveN}`;
  $('dk-courts').innerHTML = courts.map((court) => {
    const ms = byCourt.get(court).slice().sort((a, b) => L.toMin(a.scheduled) - L.toMin(b.scheduled));
    const live = ms.find(isLive);
    const next = ms.find((m) => m.status === 'upcoming');
    const done = ms.filter((m) => m.status === 'finished').pop();
    let now = '';
    if (live) {
      const v = store.view(live.id);
      const short = live.format && live.format.gamesToWin !== 6 ? ` · сет до ${live.format.gamesToWin} геймов` : '';
      now = `<div class="dk-court__now">
        <p class="cap">${esc(live.stage)}${esc(short)}</p>
        <div class="dk-court__plates">${live.pairs.map((p, side) => pairPlateHTML(pairOf(p), playersOfPair(p), { size: 'sm', view: v, side })).join('')}</div>
        <p class="dk-court__eta">Закончится ${about(F.ends.get(live.id))} ${band}</p>
      </div>`;
    } else if (done) {
      now = `<div class="dk-court__now dk-court__now--done"><p class="cap">Сыгран · ${esc(done.stage)}</p><p class="dk-court__last">${pairChip(done.pairs[0])} <span class="dk-dash">—</span> ${pairChip(done.pairs[1])}</p><p class="dk-court__eta num">${esc(scoreWord(done))}</p></div>`;
    }
    let nx = '';
    if (next) {
      const f = F.starts.get(next.id);
      const waits = f.pf.map((x, i) => (x.match ? `${esc(pairNames(next.pairs[i]))} доигрывает на ${esc(courtAt(x.court))}` : null)).filter(Boolean);
      nx = `<div class="dk-court__next">
        <p class="cap">Дальше · ${esc(next.stage)}${next.category ? ` · ${esc(next.category)}` : ''}</p>
        <p class="dk-court__last">${pairChip(next.pairs[0])} <span class="dk-dash">—</span> ${pairChip(next.pairs[1])}</p>
        <p class="dk-court__start">Начало ${about(f.at)} ${band}</p>
        <p class="dk-court__plan">по программе ${esc(next.scheduled)}${waits.length ? ` · ${waits.join('; ')}` : ''}</p>
      </div>`;
    } else if (!live) {
      nx = '<p class="dk-court__free">Корт свободен до конца вечера</p>';
    }
    return `<article class="dk-court${live ? ' is-live' : ''}">
      <header class="dk-court__head"><h3 class="dk-court__name">${esc(court)}</h3>${live ? '<span class="tag tag--live">LIVE</span>' : next ? `<span class="tag tag--soon">Скоро · ${esc(next.scheduled)}</span>` : '<span class="tag tag--done">Свободен</span>'}</header>
      ${now}${nx}
    </article>`;
  }).join('');

  $('dk-assume').innerHTML = `Как считается прогноз: оставшиеся геймы при равных силах × ${fmt1(model.minutesPerGame({}))} минуты на гейм. Минуты на гейм — 50-минутный круг из программ лиги, делённый на ${fmt1(model.actual, 2)} гейма — столько в среднем длится групповой сет (${fmtInt(model.matches)} ${plural(model.matches, 'полный сет', 'полных сета', 'полных сетов')} архива 2023–2026). <b>Допущение: время матча зависит от числа геймов. Замеров времени у лиги нет</b> — пульт начнёт их копить с первого турнира.`;
  renderTight(F);
}

function renderTight(F) {
  const rows = [];
  for (const p of pairs.filter((x) => x.demo)) {
    const next = demoMatches().filter((m) => m.status === 'upcoming' && m.pairs.includes(p.id)).sort((a, b) => F.starts.get(a.id).at - F.starts.get(b.id).at)[0];
    if (!next) continue;
    const lm = livePairMatch(p.id, next.id);
    const prevEnd = lm ? F.ends.get(lm.id) : lastFinish(p.id, next.id);
    if (prevEnd == null || !Number.isFinite(prevEnd)) continue;
    const st = F.starts.get(next.id).at;
    rows.push({ p, lm, next, prevEnd, st, gap: st - prevEnd });
  }
  rows.sort((a, b) => a.gap - b.gap);
  const hint = S.hint || 15;
  for (const b of document.querySelectorAll('#dk-hint .seg__btn')) b.setAttribute('aria-pressed', String(Number(b.dataset.hint) === hint));
  $('dk-tight').innerHTML = rows.length ? `<ul class="dk-tight__list">${rows.map((r) => {
    const tight = r.gap < hint;
    const prev = r.lm ? `матч на ${esc(courtAt(r.lm.court))} закончится ${about(r.prevEnd)}` : `предыдущий матч закончился в ${L.hhmm(r.prevEnd)}`;
    return `<li class="dk-tight__row${tight ? ' is-tight' : ''}">
      ${pairChip(r.p.id, 26)}
      <p class="dk-tight__what">${prev} → ${esc(r.next.stage.toLowerCase())} на ${esc(courtAt(r.next.court))} ${about(r.st)}</p>
      <p class="dk-tight__gap"><b class="num">${r.gap <= 0 ? 'без перерыва' : `≈ ${Math.round(r.gap)} мин`}</b> между матчами${tight ? ' <span class="dk-flag">впритык</span>' : ''}</p>
    </li>`;
  }).join('')}</ul>` : '<p class="dk-tight__none">Сейчас ни у одной пары нет двух матчей подряд.</p>';
}

/* ------------------------------------------------------------------ 02 · очередь вызовов */

function pairStateHTML(call, pid, F) {
  if (!call) {
    const f = F.pairFree(pid);
    return f.match ? `<span class="dk-st">доигрывает на ${esc(courtAt(f.court))}, освободится ${about(f.at)}</span>` : '<span class="dk-st">свободна</span>';
  }
  const c = clockOf(call, pid);
  const read = call.reads?.[pid];
  const rep = call.replies?.[pid];
  const marks = [`<span class="dk-mark">отправлено ${L.hhmm(call.at)}</span>`,
    read ? `<span class="dk-mark is-on">прочитано ${L.hhmm(read)}</span>` : '<span class="dk-mark is-off">не прочитано</span>'];
  if (rep) marks.push(`<span class="dk-mark is-on">${rep.kind === 'go' ? '«Иду»' : `«Нужно 5 минут» · к ${L.hhmm(rep.at + 5)}`} ${L.hhmm(rep.at)}</span>`);
  let clock = '';
  if (c.state === 'playing') clock = `<span class="dk-clk is-idle">доигрывает на ${esc(courtAt(c.court))} — часы стоят</span>`;
  else if (c.state === 'held') clock = `<span class="dk-clk is-idle">${esc(L.judgePairLine(c))}</span>`;
  else if (c.state === 'waiting') clock = `<span class="dk-clk"><b class="num">${L.mmss(c.elapsed)}</b> из 20:00</span>`;
  else if (c.state === 'expired') clock = read
    ? '<span class="dk-clk is-over"><b class="num">20:00</b> из 20:00 · на корте не отмечена — решение за судьёй</span>'
    : '<span class="dk-clk is-unread"><b class="num">20:00</b> из 20:00 · вызов не прочитан — вызовите голосом</span>';
  else if (c.state === 'oncourt') clock = `<span class="dk-clk is-done">на корте с ${L.hhmm(c.at)}</span>`;
  else if (c.state === 'started') clock = '<span class="dk-clk is-done">матч начался</span>';
  return `<span class="dk-marks">${marks.join('')}</span>${clock}`;
}

function renderQueue() {
  const F = forecasts();
  const list = demoMatches()
    .filter((m) => m.status === 'upcoming' || (S.calls[m.id] && !S.calls[m.id].closed))
    .sort((a, b) => L.toMin(a.scheduled) - L.toMin(b.scheduled));
  $('dk-queue').innerHTML = list.length ? list.map((m) => {
    const call = S.calls[m.id] && !S.calls[m.id].closed ? S.calls[m.id] : null;
    const f = F.starts.get(m.id);
    const st = call ? L.callStatus(clocksOf(call)) : null;
    return `<article class="dk-q${call ? ' is-called' : ''}${st && st.key === 'expired' ? ' is-over' : ''}">
      <header class="dk-q__head">
        <p class="cap cap--strong">${esc(m.stage)}${m.category ? ` · ${esc(m.category)}` : ''} · ${esc(m.court)}</p>
        <p class="dk-q__time">по программе ${esc(m.scheduled)}${f ? ` · начало ${about(f.at)} ${band}` : ''}</p>
      </header>
      <ul class="dk-q__pairs">${m.pairs.map((p) => `<li class="dk-q__pair">${pairChip(p, 26)}${pairStateHTML(call, p, F)}</li>`).join('')}</ul>
      <footer class="dk-q__foot">
        ${call
          ? `<p class="dk-q__status"><b>${esc(st.text)}</b> · вызов в ${L.hhmm(call.at)}, ${esc(call.by || 'Директор')}</p>
             <button class="btn btn--quiet btn--sm" type="button" data-act="cancel" data-m="${esc(m.id)}" data-key="cancel-${esc(m.id)}">Отменить вызов</button>`
          : `<button class="btn btn--primary" type="button" data-act="call" data-m="${esc(m.id)}" data-key="call-${esc(m.id)}">Вызвать на корт</button>`}
        <p class="dk-q__noshow">Неявку оформляет только судья на своём экране.</p>
      </footer>
    </article>`;
  }).join('') : '<p class="dk-q__none panel panel--pad">Будущих матчей в демо-вечере не осталось. «Сбросить демо» вернёт вечер к началу.</p>';
}

/* ------------------------------------------------------------------ 03 · окна: игрок, судья, табло */

let previewWho = playerId();
function whoChoices() {
  const call = activeCalls()[0];
  const base = call ? call.pairs : (demoMatches().find((m) => m.id === 'm-demo-final')?.pairs || []);
  const ids = base.map((p) => pairOf(p)?.players[0]).filter(Boolean);
  if (!ids.includes(previewWho) && myPairOf(previewWho)) ids.unshift(previewWho);
  return [...new Set(ids)];
}

function playerScreenHTML(pid, ctx) {
  const pair = myPairOf(pid);
  if (!pair) return '<p class="dk-ps__quiet">У этого игрока нет пары в демо-вечере.</p>';
  const me = playersOfPair(pair.id).find((p) => p.id === pid);
  const mate = playersOfPair(pair.id).find((p) => p.id !== pid);
  const call = activeCalls().find((c) => c.pairs.includes(pair.id));
  const head = `<p class="dk-ps__who">${pairBall(pair.id, 28)}<span>${esc(me?.name || '')}${mate ? ` · в паре с ${esc(withName(mate))}` : ''}</span></p>`;
  if (!call) {
    const F = forecasts();
    const next = demoMatches().filter((m) => m.status === 'upcoming' && m.pairs.includes(pair.id)).sort((a, b) => F.starts.get(a.id).at - F.starts.get(b.id).at)[0];
    return `${head}<p class="cap">Вызовов нет</p>
      <p class="dk-ps__title">${next ? `Ваш матч — ${esc(next.stage.toLowerCase())}` : (() => { const lm = demoMatches().filter((x) => x.status === 'live' && x.pairs.includes(pair.id)).sort((x, y) => String(y.scheduled || '').localeCompare(String(x.scheduled || '')))[0]; return lm ? `Ваш матч идёт — ${esc(lm.stage.toLowerCase())}` : 'Сегодня матчей больше нет'; })()}</p>
      ${next ? `<p class="dk-ps__line">${esc(next.court)} · начало ${about(F.starts.get(next.id).at)}</p><p class="dk-ps__quiet">Когда директор вызовет вас на корт, здесь появится вызов.</p>` : ''}`;
  }
  const opp = call.pairs.find((p) => p !== pair.id);
  const c = clockOf(call, pair.id);
  const rep = call.replies?.[pair.id];
  return `${head}<p class="cap">Вызов на корт</p>
    <p class="dk-ps__title">${c.state === 'playing' ? `Следующий матч — ${esc(call.court)}` : `Вас ждут на ${esc(courtAt(call.court))}`}</p>
    <p class="dk-ps__line">${esc(call.stage)} · вызов в ${L.hhmm(call.at)}</p>
    <p class="dk-ps__opp">Соперники: ${pairChip(opp, 22)}</p>
    ${c.state === 'playing' ? `<p class="dk-ps__note">Сначала доиграйте матч на ${esc(courtAt(c.court))} — время на выход начнётся после него.</p>` : ''}
    ${c.state === 'held' ? `<p class="dk-ps__note">${c.why === 'court' ? 'Корт ещё занят — время на выход начнётся, когда он освободится.' : 'Соперники ещё доигрывают — время на выход начнётся после их матча.'}</p>` : ''}
    <div class="dk-ps__btns">
      <button class="btn btn--primary btn--lg" type="button" data-act="go" data-m="${esc(call.matchId)}" data-p="${esc(pair.id)}" data-key="go-${ctx}" aria-pressed="${rep?.kind === 'go'}">Иду</button>
      <button class="btn btn--secondary btn--lg" type="button" data-act="five" data-m="${esc(call.matchId)}" data-p="${esc(pair.id)}" data-key="five-${ctx}" aria-pressed="${rep?.kind === 'five'}">Нужно 5 минут</button>
    </div>
    <p class="dk-ps__sent" role="status">${rep ? `Ответ отправлен: ${rep.kind === 'go' ? '«Иду»' : '«Нужно 5 минут»'} · ${L.hhmm(rep.at)}` : ''}</p>
    <p class="dk-ps__rule">По Кодексу лиги (пункт 2.1) пара выходит на корт в течение 20 минут после вызова. Если что-то мешает — скажите судье.</p>`;
}

function judgeHTML() {
  const calls = activeCalls();
  if (!calls.length) return '<div class="dk-js"><p class="cap">Вызовы</p><p class="dk-js__main">Вызова нет</p><p class="dk-js__sub">Когда директор вызовет пары, здесь появится полоса с отсчётом.</p></div>';
  return calls.map((call) => {
    const clocks = clocksOf(call);
    const st = L.callStatus(clocks);
    const lead = L.leadClock(clocks);
    const waitingIds = call.pairs.filter((p, i) => clocks[i].state === 'waiting' || clocks[i].state === 'expired');
    const main = st.key === 'both' ? 'Обе пары на корте'
      : lead ? `Ждём ${waitingIds.length > 1 ? 'обе пары' : `пару ${esc(pairNames(waitingIds[0]))}`} · <b class="num">${L.mmss(lead.elapsed)}</b> из 20:00`
        : 'Часы стоят';
    const unreadOver = clocks.some((c) => c.state === 'expired' && !c.read);
    const over = (unreadOver ? '<p class="dk-js__over dk-js__over--soft">Вызов на телефоне не прочитан — значит, мог и не дойти. Вызовите пару голосом; запись времени — подсказка, а не доказательство.</p>' : '')
      + (st.key === 'expired' ? '<p class="dk-js__over">Прошло 20 минут, пара на корте не отмечена. Решение за судьёй: неявку оформляют только на экране судьи, сайт сам ничего не ставит.</p><a class="btn btn--quiet btn--sm" href="judge.html">Открыть экран судьи</a>' : '');
    return `<div class="dk-js${st.key === 'expired' ? ' is-over' : ''}">
      <p class="cap">${esc(call.court)} · ${esc(call.stage)}</p>
      <p class="dk-js__main">${main}</p>
      <p class="dk-js__sub">${esc(st.text)}</p>
      <ul class="dk-js__pairs">${call.pairs.map((p, i) => {
        const c = clocks[i];
        const label = c.state === 'oncourt' ? `на корте с ${L.hhmm(c.at)}` : L.judgePairLine(c, { read: c.read, court: c.court ? courtAt(c.court) : '' });
        const btn = (c.state === 'waiting' || c.state === 'expired') ? `<button class="btn btn--secondary btn--sm" type="button" data-act="oncourt" data-m="${esc(call.matchId)}" data-p="${esc(p)}" data-key="oc-${esc(p)}">На корте</button>` : '';
        return `<li>${pairChip(p, 22)}<span class="dk-js__st">${esc(label)}</span>${btn}</li>`;
      }).join('')}</ul>
      ${over}
    </div>`;
  }).join('');
}

function boardHTML() {
  const calls = activeCalls();
  if (!calls.length) return '<p class="dk-bl"><span class="dk-bl__label">Вызовы</span><span class="dk-bl__text">Сейчас вызовов нет</span></p>';
  return calls.map((c) => `<p class="dk-bl"><span class="dk-bl__label">Вызываются на ${esc(courtTo(c.court))}</span><span class="dk-bl__text">${pairChip(c.pairs[0], 24)} <span class="dk-dash">—</span> ${pairChip(c.pairs[1], 24)}</span></p>`).join('');
}

function renderPreviews() {
  const opts = whoChoices();
  if (!opts.includes(previewWho)) previewWho = opts[0] || previewWho;
  $('dk-who').innerHTML = opts.map((id) => {
    const pr = myPairOf(id);
    return `<button class="seg__btn" type="button" data-who="${esc(id)}" data-key="who-${esc(id)}" aria-pressed="${id === previewWho}">${esc(pr ? pairNames(pr.id) : id)}</button>`;
  }).join('');
  $('dk-prev-player').innerHTML = playerScreenHTML(previewWho, 'prev');
  $('dk-prev-judge').innerHTML = judgeHTML();
  $('dk-prev-board').innerHTML = boardHTML();
}

function renderPlayerView() {
  $('dk-player').innerHTML = playerScreenHTML(playerId(), 'tab');
  $('dk-board').innerHTML = boardHTML();
  // «прочитано» ставит только открытый экран игрока, не окно предпросмотра у директора
  if (view === 'player' && document.visibilityState === 'visible') {
    const pair = myPairOf(playerId());
    const call = pair && activeCalls().find((c) => c.pairs.includes(pair.id));
    if (call && !call.reads?.[pair.id]) markRead(call.matchId, pair.id);
  }
}

/* ------------------------------------------------------------------ 04 · дождь */

const DAYS = A.days2026.map((d) => ({ ...d, sun: L.sunTimes(d.date) }));

function rainInputs() {
  const r = S.rain;
  const rainAt = L.toMin(r.rainAt) ?? L.toMin('11:20');
  let dryAt = L.toMin(r.dryAt) ?? rainAt;
  const fixed = dryAt < rainAt;
  if (fixed) dryAt = rainAt;
  const day = DAYS.find((d) => d.date === r.day) || DAYS[0];
  return { rainAt, dryAt, day, fixed };
}

function renderRain() {
  const { rainAt, dryAt, day, fixed } = rainInputs();
  const daySel = $('dk-day');
  if (!daySel.options.length) {
    daySel.innerHTML = DAYS.map((d) => `<option value="${d.date}">${esc(d.name)} · ${fmtDate(d.date)} · закат ${L.hhmm(d.sun.sunset)}</option>`).join('');
  }
  if (daySel.value !== day.date) daySel.value = day.date;
  if (document.activeElement !== $('dk-rainat')) $('dk-rainat').value = S.rain.rainAt;
  if (document.activeElement !== $('dk-dryat')) $('dk-dryat').value = S.rain.dryAt;
  $('dk-day-hint').textContent = `Закат в Алматы ${L.hhmm(day.sun.sunset)}, гражданские сумерки до ${L.hhmm(day.sun.dusk)}. Считаем по закату: про освещение кортов правило уточняется у лиги.`;

  const plan = L.planDay();
  const sep = DAYS.find((d) => d.date.slice(5, 7) === '09');
  $('dk-rain-lede').innerHTML = `${A.springTournaments} из ${A.tournaments} турниров лиги прошли в апреле и мае — в сезон дождей. Полный день — 32 пары, 48 групповых матчей и 30 матчей плей-офф, всего 78 (так сыграны ${A.fullDays} из ${A.tournaments} турниров архива). На 8 кортах это 11 кругов по 50 минут: с 08:45 до ${L.hhmm(plan.end)}.${sep ? ` В сентябре день почти упирается в темноту: ${esc(sep.name)} ${fmtDate(sep.date)} — закат в ${L.hhmm(sep.sun.sunset)}.` : ''}`;

  const tiles = L.rainOptions({ model, rainAt, dryAt, lightEnd: day.sun.sunset });
  const snap = L.snapshotAt(L.buildDay(), rainAt);
  const total = L.countMatches(L.buildDay());
  const left = snap.remaining.length;
  $('dk-rainstats').innerHTML = [
    ['Дождь', L.hhmm(rainAt), `перерыв ${L.dur(dryAt - rainAt)}${fixed ? ' · «готовы» раньше начала — считаем без перерыва' : ''}`],
    ['Сыграно', `${snap.played.length} из ${total}`, `по программе к ${L.hhmm(rainAt)}; прервано ${snap.inProgress.length}, впереди ${left}`],
    ['Без дождя', L.hhmm(plan.end), 'конец дня по программе'],
    ['Закат', L.hhmm(day.sun.sunset), `${esc(day.name)} · ${fmtDate(day.date)}`],
  ].map(([k, n, s]) => `<div class="stat"><span class="cap">${k}</span><b class="stat__n num">${n}</b><span class="dk-stat__sub">${s}</span></div>`).join('');

  const pick = S.rain.pick;
  $('dk-tiles').innerHTML = tiles.map((t) => {
    const fit = t.fits ? `<p class="dk-tile__fit is-ok">Укладывается до заката · запас ${L.dur(t.margin)}</p>`
      : `<p class="dk-tile__fit is-no">Не укладывается · после заката ${L.dur(-t.margin)}</p>`;
    let warn = '';
    if (t.nothingToCut) warn = '<p class="dk-tile__warn">Групповой этап уже сыгран — сокращать в группах нечего.</p>';
    else if (t.mixedGroups.length) warn = `<p class="dk-tile__warn"><b>В ${t.mixedGroups.length} ${plural(t.mixedGroups.length, 'группе', 'группах', 'группах')} (${t.mixedGroups.join(', ')}) окажутся матчи разной длины:</b> часть сыграна до 6 геймов, остальные — до 4. Процент геймов, которым решаются равенства, станет несравнимым. Сокращайте стадию целиком.</p>`;
    else if (t.key === 'po4') warn = `<p class="dk-tile__ok">Группы доигрываются в полном формате — процент геймов внутри группы сравним.${t.poAlreadyFull ? ` Но ${t.poAlreadyFull} ${plural(t.poAlreadyFull, 'матч', 'матча', 'матчей')} плей-офф уже начаты в полном формате.` : ''}</p>`;
    else if ((t.key === 'groups4' || t.key === 'groups4d') && t.affected) warn = '<p class="dk-tile__ok">Групповой этап ещё не начат — все группы играют в одном формате.</p>';
    const rule = t.key === 'asis' ? 'Все матчи — один сет до 6 геймов.'
      : t.key === 'groups4' ? 'Несыгранные групповые — сет до 4 геймов.'
        : t.key === 'groups4d' ? 'Несыгранные групповые — до 4 геймов и решающее очко при первом «ровно».'
          : 'Весь плей-офф — сет до 4 геймов, группы как есть.';
    return `<button class="dk-tile${t.fits ? ' fits' : ''}" type="button" role="radio" aria-checked="${pick === t.key}" data-tile="${t.key}" data-key="tile-${t.key}">
      <span class="dk-tile__title">${esc(t.title)}</span>
      <span class="dk-tile__rule">${rule}</span>
      <span class="dk-tile__end"><span class="cap">конец около</span><b class="num">${L.hhmm(L.round5(t.end))}</b></span>
      ${fit.replace(/<p/g, '<span').replace(/<\/p>/g, '</span>')}
      <span class="dk-tile__aff">Затронуто матчей: <b class="num">${t.affected}</b> из ${left + snap.inProgress.length}</span>
      ${warn.replace(/<p/g, '<span').replace(/<\/p>/g, '</span>')}
    </button>`;
  }).join('');

  const sel = tiles.find((t) => t.key === pick);
  $('dk-decide').disabled = !sel;
  renderHow();
}

function renderHow() {
  const sc = A.scores;
  const odd = A.oddScores.map((o) => `${o.score} (${esc(o.t)})`).join(', ');
  const pro = A.proSet8.map((x) => esc(x.tournament.replace(/ · .*/, ''))).join(', ');
  $('dk-how').innerHTML = `<ol class="dk-how__list">
    <li><b>Длина полного матча.</b> В программах лиги круг — 50 минут (Жигули Open 2023: 09:00–09:50, 09:50–10:40…; Итоговый 2023: три круга плей-офф подряд с перерывами 0 и 10 минут). Восемь кортов, начало в 08:45.</li>
    <li><b>Сколько геймов в сете.</b> В архиве ${fmtInt(A.groupMatches)} ${plural(A.groupMatches, 'групповой матч', 'групповых матча', 'групповых матчей')}, из них ${fmtInt(A.completeSets)} — полные сеты; в среднем ${fmt1(model.actual, 2)} гейма (6:4 — ${sc['6:4']}, 6:3 — ${sc['6:3']}, 6:2 — ${sc['6:2']}, 7:6 — ${sc['7:6']}…).</li>
    <li><b>Сет до 4 геймов.</b> Для каждого матча архива берём долю выигранных геймов и считаем, сколько геймов длился бы сет до 6 и до 4. Расчёт даёт ${fmt1(model.model6, 2)} и ${fmt1(model.model4, 2)} гейма. Он ниже факта (${fmt1(model.actual, 2)}), поэтому берём только отношение: до 4 — около ${fmt1(model.games4)} гейма, то есть ${mins(model.minutes({ gamesToWin: 4 }))} вместо 50.</li>
    <li><b>Решающее очко.</b> По правилу лиги после первого «ровно» играют «больше-меньше», после второго — решающее очко: в среднем ${fmt1(model.ppgL, 2)} розыгрыша в гейме. Сразу решающее очко — ${fmt1(model.ppgD, 2)}: гейм короче на ${Math.round((1 - model.ppgD / model.ppgL) * 100)} процентов. Матч до 4 с решающим очком — около ${mins(model.minutes({ gamesToWin: 4, deuce: 'deciding' }), 'minuty')}.</li>
    <li><b>Порядок.</b> Круги идут друг за другом: 3 тура групп по 2 круга, потом 1/8, 1/4, 1/2 и финалы двух категорий. Прерванные дождём матчи доигрываются первыми и в своём формате — <span class="dk-q-league">правило уточняется у лиги</span>.</li>
    <li><b>Свет.</b> Закат считается по формуле NOAA для Алматы (UTC+5 с марта 2024 года). Есть ли на кортах освещение — <span class="dk-q-league">уточняется у лиги</span>.</li>
    <li><b>Что ещё видно в архиве.</b> Формат лига уже меняла: в плей-офф играли про-сет до 8 геймов (${pro}). ${A.oddScores.length} групповых матчей закончились неполным счётом: ${odd} — причину архив не хранит. Ещё ${A.zeroZero.count} ${plural(A.zeroZero.count, 'матч записан', 'матча записаны', 'матчей записаны')} как 0:0: причину архив тоже не хранит.</li>
  </ol>`;
}

/* ------------------------------------------------------------------ 05 · журнал */

function renderLog() {
  const t = L.averageTurnout(S.log);
  $('dk-turnout').innerHTML = t
    ? `После турнира эта цифра появится впервые: <b>на корт выходят в среднем за ${Math.round(t.avg)} мин</b> после начала часов (по ${t.n} ${plural(t.n, 'отметке', 'отметкам', 'отметкам')} судьи; по турниру в целом, без имён).`
    : 'После турнира здесь появится цифра, которой у лиги нет: за сколько минут после вызова пары в среднем выходят на корт — по турниру в целом, без имён.';
  $('dk-log').innerHTML = S.log.length
    ? S.log.map((e) => `<li class="dk-log__row dk-log__row--${esc(e.kind || 'x')}"><time class="num">${L.hhmm(e.at)}</time><span class="dk-log__who">${esc(e.who)}</span><span class="dk-log__text">${esc(e.text)}</span></li>`).join('')
    : '<li class="dk-log__empty">Пока пусто. Вызовите пару на корт — запись появится здесь.</li>';
}

/* ------------------------------------------------------------------ отрисовка с сохранением фокуса */

function keepFocus(fn) {
  const a = document.activeElement;
  const key = a && a.dataset ? a.dataset.key : null;
  fn();
  if (key) {
    const el = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (el && el !== document.activeElement) el.focus({ preventScroll: true });
  }
}

function renderLive() {
  keepFocus(() => {
    renderClock();
    renderQueue();
    renderPreviews();
    renderPlayerView();
  });
}
function renderAll() {
  keepFocus(() => {
    renderClock();
    renderCourts();
    renderQueue();
    renderPreviews();
    renderPlayerView();
    renderRain();
    renderLog();
  });
}

/* ------------------------------------------------------------------ события */

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const { act, m, p } = b.dataset;
  if (act === 'call') return doCall(m);
  if (act === 'cancel') return cancelCall(m);
  if (act === 'go') return reply(m, p, 'go');
  if (act === 'five') return reply(m, p, 'five');
  if (act === 'oncourt') return onCourt(m, p);
  if (b.dataset.who) { previewWho = b.dataset.who; return renderLive(); }
  if (b.dataset.tile) { update((s) => { s.rain.pick = b.dataset.tile; }); return; }
  if (b.dataset.hint) { update((s) => { s.hint = Number(b.dataset.hint); }); return; }
  if (b.dataset.view && b.closest('#dk-view')) return setView(b.dataset.view);
});

// стрелки в группе плиток (role=radiogroup)
$('dk-tiles').addEventListener('keydown', (e) => {
  if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
  const all = [...document.querySelectorAll('#dk-tiles .dk-tile')];
  const i = all.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const j = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length;
  all[j].focus();
  update((s) => { s.rain.pick = all[j].dataset.tile; });
});

$('dk-day').addEventListener('change', (e) => update((s) => { s.rain.day = e.target.value; }));
for (const id of ['dk-rainat', 'dk-dryat']) {
  $(id).addEventListener('change', (e) => {
    if (!L.toMin(e.target.value) && e.target.value !== '00:00') return;
    update((s) => { s.rain[id === 'dk-rainat' ? 'rainAt' : 'dryAt'] = e.target.value; });
  });
}

$('dk-decide').addEventListener('click', () => {
  const name = $('dk-judge-name').value.trim();
  const msg = $('dk-decide-msg');
  const { rainAt, dryAt, day } = rainInputs();
  const t = L.rainOptions({ model, rainAt, dryAt, lightEnd: day.sun.sunset }).find((x) => x.key === S.rain.pick);
  if (!t) { msg.textContent = 'Сначала выберите вариант.'; return; }
  if (!name) { msg.textContent = 'Впишите имя главного судьи: решение подписывает он.'; $('dk-judge-name').focus(); return; }
  update((s) => {
    addLog(s, `Главный судья · ${name}`, `Решение по дождю (${L.hhmm(rainAt)}–${L.hhmm(dryAt)}): «${t.title}». Конец дня около ${L.hhmm(L.round5(t.end))}, ${t.fits ? `до заката ${L.dur(t.margin)}` : `после заката ${L.dur(-t.margin)}`}; затронуто матчей: ${t.affected}.`, { kind: 'decision' });
  });
  msg.textContent = `Записано в журнал в ${L.hhmm(now())}. Формат матчей судьи меняют на своих экранах — сайт сам ничего не переставил.`;
});

$('dk-plus5').addEventListener('click', () => {
  update((s) => { s.clock.jumps = [...(s.clock.jumps || []), { real: Date.now(), add: 5 }]; addLog(s, 'Демо', 'Демо-время передвинуто на 5 минут вперёд.', { kind: 'demo' }); });
});

$('dk-play').addEventListener('click', () => {
  const live = demoMatches().filter(isLive);
  const msg = $('dk-clock-msg');
  if (live.some((m) => store.isAutoplaying(m.id))) {
    live.forEach((m) => store.stopAutoplay(m.id));
    msg.textContent = 'Игра на кортах остановлена.';
  } else {
    const res = live.map((m) => store.tryAutoplay(m.id, { speed: 3 }));
    msg.textContent = res.some((r) => r.reason === 'claimed') ? 'Часть матчей ведёт судья — их сайт не трогает.' : live.length ? 'Матчи на кортах играются сами: счёт и прогноз меняются.' : 'Сейчас на кортах ничего не идёт.';
  }
  renderClock();
});

let resetArmed = 0;
$('dk-reset').addEventListener('click', () => {
  const msg = $('dk-clock-msg');
  if (Date.now() - resetArmed > 4000) {
    resetArmed = Date.now();
    msg.textContent = 'Нажмите ещё раз: вечер вернётся к 18:10, вызовы и журнал очистятся, а счёт всех демо-матчей на всех экранах вернётся к началу.';
    $('dk-reset').textContent = 'Точно сбросить?';
    return;
  }
  resetArmed = 0;
  $('dk-reset').textContent = 'Сбросить демо';
  const skipped = demoMatches().filter((m) => store.tryReset(m.id).reason === 'claimed').length;
  update((s) => { const f = fresh(); Object.assign(s, f); });
  msg.textContent = skipped ? `Демо сброшено. ${skipped} ${plural(skipped, 'матч ведёт', 'матча ведёт', 'матчей ведёт')} судья — ${skipped === 1 ? 'его' : 'их'} счёт не тронут.` : 'Демо сброшено: 18:10, вызовов нет.';
});

store.subscribe(() => { renderAll(); watchCalls(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') renderPlayerView(); });
window.addEventListener('pageshow', (e) => { if (e.persisted) { const s = load(); if (s) S = s; renderAll(); } });

let ticks = 0;
setInterval(() => {
  ticks++;
  if (ticks % 10 === 0) renderAll(); else renderLive();
  watchCalls();
}, 1000);

setView(view, false);
watchCalls();
