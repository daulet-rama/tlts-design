// Мир примеров раздела организатора.
// Всё общее — из мира приложения ../app-v2/data.js: люди, пары, матчи, корты, «сегодня».
// Здесь только то, что нужно админке и чего там нет. Все люди выдуманные.
// Сегодня суббота, 19 июня 2027 года, 18:47 — финальный день «Июньского кубка».
// Числа и слова — из ЗАДАНИЕ-АДМИНКА.md, СОСТАВ.md и КАЛЕНДАРИ.md. Своих не досчитываем.
//
// Что человек сделал в разделе (решения по заявкам, взносы, вызовы на корт…), лежит
// в общем состоянии admin.js. Часть мира ниже живая: числа «Июльского кубка», вызовы
// на корт, корты, правило сезона и строки дел считаются из мира и сделанного — их видят
// все страницы одинаково.

export * from '../app-v2/data.js';
import { MATCHES, SCHEDULE, COURTS as WORLD_COURTS, SURFACES, RULES as APP_RULES, CALLS as WORLD_CALLS, match } from '../app-v2/data.js';

// ---------- сделанное в примере ----------
// admin.js подключает общее состояние: bindState(() => изменения). Без него — мир как есть.
let CHANGES = () => ({});
export const bindState = (fn) => { CHANGES = fn; syncLive(); };
const changed = (part) => CHANGES()[part] || {};
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many;
};

export const YEAR = 2027;
export const NOW = { iso: '2027-06-19', time: '18:47', min: 18 * 60 + 47 };

// ---------- сезон ----------
// Цвет этапа — покрытие корта, где играют его финалы (как в app-v2/js/tour.data.js).
// play — игровые дни: 1-й, 2-й, 3-й, 7-й и 8-й день этапа.
// У черновика «Августовского кубка» корты ещё не выбраны: покрытия и игровых дней нет.
// У «Июльского кубка» pairs, waiting и paid живые: мир плюс решения по заявкам и отметки взноса.
export const STAGES = [
  { id: 'apr-1', no: 1, name: 'Кубок открытия', from: '2027-04-17', to: '2027-04-24', surface: 'hard',
    play: ['2027-04-17', '2027-04-18', '2027-04-19', '2027-04-23', '2027-04-24'], state: 'done', pairs: 14, winner: 'szh' },
  { id: 'may-2', no: 2, name: 'Майский кубок', from: '2027-05-15', to: '2027-05-22', surface: 'clay',
    play: ['2027-05-15', '2027-05-16', '2027-05-17', '2027-05-21', '2027-05-22'], state: 'done', pairs: 16, winner: 'osv' },
  { id: 'jun-3', no: 3, name: 'Июньский кубок', from: '2027-06-12', to: '2027-06-19', surface: 'clay',
    play: ['2027-06-12', '2027-06-13', '2027-06-14', '2027-06-18', '2027-06-19'], state: 'live', pairs: 16, courts: 'корты 1–5' },
  { id: 'jul-4', no: 4, name: 'Июльский кубок', from: '2027-07-10', to: '2027-07-17', surface: 'grass',
    play: ['2027-07-10', '2027-07-11', '2027-07-12', '2027-07-16', '2027-07-17'], state: 'open', slots: 16,
    get pairs() { return pairsNow('jul-4').accepted.length; },
    get waiting() { return pairsNow('jul-4').waiting.length; },
    get paid() { return pairsNow('jul-4').paid.length; },
    signupTo: '2027-07-05', draw: '2027-07-07', courts: 'корты 1–5' },
  { id: 'aug-5', no: 5, name: 'Августовский кубок', from: '2027-08-07', to: '2027-08-14', surface: null,
    play: [], state: 'draft', slots: 16, savedAt: 'вчера в 22:10' },
];
export const stage = (id) => STAGES.find((s) => s.id === id);
// Этап сейчас: перенесли в календаре (cups.<этап> = { from, to, play, moved }) — новые даты и игровые дни.
// Сроки записи и жеребьёвки у этапа мира перенос не меняет. Числа «Июльского кубка» остаются живыми.
export function stageNow(id) {
  const s = stage(id); if (!s) return s;
  const c = (CHANGES().cups || {})[id];
  if (!c || !c.moved) return s;
  return Object.create(s, { from: { value: c.from, enumerable: true }, to: { value: c.to, enumerable: true }, play: { value: c.play && c.play.length ? c.play : s.play, enumerable: true }, moved: { value: true, enumerable: true } });
}
// опубликованные этапы — их видят игроки; черновик видит только админка
export const PUBLISHED = STAGES.filter((s) => s.state !== 'draft');

// Правила лиги из мира приложения и правило сезона 2027 (меняет Совет): коридор суммы КПР пары
// и суммарный возраст. Живые: правило из «Настроек» (rules.season = { from, to, age }) видно на всех
// страницах. Массив corridor меняется на месте — его можно держать в своей переменной.
const SEASON_RULE = { corridor: [7.0, 8.5], ageSum: 70 };
export const RULES = { ...APP_RULES, corridor: SEASON_RULE.corridor.slice(), ageSum: SEASON_RULE.ageSum };

// ---------- заявки пар ----------
// В мире приложения у «Июльского кубка» только числа: приняты 9 из 16, ждут ответа 4, оплатили 7.
// Состав — из пар мира (D.PAIRS), чтобы фамилии, КПР и баллы брались оттуда.
export const ROSTER = {
  'jul-4': {
    accepted: ['ilk', 'gyu', 'bvr', 'ngs', 'lme', 'azo', 'str', 'prb', 'fch'],
    passed: ['prb', 'fch'],                                   // пропустил Совет как исключение
    paid: ['ilk', 'gyu', 'bvr', 'ngs', 'lme', 'azo', 'str'],   // 7 из 9
    waiting: ['hor', 'dee', 'szh', 'nuv'],
  },
};
// Пары турнира сейчас: мир и решения из общего состояния.
// Решение по заявке: pairs.<турнир>.<пара> = { status, why }, status —
// 'accepted' | 'waiting' | 'reserve' | 'refused' | 'council' (передана в Совет) | 'removed' (снята).
// Взнос: fees.<турнир>.<пара> = true | false.
export function pairsNow(tid) {
  const r = ROSTER[tid] || { accepted: [], passed: [], paid: [], waiting: [] };
  const dec = changed('pairs')[tid] || {}; const fee = changed('fees')[tid] || {};
  const out = { accepted: [], waiting: [], reserve: [], refused: [], council: [], removed: [], paid: [], passed: r.passed.slice() };
  const ids = [...new Set([...r.accepted, ...r.waiting, ...Object.keys(dec)])];
  for (const id of ids) {
    const d = dec[id];
    const st = d && d.status ? d.status : r.accepted.includes(id) ? 'accepted' : 'waiting';
    if (st === 'refused') out.refused.push({ id, why: (d && d.why) || '' });
    else if (out[st]) out[st].push(id);
  }
  out.paid = out.accepted.filter((id) => (id in fee ? !!fee[id] : r.paid.includes(id)));
  return out;
}

// ---------- заявки в лигу ----------
// Кандидат — D.APPLICANT (Арман Есенов): зарегистрировался 19 июня в 18:05, анкета — в 18:12, у него в приложении шаг 3 из 6.
// «Похоже, это один человек»: игроки лиги вошли в новое приложение, в имени — казахская буква.
// Шаг заявки сейчас: join.<заявка> = { step }, step — 'level' | 'council' | 'fee' | 'member' |
// 'declined' | 'merged' (объединили с игроком) | 'apart' (это разные люди).
export const JOIN_APPS = [
  { id: 'esenov', kind: 'join', at: '18:12', registered: '18:05', step: 'level' },
  { id: 'sarsenbaev', kind: 'merge', at: '11:02', step: 'match', player: 'p02', typed: { first: 'Ерлан', last: 'Сәрсенбаев' }, via: 'по почте с кодом', letter: 'ә' },
  { id: 'zhaksybekov', kind: 'merge', at: '09:14', step: 'match', player: 'p04', typed: { first: 'Нурлан', last: 'Жақсыбеков' }, via: 'через Google', letter: 'қ' },
];
export const JOIN_DONE = ['member', 'declined', 'merged', 'apart'];
export function joinNow() {
  const ch = changed('join');
  return JOIN_APPS.map((a) => ({ ...a, ...(ch[a.id] || {}) }));
}
export const joinOpen = () => joinNow().filter((a) => !JOIN_DONE.includes(a.step));

// ---------- кто работает в админке (пример на людях мира) ----------
// «Вы» — тот, кто сейчас в разделе: организатор, как «Вы: организатор» сверху на всех экранах.
export const STAFF = [
  { pid: 'me', role: 'org' },
  { pid: 'p16', role: 'org' },      // Тимур Ахметов
  { pid: 'p01', role: 'council' },  // Данияр Оспанов
  { pid: 'p05', role: 'council' },  // Павел Вершинин
  { pid: 'p15', role: 'news' },     // Антон Левин
  { pid: 'p10', role: 'admin' },    // Виктор Савельев
];

// ---------- новый турнир (создаётся на глазах) ----------
// «Как „Июльский кубок“»: шаг между этапами 4 недели, длина 8 дней, с субботы по субботу.
export const NEW_CUP = {
  name: 'Августовский кубок', from: '2027-08-07', to: '2027-08-14',
  play: ['2027-08-07', '2027-08-08', '2027-08-09', '2027-08-13', '2027-08-14'],
  start: '08:45', round: 50, courts: ['c1', 'c2', 'c3', 'c4', 'c5'],
  pairs: 16, groups: 4, format: 'Один сет до 6, тай-брейк до 7',
  signupTo: '2027-08-02', draw: '2027-08-04', like: 'jul-4',
};

// Сколько матчей в этапе на 16 пар: 4 группы по 4 пары — 24 матча,
// плей-офф и матчи за места — 12. Как они ложатся на игровые дни — по туру в день,
// затем четвертьфиналы, затем финальный день (так играли «Июньский кубок»).
// waves — волны финального дня: сначала полуфиналы и матчи за 5–8 места (4),
// потом финал и матчи за 3-е, 5-е и 7-е места (4) — их пары известны только после первой волны.
export const BLOCKS = [
  { key: 't1', label: '1-й тур групп', n: 8, stage: 'group' },
  { key: 't2', label: '2-й тур групп', n: 8, stage: 'group' },
  { key: 't3', label: '3-й тур групп', n: 8, stage: 'group' },
  { key: 'qf', label: 'четвертьфиналы', n: 4, stage: 'play' },
  { key: 'fd', label: 'полуфиналы, финал и матчи за места', n: 8, stage: 'play', waves: [4, 4] },
];

// ---------- черновые дни расписания «Июльского кубка» ----------
// Первый игровой день, суббота 10 июля, сегодня в 17:20 расставил руками Тимур Ахметов (организатор):
// 8 матчей 1-го тура групп на 5 кортах, с 08:45 по 50 минут. Два матча группы D он поставил
// на корт 3 около 09:35 — одна накладка; корты 2, 4 и 5 в это время свободны. Пары станут
// известны после жеребьёвки. Остальные игровые дни пустые.
// Сделанное на «Расписании» (days.<этап>.<день>) заменяет день мира целиком; перенесли этап
// в календаре — его черновые дни уже лежат в общем состоянии на новых датах.
export const DAY_DRAFTS = {
  'jul-4': {
    '2027-07-10': {
      state: 'draft', saved: '17:20', by: 'p16', manual: true,
      rows: [{ key: 'r1', min: 8 * 60 + 45, t: '08:45', about: false }, { key: 'r2', min: 9 * 60 + 35, t: '09:35', about: true }],
      place: { gA11: ['c1', 'r1'], gA12: ['c2', 'r1'], gB11: ['c3', 'r1'], gB12: ['c4', 'r1'], gC11: ['c5', 'r1'], gC12: ['c1', 'r2'], gD11: ['c3', 'r2'], gD12: ['c3', 'r2'] },
      breaks: [], kept: [],
    },
  },
};
const copyOf = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const movedStage = (tid) => !!((CHANGES().cups || {})[tid] || {}).moved;
// Черновой день сейчас: сделанное в разделе или день мира (если этап не переносили)
export function dayDraftNow(tid, iso) {
  const own = (changed('days')[tid] || {})[iso];
  if (own) return copyOf(own);
  if (movedStage(tid)) return null;
  return copyOf((DAY_DRAFTS[tid] || {})[iso]) || null;
}
// Все черновые дни этапа: мир и сделанное, { день: … }
export function daysNow(tid) {
  return { ...(movedStage(tid) ? {} : copyOf(DAY_DRAFTS[tid] || {})), ...copyOf(changed('days')[tid] || {}) };
}

// ---------- день турнира: суббота, 19 июня ----------
// Время дня финалов — по программе (строки сетки расписания).
export const DAY_ROWS = ['10:00', '11:30', '13:00', '16:30', '18:00', '19:00', '20:00'];
// Прогноз считает сервер по живому счёту: всегда «около».
export const FORECAST = { third: '19:05' };
// Игровые дни «Июньского кубка» для шапки расписания
export const JUNE_DAYS = STAGES[2].play;
export const DAY_MATCHES = SCHEDULE.map((id) => MATCHES.find((m) => m.id === id));
export const playedOf = (list) => list.filter((m) => m.state === 'done').length;

// Вызовы на корт, по которым матч ещё не начался: мир (в 18:45 вызваны пары матча за 5-е место)
// и вызовы из общего состояния: calls.<матч> = { at: '18:52' } — вызвали, null — вызов отменён.
// Тот же массив, что в мире приложения; admin.js обновляет его на месте.
export const CALLS = [];
export function callsNow() {
  const ch = changed('calls');
  const out = WORLD_CALLS.filter((c) => !(c.match in ch)).map((c) => ({ ...c }));
  for (const [id, v] of Object.entries(ch)) if (v && v.at && match(id) && match(id).state === 'soon') out.push({ match: id, at: v.at });
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

// ---------- корты: мир и сделанное в «Настройках» ----------
// courts.<корт> = { name, note, surface } — корт переименовали, сменили подпись или покрытие;
// { …, removed: true } — корт убрали. Переименованный корт называется по-новому на всех страницах.
// D.COURTS — корты мира (c1…c5), на них играют турниры сезона: ключи те же, имя, подпись и покрытие —
// живые. Убранный корт остаётся с пометкой removed: в сыгранных и идущих матчах он есть.
// Добавленный в настройках корт живёт в настройках: в расписания турниров сам не встаёт.
// Объекты кортов меняются на месте — их можно держать в своей переменной.
export const COURTS = Object.fromEntries(Object.entries(WORLD_COURTS).map(([id, c]) => [id, { ...c }]));
export const court = (id) => COURTS[id];
const srfLabel = (s) => (SURFACES[s] ? SURFACES[s].label : '');
// «Корт 3 · грунт»
export const courtLine = (id) => [COURTS[id].name, srfLabel(COURTS[id].surface)].filter(Boolean).join(' · ');
// Полное имя корта: «Корт 1 · центральный · грунт»
export const courtFull = (id) => {
  const c = COURTS[id];
  return [c.name, c.note, srfLabel(c.surface)].filter(Boolean).join(' · ');
};
function syncCourts() {
  const ch = changed('courts');
  for (const [id, w] of Object.entries(WORLD_COURTS)) {
    const c = COURTS[id]; const x = ch[id] || {};
    Object.keys(c).forEach((k) => { if (!(k in w)) delete c[k]; });
    Object.assign(c, w);
    if (typeof x.name === 'string' && x.name.trim()) c.name = x.name.trim();
    if (typeof x.note === 'string') c.note = x.note.trim();
    if (x.surface && SURFACES[x.surface]) c.surface = x.surface;
    if (x.removed) c.removed = true;
  }
}
// правило сезона: rules.season = { from, to, age }
function syncRules() {
  const r = changed('rules').season || {};
  const num = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);
  RULES.corridor[0] = num(r.from, SEASON_RULE.corridor[0]);
  RULES.corridor[1] = num(r.to, SEASON_RULE.corridor[1]);
  RULES.ageSum = num(r.age, SEASON_RULE.ageSum);
}

// ---------- «Сегодня» ----------
// 19 июня под пультом дня — дела (СОСТАВ.md, 1.1). Список живой: числа в строках — из мира
// и сделанного; черновик «Августовского кубка» удалили или опубликовали (cups.aug-5) — дела нет.
// Тот же массив меняется на месте, как CALLS.
const TODO_PAIRS = { key: 'pairs', title: 'Ответить на заявки пар', action: 'Посмотреть заявки', href: 'tournament.html?t=jul-4&step=pairs',
  get line() { const n = stage('jul-4').waiting; return `«Июльский кубок»: ${n ? `ждут ${n}` : 'все заявки разобраны'} · запись до 5 июля`; } };
const TODO_JOIN = { key: 'join', title: 'Разобрать заявки на вступление', action: 'Открыть заявки', href: 'applications.html',
  get line() { const n = joinOpen().length; return n ? `${n} ${plural(n, 'новая', 'новые', 'новых')}, первая подана 19 июня` : 'Все заявки разобраны'; } };
// Сколько задач черновика не сделано — те же вопросы, что в списке задач мастера: название, даты,
// корты и корт финала, игровые дни, формат, запись и жеребьёвка. Записи нет — как в мире: 2 задачи.
function draftLeft(c) {
  const miss = [
    !c.name,
    !(c.from && c.to),
    !(c.courts && c.courts.length && c.finalCourt && c.courts.includes(c.finalCourt)),
    !(c.from && c.to && c.play && c.play.length),
    !c.format,
    !c.signupTo || (c.from && c.signupTo >= c.from) || c.signupTo <= NOW.iso || !c.draw || c.draw < c.signupTo || (c.from && c.draw >= c.from),
  ];
  return miss.filter(Boolean).length;
}
function draftTodo() {
  const c = (CHANGES().cups || {})['aug-5'];
  if (c && c.state && c.state !== 'draft') return null;   // удалили или опубликовали
  const name = (c && c.name) || stage('aug-5').name;
  const left = c && !c.moved ? draftLeft(c) : 2;
  return { key: 'draft', title: 'Закончить турнир', action: 'Продолжить', href: 'new-tournament.html?draft=aug-5',
    line: `«${name}»: ${left ? `${plural(left, 'осталась', 'осталось', 'осталось')} ${left} ${plural(left, 'задача', 'задачи', 'задач')}` : 'осталось проверить и опубликовать'}` };
}
export const TODOS = [];
function syncTodos() { TODOS.splice(0, TODOS.length, ...[TODO_PAIRS, TODO_JOIN, draftTodo()].filter(Boolean)); }

// Живая часть мира — заново после любого изменения общего состояния (admin.js зовёт сам)
export function syncLive() {
  CALLS.splice(0, CALLS.length, ...callsNow());
  syncCourts();
  syncRules();
  syncTodos();
}
syncLive();

// ---------- роли ----------
export const ROLES = [
  { key: 'org', label: 'Организатор', line: 'турниры, расписание, заявки пар, взносы, судьи' },
  { key: 'council', label: 'Совет', line: 'вступление, правила сезона, исключения из коридора' },
  { key: 'news', label: 'Новости и фото', line: 'только материалы' },
  { key: 'admin', label: 'Админ', line: 'всё и доступ' },
];
