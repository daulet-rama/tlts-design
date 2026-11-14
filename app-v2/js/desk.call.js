// Экран игрока «Вас вызывают на корт»: ваш финал, корт, отсчёт на выход, «Иду» и «Нужно 5 минут».
// Если финал вызвали с пульта дня — время вызова, часы и ответ общие с пультом (desk.state.js):
// экран идёт по тем же часам, что и пульт. Иначе он показывает момент вызова по программе —
// за 20 минут до начала (19:40), и отсчёт идёт с открытия экрана.
import { D, duoHtml, matchHref, keepTheme } from '../app.js';
import * as L from './desk.logic.js';
import * as S from './desk.state.js';

const $ = (id) => document.getElementById(id);
const M = D.match(D.ME.match);
const MINE = D.ME.pair;
const OPP = M.pairs.find((p) => p !== MINE);
const C = D.court(M.court);
const LIMIT = D.RULES.callLimit;
const OWN_AT = L.toMin(M.time) - LIMIT;    // 19:40
const OWN_KEY = 'tl-call-own-v1';

// свой вызов, пока с пульта его нет: часы и ответ живут до закрытия вкладки (не дольше 45 минут)
function ownState() {
  try {
    const s = JSON.parse(window.sessionStorage.getItem(OWN_KEY) || 'null');
    if (s && Number.isFinite(s.open) && Date.now() - s.open < 45 * 60 * 1000) return s;
  } catch { /* хранилище недоступно */ }
  return { open: Date.now(), reply: null };
}
function saveOwn(s) { try { window.sessionStorage.setItem(OWN_KEY, JSON.stringify(s)); } catch { /* только на экране */ } }
const ownSt = ownState();
saveOwn(ownSt);
const OPEN = ownSt.open;
let own = ownSt.reply;

function current() {
  const s = S.peek();
  const c = s && s.calls && s.calls[M.id];
  if (c && !c.closed) return { linked: true, s, c, at: c.at, now: S.nowOf(s), reply: (c.replies || {})[MINE] || null };
  return { linked: false, at: OWN_AT, now: OWN_AT + (Date.now() - OPEN) / 60000, reply: own };
}

// корт, соперники и время — из data.js
$('dk-court-name').querySelector('.hero-num').textContent = C.name.replace(/\D/g, '');
$('dk-srf').textContent = `${D.SURFACES[C.surface].Label}${C.note ? ` · ${C.note}` : ''}`;
document.querySelector('.dk-courtobj').dataset.surface = C.surface;
$('dk-call-what').textContent = M.title;
$('dk-vs').href = keepTheme(matchHref(M));
$('dk-vs').querySelector('.duo').outerHTML = duoHtml(OPP, 'sm');
$('dk-vs-names').textContent = D.pairName(OPP);
$('dk-vs-time').textContent = M.time;

let lastSec = -1;
function render() {
  const x = current();
  // прочитано: отмечает только открытый экран игрока
  if (x.linked && !(x.c.reads || {})[MINE]) {
    S.update((s) => {
      const c = s.calls[M.id];
      if (!c) return;
      c.reads = c.reads || {};
      c.reads[MINE] = S.nowOf(s);
      S.addLog(s, { who: `Игрок · ${D.pairName(MINE)}`, text: 'Вызов прочитан на телефоне', kind: 'read' });
    }, true);
  }
  const at = `Вызов в ${L.hhmm(x.at)}`;
  if ($('dk-call-at').textContent !== at) $('dk-call-at').textContent = at;
  const left = Math.max(0, LIMIT - (x.now - x.at));
  const sec = Math.floor(left * 60 + 1e-6);
  if (sec !== lastSec) {
    lastSec = sec;
    const box = $('dk-left');
    if (sec > 0) {
      box.innerHTML = `<span class="num">${Math.floor(sec / 60)}</span><span class="unit">мин</span> <span class="num">${String(sec % 60).padStart(2, '0')}</span><span class="unit">с</span>`;
      $('dk-left-cap').textContent = 'На выход';
    } else {
      box.innerHTML = '<span class="unit">подойдите к судье</span>';
      $('dk-left-cap').textContent = 'Время вышло';
    }
    $('dk-left-box').setAttribute('aria-label', sec > 0 ? `На выход ${Math.floor(sec / 60)} мин ${sec % 60} с` : 'Время на выход вышло');
  }
  // пока ответа нет, «Иду» — главная кнопка цвета мяча; после ответа экран успокаивается:
  // выбранный ответ отмечен, как выбранная вкладка, вторая кнопка тихая
  const r = x.reply;
  const sent = r ? (r.kind === 'go' ? `Ответ «Иду» отправлен в ${L.hhmm(r.at)}` : `Ответ отправлен: будете около ${L.hhmm(r.at + 5)}`) : '';
  if ($('dk-sent').textContent !== sent) $('dk-sent').textContent = sent;
  $('dk-go').classList.toggle('main', !r);
  $('dk-go').classList.toggle('quiet', !!r);
  $('dk-go').setAttribute('aria-pressed', String(!!r && r.kind === 'go'));
  $('dk-five').setAttribute('aria-pressed', String(!!r && r.kind === 'five'));
}

function reply(kind) {
  const x = current();
  if (x.linked) {
    S.update((s) => {
      const c = s.calls[M.id];
      if (!c) return;
      const t = S.nowOf(s);
      c.reads = c.reads || {};
      if (!c.reads[MINE]) c.reads[MINE] = t;
      c.replies = c.replies || {};
      c.replies[MINE] = { kind, at: t };
      S.addLog(s, { who: `Игрок · ${D.pairName(MINE)}`, text: kind === 'go' ? 'Ответ на вызов: «Иду»' : `Ответ на вызов: «Нужно 5 минут» — будут около ${L.hhmm(t + 5)}`, kind: 'reply' });
    }, true);
  } else {
    own = { kind, at: x.now };
    saveOwn({ open: OPEN, reply: own });
  }
  if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(12);
  render();
}

$('dk-go').addEventListener('click', () => reply('go'));
$('dk-five').addEventListener('click', () => reply('five'));

render();
setInterval(render, 1000);
S.onChange(() => render());
window.addEventListener('pageshow', (e) => { if (e.persisted) render(); });
