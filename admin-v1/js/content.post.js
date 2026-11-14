// Новость и статья о лиге.
// Сверху «Где показать» — плитки с картинкой места: сайт (главная и «Новости»), страница турнира,
// приложение («Сегодня» → «Новости лиги»; у новости турнира — ещё «Турнир» → «Новости») — со следующей версии:
// в самом приложении этих мест пока нет, предпросмотр приложения помечен как будущий вид.
// Ниже заголовок, текст, фото; в конце формы — та же главная кнопка и строка «кто увидит».
// Справа — живой вид: окно сайта и будущий вид экрана «Сегодня» приложения в рамке телефона.
// Новость живёт в общем состоянии (news.<id>): черновик сохраняется сам, публикация, правки,
// снятие и удаление видны на «Новостях и фото», в журнале и в других вкладках.
// post.html — новая новость; ?id=jun-final — черновик; ?id=jul-open — уже видна игрокам;
// ?kind=press — статья о лиге (ссылка на публикацию в газете или на сайте).
import {
  D, state, esc, icon, hydrate, toast, confirmAction, openSheet, closeLayer, previewPanel,
  keepTheme, dayWords, choices, isPhone,
} from '../admin.js';
import {
  ALBUMS, tourName, tourGen, tourSrf, TOURS, APP_NEWS as APP_ON, APP_NEWS_PLACE, APP_NEXT, APP_FUTURE, tourStage,
  newsRec, newsAll, putNews, newNewsId, fieldsOf, sameFields, albumRec, shrink, roomFor,
} from './content.data.js';
import { picSite, picApp, picTour, picPress } from './content.pics.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const q = new URLSearchParams(location.search);
let ID = q.get('id');
const R0 = newsRec(ID);
if (!R0) ID = null;
const PRESS = R0 ? R0.kind === 'press' : q.get('kind') === 'press';
const APP_NEWS = !PRESS && APP_ON;
const LIVE_STAGE = D.STAGES.find((s) => s.state === 'live') || TOURS[0];

// ---------- состояние страницы: копия записи из общего состояния ----------
// ST: new (ещё нигде нет) · draft · live · off; S — поля; PUB — что видят игроки; SINCE — «с 18:52»
let ST = R0 ? R0.state : 'new';
// новая новость: отмечен только сайт; «Приложение» — со следующей версии, человек отмечает его сам
const S = R0 ? fieldsOf(R0) : fieldsOf({ places: { site: true, app: false, tour: null } });
let PUB = R0 && R0.pub ? R0.pub : null;
let SINCE = R0 ? R0.since || '' : '';
let SAVED = R0 ? R0.saved || '' : '';
if (!APP_NEWS) S.places.app = false;
let lastTour = S.places.tour || LIVE_STAGE.id;

const W = PRESS
  ? { what: 'статью о лиге', gen: 'статьи о лиге', h1New: 'Новая статья о лиге', h1: 'Статья о лиге', pub: 'Добавить статью на сайт', done: 'Статья добавлена на сайт', del: 'Удалить статью', open: 'Открыть статью на сайте', offBtn: 'Убрать с сайта', offTag: 'Убрана с сайта — игроки не видят', off: 'Статья убрана с сайта', live: 'Видно на сайте' }
  : { what: 'новость', gen: 'новости', h1New: 'Новая новость', h1: 'Новость', pub: 'Опубликовать новость', done: 'Новость опубликована', del: 'Удалить новость', open: 'Открыть новость', offBtn: 'Снять с публикации', offTag: 'Снята с публикации — игроки не видят', off: 'Новость снята с публикации', live: 'Видно игрокам' };
const nameOf = () => S.title.trim() || 'Без заголовка';
// пустую новую новость не храним: черновик появляется, когда есть что сохранить
const hasContent = () => !!(S.title.trim() || S.text.trim() || S.cover || S.outlet.trim() || S.link.trim());

// ---------- запись в общее состояние ----------
// own — запись этой страницы: подписка на изменения её пропускает (поля уже такие)
let own = false;
let off = null;
function record() {
  return { id: ID, kind: PRESS ? 'press' : 'news', state: ST === 'new' ? 'draft' : ST, ...fieldsOf(S), pub: PUB, since: SINCE, saved: SAVED, at: state.now() };
}
function write(opts) {
  if (!ID) {
    ID = newNewsId(PRESS);
    const u = new URL(location.href); u.searchParams.set('id', ID); u.searchParams.delete('kind'); history.replaceState(history.state, '', u);
    off = state.on(`news.${ID}`, fromState);
  }
  const o = opts && typeof opts.href === 'function' ? { ...opts, href: opts.href() } : opts;
  own = true;
  try { return putNews(record(), o); } finally { own = false; }
}
const dirty = () => ST === 'live' && !!PUB && !sameFields(S, PUB);

// ---------- слова о местах ----------
const tourWords = (id) => (id ? `«${tourName(id)}» → «Новости турнира»` : '«Новости турнира»');
function whoSees() {
  if (PRESS) return 'Увидят все: на сайте, «Пресса о лиге»';
  const p = S.places;
  const site = p.site || p.tour; // страница турнира — тоже сайт
  if (site && p.app) return `Увидят все: на сайте · в приложении — ${APP_NEXT}`;
  if (site) return 'Увидят все: на сайте';
  if (p.app) return `Сейчас не увидит никто: в приложении — ${APP_NEXT}`;
  return null;
}
// «Где теперь» — по месту, без повторов: «Сайт — «Новости», главная, страница «Июньского кубка»»
function whereNow() {
  if (PRESS) return [{ icon: 'site', b: 'Сайт', s: '«О лиге» → «Пресса о лиге»' }];
  const p = S.places; const out = [];
  const site = [];
  if (p.site) site.push('«Новости»', 'главная');
  if (p.tour) site.push(`страница «${tourGen(p.tour)}»`);
  if (site.length) out.push({ icon: 'site', b: 'Сайт', s: site.join(', ') });
  // новость турнира в приложении — ещё и на экране турнира: «Июньский кубок» → «Новости»
  if (p.app) out.push({ icon: 'phone', b: 'Приложение', s: `${APP_NEWS_PLACE}${p.tour ? `, «${tourName(p.tour)}» → «Новости»` : ''} — ${APP_NEXT}`, no: true });
  return out;
}

// ---------- поля ----------
// картинка места — с фото этой новости там, где она появится
const picFor = (k) => {
  const src = S.cover ? S.cover.src : null;
  if (k === 'site') return picSite(src);
  if (k === 'app') return picApp(src);
  return picTour(tourSrf(S.places.tour || lastTour), src);
};
// картинка обрезается снизу: обведённое место всегда видно (у сайта оно слева)
const slice = (svg, k) => svg.replace('xMidYMid meet', k === 'site' ? 'xMinYMax slice' : 'xMidYMax slice');
function drawPlacePics() {
  $$('#places .ct-place[data-place]').forEach((b) => { $('.ct-pic', b).innerHTML = slice(picFor(b.dataset.place), b.dataset.place); });
}
const tile = (key, t, s) => `<button type="button" class="choice ct-place" aria-pressed="${!!S.places[key]}" data-place="${key}">
    <span class="pic"><span class="ct-pic">${slice(picFor(key), key)}</span></span>
    <span class="t">${esc(t)}</span><span class="s">${esc(s)}</span>
    <span class="dot" aria-hidden="true">${icon('check')}</span></button>`;
const fieldHtml = (id, label, input, hint = '') => `<div class="field full" id="f-${id}">
    <label class="label" for="in-${id}">${esc(label)}</label>
    <span class="err">${icon('alert')}<span></span></span>
    ${input}
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
  </div>`;

function drawFields() {
  const placesHtml = PRESS
    ? `<section class="ct-sec ct-where" aria-labelledby="where-h"><h2 class="h2" id="where-h">Где появится</h2>
        <div class="ct-places"><div class="choice ct-place ct-fixed"><span class="pic"><span class="ct-pic">${slice(picPress())}</span></span><span class="t">Сайт</span><span class="s">«О лиге» → «Пресса о лиге»</span></div></div></section>`
    : `<section class="ct-sec ct-where" id="f-places" aria-labelledby="where-h">
        <h2 class="h2" id="where-h">Где показать</h2>
        <span class="err ct-err">${icon('alert')}<span>Выберите хотя бы одно место</span></span>
        <div class="ct-places" id="places" role="group" aria-labelledby="where-h">
          ${tile('site', 'Сайт', 'Главная и раздел «Новости»')}
          ${tile('tour', 'Страница турнира', tourWords(S.places.tour))}
          ${tile('app', 'Приложение', `${APP_NEWS_PLACE} — ${APP_NEXT}`)}
        </div>
        <div class="ct-tourpick" id="tourpick"${S.places.tour ? '' : ' hidden'}>
          <span class="label" id="tp-l">Какого турнира?</span>
          <div class="chips" role="radiogroup" aria-labelledby="tp-l">${TOURS.map((t) => `<button type="button" class="chip" role="radio" aria-checked="${t.id === (S.places.tour || lastTour)}" data-value="${t.id}">${icon('check')}${esc(t.name)}</button>`).join('')}</div>
        </div>
      </section>`;
  const press = PRESS ? `
      ${fieldHtml('outlet', 'Где вышла статья', `<input class="input" id="in-outlet" autocomplete="off" value="${esc(S.outlet)}">`, 'Название газеты, журнала или сайта')}
      ${fieldHtml('title', 'Заголовок статьи', `<textarea class="input ct-title-in" id="in-title" rows="1" maxlength="140" autocomplete="off">${esc(S.title)}</textarea>`)}
      ${fieldHtml('link', 'Ссылка на статью', `<input class="input" id="in-link" type="url" inputmode="url" autocomplete="off" spellcheck="false" value="${esc(S.link)}">`, 'Скопируйте адрес статьи из браузера и вставьте сюда')}`
    : `
      ${fieldHtml('title', 'Заголовок', `<textarea class="input ct-title-in" id="in-title" rows="1" maxlength="120" autocomplete="off">${esc(S.title)}</textarea>`)}
      ${fieldHtml('text', 'Текст', `<textarea class="input ct-text-in" id="in-text" rows="8">${esc(S.text)}</textarea>`)}`;
  $('#fields').innerHTML = `${placesHtml}${press}
      <section class="ct-sec ct-photo" aria-labelledby="ph-h">
        <h2 class="label" id="ph-h">Фото (необязательно)</h2>
        <div class="ct-cover" id="cover"></div>
      </section>`;
  drawCover();
  hydrate($('#fields'));
  $('#in-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  requestAnimationFrame(fitTitle);
}
// Заголовок — в несколько строк, если не помещается: на телефоне и при крупном тексте он виден целиком.
// Новой строки в нём нет: Enter ничего не добавляет.
function fitTitle() {
  const t = $('#in-title'); if (!t || !t.offsetParent) return;
  t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 4}px`;
}
addEventListener('resize', () => requestAnimationFrame(fitTitle));
document.addEventListener('adm:view', () => requestAnimationFrame(fitTitle));
// поля из S, кроме того, в котором человек сейчас пишет
function fillFields() {
  [['title', 'title'], ['text', 'text'], ['outlet', 'outlet'], ['link', 'link']].forEach(([f, k]) => {
    const x = $(`#in-${f}`);
    if (x && x !== document.activeElement && x.value !== S[k]) x.value = S[k];
  });
  fitTitle();
  $$('#places .ct-place[data-place]').forEach((b) => b.setAttribute('aria-pressed', String(!!S.places[b.dataset.place])));
  if (S.places.tour) lastTour = S.places.tour;
  const tp = $('#tourpick'); if (tp) tp.hidden = !S.places.tour;
  $$('#tourpick [role="radio"]').forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.value === lastTour)); b.tabIndex = b.dataset.value === lastTour ? 0 : -1; });
  const tt = $('.ct-place[data-place="tour"] .s'); if (tt) tt.textContent = tourWords(S.places.tour);
  drawCover(); drawPlacePics();
}

// ---------- фото ----------
function drawCover() {
  const box = $('#cover');
  if (!box) return;
  if (!S.cover) {
    box.innerHTML = `<label class="drop ct-drop">
        <span class="ic">${icon('image')}</span>
        <span class="t">Загрузить фото</span>
        <span class="s dragonly">или перетащите фото сюда</span>
        <span class="btn quiet" role="button" tabindex="0">${icon('image')}Выбрать файл</span>
        <input type="file" accept="image/*" tabindex="-1">
      </label>
      <div class="btns"><button class="btn quiet" type="button" data-album>${icon('image')}Взять фото из альбома турнира</button></div>`;
    const drop = $('.drop', box); const input = $('input', box);
    $('.drop .btn', box).addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', () => { if (input.files[0]) setFile(input.files[0]); });
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); $('.t', drop).textContent = 'Отпустите — фото загрузится'; }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); $('.t', drop).textContent = 'Загрузить фото'; }));
    drop.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) setFile(f); });
  } else {
    box.innerHTML = `<figure><img src="${esc(S.cover.src)}" alt="${esc(S.cover.cap || 'Фото новости')}"></figure>
      <div class="btns">
        <label class="btn quiet">${icon('image')}Заменить фото<input type="file" accept="image/*" class="vh" tabindex="-1"></label>
        <button class="btn quiet" type="button" data-album>${icon('image')}Взять из альбома</button>
        <button class="btn quiet" type="button" data-remove>${icon('close')}Убрать фото</button>
      </div>`;
    const input = $('input', box);
    input.addEventListener('change', () => { if (input.files[0]) setFile(input.files[0]); });
  }
}
function setCover(c, words) {
  S.cover = c;
  drawCover(); drawPlacePics();
  const undo = saveNow();
  changed();
  if (words) toast(words, { undo });
}
async function setFile(f) {
  if (!f.type.startsWith('image/')) { toast('Это не фото. Подойдут файлы JPG или PNG', { kind: 'bad' }); return; }
  // уменьшенная копия: фото новости остаётся после перезагрузки и видно в «Недавнем»
  const src = await shrink(f, 960, 0.78);
  if (!src) { toast('Это фото не открылось. Подойдут файлы JPG или PNG', { kind: 'bad' }); return; }
  if (!roomFor(src.length)) { toast('Фото не поместилось в этот пример. Возьмите фото из альбома турнира', { kind: 'bad' }); return; }
  setCover({ src, cap: '' }, 'Фото загружено');
}
// фото из альбома турнира: альбом выбранного турнира, иначе — последнего
function pickFromAlbum() {
  // альбом выбранного турнира, если в нём есть фото; иначе — первый альбом с фото
  const a = [S.places.tour || lastTour, ...ALBUMS.map((x) => x.id)].map((id) => albumRec(id)).find((x) => x && x.photos.some((p) => p.st === 'done'));
  if (!a) { toast('В альбомах пока нет фото. Загрузите фото с компьютера', { kind: 'bad' }); return; }
  const list = a.photos.filter((p) => p.st === 'done');
  let pick = Math.max(0, list.findIndex((p) => S.cover && p.src === S.cover.src));
  const s = openSheet({
    title: `Фото из альбома «${tourName(a.id)}»`,
    body: `<div class="ct-pickph" role="radiogroup" aria-label="Какое фото взять">${list.map((p, i) => `<button type="button" class="ct-pickph-i" role="radio" aria-checked="${i === pick}" data-value="${i}"><img src="${esc(p.src)}" alt="${esc(p.cap || `Фото ${i + 1}`)}"><span class="n num">${i + 1}</span><span class="ok">${icon('check')}</span></button>`).join('')}</div>`,
    foot: `<button class="btn main" type="button" data-ok>${icon('check')}Взять это фото</button><button class="btn quiet" type="button" data-no>Отмена</button>`,
  });
  choices(s);
  s.querySelector('.ct-pickph').addEventListener('change', (e) => { pick = +e.detail; });
  s.querySelector('[data-ok]').addEventListener('click', () => {
    closeLayer(true);
    const p = list[pick];
    setCover(p.key ? { key: p.key, src: p.src, cap: p.cap || '' } : { src: p.src, cap: p.cap || '' }, `Фото ${pick + 1} из альбома — фото новости`);
  });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
}

// ---------- живой вид ----------
const chev = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const titleOr = () => S.title.trim() || (PRESS ? 'Заголовок статьи' : 'Заголовок новости');
// показанная без правок — в живом виде отмечено «Эта новость», черновик и правки — «Новое»
const markWord = () => (ST === 'live' && !dirty() ? 'Эта новость' : 'Новое');
const bannerText = () => (ST === 'live'
  ? (dirty() ? 'Предпросмотр правок — игроки увидят после «Опубликовать правки»' : 'Так новость видят игроки сейчас')
  : 'Предпросмотр — игроки увидят после публикации');
// когда вышла новость мира, неизвестно — в карточке вместо даты турнир
const dateLine = () => (ST === 'live' && !SINCE ? (S.places.tour ? `«${tourName(S.places.tour)}»` : '') : 'Сегодня');
const paras = () => S.text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
const imgOr = (c, cls = '') => (c ? `<img src="${esc(c.src)}" alt=""${cls ? ` class="${cls}"` : ''}>` : `<span class="noimg${cls ? ' ' + cls : ''}"></span>`);

// карточка новости в «Сегодня» приложения — детали приложения (app.css): .section, .cap, .card, .row
const appCard = () => `<span class="cap">Новости лиги</span><div class="card"><a class="row" href="#" onclick="return false" style="gap:14px">${S.cover ? `<img src="${esc(S.cover.src)}" alt="" style="width:64px;height:64px;border-radius:14px;object-fit:cover;flex:none">` : ''}<span class="grow"><span class="strong" data-t style="display:block">${esc(titleOr())}</span><span class="sub">${esc([dateLine(), S.places.tour && dateLine() === 'Сегодня' ? `«${tourName(S.places.tour)}»` : ''].filter(Boolean).join(' · '))}</span></span><span class="go" aria-hidden="true" style="display:inline-flex">${chev}</span></a></div>`;
const markIn = (doc, scroll) => (node, word = 'Новое') => {
  node.classList.add('adm-mark'); node.dataset.adm = word;
  if (!scroll) return;
  const w = doc.defaultView; const r = node.getBoundingClientRect();
  w.scrollTo(0, Math.max(0, r.top + w.scrollY - (w.innerHeight - 110) / 2 + r.height / 2));
};
function patchApp(doc, mark) {
  doc.getElementById('adm-news')?.remove();
  if (!S.places.app) return;
  const sec = doc.createElement('section');
  sec.className = 'section'; sec.id = 'adm-news';
  sec.innerHTML = appCard();
  const r = doc.getElementById('r');
  if (r) r.after(sec); else doc.querySelector('main')?.append(sec);
  mark(sec.querySelector('.card'), markWord());
}
const rangeText = (st) => {
  const a = +st.from.slice(8); const b = +st.to.slice(8);
  const m = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][+st.to.slice(5, 7) - 1];
  return st.from.slice(5, 7) === st.to.slice(5, 7) ? `${a}–${b} ${m}` : `${a} — ${b} ${m}`;
};
function siteHtml() {
  if (PRESS) {
    const outlet = S.outlet.trim() || 'Где вышла статья';
    return `<div class="ct-site">
      <div class="ct-site-cap">${icon('site')}«О лиге» → «Пресса о лиге»</div>
      <ul class="ct-site-list"><li class="new"><span class="ct-new">${markWord()}</span>${imgOr(S.cover)}<b>${esc(titleOr())}</b><span>${esc(outlet)} · Читать статью</span></li></ul>
    </div>`;
  }
  const p = S.places;
  if (!p.site && !p.tour) return '<p class="ct-site-empty">На сайте эта новость не появится: выберите «Сайт» или «Страница турнира»</p>';
  // рядом — другие новости, которые игроки видят сейчас (то, что показано, а не правка)
  const others = newsAll().filter((n) => n.kind === 'news' && n.state === 'live' && n.id !== ID && n.pub && n.pub.places && n.pub.places.site)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 2);
  const out = [];
  if (p.site) {
    out.push(`<div class="ct-site-cap">${icon('site')}Главная → «Новости лиги»</div>
      <ul class="ct-site-list"><li class="new"><span class="ct-new">${markWord()}</span>${imgOr(S.cover)}<b>${esc(titleOr())}</b><span>${esc(dateLine())}</span></li>${others.map((n) => `<li>${imgOr(n.pub.cover)}<b>${esc(n.pub.title)}</b><span>${n.tour ? `«${esc(tourName(n.tour))}»` : 'Новости лиги'}</span></li>`).join('')}</ul>`);
  }
  if (p.tour) {
    const st = tourStage(p.tour);
    out.push(`<div class="ct-site-cap">${icon('site')}Страница «${esc(tourGen(p.tour))}» → «Новости турнира»</div>
      <div class="ct-site-head srf-fill" data-srf="${esc(st.surface || 'clay')}"><b>${esc(st.name)}</b><span>Этап ${st.no} · ${esc(rangeText(st))}</span></div>
      <div class="ct-site-tile new"><span class="ct-new">${markWord()}</span>${imgOr(S.cover)}<b>${esc(titleOr())}</b><span>${esc(dateLine())}</span></div>`);
  }
  const ps = paras();
  out.push(`<div class="ct-site-cap">${icon('site')}Страница новости</div>
    <article class="ct-site-art new"><span class="ct-new">${markWord()}</span>${imgOr(S.cover)}<h4>${esc(titleOr())}</h4>${dateLine() === 'Сегодня' ? `<p class="d">${esc(dayWords(D.NOW.iso, { cap: true }))}</p>` : ''}${ps.length ? ps.slice(0, 3).map((x) => `<p>${esc(x)}</p>`).join('') : '<p class="d">Здесь будет текст новости</p>'}</article>`);
  return `<div class="ct-site">${out.join('')}</div>`;
}

const PV = { app: PRESS ? null : { page: 'index.html', title: 'Приложение: «Сегодня»', future: APP_FUTURE, patch: patchApp }, site: '', banner: '', start: 'site' };
function drawPreview() {
  PV.site = siteHtml(); PV.banner = bannerText();
  previewPanel($('#pv'), PV);
  offNote($('#pv'));
}
// новости нет в приложении — телефон закрыт словами (и в колонке, и в шторке)
function offNote(root) {
  const a = $('.pv-app', root);
  if (!a) return;
  let n = $('.ct-pv-off', a);
  if (!n) { n = document.createElement('div'); n.className = 'ct-pv-off'; n.textContent = APP_NEWS ? 'В приложении эта новость не появится' : 'В приложении новости пока не показываются'; a.append(n); }
  n.hidden = !!S.places.app;
}
let pvTimer = null;
function updatePreview() {
  PV.site = siteHtml(); PV.banner = bannerText();
  const page = $('#pv .pv-site .page');
  if (page) { page.innerHTML = PV.site; hydrate(page); }
  // полоса над телефоном «Будущий вид…» остаётся своей; меняется только полоса сайта
  const bn = $('#pv .pv-banner:not(.future) span'); if (bn) bn.textContent = PV.banner;
  offNote($('#pv'));
  clearTimeout(pvTimer);
  pvTimer = setTimeout(() => {
    const fr = $('#pv iframe');
    try {
      const doc = fr && fr.contentDocument;
      if (!doc || !doc.getElementById('r')) return;
      const had = !!doc.getElementById('adm-news');
      patchApp(doc, markIn(doc, !had));
    } catch { /* рамка ещё грузится — вставит сама */ }
  }, 120);
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.preview-open')) return;
  setTimeout(() => { const sh = $('.sheet .pv-sheet'); if (sh) offNote(sh); }, 0);
});

// ---------- «кто увидит» над обеими главными кнопками ----------
function syncWho() {
  const w = whoSees();
  ['#who', '#who2'].forEach((sel) => {
    const who = $(sel);
    who.textContent = w || 'Пока нигде: выберите, где показать';
    who.classList.toggle('ct-where-none', !w);
  });
}

// ---------- проверка перед показом ----------
function issues() {
  const out = [];
  if (PRESS && !S.outlet.trim()) out.push({ f: 'outlet', msg: 'Впишите, где вышла статья', short: 'где вышла' });
  if (!S.title.trim()) out.push({ f: 'title', msg: PRESS ? 'Впишите заголовок статьи' : 'Впишите заголовок — его увидят первым', short: 'заголовок' });
  if (!PRESS && !S.text.trim()) out.push({ f: 'text', msg: 'Впишите текст новости', short: 'текст' });
  if (PRESS && !/^https?:\/\/\S+\.\S+/.test(S.link.trim())) out.push({ f: 'link', msg: S.link.trim() ? 'Это не похоже на ссылку. Она начинается с https://' : 'Вставьте ссылку на статью', short: 'ссылка' });
  if (!PRESS && !S.places.site && !S.places.tour) out.push({ f: 'places', msg: S.places.app ? `Выберите «Сайт» или «Страницу турнира»: в приложении новости — ${APP_NEXT}` : 'Выберите, где показать', short: 'где показать' });
  return out;
}
let asked = false;
function paintIssues(list, focus) {
  $$('#form .error').forEach((x) => x.classList.remove('error'));
  // у поля — те же слова, что в сводке («Выберите «Сайт» или «Страницу турнира»…»), а не вторая фраза
  list.forEach((i) => { const box = $(`#f-${i.f}`); if (!box) return; box.classList.add('error'); const t = $('.err span', box); if (t) t.textContent = i.msg; });
  const sum = $('#errsum');
  const msgs = [$('#pub-msg'), $('#pub-msg2')];
  if (!list.length) { sum.hidden = true; msgs.forEach((m) => { m.hidden = true; }); return; }
  sum.innerHTML = `<span class="h3">${icon('alert')}Чтобы опубликовать:</span><ul>${list.map((i) => `<li><a href="#f-${i.f}" data-go="${i.f}">${esc(i.msg)}</a></li>`).join('')}</ul>`;
  sum.hidden = false;
  msgs.forEach((m) => { m.textContent = `Сначала: ${list.map((i) => i.short).join(', ')}`; m.hidden = false; });
  if (focus) { sum.scrollIntoView({ block: 'center', behavior: 'smooth' }); sum.focus({ preventScroll: true }); }
}
$('#errsum').addEventListener('click', (e) => {
  const a = e.target.closest('[data-go]'); if (!a) return;
  e.preventDefault();
  const f = a.dataset.go;
  const target = f === 'places' ? $('#places .ct-place') : $(`#in-${f}`);
  if (target) { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); target.focus({ preventScroll: true }); }
});

// ---------- шапка: заголовок, состояние словом, кнопки ----------
const savedLabel = (words) => { const sv = $('#saved'); sv.hidden = !words; if (words) sv.innerHTML = `${icon('check')}Сохранено ${esc(words)}`; };
function headFor() {
  const live = ST === 'live'; const d = dirty();
  $('#h1').textContent = ST === 'new' ? W.h1New : W.h1;
  document.title = `${$('#h1').textContent} · Раздел организатора`;
  const tag = $('#state');
  if (ST === 'off') { tag.className = 'tag past lg'; tag.textContent = W.offTag; }
  else if (live && d) { tag.className = 'tag warn lg'; tag.textContent = 'Есть правки — игроки их ещё не видят'; }
  else if (live) { tag.className = 'tag ok lg'; tag.textContent = `${W.live}${SINCE ? ` ${SINCE}` : ''}`; }
  else { tag.className = 'tag draft lg'; tag.textContent = 'Черновик — видите только вы'; }
  const words = live ? 'Опубликовать правки' : ST === 'off' ? 'Опубликовать снова' : W.pub;
  $('#pub').textContent = words; $('#pub2').textContent = words;
  $('#revert').hidden = !(live && d);
  // показанная без правок: одна тихая кнопка «Снять с публикации», главной нет — публиковать нечего
  $('#unpub').hidden = !(live && !d);
  $('#unpub').textContent = W.offBtn;
  $('#pub').hidden = live && !d;
  $('#who-line').hidden = live && !d;
  $('#finish').hidden = live && !d;
  // без главной кнопки полоса внизу телефона не нужна: «Снять с публикации» — под заголовком
  $('#act').classList.toggle('ct-static', live && !d);
  $('#act').hidden = !!($('#done') && !$('#done').hidden);
  // «Сохранено» — у черновика и у правок показанной
  savedLabel((ST === 'draft' || ST === 'off' || d) && SAVED ? SAVED : '');
  drawDanger();
  updatePreview(); // полоса «Предпросмотр» и отметка «Новое» / «Эта новость» — по состоянию
}
function drawDanger() {
  const d = $('#danger');
  const b = [];
  if (ST === 'draft') b.push(`<button class="btn quiet" type="button" data-del>${icon('trash')}Удалить черновик</button>`);
  if (ST === 'live' || ST === 'off') b.push(`<button class="btn quiet" type="button" data-del>${icon('trash')}${esc(W.del)}</button>`);
  d.innerHTML = b.join('');
  d.hidden = !b.length;
}
$('#danger').addEventListener('click', (e) => {
  if (!e.target.closest('[data-del]')) return;
  const name = nameOf();
  const draft = ST === 'draft';
  confirmAction({
    title: `${draft ? 'Удалить черновик' : W.del} «${name}»?`,
    text: 'Это нельзя вернуть.',
    consq: [draft ? 'Текст и фото черновика пропадут' : `${PRESS ? 'Статья исчезнет с сайта' : 'Новость исчезнет с сайта'}, ссылки на неё перестанут открываться`],
    action: draft ? 'Удалить черновик' : W.del,
    onConfirm: () => {
      if (off) off();
      own = true;
      try { putNews({ ...record(), deleted: true }, { say: `удалили ${draft ? `черновик ${W.gen}` : W.what} «${name}»`, href: 'content.html' }); } finally { own = false; }
      location.href = keepTheme(`content.html?deleted=${encodeURIComponent(name)}`);
    },
  });
});

// ---------- сохранение: черновик сохраняется сам, у заголовка — «Сохранено в 18:56» ----------
let saveT = null;
function saveSoon() {
  clearTimeout(saveT);
  const sv = $('#saved'); sv.hidden = false; sv.innerHTML = `${icon('clock')}Сохраняется…`;
  saveT = setTimeout(saveNow, 700);
}
function saveNow(opts) {
  clearTimeout(saveT); saveT = null;
  if (ST === 'new' && !hasContent()) { headFor(); return () => {}; }
  if (ST === 'new') ST = 'draft';
  SAVED = `в ${state.now()}`;
  const undo = write(opts);
  headFor();
  return undo;
}
// ушли со страницы, пока «Сохраняется…» — сохраняем сразу
addEventListener('pagehide', () => { if (saveT) saveNow(); });

// «Вернуть опубликованное»: правки убраны, в форме — то, что видят игроки
$('#revert').addEventListener('click', () => {
  if (!PUB) return;
  Object.assign(S, fieldsOf(PUB));
  const undo = saveNow();
  fillFields(); syncWho();
  toast('Вернули опубликованное: правки убраны', { undo });
});

// ---------- показ, снятие, «Готово» ----------
function publish() {
  asked = true;
  const list = issues();
  paintIssues(list, true);
  if (list.length) return;
  clearTimeout(saveT); saveT = null;
  const was = ST;
  const name = nameOf();
  const time = state.now();
  if (was === 'live') {
    PUB = fieldsOf(S); SINCE = `с ${time}`; SAVED = '';
    const undo = write({ say: `опубликовали правки ${W.gen} «${name}»`, href: () => `post.html?id=${ID}` });
    headFor();
    toast('Правки опубликованы — игроки видят новое', { undo });
    return;
  }
  ST = 'live'; PUB = fieldsOf(S); SINCE = `с ${time}`; SAVED = '';
  const say = PRESS
    ? `добавили на сайт статью о лиге «${name}»${S.outlet.trim() ? ` (${S.outlet.trim()})` : ''}`
    : `${was === 'off' ? 'снова опубликовали' : 'опубликовали'} новость «${name}» — ${whereNow().filter((x) => !x.no).map((x) => `${x.b.toLowerCase()}: ${x.s}`).join('; ')}`;
  const undo = write({ say, href: () => `post.html?id=${ID}` });
  showDone();
  toast(W.done, { undo });
}
$('#pub').addEventListener('click', publish);
$('#pub2').addEventListener('click', publish);

// снять с публикации — сразу и с «Отменить»: снять не страшно, вернуть можно одной кнопкой
function unpublish() {
  ST = 'off';
  const undo = write({ say: `${PRESS ? 'убрали с сайта статью о лиге' : 'сняли с публикации новость'} «${nameOf()}»`, href: () => `post.html?id=${ID}` });
  hideDone();
  toast(`${W.off}: игроки её больше не видят`, { undo });
}
$('#unpub').addEventListener('click', unpublish);

function showDone() {
  const w = whereNow();
  const box = $('#done') || document.createElement('div');
  box.id = 'done';
  box.className = 'card pad ct-done';
  box.innerHTML = `<div class="done-box">
      <span class="done-mark">${icon('check')}</span>
      <h2 class="h1">${esc(W.done)}</h2>
      <p class="ct-done-title">«${esc(nameOf())}»</p>
      <ul class="where-now">${w.map((x) => `<li${x.no ? ' class="no"' : ''}>${icon(x.icon)}<span><b>${esc(x.b)}</b> — ${esc(x.s)}</span></li>`).join('')}</ul>
      <div class="btns"><button class="btn main" type="button" data-open>${icon('site')}${esc(W.open)}</button><button class="btn quiet" type="button" data-share>${icon('share')}Поделиться</button></div>
      <div class="ct-fix"><span class="label">Заметили ошибку?</span><div class="btns"><button class="btn quiet" type="button" data-edit>${icon('edit')}Изменить</button><button class="btn quiet" type="button" data-unpub>${esc(W.offBtn)}</button></div></div>
    </div>${S.cover ? `<figure class="ct-done-pic"><img src="${esc(S.cover.src)}" alt="Фото новости"></figure>` : ''}`;
  if (!box.isConnected) $('#work').append(box);
  $('.with-preview').hidden = true;
  box.hidden = false;
  headFor();
  window.scrollTo(0, 0);
  box.querySelector('[data-open]').addEventListener('click', openOnSite);
  box.querySelector('[data-share]').addEventListener('click', share);
  box.querySelector('[data-edit]').addEventListener('click', () => { hideDone(); $('#in-title').focus(); });
  box.querySelector('[data-unpub]').addEventListener('click', unpublish);
  box.querySelector('[data-open]').focus({ preventScroll: true });
}
function hideDone() {
  const box = $('#done');
  if (box) box.hidden = true;
  $('.with-preview').hidden = false;
  headFor();
  fitTitle();
}
function openOnSite() {
  const s = openSheet({ title: PRESS ? 'Статья на сайте' : 'Новость на сайте', body: `<div class="browser"><div class="bar-top"><i></i><i></i><i></i><span>Сайт лиги</span></div><div class="page">${siteHtml()}</div></div>`, foot: '<button class="btn quiet" type="button" data-no>Закрыть</button>', wide: true });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
}
function share() {
  const st = S.places.tour ? tourStage(S.places.tour) : null;
  const s = openSheet({
    title: 'Поделиться',
    body: `<div class="linkcard"${st ? ` data-srf="${esc(st.surface || 'clay')}"` : ''}><div class="lc-top"${S.cover ? ` style="background-image:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.6)),url('${esc(S.cover.src)}')"` : ''}><b>${esc(titleOr())}</b></div><div class="lc-body"><b>${esc(D.LEAGUE.name)}</b><span class="s">${PRESS ? 'Пресса о лиге' : 'Новости лиги'}</span></div></div><p class="muted">Так ссылка выглядит в мессенджере</p>`,
    foot: `<button class="btn main" type="button" data-copy>${icon('copy')}Скопировать ссылку</button><button class="btn quiet" type="button" data-no>Готово</button>`,
  });
  s.querySelector('[data-copy]').addEventListener('click', () => { closeLayer(true); toast('Ссылка скопирована: вставьте её в чат лиги'); });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
}

// ---------- новость удалили (здесь «Отменить» нет — так и было сказано в окне) ----------
function showGone() {
  $('.page-head .head-row').innerHTML = `<h1 class="h1">${esc(W.h1)}</h1>`;
  $('#work').innerHTML = `<div class="empty"><span class="ic">${icon('trash')}</span><p>Эта ${PRESS ? 'статья' : 'новость'} удалена</p><a class="btn quiet" href="${esc(keepTheme('content.html'))}">${icon('back')}Ко всем новостям и фото</a></div>`;
}

// ---------- изменение пришло извне: «Отменить», другая страница или вкладка ----------
function fromState() {
  if (own) return;
  const r = newsRec(ID);
  if (r && r.deleted) { showGone(); return; }
  clearTimeout(saveT); saveT = null;
  const typing = document.activeElement && document.activeElement.closest('#fields input, #fields textarea');
  const keep = typing ? { [typing.id.replace('in-', '')]: typing.value } : {};
  if (!r) {
    // «Отменить» у самого первого сохранения: новости снова нигде нет
    ST = 'new'; PUB = null; SINCE = ''; SAVED = '';
    Object.assign(S, fieldsOf({ places: { site: true, app: APP_NEWS, tour: null } }), keep);
  } else {
    ST = r.state; PUB = r.pub || null; SINCE = r.since || ''; SAVED = r.saved || '';
    Object.assign(S, fieldsOf(r), keep);
  }
  if (!APP_NEWS) S.places.app = false;
  fillFields(); syncWho();
  if (ST !== 'live' && $('#done') && !$('#done').hidden) hideDone(); else headFor();
  if (asked) paintIssues(issues(), false);
}

// ---------- одна главная кнопка на экране ----------
// В конце формы — та же кнопка; когда она видна, кнопки в шапке прячутся (на телефоне кнопка всегда внизу).
const io = new IntersectionObserver((en) => {
  const act = $('#act');
  if (act) en.forEach((x) => { act.classList.toggle('ct-quiet', x.isIntersecting && !isPhone()); });
}, { threshold: 0.5 });
io.observe($('#finish'));

// ---------- запуск ----------
if (R0 && R0.deleted) {
  showGone();
} else {
  drawFields();
  drawPreview();
  syncWho();
  headFor();
  if (ID) off = state.on(`news.${ID}`, fromState);
}

// ввод: черновик сохраняется сам через долю секунды
function changed() {
  syncWho();
  headFor();
  if (asked) paintIssues(issues(), false);
}
$('#form').addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'in-title') { S.title = t.value.replace(/\s*\n\s*/g, ' '); fitTitle(); }
  else if (t.id === 'in-text') S.text = t.value;
  else if (t.id === 'in-outlet') S.outlet = t.value;
  else if (t.id === 'in-link') S.link = t.value;
  else return;
  if (ST === 'new') ST = 'draft';
  changed();
  saveSoon();
});
// плитки мест и выбор турнира
$('#form').addEventListener('click', (e) => {
  const tileB = e.target.closest('.ct-place[data-place]');
  if (tileB) {
    const k = tileB.dataset.place;
    if (k === 'tour') {
      S.places.tour = S.places.tour ? null : lastTour;
      $('#tourpick').hidden = !S.places.tour;
      $('.s', tileB).textContent = tourWords(S.places.tour);
    } else S.places[k] = !S.places[k];
    tileB.setAttribute('aria-pressed', String(!!S.places[k]));
    changed();
    saveNow();
    return;
  }
  if (e.target.closest('[data-album]')) { pickFromAlbum(); return; }
  if (e.target.closest('[data-remove]')) setCover(null, 'Фото убрано из новости');
});
$('#form').addEventListener('change', (e) => {
  if (!e.target.closest || !e.target.closest('#tourpick')) return;
  lastTour = e.detail || lastTour;
  if (!S.places.tour) return;
  S.places.tour = lastTour;
  const tileB = $('.ct-place[data-place="tour"]');
  $('.s', tileB).textContent = tourWords(S.places.tour);
  $('.ct-pic', tileB).innerHTML = slice(picFor('tour'));
  changed();
  saveNow();
});
