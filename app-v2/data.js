// Общий мир данных приложения. Все люди выдуманные.
// Лига «Теннисная лига TS», мужской парный разряд.
// Сегодня суббота, 19 июня 2027 года: день финалов третьего этапа «Июньского кубка».
// Все даты сезона приходятся на 2027 год: этапы идут с субботы по субботу
// (17–24 апреля, 15–22 мая, 12–19 июня, 10–17 июля).
// Сейчас 18:47. На корте 3 идёт матч за 3-е место: Громов / Юсупов — Назаров / Гасанов, 4:3, 30:15.
// Его судит «вы» — Герман Хван. В 20:00 он с Максимом Орловым играет финал на корте 1
// против Оспанова и Савельева. В 18:45 на корт 2 вызваны пары матча за 5-е место (начало в 19:00).
//
// Экран берёт отсюда всё, что показывает: имена, счёт, время, места и баллы.
// Ничего не меняйте здесь ради одного экрана: те же числа видят все остальные.
// Чего не хватает — просите добавить сюда, а не заводите свой файл данных.

// ---------- лига и день ----------

export const LEAGUE = { name: 'Теннисная лига TS', short: 'Лига TS', discipline: 'Мужской парный разряд' };

export const TODAY = {
  iso: '2027-06-19',       // суббота
  weekday: 'Суббота',
  label: 'Суббота, 19 июня',
  dayMonth: '19 июня',
  now: '18:47',
  sunset: '21:10',         // закат: до него корты играют без света
};

// ---------- правила лиги (словами и числами) ----------
// Счёт — те же правила, что считает score.js (FORMAT_LEAGUE).

export const RULES = {
  short: 'Один сет до 6, тай-брейк до 7',
  set: 'Один сет до 6',
  tiebreak: 'При 6:6 — тай-брейк до 7',
  deuce: 'Ровно — одно «больше»',
  deciding: 'Второе «ровно» — решающее очко',
  callLimit: 20,           // Кодекс, пункт 2.1: 20 минут на выход после вызова на корт
  slot: 50,                // матч в программе дня — 50 минут
  replaceDays: 10,         // о замене напарника — директору не позже чем за 10 дней до жеребьёвки
  ageSum: 70,              // суммарный возраст пары — не меньше 70 лет (проверяет директор по анкетам)
};

// ---------- покрытия и корты ----------

export const SURFACES = {
  clay: { key: 'clay', label: 'грунт', Label: 'Грунт' },
  hard: { key: 'hard', label: 'хард', Label: 'Хард' },
  grass: { key: 'grass', label: 'трава', Label: 'Трава' },
};

export const COURTS = {
  c1: { id: 'c1', name: 'Корт 1', note: 'центральный', surface: 'clay' },
  c2: { id: 'c2', name: 'Корт 2', note: '', surface: 'hard' },
  c3: { id: 'c3', name: 'Корт 3', note: '', surface: 'clay' },
  c4: { id: 'c4', name: 'Корт 4', note: '', surface: 'grass' },
  c5: { id: 'c5', name: 'Корт 5', note: 'под крышей', surface: 'hard' },
};

// ---------- звания (лестница) ----------

export const RANKS = [
  { level: 1, label: 'Дебютант', rule: 'Сыграл первый турнир' },
  { level: 2, label: 'Игрок лиги', rule: '5 турниров' },
  { level: 3, label: 'Претендент', rule: 'Полуфинал высшей категории' },
  { level: 4, label: 'Призёр', rule: 'Финал высшей категории или победа во второй' },
  { level: 5, label: 'Чемпион этапа', rule: 'Победа на этапе в высшей категории' },
  { level: 6, label: 'Чемпион лиги', rule: 'Победа в Итоговом турнире' },
  { level: 7, label: 'Легенда лиги', rule: 'Три Итоговых турнира и больше' },
];

// ---------- игроки ----------
// place и points — место и баллы в рейтинге лиги; rank — уровень звания (1–7).
// portrait — имя файла портрета в img/ (есть у десяти игроков), иначе null: тогда инициалы.

const P = (id, first, last, kpr, place, points, rank, portrait = null, extra = {}) =>
  ({ id, first, last, name: `${first} ${last}`, kpr, place, points, rank, portrait, hand: 'правша', since: 2023, ...extra });

export const PLAYERS = [
  P('p01', 'Данияр', 'Оспанов', 5.0, 1, 2410, 6, 'd04', { since: 2019 }),
  P('p02', 'Ерлан', 'Сарсенбаев', 4.5, 2, 2290, 5, 'd01', { since: 2020 }),
  P('p03', 'Руслан', 'Каримов', 4.5, 3, 2205, 5, null, { since: 2020 }),
  // победил на Кубке открытия 2027 с Сарсенбаевым — «Чемпион этапа»
  P('p04', 'Нурлан', 'Жаксыбеков', 4.5, 4, 2150, 5, 'd09', { since: 2019, hand: 'левша' }),
  P('p05', 'Павел', 'Вершинин', 4.5, 5, 2080, 4, null, { since: 2021 }),
  P('p06', 'Алексей', 'Громов', 4.0, 6, 2010, 4, 'd02', { since: 2021 }),
  P('p07', 'Эльдар', 'Гасанов', 4.5, 7, 1960, 4, 'd07', { since: 2022 }),
  P('p08', 'Роман', 'Ильин', 4.0, 8, 1915, 3, null, { since: 2022 }),
  P('p09', 'Бахтияр', 'Юсупов', 4.0, 9, 1880, 3, 'd06', { since: 2021 }),
  // победил на Майском кубке 2027 с Оспановым — «Чемпион этапа»
  P('p10', 'Виктор', 'Савельев', 4.0, 10, 1840, 5, 'd05', { since: 2019 }),
  P('p11', 'Илья', 'Белов', 4.0, 11, 1800, 3, null, { since: 2022 }),
  P('p12', 'Максим', 'Орлов', 4.0, 12, 1765, 4, 'd10', { since: 2022 }),
  P('p13', 'Олег', 'Демченко', 4.0, 13, 1730, 3, null),
  P('p14', 'Кирилл', 'Ершов', 4.0, 14, 1700, 3, null),
  P('p15', 'Антон', 'Левин', 3.5, 15, 1680, 2, null, { hand: 'левша' }),
  P('p16', 'Тимур', 'Ахметов', 3.5, 16, 1655, 3, null),
  P('p17', 'Герман', 'Хван', 4.0, 17, 1620, 4, 'd03'),
  P('p18', 'Дамир', 'Назаров', 4.0, 18, 1590, 3, 'd08', { hand: 'левша' }),
  P('p19', 'Игорь', 'Мельник', 3.5, 19, 1555, 2, null),
  P('p20', 'Артём', 'Седов', 3.5, 20, 1520, 2, null, { since: 2024 }),
  P('p21', 'Михаил', 'Тарасов', 3.5, 21, 1490, 2, null, { since: 2024 }),
  P('p22', 'Андрей', 'Зотов', 3.5, 22, 1450, 2, null),
  P('p23', 'Денис', 'Панин', 3.5, 23, 1415, 2, null, { since: 2024 }),
  P('p24', 'Степан', 'Рябов', 3.0, 24, 1380, 2, null, { since: 2024 }),
  P('p25', 'Никита', 'Фомин', 3.0, 25, 1340, 2, null, { since: 2024 }),
  P('p26', 'Вадим', 'Чернов', 3.0, 26, 1300, 2, null, { since: 2024 }),
  P('p27', 'Леонид', 'Шаров', 3.0, 27, 1265, 2, null, { since: 2024 }),
  P('p28', 'Фёдор', 'Щукин', 3.0, 28, 1230, 1, null, { since: 2025 }),
  P('p29', 'Глеб', 'Носов', 3.0, 29, 1190, 1, null, { since: 2025 }),
  P('p30', 'Егор', 'Уваров', 3.0, 30, 1150, 1, null, { since: 2025 }),
  P('p31', 'Арсений', 'Цой', 3.0, 31, 1105, 1, null, { since: 2026 }),
  P('p32', 'Ринат', 'Яхин', 2.5, 32, 1060, 1, null, { since: 2026 }),
];

// ---------- пары этапа (16) ----------
// seed — номер посева этапа (1–4): по одному сеяному в группе, 1 и 2 — в разных половинах сетки.

export const PAIRS = [
  { id: 'osv', players: ['p01', 'p10'], group: 'A', seed: 1 },
  { id: 'ilk', players: ['p08', 'p03'], group: 'A' },
  { id: 'prb', players: ['p23', 'p24'], group: 'A' },
  { id: 'cyh', players: ['p31', 'p32'], group: 'A' },
  { id: 'ngs', players: ['p18', 'p07'], group: 'B', seed: 3 },
  { id: 'bvr', players: ['p11', 'p05'], group: 'B' },
  { id: 'str', players: ['p20', 'p21'], group: 'B' },
  { id: 'fch', players: ['p25', 'p26'], group: 'B' },
  { id: 'hor', players: ['p17', 'p12'], group: 'C', seed: 4 },
  { id: 'dee', players: ['p13', 'p14'], group: 'C' },
  { id: 'lme', players: ['p15', 'p19'], group: 'C' },
  { id: 'ssh', players: ['p27', 'p28'], group: 'C' },
  { id: 'gyu', players: ['p06', 'p09'], group: 'D', seed: 2 },
  { id: 'szh', players: ['p02', 'p04'], group: 'D' },
  { id: 'azo', players: ['p16', 'p22'], group: 'D' },
  { id: 'nuv', players: ['p29', 'p30'], group: 'D' },
];

// ---------- «вы» ----------

export const ME = {
  player: 'p17',
  pair: 'hor',
  match: 'final',          // ваш матч сегодня, 20:00
  // сезон 2027 по порядку: апрель — 7 матчей (финал, 4:6), май — 6 (третьи в группе,
  // полуфинал второй категории), июнь — 5 побед до финала. Весь сезон — с Орловым.
  season: {
    won: 12, lost: 6,
    form: 'WWLWWWL' + 'LLWWLL' + 'WWWWW',
    stages: [{ id: 'apr-1', matches: 7 }, { id: 'may-2', matches: 6 }, { id: 'jun-3', matches: 5 }],
    lastSay: 'Последний — 6:4 в полуфинале',
  },
  // напарники: together — матчей вместе за всё время в лиге (не за сезон); подпись — «33 матча за всё время».
  // С Орловым: 15 матчей сезона 2026 и 18 — сезона 2027.
  partners: [{ player: 'p12', together: 33, scope: 'за всё время' }, { player: 'p06', together: 5, scope: 'за всё время' }],
};

// ---------- сезон и турниры ----------

// Сезон 2027: этапы по порядку.
export const SEASON = { year: 2027, order: ['apr-1', 'may-2', 'jun-3', 'jul-4'] };

export const TOURNAMENT = {
  id: 'jun-3',
  name: 'Июньский кубок',
  stage: 'Этап 3',
  category: 'Высшая категория',
  dates: '12–19 июня',
  format: 'Один сет до 6, тай-брейк до 7',
  state: 'live',
  groups: ['A', 'B', 'C', 'D'],
  groupDays: ['12 июня', '13 июня', '14 июня'],   // туры группы по дням
  rounds: [
    { key: 'qf', label: 'Четвертьфиналы', short: '1/4' },
    { key: 'sf', label: 'Полуфиналы', short: '1/2' },
    { key: 'f', label: 'Финал', short: 'Ф' },
  ],
};

// Покрытие этапа — покрытие корта, где играют его финалы (court).
// Июльский этап: коридор суммы КПР пары и жеребьёвка.
export const TOURNAMENTS = [
  { id: 'jun-3', name: 'Июньский кубок', stage: 'Этап 3', dates: '12–19 июня', state: 'live', pairs: 16, note: 'Сегодня финал', month: 'Июнь', court: 'c1', surface: 'clay' },
  { id: 'jul-4', name: 'Июльский кубок', stage: 'Этап 4', dates: '10–17 июля', state: 'open', pairs: 9, slots: 16, note: 'Заявки до 5 июля', month: 'Июль', court: 'c4', surface: 'grass', corridor: [7.0, 8.5], draw: '2027-07-07', drawLabel: '7 июля' },
  { id: 'may-2', name: 'Майский кубок', stage: 'Этап 2', dates: '15–22 мая', state: 'done', pairs: 16, winner: 'osv', month: 'Май', court: 'c1', surface: 'clay' },
  { id: 'apr-1', name: 'Кубок открытия', stage: 'Этап 1', dates: '17–24 апреля', state: 'done', pairs: 14, winner: 'szh', month: 'Апрель', court: 'c5', surface: 'hard' },
];

// Что даёт место в группе: 1–2 — плей-офф высшей категории, 3–4 — второй (как through в groupTable).
export const CUT = 2;
// Баллы рейтинга за стадию плей-офф: высшая / вторая категория.
export const STAGE_POINTS = [
  { key: 'qf', label: 'Четвертьфинал', top: 75, second: 25 },
  { key: 'sf', label: 'Полуфинал', top: 150, second: 35 },
  { key: 'f', label: 'Финал', top: 250, second: 50 },
  { key: 'win', label: 'Победа', top: 450, second: 90 },
];

// ---------- матчи ----------
// state: 'soon' | 'live' | 'done'.
// sets — счёт по сетам: [[геймы пары 0, геймы пары 1, тай-брейк проигравшего?]].
// winner — 0 или 1 (индекс в pairs).
// pointLog — розыгрыш очко за очком (0 — очко паре 0, 1 — паре 1), firstServer — кто подавал первым.
// По нему движок счёта (score.js) восстанавливает геймы, подачу и брейки.
// Живой матч: games, points, server (кто подаёт) и pointLog с начала до этой минуты.

const G = (id, group, a, b, s0, s1, day) => ({ id, round: 'group', group, title: `Группа ${group}`, day, state: 'done', pairs: [a, b], sets: [[s0, s1]], winner: s0 > s1 ? 0 : 1 });

const GROUP_MATCHES = [
  G('gA1', 'A', 'osv', 'ilk', 6, 4, '12 июня'), G('gA2', 'A', 'prb', 'cyh', 6, 4, '12 июня'),
  G('gA3', 'A', 'osv', 'prb', 6, 2, '13 июня'), G('gA4', 'A', 'ilk', 'cyh', 6, 2, '13 июня'),
  G('gA5', 'A', 'osv', 'cyh', 6, 1, '14 июня'), G('gA6', 'A', 'ilk', 'prb', 6, 3, '14 июня'),
  G('gB1', 'B', 'ngs', 'bvr', 7, 5, '12 июня'), G('gB2', 'B', 'str', 'fch', 6, 3, '12 июня'),
  G('gB3', 'B', 'ngs', 'str', 6, 1, '13 июня'), G('gB4', 'B', 'bvr', 'fch', 6, 2, '13 июня'),
  G('gB5', 'B', 'ngs', 'fch', 6, 0, '14 июня'), G('gB6', 'B', 'bvr', 'str', 6, 4, '14 июня'),
  G('gC1', 'C', 'hor', 'dee', 6, 3, '12 июня'), G('gC2', 'C', 'lme', 'ssh', 6, 4, '12 июня'),
  G('gC3', 'C', 'hor', 'lme', 6, 2, '13 июня'), G('gC4', 'C', 'dee', 'ssh', 7, 6, '13 июня'),
  G('gC5', 'C', 'ssh', 'hor', 4, 6, '14 июня'), G('gC6', 'C', 'dee', 'lme', 6, 4, '14 июня'),
  G('gD1', 'D', 'gyu', 'szh', 6, 4, '12 июня'), G('gD2', 'D', 'azo', 'nuv', 6, 2, '12 июня'),
  G('gD3', 'D', 'gyu', 'azo', 6, 3, '13 июня'), G('gD4', 'D', 'szh', 'nuv', 6, 1, '13 июня'),
  G('gD5', 'D', 'nuv', 'gyu', 2, 6, '14 июня'), G('gD6', 'D', 'szh', 'azo', 6, 4, '14 июня'),
];
GROUP_MATCHES.find((m) => m.id === 'gC4').sets[0].push(4); // 7:6, тай-брейк 7:4

// Розыгрыш матча за 3-е место до счёта 4:3, 30:15, подают Назаров / Гасанов (0 — очко паре 0, 1 — паре 1).
const SHAPES = {
  love: (w) => [w, w, w, w],
  15: (w, l) => [w, l, w, w, w],
  30: (w, l) => [w, l, l, w, w, w],
  deuce: (w, l) => [w, w, w, l, l, l, w, w],
};
const BRONZE_LOG = (() => {
  const out = [];
  for (const item of ['15:0', '30:1', 'deuce:0', '15:1', '30:0', 'love:1', '15:0']) {
    const [k, w] = item.split(':');
    out.push(...SHAPES[k](+w, 1 - +w));
  }
  out.push(0, 1, 0);
  return out;
})();
// розыгрыш строками геймов: '00100' — гейм, где паре 0 достались очки 1, 2, 4 и 5
const LOG = (...games) => games.join('').split('').map(Number);

export const MATCHES = [
  ...GROUP_MATCHES,
  // четвертьфиналы, пятница 18 июня 2027
  { id: 'qf1', round: 'qf', title: 'Четвертьфинал', day: '18 июня', time: '17:00', court: 'c1', state: 'done', pairs: ['osv', 'bvr'], sets: [[6, 3]], winner: 0 },
  { id: 'qf2', round: 'qf', title: 'Четвертьфинал', day: '18 июня', time: '17:00', court: 'c3', state: 'done', pairs: ['ngs', 'ilk'], sets: [[6, 4]], winner: 0 },
  // первыми подают Сарсенбаев / Жаксыбеков; брейк на 5:4, подача на сет не удалась, тай-брейк 7:5
  {
    id: 'qf3', round: 'qf', title: 'Четвертьфинал', day: '18 июня', time: '18:30', court: 'c1', state: 'done', pairs: ['hor', 'szh'], sets: [[7, 6, 5]], winner: 0,
    firstServer: 1,
    pointLog: LOG('11011', '00100', '1111', '00101100', '110101', '00010', '10111', '01000', '001100', '10100111', '11101', '00010', '011010100100'),
  },
  { id: 'qf4', round: 'qf', title: 'Четвертьфинал', day: '18 июня', time: '18:30', court: 'c3', state: 'done', pairs: ['gyu', 'dee'], sets: [[6, 2]], winner: 0 },
  // сегодня
  // первыми подают Хван / Орлов; отдали подачу в 3-м гейме, отставали 1:3 и 2:4, в 6-м не взяли
  // два брейк-пойнта, дальше четыре гейма подряд: брейк в 8-м, решающее очко в 9-м, брейк на матчболе
  {
    id: 'sf1', round: 'sf', title: 'Полуфинал', day: '19 июня', time: '10:00', court: 'c1', state: 'done', pairs: ['hor', 'gyu'], sets: [[6, 4]], winner: 0, duration: '52 мин',
    firstServer: 0,
    pointLog: LOG('00100', '101011', '011011', '1111', '010010', '00101111', '00010', '010010', '010101100', '00100'),
  },
  { id: 'sf2', round: 'sf', title: 'Полуфинал', day: '19 июня', time: '11:30', court: 'c1', state: 'done', pairs: ['osv', 'ngs'], sets: [[6, 3]], winner: 0, duration: '44 мин' },
  { id: 'c5a', round: 'cons', title: 'За 5–8 места', day: '19 июня', time: '13:00', court: 'c2', state: 'done', pairs: ['bvr', 'ilk'], sets: [[6, 2]], winner: 0, duration: '38 мин' },
  { id: 'c5b', round: 'cons', title: 'За 5–8 места', day: '19 июня', time: '13:00', court: 'c4', state: 'done', pairs: ['dee', 'szh'], sets: [[7, 5]], winner: 0, duration: '61 мин' },
  { id: 'p7', round: 'cons', title: 'За 7-е место', day: '19 июня', time: '16:30', court: 'c4', state: 'done', pairs: ['szh', 'ilk'], sets: [[6, 4]], winner: 0, duration: '47 мин' },
  {
    id: 'third', round: 'third', title: 'За 3-е место', day: '19 июня', time: '18:00', court: 'c3', state: 'live',
    pairs: ['gyu', 'ngs'], games: [4, 3], points: ['30', '15'], server: 1, elapsed: '47:12',
    firstServer: 0,
    pointLog: BRONZE_LOG,
    h2h: { record: '0–1', last: 'Майский кубок, группа A · 5:7' },
  },
  { id: 'p5', round: 'cons', title: 'За 5-е место', day: '19 июня', time: '19:00', court: 'c2', state: 'soon', pairs: ['bvr', 'dee'] },
  // личные встречи финалистов — от последней к первой; score — со стороны первой пары матча
  {
    id: 'final', round: 'f', title: 'Финал', day: '19 июня', time: '20:00', court: 'c1', state: 'soon', pairs: ['hor', 'osv'],
    h2h: {
      record: '1–1', last: 'Кубок открытия, полуфинал · 6:4',
      list: [
        { tournament: 'Кубок открытия', stage: 'полуфинал', when: 'апрель 2027', score: '6:4', winner: 0 },
        { tournament: 'Итоговый турнир', stage: 'группа', when: '2026', score: '4:6', winner: 1 },
      ],
    },
  },
];

// Расписание сегодняшнего дня по времени.
export const SCHEDULE = ['sf1', 'sf2', 'c5a', 'c5b', 'p7', 'third', 'p5', 'final'];

// Сетка плей-офф: четвертьфиналы → полуфиналы → финал, отдельно матч за 3-е место.
export const BRACKET = {
  qf: ['qf3', 'qf4', 'qf1', 'qf2'],
  sf: ['sf1', 'sf2'],
  f: ['final'],
  third: 'third',
};

// ---------- день на кортах: вызовы и судьи ----------
// Журнал дня до 18:47. Вызов делает директор турнира, отметку «на корте» — судья матча.
// [время, 'call' | 'oncourt', матч, пара]
export const DAY_LOG = [
  ['09:41', 'call', 'sf1'],
  ['09:47', 'oncourt', 'sf1', 'hor'],
  ['09:50', 'oncourt', 'sf1', 'gyu'],
  ['11:10', 'call', 'sf2'],
  ['11:16', 'oncourt', 'sf2', 'osv'],
  ['11:19', 'oncourt', 'sf2', 'ngs'],
  ['12:40', 'call', 'c5a'],
  ['12:40', 'call', 'c5b'],
  ['12:44', 'oncourt', 'c5a', 'bvr'],
  ['12:45', 'oncourt', 'c5b', 'dee'],
  ['12:47', 'oncourt', 'c5a', 'ilk'],
  ['12:51', 'oncourt', 'c5b', 'szh'],
  ['16:10', 'call', 'p7'],
  ['16:15', 'oncourt', 'p7', 'szh'],
  ['16:18', 'oncourt', 'p7', 'ilk'],
  ['17:40', 'call', 'third'],
  ['17:46', 'oncourt', 'third', 'gyu'],
  ['17:49', 'oncourt', 'third', 'ngs'],
  ['18:45', 'call', 'p5'],             // пары ещё не дошли: Кодекс даёт 20 минут
];

// Сегодня судья — «вы»: после полуфинала свободен до своего финала и судит четыре матча дня
// (13:00 корт 2, 16:30 корт 4, 18:00 корт 3, 19:00 корт 2). Финал играет сам, его в списке нет.
export const JUDGE = {
  player: 'p17',
  matches: ['c5a', 'p7', 'third', 'p5'],
  sent: ['c5a', 'p7'],     // результаты, которые судья уже отправил
};

// ---------- поиск пары на июльский этап ----------
// Кто ищет пару (id игроков). Пары июня с суммой КПР выше 8.5 (Оспанов / Савельев,
// Сарсенбаев / Жаксыбеков) и ниже 7.0 в коридор июля не входят — их игроки ищут новых напарников.
export const SEEKERS = ['p06', 'p10', 'p02', 'p15', 'p24', 'p01', 'p32'];
// Приглашения в пару на сегодня: Савельев зовёт вас.
export const INVITES = [{ player: 'p10', dir: 'in', when: 'сегодня в 12:10', tournament: 'jul-4' }];

// ---------- справочные функции ----------

const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
const PLAYER = byId(PLAYERS);
const PAIR = byId(PAIRS);
const MATCH = byId(MATCHES);

export const player = (id) => PLAYER[id];
export const pair = (id) => PAIR[id];
export const match = (id) => MATCH[id];
export const court = (id) => COURTS[id];
export const tournament = (id) => TOURNAMENTS.find((t) => t.id === id);
export const rankLabel = (level) => RANKS[level - 1]?.label || '';
export const initials = (p) => `${p.first[0]}${p.last[0]}`;
export const portraitSrc = (p, size = 'sm') => (p.portrait ? `img/${p.portrait}${size === 'sm' ? '-sm' : ''}.webp` : null);
export const isMe = (playerId) => playerId === ME.player;
// пара игрока на июньском этапе
export const pairOf = (playerId) => PAIRS.find((x) => x.players.includes(playerId)) || null;

// «Хван / Орлов»
export const pairName = (id) => pair(id).players.map((x) => player(x).last).join(' / ');
// для подписи в две строки
export const pairLines = (id) => pair(id).players.map((x) => player(x).last);
// «Хвана» — для фразы «Ровно на подаче Хвана»
export const genitive = (last) => (/[бвгджзклмнпрстфхцчшщ]$/.test(last) ? `${last}а` : last);

// «Корт 3 · грунт»
export const courtLine = (id) => `${COURTS[id].name} · ${SURFACES[COURTS[id].surface].label}`;

// Счёт сыгранного матча для строки: «6:4», «7:6⁵»
export const setsText = (m, side = 0) => m.sets.map(([a, b]) => (side === 0 ? `${a}:${b}` : `${b}:${a}`)).join(' ');

// Вызовы на корт, по которым матч ещё не начался (для табло и пульта дня).
export const CALLS = DAY_LOG
  .filter(([, kind, id]) => kind === 'call' && MATCH[id] && MATCH[id].state === 'soon')
  .map(([at, , id]) => ({ match: id, at }));

// ---------- таблица группы (считается из матчей) ----------

export function groupTable(g) {
  const rows = PAIRS.filter((p) => p.group === g).map((p) => ({ pair: p.id, played: 0, won: 0, lost: 0, gf: 0, ga: 0 }));
  const row = byId(rows.map((r) => ({ ...r, id: r.pair })));
  for (const m of GROUP_MATCHES.filter((x) => x.group === g)) {
    const [a, b] = m.pairs;
    const [ga, gb] = m.sets[0];
    row[a].played++; row[b].played++;
    row[a].gf += ga; row[a].ga += gb; row[b].gf += gb; row[b].ga += ga;
    if (m.winner === 0) { row[a].won++; row[b].lost++; } else { row[b].won++; row[a].lost++; }
  }
  return Object.values(row)
    .sort((x, y) => y.won - x.won || (y.gf - y.ga) - (x.gf - x.ga))
    .map((r, i) => ({ place: i + 1, pair: r.pair, played: r.played, won: r.won, lost: r.lost, games: `${r.gf}:${r.ga}`, through: i < CUT }));
}

// ---------- рейтинг: первая тридцатка ----------
// delta — изменение места за неделю (плюс — поднялся). Неделя 12–19 июня — это и есть июньский этап.

const DELTA = { p01: 0, p02: 0, p03: 1, p04: -1, p05: 0, p06: 2, p07: 0, p08: -2, p09: 1, p10: -1, p11: 0, p12: 3, p13: -1, p14: 0, p15: -2, p16: 0, p17: 2, p18: 4, p19: -3, p20: 0 };
export const RATING = PLAYERS.slice()
  .sort((a, b) => a.place - b.place)
  .slice(0, 30)
  .map((p) => ({ place: p.place, player: p.id, points: p.points, delta: DELTA[p.id] || 0 }));

// ---------- карьера игроков (до июньского этапа) ----------
// early  — апрельский и майский этапы 2027 по порядку: W — победа, L — поражение (июнь — из MATCHES)
// tours  — турниров в лиге за всё время
// semis, finals — полуфиналы и финалы высшей категории до июньского этапа
// wins   — победы на этапах высшей категории до 2027 года (победы 2027 года — TOURNAMENTS.winner)
// cup    — победы в Итоговом турнире; second — победы во второй категории
// mates  — напарники за всё время: [игрок, матчей вместе]; первый — напарник июньского этапа
// vs     — встречи с вами до июньского этапа: [ваши победы, его победы, «турнир, круг · счёт» последней
//          встречи] (счёт глазами вашей пары, как h2h). Июньские встречи считаются из MATCHES.
// Звание в PLAYERS следует из этих чисел по лестнице RANKS. Ваш сезон — ME.season.
const C = (early, tours, semis, finals, wins, cup, second, mates, vs = null) =>
  ({ early, tours, semis, finals, wins, cup, second, mates, vs });

export const CAREER = {
  p01: C('WWWWLWWWWWWW', 30, 17, 12, 6, 2, 0, [['p10', 44], ['p02', 8]], [1, 1, 'Кубок открытия, полуфинал · 6:4']),
  p02: C('WWWWWWLWWL', 26, 9, 5, 1, 0, 0, [['p04', 27], ['p01', 8]], [0, 1, 'Кубок открытия, финал · 4:6']),
  p03: C('WLWWLWWL', 24, 6, 3, 2, 0, 0, [['p08', 12], ['p11', 9]], [0, 2, 'Майский кубок, группа B · 3:6']),
  p04: C('WWWWWWLWWL', 28, 8, 4, 0, 0, 1, [['p02', 27], ['p05', 4]], [0, 1, 'Кубок открытия, финал · 4:6']),
  p05: C('WLWWWLLW', 20, 4, 1, 0, 0, 0, [['p11', 14], ['p04', 4]], [1, 1, 'Кубок открытия, группа A · 6:3']),
  p06: C('WWLWWLW', 19, 3, 0, 0, 0, 1, [['p09', 19], ['p17', 5]], [0, 1, 'Майский кубок, вторая категория, полуфинал · 4:6']),
  p07: C('WLWLWWL', 14, 2, 1, 0, 0, 0, [['p18', 8], ['p05', 6]], [1, 0, 'Кубок открытия, четвертьфинал · 6:3']),
  p08: C('WLLWWLW', 13, 1, 0, 0, 0, 0, [['p03', 12], ['p13', 3]], [0, 2, 'Майский кубок, группа B · 3:6']),
  p09: C('WWLWWLW', 17, 1, 0, 0, 0, 0, [['p06', 19], ['p16', 4]], [0, 1, 'Майский кубок, вторая категория, полуфинал · 4:6']),
  p10: C('WWWWLWWWWWWW', 27, 7, 3, 0, 0, 0, [['p01', 44], ['p12', 3]], [1, 1, 'Кубок открытия, полуфинал · 6:4']),
  p11: C('LWWLWLW', 14, 1, 0, 0, 0, 0, [['p05', 14], ['p03', 9]], [1, 1, 'Кубок открытия, группа A · 6:3']),
  p12: C('', 15, 2, 2, 0, 0, 0, [['p17', 33], ['p10', 3]]),
  p13: C('LWLWWL', 12, 1, 0, 0, 0, 0, [['p14', 16], ['p08', 3]]),
  p14: C('LWLWWL', 11, 1, 0, 0, 0, 0, [['p13', 16]]),
  p15: C('WLLWL', 10, 0, 0, 0, 0, 0, [['p19', 10], ['p22', 4]]),
  p16: C('WLWLWL', 12, 1, 0, 0, 0, 0, [['p22', 11], ['p09', 4]]),
  p17: C('', 14, 2, 2, 0, 0, 0, [['p12', 33], ['p06', 5]]),
  p18: C('WLWWL', 9, 0, 0, 0, 0, 0, [['p07', 8]], [1, 0, 'Кубок открытия, четвертьфинал · 6:3']),
  p19: C('WLLWL', 9, 0, 0, 0, 0, 0, [['p15', 10]]),
  p20: C('LWLWL', 8, 0, 0, 0, 0, 0, [['p21', 13]]),
  p21: C('LWLWL', 7, 0, 0, 0, 0, 0, [['p20', 13]]),
  p22: C('WLWLL', 9, 0, 0, 0, 0, 0, [['p16', 11], ['p15', 4]]),
  p23: C('LWLL', 7, 0, 0, 0, 0, 0, [['p24', 9]]),
  p24: C('LWLL', 6, 0, 0, 0, 0, 0, [['p23', 9]]),
  p25: C('WLLL', 6, 0, 0, 0, 0, 0, [['p26', 12]]),
  p26: C('WLLL', 6, 0, 0, 0, 0, 0, [['p25', 12]]),
  p27: C('LWLL', 6, 0, 0, 0, 0, 0, [['p28', 5], ['p30', 4]]),
  p28: C('LLW', 4, 0, 0, 0, 0, 0, [['p27', 5]]),
  p29: C('LWL', 4, 0, 0, 0, 0, 0, [['p30', 7]]),
  p30: C('LWL', 3, 0, 0, 0, 0, 0, [['p29', 7], ['p27', 4]]),
  p31: C('LWL', 2, 0, 0, 0, 0, 0, [['p32', 6]]),
  p32: C('LWL', 2, 0, 0, 0, 0, 0, [['p31', 6]]),
};

// ---------- прошлый сезон 2026 (признание сезона) ----------
// Награды публикуют после Итогового турнира, поэтому сегодня в приложении — признание сезона 2026.
const DONE = { proposed: true, confirmed: true, agreed: true, published: true };

export const PAST_SEASON = {
  year: 2026,
  // пять турниров: четыре этапа и Итоговый
  tournaments: [
    { id: 't1', name: 'Кубок открытия', gen: 'Кубка открытия', month: 'Апрель', monthGen: 'апреля', short: 'Апр' },
    { id: 't2', name: 'Майский кубок', gen: 'Майского кубка', month: 'Май', monthGen: 'мая', short: 'Май' },
    { id: 't3', name: 'Июньский кубок', gen: 'Июньского кубка', month: 'Июнь', monthGen: 'июня', short: 'Июн' },
    { id: 't4', name: 'Июльский кубок', gen: 'Июльского кубка', month: 'Июль', monthGen: 'июля', short: 'Июл' },
    { id: 't5', name: 'Итоговый турнир', gen: 'Итогового турнира', month: 'Сентябрь', monthGen: 'сентября', short: 'Сен' },
  ],
  // «Гладиатор корта»: больше всех тай-брейков (7:6) за сезон; при равенстве выше тот, кто больше выиграл.
  // tiebreaks: турнир, стадия ('' — группа), корт, счёт сета с его стороны, очки тай-брейка у проигравшего.
  // Полуфинал Июльского он проиграл Хвану и Орлову (у них это тай-брейк 7:6⁵).
  gladiator: {
    title: 'Гладиатор корта',
    rule: 'Больше всех тай-брейков за сезон',
    player: 'p09',
    steps: DONE,
    tiebreaks: [
      { t: 't1', stage: '', court: 'c3', score: [7, 6], tb: 5 },
      { t: 't2', stage: '1/4', court: 'c1', score: [6, 7], tb: 4 },
      { t: 't3', stage: '', court: 'c4', score: [7, 6], tb: 8 },
      { t: 't4', stage: '', court: 'c2', score: [7, 6], tb: 3 },
      { t: 't4', stage: '1/2', court: 'c1', score: [6, 7], tb: 5 },
      { t: 't5', stage: '', court: 'c5', score: [7, 6], tb: 6 },
    ],
    matches: 24,
  },
  // первые по счёту тай-брейков и сколько из них выиграно (имена других не публикуются)
  tiebreakTable: [
    { player: 'p09', tiebreaks: 6, won: 4 },
    { player: 'p07', tiebreaks: 5, won: 2 },
    { player: 'p04', tiebreaks: 4, won: 3 },
    { player: 'p13', tiebreaks: 4, won: 1 },
    { player: 'p17', tiebreaks: 2, won: 2 },
  ],
  // «Дуэт сезона»: пара, сыгравшая вместе больше всех турниров сезона.
  // Оспанов и Савельев впервые сыграли вместе на Кубке открытия 2026 и прошли вместе весь сезон.
  // В 2027-м: Кубок открытия (полуфинал, 6 матчей), Майский кубок (победа, 6 матчей), Июньский — сегодня финал.
  duo: {
    title: 'Дуэт сезона',
    rule: 'Больше всех турниров вместе за сезон',
    pair: 'osv',
    steps: DONE,
    season: ['t1', 't2', 't3', 't4', 't5'],
    matches: 27,
    since: 't1',
    before: [{ tournament: 'apr-1', matches: 6 }, { tournament: 'may-2', matches: 6 }],   // турниры 2027 года до Июньского
  },
  // турниров вместе за сезон у первых по счёту пар
  duoTable: [
    { pair: 'osv', tournaments: 5 },
    { pair: 'ngs', tournaments: 4 },
    { pair: 'gyu', tournaments: 4 },
    { pair: 'hor', tournaments: 3 },
  ],
  // ваш сезон 2026: четыре турнира из пяти (Майский пропустили). С Орловым — три турнира, 15 матчей
  // (вместе с 18 матчами 2027 года это 33 «за всё время», как ME.partners). С Громовым — Кубок открытия
  // в группе из трёх пар. Финал Июльского кубка — звание «Призёр» у обоих.
  me: {
    player: 'p17',
    tournaments: [
      { t: 't1', partner: 'p06', form: 'WL', result: 'Группа' },
      { t: 't3', partner: 'p12', form: 'WWLLWW', result: '5-е место' },
      { t: 't4', partner: 'p12', form: 'WWWWWL', result: 'Финал', final: [4, 6] },
      { t: 't5', partner: 'p12', form: 'LWL', result: 'Группа' },
    ],
    tiebreaks: 2,
    tiebreaksWon: 2,
  },
};

// ---------- кандидат в лигу ----------
// Подаёт заявку на вступление. В рейтинге и сетках не играл, портрета нет (в кружке — инициалы).
// Телефон целиком не хранится: в сводке анкеты — только последние цифры.
export const APPLICANT = {
  first: 'Арман',
  last: 'Есенов',
  email: 'arman.esenov@example.com',
  phoneTail: '23',
  birth: '14.03.1988',
  pairYears: '6',
  hand: 'right',
  backhand: 'two',
};

// 1 620 — число с неразрывным пробелом между разрядами
export const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
