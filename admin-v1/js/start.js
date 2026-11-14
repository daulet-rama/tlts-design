// ============================================================
// «Сегодня», «Календарь сезона», «Новый турнир» — общее для трёх страниц.
// Мир — из admin.js (D): сезон, этапы, черновик «Августовского кубка», корты.
// Что человек сделал с турнирами (черновик, публикация, перенос, удаление), лежит
// в общем состоянии раздела: cups.<турнир>. Его видят календарь, «Сегодня», журнал
// и другие вкладки.
// Одно состояние на всё: что заполнено в турнире, считает stepState — по нему
// строятся и проверка, и список задач черновика, и дело на «Сегодня».
// ============================================================
import { D, state, esc, icon, plural, addDays, daysBetween, rangeShort, dayWords, cap1, MON_GEN, toDate, toMin, hhmm, dow, WD, DAY_END } from '../admin.js';

// ---------- мелочи ----------
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NB = '\u00a0'; // неразрывный пробел: «корт 2», «16 пар» не рвутся строкой
const WJ = '⁠'; // «1–5» не рвётся строкой на тире
const TODAY = D.NOW.iso;
export const COURT_IDS = Object.keys(D.COURTS);
export const PREV = D.stage('jul-4');                 // у него одного в мире есть сроки записи и жеребьёвки
export const surfaceOf = (courtId) => (courtId ? D.COURTS[courtId].surface : null);
export const surfaceWord = (courtId) => (courtId ? D.SURFACES[surfaceOf(courtId)].label : '');
// «Корт 4» → «корт 4»
export const courtLow = (c) => D.COURTS[c].name.toLowerCase();
// «корты 1–5», «корты 1, 3, 4», «корт 2»
export function courtsWords(ids) {
  if (!ids || !ids.length) return '';
  // корт без номера в названии («Корт Арена») — своим названием: «корты 2–5 и корт Арена»
  const named = ids.filter((c) => !/\d/.test(D.COURTS[c].name));
  if (named.length) {
    const low = (c) => { const x = D.COURTS[c].name; return x.charAt(0).toLowerCase() + x.slice(1); };
    const rest = ids.filter((c) => !named.includes(c));
    return [rest.length ? courtsWords(rest) : '', ...named.map(low)].filter(Boolean).join(' и ');
  }
  const n = ids.map((c) => +D.COURTS[c].name.replace(/\D/g, '')).sort((a, b) => a - b);
  if (n.length === 1) return `корт${NB}${n[0]}`;
  const run = n.every((x, i) => i === 0 || x === n[i - 1] + 1);
  return `корты${NB}${run ? `${n[0]}${WJ}–${WJ}${n[n.length - 1]}` : n.join(', ')}`;
}
// «корты 1–5» из мира — тоже без переноса посередине
const tightCourts = (t) => (t ? t.replace(/ (\d)/g, `${NB}$1`).replace(/(\d)–(\d)/g, `$1${WJ}–${WJ}$2`) : t);
// Покрытия кортов словами: «Корты 1 и 3 — грунт, 2 и 5 — хард, 4 — трава».
// Корт без номера в названии («Корт Арена») пишется своим названием.
const courtNo = (c) => { const n = D.COURTS[c].name.replace(/\D/g, ''); return n || D.COURTS[c].name; };
const andWords = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} и ${a[a.length - 1]}`);
export function surfacesWords(ids) {
  if (!ids || !ids.length) return '';
  const order = [];
  const by = {};
  ids.forEach((c) => { const s = surfaceOf(c); if (!by[s]) { by[s] = []; order.push(s); } by[s].push(courtNo(c)); });
  const parts = order.map((s) => `${andWords(by[s])}${NB}— ${D.SURFACES[s].label}`);
  const one = ids.length === 1;
  return `${one ? 'Корт' : 'Корты'}${NB}${parts.join(', ')}`;
}
// «Корты 1 и 3 — грунт, 2 и 5 — хард, 4 — трава · финал — корт 1, грунт»
export const courtsLine = (ids, final) => (ids && ids.length ? `${surfacesWords(ids)}${final ? ` · финал — ${courtLow(final)}, ${surfaceWord(final)}` : ''}` : '');
// «на грунте», «на харде», «на траве»
export const ON_SURFACE = { clay: 'на грунте', hard: 'на харде', grass: 'на траве' };
// «Июльский кубок» → «в Июльском кубке»
export const prep = (name) => name.replace(/ий кубок$/i, 'ом кубке').replace(/^Кубок /, 'Кубке ');

// ---------- шаблоны «Как …» ----------
// Опубликованные этапы, по одному на покрытие (покрытие этапа — корт его финала).
// Корты — все пять, как во всех этапах мира; сроки записи известны только у «Июльского кубка».
export const TEMPLATES = (() => {
  const seen = new Set();
  return D.STAGES.filter((s) => s.state !== 'draft').slice().reverse().map((s) => {
    const t = D.tournament(s.id) || {};
    return { id: s.id, name: s.name, court: t.court, surface: t.surface || s.surface, play: s.play, signupTo: s.signupTo || null, draw: s.draw || null, from: s.from };
  }).filter((t) => t.court && !seen.has(t.surface) && seen.add(t.surface));
})();
export const tplOf = (cup) => TEMPLATES.find((t) => t.id === (cup && cup.base)) || null;
// смещение от первого дня «Июльского кубка»: запись до −5 дней, жеребьёвка −3
export const SIGNUP_BEFORE = daysBetween(PREV.signupTo, PREV.from);
export const DRAW_BEFORE = daysBetween(PREV.draw, PREV.from);
// игровые дни — как в прошлом этапе: 1-й, 2-й, 3-й и два последних дня; короткий турнир — все дни
export function playPattern(from, to, baseId) {
  if (!from || !to) return [];
  const src = D.stage(baseId) || PREV;
  const n = daysBetween(from, to) + 1;
  const prevN = daysBetween(src.from, src.to) + 1;
  const offs = src.play.map((d) => daysBetween(src.from, d));
  let take;
  if (n === prevN) take = offs;
  else if (n < 5) take = Array.from({ length: n }, (_, i) => i);
  else take = [0, 1, 2, n - 2, n - 1];
  return [...new Set(take)].map((k) => addDays(from, k));
}
// «Сб 7, Вс 8, Пн 9, Пт 13, Сб 14 августа»
export function daysShort(list) {
  if (!list.length) return '';
  const months = [...new Set(list.map((d) => d.slice(0, 7)))];
  return months.map((m) => {
    const ds = list.filter((d) => d.startsWith(m));
    return `${ds.map((d) => `${WD[dow(d)]}${NB}${+d.slice(8)}`).join(', ')} ${MON_GEN[+m.slice(5) - 1]}`;
  }).join('; ');
}
// «Сб, 7 августа — сб, 14 августа · 8 дней» — итог выбора дат в одну строку
export function rangeLine(a, b) {
  const w = (iso) => `${WD[dow(iso)]}, ${+iso.slice(8)}${NB}${MON_GEN[+iso.slice(5, 7) - 1]}`;
  const n = daysBetween(a, b) + 1;
  return a === b ? `${w(a)} · 1${NB}день` : `${w(a)} — ${w(b).toLowerCase()} · ${n}${NB}${plural(n, 'день', 'дня', 'дней')}`;
}

// ---------- турнир, который создают в мастере ----------
// Черновик «Августовского кубка» из мира: готовы название, даты и формат (16 пар, как всегда).
// Игровые дни предложены как в «Июльском кубке» — их надо проверить; корты и запись не заполнены:
// «осталось 2 задачи».
export function draftFromWorld() {
  const s = D.stage('aug-5');
  return {
    id: 'aug-5', base: 'jul-4', name: s.name, kind: 'stage', from: s.from, to: s.to,
    courts: [], finalCourt: null, play: playPattern(s.from, s.to, 'jul-4'), start: D.NEW_CUP.start, round: D.NEW_CUP.round, daySet: null,
    format: 'groups', third: true, places: true,
    signupTo: null, draw: null, fee: '',
    state: 'draft', savedAt: s.savedAt, done: { start: 1, name: 1, dates: 1, format: 1 }, auto: { days: true },
  };
}
// Новый турнир: «Как …» (шаблон) или с чистого листа; номер — свой у каждого, черновики не затирают друг друга.
// Пустой черновик (ни названия, ни дат) никому не виден — его номер берётся снова.
function nextNewId() {
  const list = Object.values(cups());
  const empty = list.find((c) => isNewId(c.id) && c.state === 'draft' && !c.name && !c.from);
  if (empty) return empty.id;
  return `new-${Math.max(0, ...list.filter((c) => isNewId(c.id)).map((c) => +c.id.replace(/\D/g, '') || 0)) + 1}`;
}
export function freshCup(base = TEMPLATES[0].id, from = null) {
  const cup = {
    id: nextNewId(), base, name: '', kind: 'stage', from, to: null,
    courts: [], finalCourt: null, play: [], start: D.NEW_CUP.start, round: D.NEW_CUP.round, daySet: null,
    format: null, third: true, places: true,
    signupTo: null, draw: null, fee: '',
    state: 'draft', savedAt: null, done: {}, auto: {},
  };
  applyTemplate(cup);
  return cup;
}
// Подставить шаблон: всё, что человек ещё не подтвердил сам, берётся из выбранного этапа.
// Подставленное помечено (auto) — на проверке оно стоит значением с пометкой «как в … — проверьте».
// force — шаблон сменили на первом шаге: всё неподтверждённое берётся заново.
// Без force (сменились даты) не трогается то, что человек уже поменял сам (auto === false).
export function applyTemplate(cup, { force = false } = {}) {
  cup.auto = cup.auto || {}; cup.done = cup.done || {};
  const may = (k) => !cup.done[k] && (force || cup.auto[k] !== false);
  const t = tplOf(cup);
  if (!t) {
    // с чистого листа: подставленное из шаблона снимается, вписанное самим — остаётся
    if (may('courts') && cup.auto.courts) { cup.courts = []; cup.finalCourt = null; }
    if (may('format') && cup.auto.format) cup.format = null;
    if (may('signup') && cup.auto.signup) { cup.signupTo = null; cup.draw = null; }
    ['courts', 'format', 'signup'].forEach((k) => { if (!cup.done[k] && cup.auto[k]) cup.auto[k] = null; });
    if (cup.from && cup.to && may('days')) { cup.play = playPattern(cup.from, cup.to); cup.daySet = null; cup.auto.days = true; }
    return;
  }
  if (may('courts')) { cup.courts = COURT_IDS.slice(); cup.finalCourt = t.court; cup.auto.courts = true; }
  if (may('format')) { cup.format = 'groups'; cup.third = true; cup.places = true; cup.auto.format = true; }
  if (cup.from && cup.to && may('days')) { cup.play = playPattern(cup.from, cup.to, t.id); cup.daySet = null; cup.auto.days = true; }
  if (may('signup')) {
    const s = t.signupTo && cup.from ? addDays(cup.from, -SIGNUP_BEFORE) : null;
    if (s && s > TODAY) { cup.signupTo = s; cup.draw = addDays(cup.from, -DRAW_BEFORE); cup.auto.signup = true; } else if (cup.auto.signup || force) { cup.signupTo = null; cup.draw = null; cup.auto.signup = null; }
  }
}

// ---------- матчи этапа по формату и по числу игровых дней ----------
// «Группы, потом плей-офф» — туры групп и плей-офф из мира (D.BLOCKS): 24 матча в группах и 12 в плей-офф.
// Матчи за места можно выключить: «за 3-е место» — 1 матч, «за 5–8 места» — 4 матча
// (два полуфинала за 5–8 места, за 7-е и за 5-е место — так играли «Июньский кубок»).
// «Одна сетка» — как Итоговый турнир: 16 пар сразу в сетку.
// Игровых дней меньше пяти — дни уплотняются: в субботу все туры групп, в воскресенье плей-офф.
// Волна — матчи, которые ждут итогов прошлой: между волнами отдых пар 30 минут, как в расписании дня.
export const REST = 30;
function parts(cup) {
  const third = cup.third !== false; const places = cup.places !== false;
  const w1 = 2 + (places ? 2 : 0); const w2 = 1 + (third ? 1 : 0) + (places ? 2 : 0);
  const fd = { key: 'fd', label: third || places ? 'полуфиналы, финал и матчи за места' : 'полуфиналы и финал', waves: [w1, w2], stage: 'play' };
  if (cup.format === 'bracket') return [{ key: 'r16', label: '1/8 финала', waves: [8], stage: 'play' }, { key: 'qf', label: 'четвертьфиналы', waves: [4], stage: 'play' }, fd];
  return [...D.BLOCKS.filter((b) => b.key !== 'fd').map((b) => ({ key: b.key, label: b.label, waves: [b.n], stage: b.stage })), fd];
}
const join = (list, label) => ({ key: list.map((b) => b.key).join('+'), label, waves: list.flatMap((b) => b.waves), stage: list.some((b) => b.stage === 'group') ? 'group' : 'play', grp: list.filter((b) => b.stage === 'group').reduce((s, b) => s + b.waves.reduce((a, x) => a + x, 0), 0) });
export function dayBlocks(cup, n) {
  const p = parts(cup);
  const lab = (b) => b.label;
  const blocks = (() => {
    if (cup.format === 'bracket') {
      const [r16, qf, fd] = p;
      if (n >= 3) return [r16, qf, fd];
      if (n === 2) return [join([r16, qf], '1/8 финала и четвертьфиналы'), fd];
      return [join([r16, qf, fd], 'вся сетка: от 1/8 до финала')];
    }
    const [t1, t2, t3, qf, fd] = p;
    if (n >= 5) return [t1, t2, t3, qf, fd];
    if (n === 4) return [t1, t2, join([t3, qf], '3-й тур групп и четвертьфиналы'), fd];
    if (n === 3) return [join([t1, t2], '1-й и 2-й туры групп'), join([t3, qf], '3-й тур групп и четвертьфиналы'), fd];
    if (n === 2) return [join([t1, t2, t3], 'все туры групп'), join([qf, fd], `плей-офф: четвертьфиналы, ${lab(fd)}`)];
    return [join([t1, t2, t3, qf, fd], 'весь турнир: группы и плей-офф')];
  })();
  return blocks.map((b) => ({ ...b, n: b.waves.reduce((a, x) => a + x, 0), grp: b.grp ?? (b.stage === 'group' ? b.waves.reduce((a, x) => a + x, 0) : 0) }));
}
// Блоки для playDays основы (у неё блок — один день)
export const blocksFor = (cup) => dayBlocks(cup, (cup.play || []).length || 5).map((b) => ({ key: b.key, label: b.label, n: b.n, stage: b.stage, waves: b.waves }));
export function matchCount(cup) {
  const b = dayBlocks(cup, 5);
  const total = b.reduce((s, x) => s + x.n, 0);
  const grp = b.reduce((s, x) => s + x.grp, 0);
  return { total, grp, play: total - grp };
}
// Настройки игрового дня: свои (поменяли в шаге «Игровые дни») или общие
export const daySetOf = (cup, d) => (cup.daySet && cup.daySet[d]) || { start: cup.start, round: cup.round, courts: cup.courts.length ? cup.courts.slice() : COURT_IDS.slice() };
// Успеваем ли: по дням — что играют, с какого и до какого времени. Та же модель, что у playDays основы:
// круги по числу кортов, между волнами отдых, конец дня не позже 23:00.
export function planDays(cup) {
  const days = (cup.play || []).slice().sort();
  const blocks = dayBlocks(cup, days.length);
  // err — полностью («Суббота, 24 июля: матчи кончатся около 02:15 ночи»), why — для «хотя …»
  const lines = []; let err = null; let why = null; let errDay = null;
  const dayName = (d) => `${WD_FULL_NOM[dow(d)]}, ${+d.slice(8)}${NB}${MON_GEN[+d.slice(5, 7) - 1]}`;
  blocks.forEach((b, i) => {
    const d = days[i];
    if (!d) return;
    const x = daySetOf(cup, d); const c = x.courts.length;
    if (!c) { lines.push({ d, label: b.label, n: b.n, bad: true, none: true }); if (!err) { err = `${cap1(dayName(d))}: не выбран ни один корт`; why = `в ${WD_ACC[dow(d)]} не выбран ни один корт`; errDay = d; } return; }
    let end = toMin(x.start);
    b.waves.forEach((w, k) => { end += Math.ceil(w / c) * x.round + (k < b.waves.length - 1 ? REST : 0); });
    const late = end > DAY_END;
    lines.push({ d, label: b.label, n: b.n, from: x.start, end, late, bad: late });
    if (late && !err) { const t = `матчи кончатся около ${hhmm(end)}${end >= 24 * 60 ? ' ночи' : ''}`; err = `${cap1(dayName(d))}: ${t}`; why = t; errDay = d; }
  });
  days.slice(blocks.length).forEach((d) => lines.push({ d, spare: true }));
  const total = blocks.reduce((s, b) => s + b.n, 0);
  const grp = blocks.reduce((s, b) => s + b.grp, 0);
  if (!days.length) { err = 'Нет ни одного игрового дня'; why = 'нет ни одного игрового дня'; }
  return { ok: !err, err, why, errDay, lines, total, grp, days, short: err || `${total}${NB}${plural(total, 'матч', 'матча', 'матчей')} · успеваем` };
}
const WD_FULL_NOM = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const WD_ACC = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];

// ---------- одно состояние на всё: что заполнено ----------
// st: 'ok' — заполнено; 'auto' — подставлено «как в …», проверьте; 'missing' — не заполнено.
// err — ошибка, с которой можно идти дальше (матчи не успевают): шаг без галочки, на проверке — «Исправить».
export const STEP_KEYS = ['name', 'dates', 'courts', 'days', 'format', 'signup'];
export function stepState(cup, key) {
  const miss = (t) => ({ st: 'missing', t });
  const auto = (k) => !!(cup.auto && cup.auto[k] && !(cup.done && cup.done[k]));
  const fine = (k, extra = {}) => ({ st: auto(k) ? 'auto' : 'ok', ...extra });
  if (key === 'name') {
    if (!cup.name) return miss('Впишите название турнира');
    const twin = seasonStages().find((s) => s.id !== cup.id && s.name.toLowerCase() === cup.name.toLowerCase());
    if (twin) return miss(`Турнир «${twin.name}» уже есть в сезоне. Назовите иначе`);
    return { st: 'ok' };
  }
  if (key === 'dates') return cup.from && cup.to ? { st: 'ok' } : miss(cup.from ? 'Нажмите последний день турнира' : 'Выберите даты');
  if (key === 'courts') {
    if (!cup.courts.length) return miss('Отметьте корты');
    if (!cup.finalCourt || !cup.courts.includes(cup.finalCourt)) return miss('Выберите корт, где играют финал');
    return fine('courts');
  }
  if (key === 'days') {
    if (!cup.from || !cup.to) return miss('Сначала выберите даты');
    if (!cup.play.length) return miss('Отметьте хотя бы один игровой день');
    const p = planDays(cup);
    return fine('days', { err: p.ok ? null : p.err, why: p.ok ? null : p.why });
  }
  if (key === 'format') return cup.format ? fine('format') : miss('Выберите, как играют турнир');
  if (key === 'signup') {
    if (!cup.signupTo) return miss('Впишите, до какого дня запись');
    if (cup.from && cup.signupTo >= cup.from) return miss(`Запись должна закончиться до начала турнира — раньше ${rangeShort(cup.from)}`);
    if (cup.signupTo <= TODAY) return miss(`${rangeShort(cup.signupTo)} уже прошло. Выберите день позже`);
    if (!cup.draw) return miss('Впишите день жеребьёвки');
    if (cup.draw < cup.signupTo) return miss(`Жеребьёвка — после конца записи (${rangeShort(cup.signupTo)})`);
    if (cup.from && cup.draw >= cup.from) return miss(`Жеребьёвка — до начала турнира (${rangeShort(cup.from)})`);
    return fine('signup');
  }
  return { st: 'ok' };
}
// Задачи черновика — те же строки, что на проверке: незаполненное и ошибки
export const TASKS = [
  { key: 'name', t: 'Название и вид', short: 'название' },
  { key: 'dates', t: 'Даты', short: 'даты' },
  { key: 'courts', t: 'Корты', short: 'корты' },
  { key: 'days', t: 'Игровые дни', short: 'игровые дни' },
  { key: 'format', t: 'Формат', short: 'формат' },
  { key: 'signup', t: 'Запись', short: 'запись' },
];
export const tasksLeft = (cup) => TASKS.filter((t) => { const s = stepState(cup, t.key); return s.st === 'missing' || !!s.err; });
// «корты и запись», «корты, формат и запись»
export const andList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} и ${a[a.length - 1]}`);

// ---------- турниры в общем состоянии: cups.<турнир> ----------
// Черновик из мира и созданные в мастере — целиком: { id, name, from, to, courts, …, state: 'draft' | 'open' | 'removed' }.
// Удалённый черновик остаётся записью с state: 'removed' — календарь, «Сегодня» и мастер его не показывают.
// Перенос опубликованного этапа мира («Июльский кубок») — только новые дни: { id, from, to, play, moved: true }.
export const cups = () => state.get('cups') || {};
export const isNewId = (id) => /^new/.test(id || '');
export function getCup(id) { const c = cups()[id]; if (c && !c.moved) return c; return id === 'aug-5' ? draftFromWorld() : null; }
// opts — { say, href }: строка журнала; возвращает «Отменить»
export const putCup = (cup, opts) => state.set(`cups.${cup.id}`, cup, opts);
// Начатые черновики: «Августовский кубок» из мира и новые, у которых уже есть название или даты
export function openDrafts() {
  const out = [];
  const a = getCup('aug-5');
  if (a && a.state === 'draft') out.push(a);
  Object.values(cups()).filter((c) => isNewId(c.id) && c.state === 'draft' && (c.name || c.from)).forEach((c) => out.push(c));
  return out;
}
// где турнир виден в календаре — для строки журнала
export const seasonHref = (iso) => (iso ? `season.html?m=${iso.slice(0, 7)}` : 'season.html');

// Этап для календаря и строк приложения: как его видит календарь сезона
export function cupToStage(cup, no) {
  return {
    id: cup.id, no, name: cup.name || 'Новый турнир', from: cup.from, to: cup.to || cup.from,
    // у черновика дни ещё не окончательные: в календаре он — сплошная пунктирная пилюля, как черновик из мира
    surface: surfaceOf(cup.finalCourt), play: cup.state === 'open' ? (cup.play || []) : [],
    state: cup.state === 'open' ? 'open' : 'draft', pairs: 0, slots: 16,
    signupTo: cup.signupTo, draw: cup.draw, savedAt: cup.savedAt || `сегодня в ${state.now()}`,
    courts: courtsWords(cup.courts), kind: cup.kind,
  };
}

// Порядок этапов — по датам начала; в один день раньше тот, что создан раньше:
// этапы мира — по порядку в мире, созданные в мастере — по номеру (new-1, new-2, …).
const madeRank = (id) => { const i = D.STAGES.findIndex((s) => s.id === id); return i >= 0 ? i : 100 + (+String(id).replace(/\D/g, '') || 0); };
export const byDate = (a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : madeRank(a.id) - madeRank(b.id));
const isStageKind = (s) => s.kind !== 'separate' && s.kind !== 'final';

// Сезон с учётом сделанного в разделе: перенесённые этапы, черновики, опубликованное, удалённое.
// Числа «Июльского кубка» (pairs) живые — снимок берётся при каждом вызове.
export function seasonStages() {
  const all = cups();
  const list = D.STAGES.filter((s) => (all[s.id] || {}).state !== 'removed').map((s) => {
    const c = all[s.id];
    if (!c) return { ...s, courts: tightCourts(s.courts) };
    if (c.moved) return { ...s, courts: tightCourts(s.courts), from: c.from, to: c.to, play: c.play || s.play };
    return cupToStage(c, s.no);
  });
  Object.values(all).filter((c) => isNewId(c.id) && c.from && c.state !== 'removed').forEach((c) => list.push(cupToStage(c, 0)));
  // номер этапа — по порядку дат среди опубликованных этапов (в один день — по порядку создания);
  // черновик получает номер, который будет у него после публикации (игроки черновиков не видят)
  const st = list.filter(isStageKind).sort(byDate);
  const pub = st.filter((s) => s.state !== 'draft');
  pub.forEach((s, i) => { s.no = i + 1; });
  st.filter((s) => s.state === 'draft').forEach((s) => { s.no = pub.filter((p) => byDate(p, s) < 0).length + 1; });
  return list;
}
// опубликованные этапы сезона по порядку — их видят игроки в «Пути сезона»
export const publishedStages = () => seasonStages().filter((s) => s.state !== 'draft' && isStageKind(s)).sort(byDate);
// номер этапа сейчас (с учётом созданных и перенесённых): «Июльский кубок» — 4 или 5
export const stageNoNow = (id) => { const s = seasonStages().find((x) => x.id === id); return s ? s.no : (D.stage(id) || {}).no; };
// номер этапа для турнира из мастера: сколько опубликованных этапов раньше него, плюс один
export function stageNoFor(cup) {
  const me = { id: cup.id, from: cup.from || '9999-12-31' };
  return publishedStages().filter((s) => s.id !== cup.id && byDate(s, me) < 0).length + 1;
}
// Чьи номера сдвинутся, если турнир встанет в путь сезона на эти даты: [{ id, name, was, now }].
// Только опубликованные этапы — черновики игроки не видят.
export function stagesShift(cup) {
  const pub = publishedStages();
  const was = Object.fromEntries(pub.map((s) => [s.id, s.no]));
  const rest = pub.filter((s) => s.id !== cup.id);
  const list = cup.from && (cup.kind || 'stage') === 'stage' ? [...rest, { id: cup.id, from: cup.from }].sort(byDate) : rest;
  return list.map((s, i) => ({ id: s.id, name: s.name, was: was[s.id], now: i + 1 })).filter((x) => x.id !== cup.id && x.was !== x.now);
}
// «„Июльский кубок“ станет этапом 5», «… этапом 5, „Августовский кубок“ — этапом 6»
export const shiftWords = (list) => list.map((x, i) => (i === 0 ? `«${x.name}» станет этапом ${x.now}` : `«${x.name}» — этапом ${x.now}`)).join(', ');
// Перенос опубликованного этапа мира: только новые дни; возвращает «Отменить» (и строку журнала тоже)
export const moveStage = (id, from, to, play, opts) => state.set(`cups.${id}`, { id, from, to, play, moved: true }, opts);

// ---------- слова ----------
export const pairsWord = (n) => `${n}${NB}${plural(n, 'пара', 'пары', 'пар')}`;
export const matchesWord = (n) => `${n}${NB}${plural(n, 'матч', 'матча', 'матчей')}`;
export const daysWord = (n) => `${n}${NB}${plural(n, 'день', 'дня', 'дней')}`;
export const dateShort = (iso) => rangeShort(iso);
// «31 июля — 7 августа» для строки журнала: без невидимых знаков склейки
export const plainRange = (a, b) => rangeShort(a, b).replace(/⁠/g, '');
export { dayWords, cap1, esc, icon, toDate };

export const FORMATS = {
  groups: { t: 'Группы, потом плей-офф', s: '4 группы по 4 пары. 1-е и 2-е места — в плей-офф высшей категории, 3-е и 4-е — во второй', short: 'группы, потом плей-офф' },
  bracket: { t: 'Одна сетка на выбывание', s: 'Как на Итоговом турнире: 16 пар сразу в сетку. Проиграл — выбыл', short: 'одна сетка на выбывание' },
};
export const KINDS = {
  stage: { t: 'Этап сезона', s: 'Встанет в путь сезона следующим этапом' },
  separate: { t: 'Отдельный турнир', s: 'Например, кубок партнёра лиги' },
  final: { t: 'Итоговый турнир сезона', s: 'Лучшие пары сезона в конце года' },
};

// ---------- «Где появится» — по ЧТО-КУДА.md, раздел 1 ----------
export function whereFor(cup, stageNo) {
  const monthNom = cup.from ? ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'][+cup.from.slice(5, 7) - 1] : '';
  const inPath = cup.kind === 'stage' || !cup.kind;
  return [
    inPath
      ? { icon: 'phone', b: 'Приложение', s: `«Турниры» → «Путь сезона», этап ${stageNo}` }
      : { icon: 'phone', b: 'Приложение', no: true, s: cup.kind === 'final' ? 'места для Итогового турнира в приложении пока нет' : 'отдельные турниры в приложении пока не показываются' },
    { icon: 'site', b: 'Сайт', s: `календарь сезона${monthNom ? ', ' + monthNom : ''}; страница турнира` },
  ];
}

// ---------- «Путь сезона» в приложении (tournaments.html, #path) ----------
// Этапы мира уже стоят в разметке приложения. Опубликованные в разделе — и турнир из мастера
// (extra: { id, name, from, to, surface, signupTo }) — встают копией строки открытого этапа
// на своё место по датам; номера на плитках и «Этап 3 из 5» у героя — заново.
// Можно звать много раз на одной странице. Возвращает { li: строка по id, mine: строка extra }.
function fillPathRow(li, s) {
  const set = (sel, t) => { const x = li.querySelector(sel); if (x) x.textContent = t; };
  const cap = li.querySelector('.grow > .cap');
  if (cap) cap.innerHTML = `<span class="vh"></span>${esc(s.from && s.to ? rangeShort(s.from, s.to) : 'даты не выбраны')}${s.surface ? ` · ${esc(D.SURFACES[s.surface].label)}` : ''}`;
  set('.grow > .strong', s.name || 'Название турнира');
  set('.sub .n', s.signupTo ? `Заявки до ${rangeShort(s.signupTo)}` : 'Срок записи не выбран');
  set('.st-fill .cap', `0 из ${s.slots || 16} пар`);
  li.querySelectorAll('.st-slots i').forEach((i) => i.classList.remove('on'));
}
export function patchSeasonPath(doc, extra = null) {
  const ol = doc.getElementById('path');
  if (!ol) return { li: {}, mine: null };
  ol.querySelectorAll(':scope > li[data-adm-row]').forEach((x) => x.remove());
  [...ol.children].forEach((x, i) => { if (!x.dataset.sid) x.dataset.sid = (D.SEASON.order || [])[i] || ''; });
  const tpl = ol.querySelector(':scope > li[data-state="open"]') || ol.lastElementChild;
  let list = publishedStages().filter((s) => !extra || s.id !== extra.id);
  if (extra) list = [...list, { ...extra, from: extra.from || '9999-12-31' }].sort(byDate);
  const out = { li: {}, mine: null };
  list.forEach((s, i) => {
    let li = ol.querySelector(`:scope > li[data-sid="${s.id}"]`);
    if (!li && tpl) {
      li = tpl.cloneNode(true);
      li.dataset.admRow = '1'; li.dataset.sid = s.id; li.dataset.state = 'open';
      li.querySelectorAll('a[href]').forEach((a) => a.removeAttribute('href'));
      // отметка «Здесь» строки-образца в копию не переходит
      [li, ...li.querySelectorAll('.adm-mark')].forEach((x) => { x.classList.remove('adm-mark'); delete x.dataset.adm; });
      fillPathRow(li, extra && s.id === extra.id ? extra : s);
    }
    if (!li) return;
    // этап мира перенесли в календаре — в строке приложения новые даты
    if (!li.dataset.admRow && (cups()[s.id] || {}).moved) {
      const cap = li.querySelector('.grow > .cap');
      if (cap) cap.innerHTML = `<span class="vh"></span>${esc(rangeShort(s.from, s.to))}${s.surface ? ` · ${esc(D.SURFACES[s.surface].label)}` : ''}`;
    }
    // запись идёт — сколько пар принято сейчас (мир и решения по заявкам), а не число из разметки приложения
    if (!li.dataset.admRow && s.state === 'open' && Number.isFinite(s.pairs)) {
      const slots = s.slots || 16;
      const fc = li.querySelector('.st-fill .cap'); if (fc) fc.textContent = `${s.pairs} из ${slots} пар`;
      li.querySelectorAll('.st-slots i').forEach((x, k) => x.classList.toggle('on', k < s.pairs));
    }
    ol.append(li);
    li.querySelectorAll('.srf-tile .num, .st-tile .num').forEach((x) => { x.textContent = String(i + 1); });
    const vh = li.querySelector('.grow > .cap .vh'); if (vh) vh.textContent = `Этап ${i + 1}, `;
    out.li[s.id] = li;
    if (extra && s.id === extra.id) out.mine = li;
  });
  // у героя — номер идущего этапа и сколько их всего
  const live = list.findIndex((s) => s.state === 'live');
  const hc = doc.querySelector('#hero .st-top .cap');
  if (hc && live >= 0) hc.textContent = `Этап ${live + 1} из ${list.length}`;
  const hero = doc.getElementById('hero');
  if (hero && live >= 0) hero.setAttribute('aria-label', (hero.getAttribute('aria-label') || '').replace(/этап \d+ из \d+/, `этап ${live + 1} из ${list.length}`));
  return out;
}
