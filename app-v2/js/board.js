// Табло для телевизора в клубе: все корты сразу.
// На каждом корте — идущий матч, иначе ближайший матч и время, иначе «свободен».
// Сверху строка турнира с часами, внизу строка вызова на корт.
// Время, счёт и вызовы общие для всех экранов: часы мира и живой счёт — из app.js
// (тот же розыгрыш, что на «Сегодня» и в «Матче»), вызовы — D.CALLS из data.js
// (тот же журнал дня, что у пульта турнирного дня).
import { D, esc, startLive, phrase, ptsOf, setTick, ballSvg, duoHtml, keepTheme, matchHref, worldSec, worldTime, liveClock, clockText } from '../app.js';

const $ = (id) => document.getElementById(id);
// табло тёмное и без ?theme=, поэтому ссылки всегда несут тему табло
const THEME = document.documentElement.dataset.theme || 'dark';
const themed = (href) => {
  const k = keepTheme(href);
  return /[?&]theme=/.test(k) ? k : `${k}${k.includes('?') ? '&' : '?'}theme=${THEME}`;
};
const hmSec = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 3600 + m * 60; };

// ---------- что сейчас на каждом корте ----------
// идущий матч, иначе ближайший по времени, иначе корт свободен
const todays = D.MATCHES.filter((m) => m.day === D.TODAY.dayMonth && m.court);
const byTime = (a, b) => String(a.time).localeCompare(String(b.time));
function courtNow(cid) {
  const ms = todays.filter((m) => m.court === cid).sort(byTime);
  const live = ms.find((m) => m.state === 'live');
  if (live) return { cid, kind: 'live', m: live };
  const next = ms.find((m) => m.state === 'soon');
  if (next) return { cid, kind: 'next', m: next };
  return { cid, kind: 'free' };
}
const COURTS = Object.keys(D.COURTS).map(courtNow);
const surfaceOf = (cid) => D.COURTS[cid].surface;
const surfaceWord = (cid) => D.SURFACES[surfaceOf(cid)].label;
const courtName = (cid) => `${esc(D.COURTS[cid].name)}<span class="vh">, ${esc(surfaceWord(cid))}</span>`;

// табличка корта: капсула цвета покрытия
const signHtml = (cid) => `<span class="pill tv-sign" data-surface="${surfaceOf(cid)}">${courtName(cid)}</span>`;

// ---------- строка турнира ----------
$('event').textContent = D.TOURNAMENT.name;
$('day').textContent = D.TODAY.label;

// ---------- идущий матч: предмет-корт с крупным счётом ----------
function liveHtml({ cid, m }) {
  const pts = m.points || ['0', '0'];
  const side = (i) => {
    const ball = ballSvg('glow');
    const digit = `<span class="tick" data-games>${m.games[i]}</span>`;
    return `<div class="tv-side-score" data-side="${i}"><div class="hero-num">${i === 0 ? digit + ball : ball + digit}</div></div>`;
  };
  const who = (i) => {
    const [a, b] = D.pairLines(m.pairs[i]);
    return `<div class="tv-who" data-who="${i}">${duoHtml(m.pairs[i])}<span class="names">${esc(a)}<br>${esc(b)}</span></div>`;
  };
  // глубокий корт (.deep): текст и счёт стоят посередине предмета и читаются издалека
  return `<a class="tv-hero surface deep" data-surface="${surfaceOf(cid)}" data-live="${m.id}" href="${themed(matchHref(m))}">
    <div class="tv-hero-top">
      <span class="pill glass tv-sign">${courtName(cid)}</span>
      <span class="pill glass" data-pill><span class="dot"></span><span data-now>Идёт · <span class="tv-elapsed" data-elapsed>${esc(m.elapsed || '')}</span></span><span data-over hidden>Сыгран</span></span>
      <span class="cap">${esc(m.title)}</span>
    </div>
    <p class="tv-say" data-say>&nbsp;</p>
    <div class="tv-score">
      ${side(0)}
      <div class="pts-chip now" aria-label="Очки в гейме"><span class="num tick" data-p="0">${esc(pts[0])}</span><span class="num sep" aria-hidden="true">:</span><span class="num tick" data-p="1">${esc(pts[1])}</span></div>
      ${side(1)}
      ${who(0)}${who(1)}
    </div>
    <div class="court-line" aria-hidden="true"></div>
  </a>`;
}

// ---------- корт со следующим матчем: табличка, что за матч, время, пары ----------
function nextHtml({ cid, m }) {
  const pair = (i) => `<span class="tv-pair">${duoHtml(m.pairs[i])}<span class="tv-name">${esc(D.pairName(m.pairs[i]))}</span></span>`;
  return `<a class="tv-court card" data-court="${cid}" data-match="${m.id}" href="${themed(matchHref(m))}">
    <span class="tv-court-top">${signHtml(cid)}<span class="cap" data-what>${esc(m.title)}</span><span class="t-num tv-time">${esc(m.time)}</span></span>
    ${pair(0)}${pair(1)}
  </a>`;
}

// ---------- свободные корты: одной тихой строкой ----------
function freeHtml(list) {
  if (!list.length) return '';
  const word = list.length > 1 ? 'Свободны' : 'Свободен';
  return `<div class="tv-court card tv-free">
    <span class="cap">${word}</span>
    ${list.map(({ cid }) => `<span class="tv-free-court"><span class="srf-dot" data-surface="${surfaceOf(cid)}"></span>${courtName(cid)}</span>`).join('')}
  </div>`;
}

// ---------- строка вызова: без таймера, отсчёт видят только судья и директор ----------
// Вызов из журнала дня (D.CALLS), если его время уже наступило и матч ещё не начался.
// Вызовов несколько — первым тот, чей матч раньше.
function callHtml(sec) {
  const calls = D.CALLS
    .map((c) => ({ ...c, m: D.match(c.match) }))
    .filter((c) => c.m && c.m.state === 'soon' && hmSec(c.at) <= sec)
    .sort((a, b) => byTime(a.m, b.m));
  if (!calls.length) return '<span class="tv-call-what tv-call-none">Вызовов нет</span>';
  const c = calls[0];
  const [a, b] = c.m.pairs.map((p) => D.pairName(p));
  return `<span class="dot"></span><span class="tv-call-what">Вызов</span>
    ${signHtml(c.m.court)}
    <span class="tv-call-names">${esc(a)} <span class="tv-dash">—</span> ${esc(b)}</span>`;
}

// ---------- сборка ----------
const live = COURTS.filter((c) => c.kind === 'live');
const next = COURTS.filter((c) => c.kind === 'next').sort((a, b) => byTime(a.m, b.m));
const free = COURTS.filter((c) => c.kind === 'free');
$('live').innerHTML = live.map(liveHtml).join('');
$('live').dataset.n = String(live.length);
$('courts').innerHTML = next.map(nextHtml).join('') + freeHtml(free);

// ---------- живой счёт ----------
const hero = document.querySelector('[data-live]');
function paint(s, v) {
  const lead = v.games[0] === v.games[1] ? -1 : v.games[0] > v.games[1] ? 0 : 1;
  [0, 1].forEach((i) => {
    const sd = hero.querySelector(`.tv-side-score[data-side="${i}"]`);
    sd.classList.toggle('lead', lead === i);
    sd.classList.toggle('trail', lead === 1 - i);
    hero.querySelector(`.tv-who[data-who="${i}"]`).classList.toggle('lead', lead === i);
    setTick(sd.querySelector('[data-games]'), v.games[i]);
    sd.querySelector('.ball').style.visibility = v.server === i && !v.finished ? 'visible' : 'hidden';
  });
  const chip = hero.querySelector('.pts-chip');
  chip.style.visibility = v.finished ? 'hidden' : 'visible';
  if (!v.finished) {
    const p = ptsOf(v);
    setTick(chip.querySelector('[data-p="0"]'), p[0]);
    setTick(chip.querySelector('[data-p="1"]'), p[1]);
  }
  hero.querySelector('[data-say]').textContent = phrase(s, v);
  // сет окончен: на капсуле «Сыгран»; через одно очко розыгрыш начнётся заново (часы мира)
  const pill = hero.querySelector('[data-pill]');
  pill.querySelector('.dot').hidden = v.finished;
  pill.querySelector('[data-now]').hidden = v.finished;
  pill.querySelector('[data-over]').hidden = !v.finished;
}
if (hero) startLive((s, v) => paint(s, v));

// ---------- часы мира: время дня, время матча, вызов и «ждём начала» ----------
const clock = $('clock');
const call = $('call');
const elapsedEl = document.querySelector('[data-elapsed]');
const tiles = next.map(({ m }) => ({ m, what: document.querySelector(`[data-match="${m.id}"] [data-what]`) }));
let callWas = '';
function tick() {
  const sec = worldSec();
  const t = worldTime(sec);
  if (clock.textContent !== t) clock.textContent = t;
  if (elapsedEl) {
    const e = clockText(liveClock(sec));
    if (elapsedEl.textContent !== e) elapsedEl.textContent = e;
  }
  const html = callHtml(sec);
  if (html !== callWas) { callWas = html; call.innerHTML = html; }
  // время матча прошло, а он не начался: как на афише — «ждём начала»
  tiles.forEach(({ m, what }) => {
    const w = sec >= hmSec(m.time) ? 'Ждём начала' : m.title;
    if (what && what.textContent !== w) what.textContent = w;
  });
}
tick();
setInterval(tick, 1000);
