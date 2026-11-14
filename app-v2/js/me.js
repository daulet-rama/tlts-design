// «Я» пользователя (me.html) и общее для экранов этапа «Пользователи» в пробной версии:
// состояние в этом браузере (аккаунт, профиль, заявка, показ), кружок своего фото, членская карта,
// карточка заявки, шторки «Что хранится» и подтверждения, надпись внизу экрана.
//
// Состояние живёт в браузере (localStorage, ключ USERS_KEY, всё в try/catch) и повторяет сервер:
// server — аккаунты по почте (профиль, заявка), session — кто вошёл, trialCode — код пробной версии
// сохранён на телефоне, show — включён показ «глазами Германа Хвана», draft — черновик анкеты.
//
// Адреса me.html?as=guest | user | user-nophoto | user-empty | candidate | member | declined | offline —
// готовые состояния пользователя мира (Арман Есенов, D.APPLICANT). Состояние из адреса записывается
// в браузер, и дальше по экранам всё идёт от него; ?as= убирается из адреса (кроме offline: без связи —
// вид, а не состояние). Без ?as= — то, что записано. ?note=deleted — внизу «Аккаунт удалён»,
// ?note=again — «Войдите снова» (сеанс кончился, приложение стало гостем).
import { D, icon, ballSvg, keepTheme, hydrate, sheet, esc } from '../app.js';
import { USER, USERS_KEY, TRIAL, LEVELS } from './join.data.js';
import { stateOf, doneCount, initialsOf, nameLines } from './join.logic.js';

export const A = D.APPLICANT;
export const FULL_NAME = `${A.first} ${A.last}`;
const params = new URLSearchParams(location.search);

/* ------------------------------------------------------------ состояние */

const blank = () => ({ trialCode: false, show: false, session: null, server: {}, draft: null, pendingEmail: '' });
export function loadU() {
  try {
    const u = JSON.parse(localStorage.getItem(USERS_KEY) || 'null');
    if (!u || typeof u !== 'object') return blank();
    return { ...blank(), ...u, server: u.server && typeof u.server === 'object' ? u.server : {} };
  } catch { return blank(); }
}
export function saveU(u) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); } catch { /* без хранилища всё работает до перезагрузки */ }
}
// есть ли запись вообще: без записи страницы мира открываются в показе (app.js, VIEW)
export function hasStored() {
  try { return localStorage.getItem(USERS_KEY) !== null; } catch { return false; }
}
// состояние, по которому нарисован этот экран «Я» (адрес ?as= записывает его в браузер; «Настройки» берут его же)
let pageU = null;
export const pageState = () => pageU || loadU();

// аккаунт того, кто вошёл: { email, profile, app, last } или null
export const account = (u) => (u.session && u.server[u.session.email]) || null;

// ключ состояния заявки для текстов (join.data.js): отказ не на шаге Совета — 'declined-level'
export const appKey = (app) => (!app ? 'start' : app.status === 'declined' && app.at === 'level' ? 'declined-level' : app.status);

// кто смотрит: guest | user | candidate | member | declined
export function whoOf(u) {
  const a = account(u);
  if (!a) return 'guest';
  const s = a.app && a.app.status;
  if (s === 'member' || s === 'declined') return s;
  return s ? 'candidate' : 'user';
}

const SAMPLE_FORM = { pairYears: A.pairYears, hand: A.hand, backhand: A.backhand, amateur: true, age25: true, consentData: true, consentPublish: false };
const arman = ({ profile = {}, app = null } = {}) => ({
  email: A.email,
  profile: { name: FULL_NAME, about: USER.about, level: USER.level, photo: true, removed: false, ...profile },
  app,
  last: null,
});
const appOf = (status, extra = {}) => ({ status, sentAt: D.TODAY.dayMonth, form: { name: FULL_NAME, ...SAMPLE_FORM }, ...extra });

// готовое состояние пользователя мира: для адресов ?as= (me.html, profile.html) и ?step= (join.html)
export function seedU(kind) {
  const recs = {
    guest: () => arman(),
    user: () => arman(),
    offline: () => arman(),
    'user-nophoto': () => arman({ profile: { photo: false } }),
    'user-empty': () => arman({ profile: { name: '', about: '', level: null, photo: false } }),
    removed: () => arman({ profile: { photo: false, removed: true } }),
    start: () => arman(),
    form: () => arman(),
    candidate: () => arman({ app: appOf('level') }),
    level: () => arman({ app: appOf('level') }),
    council: () => arman({ app: appOf('council') }),
    fee: () => arman({ app: appOf('fee') }),
    member: () => arman({ app: appOf('member') }),
    declined: () => arman({ app: appOf('declined', { at: 'council' }) }),
    'declined-level': () => arman({ app: appOf('declined', { at: 'level' }) }),
  };
  if (!recs[kind]) return null;
  const u = blank();
  u.server[A.email] = recs[kind]();
  if (kind !== 'guest') { u.session = { email: A.email }; u.trialCode = true; }
  u.seed = kind;
  return u;
}

// состояние из адреса (?as= или ?step=): записать в браузер и убрать из адреса. Тот же вид второй раз
// подряд не перезаписывает записанное: ссылки мира несут ?as= дальше (app.js), и правки по пути не теряются.
// Ссылки этой страницы, которым app.js добавил ?as=, его теряют: дальше всё идёт от записанного.
export function seedFromUrl(name, keep = []) {
  const kind = params.get(name);
  let u = kind ? seedU(kind) : null;
  if (!u) return null;
  const cur = loadU();
  if (hasStored() && cur.seed === kind) u = cur; else saveU(u);
  if (!keep.includes(kind)) {
    const url = new URL(location.href);
    url.searchParams.delete(name);
    history.replaceState(history.state, '', url.pathname.split('/').pop() + url.search + url.hash);
    if (name === 'as') {
      document.querySelectorAll('a[href*="as="]').forEach((a) => {
        const h = new URL(a.getAttribute('href'), location.href);
        if (h.origin !== location.origin || !h.searchParams.has('as')) return;
        h.searchParams.delete('as');
        a.setAttribute('href', h.pathname.split('/').pop() + h.search + h.hash);
      });
    }
  }
  return u;
}

// показ «глазами игрока лиги»: «я» — Герман Хван (p17)
export const SHOW_NAME = (() => { const p = D.player(D.ME.player); return `${p.first} ${p.last}`; })();
export function setShow(on) { const u = loadU(); u.show = !!on; saveU(u); }

// изменение аккаунта на этой странице (выход, удаление) — экран перерисовывает себя сам
export const ACCOUNT_EVENT = 'tl-account';
export const announce = () => dispatchEvent(new CustomEvent(ACCOUNT_EVENT));

/* ------------------------------------------------------------ ссылки */

// ссылка только с темой, без вида ?as=: после входа, выхода и смены показа вид берётся из записанного
export function themeHref(href) {
  const t = params.get('theme');
  if (t !== 'light' && t !== 'dark') return href;
  const [path, hash] = href.split('#');
  return `${path}${path.includes('?') ? '&' : '?'}theme=${t}${hash ? `#${hash}` : ''}`;
}

// ссылка внутри пробной версии: ?trial и выбранная тема
export function trialHref(href) {
  const [path, hash] = href.split('#');
  const withTrial = /[?&]trial(=|&|$)/.test(path) ? path : `${path}${path.includes('?') ? '&' : '?'}trial`;
  return keepTheme(withTrial + (hash ? `#${hash}` : ''));
}
// «назад» на шаг внутри приложения; если пришли не отсюда — по адресу (уже с темой: themeHref или trialHref)
export function goBack(fallback) {
  let same = false;
  try {
    const r = new URL(document.referrer);
    const dir = (u) => u.pathname.replace(/[^/]*$/, '');
    same = r.origin === location.origin && dir(r) === dir(location) && r.pathname !== location.pathname && history.length > 1;
  } catch { same = false; }
  if (same) history.back(); else location.replace(fallback);
}

/* ------------------------------------------------------------ детали */

// кружок своего фото: фото (центр кадра без сдвига), инициалы или значок человека
export function photoInner(p) {
  if (p && p.photo) return `<img src="${USER.photo}" alt="" decoding="async">`;
  const ini = initialsOf(p && p.name);
  return ini ? `<span class="me-ini">${esc(ini)}</span>` : `<span class="me-icon">${icon('me')}</span>`;
}
export const photoHtml = (p, size = 'xl') => `<span class="me-photo ${size}" aria-hidden="true">${photoInner(p)}</span>`;

// значок «изменить» на кружке фото
export const editBadge = () => `<span class="me-edit" aria-hidden="true">${icon('edit')}</span>`;

// уровень словами: «4.0» или «Не знаю»
export const levelText = (v) => { const l = LEVELS.find(([k]) => k === v); return l ? l[1] : ''; };

// карточка заявки — тёмная карта лиги без фото: шаг, что дальше, полоса шагов
export function passHtml(key, { href = '', signedIn = false, h = 'h2' } = {}) {
  const st = stateOf(key, true);
  const done = doneCount(key, true) || (signedIn && key === 'start' ? 1 : 0);
  const now = key === 'start' ? (signedIn ? 1 : -1) : done;
  const bar = Array.from({ length: 6 }, (_, i) => `<i class="${i < done ? 'done' : i === now ? (st.no ? 'no' : 'now') : ''}"></i>`).join('');
  const tag = href ? 'a' : 'section';
  const label = key === 'start' ? `${st.big} шагов. ${st.title}` : `Заявка: ${st.big} ${st.of}, ${st.title}${st.pill ? `, ${st.pill}` : ''}`;
  return `<${tag} class="member auto jn-pass${href ? ' me-pass' : ''}"${href ? ` href="${href}"` : ''} aria-label="${esc(label)}">
    <div class="inner">
      <div class="jn-pass-top">
        <span class="brand">${ballSvg('glow')}<span class="cap">Заявка</span></span>
        ${st.pill ? `<span class="rank${st.no ? ' jn-no' : ''}">${st.live ? '<span class="dot"></span>' : ''}<span>${esc(st.pill)}</span></span>` : ''}
      </div>
      <p class="jn-pass-big"><span class="hero-num">${esc(st.big)}</span><span class="num">${esc(st.of)}</span></p>
      <${h} class="title">${esc(st.title)}</${h}>
      ${st.next ? `<p class="jn-pass-next">${esc(st.next)}</p>` : ''}
      <div class="stepbar" aria-hidden="true">${bar}</div>
    </div>
  </${tag}>`;
}

// членская карта: фото, имя, «В лиге с 2027», уровень КПР и «Член лиги»; без фото — инициалы
export function memberCardHtml(p, { h = 'h1' } = {}) {
  const [first, rest] = nameLines(p.name || FULL_NAME);
  const st = stateOf('member', true);
  return `<section class="member me-mcard jn-mcard" aria-label="Членская карта">
    ${p.photo ? `<img class="photo me-mphoto" src="${USER.photo}" alt="">` : `<span class="initials" aria-hidden="true">${esc(initialsOf(p.name || FULL_NAME))}</span>`}
    <div class="inner">
      <div class="brand">${ballSvg('glow')}<span class="cap">${esc(D.LEAGUE.name)}</span></div>
      <${h} class="name title">${esc(first)}<br>${esc(rest)}</${h}>
      <div class="since cap">В лиге с ${D.TODAY.iso.slice(0, 4)}</div>
      <div class="lvl">
        <div><div class="cap">Уровень КПР</div><div class="hero-num">${esc(USER.kpr)}</div></div>
        <span class="rank">${esc(st.pill)}</span>
      </div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------ шторки и надпись */

let sheetN = 0;
// шторка поверх всего (и поверх другой шторки): заголовок, текст, кнопки
function topSheet(cls, inner, label) {
  const id = `me-sheet-${++sheetN}`;
  const scrim = document.createElement('div');
  scrim.className = 'scrim me-top';
  const el = document.createElement('div');
  el.className = `bsheet float me-top ${cls}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', id);
  el.tabIndex = -1;
  el.innerHTML = `<span class="handle"></span><div class="title" id="${id}">${esc(label)}</div>${inner}`;
  (document.querySelector('.app') || document.body).append(scrim, el);
  return { el, scrim };
}

// «Что хранится»: текст согласия пробной версии (на сервере — Meta.accounts.consentText)
let consent = null;
export function openConsent(opener) {
  if (!consent) {
    const { el, scrim } = topSheet('tall me-consent', `<div class="scroll"><p class="me-consent-text">${esc(TRIAL.consent)}</p></div>
      <button class="btn quiet" type="button" data-close>Закрыть</button>`, 'Что хранится');
    const s = sheet(el, scrim);
    el.querySelector('[data-close]').addEventListener('click', () => s.close());
    consent = s;
  }
  consent.open(opener);
}

// подтверждение: заголовок-вопрос, текст, «действие» и «Отмена» (тихая, с фокусом)
export function confirmSheet({ title, text, ok, onOk }) {
  const { el, scrim } = topSheet('me-confirm', `<p class="lead">${esc(text)}</p>
    <div class="me-confirm-acts"><button class="btn quiet me-danger" type="button" data-ok>${esc(ok)}</button>
    <button class="btn quiet" type="button" data-cancel>Отмена</button></div>`, title);
  el.setAttribute('role', 'alertdialog');
  const s = sheet(el, scrim);
  const cancel = el.querySelector('[data-cancel]');
  cancel.addEventListener('click', () => s.close());
  el.querySelector('[data-ok]').addEventListener('click', () => { s.close(); onOk(); });
  return {
    open(opener) {
      s.open(opener);
      // фокус — на «Отмена»: случайное нажатие ничего не удаляет
      requestAnimationFrame(() => requestAnimationFrame(() => { if (s.isOpen) cancel.focus({ preventScroll: true }); }));
    },
    close: () => s.close(),
    get isOpen() { return s.isOpen; },
  };
}

// надпись внизу экрана: «Аккаунт удалён», «Войдите снова»
let toastTimer = 0;
export function toast(text, { stay = false } = {}) {
  let el = document.querySelector('.me-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'me-toast glass';
    el.setAttribute('role', 'status');
    (document.querySelector('.app') || document.body).append(el);
  }
  el.textContent = text;
  requestAnimationFrame(() => el.classList.add('on'));
  clearTimeout(toastTimer);
  if (!stay) toastTimer = setTimeout(() => el.classList.remove('on'), 4200);
}

/* ------------------------------------------------------------ «Я» */

const joinRow = (off = false) => {
  const inner = `<span class="me-ic" aria-hidden="true">${ballSvg()}</span>
      <span class="grow"><span class="strong">Вступить в лигу</span><span class="sub">6 шагов · Путь в лигу</span></span>`;
  return `<section class="section">
    <div class="card">${off
    ? `<div class="row me-join is-off" aria-disabled="true">${inner}</div>`
    : `<a class="row me-join" href="${trialHref('join.html')}">${inner}<i data-icon="chev" class="go"></i></a>`}</div>
  </section>`;
};

const levelRow = (p) => (p.level ? `<div class="row me-lvl"><span class="grow"><span class="strong">Мой уровень</span><span class="sub">По вашей оценке</span></span>${p.level === 'unknown' ? `<span class="strong">${levelText(p.level)}</span>` : `<span class="num">${esc(p.level)}</span>`}</div>` : '');
const aboutBlock = (p, { level = true } = {}) => {
  const lv = level ? levelRow(p) : '';
  if (!p.about && !lv) return '';
  return `<section class="section">
    ${p.about ? '<span class="cap">О себе и достижения</span>' : ''}
    <div class="card me-about">${p.about ? `<p class="me-text">${esc(p.about)}</p>` : ''}${lv}</div>
    <p class="me-note">Видите только вы и организаторы лиги</p>
  </section>`;
};
const editBtn = (off = false) => `<div class="section me-act me-edit-act">${off
  ? '<button class="btn quiet small" type="button" disabled>Изменить профиль</button>'
  : `<a class="btn quiet small" href="${keepTheme('profile.html')}">Изменить профиль</a>`}</div>`;

function guestHtml() {
  return `<section class="me-head">
      ${photoHtml(null)}
      <h1 class="title">Вы смотрите без входа</h1>
      <p class="muted">Турниры и живой счёт открыты всем. Играют члены лиги — вступление по заявке.</p>
    </section>
    <div class="section me-act"><a class="btn main" href="${trialHref('login.html?from=me')}">Войти</a></div>
    ${joinRow()}`;
}

// пользователь без заявки: фото — герой экрана; у нового аккаунта — предложение заполнить профиль
function userHtml(p) {
  return `<section class="me-head">
      <a class="me-photo xl" href="${keepTheme('profile.html')}" aria-label="Изменить профиль">${photoInner(p)}</a>
      <h1 class="title">${p.name ? esc(p.name) : 'Добавьте фото и пару слов о себе'}</h1>
    </section>
    ${editBtn()}
    ${aboutBlock(p)}
    ${joinRow()}`;
}

// кандидат, отказ: героем — карточка заявки, профиль ниже — строкой
function profileRow(p) {
  return `<section class="section">
    <span class="cap">Профиль</span>
    <div class="card me-about">
      <div class="row me-prow">${photoHtml(p, 'lg')}
        <span class="grow"><span class="strong ellipsis">${p.name ? esc(p.name) : 'Добавьте фото и пару слов о себе'}</span>${p.level ? `<span class="sub">Мой уровень ${esc(levelText(p.level))} · по вашей оценке</span>` : ''}</span>
      </div>
      ${p.about ? `<p class="me-text">${esc(p.about)}</p>` : ''}
    </div>
    <p class="me-note">Видите только вы и организаторы лиги</p>
  </section>`;
}

function candidateHtml(a) {
  return `${passHtml(appKey(a.app), { href: trialHref('join.html'), h: 'h1' })}
    ${profileRow(a.profile)}
    ${editBtn()}`;
}

function declinedHtml(a) {
  return `${passHtml(appKey(a.app), { href: trialHref('join.html'), h: 'h1' })}
    <p class="jn-lead">${esc(stateOf(appKey(a.app), true).lead)}</p>
    <div class="section me-act"><a class="btn quiet" href="${trialHref('join.html?open=form')}">Подать заявку снова</a></div>
    ${profileRow(a.profile)}
    ${editBtn()}`;
}

// член лиги: героем — членская карта; самооценки на экране нет — рядом с уровнем КПР было бы два числа
function memberHtml(a) {
  return `${memberCardHtml(a.profile)}
    <p class="jn-lead">Запись на турниры откроется позже.</p>
    ${editBtn()}
    ${aboutBlock(a.profile, { level: false })}`;
}

// без связи: имя и инициалы с телефона, правка выключена
function offlineHtml(p) {
  return `<section class="me-head">
      ${photoHtml({ name: p.name }, 'xl')}
      <h1 class="title">${p.name ? esc(p.name) : 'Добавьте фото и пару слов о себе'}</h1>
    </section>
    <p class="me-offline" role="status">${icon('info')}<span>Нет связи — профиль обновится, когда появится связь</span></p>
    ${editBtn(true)}
    ${joinRow(true)}`;
}

export function meHtml(u, { offline = false } = {}) {
  const a = account(u);
  if (!a) return guestHtml();
  if (offline) return offlineHtml(a.profile);
  const who = whoOf(u);
  if (who === 'candidate') return candidateHtml(a);
  if (who === 'declined') return declinedHtml(a);
  if (who === 'member') return memberHtml(a);
  return userHtml(a.profile);
}

function pageMe() {
  const as = params.get('as');
  // ?as=show — «Я» в показе: карта Хвана (app.js несёт вид дальше)
  if (as === 'show') { location.replace(keepTheme('player.html')); return; }
  const offline = as === 'offline';
  // показ включён — «Я» показывает карту Хвана, как в 0.2.0; записи нет — тоже показ (так открываются страницы мира)
  if (!as && (!hasStored() || loadU().show)) { location.replace(themeHref('player.html')); return; }
  let U = seedFromUrl('as', ['offline']) || loadU();
  pageU = U;
  const box = document.querySelector('[data-me]');
  const render = () => {
    const who = account(U) ? whoOf(U) : 'guest';
    document.body.dataset.who = offline && who !== 'guest' ? 'offline' : who;
    box.innerHTML = meHtml(U, { offline });
    hydrate(box);
  };
  render();
  // выход и удаление аккаунта в «Настройках» — экран становится гостевым сразу
  addEventListener(ACCOUNT_EVENT, () => { U = loadU(); pageU = U; render(); });
  // вернулись «назад» после правки профиля — перечитать
  addEventListener('pageshow', (e) => { if (e.persisted) { U = loadU(); pageU = U; render(); } });
  const note = params.get('note');
  if (note === 'deleted') toast('Аккаунт удалён', { stay: true });
  if (note === 'again') toast('Войдите снова', { stay: true });
}

if (document.body.dataset.page === 'me') pageMe();
