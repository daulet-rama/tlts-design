// TLTS · «Арифметика группы» — демо-группа «в игре». Выдуманные пары dp1–dp4 из core/data.js.
// Счета подобраны перебором (ideas/tests/group.test.mjs проверяет, что расклад ровно такой, как описан):
//   - после второго тура у пары dp2 одна победа: победа в последнем матче гарантирует Grand Masters,
//     при поражении решают соседний матч и процент геймов;
//   - в итоге три пары с одной победой, процент ставит dp2 третьей — хотя dp2 обыграла dp3 6:3:
//     при трёх равных личная встреча не решает, решает процент.

/** Пары группы по порядку посева: индекс в группе → id пары. */
export const DEMO_PAIRS = ['dp1', 'dp2', 'dp3', 'dp4'];

/** Туры круговой группы из четырёх пар: по два матча, все шесть пар соперников. */
export const DEMO_ROUNDS = [
  { n: 1, time: '08:45', matches: [{ a: 0, b: 3, score: [6, 4], court: 'Корт 2' }, { a: 1, b: 2, score: [6, 3], court: 'Корт 3' }] },
  { n: 2, time: '10:30', matches: [{ a: 0, b: 2, score: [7, 6], tb: [7, 4], court: 'Корт 2' }, { a: 1, b: 3, score: [4, 6], court: 'Корт 3' }] },
  { n: 3, time: '12:15', matches: [{ a: 0, b: 1, score: [7, 5], live: [4, 3], court: 'Корт 2' }, { a: 2, b: 3, score: [6, 2], live: [3, 1], court: 'Корт 3' }] },
];

/** Состояния, которые переключает экран. played — сколько туров сыграно; live — идёт ли следующий тур. */
export const DEMO_STATES = [
  { id: 'r1', label: 'После 1-го тура', short: '1-й тур сыгран', played: 1, live: false },
  { id: 'r2', label: 'После 2-го тура', short: '2-й тур сыгран', played: 2, live: false },
  { id: 'live', label: 'Идёт последний тур', short: 'идёт 3-й тур', played: 2, live: true },
  { id: 'done', label: 'Группа сыграна', short: 'группа сыграна', played: 3, live: false },
];

// Отдельный выдуманный турнир (не демо-вечер главной t-demo и не турниры из истории встреч в core/data.js): другой день — другой итог.
export const DEMO_GROUP = { name: 'Группа C', tournament: 'Демо · Осенний кубок', date: '2027-09-11', venue: 'Gorky Tennis Park' };

/** Сыгранные матчи состояния: [i, j, ga, gb]. */
export function playedMatches(state) {
  const st = typeof state === 'string' ? DEMO_STATES.find((s) => s.id === state) : state;
  return DEMO_ROUNDS.slice(0, st.played).flatMap((r) => r.matches.map((m) => [m.a, m.b, m.score[0], m.score[1]]));
}

/** Матчи, которые ещё не сыграны (идущие — тоже): [i, j]. */
export function remainingMatches(state) {
  const st = typeof state === 'string' ? DEMO_STATES.find((s) => s.id === state) : state;
  return DEMO_ROUNDS.slice(st.played).flatMap((r) => r.matches.map((m) => [m.a, m.b]));
}
