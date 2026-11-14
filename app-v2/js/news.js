// Новости и фото в приложении — страницы-образцы (design/app-research/ЗАДАНИЕ-НОВОСТИ-И-ФОТО.md, работа Н4).
// Владелец одобрил места 1 и 2 макета; место 3 («Игроки матча на фото») отложено и осталось
// предложением idea-news-match.html со своими файлами.
//
// Здесь правила и вид новостей и фото:
//   «Сегодня» → «Новости лиги» — последний блок экрана, после рейтинга (#r). На data-page="today" встаёт сам;
//   «Турнир» → вкладка «Фото» — albumFor(этап) говорит, есть ли вкладка, mountAlbum(панель, этап) её наполняет;
//   экран новости — news.html?id=<номер>. На data-page="news" рисуется сам;
//   просмотр фото на весь экран — openViewer(); ?view=N в адресе открывает N-е фото сразу.
// Мир — новости и альбомы раздела 3 задания — в js/news.data.js: его копирует сервер (world:sync).
// Блок подключён в index.html, вкладку в tournament.html ставит js/tour.js (работа Н5; NOTES-news.md).
//
// Личного здесь нет: гость, пользователь, кандидат, член лиги и показ видят одно и то же. Только в показе
// у плашки вашего матча тон «ваш матч» — его ставит tileHtml из app.js, как на других экранах.
import { D, VIEW, esc, icon, hydrate, tileHtml, liveTiles, shareSheet } from '../app.js';
import { NEWS, ALBUMS, FRAME_SIZE, gen } from './news.data.js';

/* =========================================================
   ПРАВИЛА: что видно и как подписано — так же ответит сервер 1.5
   ========================================================= */

const T = (id) => D.tournament(id);
const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const REDUCE = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Свежесть — целыми днями по часам лиги, а не минутами: часы показа каждые 45 минут возвращаются
// на 18:47, и новость, показанная в 19:05, не пропадает до 19:05 следующего круга.
// Сегодня — 0 дней, вчера — 1. Свежее — меньше 14 дней.
export const FRESH_DAYS = 14;
const MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAY = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const dayNo = (at) => Date.UTC(+at.slice(0, 4), +at.slice(5, 7) - 1, +at.slice(8, 10)) / 864e5;
export const daysAgo = (at) => dayNo(D.TODAY.iso) - dayNo(at);
const dayMonth = (at) => `${+at.slice(8, 10)} ${MON_GEN[+at.slice(5, 7) - 1]}`;
// «Суббота, 19 июня» — дата новости на её экране
export const dateWords = (at) => `${WEEKDAY[new Date(dayNo(at) * 864e5).getUTCDay()]}, ${dayMonth(at)}`;
// «Сегодня», «Вчера», «17 июня»
export const dayLabel = (at) => { const d = daysAgo(at); return d === 0 ? 'Сегодня' : d === 1 ? 'Вчера' : dayMonth(at); };
const plural = (n, one, few, many) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};

const withSrc = (p) => ({ ...p, src: `img/news-${p.frame}.webp`, w: FRAME_SIZE.width, h: FRAME_SIZE.height });
// фото альбома по ссылке «этап:номер» (обложка новости)
function photoAt(ref) {
  if (!ref) return null;
  const [tid, no] = String(ref).split(':');
  const a = ALBUMS.find((x) => x.tournament === tid);
  const p = a && a.photos.find((x) => x.no === Number(no));
  return p ? { ...withSrc(p), album: tid } : null;
}
// фото альбома по порядку, обложка первой
export function photosOf(a) {
  const list = a.photos.map(withSrc);
  const k = list.findIndex((p) => p.no === a.cover);
  if (k > 0) list.unshift(...list.splice(k, 1));
  return list;
}

// Показанный альбом этапа — с ним есть вкладка «Фото». Альбом не показан или пуст — вкладки нет.
// ?album=0 — вид без альбома: нет вкладки и фото в новости.
export function albumFor(tourId) {
  if (Q.get('album') === '0') return null;
  const a = ALBUMS.find((x) => x.tournament === tourId);
  return a && a.state === 'shown' && a.photos.length ? a : null;
}
// Новость, которую видно в приложении; снятой, черновика и новости «только сайт» — нет.
export function newsFor(id) {
  const n = NEWS.find((x) => x.id === id);
  return n && n.state === 'shown' && n.places.app && daysAgo(n.publishedAt) >= 0 ? n : null;
}

const stagePlaying = (id) => { const t = id && T(id); return !!t && t.state !== 'done'; };
// новость свежая 14 дней с публикации; новость этапа — ещё и пока этап не сыгран
const newsFresh = (n) => !!newsFor(n.id) && (daysAgo(n.publishedAt) < FRESH_DAYS || stagePlaying(n.tournament));
// альбом свежий 14 дней с показа; показ новых фото переносит shownAt, и строка снова наверху
const albumFresh = (a) => !!albumFor(a.tournament) && daysAgo(a.shownAt) >= 0 && daysAgo(a.shownAt) < FRESH_DAYS;

// «Новости лиги»: до трёх свежих записей, новые сверху. ?news=0 — день без свежего: блока нет.
export function newsFeed() {
  if (Q.get('news') === '0') return [];
  return [
    ...NEWS.filter(newsFresh).map((n) => ({ kind: 'news', at: n.publishedAt, n })),
    ...ALBUMS.filter(albumFresh).map((a) => ({ kind: 'album', at: a.shownAt, a })),
  ].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, 3);
}

// Подпись строки новости: у этапа с открытой записью — срок записи, иначе день публикации.
export function newsWhen(n) {
  const t = n.tournament && T(n.tournament);
  if (t && t.state === 'open' && /^Заявки до /.test(t.note || '')) return `Запись до ${t.note.replace(/^Заявки до /, '')}`;
  return dayLabel(n.publishedAt);
}

// Строка этапа на экране новости. Нажимается у идущего этапа и у этапа с показанным альбомом.
export function stageLine(tourId) {
  const t = T(tourId);
  if (!t) return null;
  const album = albumFor(t.id);
  let sub;
  if (t.state === 'live') sub = album ? 'Сетка, группы, расписание и фото' : 'Сетка, группы и расписание';
  else if (t.state === 'open') sub = `${t.pairs} из ${t.slots} пар · ${(t.note || '').toLowerCase()}`;
  else sub = `${t.dates} · ${t.pairs} ${plural(t.pairs, 'пара', 'пары', 'пар')}`;
  // на страницах «Турнир» — только идущий этап; в приложении сыгранный открывается сразу на «Фото»
  const href = t.state === 'live' ? 'tournament.html' : album ? 'tournament.html#foto' : null;
  return { t, sub, href };
}

/* =========================================================
   Детали
   ========================================================= */

const chev = '<i class="go" aria-hidden="true" data-icon="chev"></i>';
// название в кавычках не рвётся строкой: «Июльский кубок» целиком
const nb = (s) => s.replace(/«[^»]+»/g, (m) => m.replace(/ /g, ' '));
const imgHtml = (src, eager) => `<img src="${src}" alt=""${eager ? '' : ' loading="lazy"'} decoding="async">`;
// экран новости не в списке экранов мира у app.js (keepTheme), поэтому вид из адреса (?as=) ставим сами
export const newsHref = (id) => `news.html?id=${encodeURIComponent(id)}${VIEW.as ? `&as=${VIEW.as}` : ''}`;
const paragraphs = (text) => String(text).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
// текст новости в разметку: «3-е» не рвётся на «3-» и «е» (строка рвётся после дефиса)
const textHtml = (s) => esc(s).replace(/(\d+)-([а-яё]+)/gi, '<span class="nw-nb">$1-$2</span>');
const photoLabel = (p, k, n) => `Фото ${k + 1} из ${n}${p.caption ? `. ${p.caption}` : ''}`;

// миниатюра 56: кадр, мозаика из четырёх (у альбома) или плитка тоном (новость без обложки)
function thumbHtml(srcs) {
  if (!srcs.length) return '<span class="nw-thumb" aria-hidden="true"></span>';
  if (srcs.length > 1) return `<span class="nw-thumb nw-mosaic" aria-hidden="true">${srcs.slice(0, 4).map((s) => imgHtml(s, true)).join('')}</span>`;
  return `<span class="nw-thumb" aria-hidden="true">${imgHtml(srcs[0], true)}</span>`;
}

function feedRow(it) {
  if (it.kind === 'album') {
    const t = T(it.a.tournament);
    const ph = photosOf(it.a);
    return `<a class="row nw-row" href="tournament.html#foto">${thumbHtml(ph.slice(0, 4).map((p) => p.src))}
      <span class="grow"><span class="strong nw-title">${esc(nb(`Фото «${gen(t.name)}»`))}</span><span class="sub">${esc(dayLabel(it.a.shownAt))} · ${ph.length} фото</span></span>${chev}</a>`;
  }
  const n = it.n;
  const cover = photoAt(n.cover);
  return `<a class="row nw-row" href="${newsHref(n.id)}">${thumbHtml(cover ? [cover.src] : [])}
    <span class="grow"><span class="strong nw-title">${esc(nb(n.title))}</span><span class="sub">${esc(newsWhen(n))}</span></span>${chev}</a>`;
}

/* =========================================================
   1. «Сегодня» → «Новости лиги»
   ========================================================= */

// Блок встаёт после рейтинга (#r) и получает id="news" (на него ссылается админка: index.html#news).
// Свежего нет — блока нет совсем: экран кончается рейтингом, как сейчас.
export function mountTodayNews(after = $('r')) {
  const items = newsFeed();
  if (!items.length || !after || $('news')) return null;
  const sec = document.createElement('section');
  sec.className = 'section nw-today';
  sec.id = 'news';
  sec.setAttribute('aria-labelledby', 'nw-today-h');
  sec.innerHTML = `<span class="cap" id="nw-today-h">Новости лиги</span><div class="card nw-list">${items.map(feedRow).join('')}</div>`;
  after.after(sec);
  hydrate(sec);
  return sec;
}

/* =========================================================
   Просмотр фото на весь экран
   ---------------------------------------------------------
   Фон — самый глубокий тон темы. Листание, «6 из 30», «Закрыть», полоса кадров. Под фото —
   подпись организатора (если есть) и этап с датами. «Поделиться» нет: системному окну нужен
   пакет с кодом Android. «Назад» телефона закрывает просмотр (своя запись в истории).
   ========================================================= */

let viewer = null;
function makeViewer() {
  const el = document.createElement('div');
  el.className = 'nw-view';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Фото турнира');
  el.hidden = true;
  el.innerHTML = `
    <div class="nw-view-bar">
      <button class="icon-btn glass" type="button" data-x aria-label="Закрыть">${icon('close')}</button>
      <span class="cap nw-view-n" aria-live="polite"></span>
      <span aria-hidden="true"></span>
    </div>
    <div class="nw-view-track" tabindex="-1"></div>
    <div class="nw-view-foot">
      <p class="nw-view-where"></p>
      <div class="nw-thumbs" role="group" aria-label="Все фото"></div>
    </div>`;
  document.body.append(el);
  const track = el.querySelector('.nw-view-track');
  const strip = el.querySelector('.nw-thumbs');
  const counter = el.querySelector('.nw-view-n');
  const app = document.querySelector('.app');
  const st = { list: [], i: 0, opener: null, root: null, pushed: false, open: false };

  // полоса кадров: выбранный шире (76 против 48, шов 4) и стоит посередине; середина считается
  // по ширинам после смены, а не по тем, что ещё меняются плавно
  const paint = (instant) => {
    counter.textContent = `${st.i + 1} из ${st.list.length}`;
    strip.querySelectorAll('button').forEach((b, k) => {
      if (k === st.i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
    const left = pad + st.i * 52 + 38 - strip.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: instant || REDUCE ? 'auto' : 'smooth' });
  };
  const go = (i, smooth) => {
    st.i = Math.max(0, Math.min(st.list.length - 1, i));
    track.scrollTo({ left: st.i * track.clientWidth, behavior: smooth && !REDUCE ? 'smooth' : 'auto' });
    paint();
  };
  let busy = false;
  track.addEventListener('scroll', () => {
    if (busy) return;
    busy = true;
    requestAnimationFrame(() => {
      busy = false;
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== st.i && i >= 0 && i < st.list.length) { st.i = i; paint(); }
    });
  }, { passive: true });
  strip.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) go(Number(b.dataset.i), true);
  });
  addEventListener('resize', () => { if (st.open) track.scrollLeft = st.i * track.clientWidth; });

  // «Перелёт» кадра из миниатюры в просмотр (в приложении — Hero): копия кадра летит из клетки
  // на место фото; пока летит, само фото скрыто.
  const flyFrom = (thumb) => {
    const slide = track.children[st.i];
    const target = slide && slide.querySelector('img');
    if (REDUCE || !thumb || !target || !target.animate) return;
    const a = thumb.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    const p = st.list[st.i];
    const k = Math.min(box.width / p.w, box.height / p.h);
    const w = p.w * k, h = p.h * k;
    const b = { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w, height: h };
    if (!a.width || !b.width) return;
    const ghost = document.createElement('img');
    ghost.className = 'nw-fly';
    ghost.alt = '';
    ghost.src = thumb.currentSrc || thumb.src;
    document.body.append(ghost);
    target.style.visibility = 'hidden';
    const px = (r) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    const anim = ghost.animate([px(a), px(b)], { duration: 300, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'both' });
    const done = () => { ghost.remove(); target.style.visibility = ''; };
    anim.onfinish = done;
    anim.oncancel = done;
  };

  const focusables = () => [...el.querySelectorAll('button')].filter((x) => x.getClientRects().length);
  const hide = () => {
    if (!st.open) return;
    st.open = false;
    st.pushed = false;
    el.hidden = true;
    if (app) app.inert = false;
    document.documentElement.classList.remove('sheet-open');
    if (Q.has('view')) { const u = new URL(location.href); u.searchParams.delete('view'); history.replaceState(history.state, '', u); }
    // фокус — на клетку фото, которое смотрели последним (его же видно на стене), иначе — на то, что открыло
    const tile = st.root && st.root.querySelector(`[data-i="${st.i}"]`);
    const back = tile || st.opener;
    if (tile) tile.scrollIntoView({ block: 'nearest' });
    if (back && back.isConnected) back.focus({ preventScroll: true });
  };
  const close = () => { if (st.pushed) history.back(); else hide(); };
  addEventListener('popstate', () => { if (st.open) hide(); });
  el.querySelector('[data-x]').addEventListener('click', close);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(st.i + 1, true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(st.i - 1, true); }
    else if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  return {
    // list — фото по порядку (photosOf), i — с какого начать, where — «Июньский кубок · 12–19 июня»,
    // opener — что открыло (туда вернётся фокус), root — где клетки с data-i (стена, полоса новости)
    open({ list, i = 0, where = '', opener = null, root = null, fromUrl = false }) {
      if (!list.length) return;
      st.list = list; st.opener = opener || document.activeElement; st.root = root;
      st.i = Math.max(0, Math.min(list.length - 1, i));
      track.innerHTML = list.map((p, k) => `<figure class="nw-slide"><img src="${p.src}" alt="${esc(photoLabel(p, k, list.length))}"${Math.abs(k - st.i) > 2 ? ' loading="lazy"' : ''} decoding="async">${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`).join('');
      strip.innerHTML = list.map((p, k) => `<button type="button" data-i="${k}" aria-label="Фото ${k + 1}">${imgHtml(p.src, Math.abs(k - st.i) < 8)}</button>`).join('');
      el.querySelector('.nw-view-where').textContent = where;
      el.hidden = false;
      st.open = true;
      if (app) app.inert = true;
      document.documentElement.classList.add('sheet-open');
      // «назад» закрывает просмотр; открытый по ссылке (?view=N) закрывается и без своей записи
      if (!fromUrl) { history.pushState({ nwView: true }, '', location.href); st.pushed = true; }
      track.scrollLeft = st.i * track.clientWidth;
      paint(true);
      const thumb = opener && opener.querySelector ? opener.querySelector('img') : null;
      if (thumb && !REDUCE && el.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
      flyFrom(thumb);
      el.querySelector('[data-x]').focus({ preventScroll: true });
    },
  };
}
export function openViewer(opts) {
  viewer = viewer || makeViewer();
  viewer.open(opts);
}
const whereOf = (tourId) => { const t = T(tourId); return t ? `${t.name} · ${t.dates}` : ''; };
// нажатие на клетку с data-i открывает просмотр с этого фото
function bindPhotos(root, list, tourId) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b || !root.contains(b)) return;
    e.preventDefault();
    openViewer({ list, i: Number(b.dataset.i), where: whereOf(tourId), opener: b, root });
  });
}
// ?view=N (с 1) — открыть просмотр сразу: так на него ведут ссылки и так он снят на снимки
const viewAt = () => { const v = parseInt(Q.get('view'), 10); return v > 0 ? v - 1 : -1; };

/* =========================================================
   2. «Турнир» → вкладка «Фото»
   ========================================================= */

// Стена альбома: «Фото турнира · 30 фото», обложка — квадрат на две клетки, остальные по три в ряд
// со швом 3 (30 фото — ровно 11 рядов), в конце — тихая строка о снятии фото.
export function albumHtml(tourId) {
  const a = albumFor(tourId);
  if (!a) return '';
  const ph = photosOf(a);
  return `<section class="section nw-album-sec" aria-labelledby="nw-album-h">
    <div class="sec-head"><span class="cap" id="nw-album-h">Фото турнира</span><span class="cap">${ph.length} фото</span></div>
    <div class="nw-album">${ph.map((p, k) => `<button class="nw-ph${k ? '' : ' nw-big'}" type="button" data-i="${k}" aria-label="${esc(photoLabel(p, k, ph.length))}">${imgHtml(p.src, k < 12)}</button>`).join('')}</div>
    <p class="nw-tail">Не хотите быть на фото — скажите организатору лиги на турнире или в Telegram лиги, фото уберут</p>
  </section>`;
}
// Наполнить панель вкладки «Фото». Альбома нет — панель пустая и вернётся null (вкладки быть не должно).
export function mountAlbum(pane, tourId) {
  const a = albumFor(tourId);
  if (!pane || !a) return null;
  pane.innerHTML = albumHtml(tourId);
  hydrate(pane);
  const list = photosOf(a);
  bindPhotos(pane, list, tourId);
  const v = viewAt();
  if (v >= 0) openViewer({ list, i: Math.min(v, list.length - 1), where: whereOf(tourId), root: pane, fromUrl: true });
  return a;
}

/* =========================================================
   3. Экран новости (news.html)
   ========================================================= */

function renderGone() {
  document.title = 'Новость · Теннисная лига';
  $('nw-cover').remove();
  $('nw-top').classList.add('no-cover');
  $('nw-share').remove();
  $('nw-bar').classList.add('no-action');
  $('nw-art').remove();
  $('nw-more').innerHTML = `<section class="section nw-gone">
    <div class="card empty"><i data-ball=""></i><span class="shadow"></span><span class="strong">Новость больше не показывается</span></div>
  </section>`;
  hydrate($('nw-more'));
}

function renderNews() {
  const n = newsFor(Q.get('id') || 'jun-final');
  if (!n) { renderGone(); return; }
  document.title = `${n.title} · Теннисная лига`;
  const cover = photoAt(n.cover);
  if (cover) $('nw-cover-img').src = cover.src;
  else { $('nw-cover').remove(); $('nw-top').classList.add('no-cover'); }
  $('nw-art').innerHTML = `<span class="cap">${esc(dateWords(n.publishedAt))}</span>
    <h1 class="title">${textHtml(nb(n.title))}</h1>
    ${paragraphs(n.text).map((x) => `<p>${textHtml(x)}</p>`).join('')}`;

  const out = [];
  // фото этапа: четыре кадра альбома без обложки новости; на последнем — сколько ещё, он ведёт во вкладку
  const a = albumFor(n.tournament);
  const all = a ? photosOf(a) : [];
  if (all.length) {
    const pool = all.filter((p) => !(cover && cover.album === a.tournament && cover.no === p.no));
    const shown = pool.slice(0, 4);
    const more = all.length - shown.length;
    out.push(`<section class="section" aria-labelledby="nw-ph-h">
      <div class="sec-head"><span class="cap" id="nw-ph-h">Фото турнира</span><a class="cap tap-area" href="tournament.html#foto">Все ${all.length}</a></div>
      <div class="nw-strip">${shown.map((p, k) => (k === shown.length - 1 && more > 0
        ? `<a class="nw-ph" href="tournament.html#foto" aria-label="Все ${all.length} фото турнира">${imgHtml(p.src, true)}<span class="nw-more" aria-hidden="true"><span class="num">+${more}</span></span></a>`
        : `<button class="nw-ph" type="button" data-i="${all.indexOf(p)}" aria-label="${esc(photoLabel(p, all.indexOf(p), all.length))}">${imgHtml(p.src, true)}</button>`)).join('')}</div>
    </section>`);
  }
  // матчи из новости — живые плашки: идёт, скоро, сыгран
  const ms = (n.matches || []).filter((id) => D.match(id));
  if (ms.length) {
    out.push(`<section class="section" aria-labelledby="nw-mt-h"><span class="cap" id="nw-mt-h">Матчи из новости</span><div class="mt-list">${ms.map((id) => tileHtml(id)).join('')}</div></section>`);
  }
  // строка этапа
  const s = n.tournament ? stageLine(n.tournament) : null;
  if (s) {
    const inner = `<span class="srf-dot" data-surface="${s.t.surface}" aria-hidden="true"></span><span class="grow"><span class="strong ellipsis">${esc(s.t.name)}</span><span class="sub">${esc(s.sub)}</span></span>`;
    out.push(`<section class="section nw-stage"><div class="card">${s.href ? `<a class="row" href="${s.href}">${inner}${chev}</a>` : `<div class="row">${inner}</div>`}</div></section>`);
  }
  const more = $('nw-more');
  more.innerHTML = out.join('');
  hydrate($('nw-art'));
  hydrate(more);
  liveTiles(more);
  if (all.length) bindPhotos(more, all, n.tournament);

  // «Поделиться»: карточка — обложка, заголовок и «Теннисная лига TS · Новости лиги»
  const first = paragraphs(n.text)[0] || '';
  shareSheet({
    trigger: $('nw-share'),
    title: 'Новость',
    text: `${n.title} — ${D.LEAGUE.name}\n${first}`,
    card: () => `<figure class="nw-share-card">${cover ? `<img src="${cover.src}" alt="">` : ''}<figcaption><span class="strong">${esc(n.title)}</span><span class="sub">${esc(D.LEAGUE.name)} · Новости лиги</span></figcaption></figure>`,
  });
  const v = viewAt();
  if (v >= 0 && all.length) openViewer({ list: all, i: Math.min(v, all.length - 1), where: whereOf(n.tournament), root: more, fromUrl: true });
}

/* ---------- запуск ---------- */
const page = document.body.dataset.page;
if (page === 'today') mountTodayNews();
if (page === 'news') renderNews();
