// Афиша матча TLTS: вход «влёт — столкновение — VS», живой счёт, сравнение пар, другие матчи.
// Данные — только core/data.js и хранилище core/store.js; карточки, плашки и мячи — только core/card.js.

import { createStore } from './core/store.js';
import { pairOf, playersOfPair, rankA, rankB } from './core/data.js';
import { playerCardHTML, playerCard, pairPlate, updatePairPlate, pairBallHTML, pairBall3dHTML, pipsHTML } from './core/card.js';
import { mountProtoBar } from './core/protobar.js';
import { role as idRole, me as idMe, onIdentityChange } from './core/identity.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватное окно */ } },
};

const store = createStore();
const params = new URLSearchParams(location.search);
const DEFAULT_ID = 'm-demo-final';
const RAW_ID = params.get('m');
const ID = RAW_ID && store.match(RAW_ID) ? RAW_ID : DEFAULT_ID;
const MISSING = RAW_ID && ID !== RAW_ID ? RAW_ID : null;   // в адресе неизвестный матч — показан финал
// «Я» и роль — из core/identity.js: «вы здесь» видит только роль «Игрок»; меняются без перезагрузки
let ME = idMe();
let ROLE = idRole();
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FREEZE = params.has('freeze') ? Math.max(0, Number(params.get('freeze')) || 0) : null;
const NO_INTRO = params.get('intro') === 'off';
// полный вход — при первом открытии этого матча за сеанс; дальше сразу готовая афиша («Повторить» остаётся)
const SEEN_KEY = `tlts-match-seen:${ID}`;
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* приватное окно */ } },
};
const SEEN = ss.get(SEEN_KEY) === '1';

let M = store.match(ID);
const PAIRS = M.pairs.map((id) => pairOf(id));
const PLAYERS = M.pairs.map((id) => playersOfPair(id));
const IS_DEMO = M.dataset === 'demo';
const sideOfMe = () => (ME ? PLAYERS.findIndex((ps) => ps.some((p) => p && p.id === ME)) : -1);
let MY_SIDE = sideOfMe();

mountProtoBar({ current: 'match', demo: IS_DEMO });

/* ------------------------------------------------------------------ форматирование */

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function fmtDate(iso, { year = true } = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '[ДАТА]';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}${year ? ` ${m[1]}` : ''}`;
}
const kprT = (k) => (typeof k === 'number' ? k.toFixed(1) : null);
const lastNames = (ps) => ps.map((p) => p?.last || '—');
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
function formatText(f) {
  const n = f?.gamesToWin || 6;
  // тай-брейк в коротком сете регламент не описывает — не подаём его как правило
  const base = n === 6 ? 'Один сет до 6 геймов · при 6:6 тай-брейк' : `Сокращённый сет до ${n} геймов · тай-брейк при ${n}:${n} — уточняется у лиги`;
  return base + (f?.deuce === 'deciding' ? ' · решающее очко при «ровно»' : '');
}
const STAGE_ORDER = { 'Финал': 0, 'Матч за 3-е место': 1, '1/2 финала': 2 };

/* ------------------------------------------------------------------ мяч пары крупно */

function bigBallHTML(ps, side) {
  const ks = ps.map((p) => p?.kpr);
  const label = `Мяч пары, КПР ${ks.map((k) => kprT(k) || '—').join(' и ')}`;
  // 3D-рендер из основы; если уровня нет в шкале или картинка не загрузилась, основа сама ставит SVG-мяч
  return `<span class="mx-ball-box" data-side="${side}">${pairBall3dHTML(ks[0] ?? null, ks.length > 1 ? ks[1] ?? '' : null, { size: 132, label, className: 'mx-ball', sizes: '(min-width: 700px) 140px, 84px' })}</span>`;
}

/* ------------------------------------------------------------------ афиша */

// ярлык состояния по словарю (core/LOOK.md): «Скоро · 18:30», LIVE, «Завершён»; у остановленного матча — «Прерван»
const statusTag = (m, v = m && m.id ? store.view(m.id) : null) => {
  if (m.status === 'live') return '<span class="tag tag--live">LIVE</span>';
  if (m.status === 'finished') return v && v.outcome === 'stopped' ? '<span class="tag tag--soon">Прерван</span>' : '<span class="tag tag--done">Завершён</span>';
  return `<span class="tag tag--soon">Скоро${m.scheduled ? ` · ${esc(m.scheduled)}` : ''}</span>`;
};
// досрочный исход: неявка, снятие, прерван — подпись готова в движке
const earlyOutcome = (v) => !!(v && v.outcome && v.outcome !== 'played');
function cardState(side, v, m) {
  if (m.status !== 'finished' || !v || !v.finished || (v.winner !== 0 && v.winner !== 1)) return null;
  return v.winner === side ? 'winner' : 'loser';
}
// ранг на афише — вариант А: КПР, места Бета и Альфа, титулы (как «рекорд» боксёра)
const cardOpts = (p, toward, state) => ({
  size: 'xl', toward, rank: 'A', state,
  href: p?.id ? `player.html?p=${encodeURIComponent(p.id)}` : undefined,
});
function sideHTML(side, v) {
  const ps = PLAYERS[side], pair = PAIRS[side];
  const toward = side === 0 ? 'right' : 'left';
  const state = cardState(side, v, M);
  const sum = kprT(pair?.kprSum);
  const parts = [ps.map((p) => kprT(p?.kpr) || '—').join(' + ')];
  if (pair?.seed) parts.push(`посев ${pair.seed}`);
  const you = side === MY_SIDE ? '<span class="tag tag--you mx-you">Ваша пара</span>' : '';
  return `<div class="poster__side" data-side="${side}">`
    + ps.map((p) => playerCardHTML(p, cardOpts(p, toward, state))).join('')
    + `<p class="poster__pair mx-pair" data-side="${side}">${bigBallHTML(ps, side)}`
    + `<span class="poster__pair-text mx-pair__text"><span class="poster__pair-sum">${sum ? `КПР пары ${sum}` : 'КПР пары —'}</span>`
    + `<span class="cap">${esc(parts.join(' · '))}</span>${you}</span>`
    + `<span class="poster__pair-names mx-pair__names">${lastNames(ps).map(esc).join('<br>')}</span></p>`
    + '</div>';
}
function renderPoster() {
  const v = store.view(ID);
  const t = M.tournament || {};
  const where = [M.court, t.venue, fmtDate(t.date)].filter(Boolean).join(' · ');
  const tags = [statusTag(M, v), M.stage ? `<span class="tag tag--gm">${esc(M.stage)}</span>` : '', M.category ? `<span class="tag tag--gm">${esc(M.category)}</span>` : ''].join('');
  $('poster').innerHTML = `
    <header class="poster__head mx-head">
      <p class="poster__tags" id="mx-tags">${tags}</p>
      <h1 class="poster__title" id="mx-title">${esc(t.name || 'TS CUP')}</h1>
      <p class="cap">${esc(where)}${M.scheduled ? ` · ${esc(M.scheduled)}` : ''}</p>
    </header>
    <div class="poster__stage mx-stage">
      ${sideHTML(0, v)}
      <p class="poster__vs mx-vs"><span class="poster__vs-mark" aria-hidden="true">VS</span><span class="vh">против</span></p>
      ${sideHTML(1, v)}
    </div>
    <footer class="poster__foot mx-foot"><span class="cap">${M.category === 'Grand Masters' ? 'Grand Masters — высшая категория · ' : M.category === 'Masters' ? 'Masters — вторая категория · ' : ''}${esc(formatText(M.format))}</span>${IS_DEMO ? '<span class="tag tag--demo">Демо-данные</span>' : '<span class="cap">Архив лиги · настоящие данные</span>'}</footer>`;
  $('mx-crumb').textContent = IS_DEMO ? 'Афиша матча · демо-вечер' : 'Афиша матча · архив лиги';
  if (MISSING) {
    const n = $('mx-missing');
    n.hidden = false;
    n.innerHTML = `Такого матча нет${MISSING.length <= 40 ? ` («${esc(MISSING)}»)` : ''}, показан финал демо-вечера. <a href="#mx-other-h">Другие матчи</a>`;
  }
  document.title = `${M.stage || 'Матч'} · ${lastNames(PLAYERS[0]).join('/')} — ${lastNames(PLAYERS[1]).join('/')} · TLTS`;
}
let lastCardKey = null;
function refreshCards() {
  const v = store.view(ID);
  const key = [cardState(0, v, M), cardState(1, v, M)].join('|');
  if (key === lastCardKey) return;
  lastCardKey = key;
  for (const side of [0, 1]) {
    const toward = side === 0 ? 'right' : 'left';
    const state = cardState(side, v, M);
    const cards = $('poster').querySelectorAll(`.poster__side[data-side="${side}"] > .pcard`);
    cards.forEach((el, i) => { const p = PLAYERS[side][i]; el.replaceWith(playerCard(p, cardOpts(p, toward, state))); });
  }
  $('mx-tags').firstElementChild.outerHTML = statusTag(M, v);
}
function refreshTags() {
  const el = $('mx-tags')?.firstElementChild;
  const html = statusTag(M);
  if (el && el.outerHTML !== html) el.outerHTML = html;
}

/* ------------------------------------------------------------------ счёт под афишей */

let plates = [];
function renderScoreShell() {
  const s = $('score');
  s.insertAdjacentHTML('beforeend', `
    <div class="mx-score__head"><span id="mx-st"></span><span id="mx-label"></span><span class="cap mx-score__meta" id="mx-meta"></span></div>
    <div class="mx-up" id="mx-up" hidden>
      <p class="mx-up__when"><span class="air-type">${M.scheduled ? `Начало в ${esc(M.scheduled)}` : 'Время уточняется'}</span>${M.court ? `<span class="mx-up__court">${esc(M.court)}</span>` : ''}</p>
      <div class="mx-up__act" id="mx-remind-box"></div>
      <p class="cap mx-up__wait">Счёт появится здесь, когда судья начнёт матч.</p>
    </div>
    <div class="mx-live" id="mx-live" hidden>
      <div class="mx-big" id="mx-big" aria-hidden="true"></div>
      <div class="mx-plates" id="mx-plates"></div>
    </div>
    <div class="mx-feedbox" id="mx-feedbox" hidden>
      <p class="cap mx-feedbox__h" id="mx-feed-h">Геймы по порядку</p>
      <div class="mx-feed" id="mx-feed" role="table" aria-labelledby="mx-feed-h"></div>
    </div>
    <p class="cap mx-note" id="mx-note" hidden></p>
    <p class="vh" id="mx-say" aria-live="polite"></p>`);
  const v = store.view(ID);
  plates = [0, 1].map((side) => pairPlate(PAIRS[side], PLAYERS[side], { size: 'lg', ...plateOpts(M, v, side) }));
  plates.forEach((el) => $('mx-plates').append(el));
  markPlates();
  renderRemind();
}
const markPlates = () => plates.forEach((el, side) => el.classList.toggle('mx-plate-you', side === MY_SIDE));
// «Напомнить» — макет
function renderRemind() {
  const box = $('mx-remind-box');
  if (!box) return;
  if (ROLE === 'guest') {
    box.innerHTML = '<p class="cap">Войдите как игрок, чтобы получить напоминание.</p>';
  } else {
    box.innerHTML = '<button type="button" class="btn btn--secondary btn--sm" id="mx-remind" aria-pressed="false">'
      + '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8 2.2a3.8 3.8 0 0 0-3.8 3.8v2.6L3 10.8h10l-1.2-2.2V6A3.8 3.8 0 0 0 8 2.2Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.4 12.6a1.7 1.7 0 0 0 3.2 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
      + '<span>Напомнить</span></button><span class="cap" id="mx-remind-note" hidden>Напомним за 30 минут до начала · макет</span>';
    $('mx-remind').addEventListener('click', (e) => {
      const b = e.currentTarget;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('span').textContent = on ? 'Напоминание стоит' : 'Напомнить';
      $('mx-remind-note').hidden = !on;
    });
  }
}

// «только итог»: пока матч идёт, счёта нет — ни нулей, ни подачи (как на табло)
const onlyFinal = (m, v) => m?.mode === 'final' && m?.status === 'live' && !v?.finished;
const plateOpts = (m, v, side) => (onlyFinal(m, v) ? { score: null, view: null, side, serving: false, winner: undefined } : { view: v, side });
function bigScoreHTML(v) {
  const [a, b] = v.games;
  // у прерванного матча победителя нет — никого не приглушаем
  const lead = a === b || (v.finished && v.winner !== 0 && v.winner !== 1) ? -1 : a > b ? 0 : 1;
  let pts = '';
  // очки тай-брейка — цифрами (рядом ярлык «Тай-брейк»); итог тай-брейка словами — в подписи над счётом
  if (!v.finished) {
    if (v.inTiebreak && v.tiebreak) pts = `${v.tiebreak[0]}:${v.tiebreak[1]}`;
    else if (v.points) pts = `${v.points[0]}:${v.points[1]}`;
  }
  return `<span class="bigscore"><span class="bigscore__n${lead === 1 ? ' is-trail' : ''}">${a}</span><span class="bigscore__sep">:</span>`
    + `<span class="bigscore__n${lead === 0 ? ' is-trail' : ''}">${b}</span>${pts ? `<span class="bigscore__pts">${esc(pts)}</span>` : ''}</span>`;
}
// лента геймов: две строки, по одной на пару — понятно и без мячей (у пар одного уровня мячи одинаковые)
function feedHTML(log) {
  const run = [0, 0];
  const cells = [[], []];
  const head = [];
  for (const g of log) {
    const w = g.winner === 1 ? 1 : 0;
    run[w] += 1;
    const tb = Array.isArray(g.tiebreak) ? g.tiebreak : null;
    const pen = g.penaltyKind === 'game' ? 'штрафной гейм' : g.penaltyKind === 'point' ? 'было штрафное очко' : '';
    const who = lastNames(PLAYERS[w]).join(' и ');
    const said = `Гейм ${g.n}: ${who}${tb ? `, тай-брейк ${tb[0]}:${tb[1]}` : ''}${pen ? `, ${pen}` : ''}, счёт ${run[0]}:${run[1]}`;
    head.push(`<span class="mx-feed__n${tb ? ' is-tb' : ''}" role="columnheader">${tb ? `<span aria-hidden="true">${g.n}</span><span class="vh">гейм ${g.n}, тай-брейк</span>` : g.n}</span>`);
    for (const side of [0, 1]) {
      cells[side].push(side === w
        ? `<span class="mx-feed__c is-w${pen ? ' is-pen' : ''}" role="cell" title="${esc(said)}"><span aria-hidden="true">${tb ? `${tb[side]}:${tb[1 - side]}` : run[side]}</span><span class="vh">${esc(said)}</span></span>`
        : '<span class="mx-feed__c" role="cell"></span>');
    }
  }
  const rowHTML = (side) => {
    const ps = PLAYERS[side];
    return `<div class="mx-feed__row${side === MY_SIDE ? ' is-you' : ''}" role="row">`
      + `<span class="mx-feed__who" role="rowheader">${pairBallHTML(ps[0]?.kpr ?? null, ps[1]?.kpr ?? '', { size: 18, decorative: true })}<span class="mx-feed__names">${lastNames(ps).map(esc).join('<br>')}</span></span>`
      + cells[side].join('') + '</div>';
  };
  return `<div class="mx-feed__grid" style="--n:${log.length}"><div class="mx-feed__row mx-feed__row--head" role="row"><span class="mx-feed__who" role="columnheader"><span class="vh">Пара</span></span>${head.join('')}</div>${rowHTML(0)}${rowHTML(1)}</div>`;
}
let lastSeqLen = -1;
function updateScore() {
  M = store.match(ID);
  const v = store.view(ID);
  const st = M.status;
  const early = st === 'finished' && earlyOutcome(v);
  // досрочный исход: вместо «Завершён» — готовая подпись движка («Неявка», «Снятие при счёте 2:1», «Прерван при 2:1»)
  $('mx-st').innerHTML = early ? `<span class="tag tag--done">${esc(v.outcomeText)}</span>` : statusTag(M, v);
  $('mx-up').hidden = st !== 'upcoming';
  $('mx-live').hidden = st === 'upcoming';
  // ярлык момента: «Ровно», «Решающее очко», «Тай-брейк», матчбол
  let label = '';
  if (st === 'live') {
    if (v.label) label = `<span class="tag ${v.decidingPoint ? 'tag--moment' : 'tag--soon'}">${esc(v.label)}</span>`;
    if (v.matchPoint === 0 || v.matchPoint === 1) label += `<span class="tag tag--moment">Матчбол · ${esc(lastNames(PLAYERS[v.matchPoint]).join('/'))}</span>`;
  }
  $('mx-label').innerHTML = label;
  const meta = st === 'live'
    ? (M.mode === 'games' ? 'Счёт обновляется после каждого гейма' : M.mode === 'final' ? 'Судья внесёт итог после матча' : 'Счёт по очкам · обновляется после каждого розыгрыша')
    : st === 'finished' ? (early ? (v.outcome === 'stopped' ? 'Счёт на момент остановки' : 'Итог по регламенту — поражение без счёта')
      : `Итоговый счёт${v.tiebreak ? ` · ${v.scoreLong}` : ''}${M.finishedAt ? '' : ` · ${fmtDate(M.tournament?.date)}`}`) : '';
  $('mx-meta').textContent = meta;
  if (st !== 'upcoming') $('mx-big').innerHTML = onlyFinal(M, v) ? '<span class="mx-big__wait air-type">Итог после матча</span>' : bigScoreHTML(v);
  plates.forEach((el, side) => updatePairPlate(el, plateOpts(M, v, side)));
  // лента геймов
  const log = st === 'upcoming' || v.outcome === 'walkover' ? [] : (v.gameLog || []);
  $('mx-feedbox').hidden = !log.length;
  const feedKey = log.length + '|' + MY_SIDE + '|' + (log.length ? JSON.stringify(log[log.length - 1]) : '');
  if (feedKey !== lastSeqLen) {
    const grew = typeof lastSeqLen === 'string' && log.length > Number(lastSeqLen.split('|')[0]);
    $('mx-feed').innerHTML = feedHTML(log);
    if (grew && !REDUCE) $('mx-feed').querySelectorAll('.mx-feed__row').forEach((r) => r.lastElementChild?.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' }));
    lastSeqLen = feedKey;
  }
  // подписи
  let note = '';
  if (M.dataset === 'archive') note = 'Счёт по очкам не сохранился: в архиве лиги есть только итог по геймам.';
  else if (M.note && st !== 'upcoming') note = M.note;
  if (v.outcome === 'walkover') note = `Неявка${v.walkover?.reason ? `: ${v.walkover.reason}` : ''}. По регламенту — поражение без счёта, 0:0.`;
  else if (v.outcome === 'retired') note = `Пара снялась при счёте ${v.walkover.gamesAtStop.join(':')}${v.winner === 0 || v.winner === 1 ? `, победа — ${lastNames(PLAYERS[v.winner]).join(' и ')}` : ''}. Итог по регламенту 0:0, как при неявке; правило уточняется у лиги.`;
  else if (v.outcome === 'stopped') note = `Матч прерван${v.stopped?.reason ? `: ${v.stopped.reason}` : ''}. Победителя нет, судья может продолжить матч с того же счёта.`;
  $('mx-note').textContent = note;
  $('mx-note').hidden = !note;
  // для скринридера — коротко
  const say = st === 'upcoming' ? `Матч ещё не начался${M.scheduled ? `, начало в ${M.scheduled}` : ''}.`
    : st === 'finished' ? (early ? `${v.outcomeText}.` : `Итог ${v.scoreLong}.`)
    : onlyFinal(M, v) ? 'Матч идёт, итог судья внесёт после матча.'
    : `Счёт ${v.games[0]}:${v.games[1]}${v.points ? `, в гейме ${v.points[0]}:${v.points[1]}` : ''}${v.label ? `, ${v.label}` : ''}.`;
  if ($('mx-say').textContent !== say) $('mx-say').textContent = say;
  updateTry();
}

/* ------------------------------------------------------------------ «Как попробовать вживую» */

function renderTry() {
  const judge = `judge.html?m=${encodeURIComponent(ID)}`;
  const isJudge = ['judge', 'admin', 'superadmin'].includes(ROLE);
  $('mx-try').innerHTML = `
    <div class="panel panel--pad mx-try__panel">
      <div class="mx-try__text">
        <p class="cap"><span class="tag tag--demo">Прототип</span></p>
        <h2 class="mx-try__h" id="mx-try-h">Как попробовать вживую</h2>
        <p>Откройте <a href="${judge}" target="_blank" rel="noopener">экран судьи</a> в соседней вкладке и начните этот матч: счёт, лента геймов и итог появятся здесь сами, без перезагрузки.</p>
        <p class="cap" id="mx-try-note"></p>
        <p class="mx-try__msg" id="mx-try-msg" role="status" hidden></p>
      </div>
      <div class="mx-try__act">
        <button type="button" class="btn btn--primary" id="mx-auto"><span>Сыграть демо</span></button>
        <a class="btn btn--secondary" href="${judge}" target="_blank" rel="noopener">${isJudge ? 'Вести счёт этого матча' : 'Открыть экран судьи'}</a>
        <button type="button" class="btn btn--quiet btn--sm" id="mx-reset">Вернуть матч к началу</button>
      </div>
    </div>`;
  $('mx-auto').addEventListener('click', () => {
    tryMsg('');
    if (store.isAutoplaying(ID)) store.stopAutoplay(ID);
    else {
      const r = store.tryAutoplay(ID, { speed: 3 });
      if (r.reason === 'claimed') tryMsg('Матч ведёт судья: демо не запустится, пока судья на экране счёта.');
    }
    updateTry();
  });
  $('mx-reset').addEventListener('click', () => {
    tryMsg('');
    if (store.isClaimedByOther(ID)) { tryMsg('Матч ведёт судья: вернуть его к началу можно только с экрана судьи.'); return; }
    if (M.status === 'upcoming' && !store.isAutoplaying(ID)) { tryMsg('Матч и так в начале.'); return; }
    let ok = true;
    try { ok = window.confirm('Вернуть матч к началу? Счёт и лента геймов сотрутся во всех открытых вкладках.'); } catch { ok = true; }
    if (!ok) return;
    const r = store.tryReset(ID);
    if (r.reason === 'claimed') tryMsg('Матч ведёт судья: вернуть его к началу можно только с экрана судьи.');
    else if (r.accepted) { lastSeqLen = -1; tryMsg('Матч возвращён к началу.'); }
  });
}
function tryMsg(text) {
  const el = $('mx-try-msg');
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}
function updateTry() {
  const btn = $('mx-auto');
  if (!btn) return;
  const playing = store.isAutoplaying(ID);
  const fin = M.status === 'finished';
  btn.disabled = fin && !playing;
  btn.querySelector('span').textContent = playing ? 'Остановить демо' : 'Сыграть демо';
  btn.setAttribute('aria-pressed', String(playing));
  const reset = $('mx-reset');
  reset.hidden = M.dataset !== 'demo';
  const held = store.isClaimedByOther(ID);
  $('mx-try-note').textContent = held && !fin ? 'Матч ведёт судья: счёт приходит с его экрана. «Сыграть демо» и «Вернуть матч к началу» его не трогают.'
    : fin && M.dataset === 'demo' && store.view(ID).outcome === 'stopped' ? 'Матч прерван. Судья может продолжить его с того же счёта, а «Вернуть матч к началу» начнёт заново.'
    : fin
    ? (M.dataset === 'archive' ? 'Это архивный матч: он сыгран, итог настоящий. Для живой игры откройте финал демо-вечера.' : 'Матч завершён. «Вернуть матч к началу» — и можно сыграть снова.')
    : playing ? 'Матч разыгрывается сам, примерно розыгрыш в 1–3 секунды.' : '«Сыграть демо» включает автоигру: матч разыграется сам, в ускоренном темпе.';
}

/* ------------------------------------------------------------------ сравнение пар */

function renderCompare() {
  const [L, R] = PLAYERS;
  const sumBy = (ps, f) => { const xs = ps.map(f); return xs.every((x) => typeof x === 'number') ? xs.reduce((a, b) => a + b, 0) : null; };
  const lead = (a, b, more = true) => (a == null || b == null || a === b ? [false, false] : more ? [a > b, b > a] : [a < b, b < a]);
  const cell = (html, isLead, side) => `<td class="mx-cmp__v mx-cmp__v--${side}${isLead ? ' is-lead' : ''}">${html}</td>`;
  const row = (name, a, b, leads = [false, false]) => `<tr><td class="mx-cmp__k" colspan="2">${esc(name)}</td></tr>`
    + `<tr class="mx-cmp__vals">${cell(a, leads[0], 0)}${cell(b, leads[1], 1)}</tr>`;
  const per = (ps, f) => ps.map((p) => `<span class="mx-cmp__pp"><span class="mx-cmp__who">${esc(p?.last || '—')}</span>${f(p)}</span>`).join('');
  const nd = '<span class="mx-cmp__nd">нет данных</span>';

  const kpr = PAIRS.map((p) => p?.kprSum ?? null);
  const pts = PAIRS.map((p) => p?.pointsSum ?? null);
  const titles = PLAYERS.map((ps) => sumBy(ps, (p) => rankA(p)?.titles));
  const wins = M.h2h?.wins || [0, 0];
  const rows = [];
  rows.push(row('Сумма КПР', `<b class="num">${kprT(kpr[0]) || '—'}</b>`, `<b class="num">${kprT(kpr[1]) || '—'}</b>`));
  if (PAIRS.some((p) => p?.seed)) rows.push(row('Посев', `<b class="num">${PAIRS[0]?.seed ?? '—'}</b>`, `<b class="num">${PAIRS[1]?.seed ?? '—'}</b>`, lead(PAIRS[0]?.seed, PAIRS[1]?.seed, false)));
  rows.push(row('Баллы рейтинга, сумма', `<b class="num">${pts[0] ?? '—'}</b>`, `<b class="num">${pts[1] ?? '—'}</b>`, lead(pts[0], pts[1])));
  const demoRating = PLAYERS.flat().some((p) => p?.rating?.demo);
  rows.push(row(demoRating ? 'Места в Бете — общий рейтинг лиги (демо-рейтинг)' : 'Места в Бете — общий рейтинг лиги', per(L, (p) => `<span class="num">${p?.rating?.place != null ? `№${p.rating.place}` : '—'}</span>`), per(R, (p) => `<span class="num">${p?.rating?.place != null ? `№${p.rating.place}` : '—'}</span>`)));
  rows.push(row('Титулы игроков, сумма на сегодня', `<b class="num">${titles[0] ?? '—'}</b>`, `<b class="num">${titles[1] ?? '—'}</b>`, lead(titles[0], titles[1])));
  const wl = (p) => (p?.wl?.season ? `<span class="num">${p.wl.season[0]}–${p.wl.season[1]}</span>` : nd);
  rows.push(row('Сезон: победы – поражения', per(L, wl), per(R, wl)));
  const form = (p) => (Array.isArray(p?.form) && p.form.length
    ? `<span class="wl" role="img" aria-label="Последние матчи: ${p.form.map((x) => (x === 'W' ? 'победа' : 'поражение')).join(', ')}">${p.form.map((x) => (x === 'W' ? '<i class="w">В</i>' : '<i class="l">П</i>')).join('')}</span>`
    : nd);
  rows.push(row('Форма, пять последних', per(L, form), per(R, form)));
  const title = (p) => { const b = rankB(p); return b ? `<span class="mx-cmp__rank">${esc(b.label)} ${pipsHTML(b.level, b.max)}</span>` : nd; };
  rows.push(row('Звания', per(L, title), per(R, title)));
  rows.push(row('Личные встречи', `<b class="num">${wins[0]}</b>`, `<b class="num">${wins[1]}</b>`, lead(wins[0], wins[1])));

  const head = (side) => {
    const ps = PLAYERS[side];
    // «моя» пара — одним янтарным блоком: мяч, фамилии и «вы здесь» внутри, друг на друга не наезжают
    return `<th scope="col" class="mx-cmp__pair mx-cmp__pair--${side}${side === MY_SIDE ? ' is-you' : ''}"><span class="mx-cmp__ph">`
      + pairBallHTML(ps[0]?.kpr ?? null, ps[1]?.kpr ?? '', { size: 32, decorative: true })
      + `<span class="mx-cmp__names">${lastNames(ps).map(esc).join('<br>')}</span>`
      + (side === MY_SIDE ? '<span class="you-pin">вы здесь</span>' : '') + '</span></th>';
  };
  const meetings = (M.h2h?.meetings || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const mt = meetings.length
    ? `<ol class="mx-h2h">${meetings.map((x) => {
      const ps = PLAYERS[x.winner] || [];
      return `<li class="mx-h2h__i"><span class="cap">${esc(fmtDate(x.date))}</span>`
        + `<span class="mx-h2h__t">${esc(x.tournament || '')}${x.stage ? ` · ${esc(x.stage)}` : ''}</span>`
        + `<span class="mx-h2h__s num">${esc(x.score || '—')}</span>`
        + `<span class="mx-h2h__w">${pairBallHTML(ps[0]?.kpr ?? null, ps[1]?.kpr ?? '', { size: 20, decorative: true })}<span>${esc(lastNames(ps).join(' / '))}</span></span></li>`;
    }).join('')}</ol>`
    : '<p class="muted">Раньше эти пары не встречались.</p>';

  $('mx-cmp').innerHTML = `
    <header class="sec-head">
      <p class="sec-head__idx"><b class="sec-head__n">01</b><span>Сравнение пар</span><span class="sec-head__meta">${IS_DEMO ? 'демо-данные' : 'архив лиги'}</span></p>
      <h2 class="sec-head__title" id="mx-cmp-h">Кто сильнее на бумаге</h2>
    </header>
    <div class="mx-cmp__grid">
      <table class="mx-cmp__tbl">
        <caption class="vh">Сравнение пар по уровню, рейтингу, титулам, сезону, форме и личным встречам</caption>
        <thead><tr>${head(0)}${head(1)}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <div class="mx-h2hbox">
        <h3 class="mx-h2hbox__h">Личные встречи <span class="num">${wins[0]}:${wins[1]}</span></h3>
        ${mt}
        <p class="cap">${IS_DEMO ? 'Демо-встречи на выдуманных турнирах 2027 года.' : 'Личные встречи по сеткам лиги 2023–2026, до этого матча.'}</p>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ другие матчи */

const rowRefs = new Map();
function matchMeta(m) {
  if (m.dataset === 'demo') return [m.stage, m.court, m.scheduled].filter(Boolean).join(' · ');
  return [m.tournament?.name, m.stage, fmtDate(m.tournament?.date, { year: false })].filter(Boolean).join(' · ');
}
function renderOther() {
  const all = store.matches();
  const demo = all.filter((m) => m.dataset === 'demo').sort((a, b) => String(a.scheduled).localeCompare(String(b.scheduled)) || String(a.court).localeCompare(String(b.court)));
  const arch = all.filter((m) => m.dataset === 'archive').sort((a, b) => String(b.tournament?.date).localeCompare(String(a.tournament?.date)) || (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9) || a.id.localeCompare(b.id));
  const sel = M.dataset === 'archive' ? 1 : 0;
  const keep = document.querySelector('#mx-other [role="tab"][aria-selected="true"]');
  const selNow = keep ? (keep.id === 'mx-tab-1' ? 1 : 0) : sel;
  $('mx-other').innerHTML = `
    <header class="sec-head">
      <p class="sec-head__idx"><b class="sec-head__n">02</b><span>Другие матчи</span><span class="sec-head__meta">выбор откроет афишу</span></p>
      <h2 class="sec-head__title" id="mx-other-h">Ещё на афише</h2>
    </header>
    <div class="tabs mx-tabs" role="tablist" aria-label="Набор матчей">
      <button type="button" class="tabs__tab" role="tab" id="mx-tab-0" aria-controls="mx-pan-0" aria-selected="${selNow === 0}" tabindex="${selNow === 0 ? 0 : -1}">Демо-вечер <span class="tabs__n">${demo.length}</span></button>
      <button type="button" class="tabs__tab" role="tab" id="mx-tab-1" aria-controls="mx-pan-1" aria-selected="${selNow === 1}" tabindex="${selNow === 1 ? 0 : -1}">Архив <span class="tabs__n">${arch.length}</span></button>
    </div>
    <div role="tabpanel" id="mx-pan-0" aria-labelledby="mx-tab-0" ${selNow === 0 ? '' : 'hidden'}>
      <p class="cap mx-pan__note">TS CUP · Демо-вечер · ${esc(fmtDate('2027-06-19'))} · выдуманные пары · <span class="tag tag--demo">Демо-данные</span></p>
      <ul class="mx-list" id="mx-list-0"></ul>
    </div>
    <div role="tabpanel" id="mx-pan-1" aria-labelledby="mx-tab-1" ${selNow === 1 ? '' : 'hidden'}>
      <p class="cap mx-pan__note">Настоящие пары лиги и итог по геймам. Счёт по очкам не сохранился.</p>
      <ul class="mx-list" id="mx-list-1"></ul>
    </div>`;
  [demo, arch].forEach((list, i) => {
    const ul = $(`mx-list-${i}`);
    for (const m of list) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      const mine = m.pairs.some((pid) => playersOfPair(pid).some((p) => p && p.id === ME));
      a.className = `mx-row${mine ? ' is-you' : ''}`;
      a.href = `match.html?m=${encodeURIComponent(m.id)}`;
      if (m.id === ID) a.setAttribute('aria-current', 'page');
      const v = store.view(m.id);
      a.innerHTML = `<span class="mx-row__meta"><span class="mx-row__st">${statusTag(m, v)}</span><span class="cap">${esc(matchMeta(m))}</span>${mine ? '<span class="you-pin">вы здесь</span>' : ''}${m.id === ID ? '<span class="cap mx-row__here">сейчас открыт</span>' : ''}</span>`;
      const box = document.createElement('span');
      box.className = 'mx-row__plates';
      const ps = m.pairs.map((pid, side) => pairPlate(pairOf(pid), playersOfPair(pid), { size: 'sm', ...(m.status === 'upcoming' ? { view: null, side } : plateOpts(m, v, side)) }));
      ps.forEach((el) => box.append(el));
      a.append(box);
      li.append(a);
      ul.append(li);
      rowRefs.set(m.id, { plates: ps, st: a.querySelector('.mx-row__st'), tag: statusTag(m, v) });
    }
  });
  // вкладки: щелчок и стрелки
  const tabs = [$('mx-tab-0'), $('mx-tab-1')];
  const pick = (i, focus) => tabs.forEach((t, j) => {
    t.setAttribute('aria-selected', String(i === j));
    t.tabIndex = i === j ? 0 : -1;
    $(`mx-pan-${j}`).hidden = i !== j;
    if (i === j && focus) t.focus();
  });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => pick(i));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pick(1 - i, true); }
    });
  });
}
function updateRow(id) {
  const r = rowRefs.get(id);
  if (!r) return;
  const m = store.match(id);
  const v = store.view(id);
  if (m.status === 'upcoming') {
    // до старта у плашки нет счёта: пересобираем тихо, без счёта
    r.plates.forEach((el, side) => updatePairPlate(el, { score: null, view: null, side, serving: false, winner: undefined }));
  } else {
    r.plates.forEach((el, side) => updatePairPlate(el, plateOpts(m, v, side)));
  }
  const tag = statusTag(m, v);
  if (r.tag !== tag) { r.st.innerHTML = tag; r.tag = tag; }
}

/* ------------------------------------------------------------------ вход: влёт, столкновение, VS */

const T = {
  fly0: 80,         // карточки срываются
  contact: 860,     // столкновение в центре
  settle: 1300,     // встали на места
  flashDur: 60,     // вспышка по линии стыка — три-четыре кадра
  vs0: 900, vsDur: 220,
  pair0: 1300, pairDur: 620,
  head0: 1640, headDur: 540,
  dustLife: 1400,
  end: 2500,
};
const DESK_MQ = '(min-width: 700px)';   // раскладка «пара | VS | пара» — как в match.css
let intro = null;

function rng(seed) {   // mulberry32: пыль одна и та же при каждом входе и на покадровых снимках
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function waitReady(limit = 1800) {
  const imgs = [...$('poster').querySelectorAll('img')];
  const all = Promise.all([document.fonts ? document.fonts.ready : null, ...imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : null))]);
  return Promise.race([all, new Promise((r) => setTimeout(r, limit))]);
}
function geometry() {
  const desk = matchMedia(DESK_MQ).matches;
  const air = $('air').getBoundingClientRect();
  const box = (side) => {
    const rs = [...$('poster').querySelectorAll(`.poster__side[data-side="${side}"] > .pcard`)].map((c) => c.getBoundingClientRect());
    return { l: Math.min(...rs.map((r) => r.left)), r: Math.max(...rs.map((r) => r.right)), t: Math.min(...rs.map((r) => r.top)), b: Math.max(...rs.map((r) => r.bottom)), w: rs[0] ? rs[0].width : 150 };
  };
  const A = box(0), B = box(1);
  const vw = innerWidth;
  // карточки на телефоне влетают сверху и снизу, но только в пределах сцены: не над кнопками «Повторить» и «Пропустить»
  const top = Math.max(air.top, $('mx-ctl').getBoundingClientRect().bottom + 4);
  const bottom = air.bottom;
  if (desk) {
    const c = (A.r + B.l) / 2;
    const y0 = Math.min(A.t, B.t), y1 = Math.max(A.b, B.b);
    return {
      axis: 'x', desk,
      d: [c - A.r + 3, c - B.l - 3],
      far: [-(A.r + 60), Math.max(vw - B.l + 60, 300)],
      seam: { x: c - air.left, y: y0 - air.top, w: 0, h: y1 - y0 },
      dust: { x: c - air.left, y: y1 - air.top - 6, spread: A.w * 0.9, cw: A.w },
    };
  }
  const c = (A.b + B.t) / 2;
  const x0 = Math.min(A.l, B.l), x1 = Math.max(A.r, B.r);
  return {
    axis: 'y', desk,
    // сверху карточки выходят из-под полосы с кнопками (её фон их закрывает), снизу — из-за края сцены
    d: [c - A.b + 3, c - B.t - 3],
    far: [-(A.b - top + 24), Math.max(bottom - B.t + 24, 200)],
    seam: { x: x0 - air.left, y: c - air.top, w: x1 - x0, h: 0 },
    dust: { x: (x0 + x1) / 2 - air.left, y: c - air.top, spread: (x1 - x0) / 2, cw: A.w },
  };
}

// пыль: несколько мягких тёплых облачков у нижнего края карточек, расходятся и оседают вниз.
// Каждое облачко — функция времени, поэтому кадр можно нарисовать на любой миллисекунде (?freeze=)
function makeDust(g) {
  const css = getComputedStyle(document.documentElement);
  const tok = (n, fb) => (css.getPropertyValue(n) || fb).trim();
  const colors = [tok('--c-clay', '#BF4F27'), tok('--c-clay-soft', '#F0A07E'), tok('--kpr-45', '#E07A4E')];
  const R = rng(23);
  const N = g.desk ? 12 : 10;
  const ps = [];
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N * 2 - 1;                         // -1…1 вдоль края
    const sgn = u < 0 ? -1 : 1;
    ps.push({
      x: g.dust.x + u * g.dust.spread * (g.desk ? 0.35 : 0.8),
      y: g.dust.y + (R() - 0.5) * 8,
      vx: sgn * (30 + Math.abs(u) * 120 + R() * 40),
      vy: -(14 + R() * 26),
      r0: (g.desk ? 18 : 13) + R() * 12,
      grow: 0.8 + R() * 0.7,
      a0: 0.26 + R() * 0.14,
      life: T.dustLife * (0.7 + R() * 0.3),
      born: R() * 50,
      c: R() < 0.55 ? 0 : R() < 0.6 ? 1 : 2,
    });
  }
  return { ps, colors };
}
function sizeCanvas(cv) {
  const r = $('air').getBoundingClientRect();
  const dpr = Math.min(1.5, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.height * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
function drawDust(ctx, dust, t) {   // t — мс от столкновения
  const cv = ctx.canvas;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
  if (!dust || t < 0) return;
  for (const p of dust.ps) {
    const tt = t - p.born;
    if (tt < 0 || tt > p.life) continue;
    const s = tt / 1000;
    const e = (1 - Math.exp(-3.2 * s)) / 3.2;                 // быстро гаснущий разлёт
    const x = p.x + p.vx * e;
    const y = p.y + p.vy * e + 0.5 * 70 * s * s;              // и мягкое оседание вниз
    const r = p.r0 * (1 + p.grow * (1 - Math.exp(-2.6 * s)));
    const k = tt / p.life;
    const a = p.a0 * Math.min(1, tt / 60) * Math.pow(1 - k, 1.5);
    if (a <= 0.002) continue;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, dust.colors[p.c]);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function stopIntro({ finish = true } = {}) {
  if (!intro) return;
  const it = intro;
  intro = null;
  cancelAnimationFrame(it.raf);
  for (const a of it.anims) { try { finish ? a.finish() : null; a.cancel(); } catch { /* уже снята */ } }
  drawDust(it.ctx, null, -1);
  $('mx-dust').hidden = true;
  document.documentElement.classList.remove('mx-pending', 'mx-intro');
}

async function playIntro() {
  stopIntro();
  const root = document.documentElement;
  if (REDUCE || NO_INTRO) { root.classList.remove('mx-pending'); return; }
  if (FREEZE === null) ss.set(SEEN_KEY, '1');
  await waitReady();
  // слишком долго грузилось — афиша уже показана страховкой CSS, повторно не прячем
  if (root.classList.contains('mx-pending') && performance.now() > 2900 && FREEZE === null) { root.classList.remove('mx-pending'); return; }
  const poster = $('poster');
  const g = geometry();
  const anims = [];
  const add = (el, kf, o, pseudo) => { if (!el) return; anims.push(el.animate(kf, { fill: 'both', ...o, ...(pseudo ? { pseudoElement: pseudo } : {}) })); };
  const tr = (v, rot = 0) => (g.axis === 'x' ? `translate3d(${v}px,0,0) rotate(${rot}deg)` : `translate3d(0,${v}px,0) rotate(${rot}deg)`);

  // 1. карточки: разгон, удар, отскок на несколько пикселей, встали
  for (const side of [0, 1]) {
    const cards = [...poster.querySelectorAll(`.poster__side[data-side="${side}"] > .pcard`)];
    const s = side === 0 ? 1 : -1;
    cards.forEach((card, i) => {
      const outer = g.desk && (side === 0 ? i === 0 : i === cards.length - 1);
      const lag = outer ? 24 : 0;
      const dur = T.settle - T.fly0;
      const oc = (T.contact - T.fly0) / dur;
      const tilt = (g.desk ? -3 : -1.5) * s * (outer ? 1.25 : 1) * (g.axis === 'x' ? 1 : (i === 0 ? 1 : -1));
      add(card, [
        { offset: 0, transform: tr(g.far[side], tilt), easing: 'cubic-bezier(.42,0,.85,.55)' },
        { offset: oc, transform: tr(g.d[side], 0), easing: 'cubic-bezier(.25,.6,.35,1)' },
        { offset: oc + (1 - oc) * 0.5, transform: tr(-6 * s, 0), easing: 'cubic-bezier(.4,0,.6,1)' },
        { offset: oc + (1 - oc) * 0.8, transform: tr(2 * s, 0), easing: 'cubic-bezier(.4,0,.6,1)' },
        { offset: 1, transform: tr(0, 0) },
      ], { duration: dur, delay: T.fly0 + lag });
    });
  }
  // 2. короткая тряска сцены и узкая тёплая вспышка по линии стыка, как у фотографов у ринга
  const j = g.axis === 'x' ? [[-4, 1], [3, -1], [-2, 1], [1, 0]] : [[1, -4], [-1, 3], [1, -2], [0, 1]];
  add(poster.querySelector('.mx-stage'), [{ transform: 'none' }, ...j.map(([x, y]) => ({ transform: `translate(${x}px,${y}px)` })), { transform: 'none' }], { duration: 220, delay: T.contact, easing: 'linear', fill: 'none' });
  const fl = $('mx-flash');
  fl.dataset.axis = g.axis;
  Object.assign(fl.style, g.axis === 'x'
    ? { left: `${g.seam.x}px`, top: `${g.seam.y}px`, width: '', height: `${g.seam.h}px` }
    : { left: `${g.seam.x}px`, top: `${g.seam.y}px`, width: `${g.seam.w}px`, height: '' });
  add(fl, [{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0 }], { duration: T.flashDur, delay: T.contact - 6, easing: 'linear' });
  // 3. VS сразу поверх карточек: без прозрачности, коротким масштабом
  const vs = poster.querySelector('.mx-vs');
  add(vs.querySelector('.poster__vs-mark'), [
    { opacity: 0, transform: 'scale(1.15)', offset: 0 },
    { opacity: 1, transform: 'scale(1.15)', offset: 0.001 },
    { opacity: 1, transform: 'scale(1)' },
  ], { duration: T.vsDur, delay: T.vs0, easing: 'cubic-bezier(.2,.7,.2,1)' });
  if (g.desk) {
    add(vs, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 460, delay: T.vs0 + 80, easing: 'cubic-bezier(.2,.7,.2,1)' }, '::before');
    add(vs, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 460, delay: T.vs0 + 80, easing: 'cubic-bezier(.2,.7,.2,1)' }, '::after');
  }
  // 4. мячи пар выкатываются на свои места; подписи — когда мячи встали
  for (const side of [0, 1]) {
    const row = poster.querySelector(`.mx-pair[data-side="${side}"]`);
    const ball = row.querySelector('.mx-ball-box');
    const s = side === 0 ? 1 : -1;
    const br = ball.getBoundingClientRect();
    const travel = Math.min(g.desk ? 220 : 110, Math.max(60, br.width * 1.4));
    const deg = (travel / (br.width / 2 || 50)) * (180 / Math.PI);
    add(ball, [
      { opacity: 0, transform: `translateX(${travel * s}px) rotate(${deg * s}deg)` },
      { opacity: 1, offset: 0.18 },
      { opacity: 1, transform: 'translateX(0) rotate(0)' },
    ], { duration: T.pairDur, delay: T.pair0 + side * 70, easing: 'cubic-bezier(.2,.75,.25,1)' });
    [...row.querySelectorAll('.mx-pair__text, .mx-pair__names')].forEach((el, i) => add(el, [
      { opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' },
    ], { duration: 380, delay: T.pair0 + T.pairDur - 120 + side * 70 + i * 60, easing: 'cubic-bezier(.2,.7,.2,1)' }));
  }
  // 5. строка турнира, подвал, счёт
  [...poster.querySelectorAll('.mx-head > *')].forEach((el, i) => add(el, [
    { opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' },
  ], { duration: T.headDur, delay: T.head0 + i * 80, easing: 'cubic-bezier(.2,.7,.2,1)' }));
  add(poster.querySelector('.mx-foot'), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: T.head0 + 260, easing: 'ease-out' });
  add($('score'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: T.head0 + 300, easing: 'cubic-bezier(.2,.7,.2,1)' });
  // часы входа: пустая по сути анимация на холсте пыли
  const cv = $('mx-dust');
  cv.hidden = false;
  const clock = cv.animate({ opacity: [1, 1] }, { duration: T.end });
  anims.push(clock);

  const ctx = sizeCanvas(cv);
  const dust = makeDust(g);
  root.classList.add('mx-intro');
  root.classList.remove('mx-pending');
  const it = { anims, ctx, raf: 0 };
  intro = it;

  if (FREEZE !== null) {   // покадровая проверка: ?freeze=<мс>
    for (const a of anims) { a.pause(); a.currentTime = FREEZE; }
    drawDust(ctx, dust, FREEZE - T.contact);
    return;
  }
  const frame = () => {
    if (intro !== it) return;
    const t = Number(clock.currentTime) || 0;
    drawDust(ctx, dust, t - T.contact);
    if (t < T.contact + T.dustLife + 80) it.raf = requestAnimationFrame(frame);
  };
  it.raf = requestAnimationFrame(frame);
  clock.finished.then(() => { if (intro === it) stopIntro(); }).catch(() => {});
  // страховка: если часы анимаций стоят (фоновая вкладка, снимок без кадров), через время входа показываем итог
  setTimeout(() => { if (intro === it) stopIntro(); }, T.end + 700);
}

/* ------------------------------------------------------------------ сборка */

renderPoster();
lastCardKey = [cardState(0, store.view(ID), M), cardState(1, store.view(ID), M)].join('|');
renderScoreShell();
renderTry();
updateScore();
renderCompare();
renderOther();

$('mx-replay').addEventListener('click', () => { window.scrollTo({ top: 0 }); playIntro(); });
$('mx-skip').addEventListener('click', () => stopIntro());
if (REDUCE) $('mx-ctl').hidden = true;

store.subscribe(({ id }) => {
  if (id === ID) {
    if (intro) stopIntro();
    updateScore();
    refreshCards();
    refreshTags();
  }
  if (id) updateRow(id);
  else { updateScore(); refreshCards(); refreshTags(); for (const k of rowRefs.keys()) updateRow(k); }
});

// смена роли или «я» — в этой вкладке, в соседней или при возврате «Назад»: перерисовать подсветку «вы здесь»
onIdentityChange(({ role: r, me: m }) => {
  ROLE = r; ME = m; MY_SIDE = sideOfMe();
  if (intro) stopIntro();
  renderPoster();
  lastCardKey = null;
  refreshCards();
  markPlates();
  renderRemind();
  lastSeqLen = -1;
  renderTry();
  updateScore();
  renderCompare();
  rowRefs.clear();
  renderOther();
});

if (SEEN && FREEZE === null) document.documentElement.classList.remove('mx-pending');   // повторное открытие за сеанс: сразу готовая афиша
else playIntro().catch((e) => { console.error('[match] вход афиши', e); stopIntro(); });
