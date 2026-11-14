// Фото турнира: много фото сразу, обложка, порядок и показ альбома игрокам — на сайте; в приложении — со следующей версии.
// Фото — плотной сеткой; на фото только номер и «Обложка». Нажали на фото — оно выделено,
// и над сеткой одна полоса действий словами. На телефоне — шторка с теми же кнопками.
// Пример начинается спокойно: «Все 30 фото загружены». Полоса загрузки — только после того, как
// человек сам выбрал файлы: кадр виден сразу, общий счёт словами — «Загружено 31 из 33»;
// без связи фото ждут и уйдут сами.
// Только что добавленные фото встают в начало альбома с пометкой «Новое».
// Перетаскивание мышью — удобство: всё то же есть кнопками.
// «Где появится» — полоса над сеткой: сайт («Фото» и страница турнира) и приложение («Турнир» → «Фото» — со следующей версии);
// «Посмотреть, как увидят» открывает в шторке окно сайта и будущий вид экрана турнира в приложении.
// Альбом живёт в общем состоянии (albums.<id>): порядок, обложка, подписи, загрузка и показ
// видны на «Новостях и фото», в журнале, после перезагрузки и в других вкладках.
// Общий uploader() считает загрузку по одной партии и не показывает фото до конца загрузки,
// поэтому альбом собран здесь на тех же деталях (.drop, .photos, .photo, .bar) — см. NOTES-content.md.
// ?album=may-2 — другой альбом (на выбор — все опубликованные этапы, и турниры из мастера);
// ?hold=1 — загрузка добавленных фото стоит (для снимков); ?ready=1 — всё уже загружено; ?offline=1 — нет связи.
import {
  D, state, esc, icon, hydrate, toast, openSheet, closeLayer, drag, previewPanel,
  plural, netState, isPhone, gen, rangeShort,
} from '../admin.js';
import { tourName, tourGen, albumRec, putAlbum, albumDirty, shrink, roomFor, albumIds, tourStage, APP_NEXT, APP_FUTURE } from './content.data.js';
import { picAlbum } from './content.pics.js';
import { appHead } from './tournament.preview.js';
import { stageNoNow, publishedStages } from './start.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const q = new URLSearchParams(location.search);
const HOLD = q.get('hold') === '1';
const READY = q.get('ready') === '1';
let online = q.get('offline') === '1' ? false : navigator.onLine;

// ---------- альбомы: копия из общего состояния ----------
// M — альбомы, открытые на этой странице; у фото в памяти ещё p — сколько загружено (0…1).
const M = {};
function load(id) {
  const a = albumRec(id, { ready: READY });
  a.photos.forEach((p) => { p.p = 0; if (!online && p.st === 'queued') p.st = 'wait'; if (online && p.st === 'wait') p.st = 'queued'; });
  return a;
}
let cur = albumIds().includes(q.get('album')) ? q.get('album') : 'jun-3';
M[cur] = load(cur);
const al = () => M[cur];
const idx = (id) => al().photos.findIndex((p) => p.id === id);
let sel = null; // выбранное фото (id)

// ---------- запись в общее состояние ----------
// own — запись этой страницы: подписка её пропускает. «Отменить» возвращает альбом,
// но то, что успело загрузиться за эти секунды, остаётся загруженным.
let own = false;
function put(a, opts) { own = true; try { return putAlbum(a, opts); } finally { own = false; } }
function commit(opts, a = al()) {
  a.at = state.now(); a.ts = Date.now();
  const u = put(a, opts);
  const id = a.id;
  return () => {
    const done = new Set(M[id].photos.filter((p) => p.st === 'done').map((p) => p.id));
    own = true; try { u(); } finally { own = false; }
    M[id] = load(id);
    M[id].photos.forEach((p) => { if (done.has(p.id)) p.st = 'done'; });
    put(M[id]);
    if (id === cur) { drawAll(true); if ($('#done') && !$('#done').hidden && al().state !== 'live') hideDone(); }
  };
}
// альбом поменяли в другой вкладке — здесь то же
state.on('albums', () => {
  if (own) return;
  Object.keys(M).forEach((id) => { M[id] = load(id); });
  drawAll(true);
});

// ---------- загрузка: счёт ----------
const counts = (a) => {
  const total = a.photos.length;
  const done = a.photos.filter((p) => p.st === 'done').length;
  return { total, done, left: total - done };
};

// ---------- шапка ----------
function head() {
  const a = al();
  const tag = $('#state');
  const dirty = albumDirty(a);
  $('#h1').textContent = `Фото «${tourGen(a.id)}»`;
  document.title = `Фото «${tourGen(a.id)}» · Раздел организатора`;
  const live = a.state === 'live';
  if (a.state === 'off') { tag.className = 'tag past lg'; tag.textContent = 'Убран с показа — игроки не видят'; }
  else if (!live) { tag.className = 'tag draft lg'; tag.textContent = 'Черновик — видите только вы'; }
  else if (dirty) { tag.className = 'tag warn lg'; tag.textContent = 'Есть правки — игроки их ещё не видят'; }
  else { tag.className = 'tag ok lg'; tag.textContent = `Видно игрокам${a.since ? ` ${a.since}` : ''}`; }
  $('#pub').textContent = live ? 'Показать правки игрокам' : 'Показать альбом игрокам';
  // показанный без правок: одна тихая кнопка «Убрать альбом с показа», главной нет — показывать нечего
  $('#pub').hidden = live && !dirty;
  $('#who-line').hidden = live && !dirty;
  $('#revert').hidden = !(live && dirty);
  $('#unpub').hidden = !(live && !dirty);
  // без главной кнопки полоса внизу телефона не нужна: «Убрать альбом с показа» — под заголовком.
  // «Убрать», а не «Снять»: рядом на телефоне — «Снять или выбрать фото»
  $('#act').classList.toggle('ct-static', live && !dirty);
  $('#act').hidden = !!($('#done') && !$('#done').hidden);
  syncShoot();
}
// Телефон: пока фото грузятся (или их нет), главное — «Снять или выбрать фото» сверху;
// «Показать альбом игрокам» появляется внизу, когда загрузка закончилась. Кнопка цвета мяча — одна.
function syncShoot() {
  const a = al(); const { left } = counts(a);
  const addFirst = left > 0 || !a.photos.length;
  document.body.classList.toggle('ct-addfirst', addFirst);
  const main = addFirst || (a.state === 'live' && !albumDirty(a));
  $('#shoot').className = `btn ${main ? 'main' : 'quiet'} ct-shoot`;
}

// ---------- выбор альбома ----------
function drawAlbums() {
  $('#albums').innerHTML = albumIds().map((id) => `<button type="button" class="chip" role="radio" aria-checked="${id === cur}" data-value="${id}">${icon('check')}${esc(tourName(id))}</button>`).join('');
  hydrate($('#albums').parentElement);
}
$('#albums').addEventListener('change', (e) => {
  if (!albumIds().includes(e.detail) || e.detail === cur) return;
  cur = e.detail;
  if (!M[cur]) M[cur] = load(cur);
  const u = new URL(location.href); u.searchParams.set('album', cur); history.replaceState(null, '', u);
  $('#pub-msg').hidden = true;
  drawAll();
});

// ---------- рамка загрузки: счёт словами, «Выбрать ещё фото», перетаскивание ----------
const barHtml = (done, total) => `<span class="bar" role="progressbar" aria-label="Загрузка фото" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${Math.round((done / total) * 100)}%"></i></span>`;
function drawUp() {
  const a = al(); const { total, done, left } = counts(a);
  const drop = $('#drop'); const prog = $('#prog'); const ic = $('#up-ic');
  const empty = !a.photos.length;
  drop.classList.toggle('empty', empty);
  // «Подождите конца загрузки» под главной кнопкой — с живыми числами, потом исчезает
  const msg = $('#pub-msg');
  if (!msg.hidden && msg.dataset.wait) { if (left) msg.textContent = `Подождите конца загрузки: загружено ${done} из ${total}`; else { msg.hidden = true; delete msg.dataset.wait; } }
  $('#pick-w').textContent = empty ? 'Выбрать файлы' : 'Выбрать ещё фото';
  $('#drop-w').textContent = empty ? 'Можно сразу много фото' : 'или перетащите их сюда';
  if (empty) { ic.className = 'ic'; ic.innerHTML = icon('upload'); prog.innerHTML = '<span class="h3">Перетащите фото сюда</span>'; syncShoot(); return; }
  if (!left) {
    ic.className = 'ic ok'; ic.innerHTML = icon('check');
    prog.innerHTML = `<span class="h3">Все ${total} фото загружены</span><span class="muted">Можно добавить ещё</span>`;
  } else if (!online) {
    ic.className = 'ic wait'; ic.innerHTML = icon('wifioff');
    prog.innerHTML = `<span class="h3">Нет связи · ${left} ${plural(left, 'фото ждёт', 'фото ждут', 'фото ждут')} связи</span>${barHtml(done, total)}<span class="muted">Загружено ${done} из ${total}. Остальные отправятся сами</span>`;
  } else {
    ic.className = 'ic'; ic.innerHTML = icon('upload');
    prog.innerHTML = `<span class="h3">Загружено <span class="num">${done}</span> из <span class="num">${total}</span></span>${barHtml(done, total)}<span class="muted">Не закрывайте страницу до конца загрузки</span>`;
  }
  syncShoot();
}
const stWords = (p) => (p.st === 'up' ? 'Загружается' : p.st === 'wait' ? 'Ждёт связи' : 'В очереди');
const stClass = (p) => (p.st === 'up' ? ' is-up' : p.st === 'queued' ? ' is-queued' : p.st === 'wait' ? ' is-wait' : '');
// загрузка идёт сама: каждое загруженное фото сразу записано — его видно и на других страницах
function tick() {
  if (HOLD || !online) return;
  for (const a of Object.values(M)) {
    let up = a.photos.find((p) => p.st === 'up');
    if (!up) { up = a.photos.find((p) => p.st === 'queued'); if (!up) continue; up.st = 'up'; up.p = 0; }
    up.p = Math.min(1, up.p + 0.34);
    if (up.p >= 1) {
      up.st = 'done';
      const next = a.photos.find((p) => p.st === 'queued');
      if (next) { next.st = 'up'; next.p = 0; }
      put(a);
      if (!next && a.id === cur) { toast(`Загружены все ${a.photos.length} фото. Выберите обложку и проверьте порядок`, { time: 6000 }); head(); }
    }
    if (a.id === cur) { paintStates(); drawUp(); }
  }
}
setInterval(tick, 320);
// без связи: фото ждут и уйдут сами
function setOnline(v) {
  online = v;
  for (const a of Object.values(M)) a.photos.forEach((p) => { if (!v && (p.st === 'up' || p.st === 'queued')) p.st = 'wait'; else if (v && p.st === 'wait') p.st = 'queued'; });
  netState({ online: v, pending: counts(al()).left });
  paintStates(); drawUp();
}
addEventListener('offline', () => setOnline(false));
addEventListener('online', () => setOnline(true));

// новые файлы: встают в начало альбома с пометкой «Новое»; кадр — сразу, загрузка — по очереди.
// В память кладётся уменьшенная копия: фото видно после перезагрузки и на других страницах.
let seq = 0;
async function addFiles(files) {
  const all = [...files];
  const imgs = all.filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) { toast('Это не фото. Подойдут файлы JPG или PNG', { kind: 'bad' }); return; }
  const srcs = (await Promise.all(imgs.map((f) => shrink(f)))).filter(Boolean);
  if (!srcs.length) { toast(`${all.length > 1 ? 'Эти фото не открылись' : 'Это фото не открылось'}. Подойдут файлы JPG или PNG`, { kind: 'bad' }); return; }
  if (!roomFor(srcs.reduce((n, s) => n + s.length, 0))) { toast('Новые фото не поместились в этот пример. Уберите часть фото из альбома — и добавьте снова', { kind: 'bad' }); return; }
  const failed = all.length - srcs.length;
  const a = al();
  a.photos.forEach((p) => { p.isNew = false; });
  const stamp = Date.now().toString(36);
  a.photos.unshift(...srcs.map((src) => ({ id: `${a.id}-u${stamp}${(seq += 1)}`, src, cap: '', st: online ? 'queued' : 'wait', p: 0, isNew: true })));
  if (!a.cover) a.cover = a.photos[0].id;
  sel = null;
  const n = srcs.length;
  const undo = commit({ say: `добавили ${n} фото в альбом «${gen(a.name)}»`, href: `photos.html?album=${a.id}` });
  drawGrid(); drawUp(); drawStrip(); head();
  toast(`Добавлено ${n} фото — ${n > 1 ? 'они' : 'оно'} в начале альбома${failed ? `. Не открылось: ${failed} — подойдут файлы JPG или PNG` : ''}`, { undo });
}
const input = $('#files');
input.addEventListener('change', () => { if (input.files.length) addFiles(input.files); input.value = ''; });
$('#pick').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
$('#shoot').addEventListener('click', () => input.click());
const drop = $('#drop');
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });

// ---------- фото по порядку ----------
function tileHtml(p, i, a) {
  const isCover = p.id === a.cover; const on = p.id === sel;
  const label = `Фото ${i + 1}${isCover ? ', обложка' : ''}${p.isNew ? ', новое' : ''}${p.cap ? `: ${p.cap}` : ''}`;
  const badge = isCover ? `<span class="cover" aria-hidden="true">${icon('star')}Обложка</span>` : p.isNew ? '<span class="cover ct-newb" aria-hidden="true">Новое</span>' : '';
  const foot = p.st !== 'done'
    ? `<span class="ct-up" aria-hidden="true"><span data-w>${stWords(p)}</span><i><b style="width:${Math.round(p.p * 100)}%"></b></i></span>`
    : p.cap ? `<span class="ct-cap" aria-hidden="true">${esc(p.cap)}</span>` : '';
  return `<li class="photo${isCover ? ' is-cover' : ''}${stClass(p)}${on ? ' is-sel' : ''}" data-id="${esc(p.id)}">
      <button type="button" class="ph" aria-pressed="${on}" aria-label="${esc(label)}"><img src="${esc(p.src)}" alt="" loading="lazy" draggable="false"><span class="ord" aria-hidden="true">${i + 1}</span>${badge}${foot}</button>
    </li>`;
}
function drawGrid() {
  const a = al();
  const grid = $('#grid');
  $('.ct-gridsec').hidden = !a.photos.length;
  grid.innerHTML = a.photos.map((p, i) => tileHtml(p, i, a)).join('');
  const ci = a.photos.findIndex((p) => p.id === a.cover);
  $('#grid-sub').textContent = a.photos.length ? `${a.photos.length} фото${ci >= 0 ? ` · обложка — фото ${ci + 1}` : ''}` : '';
  const nNew = a.photos.filter((p) => p.isNew).length;
  $('#grid-new').innerHTML = nNew ? `<span class="tag info">Новые: ${nNew} — в начале</span>` : '';
  $$('.photo', grid).forEach((li) => drag(li, {
    ghost: () => { const g = li.cloneNode(true); g.style.cssText = `position:fixed;z-index:80;width:${li.offsetWidth}px;pointer-events:none;transform:rotate(-2deg);box-shadow:0 22px 40px -12px rgba(10,20,15,.5);border-radius:14px`; return g; },
    over: (x, y) => {
      $$('.photo', grid).forEach((o) => o.classList.remove('drop-before'));
      const o = document.elementFromPoint(x, y)?.closest('.photo');
      if (o && o !== li && grid.contains(o)) { o.classList.add('drop-before'); return o; }
      return null;
    },
    drop: (o) => { o.classList.remove('drop-before'); moveTo(li.dataset.id, idx(o.dataset.id)); },
    cancel: () => $$('.photo', grid).forEach((o) => o.classList.remove('drop-before')),
  }));
  drawBar();
}
// загрузка идёт — меняются только слова и полоски, сетка не перерисовывается
function paintStates() {
  const a = al();
  a.photos.forEach((p) => {
    const li = $(`#grid .photo[data-id="${CSS.escape(p.id)}"]`);
    if (!li) return;
    li.classList.remove('is-up', 'is-queued', 'is-wait');
    const cls = stClass(p).trim(); if (cls) li.classList.add(cls);
    const o = $('.ct-up', li);
    if (p.st === 'done') {
      if (o) { o.remove(); if (p.cap) $('.ph', li).insertAdjacentHTML('beforeend', `<span class="ct-cap" aria-hidden="true">${esc(p.cap)}</span>`); }
      return;
    }
    if (!o) $('.ph', li).insertAdjacentHTML('beforeend', '<span class="ct-up" aria-hidden="true"><span data-w></span><i><b></b></i></span>');
    const box = $('.ct-up', li);
    $('[data-w]', box).textContent = stWords(p);
    $('b', box).style.width = `${Math.round(p.p * 100)}%`;
  });
}
function moveTo(id, to) {
  const a = al(); const from = idx(id);
  if (from < 0 || to === from) return;
  const [x] = a.photos.splice(from, 1);
  a.photos.splice(to > from ? to - 1 : to, 0, x);
  const n = a.photos.indexOf(x) + 1;
  const undo = commit();
  drawGrid(); drawStrip(); head();
  toast(`Фото переставлено: теперь ${n}-е`, { undo });
}

// ---------- выбор фото и полоса действий ----------
function select(id) {
  const prev = sel; sel = id;
  [prev, id].forEach((x) => {
    if (!x) return;
    const li = $(`#grid .photo[data-id="${CSS.escape(x)}"]`); if (!li) return;
    li.classList.toggle('is-sel', x === sel);
    $('.ph', li).setAttribute('aria-pressed', String(x === sel));
  });
  drawBar();
}
function drawBar() {
  const bar = $('#selbar'); const a = al();
  const i = sel ? idx(sel) : -1;
  if (i < 0) {
    sel = null; bar.className = 'ct-selbar';
    bar.innerHTML = `<p class="ct-selhint">${icon('info')}<span>Нажмите на фото, чтобы сделать его обложкой, подписать или переставить</span></p>`;
    return;
  }
  const p = a.photos[i]; const n = i + 1; const last = a.photos.length;
  bar.className = 'ct-selbar on';
  bar.innerHTML = `<span class="ct-selwho" aria-live="polite"><b>Фото <span class="num">${n}</span></b></span>
    <div class="ct-selacts">
      ${p.id === a.cover ? `<span class="cover-tag">${icon('star')}Обложка альбома</span>` : `<button class="btn quiet" type="button" data-a="cover">${icon('star')}Сделать обложкой</button>`}
      <button class="btn quiet" type="button" data-a="cap">${icon('text')}Подпись</button>
      ${n > 1 ? `<button class="btn quiet" type="button" data-a="first">${icon('first')}В начало</button><button class="btn quiet" type="button" data-a="left">${icon('back')}Сдвинуть раньше</button>` : ''}
      ${n < last ? `<button class="btn quiet" type="button" data-a="right">Сдвинуть дальше${icon('chev')}</button>` : ''}
    </div>
    <div class="ct-seldel"><button class="btn quiet" type="button" data-a="del">${icon('trash')}Убрать из альбома</button></div>
    <button class="btn text ct-selx" type="button" data-a="x">Закрыть</button>`;
  requestAnimationFrame(barWrap);
}
// «Убрать из альбома» ушло второй строкой — черта слева ему не нужна: оно и так отдельно
function barWrap() {
  const bar = $('#selbar'); const del = bar && $('.ct-seldel', bar); const acts = bar && $('.ct-selacts', bar);
  if (!del || !acts) return;
  bar.classList.toggle('wrapped', del.offsetTop > acts.offsetTop + 8);
}
addEventListener('resize', () => requestAnimationFrame(barWrap));
document.addEventListener('adm:view', () => requestAnimationFrame(barWrap));
function act(kind, id) {
  const a = al(); const i = idx(id); if (i < 0) return;
  const n = i + 1;
  if (kind === 'x') { select(null); $(`#grid .photo[data-id="${CSS.escape(id)}"] .ph`)?.focus(); return; }
  if (kind === 'cover') {
    a.cover = id;
    const undo = commit({ say: `сделали обложкой альбома «${a.name}» фото ${n}`, href: `photos.html?album=${a.id}` });
    drawGrid(); drawStrip(); head();
    toast(`Фото ${n} — обложка альбома`, { undo });
    return;
  }
  if (kind === 'first') moveTo(id, 0);
  if (kind === 'left') moveTo(id, i - 1);
  if (kind === 'right') moveTo(id, i + 2);
  if (kind === 'del') {
    a.photos.splice(i, 1);
    if (a.cover === id) a.cover = a.photos[0] ? a.photos[0].id : null;
    sel = null;
    const undo = commit();
    drawGrid(); drawUp(); drawStrip(); head();
    toast(`Фото ${n} убрано из альбома`, { undo });
  }
  if (kind === 'cap') capSheet(id);
}
$('#grid').addEventListener('click', (e) => {
  const li = e.target.closest('.photo'); if (!li) return;
  const id = li.dataset.id;
  if (isPhone()) { phoneSheet(id); return; }
  select(sel === id ? null : id);
});
$('#selbar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || !sel) return;
  const k = b.dataset.a; const id = sel;
  act(k, id);
  // фокус остаётся на той же кнопке, если она есть; иначе — на самом фото
  if (k !== 'x' && k !== 'cap') ($(`#selbar [data-a="${k}"]`) || $(`#grid .photo[data-id="${CSS.escape(id)}"] .ph`))?.focus();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && sel && !$('.sheet, .dialog')) select(null); });
// телефон: нажали на фото — шторка с теми же кнопками
function phoneSheet(id) {
  const a = al(); const i = idx(id); const p = a.photos[i]; const n = i + 1; const last = a.photos.length;
  const b = (k, ic, t) => `<button type="button" data-a="${k}">${icon(ic)}${esc(t)}</button>`;
  const s = openSheet({
    title: `Фото ${n}`,
    body: `<img class="ct-sheetph" src="${esc(p.src)}" alt="">${p.cap ? `<p class="muted">Подпись: ${esc(p.cap)}</p>` : ''}
      <div class="menu ct-phmenu">
        ${p.id === a.cover ? `<span class="cover-tag">${icon('star')}Обложка альбома</span>` : b('cover', 'star', 'Сделать обложкой')}
        ${b('cap', 'text', p.cap ? 'Изменить подпись' : 'Подпись')}
        ${n > 1 ? b('first', 'first', 'В начало') + b('left', 'back', 'Сдвинуть раньше') : ''}
        ${n < last ? b('right', 'chev', 'Сдвинуть дальше') : ''}
      </div>
      <div class="menu ct-phmenu ct-phdel">${b('del', 'trash', 'Убрать из альбома')}</div>`,
  });
  s.addEventListener('click', (e) => { const x = e.target.closest('[data-a]'); if (!x) return; closeLayer(true); act(x.dataset.a, id); });
}
function capSheet(id) {
  const a = al(); const i = idx(id); const p = a.photos[i]; const n = i + 1;
  const s = openSheet({
    title: `Подпись к фото ${n}`,
    body: `<div class="field full"><label class="label" for="cap-in">Подпись (необязательно)</label><input class="input" id="cap-in" value="${esc(p.cap || '')}" autofocus><span class="hint">Видна под фото на сайте</span></div><img src="${esc(p.src)}" alt="" class="ct-sheetph">`,
    foot: `<button class="btn main" type="button" data-save>${icon('check')}Сохранить подпись</button><button class="btn quiet" type="button" data-cancel>Отмена</button>`,
  });
  s.querySelector('[data-save]').addEventListener('click', () => {
    const v = s.querySelector('input').value.trim();
    if (v === (p.cap || '')) { closeLayer(true); return; }
    p.cap = v; closeLayer(true);
    const undo = commit();
    drawGrid(); drawPreview(); head();
    toast(v ? `Подпись сохранена: «${v}»` : 'Подпись убрана', { undo });
  });
  s.querySelector('[data-cancel]').addEventListener('click', () => closeLayer());
}
// полоса действий прилипает под шапкой, пока фото выбрано; прилипшая — стекло
const ph = $('.page-head');
const setHeadH = () => document.documentElement.style.setProperty('--ct-head-h', `${Math.round(ph.getBoundingClientRect().height)}px`);
new ResizeObserver(setHeadH).observe(ph);
setHeadH();
addEventListener('scroll', () => {
  const b = $('#selbar');
  const top = parseFloat(getComputedStyle(b).top) || 0;
  b.classList.toggle('stuck', b.classList.contains('on') && scrollY > 0 && b.getBoundingClientRect().top <= top + 1);
}, { passive: true });

// ---------- где появится и как увидят на сайте ----------
function siteHtml() {
  const a = al();
  if (!a.photos.length) return '<p class="ct-site-empty">В альбоме пока нет фото</p>';
  const cover = a.photos.find((p) => p.id === a.cover) || a.photos[0];
  const rest = a.photos.filter((p) => p !== cover);
  const isNew = a.state !== 'live';
  const n = a.photos.length;
  return `<div class="ct-site">
      <div class="ct-site-cap">${icon('site')}«Фото» → ${D.YEAR} → «${esc(tourName(a.id))}»</div>
      <div class="ct-site-art${isNew ? ' new' : ''}">${isNew ? '<span class="ct-new">Новое</span>' : ''}<div class="ct-site-alb"><img class="cv" src="${esc(cover.src)}" alt="">${rest.slice(0, 6).map((p) => `<img src="${esc(p.src)}" alt="">`).join('')}</div>
        <p class="d">${n} фото${rest.length > 6 ? ` · ещё ${rest.length - 6} ниже` : ''}</p></div>
      <div class="ct-site-cap">${icon('site')}Страница «${esc(tourGen(a.id))}» → «Фото»</div>
      <div class="ct-site-tile${isNew ? ' new' : ''}">${isNew ? '<span class="ct-new">Новое</span>' : ''}<img src="${esc(cover.src)}" alt=""><b>Фото турнира</b><span>${n} фото</span></div>
    </div>`;
}
// Приложение → «Турнир» → «Фото»: экран турнира, вкладка «Фото» с обложкой и фото по порядку.
// Экран турнира в приложении — об идущем этапе; у другого этапа шапка — его.
function patchApp(doc, mark) {
  const a = al();
  const tabs = doc.getElementById('tabs'); const panes = doc.querySelectorAll('.tp-pane');
  if (!tabs || !panes.length) return;
  if (a.id !== 'jun-3') {
    const st = tourStage(a.id) || {};
    const cap = st.kind === 'separate' ? 'Отдельный турнир' : st.kind === 'final' ? 'Итоговый турнир сезона' : `Этап ${stageNoNow(a.id)} из ${publishedStages().length}`;
    appHead(doc, { surface: st.surface || 'clay', cap, title: a.name, meta: st.from && st.to ? rangeShort(st.from, st.to) : '', line: 'Фото турнира' });
  }
  doc.getElementById('pane-foto')?.remove();
  tabs.querySelector('[data-tab="foto"]')?.remove();
  tabs.querySelectorAll('[data-tab]').forEach((x) => x.removeAttribute('aria-current'));
  tabs.insertAdjacentHTML('beforeend', '<a href="#foto" data-tab="foto" aria-current="true">Фото</a>');
  doc.querySelectorAll('.tp-pane').forEach((x) => { x.hidden = true; });
  const head = doc.getElementById('head');
  if (head) {
    head.classList.add('compact');
    head.querySelector('[data-part="big"]')?.classList.add('off');
    head.querySelector('[data-part="small"]')?.classList.remove('off');
  }
  const done = a.photos.filter((p) => p.st === 'done');
  const cover = done.find((p) => p.id === a.cover) || done[0];
  const rest = done.filter((p) => p !== cover);
  const img = (p, big) => `<img src="${esc(p.src)}" alt="" style="width:100%;${big ? 'grid-column:1 / -1;aspect-ratio:3 / 2' : 'aspect-ratio:1'};object-fit:cover;border-radius:${big ? 14 : 10}px;display:block">`;
  panes[panes.length - 1].insertAdjacentHTML('afterend', `<div class="tp-pane" id="pane-foto" aria-label="Фото"><section class="section"><span class="cap">Фото турнира · ${done.length} фото</span>
    ${cover ? `<div class="card" style="padding:8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">${img(cover, true)}${rest.slice(0, 9).map((p) => img(p)).join('')}</div>` : '<div class="card" style="padding:18px"><span class="strong">Фото пока нет</span></div>'}
    ${rest.length > 9 ? `<p class="muted" style="margin:10px 4px 0">Ещё ${rest.length - 9} фото ниже</p>` : ''}</section></div>`);
  const card = doc.querySelector('#pane-foto .card');
  if (card) mark(card, a.state === 'live' && !albumDirty(a) ? 'Видно' : 'Новое');
}
const PV = { app: { page: 'tournament.html', title: 'Приложение: Турнир, Фото', future: APP_FUTURE, patch: (doc, mark) => { try { patchApp(doc, mark); } catch { /* место в приложении не нашлось — показываем как есть */ } } }, site: '', banner: '', start: 'site' };
function drawPreview() {
  const a = al();
  PV.site = siteHtml();
  PV.banner = a.state !== 'live' ? 'Предпросмотр — игроки увидят альбом после показа' : albumDirty(a) ? 'Предпросмотр правок — игроки их ещё не видят' : 'Так альбом видят игроки сейчас';
}
function drawStrip() {
  const a = al();
  const cover = a.photos.find((p) => p.id === a.cover) || a.photos[0];
  $('#strip-pic').innerHTML = cover ? picAlbum([cover, ...a.photos.filter((p) => p !== cover)]) : '';
  $('#strip-site').innerHTML = `${icon('site')}<span>Сайт: раздел «Фото» и страница «${esc(tourGen(a.id))}»</span>`;
  $('#strip-app').innerHTML = `${icon('phone')}<span>Приложение: «${esc(a.name)}» → «Фото» — <b>${esc(APP_NEXT)}</b></span>`;
  $('#strip-app').classList.add('ct-next');
  drawPreview();
}

// ---------- показать альбом, убрать с сайта, «Готово» ----------
$('#pub').addEventListener('click', () => {
  const a = al();
  const { left, total, done } = counts(a);
  const msg = $('#pub-msg');
  if (!a.photos.length) { msg.textContent = 'Сначала добавьте фото'; msg.hidden = false; return; }
  if (left) {
    msg.textContent = `Подождите конца загрузки: загружено ${done} из ${total}`;
    msg.dataset.wait = '1';
    msg.hidden = false;
    return;
  }
  msg.hidden = true; delete msg.dataset.wait;
  const name = a.name;
  const time = state.now();
  if (a.state === 'live') {
    a.photos.forEach((p) => { p.isNew = false; });
    a.pub = { photos: a.photos.map((p) => ({ ...p })), cover: a.cover }; a.since = `с ${time}`;
    const undo = commit({ say: `показали игрокам правки альбома «${gen(name)}»`, href: `photos.html?album=${a.id}` });
    head(); drawGrid(); drawPreview();
    toast('Правки показаны игрокам', { undo });
    return;
  }
  const again = a.state === 'off';
  a.state = 'live'; a.since = `с ${time}`;
  a.photos.forEach((p) => { p.isNew = false; });
  a.pub = { photos: a.photos.map((p) => ({ ...p })), cover: a.cover };
  const undo = commit({ say: `${again ? 'снова показали' : 'показали'} игрокам альбом «${name}» — ${a.photos.length} фото: сайт`, href: `photos.html?album=${a.id}` });
  showDone();
  toast('Альбом показан игрокам', { undo });
});
$('#revert').addEventListener('click', () => {
  const a = al(); if (!a.pub) return;
  a.photos = a.pub.photos.map((p) => ({ ...p, st: p.st || 'done', p: 0 }));
  a.cover = a.pub.cover;
  sel = null;
  const undo = commit();
  drawAll(true);
  toast('Вернули опубликованное: правки убраны', { undo });
});
// убрать с показа — сразу и с «Отменить»: показать снова можно одной кнопкой
function unpublish() {
  const a = al();
  a.state = 'off'; a.since = '';
  const undo = commit({ say: `убрали с показа альбом «${a.name}»`, href: `photos.html?album=${a.id}` });
  hideDone();
  drawPreview();
  toast('Альбом убран: игроки его больше не видят', { undo });
}
$('#unpub').addEventListener('click', unpublish);
function showDone() {
  const a = al();
  const cover = a.photos.find((p) => p.id === a.cover) || a.photos[0];
  let box = $('#done');
  if (!box) { box = document.createElement('div'); box.id = 'done'; box.className = 'card pad ct-done'; $('#work').append(box); }
  box.innerHTML = `<div class="done-box">
      <span class="done-mark">${icon('check')}</span>
      <h2 class="h1">Альбом «${esc(tourName(a.id))}» показан игрокам</h2>
      <ul class="where-now">
        <li>${icon('site')}<span><b>Сайт</b> — раздел «Фото» и страница «${esc(tourGen(a.id))}», ${a.photos.length} фото</span></li>
        <li class="no">${icon('phone')}<span><b>Приложение</b> — «${esc(tourName(a.id))}» → «Фото», ${esc(APP_NEXT)}</span></li>
      </ul>
      <div class="btns"><button class="btn main" type="button" data-open>${icon('site')}Открыть альбом</button><button class="btn quiet" type="button" data-share>${icon('share')}Поделиться</button></div>
      <div class="ct-fix"><span class="label">Заметили ошибку?</span><div class="btns"><button class="btn quiet" type="button" data-edit>${icon('edit')}Изменить альбом</button><button class="btn quiet" type="button" data-unpub>Убрать альбом с показа</button></div></div>
    </div>
    <figure class="ct-done-pic"><img src="${esc(cover.src)}" alt="Обложка альбома"></figure>`;
  $('#editor').hidden = true; box.hidden = false;
  head();
  window.scrollTo(0, 0);
  box.querySelector('[data-open]').addEventListener('click', () => {
    const s = openSheet({ title: 'Альбом на сайте', body: `<div class="browser"><div class="bar-top"><i></i><i></i><i></i><span>Сайт лиги</span></div><div class="page">${siteHtml()}</div></div>`, foot: '<button class="btn quiet" type="button" data-no>Закрыть</button>', wide: true });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  });
  box.querySelector('[data-share]').addEventListener('click', () => {
    const s = openSheet({
      title: 'Поделиться',
      body: `<div class="linkcard"><div class="lc-top" style="background-image:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.6)),url('${esc(cover.src)}')"><b>Фото: ${esc(tourName(a.id))}</b></div><div class="lc-body"><b>${esc(D.LEAGUE.name)}</b><span class="s">${a.photos.length} фото</span></div></div><p class="muted">Так ссылка выглядит в мессенджере</p>`,
      foot: `<button class="btn main" type="button" data-copy>${icon('copy')}Скопировать ссылку</button><button class="btn quiet" type="button" data-no>Готово</button>`,
    });
    s.querySelector('[data-copy]').addEventListener('click', () => { closeLayer(true); toast('Ссылка скопирована: вставьте её в чат лиги'); });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  });
  box.querySelector('[data-edit]').addEventListener('click', () => { hideDone(); $('#grid .ph')?.focus(); });
  box.querySelector('[data-unpub]').addEventListener('click', unpublish);
  box.querySelector('[data-open]').focus({ preventScroll: true });
}
function hideDone() {
  const box = $('#done');
  if (box) box.hidden = true;
  $('#editor').hidden = false;
  head(); drawGrid(); drawPreview();
}

// ---------- запуск ----------
// keepSel — после «Отменить» и правки из другой вкладки выбранное фото остаётся выбранным
function drawAll(keepSel = false) {
  if (!keepSel || (sel && idx(sel) < 0)) sel = null;
  head(); drawAlbums(); drawGrid(); drawUp(); drawStrip();
  if (!keepSel && $('#done')) { $('#done').hidden = true; $('#editor').hidden = false; head(); }
}
previewPanel($('#pv'), PV); // окно сайта для шторки «Посмотреть, как увидят»
drawAll();
hydrate($('#editor'));
if (!online) setOnline(false);
