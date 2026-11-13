// Данные прототипа TLTS: демо-игроки, архив, турниры, стартовые матчи, ранги.
// Демо — выдуманные люди (CONTRACT.md, раздел 4). Архив — настоящие данные лиги,
// собранные tools/build-archive.py в data.archive.js; там ничего не придумано.

import { FORMAT_LEAGUE, createScore, applyEvent } from './score.js';
import { ARCHIVE } from './data.archive.js';

// ---------- лестница званий (вариант Б) ----------

export const RANK_B_LADDER = Object.freeze([
  { level: 1, key: 'debut', label: 'Дебютант', rule: 'Сыграл первый турнир' },
  { level: 2, key: 'player', label: 'Игрок лиги', rule: '5 турниров' },
  { level: 3, key: 'contender', label: 'Претендент', rule: '1/2 финала высшей категории' },
  { level: 4, key: 'medalist', label: 'Призёр', rule: 'Финал высшей категории или победа во второй' },
  { level: 5, key: 'stage-champion', label: 'Чемпион этапа', rule: 'Победа на этапе в высшей категории' },
  { level: 6, key: 'league-champion', label: 'Чемпион лиги', rule: 'Победа в Итоговом TS CUP' },
  { level: 7, key: 'legend', label: 'Легенда лиги', rule: 'Три Итоговых и больше' },
].map(Object.freeze));

// ---------- демо-игроки ----------
// Имена, возраст, рука, КПР и пары — строго из договора. Остальные цифры выдуманы,
// но согласованы между собой и со званиями варианта Б (уровни 1–7 все встречаются).

// rating.demo: true — демо-рейтинг: места и баллы выдуманы и не входят в настоящий рейтинг лиги,
// поэтому могут совпадать с местами настоящих игроков. Экраны пишут «демо-рейтинг».
// alphaPoints — баллы Альфы; внутри своего уровня КПР место в Альфе растёт вместе с ними.
// stageWins — победы в высшей категории без Итогового (у демо все — этапы, спецтурниров нет).
const demo = (o) => ({
  demo: true,
  patronymic: null,
  name: `${o.first} ${o.last}`,
  short: `${o.last} ${o.first[0]}.`,
  portrait: o.id,
  sinceApprox: false,
  ...o,
  rating: { ...o.rating, demo: true },
  stageWins: { tsCup: o.titles.stage, special: 0, specialNames: [] },
});

const DEMO_PLAYERS = [
  demo({ id: 'd01', last: 'Сарсенбаев', first: 'Ерлан', age: 45, hand: 'R', kpr: 4.5,
    rating: { points: 2300, place: 4, alphaPlace: 2, alphaPoints: 1980, tournaments: 5 },
    titles: { stage: 3, final: 1, second: 0 }, finals: 5, semis: 8, tournaments: 22, since: 2023,
    wl: { season: [15, 5], career: [61, 27] }, form: ['W', 'L', 'W', 'W', 'W'],
    partners: [{ id: 'd05', matches: 34 }, { id: 'd10', matches: 6 }] }),
  demo({ id: 'd02', last: 'Громов', first: 'Алексей', age: 38, hand: 'R', kpr: 4.0,
    rating: { points: 1460, place: 21, alphaPlace: 9, alphaPoints: 1100, tournaments: 5 },
    titles: { stage: 0, final: 0, second: 0 }, finals: 0, semis: 2, tournaments: 11, since: 2024,
    wl: { season: [10, 7], career: [29, 22] }, form: ['L', 'W', 'W', 'W', 'L'],
    partners: [{ id: 'd06', matches: 26 }, { id: 'd03', matches: 5 }] }),
  demo({ id: 'd03', last: 'Хван', first: 'Герман', age: 52, hand: 'R', kpr: 4.0,
    rating: { points: 1620, place: 17, alphaPlace: 6, alphaPoints: 1350, tournaments: 5 },
    titles: { stage: 0, final: 0, second: 1 }, finals: 0, semis: 3, tournaments: 16, since: 2023,
    wl: { season: [11, 7], career: [40, 30] }, form: ['W', 'W', 'L', 'W', 'L'],
    partners: [{ id: 'd10', matches: 22 }, { id: 'd02', matches: 5 }] }),
  demo({ id: 'd04', last: 'Оспанов', first: 'Данияр', age: 33, hand: 'R', kpr: 5.0,
    rating: { points: 2950, place: 1, alphaPlace: 1, alphaPoints: 2600, tournaments: 5 },
    titles: { stage: 6, final: 3, second: 0 }, finals: 12, semis: 17, tournaments: 26, since: 2023,
    wl: { season: [18, 2], career: [96, 23] }, form: ['W', 'W', 'L', 'W', 'W'],
    partners: [{ id: 'd09', matches: 38 }, { id: 'd01', matches: 11 }] }),
  demo({ id: 'd05', last: 'Савельев', first: 'Виктор', age: 58, hand: 'R', kpr: 3.5,
    rating: { points: 2180, place: 6, alphaPlace: 1, alphaPoints: 1900, tournaments: 5 },
    titles: { stage: 0, final: 0, second: 0 }, finals: 2, semis: 5, tournaments: 19, since: 2023,
    wl: { season: [14, 6], career: [55, 38] }, form: ['W', 'L', 'W', 'W', 'W'],
    partners: [{ id: 'd01', matches: 34 }, { id: 'd07', matches: 9 }] }),
  demo({ id: 'd06', last: 'Юсупов', first: 'Бахтияр', age: 41, hand: 'R', kpr: 4.0,
    rating: { points: 980, place: 34, alphaPlace: 15, alphaPoints: 760, tournaments: 4 },
    titles: { stage: 0, final: 0, second: 0 }, finals: 0, semis: 0, tournaments: 6, since: 2025,
    wl: { season: [8, 7], career: [14, 13] }, form: ['W', 'L', 'L', 'W', 'L'],
    partners: [{ id: 'd02', matches: 26 }] }),
  demo({ id: 'd07', last: 'Гасанов', first: 'Эльдар', age: 47, hand: 'R', kpr: 3.5,
    rating: { points: 870, place: 38, alphaPlace: 10, alphaPoints: 800, tournaments: 4 },
    titles: { stage: 0, final: 0, second: 0 }, finals: 0, semis: 0, tournaments: 9, since: 2024,
    wl: { season: [6, 8], career: [20, 21] }, form: ['L', 'W', 'L', 'L', 'W'],
    partners: [{ id: 'd05', matches: 9 }, { id: 'd08', matches: 8 }] }),
  demo({ id: 'd08', last: 'Назаров', first: 'Дамир', age: 29, hand: 'L', kpr: 4.5,
    rating: { points: 340, place: 61, alphaPlace: 12, alphaPoints: 340, tournaments: 2 },
    titles: { stage: 0, final: 0, second: 0 }, finals: 0, semis: 0, tournaments: 2, since: 2027,
    wl: { season: [5, 3], career: [5, 3] }, form: ['W', 'L', 'W', 'W', 'L'],
    partners: [{ id: 'd07', matches: 8 }] }),
  demo({ id: 'd09', last: 'Жаксыбеков', first: 'Нурлан', age: 62, hand: 'R', kpr: 3.0,
    rating: { points: 2420, place: 3, alphaPlace: 1, alphaPoints: 2100, tournaments: 5 },
    titles: { stage: 2, final: 0, second: 0 }, finals: 3, semis: 6, tournaments: 18, since: 2023,
    wl: { season: [17, 3], career: [52, 33] }, form: ['W', 'W', 'L', 'W', 'W'],
    partners: [{ id: 'd04', matches: 38 }, { id: 'd05', matches: 4 }] }),
  demo({ id: 'd10', last: 'Орлов', first: 'Максим', age: 36, hand: 'R', kpr: 4.0,
    rating: { points: 1210, place: 26, alphaPlace: 8, alphaPoints: 1150, tournaments: 5 },
    titles: { stage: 0, final: 0, second: 0 }, finals: 0, semis: 1, tournaments: 8, since: 2025,
    wl: { season: [9, 8], career: [17, 13] }, form: ['L', 'W', 'L', 'W', 'L'],
    partners: [{ id: 'd03', matches: 22 }, { id: 'd01', matches: 6 }] }),
];

// У демо-партнёров те же поля, что у настоящих: имя («Имя Фамилия»), короткое имя и КПР.
for (const p of DEMO_PLAYERS) {
  p.partners = p.partners.map((x) => {
    const mate = DEMO_PLAYERS.find((d) => d.id === x.id);
    return { id: x.id, name: mate.name, short: mate.short, kpr: mate.kpr, matches: x.matches };
  });
}

const DEMO_PAIRS = [
  { id: 'dp1', players: ['d04', 'd09'], seed: 1 },
  { id: 'dp2', players: ['d01', 'd05'], seed: 2 },
  { id: 'dp3', players: ['d08', 'd07'], seed: 5 },
  { id: 'dp4', players: ['d02', 'd06'], seed: 4 },
  { id: 'dp5', players: ['d03', 'd10'], seed: 3 },
];

// ---------- общие таблицы ----------

export const players = [...DEMO_PLAYERS, ...ARCHIVE.players.map((p) => ({ ...p }))];
const playerIndex = new Map(players.map((p) => [p.id, p]));

function pairTotals(ids) {
  const ps = ids.map((id) => playerIndex.get(id));
  const kprs = ps.map((p) => p && p.kpr);
  const pts = ps.map((p) => p && p.rating && p.rating.points);
  return {
    kprSum: kprs.every((x) => typeof x === 'number') ? Math.round(kprs.reduce((a, b) => a + b, 0) * 10) / 10 : null,
    pointsSum: pts.every((x) => typeof x === 'number') ? pts.reduce((a, b) => a + b, 0) : null,
  };
}

export const pairs = [
  ...DEMO_PAIRS.map((p) => ({ id: p.id, players: p.players, ...pairTotals(p.players), seed: p.seed, demo: true })),
  ...ARCHIVE.pairs.map((p) => ({ ...p, demo: false })),
];
const pairIndex = new Map(pairs.map((p) => [p.id, p]));

const DEMO_TOURNAMENT = {
  id: 't-demo', demo: true, name: 'TS CUP · Демо-вечер', season: 2027, date: '2027-06-19',
  venue: 'Gorky Tennis Park', categories: ['Grand Masters'],
  courts: ['Центральный корт', 'Корт 2', 'Корт 3', 'Корт 4', 'Корт 5'],
};

export const tournaments = [DEMO_TOURNAMENT, ...ARCHIVE.tournaments.map((t) => ({ ...t }))];
const tournamentIndex = new Map(tournaments.map((t) => [t.id, t]));

export const ratingBeta = ARCHIVE.ratingBeta.map((r) => ({ ...r }));

// Дата рейтинга лиги (ISO), на которую в архиве стоят места, баллы и КПР: «Рейтинг лиги на 07.09.2026».
// Не путать с ARCHIVE_META.generated — это дата сборки файла архива.
export const RATING_DATE = ARCHIVE.meta.ratingDate || null;

export function playerOf(id) { return playerIndex.get(id) || null; }
export function pairOf(id) { return pairIndex.get(id) || null; }
export function playersOfPair(pairId) {
  const p = pairOf(pairId);
  return p ? p.players.map((id) => playerOf(id)) : [];
}
export function tournamentOf(id) { return tournamentIndex.get(id) || null; }

// ---------- построение счёта для стартовых матчей ----------

// Гейм для side: варианты розыгрыша, чтобы демо выглядело живо.
const GAME_SHAPES = {
  love: (w) => [w, w, w, w],
  '15': (w, l) => [w, l, w, w, w],
  '30': (w, l) => [w, l, l, w, w, w],
  deuce: (w, l) => [w, w, w, l, l, l, w, w], // ровно → больше → гейм
  deciding: (w, l) => [w, l, w, l, w, l, l, w, w], // ровно → больше → ровно → решающее очко
};

function playScript(state, script) {
  let s = state;
  for (const item of script) {
    if (typeof item === 'string') {
      const [shape, side] = item.split(':');
      const w = Number(side);
      for (const side2 of GAME_SHAPES[shape](w, 1 - w)) s = applyEvent(s, { t: 'point', side: side2 });
    } else {
      s = applyEvent(s, item);
    }
  }
  return s;
}

const pts = (...sides) => sides.map((side) => ({ t: 'point', side }));
const gms = (...sides) => sides.map((side) => ({ t: 'game', side }));

const DEMO_TOUR_REF = { name: DEMO_TOURNAMENT.name, season: DEMO_TOURNAMENT.season, date: DEMO_TOURNAMENT.date, venue: DEMO_TOURNAMENT.venue };

function demoMatch(o) {
  return {
    dataset: 'demo',
    tournamentId: 't-demo',
    tournament: { ...DEMO_TOUR_REF },
    category: 'Grand Masters',
    note: null,
    rev: 0,
    ...o,
  };
}

function buildDemoMatches() {
  const league = FORMAT_LEAGUE;
  // 1/2 финала: dp1 — dp4, 7:6 (тай-брейк 7:5)
  const sf1 = playScript(createScore({ format: league, mode: 'points', firstServer: 0 }), [
    'love:0', '15:1', '30:0', 'deuce:1', '15:0', '30:1', 'love:0', '15:1', '30:0', 'deciding:1', '15:0', '30:1',
    ...pts(0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0),
  ]);
  // 1/2 финала: dp2 — dp5, 6:4
  const sf2 = playScript(createScore({ format: league, mode: 'points', firstServer: 1 }), [
    '15:1', '30:0', 'love:1', 'deuce:0', '30:1', '15:0', '30:1', '15:0', 'deciding:0', '30:0',
  ]);
  // Матч за 3-е место: dp4 — dp5, идёт: 4:3 и 30:15
  const bronze = playScript(createScore({ format: league, mode: 'points', firstServer: 0 }), [
    '15:0', '30:1', 'deuce:0', '15:1', '30:0', 'love:1', '15:0', ...pts(0, 1, 0),
  ]);
  // Показательный сет до 4 геймов по геймам: dp3 — dp2, идёт 2:1
  const show = playScript(createScore({ format: { gamesToWin: 4, deuce: 'deciding' }, mode: 'games', firstServer: 0 }), gms(0, 1, 0));
  const fresh = (format = league, mode = 'points') => createScore({ format, mode, firstServer: 0 });

  return [
    demoMatch({
      id: 'm-demo-sf1', stage: '1/2 финала', court: 'Центральный корт', scheduled: '16:00',
      pairs: ['dp1', 'dp4'], status: 'finished', mode: 'points', format: { gamesToWin: 6, deuce: 'league' }, score: sf1,
      h2h: { wins: [2, 0], meetings: [
        { date: '2027-05-22', tournament: 'Демо · Майский кубок', stage: '1/4 финала', score: '6:3', winner: 0 },
        { date: '2027-04-17', tournament: 'Демо · Кубок открытия', stage: 'Группа B', score: '6:4', winner: 0 },
      ] },
    }),
    demoMatch({
      id: 'm-demo-sf2', stage: '1/2 финала', court: 'Корт 2', scheduled: '16:00',
      pairs: ['dp2', 'dp5'], status: 'finished', mode: 'points', format: { gamesToWin: 6, deuce: 'league' }, score: sf2,
      h2h: { wins: [1, 1], meetings: [
        { date: '2027-06-05', tournament: 'Демо · Июньский кубок', stage: 'Группа C', score: '4:6', winner: 1 },
        { date: '2027-05-08', tournament: 'Демо · Весенний кубок', stage: '1/4 финала', score: '7:5', winner: 0 },
      ] },
    }),
    demoMatch({
      id: 'm-demo-bronze', stage: 'Матч за 3-е место', court: 'Корт 3', scheduled: '17:30',
      pairs: ['dp4', 'dp5'], status: 'live', mode: 'points', format: { gamesToWin: 6, deuce: 'league' }, score: bronze,
      h2h: { wins: [0, 1], meetings: [
        { date: '2027-05-22', tournament: 'Демо · Майский кубок', stage: 'Группа A', score: '5:7', winner: 1 },
      ] },
    }),
    demoMatch({
      id: 'm-demo-show', stage: 'Показательный сет', category: null, court: 'Корт 4', scheduled: '17:45',
      pairs: ['dp3', 'dp2'], status: 'live', mode: 'games', format: { gamesToWin: 4, deuce: 'deciding' }, score: show,
      note: 'Сокращённый регламент: сет до 4 геймов, решающее очко при «ровно». Счёт ведётся по геймам.',
      h2h: { wins: [0, 0], meetings: [] },
    }),
    demoMatch({
      id: 'm-demo-next', stage: 'Показательный матч', category: null, court: 'Корт 5', scheduled: '20:00',
      pairs: ['dp3', 'dp5'], status: 'upcoming', mode: 'points', format: { gamesToWin: 6, deuce: 'league' }, score: fresh(),
      h2h: { wins: [0, 1], meetings: [
        { date: '2027-05-08', tournament: 'Демо · Весенний кубок', stage: 'Группа D', score: '3:6', winner: 1 },
      ] },
    }),
    demoMatch({
      id: 'm-demo-final', stage: 'Финал', court: 'Центральный корт', scheduled: '18:30',
      pairs: ['dp1', 'dp2'], status: 'upcoming', mode: 'points', format: { gamesToWin: 6, deuce: 'league' }, score: fresh(),
      h2h: { wins: [2, 1], meetings: [
        { date: '2027-06-05', tournament: 'Демо · Июньский кубок', stage: 'Финал', score: '6:4', winner: 0 },
        { date: '2027-05-22', tournament: 'Демо · Майский кубок', stage: '1/2 финала', score: '4:6', winner: 1 },
        { date: '2027-04-17', tournament: 'Демо · Кубок открытия', stage: 'Финал', score: '7:5', winner: 0 },
      ] },
    }),
  ];
}

function buildArchiveMatches() {
  return ARCHIVE.matches.map((m) => {
    const t = tournamentOf(m.tournamentId);
    const score = applyEvent(createScore({ format: FORMAT_LEAGUE, mode: 'final' }), { t: 'final', games: m.result });
    return {
      id: m.id,
      dataset: 'archive',
      tournamentId: m.tournamentId,
      tournament: { name: t.name, season: t.season, date: t.date, venue: t.venue },
      stage: m.stage,
      category: m.category,
      court: null,
      scheduled: null,
      pairs: m.pairs.slice(),
      status: 'finished',
      mode: 'final',
      format: { gamesToWin: 6, deuce: 'league' },
      score,
      rev: 0,
      h2h: { wins: m.h2h.wins.slice(), meetings: m.h2h.meetings.map((x) => ({ ...x })) },
      note: 'Счёт по очкам неизвестен: в архиве лиги есть только итог по геймам. Любой повтор розыгрыша — реконструкция.',
    };
  });
}

export const seedMatches = [...buildDemoMatches(), ...buildArchiveMatches()];

// ---------- ранги ----------

export function rankA(player) {
  if (!player) return null;
  const t = player.titles || {};
  const r = player.rating || null;
  const total = ['stage', 'final', 'second'].reduce((a, k) => a + (Number(t[k]) || 0), 0);
  return {
    kpr: player.kpr ?? null,
    place: r ? r.place ?? null : null,
    alphaPlace: r ? r.alphaPlace ?? null : null,
    points: r ? r.points ?? null : null,
    alphaPoints: r ? r.alphaPoints ?? null : null,
    ratingDemo: !!(r && r.demo),
    titles: total,
    titlesDetail: { stage: t.stage || 0, final: t.final || 0, second: t.second || 0 },
  };
}

// Отрыв до места выше в Бете ('beta') или в Альфе ('alpha', внутри своего уровня КПР).
// Отрыв Альфы считается по баллам Альфы, Беты — по баллам Беты; отрицательным не бывает.
// → null — у игрока нет места или баллов в этом списке;
//   { top: true, place: 1, above: null, gap: 0, exact: true } — игрок первый;
//   { top: false, place, above: { place, name, points, id, player } | null, gap: число | null, exact }
//   exact: true — above стоит ровно на месте выше; false — ближайший выше из тех, кто есть в прототипе.
//   above: null — выше в прототипе никого нет («нет в прототипе»).
// У архивных игроков соседнее место выше взято из настоящего рейтинга (rating.above), даже если
// этого человека нет в прототипе (тогда id и player — null). Демо сравниваются только с демо.
export function ratingGap(player, list = 'beta') {
  const r = player && player.rating;
  if (!r) return null;
  const alpha = list === 'alpha';
  const placeKey = alpha ? 'alphaPlace' : 'place';
  const ptsKey = alpha ? 'alphaPoints' : 'points';
  const place = r[placeKey];
  const mine = r[ptsKey];
  if (place == null || mine == null) return null;
  if (place <= 1) return { top: true, place, above: null, gap: 0, exact: true };
  const known = r.above && r.above[list];
  if (known) {
    return {
      top: false, place,
      above: { ...known, player: known.id ? playerOf(known.id) : null },
      gap: Math.max(0, known.points - mine),
      exact: known.place === place - 1,
    };
  }
  const pool = players.filter((x) => x !== player && !!x.demo === !!player.demo
    && x.rating && x.rating[placeKey] != null && x.rating[ptsKey] != null && x.rating[placeKey] < place
    && (!alpha || x.kpr === player.kpr));
  if (!pool.length) return { top: false, place, above: null, gap: null, exact: false };
  const up = pool.reduce((a, b) => (b.rating[placeKey] > a.rating[placeKey] ? b : a));
  return {
    top: false, place,
    above: { place: up.rating[placeKey], name: up.name, points: up.rating[ptsKey], id: up.id, player: up },
    gap: Math.max(0, up.rating[ptsKey] - mine),
    exact: up.rating[placeKey] === place - 1,
  };
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// Звание по заслугам считается из полей игрока: tournaments, semis, finals, titles.
export function rankB(player) {
  if (!player) return null;
  const t = player.titles || {};
  const tours = Number(player.tournaments ?? player.rating?.tournaments ?? 0) || 0;
  const semis = Number(player.semis) || 0;
  const finals = Number(player.finals) || 0;
  const stage = Number(t.stage) || 0;
  const final = Number(t.final) || 0;
  const second = Number(t.second) || 0;
  const met = [
    tours >= 1,
    tours >= 5,
    semis >= 1 || finals >= 1 || stage >= 1 || final >= 1,
    finals >= 1 || second >= 1 || stage >= 1 || final >= 1,
    stage >= 1,
    final >= 1,
    final >= 3,
  ];
  let level = 0;
  met.forEach((ok, i) => { if (ok) level = Math.max(level, i + 1); });

  const needs = [
    () => 'Сыграть первый турнир',
    () => { const n = 5 - tours; return `Сыграть ещё ${n} ${plural(n, 'турнир', 'турнира', 'турниров')}`; },
    () => 'Дойти до 1/2 финала высшей категории',
    () => 'Сыграть финал высшей категории или выиграть вторую',
    () => 'Выиграть этап в высшей категории',
    () => 'Выиграть Итоговый TS CUP',
    () => { const n = 3 - final; return `Выиграть Итоговый TS CUP ещё ${n} ${plural(n, 'раз', 'раза', 'раз')}`; },
  ];
  const cur = level ? RANK_B_LADDER[level - 1] : null;
  const nxt = level < 7 ? RANK_B_LADDER[level] : null;
  return {
    key: cur ? cur.key : 'none',
    label: cur ? cur.label : 'Без звания',
    level,
    max: 7,
    next: nxt ? { label: nxt.label, need: needs[level](), level: nxt.level } : null,
  };
}

export const DEMO_NOTE = 'Демо-данные';
export const ARCHIVE_META = ARCHIVE.meta;
