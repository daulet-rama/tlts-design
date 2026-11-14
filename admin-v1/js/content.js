// «Новости и фото»: три вида материала крупными плитками и «Недавнее».
// У каждой строки — состояние словом и где это видно; строка открывается целиком,
// там же — «Снять с публикации» и правка.
// Список — из мира и общего состояния: что сделали на других страницах и в других вкладках, видно сразу.
// ?empty=1 — пусто; ?deleted=… — после «Удалить».
// Место в приложении (со следующей версии) сказано один раз — в «Где появится» внутри новости и альбома;
// на карточках — только то, что игроки видят уже сейчас: сайт.
import { D, state, esc, icon, hydrate, keepTheme, plural, toast } from '../admin.js';
import { ALBUMS, tourGen, news, newsAll, albumRec, albumDirty, sameFields, albumIds, tourStage } from './content.data.js';
import { picNews, picAlbum, picPress } from './content.pics.js';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const EMPTY = q.get('empty') === '1';
// пришли после «Удалить»: строки больше нет, полоса говорит, что сделано
const GONE = q.get('deleted');

// где видно: значок места и слово
const wl = (parts) => `<span class="ct-wl">${parts.map(([ic, t, no]) => `<span${no ? ' class="no"' : ''}>${icon(ic)}${esc(t)}</span>`).join('')}</span>`;

// ---------- три плитки ----------
const jun = albumRec('jun-3');
const cover = news('jun-final').cover.src;
const KINDS = [
  { href: 'post.html', pic: picNews(cover), t: 'Новость',
    where: [['site', 'Сайт: «Новости» и главная']], btn: 'Написать новость', ic: 'edit', main: true },
  { href: 'photos.html', pic: picAlbum(jun.photos), t: 'Фото турнира',
    where: [['site', 'Сайт: «Фото» и страница турнира']], btn: 'Загрузить фото', ic: 'upload' },
  { href: 'post.html?kind=press', pic: picPress(), t: 'Статья о лиге',
    where: [['site', 'Сайт: «Пресса о лиге»']], btn: 'Добавить статью', ic: 'plus' },
];
$('#kinds').innerHTML = KINDS.map((k) => `<a class="ct-kind" href="${esc(keepTheme(k.href))}">
    <span class="ct-pic">${k.pic}</span>
    <span class="t">${esc(k.t)}</span>
    ${wl(k.where)}
    <span class="btn ${k.main ? 'main' : 'quiet'}">${icon(k.ic)}${esc(k.btn)}</span>
  </a>`).join('');

// ---------- недавнее ----------
const newsWhere = (n) => {
  if (n.kind === 'press') return [['site', 'Сайт: «Пресса о лиге»']];
  const p = n.places || {};
  const site = [];
  if (p.site) site.push('«Новости»', 'главная');
  if (p.tour) site.push(`страница «${tourGen(p.tour)}»`);
  return site.length ? [['site', `Сайт: ${site.join(', ')}`]] : [];
};
const albumKw = (a) => `Фото турнира · ${a.photos.length} фото${a.uploaded < a.photos.length ? `, загружено ${a.uploaded}` : ''}`;
const coverOf = (a) => (a.photos.find((p) => p.id === a.cover) || a.photos[0] || {}).src || '';
// альбомы: из мира и начатые в разделе (у этапа без фото альбом появляется, когда в него что-то добавили)
const albumList = () => [...ALBUMS.map((w) => w.id), ...albumIds().filter((id) => !ALBUMS.some((w) => w.id === id) && state.get(`albums.${id}`))].map((id) => albumRec(id)).filter(Boolean);
function items() {
  const list = [
    ...albumList().map((a) => ({
      kind: 'album', id: a.id, ts: a.ts || 0, draft: a.state === 'draft', date: (tourStage(a.id) || {}).to || D.NOW.iso,
      kw: albumKw(a), title: `«${a.name}»`, thumb: coverOf(a), state: a.state, dirty: albumDirty(a), live: 'Видно игрокам', off: 'Убран с показа',
      where: [['site', `Сайт: «Фото», страница «${tourGen(a.id)}»`]], href: `photos.html?album=${a.id}`,
    })),
    ...newsAll().map((n) => ({
      kind: n.kind, id: n.id, ts: n.ts || 0, draft: n.state === 'draft', date: n.tour ? (tourStage(n.tour) || {}).to || D.NOW.iso : D.NOW.iso,
      kw: `${n.kind === 'press' ? 'Статья о лиге' : 'Новость'}${n.state === 'draft' && n.saved ? ` · сохранено ${n.saved}` : ''}`,
      title: n.title.trim() || 'Без заголовка', thumb: n.cover ? n.cover.src : '', state: n.state,
      dirty: n.state === 'live' && n.pub && !sameFields(n, n.pub),
      live: n.kind === 'press' ? 'Видно на сайте' : 'Видно игрокам', off: n.kind === 'press' ? 'Убрана с сайта' : 'Снято с публикации',
      where: newsWhere(n), href: `post.html?id=${n.id}`,
    })),
  ];
  // сначала то, что меняли в разделе (последнее сверху), потом черновики, потом по дате турнира
  return list.sort((a, b) => (b.ts - a.ts) || (b.draft - a.draft) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// ярлык: на телефоне — одно слово, на широком экране — и кто видит
const tagHtml = (it) => {
  if (it.state === 'draft') return '<span class="tag draft"><span>Черновик<span class="ct-long"> — видите только вы</span></span></span>';
  if (it.state === 'off') return `<span class="tag past">${esc(it.off)}</span>`;
  if (it.dirty) return '<span class="tag warn"><span>Есть правки<span class="ct-long"> — игроки их ещё не видят</span></span></span>';
  return `<span class="tag ok">${esc(it.live)}</span>`;
};
const row = (it) => `<li class="row ct-mat" data-id="${esc(it.id)}">
    <span class="thumb">${it.thumb ? `<img src="${esc(it.thumb)}" alt="" loading="lazy">` : ''}</span>
    <span class="grow">
      <span class="kw">${esc(it.kw)}</span>
      <a class="t" href="${esc(keepTheme(it.href))}">${esc(it.title)}</a>
      ${it.where.length ? wl(it.where) : ''}
    </span>
    <span class="ct-meta">${tagHtml(it)}</span>
    ${icon('chev', 'go')}
  </li>`;

const SHOW = 5;
const list = $('#recent');
let all = false;
function draw() {
  if (EMPTY) return;
  const focus = document.activeElement && list.contains(document.activeElement) ? document.activeElement.closest('.ct-mat')?.dataset.id : null;
  const its = items();
  list.innerHTML = its.slice(0, all ? its.length : SHOW).map(row).join('');
  hydrate(list);
  const rest = its.length - SHOW;
  $('#more').innerHTML = !all && rest > 0 ? `<button class="btn quiet ct-more" type="button">${icon('down')}Показать ещё ${rest} ${plural(rest, 'материал', 'материала', 'материалов')}</button>` : '';
  hydrate($('#more'));
  if (focus) list.querySelector(`.ct-mat[data-id="${CSS.escape(focus)}"] a.t`)?.focus();
}

if (EMPTY) {
  list.outerHTML = `<div class="empty"><span class="ic">${icon('news')}</span><p>Пока ничего не выложено. Первая новость появится на сайте в разделе «Новости»</p></div>`;
} else {
  draw();
  $('#more').addEventListener('click', (e) => {
    if (!e.target.closest('button')) return;
    all = true; draw();
    list.children[SHOW]?.querySelector('a.t')?.focus();
  });
  // строка открывается целиком
  list.addEventListener('click', (e) => {
    const r = e.target.closest('.ct-mat'); if (!r || e.target.closest('a, button')) return;
    location.href = r.querySelector('a.t').href;
  });
  // новость или альбом поменяли здесь, на другой странице или в другой вкладке — список сразу такой же
  state.on('news', draw);
  state.on('albums', draw);
}
hydrate(document.querySelector('.work'));
if (GONE) {
  toast(`Удалено: «${GONE}»`, { kind: 'bad' });
  const u = new URL(location.href); u.searchParams.delete('deleted'); history.replaceState(null, '', u);
}
