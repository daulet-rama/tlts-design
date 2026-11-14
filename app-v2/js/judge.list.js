// «Мои матчи»: ближайший матч судьи крупно, ниже остальные матчи дня.
// Состояние — из data.js и того, что судья сделал сам в этой вкладке (judge.js, phaseOf).
import { duoHtml, tileHtml, hydrate, icon, phrase, pairInfo, ptsOf, setTick, ballSvg, startLive, liveClock, clockText, worldSec, liveTiles } from '../app.js';
import { view } from '../score.js';
import { D, JUDGE, phaseOf, store, esc, courtOf, pairGen, callOf, hereOf, pultLog, pultScore, pultHref } from './judge.js';

const ids = JUDGE.matches;
const phase = Object.fromEntries(ids.map((id) => [id, phaseOf(id)]));
// герой: матч, который судья ведёт или закончил последним (по его действиям в этой вкладке);
// пока он ничего не делал — идущий матч, потом сыгранный без отправки, потом ближайший по времени
const open = ids.filter((id) => phase[id] === 'live' || phase[id] === 'done');
const touched = open.filter((id) => store.get(id).at).sort((a, b) => store.get(b).at - store.get(a).at);
const heroId = touched[0] || open.find((id) => phase[id] === 'live') || open[0] || ids.find((id) => phase[id] === 'soon') || null;

document.getElementById('day').textContent = `Судья · ${D.TODAY.label}`;

// итог матча, который судья закончил сам (счёт, неявка или снятие)
function result(id) {
  const own = store.get(id);
  if (!own.games) return null;
  const outcome = own.outcome || 'played';
  const g = own.games;
  const winner = outcome === 'played' ? (g[0] > g[1] ? 0 : 1) : 1 - own.by;
  return { outcome, games: g, tb: own.tb ?? null, by: own.by ?? null, winner };
}
const resultSay = (m, r) => (r.outcome === 'played'
  ? `Выиграли ${D.pairName(m.pairs[r.winner])}`
  : `${D.pairName(m.pairs[r.by])} ${r.outcome === 'noshow' ? 'не явились' : 'снялись'}, победа — ${D.pairName(m.pairs[r.winner])}`);

// ---------- герой: матч-предмет цвета своего корта ----------
const pairRow = (m, side) => `<span class="jd-pair" data-side="${side}">${duoHtml(m.pairs[side], 'sm')}<span class="strong ellipsis">${esc(D.pairName(m.pairs[side]))}</span>${ballSvg('jd-srv')}</span>`;

function heroHtml(id) {
  const m = D.match(id);
  const c = courtOf(m);
  const ph = phase[id];
  let pill = '';
  let big = '';
  let say = '';
  let btn = '';
  if (ph === 'live') {
    pill = '<span class="pill glass"><span class="dot"></span>Идёт · <span data-clock></span></span>';
    // очки гейма — капсула цвета мяча, как на «Сегодня» и в «Матче»: это «сейчас»
    big = '<span class="hero-num tick" data-games></span><span class="pts-chip now" aria-label="Очки в гейме"><span class="num tick" data-p="0"></span><span class="num sep" aria-hidden="true">:</span><span class="num tick" data-p="1"></span></span>';
    btn = `<a class="btn main jd-go" href="${pultHref(id)}">${icon('board')}Продолжить</a>`;
  } else if (ph === 'done') {
    const r = result(id);
    pill = '<span class="pill glass">Не отправлен</span>';
    big = r.outcome === 'noshow' ? '<span class="hero-num jd-word">Неявка</span>' : `<span class="hero-num">${r.games[0]}:${r.games[1]}</span>`;
    say = resultSay(m, r);
    btn = `<a class="btn main jd-go" href="judge-end.html?m=${id}">${icon('check')}К итогу</a>`;
  } else {
    // скоро: время крупно, под ним — вывод о парах: вызваны ли, на месте ли, когда можно записать неявку
    const call = callOf(id);
    const here = hereOf(id);
    const missing = [0, 1].filter((s) => !here[s]);
    if (call) pill = `<span class="pill glass">Вызов · ${call.at}</span>`;
    big = `<span class="hero-num">${m.time}</span>`;
    if (!missing.length) say = 'Пары на корте — можно начинать';
    else if (missing.length === 2) say = call ? `Ждём обе пары · неявка с ${call.noshow}` : 'Ждём обе пары';
    else say = `Ждём ${pairGen(m, missing[0])}${call ? ` · неявка с ${call.noshow}` : ''}`;
    btn = `<a class="btn main jd-go" href="judge-start.html?m=${id}">${icon('play')}Начать</a>`;
  }
  return `<article class="surface jd-ticket" data-surface="${c.surface}" aria-label="${esc(`${m.title}, ${D.courtLine(m.court)}, ${m.time}`)}">
    <div class="jd-ticket-top"><span class="cap">${esc(D.courtLine(m.court))}</span>${pill}</div>
    <div class="jd-who"><span class="cap">${esc(m.title)}</span>${pairRow(m, 0)}${pairRow(m, 1)}</div>
    <div class="jd-big">${big}</div>
    <p class="jd-say" data-say aria-live="polite">${esc(say)}</p>
    <div class="court-line" aria-hidden="true"></div>
  </article>
  ${btn}`;
}

const next = document.getElementById('next');
if (heroId) next.innerHTML = heroHtml(heroId);
else {
  // судья — «вы»: после своих матчей дня у него остаётся свой финал
  const mine = D.match(D.ME.match);
  const tail = mine && mine.state === 'soon' ? `. ${mine.title} у вас — в ${mine.time}, ${D.court(mine.court).name.toLowerCase()}` : '';
  next.innerHTML = `<div class="card empty"><i data-ball=""></i><span class="shadow"></span><span class="strong">На сегодня всё</span><span class="muted">Все результаты отправлены${esc(tail)}</span><a class="btn quiet small" href="index.html">Сегодня</a></div>`;
}

// идущий матч: счёт судьи с пульта; пока судья не вёл счёт в этой вкладке — счёт общего мира,
// тот же, что в эту секунду на «Сегодня» и в «Матче»
if (heroId && phase[heroId] === 'live') {
  const m = D.match(heroId);
  const PP = m.pairs.map(pairInfo);
  const card = next.querySelector('.jd-ticket');
  const paint = (s, v) => {
    const shown = v.stopped ? { ...v, games: v.stopped.games } : v;
    setTick(card.querySelector('[data-games]'), `${shown.games[0]}:${shown.games[1]}`);
    const p = ptsOf(v);
    card.querySelector('.pts-chip').hidden = v.finished;
    setTick(card.querySelector('[data-p="0"]'), p[0]);
    setTick(card.querySelector('[data-p="1"]'), p[1]);
    card.querySelector('[data-say]').textContent = v.stopped ? 'Перерыв из-за дождя' : phrase(s, v, PP);
    card.querySelectorAll('.jd-pair').forEach((el) => el.classList.toggle('srv', !v.finished && v.server === +el.dataset.side));
  };
  if (pultLog(heroId) || m.state !== 'live') {
    const s = pultScore(heroId);
    paint(s, view(s));
  } else {
    startLive((s, v) => paint(s, v));
  }
  // сколько идёт матч: у матча из общего мира — его часы, у начатого судьёй — с «Начать матч»
  const t0 = store.get(heroId).startedAt;
  const clock = card.querySelector('[data-clock]');
  const tick = () => { clock.textContent = clockText(m.state === 'live' ? liveClock() : Math.max(0, Math.floor(worldSec() - (t0 ?? worldSec())))); };
  tick();
  setInterval(tick, 1000);
}

// ---------- дальше: остальные неотправленные матчи ----------
// Плашка — по тому, где матч у судьи: скоро — к «Перед началом», идёт — на пульт
// (счёт общего мира идёт сам, свой счёт судьи стоит), сыгран — к итогу.
function laterTile(id) {
  const m = D.match(id);
  if (phase[id] === 'soon') return tileHtml({ ...m, state: 'soon' }, { href: `judge-start.html?m=${id}` });
  if (phase[id] === 'done') {
    const r = result(id);
    const sets = r && r.outcome === 'played' ? [[r.games[0], r.games[1], ...(r.tb !== null ? [r.tb] : [])]] : [];
    return tileHtml({ ...m, state: 'done', sets, winner: r ? r.winner : 0, duration: undefined }, { href: `judge-end.html?m=${id}` })
      .replace('<span class="cap">Сыгран</span>', '<span class="cap">Не отправлен</span>');
  }
  if (m.state === 'live' && !pultLog(id)) return tileHtml(m, { href: pultHref(id) });
  const v = view(pultScore(id));
  const p = ptsOf(v);
  // свой счёт судьи: плашка не подключается к общему живому счёту (data-live-on)
  return tileHtml({ ...m, state: 'live' }, { href: pultHref(id), live: { games: v.games, points: v.finished ? ['', ''] : p, server: v.server } })
    .replace('<a class="mt"', '<a class="mt" data-live-on');
}
const later = ids.filter((id) => id !== heroId && phase[id] !== 'sent');
if (later.length) {
  document.getElementById('later').hidden = false;
  const box = document.getElementById('laterList');
  box.innerHTML = later.map(laterTile).join('');
  liveTiles(box);
}

// ---------- отправлены: последние сверху ----------
// Сыгранные по data.js — на свой экран «Матч сыгран» (match-done.html?m=…);
// отправленные судьёй в этой вкладке — на его «Итог матча» с тем, что ушло.
const sent = ids.filter((id) => phase[id] === 'sent').reverse();
if (sent.length) {
  document.getElementById('sent').hidden = false;
  document.getElementById('sentN').textContent = `${sent.length} из ${ids.length}`;
  document.getElementById('sentList').innerHTML = sent.map((id) => {
    const m = D.match(id);
    const r = result(id);
    if (!r) return tileHtml(m, { href: `match-done.html?m=${id}` });
    const href = `judge-end.html?m=${id}`;
    if (r.outcome !== 'played') {
      // неявка и снятие — без счёта, исход словами в заголовке плашки
      const word = r.outcome === 'noshow' ? 'Неявка' : `Снятие при ${r.games[0]}:${r.games[1]}`;
      return tileHtml({ ...m, state: 'done', sets: [], winner: r.winner, duration: undefined }, { href }).replace('<span class="cap">Сыгран</span>', `<span class="cap">${word}</span>`);
    }
    const sets = [[r.games[0], r.games[1], ...(r.tb !== null ? [r.tb] : [])]];
    return tileHtml({ ...m, state: 'done', sets, winner: r.winner, duration: undefined }, { href });
  }).join('');
}

// ---------- только что отправлено — строка над героем ----------
const flash = store.get('_flash');
if (flash.text) {
  const el = document.getElementById('flash');
  el.innerHTML = `${icon('check')}<span>${esc(flash.text)}</span>`;
  el.hidden = false;
  store.set('_flash', { text: '' });
}

hydrate(document.querySelector('.app'));
