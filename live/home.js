// TLTS · главная. Данные — только из core/data.js и хранилища core/store.js,
// карточки, плашки и мячи — только из core/card.js. 3D-сцена первого экрана живёт в home-scene.js
// и подгружается отдельно: на телефоне, без WebGL и при «меньше движения» остаётся готовый кадр.

import { createStore } from './core/store.js';
import {
  players, pairs, tournaments, seedMatches, ratingBeta,
  playerOf, pairOf, playersOfPair, rankB, RATING_DATE,
} from './core/data.js';
import { playerCard, pairPlate, updatePairPlate, pairBallHTML, kprChipHTML, kprColor, KPR_SCALE } from './core/card.js';
import { mountProtoBar } from './core/protobar.js';
import { role as getRole, me as getMe, onIdentityChange } from './core/identity.js';

mountProtoBar({ current: 'home', demo: true });

/* ------------------------------------------------------------------ общее */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// роль и «я» — из core/identity.js: «вы здесь» видит только роль «Игрок».
// Смена роли в другой вкладке или возврат «Назад» перерисовывают подсветку (см. внизу файла).
let ROLE = getRole();                                                // guest | player | judge | admin | superadmin
let ME = getMe();                                                    // id игрока или null
const QS = new URLSearchParams(window.location.search);
const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqPhone = window.matchMedia('(max-width: 767px), (pointer: coarse)');

const ARROW = '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M3 9h11M10 4.5L14.5 9 10 13.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : 'дата уточняется'; };
const kpr1 = (k) => (typeof k === 'number' ? k.toFixed(1) : '—');
const pairNames = (pairId, sep = ' / ') => playersOfPair(pairId).map((p) => (p ? p.last : '—')).join(sep);
const pairKprs = (pairId) => playersOfPair(pairId).map((p) => (p ? p.kpr : null));
const pairBallOf = (pairId, size) => { const [a, b] = pairKprs(pairId); return pairBallHTML(a, b ?? '', { size, decorative: true }); };
const isMyPair = (pairId) => { const p = pairOf(pairId); return !!(ME && p && p.players.includes(ME)); };
const matchHref = (id) => `match.html?m=${encodeURIComponent(id)}`;
const playerHref = (id) => `player.html?p=${encodeURIComponent(id)}`;
const stageRank = (s) => (/^финал/i.test(s || '') ? 3 : /1\/2|полуфинал/i.test(s || '') ? 2 : 1);
const LEVELS = Object.keys(KPR_SCALE).map(Number).sort((a, b) => a - b);     // уровни КПР: 3.0 … 5.0

const store = createStore();

// цвет панели браузера (theme-color) стоит в <head> index.html

/* ------------------------------------------------------------------ 1. первый экран */

const hero = $('top');
const archiveDone = store.matches().filter((m) => m.dataset === 'archive' && m.status === 'finished')
  .sort((a, b) => String(b.tournament.date).localeCompare(String(a.tournament.date)) || stageRank(b.stage) - stageRank(a.stage));
const lastMatch = archiveDone[0] || null;      // самый свежий финал архива: Итоговый TS CUP 2026

// плашка последнего результата, как в трансляции
(function renderLower3() {
  const box = $('lower3');
  if (!lastMatch) return;
  const m = lastMatch, v = store.view(m.id);
  const [a, b] = m.pairs.map((id) => pairNames(id, ' и '));
  const link = document.createElement('a');
  link.className = 'lower3__link';
  link.href = matchHref(m.id);
  link.setAttribute('aria-label', `Последний результат. ${m.tournament.name}, ${m.stage.toLowerCase()}, ${fmtDate(m.tournament.date)}: ${a} — ${b}, ${v.scoreText}. Открыть афишу матча`);
  link.innerHTML = `<span class="lower3__head"><span class="lower3__tab">Последний результат</span>`
    + `<span class="cap lower3__meta">${esc(m.tournament.name)} · ${esc(m.stage)} · ${fmtDate(m.tournament.date)}</span></span>`;
  m.pairs.forEach((id, side) => link.appendChild(pairPlate(pairOf(id), playersOfPair(id), { size: 'md', view: v, side })));
  box.appendChild(link);
})();

// мяч, который лежит в сетке: чемпионы последнего финала
const champPairId = lastMatch ? lastMatch.pairs[store.view(lastMatch.id).winner ?? 0] : null;
// В 3D половина A оказывается слева: как на рендерах мячей, меньший уровень — слева.
const ballColors = (kprs) => {
  const [lo, hi] = kprs.filter((k) => typeof k === 'number').sort((x, y) => x - y);
  return { a: kprColor(lo) || kprColor(4.0), b: kprColor(hi ?? lo) || kprColor(4.0) };
};
const ballCaption = (pairId, lead) => {
  const ks = pairKprs(pairId);
  return `${pairBallOf(pairId, 22)}<span>${esc(lead)} <b>${esc(pairNames(pairId))}</b> · ${ks.map(kpr1).join(' + ')}</span>`;
};
if (champPairId) $('hero-ball').innerHTML = ballCaption(champPairId, 'В сетке — мяч чемпионов:');

// пары для бросков: все пары прототипа по кругу в случайном порядке
let bag = [];
function nextPair() {
  if (!bag.length) bag = pairs.map((p) => p.id).filter((id) => id !== champPairId).sort(() => Math.random() - 0.5);
  const id = bag.pop();
  return { id, ...ballColors(pairKprs(id)) };
}

/* ---- готовый кадр: лёгкий параллакс от прокрутки и курсора ---- */
const still = $('hero-still');
let parOn = false, parRaf = 0, parX = 0, parY = 0;
function parApply() {
  parRaf = 0;
  const r = hero.getBoundingClientRect();
  if (r.bottom < 0) return;
  const sc = Math.max(0, -r.top);
  still.style.setProperty('--par-s', '1.07');
  still.style.setProperty('--par-x', `${(parX * -9).toFixed(1)}px`);
  still.style.setProperty('--par-y', `${(sc * 0.16 + parY * -6).toFixed(1)}px`);
}
const parKick = () => { if (parOn && !parRaf) parRaf = requestAnimationFrame(parApply); };
const parMove = (e) => {
  if (e.pointerType && e.pointerType !== 'mouse') return;
  const r = hero.getBoundingClientRect();
  parX = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2; parY = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
  parKick();
};
function setParallax(on) {
  on = on && !mqReduce.matches;
  if (on === parOn) return;
  parOn = on;
  if (on) {
    window.addEventListener('scroll', parKick, { passive: true });
    hero.addEventListener('pointermove', parMove, { passive: true });
    parKick();
  } else {
    window.removeEventListener('scroll', parKick);
    hero.removeEventListener('pointermove', parMove);
    for (const k of ['--par-s', '--par-x', '--par-y']) still.style.removeProperty(k);
  }
}

/* ---- 3D-сцена ---- */
let scene3d = null;
const liveBox = $('hero-live');
function showStill(reason) {
  hero.classList.remove('is-live');
  hero.dataset.hero = reason || 'still';
  liveBox.hidden = true;
  setParallax(true);
}
function showLive() {
  hero.classList.add('is-live');
  hero.dataset.hero = 'live';
  liveBox.hidden = false;
  setParallax(false);
}
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
let booting = false;
async function bootHero() {
  const want = QS.get('3d');                                   // ?3d=off — готовый кадр, ?3d=force — сцена на любой графике
  const headless = /HeadlessChrome/.test(navigator.userAgent); // автоматическая проверка: программная графика допустима
  if (scene3d || booting) return;
  showStill('still');
  if (want === 'off') return showStill('off');
  if (mqReduce.matches) return showStill('reduced-motion');
  if (mqPhone.matches && want !== 'force') return showStill('phone');
  if (!hasWebGL()) return showStill('no-webgl');             // Three.js без WebGL даже не скачиваем
  booting = true;
  try {
    const mod = await import('./home-scene.js');
    scene3d = await mod.mountHeroScene({
      host: $('hero-gl'),
      section: hero,
      champion: champPairId ? ballColors(pairKprs(champPairId)) : { a: kprColor(5.0), b: kprColor(3.0) },
      nextPair,
      onThrow: (pair) => { if (pair && pair.id) $('hero-ball').innerHTML = ballCaption(pair.id, 'Бросок — мяч пары:'); },
      onState: (state) => {
        if (state === 'live') { if (!mqReduce.matches) showLive(); }
        else showStill(state);                               // 'lost' — потерян контекст WebGL, 'slow' — графика не тянет
      },
      force: want === 'force' || headless,
    });
    if (!scene3d) return showStill('no-webgl');
    window.__tltsHero = scene3d;                             // для проверки из консоли
  } catch (e) {
    console.warn('[tlts] 3D-сцена не запустилась, остаётся готовый кадр:', e && e.message);
    showStill('error');
  } finally {
    booting = false;
  }
}
$('hero-throw').addEventListener('click', () => { if (scene3d) scene3d.throwRandom(); });
const onReduceChange = () => {
  if (!scene3d) {
    setParallax(!mqReduce.matches && !hero.classList.contains('is-live'));
    if (!mqReduce.matches) bootHero();                        // движение разрешили — пробуем поднять сцену
    return;
  }
  if (mqReduce.matches) { scene3d.pause(); showStill('reduced-motion'); return; }
  scene3d.resume();
  if (scene3d.alive) showLive(); else showStill('still');
};
if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduceChange);
// окно стало широким (или страница открылась в свёрнутой панели, а потом её развернули) — поднимаем сцену
if (mqPhone.addEventListener) mqPhone.addEventListener('change', () => { if (!mqPhone.matches) bootHero(); });

// «Найти себя»: прокрутка к поиску и курсор в поле
$('cta-find').addEventListener('click', (e) => {
  const q = $('find-q');
  if (!q) return;
  e.preventDefault();
  $('find').scrollIntoView({ behavior: mqReduce.matches ? 'auto' : 'smooth', block: 'start' });
  q.focus({ preventScroll: true });
  if (window.history && window.history.replaceState) window.history.replaceState(null, '', '#find');
});

/* ------------------------------------------------------------------ 2. сейчас на кортах */

const demoTour = tournaments.find((t) => t.demo) || null;
const demoSeed = seedMatches.filter((m) => m.dataset === 'demo');
const AUTO_IDS = demoSeed.filter((m) => m.status === 'live').map((m) => m.id);     // матчи, которые этот блок разыгрывает сам
const FINAL_ID = (demoSeed.find((m) => /^финал/i.test(m.stage)) || {}).id || null;
const courtOrder = (m) => { const i = demoTour ? demoTour.courts.indexOf(m.court) : -1; return i < 0 ? 99 : i; };
const SPEED = 2.5;                                                                 // темп автоигры: очко раз в 1,5–3 с

if (demoTour) $('now-meta').textContent = `${demoTour.name} · ${fmtDate(demoTour.date)} · ${demoTour.venue}`;

// бегущая строка: результаты архива (кроме финала, который уже на плашке первого экрана)
(function renderTicker() {
  const items = archiveDone.filter((m) => !lastMatch || m.id !== lastMatch.id).map((m) => {
    const v = store.view(m.id), w = v.winner === 1 ? 1 : 0;
    return `<li class="ticker__item"><b>${esc(m.tournament.name)}</b><span class="num">${fmtDate(m.tournament.date)}</span>`
      + `<span>${esc(m.stage)}${m.category ? ` · ${esc(m.category)}` : ''}</span><span>${esc(pairNames(m.pairs[w]))}</span>`
      + `<span class="num">${v.games[w]}:${v.games[1 - w]}</span><span>${esc(pairNames(m.pairs[1 - w]))}</span></li>`;
  }).join('');
  if (!items) { $('ticker').hidden = true; return; }
  const list = (hidden) => `<ul class="ticker__list"${hidden ? ' aria-hidden="true"' : ''}>${items}</ul>`;
  $('ticker').innerHTML = `<span class="ticker__label">Архив</span><div class="ticker__viewport"><div class="ticker__track">${list(false)}${list(true)}</div></div>`;
})();

const nowList = $('now-list');
const courts = new Map();          // id матча → { el, plates, tag, state, sig }

// исход остановленного матча: «Неявка», «Снятие при счёте 2:1», «Прерван при 4:3» (core/score.js)
const stopped = (v) => !!(v.outcome && v.outcome !== 'played');
// режим «только итог», пока матч идёт: цифр нет, как на афише и табло
const onlyFinal = (m, v) => m.mode === 'final' && m.status === 'live' && !v?.finished;
function courtState(m, v) {
  if (stopped(v)) return `<b>${esc(v.outcomeText || v.label || 'Матч окончен')}</b>`;
  if (v.finished) return `Матч окончен · <b>${esc(v.scoreText)}</b>`;
  if (onlyFinal(m, v)) return 'Итог после матча';
  if (store.isClaimedByOther(m.id) && v.label) return `<b>${esc(v.label)}</b> · счёт ведёт судья`;
  if (store.isClaimedByOther(m.id)) return 'Счёт ведёт судья';
  const mode = m.mode === 'games' ? 'Счёт обновляется после каждого гейма' : m.mode === 'final' ? 'Судья внесёт счёт после матча' : 'Счёт по очкам';
  return v.label ? `<b>${esc(v.label)}</b> · ${mode}` : mode;
}
function makeCourt(m) {
  const el = document.createElement('article');
  el.className = 'court';
  el.dataset.match = m.id;
  const mine = m.pairs.some(isMyPair);
  if (mine) el.classList.add('row', 'is-you');
  const stage = [m.stage, m.category].filter(Boolean).join(' · ');
  el.innerHTML = `<header class="court__head"><span class="court__tag"></span><h3 class="court__name">${esc(m.court || 'Корт')}</h3>`
    + `<span class="cap">${esc(stage)}</span>${mine ? '<span class="you-pin">вы здесь</span>' : ''}`
    + `<span class="num court__time">${esc(m.scheduled || '')}</span></header>`
    + `<div class="court__plates"></div>`
    + `<footer class="court__foot"><p class="cap court__state"></p><a class="more" href="${matchHref(m.id)}">Афиша матча ${ARROW}</a></footer>`;
  const v = store.view(m.id);
  // bump: изменившаяся цифра коротко подпрыгивает (класс .is-changed ставит основа)
  const plates = m.pairs.map((id, side) => pairPlate(pairOf(id), playersOfPair(id), onlyFinal(m, v) ? { size: 'md', score: null, view: null, side, serving: false } : { size: 'md', view: v, side, bump: true }));
  el.querySelector('.court__plates').append(...plates);
  return { el, plates, tag: el.querySelector('.court__tag'), state: el.querySelector('.court__state'), sig: '', status: '' };
}
function updateCourt(rec, m) {
  const v = store.view(m.id);
  const sig = `${m.rev}|${m.status}|${store.isClaimedByOther(m.id)}`;
  if (sig === rec.sig) return;
  rec.sig = sig;
  rec.plates.forEach((p, side) => updatePairPlate(p, onlyFinal(m, v) ? { score: null, view: null, side, serving: false } : { view: v, side }));     // счёт меняется на месте
  const tagKey = `${m.status}|${v.outcome || ''}`;
  if (rec.status !== tagKey) {
    rec.status = tagKey;
    rec.tag.innerHTML = stopped(v) ? `<span class="tag tag--done">${esc(v.label || 'Завершён')}</span>`
      : m.status === 'finished' ? '<span class="tag tag--done">Завершён</span>' : '<span class="tag tag--live">Live</span>';
  }
  const text = courtState(m, v);
  if (rec.state.innerHTML !== text) rec.state.innerHTML = text;
}
function renderNow() {
  const all = store.matches().filter((m) => m.dataset === 'demo');
  // показываем идущие матчи, а также доигранные или остановленные матчи этого блока
  // (и те, что доиграны, пока страница открыта): после перезагрузки корт с итогом не пропадает
  const list = all.filter((m) => m.status === 'live' || (m.status === 'finished' && (courts.has(m.id) || AUTO_IDS.includes(m.id))))
    .sort((a, b) => courtOrder(a) - courtOrder(b));
  const keep = new Set(list.map((m) => m.id));
  for (const [id, rec] of courts) if (!keep.has(id)) { rec.el.remove(); courts.delete(id); }
  list.forEach((m, i) => {
    let rec = courts.get(m.id);
    if (!rec) { rec = makeCourt(m); courts.set(m.id, rec); }
    if (nowList.children[i] !== rec.el) nowList.insertBefore(rec.el, nowList.children[i] || null);
    updateCourt(rec, m);
  });
  $('now-empty').hidden = list.length > 0;
}

// анонс финала отдельной строкой
function renderFinal() {
  const box = $('final');
  const m = FINAL_ID ? store.match(FINAL_ID) : null;
  if (!m) { box.hidden = true; return; }
  const v = store.view(m.id);
  const sig = `${m.status}|${v.games.join(':')}|${v.finished}|${v.outcome || ''}|${ME}`;
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  const mine = m.pairs.some(isMyPair);
  const tag = m.status === 'live' ? '<span class="tag tag--live">Live</span>'
    : stopped(v) ? `<span class="tag tag--done">${esc(v.label || 'Завершён')}</span>`
    : m.status === 'finished' ? '<span class="tag tag--done">Завершён</span>'
      : `<span class="tag tag--soon">Скоро · ${esc(m.scheduled || '[ВРЕМЯ]')}</span>`;
  const score = m.status === 'upcoming' ? ''
    : stopped(v) ? `<span class="final__outcome">${esc(v.outcomeText || v.label)}</span>`
      : onlyFinal(m, v) ? '<span class="final__outcome">Итог после матча</span>'
      : `<span class="final__score" aria-label="Счёт ${esc(v.scoreText || v.games.join(':'))}">${v.games[0]}:${v.games[1]}</span>`;
  const pair = (id) => `<span class="final__pair">${pairBallOf(id, 30)}<span>${esc(pairNames(id))}</span>${isMyPair(id) ? '<span class="you-pin">вы здесь</span>' : ''}</span>`;
  const title = [m.stage, m.court, m.scheduled].filter(Boolean).join(' · ');
  const go = m.status === 'live' ? 'Смотреть финал' : m.status === 'finished' ? 'Итог финала' : 'Афиша финала';
  box.innerHTML = `<a class="final${mine ? ' is-you' : ''}" href="${matchHref(m.id)}">`
    + `<span class="final__lead"><span class="cluster">${tag}${m.category ? `<span class="tag tag--gm">${esc(m.category)}</span>` : ''}</span>`
    + `<span class="final__title">${esc(title)}</span>`
    + `<span class="final__pairs">${pair(m.pairs[0])}<span class="cap final__vs">против</span>${pair(m.pairs[1])}</span></span>`
    + `<span class="final__side">${score}<span class="final__go">${go} ${ARROW}</span></span></a>`;
}

// «Запустить демо-матч»: идущие матчи разыгрываются сами
const runBtn = $('demo-run'), resetBtn = $('demo-reset'), demoStatus = $('demo-status');
// Матч, который держит судья (экран счёта открыт в другой вкладке), автоигра и сброс не трогают.
const held = (id) => store.isClaimedByOther(id);
const courtOf = (id) => { const m = store.match(id); return (m && m.court) || 'корт'; };
const heldText = (ids) => (ids.length ? `${ids.map(courtOf).join(', ')}: матч ведёт судья, автоигра и сброс его не трогают` : '');
const autoOn = () => AUTO_IDS.some((id) => store.isAutoplaying(id) && !held(id));
const autoLive = () => AUTO_IDS.filter((id) => { const m = store.match(id); return m && m.status === 'live'; });
const freeLive = () => autoLive().filter((id) => !held(id));
let barNote = '';            // разовое сообщение после нажатия: что пропущено и почему
function refreshBar() {
  const on = autoOn(), liveN = freeLive().length, heldIds = AUTO_IDS.filter(held);
  const label = on ? 'Остановить демо-матч' : liveN || heldIds.length ? 'Запустить демо-матч' : 'Сыграть заново';
  if (runBtn.textContent !== label) runBtn.textContent = label;
  runBtn.setAttribute('aria-pressed', String(on));
  const base = on ? 'Автоигра идёт: счёт меняется каждые две-три секунды'
    : liveN ? 'Счёт стоит. Запустите демо-матч или откройте экран судьи в соседней вкладке'
      : heldIds.length ? 'Свободных матчей для автоигры нет'
        : 'Матчи доиграны. Можно сыграть заново';
  const text = [base, heldText(heldIds) || barNote].filter(Boolean).join('. ');
  if (demoStatus.textContent !== text) demoStatus.textContent = text;
}
runBtn.addEventListener('click', () => {
  barNote = '';
  if (autoOn()) AUTO_IDS.forEach((id) => { if (!held(id)) store.stopAutoplay(id); });
  else {
    // всё доиграно — начинаем с исходного счёта (кроме матча судьи)
    if (!autoLive().length) AUTO_IDS.forEach((id) => store.tryReset(id));
    autoLive().forEach((id) => store.tryAutoplay(id, { speed: SPEED }));
  }
  refreshBar();
});
resetBtn.addEventListener('click', () => {
  AUTO_IDS.forEach((id) => store.tryReset(id));
  renderNow(); refreshBar();
});
function applyRoleUI() {      // судье и админам — вход в экран судьи
  $('judge-link').hidden = !['judge', 'admin', 'superadmin'].includes(ROLE);
}
applyRoleUI();

store.subscribe(({ id }) => {
  const m = id ? store.match(id) : null;
  if (m && m.dataset === 'demo') { renderNow(); if (id === FINAL_ID) renderFinal(); refreshBar(); }
  else if (!id) { renderNow(); renderFinal(); refreshBar(); }
});

/* ------------------------------------------------------------------ 3. найти себя */

const KZ = { 'ә': 'а', 'ғ': 'г', 'қ': 'к', 'ң': 'н', 'ө': 'о', 'ұ': 'у', 'ү': 'у', 'һ': 'х', 'і': 'и', 'ё': 'е' };
const norm = (s) => String(s || '').toLowerCase().replace(/[әғқңөұүһіё]/g, (c) => KZ[c]).replace(/\s+/g, ' ').trim();
const demoN = players.filter((p) => p.demo).length, archN = players.length - demoN;
const findInput = $('find-q'), findList = $('find-list'), findCount = $('find-count'), findHint = $('find-hint');
let found = null;          // игрок, найденный поиском однозначно: отмечается янтарём в рейтинге и сетке

const playersN = (n) => `${n} ${plural(n, 'игрок', 'игрока', 'игроков')}`;
$('find-meta').textContent = `${playersN(players.length)} · ${demoN} демо · ${archN} из архива`;
findInput.placeholder = 'Например, Достанов';

function findRow(p) {
  const li = document.createElement('li');
  const me = p.id === ME;
  li.className = `findme__opt${me ? ' row is-you' : ''}`;
  li.appendChild(playerCard(p, { size: 'sm', rank: 'B', rankB: rankB(p), href: playerHref(p.id) }));
  if (me) li.insertAdjacentHTML('beforeend', '<span class="you-pin">вы здесь</span>');
  else if (p.demo) li.insertAdjacentHTML('beforeend', '<span class="cap find__mark">демо</span>');
  return li;
}
// Ищем по фамилии, но понимаем и «Ерлан Сарсенбаев», и «Сарсенбаев Ерлан», и «Сарсенбаев Е»:
// каждое слово запроса должно быть началом одного из слов имени.
function searchPlayers(q) {
  const n = norm(q), words = n.split(' ').filter(Boolean);
  const hits = [];
  for (const p of players) {
    const last = norm(p.last), first = norm(p.first), full = norm(`${p.last} ${p.first} ${p.patronymic || ''}`);
    const parts = full.split(' ').filter(Boolean);
    const allWords = words.length > 1 && words.every((w) => parts.some((x) => x.startsWith(w)))
      && words.some((w) => last.startsWith(w));
    const score = last.startsWith(n) ? 0 : allWords ? 0 : first.startsWith(n) ? 1 : full.includes(n) ? 2 : -1;
    if (score >= 0) hits.push([score, p]);
  }
  return hits.sort((a, b) => a[0] - b[0] || a[1].last.localeCompare(b[1].last, 'ru')).map((x) => x[1]);
}
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
function renderFind() {
  const q = findInput.value;
  const MAX = 8;
  let list, title, hint, nextFound = null, more = 0;
  if (!norm(q)) {
    const me = ME ? playerOf(ME) : null;
    if (me) {
      list = [me, ...(me.partners || []).map((x) => playerOf(x.id)).filter(Boolean)].slice(0, 4);
      title = 'Вы и ваши партнёры';
      hint = `Вы вошли как ${me.name}. Строки с вами и вашей парой отмечены янтарём на всех экранах.`;
    } else {
      list = ratingBeta.slice(0, 3).map((r) => playerOf(r.id)).filter(Boolean);
      title = 'Лидеры рейтинга';
      hint = 'Вы смотрите как гость. Найдите себя по фамилии — или любого игрока лиги.';
    }
  } else {
    const all = searchPlayers(q);
    list = all.slice(0, MAX); more = all.length - list.length;
    title = all.length ? `Найдено: ${all.length} ${plural(all.length, 'игрок', 'игрока', 'игроков')}` : 'Никого не нашли';
    if (all.length === 1) nextFound = all[0];
    hint = !all.length ? `В прототипе ${playersN(players.length)}: ${demoN} демо и ${archN} из архива лиги. Проверьте фамилию.`
      : all.length === 1 ? foundHint(all[0])
        : 'Уточните фамилию: когда останется один игрок, его строки в рейтинге и сетке ниже отметятся янтарём.';
  }
  findList.replaceChildren(...list.map(findRow));
  if (more > 0) findList.insertAdjacentHTML('beforeend', `<li class="find__more">И ещё ${more}. Уточните фамилию.</li>`);
  findCount.textContent = title;
  findHint.textContent = hint;
  setFound(nextFound);
}
function foundHint(p) {
  const inRating = ratingBeta.slice(0, 10).find((r) => r.id === p.id);
  const inBracket = bracketPairs().some((id) => pairOf(id).players.includes(p.id));
  const where = [inRating ? `№${inRating.place} в рейтинге` : '', inBracket ? 'пара в сетке турнира' : ''].filter(Boolean);
  return where.length ? `${p.name}: ${where.join(', ')} — строки ниже отмечены янтарём.` : `${p.name}: в первой десятке и в сетке этого турнира игрока нет. Все его цифры — в профиле.`;
}
function setFound(p) {
  const id = p ? p.id : null;
  if ((found && found.id) === id) return;
  found = p || null;
  renderRating();
  renderBracket();
}
findInput.addEventListener('input', renderFind);
$('find-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const first = findList.querySelector('a.pcard');
  if (first && norm(findInput.value)) window.location.href = first.href;         // Enter открывает первого найденного
});
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { const first = findList.querySelector('a.pcard'); if (first) { e.preventDefault(); first.focus(); } }
  if (e.key === 'Escape' && findInput.value) { findInput.value = ''; renderFind(); }
});
findList.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const links = [...findList.querySelectorAll('a.pcard')], i = links.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const next = e.key === 'ArrowDown' ? links[i + 1] : (i === 0 ? findInput : links[i - 1]);
  if (next) next.focus();
});

/* ------------------------------------------------------------------ 4. сетка турнира */

// полуфиналы и финал высшей категории TS CUP 7 из архива
const cup7 = tournaments.find((t) => !t.demo && /^TS CUP 7$/i.test(t.name)) || tournaments.find((t) => !t.demo) || null;
const cupMatches = cup7 ? store.matches().filter((m) => m.tournamentId === cup7.id && m.category === 'Grand Masters') : [];
const cupFinal = cupMatches.find((m) => stageRank(m.stage) === 3) || null;
// полуфиналы — в порядке, в котором их победители стоят в финале: верхний матч кормит верхнюю строку
const cupSemis = cupMatches.filter((m) => stageRank(m.stage) === 2)
  .sort((a, b) => (cupFinal ? semiSlot(a) - semiSlot(b) : 0));
function semiSlot(sf) { const i = cupFinal.pairs.findIndex((id) => sf.pairs.includes(id)); return i < 0 ? 9 : i; }
function bracketPairs() { return [...new Set([...cupSemis, ...(cupFinal ? [cupFinal] : [])].flatMap((m) => m.pairs))]; }
const winnerOf = (m) => { const v = store.view(m.id); return m.pairs[v.winner === 1 ? 1 : 0]; };
// счёт матча глазами пары: её геймы первыми
const scoreFor = (m, pairId) => { const v = store.view(m.id), i = m.pairs.indexOf(pairId) === 1 ? 1 : 0; return `${v.games[i]}:${v.games[1 - i]}`; };
const fullNames = (pairId) => playersOfPair(pairId).map((p) => `${p.last} ${p.first}`);

function renderBracket() {
  const grid = $('bracket-grid');
  if (!cupFinal) { $('bracket').hidden = true; return; }
  const champ = winnerOf(cupFinal);
  // янтарный путь: пара найденного игрока, если она играла в этой сетке; иначе путь чемпионов
  const foundPair = found ? bracketPairs().find((id) => pairOf(id).players.includes(found.id)) : null;
  const path = foundPair || champ;

  const rowHTML = (m, side) => {
    const v = store.view(m.id), id = m.pairs[side], win = v.winner === side;
    return `<div class="bm__row${win ? ' is-win' : ''}${id === path ? ' on-path' : ''}">${pairBallOf(id, 20)}`
      + `<span class="bm__name">${esc(pairNames(id))}</span><span class="bm__score">${v.games[side]}</span></div>`;
  };
  const matchHTML = (m, slotCls) => {
    const v = store.view(m.id), has = m.pairs.includes(path), out = has && winnerOf(m) === path;
    const label = `${m.stage}: ${pairNames(m.pairs[0], ' и ')} — ${pairNames(m.pairs[1], ' и ')}, ${v.scoreText}. Открыть афишу матча`;
    return `<div class="bslot${slotCls}"><div class="bm${out ? ' path-out' : ''}${slotCls ? ' path-in' : ''}">${rowHTML(m, 0)}${rowHTML(m, 1)}`
      + `<a class="bm__link" href="${matchHref(m.id)}" aria-label="${esc(label)}"></a></div></div>`;
  };
  // из какого полуфинала путь пришёл в финал
  const fromIdx = cupSemis.findIndex((sf) => sf.pairs.includes(path) && winnerOf(sf) === path);
  const finalSlot = cupFinal.pairs.includes(path) && fromIdx >= 0 ? (fromIdx === 0 ? ' path-top' : ' path-bottom') : '';
  const champIn = champ === path;
  const [c1, c2] = playersOfPair(champ);
  const mark = (p) => (found && found.id === p.id ? `<span class="you-mark">${esc(`${p.last} ${p.first}`)}</span>` : esc(`${p.last} ${p.first}`));

  grid.innerHTML = `<div class="bracket__round"><div class="bracket__head">1/2 финала<span>${cupSemis.length} ${plural(cupSemis.length, 'матч', 'матча', 'матчей')}</span></div>`
    + `<div class="bracket__slots">${cupSemis.map((m) => matchHTML(m, '')).join('')}</div></div>`
    + `<div class="bracket__round"><div class="bracket__head">Финал<span>1 матч</span></div><div class="bracket__slots">${matchHTML(cupFinal, finalSlot)}</div></div>`
    + `<div class="bracket__round"><div class="bracket__head">Итог<span>${esc(cup7.name)}</span></div><div class="bracket__slots"><div class="bslot bslot--solo">`
    + `<div class="bracket__champ bm${champIn ? ' path-in' : ''}"><span class="cap">Чемпионы · ${esc(cupFinal.category || '')}</span>`
    + `<b>${mark(c1)}<br>${mark(c2)}</b><span class="cap">финал ${scoreFor(cupFinal, champ)}</span></div></div></div></div>`;

  $('bracket-path-label').textContent = foundPair && foundPair !== champ ? `путь пары ${pairNames(foundPair)}` : 'путь чемпионов';
}
(function bracketTexts() {
  if (!cupFinal) return;
  const champ = winnerOf(cupFinal), sf = cupSemis.find((m) => m.pairs.includes(champ));
  $('bracket-meta').textContent = `${cup7.name} · ${fmtDate(cup7.date)} · ${cupFinal.category}`;
  const [a, b] = fullNames(champ);
  $('bracket-lede').textContent = `${a} и ${b}: ${sf ? `1/2 финала ${scoreFor(sf, champ)}, ` : ''}финал ${scoreFor(cupFinal, champ)}. `
    + 'Пары и счёт — из архива лиги. У каждой пары свой мяч: половины по уровням КПР партнёров.';
})();

/* ------------------------------------------------------------------ 5. рейтинг */

function renderRating() {
  const top = ratingBeta.slice(0, 10);
  const rows = top.map((r, i) => {
    const p = playerOf(r.id);
    const name = p ? `${p.last} ${p.first}` : r.id;
    const you = ME && r.id === ME, hit = found && found.id === r.id;
    const gap = i === 0 ? null : top[i - 1].points - r.points;
    const pin = you ? '<span class="you-pin">вы здесь</span>' : hit ? '<span class="you-pin">найден</span>' : '';
    return `<tr${you || hit ? ' class="is-you"' : ''}><td class="tbl__place">${r.place}</td>`
      + `<td><span class="rate__name">${pairBallHTML(r.kpr, null, { size: 24, decorative: true })}`
      + `<a href="${playerHref(r.id)}">${esc(name)}</a>${pin}</span></td>`
      + `<td>${kprChipHTML(r.kpr)}</td><td class="n r">${Number(r.points).toLocaleString('ru-RU')}</td>`
      + `<td class="n r${gap === null ? ' is-lead' : ''}">${gap === null ? 'лидер' : gap === 0 ? '0' : `−${gap.toLocaleString('ru-RU')}`}</td></tr>`;
  }).join('');
  $('rating-table').innerHTML = '<thead><tr><th scope="col">№</th><th scope="col">Игрок</th><th scope="col">КПР</th>'
    + `<th scope="col" class="r">Баллы</th><th scope="col" class="r">Отрыв</th></tr></thead><tbody>${rows}</tbody>`;
}
$('rating-meta').textContent = `Рейтинг лиги на ${fmtDate(RATING_DATE)}`;
$('rating-legend').innerHTML = LEVELS.map((k) => `<li>${pairBallHTML(k, null, { size: 28, decorative: true })}${kprChipHTML(k)}</li>`).join('');

/* ------------------------------------------------------------------ 6. соберите пару */

const CORRIDOR = [7.5, 8.0];                       // сумма КПР пары в сезоне 2026
const build = { a: 5.0, b: 3.0 };
const buildEl = $('build'), buildStage = $('build-stage'), buildOut = $('build-out');

// Готовый мяч пары — 3D-рендер из assets/3d/pairballs (первым в имени идёт меньший уровень, он же слева).
const BALL_DIR = new URL('../assets/3d/pairballs/', import.meta.url);
const ballFile = (lo, hi) => new URL(`ball-${Math.round(lo * 10)}-${Math.round(hi * 10)}.webp`, BALL_DIR).href;
let buildSeq = 0;
function renderBuild(first) {
  const sum = Math.round((build.a + build.b) * 10) / 10;
  const below = Math.round((CORRIDOR[0] - sum) * 10) / 10, above = Math.round((sum - CORRIDOR[1]) * 10) / 10;
  const ok = below <= 0 && above <= 0, off = Math.max(below, above, 0);
  const lo = Math.min(build.a, build.b), hi = Math.max(build.a, build.b);
  if (first) {
    // половины — pairBall(kpr, null) из card.js; вторая повёрнута на пол-оборота: шов мяча симметричен.
    // Плоский мяч стоит в том же ракурсе, что и рендер: меньший уровень слева.
    buildStage.innerHTML = '<div class="build__flat"><div class="build__half build__half--a"></div><div class="build__half build__half--b"></div><div class="build__full"></div></div>'
      + '<img class="build__real" alt="" decoding="async" draggable="false">';
  }
  const flat = buildStage.firstElementChild, real = buildStage.lastElementChild;
  // меняем только цвета: половины остаются на месте и плавно сходятся или расходятся
  flat.children[0].innerHTML = pairBallHTML(hi, null, { size: 240, decorative: true });
  flat.children[1].innerHTML = pairBallHTML(lo, null, { size: 240, decorative: true });
  flat.children[2].innerHTML = pairBallHTML(hi, lo, { size: 240, decorative: true });
  const src = ballFile(lo, hi), seq = ++buildSeq;
  if (real.dataset.src !== src) {
    // новый рендер подставляем только когда он загружен: без мигания и без «чужого» мяча
    const img = new Image();
    img.onload = () => { if (seq === buildSeq) { real.src = src; real.dataset.src = src; real.classList.add('is-ready'); } };
    img.onerror = () => { if (seq === buildSeq) real.classList.remove('is-ready'); };   // рендера нет — остаётся плоский мяч
    if (real.dataset.src) real.classList.remove('is-ready');
    img.src = src;
  }
  buildEl.classList.toggle('is-out', !ok);
  buildEl.style.setProperty('--gap', `${(8 + off * 6).toFixed(1)}%`);      // чем дальше сумма от коридора, тем шире разошлись половины
  for (const [key, box] of [['a', $('build-a')], ['b', $('build-b')]]) {
    for (const btn of box.children) btn.setAttribute('aria-pressed', String(Number(btn.dataset.kpr) === build[key]));
  }
  const verdict = ok ? '<span class="tag tag--gm">Пара проходит</span>'
    : below > 0 ? `<span class="tag tag--m">Не хватает ${below.toFixed(1)}</span>`
      : `<span class="tag tag--m">Лишние ${above.toFixed(1)}</span>`;
  const why = ok ? `Сумма в коридоре ${CORRIDOR[0].toFixed(1)}–${CORRIDOR[1].toFixed(1)}: половины сошлись, шов застёгнут.`
    : below > 0 ? `Сумма ниже ${CORRIDOR[0].toFixed(1)}: половины не сходятся. Нужен партнёр с уровнем выше.`
      : `Сумма выше ${CORRIDOR[1].toFixed(1)}: половины не сходятся. Нужен партнёр с уровнем ниже.`;
  buildOut.innerHTML = `<p class="build__sum">${build.a.toFixed(1)} + ${build.b.toFixed(1)} = ${sum.toFixed(1)} <small>сумма КПР</small></p>`
    + `<p class="build__verdict">${verdict}</p><p class="build__why">${why}</p>`;
}
for (const [key, box] of [['a', $('build-a')], ['b', $('build-b')]]) {
  box.innerHTML = LEVELS.map((k) => `<button class="seg__btn" type="button" data-kpr="${k}" aria-pressed="false" aria-label="КПР ${k.toFixed(1)}">${kprChipHTML(k)}</button>`).join('');
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg__btn');
    if (!btn) return;
    build[key] = Number(btn.dataset.kpr);
    renderBuild(false);
  });
}

/* ------------------------------------------------------------------ 7. как вступить: форма-макет */

const dlg = $('apply'), applyForm = $('apply-form'), applyDone = $('apply-done'), applyError = $('apply-error');
let applyOpener = null;
function openApply(opener) {
  applyOpener = opener || null;
  applyForm.hidden = false; applyDone.hidden = true; applyError.hidden = true;
  for (const el of applyForm.querySelectorAll('.input')) el.removeAttribute('aria-invalid');
  if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  const first = applyForm.querySelector('.input');
  if (first) first.focus();
}
function closeApply() {
  if (typeof dlg.close === 'function') { if (dlg.open) dlg.close(); } else dlg.removeAttribute('open');
}
$('join-open').addEventListener('click', (e) => openApply(e.currentTarget));
dlg.addEventListener('close', () => { if (applyOpener) applyOpener.focus(); });
dlg.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) { closeApply(); return; }
  if (e.target === dlg) closeApply();                                          // клик по затемнению
  const hand = e.target.closest('[data-hand]');
  if (hand) for (const b of hand.parentElement.children) b.setAttribute('aria-pressed', String(b === hand));
});
applyForm.addEventListener('submit', (e) => {
  e.preventDefault();                                                          // макет: ничего никуда не уходит
  const f = applyForm.elements;
  const problems = [];
  const check = (el, ok, text) => { if (ok) el.removeAttribute('aria-invalid'); else { el.setAttribute('aria-invalid', 'true'); problems.push([el, text]); } };
  check(f.name, f.name.value.trim().length >= 2, 'Укажите имя и фамилию');
  check(f.phone, f.phone.value.replace(/\D/g, '').length >= 10, 'Укажите телефон: не меньше 10 цифр');
  const since = Number(f.since.value);
  check(f.since, f.since.value !== '' && Number.isInteger(since) && since >= 3 && since <= 80, 'Укажите возраст, с которого играете: от 3 до 80 лет');
  if (problems.length) {
    applyError.textContent = problems.map((p) => p[1]).join('. ') + '.';
    applyError.hidden = false;
    problems[0][0].focus();
    return;
  }
  applyError.hidden = true;
  applyForm.reset();
  for (const b of applyForm.querySelectorAll('[data-hand]')) b.setAttribute('aria-pressed', String(b.dataset.hand === 'R'));
  applyForm.hidden = true; applyDone.hidden = false;
  $('apply-done-h').focus();
});

/* ------------------------------------------------------------------ роль и «я» меняются без перезагрузки */

// роль сменили в другой вкладке (player.html) или страница вернулась кнопкой «Назад»
onIdentityChange((id) => {
  ROLE = id.role; ME = id.me;
  for (const rec of courts.values()) rec.el.remove();                         // корты строятся заново с новой подсветкой
  courts.clear();
  renderNow(); renderFinal(); refreshBar(); applyRoleUI();
  renderRating(); renderFind();
});

/* ------------------------------------------------------------------ запуск */

renderNow();
renderFinal();
refreshBar();
renderRating();
renderBracket();
renderFind();
renderBuild(true);
bootHero();
