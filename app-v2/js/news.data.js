// Мир новостей и альбомов — страницы-образцы (design/app-research/ЗАДАНИЕ-НОВОСТИ-И-ФОТО.md, раздел 3; работа Н4).
// Отдельный файл данных — исключение из правила SYSTEM.md «Своих файлов данных не заводите»: его копирует
// сервер. world:sync кладёт все js/*.data.js в server/src/seed/world/js/ (как data.js и desk.data.js), и сервер
// пишет мир новостей и альбомов в базу из этой копии. Поэтому здесь только данные: один импорт — ../data.js
// (без app.js, страницы и адресной строки) и ни одного адреса почты (файл с адресом world:sync не копирует).
// Правила (что видно, свежесть, подписи) и вид — в js/news.js. Поправили мир — следом world:sync в server/.
//
// Те же материалы, что в админке (admin-v1/js/content.data.js): номера, заголовки, тексты, кадры.
// «Дела дня» уже сделаны: в 18:40 показан альбом «Июньского кубка», в 18:45 опубликована новость
// «Июньский кубок: финал». Тексты собраны из фактов data.js; своих имён и чисел нет.
// Время — по часам лиги, «ГГГГ-ММ-ДДTЧЧ:ММ». Состояния — как у сервера: draft | shown | hidden.
import * as D from '../data.js';

// Кадр мира — img/news-<кадр>.webp (на сервере — media/news/<кадр>.webp), все 720 × 540.
export const FRAME_SIZE = { width: 720, height: 540 };

// Порядок фото — как в админке. Постоянный номер фото мира в альбоме — его место: 1, 2, 3…
// Обложка альбома — номер фото; на стене и в мозаике она первая.
// Кадр — это файл, фото — его место в альбоме. Один кадр стоит в нескольких альбомах (d01 и d09 — во всех
// трёх), внутри альбома кадры не повторяются. Фото узнают по этапу и номеру («jun-3:6»); номер для адреса
// на сервере, w-<кадр>, уникален только внутри альбома (NOTES-news.md, «Уникальность фото мира»).
// Подписи организатора — без имён: имя человека в подписи только с его согласия (раздел 8 задания),
// а отметка игроков на фото отложена вместе с местом 3.
const albumOf = (tournament, shownAt, frames, captions = {}) => ({
  tournament,
  state: 'shown',
  shownAt,
  cover: 1,
  photos: frames.map((frame, k) => ({ no: k + 1, frame, caption: captions[frame] || '' })),
});

export const ALBUMS = [
  albumOf('jun-3', `${D.TODAY.iso}T18:40`, [
    'ball-1', 'hand-1', 'court-1', 'd03', 'd10', 'd04', 'd05', 'court-2', 'ball-2', 'd06',
    'd02', 'hand-2', 'd07', 'd08', 'court-3', 'd01', 'd09', 'ball-3', 'hand-3', 'd04-bw',
    'd05-bw', 'court-4', 'd10-bw', 'd03-bw', 'ball-4', 'd01-bw', 'hand-4', 'd07-bw', 'd09-bw', 'd02-bw',
  ], { 'hand-1': 'Рукопожатие у сетки', 'court-1': 'Центральный корт вечером' }),
  // альбомы сыгранных этапов показаны после этапов: в блоке они уже не свежие,
  // а «Турнир» сыгранного этапа на страницах не открывается
  albumOf('may-2', '2027-05-22T21:30', ['d04', 'd05', 'ball-2', 'court-3', 'hand-1', 'd01', 'd09', 'd06-bw', 'd08-bw', 'court-1', 'ball-4', 'd02']),
  albumOf('apr-1', '2027-04-24T21:30', ['d01', 'd09', 'court-2', 'ball-1', 'hand-2', 'd03-bw', 'd10-bw', 'd07', 'd08', 'court-4']),
];

const T = (id) => D.tournament(id);
// «Июньский кубок» → «Июньского кубка», «Кубок открытия» → «Кубка открытия»
export const gen = (name) => name.replace(/ий кубок$/i, 'ого кубка').replace(/^Кубок /, 'Кубка ');
const pairAnd = (id) => D.pair(id).players.map((x) => D.player(x).last).join(' и ');
const pairGen = (id) => D.pair(id).players.map((x) => D.genitive(D.player(x).last)).join(' и ');
const finalM = D.match('final');
const thirdM = D.match('third');
const jul = T('jul-4');
const julTo = jul.note.replace(/^Заявки до /, '');
const winTitle = (id) => `${T(id).name}: победили ${pairAnd(T(id).winner)}`;
const winText = (id) => `${T(id).name} — ${T(id).stage.toLowerCase()}, ${T(id).dates}, ${T(id).pairs} пар. Победили ${pairAnd(T(id).winner)}.`;

// Новость: абзацы текста — через пустую строку; обложка — фото альбома «этап:номер» (как news:add --cover);
// места: app — приложение, site — сайт, tournamentPage — страница этапа на сайте; matches — до четырёх матчей.
export const NEWS = [
  {
    id: 'jun-final', state: 'shown', publishedAt: `${D.TODAY.iso}T18:45`, tournament: 'jun-3',
    places: { app: true, site: true, tournamentPage: true },
    title: `${T('jun-3').name}: финал`,
    text: [
      `${D.TODAY.label}, ${finalM.time}, ${D.court(finalM.court).name.toLowerCase()} — финал «${gen(T('jun-3').name)}». ${pairAnd(finalM.pairs[0])} играют против ${pairGen(finalM.pairs[1])}.`,
      `До финала, в ${thirdM.time} на корте ${thirdM.court.slice(1)}, — матч за 3-е место: ${pairAnd(thirdM.pairs[0])} против ${pairGen(thirdM.pairs[1])}.`,
    ].join('\n\n'),
    cover: 'jun-3:3',
    matches: ['third', 'final'],
  },
  {
    id: 'jul-open', state: 'shown', publishedAt: '2027-06-14T12:00', tournament: 'jul-4',
    places: { app: true, site: true, tournamentPage: true },
    title: `Открыта запись на «${jul.name}»`,
    text: `${jul.stage}, ${jul.dates}. Запись до ${julTo}, жеребьёвка ${jul.drawLabel}. Сумма КПР пары — от ${jul.corridor[0].toFixed(1)} до ${jul.corridor[1].toFixed(1)}.`,
    // альбом июльского этапа пуст: обложка — кадр из альбома «Июньского кубка»
    cover: 'jun-3:2',
    matches: [],
  },
  // итоги этапов — только на сайте: в приложении их и так видно в «Турнирах»
  {
    id: 'may-win', state: 'shown', publishedAt: '2027-05-22T21:00', tournament: 'may-2',
    places: { app: false, site: true, tournamentPage: true },
    title: winTitle('may-2'), text: winText('may-2'), cover: 'may-2:1', matches: [],
  },
  {
    id: 'apr-win', state: 'shown', publishedAt: '2027-04-24T21:00', tournament: 'apr-1',
    places: { app: false, site: true, tournamentPage: true },
    title: winTitle('apr-1'), text: winText('apr-1'), cover: 'apr-1:1', matches: [],
  },
];
