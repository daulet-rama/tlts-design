// «Перед началом»: пары на корте, кто подаёт первым, стороны, формат.
// По умолчанию — следующий несыгранный матч судьи (в 18:47 это матч за 5-е место в 19:00).
// Матч, который уже идёт или сыгран, сюда не попадает: идущий — на пульт, сыгранный — к итогу.
import { duoHtml, ballSvg, hydrate, icon, worldSec, sheet } from '../app.js';
import { D, RULES, store, pickMatch, phaseOf, go, esc, courtOf, pairOf, pairGen, callOf, hereOf, pultHref, markRowHtml, setMark, pickHtml, buzz } from './judge.js';

const id = pickMatch('soon');
const ph = id ? phaseOf(id) : null;
if (!id) go('judge-list.html', true);
else if (ph === 'live') go(pultHref(id), true);
else if (ph === 'done' || ph === 'sent') go(`judge-end.html?m=${id}`, true);
else start();

function start() {
  const m = D.match(id);
  const c = courtOf(m);
  const saved = store.get(id);
  const call = callOf(id);
  let server = saved.server === 1 ? 1 : 0;   // кто подаёт первым
  let far = saved.far === 1 ? 1 : 0;         // какая пара на дальней половине (сверху)
  const here = hereOf(id);                   // пары на корте: журнал дня и отметки судьи

  document.getElementById('where').textContent = `${c.name} · ${m.time}`;
  document.getElementById('what').textContent = m.title;
  document.getElementById('srf').textContent = D.SURFACES[c.surface].Label;
  document.title = `Перед началом · ${m.title} · Судья · Теннисная лига`;
  const court = document.getElementById('court');
  court.dataset.surface = c.surface;

  // ---------- корт: половины, сетка, мяч ----------
  const halves = document.getElementById('halves');
  const halfHtml = (side) => {
    const p = pairOf(m, side);
    return `<button type="button" class="jd-half" data-side="${side}" aria-pressed="false" aria-label="Первыми подают ${esc(p.name)}">
      ${duoHtml(p.id, '')}
      <span class="jd-half-name"><span>${esc(p.lines[0])}</span><span>${esc(p.lines[1])}</span></span>
    </button>`;
  };
  halves.innerHTML = `${halfHtml(0)}
    <div class="jd-net"><span class="court-line jd-net-line" aria-hidden="true"></span><button type="button" class="jd-swap glass" id="swap" aria-label="Поменять стороны">${icon('swap')}<span>Стороны</span></button></div>
    ${halfHtml(1)}
    <span class="jd-ball" aria-hidden="true">${ballSvg('glow')}</span>`;
  const halfEl = [0, 1].map((s) => halves.querySelector(`.jd-half[data-side="${s}"]`));
  const net = halves.querySelector('.jd-net');
  const ball = halves.querySelector('.jd-ball');

  function placeBall(animate) {
    const h = halfEl[server];
    const y = h.offsetTop + h.offsetHeight / 2;
    ball.style.transition = animate ? '' : 'none';
    ball.style.transform = `translateY(${y}px)`;
    if (!animate) { void ball.offsetWidth; ball.style.transition = ''; }
  }
  function order() {
    // дальняя половина — сверху, у сетки — кнопка «Стороны», ближняя — снизу
    halves.prepend(halfEl[far]);
    net.after(halfEl[1 - far]);
  }
  function paint(animate = true) {
    halfEl.forEach((h, s) => h.setAttribute('aria-pressed', s === server ? 'true' : 'false'));
    placeBall(animate);
    document.getElementById('say').textContent = `Первыми подают ${pairOf(m, server).name}`;
  }
  halfEl.forEach((h, s) => h.addEventListener('click', () => {
    if (server === s) return;
    server = s; store.set(id, { server, far }); buzz(); paint(true);
  }));

  // смена сторон: пары меняются половинами, мяч уходит вместе с подающей парой
  document.getElementById('swap').addEventListener('click', () => {
    const before = halfEl.map((h) => h.getBoundingClientRect().top);
    far = 1 - far;
    order();
    halfEl.forEach((h, s) => {
      const dy = before[s] - h.getBoundingClientRect().top;
      if (dy && h.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        h.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    });
    store.set(id, { server, far }); buzz(); paint(true);
  });
  order();
  paint(false);
  addEventListener('resize', () => placeBall(false));
  if (document.fonts) document.fonts.ready.then(() => placeBall(false));

  // ---------- пары на корте ----------
  const hereBox = document.getElementById('here');
  hereBox.innerHTML = [0, 1].map((s) => markRowHtml(m, s, here[s], ['На месте', 'Ждём'])).join('')
    + '<button type="button" class="row jd-row-go" id="noshow"><span class="grow strong">Пара не явилась</span><i data-icon="chev" class="go"></i></button>';
  const startBtn = document.getElementById('start');
  const wait = document.getElementById('wait');
  function paintHere() {
    const n = here.filter(Boolean).length;
    document.getElementById('hereN').textContent = `${n} из 2`;
    startBtn.disabled = n < 2;
    const missing = [0, 1].filter((s) => !here[s]);
    wait.hidden = !missing.length;
    const tail = call ? ` · неявка с ${call.noshow}` : '';
    wait.textContent = missing.length === 2 ? `Ждём обе пары${tail}` : missing.length ? `Ждём ${pairGen(m, missing[0])}${tail}` : '';
  }
  hereBox.querySelectorAll('.pick').forEach((row) => row.addEventListener('click', () => {
    const s = +row.dataset.side;
    here[s] = !here[s];
    store.set(id, { here: here.slice() });
    setMark(row, here[s]); buzz(); paintHere();
  }));
  paintHere();

  // ---------- формат ----------
  document.getElementById('format').innerHTML = `
    <div class="row"><span class="grow"><span class="strong">${esc(RULES.set)}</span><span class="sub">${esc(RULES.tiebreak)}</span></span></div>
    <div class="row"><span class="grow"><span class="strong">${esc(RULES.deuce)}</span><span class="sub">${esc(RULES.deciding)}</span></span></div>`;

  // ---------- начать: пульт с нуля, подача и стороны — как выбрано ----------
  startBtn.addEventListener('click', () => {
    if (startBtn.disabled) return;
    store.set(id, { phase: 'live', server, far, here: here.slice(), startedAt: worldSec() });
    go(pultHref(id));
  });

  // ---------- неявка ----------
  const sheetEl = document.getElementById('sheet');
  const sh = sheet(sheetEl, document.getElementById('scrim'));
  const picks = document.getElementById('picks');
  const okBtn = document.getElementById('noshowOk');
  document.getElementById('noshowLead').textContent = call
    ? `Через ${RULES.callLimit} минут после вызова — поражение без счёта. Вызов в ${call.at}, неявка с ${call.noshow}`
    : `Через ${RULES.callLimit} минут после вызова — поражение без счёта`;
  let absent = null;
  function paintNoshow() {
    picks.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.side === absent ? 'true' : 'false'));
    okBtn.disabled = absent === null;
    document.getElementById('then').textContent = absent === null ? 'Какая пара не явилась?' : `Победа без счёта: ${pairOf(m, 1 - absent).name}`;
  }
  document.getElementById('noshow').addEventListener('click', (e) => {
    // если одна пара на месте, а другой нет — не явилась она
    absent = here[0] !== here[1] ? (here[0] ? 1 : 0) : null;
    picks.innerHTML = pickHtml(m, 0) + pickHtml(m, 1);
    picks.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { absent = +b.dataset.side; buzz(); paintNoshow(); }));
    paintNoshow();
    sh.open(e.currentTarget);
  });
  document.getElementById('noshowNo').addEventListener('click', () => sh.close());
  okBtn.addEventListener('click', () => {
    if (absent === null) return;
    store.set(id, { phase: 'done', outcome: 'noshow', by: absent, games: [0, 0], tb: null, fixed: false, was: null, ok: [false, false] });
    go(`judge-end.html?m=${id}`);
  });

  hydrate(document.querySelector('.app'));
}
