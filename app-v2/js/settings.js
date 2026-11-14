// «Настройки» на экране «Я»: шторка из толстого стекла. Вход — кнопка-шестерёнка в шапке ([data-settings]):
// карта Хвана (player.html — «Я» в показе) и «Я» вне показа (me.html).
// Тема: «Как в телефоне», «Светлая», «Тёмная». Выбор применяется сразу и хранится в браузере
// (localStorage, tl-theme: light | dark; «как в телефоне» — записи нет). На каждой странице его ставит app.js
// (applyTheme) до первой отрисовки. ?theme= в адресе сильнее — им пользуются снимки; если тему выбрали здесь,
// ?theme= снимается с адреса и ссылок этой страницы, чтобы выбор шёл дальше по приложению.
// Этап «Пользователи» (пробная версия на показном сервере):
// «Аккаунт» — у гостя «Войти»; у вошедшего почта, «Выйти» (сразу, без окна), «Выйти на всех устройствах»,
// «Удалить аккаунт» (шторка подтверждения), пометка пробной версии. «Показ» — «Глазами игрока лиги · Герман Хван»;
// включённый показ (player.html) отмечен строкой «Выйти из показа». Состояние — общее с «Я» (js/me.js).
// ?settings — открыть шторку сразу (для снимков), как ?share у «Поделиться»; ?delete — и окно «Удалить аккаунт?».
import { D, icon, ballSvg, hydrate, sheet, applyTheme, THEME_KEY, avHtml, esc } from '../app.js';
import { TRIAL } from './join.data.js';
import { loadU, saveU, account, setShow, SHOW_NAME, announce, toast, confirmSheet, trialHref, themeHref, photoHtml, pageState } from './me.js';

const VERSION = '0.3.0';   // версия приложения этапа «Пользователи» (сборка 0.3.0)
const CHOICES = [['system', 'Как в телефоне'], ['light', 'Светлая'], ['dark', 'Тёмная']];   // предлог не висит в конце строки
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
// «Я» в показе — карта Хвана (player.html); вне показа — me.html
const IN_SHOW = document.body.dataset.page === 'player';

// кружок своего фото и шторка подтверждения — из css/me.css; карта Хвана его не подключает
if (!document.querySelector('link[href$="css/me.css"]')) {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'css/me.css';
  document.head.append(l);
}

const saved = () => {
  try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'system'; } catch { return 'system'; }
};
const forced = () => { const t = new URLSearchParams(location.search).get('theme'); return t === 'light' || t === 'dark' ? t : null; };
// что выбрано сейчас: адрес сильнее сохранённого
const current = () => forced() || saved();

// образец экрана «Сегодня» в цветах темы; у «как в телефоне» — половина светлого и половина тёмного
const screen = (t, attrs = '') => `<span class="set-scr" data-s="${t}"${attrs}><i class="s-cap"></i><i class="s-title"></i><i class="s-live"><i class="s-chip"></i></i><i class="s-row"></i><i class="s-row two"></i><i class="s-dock"><i class="s-tab"></i></i><i class="s-btn"></i></span>`;
const picture = (k) => (k === 'system'
  ? `<span class="set-scr auto" aria-hidden="true">${screen('light')}${screen('dark')}</span>`
  : screen(k, ' aria-hidden="true"'));

// ?theme= больше не нужен: выбор сделан здесь
function dropThemeParam() {
  const rel = (u) => u.pathname.split('/').pop() + u.search + u.hash;
  const here = new URL(location.href);
  if (here.searchParams.has('theme')) {
    here.searchParams.delete('theme');
    history.replaceState(history.state, '', rel(here));
  }
  document.querySelectorAll('a[href*="theme="]').forEach((a) => {
    const u = new URL(a.getAttribute('href'), location.href);
    if (u.origin !== location.origin) return;
    u.searchParams.delete('theme');
    a.setAttribute('href', rel(u));
  });
}

/* ---------- «Аккаунт» и «Показ» ---------- */

const chev = '<i class="go" aria-hidden="true">' + icon('chev') + '</i>';
const ic = (svg) => `<span class="set-ic" aria-hidden="true">${svg}</span>`;

function accountHtml(u) {
  const a = account(u);
  if (!a) {
    return `<span class="cap set-cap">Аккаунт</span>
      <div class="card set-card">
        <a class="row" href="${trialHref('login.html?from=me')}" data-login>${ic(icon('me'))}<span class="grow"><span class="strong">Войти</span></span>${chev}</a>
      </div>`;
  }
  const p = a.profile;
  return `<span class="cap set-cap">Аккаунт</span>
    <div class="card set-card">
      <div class="row set-who">${photoHtml(p, 'sm')}<span class="grow"><span class="strong ellipsis set-mail">${esc(a.email)}</span>${p.name ? `<span class="sub ellipsis">${esc(p.name)}</span>` : ''}</span></div>
      <button class="row set-act" type="button" data-logout>${ic(icon('leave'))}<span class="grow"><span class="strong">Выйти</span></span></button>
      <button class="row set-act set-quiet" type="button" data-logout-all><span class="set-ic" aria-hidden="true"></span><span class="grow">Выйти на всех устройствах</span></button>
      <button class="row set-act set-danger" type="button" data-delete><span class="set-ic" aria-hidden="true"></span><span class="grow"><span class="strong">Удалить аккаунт</span></span></button>
    </div>
    <p class="set-note">${icon('info')}<span>${esc(TRIAL.note)}</span></p>`;
}

function showHtml() {
  const who = avHtml(D.ME.player, 'sm');
  return `<span class="cap set-cap">Показ</span>
    <div class="card set-card">${IN_SHOW
    ? `<button class="row set-act" type="button" data-show="off">${who}<span class="grow"><span class="strong">Выйти из показа</span><span class="sub">Глазами игрока лиги · ${esc(SHOW_NAME)}</span></span></button>`
    : `<button class="row set-act" type="button" data-show="on">${who}<span class="grow"><span class="strong">Глазами игрока лиги</span><span class="sub">${esc(SHOW_NAME)}</span></span>${chev}</button>`}
    </div>`;
}

const opener = document.querySelector('[data-settings]');
if (opener) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const el = document.createElement('div');
  el.className = 'bsheet float tall set-sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'set-t');
  el.tabIndex = -1;
  el.innerHTML = `<span class="handle"></span>
    <div class="title" id="set-t">Настройки</div>
    <div class="scroll">
      <span class="cap set-cap" id="set-theme">Тема</span>
      <div class="set-themes" role="radiogroup" aria-labelledby="set-theme">${CHOICES.map(([k, label]) =>
        `<button type="button" role="radio" aria-checked="false" data-pick="${k}">${picture(k)}<span class="name">${label}</span></button>`).join('')}</div>
      <div data-dyn></div>
      <span class="cap set-cap">Судья</span>
      <div class="card set-card">
        <a class="row" href="judge-list.html"><span class="set-ic" aria-hidden="true">${icon('board')}</span><span class="grow"><span class="strong ellipsis">Ключ судьи</span><span class="sub">Мои матчи и пульт</span></span><i data-icon="chev" class="go"></i></a>
      </div>
      <span class="cap set-cap">О приложении</span>
      <div class="card set-card">
        <div class="row"><span class="set-ic" aria-hidden="true">${ballSvg()}</span><span class="grow"><span class="strong">${D.LEAGUE.short}</span><span class="sub">Версия ${VERSION}</span></span></div>
      </div>
    </div>
    <button class="btn quiet" type="button" data-close>Готово</button>`;
  (document.querySelector('.app') || document.body).append(scrim, el);
  hydrate(el);

  const picks = [...el.querySelectorAll('[data-pick]')];
  const mark = (k) => picks.forEach((b) => {
    const on = b.dataset.pick === k;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  const choose = (k) => {
    try { if (k === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, k); } catch { /* память закрыта — тема только на этой странице */ }
    dropThemeParam();
    mark(k);
    // тема меняется мягкой сменой кадра, где она есть; без движения — сразу
    if (document.startViewTransition && !REDUCE) document.startViewTransition(applyTheme);
    else applyTheme();
  };
  picks.forEach((b) => b.addEventListener('click', () => { if (b.getAttribute('aria-checked') !== 'true') choose(b.dataset.pick); }));
  // стрелки внутри выбора темы — как у переключателя: фокус и выбор идут вместе
  el.querySelector('.set-themes').addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const i = picks.indexOf(document.activeElement);
    if (!step || i < 0) return;
    e.preventDefault();
    const next = picks[(i + step + picks.length) % picks.length];
    next.focus();
    choose(next.dataset.pick);
  });

  const s = sheet(el, scrim);

  // «Аккаунт» и «Показ»: в показе сначала «Показ» (его выключают отсюда), вне показа — сначала «Аккаунт»
  const dyn = el.querySelector('[data-dyn]');
  let del = null;
  const paint = () => {
    const u = pageState();
    dyn.innerHTML = IN_SHOW ? showHtml() + accountHtml(u) : accountHtml(u) + showHtml();
  };
  // выйти: сеанс отозван, приложение — гость, черновик анкеты стёрт; ключ судьи и код пробной версии остаются
  const signOut = () => {
    const u = loadU();
    u.session = null;
    u.draft = null;
    saveU(u);
    announce();
    paint();
    const first = dyn.querySelector('a, button');
    if (first) first.focus({ preventScroll: true });
  };
  // удалить: профиль, фото и заявка удалены; приложение — гость, внизу «Аккаунт удалён»
  const askDelete = (from) => {
    if (!del) {
      del = confirmSheet({
        title: 'Удалить аккаунт?',
        text: 'Удалятся профиль, фото и заявка в лигу. Вернуть их будет нельзя',
        ok: 'Удалить',
        onOk: () => {
          const u = loadU();
          const a = account(u);
          if (a) delete u.server[a.email];
          u.session = null;
          u.draft = null;
          saveU(u);
          announce();
          paint();
          s.close();
          toast('Аккаунт удалён');
        },
      });
    }
    del.open(from);
  };
  dyn.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.matches('[data-logout], [data-logout-all]')) signOut();
    else if (t.matches('[data-delete]')) askDelete(t);
    else if (t.matches('[data-show="on"]')) { setShow(true); location.href = themeHref('player.html'); }
    else if (t.matches('[data-show="off"]')) { setShow(false); location.href = themeHref('me.html'); }
    // «Войти» из показа сначала выключает показ
    else if (t.matches('[data-login]') && IN_SHOW) setShow(false);
  });

  const open = () => {
    mark(current());
    paint();
    s.open(opener);
    // фокус — на выбранной теме (sheet() ставит его на первую кнопку)
    requestAnimationFrame(() => requestAnimationFrame(() => { const on = picks.find((b) => b.tabIndex === 0); if (on && s.isOpen) on.focus({ preventScroll: true }); }));
  };
  el.querySelector('[data-close]').addEventListener('click', () => s.close());
  opener.addEventListener('click', open);
  if (params.has('settings')) {
    open();
    const d = dyn.querySelector('[data-delete]');
    if (d && params.has('delete')) setTimeout(() => askDelete(d), 120);
  }
}
