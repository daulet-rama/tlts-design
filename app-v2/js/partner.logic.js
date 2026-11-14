// Коридор напарника: проверка пары по правилу этапа и сроки замены выбывшего.
// Чистые функции без страницы: в приложении переносятся в Dart один к одному.

const r1 = (x) => Math.round(x * 10) / 10;

// 4 → «4.0»
export const fmtK = (x) => (x == null || Number.isNaN(x) ? '—' : r1(x).toFixed(1));

// [7, 8.5] → «7.0–8.5», [8, 8] → «ровно 8.0»
export const corridorText = (c) => (c[0] === c[1] ? `ровно ${fmtK(c[0])}` : `${fmtK(c[0])}–${fmtK(c[1])}`);

export const inCorridor = (sum, c) => r1(sum) >= r1(c[0]) && r1(sum) <= r1(c[1]);

// Можно ли двоим играть вместе: сумма уровней должна попасть в коридор этапа.
// → { ok, sum, where: 'in' | 'above' | 'below', why: 'сумма 9.0 выше коридора 7.0–8.5' }
export function checkPair(kA, kB, c) {
  const sum = r1(kA + kB);
  const where = sum > r1(c[1]) ? 'above' : sum < r1(c[0]) ? 'below' : 'in';
  let why;
  if (where === 'in') why = `сумма ${fmtK(sum)} в коридоре этапа ${corridorText(c)}`;
  else if (c[0] === c[1]) why = `сумма ${fmtK(sum)}, а нужна ровно ${fmtK(c[0])}`;
  else why = `сумма ${fmtK(sum)} ${where === 'above' ? 'выше' : 'ниже'} коридора ${corridorText(c)}`;
  return { ok: where === 'in', sum, where, why };
}

// Замена выбывшего напарника. Сообщить директору — не позже чем за notice дней до жеребьёвки:
// тогда пара остаётся и ищет замену. Позже — сообщить сразу, замена только если разрешит директор.
// После жеребьёвки состав пары не меняется: если выбывает один, снимается вся пара.
export function replacementPhase(daysToDraw, notice = 10) {
  if (daysToDraw < 0) return 'after';
  return daysToDraw >= notice ? 'early' : 'late';
}

// ---------- даты ----------

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const toDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
export const daysBetween = (fromIso, toIso) => Math.round(toDay(toIso) - toDay(fromIso));
export const shiftDays = (iso, n) => new Date((toDay(iso) + n) * 864e5).toISOString().slice(0, 10);
// '2027-06-27' → «27 июня»
export const dayMonth = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

// 1 день, 2 дня, 5 дней
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
