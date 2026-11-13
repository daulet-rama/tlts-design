// TLTS · desk.logic.js — чистые расчёты экрана «Пульт турнирного дня».
// Без DOM и хранилища: время — в минутах от полуночи (дробные можно), всё проверяется тестами
// ideas/tests/desk.test.mjs (node --test).

/* ------------------------------------------------------------------ время */

export const SLOT_MIN = 50;        // круг в программах лиги: Жигули Open 2023, день 2 — по 50 минут
export const COURTS = 8;           // 8 кортов в программах Жигули Open и Итогового 2023
export const DAY_START = 8 * 60 + 45; // 08:45 — начало игр по программам
export const CALL_LIMIT = 20;      // Кодекс, пункт 2.1: 20 минут после вызова
export const FORECAST_BAND = 10;   // «± 10 минут»: ширина подписи прогноза, не замер

export function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// 1093.4 → «18:13»; округление до минуты вниз, сутки по кругу
export function hhmm(min) {
  if (!Number.isFinite(min)) return '—';
  const t = ((Math.floor(min + 1e-9) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// 14.333 → «14:20» (минуты:секунды)
export function mmss(min) {
  if (!Number.isFinite(min)) return '—';
  const s = Math.max(0, Math.floor(min * 60 + 1e-6));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// 95 → «1 ч 35 мин», 40 → «40 мин»
export function dur(min) {
  const m = Math.round(Math.abs(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} мин`;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
}

// прогноз округляем до 5 минут: «около 18:40»
export const round5 = (min) => Math.round(min / 5) * 5;

/* ------------------------------------------------------------------ модель длины матча */

// Ожидаемое число геймов в сете до N (разница в два, при N:N — тай-брейк, он считается одним геймом),
// если одна пара выигрывает гейм с вероятностью q. Счёт (a, b) — откуда считать.
export function expectedGames(N, q = 0.5, a = 0, b = 0) {
  const memo = new Map();
  const done = (x, y) => (x === N + 1 || y === N + 1 || (x === N && y <= N - 2) || (y === N && x <= N - 2));
  function E(x, y) {
    if (done(x, y)) return 0;
    if (x === N && y === N) return 1; // тай-брейк
    const k = x * 100 + y;
    if (memo.has(k)) return memo.get(k);
    const v = 1 + q * E(x + 1, y) + (1 - q) * E(x, y + 1);
    memo.set(k, v);
    return v;
  }
  return E(a, b);
}

// Ожидаемое число розыгрышей в гейме при вероятности выиграть розыгрыш p.
// deuce: 'league' — первое «ровно» → «больше/меньше», второе «ровно» → решающее очко (правило лиги);
//        'deciding' — сразу решающее очко при «ровно» (сокращённый регламент).
export function pointsPerGame(deuce = 'league', p = 0.5) {
  const fromDeuce = deuce === 'deciding' ? 1 : 2 + 2 * p * (1 - p);
  const memo = new Map();
  function E(i, j) {
    if (i === 4 || j === 4) return 0;
    if (i === 3 && j === 3) return fromDeuce;
    const k = i * 10 + j;
    if (memo.has(k)) return memo.get(k);
    const v = 1 + p * E(i + 1, j) + (1 - p) * E(i, j + 1);
    memo.set(k, v);
    return v;
  }
  return E(0, 0);
}

// Модель по счёту групповых матчей архива: { '6:4': 339, ... }.
// Для каждого матча q = доля выигранных геймов; модель сравнивается с фактом (калибровка),
// а длина короткого сета берётся как факт × (модель до 4 / модель до 6).
export function makeModel(scores, slot = SLOT_MIN) {
  let n = 0, games = 0, e6 = 0, e4 = 0;
  for (const [k, cnt] of Object.entries(scores || {})) {
    const [w, l] = k.split(':').map(Number);
    if (!(w + l > 0) || !(cnt > 0)) continue;
    const q = w / (w + l);
    n += cnt;
    games += cnt * (w + l);
    e6 += cnt * expectedGames(6, q);
    e4 += cnt * expectedGames(4, q);
  }
  const actual = games / n;
  const model6 = e6 / n;
  const model4 = e4 / n;
  const ppgL = pointsPerGame('league');
  const ppgD = pointsPerGame('deciding');
  const gamesFor = (gtw) => (gtw === 4 ? actual * (model4 / model6) : actual);
  const ppg = (deuce) => (deuce === 'deciding' ? ppgD : ppgL);
  // время матча считаем пропорциональным числу розыгрышей: геймы × розыгрыши в гейме
  const minutes = (fmt = {}) => slot * (gamesFor(fmt.gamesToWin || 6) / actual) * (ppg(fmt.deuce) / ppgL);
  const minutesPerGame = (fmt = {}) => (slot / actual) * (ppg(fmt.deuce) / ppgL);
  return { matches: n, actual, model6, model4, games4: gamesFor(4), ppgL, ppgD, slot, minutes, minutesPerGame };
}

/* ------------------------------------------------------------------ турнирный день */

const GROUP_LETTERS = 'ABCDEFGH';

// Полный день: 8 групп по 4 пары (3 тура по 2 матча в группе) и плей-офф двух категорий
// (1/8 — 8 + 8, 1/4 — 4 + 4, 1/2 — 2 + 2, финалы — 1 + 1). Итого 48 + 30 = 78 матчей.
export function buildDay({ groups = 8 } = {}) {
  const waves = [];
  for (let r = 1; r <= 3; r++) {
    const matches = [];
    for (let g = 0; g < groups; g++) {
      const L = GROUP_LETTERS[g];
      matches.push({ id: `g${r}${L}1`, stage: 'group', group: L }, { id: `g${r}${L}2`, stage: 'group', group: L });
    }
    waves.push({ key: `g${r}`, label: `Группы, ${r}-й тур`, stage: 'group', matches });
  }
  for (const [key, label, n] of [['r16', '1/8 финала', 16], ['qf', '1/4 финала', 8], ['sf', '1/2 финала', 4], ['f', 'Финалы', 2]]) {
    waves.push({ key, label, stage: 'po', matches: Array.from({ length: n }, (_, i) => ({ id: `${key}-${i + 1}`, stage: 'po' })) });
  }
  return waves;
}

export const countMatches = (waves) => waves.reduce((a, w) => a + w.matches.length, 0);

// Расписание: круги идут по очереди (следующий начинается, когда кончился предыдущий),
// внутри круга матч занимает первый свободный корт.
//   busy — корты, занятые прерванными матчами: [{ id, until }]; skip — id сыгранных и прерванных
export function schedule(waves, { startAt, courts = COURTS, duration, busy = [], skip = new Set() }) {
  const free = Array.from({ length: courts }, () => startAt);
  const items = [];
  busy.slice(0, courts).forEach((b, i) => { free[i] = b.until; });
  const busyEnd = new Map(busy.map((b) => [b.id, b.until]));
  let barrier = startAt;
  let end = startAt;
  for (const w of waves) {
    let waveEnd = barrier;
    for (const m of w.matches) {
      if (busyEnd.has(m.id)) { waveEnd = Math.max(waveEnd, busyEnd.get(m.id)); continue; }
      if (skip.has(m.id)) continue;
      let c = 0;
      for (let i = 1; i < courts; i++) if (free[i] < free[c]) c = i;
      const st = Math.max(free[c], barrier);
      const en = st + duration(m, w);
      free[c] = en;
      items.push({ id: m.id, wave: w.key, stage: m.stage, group: m.group || null, court: c + 1, start: st, end: en });
      waveEnd = Math.max(waveEnd, en);
    }
    barrier = waveEnd;
    end = Math.max(end, waveEnd);
  }
  return { items, end };
}

// План дня без сюрпризов: все матчи по 50 минут.
export function planDay(waves = buildDay(), { startAt = DAY_START, slot = SLOT_MIN, courts = COURTS } = {}) {
  return schedule(waves, { startAt, courts, duration: () => slot });
}

// Что успели к началу дождя (по программе): сыгранные, прерванные (с долей сыгранного), оставшиеся.
export function snapshotAt(waves, rainAt, opts = {}) {
  const plan = planDay(waves, opts);
  const played = [], inProgress = [], remaining = [];
  for (const it of plan.items) {
    if (it.end <= rainAt) played.push(it);
    else if (it.start < rainAt) inProgress.push({ ...it, doneFrac: (rainAt - it.start) / (it.end - it.start) });
    else remaining.push(it);
  }
  return { plan, played, inProgress, remaining };
}

export const RAIN_OPTIONS = [
  { key: 'asis', title: 'Как есть', short: 'Без сокращений' },
  { key: 'groups4', title: 'Оставшиеся групповые до 4 геймов', short: 'Группы до 4' },
  { key: 'groups4d', title: 'То же и сразу решающее очко', short: 'Группы до 4 и решающее очко' },
  { key: 'po4', title: 'Сократить только плей-офф', short: 'Плей-офф до 4' },
];

function formatFor(key, it, remainingIds) {
  const full = { gamesToWin: 6, deuce: 'league' };
  if (!remainingIds.has(it.id)) return full; // прерванный матч доигрывается в своём формате
  if ((key === 'groups4' || key === 'groups4d') && it.stage === 'group') return { gamesToWin: 4, deuce: key === 'groups4d' ? 'deciding' : 'league' };
  if (key === 'po4' && it.stage === 'po') return { gamesToWin: 4, deuce: 'league' };
  return full;
}

// Четыре плитки «Дождь». Возвращает по каждой: когда закончится день, укладывается ли в свет,
// сколько матчей затронуто и в каких группах окажутся матчи разной длины.
export function rainOptions({ waves = buildDay(), model, startAt = DAY_START, slot = SLOT_MIN, courts = COURTS, rainAt, dryAt, lightEnd }) {
  const snap = snapshotAt(waves, rainAt, { startAt, slot, courts });
  const resume = Math.max(dryAt, rainAt);
  const remainingIds = new Set(snap.remaining.map((x) => x.id));
  const byId = new Map(snap.plan.items.map((x) => [x.id, x]));
  const busy = snap.inProgress.map((x) => ({ id: x.id, until: resume + (1 - x.doneFrac) * slot }));
  const skip = new Set(snap.played.map((x) => x.id));
  const groupsTouched = (pred) => [...new Set(snap.plan.items.filter(pred).map((x) => x.group))].filter(Boolean).sort();
  return RAIN_OPTIONS.map((o) => {
    const res = schedule(waves, {
      startAt: resume, courts, busy, skip,
      duration: (m) => model.minutes(formatFor(o.key, byId.get(m.id) || m, remainingIds)),
    });
    const affected = snap.remaining.filter((x) => formatFor(o.key, x, remainingIds).gamesToWin !== 6).length;
    let mixed = [];
    if (o.key === 'groups4' || o.key === 'groups4d') {
      const fullAlready = new Set(groupsTouched((x) => x.stage === 'group' && !remainingIds.has(x.id)));
      mixed = groupsTouched((x) => x.stage === 'group' && remainingIds.has(x.id)).filter((g) => fullAlready.has(g));
    }
    let poMixed = null;
    if (o.key === 'po4') {
      const started = snap.plan.items.filter((x) => x.stage === 'po' && !remainingIds.has(x.id));
      poMixed = started.length ? started.length : 0;
    }
    return {
      ...o,
      end: res.end,
      fits: res.end <= lightEnd,
      margin: lightEnd - res.end,
      affected,
      mixedGroups: mixed,
      poAlreadyFull: poMixed,
      nothingToCut: affected === 0 && o.key !== 'asis',
    };
  });
}

/* ------------------------------------------------------------------ свет: закат в Алматы */

// Алгоритм NOAA (точность около минуты). zenith 90.833° — закат, 96° — конец гражданских сумерек.
// Алматы: 43.24° с. ш., 76.95° в. д.; с 1 марта 2024 года Казахстан живёт по UTC+5.
export const ALMATY = { lat: 43.238, lon: 76.946 };
export function tzFor(iso) { return String(iso) >= '2024-03-01' ? 5 : 6; }

export function sunTimes(iso, { lat = ALMATY.lat, lon = ALMATY.lon, tz = tzFor(iso) } = {}) {
  const [y, mo, d] = String(iso).split('-').map(Number);
  const doy = Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 1)) / 864e5) + 1;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const g = (2 * Math.PI / (leap ? 366 : 365)) * (doy - 1 + (18 - 12) / 24);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const rad = Math.PI / 180;
  const at = (zen) => {
    const c = Math.cos(zen * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
    const ha = Math.acos(Math.max(-1, Math.min(1, c))) / rad;
    return 720 - 4 * (lon - ha) - eq + tz * 60;
  };
  return { sunset: at(90.833), dusk: at(96), tz };
}

/* ------------------------------------------------------------------ прогноз по живому счёту */

// Сколько минут ещё идти матчу: ожидаемые оставшиеся геймы при равных парах × минут на гейм.
export function remainingMinutes(view, model) {
  if (!view || view.finished) return 0;
  const N = view.gamesToWin || 6;
  const [a, b] = view.games || [0, 0];
  const fmt = { gamesToWin: N, deuce: view.format && view.format.deuce };
  return expectedGames(N, 0.5, a, b) * model.minutesPerGame(fmt);
}

// Начало будущего матча: не раньше программы, свободного корта и освободившихся пар.
export function forecastStart({ scheduled, courtFree = -Infinity, pairsFree = [] }) {
  return Math.max(scheduled, courtFree, ...pairsFree);
}

/* ------------------------------------------------------------------ вызов на корт */

// Часы одной пары. calledAt — когда вызвали; freeAt — когда пара освободилась (null — ещё играет);
// onCourtAt — судья отметил «на корте». Часы идут с max(вызов, освободилась).
export function pairClock({ calledAt, freeAt, onCourtAt = null, now }) {
  if (onCourtAt != null) return { state: 'oncourt', from: freeAt == null ? calledAt : Math.max(calledAt, freeAt), at: onCourtAt };
  if (freeAt == null) return { state: 'playing' };
  const from = Math.max(calledAt, freeAt);
  const elapsed = Math.max(0, now - from);
  return { state: elapsed >= CALL_LIMIT ? 'expired' : 'waiting', from, elapsed: Math.min(elapsed, CALL_LIMIT), left: Math.max(0, CALL_LIMIT - elapsed) };
}

// Часы вызова для всего матча. Матч может начаться, только когда свободны обе пары и корт,
// поэтому часы идут для обеих пар с одного момента: max(вызов, освободились обе пары, освободился корт).
// Пока одна пара доигрывает (freeAt: null) или корт занят (courtFreeAt: null), у второй часы стоят: 'held'.
//   pairs: [{ freeAt, onCourtAt }] — по паре на сторону; ответ — часы каждой пары в том же порядке.
export function matchClocks({ calledAt, pairs, courtFreeAt = -Infinity, now }) {
  const ps = pairs || [];
  const block = ps.some((p) => p.freeAt == null) ? 'opponents' : courtFreeAt == null ? 'court' : null;
  const start = block ? null : Math.max(calledAt, courtFreeAt, ...ps.map((p) => p.freeAt));
  return ps.map((p) => {
    if (p.onCourtAt != null) return { state: 'oncourt', from: start, at: p.onCourtAt };
    if (p.freeAt == null) return { state: 'playing' };
    if (start == null) return { state: 'held', why: block };
    const elapsed = Math.max(0, now - start);
    return { state: elapsed >= CALL_LIMIT ? 'expired' : 'waiting', from: start, elapsed: Math.min(elapsed, CALL_LIMIT), left: Math.max(0, CALL_LIMIT - elapsed) };
  });
}

// Сводка по вызову для судьи. read: false у часов — пара вызов не прочитала: тогда «срок вышел» не пишем,
// а просим вызвать голосом (запись помогает судье, но не доказывает, что вызов дошёл).
export function callStatus(clocks) {
  const s = clocks.map((c) => c.state);
  if (s.every((x) => x === 'oncourt')) return { key: 'both', text: 'Обе пары на корте' };
  const over = clocks.filter((c) => c.state === 'expired');
  if (over.some((c) => c.read !== false)) return { key: 'expired', text: 'Прошло 20 минут · решение за судьёй' };
  if (over.length) return { key: 'unread', text: 'Вызов не прочитан — вызовите голосом' };
  const waiting = s.filter((x) => x === 'waiting').length;
  if (!waiting && s.includes('playing')) return { key: 'playing', text: 'Пара ещё доигрывает · часы стоят' };
  if (!waiting && s.includes('held')) return { key: 'playing', text: 'Корт ещё занят · часы стоят' };
  if (waiting === 2) return { key: 'two', text: 'Ждём обе пары' };
  return { key: 'one', text: 'Ждём одну пару' };
}

// Строка о паре в полосе судьи. read — прочитала ли пара вызов; court — где она доигрывает («корте 4»).
export function judgePairLine(c, { read = true, court = '' } = {}) {
  if (c.state === 'oncourt') return 'на корте';
  if (c.state === 'playing') return court ? `доигрывает на ${court}` : 'доигрывает';
  if (c.state === 'held') return c.why === 'court' ? 'корт занят — часы стоят' : 'ждём соперников — часы стоят';
  if (c.state === 'started') return 'матч начался';
  if (c.state === 'expired') return read ? 'на корте не отмечена · прошло 20 минут' : 'вызов не прочитан — вызовите голосом';
  return read ? 'ждём' : 'ждём · вызов не прочитан';
}

// Самые долгие часы из идущих — их показывает полоса судьи («14:20 из 20:00»).
export function leadClock(clocks) {
  const run = clocks.filter((c) => c.state === 'waiting' || c.state === 'expired');
  if (!run.length) return null;
  return run.reduce((a, c) => (c.elapsed > a.elapsed ? c : a));
}

// Средний выход на корт по журналу: от начала часов до отметки «на корте».
export function averageTurnout(entries) {
  const xs = (entries || []).filter((e) => e.kind === 'oncourt' && Number.isFinite(e.waited)).map((e) => e.waited);
  if (!xs.length) return null;
  return { n: xs.length, avg: xs.reduce((a, b) => a + b, 0) / xs.length };
}
