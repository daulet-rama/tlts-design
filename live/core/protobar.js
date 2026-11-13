// TLTS · core/protobar.js — узкая полоска прототипа вверху страницы и плашка «Моя идея».
//
// mountProtoBar({ current, demo, sticky, overlay, idle, here, target })
//   current  'home' | 'match' | 'player' | 'judge' | 'board' — пять утверждённых экранов
//            'ideas' | 'group' | 'join' | 'partner' | 'desk' | 'honors' — экраны с идеями (группа «Идеи»)
// mountIdeaNote(target, { title, score, approvals, changed, league, ... }) — плашка «Моя идея» для экранов с идеями.
//
// Полоска и плашка сами приносят свои стили и не зависят от разметки страницы. Цвета и шрифты берут из токенов theme.css.
// Подробно — design/live-docs/CORE-CHANGES-bar.md, витрина — core/kit-bar.html.

const LIVE_ROOT = new URL('../', import.meta.url);   // папка live/ — ссылки работают из любой подпапки

const SCREENS = [
  { id: 'home', label: 'Главная', file: 'index.html' },
  { id: 'match', label: 'Афиша матча', file: 'match.html' },
  { id: 'player', label: 'Игрок', file: 'player.html' },
  { id: 'judge', label: 'Судья', file: 'judge.html' },
  { id: 'board', label: 'Табло', file: 'board.html' },
];

// Экраны с идеями: заказчик их ещё не утверждал, поэтому в полоске они отдельной группой.
const IDEAS = [
  { id: 'ideas', label: 'Витрина идей', file: 'ideas.html', hint: 'что предложено сверх утверждённого' },
  { id: 'group', label: 'Арифметика группы', file: 'group.html' },
  { id: 'join', label: 'Регистрация', file: 'join.html', hint: 'шаг «Это вы?»' },
  { id: 'partner', label: 'Напарник', file: 'partner.html' },
  { id: 'desk', label: 'Пульт дня', file: 'desk.html' },
  { id: 'honors', label: 'Признание', file: 'honors.html' },
];

const href = (file) => new URL(file, LIVE_ROOT).href;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
.protobar{position:relative;z-index:90;display:flex;align-items:stretch;min-height:44px;
  padding-top:env(safe-area-inset-top,0px);
  background:#0A0E1A;color:var(--c-on-air,#fff);
  border-bottom:1px solid var(--c-air-line,#323C5C);
  font:500 12px/1 var(--font-mono,ui-monospace,Menlo,Consolas,monospace);font-stretch:87.5%;
  letter-spacing:.06em;text-transform:uppercase;-webkit-font-smoothing:antialiased;color-scheme:dark}
.protobar[data-sticky]{position:sticky;top:0}
.protobar[data-overlay]{position:fixed;inset:0 0 auto 0;
  transition:transform .42s cubic-bezier(.2,.7,.2,1),opacity .42s cubic-bezier(.2,.7,.2,1),visibility 0s}
.protobar[data-overlay][data-hidden]{transform:translateY(-100%);opacity:0;visibility:hidden;
  transition:transform .42s cubic-bezier(.2,.7,.2,1),opacity .42s cubic-bezier(.2,.7,.2,1),visibility 0s .42s}
.protobar__brand{flex:none;display:flex;align-items:center;gap:8px;
  padding:0 12px 0 max(16px,env(safe-area-inset-left,0px));
  font-weight:700;letter-spacing:.09em;white-space:nowrap;color:inherit;text-decoration:none}
.protobar__brand svg{flex:none;width:16px;height:16px}
.protobar__nav{flex:0 1 auto;min-width:0;display:flex;align-items:stretch;overflow-x:auto;overscroll-behavior-x:contain;
  scrollbar-width:none; border-left:1px solid var(--c-air-line,#323C5C);
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 18px),transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 18px),transparent 100%)}
.protobar__nav::-webkit-scrollbar{display:none}
.protobar__list{display:flex;align-items:stretch;margin:0;padding:0 8px;list-style:none}
.protobar__link{position:relative;display:flex;align-items:center;min-height:44px;padding:0 10px;
  color:var(--c-on-air-2,#B9C1D3);text-decoration:none;white-space:nowrap;transition:color .2s}
.protobar__link::after{content:'';position:absolute;left:10px;right:10px;bottom:0;height:3px;
  background:var(--c-clay,#BF4F27);transform:scaleX(0);transform-origin:left;transition:transform .2s}
.protobar__link[aria-current="page"]{color:var(--c-on-air,#fff);font-weight:700}
.protobar__link[aria-current="page"]::after{transform:scaleX(1)}
.protobar__link:focus-visible,.protobar__brand:focus-visible,.protobar__ideas-btn:focus-visible,.protobar__menu a:focus-visible{
  outline:2px solid #fff;outline-offset:-3px;box-shadow:inset 0 0 0 5px var(--c-amber,#FFC24B);border-radius:0}
.protobar__side{flex:none;display:flex;align-items:center;gap:8px;margin-left:auto;
  padding:0 max(16px,env(safe-area-inset-right,0px)) 0 8px}
.protobar__demo{padding:5px 7px;outline:1px dashed var(--c-on-air-3,#96A0B6);outline-offset:-1px;
  color:var(--c-on-air-2,#B9C1D3);font-weight:600;font-size:11px;letter-spacing:.08em;white-space:nowrap}
.protobar__here{color:var(--c-on-air-3,#96A0B6);white-space:nowrap}

/* группа «Идеи»: отделена пунктиром — это не утверждённое */
.protobar__ideas{flex:none;position:relative;display:flex;align-items:stretch;border-left:1px dashed var(--c-air-line,#323C5C)}
.protobar__ideas-btn{position:relative;display:flex;align-items:center;gap:7px;min-height:44px;margin:0;padding:0 12px;
  border:0;background:none;color:var(--c-on-air-2,#B9C1D3);font:inherit;letter-spacing:inherit;text-transform:inherit;
  white-space:nowrap;cursor:pointer;transition:color .2s}
.protobar__ideas-btn::after{content:'';position:absolute;left:12px;right:12px;bottom:0;height:3px;
  background:var(--c-clay,#BF4F27);transform:scaleX(0);transform-origin:left;transition:transform .2s}
.protobar__ideas-btn[data-current]{color:var(--c-on-air,#fff);font-weight:700}
.protobar__ideas-btn[data-current]::after{transform:scaleX(1)}
.protobar__ideas-btn[aria-expanded="true"]{color:var(--c-on-air,#fff);background:#151B2E}
.protobar__ideas-tag{padding:3px 5px;outline:1px dashed currentColor;outline-offset:-1px;font-weight:600}
.protobar__ideas-cur{max-width:22ch;overflow:hidden;text-overflow:ellipsis;color:var(--c-on-air,#fff);font-weight:700}
.protobar__ideas-caret{width:9px;height:9px;flex:none;transition:transform .2s}
.protobar__ideas-btn[aria-expanded="true"] .protobar__ideas-caret{transform:rotate(180deg)}
.protobar__menu{position:absolute;z-index:2;top:100%;left:-1px;width:min(340px,calc(100vw - 16px));margin:0;padding:6px 0 8px;
  background:#0A0E1A;border:1px solid var(--c-air-line,#323C5C);border-top:1px dashed var(--c-air-line,#323C5C);
  box-shadow:0 18px 40px -18px rgb(0 0 0 / .7);text-transform:none;letter-spacing:0}
.protobar__menu[hidden]{display:none}
.protobar__menu-head{margin:0;padding:8px 16px 10px;color:var(--c-on-air-3,#96A0B6);
  font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;line-height:1.4}
.protobar__menu ul{margin:0;padding:0;list-style:none}
.protobar__menu li + li.is-first-screen{margin-top:6px;padding-top:6px;border-top:1px solid var(--c-air-line,#323C5C)}
.protobar__menu a{position:relative;display:flex;flex-direction:column;justify-content:center;gap:3px;min-height:44px;
  padding:6px 16px 6px 19px;color:var(--c-on-air,#fff);text-decoration:none;
  font:500 15px/1.25 var(--font-text,system-ui,sans-serif);font-stretch:normal}
.protobar__menu a small{font:500 11.5px/1.3 var(--font-mono,ui-monospace,monospace);font-stretch:87.5%;color:var(--c-on-air-3,#96A0B6)}
.protobar__menu a[aria-current="page"]{font-weight:700}
.protobar__menu a[aria-current="page"]::before{content:'';position:absolute;left:0;top:8px;bottom:8px;width:3px;background:var(--c-clay,#BF4F27)}
@media (hover:hover){
  .protobar__link:hover,.protobar__ideas-btn:hover{color:var(--c-on-air,#fff)}
  .protobar__menu a:hover{background:#151B2E}
}
@media (max-width:560px){
  .protobar__brand{padding-right:12px}
  .protobar__brand-text{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .protobar__ideas{position:static}
  .protobar__ideas-btn{padding:0 10px}
  .protobar__ideas-btn::after{left:10px;right:10px}
  .protobar__ideas-cur{display:none}
  .protobar__menu{left:0;right:0;width:auto;border-left:0;border-right:0}
}
@media (max-width:420px){.protobar__here{display:none}}
@media (max-width:400px){.protobar__demo-tail{display:none}.protobar__side{padding-left:6px}}
@media (prefers-reduced-motion:reduce){
  .protobar__link,.protobar__link::after,.protobar__ideas-btn,.protobar__ideas-btn::after,.protobar__ideas-caret,
  .protobar[data-overlay],.protobar[data-overlay][data-hidden]{transition:none}
}
`;

const NOTE_CSS = `
.idea-note{--in-line:var(--line-2,rgb(22 25 29 / .34));position:relative;margin:0;
  background:var(--bg-2,#F6F7F3);color:var(--fg,#16191D);
  outline:1px dashed var(--fg-3,#565D64);outline-offset:-1px;
  font:400 15px/1.45 var(--font-text,system-ui,sans-serif)}
.idea-note *{box-sizing:border-box}
.idea-note__head{display:flex;align-items:flex-start;gap:12px 16px;flex-wrap:wrap;padding:14px var(--gutter-r,16px) 14px var(--gutter,16px)}
.idea-note__tag{flex:none;display:inline-flex;align-items:center;gap:6px;padding:5px 8px;
  background:var(--fg,#16191D);color:var(--bg,#EDEFEA);
  font:700 11px/1 var(--font-mono,ui-monospace,monospace);font-stretch:87.5%;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
.idea-note__main{flex:1 1 320px;min-width:0;display:grid;gap:4px}
.idea-note__status{margin:0;color:var(--fg-2,#454C54);font:600 11.5px/1.35 var(--font-mono,ui-monospace,monospace);
  font-stretch:87.5%;letter-spacing:.06em;text-transform:uppercase}
.idea-note__title{margin:0;font:600 18px/1.25 var(--font-text,system-ui,sans-serif);letter-spacing:-.01em}
.idea-note__meta{margin:0;color:var(--fg-2,#454C54);font:500 13px/1.4 var(--font-mono,ui-monospace,monospace);font-stretch:87.5%;
  font-variant-numeric:tabular-nums}
.idea-note__meta b{color:var(--fg,#16191D);font-weight:700}
.idea-note__why,.idea-note__approved{margin:2px 0 0;color:var(--fg-2,#454C54);font-size:14px;max-width:80ch}
.idea-note__approved b{color:var(--fg,#16191D);font-weight:600}
.idea-note__acts{flex:none;display:flex;align-items:center;gap:4px 14px;flex-wrap:wrap;margin-left:auto}
.idea-note__toggle,.idea-note__all{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 2px;margin:0;
  border:0;background:none;color:var(--fg,#16191D);cursor:pointer;text-decoration:underline;text-underline-offset:3px;
  text-decoration-thickness:1px;font:600 13px/1.2 var(--font-mono,ui-monospace,monospace);font-stretch:87.5%;letter-spacing:.02em}
.idea-note__toggle{text-decoration:none}
.idea-note__toggle svg{width:10px;height:10px;transition:transform .2s}
.idea-note[data-open] .idea-note__toggle svg{transform:rotate(180deg)}
.idea-note__body{display:grid;gap:18px 32px;padding:4px var(--gutter-r,16px) 18px var(--gutter,16px);border-top:1px solid var(--line,rgb(22 25 29 / .16));padding-top:16px}
.idea-note:not([data-open]) .idea-note__body{display:none}
.idea-note__col{min-width:0}
.idea-note__col-h{margin:0 0 8px;color:var(--fg-2,#454C54);font:700 11.5px/1.35 var(--font-mono,ui-monospace,monospace);
  font-stretch:87.5%;letter-spacing:.08em;text-transform:uppercase;font-style:normal}
.idea-note__col ol,.idea-note__col ul{margin:0;padding:0;list-style:none;display:grid;gap:7px;counter-reset:in}
.idea-note__col li{position:relative;padding-left:26px;font-size:14.5px;line-height:1.45;max-width:72ch}
.idea-note__col ol li::before{counter-increment:in;content:counter(in);position:absolute;left:0;top:1px;width:18px;
  color:var(--fg-3,#565D64);font:600 12px/1.6 var(--font-mono,ui-monospace,monospace);text-align:right}
.idea-note__col ul li::before{content:'?';position:absolute;left:3px;top:1px;width:14px;height:14px;
  outline:1px solid var(--fg-3,#565D64);font:700 10px/14px var(--font-mono,ui-monospace,monospace);text-align:center;color:var(--fg-2,#454C54)}
.idea-note__none{color:var(--fg-3,#565D64);font-size:14px}
.idea-note__toggle:focus-visible,.idea-note__all:focus-visible,.idea-note__line:focus-visible{
  outline:2px solid var(--focus-ring,currentColor);outline-offset:2px}
.idea-note__line{display:none}
.idea-note__vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media (min-width:860px){.idea-note__body{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:767px){
  .idea-note__line{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;margin:0;
    padding:6px var(--gutter-r,16px) 6px var(--gutter,16px);border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
  .idea-note__line-title{flex:1;min-width:0;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;
    line-height:1.25;overflow-wrap:anywhere;font-weight:600;font-size:14.5px}
  .idea-note__line-score{flex:none;color:var(--fg-2,#454C54);font:600 12px/1 var(--font-mono,ui-monospace,monospace);font-stretch:87.5%}
  .idea-note__line .idea-note__tag{padding:5px 7px}
  .idea-note__line svg{flex:none;width:10px;height:10px;transition:transform .2s}
  .idea-note[data-open] .idea-note__line svg{transform:rotate(180deg)}
  .idea-note:not([data-open]) .idea-note__head{display:none}
  .idea-note[data-open] .idea-note__head{padding-top:4px}
  .idea-note[data-open] .idea-note__head .idea-note__tag,.idea-note[data-open] .idea-note__head .idea-note__toggle{display:none}
  .idea-note__acts{margin-left:0}
}
@media (max-width:479px){.idea-note__tag-tail{display:none}}
@media (prefers-reduced-motion:reduce){.idea-note svg{transition:none}}
`;

const MARK = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
  + '<circle cx="8" cy="8" r="7.2" fill="var(--kpr-30,#7FD3EA)"/>'
  + '<path d="M1.2 10.6C3.4 15 6.4 13.9 7.4 9.6 8.6 4.6 10.3 1.4 14.8 5.4A7.2 7.2 0 0 0 1.2 10.6Z" fill="var(--kpr-50,#BF4F27)"/>'
  + '<path d="M1.2 10.6C3.4 15 6.4 13.9 7.4 9.6 8.6 4.6 10.3 1.4 14.8 5.4" fill="none" stroke="var(--c-seam,#F4F3EC)" stroke-width="1.3"/></svg>';

const CARET = '<svg class="protobar__ideas-caret" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

function ensureStyle(id, css) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

let uid = 0;
const cleanups = new WeakMap(); // снять слушатели прежней полоски в том же месте при повторном вызове

// Ссылка-пропуск («К содержанию») должна остаться первой по Tab: полоска встаёт сразу после неё.
const SKIP_SEL = '.skip, .skip-link, [data-skip-link], a[href^="#"]';
// Своя ссылка «К содержанию» на экране: общий класс, свои классы экранов или ссылка-якорь с этим текстом
const OWN_SKIP_SEL = '.skip, .skip-link, [data-skip-link], .id-skip, .dk-skip';
const hasOwnSkip = () => !!document.querySelector(OWN_SKIP_SEL)
  || [...document.querySelectorAll('a[href^="#"]')].some((a) => /к\s+содержани/i.test(a.textContent || ''));
// Если на экране нет ссылки «К содержанию», полоска ставит её первой в <body> (FIXES-2, О1). Цель — <main>.
function ensureSkip() {
  if (hasOwnSkip()) return null;
  const main = document.querySelector('main');
  if (!main) return null;
  if (!main.id) main.id = 'main';
  const a = document.createElement('a');
  a.className = 'skip';
  a.href = `#${main.id}`;
  a.textContent = 'К содержанию';
  a.setAttribute('data-skip-link', 'protobar');
  document.body.prepend(a);
  return a;
}
function insertAtTop(host, el) {
  let after = null;
  for (const child of host.children) {
    if (child === el) continue;
    if (child.matches(SKIP_SEL)) { after = child; continue; }
    break;
  }
  if (after) after.after(el); else host.prepend(el);
}

/**
 * Поставить полоску прототипа в начало <body> (после ссылки «К содержанию», если она есть).
 *   current  какой экран открыт: 'home' | 'match' | 'player' | 'judge' | 'board' | 'kit'
 *            или экран с идеей: 'ideas' | 'group' | 'join' | 'partner' | 'desk' | 'honors'
 *            (другое значение — ничего не подсвечено)
 *   demo     показать пометку «Демо-данные» (по умолчанию да)
 *   sticky   прилипать к верху при прокрутке (по умолчанию нет)
 *   overlay  лежать поверх экрана (position: fixed) и прятаться, когда ничего не происходит (для табло)
 *   idle     overlay: через сколько мс без мыши, касаний и клавиш спрятаться (по умолчанию 3500; 0 — не прятаться самой)
 *   here     короткая подпись справа, например 'Витрина полоски' (для current: 'kit' — «Витрина стиля»)
 *   target   куда вставить (по умолчанию document.body)
 * Возвращает элемент полоски. При overlay у него работают bar.show(), bar.hide() и bar.isHidden;
 * при каждой смене на полоске всплывает событие 'protobar:toggle' с detail.hidden.
 * Повторный вызов заменяет прежнюю полоску.
 * На <html> всегда стоит --protobar-h (высота полоски), а при overlay ещё --protobar-shown
 * (высота, пока полоска видна, и 0px, пока спрятана) и атрибут data-protobar-hidden.
 */
export function mountProtoBar({ current = null, demo = true, sticky = false, overlay = false, idle = 3500, here = null, target = null } = {}) {
  if (typeof document === 'undefined') return null;
  ensureStyle('tlts-protobar-css', CSS);
  const host = target || document.body;
  cleanups.get(host)?.();
  cleanups.delete(host);
  // переменные на <html> ставит только полоска страницы (в <body>); полоски-образцы в витрине их не трогают
  const owner = host === document.body;
  host.querySelector(':scope > .protobar')?.remove();
  const root = document.documentElement;

  const bar = document.createElement('header');
  bar.className = 'protobar';
  bar.setAttribute('aria-label', 'Прототип TLTS: экраны');
  if (sticky && !overlay) bar.setAttribute('data-sticky', '');
  if (overlay) bar.setAttribute('data-overlay', '');

  const links = SCREENS.map((s) => {
    const cur = s.id === current;
    return `<li><a class="protobar__link" href="${href(s.file)}"${cur ? ' aria-current="page"' : ''}>${s.label}</a></li>`;
  }).join('');

  const idea = IDEAS.find((s) => s.id === current) || null;
  const menuId = `protobar-ideas-${++uid}`;
  const ideaItems = IDEAS.map((s, i) => {
    const cur = s.id === current;
    return `<li${i === 1 ? ' class="is-first-screen"' : ''}><a href="${href(s.file)}"${cur ? ' aria-current="page"' : ''}>`
      + `<span>${s.label}</span>${s.hint ? `<small>${s.hint}</small>` : ''}</a></li>`;
  }).join('');
  const ideas = `<div class="protobar__ideas">`
    + `<button type="button" class="protobar__ideas-btn" aria-expanded="false" aria-controls="${menuId}"${idea ? ' data-current' : ''}`
    + ` aria-label="Идеи, не утверждены${idea ? `: открыт экран «${idea.label}»` : ''}">`
    + `<span class="protobar__ideas-tag" aria-hidden="true">Идеи</span>`
    + `${idea ? `<span class="protobar__ideas-cur" aria-hidden="true">${idea.label}</span>` : ''}${CARET}</button>`
    + `<div class="protobar__menu" id="${menuId}" hidden>`
    + `<p class="protobar__menu-head">Мои идеи · пока не утверждены</p>`
    + `<ul>${ideaItems}</ul></div></div>`;

  const hereText = here ?? (current === 'kit' ? 'Витрина стиля' : null);
  bar.innerHTML = `<a class="protobar__brand" href="${href('index.html')}" aria-label="Прототип TLTS — главная">${MARK}<span class="protobar__brand-text">Прототип TLTS</span></a>`
    + `<nav class="protobar__nav" aria-label="Экраны прототипа"><ul class="protobar__list">${links}</ul></nav>`
    + ideas
    + `<div class="protobar__side">${hereText ? `<span class="protobar__here">${esc(hereText)}</span>` : ''}`
    + `${demo ? '<span class="protobar__demo">Демо<span class="protobar__demo-tail">-данные</span></span>' : ''}</div>`;
  if (owner) ensureSkip();
  insertAtTop(host, bar);

  const offs = [];
  const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); offs.push(() => el.removeEventListener(type, fn, opts)); };

  // --- текущая ссылка видна в прокручиваемой ленте (Б1): положение считаем от самой ленты
  const nav = bar.querySelector('.protobar__nav');
  const active = nav.querySelector('.protobar__link[aria-current="page"]');
  if (active) {
    const place = () => {
      if (!active.isConnected || nav.scrollWidth <= nav.clientWidth) return;
      const left = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
      nav.scrollLeft = Math.max(0, left - (nav.clientWidth - active.offsetWidth) / 2);
    };
    place();
    requestAnimationFrame(() => requestAnimationFrame(place));
    document.fonts?.ready?.then(place);
    let lastW = innerWidth;
    on(window, 'resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; place(); } });
  }

  // --- группа «Идеи»: кнопка-раскрывашка (Enter/Пробел открывают, Esc закрывает, стрелки ходят по списку)
  const btn = bar.querySelector('.protobar__ideas-btn');
  const menu = bar.querySelector('.protobar__menu');
  const items = () => [...menu.querySelectorAll('a')];
  const setOpen = (open, { focus = null } = {}) => {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open && focus === 'first') items()[0]?.focus();
    if (open && focus === 'current') (menu.querySelector('[aria-current="page"]') || items()[0])?.focus();
    if (!open && focus === 'button') btn.focus();
    if (open && overlay) bar.show();
  };
  on(btn, 'click', () => setOpen(menu.hidden));
  on(btn, 'keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true, { focus: 'first' }); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); items().at(-1)?.focus(); }
  });
  on(bar.querySelector('.protobar__ideas'), 'keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); e.stopPropagation(); setOpen(false, { focus: 'button' }); return; }
    if (menu.hidden || !menu.contains(e.target)) return;
    const list = items(); const i = list.indexOf(e.target);
    const go = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: list.length - 1 }[e.key];
    if (go !== undefined) { e.preventDefault(); list[(go + list.length) % list.length].focus(); }
  });
  on(bar.querySelector('.protobar__ideas'), 'focusout', (e) => {
    if (!menu.hidden && e.relatedTarget && !bar.querySelector('.protobar__ideas').contains(e.relatedTarget)) setOpen(false);
  });
  on(document, 'pointerdown', (e) => { if (!menu.hidden && !bar.querySelector('.protobar__ideas').contains(e.target)) setOpen(false); });

  // --- поверх экрана и прячется (Б4)
  let hidden = false;
  let timer = 0;
  const setShown = () => {
    if (!overlay || !owner) return;
    root.style.setProperty('--protobar-shown', hidden ? '0px' : `${bar.offsetHeight}px`);
    root.toggleAttribute('data-protobar-hidden', hidden);
  };
  const setHidden = (v) => {
    if (!overlay || v === hidden) return;
    hidden = v;
    bar.toggleAttribute('data-hidden', v);
    if (v) bar.setAttribute('aria-hidden', 'true'); else bar.removeAttribute('aria-hidden');
    setShown();
    bar.dispatchEvent(new CustomEvent('protobar:toggle', { bubbles: true, detail: { hidden: v } }));
  };
  const sleep = () => {
    // не прятаться, пока полоску трогают: наведена мышь, внутри фокус, открыт список идей
    if (bar.matches(':hover') || bar.contains(document.activeElement) || !menu.hidden) { timer = setTimeout(sleep, idle); return; }
    setHidden(true);
  };
  const wake = () => {
    if (!bar.isConnected) return;
    setHidden(false);
    clearTimeout(timer);
    if (overlay && idle > 0) timer = setTimeout(sleep, idle);
  };
  bar.show = wake;
  bar.hide = () => { clearTimeout(timer); setOpen(false); setHidden(true); };
  Object.defineProperty(bar, 'isHidden', { get: () => hidden, configurable: true });
  if (overlay) {
    for (const t of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) on(window, t, wake, { passive: true });
    on(bar, 'focusin', wake);
    wake();
  }

  // --- высота полоски (П3)
  const setHeight = () => {
    if (!bar.isConnected || !owner) return;
    root.style.setProperty('--protobar-h', `${bar.offsetHeight}px`);
    setShown();
  };
  setHeight();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(setHeight); ro.observe(bar); }

  cleanups.set(host, () => {
    offs.forEach((off) => off());
    clearTimeout(timer);
    ro?.disconnect();
    if (overlay && owner) { root.style.removeProperty('--protobar-shown'); root.removeAttribute('data-protobar-hidden'); }
  });
  return bar;
}

export const PROTO_SCREENS = SCREENS.map((s) => ({ id: s.id, label: s.label, href: href(s.file) }));
export const PROTO_IDEAS = IDEAS.map((s) => ({ id: s.id, label: s.label, href: href(s.file) }));

/* ======================================================================
   Плашка «Моя идея» для верха экранов с идеями (Б3)
   ====================================================================== */

const NOTE_CARET = '<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

const fmtScore = (s) => (typeof s === 'number' ? s.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : String(s));
function fmtApprovals(a) {
  if (a == null) return null;
  if (Array.isArray(a)) return `${a[0]} из ${a[1]}`;
  if (typeof a === 'object') return `${a.yes} из ${a.of ?? 3}`;
  if (typeof a === 'number') return `${a} из 3`;
  return String(a);
}
function metaLine({ score, approvals }) {
  const parts = [];
  if (score != null) parts.push(`оценка критиков <b>${esc(fmtScore(score))}</b> из 10`);
  const ap = fmtApprovals(approvals);
  if (ap) parts.push(`одобрили <b>${esc(ap)}</b>`);
  return parts.join(' · ');
}

/**
 * Плашка «Моя идея · заказчик ещё не утверждал».
 *   target     куда вставить: элемент или CSS-селектор. Плашка встаёт первой внутри него.
 *              null — сразу после полоски прототипа (или в начало <body>).
 *   title      название идеи
 *   score      оценка критиков: 8.3 → «8,3 из 10»
 *   approvals  сколько критиков одобрили: 3 → «3 из 3», [2, 3] или { yes: 2, of: 3 } → «2 из 3», строка — как есть
 *   ideas      вместо title/score/approvals, если на экране две идеи: [{ title, score, approvals }, …]
 *   changed    ['…'] — «Изменено по требованию критиков» (нумерованный список)
 *   league     ['…'] — «Что должна решить лига»
 *   why        одна фраза: зачем эта идея (необязательно)
 *   approved   что на экране уже утверждено заказчиком (необязательно), например «порядок регистрации»
 *   href       ссылка «Все идеи» (по умолчанию ideas.html; false — без ссылки)
 *   open       true | false | 'auto' (по умолчанию): свёрнута — на телефоне (до 767 px) в одну строку, на компьютере виден заголовок, списки раскрываются кнопкой «Подробнее»
 *   layer      'paper' | 'air' — если плашка другого слоя, чем блок вокруг
 *   kind       'idea' (по умолчанию) — «Моя идея · не утверждена»;
 *              'overview' — для витрины идей: метка «Обзор» и подпись «Предложения сверх утверждённого»
 * На телефоне свёрнутая строка у экрана с двумя идеями пишет «2 идеи» и оценки «6,3 и 6,3», а не обрезанные названия.
 * Возвращает элемент плашки. Повторный вызов в тот же target заменяет прежнюю плашку.
 */
export function mountIdeaNote(target = null, opts = {}) {
  if (typeof document === 'undefined') return null;
  ensureStyle('tlts-idea-note-css', NOTE_CSS);
  const {
    title = '', score = null, approvals = null, ideas = null, changed = [], league = [],
    why = null, approved = null, href: link = 'ideas.html', open = 'auto', layer = null, kind = 'idea',
  } = opts;
  const overview = kind === 'overview';
  let host = typeof target === 'string' ? document.querySelector(target) : target;
  const list = (ideas && ideas.length ? ideas : [{ title, score, approvals }]).filter((x) => x && x.title);
  const n = ++uid;

  const el = document.createElement('aside');
  el.className = 'idea-note';
  el.setAttribute('aria-labelledby', `idea-note-t${n}`);
  if (layer) el.setAttribute('data-layer', layer);

  const titleText = list.map((x) => x.title).join(' + ');
  const titleHTML = list.map((x) => esc(x.title)).join(' <span aria-hidden="true">+</span> ');
  const metaHTML = list.length > 1
    ? list.map((x) => `<span>«${esc(x.title)}»: ${metaLine(x)}</span>`).join('<br>')
    : metaLine(list[0] || {});
  const scores = list.filter((x) => x.score != null).map((x) => fmtScore(x.score));
  const shortScore = scores.length > 1 ? `${scores.slice(0, -1).join(', ')} и ${scores.at(-1)}` : scores.join('');
  // свёрнутая строка на телефоне: две идеи — «2 идеи» (названия видны в раскрытой плашке); витрина — подпись обзора
  const lineText = overview ? 'Предложения сверх утверждённого'
    : list.length > 1 ? `${list.length} ${list.length < 5 ? 'идеи' : 'идей'}` : titleText;
  const lineLabel = overview ? `Обзор: ${titleText || 'предложения сверх утверждённого'}`
    : list.length > 1 ? `${lineText}: ${titleText}` : null;
  const tagHTML = overview ? 'Обзор' : 'Моя идея<span class="idea-note__tag-tail"> · не утверждена</span>';
  const statusText = overview ? 'Предложения сверх утверждённого · пока не утверждены' : 'Пока не утверждено · это предложение';
  const ch = (changed || []).filter(Boolean);
  const lg = (league || []).filter(Boolean);
  const counts = [ch.length ? `изменено: ${ch.length}` : '', lg.length ? `вопросов лиге: ${lg.length}` : ''].filter(Boolean).join(' · ');
  const linkHref = link === false ? null : new URL(link, LIVE_ROOT).href;

  el.innerHTML = `<button type="button" class="idea-note__line" aria-expanded="false" aria-controls="idea-note-b${n}">`
    + `<span class="idea-note__tag">${tagHTML}</span>`
    + `<span class="idea-note__line-title">${lineLabel ? `<span aria-hidden="true">${esc(lineText)}</span><span class="idea-note__vh">${esc(lineLabel)}</span>` : esc(lineText)}</span>`
    + `${shortScore ? `<span class="idea-note__line-score">${esc(shortScore)}</span>` : ''}${NOTE_CARET}</button>`
    + `<div class="idea-note__head">`
    + `<span class="idea-note__tag">${overview ? 'Обзор' : 'Моя идея'}</span>`
    + `<div class="idea-note__main">`
    + `<p class="idea-note__status">${statusText}</p>`
    + `<p class="idea-note__title" id="idea-note-t${n}">${titleHTML}</p>`
    + `${metaHTML ? `<p class="idea-note__meta">${metaHTML}</p>` : ''}`
    + `${why ? `<p class="idea-note__why">${esc(why)}</p>` : ''}`
    + `${approved ? `<p class="idea-note__approved"><b>Уже утверждено:</b> ${esc(approved)}</p>` : ''}`
    + `</div><div class="idea-note__acts">`
    + `${ch.length || lg.length ? `<button type="button" class="idea-note__toggle" aria-expanded="false" aria-controls="idea-note-b${n}">`
      + `<span class="idea-note__toggle-text">Условия критиков и вопросы лиге</span>${NOTE_CARET}</button>` : ''}`
    + `${linkHref ? `<a class="idea-note__all" href="${linkHref}">Все идеи</a>` : ''}`
    + `</div></div>`
    + `<div class="idea-note__body" id="idea-note-b${n}">`
    + `<section class="idea-note__col"><p class="idea-note__col-h">Изменено по требованию критиков${ch.length ? ` · ${ch.length}` : ''}</p>`
    + (ch.length ? `<ol>${ch.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '<p class="idea-note__none">Без изменений.</p>')
    + `</section><section class="idea-note__col"><p class="idea-note__col-h">Что должна решить лига${lg.length ? ` · ${lg.length}` : ''}</p>`
    + (lg.length ? `<ul>${lg.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="idea-note__none">Вопросов к лиге нет.</p>')
    + `</section></div>`;

  // без условий и вопросов на компьютере тело не нужно
  const hasBody = ch.length || lg.length;
  const lineBtn = el.querySelector('.idea-note__line');
  const toggle = el.querySelector('.idea-note__toggle');
  const toggleText = el.querySelector('.idea-note__toggle-text');
  const mqPhone = window.matchMedia('(max-width: 767px)');
  let isOpen;
  const apply = (v) => {
    isOpen = v;
    el.toggleAttribute('data-open', v);
    lineBtn.setAttribute('aria-expanded', String(v));
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(v));
      toggleText.textContent = v ? 'Свернуть' : (counts ? `Подробнее · ${counts}` : 'Подробнее');
    }
  };
  // «auto»: свёрнута везде; на компьютере виден заголовок, списки открывает кнопка (решение главной сессии 13.11: раскрытая плашка занимала пол-экрана)
  const initial = open === 'auto' ? false : Boolean(open);
  apply(initial);
  if (!hasBody) el.querySelector('.idea-note__body').hidden = true;
  lineBtn.addEventListener('click', () => apply(!isOpen));
  toggle?.addEventListener('click', () => apply(!isOpen));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen && mqPhone.matches) { apply(false); lineBtn.focus(); }
  });

  if (host) {
    host.querySelector(':scope > .idea-note')?.remove();
    host.prepend(el);
  } else {
    host = document.body;
    host.querySelector(':scope > .idea-note')?.remove();
    const bar = host.querySelector(':scope > .protobar');
    if (bar) bar.after(el); else insertAtTop(host, el);
  }
  return el;
}
