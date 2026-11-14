// Расчёты пульта дня. Чистые функции без страницы: время — минуты от полуночи (можно дробные).
// Модель пульта: длина матча пропорциональна числу розыгрышей,
// оставшиеся геймы считаются при равных силах, вызов даёт 20 минут, часы идут,
// только когда свободны обе пары и корт; дождь — что успеем до заката.

/* ---------- время ---------- */

export function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// «18:47:40» → 1127.67 (минуты дня с секундами)
export function toMinSec(t) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(t || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3] || 0) / 60 : null;
}

// 1093.4 → «18:13»
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

export const round5 = (min) => Math.round(min / 5) * 5;

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}

// 95 → «1 ч 35 мин», 40 → «40 минут»; acc — после «на», «через», «за»: «на 21 минуту»
export function dur(min, short = false, acc = false) {
  const m = Math.round(Math.abs(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return short ? `${r} мин` : `${r} ${plural(r, acc ? 'минуту' : 'минута', 'минуты', 'минут')}`;
  return r ? `${h} ч ${r} мин` : `${h} ${plural(h, 'час', 'часа', 'часов')}`;
}
export const durAcc = (min) => dur(min, false, true);

/* ---------- длина матча ---------- */

// Ожидаемое число геймов в сете до N (при N:N тай-брейк — один гейм), q — доля геймов одной пары.
export function expectedGames(N, q = 0.5, a = 0, b = 0) {
  const memo = new Map();
  const done = (x, y) => (x === N + 1 || y === N + 1 || (x === N && y <= N - 2) || (y === N && x <= N - 2));
  function E(x, y) {
    if (done(x, y)) return 0;
    if (x === N && y === N) return 1;
    const k = x * 100 + y;
    if (memo.has(k)) return memo.get(k);
    const v = 1 + q * E(x + 1, y) + (1 - q) * E(x, y + 1);
    memo.set(k, v);
    return v;
  }
  return E(a, b);
}

// Розыгрышей в гейме. 'league' — после второго «ровно» решающее очко; 'deciding' — сразу при «ровно».
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

// Модель по счёту сыгранных сетов ({ '6:4': 11, … }) и по минутам на гейм.
// Сет до 4 геймов — факт × (модель до 4 / модель до 6); решающее очко — меньше розыгрышей в гейме.
export function makeModel(scores, minPerGame) {
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
  const ppgL = pointsPerGame('league');
  const ppgD = pointsPerGame('deciding');
  const gamesFor = (g) => (g === 4 ? actual * (e4 / e6) : actual);
  const perGame = (fmt = {}) => minPerGame * ((fmt.deuce === 'deciding' ? ppgD : ppgL) / ppgL);
  const minutes = (fmt = {}) => gamesFor(fmt.gamesToWin || 6) * perGame(fmt);
  return { sets: n, actual, minPerGame, ppgL, ppgD, minutes, perGame };
}

// Сколько ещё идти матчу: оставшиеся геймы при равных силах × минут на гейм.
export function remainingMinutes(view, model) {
  if (!view || view.finished) return 0;
  const N = view.gamesToWin || 6;
  const [a, b] = view.games || [0, 0];
  return expectedGames(N, 0.5, a, b) * model.perGame({ deuce: view.format && view.format.deuce });
}

/* ---------- день: прогноз начала и конца ---------- */

// matches — матчи дня по порядку: { id, court, at (по программе), state, pairs, length (у сыгранных) };
// live — { id, left } (сколько минут ещё идти живому матчу); rain — { from, to, fmt } или null.
// Начало будущего матча: не раньше программы, свободного корта, освободившихся пар и «сейчас»;
// в дождь не начинается, прерванный дождём доигрывается после него в своём формате.
export function forecastDay({ matches, now, model, live = null, rain = null }) {
  const courtFree = {};
  const pairFree = {};
  const out = new Map();
  const full = { gamesToWin: 6, deuce: 'league' };
  const from = rain ? Math.max(rain.from, now) : Infinity;
  const to = rain ? Math.max(rain.to, from) : Infinity;
  const take = (m, start, end, extra = {}) => {
    out.set(m.id, { id: m.id, start, end, ...extra });
    courtFree[m.court] = Math.max(courtFree[m.court] ?? -Infinity, end);
    for (const p of m.pairs) pairFree[p] = Math.max(pairFree[p] ?? -Infinity, end);
  };
  for (const m of matches) {
    if (m.state === 'done') take(m, m.at, m.at + m.length, { state: 'done' });
  }
  for (const m of matches) {
    if (m.state !== 'live') continue;
    const left = live && live.id === m.id ? live.left : 0;
    let end = now + left;
    let stopped = false;
    if (end > from) { end = to + (left - (from - now)); stopped = true; }
    take(m, m.at, end, { state: 'live', stopped });
  }
  for (const m of matches) {
    if (m.state !== 'soon') continue;
    let start = Math.max(m.at, courtFree[m.court] ?? -Infinity, now, ...m.pairs.map((p) => pairFree[p] ?? -Infinity));
    const startFree = start;
    let fmt = full;
    let end;
    let stopped = false;
    if (start >= from && start < to) start = to;
    if (start < from) {
      // начнётся до дождя: доигрывается после него в полном формате
      end = start + model.minutes(full);
      if (end > from) { end = to + (end - from); stopped = true; }
    } else {
      fmt = rain && rain.fmt ? rain.fmt : full;
      end = start + model.minutes(fmt);
    }
    take(m, start, end, { state: 'soon', fmt, stopped, plan: m.at, ready: startFree, shortened: fmt !== full && (fmt.gamesToWin !== 6 || fmt.deuce !== 'league') });
  }
  const end = Math.max(...[...out.values()].map((x) => x.end));
  return { byId: out, end, courtFree, pairFree };
}

// Что можно сократить в дождь: формат для ещё не начатых матчей.
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
    return {
      ...o,
      end: f.end,
      margin: lightEnd - f.end,
      fits: f.end <= lightEnd,
      affected,
      nothingToCut: o.key !== 'asis' && affected === 0,
      day: f,
    };
  });
}

/* ---------- вызов на корт ---------- */

// Часы вызова для матча: идут для обеих пар с max(вызов, освободились обе пары, освободился корт).
// pairs: [{ freeAt, onCourtAt }]; freeAt: null — пара ещё играет; courtFreeAt: null — корт занят.
export function matchClocks({ calledAt, pairs, courtFreeAt = -Infinity, now, limit = 20 }) {
  const block = pairs.some((p) => p.freeAt == null) ? 'opponents' : courtFreeAt == null ? 'court' : null;
  const start = block ? null : Math.max(calledAt, courtFreeAt, ...pairs.map((p) => p.freeAt));
  return pairs.map((p) => {
    if (p.onCourtAt != null) return { state: 'oncourt', from: start, at: p.onCourtAt };
    if (p.freeAt == null) return { state: 'playing' };
    if (start == null) return { state: 'held', why: block };
    const elapsed = Math.max(0, now - start);
    return { state: elapsed >= limit ? 'expired' : 'waiting', from: start, elapsed: Math.min(elapsed, limit), left: Math.max(0, limit - elapsed) };
  });
}

// Сводка вызова. Не прочитан и срок вышел — «вызовите голосом», а не «срок вышел».
export function callStatus(clocks) {
  const s = clocks.map((c) => c.state);
  if (s.every((x) => x === 'oncourt')) return { key: 'both', text: 'Обе пары на корте' };
  const over = clocks.filter((c) => c.state === 'expired');
  if (over.some((c) => c.read !== false)) return { key: 'expired', text: 'Прошло 20 минут · решение за судьёй' };
  if (over.length) return { key: 'unread', text: 'Вызов не прочитан — вызовите голосом' };
  const waiting = s.filter((x) => x === 'waiting').length;
  if (!waiting && s.includes('playing')) return { key: 'held', text: 'Пара ещё доигрывает · часы стоят' };
  if (!waiting && s.includes('held')) return { key: 'held', text: 'Корт ещё занят · часы стоят' };
  if (waiting === 2) return { key: 'two', text: 'Ждём обе пары' };
  return { key: 'one', text: 'Ждём одну пару' };
}

// Самые долгие из идущих часов
export function leadClock(clocks) {
  const run = clocks.filter((c) => c.state === 'waiting' || c.state === 'expired');
  if (!run.length) return null;
  return run.reduce((a, c) => (c.elapsed > a.elapsed ? c : a));
}

// Средний выход на корт: от начала часов до отметки «на корте».
export function averageTurnout(entries) {
  const xs = (entries || []).filter((e) => e.kind === 'oncourt' && Number.isFinite(e.waited)).map((e) => e.waited);
  if (!xs.length) return null;
  return { n: xs.length, avg: xs.reduce((a, b) => a + b, 0) / xs.length };
}
