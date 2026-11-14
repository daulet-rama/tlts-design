// Признание сезона: чистая логика без DOM.
// Путь награды, места с учётом равенства, «больше всех», строка «Вместе N-й турнир», слова.

/* ---------- путь награды ---------- */

// Награду видят все только после четырёх шагов: посчитано по счёту матчей, директор подтвердил,
// номинант согласился, награда опубликована. Иначе на общем экране её нет.
export const STEPS = Object.freeze(['proposed', 'confirmed', 'agreed', 'published']);
export const STEP_LABELS = Object.freeze({
  proposed: 'Посчитано по матчам',
  confirmed: 'Подтвердил директор',
  agreed: 'Номинант согласен',
  published: 'Опубликовано',
});
export const isPublished = (award) => !!award && STEPS.every((s) => award.steps && award.steps[s]);

/* ---------- места ---------- */

// Сравнение по числам ключа: больше — выше. key(x) → [главное, второе, …].
const cmp = (key) => (a, b) => {
  const x = key(a), y = key(b);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
  }
  return 0;
};

// Места с учётом равенства: одинаковый ключ — одно место («делят 2-е»).
export function ranks(list, key) {
  const c = cmp(key);
  return list.map((item) => 1 + list.filter((o) => c(o, item) < 0).length);
}

// Где стоит item по главному числу: 'alone' — больше всех, 'shared' — делит первое место,
// 'below' — не первый. Второе число решает только при равенстве главного.
export function leadKind(list, item, key) {
  const main = key(item)[0];
  const top = Math.max(...list.map((x) => key(x)[0]));
  if (main < top) return 'below';
  return list.filter((x) => key(x)[0] === top).length > 1 ? 'shared' : 'alone';
}

/* ---------- сыгранность ---------- */

export const TOGETHER_MIN_MATCHES = 5;

// Строка афиши «Вместе N-й турнир» — только факт и только когда пара сыграла вместе
// не меньше пяти матчей до этого матча. Первый турнир вместе — без строки.
export function togetherLine({ tournamentNo, matchesBefore }, min = TOGETHER_MIN_MATCHES) {
  if (!Number.isInteger(tournamentNo) || tournamentNo < 2) return null;
  if (!Number.isFinite(matchesBefore) || matchesBefore < min) return null;
  return `Вместе ${tournamentNo}-й турнир`;
}

/* ---------- счёт ---------- */

// Счёт сета со стороны игрока: «7:6⁵» — выиграл, «6⁴:7» — проиграл (маленькая цифра —
// очки тай-брейка у проигравшего). Возвращает части для разметки.
export function setParts([mine, theirs], tb) {
  const won = mine > theirs;
  const isTb = (mine === 7 && theirs === 6) || (mine === 6 && theirs === 7);
  return { won, a: String(mine), b: String(theirs), supA: isTb && !won ? tb : null, supB: isTb && won ? tb : null };
}

/* ---------- слова ---------- */

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}

// Числа словами для начала фразы («Шесть матчей…»); дальше десяти — цифрами.
const WORDS = ['Ноль', 'Один', 'Два', 'Три', 'Четыре', 'Пять', 'Шесть', 'Семь', 'Восемь', 'Девять', 'Десять'];
export const numWord = (n) => (Number.isInteger(n) && n >= 0 && n <= 10 ? WORDS[n] : String(n));

// Слова, которых на экране нет никогда: тон лиги — не букмекер и не надзор.
export const FORBIDDEN_WORDS = Object.freeze(['фаворит', 'шанс', 'ставк', 'рынок', 'ценник', 'индекс сыгранности', 'через не могу', 'верная пара', 'личные счёты', 'пропал']);
export function forbiddenIn(text) {
  const t = String(text || '').toLowerCase();
  const hits = FORBIDDEN_WORDS.filter((w) => t.includes(w));
  if (/\d\s*%|процент/.test(t)) hits.push('%');
  return hits;
}
