// Турнир — чистые расчёты без страницы.
// Посев и жребий, круги в группе, сетка из мест в группах, законный счёт сета,
// прогноз дня и «пошёл дождь». Длина матча — по расчётам пульта турнирного дня
// (design/site/live/ideas/desk.logic.js): время матча пропорционально числу розыгрышей,
// оставшиеся геймы считаются при равных силах. Прогноз всегда «около».
import { expectedGames, pointsPerGame, round5, CALL_LIMIT, SLOT_MIN } from '../../live/ideas/desk.logic.js';

export { round5, CALL_LIMIT, SLOT_MIN };

/* ---------- время ---------- */
const pad = (n) => String(n).padStart(2, '0');
export const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
export const hhmm = (min) => { const t = ((Math.floor(min + 1e-9) % 1440) + 1440) % 1440; return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; };
export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many;
};
// «1 час 05 минут», «25 минут», «2 часа»
export function durWords(min) {
  const m = Math.round(Math.abs(min)); const h = Math.floor(m / 60); const r = m % 60;
  const mm = (x) => `${x} ${plural(x, 'минута', 'минуты', 'минут')}`;
  if (!h) return mm(r);
  return `${h} ${plural(h, 'час', 'часа', 'часов')}${r ? ' ' + mm(r) : ''}`;
}
// после «на», «через»: «на 15 минут», «на 1 минуту»
export function durAcc(min) {
  const m = Math.round(Math.abs(min)); const h = Math.floor(m / 60); const r = m % 60;
  const mm = (x) => `${x} ${plural(x, 'минуту', 'минуты', 'минут')}`;
  if (!h) return mm(r);
  return `${h} ${plural(h, 'час', 'часа', 'часов')}${r ? ' ' + mm(r) : ''}`;
}

/* ---------- жребий: повторяемый, чтобы «Отменить» возвращало то же самое ---------- */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- группы ---------- */
export const GROUPS = ['A', 'B', 'C', 'D'];
// посев 1 и 2 — в разных половинах сетки: A и B играют в одной половине, C и D — в другой
export const SEED_GROUP = ['A', 'D', 'B', 'C'];

// Разложить пары: сеяные — по одной в группе (больше всего баллов рейтинга),
// остальные — жребием по кругу, чтобы группы были ровными. size — мест в группе.
export function drawGroups(ids, { points, size = 4, seed = 1 } = {}) {
  const sorted = ids.slice().sort((x, y) => points(y) - points(x) || (x < y ? -1 : 1));
  const seeds = sorted.slice(0, GROUPS.length);
  const lot = sorted.slice(GROUPS.length);
  const r = rng(seed);
  for (let i = lot.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [lot[i], lot[j]] = [lot[j], lot[i]]; }
  const G = Object.fromEntries(GROUPS.map((g) => [g, []]));
  seeds.forEach((id, k) => G[SEED_GROUP[k]].push(id));
  let k = 0;
  for (const id of lot) {
    let tries = 0;
    while (G[GROUPS[k % GROUPS.length]].length >= size && tries < GROUPS.length) { k += 1; tries += 1; }
    G[GROUPS[k % GROUPS.length]].push(id);
    k += 1;
  }
  return { groups: G, seeds: Object.fromEntries(seeds.map((id, i) => [id, i + 1])), lot: lot.length };
}

// Туры группы из четырёх мест: 1–2 и 3–4, потом 1–3 и 2–4, потом 1–4 и 2–3 (как в «Июньском кубке»)
export const TOURS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

/* ---------- сетка из мест в группах ---------- */
// Первые места играют со вторыми из соседней группы. Верхняя половина — C и D, нижняя — A и B:
// сеяные 1 и 2 (группы A и D) встретятся только в финале. Так собрана сетка «Июньского кубка».
export const QF = [
  { id: 'qf3', a: ['C', 1], b: ['D', 2] },
  { id: 'qf4', a: ['D', 1], b: ['C', 2] },
  { id: 'qf1', a: ['A', 1], b: ['B', 2] },
  { id: 'qf2', a: ['B', 1], b: ['A', 2] },
];
// кто откуда приходит: победитель (w) или проигравший (l) матча
export const LATER = [
  { id: 'sf1', round: 'sf', title: 'Полуфинал', from: [['w', 'qf3'], ['w', 'qf4']] },
  { id: 'sf2', round: 'sf', title: 'Полуфинал', from: [['w', 'qf1'], ['w', 'qf2']] },
  { id: 'final', round: 'f', title: 'Финал', from: [['w', 'sf1'], ['w', 'sf2']] },
  { id: 'third', round: 'third', title: 'За 3-е место', from: [['l', 'sf1'], ['l', 'sf2']] },
  { id: 'c5a', round: 'cons', title: 'За 5–8 места', from: [['l', 'qf1'], ['l', 'qf2']] },
  { id: 'c5b', round: 'cons', title: 'За 5–8 места', from: [['l', 'qf4'], ['l', 'qf3']] },
  { id: 'p5', round: 'cons', title: 'За 5-е место', from: [['w', 'c5a'], ['w', 'c5b']] },
  { id: 'p7', round: 'cons', title: 'За 7-е место', from: [['l', 'c5b'], ['l', 'c5a']] },
];
export const placeWords = ([g, p]) => `${p}-е место группы ${g}`;

/* ---------- законный счёт: один сет до 6, при 6:6 — тай-брейк до 7 ---------- */
export const WIN_SCORES = [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]];
// a, b — геймы первой и второй пары. Ответ: { ok, winner, tb } или { ok: false, msg }
export function checkSet(a, b) {
  const w = Math.max(a, b); const l = Math.min(a, b);
  const sc = `${a}:${b}`;
  if (a === b) return { ok: false, msg: `Счёт ${sc} — ничья. В сете всегда есть победитель` };
  if (w < 6) return { ok: false, msg: `Счёт ${sc} — сет не окончен: играют до 6 геймов` };
  if (w === 6 && l === 5) return { ok: false, msg: `Счёт ${sc} невозможен: при 6:5 играют дальше — до 7:5 или тай-брейка` };
  if (w === 6) return { ok: true, winner: a > b ? 0 : 1, tb: false };
  if (w === 7 && l >= 5) return { ok: true, winner: a > b ? 0 : 1, tb: l === 6 };
  if (w === 7) return { ok: false, msg: `Счёт ${sc} невозможен: при 6:${l} сет уже окончен` };
  return { ok: false, msg: `Счёт ${sc} невозможен: больше 7 геймов в сете не бывает — при 6:6 играют тай-брейк` };
}
// очки тай-брейка: у проигравшего t, у победителя — 7 или на 2 больше
export const tbWin = (t) => Math.max(7, t + 2);

/* ---------- длина матча и прогноз дня ---------- */
// scores — счёт сыгранных сетов этапа { '6:4': 9, … }; minPerGame — темп сегодняшних матчей.
export function dayModel(scores, minPerGame) {
  let n = 0; let games = 0; let e6 = 0; let e4 = 0;
  for (const [k, cnt] of Object.entries(scores)) {
    const [w, l] = k.split(':').map(Number);
    const q = w / (w + l);
    n += cnt; games += cnt * (w + l); e6 += cnt * expectedGames(6, q); e4 += cnt * expectedGames(4, q);
  }
  const actual = games / n;
  const ppgL = pointsPerGame('league'); const ppgD = pointsPerGame('deciding');
  const perGame = (fmt = {}) => minPerGame * ((fmt.deuce === 'deciding' ? ppgD : ppgL) / ppgL);
  const gamesFor = (N) => (N === 4 ? actual * (e4 / e6) : actual);
  return {
    sets: n, actual, minPerGame,
    minutes: (fmt = {}) => gamesFor(fmt.gamesToWin || 6) * perGame(fmt),
    // сколько ещё идти матчу при счёте a:b (равные силы)
    left: (a, b, fmt = {}) => expectedGames(fmt.gamesToWin || 6, 0.5, a, b) * perGame(fmt),
  };
}

// Прогноз дня. matches — по порядку: { id, court, at, state, pairs, length, ready }; live — { id, left }.
// Будущий матч начнётся не раньше программы, свободного корта, свободных пар и «сейчас».
// ready — пары вызвали раньше обычного: вместо программы — когда они выйдут на корт («начнут около 19:20»).
// Дождь { from, to, fmt }: идущий матч прерывается и доигрывается после него в своём формате,
// не начатые получают формат варианта. Как в пульте приложения (app-v2/js/desk.logic.js).
export function forecastDay({ matches, now, model, live = null, rain = null }) {
  const courtFree = {}; const pairFree = {}; const out = new Map();
  const full = { gamesToWin: 6, deuce: 'league' };
  const from = rain ? Math.max(rain.from, now) : Infinity;
  const to = rain ? Math.max(rain.to, from) : Infinity;
  const take = (m, start, end, extra = {}) => {
    out.set(m.id, { id: m.id, start, end, ...extra });
    courtFree[m.court] = Math.max(courtFree[m.court] ?? -Infinity, end);
    for (const p of m.pairs) pairFree[p] = Math.max(pairFree[p] ?? -Infinity, end);
  };
  for (const m of matches) if (m.state === 'done') take(m, m.at, m.at + m.length, { state: 'done' });
  for (const m of matches) {
    if (m.state !== 'live') continue;
    const left = live && live.id === m.id ? live.left : 0;
    let end = now + left; let stopped = false;
    if (end > from) { end = to + (left - (from - now)); stopped = true; }
    take(m, m.at, end, { state: 'live', stopped });
  }
  for (const m of matches) {
    if (m.state !== 'soon') continue;
    const at = m.ready != null && m.ready < m.at ? m.ready : m.at;
    let start = Math.max(at, courtFree[m.court] ?? -Infinity, now, ...m.pairs.map((p) => pairFree[p] ?? -Infinity));
    let fmt = full; let end; let stopped = false;
    if (start >= from && start < to) start = to;
    if (start < from) {
      end = start + model.minutes(full);
      if (end > from) { end = to + (end - from); stopped = true; }
    } else {
      fmt = rain && rain.fmt ? rain.fmt : full;
      end = start + model.minutes(fmt);
    }
    take(m, start, end, { state: 'soon', fmt, stopped, plan: m.at, shortened: fmt.gamesToWin !== 6 || fmt.deuce !== 'league' });
  }
  const end = Math.max(...[...out.values()].map((x) => x.end));
  return { byId: out, end };
}

// Что можно сократить в дождь — формат ещё не начатых матчей. Решает главный судья.
export const RAIN_OPTIONS = [
  { key: 'asis', title: 'Как есть', rule: 'Сет до 6 геймов', fmt: { gamesToWin: 6, deuce: 'league' } },
  { key: 'deciding', title: 'Сразу решающее очко', rule: 'Сет до 6, при «ровно» — решающее очко', fmt: { gamesToWin: 6, deuce: 'deciding' } },
  { key: 'to4', title: 'Сет до 4 геймов', rule: 'Оставшиеся матчи — до 4 геймов', fmt: { gamesToWin: 4, deuce: 'league' } },
  { key: 'to4d', title: 'До 4 и решающее очко', rule: 'До 4 геймов, при «ровно» — решающее очко', fmt: { gamesToWin: 4, deuce: 'deciding' } },
];
export function rainOptions({ matches, now, model, live, from, to, lightEnd }) {
  return RAIN_OPTIONS.map((o) => {
    const f = forecastDay({ matches, now, model, live, rain: { from, to, fmt: o.fmt } });
    const soon = [...f.byId.values()].filter((x) => x.state === 'soon');
    const affected = o.key === 'asis' ? 0 : soon.filter((x) => x.shortened).length;
    return { ...o, end: f.end, margin: lightEnd - f.end, fits: f.end <= lightEnd, affected, day: f };
  });
}

/* ---------- раскладка дня: круги друг за другом, матч — на свой корт или на первый свободный ---------- */
// waves — [[матч, …], …]: следующая волна начинается, когда кончилась предыдущая и пары отдохнули.
// Как schedule() пульта; отдых между волнами финального дня — rest минут.
// pin — { матч: корт }: такой матч встаёт на свой корт (финал — на корт финала этапа),
// остальные матчи круга — на свободные корты по порядку. Своего корта среди courts нет — как все.
export function layoutDay(waves, { start, round, courts, rest = 0, pin = {} }) {
  const out = []; let t = start;
  waves.forEach((w, wi) => {
    let left = w.slice();
    while (left.length) {
      const free = courts.slice(); const here = [];
      left.forEach((m) => { const c = pin[m.id]; if (c && free.includes(c)) { here.push({ m, c }); free.splice(free.indexOf(c), 1); } });
      left.forEach((m) => { if (free.length && !here.some((x) => x.m === m)) here.push({ m, c: free.shift() }); });
      if (!here.length) break;   // кортов нет
      here.forEach((x) => out.push({ id: x.m.id, court: x.c, min: t }));
      left = left.filter((m) => !here.some((x) => x.m === m));
      t += round;
    }
    if (wi < waves.length - 1) t += rest;
  });
  return out;
}
