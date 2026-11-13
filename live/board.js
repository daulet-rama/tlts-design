// Табло TLTS: один корт крупно, все корты сеткой или по кругу.
// Раскладка выбирается по пропорциям окна: широкий экран, вертикальный, узкая LED-полоса.
import { createStore, reasonText } from './core/store.js';
import { pairOf, playersOfPair, tournaments } from './core/data.js';
import { pairPlate, updatePairPlate, pairBall3dHTML, playerCard } from './core/card.js';
import { mountProtoBar } from './core/protobar.js';

// полоска лежит поверх табло и прячется ровно вместе с панелью управления (wake/sleep ниже)
const bar = mountProtoBar({ current: 'board', demo: true, overlay: true, idle: 0 });

const store = createStore();
const $ = (id) => document.getElementById(id);
const screen = $('screen');
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const VIEWS = ['court', 'all', 'auto'];
const params = new URLSearchParams(location.search);
let VIEW = VIEWS.includes(params.get('view')) ? params.get('view') : 'auto';
let M = params.get('m') && store.match(params.get('m')) ? params.get('m') : null;
// в адресе был матч, которого нет в данных: показываем разумное по умолчанию и говорим об этом
let MISSING = params.get('m') && !M ? params.get('m') : null;
// «вы здесь» на табло не бывает: это общий экран клуба (identity.js здесь не нужен)

const DUR = { all: 15000, court: 12000, next: 12000, strip: 6000 };
const SPEED = 2; // темп демо-автоигры на табло: очко примерно каждые 2–4 с

/* ---------------------------------------------------------------- данные */

const DEMO_T = tournaments.find((t) => t.id === 't-demo');
const demo = () => store.matches().filter((m) => m.dataset === 'demo');
const COURTS = DEMO_T?.courts?.length ? DEMO_T.courts : [...new Set(demo().map((m) => m.court).filter(Boolean))];
const byTime = (a, b) => String(a.scheduled || '').localeCompare(String(b.scheduled || ''));

// что сейчас показывать на корте: идущий матч, иначе ближайший, иначе последний сыгранный
function courtMatch(court) {
  const ms = demo().filter((m) => m.court === court).sort(byTime);
  return ms.find((m) => m.status === 'live') || ms.find((m) => m.status === 'upcoming') || ms.filter((m) => m.status === 'finished').pop() || null;
}
const courtIds = () => COURTS.map(courtMatch).filter(Boolean).map((m) => m.id);
const liveIds = () => COURTS.map(courtMatch).filter((m) => m && m.status === 'live').map((m) => m.id);
const nextUpcoming = () => demo().filter((m) => m.status === 'upcoming').sort(byTime)[0] || null;
function defaultMatch() {
  const ms = COURTS.map(courtMatch).filter(Boolean);
  return (ms.find((m) => m.status === 'live') || nextUpcoming() || ms[0] || store.matches()[0])?.id || null;
}

const courtShort = (c) => (c ? c.replace(/\s*корт$/i, '').replace(/^Корт\s*/i, 'Корт ') : null);
const courtLabel = (m) => (m.court ? (m.court === 'Центральный корт' ? 'Центральный' : m.court) : null);
const playersOf = (pid) => playersOfPair(pid).filter(Boolean);
const lastName = (p) => p?.last || p?.short || p?.name || '—';
const pairNames = (pid, sep = ' / ') => playersOf(pid).map(lastName).join(sep);
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '');
};
const formatText = (m) => {
  const g = m.format?.gamesToWin ?? 6;
  // тай-брейк в коротком сете регламент не описывает — «уточняется у лиги», как на афише
  const tb = g === 6 ? `при ${g}:${g} тай-брейк` : `тай-брейк при ${g}:${g} — уточняется у лиги`;
  const deuce = m.format?.deuce === 'deciding' ? ' · решающее очко при «ровно»' : '';
  const mode = m.mode === 'games' ? ' · счёт по геймам' : m.mode === 'final' ? ' · только итог' : '';
  return `Сет до ${g} геймов · ${tb}${deuce}${mode}`;
};

function tagsHTML(m) {
  const t = [];
  if (m.status === 'live') t.push('<span class="tag tag--live">LIVE</span>');
  else if (m.status === 'upcoming') t.push(`<span class="tag tag--soon">Скоро${m.scheduled ? ' · ' + esc(m.scheduled) : ''}</span>`);
  else t.push('<span class="tag tag--done">Завершён</span>');
  if (m.category === 'Grand Masters') t.push('<span class="tag tag--gm">Grand Masters</span>');
  else if (m.category === 'Masters') t.push('<span class="tag tag--m">Masters</span>');
  t.push(m.dataset === 'demo' ? '<span class="tag tag--demo">Демо-данные</span>' : '<span class="tag tag--done">Архив</span>');
  return t.join('');
}

// подпись состояния: главное слово и (если есть) уточнение на грунте
// «только итог»: судья внесёт счёт после матча — ни геймов, ни подачи до этого не показываем
const onlyFinal = (m, v) => m.mode === 'final' && m.status === 'live' && !v?.finished;
const scoreWords = (v) => v?.scoreLong || v?.scoreText || '';
function stateOf(m, v) {
  if (m.status === 'upcoming') return { text: `Начало в ${m.scheduled || '—'}`, chip: null };
  if (!v) return { text: '', chip: null };
  // неявка, снятие, прерван: готовая подпись основы, без очков, подачи и «Гейм N»
  if (v.outcome === 'walkover') return { text: 'Неявка · победа без счёта', chip: null };
  if (v.outcome && v.outcome !== 'played') return { text: v.outcomeText || v.label || 'Матч окончен', chip: null };
  if (v.finished) return { text: `Матч окончен · ${scoreWords(v)}`, chip: null };
  if (onlyFinal(m, v)) return { text: 'Итог после матча', chip: null };
  let chip = null;
  if (v.matchPoint === 0 || v.matchPoint === 1) chip = 'Матчбол';
  else if (v.decidingPoint) chip = 'Решающее очко';
  let text = v.label && v.label !== chip ? v.label : '';
  if (!text) text = m.mode === 'games' ? 'Счёт после каждого гейма' : `Гейм ${v.games[0] + v.games[1] + 1}`;
  return { text, chip };
}
const stateHTML = (s) => `<span class="st__text">${esc(s.text)}</span>${s.chip ? `<span class="tag tag--moment st__chip">${esc(s.chip)}</span>` : ''}`;
const serveHTML = (m, v) => (m.status === 'live' && v && !v.finished && !onlyFinal(m, v) && (v.server === 0 || v.server === 1)
  ? `<span class="serve-dot" aria-hidden="true"></span>Подают: ${esc(pairNames(m.pairs[v.server], ' и '))}` : '');

// счёт для плашки: в режиме «только итог» до конца матча — без цифр
const scoreOpts = (m, v, side) => (onlyFinal(m, v) ? {} : { view: v, side });
const plateFor = (m, side, size, withScore = true) => {
  const pid = m.pairs[side];
  const opts = { size, layer: 'air', ball3d: true };
  if (withScore) Object.assign(opts, scoreOpts(m, store.view(m.id), side));
  return pairPlate(pairOf(pid), playersOf(pid), opts);
};

// фамилия в плашке не должна уходить в многоточие: ужимаем кегль блока, пока все фамилии влезают
function fitNames(el, prop) {
  if (!el || !el.isConnected) return;
  let k = parseFloat(el.style.getPropertyValue(prop)) || 1;
  for (let i = 0; i < 8; i++) {
    const cut = [...el.querySelectorAll('.plate__n')].some((n) => n.scrollWidth > n.clientWidth + 0.5);
    if (!cut) break;
    k *= 0.97;
    el.style.setProperty(prop, k.toFixed(3));
  }
}
// 3D-мяч: браузер берёт картинку по настоящему размеру мяча на экране (160 или 640 px)
function ballSizes(el) {
  for (const img of el?.querySelectorAll?.('.pball--3d img') || []) {
    const w = Math.ceil(img.getBoundingClientRect().width);
    if (w) img.sizes = `${w}px`;
  }
}

// уменьшать масштаб блока, пока он не влезет по высоте и ширине (страховка для необычных пропорций)
function fitBox(el, prop = '--fit') {
  if (!el || !el.isConnected) return;
  let k = 1;
  el.style.setProperty(prop, k);
  for (let i = 0; i < 14; i++) {
    const over = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    if (!over) break;
    k *= 0.93;
    el.style.setProperty(prop, k.toFixed(3));
  }
  fitNames(el, prop);
  ballSizes(el);
}

/* ---------------------------------------------------------------- форма экрана */

function calcShape() {
  const w = innerWidth, h = innerHeight;
  const a = w / Math.max(1, h);
  return a >= 3 ? 'strip' : a < 0.82 ? 'tall' : 'wide';
}
let SHAPE = calcShape();
root.dataset.shape = SHAPE;

/* ---------------------------------------------------------------- вид «один корт» */

function courtComp(id) {
  const m = store.match(id);
  if (!m) return emptyComp('Матч не найден');
  if (SHAPE === 'strip') return stripComp(() => [id], 0);
  if (m.status === 'upcoming') return posterComp(m);

  const v = store.view(m.id);
  const el = document.createElement('section');
  el.className = 'cv';
  el.dataset.status = m.status;
  const st = stateOf(m, v);
  const archive = m.dataset === 'archive';
  el.innerHTML = `
    <header class="vhead">
      <p class="vhead__tags">${tagsHTML(m)}</p>
      <h1 class="vhead__title">${esc(m.stage)}${courtLabel(m) ? `<span class="vhead__court"> · ${esc(courtLabel(m))}</span>` : ''}</h1>
      <p class="vhead__meta">${esc(m.tournament?.name)} · ${esc(fmtDate(m.tournament?.date))} · ${esc(m.tournament?.venue || '')}</p>
    </header>
    <div class="cv__body">
      <div class="cv__faces cv__faces--a" aria-hidden="true"></div>
      <div class="cv__plates"></div>
      <div class="cv__faces cv__faces--b" aria-hidden="true"></div>
      <p class="cv__state st">${stateHTML(st)}</p>
      <p class="cv__serve">${serveHTML(m, v)}</p>
    </div>
    <footer class="vfoot"><span>${esc(formatText(m))}</span>${archive ? '<span>Счёт по очкам не сохранился: в архиве только итог</span>' : ''}</footer>`;
  const plates = [0, 1].map((side) => plateFor(m, side, 'lg'));
  el.querySelector('.cv__plates').append(...plates);

  // вертикальный экран: лица первой пары над счётом, второй — под ним
  if (SHAPE === 'tall') {
    m.pairs.forEach((pid, side) => {
      const grp = el.querySelector(side === 0 ? '.cv__faces--a' : '.cv__faces--b');
      for (const p of playersOf(pid)) {
        const state = v?.finished && (v.winner === 0 || v.winner === 1) ? (v.winner === side ? 'winner' : 'loser') : null;
        grp.append(playerCard(p, { size: 'md', toward: null, rank: 'none', state }));
      }
    });
  }

  return {
    el,
    fit() { fitBox(el); },
    update(cid) {
      if (cid && cid !== m.id) return true;
      const nm = store.match(m.id);
      if (!nm || nm.status !== m.status || nm.mode !== m.mode) return false;
      const nv = store.view(m.id);
      plates.forEach((p, side) => updatePairPlate(p, scoreOpts(nm, nv, side)));
      el.querySelector('.cv__state').innerHTML = stateHTML(stateOf(nm, nv));
      el.querySelector('.cv__serve').innerHTML = serveHTML(nm, nv);
      return true;
    },
  };
}

/* ---------------------------------------------------------------- афиша следующего матча */

function posterComp(m) {
  const el = document.createElement('section');
  el.className = 'pv';
  el.dataset.status = m.status;
  const h2h = m.h2h?.wins && (m.h2h.wins[0] + m.h2h.wins[1] > 0) ? `Личные встречи ${m.h2h.wins[0]}:${m.h2h.wins[1]}` : 'Первая встреча пар';
  el.innerHTML = `
    <header class="vhead">
      <p class="vhead__tags">${tagsHTML(m)}</p>
      <h1 class="vhead__title">${esc(m.stage)}</h1>
      <p class="vhead__meta">${esc(m.tournament?.name)} · ${esc(fmtDate(m.tournament?.date))} · ${esc(m.tournament?.venue || '')}</p>
    </header>
    <div class="pv__stage"></div>
    <p class="pv__start">Начало в <b class="num">${esc(m.scheduled || '—')}</b>${m.court ? ` · ${esc(m.court)}` : ''}</p>
    <footer class="vfoot"><span>${esc(formatText(m))}</span><span>${esc(h2h)}</span></footer>`;
  const stage = el.querySelector('.pv__stage');
  m.pairs.forEach((pid, side) => {
    const sideEl = document.createElement('div');
    sideEl.className = 'pv__side';
    const cards = document.createElement('div');
    cards.className = 'pv__cards';
    for (const p of playersOf(pid)) cards.append(playerCard(p, { size: 'xl', toward: side === 0 ? 'right' : 'left', rank: 'A' }));
    const plateBox = document.createElement('div');
    plateBox.className = 'pv__plate';
    plateBox.append(plateFor(m, side, 'md', false));
    sideEl.append(cards, plateBox);
    stage.append(sideEl);
    if (side === 0) stage.insertAdjacentHTML('beforeend', '<div class="pv__vs"><span class="poster__vs-mark">VS</span></div>');
  });
  return {
    el,
    fit() { fitBox(el); },
    update(cid) {
      if (cid && cid !== m.id) return true;
      const nm = store.match(m.id);
      return !!nm && nm.status === m.status;
    },
  };
}

/* ---------------------------------------------------------------- вид «все корты» */

function tileHTMLHead(m) {
  const court = courtLabel(m) || '—';
  const tag = m.status === 'live' ? '<span class="tag tag--live">LIVE</span>'
    : m.status === 'upcoming' ? `<span class="tag tag--soon">Скоро${m.scheduled ? ' · ' + esc(m.scheduled) : ''}</span>`
      : '<span class="tag tag--done">Завершён</span>';
  return `<header class="tile__head"><b class="tile__court">${esc(court)}</b><span class="tile__tags">${tag}</span></header>
    <p class="tile__stage">${esc(m.stage)}${m.scheduled ? ` · ${esc(m.scheduled)}` : ''}</p>`;
}

function allComp() {
  const el = document.createElement('section');
  el.className = 'av';
  const t = DEMO_T || {};
  el.innerHTML = `
    <header class="vhead">
      <p class="vhead__tags"><span class="tag tag--demo">Демо-данные</span></p>
      <h1 class="vhead__title">${esc(t.name || 'TS CUP')}</h1>
      <p class="vhead__meta">${esc(fmtDate(t.date))} · ${esc(t.venue || '')} · кортов: ${COURTS.length}</p>
    </header>
    <div class="av__grid" role="list"></div>`;
  const grid = el.querySelector('.av__grid');
  const tiles = new Map();
  const shown = COURTS.map(courtMatch).filter(Boolean);
  for (const m of shown) {
    const v = store.view(m.id);
    const tile = document.createElement('article');
    tile.className = 'tile';
    tile.setAttribute('role', 'listitem');
    tile.dataset.status = m.status;
    tile.innerHTML = `${tileHTMLHead(m)}<div class="tile__plates"></div><p class="tile__state st">${stateHTML(stateOf(m, v))}</p>`;
    const withScore = m.status !== 'upcoming';
    const plates = [0, 1].map((side) => plateFor(m, side, 'md', withScore));
    tile.querySelector('.tile__plates').append(...plates);
    grid.append(tile);
    tiles.set(m.id, { tile, plates, status: m.status, mode: m.mode });
  }

  // бегущая строка: итоги вечера и архива
  const done = demo().filter((m) => m.status === 'finished').sort(byTime);
  const arch = store.matches().filter((m) => m.dataset === 'archive' && /финал/i.test(m.stage) && !/1\/2/.test(m.stage));
  const items = [...done, ...arch].map((m) => {
    const v = store.view(m.id);
    const w = v?.winner;
    const a = pairNames(m.pairs[0]), b = pairNames(m.pairs[1]);
    const head = m.dataset === 'demo' ? `${courtLabel(m) || ''} · ${m.stage}` : `${m.tournament?.name} · ${m.stage}`;
    return `<li class="ticker__item"><b>${esc(head)}</b><span class="${w === 0 ? 'is-w' : ''}">${esc(a)}</span><span class="num">${esc(scoreWords(v))}</span><span class="${w === 1 ? 'is-w' : ''}">${esc(b)}</span></li>`;
  });
  if (items.length) {
    const list = (hidden) => `<ul class="ticker__list"${hidden ? ' aria-hidden="true"' : ''}>${items.join('')}</ul>`;
    el.insertAdjacentHTML('beforeend', `<div class="ticker av__ticker"><span class="ticker__label">Итоги</span><div class="ticker__viewport"><div class="ticker__track">${list(false)}${list(true)}</div></div></div>`);
  }

  // раскладка плиток: столько колонок, чтобы плитка вышла крупнее всего
  function layout() {
    const n = tiles.size;
    if (!n || !grid.isConnected) return;
    const W = grid.clientWidth, H = grid.clientHeight;
    const gap = Math.max(8, Math.min(W, H) * 0.018);
    // узкий экран (телефон): плитки в одну колонку своей высоты, сетка прокручивается — текст не мельчит
    const list = W < 600;
    grid.classList.toggle('is-list', list);
    if (list) {
      for (const { tile } of tiles.values()) { tile.classList.remove('tile--row'); tile.style.removeProperty('--tfit'); }
      grid.style.setProperty('--gap', `${gap}px`);
      grid.style.setProperty('--tile-w', `${Math.floor(W)}px`);
      grid.style.setProperty('--tile-fs', `${Math.max(16, Math.min(W / 14.6, 40)).toFixed(1)}px`);
      for (const { tile } of tiles.values()) { fitNames(tile, '--tfit'); ballSizes(tile); }
      return;
    }
    // два вида плитки: «столбик» (шапка над плашками) и «строка» (шапка слева от плашек)
    const KINDS = [{ row: false, TW: 14.6, TH: 9.9 }, { row: true, TW: 21.5, TH: 6.9 }];
    let best = null;
    for (const k of KINDS) {
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const tw = (W - gap * (cols - 1)) / cols;
        const th = (H - gap * (rows - 1)) / rows;
        const fs = Math.min(tw / k.TW, th / k.TH);
        if (!best || fs > best.fs * 1.02) best = { cols, rows, tw, th, fs, row: k.row };
      }
    }
    for (const { tile } of tiles.values()) tile.classList.toggle('tile--row', best.row);
    grid.style.setProperty('--gap', `${gap}px`);
    grid.style.setProperty('--tile-w', `${Math.floor(best.tw)}px`);
    grid.style.setProperty('--tile-h', `${Math.floor(best.th)}px`);
    grid.style.setProperty('--tile-fs', `${Math.max(10, Math.min(best.fs, 120)).toFixed(1)}px`);
    for (const { tile } of tiles.values()) fitBox(tile, '--tfit');
  }

  return {
    el,
    fit() { layout(); },
    update(cid) {
      const now = COURTS.map(courtMatch).filter(Boolean).map((m) => m.id);
      if (now.join() !== shown.map((m) => m.id).join()) return false;
      const rec = tiles.get(cid);
      if (!rec) return true;
      const nm = store.match(cid);
      if (!nm || nm.status !== rec.status || nm.mode !== rec.mode) return false;
      const nv = store.view(cid);
      rec.plates.forEach((p, side) => updatePairPlate(p, scoreOpts(nm, nv, side)));
      rec.tile.querySelector('.tile__state').innerHTML = stateHTML(stateOf(nm, nv));
      return true;
    },
  };
}

/* ---------------------------------------------------------------- LED-полоса: одна строка */

function stripLineHTML(m) {
  const v = store.view(m.id);
  const court = (m.court ? courtShort(m.court) : m.tournament?.name || '').toUpperCase();
  const side = (s) => {
    const pid = m.pairs[s];
    const ps = playersOf(pid);
    const ball = pairBall3dHTML(ps[0]?.kpr ?? null, ps[1]?.kpr ?? null, { size: 64, decorative: true, sizes: '160px' });
    const cls = v?.finished && (v.winner === 0 || v.winner === 1) ? (v.winner === s ? ' is-w' : ' is-l') : '';
    const serve = m.status === 'live' && v?.server === s ? '<span class="serve-dot" role="img" aria-label="Подают"></span>' : '';
    return `<span class="sl__pair${cls}">${s === 0 ? serve : ''}<span class="sl__ball">${ball}</span>${esc(pairNames(pid))}${s === 1 ? serve : ''}</span>`;
  };
  let mid, tail;
  if (m.status === 'upcoming') {
    mid = '<b class="sl__vs">—</b>';
    tail = `НАЧАЛО В ${esc(m.scheduled || '—')}`;
  } else if (onlyFinal(m, v)) {
    mid = '<b class="sl__vs">—</b>';
    tail = 'ИТОГ ПОСЛЕ МАТЧА';
  } else {
    mid = `<b class="sl__score num">${v.games[0]} — ${v.games[1]}</b>`;
    if (v.outcome === 'walkover') tail = 'НЕЯВКА';
    else if (v.outcome && v.outcome !== 'played') tail = esc(String(v.outcomeText || v.label || 'ИТОГ').toUpperCase());
    else if (v.finished) tail = `ИТОГ${v.tiebreak ? ` · ТАЙ-БРЕЙК ${v.tiebreak[0]}:${v.tiebreak[1]}` : ''}`;
    else if (v.inTiebreak && v.tiebreak) tail = `ТАЙ-БРЕЙК <span class="num">${v.tiebreak[0]}:${v.tiebreak[1]}</span>`;
    else if (v.points) tail = `<span class="num">${esc(v.points[0])}:${esc(v.points[1])}</span>`;
    else tail = m.mode === 'games' ? 'ПО ГЕЙМАМ' : '';
    if (!v.finished && v.decidingPoint) tail += ' · РЕШАЮЩЕЕ';
    else if (!v.finished && (v.matchPoint === 0 || v.matchPoint === 1)) tail += ' · МАТЧБОЛ';
  }
  const live = m.status === 'live' ? '<span class="sl__live" aria-label="Идёт матч"></span>' : '';
  return `${live}<span class="sl__court">${esc(court)}</span><span class="sl__sep">·</span>${side(0)}${mid}${side(1)}${tail ? `<span class="sl__sep">·</span><span class="sl__tail">${tail}</span>` : ''}`;
}

// строка для полосы; если матчей несколько — по кругу
function stripComp(listFn, dur) {
  const el = document.createElement('section');
  el.className = 'sv';
  el.innerHTML = `<p class="sl" aria-live="off"></p>${dur ? '<span class="sv__count cap"></span>' : ''}<span class="tag tag--demo sv__demo">Демо-данные</span>`;
  const line = el.querySelector('.sl');
  let idx = 0, timer = null, cur = null;

  function fitLine() {
    if (!line.isConnected) return;
    let fs = el.clientHeight * 0.34;
    line.style.fontSize = `${fs}px`;
    for (let i = 0; i < 40 && line.scrollWidth > line.clientWidth + 1 && fs > 12; i++) {
      fs *= 0.95;
      line.style.fontSize = `${fs}px`;
    }
  }
  function show() {
    const ids = listFn();
    if (!ids.length) { line.textContent = 'Матчей нет'; return; }
    idx %= ids.length;
    cur = ids[idx];
    const m = store.match(cur);
    line.dataset.status = m.status;
    line.innerHTML = stripLineHTML(m);
    line.classList.remove('is-in'); void line.offsetWidth; line.classList.add('is-in');
    const c = el.querySelector('.sv__count');
    if (c) c.textContent = `${idx + 1} / ${ids.length}`;
    fitLine();
  }
  function tick() {
    idx++;
    show();
    progress(dur);
    timer = setTimeout(tick, dur);
  }
  show();
  if (dur) { progress(dur); timer = setTimeout(tick, dur); }
  return {
    el,
    fit() { fitLine(); },
    update(cid) {
      if (cid && cid !== cur) return true;
      const m = store.match(cur);
      if (!m) return false;
      line.dataset.status = m.status;
      line.innerHTML = stripLineHTML(m);
      fitLine();
      return true;
    },
    destroy() { clearTimeout(timer); },
  };
}

/* ---------------------------------------------------------------- вид «по кругу» */

function autoComp() {
  const el = document.createElement('div');
  el.className = 'auto';
  let inner = null, step = -1, timer = null, seq = [];

  const buildSeq = () => {
    const next = nextUpcoming();
    return [{ kind: 'all', dur: DUR.all }, ...liveIds().map((id) => ({ kind: 'court', id, dur: DUR.court })), ...(next ? [{ kind: 'court', id: next.id, dur: DUR.next }] : [])];
  };
  function mount(s) {
    inner?.destroy?.();
    inner = s.kind === 'all' ? allComp() : courtComp(s.id);
    inner.el.classList.add('bd-in');
    el.replaceChildren(inner.el);
    inner.fit?.();
    setNowLabel(s);
  }
  function advance() {
    if (step < 0 || step >= seq.length - 1) { seq = buildSeq(); step = 0; } else step++;
    const s = seq[step];
    mount(s);
    progress(s.dur);
    clearTimeout(timer);
    timer = setTimeout(advance, s.dur);
  }
  function setNowLabel(s) {
    const n = seq[step + 1] || buildSeq()[0];
    const name = (x) => (x.kind === 'all' ? 'все корты' : (() => { const m = store.match(x.id); return m ? `${courtLabel(m) || ''} · ${m.stage}` : ''; })());
    el.dataset.next = n ? `Далее: ${name(n)}` : '';
  }
  // полоса: вместо экранов — строки по кругу
  if (SHAPE === 'strip') {
    const sc = stripComp(() => { const n = nextUpcoming(); const l = liveIds(); return n ? [...l, n.id] : l.length ? l : courtIds(); }, DUR.strip);
    return sc;
  }
  advance();
  return {
    el,
    fit() { inner?.fit?.(); },
    update(cid) {
      if (!inner) return true;
      if (inner.update(cid) === false) mount(seq[step]);
      return true;
    },
    destroy() { clearTimeout(timer); inner?.destroy?.(); },
  };
}

function emptyComp(text) {
  const el = document.createElement('section');
  el.className = 'bd__empty';
  el.innerHTML = `<p>${esc(text)}</p>`;
  return { el, update: () => true };
}

/* ---------------------------------------------------------------- полоска хода по кругу */

const progEl = $('progress');
let progAnim = null;
function progress(dur) {
  progAnim?.cancel();
  progEl.hidden = !dur;
  if (!dur || reduced.matches) return;
  const bar = progEl.firstElementChild;
  progAnim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: dur, easing: 'linear', fill: 'forwards' });
}

/* ---------------------------------------------------------------- отрисовка */

let comp = null;
function render() {
  comp?.destroy?.();
  progress(0);
  SHAPE = calcShape();
  root.dataset.shape = SHAPE;
  root.dataset.view = VIEW;
  if (VIEW === 'court' && !M) M = defaultMatch();
  comp = VIEW === 'court' ? courtComp(M)
    : VIEW === 'all' ? (SHAPE === 'strip' ? stripComp(courtIds, DUR.strip) : allComp())
      : autoComp();
  screen.replaceChildren(comp.el);
  missNotice();
  comp.fit?.();
  setTimeout(refit, 700);
  syncControls();
}

// неизвестный матч в адресе: заметная строка над шапкой, пока не выбран другой матч
function missNotice() {
  if (!MISSING || VIEW !== 'court' || !comp?.el) return;
  const m = store.match(M);
  const shown = m ? [courtLabel(m), m.stage].filter(Boolean).join(' · ') : 'матч по умолчанию';
  const p = document.createElement('p');
  p.className = 'bd-miss';
  p.setAttribute('role', 'status');
  p.textContent = `Матча «${MISSING}» нет в данных прототипа. Показан: ${shown}`;
  const head = comp.el.querySelector('.vhead');
  if (head) head.prepend(p); else comp.el.append(p);
}

let fitRaf = 0;
const refit = () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => comp?.fit?.()); };
new ResizeObserver(() => {
  if (calcShape() !== SHAPE) render();
  else refit();
}).observe(screen);
document.fonts?.ready.then(refit);
// портреты и шрифты догружаются — перепроверить, что всё влезло
addEventListener('load', refit);
document.addEventListener('load', (e) => { if (e.target?.tagName === 'IMG') refit(); }, true);

let lastChange = Date.now();
store.subscribe(({ id }) => {
  lastChange = Date.now();
  tickClock();
  if (comp && comp.update(id) === false) render();
  else refit();
  syncControls();
});

/* ---------------------------------------------------------------- часы и «обновлено» */

const clockEl = $('clock');
function tickClock() {
  const d = new Date();
  $('clock-time').textContent = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const s = Math.round((Date.now() - lastChange) / 1000);
  $('clock-upd').textContent = s < 10 ? 'обновлено только что' : s < 60 ? `обновлено ${s} с назад` : `обновлено ${Math.floor(s / 60)} мин назад`;
}
setInterval(() => { tickClock(); syncDemoBtn(); }, 1000);
tickClock();
new ResizeObserver(() => {
  root.style.setProperty('--clock-space', `${clockEl.offsetWidth + 16}px`);
  root.style.setProperty('--clock-h', `${clockEl.offsetHeight}px`);
}).observe(clockEl);

/* ---------------------------------------------------------------- управление */

const ctrl = $('ctrl');
const pick = $('pick');
const btnDemo = $('btn-demo');
const btnFs = $('btn-fs');

(function fillPick() {
  const opt = (m, label) => `<option value="${esc(m.id)}">${esc(label)}</option>`;
  const d = demo().sort((a, b) => COURTS.indexOf(a.court) - COURTS.indexOf(b.court) || byTime(a, b));
  const a = store.matches().filter((m) => m.dataset === 'archive');
  pick.innerHTML = `<optgroup label="Демо-вечер">${d.map((m) => opt(m, `${courtLabel(m)} · ${m.stage} · ${m.scheduled || ''}`)).join('')}</optgroup>`
    + (a.length ? `<optgroup label="Архив">${a.map((m) => opt(m, `${m.tournament?.name} · ${m.stage}`)).join('')}</optgroup>` : '');
})();

function demoTargets() {
  if (VIEW === 'court') {
    const m = store.match(M || defaultMatch());
    return m && m.dataset === 'demo' ? [m.id] : [];
  }
  return demo().filter((m) => m.status !== 'finished').map((m) => m.id);
}
// матч держит судья из другой вкладки: автоигра и сброс его не трогают
const judged = (id) => !!store.isClaimedByOther?.(id);
function syncDemoBtn() {
  const all = demoTargets();
  const t = all.filter((id) => !judged(id));
  const playing = t.some((id) => store.isAutoplaying?.(id));
  const finishedOnly = VIEW === 'court' && t.length && store.match(t[0])?.status === 'finished';
  btnDemo.disabled = !t.length;
  const text = !t.length ? (all.length ? 'Матч ведёт судья' : VIEW === 'court' ? 'Архив: только итог' : 'Все матчи сыграны')
    : playing ? 'Остановить демо' : finishedOnly ? 'Сыграть матч заново' : VIEW === 'court' ? 'Запустить демо-матч' : 'Запустить демо-матчи';
  if (btnDemo.textContent !== text) btnDemo.textContent = text;
}
function syncControls() {
  for (const b of ctrl.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === VIEW));
  const cur = M || defaultMatch();
  if (cur && pick.value !== cur) pick.value = cur;
  syncDemoBtn();
}
// подсказка панели: по умолчанию — как вернуть панель; на время — ответ на нажатие
const coarse = matchMedia('(pointer: coarse)');
const idleHint = () => (coarse.matches ? 'Панель спрячется сама. Коснитесь экрана, чтобы вернуть.' : 'Панель спрячется сама. Двиньте мышью, чтобы вернуть.');
let hintTimer = 0;
function say(text) {
  const h = $('ctrl-hint');
  clearTimeout(hintTimer);
  h.textContent = text || idleHint();
  h.classList.toggle('is-say', !!text);
  hintTimer = text ? setTimeout(() => say(''), 8000) : 0;
}
say('');
coarse.addEventListener?.('change', () => { if (!hintTimer) say(''); });
const matchName = (id) => { const m = store.match(id); return m ? [courtLabel(m), m.stage].filter(Boolean).join(' · ') : id; };
function setURL() {
  const p = new URLSearchParams();
  p.set('view', VIEW);
  if (VIEW === 'court' && M) p.set('m', M);
  try { history.replaceState(null, '', `${location.pathname}?${p}`); } catch { /* file:// и песочницы */ }
}

ctrl.addEventListener('click', async (e) => {
  const vb = e.target.closest('.seg__btn[data-view]');
  if (vb) { VIEW = vb.dataset.view; setURL(); render(); return; }
  if (e.target.closest('#btn-demo')) {
    const all = demoTargets();
    const t = all.filter((id) => !judged(id));
    const playing = t.some((id) => store.isAutoplaying?.(id));
    const busy = all.filter(judged);
    for (const id of t) {
      if (playing) { store.stopAutoplay(id); continue; }
      if (store.match(id)?.status === 'finished') {
        const rr = store.tryReset(id);
        if (!rr.accepted && rr.reason === 'claimed') { busy.push(id); continue; }
      }
      const r = store.tryAutoplay(id, { speed: SPEED });
      if (!r.accepted && r.reason === 'claimed') busy.push(id);
    }
    if (busy.length) say(`${reasonText('claimed')}: ${busy.map(matchName).join(', ')} — автоигра его не трогает.`);
    syncControls();
    return;
  }
  if (e.target.closest('#btn-reset')) {
    if (!confirm('Вернуть демо-вечер к началу? Счёт всех демо-матчей сотрётся. Матч, который ведёт судья, останется как есть.')) return;
    for (const m of demo()) if (!judged(m.id)) store.stopAutoplay(m.id);
    const { skipped = [] } = store.resetAll() || {};
    render();
    say(skipped.length ? `Демо-вечер сброшен. ${reasonText('claimed')}: ${skipped.map(matchName).join(', ')} — не сброшен.` : 'Демо-вечер сброшен.');
    return;
  }
  if (e.target.closest('#btn-fs')) {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.requestFullscreen) await root.requestFullscreen();
      else throw new Error('нет полноэкранного режима');
    } catch {
      say('Браузер не дал включить полный экран. Попробуйте клавишу F11.');
    }
  }
});
pick.addEventListener('change', () => { M = pick.value; MISSING = null; VIEW = 'court'; setURL(); render(); });
document.addEventListener('fullscreenchange', () => { btnFs.textContent = document.fullscreenElement ? 'Выйти из полного экрана' : 'На весь экран'; });

// панель и полоска прототипа прячутся без движения мыши
let idleTimer = 0;
function wake() {
  root.classList.remove('is-idle');
  bar.show?.();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(sleep, 3500);
}
function sleep() {
  if (ctrl.matches(':focus-within') && document.activeElement?.matches(':focus-visible')) { idleTimer = setTimeout(sleep, 3500); return; }
  if (ctrl.matches(':hover') || bar.matches?.(':hover') || bar.contains?.(document.activeElement) || bar.querySelector?.('.protobar__menu:not([hidden])')) { idleTimer = setTimeout(sleep, 3500); return; }
  root.classList.add('is-idle');
  bar.hide?.();
}
// полоска сама просыпается и от «пустых» pointermove после перестройки страницы — их табло не считает движением
bar.addEventListener?.('protobar:toggle', (e) => {
  if (!e.detail?.hidden) setTimeout(() => { if (root.classList.contains('is-idle')) bar.hide?.(); }, 0);
});
// браузер шлёт «пустые» mousemove после перестройки страницы — их не считаем движением
let lastXY = '';
addEventListener('mousemove', (e) => {
  const xy = `${e.screenX},${e.screenY}`;
  if (xy === lastXY) return;
  lastXY = xy;
  wake();
}, { passive: true });
for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) addEventListener(ev, wake, { passive: true });
document.addEventListener('focusin', wake);

render();
wake();
