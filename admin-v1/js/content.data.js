// Новости, альбомы и статьи о лиге — для экранов «Новости и фото».
// В общем мире (data.js) материалов нет, поэтому здесь они собраны только из его фактов:
// названия этапов, даты, победители, корты, финал дня, правила записи.
// Своих имён, сумм и сроков нет. Подписи к портретам — имена игроков из мира.
// Фото — кадры из снимков приложения (img/content-*.webp).
//
// Что человек сделал с материалом, лежит в общем состоянии (admin.js → state):
//   news.<новость>   { kind, state: 'draft'|'live'|'off', title, text, cover, places, outlet, link,
//                      saved, since, at, ts, pub, deleted }
//   albums.<альбом>  { state: 'draft'|'live'|'off', photos, cover, uploaded, since, at, ts, pub }
// at — «18:52» для слов, ts — когда меняли (порядок в «Недавнем»).
// newsRec(id), newsAll(), albumRec(id) — мир вместе со сделанным; так их видят все страницы.
import { D, at, pairAnd, rangeShort, dayWords, gen, state } from '../admin.js';
import { seasonStages, byDate } from './start.js';

// ---------- фото ----------
// Портрет d04 — это Данияр Оспанов и так далее: имя берём у игрока с этим портретом.
const who = (key) => {
  const p = D.PLAYERS.find((x) => x.portrait === key.slice(0, 3));
  return p ? p.name : '';
};
export const photo = (key) => ({ key, src: at(`img/content-${key}.webp`), cap: /^d\d\d/.test(key) ? who(key) : '' });

// ---------- этапы ----------
const S = (id) => D.stage(id);
const finalM = D.match('final');
const thirdM = D.match('third');
const court = (id) => D.COURTS[id].name;
const jul = S('jul-4');
// «Оспанова и Савельева» — для «играют против …»
const pairGen = (id) => D.pair(id).players.map((x) => D.genitive(D.player(x).last)).join(' и ');

// ---------- места в приложении ----------
// Предложенные места: новость — «Сегодня» → «Новости лиги»; новость турнира — ещё и «Турнир» → «Новости»;
// фото турнира — «Турнир» → «Фото». В самом приложении этих мест пока нет: появятся со следующей версии,
// решает владелец лиги. Поэтому рядом с местом в приложении всегда стоит «со следующей версии»,
// а предпросмотр приложения помечен как будущий вид. Статья о лиге — только на сайте («Пресса о лиге»).
export const APP_NEWS = true;
export const APP_NEWS_PLACE = '«Сегодня» → «Новости\u00a0лиги»';
export const APP_PHOTOS_PLACE = '«Турнир» → «Фото»';
export const APP_NEXT = 'со\u00a0следующей версии';
export const APP_FUTURE = 'Будущий вид: в приложении это появится со\u00a0следующей версии';

// ---------- новости ----------
// state: 'draft' — черновик; 'live' — видно игрокам; 'off' — снято с публикации.
// places: site — сайт («Новости» и главная), app — приложение («Сегодня» → «Новости лиги»), tour — id этапа или null.
export const NEWS = [
  {
    id: 'jun-final', state: 'draft', saved: 'вчера в 22:10', tour: 'jun-3',
    title: 'Июньский кубок: финал',
    text: [
      `${dayWords(D.NOW.iso, { cap: true })}, ${finalM.time}, ${court(finalM.court).toLowerCase()} — финал «${gen(S('jun-3').name)}». ${pairAnd(finalM.pairs[0])} играют против ${pairGen(finalM.pairs[1])}.`,
      `До финала, в ${thirdM.time} на корте ${thirdM.court.slice(1)}, — матч за 3-е место: ${pairAnd(thirdM.pairs[0])} против ${pairGen(thirdM.pairs[1])}.`,
    ].join('\n\n'),
    cover: photo('court-1'),
    places: { site: true, app: true, tour: 'jun-3' },
  },
  {
    id: 'jul-open', state: 'live', tour: 'jul-4',
    title: `Открыта запись на «${jul.name}»`,
    text: `Этап ${jul.no}, ${rangeShort(jul.from, jul.to)}. Запись до ${rangeShort(jul.signupTo)}, жеребьёвка ${rangeShort(jul.draw)}. Сумма КПР пары — от ${D.RULES.corridor[0].toFixed(1)} до ${D.RULES.corridor[1].toFixed(1)}.`,
    cover: photo('hand-1'),
    places: { site: true, app: true, tour: 'jul-4' },
  },
  {
    id: 'may-win', state: 'live', tour: 'may-2',
    title: `${S('may-2').name}: победили ${pairAnd(S('may-2').winner)}`,
    text: `${S('may-2').name} — этап ${S('may-2').no}, ${rangeShort(S('may-2').from, S('may-2').to)}, ${S('may-2').pairs} пар. Победили ${pairAnd(S('may-2').winner)}.`,
    cover: photo('d04'),
    places: { site: true, app: false, tour: 'may-2' },
  },
  {
    id: 'apr-win', state: 'live', tour: 'apr-1',
    title: `${S('apr-1').name}: победили ${pairAnd(S('apr-1').winner)}`,
    text: `${S('apr-1').name} — этап ${S('apr-1').no}, ${rangeShort(S('apr-1').from, S('apr-1').to)}, ${S('apr-1').pairs} пар. Победили ${pairAnd(S('apr-1').winner)}.`,
    cover: photo('d01'),
    places: { site: true, app: false, tour: 'apr-1' },
  },
];
export const news = (id) => NEWS.find((n) => n.id === id);

// поля материала: то, что видят игроки (pub — показанное, остальное — правка)
export const FIELDS = ['title', 'text', 'cover', 'places', 'outlet', 'link'];
const copy = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
export const fieldsOf = (r) => Object.fromEntries(FIELDS.map((k) => [k, copy(r[k] ?? (k === 'cover' ? null : k === 'places' ? { site: true, app: false, tour: null } : ''))]));
export const sameFields = (a, b) => JSON.stringify(fieldsOf(a)) === JSON.stringify(fieldsOf(b));
// у кадра мира в памяти только key — адрес картинки считается здесь; у загруженного фото — уменьшенная копия
const coverIn = (c) => (c && c.key ? { key: c.key, src: photo(c.key).src, cap: c.cap || '' } : c);
const coverOut = (c) => (c && c.key ? { key: c.key, cap: c.cap || '' } : c);

// Новость сейчас: мир и сделанное. Новая (нет в мире) — только из состояния.
export function newsRec(id) {
  if (!id) return null;
  const w = news(id);
  const s = state.get(`news.${id}`);
  if (!w && !s) return null;
  const base = w
    ? { kind: 'news', state: w.state, ...fieldsOf({ ...w, outlet: '', link: '' }), saved: w.saved || '', since: '', at: '', pub: null, tour: w.tour, world: true }
    : { kind: 'news', state: 'draft', ...fieldsOf({}), saved: '', since: '', at: '', pub: null, tour: null };
  // показанная новость мира: игроки видят то, что в мире
  if (w && w.state === 'live') base.pub = fieldsOf(base);
  const r = { ...base, ...(s || {}), id };
  if (s && !('pub' in s)) r.pub = base.pub;
  r.cover = coverIn(r.cover);
  if (r.pub) r.pub = { ...r.pub, cover: coverIn(r.pub.cover) };
  r.tour = r.places && r.places.tour ? r.places.tour : base.tour;
  return r;
}
// все новости и статьи: сначала мир, потом добавленные в разделе; удалённых нет
export function newsAll() {
  const mine = Object.keys(state.get('news') || {}).filter((id) => !news(id));
  return [...NEWS.map((n) => n.id), ...mine].map(newsRec).filter((r) => r && !r.deleted);
}
// записать новость в общее состояние целиком; say — строка журнала со слов «Вы …»
export function putNews(r, opts) {
  const { id, world, tour, ...rest } = r;
  rest.cover = coverOut(rest.cover);
  if (rest.pub) rest.pub = { ...rest.pub, cover: coverOut(rest.pub.cover) };
  rest.ts = Date.now();
  return state.set(`news.${id}`, rest, opts);
}
export const newNewsId = (press) => `${press ? 'p' : 'n'}${Date.now().toString(36)}`;

// Пример хранит сделанное в памяти браузера — там около 5 МБ на сайт, и это место общее для всего раздела.
// Фото кладутся уменьшенными копиями; если новые не помещаются, их не добавляем и говорим об этом.
const ROOM = 4.2e6;
export const roomFor = (chars) => JSON.stringify(state.get('') || {}).length + chars < ROOM;

// ---------- альбомы ----------
// «Июньский кубок»: все 30 фото загружены, альбом ещё не показан. Другие альбомы видны игрокам.
// У опубликованных этапов без фото (следующие этапы, турниры из мастера) альбом пустой.
const JUN = ['ball-1', 'hand-1', 'court-1', 'd03', 'd10', 'd04', 'd05', 'court-2', 'ball-2', 'd06', 'd02', 'hand-2', 'd07', 'd08', 'court-3',
  'd01', 'd09', 'ball-3', 'hand-3', 'd04-bw', 'd05-bw', 'court-4', 'd10-bw', 'd03-bw', 'ball-4', 'd01-bw', 'hand-4', 'd07-bw', 'd09-bw', 'd02-bw'];
const MAY = ['d04', 'd05', 'ball-2', 'court-3', 'hand-1', 'd01', 'd09', 'd06-bw', 'd08-bw', 'court-1', 'ball-4', 'd02'];
const APR = ['d01', 'd09', 'court-2', 'ball-1', 'hand-2', 'd03-bw', 'd10-bw', 'd07', 'd08', 'court-4'];
export const ALBUMS = [
  { id: 'jun-3', state: 'draft', photos: JUN.map(photo), cover: 0 },
  { id: 'may-2', state: 'live', photos: MAY.map(photo), cover: 0 },
  { id: 'apr-1', state: 'live', photos: APR.map(photo), cover: 0 },
];
// Фото альбома: { id, key | src, cap, st: 'done'|'queued'|'wait', isNew }.
// У кадра из мира — key (адрес картинки считается), у загруженного — src (уменьшенная копия).
const srcOf = (p) => p.src || (p.key ? photo(p.key).src : '');
// Альбом сейчас: мир и сделанное. ready — всё уже загружено (для снимков).
export function albumRec(id, { ready = false } = {}) {
  const w = ALBUMS.find((a) => a.id === id) || (tourStage(id) ? { id, state: 'draft', photos: [], cover: 0 } : null);
  if (!w) return null;
  const photos = w.photos.map((p, i) => ({ id: `${id}-${i + 1}`, key: p.key, cap: p.cap, st: ready || w.uploaded == null || i < w.uploaded ? 'done' : 'queued', isNew: false }));
  const base = { state: w.state, photos, cover: photos[w.cover] ? photos[w.cover].id : null, since: '', at: '', pub: null };
  if (w.state === 'live') base.pub = { photos: photos.map((p) => ({ ...p })), cover: base.cover };
  const s = state.get(`albums.${id}`);
  const r = { ...base, ...(s || {}), id };
  r.photos = r.photos.map((p) => ({ ...p, src: srcOf(p), st: p.st === 'up' ? 'queued' : p.st || 'done' }));
  if (r.pub) r.pub = { ...r.pub, photos: r.pub.photos.map((p) => ({ ...p, src: srcOf(p) })) };
  r.uploaded = r.photos.filter((p) => p.st === 'done').length;
  r.name = tourName(id);
  return r;
}
// Альбомы на выбор: все опубликованные этапы, новые сверху (в один день — созданный позже выше)
export const albumIds = () => publishedTours().map((s) => s.id);
// показанный альбом изменён, а на сайте ещё старый
export const albumDirty = (a) => !!(a.state === 'live' && a.pub && JSON.stringify([a.photos.map((p) => [p.id, p.cap || '']), a.cover]) !== JSON.stringify([a.pub.photos.map((p) => [p.id, p.cap || '']), a.pub.cover]));
// записать альбом в общее состояние; у кадров мира адрес не храним — он считается из key
export function putAlbum(a, opts) {
  const slim = (p) => { const o = { id: p.id, cap: p.cap || '', st: p.st === 'up' ? 'queued' : p.st, isNew: !!p.isNew }; if (p.key) o.key = p.key; else o.src = p.src || ''; return o; };
  const rec = {
    state: a.state, cover: a.cover, since: a.since || '', at: a.at || '', ts: a.ts || 0,
    photos: a.photos.map(slim), uploaded: a.photos.filter((p) => p.st === 'done').length,
    pub: a.pub ? { photos: a.pub.photos.map(slim), cover: a.pub.cover } : null,
  };
  return state.set(`albums.${a.id}`, rec, opts);
}

// Уменьшенная копия загруженного фото: так оно переживает перезагрузку и видно на других страницах.
// HEIC и испорченный файл браузер не открывает — тогда null.
export async function shrink(file, max = 480, q = 0.74) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

// Статей о лиге в мире нет: первая появится на сайте в «Пресса о лиге».

// ---------- этапы: мир вместе с созданными в разделе ----------
// Турнир из мастера после публикации — такой же этап: к нему можно привязать новость и альбом.
export const tourStage = (id) => (id ? seasonStages().find((s) => s.id === id) || D.stage(id) || null : null);
export const tourName = (id) => (tourStage(id) || {}).name || '';
export const tourGen = (id) => (id ? gen(tourName(id)) : '');
export const tourSrf = (id) => (tourStage(id) || {}).surface || null;
// опубликованные этапы, новые сверху (черновик видит только админка)
const publishedTours = () => seasonStages().filter((s) => s.state !== 'draft').sort((a, b) => -byDate(a, b));
export const TOURS = publishedTours();

// ---------- дела для «Сегодня» (СОСТАВ.md, 1.1): дописать новость, показать фото турнира ----------
// [{ key, title, line, action, href }] — из мира и общего состояния; пусто, если всё сделано.
export function contentTodos() {
  const out = [];
  const draft = newsAll().filter((r) => r.state === 'draft')[0];
  if (draft) out.push({ key: 'news', title: draft.kind === 'press' ? 'Дописать статью о лиге' : 'Дописать новость', line: `«${draft.title.trim() || 'Без заголовка'}» — сохранено ${draft.saved || 'сегодня'}`, action: 'Продолжить', href: `post.html?id=${draft.id}` });
  const jun = albumRec('jun-3');
  if (jun && jun.state === 'draft') {
    const n = jun.photos.length;
    const line = jun.uploaded < n ? `загружено ${jun.uploaded} из ${n}` : `${n} фото загружены`;
    out.push({ key: 'photos', title: 'Показать фото турнира игрокам', line: `«${jun.name}»: ${line}, игроки их ещё не видят`, action: 'Открыть альбом', href: 'photos.html?album=jun-3' });
  }
  return out;
}
