// ============================================================
// Раздел организатора · общий код всех экранов.
// Страница подключает его модулем и берёт что нужно:
//   import { D, toast, confirmAction, seasonCalendar } from './admin.js';
// При загрузке admin.js сам ставит меню, нижнюю панель телефона, верхнюю
// строку, значки, кружки игроков, плашки матчей и выбор плитками.
// Правила — ADMIN-SYSTEM.md, образцы — kit.html.
// ============================================================
import * as D from './data.js';
export { D };

// ---------- мелочи ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Адреса считаются от admin.js, а не от страницы: фото, приложение и меню
// находятся и со страницы во вложенной папке.
export const at = (p) => new URL(p, import.meta.url).href;
const APP = (page) => at(`../app-v2/${page}`);
export const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function el(html) { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstElementChild; }
export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many;
};
export const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n) => String(n).padStart(2, '0');
// set → true, если записалось; 'full' — память браузера заполнена (прежнее записанное остаётся как было);
// false — памяти нет совсем (частный режим): просто не запоминаем.
const isFull = (e) => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return isFull(e) ? 'full' : false; } },
};
export const isPhone = () => matchMedia('(max-width: 759px)').matches;

// ============================================================
// ЗНАЧКИ — один рисунок 24 × 24, линия 2; у каждого значка на экране есть слово
// ============================================================
const P = {
  today: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.7c3.2 3.3 3.2 9.3 0 12.6M18.4 5.7c-3.2 3.3-3.2 9.3 0 12.6"/>',
  cup: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8"/>',
  players: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.8 19.5c.9-3.4 3.3-5 6.2-5s5.3 1.6 6.2 5"/><circle cx="17" cy="9" r="2.7"/><path d="M16.4 14.4c2.5-.1 4.2 1.4 4.8 4.4"/>',
  news: '<path d="M4.5 5.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1V18a1.5 1.5 0 0 0 1.5 1.5H6.5a2 2 0 0 1-2-2z"/><path d="M16.5 9h2.5a1 1 0 0 1 1 1v8a1.5 1.5 0 0 1-3 0"/><path d="M7.5 8.5h6M7.5 12h6M7.5 15.5h4"/>',
  key: '<circle cx="8" cy="15" r="4.2"/><path d="M11 12l8.5-8.5M15.5 7.5l2.5 2.5M13.5 9.5l2 2"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  up: '<path d="M6 14.5l6-6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  month: '<rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M9.2 9.5v11M14.8 9.5v11M3.5 15h17"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.5M4.5 12h.5M4.5 17.5h.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  share: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M6 11.5H5v9h14v-9h-1"/>',
  upload: '<path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 14.5v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17.5l4.8-4.6 3.4 3.1 2.6-2.4 5.2 4.6"/>',
  camera: '<path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  site: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9h18M6.5 6.8h.01M9 6.8h.01"/>',
  board: '<rect x="2.5" y="5" width="19" height="14" rx="3.5"/><path d="M12 5v14M7 10l1.5-1v6M15 9.5h2.5l-2.5 5.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  warn: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.3v.2"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.3v.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  court: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M12 5v14M3.5 8.5h17M3.5 15.5h17M7.5 8.5v7M16.5 8.5v7"/>',
  log: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  exit: '<path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
  move: '<path d="M12 3v18M3 12h18M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  text: '<path d="M5 6h14M12 6v13M8.5 19h7"/>',
  first: '<path d="M6 5v14M18 6l-7 6 7 6"/>',
  wifioff: '<path d="M3.5 4.5l17 15"/><path d="M2.5 9a14 14 0 0 1 5-3M11 4.9A14 14 0 0 1 21.5 9M5.8 12.4a9 9 0 0 1 3.6-2M14.6 10.6a9 9 0 0 1 3.6 1.8M9.2 15.7a4.5 4.5 0 0 1 5.6 0"/><path d="M12 19.3h.01"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5M10.5 7.5v6M7.5 10.5h6"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4h4"/>',
};
const FILLED = {
  more: '<circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/>',
  grip: '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>',
};
export function icon(k, cls = '') {
  const c = cls ? ` class="${cls}"` : '';
  if (FILLED[k]) return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"${c}>${FILLED[k]}</svg>`;
  if (!P[k]) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${c}>${P[k]}</svg>`;
}
const ballMark = '<svg class="ballmark" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#C9E82A" stroke="#11170A" stroke-width="1.5"/><path d="M3.6 4.6c2.8 2.5 2.8 8.3 0 10.8M16.4 4.6c-2.8 2.5-2.8 8.3 0 10.8" fill="none" stroke="#11170A" stroke-width="1.3" stroke-linecap="round"/></svg>';

// ============================================================
// ДАТЫ И ВРЕМЯ СЛОВАМИ
// ============================================================
export const MON = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MON_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
export const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WD_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
export const WD_ACC = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];
export const toDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const toIso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
export const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return toIso(d); };
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
export const dow = (iso) => (toDate(iso).getDay() + 6) % 7; // 0 — понедельник
const dim = (y, m) => new Date(y, m, 0).getDate(); // m — 1…12
const dayNo = (iso) => +iso.slice(8);
const monIdx = (iso) => +iso.slice(5, 7) - 1;
// Неразрывный пробел: «7 августа», «50 минут» не разрываются строкой
const NB = ' ';
// «суббота, 7 августа»
export function dayWords(iso, o = {}) {
  const s = `${o.noWeekday ? '' : WD_FULL[dow(iso)] + ', '}${dayNo(iso)}${NB}${MON_GEN[monIdx(iso)]}`;
  return o.cap ? cap1(s) : s;
}
// «7–14 августа», «28 июля — 4 августа», «7 августа»
export function rangeShort(a, b) {
  if (!b || a === b) return `${dayNo(a)}${NB}${MON_GEN[monIdx(a)]}`;
  if (a.slice(0, 7) === b.slice(0, 7)) return `${dayNo(a)}–⁠${dayNo(b)}${NB}${MON_GEN[monIdx(b)]}`;
  return `${dayNo(a)}${NB}${MON_GEN[monIdx(a)]} — ${dayNo(b)}${NB}${MON_GEN[monIdx(b)]}`;
}
// «Суббота, 7 августа — суббота, 14 августа · 8 дней»
export function rangeWords(a, b) {
  if (!b || a === b) return `${dayWords(a, { cap: true })} · один день`;
  const n = daysBetween(a, b) + 1;
  return `${dayWords(a, { cap: true })} — ${dayWords(b)} · ${n} ${plural(n, 'день', 'дня', 'дней')}`;
}
export const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const hhmm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
// Конец игрового дня: позже 23:00 матчи не ставим — итог об этом говорит словами
export const DAY_END = 23 * 60;
// «около 22:40», «около 00:50 — уже после полуночи»
export const endWords = (min) => `около ${hhmm(min)}${min >= 24 * 60 ? ' — уже после полуночи' : ''}`;
// «Июльский кубок» → «Июльским кубком», «Июльского кубка»
export const instr = (name) => name.replace(/ий кубок$/i, 'им кубком').replace(/^Кубок /, 'Кубком ');
export const gen = (name) => name.replace(/ий кубок$/i, 'ого кубка').replace(/^Кубок /, 'Кубка ');

// Время: «0845», «8:45», «8.45», «8 45», «8» → «08:45»
export function parseTime(text) {
  const t = String(text).trim().replace(/[.\s-]/g, ':');
  let h; let m;
  if (/^\d{3,4}$/.test(t)) { h = +t.slice(0, t.length - 2); m = +t.slice(-2); }
  else if (/^\d{1,2}(:\d{1,2})?$/.test(t)) { [h, m = 0] = t.split(':').map(Number); }
  else return null;
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

// Даты словами и цифрами: «7 августа», «7.08», «07.08.2027», «7/8», «7–14 августа»,
// «с 7 по 14 августа», «07.08–14.08». Год — год сезона.
// Возвращает { from, to, words } или { error } — слова ошибки для строки у поля.
const MONTH_STEMS = [['январ', 0], ['янв', 0], ['феврал', 1], ['фев', 1], ['март', 2], ['мар', 2], ['апрел', 3], ['апр', 3], ['ма', 4], ['июн', 5], ['июл', 6], ['август', 7], ['авг', 7], ['сентябр', 8], ['сен', 8], ['октябр', 9], ['окт', 9], ['ноябр', 10], ['ноя', 10], ['декабр', 11], ['дек', 11]];
const monthOf = (w) => { for (const [s, i] of MONTH_STEMS) if (w.startsWith(s)) return i; return -1; };
export function parseDates(text, { today = D.NOW.iso, year = D.YEAR } = {}) {
  const raw = String(text).trim();
  if (!raw) return { empty: true };
  let t = raw.toLowerCase().replace(/⁠/g, '').replace(/ё/g, 'е').replace(/[–—−]/g, '-').replace(/\s+/g, ' ');
  t = t.replace(/^с\s+/, '').replace(/\s+(по|до)\s+/, '-').replace(/\s*-\s*/, '-');
  const parts = t.split('-').filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return { error: `Не понял «${raw}». Впишите, например: 7–14 августа` };
  const one = (p) => {
    let m;
    if ((m = p.match(/^(\d{1,2})\s*([а-я]+)\.?(?:\s*(\d{4}))?(?:\s*г\.?)?$/))) {
      const mo = monthOf(m[2]); if (mo < 0) return { bad: p };
      return { d: +m[1], m: mo, y: m[3] ? +m[3] : null, src: p };
    }
    if ((m = p.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/))) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null;
      return { d: +m[1], m: +m[2] - 1, y, src: p };
    }
    if ((m = p.match(/^(\d{1,2})$/))) return { d: +m[1], m: null, y: null, src: p };
    return { bad: p };
  };
  const A = one(parts[0]);
  const B = parts[1] ? one(parts[1]) : null;
  if (A.bad || (B && B.bad)) return { error: `Не понял «${raw}». Впишите, например: 7–14 августа` };
  if (A.m === null && B && B.m !== null) A.m = B.m;
  if (A.m === null) return { error: `Не понял «${raw}»: какой месяц? Например: 7–14 августа` };
  if (B && B.m === null) B.m = A.m;
  for (const X of [A, B].filter(Boolean)) {
    if (X.m < 0 || X.m > 11) return { error: `Не понял «${X.src}»: месяца с номером ${X.m + 1} нет` };
    const yy = X.y || year;
    const n = dim(yy, X.m + 1);
    if (X.d < 1 || X.d > n) return { error: `Не понял «${X.d} ${MON_GEN[X.m]}»: в ${MON_PREP[X.m]} ${n} ${plural(n, 'день', 'дня', 'дней')}` };
    X.iso = `${yy}-${pad(X.m + 1)}-${pad(X.d)}`;
  }
  let from = A.iso; let to = B ? B.iso : A.iso;
  if (to < from) [from, to] = [to, from];
  if (from < today) return { error: `${dayNo(from)} ${MON_GEN[monIdx(from)]} уже прошло. Выберите день после ${dayNo(today)} ${MON_GEN[monIdx(today)]}` };
  // «суббота, 7 августа — суббота, 14 августа»: под полем пишется «Даты: …»
  return { from, to, words: from === to ? dayWords(from) : `${dayWords(from)} — ${dayWords(to)}` };
}

// ============================================================
// ТЕМА И «МОЙ ВИД»
// В <head> страницы стоит короткий скрипт, который ставит тему до отрисовки;
// здесь — то же самое для переключателей и ссылок.
// ============================================================
// Тема из адреса (?theme=dark) нужна для снимков и ссылок. Явный выбор человека
// в «Мой вид» главнее: адрес очищается, и ссылки больше не несут ?theme=.
// Размер текста: 'normal' — «Обычный», 'large' — «Крупнее», 'xl' — «Крупный».
// В памяти: { text: 'large' } и для «Крупного» ещё { xl: true } — короткий скрипт в <head>
// каждой страницы уже ставит data-text="large", пока грузится остальное.
const VIEW = 'adm-view';
export const getView = () => store.get(VIEW) || {};
const urlTheme = () => { const q = new URLSearchParams(location.search).get('theme'); return q === 'light' || q === 'dark' ? q : null; };
export function setView(v) {
  const next = { ...getView(), ...v };
  // «Обычный» или «Крупнее», выбранные без xl, снимают «Крупный»
  if ('text' in v && !('xl' in v)) delete next.xl;
  if (next.text !== 'large') delete next.xl;
  if (!next.xl) delete next.xl;
  store.set(VIEW, next);
  if (v.theme) dropThemeParam();
  applyView();
}
export const textSize = () => { const v = getView(); return v.text === 'large' ? (v.xl ? 'xl' : 'large') : 'normal'; };
export const setTextSize = (size) => setView(size === 'xl' ? { text: 'large', xl: true } : { text: size === 'large' ? 'large' : 'normal' });
function dropThemeParam() {
  const u = new URL(location.href);
  if (u.searchParams.has('theme')) { u.searchParams.delete('theme'); history.replaceState(history.state, '', u); }
  $$('a[href]').forEach((a) => {
    const h = a.getAttribute('href');
    if (!/[?&]theme=/.test(h)) return;
    a.setAttribute('href', h.replace(/([?&])theme=(light|dark)&?/, '$1').replace(/[?&](#|$)/, '$1'));
  });
}
export function applyView() {
  const r = document.documentElement;
  const v = getView();
  const t = urlTheme() || v.theme;
  if (t === 'light' || t === 'dark') r.dataset.theme = t; else delete r.dataset.theme;
  if (v.text === 'large') r.dataset.text = 'large'; else delete r.dataset.text;
  if (v.text === 'large' && v.xl) r.dataset.xl = ''; else delete r.dataset.xl;
  document.dispatchEvent(new CustomEvent('adm:view'));
}
// «Мой вид» сменили в другой вкладке — эта вкладка показывает то же
addEventListener('storage', (e) => { if (e.key === VIEW) applyView(); });
export const currentTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
// ссылки на страницы раздела сохраняют ?theme=, пока он есть в адресе
export function keepTheme(href) {
  const t = urlTheme();
  if (!t || !href || /[?&]theme=/.test(href) || /^(#|mailto:|tel:)/.test(href)) return href;
  if (/^https?:/.test(href) && !href.startsWith(location.origin)) return href;
  const [path, hash] = href.split('#');
  return `${path}${path.includes('?') ? '&' : '?'}theme=${t}${hash ? '#' + hash : ''}`;
}
export function fixLinks(root = document) { $$('a[href*=".html"]', root).forEach((a) => { a.setAttribute('href', keepTheme(a.getAttribute('href'))); }); }

// ============================================================
// ОБЩЕЕ СОСТОЯНИЕ ПРИМЕРА — одно на все страницы и вкладки браузера.
// В памяти браузера лежит только сделанное в разделе; мир (D) не меняется.
// Мир и сделанное вместе собирают D.pairsNow, D.joinNow, D.callsNow; числа
// «Июльского кубка» (D.stage('jul-4').pairs, waiting, paid) и D.CALLS уже живые.
//
//   state.get('pairs.jul-4.hor')                    → { status: 'accepted' } или undefined
//   const undo = state.set('pairs.jul-4.hor', { status: 'accepted' },
//     { say: 'приняли пару Хван / Орлов на «Июльский кубок»', href: 'tournament.html?t=jul-4' });
//   toast('Хван / Орлов приняты', { undo });        // «Отменить» вернёт и решение, и строку журнала
//   const off = state.on('pairs.jul-4', (v) => draw());   // зовётся и после правки в другой вкладке
//   state.log('вызвали на корт 1: финал', { href: 'day.html' })   — только строка журнала
//   state.journal() — журнал: мир и сделанное, новое сверху
//   state.now() — часы примера, «18:52»: 18:47 и минута на каждое сделанное дело, не дальше 19:04
//   state.reset() — «Начать пример заново»
//
// Где что лежит (части пути — id из мира):
//   pairs.<турнир>.<пара>   { status: 'accepted'|'waiting'|'reserve'|'refused'|'council'|'removed', why }
//   fees.<турнир>.<пара>    true | false — взнос оплачен
//   join.<заявка>           { step: 'level'|'council'|'fee'|'member'|'declined'|'merged'|'apart', level, asked }
//   cups.<турнир>           черновик и публикация турнира: { state: 'draft'|'open', name, from, to, … }
//   groups.<турнир>         { state: 'draft'|'shown', groups: { A: [пары], … } }
//   bracket.<турнир>        { state: 'draft'|'shown' }
//   days.<турнир>.<день>    расписание дня: { state: 'draft'|'published' }
//   moves.<матч>            перенос: { court, time }
//   scores.<матч>           счёт: { sets: [[6, 4]], winner: 0, was: '7:5', why, confirmed: true }
//   calls.<матч>            вызов на корт: { at: '18:52' }; null — вызов отменён
//   news.<новость>          { state: 'draft'|'live'|'off', title }
//   albums.<альбом>         { state: 'draft'|'live'|'off', cover, uploaded }
//   judges.<матч>           кто судит: id игрока или 'me'; null — судью сняли
//   … и пути разделов — таблица в ADMIN-SYSTEM.md.
//
// Несколько путей одним делом — одна строка журнала и одно «Отменить»:
//   const undo = state.setMany({ 'judges.c5a': null, 'judges.p7': null }, { say: 'отозвали ссылку судьи …' });
// Память браузера заполнена — сделанное не записывается и откатывается, сверху полоса словами;
// записанное раньше остаётся на месте.
// ============================================================
const STATE = 'adm-state-v1';
const UNDO_RESET = 'adm-reset-undo';
const sessionKeys = () => { try { return Object.keys(sessionStorage).filter((k) => k.startsWith('adm-') && k !== UNDO_RESET); } catch { return []; } };
// tick — сколько дел сделано в примере (по ним идут часы примера, ниже); не убывает и после «Отменить»
const freshState = () => ({ v: 1, tick: 0, data: {}, log: [] });
const readState = () => {
  const x = store.get(STATE);
  if (!(x && x.v === 1 && x.data && Array.isArray(x.log))) return freshState();
  if (!Number.isInteger(x.tick) || x.tick < 0) x.tick = x.log.length;   // запись без счётчика — по строкам журнала
  return x;
};
let ST = readState();
const SUBS = new Set();
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const parts = (path) => String(path ?? '').split('.').filter((k) => k && k !== '*');
function valueAt(path) {
  const p = parts(path);
  if (!p.length) return ST;
  if (p[0] === 'log') return ST.log;
  return p.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), ST.data);
}
function putAt(path, value) {
  const p = parts(path);
  let o = ST.data;
  p.slice(0, -1).forEach((k) => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
  const last = p[p.length - 1];
  if (value === undefined) delete o[last]; else o[last] = clone(value);
}
function notify(all = false) {
  D.syncLive();
  SUBS.forEach((x) => {
    const j = JSON.stringify(valueAt(x.path) ?? null);
    if (j === x.last && !all) return;
    x.last = j;
    try { x.fn(clone(valueAt(x.path)), x.path); } catch (e) { console.error(e); }
  });
}
// Память браузера заполнена: жёлтая полоса внизу, там же, где «Готово», — что не сохранилось
// и что делать. Висит, пока не закроют или пока следующее дело не запишется. Полоса «Готово»
// этого же дела не показывается: оно не сохранилось.
let memBar = null; let memFailTick = false;
function memoryFull(on) {
  if (!on) { if (memBar) { memBar.remove(); memBar = null; } return; }
  memFailTick = true; setTimeout(() => { memFailTick = false; }, 0);
  if (!document.body) return;
  const box = toastBox();
  $$('.toast', box).forEach((t) => t.remove());
  if (!memBar) {
    memBar = el(`<div class="membar" role="alert">${icon('alert')}<span class="msg"><b>Не сохранилось — память браузера заполнена.</b> Сделанное раньше на месте. Освободите место: уберите часть фото из альбома или начните пример заново в «Моём виде»</span><button class="btn" type="button">Понятно</button></div>`);
    memBar.querySelector('button').addEventListener('click', () => memoryFull(false));
  }
  box.prepend(memBar);
  placeToasts();
}
// Записать сделанное. Память браузера заполнена — сделанное откатывается (back), внизу — полоса
// словами; записанное раньше не трогаем. Страницы, которые уже нарисовали своё, перерисуются сами.
function persist(back) {
  const ok = store.set(STATE, ST);
  if (ok === 'full') {
    if (back) back();
    memoryFull(true);
    notify();
    setTimeout(() => notify(true), 0);
    return false;
  }
  if (ok === true) memoryFull(false);
  notify();
  return true;
}
// другая вкладка изменила пример — здесь то же
addEventListener('storage', (e) => { if (e.key === STATE) { ST = readState(); notify(); } });
// Часы примера: 18:47 и минута на каждое сделанное дело (строку журнала), но не дальше 19:04.
// Мир примера стоит: в 19:05 по прогнозу кончается матч на корте 3 (D.FORECAST), и часы его не обгоняют.
// Отсюда берут время «сейчас» в шапках, журнал, часы вызова на корт и прогноз дня.
const CLOCK_END = Math.min(...Object.values(D.FORECAST).map(toMin)) - 1;
const nowMin = () => Math.min(CLOCK_END, D.NOW.min + ST.tick);
const myRole = () => (document.body && ROLE[document.body.dataset.role] ? document.body.dataset.role : 'org');
function addLog(what, { href = '', kind = '' } = {}) {
  const e = { id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, day: D.NOW.iso, at: hhmm(nowMin()), who: 'me', role: myRole(), what, href, kind };
  ST.log.unshift(e);
  ST.tick += 1;   // дело сделано — на часах примера минутой больше
  return e.id;
}
const dropLog = (id) => { if (id) ST.log = ST.log.filter((e) => e.id !== id); };
const noUndo = () => {};
export const state = {
  get(path, fallback) { const v = valueAt(path); return v === undefined ? fallback : clone(v); },
  set(path, value, opts) { return state.setMany({ [path]: value }, opts); },
  // несколько путей одним делом: { 'judges.c5a': null, 'judges.p7': null } — одна строка журнала, одно «Отменить»
  setMany(changes, { say, href, kind } = {}) {
    const list = Object.entries(changes || {});
    if (!list.length) return noUndo;
    list.forEach(([path]) => { const p = parts(path); if (!p.length || p[0] === 'log') throw new Error('state.set: нужен путь, например pairs.jul-4.hor'); });
    const before = list.map(([path]) => [path, clone(valueAt(path))]);
    const back = () => before.slice().reverse().forEach(([path, v]) => putAt(path, v));
    list.forEach(([path, v]) => putAt(path, v));
    const tick = ST.tick;
    const id = say ? addLog(say, { href, kind: kind || parts(list[0][0])[0] }) : null;
    if (!persist(() => { back(); dropLog(id); ST.tick = tick; })) return noUndo;
    return () => {
      const now = list.map(([path]) => [path, clone(valueAt(path))]); const log = ST.log.find((e) => e.id === id);
      back(); dropLog(id);
      persist(() => { now.forEach(([path, v]) => putAt(path, v)); if (log) ST.log.unshift(log); });
    };
  },
  update(path, fn, opts) { return state.set(path, fn(state.get(path)), opts); },
  on(path, fn) { const x = { path, fn, last: JSON.stringify(valueAt(path) ?? null) }; SUBS.add(x); return () => SUBS.delete(x); },
  log(what, opts) {
    const tick = ST.tick;
    const id = addLog(what, opts);
    if (!persist(() => { dropLog(id); ST.tick = tick; })) return noUndo;
    return () => { const log = ST.log.find((e) => e.id === id); dropLog(id); persist(() => { if (log) ST.log.unshift(log); }); };
  },
  journal: () => journal(),
  now: () => hhmm(nowMin()),
  reset: () => resetExample(),
};
D.bindState(() => ST.data);

// ---------- журнал действий: мир (что было до 18:47) и сделанное в разделе ----------
// Строка: { day, at, who: 'me' | 'applicant' | id игрока, role, what, href, kind }.
// what — со слов «Вы …» для 'me' («вызвали на корт 2: …») и «он …» для остальных («подал анкету»).
// «Ильин / Каримов» не рвётся строкой посередине пары
const pairTight = (id) => D.pairName(id).replace(/ \/ /g, '\u00a0/\u00a0');
function worldLog() {
  const day = D.NOW.iso;
  const out = [];
  D.DAY_LOG.filter(([, kind]) => kind === 'call').forEach(([at, , id]) => {
    const m = D.match(id);
    out.push({ day, at, who: 'me', role: 'org', kind: 'day', href: 'day.html', what: `вызвали на ${D.COURTS[m.court].name.toLowerCase()}: ${matchName(m.title)} — ${pairTight(m.pairs[0])} и ${pairTight(m.pairs[1])}` });
  });
  const jn = D.JOIN_APPS.find((a) => a.kind === 'join');
  if (jn && jn.registered) out.push({ day, at: jn.registered, who: 'applicant', kind: 'apps', href: `applications.html?a=${jn.id}`, what: 'зарегистрировался в приложении' });
  if (jn) out.push({ day, at: jn.at, who: 'applicant', kind: 'apps', href: `applications.html?a=${jn.id}`, what: 'подал анкету на вступление в лигу' });
  D.JOIN_APPS.filter((a) => a.kind === 'merge').forEach((a) => out.push({ day, at: a.at, who: a.player, kind: 'apps', href: `applications.html?a=${a.id}`, what: `вошёл в новое приложение как «${a.typed.first} ${a.typed.last}» — сайт нашёл похожего игрока лиги` }));
  const draft = D.stage('aug-5');
  if (draft) out.push({ day: addDays(D.NOW.iso, -1), at: '22:10', who: 'me', role: 'org', kind: 'tour', href: 'new-tournament.html?draft=aug-5', what: `сохранили черновик «${draft.name}»` });
  // черновые дни расписания из мира: кто и когда их расставил («Тимур Ахметов расставил матчи на субботу, 10 июля»)
  Object.entries(D.DAY_DRAFTS || {}).forEach(([tid, days]) => Object.entries(days).forEach(([iso, d]) => {
    const st = D.stage(tid); const n = Object.keys(d.place || {}).length;
    if (d.by && d.saved) out.push({ day, at: d.saved, who: d.by, kind: 'days', href: `schedule.html?t=${tid}&day=${iso}`, what: `расставил ${n} ${plural(n, 'матч', 'матча', 'матчей')} на ${WD_ACC[dow(iso)]}, ${+iso.slice(8)} ${MON_GEN[+iso.slice(5, 7) - 1]} — черновик расписания «${gen(st.name)}»` });
  }));
  return out;
}
function journal() {
  return [...clone(ST.log), ...worldLog()].sort((a, b) => (a.day !== b.day ? (a.day < b.day ? 1 : -1) : a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
// Роль человека в разделе сейчас: мир (D.STAFF) и роли, выданные на экране ролей
// (staff.<человек> = 'org' | 'council' | 'news' | 'admin'; null — доступ забрали).
export function staffRole(pid) {
  const v = valueAt(`staff.${pid}`);
  if (v !== undefined) return v && ROLE[v] ? v : null;
  const s = D.STAFF.find((x) => x.pid === pid);
  return s ? s.role : null;
}
// кто: «Вы · организатор», «Арман Есенов · кандидат», «Ерлан Сарсенбаев · игрок лиги»
export function whoWords(e) {
  const roleWord = (r) => (ROLE[r] ? ROLE[r].who : '');
  if (e.who === 'me') return { name: 'Вы', short: 'Вы', role: roleWord(e.role || 'org') };
  if (e.who === 'applicant') return { name: `${D.APPLICANT.first} ${D.APPLICANT.last}`, short: D.APPLICANT.last, role: 'кандидат' };
  const p = D.player(e.who);
  const r = staffRole(e.who);
  return { name: p ? p.name : '', short: p ? p.last : '', role: r ? roleWord(r) : 'игрок лиги' };
}

// ---------- «Начать пример заново» ----------
// Всё сделанное (общее состояние и память страниц этой вкладки) уходит; «Мой вид» остаётся.
// После перезагрузки — полоса «Пример начат заново · Отменить».
function resetExample() {
  const keep = { state: (() => { try { return localStorage.getItem(STATE); } catch { return null; } })(), session: {} };
  sessionKeys().forEach((k) => { try { keep.session[k] = sessionStorage.getItem(k); sessionStorage.removeItem(k); } catch { /* */ } });
  try { localStorage.removeItem(STATE); } catch { /* без памяти — и так с начала */ }
  try { sessionStorage.setItem(UNDO_RESET, JSON.stringify(keep)); } catch { /* */ }
  location.reload();
}
function afterReset() {
  let keep = null;
  try { keep = JSON.parse(sessionStorage.getItem(UNDO_RESET)); sessionStorage.removeItem(UNDO_RESET); } catch { keep = null; }
  if (!keep) return;
  toast('Пример начат заново: решения, черновики и вызовы — как в начале', {
    undo: () => {
      try {
        if (keep.state) localStorage.setItem(STATE, keep.state);
        Object.entries(keep.session || {}).forEach(([k, v]) => { if (v != null) sessionStorage.setItem(k, v); });
      } catch { /* */ }
      location.reload();
    },
  });
}

// ============================================================
// РАМКА: меню слева (ноутбук), нижняя панель (телефон), «Вы: организатор»
// <body data-nav="today|tournaments|players|news|access|settings|log" data-role="org|council|news|admin">
// Внизу меню — «Журнал действий» (log.html), «Мой вид» (шторка с любой страницы) и «Выйти».
// ============================================================
export const NAV = [
  { key: 'today', href: 'today.html', label: 'Сегодня', icon: 'today' },
  { key: 'tournaments', href: 'season.html', label: 'Турниры', icon: 'cup', count: 'pairs' },
  { key: 'players', href: 'players.html', label: 'Игроки', icon: 'players', count: 'join' },
  { key: 'news', href: 'content.html', label: 'Новости и фото', short: 'Новости', icon: 'news' },
  { key: 'access', href: 'judges.html', label: 'Судьи и доступ', icon: 'key' },
  { key: 'settings', href: 'settings.html', label: 'Настройки', icon: 'sliders' },
];
// log — видит ли «Журнал действий» (СОСТАВ.md, раздел 0: в «Ещё» — Судьи и доступ, Настройки, Журнал действий)
export const ROLE = {
  org: { who: 'организатор', nav: ['today', 'tournaments', 'players', 'news', 'access', 'settings'], log: true },
  council: { who: 'член Совета', nav: ['today', 'tournaments', 'players', 'settings'] },
  news: { who: 'новости и фото', nav: ['today', 'news'] },
  admin: { who: 'админ', nav: ['today', 'tournaments', 'players', 'news', 'access', 'settings'], log: true },
};
// Счётчики у пунктов меню — из мира и общего состояния: сколько заявок ждут ответа
export function counts() {
  const pairs = D.STAGES.filter((x) => x.state === 'open' && D.ROSTER[x.id]).reduce((n, x) => n + D.pairsNow(x.id).waiting.length, 0);
  return { pairs, join: D.joinOpen().length };
}
const COUNT_WORDS = {
  pairs: (n) => `${n} ${plural(n, 'заявка пары ждёт', 'заявки пар ждут', 'заявок пар ждут')} ответа`,
  join: (n) => `${n} ${plural(n, 'заявка в лигу ждёт', 'заявки в лигу ждут', 'заявок в лигу ждут')} решения`,
};
const countHtml = (n, c = counts()) => (n.count && c[n.count] ? `<span class="n"><span aria-hidden="true">${c[n.count]}</span><span class="vh">: ${esc(COUNT_WORDS[n.count](c[n.count]))}</span></span>` : '');
function paintCounts() {
  const c = counts();
  $$('.side .nav a[data-key], .tabbar a[data-key]').forEach((a) => {
    const n = NAV.find((x) => x.key === a.dataset.key);
    if (!n || !n.count) return;
    $$(':scope > .n', a).forEach((x) => x.remove());
    const h = countHtml(n, c);
    if (h) a.append(el(h));
  });
}
// День игры: сегодня играет турнир — «Вызов на корт» ведёт на «День турнира» (day.html)
export const gameDay = () => D.STAGES.find((x) => x.state === 'live' && (x.play || []).includes(D.NOW.iso)) || null;
// день турнира ведут организатор и админ: у Совета и «Новостей и фото» «Вызова на корт» нет
const runsDay = () => ['org', 'admin'].includes(myRole());
const isDayLink = (a) => { try { return new URL(a.getAttribute('href'), location.href).pathname.endsWith('/day.html'); } catch { return false; } };
const fileName = () => location.pathname.split('/').pop() || 'index.html';

export function mountFrame() {
  const b = document.body;
  if (b.dataset.frame === 'none' || $('.side')) return;
  const frame = $('.frame');
  const main = $('.frame-main');
  if (!frame || !main) return;
  const active = b.dataset.nav || '';
  const R = ROLE[b.dataset.role] || ROLE.org;
  const items = NAV.filter((n) => R.nav.includes(n.key));
  const go = (p) => keepTheme(at(p));
  const cur = (k) => (k === active ? ' aria-current="page"' : '');
  const c = counts();
  const side = el(`<nav class="side" aria-label="Разделы">
    <a class="brand" href="${go('today.html')}"><span class="mark">${icon('today')}</span><span><b>${esc(D.LEAGUE.short)}</b><span>Раздел организатора</span></span></a>
    <div class="nav">${items.map((n) => `<a href="${go(n.href)}" data-key="${n.key}"${cur(n.key)}>${icon(n.icon)}<span>${esc(n.label)}</span>${countHtml(n, c)}</a>`).join('')}</div>
    <div class="side-foot">
      ${R.log ? `<a href="${go('log.html')}"${cur('log')}>${icon('log')}<span>Журнал действий</span></a>` : ''}
      <button type="button" data-myview aria-haspopup="dialog">${icon('eye')}<span>Мой вид</span></button>
      <a href="#" data-exit>${icon('exit')}<span>Выйти</span></a>
    </div>
  </nav>`);
  frame.prepend(side);
  const top = el(`<div class="topline"><span class="who">${icon('user')}Вы: ${esc(R.who)}</span><a href="${at('../live/index.html')}" target="_blank" rel="noopener">${icon('site')}Открыть сайт</a></div>`);
  main.prepend(top);
  // телефон: «Сегодня · Турниры · Игроки · Новости · Ещё»
  const tabs = items.slice(0, 4);
  const rest = items.slice(4);
  const inMore = rest.some((n) => n.key === active) || active === 'log';
  const bar = el(`<nav class="tabbar glass" aria-label="Разделы" style="grid-template-columns:repeat(${tabs.length + 1},minmax(0,1fr))">${tabs.map((n) => `<a href="${go(n.href)}" data-key="${n.key}"${cur(n.key)}>${icon(n.icon)}<span>${esc(n.short || n.label)}</span>${countHtml(n, c)}</a>`).join('')}<button type="button" data-more aria-haspopup="dialog"${inMore ? ' aria-current="page"' : ''}>${icon('more')}<span>Ещё</span></button></nav>`);
  b.append(bar);
  bar.querySelector('[data-more]').addEventListener('click', () => {
    const g = runsDay() && gameDay();
    openSheet({
      title: 'Ещё',
      body: `<p class="muted">Вы: ${esc(R.who)}</p><div class="menu" style="padding:0">
        ${g ? `<a href="${go('day.html')}" class="strong"${fileName() === 'day.html' ? ' aria-current="page"' : ''}>${icon('bell')}Вызов на корт</a>` : ''}
        ${rest.map((n) => `<a href="${go(n.href)}"${cur(n.key)}>${icon(n.icon)}${esc(n.label)}</a>`).join('')}
        ${R.log ? `<a href="${go('log.html')}"${cur('log')}>${icon('log')}Журнал действий</a>` : ''}
        <button type="button" data-myview>${icon('eye')}Мой вид</button>
        <a href="${at('../live/index.html')}" target="_blank" rel="noopener">${icon('site')}Открыть сайт</a>
        <a href="#" data-exit>${icon('exit')}Выйти</a></div>`,
    });
  });
  document.addEventListener('click', (e) => {
    const x = e.target.closest('[data-exit]');
    if (!x) return;
    e.preventDefault();
    confirmAction({ title: 'Выйти из раздела организатора?', text: 'Черновики сохранены — продолжите с того же места.', action: 'Выйти', kind: 'main', onConfirm: () => toast('Вы вышли. Чтобы вернуться, войдите снова') });
  });
  state.on('', paintCounts);
  watchHead();
  mountDayCall();
}
// Прилипшая шапка короче (подпись под заголовком прячется) — на столько же места остаётся под ней,
// поэтому содержимое не подскакивает, когда шапка прилипает.
function watchHead() {
  const head = $('.page-head');
  if (!head) return;
  // Колонка «Так увидят» прилипает ниже шапки, а не уходит под неё: её верх — высота прилипшей шапки
  // (без подписи под заголовком) и 16 px, не меньше 112. Шапка выросла (строка «кто увидит»,
  // крупный текст) — верх колонки тоже.
  const pvTop = () => {
    if (!head.isConnected) return;
    const sub = $('.head-sub', head);
    const subH = !head.classList.contains('stuck') && sub && getComputedStyle(sub).display !== 'none' ? sub.offsetHeight + 6 : 0;
    const h = getComputedStyle(head).position === 'sticky' ? head.offsetHeight - subH : 0;
    document.documentElement.style.setProperty('--pv-top', `${Math.max(112, Math.round(h + 16))}px`);
  };
  const check = () => {
    const on = scrollY > 2 && head.getBoundingClientRect().top <= 1;
    if (on === head.classList.contains('stuck')) return;
    const h0 = head.offsetHeight;
    head.classList.toggle('stuck', on);
    head.style.marginBottom = on && getComputedStyle(head).position === 'sticky' ? `${Math.max(0, h0 - head.offsetHeight)}px` : '';
    pvTop();
  };
  addEventListener('scroll', check, { passive: true });
  check();
  pvTop();
  if ('ResizeObserver' in window) new ResizeObserver(pvTop).observe(head);
}
// «Вызов на корт» в день игры: на «Сегодня» и в шапке турнира, который играет сегодня.
// Шапку страница дописывает сама, поэтому кнопка встаёт, как только в заголовке — этот турнир.
// Если в шапке уже есть путь на «День турнира», вторую кнопку не ставим.
function mountDayCall() {
  const g = gameDay();
  const head = $('.page-head');
  const file = fileName();
  if (!g || !head || file === 'day.html' || !runsDay()) return;
  const want = () => {
    if (file === 'today.html') return true;
    const h1 = $('.head-row .h1', head);
    return !!h1 && h1.textContent.trim() === g.name && !!$('#tabs, .ttabs');
  };
  let queued = false;
  const sync = () => {
    queued = false;
    const has = $(':scope > .head-call', head);
    const other = $$('a[href]', head).some((a) => isDayLink(a) && !a.closest('.head-call'));
    const ok = want() && !other;
    if (ok && !has) head.append(el(`<div class="head-call"><a class="btn quiet bold" href="${esc(keepTheme(at('day.html')))}">${icon('bell')}Вызов на корт</a></div>`));
    else if (!ok && has) has.remove();
  };
  sync();
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(sync); } }).observe(head, { childList: true, subtree: true, characterData: true });
}

// ============================================================
// «МОЙ ВИД»: размер текста и тема. Меняются сразу, только у вас, на этом устройстве.
// Шторка открывается из меню с любой страницы (openMyView). Внизу — «Начать пример заново».
// myViewHtml() и bindMyView(узел) — те же плитки для своей страницы.
// ============================================================
const SIZES = [{ v: 'normal', t: 'Обычный' }, { v: 'large', t: 'Крупнее' }, { v: 'xl', t: 'Крупный' }];
const themePic = (t) => `<span class="myv-pic" data-mock="${t}" aria-hidden="true"><span class="m-side"><i></i><i class="on"></i><i></i><i></i></span><span class="m-main"><i></i><i></i><i></i></span></span>`;
export function myViewHtml() {
  const size = textSize(); const theme = currentTheme();
  return `<div class="myv">
    <section class="myv-group" aria-labelledby="myv-text"><h3 class="h3" id="myv-text">Размер текста</h3>
      <div class="choices myv-sizes" role="radiogroup" aria-labelledby="myv-text" data-myv="text">${SIZES.map((x) => `<button type="button" class="choice" role="radio" aria-checked="${x.v === size}" data-value="${x.v}"><span class="t">${x.t}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div>
    </section>
    <section class="myv-group" aria-labelledby="myv-theme"><h3 class="h3" id="myv-theme">Тема</h3>
      <div class="choices myv-themes" role="radiogroup" aria-labelledby="myv-theme" data-myv="theme">${[['light', 'Светлая'], ['dark', 'Тёмная']].map(([v, t]) => `<button type="button" class="choice" role="radio" aria-checked="${v === theme}" data-value="${v}"><span class="pic">${themePic(v)}</span><span class="t">${t}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div>
    </section>
  </div>`;
}
export function bindMyView(root) {
  root.addEventListener('change', (e) => {
    const g = e.target.closest('[data-myv]');
    if (!g) return;
    if (g.dataset.myv === 'text') { if (e.detail !== textSize()) setTextSize(e.detail); }
    else if (e.detail !== currentTheme()) setView({ theme: e.detail });
  });
}
export function openMyView() {
  const s = openSheet({
    title: 'Мой вид',
    body: `<p class="muted">Только у вас, на этом устройстве</p>${myViewHtml()}
      <section class="myv-reset" aria-labelledby="myv-demo"><h3 class="h3" id="myv-demo">Только для показа</h3><p>В настоящем разделе этой кнопки не будет. Она возвращает пример к началу: решения, черновики и вызовы на корт. Размер текста и тема останутся.</p><button class="btn quiet" type="button" data-reset>${icon('restart')}Начать пример заново</button></section>`,
  });
  bindMyView(s);
  s.querySelector('[data-reset]').addEventListener('click', () => resetExample());
  return s;
}
document.addEventListener('click', (e) => {
  const x = e.target.closest('[data-myview]');
  if (!x) return;
  e.preventDefault();
  openMyView();
});

// ============================================================
// КРУЖКИ ИГРОКОВ, ПАРЫ, ПЛАШКА «ПАРА ПРОТИВ ПАРЫ»
// ============================================================
export function avHtml(pid, size = '') {
  const p = D.player(pid);
  const src = p.portrait ? at(`img/${p.portrait}-sm.webp`) : null;
  const cls = `av${size ? ' ' + size : ''}`;
  return src ? `<span class="${cls}"><img src="${src}" alt="" loading="lazy"></span>` : `<span class="${cls}" aria-hidden="true">${esc(D.initials(p))}</span>`;
}
export const duoHtml = (pairId, size = 'sm') => `<span class="duo" aria-hidden="true">${D.pair(pairId).players.map((x) => avHtml(x, size)).join('')}</span>`;
// «Назаров и Гасанов» — для фраз
export const pairAnd = (id) => D.pair(id).players.map((x) => D.player(x).last).join(' и ');
// «финал», «полуфинал», «матч за 3-е место», «группа C» — меняется только первая буква
const low1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
export const matchName = (title) => (/^За /.test(title) ? `матч ${low1(title)}` : low1(title));
const minutesWords = (n) => `${n} ${plural(n, 'минута', 'минуты', 'минут')}`;
// Плашка матча — как в приложении: скоро (полоса покрытия), идёт, сыгран.
export function vsHtml(m, opts = {}) {
  if (typeof m === 'string') m = D.match(m);
  const c = m.court ? D.COURTS[m.court] : null;
  const href = opts.href;
  const tagName = href ? 'a' : 'div';
  let head = '';
  if (m.state === 'live') head = `<span class="tag live">Идёт${c ? ' · ' + esc(c.name) : ''}</span>`;
  else if (m.state === 'soon') head = `${c ? `<span class="srf-dot" data-srf="${c.surface}"></span>${esc(D.courtLine(m.court))}` : ''}`;
  else head = `Сыгран${m.duration ? ' · ' + esc(minutesWords(parseInt(m.duration, 10))) : ''}`;
  const side = (i) => {
    const id = m.pairs[i];
    let cls = 'vs-side';
    let sc = '';
    if (m.state === 'done') {
      cls += m.winner === i ? ' win' : ' lose';
      sc = `<span class="num sc">${m.sets.map(([a, b]) => (i === 0 ? a : b)).join(' ')}</span>`;
    } else if (m.state === 'live') {
      sc = `<span class="num sc">${m.games[i]}</span>`;
    }
    const srv = m.state === 'live' && m.server === i ? ballMark : '';
    return `<span class="${cls}">${duoHtml(id)}<span class="nm">${esc(D.pairName(id))}</span>${srv}${sc}</span>`;
  };
  const when = m.state === 'soon' ? `<span class="vs-when"><span class="num">${esc(m.time)}</span>${m.day === D.TODAY.dayMonth ? '' : `<span class="muted">${esc(m.day)}</span>`}</span>` : '';
  const strip = m.state === 'soon' && c ? `<span class="vs-srf srf-fill" data-srf="${c.surface}" aria-hidden="true"></span>` : '';
  return `<${tagName} class="vs" data-state="${m.state}"${href ? ` href="${esc(keepTheme(href))}"` : ''}>${strip}
    <span class="vs-head">${head}<span class="what">${esc(m.title)}</span></span>
    <span style="display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:0 16px"><span>${side(0)}${side(1)}</span>${when}</span>
  </${tagName}>`;
}

// ============================================================
// ГИДРАТАЦИЯ: значки, кружки, плашки, выбор плитками, подгонка длинных фамилий
// <i data-icon="plus"></i> · <i data-av="p17"></i> · <i data-duo="hor"></i> · <i data-vs="final"></i>
// ============================================================
export function hydrate(root = document) {
  $$('[data-icon]', root).forEach((x) => { x.outerHTML = icon(x.dataset.icon, x.getAttribute('class') || ''); });
  $$('[data-av]', root).forEach((x) => { x.outerHTML = avHtml(x.dataset.av, x.dataset.size || ''); });
  $$('[data-duo]', root).forEach((x) => { x.outerHTML = duoHtml(x.dataset.duo, x.dataset.size || 'sm'); });
  $$('[data-vs]', root).forEach((x) => { x.outerHTML = vsHtml(x.dataset.vs, { href: x.dataset.href }); });
  choices(root);
  fixLinks(root);
  requestAnimationFrame(() => fitText(root));
}
// Длинная фамилия не обрезается и не уходит под многоточие: сначала шрифт уже
// (87,5 %, потом 75 %), потом на 2 px мельче, и только потом перенос.
// В CSS эти строки переносятся сами — если код не успел, слово не режется.
// Пересчёт — после смены «Мой вид», ширины окна и загрузки шрифта.
const FIT = '.fit, .mc-pair:not(.tbd), .mc-top, .mc-foot, .vs-side .nm, .pl-open .pr';
export function fitText(root = document) {
  $$(FIT, root).forEach((x) => {
    x.style.fontStretch = ''; x.style.fontSize = ''; x.style.whiteSpace = ''; x.style.flexWrap = '';
    if (!x.clientWidth) return; // скрыто — посчитаем, когда покажется
    x.style.whiteSpace = 'nowrap'; x.style.flexWrap = 'nowrap';
    const fits = () => x.scrollWidth <= x.clientWidth + 1;
    if (fits()) return;
    for (const s of ['87.5%', '75%']) { x.style.fontStretch = s; if (fits()) return; }
    x.style.fontSize = `${parseFloat(getComputedStyle(x).fontSize) - 2}px`;
    if (fits()) return;
    x.style.whiteSpace = 'normal'; x.style.flexWrap = 'wrap';
  });
}
let refitTimer = null;
export const refit = () => { clearTimeout(refitTimer); refitTimer = setTimeout(() => fitText(document), 120); };
addEventListener('resize', refit);
document.addEventListener('adm:view', () => requestAnimationFrame(() => fitText(document)));

// ============================================================
// ВЫБОР ПЛИТКАМИ И КНОПКАМИ
// Один из нескольких: <div role="radiogroup"> … <button role="radio" aria-checked="false">
// Несколько: <button class="chip" aria-pressed="false" data-toggle>
// Группа сообщает выбор событием change (detail — data-value выбранного).
// ============================================================
export function choices(root = document) {
  $$('[role="radiogroup"]', root).forEach((g) => {
    if (g.dataset.on) return;
    g.dataset.on = '1';
    const items = () => $$('[role="radio"]', g);
    const sync = () => {
      const all = items();
      all.forEach((x) => { x.tabIndex = x.getAttribute('aria-checked') === 'true' ? 0 : -1; });
      if (!all.some((x) => x.tabIndex === 0) && all[0]) all[0].tabIndex = 0;
    };
    const pick = (it, focus) => {
      items().forEach((x) => x.setAttribute('aria-checked', String(x === it)));
      sync();
      if (focus) it.focus();
      g.dispatchEvent(new CustomEvent('change', { detail: it.dataset.value ?? it.textContent.trim(), bubbles: true }));
    };
    g.addEventListener('click', (e) => { const it = e.target.closest('[role="radio"]'); if (it && g.contains(it)) pick(it, false); });
    g.addEventListener('keydown', (e) => {
      const all = items(); const i = all.indexOf(document.activeElement);
      if (i < 0) return;
      const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!k) return;
      e.preventDefault();
      pick(all[(i + k + all.length) % all.length], true);
    });
    sync();
  });
  $$('[data-toggle]', root).forEach((x) => {
    if (x.dataset.on) return;
    x.dataset.on = '1';
    x.addEventListener('click', () => x.setAttribute('aria-pressed', String(x.getAttribute('aria-pressed') !== 'true')));
  });
}
// Плитки вариантов: [{ value, t, s, checked }] → разметка radiogroup
export const choicesHtml = (label, opts, cls = '') => `<div class="choices ${cls}" role="radiogroup" aria-label="${esc(label)}">${opts.map((o) => `<button type="button" class="choice" role="radio" aria-checked="${o.checked ? 'true' : 'false'}" data-value="${esc(o.value)}"><span class="t">${esc(o.t)}</span>${o.s ? `<span class="s">${esc(o.s)}</span>` : ''}<span class="dot" aria-hidden="true"></span></button>`).join('')}</div>`;

// ============================================================
// ОКНА: шторка, окно подтверждения, «Продолжить черновик?», подсказка
// Одно окно за раз. Esc и затемнение закрывают; фокус остаётся внутри окна.
// ============================================================
let layer = null;
// onClose — человек закрыл окно сам (крестик, Esc, затемнение, «Отмена»);
// onGone — окно убрано любым путём, в том числе другим окном (вернуть взятое на место).
function openLayer(node, { onClose, onGone, label } = {}) {
  closeLayer(true);
  const scrim = el('<div class="scrim"></div>');
  const prev = document.activeElement;
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-modal', 'true');
  if (label) node.setAttribute('aria-label', label);
  document.body.append(scrim, node);
  layer = { node, scrim, prev, onClose, onGone };
  scrim.addEventListener('click', () => closeLayer());
  hydrate(node);
  // фокус — никогда не на красной кнопке: Enter не должен удалять
  setTimeout(() => {
    const f = node.querySelector('[autofocus]') || node.querySelector('.btn.main') || node.querySelector('input:not([type=hidden]), textarea') || node.querySelector('.sheet-foot .btn.quiet, .btns .btn.quiet, [data-no], [data-x]') || node.querySelector('button:not(.danger), a');
    if (f) f.focus();
  }, 40);
  return node;
}
export function closeLayer(silent = false) {
  if (!layer) return;
  const { node, scrim, prev, onClose, onGone } = layer;
  layer = null;
  if (onGone) onGone(node);
  node.remove(); scrim.remove();
  if (!silent && onClose) onClose();
  if (prev && prev.isConnected && prev.focus) prev.focus({ preventScroll: true });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (pop) closePop(); else if (layer) closeLayer(); }
  if (e.key === 'Tab' && layer) {
    const f = $$('button:not([disabled]), a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])', layer.node).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0]; const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
const nodeOrHtml = (x) => (x instanceof Node ? x : el(`<div>${x ?? ''}</div>`));
// Шторка: справа на ноутбуке, снизу на телефоне. body и foot — разметка или узел
// (узел ставится в шторку целиком). full: true — на телефоне во весь экран.
export function openSheet({ title, body = '', foot = '', label, onClose, onGone, wide, full } = {}) {
  const s = el(`<section class="sheet glass${wide ? ' wide' : ''}${full ? ' full' : ''}"><div class="sheet-head"><h2 class="h2">${esc(title)}</h2><button class="btn quiet close" type="button" data-x>${icon('close')}Закрыть</button></div><div class="sheet-body"></div>${foot ? '<div class="sheet-foot"></div>' : ''}</section>`);
  const sb = s.querySelector('.sheet-body');
  if (body instanceof Node) sb.append(body); else sb.append(...nodeOrHtml(body).childNodes);
  if (foot) { if (foot instanceof Node) s.querySelector('.sheet-foot').append(foot); else s.querySelector('.sheet-foot').append(...nodeOrHtml(foot).childNodes); }
  s.querySelector('.sheet-head [data-x]').addEventListener('click', () => closeLayer());
  return openLayer(s, { onClose, onGone, label: label || title });
}
// Подтверждение словами. kind: 'danger' — красная кнопка; 'main' — главная.
// consq — последствия списком; опасная кнопка называет действие: «Удалить турнир».
// В опасном окне фокус на «Отмена»; на телефоне «Отмена» внизу, под пальцем.
export function confirmAction({ title, text = '', consq = [], action, kind = 'danger', cancel = 'Отмена', onConfirm } = {}) {
  const danger = kind === 'danger';
  const d = el(`<section class="dialog glass${danger ? ' danger' : ''}"><h2 class="h2">${esc(title)}</h2>${text ? `<p class="lead">${esc(text)}</p>` : ''}${consq.length ? `<div class="consq">${consq.map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : ''}<div class="btns"><button class="btn ${danger ? 'danger' : 'main'}" type="button" data-ok>${danger ? icon('trash') : ''}${esc(action)}</button><button class="btn quiet" type="button" data-no${danger ? ' autofocus' : ''}>${esc(cancel)}</button></div></section>`);
  d.querySelector('[data-ok]').addEventListener('click', () => { closeLayer(true); if (onConfirm) onConfirm(); });
  d.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  return openLayer(d, { label: title });
}
// 0.1 «Продолжить черновик?»
export function resumeDraft({ name, saved, onContinue, onRestart } = {}) {
  const d = el(`<section class="dialog glass"><h2 class="h2">Продолжить черновик «${esc(name)}»?</h2><p class="lead muted">Сохранён ${esc(saved)}</p><div class="btns"><button class="btn main" type="button" data-ok>Продолжить</button><button class="btn quiet" type="button" data-no>Начать заново</button></div></section>`);
  d.querySelector('[data-ok]').addEventListener('click', () => { closeLayer(true); if (onContinue) onContinue(); });
  d.querySelector('[data-no]').addEventListener('click', () => { closeLayer(true); if (onRestart) onRestart(); });
  return openLayer(d, { label: `Продолжить черновик «${name}»?` });
}
// Подсказка у календаря (карточка турнира или пустого дня) — стекло, без затемнения.
let pop = null;
function outside(e) { if (pop && !pop.node.contains(e.target) && !pop.anchor.contains(e.target)) closePop(); }
export function closePop() {
  if (!pop) return;
  const { node, anchor } = pop;
  pop = null;
  node.remove();
  document.removeEventListener('pointerdown', outside);
  if (anchor.isConnected) { anchor.classList.remove('picked'); anchor.focus({ preventScroll: true }); }
}
// popover(якорь, разметка, { title, label }) — заголовок и «Закрыть» словом сверху
export function popover(anchor, html, { label = '', title = '' } = {}) {
  closePop();
  const p = el(`<div class="pop glass" role="dialog" aria-label="${esc(label || title)}"><div class="pop-head"><h3 class="h3">${esc(title)}</h3><button class="btn quiet close x" type="button">${icon('close')}Закрыть</button></div>${html}</div>`);
  document.body.append(p);
  hydrate(p);
  const r = anchor.getBoundingClientRect();
  const w = p.offsetWidth; const h = p.offsetHeight;
  let left = r.left + scrollX;
  left = Math.max(scrollX + 16, Math.min(left, scrollX + innerWidth - w - 16));
  let top = r.bottom + scrollY + 8;
  if (r.bottom + h + 24 > innerHeight && r.top - h - 8 > 0) top = r.top + scrollY - h - 8;
  p.style.left = `${left}px`;
  p.style.top = `${top}px`;
  p.querySelector('.x').addEventListener('click', closePop);
  pop = { node: p, anchor };
  anchor.classList.add('picked');
  setTimeout(() => document.addEventListener('pointerdown', outside), 0);
  const f = [...p.querySelectorAll('.btn')].find((b) => !b.classList.contains('x')) || p.querySelector('.x');
  if (f) f.focus({ preventScroll: true });
  return p;
}

// ============================================================
// ПОЛОСА РЕЗУЛЬТАТА: «Сделано · Отменить» — 10 секунд, не исчезает под курсором или пальцем.
// Одна полоса за раз: новая заменяет прежнюю.
// ============================================================
// Полоса не ложится на плавающие кнопки снизу (нижняя панель телефона, полоса мастера,
// главная кнопка телефона): встаёт над самой верхней из них — на любой странице.
const BOTTOM_BARS = '.tabbar, .wiz-foot, .page-head .head-act, .page-head .btn.main, .tp-act, .ssn-dock, [data-bottom-bar]';
function placeToasts() {
  const box = $('.toasts');
  if (!box) return;
  let top = innerHeight;
  $$(BOTTOM_BARS).forEach((x) => {
    const cs = getComputedStyle(x);
    if ((cs.position !== 'fixed' && cs.position !== 'sticky') || cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = x.getBoundingClientRect();
    // любая плавающая полоса в нижней половине экрана: и вкладки, и главная кнопка над ними
    if (!r.width || !r.height || r.top < innerHeight * 0.5) return;
    top = Math.min(top, r.top);
  });
  box.style.bottom = top < innerHeight ? `${Math.round(innerHeight - top + 12)}px` : '';
  // колонка «Так увидят» справа — полоса встаёт под формой и не закрывает рамку телефона
  const pv = [...$$('.with-preview > .preview-col')].find((x) => x.getClientRects().length && getComputedStyle(x).display !== 'none');
  const r = pv && !isPhone() ? pv.getBoundingClientRect() : null;
  box.style.right = r && r.width && r.left > innerWidth / 2 ? `${Math.round(innerWidth - r.left + 16)}px` : '';
}
// Полоса не закрывает то, что только что изменилось (пилюля в календаре с красной строкой под ней,
// карточка в расписании — у них класс .just, или near: узел или список узлов), и то, что закрывать
// нельзя никогда ([data-keep-clear]: строка «кто увидит» над главной кнопкой внизу формы).
// Страница чуть прокручивается, а если некуда — полоса встаёт наверх.
function clearOf(t, near) {
  const box = $('.toasts');
  if (!box || !t.isConnected) return;
  box.classList.remove('top');
  const tr = t.getBoundingClientRect();
  const list = [...[].concat(near || []), ...$$('.just'), ...$$('[data-keep-clear]')].filter((x) => x && x.isConnected && x.getClientRects().length && !x.closest('.toasts, .sheet, .dialog'));
  const hits = list.filter((x) => { const q = x.getBoundingClientRect(); return q.bottom > tr.top - 8 && q.top < tr.bottom && q.right > tr.left && q.left < tr.right; });
  if (!hits.length) return;
  const qb = Math.max(...hits.map((x) => x.getBoundingClientRect().bottom));
  const qt = Math.min(...hits.map((x) => x.getBoundingClientRect().top));
  const need = Math.ceil(qb - tr.top + 20);
  const room = document.documentElement.scrollHeight - innerHeight - scrollY;
  if (room >= need && qt - need > 120) { scrollBy({ top: need }); return; }
  const head = $('.page-head');
  const hb = head && getComputedStyle(head).position === 'sticky' ? head.getBoundingClientRect().bottom : 0;
  box.style.setProperty('--toast-top', `${Math.round(Math.max(76, hb + 12))}px`);
  box.classList.add('top');
}
// вспышка «только что изменилось» отыграла — метка снимается: полоса «Готово» смотрит только на свежее
document.addEventListener('animationend', (e) => { if (/flash/.test(e.animationName) && e.target.classList) e.target.classList.remove('just'); });
let placeQueued = false;
const placeSoon = () => { if (placeQueued || !$('.toasts > *')) return; placeQueued = true; requestAnimationFrame(() => { placeQueued = false; placeToasts(); }); };
addEventListener('resize', placeSoon);
addEventListener('scroll', placeSoon, { passive: true });
function toastBox() {
  let box = $('.toasts');
  if (!box) { box = el('<div class="toasts" role="status" aria-live="polite"></div>'); document.body.append(box); }
  return box;
}
export function toast(msg, { undo, kind = 'ok', time = 10000, undoLabel = 'Отменить', near = null } = {}) {
  // дело только что не записалось (память заполнена) — «Готово» не показываем: говорит жёлтая полоса
  if (memFailTick && kind !== 'bad') return { close() {} };
  const box = toastBox();
  $$('.toast', box).forEach((x) => x.remove());   // полоса «Память заполнена» остаётся
  placeToasts();
  const t = el(`<div class="toast${kind === 'bad' ? ' bad' : ''}">${icon(kind === 'bad' ? 'alert' : 'check')}<span class="msg">${esc(msg)}</span>${undo ? `<button class="btn" type="button">${icon('undo')}${esc(undoLabel)}</button>` : ''}<i class="left" style="--t:${time}ms"></i></div>`);
  box.append(t);
  let left = time; let since = Date.now(); let timer = null; let holds = 0;
  // плавающая кнопка снизу появилась уже после полосы (сменили шаг, открыли вкладку) — полоса встаёт над ней
  const keep = setInterval(() => { if (!t.isConnected) { clearInterval(keep); return; } placeToasts(); }, 400);
  const close = () => { clearTimeout(timer); clearInterval(keep); t.remove(); };
  const run = () => { since = Date.now(); timer = setTimeout(close, left); };
  const hold = () => { if (holds++ === 0) { clearTimeout(timer); left -= Date.now() - since; } };
  const free = () => { if (--holds === 0) run(); };
  t.addEventListener('pointerenter', hold); t.addEventListener('pointerleave', free);
  t.addEventListener('focusin', hold); t.addEventListener('focusout', free);
  if (undo) t.querySelector('.btn').addEventListener('click', () => { close(); undo(); toast('Отменено', { time: 4000 }); });
  run();
  requestAnimationFrame(() => requestAnimationFrame(() => clearOf(t, near)));
  return { close };
}

// ============================================================
// НЕТ СВЯЗИ: спокойная полоса сверху, висит, пока связи нет, и считает,
// сколько изменений ждут отправки. netState({ online: false, pending: 3 })
// ============================================================
let netBar = null;
export function netState({ online = navigator.onLine, pending = 0 } = {}) {
  if (online) {
    if (netBar) { netBar.remove(); netBar = null; toast(pending ? `Связь есть · ${pending} ${plural(pending, 'изменение отправлено', 'изменения отправлены', 'изменений отправлено')}` : 'Связь есть', { time: 5000 }); }
    return;
  }
  const words = pending ? `${pending} ${plural(pending, 'изменение ждёт', 'изменения ждут', 'изменений ждут')} отправки, ${plural(pending, 'уйдёт', 'уйдут', 'уйдут')} сами` : 'изменения уйдут, когда связь появится';
  if (!netBar) { netBar = el('<div class="netbar glass" role="status" aria-live="polite"></div>'); document.body.append(netBar); }
  netBar.innerHTML = `${icon('wifioff')}<span><b>Нет связи</b> · ${esc(words)}</span>`;
}
addEventListener('offline', () => netState({ online: false }));
addEventListener('online', () => netState({ online: true }));

// «Сохранено в 18:47» у заголовка: черновик сохраняется сам через секунду после ввода.
// Если вещь уже видна игрокам (published: 'с 18:42'), правки — отдельно от показанного:
// ярлык становится «Есть правки — игроки их ещё не видят», появляется «Вернуть опубликованное».
// autosave(форма, ярлык «Сохранено», { tag, published, revert })
export function autosave(form, label, { time = D.NOW.time, tag, published, revert, onDirty } = {}) {
  let t = null; let dirty = false;
  const snap = () => $$('input, textarea, select, [role="radio"], [aria-pressed]', form).map((x) => [x, x.type === 'checkbox' || x.type === 'radio' ? x.checked : 'value' in x && x.tagName !== 'BUTTON' ? x.value : x.getAttribute('aria-checked') ?? x.getAttribute('aria-pressed')]);
  let base = snap();
  const paintTag = () => {
    if (!tag || !published) return;
    tag.className = `tag lg ${dirty ? 'warn' : 'ok'}`;
    tag.textContent = dirty ? 'Есть правки — игроки их ещё не видят' : `Видно игрокам ${published}`;
    if (revert) revert.hidden = !dirty;
  };
  const changed = () => {
    clearTimeout(t);
    label.innerHTML = `${icon('clock')}Сохраняется…`;
    t = setTimeout(() => { label.innerHTML = `${icon('check')}Сохранено в ${esc(time)}`; }, 1000);
    if (!dirty) { dirty = true; paintTag(); if (onDirty) onDirty(true); }
  };
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  form.addEventListener('click', (e) => { if (e.target.closest('[role="radio"], [data-toggle]')) changed(); });
  if (revert) {
    revert.addEventListener('click', () => {
      const now = snap();
      const put = (list) => list.forEach(([x, v]) => {
        if (x.type === 'checkbox' || x.type === 'radio') x.checked = v;
        else if ('value' in x && x.tagName !== 'BUTTON') x.value = v;
        else if (x.hasAttribute('aria-checked')) x.setAttribute('aria-checked', v); else x.setAttribute('aria-pressed', v);
      });
      put(base); dirty = false; paintTag(); if (onDirty) onDirty(false);
      toast('Вернули опубликованное: правки убраны', { undo: () => { put(now); dirty = true; paintTag(); if (onDirty) onDirty(true); } });
    });
  }
  paintTag();
  return {
    // после «Опубликовать правки»: показанное = то, что в форме
    published(at) { published = at; base = snap(); dirty = false; paintTag(); if (onDirty) onDirty(false); },
    get dirty() { return dirty; },
  };
}

// ============================================================
// ШАГИ МАСТЕРА: шкала словами, «Шаг 3 из 7», «Назад» и «Дальше»
// ============================================================
export function wizStepsHtml(steps, now, { links } = {}) {
  return steps.map((s, i) => {
    const st = i < now ? 'done' : i === now ? 'now' : '';
    const inner = `${i < now ? icon('check') : ''}<span>${esc(s)}</span>`;
    const body = links && links[i] && i < now ? `<a href="${esc(keepTheme(links[i]))}">${inner}</a>` : inner;
    return `<li class="${st}"${i === now ? ' aria-current="step"' : ''}>${body}</li>`;
  }).join('');
}
export const progressHtml = (i, n) => `<span class="t">Шаг ${i} из ${n}</span><div class="bar" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${i}"><i style="width:${Math.round((i / n) * 100)}%"></i></div>`;
// Мастер на одной странице: <section data-step="Название">…</section> внутри .wiz,
// <ol class="wiz-steps">, <div class="progress">, кнопки [data-wiz="back"] и [data-wiz="next"].
// data-next у шага — слово на главной кнопке («Опубликовать турнир и открыть запись»).
export function wizard(root, { start = 0, onStep, onFinish } = {}) {
  const panels = $$('[data-step]', root);
  const names = panels.map((p) => p.dataset.step);
  const back = $('[data-wiz="back"]', root);
  const next = $('[data-wiz="next"]', root);
  let i = start;
  const show = () => {
    panels.forEach((p, k) => { p.hidden = k !== i; });
    const ol = $('.wiz-steps', root); if (ol) ol.innerHTML = wizStepsHtml(names, i);
    const pr = $('.progress', root); if (pr) pr.innerHTML = progressHtml(i + 1, names.length);
    if (back) back.hidden = i === 0;
    if (next) next.innerHTML = `${esc(panels[i].dataset.next || 'Дальше')}${panels[i].dataset.next ? '' : icon('arrow')}`;
    if (onStep) onStep(i, panels[i]);
  };
  if (back) back.addEventListener('click', () => { if (i > 0) { i -= 1; show(); } });
  if (next) next.addEventListener('click', () => { if (i < panels.length - 1) { i += 1; show(); } else if (onFinish) onFinish(); });
  show();
  return { go(k) { i = k; show(); }, get step() { return i; } };
}

// ============================================================
// ПЕРЕТАСКИВАНИЕ — удобство, а не единственный путь: у каждого действия есть кнопка.
// Только мышь на ноутбуке; на телефоне перетаскивания нет.
// drag(item, { ghost, over(x, y) → цель или null, drop(цель), cancel() })
// ============================================================
export function drag(item, h) {
  item.addEventListener('pointerdown', (e) => {
    // только мышь и только на широком экране; палец и перо — кнопками
    if (e.pointerType !== 'mouse' || isPhone() || e.button !== 0 || e.target.closest('.btn, [data-keep], [data-nodrag], a, input, textarea, select')) return;
    const sx = e.clientX; const sy = e.clientY;
    let on = false; let ghost = null; let target = null;
    const move = (ev) => {
      if (!on) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        on = true;
        ghost = h.ghost ? h.ghost() : item.cloneNode(true);
        document.body.append(ghost);
        item.classList.add('dragging');
        document.body.style.userSelect = 'none';
      }
      ghost.style.left = `${ev.clientX - 24}px`;
      ghost.style.top = `${ev.clientY - 20}px`;
      target = h.over ? h.over(ev.clientX, ev.clientY, ghost) : null;
    };
    const end = (ok) => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('keydown', key);
      document.body.style.userSelect = '';
      if (!on) return;
      item.classList.remove('dragging');
      if (ghost) ghost.remove();
      // клик после перетаскивания не открывает карточку (только этот один клик)
      const swallow = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
      item.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => item.removeEventListener('click', swallow, { capture: true }), 0);
      if (ok && target && h.drop) h.drop(target); else if (h.cancel) h.cancel();
    };
    const up = () => end(true);
    const key = (ev) => { if (ev.key === 'Escape') end(false); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('keydown', key);
  });
}

// ============================================================
// ЗАГРУЗКА ФОТО: плитка с перетаскиванием и «Выбрать файлы», порядок, обложка
// uploader(root, { photos: [{ src, cap }], cover: 0, onChange(list, cover) })
// ============================================================
export function uploader(root, { photos = [], cover = 0, onChange, label = 'Загрузить фото' } = {}) {
  let list = photos.map((p, i) => ({ id: `ph${i}`, ...p }));
  let coverId = list[cover] ? list[cover].id : null;
  let seq = list.length;
  root.innerHTML = `<label class="drop" tabindex="-1">
      <span class="ic">${icon('upload')}</span>
      <span class="t">${esc(label)}</span>
      <span class="s">или перетащите фото сюда</span>
      <span class="btn quiet" role="button" tabindex="0">${icon('image')}Выбрать файлы</span>
      <input type="file" accept="image/*" multiple>
    </label>
    <div class="upload-state" hidden></div>
    <ol class="photos" aria-label="Фото по порядку"></ol>`;
  const drop = $('.drop', root); const input = $('input', root); const grid = $('.photos', root); const state = $('.upload-state', root);
  const pick = $('.drop .btn', root);
  pick.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  const changed = () => { if (onChange) onChange(list, coverId); };
  const draw = () => {
    grid.innerHTML = list.map((p, i) => `<li class="photo${p.id === coverId ? ' is-cover' : ''}" data-id="${p.id}">
        <div class="ph"><img src="${esc(p.src)}" alt="${esc(p.cap || 'Фото ' + (i + 1))}"><span class="ord" aria-label="Место ${i + 1}">${i + 1}</span>${p.id === coverId ? `<span class="cover">${icon('star')}Обложка</span>` : ''}</div>
        <span class="cap">${p.cap ? esc(p.cap) : 'Без подписи'}</span>
        <div class="acts">${p.id === coverId ? `<span class="cover-tag">${icon('star')}Обложка альбома</span>` : `<button class="btn quiet" type="button" data-cover>${icon('star')}Сделать обложкой</button>`}<button class="btn quiet more" type="button" data-more aria-label="Ещё действия с фото ${i + 1}">${icon('more')}Ещё</button></div>
      </li>`).join('');
    $$('.photo', grid).forEach((li) => drag(li, {
      ghost: () => { const g = li.cloneNode(true); g.style.cssText = `position:fixed;z-index:80;width:${li.offsetWidth}px;pointer-events:none;transform:rotate(-2deg);box-shadow:0 22px 40px -12px rgba(10,20,15,.5)`; return g; },
      over: (x, y) => {
        $$('.photo', grid).forEach((o) => o.classList.remove('drop-before'));
        const o = document.elementFromPoint(x, y)?.closest('.photo');
        if (o && o !== li) { o.classList.add('drop-before'); return o; }
        return null;
      },
      drop: (o) => { o.classList.remove('drop-before'); moveTo(li.dataset.id, list.findIndex((p) => p.id === o.dataset.id)); },
      cancel: () => $$('.photo', grid).forEach((o) => o.classList.remove('drop-before')),
    }));
  };
  const moveTo = (id, to) => {
    const from = list.findIndex((p) => p.id === id);
    if (from < 0 || from === to) return;
    const before = list.slice();
    const [x] = list.splice(from, 1);
    list.splice(to > from ? to - 1 : to, 0, x);
    draw(); changed();
    toast(`Фото переставлено: теперь ${list.indexOf(x) + 1}-е`, { undo: () => { list = before; draw(); changed(); } });
  };
  grid.addEventListener('click', (e) => {
    const li = e.target.closest('.photo'); if (!li) return;
    const id = li.dataset.id; const p = list.find((x) => x.id === id); const n = list.indexOf(p) + 1;
    if (e.target.closest('[data-cover]')) {
      const prev = coverId; coverId = id; draw(); changed();
      toast(`Фото ${n} — обложка альбома`, { undo: () => { coverId = prev; draw(); changed(); } });
    }
    if (e.target.closest('[data-more]')) {
      const m = popover(e.target.closest('[data-more]'), `<div class="menu" style="padding:0">
          <button type="button" data-a="cap">${icon('text')}Подпись</button>
          ${n > 1 ? `<button type="button" data-a="first">${icon('first')}Переместить в начало</button>` : ''}
          ${n > 1 ? `<button type="button" data-a="left">${icon('back')}Левее</button>` : ''}
          ${n < list.length ? `<button type="button" data-a="right">${icon('chev')}Правее</button>` : ''}
          <button type="button" data-a="del">${icon('trash')}Убрать из альбома</button></div>`, { title: `Фото ${n}` });
      m.addEventListener('click', (ev) => {
        const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
        closePop();
        const i = list.indexOf(p);
        if (a === 'first') moveTo(id, 0);
        if (a === 'left') moveTo(id, i - 1);
        if (a === 'right') moveTo(id, i + 2);
        if (a === 'del') {
          const before = list.slice(); const prevCover = coverId;
          list = list.filter((x) => x.id !== id);
          if (coverId === id) coverId = list[0] ? list[0].id : null;
          draw(); changed();
          toast(`Фото ${n} убрано из альбома`, { undo: () => { list = before; coverId = prevCover; draw(); changed(); } });
        }
        if (a === 'cap') {
          const s = openSheet({ title: `Подпись к фото ${n}`, body: `<label class="field full"><span class="label">Подпись (необязательно)</span><input class="input" value="${esc(p.cap || '')}" autofocus><span class="hint">Видна под фото на сайте</span></label>`, foot: '<button class="btn main" type="button" data-save>Сохранить подпись</button><button class="btn quiet" type="button" data-cancel>Отмена</button>' });
          s.querySelector('[data-save]').addEventListener('click', () => { p.cap = s.querySelector('input').value.trim(); closeLayer(true); draw(); changed(); toast('Подпись сохранена'); });
          s.querySelector('[data-cancel]').addEventListener('click', () => closeLayer());
        }
      });
    }
  });
  const add = (files) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) { toast('Это не фото. Подойдут файлы JPG, PNG или HEIC', { kind: 'bad' }); return; }
    const total = imgs.length; let done = 0;
    state.hidden = false;
    const paint = () => { state.innerHTML = `<span class="strong">Загружено ${done} из ${total}</span><div class="bar"><i style="width:${Math.round((done / total) * 100)}%"></i></div>`; };
    paint();
    imgs.forEach((f, k) => setTimeout(() => {
      list.push({ id: `ph${seq++}`, src: URL.createObjectURL(f), cap: '' });
      if (!coverId) coverId = list[0].id;
      done += 1; paint(); draw(); changed();
      if (done === total) setTimeout(() => { state.hidden = true; toast(`Загружено ${total} ${plural(total, 'фото', 'фото', 'фото')}`); }, 400);
    }, 250 * (k + 1)));
  };
  input.addEventListener('change', () => { add(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); $('.t', drop).textContent = 'Отпустите — фото загрузятся'; }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); $('.t', drop).textContent = label; }));
  drop.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) add(e.dataTransfer.files); });
  draw();
  return { get list() { return list; }, get cover() { return coverId; } };
}

// ============================================================
// ПРЕДПРОСМОТР «Так это увидят игроки»
// Настоящий экран приложения (../app-v2/<страница>) в рамке телефона, в масштабе 1:
// текст приложения того же размера, что увидит игрок. Высота экрана — по окну.
// patch(doc, mark) — вписать черновик в настоящую страницу и отметить место: mark(узел, 'Новое').
// Мир приложения стоит на 18:47 (счёт 4:3, как в админке): часы в рамке останавливаются.
// ============================================================
const markCss = (theme) => `.adm-mark{outline:3px solid ${theme === 'dark' ? '#F2F5F1' : '#0F1512'};outline-offset:4px;border-radius:18px;position:relative;scroll-margin:120px}.adm-mark::after{content:attr(data-adm);position:absolute;z-index:9;top:-16px;right:14px;height:28px;padding:0 12px;border-radius:14px;background:#C9E82A;color:#11170A;font:700 16px/28px "Ubuntu Sans App",system-ui,sans-serif;box-shadow:inset 0 0 0 2px #11170A}`;
export function phone(box, o = {}) {
  const { page = 'index.html', title = 'Приложение' } = o;   // o.patch читается при каждой загрузке: update() может его сменить
  box.classList.add('phone');
  const src = (th) => `${APP(page)}${page.includes('?') ? '&' : '?'}theme=${th}&now=${encodeURIComponent(D.NOW.time)}`;
  let theme = currentTheme();
  box.innerHTML = `<div class="screen"><iframe title="${esc(title)}" src="${esc(src(theme))}" tabindex="-1"></iframe></div>`;
  const fr = $('iframe', box); const screen = $('.screen', box);
  // экран рамки задаёт CSS; страница приложения всегда шириной 390 и вписывается в него
  const fit = () => {
    const w = screen.clientWidth; const h = screen.clientHeight;
    if (!w || !h) return;
    const k = w / 390;
    fr.style.transform = `scale(${k})`;
    fr.style.height = `${Math.round(h / k)}px`;
  };
  new ResizeObserver(fit).observe(screen);
  fit();
  fr.addEventListener('load', () => {
    fit();
    try {
      const w = fr.contentWindow; const doc = fr.contentDocument;
      // остановить живой счёт и часы мира в рамке
      const last = w.setTimeout(() => {}, 0);
      for (let i = 1; i <= last; i += 1) { w.clearTimeout(i); w.clearInterval(i); }
      if (!o.patch) return;
      const st = doc.createElement('style'); st.textContent = markCss(theme); doc.head.append(st);
      // прокручиваем только страницу в рамке: отметка — посередине, над нижней панелью приложения
      const mark = (node, word = 'Новое') => {
        if (!node) return;
        node.classList.add('adm-mark'); node.dataset.adm = word;
        const r = node.getBoundingClientRect();
        w.scrollTo(0, Math.max(0, r.top + w.scrollY - (w.innerHeight - 110) / 2 + r.height / 2));
      };
      o.patch(doc, mark);
    } catch { /* страница другого адреса — показываем как есть */ }
  });
  // тема админки сменилась — рамка показывает приложение в той же теме
  const onView = () => {
    if (!box.isConnected) { document.removeEventListener('adm:view', onView); return; }
    if (currentTheme() !== theme) { theme = currentTheme(); fr.src = src(theme); }
  };
  document.addEventListener('adm:view', onView);
  return fr;
}
// «Где появится» — один список под формой. where: [{ icon, b, s, no }];
// no: true — места нет, так и написано: «В приложении новости пока не показываются».
export const whereHtml = (where, { title = 'Где появится' } = {}) => `<div class="where-box"><span class="label">${esc(title)}</span><ul class="where">${where.map((w) => `<li class="${w.no ? 'no' : ''}">${icon(w.icon || 'pin')}<span><b>${esc(w.b)}</b>${w.s ? ' — ' + esc(w.s) : ''}</span></li>`).join('')}</ul></div>`;
// Колонка «Так увидят»: переключатель «Приложение · Сайт», полоса «Предпросмотр»,
// телефон или окно сайта. app: { page, patch, title }, site: разметка окна сайта.
// Уже 1280 колонку открывает кнопка .preview-open — шторкой, на телефоне во весь экран.
// site — разметка окна сайта или функция, которая её возвращает (её зовут заново при update).
// → { show(app|site), update(что поменялось) }: update({ site, banner, app: { patch } }) или update() —
// окно сайта и полоса перерисовываются на месте, страница приложения в рамке загружается заново
// с той же вставкой; переключатель «Приложение · Сайт» остаётся где был, открытая шторка
// «Так увидят» из этой колонки меняется вместе с ней.
const PV = new WeakMap();
const siteOf = (site) => (typeof site === 'function' ? site() : site);
// app.future — места в приложении ещё нет (новости, фото турнира): над телефоном вместо полосы
// «Предпросмотр» — жёлтая «Будущий вид: в приложении это появится со следующей версии», подпись — «Так это будет в приложении».
const PV_BANNER = 'Предпросмотр — игроки увидят после публикации';
const pvBanner = (cfg, v) => (v === 'app' && cfg.app && cfg.app.future ? cfg.app.future : cfg.banner === undefined ? PV_BANNER : cfg.banner);
function paintBanner(box, cfg, v) {
  const bn = $('.pv-banner', box); if (!bn) return;
  const t = pvBanner(cfg, v);
  bn.hidden = !t; bn.classList.toggle('future', v === 'app' && !!(cfg.app && cfg.app.future));
  bn.innerHTML = `${icon(v === 'app' && cfg.app && cfg.app.future ? 'info' : 'eye')}<span>${esc(t || '')}</span>`;
}
export function previewPanel(root, cfg = {}) {
  const { app, site, start = 'app' } = cfg;
  PV.set(root, cfg);
  root.innerHTML = `<div class="preview">
      ${app && site ? '<div class="seg" role="group" aria-label="Где смотреть"><button type="button" data-v="app">' + icon('phone') + 'Приложение</button><button type="button" data-v="site">' + icon('site') + 'Сайт</button></div>' : ''}
      <div class="pv-banner"></div>
      ${app ? `<figure class="pv-app${app.future ? ' future' : ''}"><div class="phone"></div><figcaption>${icon('phone')}${app.future ? 'Так это будет в приложении' : 'Так это увидят игроки'}</figcaption></figure>` : ''}
      ${site ? `<figure class="pv-site"><div class="browser"><div class="bar-top"><i></i><i></i><i></i><span>Сайт лиги</span></div><div class="page">${siteOf(site)}</div></div><figcaption>${icon('site')}Так будет на сайте</figcaption></figure>` : ''}
    </div>`;
  if (app) phone($('.phone', root), app);
  const seg = $('.seg', root);
  let view = app ? start : 'site';
  const show = (v) => {
    view = v;
    if (seg) $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    const a = $('.pv-app', root); const s = $('.pv-site', root);
    if (a) a.hidden = v !== 'app';
    if (s) s.hidden = v !== 'site';
    paintBanner(root, cfg, v);
    // рамка грузилась скрытой — отметка «Новое» встаёт посередине экрана телефона, когда его открыли
    if (v === 'app' && a) requestAnimationFrame(() => { try {
      const fr = $('iframe', a); const w = fr.contentWindow; const m = fr.contentDocument && fr.contentDocument.querySelector('.adm-mark');
      if (!m) return;
      const r = m.getBoundingClientRect();
      w.scrollTo(0, Math.max(0, r.top + w.scrollY - (w.innerHeight - 110) / 2 + r.height / 2));
    } catch { /* страница другого адреса */ } });
  };
  if (seg) seg.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) show(b.dataset.v); });
  show(view);
  const update = (next = {}) => {
    if ('site' in next) cfg.site = next.site;
    if ('banner' in next) cfg.banner = next.banner;
    if (next.app && cfg.app) Object.assign(cfg.app, next.app);
    // эта колонка и шторки, открытые из неё (у них та же настройка)
    [root, ...$$('.pv-sheet')].filter((b, i) => i === 0 || PV.get(b) === cfg).forEach((b) => {
      const pg = $('.pv-site .page', b); if (pg && cfg.site) pg.innerHTML = siteOf(cfg.site);
      const a = $('.pv-app', b);
      paintBanner(b, cfg, a && !a.hidden ? 'app' : 'site');
      const fr = $('.pv-app iframe', b); if (fr && cfg.app && cfg.app.patch) fr.src = fr.src;
    });
  };
  return { show, update };
}
// Шторка «Так увидят игроки» для своей колонки. Колонка остаётся на месте:
// шторка строит свой предпросмотр заново, поэтому её можно открывать сколько угодно раз.
export function openPreview(col) {
  const cfg = PV.get(col);
  const box = el('<div class="pv-sheet"></div>');
  const o = { title: 'Так увидят игроки', body: box, wide: true, full: isPhone() };
  if (cfg) { openSheet(o); previewPanel(box, cfg); return; }
  // колонку собрали вручную — берём её содержимое и при любом закрытии возвращаем
  const kids = [...col.childNodes];
  box.append(...kids);
  openSheet({ ...o, onGone: () => col.append(...kids) });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.preview-open');
  if (!b) return;
  const col = (b.dataset.for && document.getElementById(b.dataset.for)) || b.closest('.with-preview')?.querySelector('.preview-col') || $('.preview-col');
  if (col) openPreview(col);
});

// Строки календаря на сайте — для окна сайта в предпросмотре турнира
export function siteCalendarRows(stages, { mark } = {}) {
  return stages.map((s) => {
    const same = s.from.slice(0, 7) === s.to.slice(0, 7);
    const d = same ? `${dayNo(s.from)}–${dayNo(s.to)}` : `${dayNo(s.from)}.${pad(monIdx(s.from) + 1)}`;
    return `<div class="site-row${mark === s.id ? ' new' : ''}"><span class="d">${d}<small>${MON_GEN[monIdx(s.to)]}</small></span><span class="t">${esc(s.name)}</span><span class="s">Этап ${s.no} · ${esc(stateWords(s).site)} · Подробнее</span></div>`;
  }).join('');
}

// ============================================================
// КАЛЕНДАРИ — общее
// ============================================================
// Состояние этапа словами: метка, короткое слово для пилюли, для полосы сезона, для сайта
export function stateWords(s) {
  if (s.state === 'done') return { tag: 'past', label: `Прошёл · победили ${s.winner ? D.pairName(s.winner) : ''}`, short: 'Прошёл', low: 'прошёл', site: 'прошёл' };
  if (s.state === 'live') return { tag: 'live', label: 'Идёт', short: 'Идёт', low: 'идёт', site: 'идёт' };
  if (s.state === 'open') return { tag: 'ok', label: `Запись открыта · до ${dayNo(s.signupTo)} ${MON_GEN[monIdx(s.signupTo)]}`, short: 'Запись открыта', low: 'запись открыта', site: `запись открыта до ${dayNo(s.signupTo)} ${MON_GEN[monIdx(s.signupTo)]}` };
  if (s.state === 'draft') return { tag: 'draft', label: 'Черновик — видите только вы', short: 'Черновик', low: 'черновик', site: '' };
  return { tag: 'plain', label: '', short: '', low: '', site: '' };
}
const overlapping = (s, all) => all.filter((t) => t !== s && t.from <= s.to && t.to >= s.from);
const stageAt = (iso, all) => all.filter((s) => s.from <= iso && s.to >= iso);
const monthsSpan = (stages) => {
  const a = stages.map((s) => s.from).sort()[0]; const b = stages.map((s) => s.to).sort().slice(-1)[0];
  const out = []; let y = +a.slice(0, 4); let m = +a.slice(5, 7);
  const ey = +b.slice(0, 4); const em = +b.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${pad(m)}`); m += 1; if (m > 12) { m = 1; y += 1; } }
  return out;
};
const ymAdd = (ym, n) => { let y = +ym.slice(0, 4); let m = +ym.slice(5, 7) + n; while (m > 12) { m -= 12; y += 1; } while (m < 1) { m += 12; y -= 1; } return `${y}-${pad(m)}`; };
const ymTitle = (ym) => `${cap1(MON[+ym.slice(5, 7) - 1])} ${ym.slice(0, 4)}`;
const legendHtml = (extra = '') => `<div class="legend" aria-label="Подпись цветов"><span><i class="srf-fill" data-srf="clay"></i>Грунт</span><span><i class="srf-fill" data-srf="hard"></i>Хард</span><span><i class="srf-fill" data-srf="grass"></i>Трава</span><span><i class="sw-draft"></i>Черновик</span><span><i class="sw-today"></i>Сегодня</span>${extra}</div>`;

// ============================================================
// КАЛЕНДАРЬ СЕЗОНА
// seasonCalendar(root, { stages, today, month: '2027-06', view: 'month'|'list',
//   openHref(stage), createHref(iso), onMonth(ym) })
// Ноутбук: полоса сезона, «Месяц · Список». Телефон: только список,
// сверху закреплено «Сегодня: …», под ним короткая полоса сезона.
// ============================================================
export function seasonCalendar(root, o = {}) {
  const stages = (o.stages || D.STAGES).slice().sort((a, b) => (a.from < b.from ? -1 : 1));
  const today = o.today || D.NOW.iso;
  const year = +today.slice(0, 4);
  const openHref = o.openHref || ((s) => at(s.state === 'draft' ? 'new-draft.html' : `tour.html?t=${s.id}`));
  const createHref = o.createHref || ((iso) => at(`new-start.html?from=${iso}`));
  const months = monthsSpan(stages);
  const st = { month: o.month || today.slice(0, 7), view: store.get('adm-season-view') || o.view || 'month' };
  const pub = stages.filter((s) => s.state !== 'draft');
  const cur = pub.find((s) => s.from <= today && s.to >= today);
  const curNo = cur ? cur.no : pub.filter((s) => s.to < today).length;

  const stagePop = (anchor, s) => {
    const w = stateWords(s);
    const clash = overlapping(s, stages);
    popover(anchor, `<p>${esc(cap1(dayWords(s.from)))} — ${esc(dayWords(s.to))}</p>
      <div class="line"><span class="tag ${w.tag}">${esc(w.label)}</span></div>
      ${s.state === 'open' ? `<p class="muted">${s.pairs} из ${s.slots} пар</p>` : s.pairs ? `<p class="muted">${s.pairs} ${plural(s.pairs, 'пара', 'пары', 'пар')}</p>` : ''}
      ${s.state === 'draft' ? `<p class="muted">Сохранён ${esc(s.savedAt || '')}</p>` : ''}
      ${clash.map((t) => `<p class="strong" style="color:var(--bad-ink)">Пересекается с «${esc(instr(t.name))}» (${esc(rangeShort(t.from, t.to))})</p>`).join('')}
      <a class="btn quiet wide" href="${esc(keepTheme(openHref(s)))}">${s.state === 'draft' ? 'Продолжить черновик' : 'Открыть турнир'}${icon('arrow')}</a>`, { title: s.name });
  };
  const dayPop = (anchor, iso) => {
    popover(anchor, `<a class="btn quiet wide" href="${esc(keepTheme(createHref(iso)))}">${icon('plus')}Создать турнир с этого дня</a>`, { title: `${dayWords(iso, { cap: true })} — турниров нет` });
  };

  // ---------- полоса сезона ----------
  const bar = () => {
    const node = el(`<section class="sbar" aria-label="Полоса сезона ${year}"><div class="sbar-top"><h2 class="h3">Сезон ${year}</h2><span class="cnt">Этап ${curNo} из ${pub.length}</span></div><div class="sbar-months"></div></section>`);
    const wrap = $('.sbar-months', node);
    wrap.style.gridTemplateColumns = months.map((m) => (stages.some((s) => s.from.slice(0, 7) === m || s.to.slice(0, 7) === m) ? 'minmax(0,1fr)' : 'minmax(0,.5fr)')).join(' ');
    months.forEach((m) => {
      const [y, mm] = m.split('-').map(Number); const n = dim(y, mm);
      const first = `${m}-01`; const last = `${m}-${pad(n)}`;
      const col = el(`<div class="sbar-m"${m === st.month && st.view === 'month' ? ' aria-current="true"' : ''} data-m="${m}"><button class="mn" type="button" aria-label="Показать ${esc(MON[mm - 1])}">${esc(cap1(MON[mm - 1]))}</button><div class="sbar-axis"></div><div class="labs" style="display:grid;gap:6px"></div></div>`);
      const axis = $('.sbar-axis', col); const labs = $('.labs', col);
      stages.filter((s) => s.to >= first && s.from <= last).forEach((s) => {
        const a = s.from < first ? first : s.from; const b = s.to > last ? last : s.to;
        const left = ((dayNo(a) - 1) / n) * 100; const width = ((daysBetween(a, b) + 1) / n) * 100;
        const w = stateWords(s);
        const past = s.to < today;
        axis.append(el(`<button type="button" tabindex="-1" aria-hidden="true" class="sbar-seg srf-fill${past ? ' past' : ''}${s.state === 'draft' ? ' draft' : ''}" data-srf="${s.surface || ''}" style="left:${left}%;width:${width}%" aria-label="${esc(s.name)}, ${esc(rangeShort(s.from, s.to))}, ${esc(w.low)}"></button>`));
        if (s.from >= first) labs.append(el(`<a class="sbar-lab${s.state === 'live' ? ' now' : ''}" href="${esc(keepTheme(openHref(s)))}"><b>${esc(s.name)}</b><span>${esc(rangeShort(s.from, s.to))} · ${esc(w.low)}</span></a>`));
        $$('.sbar-seg', axis).slice(-1)[0].addEventListener('click', (e) => stagePop(e.currentTarget, s));
      });
      $('.mn', col).addEventListener('click', () => { st.month = m; st.view = 'month'; store.set('adm-season-view', 'month'); render(); if (o.onMonth) o.onMonth(m); });
      wrap.append(col);
    });
    // отметка «Сегодня»: линия с кружком цвета мяча
    const tm = today.slice(0, 7);
    if (months.includes(tm)) {
      const mark = el(`<span class="sbar-today" aria-hidden="true"><span>Сегодня, ${dayNo(today)} ${MON_GEN[monIdx(today)]}</span><i></i></span>`);
      wrap.append(mark);
      const place = () => {
        const col = $(`[data-m="${tm}"]`, wrap); const axis = col && $('.sbar-axis', col);
        if (!axis) return;
        const n = dim(year, +tm.slice(5, 7));
        // .sbar-m не позиционирован: отступы оси считаются от .sbar-months
        const x = axis.offsetLeft + ((dayNo(today) - .5) / n) * axis.offsetWidth;
        mark.style.left = `${x}px`;
        mark.style.height = `${axis.offsetTop + 16}px`;
        $('i', mark).style.top = `${axis.offsetTop - 1}px`;
      };
      requestAnimationFrame(place);
      new ResizeObserver(place).observe(wrap);
    }
    return node;
  };

  // ---------- переключатель «Месяц · Список» ----------
  const switcher = () => {
    const s = el(`<div class="line" style="justify-content:space-between"><div class="seg" role="group" aria-label="Вид календаря"><button type="button" data-v="month" aria-pressed="${st.view === 'month'}">${icon('month')}Месяц</button><button type="button" data-v="list" aria-pressed="${st.view === 'list'}">${icon('list')}Список</button></div></div>`);
    s.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; st.view = b.dataset.v; store.set('adm-season-view', st.view); render(); });
    return s;
  };

  // ---------- месяц ----------
  const monthView = () => {
    const [y, m] = st.month.split('-').map(Number); const n = dim(y, m);
    const first = `${st.month}-01`; const last = `${st.month}-${pad(n)}`;
    const gridStart = addDays(first, -dow(first));
    const inMonth = stages.filter((s) => s.to >= first && s.from <= last);
    const prev = ymAdd(st.month, -1); const next = ymAdd(st.month, 1);
    const node = el(`<section class="smonth" aria-label="${esc(ymTitle(st.month))}">
      <div class="smonth-head"><h2 class="h2">${esc(ymTitle(st.month))}</h2>
        <button class="btn quiet" type="button" data-go="${prev}">${icon('back')}${esc(cap1(MON[+prev.slice(5) - 1]))}</button>
        ${today.slice(0, 7) !== st.month ? `<button class="btn quiet" type="button" data-go="${today.slice(0, 7)}">Сегодня</button>` : ''}
        <button class="btn quiet" type="button" data-go="${next}">${esc(cap1(MON[+next.slice(5) - 1]))}${icon('chev')}</button></div>
      ${inMonth.length ? '' : `<div class="sm-empty">${icon('calendar')}<span>В ${esc(MON_PREP[m - 1])} турниров нет. Нажмите на день, чтобы создать турнир</span></div>`}
      <div class="sm-dow" aria-hidden="true">${WD.map((d, i) => `<span${i > 4 ? ' class="we"' : ''}>${d}</span>`).join('')}</div>
      <div class="sm-weeks"></div>
      <div class="sm-foot">${legendHtml()}<span class="muted small">Свободный день — нажмите, чтобы создать турнир</span></div></section>`);
    $$('[data-go]', node).forEach((b) => b.addEventListener('click', () => { st.month = b.dataset.go; render(); if (o.onMonth) o.onMonth(st.month); }));
    const weeks = $('.sm-weeks', node);
    for (let ws = gridStart; ws <= last; ws = addDays(ws, 7)) weeks.append(weekRow(ws, first, last));
    return node;
  };
  const weekRow = (ws, first, last) => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const segs = [];
    stages.forEach((s) => {
      const a = [s.from, ws, first].sort().pop(); const b = [s.to, days[6], last].sort()[0];
      if (a <= b) segs.push({ s, a, b, c0: daysBetween(ws, a), c1: daysBetween(ws, b) });
    });
    segs.sort((x, y) => x.c0 - y.c0);
    const lanes = [];
    segs.forEach((g) => { let li = lanes.findIndex((end) => end < g.c0); if (li < 0) { li = lanes.length; lanes.push(-1); } lanes[li] = g.c1; g.lane = li; });
    const row = el(`<div class="sm-week" style="--lanes:${Math.max(1, lanes.length)}"></div>`);
    days.forEach((d, i) => {
      if (d < first || d > last) { row.append(el(`<span class="sm-day off" style="grid-column:${i + 1}" aria-hidden="true"></span>`)); return; }
      const has = stageAt(d, stages);
      const past = d < today;
      const cls = ['sm-day']; if (i > 4) cls.push('we'); if (past) cls.push('past'); if (d === today) cls.push('today'); if (!has.length && !past) cls.push('free');
      const lbl = `${dayWords(d, { cap: true })}${d === today ? ', сегодня' : ''}${has.length ? ' — ' + has.map((s) => s.name).join(', ') : past ? '' : ' — турниров нет'}`;
      const cell = el(`<button type="button" class="${cls.join(' ')}" style="grid-column:${i + 1}" data-iso="${d}" aria-label="${esc(lbl)}"${past && !has.length ? ' tabindex="-1"' : ''}><span class="d">${dayNo(d)}</span><span class="add">${icon('plus')}Нажмите, чтобы добавить</span></button>`);
      cell.addEventListener('click', () => { if (has.length) stagePop(cell, has[0]); else if (!past) dayPop(cell, d); });
      row.append(cell);
    });
    segs.forEach((g) => {
      const s = g.s; const n = g.c1 - g.c0 + 1;
      const on = Array.from({ length: n }, (_, i) => !s.play.length || s.play.includes(addDays(g.a, i)));
      const parts = on.map((v, i) => {
        if (!v) return '<span class="p thin"></span>';
        const c = ['p'];
        if (!(i > 0 && on[i - 1])) c.push(i === 0 && g.a !== s.from ? 'cut-l' : 'l');
        if (!(i < n - 1 && on[i + 1])) c.push(i === n - 1 && g.b !== s.to ? 'cut-r' : 'r');
        return `<span class="${c.join(' ')}"></span>`;
      }).join('');
      // подпись — в первом отрезке игровых дней, если он не короче двух дней, иначе в самом длинном
      const runs = []; on.forEach((v, i) => { if (v && (i === 0 || !on[i - 1])) runs.push([i, i]); if (v) runs[runs.length - 1][1] = i; });
      let run = runs[0];
      if (run && run[1] - run[0] < 1) runs.forEach((r) => { if (r[1] - r[0] > run[1] - run[0]) run = r; });
      const w = stateWords(s);
      const lab = run ? `<span class="lab" style="left:${(run[0] / n) * 100}%;width:${((run[1] - run[0] + 1) / n) * 100}%"><b>${esc(s.name)}</b><span class="st">${esc(w.short)}</span></span>` : '';
      // красная строка — только там, где дни турниров в этой неделе действительно совпали
      const clash = stages.filter((t) => t !== s && t.from <= g.b && t.to >= g.a);
      const wrap = el(`<div class="sm-tw" style="grid-column:${g.c0 + 1} / span ${n};grid-row:${2 + g.lane}"></div>`);
      const btn = el(`<button type="button" class="sm-t${s.to < today ? ' past' : ''}${s.state === 'draft' ? ' draft' : ''}" data-srf="${s.surface || ''}" style="--n:${n}" aria-label="${esc(s.name)}, ${esc(rangeShort(s.from, s.to))}, ${esc(w.low)}">${parts}${lab}</button>`);
      btn.addEventListener('click', () => stagePop(btn, s));
      wrap.append(btn);
      clash.forEach((t) => wrap.append(el(`<div class="sm-clash">Пересекается с «${esc(instr(t.name))}» (${esc(rangeShort(t.from, t.to))})</div>`)));
      row.append(wrap);
    });
    // название не влезает — слово состояния уходит строкой под пилюлю, потом шрифт уже,
    // потом две строки («Июньский / кубок»), потом на 2 px мельче (не мельче 16)
    requestAnimationFrame(() => $$('.sm-t .lab', row).forEach((l) => {
      const x = $('.st', l);
      const over = () => l.scrollWidth > l.clientWidth + 1 || l.scrollHeight > l.clientHeight + 1;
      if (x && over()) {
        x.remove();
        // строка — под самим названием, с того же места, что подпись на пилюле
        const line = el(`<div class="sm-st" style="margin-left:calc(${l.style.left || '0%'} + 6px)">${esc(x.textContent)}</div>`);
        l.closest('.sm-tw').insertBefore(line, l.closest('.sm-t').nextSibling);
      }
      if (over()) l.style.fontStretch = '87.5%';
      if (over()) l.style.fontStretch = '75%';
      if (over()) { l.classList.add('two'); l.style.fontStretch = '87.5%'; }
      if (over()) l.style.fontStretch = '75%';
      if (over()) l.style.fontSize = `${Math.max(16, parseFloat(getComputedStyle(l).fontSize) - 2)}px`;
    }));
    return row;
  };

  // ---------- список ----------
  const stRow = (s, phoneView) => {
    const w = stateWords(s);
    const same = s.from.slice(0, 7) === s.to.slice(0, 7);
    const num = same ? `${dayNo(s.from)}–${dayNo(s.to)}` : `${dayNo(s.from)}.${pad(monIdx(s.from) + 1)}–${dayNo(s.to)}.${pad(monIdx(s.to) + 1)}`;
    // у прошедшего этапа метка короткая, чемпионы — строкой ниже: на телефоне метка не ломается в три строки
    const sub = s.state === 'open' ? `${s.pairs} из ${s.slots} пар · ${s.courts}` : s.state === 'draft' ? `Сохранён ${s.savedAt}` : s.state === 'done' ? `Победили ${D.pairName(s.winner)} · ${s.pairs} ${plural(s.pairs, 'пара', 'пары', 'пар')}` : `${s.pairs} ${plural(s.pairs, 'пара', 'пары', 'пар')}${s.courts ? ' · ' + s.courts : ''}`;
    const clash = overlapping(s, stages).map((t) => `<span class="clash">Пересекается с «${esc(instr(t.name))}» (${esc(rangeShort(t.from, t.to))})</span>`).join('');
    const inner = `<div class="dt"><span class="num">${num}</span><span>${same ? MON_GEN[monIdx(s.to)] : ''}</span></div>
      <div class="mid"><span class="nm">${esc(s.name)}</span><span class="tag ${w.tag}">${esc(s.state === 'done' ? w.short : w.label)}</span><span class="s">${esc(sub)}</span>${clash}</div>`;
    const cls = `st-row${s.to < today ? ' past' : ''}${s.state === 'draft' ? ' draft' : ''}`;
    if (phoneView) return el(`<a class="${cls}" data-srf="${s.surface || ''}" href="${esc(keepTheme(openHref(s)))}">${inner}</a>`);
    return el(`<div class="${cls}" data-srf="${s.surface || ''}">${inner}<a class="btn quiet" href="${esc(keepTheme(openHref(s)))}">${s.state === 'draft' ? 'Продолжить' : 'Открыть'}</a></div>`);
  };
  const listView = (phoneView) => {
    const node = el('<section class="slist" aria-label="Турниры списком"></section>');
    let todayPut = false;
    const todayLine = () => el(`<div class="slist-today">Сегодня, ${dayNo(today)} ${MON_GEN[monIdx(today)]}</div>`);
    months.forEach((m) => {
      const sec = el(`<div class="slist-month" data-m="${m}"><h2 class="h2">${esc(cap1(MON[+m.slice(5) - 1]))}</h2></div>`);
      const list = stages.filter((s) => s.from.slice(0, 7) === m);
      if (!list.length) {
        const b = el(`<button type="button" class="slist-empty">${icon('plus')}Турниров нет. Нажмите, чтобы добавить</button>`);
        b.addEventListener('click', () => { location.href = keepTheme(createHref(`${m}-01`)); });
        sec.append(b);
      }
      list.forEach((s) => {
        if (!todayPut && s.from > today) { sec.append(todayLine()); todayPut = true; }
        sec.append(stRow(s, phoneView));
        if (!todayPut && s.from <= today && s.to >= today) { sec.append(todayLine()); todayPut = true; }
      });
      node.append(sec);
    });
    return node;
  };

  // ---------- телефон: закреплённое «Сегодня: …» и короткая полоса ----------
  // «Сегодня» — прямо в корне календаря: так оно держится сверху, пока листают весь список
  const phoneTop = () => {
    const out = [];
    if (cur) {
      const f = D.match('final');
      out.push(el(`<a class="today-pin glass" href="${esc(keepTheme(at('today.html')))}"><span class="today-mark num">${dayNo(today)}</span><span class="grow"><b>Сегодня: ${esc(cur.name)}</b><span class="muted">финал в ${esc(f.time)}, ${esc(D.COURTS[f.court].name.toLowerCase())}</span></span>${icon('chev')}</a>`));
    }
    const draft = stages.filter((s) => s.state === 'draft');
    const cap = `Этап ${curNo} из ${pub.length}${draft.length ? ` · ${draft.map((s) => `этап ${s.no}`).join(', ')} — ${plural(draft.length, 'черновик', 'черновики', 'черновики')}` : ''}`;
    out.push(el(`<div class="minibar"><div class="segs">${stages.map((s) => `<span class="srf-fill${s.to < today ? ' past' : ''}${s.state === 'draft' ? ' draft' : ''}${s === cur ? ' now' : ''}" data-srf="${s.surface || ''}" aria-label="${esc(s.name)}, ${esc(stateWords(s).low)}">${s.no}</span>`).join('')}</div><span class="strong">${esc(cap)}</span></div>`));
    return out;
  };

  function render() {
    closePop();
    root.innerHTML = '';
    root.classList.add('stack', 'loose');
    if (isPhone()) { root.append(...phoneTop(), listView(true)); fixLinks(root); return; }
    root.append(bar(), switcher(), st.view === 'list' ? listView(false) : monthView());
    fixLinks(root);
  }
  render();
  let wasPhone = isPhone();
  addEventListener('resize', () => { if (isPhone() !== wasPhone) { wasPhone = isPhone(); render(); } });
  document.addEventListener('adm:view', render);
  return { render, setMonth(m) { st.month = m; st.view = 'month'; render(); } };
}

// ============================================================
// ВЫБОР ДАТ
// datePicker(root, { from, to, month: '2027-08', today, others: [этапы], self: 'aug-5',
//   suggest: { from, to, text, why }, bare, single, id, onChange(r) })
// onChange получает: { from, to, clash, words } — выбран диапазон; { from, partial, words } —
// нажат только первый день; { error, words } — в поле ошибка; {} — ничего не выбрано.
// Два нажатия — сплошная тёмная полоса. Чужой турнир — серая штриховка его дней и название
// под ними: эти дни выбрать можно, но итог станет красным. Свободные субботы — зелёная точка.
// single: true — выбор одного дня (для поля даты), один месяц.
// ============================================================
const plain = (s) => s.replace(/⁠/g, '').replace(/ /g, ' ');
export function datePicker(root, o = {}) {
  const today = o.today || D.NOW.iso;
  const others = (o.others || D.STAGES).filter((s) => !(o.self && s.id === o.self));
  const st = { a: o.from || null, b: o.to || (o.single ? o.from : null) || null, hover: null, mode: o.single ? 'one' : null, error: null, start: o.month || (o.from ? o.from.slice(0, 7) : ymAdd(today.slice(0, 7), 1)) };
  const QUICK = [['week8', 'С субботы по субботу'], ['weekend', 'Только выходные'], ['one', 'Один день']];
  const fid = `dp-in-${o.id || 'x'}`;
  const bare = o.bare || o.single;
  root.classList.add('dp');
  if (o.single) root.classList.add('single');
  root.innerHTML = `
    ${o.suggest ? `<div class="dp-suggest"><span class="ic">${icon('calendar')}</span><span class="grow"><b>${esc(o.suggest.text)}</b>${o.suggest.why ? `<span class="muted">${esc(o.suggest.why)}</span>` : ''}</span><button class="btn quiet" type="button" data-take>${icon('check')}Взять эти даты</button></div>` : ''}
    <div class="dp-quick"${bare ? ' hidden' : ''}><span class="lbl">Быстро:</span>${QUICK.map(([k, t]) => `<button type="button" class="chip" aria-pressed="false" data-mode="${k}">${icon('check')}${t}</button>`).join('')}</div>
    <div class="dp-nav"><button class="btn quiet" type="button" data-nav="-1">${icon('back')}Раньше</button><span class="dp-msg" aria-live="polite"></span><button class="btn quiet" type="button" data-nav="1">Позже${icon('chev')}</button></div>
    <div class="dp-months"></div>
    <div class="legend dp-legend" aria-label="Что значат отметки"><span><i class="sw-free" aria-hidden="true"></i>свободная суббота</span><span><i class="sw-busy" aria-hidden="true"></i>серая штриховка — другой турнир</span><span><i class="sw-past" aria-hidden="true">12</i>зачёркнуто — прошло</span></div>
    <div class="dp-type field"${bare ? ' hidden' : ''}><label class="label" for="${fid}">Или впишите даты</label><span class="err">${icon('alert')}<span></span></span><input class="input" id="${fid}" autocomplete="off" inputmode="text"><span class="hint">например: 7–14 августа или 07.08–14.08</span><span class="understood" hidden>${icon('check')}<span></span></span></div>
    <div class="line dp-reset"${bare ? ' hidden' : ''}><button class="btn text" type="button" data-reset>Сбросить</button></div>`;
  const monthsBox = $('.dp-months', root); const msg = $('.dp-msg', root);
  const field = $('.dp-type', root); const input = $('input', field); const und = $('.understood', field);
  const lo = () => (st.a && st.b ? (st.a < st.b ? st.a : st.b) : st.a);
  const hi = () => (st.a && st.b ? (st.a < st.b ? st.b : st.a) : st.a);
  const clashOf = (a, b) => others.find((s) => s.from <= b && s.to >= a);
  // подсказка над месяцами — только на миг: что делать дальше или почему нельзя
  const say = (t, bad) => { msg.textContent = t || ''; msg.classList.toggle('bad', !!bad); };
  const result = () => {
    if (st.error) return { error: st.error, words: 'Даты не выбраны: исправьте поле «Или впишите даты»' };
    if (!st.a) return {};
    if (!st.b) return { from: st.a, partial: true, words: `${dayWords(st.a, { cap: true })} — теперь нажмите последний день` };
    const c = clashOf(lo(), hi());
    const n = daysBetween(lo(), hi()) + 1;
    const words = c ? `${rangeShort(lo(), hi())} · ${n} ${plural(n, 'день', 'дня', 'дней')} · пересекается с «${instr(c.name)}» (${rangeShort(c.from, c.to)})` : o.single ? dayWords(lo(), { cap: true }) : rangeWords(lo(), hi());
    return { from: lo(), to: hi(), clash: c || null, words };
  };
  // чего не хватает, чтобы идти дальше — словами
  const missing = () => { const r = result(); if (r.error) return r.words; if (!r.from) return o.single ? 'Нажмите нужный день' : 'Нажмите первый день турнира'; if (!r.to) return 'Нажмите последний день турнира'; return ''; };
  const emit = () => { if (o.onChange) o.onChange(result()); };
  const months = () => (o.single ? [st.start] : [st.start, ymAdd(st.start, 1)]);
  const monthNode = (ym) => {
    const [y, m] = ym.split('-').map(Number); const n = dim(y, m);
    const first = `${ym}-01`; const last = `${ym}-${pad(n)}`;
    const node = el(`<div class="dp-month" data-m="${ym}"><h3 class="h2">${esc(ymTitle(ym))}</h3><div class="dp-dow" aria-hidden="true">${WD.map((d, i) => `<span${i > 4 ? ' class="we"' : ''}>${d}</span>`).join('')}</div></div>`);
    for (let ws = addDays(first, -dow(first)); ws <= last; ws = addDays(ws, 7)) {
      const wk = el('<div class="dp-week"></div>');
      const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
      // куски чужих турниров в этой неделе
      const segs = others.map((s) => {
        const a = [s.from, days[0], first].sort().pop(); const b = [s.to, days[6], last].sort()[0];
        return a <= b ? { s, a, b } : null;
      }).filter(Boolean);
      days.forEach((d, i) => {
        if (d < first || d > last) { wk.append(el(`<span class="dp-day blank" style="grid-column:${i + 1};grid-row:1"></span>`)); return; }
        const busy = segs.filter((g) => g.a <= d && g.b >= d);
        const past = d < today;
        const free = i === 5 && !busy.length && !past;
        const cls = ['dp-day']; if (i > 4) cls.push('we'); if (past) cls.push('past'); if (d === today) cls.push('today');
        if (busy.length) {
          cls.push('busy');
          if (busy.some((g) => g.a === d && g.a === g.s.from)) cls.push('bs-l');
          if (busy.some((g) => g.b === d && g.b === g.s.to)) cls.push('bs-r');
        }
        const lbl = `${dayWords(d, { cap: true })}${d === today ? ', сегодня' : ''}${past ? ', прошёл' : ''}${busy.length ? ', уже стоит: ' + busy.map((g) => g.s.name).join(', ') : ''}${free ? ', свободная суббота' : ''}`;
        wk.append(el(`<button type="button" class="${cls.join(' ')}" style="grid-column:${i + 1};grid-row:1" data-iso="${d}" aria-label="${esc(lbl)}"${past ? ' aria-disabled="true"' : ''}><span class="d">${dayNo(d)}</span>${free ? '<span class="free" aria-hidden="true"></span>' : ''}</button>`));
      });
      // название чужого турнира — прямо под его днями, тем же серым: видно, к какой строке оно относится
      segs.forEach((g) => {
        const c0 = daysBetween(days[0], g.a); const c1 = daysBetween(days[0], g.b);
        wk.append(el(`<span class="dp-band${g.a !== g.s.from ? ' cut-l' : ''}${g.b !== g.s.to ? ' cut-r' : ''}" style="grid-column:${c0 + 1} / ${c1 + 2}" aria-hidden="true">${esc(g.s.name)}</span>`));
      });
      node.append(wk);
    }
    return node;
  };
  const paint = () => {
    const hov = !st.b && st.a && st.hover && st.hover !== st.a ? st.hover : null;
    const A = st.b ? lo() : hov && hov < st.a ? hov : st.a;
    const B = st.b ? hi() : hov && hov > st.a ? hov : st.a;
    $$('.dp-day[data-iso]', monthsBox).forEach((c) => {
      const d = c.dataset.iso;
      const inR = !!(A && B && (st.b || hov) && d >= A && d <= B);
      const ym = d.slice(0, 7); const n = dim(+ym.slice(0, 4), +ym.slice(5, 7));
      c.classList.toggle('in', inR);
      c.classList.toggle('ghost', inR && !!hov);
      c.classList.toggle('a', inR && d === A);
      c.classList.toggle('b', inR && d === B);
      c.classList.toggle('wk-a', inR && (dow(d) === 0 || dayNo(d) === 1));
      c.classList.toggle('wk-b', inR && (dow(d) === 6 || dayNo(d) === n));
      c.classList.toggle('first', !st.b && d === st.a);
      c.classList.toggle('hov', !!hov && d === hov);
      c.setAttribute('aria-pressed', String(inR || d === st.a));
    });
  };
  const draw = () => { monthsBox.innerHTML = ''; months().forEach((m) => monthsBox.append(monthNode(m))); paint(); };
  const setRange = (a, b, { fromField } = {}) => {
    st.a = a; st.b = b; st.error = null; st.hover = null;
    if (a && !months().includes(a.slice(0, 7))) { st.start = a.slice(0, 7); draw(); } else paint();
    if (!fromField) {
      input.value = a && b ? plain(rangeShort(lo(), hi())) : '';
      field.classList.remove('error'); und.hidden = true;
    }
    say('');
    emit();
  };
  const sat = (d) => addDays(d, 5 - dow(d)); // суббота этой недели
  monthsBox.addEventListener('click', (e) => {
    const c = e.target.closest('.dp-day[data-iso]'); if (!c) return;
    const d = c.dataset.iso;
    if (d < today) { say('Прошедшие дни выбрать нельзя', true); return; }
    if (st.mode === 'one') { setRange(d, d); return; }
    if (st.mode === 'week8') { let a = dow(d) === 6 ? addDays(d, -1) : sat(d); if (a > d) a = addDays(a, -7); if (a < today) a = addDays(a, 7); setRange(a, addDays(a, 7)); return; }
    if (st.mode === 'weekend') { let a = dow(d) === 6 ? addDays(d, -1) : sat(d); if (a < today) a = addDays(a, 7); setRange(a, addDays(a, 1)); return; }
    if (!st.a || st.b || st.error) {
      st.a = d; st.b = null; st.hover = null; st.error = null;
      input.value = ''; field.classList.remove('error'); und.hidden = true;
      paint(); say(''); emit(); return;
    }
    if (d < st.a) setRange(d, st.a); else setRange(st.a, d);
  });
  monthsBox.addEventListener('pointerover', (e) => {
    if (!st.a || st.b || st.mode) return;
    const c = e.target.closest('.dp-day[data-iso]'); if (!c || c.dataset.iso < today) return;
    if (st.hover !== c.dataset.iso) { st.hover = c.dataset.iso; paint(); }
  });
  monthsBox.addEventListener('pointerleave', () => { if (st.hover) { st.hover = null; paint(); } });
  $$('[data-nav]', root).forEach((b) => b.addEventListener('click', () => { st.start = ymAdd(st.start, +b.dataset.nav); draw(); }));
  $$('[data-mode]', root).forEach((b) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    $$('[data-mode]', root).forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(on));
    st.mode = on ? b.dataset.mode : null;
    if (st.mode === 'one' && st.a) setRange(st.a, st.a);
    else say(on ? 'Теперь нажмите на любой день — диапазон выберется сам' : '');
  }));
  const take = $('[data-take]', root);
  if (take) take.addEventListener('click', () => setRange(o.suggest.from, o.suggest.to));
  $('[data-reset]', root).addEventListener('click', () => { st.a = null; st.b = null; st.hover = null; st.error = null; input.value = ''; field.classList.remove('error'); und.hidden = true; paint(); say(''); emit(); });
  // поле: понимает слова и цифры; ошибка — у поля, введённое на месте, выбор в календаре снимается
  let typing = null;
  input.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(() => {
      const r = parseDates(input.value, { today });
      if (r.empty) { field.classList.remove('error'); und.hidden = true; if (st.error) { st.error = null; emit(); } return; }
      if (r.error) {
        field.classList.add('error'); $('.err span', field).textContent = r.error; und.hidden = true;
        st.error = r.error; st.a = null; st.b = null; st.hover = null; paint(); emit(); return;
      }
      field.classList.remove('error');
      und.hidden = false; $('span', und).textContent = `${r.from === r.to ? 'Дата' : 'Даты'}: ${r.words}`;
      setRange(r.from, r.to, { fromField: true });
    }, 350);
  });
  draw();
  if (st.a && st.b) setRange(st.a, st.b);
  let wasPhone = isPhone();
  addEventListener('resize', () => { if (isPhone() !== wasPhone) { wasPhone = isPhone(); draw(); } });
  return { set: setRange, get: result, missing, say };
}

// ============================================================
// ПОЛЕ ОДНОЙ ДАТЫ: «Запись до», «Жеребьёвка», новые даты
// dateField(root, { label, value: '2027-08-02', hint, id, others, onChange(iso | null) })
// Пишут словами или цифрами; под полем — «Дата: понедельник, 2 августа»; ошибка — словами
// над полем, введённое на месте; кнопка «Календарь» — шторка с одним месяцем.
// ============================================================
let dfSeq = 0;
export function dateField(root, o = {}) {
  const id = o.id || `df-${(dfSeq += 1)}`;
  let value = o.value || null;
  root.classList.add('field', 'date-field');
  root.innerHTML = `<label class="label" for="${id}">${esc(o.label || 'Дата')}</label>
    <span class="err">${icon('alert')}<span></span></span>
    <div class="df-row"><input class="input" id="${id}" autocomplete="off" value="${esc(value ? plain(rangeShort(value)) : '')}"><button class="btn quiet" type="button" data-cal>${icon('calendar')}Календарь</button></div>
    <span class="hint">${esc(o.hint || 'например: 2 августа или 02.08')}</span>
    <span class="understood"${value ? '' : ' hidden'}>${icon('check')}<span>${value ? `Дата: ${esc(dayWords(value))}` : ''}</span></span>`;
  const input = $('input', root); const und = $('.understood', root); const err = $('.err span', root);
  const put = (iso, { typed } = {}) => {
    value = iso;
    root.classList.remove('error');
    if (!typed) input.value = iso ? plain(rangeShort(iso)) : '';
    und.hidden = !iso; if (iso) $('span', und).textContent = `Дата: ${dayWords(iso)}`;
    if (o.onChange) o.onChange(iso);
  };
  const bad = (t) => { root.classList.add('error'); err.textContent = t; und.hidden = true; value = null; if (o.onChange) o.onChange(null); };
  let typing = null;
  input.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(() => {
      const r = parseDates(input.value, { today: o.today || D.NOW.iso });
      if (r.empty) { root.classList.remove('error'); und.hidden = true; value = null; if (o.onChange) o.onChange(null); return; }
      if (r.error) { bad(r.error); return; }
      if (r.from !== r.to) { bad(`Здесь нужен один день, а не «${input.value.trim()}». Например: 2 августа`); return; }
      put(r.from, { typed: true });
    }, 350);
  });
  $('[data-cal]', root).addEventListener('click', () => {
    const box = el('<div></div>');
    let pick = value;
    const s = openSheet({ title: o.label || 'Дата', body: box, foot: `<button class="btn main" type="button" data-ok>${icon('check')}<span>${value ? `Взять: ${esc(dayWords(value))}` : 'Взять этот день'}</span></button><button class="btn quiet" type="button" data-no>Отмена</button>` });
    const ok = s.querySelector('[data-ok]'); const okText = $('span', ok);
    const dp = datePicker(box, {
      single: true, id: `${id}-cal`, from: value, month: (value || o.month || ymAdd((o.today || D.NOW.iso).slice(0, 7), 1)).slice(0, 7), others: o.others || [], today: o.today,
      onChange: (r) => { pick = r.from || null; okText.textContent = pick ? `Взять: ${dayWords(pick)}` : 'Взять этот день'; },
    });
    ok.addEventListener('click', () => { if (!pick) { dp.say(dp.missing(), true); return; } closeLayer(true); put(pick); input.focus(); });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  });
  return { get: () => value, set: (iso) => put(iso) };
}

// ============================================================
// ИГРОВЫЕ ДНИ И КОРТЫ
// playDays(root, { from, to, play: [iso], start: '08:45', round: 50, courts: ['c1', …],
//   blocks: D.BLOCKS, rest: 30, onChange(итог) })
// Справа итог словами: сколько матчей, кругов, когда конец, успеваем ли.
// Матчи финального дня идут волнами (сначала полуфиналы, потом финал), между волнами —
// отдых пар, как в расписании дня. Позже 23:00 день не кончается: иначе итог красный.
// onChange(итог): { ok, short — «36 матчей · успеваем» для низа мастера, over, late, … }
// ============================================================
export function playDays(root, o = {}) {
  const all = []; for (let d = o.from; d <= o.to; d = addDays(d, 1)) all.push(d);
  const courtIds = Object.keys(D.COURTS);
  const rest = o.rest || 30;
  const set = {}; // настройки игрового дня
  (o.play || []).forEach((d) => { set[d] = { start: o.start || '08:45', round: o.round || 50, courts: (o.courts || courtIds).slice() }; });
  let openDay = null;
  const blocks = o.blocks || D.BLOCKS;
  root.classList.add('pdays');
  root.innerHTML = `<div class="stack loose"><div class="stack tight"><h3 class="h3">Нажмите на день, чтобы включить или выключить игры</h3><div class="dtiles" role="group" aria-label="Дни турнира"></div></div><div class="dsets"></div></div><aside class="dsum" aria-live="polite"></aside>`;
  const tiles = $('.dtiles', root); const sets = $('.dsets', root); const sum = $('.dsum', root);
  const courtsWords = (ids) => (ids.length === courtIds.length ? `корты${NB}1–⁠${courtIds.length}` : ids.length ? `${plural(ids.length, 'корт', 'корты', 'корты')}${NB}${ids.map((c) => D.COURTS[c].name.replace('Корт ', '')).join(', ')}` : 'кортов нет');
  const dayLine = (x) => `начало ${x.start} · круг ${x.round}${NB}минут · ${courtsWords(x.courts)}`;
  const calc = () => {
    const days = Object.keys(set).sort();
    const total = blocks.reduce((s, b) => s + b.n, 0);
    const grp = blocks.filter((b) => b.stage === 'group').reduce((s, b) => s + b.n, 0);
    const used = new Set(); days.forEach((d) => set[d].courts.forEach((c) => used.add(c)));
    const lines = []; let over = 0; const late = [];
    blocks.forEach((b, i) => {
      const d = days[i];
      if (!d) { over += b.n; return; }
      const x = set[d]; const c = x.courts.length;
      if (!c) { over += b.n; lines.push({ d, t: `${b.label} — нет кортов`, bad: true }); return; }
      // волна ждёт итогов прошлой: между ними отдых пар
      const waves = b.waves || [b.n];
      let end = toMin(x.start); let rounds = 0;
      waves.forEach((n, k) => { const r = Math.ceil(n / c); rounds += r; end += r * x.round + (k < waves.length - 1 ? rest : 0); });
      const isLate = end > DAY_END;
      if (isLate) late.push({ d, end });
      lines.push({ d, bad: isLate, t: `${b.label} — ${b.n}${NB}${plural(b.n, 'матч', 'матча', 'матчей')}, ${rounds}${NB}${plural(rounds, 'круг', 'круга', 'кругов')}${waves.length > 1 ? `, между ними отдых ${rest}${NB}минут` : ''}, конец ${endWords(end)}${isLate ? ' — проверьте начало' : ''}` });
    });
    days.slice(blocks.length).forEach((d) => lines.push({ d, t: 'запасной день — матчей нет' }));
    const ok = !over && !late.length;
    const short = over ? `Не помещаются ${over} ${plural(over, 'матч', 'матча', 'матчей')}` : late.length ? `${dayWords(late[0].d, { cap: true })}: конец ${endWords(late[0].end)}` : `${total} ${plural(total, 'матч', 'матча', 'матчей')} · успеваем`;
    return { days, total, grp, courts: used.size, lines, over, late, ok, short };
  };
  // итог справа и строки дней — без перерисовки полей: фокус остаётся на месте
  const refresh = () => {
    $$('.dset', sets).forEach((b) => { const x = set[b.dataset.d]; const t = $('.dset-line', b); if (x && t) t.textContent = dayLine(x); });
    const r = calc();
    const verdict = r.over ? `<div class="verdict bad">${icon('alert')}<span>Не помещаются ${r.over}${NB}${plural(r.over, 'матч', 'матча', 'матчей')}. Добавьте корт или игровой день</span></div>`
      : r.late.length ? `<div class="verdict bad">${icon('alert')}<span>${esc(dayWords(r.late[0].d, { cap: true }))} закончится ${esc(endWords(r.late[0].end))}. Проверьте начало первого круга</span></div>`
        : `<div class="verdict ok">${icon('check')}<span>Успеваем</span></div>`;
    sum.innerHTML = `<h3 class="h3">Итог</h3><ul>
        <li><b>Всего матчей ${r.total}:</b> ${r.grp} в группах и ${r.total - r.grp} в плей-офф и за места.</li>
        <li>Игровых дней ${r.days.length}, кортов ${r.courts}.</li>
        ${r.lines.map((l) => `<li${l.bad ? ' class="bad"' : ''}><b>${esc(dayWords(l.d, { cap: true }))}:</b> ${esc(l.t)}.</li>`).join('')}
      </ul>${verdict}`;
    if (o.onChange) o.onChange({ play: r.days, set: JSON.parse(JSON.stringify(set)), ...r });
  };
  const draw = () => {
    tiles.innerHTML = all.map((d) => { const on = !!set[d]; return `<button type="button" class="dtile${dow(d) > 4 ? ' we' : ''}" aria-pressed="${on}" data-d="${d}" aria-label="${esc(dayWords(d, { cap: true }))}: ${on ? 'играем' : 'без игр'}"><span class="wd">${WD[dow(d)]}</span><span class="dn">${dayNo(d)}</span><span class="mo">${MON_GEN[monIdx(d)]}</span><span class="st">${on ? 'играем' : 'без игр'}</span></button>`; }).join('');
    const days = Object.keys(set).sort();
    if (openDay && !set[openDay]) openDay = null;
    sets.innerHTML = days.map((d) => {
      const x = set[d]; const open = d === openDay;
      return `<div class="dset" data-d="${d}"><button type="button" aria-expanded="${open}"><span class="grow"><b>${esc(dayWords(d, { cap: true }))}</b><span class="dset-line">${esc(dayLine(x))}</span></span>${open ? '' : '<span class="dset-edit" aria-hidden="true">Изменить</span>'}${icon('down')}</button>
        ${open ? `<div class="body">
          <div class="field"><label class="label" for="pd-start-${d}">Начало первого круга</label><span class="err">${icon('alert')}<span></span></span><input class="input num" id="pd-start-${d}" data-k="start" value="${esc(x.start)}" inputmode="numeric" style="max-width:200px"><span class="hint">например: 08:45 или 0845</span></div>
          <div class="field full"><span class="label">Круг длится</span><div class="chips" role="radiogroup" aria-label="Круг длится">${[40, 50, 60].map((m) => `<button type="button" class="chip" role="radio" aria-checked="${x.round === m}" data-v="${m}">${icon('check')}${m} минут</button>`).join('')}<button type="button" class="chip" role="radio" aria-checked="${![40, 50, 60].includes(x.round)}" data-v="other">${icon('check')}${[40, 50, 60].includes(x.round) ? 'Другое' : x.round + ' минут'}</button></div></div>
          <div class="field full"><span class="label">Корты</span><div class="checks">${courtIds.map((c) => `<label class="check"><input type="checkbox" data-c="${c}"${x.courts.includes(c) ? ' checked' : ''}><span class="box">${icon('check')}</span><span class="srf" style="background:linear-gradient(160deg,var(--srf),var(--srf-2))" data-srf="${D.COURTS[c].surface}"></span><span>${esc(D.courtFull(c))}</span></label>`).join('')}</div></div>
          <div class="line"><button class="btn quiet" type="button" data-same>${icon('copy')}Так же во все дни</button></div>
        </div>` : ''}</div>`;
    }).join('') || '<p class="muted">Ни одного игрового дня. Нажмите на день выше.</p>';
    choices(sets);
    refresh();
  };
  tiles.addEventListener('click', (e) => {
    const t = e.target.closest('.dtile'); if (!t) return;
    const d = t.dataset.d;
    if (set[d]) delete set[d];
    else { const like = set[Object.keys(set).sort()[0]]; set[d] = like ? JSON.parse(JSON.stringify(like)) : { start: o.start || '08:45', round: o.round || 50, courts: courtIds.slice() }; }
    draw();
    const nt = $(`.dtile[data-d="${d}"]`, tiles); if (nt) nt.focus();
  });
  sets.addEventListener('click', (e) => {
    const box = e.target.closest('.dset'); if (!box) return;
    const d = box.dataset.d;
    if (e.target.closest('.dset > button')) { openDay = openDay === d ? null : d; draw(); const b = $(`.dset[data-d="${d}"] > button`, sets); if (b) b.focus(); return; }
    const chip = e.target.closest('.chip[data-v]');
    if (chip) {
      if (chip.dataset.v === 'other') {
        const s = openSheet({ title: 'Сколько длится круг?', body: `<div class="field full"><label class="label" for="pd-other">Минут</label><span class="err">${icon('alert')}<span>Впишите число от 20 до 180</span></span><input class="input num" id="pd-other" inputmode="numeric" value="${set[d].round}" autofocus></div>`, foot: '<button class="btn main" type="button" data-ok>Сохранить длину круга</button><button class="btn quiet" type="button" data-no>Отмена</button>' });
        s.querySelector('[data-ok]').addEventListener('click', () => { const v = parseInt(s.querySelector('input').value, 10); if (v >= 20 && v <= 180) { set[d].round = v; closeLayer(true); draw(); } else s.querySelector('.field').classList.add('error'); });
        s.querySelector('[data-no]').addEventListener('click', () => { closeLayer(true); draw(); });
        return;
      }
      set[d].round = +chip.dataset.v; refresh(); return;
    }
    if (e.target.closest('[data-same]')) {
      const src = set[d]; const before = JSON.parse(JSON.stringify(set));
      Object.keys(set).forEach((k) => { set[k] = JSON.parse(JSON.stringify(src)); });
      refresh();
      toast(`Во всех днях: ${dayLine(src)}`, { undo: () => { Object.keys(before).forEach((k) => { set[k] = before[k]; }); draw(); } });
    }
  });
  // флажки кортов и время начала — сразу в итог, поля не перерисовываются
  sets.addEventListener('change', (e) => {
    const box = e.target.closest('.dset'); if (!box) return;
    const d = box.dataset.d;
    if (e.target.dataset.c) { set[d].courts = $$('input[data-c]', box).filter((x) => x.checked).map((x) => x.dataset.c); refresh(); return; }
    if (e.target.dataset.k === 'start') {
      const t = parseTime(e.target.value);
      const f = e.target.closest('.field');
      if (!t) { f.classList.add('error'); $('.err span', f).textContent = `Не понял время «${e.target.value}». Например: 08:45`; return; }
      if (toMin(t) < 6 * 60 || toMin(t) > 21 * 60) { f.classList.add('error'); $('.err span', f).textContent = `Первый круг начинают с 06:00 до 21:00, а не в ${t}. Например: 08:45`; return; }
      f.classList.remove('error'); e.target.value = t; set[d].start = t; refresh();
    }
  });
  draw();
  return { get: () => JSON.parse(JSON.stringify(set)), summary: calc };
}

// ============================================================
// КАК ИДЁТ ДЕНЬ — одно правило и одни слова для «Сегодня» и «Дня турнира».
// dayPace(day, F): day — матчи дня, мир и сделанное (перенос, введённый счёт: dayMatchesNow()),
// F — прогноз дня (forecastDay из js/tournament.logic.js: byId → { start, end }, end — конец дня).
// Прогноз знает ранний вызов (forecastList в js/tournament.calls.js): вызвали финал в 18:58 —
// он начнётся около 19:20, и конец дня считается от этого.
// «Отстаём на 15 минут на корте 3» — хоть один матч идёт дольше программы или начнётся позже неё
// (от 5 минут, шаг 5); корт — где отстаём больше всего. Отстаёт финал — корт не пишем: об этом
// строка про финал. Иначе — «Идём по программе».
// → { ok, text, late, court, final: { late, start, done, text }, end, margin, light: 'за 25 минут до заката' };
//   final.late меньше нуля — финал начнётся раньше программы
// ============================================================
const r5 = (x) => Math.round(x / 5) * 5;
// «на 15 минут», «на 1 час 5 минут» — после «на» и «за»
const durAcc = (n) => { const m = Math.round(Math.abs(n)); const h = Math.floor(m / 60); const r = m % 60; const mm = (x) => `${x} ${plural(x, 'минуту', 'минуты', 'минут')}`; return h ? `${h} ${plural(h, 'час', 'часа', 'часов')}${r ? ` ${mm(r)}` : ''}` : mm(r); };
export function dayPace(day, F, { slot = D.RULES.slot || 50, sunset = D.TODAY.sunset } = {}) {
  let late = 0; let court = null;
  day.forEach((m) => {
    const f = F && F.byId.get(m.id); if (!f) return;
    const t = toMin(m.time);
    const d = m.state === 'live' ? r5(f.end - (t + slot)) : m.state === 'soon' ? r5(f.start - t) : 0;
    if (d > late) { late = d; court = m.court; }
  });
  const fm = day.find((m) => m.round === 'f' || m.id === 'final');
  const ff = fm && F ? F.byId.get(fm.id) : null;
  const finLate = fm && ff && fm.state === 'soon' ? r5(ff.start - toMin(fm.time)) : 0;
  const ok = late < 5;
  const where = court && D.COURTS[court] ? ` на ${D.COURTS[court].name.toLowerCase().replace(/^корт/, 'корте')}` : '';
  const text = ok ? 'Идём по программе' : `Отстаём на ${durAcc(late)}${finLate < 5 ? where : ''}`;
  const end = F ? r5(F.end) : null;
  const margin = end == null ? null : toMin(sunset) - end;
  const light = margin == null ? '' : margin > 0 ? `за ${durAcc(margin)} до заката` : margin === 0 ? 'к закату' : `позже заката на ${durAcc(-margin)}`;
  // финал словами — рядом с выводом: «Отстаём на 15 минут на корте 3» не пугает, когда видно «Финал вовремя — в 20:00».
  // Пары финала вызвали раньше обычного — «Финал раньше — около 19:20», как «начнут около 19:20» в карточке вызова
  const finStart = ff ? r5(ff.start) : null;
  const finalText = !fm ? '' : fm.state === 'done' ? 'Финал сыгран'
    : finLate >= 5 && finStart != null ? `Финал около ${hhmm(finStart)}`
      : finLate <= -5 && finStart != null ? `Финал раньше — около ${hhmm(finStart)}`
        : `Финал вовремя — в ${fm.time}`;
  return { ok, text, late, court, final: fm ? { late: finLate, start: finStart, done: fm.state === 'done', text: finalText } : null, end, margin, light };
}
// строка под выводом — одна на «Сегодня» и «Дне турнира»:
// «Финал вовремя — в 20:00 · конец дня около 20:45 · за 25 минут до заката» (позже заката — красным);
// после раннего вызова — «Финал раньше — около 19:20 · конец дня около 20:05 · за 1 час 5 минут до заката»
export function dayPaceLine(P) {
  const parts = [];
  if (P.final && P.final.text) parts.push(esc(P.final.text));
  if (P.end != null) parts.push(`${parts.length ? 'конец' : 'Конец'} дня около ${hhmm(P.end)}`);
  if (P.light) parts.push(P.margin < 0 ? `<span class="bad">${esc(P.light)}</span>` : esc(P.light));
  return parts.join(' · ');
}

// ============================================================
// РАСПИСАНИЕ ДНЯ ПО КОРТАМ
// dayPlan(root, {
//   day: '2027-06-19', days: [iso…] — игровые дни турнира (плитки в шапке),
//   mode: 'live' — день идёт, правки видны сразу; 'draft' — черновик; 'published' — показан;
//         'done' — день сыгран, только смотреть,
//   courts: ['c1', …], rows: [{ key, b, s, min }] — круги или время по программе,
//   matches: [{ id, court, row, pairs, title, tour, stage: 'group'|'play'|'final', state,
//     sets, winner, games, duration, ends, tbd }],
//   breaks: [{ from: '13:00', to: '13:30', court: null | 'c4', kind: 'all'|'court'|'open', label }],
//   now: { min, label }, rest: 30, start, round, cupName,
//   onDay(iso) — переключить день; без него плитки дней только показывают, какой это день,
//   onChange(state) })
// Вернёт { load(план), draw, state }. Перенос — перетаскиванием (ноутбук) или кнопками
// «Перенести» → корт → время → «Проверьте» (везде). В идущий день перенос всегда проходит
// через «Проверьте»: игроки увидят его сразу. Конфликты — на карточке словами, с «Оставить так».
// ============================================================
const toPlan = (m, court, row, extra = {}) => ({
  id: m.id, court, row, pairs: m.pairs, title: m.title, state: m.state,
  stage: m.round === 'f' ? 'final' : m.round === 'group' ? 'group' : 'play',
  sets: m.sets, winner: m.winner, games: m.games, duration: m.duration ? parseInt(m.duration, 10) : null,
  ends: m.state === 'live' ? D.FORECAST[m.id] : null, ...extra,
});
// Ярлык «сейчас 19:05» не ложится на подпись часа «19:00»: если задевает её — встаёт справа от подписи.
export function nowTagAside(grid, tag) {
  const pill = tag && tag.firstElementChild; if (!pill) return;
  pill.style.left = '';
  const pr = pill.getBoundingClientRect();
  const hit = [...grid.querySelectorAll('.pg-time b, .pg-time span')].find((x) => {
    const q = x.getBoundingClientRect();
    return q.width && q.bottom > pr.top + 1 && q.top < pr.bottom - 1 && q.right > pr.left && q.left < pr.right;
  });
  if (!hit) return;
  const q = hit.closest('.pg-time').getBoundingClientRect(); const lab = hit.getBoundingClientRect();
  pill.style.left = `${Math.round(Math.max(lab.right, q.left + 8) - grid.getBoundingClientRect().left + 8)}px`;
}
// День финалов «Июньского кубка» из общего мира — готовые данные для расписания
export function planFromWorld() {
  return {
    day: D.TODAY.iso, days: D.JUNE_DAYS, mode: 'live', cupName: D.TOURNAMENT.name,
    courts: Object.keys(D.COURTS),
    rows: D.DAY_ROWS.map((t) => ({ key: t, b: t, min: toMin(t) })),
    matches: D.DAY_MATCHES.map((m) => toPlan(m, m.court, m.time)),
    breaks: [],
    now: { min: D.NOW.min, label: D.NOW.time },
    rest: 30,
  };
}
// Любой игровой день «Июньского кубка»: 19 июня идёт, 18 июня — четвертьфиналы по времени,
// 12–14 июня — туры групп. Кортов и времени у матчей групп в мире нет — они показаны списком.
export function planForDay(iso) {
  if (iso === D.TODAY.iso) return planFromWorld();
  const dm = `${dayNo(iso)} ${MON_GEN[monIdx(iso)]}`;
  const tour = D.TOURNAMENT.groupDays.indexOf(dm) + 1;
  const list = D.MATCHES.filter((m) => m.day === dm);
  const base = { day: iso, days: D.JUNE_DAYS, mode: 'done', cupName: D.TOURNAMENT.name, courts: Object.keys(D.COURTS), breaks: [], now: null, rest: 30 };
  if (list.length && list.every((m) => m.time && m.court)) {
    const times = [...new Set(list.map((m) => m.time))].sort();
    return { ...base, rows: times.map((t) => ({ key: t, b: t, min: toMin(t) })), matches: list.map((m) => toPlan(m, m.court, m.time)) };
  }
  return { ...base, rows: [], matches: list.map((m) => toPlan(m, null, null, tour ? { tour: `${tour}-й тур` } : {})) };
}
// Пустой день «Августовского кубка»: 1-й тур групп, пары станут известны после жеребьёвки
export function planEmptyDay() {
  const g = ['A', 'B', 'C', 'D'];
  const matches = [];
  g.forEach((x) => [1, 2].forEach((k) => matches.push({ id: `${x}${k}`, court: null, row: null, pairs: null, title: `Группа ${x}`, stage: 'group', state: 'soon', tbd: `Пары — после жеребьёвки ${dayNo(D.NEW_CUP.draw)}${NB}${MON_GEN[monIdx(D.NEW_CUP.draw)]}`, tour: '1-й тур' })));
  return {
    day: D.NEW_CUP.from, days: D.NEW_CUP.play, mode: 'draft', cupName: D.NEW_CUP.name, empty: true,
    courts: D.NEW_CUP.courts, start: D.NEW_CUP.start, round: D.NEW_CUP.round,
    rows: [], matches, breaks: [], now: null, rest: 30,
  };
}
const BREAK_KINDS = { all: 'Перерыв на всех кортах', court: 'Корт закрыт', open: 'Открытие или награждение' };
export function dayPlan(root, o) {
  let S; let snapshot = null; let bSeq = 0; let gridRO = null;
  const normBreak = (b) => ({ ...b, id: b.id || `b${(bSeq += 1)}`, from: typeof b.from === 'number' ? b.from : toMin(b.from), to: typeof b.to === 'number' ? b.to : toMin(b.to), court: b.court || null, kind: b.kind || (b.court ? 'court' : 'all') });
  const init = (p) => {
    S = { ...p, matches: p.matches.map((m) => ({ ...m })), rows: (p.rows || []).slice(), kept: new Set(), published: p.mode === 'published' ? (p.publishedAt || 'в 18:42') : null, dirty: false, manual: false };
    S.breaks = (p.breaks || []).map(normBreak);
    snapshot = S.mode === 'published' ? JSON.stringify(S.matches) : null;
  };
  init(o);
  const isLive = () => S.mode === 'live';
  const isDone = () => S.mode === 'done';
  const rowOf = (key) => S.rows.find((r) => r.key === key);
  const rowIndex = (key) => S.rows.findIndex((r) => r.key === key);
  const mdur = (m) => m.duration || S.round || 50;
  const start = (m) => (rowOf(m.row) ? rowOf(m.row).min : null);
  const rowWords = (r) => (r.s && /^\d/.test(r.s) ? r.s : r.b);
  // время для игрока: «08:45», «около 09:35», «19:00»
  const timeWords = (r) => (r.round ? (r.s || r.b) : rowWords(r));
  // место в расписании словами: «2 круг · около 09:35», «в 19:00»
  const placeWords = (r) => (r.round ? `${r.b}${r.s ? " · " + r.s : ""}` : `в ${rowWords(r)}`);
  const stageWord = (m) => (m.tour ? `${m.title} · ${m.tour}` : m.title);
  const courtName = (c) => D.COURTS[c].name;
  const lowCourt = (c) => courtName(c).toLowerCase();
  const courtLoc = (c) => lowCourt(c).replace('корт', 'корте');
  const placed = () => S.matches.filter((m) => m.court && m.row);
  const players = (m) => (m.pairs ? m.pairs.flatMap((p) => D.pair(p).players) : []);
  const dayStart = () => (S.rows[0] ? S.rows[0].min : 0);
  // строка расписания занимает время до следующей строки
  const rowEnd = (i) => (S.rows[i + 1] ? S.rows[i + 1].min : S.rows[i].min + (S.round || 60));
  const breakWhen = (b) => (b.kind === 'court' && b.from <= dayStart() ? `до ${hhmm(b.to)}` : `${hhmm(b.from)}–${hhmm(b.to)}`);
  const breakText = (b) => (b.kind === 'court' ? `${courtName(b.court)} закрыт ${b.from <= dayStart() ? `до ${hhmm(b.to)}` : `с ${hhmm(b.from)} до ${hhmm(b.to)}`}` : `${b.label || BREAK_KINDS[b.kind]} · ${breakWhen(b)}`);
  const breakPhrase = (b) => (b.kind === 'court' ? breakText(b) : `В это время ${low1(b.label || BREAK_KINDS[b.kind])} (${breakWhen(b)})`);
  const pastRow = (r) => isLive() && S.now && r.min < S.now.min;

  // ---------- конфликты ----------
  // t — фраза на карточке; lc — первую букву можно сделать строчной во «Оставлено так: …»
  const issues = (m) => {
    if (!m.court || !m.row || m.state === 'done') return [];
    const out = [];
    const t0 = start(m);
    placed().forEach((x) => {
      if (x === m) return;
      if (x.court === m.court && x.row === m.row) out.push({ k: `court:${x.id}`, bad: true, lc: true, t: `На ${courtLoc(m.court)} в это время уже ${matchName(x.title)}` });
      else if (x.row === m.row && players(m).some((p) => players(x).includes(p))) {
        const shared = m.pairs.find((p) => x.pairs && x.pairs.includes(p));
        out.push({ k: `pair:${x.id}`, bad: true, t: `${shared ? pairAnd(shared) : 'Пара'} в это время ${shared ? 'играют' : 'играет'} ${matchName(x.title)} на ${courtLoc(x.court)}` });
      }
      if (x.state === 'live' && x.court === m.court && x.ends && x.row !== m.row && start(x) < t0 && toMin(x.ends) > t0) out.push({ k: `live:${x.id}`, bad: true, lc: true, t: `На ${courtLoc(m.court)} до ${x.ends} идёт ${matchName(x.title)}` });
    });
    S.breaks.forEach((b) => { if ((!b.court || b.court === m.court) && t0 < b.to && t0 + mdur(m) > b.from) out.push({ k: `brk:${b.id}`, bad: true, lc: true, t: breakPhrase(b) }); });
    // мало отдыха между матчами пары (порог — настройка организатора)
    if (m.pairs && t0 !== null) {
      placed().forEach((x) => {
        if (x === m || !x.pairs || start(x) === null) return;
        m.pairs.filter((p) => x.pairs.includes(p)).forEach((p) => {
          const gap = start(x) < t0 ? t0 - (start(x) + mdur(x)) : start(x) - (t0 + mdur(m));
          if (gap >= 0 && gap < (S.rest || 30)) out.push({ k: `rest:${x.id}:${p}`, warn: true, short: `отдых ${minutesWords(gap)}`, t: `${pairAnd(p)} отдыхают между матчами ${minutesWords(gap)}` });
        });
      });
    }
    return out;
  };
  const openIssues = (m) => issues(m).filter((x) => !S.kept.has(`${m.id}|${x.k}`));
  const allIssues = () => placed().flatMap((m) => openIssues(m).map((x) => ({ m, ...x })));
  const issuesHtml = (m) => {
    const iss = issues(m);
    const open = iss.filter((x) => !S.kept.has(`${m.id}|${x.k}`));
    const kept = iss.filter((x) => S.kept.has(`${m.id}|${x.k}`));
    return {
      cls: open.some((x) => x.bad) ? 'issue-bad' : open.some((x) => x.warn) ? 'issue-warn' : '',
      html: open.map((x) => `<div class="mc-issue ${x.bad ? 'bad' : 'warn'}" role="note"><span>${esc(x.t)}</span><button class="btn" type="button" data-keep="${esc(x.k)}">Оставить так</button></div>`).join('')
        + kept.map((x) => `<span class="mc-kept">Оставлено так: ${esc(x.short || (x.lc ? low1(x.t) : x.t))}</span>`).join(''),
    };
  };
  // ---------- строки карточки: время словами сверху, состояние снизу ----------
  const lines = (m, { inStack } = {}) => {
    const r = rowOf(m.row);
    if (m.state === 'live') { const g = m.games ? m.games.join(':') : ''; return { top: `<span class="lv">Идёт · ${g}</span>`, foot: m.ends ? `закончится около ${m.ends}` : '', st: `идёт · ${g}${m.ends ? ' · закончится около ' + m.ends : ''}` }; }
    if (m.state === 'done') { const sc = m.sets ? m.sets.map(([a, b]) => `${a}:${b}`).join(' ') : ''; return { top: `Сыгран · ${sc}`, foot: m.duration ? minutesWords(m.duration) : '', st: `сыгран · ${sc}` }; }
    if (inStack || !r) return { top: 'ещё не в расписании', foot: m.tour || '', st: 'ещё не в расписании' };
    const top = r.round && rowIndex(m.row) > 0 ? 'после матча выше' : `в ${rowWords(r)}`;
    const before = placed().find((x) => x !== m && x.court === m.court && x.state === 'live' && x.ends && start(x) < r.min && toMin(x.ends) > r.min);
    const foot = before ? `начнётся около ${before.ends}` : isLive() ? 'начнётся вовремя' : (m.tour || '');
    return { top: esc(top), foot, st: before || isLive() ? foot : top };
  };
  const pairLine = (m, i) => {
    if (!m.pairs) return i === 0 ? `<span class="mc-pair tbd">${esc(m.tbd || 'Пара ещё не известна')}</span>` : '';
    const lose = m.state === 'done' && m.winner !== i;
    return `<span class="mc-pair${lose ? ' lose' : ''}">${esc(D.pairName(m.pairs[i]))}</span>`;
  };
  const labelOf = (m) => {
    const r = rowOf(m.row);
    const where = m.court && r ? `${courtName(m.court)}, ${rowWords(r)}` : 'ещё не в расписании';
    return `${stageWord(m)}${m.pairs ? `: ${D.pairName(m.pairs[0])} против ${D.pairName(m.pairs[1])}` : ''}, ${where}`;
  };
  // карточка: сама карточка — кнопка «открыть матч», «Оставить так» — отдельные кнопки под ней
  const cardHtml = (m, { inStack } = {}) => {
    const L = lines(m, { inStack });
    const I = inStack ? { cls: '', html: '' } : issuesHtml(m);
    return `<div class="mcard${I.cls ? ' ' + I.cls : ''}" data-id="${esc(m.id)}" data-stage="${m.stage}" data-state="${m.state}"${I.cls ? ' data-issue' : ''}>
      <button type="button" class="mc-open" aria-label="${esc(labelOf(m))}">
        <span class="mc-top">${L.top}<span class="stg">${esc(m.title)}</span></span>
        ${pairLine(m, 0)}${pairLine(m, 1)}
        <span class="mc-foot">${esc(L.foot)}</span>
        <span class="mc-where"></span>
      </button>${I.html}</div>`;
  };
  // ---------- шапка ----------
  const headHtml = () => {
    const nav = !!o.onDay;
    const idx = S.days.indexOf(S.day);
    const prev = idx > 0 ? S.days[idx - 1] : null;
    const n = allIssues().length;
    const played = S.matches.filter((m) => m.state === 'done').length;
    let state = '';
    if (isLive()) state = `<span class="tag live lg">День идёт</span><span class="strong">Изменения видны игрокам сразу</span>`;
    else if (isDone()) state = `<span class="tag past lg">День сыгран</span>`;
    else if (S.published && !S.dirty) state = `<span class="tag ok lg">Опубликовано ${esc(S.published)}</span>`;
    else if (S.published && S.dirty) state = `<span class="tag warn lg">Есть правки — игроки их ещё не видят</span>`;
    else state = `<span class="tag draft lg">Черновик — игроки не видят</span><span class="saved">${icon('check')}Сохранено в ${esc(D.NOW.time)}</span>`;
    const issuesLink = n ? `<button type="button" class="btn text issues-link" data-issues>${icon('alert')}${n} ${plural(n, 'вопрос', 'вопроса', 'вопросов')}</button>` : '';
    const canPublish = !isLive() && !isDone() && placed().length && (!S.published || S.dirty);
    const btn = `${S.published && S.dirty ? `<button class="btn quiet" type="button" data-revert>${icon('undo')}Вернуть опубликованное</button>` : ''}${canPublish ? `<button class="btn main" type="button" data-publish>${icon('eye')}${S.published ? 'Опубликовать правки' : 'Опубликовать день'}</button>` : ''}`;
    const free = isLive() && S.now ? S.courts.filter((c) => !S.matches.some((m) => m.court === c && m.state === 'live')) : [];
    const tile = (d) => {
      const inner = `<span class="wd">${WD[dow(d)]}</span><span class="dn">${dayNo(d)}</span>`;
      const cls = d === D.NOW.iso ? 'is-today' : '';
      const cur = d === S.day ? ' aria-current="true"' : '';
      return nav ? `<button type="button" data-day="${d}" class="${cls}"${cur} aria-label="${esc(dayWords(d, { cap: true }))}${d === D.NOW.iso ? ', сегодня' : ''}">${inner}</button>` : `<span class="${cls}"${cur} aria-label="${esc(dayWords(d, { cap: true }))}">${inner}</span>`;
    };
    return `<div class="plan-day">${nav && prev ? `<button class="btn text" type="button" data-day="${prev}">${icon('back')}${esc(dayWords(prev, { cap: true }))}</button>` : ''}<h2 class="h1">${esc(dayWords(S.day, { cap: true }))}</h2>${isLive() || isDone() ? `<span class="strong">Сыграно ${played} из ${S.matches.length}</span>` : ''}</div>
      <div class="plan-days${nav ? '' : ' still'}" role="${nav ? 'group' : 'list'}" aria-label="Игровые дни турнира">${S.days.map(tile).join('')}</div>
      <div class="plan-state">${state}${issuesLink}<span class="push"></span>${btn}</div>
      ${free.length ? `<div class="plan-free">${icon('check')}Свободны сейчас: ${free.map((c) => lowCourt(c)).join(', ')}</div>` : ''}`;
  };
  // ---------- стопка «Ещё не в расписании» ----------
  const stackHtml = () => {
    const rest = S.matches.filter((m) => !m.court || !m.row);
    if (!rest.length) {
      const g = S.matches.filter((m) => m.stage === 'group').length; const p = S.matches.length - g;
      return `<div class="plan-sum">${icon('check')}<span>Все матчи дня в расписании</span>${g ? `<span class="s">Группы — ${g} из ${g}</span>` : ''}${p ? `<span class="s">Плей-офф и матчи за места — ${p} из ${p}</span>` : ''}</div>`;
    }
    const by = {}; rest.forEach((m) => { const k = stageWord(m); (by[k] = by[k] || []).push(m); });
    return `<aside class="pstack" aria-label="Ещё не в расписании"><h3 class="h3">Ещё не в расписании <span class="num">· ${rest.length}</span></h3>${Object.entries(by).map(([k, list], i) => `<details${i === 0 ? ' open' : ''}><summary><span class="stp" data-stage="${list[0].stage}" aria-hidden="true"></span>${esc(k)}<span class="n">${list.length}</span></summary><div class="cards">${list.map((m) => cardHtml(m, { inStack: true })).join('')}</div></details>`).join('')}<p class="muted small">Нажмите на матч, чтобы поставить его, или перетащите в клетку</p></aside>`;
  };
  // ---------- сетка ----------
  // свободная клетка что-то делает, только если есть что сюда поставить
  const movable = (c, rk) => S.matches.filter((m) => m.state === 'soon' && !(m.court === c && m.row === rk));
  const gridHtml = () => {
    const cols = S.courts.length;
    // корты не помещаются (1024): над сеткой «Видны корты 1–3 из 5» и кнопки «‹ Корты 1–2», «Корты 4–5 ›»
    let h = `<div class="pgrid-box"><div class="pg-nav" hidden><span class="pg-seen"></span><span class="push"></span><button type="button" class="btn quiet" data-more="-1" hidden></button><button type="button" class="btn quiet" data-more="1" hidden></button></div><div class="pgrid-wrap"><div class="pgrid" style="--courts:${cols}" role="grid" aria-label="Расписание по кортам"><div class="pg-corner"></div>`;
    S.courts.forEach((c) => { const x = D.COURTS[c]; h += `<div class="pg-court" data-srf="${x.surface}" data-court="${c}" role="columnheader"><b>${esc(x.name)}${x.note ? ' · ' + esc(x.note) : ''}</b><span>${esc(D.SURFACES[x.surface].label)}</span></div>`; });
    const common = S.breaks.filter((b) => !b.court).sort((a, b) => a.from - b.from);
    let bi = 0;
    const breakRow = (b) => `<div class="pg-time brk" role="rowheader"><b>${hhmm(b.from)}</b><span>до ${hhmm(b.to)}</span></div><div class="pg-cell brk" style="grid-column:2 / span ${cols}"><div class="pg-break">${icon(b.kind === 'open' ? 'star' : 'pause')}${esc(breakText(b))}</div></div>`;
    S.rows.forEach((r, ri) => {
      while (bi < common.length && common[bi].from <= r.min) { h += breakRow(common[bi]); bi += 1; }
      const past = pastRow(r);
      h += `<div class="pg-time${past ? ' past' : ''}" data-row="${esc(r.key)}" role="rowheader"><b>${esc(r.b)}</b>${r.s ? `<span>${esc(r.s)}</span>` : ''}</div>`;
      S.courts.forEach((c) => {
        const here = S.matches.filter((m) => m.court === c && m.row === r.key);
        const shut = S.breaks.filter((b) => b.court === c && b.from < rowEnd(ri) && b.to > r.min);
        const can = !isDone() && !past && !here.length && !shut.length && movable(c, r.key).length;
        h += `<div class="pg-cell${can ? ' empty-slot' : ''}${past ? ' past' : ''}" data-court="${c}" data-row="${esc(r.key)}" role="gridcell">${shut.map((b) => `<div class="pg-break">${icon('lock')}${esc(breakText(b))}</div>`).join('')}${here.map((m) => cardHtml(m)).join('')}${can ? `<button type="button" class="slot-add" data-slot aria-label="${esc(courtName(c))}, ${esc(rowWords(r))}: свободно — поставить матч">${icon('plus')}Свободно</button>` : ''}</div>`;
      });
    });
    while (bi < common.length) { h += breakRow(common[bi]); bi += 1; }
    h += '</div></div></div>';
    return h;
  };
  const legend = `<div class="legend plan-legend" aria-label="Что значат цвета"><span><i class="stg-sw" data-stage="group"></i>Группы</span><span><i class="stg-sw" data-stage="play"></i>Плей-офф и матчи за места</span><span><i class="stg-sw" data-stage="final"></i>Финал</span><span><i class="iss-sw bad"></i>Конфликт</span><span><i class="iss-sw warn"></i>Обратите внимание</span></div>`;
  // ---------- телефон: день списком ----------
  const phoneItem = (m) => {
    const L = lines(m); const I = issuesHtml(m); const r = rowOf(m.row); const c = D.COURTS[m.court];
    const who = m.pairs ? `<span class="pr${m.state === 'done' && m.winner !== 0 ? ' lose' : ''}">${esc(D.pairName(m.pairs[0]))}</span><span class="pr${m.state === 'done' && m.winner !== 1 ? ' lose' : ''}">${esc(D.pairName(m.pairs[1]))}</span>` : `<span class="s">${esc(m.tbd || 'Пара ещё не известна')}</span>`;
    return `<div class="plist-item${I.cls ? ' ' + I.cls : ''}" data-id="${esc(m.id)}" data-stage="${m.stage}" data-state="${m.state}" data-srf="${c.surface}"${I.cls ? ' data-issue' : ''}>
      <button type="button" class="pl-open" aria-label="${esc(labelOf(m))}"><span class="ct">${esc(courtName(m.court))}<span class="when num">${esc(r.round ? r.b : rowWords(r))}</span></span>${who}<span class="s"><i class="stc" data-stage="${m.stage}" aria-hidden="true"></i>${esc(stageWord(m))} · ${esc(L.st)}</span></button>${I.html}</div>`;
  };
  const phoneHtml = () => {
    const list = placed().slice().sort((a, b) => start(a) - start(b) || a.court.localeCompare(b.court));
    const items = list.map((m) => ({ t: start(m), h: phoneItem(m) }));
    S.breaks.forEach((b) => items.push({ t: b.from - 0.5, h: `<div class="plist-break">${icon(b.kind === 'court' ? 'lock' : b.kind === 'open' ? 'star' : 'pause')}<span>${esc(breakText(b))}</span></div>` }));
    items.sort((a, b) => a.t - b.t);
    let h = '<div class="plist">'; let nowPut = false;
    items.forEach((x) => {
      if (S.now && !nowPut && x.t > S.now.min) { h += `<div class="plist-now" id="plan-now"><span class="now-tag">${esc(S.now.label)}</span></div>`; nowPut = true; }
      h += x.h;
    });
    if (S.now && !nowPut) h += `<div class="plist-now" id="plan-now"><span class="now-tag">${esc(S.now.label)}</span></div>`;
    h += '</div>';
    if (S.now) h += `<button class="btn quiet to-now" type="button" data-tonow>${icon('clock')}К текущему</button>`;
    return h;
  };
  // сыгранный день без кортов (туры групп): матчи плашками, как в приложении
  const doneListHtml = () => `<div class="plan-sum">${icon('check')}<span>Все ${S.matches.length} ${plural(S.matches.length, 'матч', 'матча', 'матчей')} дня сыграны</span>${S.matches[0] && S.matches[0].tour ? `<span class="s">Группы, ${esc(S.matches[0].tour)}</span>` : ''}</div><div class="plan-done">${S.matches.map((m) => vsHtml(m.id)).join('')}</div>`;
  // ---------- отрисовка ----------
  const draw = () => {
    if (!root.isConnected && root.dataset.drawn) return;
    root.dataset.drawn = '1';
    const phoneView = isPhone();
    const head = `<div class="plan-head">${headHtml()}</div>`;
    if (S.empty && !placed().length && !S.manual) {
      const m0 = S.matches[0];
      root.innerHTML = `<div class="plan">${head}<div class="plan-empty"><p>В ${esc(WD_ACC[dow(S.day)])}, ${dayNo(S.day)}${NB}${MON_GEN[monIdx(S.day)]} ещё нет матчей. Сайт разложит ${S.matches.length}${NB}${plural(S.matches.length, 'матч', 'матча', 'матчей')} ${m0 && m0.tour ? m0.tour.replace('-й тур', '-го тура') : ''} по ${S.courts.length}${NB}кортам, потом вы поправите</p><div class="btns"><button class="btn main" type="button" data-layout>${icon('month')}Разложить матчи</button><button class="btn text" type="button" data-manual>Расставлю сам</button></div></div></div>`;
      return;
    }
    if (isDone() && !placed().length) {
      root.innerHTML = `<div class="plan">${head}${doneListHtml()}</div>`;
      requestAnimationFrame(() => fitText(root));
      return;
    }
    const rest = S.matches.some((m) => !m.court || !m.row);
    const tools = isDone() ? '' : `<div class="line">${S.now ? `<button class="btn quiet" type="button" data-tonow>${icon('clock')}Сейчас</button>` : ''}<button class="btn text" type="button" data-addbreak>${icon('pause')}Добавить перерыв</button></div>`;
    root.innerHTML = `<div class="plan">${head}
      ${phoneView ? phoneHtml() + (isDone() ? '' : `<div class="line">${'<button class="btn text" type="button" data-addbreak>' + icon('pause') + 'Добавить перерыв</button>'}</div>`) : `<div class="plan-body${rest ? '' : ' flat'}">${rest ? stackHtml() : ''}<div class="stack">${rest ? '' : stackHtml()}${gridHtml()}${legend}${tools}</div></div>`}</div>`;
    if (!phoneView) {
      // сначала подогнать фамилии (высота строк меняется), потом ставить линию «сейчас»
      fitText(root); placeNow();
      requestAnimationFrame(() => { fitText(root); placeNow(); moreHint(); });
      const wrap = $('.pgrid-wrap', root); const grid = $('.pgrid', root);
      if (wrap) wrap.addEventListener('scroll', moreHint, { passive: true });
      if (gridRO) gridRO.disconnect();
      if (grid) { gridRO = new ResizeObserver(() => { placeNow(); moreHint(); }); gridRO.observe(grid); }
      if (!isDone()) $$('.mcard', root).forEach((c) => {
        const m = S.matches.find((x) => x.id === c.dataset.id);
        if (m && m.state === 'soon') wireDrag(c, m);
      });
    } else {
      requestAnimationFrame(() => fitText(root));
    }
    // на телефоне плитка сегодняшнего дня всегда видна
    const tiles = $('.plan-days', root); const curT = tiles && $('[aria-current="true"]', tiles);
    if (tiles && curT && tiles.scrollWidth > tiles.clientWidth) tiles.scrollLeft = curT.offsetLeft - (tiles.clientWidth - curT.offsetWidth) / 2;
  };
  // на 1024 часть кортов уходит вправо: над сеткой «Видны корты 1–3 из 5» и кнопки
  // «‹ Корты 1–2», «Корты 4–5 ›» — над сеткой, а не поверх столбца
  const courtNo = (c) => courtName(c).replace(/^Корт\s*/i, '');
  const moreHint = () => {
    const wrap = $('.pgrid-wrap', root); const nav = $('.pg-nav', root); if (!wrap || !nav) return;
    const heads = $$('.pg-court', wrap);
    const time = $('.pg-corner', wrap); const tw = time ? time.offsetWidth : 0;
    const seen = heads.filter((x) => x.offsetLeft >= wrap.scrollLeft + tw - 4 && x.offsetLeft + x.offsetWidth <= wrap.scrollLeft + wrap.clientWidth + 4);
    const right = heads.filter((x) => x.offsetLeft + x.offsetWidth > wrap.scrollLeft + wrap.clientWidth + 4);
    const left = heads.filter((x) => x.offsetLeft < wrap.scrollLeft + tw - 4);
    nav.hidden = !right.length && !left.length;
    if (nav.hidden) return;
    const nums = (list) => list.map((x) => courtNo(x.dataset.court));
    const say = (list) => { const n = nums(list); return n.length > 1 ? `Корты ${n[0]}–${n[n.length - 1]}` : `Корт ${n[0]}`; };
    const sn = nums(seen);
    $('.pg-seen', nav).textContent = sn.length ? `Видны ${sn.length > 1 ? `корты ${sn[0]}–${sn[sn.length - 1]}` : `корт ${sn[0]}`} из ${heads.length}` : '';
    const r = $('[data-more="1"]', nav); const l = $('[data-more="-1"]', nav);
    r.hidden = !right.length; if (right.length) r.innerHTML = `${say(right)}${icon('chev')}`;
    l.hidden = !left.length; if (left.length) l.innerHTML = `${icon('back')}${say(left)}`;
  };
  const placeNow = () => {
    if (!S.now || isPhone()) return;
    const grid = $('.pgrid', root); if (!grid) return;
    let line = $('.pg-now', grid); let tag = $('.pg-nowtag', grid);
    const idx = S.rows.findIndex((r, i) => r.min <= S.now.min && (!S.rows[i + 1] || S.rows[i + 1].min > S.now.min));
    if (idx < 0) { if (line) line.remove(); if (tag) tag.remove(); return; }
    const r = S.rows[idx]; const nx = S.rows[idx + 1];
    const cell = $(`.pg-time[data-row="${CSS.escape(r.key)}"]`, grid);
    const frac = nx ? (S.now.min - r.min) / (nx.min - r.min) : 0.5;
    if (!line) { line = el('<div class="pg-now" id="plan-now" aria-hidden="true"></div>'); grid.append(line); }
    if (!tag) { tag = el(`<div class="pg-nowtag"><span class="now-tag" role="img" aria-label="Сейчас ${esc(S.now.label)}">${esc(S.now.label)}</span></div>`); grid.append(tag); }
    const y = `${cell.offsetTop + frac * cell.offsetHeight}px`;
    line.style.top = y; tag.style.top = y;
    nowTagAside(grid, tag);
  };
  // ---------- действия ----------
  const commit = (m, court, row, { via } = {}) => {
    const before = { court: m.court, row: m.row };
    m.court = court; m.row = row;
    if (!isLive()) S.dirty = true;
    if (via === 'sheet') closeLayer(true);
    draw();
    const c = $(`[data-id="${CSS.escape(m.id)}"]`, root); if (c) c.classList.add('just');
    const what = `«${m.title}»${m.tour ? ' ' + m.tour : ''} — ${lowCourt(court)}, ${placeWords(rowOf(row))}`;
    toast(`${isLive() ? 'Перенесено и показано игрокам' : before.court ? 'Перенесено' : 'Поставлено'}: ${what}`, { undo: () => { m.court = before.court; m.row = before.row; draw(); } });
    if (o.onChange) o.onChange(S);
  };
  // перетаскивание: новое время видно на карточке, новое место обведено, конфликт — красным
  const wireDrag = (card, m) => {
    drag(card, {
      ghost: () => { const g = card.cloneNode(true); g.classList.add('lifted'); g.classList.remove('issue-bad', 'issue-warn'); $$('.mc-issue, .mc-kept', g).forEach((x) => x.remove()); return g; },
      over: (x, y, ghost) => {
        $$('.pg-cell.target', root).forEach((t) => t.classList.remove('target', 'bad', 'warn'));
        const cell = document.elementFromPoint(x, y)?.closest('.pg-cell[data-court]');
        const w = $('.mc-where', ghost);
        if (!cell) { w.textContent = ''; ghost.classList.remove('bad'); return null; }
        const r = rowOf(cell.dataset.row);
        if (pastRow(r)) { w.textContent = `в ${rowWords(r)} — уже прошло`; ghost.classList.add('bad'); return null; }
        const was = { court: m.court, row: m.row }; m.court = cell.dataset.court; m.row = cell.dataset.row;
        const iss = issues(m); m.court = was.court; m.row = was.row;
        const bad = iss.some((i) => i.bad); const warn = !bad && iss.some((i) => i.warn);
        cell.classList.add('target'); if (bad) cell.classList.add('bad'); if (warn) cell.classList.add('warn');
        ghost.classList.toggle('bad', bad);
        w.textContent = `в ${rowWords(r)} · ${lowCourt(cell.dataset.court)}${iss[0] ? ' — ' + (iss[0].lc ? low1(iss[0].t) : iss[0].t) : ''}`;
        return cell;
      },
      drop: (cell) => {
        cell.classList.remove('target', 'bad', 'warn');
        if (cell.dataset.court === m.court && cell.dataset.row === m.row) return;
        // в идущий день игроки увидят перенос сразу — сначала «Проверьте», как у пути кнопками
        if (isLive()) stepSum(m, cell.dataset.court, cell.dataset.row, { fromDrag: true });
        else commit(m, cell.dataset.court, cell.dataset.row);
      },
      cancel: () => $$('.pg-cell.target', root).forEach((t) => t.classList.remove('target', 'bad', 'warn')),
    });
  };
  // без перетаскивания: «Матч» → «Перенести» → корт → время → «Проверьте»
  const openMatch = (m) => {
    const r = rowOf(m.row);
    const where = m.court && r ? `${D.courtFull(m.court)} · ${r.round ? r.b + (r.s ? ', ' + r.s : '') : 'в ' + rowWords(r)}` : 'Ещё не в расписании';
    // плашка показывает место матча из расписания, а не из мира: после переноса — новое
    const vs = m.pairs ? (D.match(m.id) ? vsHtml({ ...D.match(m.id), court: m.court, time: r ? (r.round ? r.b : rowWords(r)) : '', day: D.TODAY.dayMonth }) : `<div class="vs"><span class="vs-side"><span class="nm">${esc(D.pairName(m.pairs[0]))}</span></span><span class="vs-side"><span class="nm">${esc(D.pairName(m.pairs[1]))}</span></span></div>`) : `<div class="note">${icon('info')}<span>${esc(m.tbd)}</span></div>`;
    const canMove = m.state === 'soon' && !isDone();
    const s = openSheet({
      title: stageWord(m),
      body: `${vs}<p class="lead"><b>${esc(where)}</b></p>${m.state === 'live' ? '<p class="muted">Матч идёт — перенести нельзя.</p>' : ''}${m.state === 'done' ? '<p class="muted">Матч сыгран.</p>' : ''}`,
      foot: `${canMove ? `<button class="btn main${isPhone() ? ' big' : ''}" type="button" data-move>${icon('move')}${m.court ? 'Перенести' : 'Поставить в расписание'}</button>` : ''}${m.court && canMove && !isLive() ? '<button class="btn quiet" type="button" data-unplace>Убрать из расписания</button>' : ''}<button class="btn quiet" type="button" data-back>Назад</button>`,
    });
    const mv = s.querySelector('[data-move]'); if (mv) mv.addEventListener('click', () => stepCourt(m));
    const un = s.querySelector('[data-unplace]'); if (un) un.addEventListener('click', () => { const b = { court: m.court, row: m.row }; m.court = null; m.row = null; S.dirty = true; closeLayer(true); draw(); toast(`«${m.title}» убран из расписания`, { undo: () => { m.court = b.court; m.row = b.row; draw(); } }); });
    s.querySelector('[data-back]').addEventListener('click', () => closeLayer());
  };
  // что занимает корт в эту строку — словами
  const busyText = (c, rowKey, m) => {
    const r = rowOf(rowKey); const ri = rowIndex(rowKey);
    const x = placed().find((y) => y !== m && y.court === c && y.row === rowKey);
    if (x) return matchName(x.title);
    const b = S.breaks.find((y) => (!y.court || y.court === c) && y.from < rowEnd(ri) && y.to > r.min);
    if (b) return b.kind === 'court' ? `корт закрыт ${breakWhen(b)}` : low1(breakText(b));
    const lv = placed().find((y) => y.court === c && y.state === 'live' && y.ends && toMin(y.ends) > r.min && start(y) < r.min);
    if (lv) return `до ${lv.ends} идёт ${matchName(lv.title)}`;
    return '';
  };
  const choiceMsg = (s, t) => { const p = s.querySelector('.pick-msg'); if (p) { p.textContent = t; p.hidden = !t; } };
  const stepCourt = (m) => {
    const rk = m.row || (S.rows.find((r) => !pastRow(r)) || S.rows[0] || {}).key;
    const s = openSheet({
      title: 'На какой корт?',
      body: `<p class="muted">${esc(stageWord(m))}${m.court ? ' · сейчас ' + esc(lowCourt(m.court)) : ''}</p><p class="pick-msg" role="alert" hidden></p><div class="mv-courts" role="radiogroup" aria-label="Корт">${S.courts.map((c) => { const busy = rk ? busyText(c, rk, m) : ''; const here = c === m.court; return `<button type="button" class="choice" role="radio" aria-checked="${here}" data-c="${c}" data-value="${c}"><span class="t">${esc(courtName(c))}${D.COURTS[c].note ? ' · ' + esc(D.COURTS[c].note) : ''}</span><span class="s">${esc(D.SURFACES[D.COURTS[c].surface].label)}${here ? ' · матч стоит здесь — можно сменить только время' : busy ? ` · в ${esc(rowOf(rk).b)} — ${esc(busy)}` : rk ? ` · свободен в ${esc(rowOf(rk).b)}` : ''}</span><span class="dot"></span></button>`; }).join('')}</div>`,
      // тот же корт выбран заранее: перенос только по времени — два нажатия
      foot: `<button class="btn main" type="button" data-next>Дальше${icon('arrow')}</button><button class="btn quiet" type="button" data-back>Назад</button>`,
    });
    let pick = m.court || null;
    s.querySelector('.mv-courts').addEventListener('change', (e) => { pick = e.detail; choiceMsg(s, ''); e.stopPropagation(); });
    s.querySelector('[data-next]').addEventListener('click', () => { if (pick) stepTime(m, pick); else choiceMsg(s, 'Выберите корт — нажмите на него'); });
    s.querySelector('[data-back]').addEventListener('click', () => openMatch(m));
  };
  const stepTime = (m, c) => {
    const s = openSheet({
      title: 'Во сколько?',
      body: `<p class="muted">${esc(courtName(c))}</p><div class="mv-times">${S.rows.map((r) => { const here = c === m.court && r.key === m.row; const b = here ? '' : busyText(c, r.key, m); const past = pastRow(r); return b || past || here ? `<span class="slot busy"><span class="num">${esc(r.b)}</span>${esc(here ? 'матч стоит здесь' : past ? 'уже прошло' : b)}</span>` : `<button type="button" class="slot free" data-r="${esc(r.key)}"><span class="num">${esc(r.b)}</span>${r.s ? `<span class="small">${esc(r.s)}</span>` : ''}</button>`; }).join('')}</div>`,
      foot: '<button class="btn quiet" type="button" data-back>Назад</button>',
    });
    s.querySelector('.mv-times').addEventListener('click', (e) => { const b = e.target.closest('.slot.free'); if (b) stepSum(m, c, b.dataset.r); });
    s.querySelector('[data-back]').addEventListener('click', () => stepCourt(m));
  };
  const stepSum = (m, c, rk, { fromDrag } = {}) => {
    const was = { court: m.court, row: m.row }; m.court = c; m.row = rk;
    const iss = issues(m); m.court = was.court; m.row = was.row;
    const r = rowOf(rk);
    const t = `${m.court ? 'Перенести' : 'Поставить'} «${m.title}»${m.tour ? ' ' + m.tour : ''} на ${lowCourt(c)}, ${placeWords(r)}?${isLive() ? ' Игроки увидят сразу' : ''}`;
    const s = openSheet({
      title: 'Проверьте',
      body: `<p class="mv-sum">${esc(t)}</p>${iss.map((x) => `<div class="note ${x.bad ? 'bad' : 'warn'}">${icon(x.bad ? 'alert' : 'warn')}<span>${esc(x.t)}</span></div>`).join('')}`,
      foot: `<button class="btn main${isPhone() ? ' big' : ''}" type="button" data-go>${isLive() ? 'Перенести и показать игрокам' : m.court ? 'Перенести' : 'Поставить'}</button><button class="btn quiet" type="button" data-back>${fromDrag ? 'Отмена' : 'Назад'}</button>`,
    });
    s.querySelector('[data-go]').addEventListener('click', () => commit(m, c, rk, { via: 'sheet' }));
    s.querySelector('[data-back]').addEventListener('click', () => (fromDrag ? closeLayer() : stepTime(m, c)));
  };
  // нажатие на свободную клетку: что поставить или перенести сюда
  const stepSlot = (c, rk) => {
    const list = movable(c, rk);
    const r = rowOf(rk);
    const s = openSheet({
      title: 'Что поставить сюда?',
      body: `<p class="muted">${esc(courtName(c))} · ${esc(placeWords(r))}</p><div class="stack tight">${list.map((m) => `<button type="button" class="choice" data-id="${esc(m.id)}"><span class="t">${esc(stageWord(m))}</span><span class="s">${m.court ? `сейчас ${esc(lowCourt(m.court))}, ${esc(rowWords(rowOf(m.row)))}` : 'ещё не в расписании'}${m.pairs ? ' · ' + esc(D.pairName(m.pairs[0]) + ' — ' + D.pairName(m.pairs[1])) : ''}</span></button>`).join('')}</div>`,
      foot: '<button class="btn quiet" type="button" data-back>Назад</button>',
    });
    s.addEventListener('click', (ev) => { const b = ev.target.closest('.choice[data-id]'); if (b) stepSum(S.matches.find((x) => x.id === b.dataset.id), c, rk, { fromDrag: true }); });
    s.querySelector('[data-back]').addEventListener('click', () => closeLayer());
  };
  // раскладка пустого дня: по кругам с начала дня, матч — на первый свободный корт
  const roundsRows = () => {
    const per = S.courts.length; const n = Math.ceil(S.matches.length / per);
    const t0 = toMin(S.start || '08:45'); const dur = S.round || 50;
    return Array.from({ length: n }, (_, i) => ({ key: `r${i + 1}`, b: `${i + 1} круг`, s: i === 0 ? hhmm(t0) : `около ${hhmm(t0 + i * dur)}`, min: t0 + i * dur, round: true }));
  };
  const layout = () => {
    const per = S.courts.length;
    S.rows = roundsRows();
    S.matches.forEach((m, i) => { m.row = `r${Math.floor(i / per) + 1}`; m.court = S.courts[i % per]; });
    S.dirty = true; draw();
    toast(`Разложено: ${S.matches.length} ${plural(S.matches.length, 'матч', 'матча', 'матчей')} на ${S.rows.length} ${plural(S.rows.length, 'круг', 'круга', 'кругов')}. Это черновик — поправьте как нужно`, { undo: () => { S.matches.forEach((m) => { m.row = null; m.court = null; }); S.rows = []; draw(); } });
  };
  // публикация дня: кто увидит, два маленьких предпросмотра, что изменится, оставшиеся вопросы
  const publish = () => {
    const iss = allIssues();
    const was = snapshot ? JSON.parse(snapshot) : [];
    const changes = snapshot ? S.matches.map((m) => { const w = was.find((x) => x.id === m.id); if (!w || (w.court === m.court && w.row === m.row)) return null; return `«${m.title}» — ${w.court ? lowCourt(w.court) + ', ' + (rowOf(w.row)?.b || '') : 'не стоял'} → ${m.court ? lowCourt(m.court) + ', ' + (rowOf(m.row)?.b || '') : 'убран из дня'}`; }).filter(Boolean) : [];
    const byTime = placed().slice().sort((a, b) => start(a) - start(b) || a.court.localeCompare(b.court));
    const first = byTime.find((m) => m.pairs && m.state === 'soon') || byTime.find((m) => m.state === 'soon') || byTime[0];
    const fr = rowOf(first.row);
    const dlg = el(`<section class="dialog glass wide">
      <h2 class="h2">Расписание на ${esc(WD_ACC[dow(S.day)])}, ${dayNo(S.day)}${NB}${MON_GEN[monIdx(S.day)]} увидят:</h2>
      <ul class="where"><li>${icon('phone')}<span><b>игроки</b> — в приложении: «Сегодня» → «Ваш матч» и «Турнир» → «Расписание»</span></li><li>${icon('site')}<span><b>сайт</b> — страница «${esc(S.cupName || '')}» → «Расписание»</span></li><li>${icon('board')}<span><b>табло в клубе</b> — «Все корты»</span></li></ul>
      <div class="pub-pv">
        <figure><figcaption class="pv-cap">${icon('phone')}Так увидит игрок</figcaption><div class="card pad pub-card"><span class="sublabel">Ваш матч</span><b class="h3">${esc(first.title)} · ${esc(courtName(first.court))}</b><span class="num l">${esc(timeWords(fr))}</span>${first.pairs ? `<span class="muted">${esc(D.pairName(first.pairs[0]))} — ${esc(D.pairName(first.pairs[1]))}</span>` : `<span class="muted">${esc(first.tbd || '')}</span>`}</div></figure>
        <figure><figcaption class="pv-cap">${icon('site')}Так будет на сайте</figcaption><div class="browser"><div class="bar-top"><i></i><i></i><i></i><span>Сайт лиги · Расписание</span></div><div class="page">${placed().slice().sort((a, b) => start(a) - start(b) || a.court.localeCompare(b.court)).slice(0, 3).map((m) => `<div class="site-row"><span class="d">${esc(rowOf(m.row).round ? rowOf(m.row).b : rowWords(rowOf(m.row)))}</span><span class="t">${esc(courtName(m.court))} · ${esc(m.title)}</span><span class="s">${m.pairs ? esc(D.pairName(m.pairs[0]) + ' — ' + D.pairName(m.pairs[1])) : esc(m.tbd || '')}</span></div>`).join('')}</div></div></figure>
      </div>
      ${changes.length ? `<div class="stack tight"><h3 class="h3">Что изменится для игроков</h3><ul class="where">${changes.map((c) => `<li>${icon('arrow')}<span>${esc(c)}</span></li>`).join('')}</ul></div>` : ''}
      ${iss.length ? `<div class="errsum warn"><span class="h3">${icon('warn')}Осталось ${iss.length} ${plural(iss.length, 'вопрос', 'вопроса', 'вопросов')}</span><ul>${iss.map((x) => `<li>${esc(x.t)}</li>`).join('')}</ul></div>` : ''}
      <div class="btns"><button class="btn main" type="button" data-ok>${icon('eye')}${S.published ? 'Опубликовать правки' : 'Опубликовать день'}</button><button class="btn quiet" type="button" data-no>Отмена</button></div></section>`);
    dlg.querySelector('[data-ok]').addEventListener('click', () => { closeLayer(true); S.published = `в ${D.NOW.time}`; S.dirty = false; snapshot = JSON.stringify(S.matches); draw(); toast(`Расписание на ${WD_ACC[dow(S.day)]} опубликовано — игроки его видят`); if (o.onChange) o.onChange(S); });
    dlg.querySelector('[data-no]').addEventListener('click', () => closeLayer());
    openLayer(dlg, { label: 'Опубликовать день' });
  };
  // «Добавить перерыв» → что это → с и до → какие корты закрыты
  const addBreak = () => {
    const s = openSheet({ title: 'Что это?', body: `<p class="pick-msg" role="alert" hidden></p>${choicesHtml('Что это', Object.entries(BREAK_KINDS).map(([v, t]) => ({ value: v, t })), 'one')}`, foot: `<button class="btn main" type="button" data-next>Дальше${icon('arrow')}</button><button class="btn quiet" type="button" data-no>Отмена</button>` });
    let kind = null;
    s.addEventListener('change', (e) => { if (e.detail) { kind = e.detail; choiceMsg(s, ''); } });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
    s.querySelector('[data-next]').addEventListener('click', () => (kind ? stepWhen(kind) : choiceMsg(s, 'Выберите, что это: перерыв, закрытый корт или открытие')));
  };
  const stepWhen = (kind) => {
    const next = S.rows.find((r) => !pastRow(r)) || S.rows[0];
    const f0 = next ? next.min : toMin(S.start || '08:45');
    const timeField = (k, label, v) => `<div class="field" data-f="${k}"><label class="label" for="brk-${k}">${label}</label><span class="err">${icon('alert')}<span></span></span><input class="input num" id="brk-${k}" inputmode="numeric" value="${hhmm(v)}" style="max-width:200px"><span class="hint">например: 13:00 или 1300</span></div>`;
    const s = openSheet({
      title: 'Когда?',
      body: `<p class="muted">${esc(BREAK_KINDS[kind])}</p><div class="line" style="align-items:flex-start;gap:20px">${timeField('from', 'С', f0)}${timeField('to', 'До', f0 + 30)}</div>`,
      foot: `<button class="btn main" type="button" data-ok>${kind === 'court' ? `Дальше${icon('arrow')}` : 'Добавить перерыв'}</button><button class="btn quiet" type="button" data-back>Назад</button>`,
    });
    const read = (k) => {
      const f = s.querySelector(`[data-f="${k}"]`); const v = $('input', f).value; const t = parseTime(v);
      f.classList.toggle('error', !t); if (!t) $('.err span', f).textContent = `Не понял время «${v}». Например: 13:00`;
      return t ? toMin(t) : null;
    };
    s.querySelector('[data-ok]').addEventListener('click', () => {
      const a = read('from'); const b = read('to');
      if (a === null || b === null) return;
      if (b <= a) { const f = s.querySelector('[data-f="to"]'); f.classList.add('error'); $('.err span', f).textContent = `Конец раньше начала. Например: с ${hhmm(a)} до ${hhmm(a + 30)}`; return; }
      if (kind === 'court') stepShut(a, b); else add([{ kind, from: a, to: b }]);
    });
    s.querySelector('[data-back]').addEventListener('click', addBreak);
  };
  const stepShut = (a, b) => {
    const s = openSheet({
      title: 'Какие корты закрыты?',
      body: `<p class="muted">${hhmm(a)}–${hhmm(b)}</p><p class="pick-msg" role="alert" hidden></p><div class="checks">${S.courts.map((c) => `<label class="check"><input type="checkbox" data-c="${c}"><span class="box">${icon('check')}</span><span class="srf" style="background:linear-gradient(160deg,var(--srf),var(--srf-2))" data-srf="${D.COURTS[c].surface}"></span><span>${esc(D.courtFull(c))}</span></label>`).join('')}</div>`,
      foot: '<button class="btn main" type="button" data-ok>Добавить перерыв</button><button class="btn quiet" type="button" data-back>Назад</button>',
    });
    s.querySelector('[data-ok]').addEventListener('click', () => {
      const cs = $$('input[data-c]:checked', s).map((x) => x.dataset.c);
      if (!cs.length) { choiceMsg(s, 'Отметьте хотя бы один корт'); return; }
      add(cs.map((c) => ({ kind: 'court', court: c, from: a, to: b })));
    });
    s.querySelector('[data-back]').addEventListener('click', () => stepWhen('court'));
  };
  const add = (list) => {
    const nb = list.map(normBreak);
    S.breaks.push(...nb);
    if (!isLive()) S.dirty = true;
    closeLayer(true); draw();
    toast(`${isLive() ? 'Добавлено и показано игрокам' : 'Добавлено'}: ${nb.map(breakText).join('; ')}`, { undo: () => { S.breaks = S.breaks.filter((x) => !nb.includes(x)); draw(); } });
    if (o.onChange) o.onChange(S);
  };
  root.addEventListener('click', (e) => {
    const keep = e.target.closest('[data-keep]');
    if (keep) { const id = keep.closest('[data-id]').dataset.id; const k = `${id}|${keep.dataset.keep}`; S.kept.add(k); draw(); toast('Оставлено так', { undo: () => { S.kept.delete(k); draw(); } }); return; }
    const dayB = e.target.closest('[data-day]');
    if (dayB) { if (o.onDay && dayB.dataset.day !== S.day) o.onDay(dayB.dataset.day); return; }
    const open = e.target.closest('.mc-open, .pl-open');
    if (open) { const m = S.matches.find((x) => x.id === open.closest('[data-id]').dataset.id); if (m) openMatch(m); return; }
    if (e.target.closest('[data-publish]')) { publish(); return; }
    if (e.target.closest('[data-revert]')) { const before = JSON.stringify(S.matches); S.matches = JSON.parse(snapshot); S.dirty = false; draw(); toast('Вернули опубликованное: черновые правки убраны', { undo: () => { S.matches = JSON.parse(before); S.dirty = true; draw(); } }); return; }
    if (e.target.closest('[data-layout]')) { layout(); return; }
    if (e.target.closest('[data-manual]')) { S.rows = roundsRows(); S.manual = true; draw(); return; }
    if (e.target.closest('[data-tonow]')) { const n = $('#plan-now', root); if (n) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (e.target.closest('[data-issues]')) { const c = $('[data-issue]', root); if (c) { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); $('.mc-open, .pl-open', c).focus({ preventScroll: true }); } return; }
    if (e.target.closest('[data-addbreak]')) { addBreak(); return; }
    const more = e.target.closest('[data-more]');
    if (more) { const w = $('.pgrid-wrap', root); const col = $('.pg-court', root); if (w && col) w.scrollBy({ left: +more.dataset.more * col.offsetWidth * 2, behavior: 'smooth' }); return; }
    const slot = e.target.closest('[data-slot]');
    if (slot) { const cell = slot.closest('.pg-cell'); stepSlot(cell.dataset.court, cell.dataset.row); }
  });
  draw();
  let wasPhone = isPhone();
  addEventListener('resize', () => { if (!root.isConnected) return; if (isPhone() !== wasPhone) { wasPhone = isPhone(); draw(); } else { placeNow(); moreHint(); } });
  // «Текст крупнее» и тема — перерисовать, чтобы фамилии заново подогнались
  document.addEventListener('adm:view', () => { if (root.isConnected) draw(); });
  return { get state() { return S; }, draw, load(p) { init(p); draw(); } };
}

// ============================================================
// ЗАПУСК
// ============================================================
applyView();
mountFrame();
hydrate();
document.fonts?.ready.then(() => fitText());
afterReset();
// ссылка «…#my-view» открывает «Мой вид» сразу
if (location.hash === '#my-view') setTimeout(() => openMyView(), 60);
