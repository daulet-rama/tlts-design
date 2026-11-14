// Общий код всех экранов: иконки, нижняя панель, ссылки с темой, часы мира, живой счёт,
// пульт судьи, шторки и готовые куски разметки (кружок игрока, пара, плашка матча).
// Страница подключает app.js как модуль; свой код страница пишет отдельным модулем
// и берёт отсюда что нужно: import { icon, tileHtml, startLive } from './app.js'.
import { FORMAT_LEAGUE, createScore, applyEvent, tryApply, view, serverOf } from './score.js';
import * as D from './data.js';

export { D };

// ---------- тема ----------
// Выбор из «Настроек» (js/settings.js) хранится в браузере: tl-theme = light | dark, без записи — как в телефоне.
// ?theme= в адресе сильнее (им пользуются снимки). Страница, которая сама держит тему (табло для телевизора —
// всегда тёмное), выбор не берёт. ?edge=0…3 — сила каймы нижней панели (glass.css).
export const THEME_KEY = 'tl-theme';
const OWN_THEME = /^(light|dark)$/.test(new URLSearchParams(location.search).get('theme') || '') ? null : document.documentElement.dataset.theme || null;
export function applyTheme() {
  const q = new URLSearchParams(location.search);
  let t = q.get('theme');
  if (t !== 'light' && t !== 'dark') t = OWN_THEME;
  if (!t) { try { t = localStorage.getItem(THEME_KEY); } catch { t = null; } }
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  if (/^[0-3]$/.test(q.get('edge') || '')) document.documentElement.dataset.edge = q.get('edge');
}
applyTheme();
addEventListener('pageshow', (e) => { if (e.persisted) applyTheme(); });                // вернулись «назад» из кэша
addEventListener('storage', (e) => { if (e.key === THEME_KEY) applyTheme(); });        // тему сменили в другой вкладке

// ---------- кто смотрит ----------
// В показе «я» — Герман Хван (D.ME, p17): экраны мира лиги идут с личными блоками, как в 0.2.0
// и как ответы сервера с me=p17. Гость и вошедший (пользователь, кандидат, член лиги) видят мир лиги
// как ответ сервера без me: личных блоков нет. Экран не спрашивает «кто я»: личный блок есть, только
// если есть ME. Гость и вошедший отличаются только кружком справа в шапке «Сегодня» и «Рейтинга».
// Мир лиги от вида не меняется: D.ME — по-прежнему факты о Хване, и для гостя он просто игрок лиги.
// Вид берётся так: ?as= в адресе (ссылки по экранам мира его сохраняют, как тему) → состояние пробной
// версии в браузере, общее с js/me.js (показ включён — показ, вошёл — пользователь, иначе гость) →
// записи нет — показ: так страницы открываются всегда, и вид показа не меняется ни на точку.
//   ?as=show | guest | user | user-nophoto | user-empty | candidate | member | declined | offline
const USERS_KEY = 'tlts-app-users-v1';          // состояние пробной версии (js/join.data.js, USERS_KEY)
const USER_PHOTO = 'img/user-photo.webp';      // фото пользователя мира (js/join.data.js, USER.photo)
// вошедший из адреса — какой у него кружок: фото, инициалы или значок человека (состояния js/me.js)
const AS_USERS = { user: 'photo', 'user-nophoto': 'ini', 'user-empty': 'icon', candidate: 'photo', member: 'photo', declined: 'photo', offline: 'ini' };
function viewOf() {
  const as = new URLSearchParams(location.search).get('as');
  if (as === 'show' || as === 'guest') return { kind: as, as };
  if (AS_USERS[as]) {
    const k = AS_USERS[as];
    return { kind: 'user', as, me: { name: k === 'icon' ? '' : `${D.APPLICANT.first} ${D.APPLICANT.last}`, photo: k === 'photo' } };
  }
  let u = null;
  try { u = JSON.parse(localStorage.getItem(USERS_KEY) || 'null'); } catch { u = null; }
  if (!u || typeof u !== 'object' || u.show) return { kind: 'show', as: null };
  const a = u.session && u.server && u.server[u.session.email];
  if (!a) return { kind: 'guest', as: null };
  const p = a.profile || {};
  return { kind: 'user', as: null, me: { name: String(p.name || '').trim(), photo: !!p.photo } };
}
// kind — show | guest | user; as — вид из адреса (его несут ссылки); me — имя и фото вошедшего
export const VIEW = viewOf();
// «я» в ответе сервера: в показе — Хван, у гостя и вошедшего — нет
export const ME = VIEW.kind === 'show' ? D.ME : null;
export const isMe = (playerId) => !!ME && playerId === ME.player;

const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export { esc };
const pad2 = (n) => String(n).padStart(2, '0');
const REDUCE = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- живой матч ----------
// Матч за 3-е место из data.js: тот же розыгрыш (4:3, 30:15, подают Назаров / Гасанов).
export const LIVE = D.match('third');
export const pairInfo = (id) => {
  const [a, b] = D.pairLines(id);
  return { id, names: D.pairName(id), a, b, ids: D.pair(id).players.map((x) => D.player(x).portrait) };
};
export const PAIRS = LIVE.pairs.map(pairInfo);
export const BRONZE = LIVE.pointLog;
export function bronzeStart() {
  let s = createScore({ format: FORMAT_LEAGUE, mode: 'points', firstServer: 0 });
  for (const side of BRONZE) s = applyEvent(s, { t: 'point', side });
  return s;
}

// ---------- часы мира ----------
// В мире суббота, 19 июня 2027: в 18:47:12 матч за 3-е место идёт 47:12, счёт 4:3, 30:15.
// Все экраны берут время из одних часов. Первая открытая страница запоминает в браузере,
// когда в мире было 18:47:12; дальше время идёт по-настоящему, и любая страница, открытая
// позже, видит тот же момент. Через 45 минут день начинается заново.
// ?now=19:05 — открыть одну страницу в другой момент того же дня (в память не пишется).
const hmSec = (t) => { const [h, m, s = 0] = String(t).split(':').map(Number); return h * 3600 + m * 60 + s; };   // '18:47' → секунды дня
const msSec = (t) => { const [m, s] = String(t).split(':').map(Number); return m * 60 + s; };                   // '47:12' → секунды
export const WORLD_START = hmSec(LIVE.time) + msSec(LIVE.elapsed);
const LIVE_AT = msSec(LIVE.elapsed);
const WORLD_KEY = 'tl-world-v1';
const WORLD_TTL = 45 * 60 * 1000;
const T0 = (() => {
  const now = Date.now();
  const q = new URLSearchParams(location.search).get('now');
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(q || '')) return now - (hmSec(q) - WORLD_START) * 1000;
  try {
    const t = Number(localStorage.getItem(WORLD_KEY));
    if (t && now >= t && now - t < WORLD_TTL) return t;
    localStorage.setItem(WORLD_KEY, String(now));
  } catch { /* память закрыта — часы этой страницы */ }
  return now;
})();
// секунды от начала суток в мире (с дробью)
export const worldSec = () => WORLD_START + (Date.now() - T0) / 1000;
// «18:47»
export const worldTime = (sec = worldSec()) => `${pad2(Math.floor(sec / 3600) % 24)}:${pad2(Math.floor(sec / 60) % 60)}`;

// Живой матч идёт по тем же часам: очко каждые 2,6 секунды. Розыгрыш не случайный, а один на всех
// (подающие берут 60 % очков, порядок задан числом круга), поэтому все экраны в одну секунду
// показывают один счёт. Сет доигран — 2,6 секунды виден итог, и матч снова идёт с 4:3, 30:15.
export const TICK = 2.6;
const seqs = [];
function cycleSeq(c) {
  if (seqs[c]) return seqs[c];
  let seed = 20270619 + c * 7919;
  const rnd = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const seq = [];
  let s = bronzeStart();
  while (!s.finished && seq.length < 600) {
    const srv = serverOf(s);
    const side = rnd() < 0.6 ? srv : 1 - srv;
    seq.push(side);
    s = applyEvent(s, { t: 'point', side });
  }
  seqs[c] = seq;
  return seq;
}
// Где сейчас живой матч: круг c, сыграно k очков круга, начало круга и следующее очко (секунды мира).
export function livePos(sec = worldSec()) {
  let ticks = Math.max(0, Math.floor((sec - WORLD_START) / TICK + 1e-9));
  let c = 0;
  let start = WORLD_START;
  for (;;) {
    const n = cycleSeq(c).length + 1;
    if (ticks < n) break;
    ticks -= n; start += n * TICK; c += 1;
  }
  return { c, k: ticks, start, next: start + (ticks + 1) * TICK };
}
// Сколько идёт живой матч, в секундах: 47:12 в начале круга.
export const liveClock = (sec = worldSec()) => Math.floor(LIVE_AT + (sec - livePos(sec).start));
// минута матча, когда разыграно очко i круга
const liveMinute = (i) => Math.floor((LIVE_AT + (i + 1) * TICK) / 60);

// ---------- иконки ----------
const I = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.7c3.2 3.3 3.2 9.3 0 12.6M18.4 5.7c-3.2 3.3-3.2 9.3 0 12.6"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="3.5"/><path d="M12 5v14M7 10l1.5-1v6M15 9.5h2.5l-2.5 5.5"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  cup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8"/></svg>',
  bars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 20v-6M12 20V5M18 20v-9"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M6 11.5H5v9h14v-9h-1"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10l6 6 6-6"/></svg>',
  // сведения: правила, «как считается»
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor" stroke-width="1.6"/></svg>',
  // поменять стороны: две стрелки навстречу
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4v15M4.5 15.5 8 19l3.5-3.5M16 20V5M12.5 8.5 16 5l3.5 3.5"/></svg>',
  // тайм-аут: пауза в круге
  pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/></svg>',
  // штраф: карточка
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="6.5" y="3.5" width="11" height="15" rx="2.5" transform="rotate(8 12 11)"/><path d="M9 21h6" stroke-linecap="round"/></svg>',
  // снятие пары: человек и стрелка наружу
  leave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.5" cy="8" r="3.5"/><path d="M3.5 19.5c.9-3.3 3.1-5 6-5 1.4 0 2.6.4 3.6 1.1M16 13l4 4-4 4M20 17h-6"/></svg>',
  // дождь: облако и капли
  rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.2 15.5h10.1a3.7 3.7 0 0 0 .5-7.37A5.6 5.6 0 0 0 6.9 9.3a3.1 3.1 0 0 0 .3 6.2z"/><path d="M8.6 18.6l-.9 1.9M12.6 18.6l-.9 1.9M16.6 18.6l-.9 1.9"/></svg>',
  // отправить результат
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12 19.5 4.5 15 19.5l-3.2-6.3z"/><path d="M11.8 13.2 19.5 4.5"/></svg>',
};
export const icon = (k) => I[k] || '';
export const ballSvg = (cls = '') =>
  `<svg class="ball ${cls}" viewBox="0 0 20 20" aria-hidden="true"><circle class="b-fill" cx="10" cy="10" r="9.5"/><path class="b-seam" d="M3.2 4.2c3 2.6 3 9 0 11.6M16.8 4.2c-3 2.6-3 9 0 11.6"/></svg>`;

// ---------- нижняя панель ----------
// Страница указывает активный пункт: <body data-dock="today|tournaments|rating|me|judge|none">.
// judge — открыт раздел судьи: вкладки не выбраны, отмечена круглая кнопка.
const DOCK = [
  ['today', 'index.html', 'Сегодня', 'today'],
  ['cup', 'tournaments.html', 'Турниры', 'tournaments'],
  ['bars', 'rating.html', 'Рейтинг', 'rating'],
  ['me', 'player.html', 'Я', 'me'],
];
export function mountDock(active) {
  if (!active || active === 'none' || document.querySelector('.dock')) return;
  const nav = document.createElement('nav');
  nav.className = 'dock';
  nav.setAttribute('aria-label', 'Разделы');
  // «Я» вне показа — me.html (гость, пользователь, кандидат, член лиги); в показе — карта Хвана
  nav.innerHTML = `<div class="tabbar glass">${DOCK
    .map(([ic, href, label, key]) => `<a class="tab" href="${keepTheme(key === 'me' && !ME ? 'me.html' : href)}" aria-label="${label}"${key === active ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`)
    .join('')}</div><a class="icon-btn glass" href="${keepTheme('judge-list.html')}" aria-label="Судья: мои матчи"${active === 'judge' ? ' aria-current="page"' : ''}>${icon('board')}</a>`;
  (document.querySelector('.app') || document.body).append(nav);
  watchOver(nav);
}

// Над покрытием (.surface, шапка матча, мини-корт, всё с data-dock-under) и над всем, что цвета мяча
// (главная кнопка, капсула очков, текущий шаг, капсула «сейчас»), а также над шторкой плавающее
// стекло становится дымчатым — см. glass.css. Иначе стекло усиливает яркий цвет под собой и надписи
// теряют контраст. Яркое светится тенью, поэтому его ловим с запасом в 16 px.
// Так ведут себя нижняя панель и любая плавающая строка с атрибутом data-float (верхняя строка
// рассказа, кнопки над предметом): app.js ставит ей классы on-surface и on-bright.
const DOCK_UNDER = '.surface, .court-head, .bsheet, .srf-tile, [data-dock-under]';
const DOCK_BRIGHT = '.btn.main:not(:disabled), .mt-now, .pill.now, .pts-chip.now, .step.now .mark, .stepbar .now, .otp.ok';
const watched = new Set();
let overBusy = false;
function overCheck() {
  overBusy = false;
  watched.forEach((nav) => {
    if (!nav.isConnected) { watched.delete(nav); return; }
    const d = nav.getBoundingClientRect();
    const hit = (sel, pad) => [...document.querySelectorAll(sel)].some((el) => {
      if (el === nav || nav.contains(el) || el.contains(nav) || el.closest('.off, [inert]')) return false;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      return r.bottom + pad > d.top && r.top - pad < d.bottom && r.right + pad > d.left && r.left - pad < d.right;
    });
    const bright = hit(DOCK_BRIGHT, 16);
    nav.classList.toggle('on-surface', bright || hit(DOCK_UNDER, 0));
    nav.classList.toggle('on-bright', bright);
  });
}
const overAsk = () => { if (!overBusy) { overBusy = true; requestAnimationFrame(overCheck); } };
let overOn = false;
export function watchOver(el) {
  watched.add(el);
  if (!overOn) {
    overOn = true;
    addEventListener('scroll', overAsk, { passive: true });
    addEventListener('resize', overAsk);
    // шторка или кнопка могут появиться без прокрутки
    new MutationObserver(overAsk).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  }
  setTimeout(overCheck, 0);
  setTimeout(overCheck, 600);
}

// ---------- ссылки ----------
// ссылки сохраняют выбранную тему, а ссылки на экраны мира лиги — и вид из адреса (?as=).
// На вход, вступление и профиль вид не несут: там состояние ведёт js/me.js, и ?as= его бы перезаписал.
// На карту Хвана (player.html) — тоже: туда ведёт только включённый показ, а ?as= его бы отменил.
const AS_KEEP = /^(index|tournaments|tournament|rating|ranks|player-other|match|match-soon|match-done|me|judge[\w-]*)\.html$/;
export function keepTheme(href) {
  const t = new URLSearchParams(location.search).get('theme');
  const add = [];
  if ((t === 'light' || t === 'dark') && !/[?&]theme=/.test(href)) add.push(`theme=${t}`);
  if (VIEW.as && !/[?&]as=/.test(href) && AS_KEEP.test(href.split(/[?#]/)[0])) add.push(`as=${VIEW.as}`);
  if (!add.length) return href;
  const [path, hash] = href.split('#');
  return `${path}${path.includes('?') ? '&' : '?'}${add.join('&')}${hash ? '#' + hash : ''}`;
}
export function fixLinks(root = document) {
  root.querySelectorAll('a[href*=".html"]').forEach((a) => { a.href = keepTheme(a.getAttribute('href')); });
}
// карточка игрока: вы — «Я», другие — player-other.html?p=<id> (гостю и Хван — другой игрок)
export const playerHref = (id) => (isMe(id) ? 'player.html' : `player-other.html?p=${id}`);
// экран матча по состоянию: идёт — match.html, скоро — афиша, сыгран — итог; номер матча — в ?m=
export const matchHref = (m) => {
  if (typeof m === 'string') m = D.match(m);
  const file = m.state === 'live' ? 'match.html' : m.state === 'soon' ? 'match-soon.html' : 'match-done.html';
  return `${file}?m=${m.id}`;
};

// «Назад» и «Закрыть» вложенного экрана: на шаг назад внутри приложения; при прямом заходе — по href.
// Разметка: <a href="index.html" data-step-back>. app.js подключает такие ссылки сам.
export function backLink(el, fallback = el.getAttribute('href') || 'index.html') {
  let ref = null;
  if (document.referrer) {
    try {
      const r = new URL(document.referrer);
      const dir = (u) => u.pathname.replace(/[^/]*$/, '');
      if (r.origin === location.origin && dir(r) === dir(location) && /\.html$/.test(r.pathname) && r.pathname !== location.pathname) ref = r;
    } catch { /* адрес не разобрать — по href */ }
  }
  if (!ref) { el.href = keepTheme(fallback); return; }
  el.href = ref.pathname.split('/').pop() + ref.search + ref.hash;
  el.addEventListener('click', (e) => {
    if (history.length > 1 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); history.back(); }
  });
}

// ---------- счёт словами ----------
// Фраза под счётом. Из нескольких положений гейма берётся самое важное: тай-брейк, матчбол
// («подают на матч»), решающее очко, брейк-пойнт, подача на сет, «больше», «ровно», подача.
// Решающее очко (второе «ровно») важнее брейк-пойнта: при нём брейк-пойнт есть всегда, а подача
// на сет при решающем очке — уже матчбол. «Больше» у принимающих — всегда брейк-пойнт, поэтому
// «Больше у пары …» бывает только у подающих. Порядок и слова — как у сервера (Situation).
export function phrase(s, v, pp = PAIRS) {
  const [g0, g1] = v.games;
  if (v.finished) {
    const w = v.winner;
    return `${pp[w].names} выиграли ${Math.max(g0, g1)}:${Math.min(g0, g1)}`;
  }
  if (v.inTiebreak) return `Тай-брейк, ${v.tiebreak[0]}:${v.tiebreak[1]}`;
  const srv = v.server;
  const rcv = 1 - srv;
  if (v.matchPoint !== null) {
    return v.matchPoint === srv ? `${pp[srv].names} подают на матч` : `Матчбол у пары ${pp[v.matchPoint].names}`;
  }
  if (v.decidingPoint) return `Решающее очко на подаче ${D.genitive(pp[srv].a)}`;
  const raw = v.pointsRaw;
  if (raw) {
    const br = applyEvent(s, { t: 'point', side: rcv });
    if (br.games[rcv] > s.games[rcv]) return `Брейк-пойнт у пары ${pp[rcv].names}`;
  }
  const after = [...v.games];
  after[srv] += 1;
  if (after[srv] >= 6 && after[srv] - after[1 - srv] >= 2) return `${pp[srv].names} подают на сет`;
  if (v.advantage !== null) return `Больше у пары ${pp[v.advantage].names}`;
  if (v.label === 'Ровно') return `Ровно на подаче ${D.genitive(pp[srv].a)}`;
  const lead = g0 === g1 ? null : g0 > g1 ? 0 : 1;
  if (lead === null) return `${pp[srv].names} подают при ${g0}:${g1}`;
  if (lead === srv) return `${pp[srv].names} подают, ведут ${Math.max(g0, g1)}:${Math.min(g0, g1)}`;
  return `${pp[srv].names} подают, догоняют ${Math.min(g0, g1)}:${Math.max(g0, g1)}`;
}

// заменить текст с мягкой анимацией; очко «AD» получает класс .ad — в капсуле очков оно встаёт
// на место «40», и капсула не меняет ширину (.pts-chip .ad в app.css)
export function setTick(el, text) {
  if (!el || el.textContent === String(text)) return;
  el.textContent = text;
  el.classList.toggle('ad', text === 'AD');
  el.classList.remove('in');
  void el.offsetWidth;
  el.classList.add('in');
}

// Очки гейма для капсулы и записи: «30 : 15»; «ровно» и решающее очко — «40 : 40»; «больше» —
// «AD» у пары с преимуществом и «40» у другой. В тай-брейке — его счёт. У движка «больше» — «Б».
export const ptsOf = (v) => (v.inTiebreak ? v.tiebreak.map(String) : v.points ? v.points.map((p) => (p === 'Б' ? 'AD' : p)) : ['–', '–']);
// Очки на клавише пульта: при «больше» — «40», преимущество на клавише показывает плашка «Больше».
export const keyPtsOf = (v) => ptsOf(v).map((p) => (p === 'AD' ? '40' : p));

// ---------- живой матч (Сегодня и Матч) ----------
// Подпись очков в ленте и в розыгрыше сыгранного матча — словами, а не как в капсуле:
// «15:0», «ровно», «больше», «решающее», счёт тай-брейка.
const ptLabel = (v) => (v.inTiebreak ? v.tiebreak.join(':') : v.decidingPoint ? 'решающее' : v.label === 'Ровно' ? 'ровно' : v.label === 'Больше' ? 'больше' : ptsOf(v).join(':'));

// Ведёт цифры и ленту: каждое очко проходит через track().
// events — три последних события (для ленты «Матча»), log — все события с начала, новые сверху.
export function makeTracker(pairs = PAIRS) {
  const t = { won: [0, 0], srvPts: [0, 0], srvWon: [0, 0], breaks: [0, 0], bp: false, trail: [], events: [], log: [], fresh: false };
  t.track = (s, side, min) => {
    const v = view(s);
    const srv = v.server;
    const rcv = 1 - srv;
    if (v.pointsRaw && applyEvent(s, { t: 'point', side: rcv }).games[rcv] > s.games[rcv]) t.bp = true;
    const s2 = applyEvent(s, { t: 'point', side });
    const v2 = view(s2);
    t.won[side] += 1;
    t.srvPts[srv] += 1;
    if (side === srv) t.srvWon[srv] += 1;
    t.fresh = false;
    if (v2.gameLog.length > v.gameLog.length) {
      const g = v2.gameLog[v2.gameLog.length - 1];
      const brk = g.server !== null && g.winner !== g.server && !g.tiebreak;
      if (brk) t.breaks[g.winner] += 1;
      let kind = 'hold';
      let tag = `Гейм ${g.n}`;
      if (v2.finished) { kind = 'set'; tag = 'Сет'; }
      else if (brk) { kind = 'brk'; tag = 'Брейк'; }
      else if (t.bp) { tag = 'Спасли брейк-пойнт'; }
      const ev = { kind, tag, who: pairs[g.winner].names, min, score: `${v2.games[0]}:${v2.games[1]}`, trail: t.trail.slice() };
      t.log.unshift(ev);
      t.events.unshift(ev);
      t.events.length = Math.min(t.events.length, 3);
      t.trail = [];
      t.bp = false;
      t.fresh = true;
    } else {
      t.trail.push(ptLabel(v2));
    }
    return s2;
  };
  return t;
}

// Живой счёт по часам мира. render(s, view(s), tracker, first) вызывается сразу и после каждого очка;
// first — счёт показан заново (открытие, новый круг, возврат на вкладку), без анимации «свежего».
// withHistory — трекер видит матч с первого очка (лента и цифры «Матча»).
export function startLive(render, withHistory = false) {
  let cur = null;
  const build = (pos) => {
    const t = makeTracker();
    let s;
    if (withHistory) {
      s = createScore({ format: FORMAT_LEAGUE, mode: 'points', firstServer: 0 });
      BRONZE.forEach((side, i) => { s = t.track(s, side, Math.max(1, Math.round((i / BRONZE.length) * 46))); });
    } else s = bronzeStart();
    const seq = cycleSeq(pos.c);
    for (let i = 0; i < pos.k; i++) s = t.track(s, seq[i], liveMinute(i));
    return { c: pos.c, k: pos.k, s, t };
  };
  const step = () => {
    const pos = livePos();
    if (cur && pos.c === cur.c && pos.k === cur.k + 1) {
      cur.s = cur.t.track(cur.s, cycleSeq(cur.c)[cur.k], liveMinute(cur.k));
      cur.k += 1;
      render(cur.s, view(cur.s), cur.t, false);
    } else if (!cur || pos.c !== cur.c || pos.k !== cur.k) {
      cur = build(pos);
      render(cur.s, view(cur.s), cur.t, true);
    }
    setTimeout(step, Math.max(40, (pos.next - worldSec()) * 1000 + 30));
  };
  step();
}

function renderSides(root, v) {
  const lead = v.games[0] === v.games[1] ? -1 : v.games[0] > v.games[1] ? 0 : 1;
  [0, 1].forEach((i) => {
    const side = root.querySelector(`[data-side="${i}"]`);
    if (!side) return;
    side.classList.toggle('lead', lead === i);
    side.classList.toggle('trail', lead === 1 - i);
    setTick(side.querySelector('[data-games]'), v.games[i]);
    const b = side.querySelector('.ball');
    if (b) b.style.visibility = v.server === i && !v.finished ? 'visible' : 'hidden';
  });
  const p = ptsOf(v);
  setTick(root.querySelector('[data-p="0"]'), p[0]);
  setTick(root.querySelector('[data-p="1"]'), p[1]);
}

function pageToday() {
  const card = document.querySelector('.live-card');
  startLive((s, v) => {
    renderSides(card, v);
    card.querySelector('[data-say]').textContent = phrase(s, v);
  });
}

// «Сегодня» без me (гость и вошедший): блока «Ваш матч» нет, «Рейтинг лиги» — первые три места,
// как их отдаёт сервер без me (в показе — ваше место и соседи по местам).
function todayWithoutMe() {
  const mine = document.getElementById('t');
  if (mine) mine.remove();
  const card = document.querySelector('#r .card');
  if (!card) return;
  card.innerHTML = D.RATING.slice(0, 3).map((r) => {
    const p = D.player(r.player);
    return `<a class="row rank-row" href="${keepTheme(playerHref(p.id))}"><span class="num place muted">${r.place}</span><span class="grow strong ellipsis">${esc(p.name)}</span><span class="pts">${D.fmt(r.points)}</span></a>`;
  }).join('');
}

// Кружок справа в шапке «Сегодня» и «Рейтинга» (.topbar .ava-btn). В показе — портрет Хвана из разметки.
// Гостю — стеклянная капсула «Войти» со значком человека: один значок был бы похож на кружок
// вошедшего без фото и имени. Вошедшему — своё фото (середина кадра: снимок кадрирует сервер),
// без фото — инициалы, без имени — значок человека; ведёт в «Я».
const meSvg = (px) => icon('me').replace('<svg ', `<svg aria-hidden="true" style="width:${px}px;height:${px}px" `);
const initialsOf = (name) => {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return w.length ? `${w[0][0]}${w.length > 1 ? w[w.length - 1][0] : ''}`.toUpperCase() : '';
};
function meButton() {
  if (ME) return;
  const from = document.body.dataset.page === 'rating' ? 'rating' : 'today';
  document.querySelectorAll('.topbar .ava-btn').forEach((el) => {
    if (VIEW.kind === 'guest') {
      el.outerHTML = `<a class="btn small glass" href="${keepTheme(`login.html?trial&from=${from}`)}">${meSvg(22)}<span>Войти</span></a>`;
      return;
    }
    const me = VIEW.me || { name: '', photo: false };
    const ini = initialsOf(me.name);
    const inner = me.photo ? `<img src="${USER_PHOTO}" alt="" style="object-position:50% 50%">`
      : `<span class="av" aria-hidden="true">${ini ? esc(ini) : meSvg(24)}</span>`;
    el.outerHTML = `<a class="ava-btn" href="${keepTheme('me.html')}" aria-label="${esc(me.name ? `Я · ${me.name}` : 'Я')}">${inner}</a>`;
  });
}

// хвост розыгрыша гейма: последние четыре очка, последнее — жирным; не входит в строку —
// переносится на вторую по очкам целиком, последнее (главное) очко не обрезается
// (неразрывный пробел держит точку при своём очке, строка рвётся только между очками)
const trailHtml = (arr) => {
  const last = arr.slice(-4);
  return (arr.length > 4 ? '… ' : '') + last.map((x, i) => (i === last.length - 1 ? `<b>${esc(x)}</b>` : esc(x))).join('&nbsp;· ');
};
export const clockText = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
};

function pageMatch() {
  const hero = document.querySelector('.match-hero');
  const rec = document.querySelector('.record');
  const grid = document.querySelector('.flow-grid');
  const flowSay = document.querySelector('.flow-say');
  const feed = document.querySelector('.feed');
  const stats = document.querySelector('.stats-card');
  const clock = document.querySelector('[data-clock]');
  const showClock = () => { clock.textContent = clockText(liveClock()); };
  showClock();
  setInterval(showClock, 1000);
  let last = null;

  startLive((s, v, t, first) => {
    last = v;
    renderSides(hero, v);
    hero.querySelector('[data-say]').textContent = phrase(s, v);
    const lead = v.games[0] === v.games[1] ? -1 : v.games[0] > v.games[1] ? 0 : 1;
    const p = ptsOf(v);
    [0, 1].forEach((i) => {
      const r = rec.querySelector(`[data-row="${i}"]`);
      r.classList.toggle('serving', v.server === i && !v.finished);
      r.classList.toggle('trail', lead === 1 - i);
      const tb = v.tiebreak && !v.inTiebreak && v.finished ? v.tiebreak : null;
      const g = r.querySelector('[data-g]');
      const text = String(v.games[i]);
      if (tb && (v.games[i] === 7 || (v.games[i] === 6 && v.games[1 - i] === 7))) g.innerHTML = `${text}<sup>${tb[i]}</sup>`;
      else setTick(g, text);
      setTick(r.querySelector('[data-pt]'), v.finished ? '' : p[i]);
    });

    // лента: текущий гейм сверху, ниже последние события
    let html = '';
    if (!v.finished) {
      const srvNames = PAIRS[v.server].names;
      html += `<div class="ev now"><span class="t" aria-label="Сейчас"><span class="dot"></span></span><span class="txt"><span class="tag">Гейм ${v.gameLog.length + 1}</span><span class="srv" aria-label="подают">${ballSvg()}</span>${esc(srvNames)}<span class="sub">${t.trail.length ? trailHtml(t.trail) : 'первое очко'}</span></span><span class="sc"></span></div>`;
    }
    t.events.forEach((e, k) => {
      html += `<div class="ev ${e.kind}${k === 0 && t.fresh && !first ? ' fresh' : ''}"><span class="cap t">${e.min}′</span><span class="txt"><span class="tag">${esc(e.tag)}</span>${esc(e.who)}<span class="sub">${trailHtml(e.trail)}</span></span><span class="num sc">${e.score}</span></div>`;
    });
    feed.innerHTML = html;

    // цифры
    const pct = (i) => (t.srvPts[i] ? Math.round((t.srvWon[i] / t.srvPts[i]) * 100) : 0);
    const rows = [
      ['Очков выиграно', t.won[0], t.won[1], t.won[0], t.won[1]],
      ['На своей подаче', `${pct(0)}%`, `${pct(1)}%`, pct(0), pct(1)],
      ['Брейки', t.breaks[0], t.breaks[1], t.breaks[0], t.breaks[1]],
    ];
    stats.innerHTML = rows.map(([label, a, b, x, y]) => {
      const max = Math.max(x, y, 1);
      return `<div class="stat-row"><div class="stat-top"><span class="num">${a}</span><span class="cap">${label}</span><span class="num">${b}</span></div><div class="stat-bars"><span><i class="${x > y ? 'more' : ''}" style="width:${(x / max) * 100}%"></i></span><span><i class="${y > x ? 'more' : ''}" style="width:${(y / max) * 100}%"></i></span></div></div>`;
    }).join('');

    // ход сета: каждый гейм — клетка у победителя
    const log = v.gameLog;
    let cells = '';
    [0, 1].forEach((i) => {
      cells += `<span class="cap">${PAIRS[i].a}</span>`;
      for (let n = 0; n < 13; n++) {
        const g = log[n];
        let cls = 'cell';
        if (g && g.winner === i) cls += ' won' + (g.server !== null && g.server !== i ? ' brk' : '');
        if (!g && n === log.length && !v.finished) cls += ' now';
        cells += `<span class="${cls}"></span>`;
      }
    });
    grid.innerHTML = cells;
    const breaks = log.filter((g) => g.server !== g.winner && !g.tiebreak);
    if (v.finished) flowSay.textContent = `Сет окончен, ${v.scoreLong}`;
    else if (!breaks.length) flowSay.textContent = `${log.length} геймов, все на своей подаче`;
    else {
      const b = breaks[breaks.length - 1];
      flowSay.textContent = `Брейк в ${b.n}-м гейме: взяли ${PAIRS[b.winner].names}`;
    }
  }, true);

  // переключатель «Счёт · Лента · Цифры» прокручивает к разделу и следует за прокруткой
  const seg = document.querySelector('.seg');
  if (seg) segSpy(seg);

  // «Поделиться»: карточка 9:16 — корт, пары на своих половинах, счёт по геймам на сетке
  const share = document.querySelector('[data-share]');
  if (share) {
    const m = LIVE;
    const lines = (i) => `<span class="strong">${PAIRS[i].a}<br>${PAIRS[i].b}</span>`;
    shareSheet({
      trigger: share,
      title: 'Матч идёт',
      text: () => `${D.TOURNAMENT.name}, ${m.title.toLowerCase()}: ${PAIRS[0].names} — ${PAIRS[1].names}, ${last ? `${last.games[0]}:${last.games[1]}` : ''}, идёт`,
      card: () => storyCard({
        surface: D.court(m.court).surface,
        label: `${m.title}: ${PAIRS[0].names} — ${PAIRS[1].names}, идёт, ${last ? `${last.games[0]}:${last.games[1]}` : ''}`,
        hole: { w: 112, h: 16 },
        zones: {
          top: brandHtml(),
          bt: duoHtml(m.pairs[0], 'sm'),
          st: lines(0),
          net: `<span class="hero-num">${last ? last.games[0] : m.games[0]}:${last ? last.games[1] : m.games[1]}</span>`,
          sb: lines(1),
          bb: duoHtml(m.pairs[1], 'sm'),
          bottom: metaLines(m, ['идёт']),
        },
      }),
    });
  }
}

function pagePlayer() {
  // «Поделиться»: карта игрока — тот же предмет, что на экране
  const share = document.querySelector('[data-share]');
  const card = document.querySelector('.member');
  if (!share || !card) return;
  const p = D.player(D.ME.player);
  shareSheet({
    trigger: share,
    title: 'Карта игрока',
    text: () => `${p.name} — ${D.LEAGUE.name}: КПР ${p.kpr.toFixed(1)}, «${D.rankLabel(p.rank)}», №${p.place} в рейтинге`,
    card: () => card.outerHTML,
  });
}

function pageJudge() {
  let s = bronzeStart();
  const keys = [...document.querySelectorAll('.key')];
  const float = document.querySelector('.games-float');
  const undo = document.querySelector('.undo');
  const undoNote = undo.querySelector('.muted');
  let msgTimer = null;
  let prevText = '';

  const draw = () => {
    const v = view(s);
    keys.forEach((k, i) => {
      k.classList.toggle('serving', v.server === i);
      k.classList.toggle('has-adv', v.advantage === i);
      setTick(k.querySelector('[data-pts]'), v.finished ? (v.winner === i ? '✓' : '') : keyPtsOf(v)[i]);
    });
    // решающее очко (второе «ровно»): на капсуле геймов вместо «геймы» — плашка «Решающее очко»
    float.classList.toggle('deciding', v.decidingPoint);
    if (!float.classList.contains('flashmsg')) {
      setTick(float.querySelector('[data-g="0"]'), v.games[0]);
      setTick(float.querySelector('[data-g="1"]'), v.games[1]);
    }
    undo.disabled = !v.canUndo;
    undoNote.textContent = prevText ? `было ${prevText}` : '';
  };
  const say = (text) => {
    float.classList.add('flashmsg');
    float.querySelector('.msg').textContent = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { float.classList.remove('flashmsg'); float.querySelector('.msg').textContent = ''; draw(); }, 1800);
  };

  keys.forEach((k, i) => {
    k.addEventListener('pointerdown', (e) => {
      const r = k.getBoundingClientRect();
      k.style.setProperty('--x', `${e.clientX - r.left}px`);
      k.style.setProperty('--y', `${e.clientY - r.top}px`);
    });
    k.addEventListener('click', () => {
      const before = view(s);
      const res = tryApply(s, { t: 'point', side: i });
      if (!res.accepted) return;
      prevText = before.inTiebreak ? before.tiebreak.join(':') : `${ptsOf(before).join(':')}`;
      s = res.state;
      k.classList.remove('hit'); void k.offsetWidth; k.classList.add('hit');
      if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(12);
      const v = view(s);
      if (v.finished) say(`Сет · ${PAIRS[v.winner].names} ${v.scoreText}`);
      else if (v.games[i] > before.games[i]) say(`Гейм · ${v.games[0]}:${v.games[1]} · смена подачи`);
      draw();
    });
  });
  undo.addEventListener('click', () => {
    const res = tryApply(s, { t: 'undo' });
    if (!res.accepted) return;
    s = res.state;
    prevText = '';
    clearTimeout(msgTimer);
    float.classList.remove('flashmsg');
    float.querySelector('.msg').textContent = '';
    draw();
  });
  draw();
}

// ---------- переключатель разделов страницы ----------
// <nav class="seg glass"> или <nav class="tabs glass"> со ссылками #раздел: нажатие прокручивает
// к разделу так, чтобы он не уходил под прилипший переключатель; выбранный пункт следует за прокруткой.
export function segSpy(nav) {
  const links = [...nav.querySelectorAll('a[href^="#"]')].filter((a) => !a.hidden);
  const targets = links.map((a) => { try { return document.querySelector(a.getAttribute('href')); } catch { return null; } });
  const set = (k) => links.forEach((a, j) => (j === k ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  let lock = 0;
  links.forEach((a, k) => a.addEventListener('click', (e) => {
    const t = targets[k];
    if (!t) return;
    e.preventDefault();
    const top = k === 0 ? 0 : t.getBoundingClientRect().top + scrollY - nav.offsetHeight - 24;
    lock = Date.now() + 800;
    set(k);
    scrollTo({ top: Math.max(0, top), behavior: REDUCE ? 'auto' : 'smooth' });
  }));
  let busy = false;
  const spy = () => {
    busy = false;
    if (Date.now() < lock) return;
    const line = nav.getBoundingClientRect().bottom + 40;
    let cur = 0;
    targets.forEach((t, k) => { if (t && k && t.getBoundingClientRect().top <= line) cur = k; });
    if (scrollY > 0 && innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = targets.length - 1;
    set(cur);
  };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(spy); } }, { passive: true });
  spy();
}

// ---------- нижняя шторка ----------
// sheet(el, scrim) — выезд снизу и уход вниз (классы .slide и .off), фокус внутри шторки,
// Esc, фон и ручка вниз закрывают, фокус возвращается к тому, что её открыло.
// Разметка: <div class="scrim slide off"></div><div class="bsheet float slide off" role="dialog">…</div>
export function sheet(el, scrim, { onClose } = {}) {
  el.classList.add('slide', 'off'); scrim.classList.add('slide', 'off');
  el.setAttribute('inert', '');
  el.hidden = false; scrim.hidden = false;
  let back = null;
  const focusables = () => [...el.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((x) => !x.disabled && !x.hidden && x.getClientRects().length);
  const api = {
    // opener — куда вернуть фокус после закрытия (по умолчанию — то, что было в фокусе)
    open(opener = null) {
      back = opener || (document.activeElement && document.activeElement !== document.body ? document.activeElement : null);
      el.removeAttribute('inert');
      el.setAttribute('aria-modal', 'true');
      el.classList.remove('off'); scrim.classList.remove('off');
      document.documentElement.classList.add('sheet-open');
      requestAnimationFrame(() => (focusables()[0] || el).focus({ preventScroll: true }));
    },
    close() {
      if (!api.isOpen) return;
      el.classList.add('off'); scrim.classList.add('off');
      el.setAttribute('inert', '');
      document.documentElement.classList.remove('sheet-open');
      if (back && back.isConnected) back.focus({ preventScroll: true });
      if (onClose) onClose();
    },
    get isOpen() { return !el.classList.contains('off'); },
  };
  scrim.addEventListener('click', () => api.close());
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); api.close(); }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  const handle = el.querySelector('.handle');
  if (handle) {
    let y0 = null;
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('.handle')) y0 = e.clientY; });
    addEventListener('pointerup', (e) => { if (y0 !== null && e.clientY - y0 > 40) api.close(); y0 = null; });
  }
  return api;
}

// «Поделиться»: шторка с карточкой и кнопкой. Системное окно «Поделиться», где его нет —
// ссылка в буфер обмена, где и буфер закрыт — адрес текстом под кнопками.
// Ссылка уходит без выбранной темы. card и text — строка или функция (считаются при открытии).
export function shareSheet({ trigger, title, text = '', url = null, card = '' }) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const el = document.createElement('div');
  el.className = 'bsheet float share-sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', title);
  el.tabIndex = -1;
  el.innerHTML = `<span class="handle"></span>
    <div class="title">${esc(title)}</div>
    <div class="share-card"></div>
    <div class="btn-row">
      <button class="btn quiet" type="button" data-close>Закрыть</button>
      <button class="btn main" type="button" data-send>${icon('share')}<span>Поделиться</span></button>
    </div>
    <p class="share-note" role="status"></p>`;
  (document.querySelector('.app') || document.body).append(scrim, el);
  const box = el.querySelector('.share-card');
  const label = el.querySelector('[data-send] span');
  const note = el.querySelector('.share-note');
  const val = (x) => (typeof x === 'function' ? x() : x);
  const link = () => {
    if (url) return url;
    const u = new URL(location.href);
    u.searchParams.delete('theme'); u.searchParams.delete('share'); u.searchParams.delete('now'); u.searchParams.delete('as');
    return u.href;
  };
  const s = sheet(el, scrim, { onClose: () => { label.textContent = 'Поделиться'; note.textContent = ''; } });
  const open = (opener = trigger) => {
    const c = val(card);
    box.innerHTML = c || '';
    box.hidden = !c;
    hydrate(box);
    s.open(opener);
  };
  el.querySelector('[data-close]').addEventListener('click', () => s.close());
  el.querySelector('[data-send]').addEventListener('click', async () => {
    const t = val(text);
    const u = link();
    try {
      if (navigator.share) { await navigator.share({ title, text: t, url: u }); return; }
      await navigator.clipboard.writeText(t ? `${t}\n${u}` : u);
      label.textContent = 'Ссылка скопирована';
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      note.textContent = u;
    }
  });
  if (trigger) trigger.addEventListener('click', (e) => { e.preventDefault(); open(); });
  if (new URLSearchParams(location.search).has('share')) open();
  return { open, close: () => s.close() };
}

// ---------- разметка корта ----------
// courtLines({ half: true }) — половина корта сверху вниз: сетка, коридоры, линия подачи, задняя линия
// с меткой (растягивается на весь предмет). courtLines({ hole }) — весь корт в карточке 9:16 (240 × 427),
// корт 10,97 × 23,77 м высотой 330 px; hole — вырез под цифрами на сетке { w, h }.
let holeId = 0;
export function courtLines({ half = false, hole = null } = {}) {
  if (half) {
    return `<svg class="court-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path class="net" d="M2 7H98"/>
      <path d="M6 7V90M94 7V90M17 7V90M83 7V90M17 43H83M50 7V43"/>
      <path class="base" d="M6 90H94M50 90V86.5"/>
    </svg>`;
  }
  const k = 330 / 23.77, w = 10.97 * k, x0 = (240 - w) / 2, x1 = 240 - x0, al = 1.37 * k;
  const y0 = 48.5, y1 = 378.5, net = (y0 + y1) / 2, sv = 6.4 * k;
  const r = (n) => Math.round(n * 10) / 10;
  const id = `court-hole-${++holeId}`;
  const h = hole || { w: 0, h: 0 };
  return `<svg class="court-lines" viewBox="0 0 240 427" aria-hidden="true" focusable="false">
    <defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="427"><rect width="240" height="427" fill="#fff"/><rect x="${r(120 - h.w / 2)}" y="${r(net - h.h / 2)}" width="${h.w}" height="${h.h}" rx="6" fill="#000"/></mask></defs>
    <g mask="url(#${id})">
      <path d="M${r(x0)} ${y0}H${r(x1)}V${y1}H${r(x0)}Z M${r(x0 + al)} ${y0}V${y1} M${r(x1 - al)} ${y0}V${y1} M${r(x0 + al)} ${r(net - sv)}H${r(x1 - al)} M${r(x0 + al)} ${r(net + sv)}H${r(x1 - al)} M120 ${y0}v8 M120 ${y1}v-8" />
      <path class="net" d="M${r(x0 - 9)} ${r(net)}H${r(x1 + 9)}" />
    </g>
  </svg>`;
}

// Карточка 9:16, которой делятся: предмет цвета покрытия и разметка корта целиком.
// zones: top — над кортом, bt — у верхней задней линии, st — верхнее поле подачи, net — на сетке,
// sb и bb — то же внизу, bottom — под кортом.
const ZONES = ['top', 'bt', 'st', 'net', 'sb', 'bb', 'bottom'];
export function storyCard({ surface = 'clay', label = '', hole = { w: 112, h: 16 }, zones = {} }) {
  return `<figure class="story" data-surface="${surface}" role="img" aria-label="${esc(label)}">
    ${courtLines({ hole })}
    ${ZONES.map((z) => `<div class="z" data-z="${z}" aria-hidden="true">${zones[z] || ''}</div>`).join('')}
  </figure>`;
}
// знак лиги для карточки: мяч и «Лига TS»
export const brandHtml = () => `<span class="brand-mark">${ballSvg('glow')}<span class="cap">${esc(D.LEAGUE.short)}</span></span>`;
// подпись под кортом в две строки: «Июньский кубок · финал / 19 июня · корт 1»;
// если турнир с кругом в строку не влезают — «Июньский кубок / Полуфинал · 19 июня»
export function metaLines(m, rest) {
  const t = D.TOURNAMENT.name;
  const one = `${t} · ${m.title.toLowerCase()}`;
  const [a, b] = one.length <= 22 ? [one, rest.join(' · ')] : [t, [m.title, ...rest].join(' · ')];
  return `<span class="cap">${esc(a)}</span><span class="cap">${esc(b)}</span>`;
}

// ---------- розыгрыш сыгранного матча ----------
// Проходит pointLog матча из data.js через движок счёта и собирает геймы (кто подавал, кто взял,
// брейк, спасённые брейк-пойнты, хвост розыгрыша, счёт и минута) и цифры матча.
// Если итог не сходится с sets из data.js — возвращает null: экран показывает только итог.
// Хвост розыгрыша гейма — те же подписи, что в ленте живого матча (ptLabel).
export function matchStory(m) {
  if (typeof m === 'string') m = D.match(m);
  if (!m || !m.pointLog || !m.sets || m.sets.length !== 1 || m.state !== 'done') return null;
  const seq = m.pointLog;
  const mins = parseInt(m.duration, 10) || null;
  const st = { won: [0, 0], srvPts: [0, 0], srvWon: [0, 0], bp: [0, 0], bpWon: [0, 0], breaks: [0, 0], best: [0, 0], ptBest: [0, 0] };
  const games = [];
  let s = createScore({ format: FORMAT_LEAGUE, mode: 'points', firstServer: m.firstServer || 0 });
  let trail = [];
  let bpGame = [0, 0];
  let run = 0, runSide = null, prun = 0, prunSide = null;
  seq.forEach((side, i) => {
    const v = view(s);
    const srv = v.server;
    const rcv = 1 - srv;
    if (!v.inTiebreak && applyEvent(s, { t: 'point', side: rcv }).games[rcv] > s.games[rcv]) {
      st.bp[rcv] += 1; bpGame[rcv] += 1;
      if (side === rcv) st.bpWon[rcv] += 1;
    }
    s = applyEvent(s, { t: 'point', side });
    st.won[side] += 1; st.srvPts[srv] += 1;
    if (side === srv) st.srvWon[srv] += 1;
    prun = prunSide === side ? prun + 1 : 1; prunSide = side;
    st.ptBest[side] = Math.max(st.ptBest[side], prun);
    const v2 = view(s);
    if (v2.gameLog.length > v.gameLog.length) {
      const g = v2.gameLog[v2.gameLog.length - 1];
      const brk = g.server !== null && g.winner !== g.server && !g.tiebreak;
      if (brk) st.breaks[g.winner] += 1;
      run = runSide === g.winner ? run + 1 : 1; runSide = g.winner;
      st.best[g.winner] = Math.max(st.best[g.winner], run);
      games.push({
        n: g.n, server: g.server, winner: g.winner, brk, tb: g.tiebreak,
        saved: !brk && !g.tiebreak ? bpGame[1 - g.server] : 0,
        score: v2.games.slice(), trail,
        min: mins ? Math.max(1, Math.round(((i + 1) / seq.length) * mins)) : null,
        last: v2.finished,
      });
      trail = []; bpGame = [0, 0];
    } else {
      trail.push(ptLabel(v2));
    }
  });
  const v = view(s);
  const [a, b, tb] = m.sets[0];
  const ok = v.finished && v.winner === m.winner && v.games[0] === a && v.games[1] === b
    && (tb === undefined ? !v.tiebreak : !!v.tiebreak && Math.min(...v.tiebreak) === tb);
  return ok ? { ...st, games, points: seq.length, view: v } : null;
}

// ---------- листание страницами ----------
// Для экранов-рассказов, где страницы прилипают к краю: шаг колеса или тачпада листает ровно
// на страницу; пока колесо крутится дальше (инерция), следующая страница не перелистывается.
// pages — разделы-страницы, current() — номер текущей.
export function wheelPaging(pages, current) {
  let releaseAt = 0;
  addEventListener('wheel', (e) => {
    if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const dir = Math.sign(e.deltaY);
    const i = current();
    const r = pages[i].getBoundingClientRect();
    // страница выше экрана — сначала докрутить её саму
    if ((dir > 0 && r.bottom > innerHeight + 2) || (dir < 0 && r.top < -2)) return;
    const next = i + dir;
    if (next < 0 || next >= pages.length) return;
    e.preventDefault();
    const now = performance.now();
    if (now < releaseAt) { releaseAt = Math.max(releaseAt, now + 180); return; }
    releaseAt = now + 650;
    scrollTo({ top: pages[next].offsetTop, behavior: REDUCE ? 'auto' : 'smooth' });
  }, { passive: false });
}

// ---------- готовые куски разметки ----------
// Кадр лица в портрете: центр лица (доли ширины и высоты снимка 3:4). Кружок показывает лицо,
// а не фигуру по пояс: снимок увеличен в 2,4 раза и сдвинут так, что лицо в центре.
const FACE = {
  d01: [0.56, 0.26], d02: [0.53, 0.21], d03: [0.50, 0.20], d04: [0.52, 0.19], d05: [0.54, 0.23],
  d06: [0.49, 0.25], d07: [0.49, 0.33], d08: [0.49, 0.28], d09: [0.50, 0.27], d10: [0.53, 0.30],
};
const faceStyle = (key) => {
  const [x, y] = FACE[key] || [0.5, 0.24];
  return `--fx:${x};--fy:${(y * 4 / 3).toFixed(3)}`;
};
// Кружок игрока: портрет (кадр лица) или инициалы. size: '' (44), 'sm' (32), 'xs' (28), 'lg' (64).
export function avHtml(playerId, size = '') {
  const p = D.player(playerId);
  const src = D.portraitSrc(p);
  const cls = `av${size ? ' ' + size : ''}`;
  return src
    ? `<span class="${cls}"><img class="face" src="${src}" alt="" loading="lazy" style="${faceStyle(p.portrait)}"></span>`
    : `<span class="${cls}" aria-hidden="true">${D.initials(p)}</span>`;
}
// Пара: два наложенных кружка.
export const duoHtml = (pairId, size = 'sm') =>
  `<span class="duo${size === 'xs' ? ' xs' : ''}" aria-hidden="true">${D.pair(pairId).players.map((x) => avHtml(x, size === 'xs' ? 'xs' : size)).join('')}</span>`;

// Плашка «пара против пары». m — матч из data.js (или его id).
// opts.slim — узкая плашка для сетки; opts.href — куда ведёт (по умолчанию matchHref: экран
// по состоянию матча и ?m=<id>); opts.live — живой счёт {games, points, server}.
export function tileHtml(m, opts = {}) {
  if (typeof m === 'string') m = D.match(m);
  const slim = !!opts.slim;
  const live = m.state === 'live' ? { games: m.games, points: m.points, server: m.server, ...(opts.live || {}) } : null;
  // тон «ваш матч» — только у вашего ближайшего матча (ME.match), а не у всех матчей вашей пары;
  // у гостя и вошедшего «вашего» матча нет
  const mine = !!ME && m.id === ME.match;
  const c = m.court ? D.COURTS[m.court] : null;
  const href = keepTheme(opts.href || matchHref(m));
  let left = '';
  if (m.state === 'live') left = `<span class="dot"></span><span class="cap">Идёт${c ? ' · ' + c.name : ''}</span>`;
  else if (m.state === 'soon') left = `<span class="srf-dot" data-surface="${c ? c.surface : 'clay'}"></span><span class="cap">${slim ? m.time + ' · ' : ''}${c ? D.courtLine(m.court) : ''}</span>`;
  else left = `<span class="cap">${slim ? m.title : 'Сыгран'}${!slim && m.duration ? ' · ' + m.duration : ''}</span>`;
  const right = slim ? '' : `<span class="cap mt-what">${m.title}</span>`;

  const side = (i) => {
    const id = m.pairs[i];
    let cls = 'mt-side';
    let score = '';
    if (m.state === 'done') {
      cls += m.winner === i ? ' win' : ' lose';
      score = m.sets.map(([a, b, tb]) => {
        const g = i === 0 ? a : b;
        const lost = (i === 0 ? a < b : b < a);
        return `<span class="num mt-set">${g}${tb !== undefined && lost ? `<sup>${tb}</sup>` : ''}</span>`;
      }).join('');
    } else if (live) {
      const lead = live.games[i] > live.games[1 - i];
      cls += lead ? ' lead' : '';
      score = `<span class="num mt-set tick" data-games>${live.games[i]}</span>`;
    }
    const srv = live && live.server === i;
    // в узкой плашке фамилии в две строки: в 248 px «Сарсенбаев / Жаксыбеков» в строку не входит;
    // в широкой — в строку, а если не входят (360 px, рядом очки) — переносятся по фамилиям целиком
    const [a, b] = D.pairLines(id);
    const name = slim ? `<span>${a}</span><span><span class="vh"> / </span>${b}</span>` : `<span class="nm">${a} /</span> <span class="nm">${b}</span>`;
    return `<span class="${cls}${srv ? ' serve' : ''}" data-side="${i}">${duoHtml(id, slim ? 'xs' : 'sm')}<span class="mt-name">${name}</span>${live ? ballSvg('mt-ball') : ''}${score}</span>`;
  };
  let aside = '';
  const pt = (i) => `<span class="num tick${live.points[i] === 'AD' ? ' ad' : ''}" data-p="${i}">${live.points[i]}</span>`;
  if (live) aside = `<span class="mt-now" aria-label="Очки в гейме">${pt(0)}${pt(1)}</span>`;
  else if (m.state === 'soon' && !slim) aside = `<span class="mt-when"><span class="num">${m.time}</span>${m.day === D.TODAY.dayMonth ? '' : `<span class="cap">${m.day}</span>`}</span>`;
  // скоро: у левого края полоса покрытия корта — цвет содержимого, как у шапки матча
  const strip = m.state === 'soon' && c ? `<span class="mt-srf" data-surface="${c.surface}" aria-hidden="true"></span>` : '';
  return `<a class="mt${slim ? ' slim' : ''}" data-state="${m.state}"${mine ? ' data-me' : ''} data-match="${m.id}" href="${href}">${strip}
  <span class="mt-head">${left}${right}</span>
  <span class="mt-body">${side(0)}${side(1)}${aside}</span>
</a>`;
}

// Живая плашка: счёт в плашках идущего матча идёт сам, по часам мира — как на «Сегодня» и в «Матче».
// Плашки из разметки (data-tile) app.js запускает сам; liveTiles(root) нужен только
// для плашек, вставленных из JS. Повторный вызов безопасен: плашка с data-live-on пропускается.
const liveSet = new Set();
let liveView = null;
function paintTile(el, v) {
  const lead = v.games[0] === v.games[1] ? -1 : v.games[0] > v.games[1] ? 0 : 1;
  [0, 1].forEach((i) => {
    const sd = el.querySelector(`.mt-side[data-side="${i}"]`);
    if (!sd) return;
    sd.classList.toggle('lead', lead === i);
    sd.classList.toggle('serve', v.server === i && !v.finished);
    setTick(sd.querySelector('[data-games]'), v.games[i]);
  });
  const p = ptsOf(v);
  setTick(el.querySelector('[data-p="0"]'), p[0]);
  setTick(el.querySelector('[data-p="1"]'), p[1]);
}
export function liveTiles(root = document) {
  const fresh = [...root.querySelectorAll('.mt[data-state="live"]:not([data-live-on])')];
  if (!fresh.length) return;
  fresh.forEach((el) => {
    el.setAttribute('data-live-on', '');
    liveSet.add(el);
    if (liveView) paintTile(el, liveView);
  });
  if (liveView) return;
  startLive((s, v) => {
    liveView = v;
    liveSet.forEach((el) => { if (el.isConnected) paintTile(el, v); else liveSet.delete(el); });
  });
}

// ---------- запуск ----------
// На любой странице: иконки, мячи, кружки игроков, плашки матчей, панель, ссылки с темой,
// «назад» по истории (data-step-back) и плавающие строки над покрытием (data-float).
export function hydrate(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  root.querySelectorAll('[data-ball]').forEach((el) => { el.outerHTML = ballSvg(el.dataset.ball); });
  root.querySelectorAll('[data-av]').forEach((el) => { el.outerHTML = avHtml(el.dataset.av, el.dataset.size || ''); });
  root.querySelectorAll('[data-duo]').forEach((el) => { el.outerHTML = duoHtml(el.dataset.duo, el.dataset.size || 'sm'); });
  root.querySelectorAll('[data-tile]').forEach((el) => { el.outerHTML = tileHtml(el.dataset.tile, { slim: el.hasAttribute('data-slim') }); });
  fixLinks(root);
  root.querySelectorAll('a[data-step-back]:not([data-step-on])').forEach((a) => { a.setAttribute('data-step-on', ''); backLink(a); });
  root.querySelectorAll('[data-float]').forEach((el) => { if (!watched.has(el)) watchOver(el); });
}

// Прилипающая деталь (.stick: переключатель, поиск) получает класс .stuck, пока держится сверху.
function watchStick() {
  const els = [...document.querySelectorAll('.stick')];
  if (!els.length) return;
  let busy = false;
  const check = () => {
    busy = false;
    els.forEach((el) => {
      const top = parseFloat(getComputedStyle(el).top) || 0;
      el.classList.toggle('stuck', scrollY > 0 && el.getBoundingClientRect().top <= top + 1);
    });
  };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(check); } }, { passive: true });
  check();
}

const page = document.body.dataset.page;
const dock = document.body.dataset.dock || (page === 'today' ? 'today' : page === 'player' ? 'me' : 'none');
// карта Хвана — «Я» в показе; если адрес просит другой вид (?as=guest…), «Я» — me.html
const away = page === 'player' && !ME && !!VIEW.as;
if (away) location.replace(keepTheme('me.html'));
hydrate();
mountDock(dock);
watchStick();
meButton();
if (page === 'today') { pageToday(); if (!ME) todayWithoutMe(); }
if (page === 'match') pageMatch();
if (page === 'judge') pageJudge();
if (page === 'player' && !away) pagePlayer();
if (page !== 'today' && page !== 'match') liveTiles();
