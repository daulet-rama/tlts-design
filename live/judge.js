// TLTS · экран судьи (judge.html). Логика — core/store.js и core/score.js, вид — core/theme.css и core/card.js.
// Экраны: вход → мои матчи → перед началом → счёт (по очкам, по геймам, только итог) → конец матча.
// Адреса: judge.html#/matches, #/setup/<id>, #/play/<id>; judge.html?m=<id> открывает матч сразу после входа.

import { createStore, reasonText } from './core/store.js';
import { pairOf, playersOfPair, tournaments } from './core/data.js';
import { isLegalFinal, isLegalTiebreak, makeFormat } from './core/score.js';
import { pairPlate, updatePairPlate, pairBall } from './core/card.js';
import { mountProtoBar } from './core/protobar.js';

mountProtoBar({ current: 'judge', demo: true });

// iPhone показывает нажатие кнопки (:active) только если на странице есть обработчик касания
document.addEventListener('touchstart', () => {}, { passive: true });

const store = createStore();
const LOCK_MS = 350;                 // защита от двойного нажатия после очка
const LS_SESSION = 'tlts-judge-session';
const LS_THEME = 'tlts-judge-theme';

const $ = (id) => document.getElementById(id);
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим — живём без памяти */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* нет доступа */ } },
};

/** Маленький помощник для разметки: h('p', { class: 'x' }, 'текст', node). */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}

// ---------------------------------------------------------------- данные

const DEMO_T = tournaments.find((t) => t.id === 't-demo');
const COURT_ORDER = DEMO_T ? DEMO_T.courts : [];

function demoMatches() {
  return store.matches()
    .filter((m) => m.dataset === 'demo')
    .sort((a, b) => (COURT_ORDER.indexOf(a.court) - COURT_ORDER.indexOf(b.court)) || String(a.scheduled).localeCompare(String(b.scheduled)));
}

/** Матч ещё не начат — плашка без счёта, чтобы «0 : 0» не выглядел как идущий матч. */
function plateOpts(m, v, side, size) {
  return m.status === 'upcoming' ? { size } : { size, view: v, side };
}
function pairPlayers(pairId) { return playersOfPair(pairId).filter(Boolean); }
/** «Оспанов и Жаксыбеков» */
function pairName(pairId) { return pairPlayers(pairId).map((p) => p.last).join(' и '); }
function sideName(m, side) { return pairName(m.pairs[side]); }
function pairKprs(pairId) { const ps = pairPlayers(pairId); return [ps[0]?.kpr ?? null, ps[1]?.kpr ?? null]; }

function fmtDate(iso) {
  const [y, mo, d] = String(iso || '').split('-');
  return y && mo && d ? `${d}.${mo}.${y}` : '[ДАТА]';
}

function formatText(f) {
  const ff = makeFormat(f || {});
  const len = ff.gamesToWin === 6 ? 'сет до 6' : `сет до ${ff.gamesToWin}`;
  return ff.deuce === 'deciding' ? `${len}, сразу решающее очко` : len;
}
const MODE_TEXT = { points: 'по очкам', games: 'по геймам', final: 'только итог' };

function statusTag(m, v = null) {
  if (m.status === 'live') return h('span', { class: 'tag tag--live', text: 'LIVE' });
  if (m.status === 'finished') {
    // неявка, снятие, прерван — словами исхода; доигранный — «Завершён»
    const word = v && v.outcome && v.outcome !== 'played' ? v.label : 'Завершён';
    return h('span', { class: 'tag tag--done', text: word || 'Завершён' });
  }
  return h('span', { class: 'tag tag--soon', text: `Скоро · ${m.scheduled || '[ВРЕМЯ]'}` });
}

/** Что сделает «Отменить» — по последнему событию журнала. */
function describeEvent(ev, m) {
  if (!ev) return '';
  const who = (s) => (s === 0 || s === 1 ? sideName(m, s) : '');
  switch (ev.t) {
    case 'point': return `очко: ${who(ev.side)}`;
    case 'game': return ev.tiebreak ? `тай-брейк ${ev.tiebreak[0]}:${ev.tiebreak[1]}: ${who(ev.side)}` : `гейм: ${who(ev.side)}`;
    case 'penaltyPoint': return `штрафное очко: ${who(ev.to)}`;
    case 'penaltyGame': return `штрафной гейм: ${who(ev.to)}`;
    case 'warning': return `предупреждение: ${who(ev.to)}`;
    case 'final': return `итог ${ev.games[0]}:${ev.games[1]}${ev.tiebreak ? `, тай-брейк ${ev.tiebreak[0]}:${ev.tiebreak[1]}` : ''}`;
    case 'walkover': {
      const retired = ev.kind ? ev.kind === 'retired' : !!(ev.reason && /снят/i.test(ev.reason));
      return `${retired ? 'снятие' : 'неявку'}, победа: ${who(ev.winner)}`;
    }
    case 'stop': return 'остановку матча';
    case 'resume': return 'продолжение матча';
    case 'setMode': return `смену способа: «${MODE_TEXT[ev.mode] || ev.mode}»`;
    default: return 'последнее действие';
  }
}
/** Короткая кнопка отмены на карточке конца матча: «Нет, вернуть последнее очко». */
function undoEndLabel(ev) {
  switch (ev && ev.t) {
    case 'point': return 'Нет, вернуть последнее очко';
    case 'game': return ev.tiebreak || ev.side === undefined ? 'Нет, вернуть тай-брейк' : 'Нет, вернуть последний гейм';
    case 'penaltyPoint': return 'Нет, вернуть штрафное очко';
    case 'penaltyGame': return 'Нет, вернуть штрафной гейм';
    case 'final': return 'Нет, исправить итог';
    case 'walkover': return ev.kind === 'noshow' ? 'Нет, отменить неявку' : 'Нет, отменить снятие';
    default: return 'Нет, вернуть последнее действие';
  }
}
/** «7:6, тай-брейк 7:4» · «6:3» · «неявка» · «снятие при счёте 4:3» · «прерван при 2:1» — из движка. */
function scoreLine(v) { return v ? v.scoreLong || '' : ''; }
const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Отправить событие; true — хранилище его приняло. При отказе — объяснение в строке действия. */
function send(id, ev) {
  const r = store.tryEvent(id, ev);
  if (r.accepted) return true;
  if (r.reason === 'not-started' && current.screen === 'play' && current.id === id) {
    backToSetup(id, 'Матч сброшен в другой вкладке: счёт начат заново. Выберите настройки ещё раз.');
  } else if (play && r.reason && r.reason !== 'unchanged') {
    freshAction(`Не записано: ${reasonText(r.reason).toLowerCase()}`);
  }
  return false;
}

// ---------------------------------------------------------------- тема

function applyTheme(dark) {
  document.body.dataset.layer = dark ? 'air' : 'paper';
  document.documentElement.dataset.layer = dark ? 'air' : 'paper';
  $('darkSwitch').setAttribute('aria-checked', dark ? 'true' : 'false');
  $('darkQuick').setAttribute('aria-pressed', dark ? 'true' : 'false');
  // судья выбрал вид сам — строка состояния телефона следует ему, а не системе
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.content = dark ? '#0F1424' : '#EDEFEA';
}
applyTheme(ls.get(LS_THEME) === 'dark');
function toggleTheme() {
  const dark = document.body.dataset.layer !== 'air';
  ls.set(LS_THEME, dark ? 'dark' : 'light');
  applyTheme(dark);
}
$('darkSwitch').addEventListener('click', toggleTheme);
// на телефоне шапка на экране счёта скрыта — там тот же переключатель стоит кнопкой в верхней строке
$('darkQuick').addEventListener('click', toggleTheme);

// ---------------------------------------------------------------- вход

function session() {
  try { return JSON.parse(ls.get(LS_SESSION) || 'null'); } catch { return null; }
}
function maskPhone(raw) {
  const d = raw.replace(/\D/g, '');
  return `··· ${d.slice(-4, -2)} ${d.slice(-2)}`;
}

$('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const phone = $('phone').value.trim();
  const code = $('code').value.trim();
  const digits = phone.replace(/\D/g, '');
  let err = null;
  if (digits.length < 10 || digits.length > 12) err = 'Введите номер телефона полностью, например +7 701 123 45 67.';
  else if (!/^\d{4}$/.test(code)) err = 'Код — ровно четыре цифры.';
  const box = $('loginErr');
  if (err) {
    box.textContent = err; box.hidden = false;
    (digits.length < 10 || digits.length > 12 ? $('phone') : $('code')).focus();
    return;
  }
  box.hidden = true;
  // храним только маску номера: в прототипе он больше ни для чего не нужен
  ls.set(LS_SESSION, JSON.stringify({ phone: maskPhone(phone), at: Date.now() }));
  $('code').value = '';
  go(wantedRoute() || '#/matches');
});
$('code').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });

$('logout').addEventListener('click', () => { leavePlay(); ls.del(LS_SESSION); go('#/login'); });

/** judge.html?m=<id> (кнопка «Вести счёт» на афише): адрес матча; ?m из адреса убираем, чтобы «Назад» не возвращал туда же. */
function wantedRoute() {
  let want = null;
  try { want = new URLSearchParams(location.search).get('m'); } catch { /* нет адреса */ }
  if (!want) return null;
  const m = store.match(want);
  try {
    const u = new URL(location.href);
    u.searchParams.delete('m');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch { /* старый браузер — оставим как есть */ }
  if (!m) missingMatch(want);
  return m ? routeFor(m) : null;
}

/** Матча из адреса нет: сообщение покажем над списком матчей. */
let missingText = null;
function missingMatch(id) {
  const name = String(id).length > 40 ? `${String(id).slice(0, 40)}…` : String(id);
  missingText = `Матча «${name}» нет — выберите матч из списка.`;
}

// ---------------------------------------------------------------- маршруты

let current = { screen: null, id: null };

function routeFor(m) {
  return m.status === 'upcoming' ? `#/setup/${m.id}` : `#/play/${m.id}`;
}
function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

function route() {
  const s = session();
  // уже вошёл и пришёл по ссылке ?m= — сразу в матч
  if (s && !location.hash.replace(/^#\/?/, '')) {
    const want = wantedRoute();
    if (want) { location.replace(want); return; }
  }
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  let screen = parts[0] || 'matches';
  let id = parts[1] ? decodeURIComponent(parts[1]) : null;
  if (!s) { screen = 'login'; id = null; }
  else if (screen === 'login') screen = 'matches';
  if ((screen === 'setup' || screen === 'play') && !(id && store.match(id))) {
    if (id) {
      missingMatch(id);
      try { history.replaceState(history.state, '', '#/matches'); } catch { /* оставим адрес как есть */ }
    }
    screen = 'matches'; id = null;
  }
  // матч уже начат — «перед началом» не нужен
  if (screen === 'setup' && store.match(id).status !== 'upcoming') screen = 'play';
  // ушли со счёта (или на другой матч) — матч больше не держим
  if (current.screen === 'play' && (screen !== 'play' || id !== current.id)) leavePlay();
  if (screen !== 'setup') $('setupFlash').hidden = true;
  current = { screen, id };
  for (const el of document.querySelectorAll('.jd-screen')) el.hidden = true;
  $('top').hidden = screen === 'login';
  $('conn').hidden = screen === 'login';
  if (s) $('whoPhone').textContent = s.phone || '';
  document.body.classList.toggle('is-play', screen === 'play');
  if (screen === 'login') { $('scrLogin').hidden = false; }
  if (screen === 'matches') {
    renderList(); $('scrList').hidden = false;
    if (missingText) { flash(missingText); missingText = null; }
  }
  if (screen === 'setup') { renderSetup(id); $('scrSetup').hidden = false; }
  if (screen === 'play') { openPlay(id); $('scrPlay').hidden = false; }
  if (screen !== 'play') releaseWake();
  window.scrollTo(0, 0);
  const focusTarget = screen === 'login' ? $('phone') : document.querySelector(`#${screenId(screen)} h1`);
  if (focusTarget) { if (!focusTarget.hasAttribute('tabindex') && focusTarget.tagName === 'H1') focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true }); }
}
const screenId = (s) => ({ login: 'scrLogin', matches: 'scrList', setup: 'scrSetup', play: 'scrPlay' }[s]);
window.addEventListener('hashchange', route);

// ---------------------------------------------------------------- 2. мои матчи

const listPlates = new Map();   // id → [plate0, plate1]
let flashTimer = null;

function flash(text) {
  const el = $('listFlash');
  el.textContent = text; el.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

function renderList() {
  $('listMeta').textContent = DEMO_T ? `${DEMO_T.name} · ${fmtDate(DEMO_T.date)} · ${DEMO_T.venue}` : 'Демо-вечер';
  const root = $('matchList');
  root.textContent = '';
  listPlates.clear();
  const byCourt = new Map();
  for (const m of demoMatches()) {
    if (!byCourt.has(m.court)) byCourt.set(m.court, []);
    byCourt.get(m.court).push(m);
  }
  for (const [court, list] of byCourt) {
    const sec = h('section', { class: 'jd-court', 'aria-label': court });
    sec.append(h('h2', { class: 'jd-court__h' }, court));
    for (const m of list) sec.append(listItem(m));
    root.append(sec);
  }
}

function listItem(m) {
  const v = store.view(m.id);
  const li = h('article', { class: 'jd-match', 'data-id': m.id, 'data-status': m.status });
  const head = h('div', { class: 'jd-match__head' },
    h('span', { class: 'jd-match__time num', text: m.scheduled || '[ВРЕМЯ]' }),
    h('span', { class: 'jd-match__stage', text: m.stage }),
    h('span', { class: 'jd-match__tag' }, statusTag(m)));
  const plates = m.pairs.map((pid, side) => pairPlate(pairOf(pid), pairPlayers(pid), plateOpts(m, v, side, 'sm')));
  listPlates.set(m.id, plates);
  const meta = h('p', { class: 'jd-match__meta cap' });
  const acts = h('div', { class: 'jd-match__acts' });
  li.append(head, h('div', { class: 'jd-match__plates' }, plates), meta, acts);
  fillListItem(li, m, v);
  return li;
}

function fillListItem(li, m, v) {
  li.dataset.status = m.status;
  li.querySelector('.jd-match__tag').replaceChildren(statusTag(m, v));
  const meta = li.querySelector('.jd-match__meta');
  const bits = [MODE_TEXT[m.mode] || m.mode, formatText(m.format)];
  if (m.status === 'finished') bits.unshift(v && v.outcome && v.outcome !== 'played' ? v.outcomeText : `итог ${scoreLine(v)}`);
  if (m.autoplay) bits.push('идёт демо-автоигра');
  if (store.isClaimedByOther(m.id)) bits.push('ведёт судья в другой вкладке');
  meta.textContent = bits.join(' · ');
  const acts = li.querySelector('.jd-match__acts');
  acts.textContent = '';
  if (m.status === 'upcoming') acts.append(h('a', { class: 'btn btn--primary btn--block', href: `#/setup/${m.id}` }, 'Начать'));
  else if (m.status === 'live') acts.append(h('a', { class: 'btn btn--primary btn--block', href: `#/play/${m.id}` }, 'Продолжить'));
  else acts.append(h('a', { class: 'btn btn--secondary btn--block', href: `#/play/${m.id}` }, 'Исправить счёт'));
}

function updateList(id) {
  const ids = id ? [id] : [...listPlates.keys()];
  for (const mid of ids) {
    const plates = listPlates.get(mid);
    const li = document.querySelector(`.jd-match[data-id="${CSS.escape(mid)}"]`);
    const m = store.match(mid);
    if (!plates || !li || !m) continue;
    const v = store.view(mid);
    plates.forEach((el, side) => updatePairPlate(el, m.status === 'upcoming' ? {} : { view: v, side }));
    fillListItem(li, m, v);
  }
}

$('resetAll').addEventListener('click', async () => {
  const ok = await ask({
    title: 'Вернуть демо-вечер к началу?',
    body: 'Все шесть матчей демо-вечера вернутся к исходному счёту на всех открытых вкладках: финал снова ждёт судью. Архив не меняется.',
    ok: 'Вернуть к началу',
  });
  if (!ok) return;
  const skipped = [];
  for (const m of demoMatches()) {
    // матч, который ведёт судья в другой вкладке, не трогаем
    if (store.isClaimedByOther(m.id)) { skipped.push(m); continue; }
    store.stopAutoplay(m.id);
    if (store.tryReset(m.id).reason === 'claimed') skipped.push(m);
  }
  renderList();
  flash(skipped.length
    ? `Демо-вечер вернулся к началу, кроме матча, который ведёт судья в другой вкладке: ${skipped.map((m) => `${m.court}, ${m.stage}`).join('; ')}.`
    : 'Демо-вечер вернулся к началу.');
});

// ---------------------------------------------------------------- 3. перед началом

function renderSetup(id) {
  const m = store.match(id);
  $('setupMeta').textContent = `${m.court} · ${m.stage} · ${m.scheduled || ''}`;
  const v = store.view(id);
  $('setupPlates').replaceChildren(...m.pairs.map((pid, side) => pairPlate(pairOf(pid), pairPlayers(pid), { ...plateOpts(m, v, side, 'md'), seed: true })));
  const f = makeFormat(m.format || {});
  const form = $('setupForm');
  form.reset();
  form.elements.mode.value = m.mode || 'points';
  form.elements.len.value = String(f.gamesToWin);
  $('decidingBox').checked = f.deuce === 'deciding';
  const so = $('serverOpts');
  so.textContent = '';
  m.pairs.forEach((pid, side) => {
    const [a, b] = pairKprs(pid);
    so.append(h('label', { class: 'jd-opt jd-opt--pair' },
      h('input', { type: 'radio', name: 'server', value: String(side) }),
      h('span', {}, pairBall(a, b, { size: 36, decorative: true }), h('b', {}, pairName(pid)))));
  });
  $('setupErr').hidden = true;
  syncSetup();
}
function syncSetup() {
  const mode = $('setupForm').elements.mode.value;
  $('serverStep').hidden = mode === 'final';
  $('shortTbHint').hidden = $('setupForm').elements.len.value === '6';
}
$('modeOpts').addEventListener('change', syncSetup);
$('lenOpts').addEventListener('change', syncSetup);

$('setupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = current.id;
  const m = store.match(id);
  if (!m) return;
  const form = $('setupForm');
  const mode = form.elements.mode.value;
  const server = form.elements.server.value;
  if (mode !== 'final' && server === '') {
    const err = $('setupErr');
    err.textContent = 'Отметьте, кто подаёт первым: от этого зависит точка подачи на табло.';
    err.hidden = false;
    form.querySelector('input[name="server"]').focus();
    return;
  }
  const format = { gamesToWin: Number(form.elements.len.value), deuce: $('decidingBox').checked ? 'deciding' : 'league' };
  if (m.status === 'upcoming') {
    if (store.isAutoplaying(id)) store.stopAutoplay(id);
    store.start(id, { mode, format, firstServer: server === '1' ? 1 : 0 });
  }
  $('setupFlash').hidden = true;
  go(`#/play/${id}`);
});

$('noShowBtn').addEventListener('click', async () => {
  const m = store.match(current.id);
  if (!m) return;
  await walkoverFlow(m, 'noshow');
});

/** Неявка до начала ('noshow') или снятие пары по ходу матча ('retired'). */
async function walkoverFlow(m, kind) {
  const noshow = kind === 'noshow';
  const v = store.view(m.id);
  const at = v ? `${v.games[0]}:${v.games[1]}` : '0:0';
  const absent = await ask({
    title: noshow ? 'Какая пара не явилась?' : 'Какая пара снялась?',
    body: noshow
      ? 'Неявка через 20 минут после вызова — поражение без счёта (0:0). Победа присуждается сопернику.'
      : `Снятие — поражение без счёта (0:0), победа сопернику. Счёт на момент снятия останется в протоколе: «Снятие при счёте ${at}». Правило уточняется у лиги.`,
    choices: m.pairs.map((pid, side) => ({ value: side, label: pairName(pid), kprs: pairKprs(pid) })),
    ok: 'Дальше',
  });
  if (absent === null) return;
  const winner = 1 - absent;
  const sure = await ask({
    title: noshow ? 'Записать неявку?' : 'Записать снятие?',
    body: noshow
      ? `Не явились: ${sideName(m, absent)}. Победа без счёта: ${sideName(m, winner)}. Исход: «Неявка».`
      : `Снялись: ${sideName(m, absent)}. Победа: ${sideName(m, winner)}. Исход: «Снятие при счёте ${at}».`,
    ok: noshow ? 'Да, неявка' : 'Да, снятие',
  });
  if (!sure) return;
  if (store.isAutoplaying(m.id)) store.stopAutoplay(m.id);
  const ok = send(m.id, { t: 'walkover', winner, kind: noshow ? 'noshow' : 'retired', reason: noshow ? 'Неявка через 20 минут после вызова' : 'Снятие пары' });
  if (!ok) return;
  if (current.screen === 'play' && current.id === m.id) { buzz(40); freshAction(noshow ? 'Записана неявка' : `Записано снятие при счёте ${at}`); }
  else go(`#/play/${m.id}`);
}

/** «Матч прерван» (погода, темнота): победителя нет, матч можно продолжить. */
async function stopFlow(m) {
  const v = store.view(m.id);
  const at = `${v.games[0]}:${v.games[1]}`;
  const reason = await ask({
    title: 'Почему матч прерван?',
    body: 'Победителя нет. Счёт и подача сохранятся, матч можно продолжить позже через «Исправить счёт».',
    choices: [
      { value: 'Погода', label: 'Погода', hint: 'дождь, ветер' },
      { value: 'Темнота', label: 'Темнота', hint: 'нет освещения' },
      { value: 'Другое', label: 'Другая причина', hint: 'травма без снятия, корт занят' },
    ],
    ok: 'Дальше',
  });
  if (reason === null) return;
  const sure = await ask({
    title: `Прервать матч при ${at}?`,
    body: `Исход: «Прерван при ${at}» (${reason.toLowerCase()}). Победителя нет, на табло пропадут очки гейма и подача.`,
    ok: 'Да, прервать',
  });
  if (!sure) return;
  if (store.isAutoplaying(m.id)) store.stopAutoplay(m.id);
  store.finish(m.id, { reason });
  const nv = store.view(m.id);
  if (nv && nv.outcome === 'stopped') { buzz(40); freshAction(`Матч прерван при ${at}`); }
}

// ---------------------------------------------------------------- 4–7. счёт

let play = null;   // { id, plates, buttons, lockUntil, fresh }

function openPlay(id) {
  play = null;
  // судья держит матч, пока открыт экран счёта: чужие «Сбросить» и автоигра его не трогают
  const claim = store.claim(id, { role: 'judge' });
  const wasAuto = store.isAutoplaying(id);
  // судья берёт матч в свои руки: автоигру останавливаем, чтобы счёт не шёл сам
  if (wasAuto && claim.accepted) store.stopAutoplay(id);
  const m = store.match(id);
  const v = store.view(id);
  const plates = m.pairs.map((pid, side) => pairPlate(pairOf(pid), pairPlayers(pid), { size: 'lg', view: v, side }));
  $('boardPlates').replaceChildren(...plates);
  play = { id, plates, buttons: null, buttonsKey: null, lockUntil: 0, freshTimer: null, finalDraft: null, finalKey: null, lostClaim: !claim.accepted, epoch: m.epoch || 0 };
  $('playTitle').textContent = `${m.court} · ${m.stage}`;
  renderLinks($('playLinks'), id);
  renderPlay();
  if (wasAuto && claim.accepted) freshAction('Демо-автоигра остановлена: дальше счёт ведёте вы');
  requestWake();
}

/** Уходим со счёта: матч свободен для табло, афиши и других судей. */
function leavePlay() {
  // play обнуляем до release: подписка не должна снова взять матч
  const id = play ? play.id : current.screen === 'play' ? current.id : null;
  if (play) clearTimeout(play.freshTimer);
  play = null;
  if (id) store.release(id);
}

/** Матч сбросили в другой вкладке: назад на «Перед началом» с объяснением. */
function backToSetup(id, text) {
  leavePlay();
  const el = $('setupFlash');
  el.textContent = text;
  el.hidden = false;
  go(`#/setup/${id}`);
}

/** «Табло корта» и «Афиша матча» — в новой вкладке, чтобы судья не уходил со счёта. */
function renderLinks(box, id) {
  const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  const a1 = h('a', { class: 'jd-link', href: `board.html?view=court&m=${encodeURIComponent(id)}`, target: '_blank', rel: 'noopener' }, 'Открыть табло корта');
  const a2 = h('a', { class: 'jd-link', href: `match.html?m=${encodeURIComponent(id)}`, target: '_blank', rel: 'noopener' }, 'Афиша матча');
  for (const a of [a1, a2]) { a.insertAdjacentHTML('beforeend', arrow); a.append(h('span', { class: 'vh', text: ' (откроется в новой вкладке)' })); }
  box.replaceChildren(a1, a2);
}

/** Плашка над счётом: идёт автоигра или матч держит судья в другой вкладке. */
function renderNotice(m) {
  const box = $('playNotice');
  const other = store.isClaimedByOther(m.id);
  const auto = store.isAutoplaying(m.id);
  // матч у нас перехватили, а потом отпустили: сами не берём, но предлагаем
  const free = !other && !auto && play && play.lostClaim && !store.claimOf(m.id);
  const key = other ? 'other' : auto ? 'auto' : free ? 'free' : '';
  box.hidden = !key;
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  if (key === 'auto') {
    box.replaceChildren(
      h('p', { class: 'jd-notice__t' }, h('b', { text: 'Идёт демо-автоигра' }), ' · очки идут сами'),
      h('button', { type: 'button', class: 'btn btn--secondary btn--sm', id: 'autoStop', onclick: () => {
        store.stopAutoplay(m.id);
        if (play) freshAction('Демо-автоигра остановлена: дальше счёт ведёте вы');
      } }, 'Остановить'));
  } else if (key === 'other' || key === 'free') {
    box.replaceChildren(
      key === 'other'
        ? h('p', { class: 'jd-notice__t' }, h('b', { text: 'Матч ведёт судья в другой вкладке' }), ' · нажатия здесь смешаются с его счётом')
        : h('p', { class: 'jd-notice__t' }, h('b', { text: 'Другая вкладка отпустила матч' }), ' · здесь он не закреплён за вами'),
      h('button', { type: 'button', class: 'btn btn--secondary btn--sm', id: 'claimTake', onclick: () => {
        const r = store.claim(m.id, { role: 'judge', force: true });
        if (r.accepted && play) { play.lostClaim = false; if (store.isAutoplaying(m.id)) store.stopAutoplay(m.id); freshAction('Матч теперь ведёте вы'); }
      } }, 'Вести здесь'));
  } else box.textContent = '';
}

function renderPlay() {
  if (!play) return;
  const m = store.match(play.id);
  if (!m) return;
  const v = store.view(play.id);
  play.plates.forEach((el, side) => updatePairPlate(el, { view: v, side }));
  $('playTag').replaceChildren(statusTag(m, v));
  renderState(m, v);
  renderNotice(m);

  const finished = m.status === 'finished' || v.finished;
  const isFinalMode = v.mode === 'final' && !finished;
  $('hitArea').hidden = finished || isFinalMode;
  $('finalArea').hidden = !isFinalMode;
  $('endArea').hidden = !finished;
  // конец матча: одна кнопка отмены — на карточке; строка действия и плитка «Отменить» прячутся
  $('lastLine').hidden = finished || (isFinalMode && !v.canUndo);
  $('undoBtn').hidden = finished;
  $('tools').classList.toggle('jd-tools--one', finished);
  $('playLinks').hidden = finished;   // на карточке конца матча свои ссылки
  if (finished) renderEnd(m, v);
  else if (isFinalMode) renderFinal(m, v);
  else renderHit(m, v);

  // нижняя панель
  const undo = $('undoBtn');
  undo.disabled = !v.canUndo;
  $('undoDesc').textContent = v.canUndo ? cap1(describeEvent(v.lastEvent, m)) : 'отменять нечего';
  $('moreBtn').disabled = false;
  $('moreDesc').textContent = finished ? 'сбросить матч' : 'штрафы, неявка, способ счёта';
  if (!play.fresh) setLast(v.lastEvent ? `Последнее: ${describeEvent(v.lastEvent, m)}` : v.mode === 'games' ? 'Пока ни одного гейма' : 'Пока ни одного очка', false);
  $('lastUndo').hidden = !v.canUndo;
  document.body.dataset.mode = v.mode;
}

function renderState(m, v) {
  let label = v.label || '';
  let sub = '';
  const warnHint = () => [0, 1].filter((s) => v.warnings && v.warnings[s] > 0)
    .map((s) => `предупреждение: ${sideName(m, s)}, следующее нарушение — штрафное очко`).join(' · ');
  if (v.outcome && v.outcome !== 'played') {
    // неявка, снятие, прерван — подпись движка; очков и подачи у такого матча нет
    label = v.outcomeText;
    sub = v.outcome === 'stopped' ? 'победителя нет · матч можно продолжить' : `победа: ${sideName(m, v.winner)}`;
  }
  else if (v.finished) { label = `Матч окончен · ${v.games[0]}:${v.games[1]}`; if (v.tiebreak) sub = `тай-брейк ${v.tiebreak[0]}:${v.tiebreak[1]}`; }
  else if (v.label === 'Больше' && v.advantage !== null) sub = `у пары ${sideName(m, v.advantage)}`;
  else if (v.inTiebreak && v.mode === 'games') sub = 'по геймам: победителя тай-брейка — одной кнопкой';
  else if (v.inTiebreak) sub = 'до 7 очков, разница в два';
  // тай-брейка в коротком сете в регламенте нет
  if (v.inTiebreak && !v.finished && shortSet(v.format)) sub = `${sub} · ${shortTbNote(v.format)}`;
  if (!label && !v.finished) {
    if (v.matchPoint !== null) label = 'Матчбол';
    else label = v.mode === 'games' ? 'Идёт сет' : v.mode === 'final' ? 'Ожидается итог' : 'Идёт гейм';
  }
  if (v.matchPoint !== null && !v.finished && label !== 'Матчбол') sub = [sub, `матчбол: ${sideName(m, v.matchPoint)}`].filter(Boolean).join(' · ');
  else if (label === 'Матчбол') sub = sideName(m, v.matchPoint);
  if (!sub) sub = `${MODE_TEXT[v.mode]} · ${formatText(v.format)}`;
  if (!v.finished && warnHint()) sub = `${sub} · ${warnHint()}`;
  $('boardLabel').textContent = label;
  $('boardSub').textContent = sub;
  const st = $('boardState');
  st.dataset.kind = v.decidingPoint ? 'deciding' : v.inTiebreak ? 'tiebreak' : v.finished || m.status === 'finished' ? 'done' : v.label ? 'deuce' : 'plain';
  // для проверки: что видно на экране, одной строкой
  $('board').dataset.shown = JSON.stringify({ games: v.games, points: v.points, tiebreak: v.inTiebreak ? v.tiebreak : null, label: v.label });
}

/** Главные кнопки. Перестраиваются только при смене вида (очко / гейм / тай-брейк), иначе обновляются на месте. */
function renderHit(m, v) {
  const kind = v.mode === 'games' ? (v.inTiebreak ? 'tb' : 'game') : 'point';
  const key = `${kind}`;
  const area = $('hitArea');
  if (play.buttonsKey !== key || !play.buttons) {
    play.buttons = m.pairs.map((pid, side) => {
      const [a, b] = pairKprs(pid);
      const ps = pairPlayers(pid);
      const word = kind === 'point' ? 'Очко' : kind === 'game' ? 'Гейм' : 'Тай-брейк';
      const btn = h('button', {
        type: 'button', class: `jd-hitbtn jd-hitbtn--${side}`, 'data-side': String(side),
        'aria-label': `${kind === 'tb' ? 'Тай-брейк выиграли' : word}: ${pairName(pid)}`,
      },
      h('span', { class: 'jd-hitbtn__ball' }, pairBall(a, b, { size: 52, decorative: true })),
      h('span', { class: 'jd-hitbtn__names' }, ...ps.map((p) => h('span', { class: 'jd-hitbtn__n', text: p.last }))),
      h('span', { class: 'jd-hitbtn__word' },
        kind === 'tb' ? h('small', { text: 'выиграли' }) : null,
        h('b', { text: word }),
        h('span', { class: 'jd-hitbtn__serve' }, h('i', { 'aria-hidden': 'true' }), 'подача')),
      h('span', { class: 'jd-hitbtn__lock', 'aria-hidden': 'true' }));
      btn.addEventListener('click', () => onHit(side));
      return btn;
    });
    play.buttonsKey = key;
    area.replaceChildren(...play.buttons);
    area.dataset.kind = kind;
    fitNames();
  }
  play.buttons.forEach((btn, side) => btn.classList.toggle('is-serving', v.server === side));
}

/** Длинная фамилия на узком телефоне (320) не обрезается: кегль фамилий кнопки уменьшается, пока обе не влезут. */
const NAME_MIN_PX = 14;
function fitNames() {
  if (!play || !play.buttons) return;
  for (const btn of play.buttons) {
    const names = [...btn.querySelectorAll('.jd-hitbtn__n')];
    for (const n of names) n.style.fontSize = '';
    if (!btn.isConnected || !btn.offsetWidth) continue;
    let size = parseFloat(getComputedStyle(names[0]).fontSize) || 19;
    // обе фамилии одной пары — одним кеглем, чтобы пара читалась ровно
    for (let i = 0; i < 12 && size > NAME_MIN_PX && names.some((n) => n.scrollWidth > n.clientWidth + 0.5); i++) {
      const worst = Math.min(...names.map((n) => n.clientWidth / Math.max(1, n.scrollWidth)));
      size = Math.max(NAME_MIN_PX, Math.floor(size * Math.min(worst, 0.97) * 2) / 2);
      for (const n of names) n.style.fontSize = `${size}px`;
    }
  }
}
let fitRaf = 0;
window.addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitNames); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitNames());
if (document.fonts && 'onloadingdone' in document.fonts) document.fonts.addEventListener('loadingdone', () => fitNames());

function locked() { return play && performance.now() < play.lockUntil; }
function lock() {
  play.lockUntil = performance.now() + LOCK_MS;
  const area = $('hitArea');
  area.classList.remove('is-locked'); void area.offsetWidth; area.classList.add('is-locked');
  for (const b of play.buttons || []) b.setAttribute('aria-disabled', 'true');
  setTimeout(() => {
    if (!play) return;
    area.classList.remove('is-locked');
    for (const b of play.buttons || []) b.removeAttribute('aria-disabled');
  }, LOCK_MS);
}
function buzz(ms = 25) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* не умеет */ } }

async function onHit(side) {
  if (!play || locked()) return;
  const m = store.match(play.id);
  const v = store.view(play.id);
  if (!m || v.finished) return;
  if (v.mode === 'games' && v.inTiebreak) { await tiebreakFlow(m, side); return; }
  const ev = v.mode === 'games' ? { t: 'game', side } : { t: 'point', side };
  if (!send(play.id, ev)) return;
  buzz();
  lock();
  freshAction(`${ev.t === 'game' ? 'Гейм' : 'Очко'}: ${sideName(m, side)}`);
}

/** По геймам при 6:6: «Тай-брейк выиграли…», счёт тай-брейка — по желанию. */
async function tiebreakFlow(m, side) {
  const n = makeFormat(m.format).gamesToWin;
  const fields = h('div', { class: 'jd-tbinput' },
    h('p', { class: 'field__hint', text: 'Счёт тай-брейка можно не указывать. Если указываете — до 7 очков с разницей в два, например 7:4 или 10:8.' }),
    h('div', { class: 'jd-tbinput__row' },
      ...[0, 1].map((s) => h('label', { class: 'field' },
        h('span', { class: 'field__label', text: sideName(m, s) }),
        h('input', { class: 'input input--num', name: `tb${s}`, type: 'text', inputmode: 'numeric', maxlength: '2', placeholder: s === side ? '7' : '—', autocomplete: 'off' })))));
  const res = await ask({
    title: `Тай-брейк выиграли ${sideName(m, side)}?`,
    body: [h('p', { text: `Итог сета будет ${side === 0 ? `${n + 1}:${n}` : `${n}:${n + 1}`}. Матч закончится.` }), fields],
    ok: 'Да, записать',
    validate(form) {
      const a = form.elements.tb0.value.trim(); const b = form.elements.tb1.value.trim();
      if (!a && !b) return null;
      if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return 'Укажите оба числа тай-брейка или оставьте оба поля пустыми.';
      const tb = [Number(a), Number(b)];
      if (!isLegalTiebreak(m.format, tb)) return `Тай-брейк ${tb[0]}:${tb[1]} невозможен: играют до 7 очков с разницей в два.`;
      if ((tb[0] > tb[1] ? 0 : 1) !== side) return `По такому счёту тай-брейк выиграли не ${sideName(m, side)}.`;
      return null;
    },
    collect(form) {
      const a = form.elements.tb0.value.trim(); const b = form.elements.tb1.value.trim();
      return a && b ? [Number(a), Number(b)] : true;
    },
  });
  if (!res) return;
  // гейм тай-брейка; счёт тай-брейка — по желанию. Лента геймов сохраняется.
  const ev = Array.isArray(res) ? { t: 'game', side, tiebreak: res } : { t: 'game', side };
  if (send(m.id, ev)) { buzz(40); freshAction(`Тай-брейк: ${sideName(m, side)}${Array.isArray(res) ? ` ${res[0]}:${res[1]}` : ''}`); }
}

function freshAction(text) {
  setLast(text, true);
  clearTimeout(play.freshTimer);
  play.fresh = true;
  play.freshTimer = setTimeout(() => { if (play) { play.fresh = false; renderPlay(); } }, 4000);
}
function setLast(text, fresh) {
  $('lastText').textContent = text;
  $('lastLine').classList.toggle('is-fresh', !!fresh);
}

function doUndo() {
  if (!play) return;
  const m = store.match(play.id);
  const v = store.view(play.id);
  if (!v || !v.canUndo) return;
  const what = describeEvent(v.lastEvent, m);
  if (!send(play.id, { t: 'undo' })) return;
  buzz(15);
  play.lockUntil = 0;
  freshAction(`Отменено: ${what}`);
}
$('undoBtn').addEventListener('click', doUndo);
$('lastUndo').addEventListener('click', doUndo);

// ---- 6. только итог

/** Какие итоги сета бывают: «6:0 … 6:4, 7:5 или 7:6 через тай-брейк»; для сета до 2 — «2:0, 3:1 или 3:2 через тай-брейк». */
function winsText(n) {
  const clean = n - 2 > 0 ? `${n}:0 … ${n}:${n - 2}` : `${n}:0`;
  const text = `${clean}, ${n + 1}:${n - 1} или ${n + 1}:${n} через тай-брейк`;
  return n === 6 ? text : `${text} (тай-брейк при ${n}:${n} — уточняется у лиги)`;
}
/** Короткий сет (до 4 или до 2): тай-брейка при 4:4 и 2:2 в регламенте нет — «уточняется у лиги». */
function shortSet(format) { return makeFormat(format || {}).gamesToWin !== 6; }
function shortTbNote(format) { const n = makeFormat(format || {}).gamesToWin; return `тай-брейк при ${n}:${n} — уточняется у лиги`; }

function finalProblem(format, g) {
  const f = makeFormat(format);
  const n = f.gamesToWin;
  const [a, b] = g;
  const w = Math.max(a, b); const l = Math.min(a, b);
  if (isLegalFinal(f, g)) return null;
  if (w < n) return `Сет не окончен: одна из пар должна взять ${n} ${n === 2 || n === 4 ? 'гейма' : 'геймов'}.`;
  if (w === n && l === n - 1) return `${a}:${b} — так сет не заканчивается: при ${n}:${n - 1} играют дальше, до ${n + 1}:${n - 1} или до ${n}:${n} и тай-брейка.`;
  if (w === n && l === n) return `При ${n}:${n} играют тай-брейк, итог записывается как ${n + 1}:${n}.${n === 6 ? '' : ' Тай-брейк в коротком сете — уточняется у лиги.'}`;
  if (w === n + 1 && l < n - 1) return `${a}:${b} невозможно: сет закончился бы уже при ${n}:${l}.`;
  if (w > n + 1) return `Больше ${n + 1} геймов в сете не бывает.`;
  return `${a}:${b} — такой итог невозможен.`;
}

function renderFinal(m, v) {
  const n = makeFormat(m.format).gamesToWin;
  const key = `${m.id}:${n}`;
  if (play.finalKey !== key) {
    play.finalKey = key;
    play.finalDraft = v.games.slice();
    const area = $('finalArea');
    const rows = m.pairs.map((pid, side) => {
      const [ka, kb] = pairKprs(pid);
      return h('div', { class: 'jd-step-row', 'data-side': String(side) },
        h('span', { class: 'jd-step-row__who' }, pairBall(ka, kb, { size: 36, decorative: true }), h('b', { text: pairName(pid) })),
        h('span', { class: 'jd-stepper' },
          h('button', { type: 'button', class: 'jd-stepper__b', 'data-icon': 'minus', 'aria-label': `Убрать гейм: ${pairName(pid)}`, onclick: () => bump(side, -1) }),
          h('output', { class: 'jd-stepper__n num', 'aria-live': 'polite', 'aria-label': `Геймы: ${pairName(pid)}` }, '0'),
          h('button', { type: 'button', class: 'jd-stepper__b', 'data-icon': 'plus', 'aria-label': `Добавить гейм: ${pairName(pid)}`, onclick: () => bump(side, 1) })));
    });
    // иконки «минус» и «плюс»
    for (const b of rows.flatMap((r) => [...r.querySelectorAll('.jd-stepper__b')])) {
      const d = b.dataset.icon === 'plus' ? 'M5 12h14M12 5v14' : 'M5 12h14';
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}" stroke="currentColor" stroke-width="2.6" fill="none"/></svg>`;
    }
    const tb = h('div', { class: 'jd-final__tb', hidden: true },
      h('p', { class: 'field__label', text: 'Счёт тай-брейка — необязательно' }),
      h('div', { class: 'jd-tbinput__row' }, ...[0, 1].map((s) => h('input', { class: 'input input--num', type: 'text', inputmode: 'numeric', maxlength: '2', 'aria-label': `Тай-брейк: ${sideName(m, s)}`, 'data-tb': String(s), oninput: checkFinal }))));
    const msg = h('p', { class: 'jd-final__msg', id: 'finalMsg', role: 'status' });
    const submit = h('button', { type: 'button', class: 'btn btn--primary btn--lg btn--block', id: 'finalSubmit', onclick: submitFinal }, 'Записать итог');
    area.replaceChildren(
      h('h2', { class: 'jd-final__h', text: 'Итог матча' }),
      h('p', { class: 'field__hint', text: `${cap1(formatText(m.format))}. Сет выигран при счёте ${winsText(n)}.` }),
      ...rows, tb, msg, submit);
  }
  checkFinal();
}
function bump(side, d) {
  const g = play.finalDraft;
  const n = makeFormat(store.match(play.id).format).gamesToWin;
  g[side] = Math.max(0, Math.min(n + 1, g[side] + d));
  buzz(10);
  checkFinal();
}
function readFinalTb() {
  const ins = [...document.querySelectorAll('#finalArea [data-tb]')];
  const a = ins[0]?.value.trim() ?? ''; const b = ins[1]?.value.trim() ?? '';
  return { raw: [a, b], tb: a !== '' && b !== '' ? [Number(a), Number(b)] : null, partial: (a === '') !== (b === '') };
}
function checkFinal() {
  if (!play || !play.finalDraft) return null;
  const m = store.match(play.id);
  const n = makeFormat(m.format).gamesToWin;
  const g = play.finalDraft;
  document.querySelectorAll('#finalArea .jd-step-row').forEach((row, side) => {
    row.querySelector('output').textContent = String(g[side]);
    const [minus, plus] = row.querySelectorAll('.jd-stepper__b');
    minus.disabled = g[side] <= 0; plus.disabled = g[side] >= n + 1;
  });
  const tbBox = document.querySelector('#finalArea .jd-final__tb');
  const hasTb = Math.max(...g) === n + 1 && Math.min(...g) === n;
  tbBox.hidden = !hasTb;
  let problem = finalProblem(m.format, g);
  if (!problem && hasTb) {
    const { tb, partial } = readFinalTb();
    if (partial) problem = 'Укажите оба числа тай-брейка или оставьте оба поля пустыми.';
    else if (tb && !isLegalTiebreak(m.format, tb)) problem = `Тай-брейк ${tb[0]}:${tb[1]} невозможен: до 7 очков с разницей в два.`;
    else if (tb && (tb[0] > tb[1]) !== (g[0] > g[1])) problem = 'Тай-брейк должна выиграть та же пара, что и сет.';
  }
  const msg = $('finalMsg');
  const untouched = g[0] === 0 && g[1] === 0;
  msg.dataset.ok = problem ? 'no' : 'yes';
  msg.textContent = untouched ? 'Отметьте геймы каждой пары кнопками «+» и «−».'
    : problem ? problem : `Итог ${g[0]}:${g[1]} — победа: ${sideName(m, g[0] > g[1] ? 0 : 1)}.`;
  if (untouched) msg.dataset.ok = 'idle';
  return problem;
}
function submitFinal() {
  const problem = checkFinal();
  if (problem) { buzz(60); $('finalMsg').focus?.(); return; }
  const g = play.finalDraft.slice();
  const ev = { t: 'final', games: g };
  const { tb } = readFinalTb();
  if (tb) ev.tiebreak = tb;
  if (send(play.id, ev)) { buzz(40); play.finalKey = null; freshAction(`Итог: ${g[0]}:${g[1]}`); }
}

// ---- 7. конец матча

function renderEnd(m, v) {
  const area = $('endArea');
  const key = `${m.id}:${m.rev}`;
  if (area.dataset.key === key) return;
  area.dataset.key = key;
  const outcome = v.outcome || 'played';
  // доигранный: «Матч окончен, 7:6, тай-брейк 7:4»; остальное — подпись исхода из движка
  const title = outcome === 'played' ? `Матч окончен, ${v.scoreLong}` : v.outcomeText;
  const kids = [
    h('h2', { class: 'jd-end__h', id: 'endTitle', text: `${title}. Подтвердить?` }),
  ];
  if (v.winner === 0 || v.winner === 1) kids.push(h('p', { class: 'jd-end__win' }, h('span', { class: 'cap', text: 'Победа' }), h('b', { text: sideName(m, v.winner) })));
  if (outcome === 'stopped') kids.push(h('p', { class: 'field__hint', text: `Матч прерван${v.stopped && v.stopped.reason ? ` (${v.stopped.reason.toLowerCase()})` : ''}. Победителя нет. Счёт и подача сохранены: матч можно продолжить.` }));
  if (outcome === 'retired') kids.push(h('p', { class: 'field__hint', text: 'Итог по регламенту — поражение без счёта (0:0). Счёт на момент снятия виден в протоколе. Правило уточняется у лиги.' }));
  if (outcome === 'walkover') kids.push(h('p', { class: 'field__hint', text: 'Поражение без счёта (0:0).' }));
  kids.push(h('button', { type: 'button', class: 'btn btn--primary btn--lg btn--block', id: 'endOk', onclick: () => confirmEnd(m.id) }, 'Подтвердить'));
  if (outcome === 'stopped') kids.push(h('button', { type: 'button', class: 'btn btn--secondary btn--block', id: 'endResume', onclick: () => { store.reopen(m.id); freshAction('Матч продолжен'); } }, 'Продолжить матч'));
  else if (v.canUndo) kids.push(h('button', { type: 'button', class: 'btn btn--secondary btn--block', id: 'endUndo', 'aria-label': `${undoEndLabel(v.lastEvent)}: ${describeEvent(v.lastEvent, m)}`, onclick: doUndo }, undoEndLabel(v.lastEvent)));
  const links = h('nav', { class: 'jd-links jd-links--end', 'aria-label': 'Этот матч на других экранах' });
  renderLinks(links, m.id);
  kids.push(links);
  area.replaceChildren(h('div', { class: 'jd-end__card', role: 'group', 'aria-labelledby': 'endTitle' }, ...kids));
}

function confirmEnd(id) {
  const m = store.match(id);
  const v = store.view(id);
  if (m && m.status !== 'finished') store.finish(id);
  go('#/matches');
  flash(`Матч записан: ${m.court}, ${m.stage}, ${scoreLine(v)}.`);
}

// ---- «Ещё»

$('moreBtn').addEventListener('click', async () => {
  if (!play) return;
  const m = store.match(play.id);
  const v = store.view(play.id);
  const done = v.finished || m.status === 'finished';
  const items = [
    { value: 'penaltyPoint', label: 'Штрафное очко', hint: 'очко сопернику нарушителя', off: done || v.mode !== 'points' },
    { value: 'penaltyGame', label: 'Штрафной гейм', hint: 'гейм сопернику нарушителя', off: done || v.mode === 'final' },
    { value: 'warning', label: 'Предупреждение паре', hint: 'первое нарушение: счёт не меняется, запись в протоколе', off: done },
    { value: 'mode', label: 'Сменить способ счёта', hint: `сейчас: ${MODE_TEXT[v.mode]}`, off: done },
    { value: 'walkover', label: 'Неявка или снятие', hint: 'поражение без счёта, победа сопернику', off: done },
    { value: 'finish', label: 'Досрочно завершить', hint: 'пара снялась или матч прерван', off: done },
    { value: 'reset', label: 'Сбросить матч', hint: 'вернуть к исходному виду и настройкам', off: false },
  ];
  const pick = await ask({
    title: 'Ещё',
    body: done ? 'Матч окончен: штрафы и смена способа недоступны. Чтобы изменить счёт, отмените последнее действие.' : 'Каждое действие ещё раз спросит подтверждение.',
    choices: items.map((i) => ({ value: i.value, label: i.label, hint: i.off ? `${i.hint} · недоступно сейчас` : i.hint, disabled: i.off })),
    ok: 'Дальше',
  });
  if (pick === null) return;
  if (pick === 'penaltyPoint' || pick === 'penaltyGame') return penaltyFlow(m, pick);
  if (pick === 'warning') return warningFlow(m);
  if (pick === 'mode') return modeFlow(m, v);
  if (pick === 'walkover') {
    const kind = await ask({
      title: 'Неявка или снятие?',
      body: 'В обоих случаях — поражение без счёта (0:0) и победа сопернику.',
      choices: [
        { value: 'noshow', label: 'Пара не явилась', hint: 'через 20 минут после вызова' },
        { value: 'retired', label: 'Пара снялась по ходу матча', hint: `в протоколе: «Снятие при счёте ${v.games[0]}:${v.games[1]}»` },
      ],
      ok: 'Дальше',
    });
    if (kind === null) return;
    return walkoverFlow(m, kind);
  }
  if (pick === 'finish') {
    // без исхода матч не завершается: либо снятие (победа другой паре), либо «прерван» без победителя
    const how = await ask({
      title: 'Как закончился матч?',
      body: `Сейчас ${v.games[0]}:${v.games[1]}. Выберите исход: от него зависит, что увидят табло и афиша.`,
      choices: [
        { value: 'retired', label: 'Пара снялась', hint: `победа другой паре, «Снятие при счёте ${v.games[0]}:${v.games[1]}»` },
        { value: 'stopped', label: 'Матч прерван', hint: `погода или темнота: победителя нет, «Прерван при ${v.games[0]}:${v.games[1]}», можно продолжить` },
      ],
      ok: 'Дальше',
    });
    if (how === 'retired') return walkoverFlow(m, 'retired');
    if (how === 'stopped') return stopFlow(m);
    return;
  }
  if (pick === 'reset') {
    const ok = await ask({ title: 'Сбросить матч?', body: 'Весь счёт этого матча сотрётся, матч вернётся к исходному виду демо-вечера. Отменить сброс нельзя.', ok: 'Сбросить' });
    if (!ok) return;
    // судья сбрасывает осознанно — сброс «с силой», даже если матч держит другая вкладка;
    // та вкладка сама вернётся на «Перед началом» с сообщением
    store.stopAutoplay(m.id);
    const r = store.tryReset(m.id, { force: true });
    if (!r.accepted) {
      if (play) freshAction(`Сбросить не удалось: ${reasonText(r.reason).toLowerCase()}`);
      return;
    }
    // финал и другие несыгранные матчи: подписка уже повела на «Перед началом» с сообщением
    if (current.screen === 'play' && current.id === m.id && play && store.match(m.id).status !== 'upcoming') {
      freshAction('Матч сброшен к исходному виду демо-вечера');
    }
  }
});

/** Предупреждение паре — первая ступень санкций по Кодексу: счёт не меняется, запись в журнале матча. */
async function warningFlow(m) {
  const to = await ask({
    title: 'Кому предупреждение?',
    body: 'Выберите пару, которая нарушила правила. Счёт не изменится.',
    choices: m.pairs.map((pid, side) => ({ value: side, label: pairName(pid), kprs: pairKprs(pid) })),
    ok: 'Дальше',
  });
  if (to === null) return;
  const v = store.view(m.id);
  const before = v && v.warnings ? v.warnings[to] : 0;
  const ok = await ask({
    title: `Предупреждение: ${sideName(m, to)}?`,
    body: before > 0
      ? `У пары уже ${before === 1 ? 'есть предупреждение' : `${before} предупреждения`}. По Кодексу повторное нарушение — штрафное очко сопернику («Ещё» → «Штрафное очко»).`
      : 'Счёт не меняется, запись видна в протоколе матча. Следующее нарушение — штрафное очко сопернику.',
    ok: 'Записать',
  });
  if (!ok) return;
  if (send(m.id, { t: 'warning', to, note: 'Нарушение Кодекса поведения' })) { buzz(); freshAction(`Предупреждение: ${sideName(m, to)} · следующее — штрафное очко`); }
}

async function penaltyFlow(m, kind) {
  const what = kind === 'penaltyPoint' ? 'штрафное очко' : 'штрафной гейм';
  const to = await ask({
    title: `Кому присудить ${what}?`,
    body: 'Выберите пару, которая получает очко или гейм, — то есть соперника нарушителя.',
    choices: m.pairs.map((pid, side) => ({ value: side, label: pairName(pid), kprs: pairKprs(pid) })),
    ok: 'Дальше',
  });
  if (to === null) return;
  const ok = await ask({ title: `${cap1(what)}: ${sideName(m, to)}?`, body: `Нарушение: ${sideName(m, 1 - to)}. Запись сразу попадёт в счёт матча.`, ok: 'Присудить' });
  if (!ok) return;
  if (send(m.id, { t: kind, to })) { buzz(); freshAction(`${cap1(what)}: ${sideName(m, to)}`); }
}

async function modeFlow(m, v) {
  const notes = {
    points: 'Кнопка после каждого розыгрыша.',
    games: 'Кнопка после каждого гейма.',
    final: 'Счёт вводится один раз, после матча.',
  };
  let body = 'Геймы сохранятся.';
  if (v.inTiebreak && v.tiebreak && (v.tiebreak[0] || v.tiebreak[1])) body = `Очки тай-брейка (${v.tiebreak[0]}:${v.tiebreak[1]}) обнулятся, геймы сохранятся.`;
  else if (v.mode === 'points' && v.pointsRaw && (v.pointsRaw[0] || v.pointsRaw[1])) body = 'Очки текущего гейма обнулятся, геймы сохранятся.';
  const pick = await ask({
    title: 'Сменить способ счёта',
    body,
    choices: ['points', 'games', 'final'].filter((x) => x !== v.mode).map((x) => ({ value: x, label: cap1(MODE_TEXT[x]), hint: notes[x] })),
    ok: 'Сменить',
  });
  if (pick === null) return;
  if (send(m.id, { t: 'setMode', mode: pick })) { play.buttonsKey = null; play.finalKey = null; freshAction(`Способ счёта: ${MODE_TEXT[pick]}`); }
}

// ---------------------------------------------------------------- окно подтверждения

let dlgState = null;
/**
 * ask({ title, body, ok, choices?, validate?, collect? }) → Promise:
 *   без choices — true | null; с choices — value | null; с collect — его результат | null.
 */
function ask({ title, body, ok = 'Подтвердить', choices = null, validate = null, collect = null }) {
  const dlg = $('dlg');
  if (dlgState) dlgState.resolve(null);
  $('dlgTitle').textContent = title;
  const bodyEl = $('dlgBody');
  bodyEl.textContent = '';
  for (const part of [].concat(body || [])) bodyEl.append(typeof part === 'string' ? h('p', { text: part }) : part);
  if (choices) {
    const list = h('div', { class: 'jd-opts', role: 'radiogroup', 'aria-label': title });
    for (const c of choices) {
      list.append(h('label', { class: `jd-opt${c.kprs ? ' jd-opt--pair' : ''}${c.disabled ? ' is-off' : ''}` },
        h('input', { type: 'radio', name: 'choice', value: String(c.value), disabled: !!c.disabled }),
        h('span', {}, c.kprs ? pairBall(c.kprs[0], c.kprs[1], { size: 36, decorative: true }) : null,
          h('b', { text: c.label }), c.hint ? h('i', { text: c.hint }) : null)));
    }
    bodyEl.append(list);
  }
  $('dlgOk').textContent = ok;
  $('dlgErr').hidden = true;
  return new Promise((resolve) => {
    dlgState = { resolve: (val) => { dlgState = null; resolve(val); }, choices, validate, collect };
    try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
    // на телефоне не ставим курсор в поле для набора: клавиатура закрыла бы кнопки, а счёт тай-брейка необязателен
    const firstInput = dlg.querySelector('input:not([disabled])');
    const typing = firstInput && !['radio', 'checkbox'].includes(firstInput.type);
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const first = (firstInput && !(typing && touch)) ? firstInput : $('dlgOk');
    first.focus();
  });
}
function closeDlg(val) {
  const dlg = $('dlg');
  const st = dlgState;
  try { dlg.close(); } catch { dlg.removeAttribute('open'); }
  if (st) st.resolve(val);
}
$('dlgForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const st = dlgState;
  if (!st) return closeDlg(null);
  const form = $('dlgForm');
  const err = $('dlgErr');
  if (st.choices) {
    const val = form.elements.choice ? (form.querySelector('input[name="choice"]:checked') || {}).value : undefined;
    if (val === undefined) { err.textContent = 'Сначала выберите вариант.'; err.hidden = false; return; }
    const c = st.choices.find((x) => String(x.value) === val);
    return closeDlg(c ? c.value : null);
  }
  if (st.validate) {
    const problem = st.validate(form);
    if (problem) { err.textContent = problem; err.hidden = false; return; }
  }
  closeDlg(st.collect ? st.collect(form) : true);
});
$('dlgCancel').addEventListener('click', () => closeDlg(null));
$('dlg').addEventListener('cancel', (e) => { e.preventDefault(); closeDlg(null); });
// касание по затемнению вокруг окна — отмена
$('dlg').addEventListener('click', (e) => { if (e.target === $('dlg')) closeDlg(null); });

// ---------------------------------------------------------------- экран не гаснет

let wake = null;
// на низких экранах строка связи скрыта; класс wake-off возвращает её, когда экран может погаснуть
function wakeNote(on) {
  $('wakeText').textContent = on === null ? '' : on ? ' · экран не погаснет' : ' · экран может погаснуть';
  document.body.classList.toggle('wake-off', on === false);
}
async function requestWake() {
  if (!('wakeLock' in navigator)) { wakeNote(false); return; }
  try {
    if (wake) return;
    wake = await navigator.wakeLock.request('screen');
    wakeNote(true);
    wake.addEventListener('release', () => { wake = null; if (current.screen === 'play') wakeNote(false); });
  } catch {
    wake = null;
    wakeNote(false);
  }
}
function releaseWake() {
  wakeNote(null);
  if (wake) { try { wake.release(); } catch { /* уже отпущен */ } wake = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && current.screen === 'play') requestWake();
});

// ---------------------------------------------------------------- синхронизация

store.subscribe(({ id, source }) => {
  if (current.screen === 'matches') updateList(id);
  else if (current.screen === 'play' && play && (!id || id === play.id)) {
    const m = store.match(play.id);
    // матч сбросили в другой вкладке (табло, афиша, другой судья) — назад на «Перед началом»
    // (свой «Сбросить матч» сюда не попадает: он сначала отпускает матч)
    if (m && m.status === 'upcoming') {
      backToSetup(play.id, source === 'local'
        ? 'Матч сброшен: счёт начат заново. Выберите настройки ещё раз.'
        : 'Матч сброшен в другой вкладке: счёт начат заново. Выберите настройки ещё раз.');
      return;
    }
    // матч сбросили, но он в демо «уже идёт» (бронза, показательный): статус остался live, счёт вернулся к исходному.
    // Сброс виден по росту epoch. Вкладка, у которой матч сбросили, сама его обратно не берёт (решение FIXES-2).
    if (m && (m.epoch || 0) !== play.epoch) {
      play.epoch = m.epoch || 0;
      if (source !== 'local') {
        play.lostClaim = true;
        freshAction('Матч сброшен в другой вкладке: счёт вернулся к исходному виду демо-вечера');
      }
    }
    const c = m ? store.claimOf(play.id) : null;
    // матч перехватила другая вкладка («Вести здесь») — сами обратно не берём, даже когда она его отпустит
    if (c && !c.mine && !play.lostClaim) {
      play.lostClaim = true;
      freshAction('Матч ведут в другой вкладке. Чтобы вести здесь, нажмите «Вести здесь»');
    }
    // захват пропал (истёк, вкладка уснула) и никто другой его не брал — берём снова
    if (m && !c && !play.lostClaim) store.claim(play.id, { role: 'judge' });
    renderPlay();
  }
  else if (current.screen === 'setup' && id === current.id) {
    const m = store.match(id);
    if (m && m.status !== 'upcoming') go(`#/play/${id}`);   // матч начали в другой вкладке
  }
});

// для проверки сценария по CDP
window.__judge = { store, get current() { return { ...current }; } };

route();
