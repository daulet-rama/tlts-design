// Пульт дня: успеваем ли мы, корты с прогнозом и вызовом на корт, «впритык», журнал;
// «если пойдёт дождь» — в нижней шторке. Данные — data.js (настройки пульта — desk.data.js),
// расчёты — desk.logic.js, общий день с экраном вызова — desk.state.js, время — часы мира.
import { D, tileHtml, duoHtml, icon, hydrate, startLive, setTick, liveTiles, sheet, esc } from '../app.js';
import * as L from './desk.logic.js';
import { DESK, REPLIES, RAIN_DEFAULT } from './desk.data.js';
import * as S from './desk.state.js';

const $ = (id) => document.getElementById(id);
const LIMIT = D.RULES.callLimit;          // 20 минут на выход после вызова (Кодекс, 2.1)
const SLOT = D.RULES.slot;                // матч в программе дня — 50 минут
const SUNSET = L.toMin(D.TODAY.sunset);   // 21:10
const ME = D.ME.pair;

/* ---------- день из data.js ---------- */

const DAYM = D.SCHEDULE.map((id) => {
  const m = D.match(id);
  return { id, court: m.court, at: L.toMin(m.time), state: m.state, pairs: m.pairs, length: m.duration ? parseInt(m.duration, 10) : null };
});
const MID = Object.fromEntries(DAYM.map((m) => [m.id, m]));
const LIVE_ID = (DAYM.find((m) => m.state === 'live') || {}).id || null;

// модель: счёт всех сыгранных сетов этапа и темп сегодняшних матчей (минут на гейм)
const scores = {};
for (const m of D.MATCHES) {
  if (m.state !== 'done') continue;
  const [a, b] = m.sets[0];
  const k = `${Math.max(a, b)}:${Math.min(a, b)}`;
  scores[k] = (scores[k] || 0) + 1;
}
const todayDone = DAYM.filter((m) => m.state === 'done' && m.length);
const perGame = todayDone.reduce((a, m) => a + m.length, 0) / todayDone.reduce((a, m) => a + D.match(m.id).sets[0][0] + D.match(m.id).sets[0][1], 0);
const model = L.makeModel(scores, perGame);

const court = (c) => D.court(c);
const courtTo = (c) => court(c).name.replace(/^Корт/, 'корт');
const courtAt = (c) => court(c).name.replace(/^Корт/, 'корте');
const titleLow = (id) => D.match(id).title.replace(/^./, (x) => x.toLowerCase());
const shortTitle = (id) => D.match(id).title.replace(/\s+место$/, '');   // «За 3-е», «За 5-е», «Финал»
const pairGen = (id) => D.pairLines(id).map(D.genitive).join(' / ');      // «у Демченко / Ершова»

/* ---------- общее состояние ---------- */

let st = S.own();
if (!st.rain) st = S.update((s) => { s.rain = { ...RAIN_DEFAULT }; });
let liveView = null;
const now = () => S.nowOf(st);
const activeCall = (id) => { const c = st.calls[id]; return c && !c.closed ? c : null; };

/* ---------- прогноз ---------- */

function liveLeft() {
  if (!LIVE_ID) return 0;
  const m = D.match(LIVE_ID);
  const v = liveView || { games: m.games, gamesToWin: 6, format: { deuce: 'league' }, finished: false };
  return L.remainingMinutes(v, model);
}
const forecast = (rain = null) => L.forecastDay({ matches: DAYM, now: now(), model, live: LIVE_ID ? { id: LIVE_ID, left: liveLeft() } : null, rain });

const liveOn = () => LIVE_ID && !(liveView && liveView.finished);
function pairFreeAt(pid) {
  if (liveOn() && MID[LIVE_ID].pairs.includes(pid)) return null;
  let t = -Infinity;
  for (const m of DAYM) if (m.state === 'done' && m.pairs.includes(pid)) t = Math.max(t, m.at + m.length);
  return t;
}
function courtFreeAt(c) {
  if (liveOn() && MID[LIVE_ID].court === c) return null;
  let t = -Infinity;
  for (const m of DAYM) if (m.state === 'done' && m.court === c) t = Math.max(t, m.at + m.length);
  return t;
}
function clocksOf(call, m) {
  const cs = L.matchClocks({
    calledAt: call.at, courtFreeAt: courtFreeAt(m.court), now: now(), limit: LIMIT,
    pairs: m.pairs.map((p) => ({ freeAt: pairFreeAt(p), onCourtAt: (call.onCourt || {})[p] ?? null })),
  });
  return cs.map((c, i) => ({ ...c, read: !!(call.reads || {})[m.pairs[i]] }));
}

/* ---------- отрисовка без мигания: разметка меняется, только когда меняется смысл ---------- */

function paint(el, html) {
  if (!el || el.__html === html) return false;
  el.__html = html;
  el.innerHTML = html;
  hydrate(el);
  return true;
}
function dyn(root, key, text) {
  const el = root && root.querySelector(`[data-dyn="${key}"]`);
  if (el && el.textContent !== text) el.textContent = text;
}

/* ---------- герой: табло дня ---------- */

function renderHero(F) {
  const fin = F.byId.get('final');
  const lag = fin.start - fin.plan;
  const late = lag > 2;
  setTick($('dk-hero-num'), L.hhmm(late ? L.round5(fin.start) : fin.plan));
  $('dk-hero-pill').textContent = late ? `+${Math.round(lag)} мин` : 'Вовремя';
  const end = L.round5(F.end);
  const margin = SUNSET - end;
  const head = late ? `Отстаём на ${L.durAcc(lag)}` : margin >= 0 ? 'Успеваем по программе' : 'Не успеваем до заката';
  const tail = `Конец дня около ${L.hhmm(end)} · ${margin >= 0 ? `до заката ${L.dur(margin, true)}` : `после заката ${L.dur(-margin, true)}`}`;
  paint($('dk-hero-say'), `<span class="strong">${head}</span><span class="muted">${tail}</span>`);
  renderTrack(F);
}

// остаток дня: матч на дорожке, полоса цвета покрытия его корта; «сейчас» — линия цвета мяча
function renderTrack(F) {
  const t = now();
  const from = Math.floor(t / 5) * 5 - 5;
  const to = SUNSET + 10;
  const x = (v) => Math.max(0, Math.min(1, (v - from) / (to - from)));
  const items = [...F.byId.values()].filter((it) => it.state !== 'done').sort((a, b) => a.start - b.start);
  const lanes = items.map((it) => {
    const m = MID[it.id];
    const a = x(Math.max(it.start, t));
    const b = x(it.end);
    // подпись — за полосой, а у поздних матчей — перед ней, чтобы не заходить на закат
    const before = b > 0.62;
    return `<div class="dk-lane${before ? ' before' : ''}${m.id === 'final' ? ' hero' : ''}" style="--a:${a.toFixed(4)};--b:${b.toFixed(4)}"><span class="dk-bar" data-surface="${court(m.court).surface}"></span><span class="cap dk-lbl">${shortTitle(m.id)}</span></div>`;
  }).join('');
  const html = `${lanes}<span class="dk-sun" style="--x:${x(SUNSET).toFixed(4)}"></span>
    <div class="dk-axis"><span class="cap dk-nowlbl">Сейчас ${L.hhmm(t)}</span><span class="cap">Закат ${D.TODAY.sunset}</span></div>`;
  const el = $('dk-track');
  el.style.setProperty('--now', x(t).toFixed(4));
  if (el.__html !== html) { el.__html = html; el.innerHTML = html; }
}

/* ---------- корты ---------- */

function liveFoot(m, F) {
  const it = F.byId.get(m.id);
  if (liveView && liveView.finished) return `<p class="dk-line"><span class="strong">Сыгран · ${liveView.games[0]}:${liveView.games[1]}</span><span class="muted">корт свободен</span></p>`;
  const over = it.end - (m.at + SLOT);
  const plan = over > 2 ? `на ${L.durAcc(over)} дольше программы` : 'по программе';
  return `<p class="dk-line"><span class="strong">Закончится около <span data-dyn="end">${L.hhmm(L.round5(it.end))}</span></span><span class="muted">${plan}</span></p>`;
}

function readyLine(m, F) {
  const it = F.byId.get(m.id);
  const lag = it.start - m.at;
  const waits = [];
  m.pairs.forEach((p) => { if (pairFreeAt(p) == null) waits.push(`${D.pairName(p)} доигрывают на ${courtAt(MID[LIVE_ID].court)}`); });
  if (courtFreeAt(m.court) == null) waits.push(`корт занят до ${L.hhmm(L.round5(F.byId.get(LIVE_ID).end))}`);
  const why = waits.length ? waits.join('; ') : 'пары и корт свободны';
  if (lag <= 2) return `<p class="dk-line"><span class="strong">Начнётся вовремя</span><span class="muted">${why}</span></p>`;
  return `<p class="dk-line"><span class="strong">Начнётся около ${L.hhmm(L.round5(it.start))}</span><span class="muted">позже на ${L.durAcc(lag)} · ${why}</span></p>`;
}

// отметки пары: ответ важнее «прочитано», «прочитано» важнее «отправлено»
const marks = (call, pid) => {
  const read = (call.reads || {})[pid];
  const rep = (call.replies || {})[pid];
  if (rep) return rep.kind === 'go' ? `«Иду» в ${L.hhmm(rep.at)}` : `«Нужно 5 минут» · к ${L.hhmm(rep.at + 5)}`;
  return read ? `прочитано в ${L.hhmm(read)}` : 'отправлено, не прочитано';
};

function callFoot(m, call) {
  const clocks = clocksOf(call, m);
  const status = L.callStatus(clocks);
  const lead = L.leadClock(clocks);
  const rows = m.pairs.map((p, i) => {
    const c = clocks[i];
    // справа — только то, что меняет дело: на корте, доигрывает, часы стоят
    const end = c.state === 'oncourt' ? 'на корте' : c.state === 'playing' ? 'доигрывает' : c.state === 'held' ? 'часы стоят' : '';
    const inner = `${duoHtml(p, 'xs')}<span class="grow"><span class="strong ellipsis">${D.pairName(p)}</span><span class="sub ellipsis">${marks(call, p)}</span></span>${end ? `<span class="end">${end}</span>` : ''}`;
    return p === ME
      ? `<a class="row dk-pr" href="call.html" aria-label="${D.pairName(p)}: экран вызова">${inner}<i data-icon="chev" class="go"></i></a>`
      : `<div class="row dk-pr">${inner}</div>`;
  }).join('');
  const clock = lead
    ? `<span class="dk-clock"><span class="num" data-dyn="clk">${L.mmss(lead.elapsed)}</span><span class="cap">из ${LIMIT}:00</span></span>`
    : '';
  return `<div class="dk-callhead">
      <span class="grow"><span class="strong">${status.text}</span><span class="muted">Вызов в ${L.hhmm(call.at)}</span></span>${clock}
    </div>
    <div class="dk-pairs">${rows}</div>
    <div class="dk-callfoot"><button class="btn quiet small" type="button" data-act="cancel" data-m="${m.id}" aria-label="Отменить вызов: ${titleLow(m.id)}">Отменить</button><span class="muted">Неявку ставит судья</span></div>`;
}

// Кнопка вызова: главная — у ближайшего невызванного матча и не раньше чем за 20 + 5 минут
// до его начала. Раньше — неактивная, со временем вызова: вызванной паре Кодекс даёт 20 минут.
const inWindow = (m, F) => F.byId.get(m.id).start - now() <= LIMIT + DESK.lead;
const callTime = (m, F) => L.round5(F.byId.get(m.id).start - LIMIT);

function soonFoot(m, F, isMain) {
  const call = activeCall(m.id);
  if (call) return callFoot(m, call);
  const btn = inWindow(m, F)
    ? `<button class="btn ${isMain ? 'main' : 'quiet'}" type="button" data-act="call" data-m="${m.id}"><i data-icon="bell" style="display:contents"></i>Вызвать на ${courtTo(m.court)}</button>`
    : `<button class="btn" type="button" disabled><i data-icon="bell" style="display:contents"></i>Вызов — в ${L.hhmm(callTime(m, F))}</button>`;
  return `${readyLine(m, F)}${btn}`;
}

// свободные корты: мини-корт с номером, последний матч на нём
function freeRow(c) {
  const ct = court(c);
  const last = DAYM.filter((m) => m.court === c && m.state === 'done').pop();
  const sub = last ? `${D.match(last.id).title} · ${D.setsText(D.match(last.id))}` : ct.note ? `${ct.note[0].toUpperCase()}${ct.note.slice(1)} · без матчей` : 'Сегодня без матчей';
  return `<div class="row"><span class="srf-tile" data-surface="${ct.surface}" aria-hidden="true"><span class="num">${ct.name.replace(/\D/g, '')}</span><span class="base"></span></span><span class="grow"><span class="strong">${D.courtLine(c)}</span><span class="sub">${sub}</span></span><span class="end">свободен</span></div>`;
}

function renderCourts(F) {
  const box = $('dk-courts');
  const live = DAYM.filter((m) => m.state === 'live');
  const soon = DAYM.filter((m) => m.state === 'soon').sort((a, b) => F.byId.get(a.id).start - F.byId.get(b.id).start);
  const mainId = (soon.find((m) => !activeCall(m.id) && inWindow(m, F)) || {}).id;
  const used = new Set([...live, ...soon].map((m) => m.court));
  // каркас карточек: меняется, только если меняется набор матчей
  const frame = [...live, ...soon].map((m) => m.id).join(',');
  if (box.__frame !== frame) {
    box.__frame = frame;
    const free = Object.keys(D.COURTS).filter((c) => !used.has(c));
    // плашка ведёт сама: идёт — match.html?m=…, скоро — match-soon.html?m=…
    box.innerHTML = [...live, ...soon].map((m) => `<article class="dk-court" data-m="${m.id}">${tileHtml(m.id)}<div class="dk-foot" data-foot="${m.id}"></div></article>`).join('')
      + (free.length ? `<div class="card dk-free">${free.map(freeRow).join('')}</div>` : '');
    hydrate(box);
    liveTiles(box);
    box.querySelectorAll('.dk-foot').forEach((el) => { el.__html = null; });
  }
  live.forEach((m) => {
    const el = box.querySelector(`[data-foot="${m.id}"]`);
    paint(el, liveFoot(m, F).replace(/data-dyn="end">[^<]*</, 'data-dyn="end"><'));
    dyn(el, 'end', L.hhmm(L.round5(F.byId.get(m.id).end)));
  });
  soon.forEach((m) => {
    const el = box.querySelector(`[data-foot="${m.id}"]`);
    const call = activeCall(m.id);
    paint(el, soonFoot(m, F, m.id === mainId).replace(/data-dyn="clk">[^<]*</, 'data-dyn="clk"><'));
    if (call) {
      const lead = L.leadClock(clocksOf(call, m));
      if (lead) dyn(el, 'clk', L.mmss(lead.elapsed));
    }
    el.closest('.dk-court').classList.toggle('called', !!call);
  });
  $('dk-courts-meta').textContent = `идёт ${live.length} · впереди ${soon.length}`;
}

/* ---------- впритык ---------- */

// пусто — одна тихая строка под кортами; есть пары почти без отдыха — свой раздел
function renderTight(F) {
  const rows = [];
  for (const m of DAYM.filter((x) => x.state === 'soon')) {
    const it = F.byId.get(m.id);
    for (const p of m.pairs) {
      let prev = null;
      if (liveOn() && MID[LIVE_ID].pairs.includes(p)) prev = F.byId.get(LIVE_ID).end;
      else for (const d of DAYM) if (d.state === 'done' && d.pairs.includes(p)) prev = Math.max(prev ?? -Infinity, d.at + d.length);
      if (prev == null) continue;
      rows.push({ p, m, gap: it.start - prev });
    }
  }
  rows.sort((a, b) => a.gap - b.gap);
  const tight = rows.filter((r) => r.gap < DESK.tight);
  const least = rows[0];
  $('tight').hidden = !tight.length;
  const line = $('dk-tight-line');
  line.hidden = !!tight.length;
  if (!tight.length) {
    const text = least ? `Впритык никого · меньше всего отдыха у ${pairGen(least.p)} — ${L.dur(least.gap, true)}` : 'Впритык никого · двух матчей подряд ни у кого нет';
    if (line.textContent !== text) line.textContent = text;
    return;
  }
  paint($('dk-tight'), tight.map((r) => {
    const when = L.hhmm(L.round5(F.byId.get(r.m.id).start));
    return `<div class="row dk-tight">${duoHtml(r.p, 'xs')}<span class="grow"><span class="strong ellipsis">${D.pairName(r.p)}</span><span class="sub ellipsis">${D.match(r.m.id).title} в ${when}</span></span><span class="end">${r.gap <= 0 ? 'без перерыва' : L.dur(r.gap, true)}</span></div>`;
  }).join(''));
}

/* ---------- дождь: шторка ---------- */

function rainInputs() {
  const minFrom = Math.ceil(now() / 5) * 5;
  const from = Math.max(L.toMin(st.rain.rainAt) ?? minFrom, minFrom);
  const to = Math.max(L.toMin(st.rain.dryAt) ?? from, from);
  return { from, to, minFrom };
}

function renderRain() {
  const { from, to, minFrom } = rainInputs();
  const opts = L.rainOptions({ matches: DAYM, now: now(), model, live: LIVE_ID ? { id: LIVE_ID, left: liveLeft() } : null, from, to, lightEnd: SUNSET });
  let pick = st.pick;
  const step = (key, label, val, lo, hi) => `<div class="row stepper"><span class="grow strong">${label}</span>
      <button class="step-btn" type="button" data-act="step" data-k="${key}" data-d="-10" aria-label="${label}: на 10 минут раньше"${val <= lo ? ' disabled' : ''}>${icon('minus')}</button>
      <span class="num val">${L.hhmm(val)}</span>
      <button class="step-btn" type="button" data-act="step" data-k="${key}" data-d="10" aria-label="${label}: на 10 минут позже"${val >= hi ? ' disabled' : ''}>${icon('plus')}</button></div>`;
  // «− +» рисуются заново: фокус — на ту же кнопку, а если она у края выключилась, — на соседнюю в строке
  const steps = $('dk-rain-in');
  const was = steps.contains(document.activeElement) ? { ...document.activeElement.dataset } : null;
  if (paint(steps, step('rainAt', 'Дождь с', from, minFrom, SUNSET) + step('dryAt', 'Корты готовы', to, from, SUNSET + 60)) && was && was.k) {
    const same = steps.querySelector(`[data-k="${was.k}"][data-d="${was.d}"]`);
    const next = same && (same.disabled ? same.parentElement.querySelector('.step-btn:not(:disabled)') : same);
    if (next) next.focus({ preventScroll: true });
  }
  // время конца — с точностью до минуты, вывод «успеваем» — по тому же числу
  const endMin = (o) => Math.floor(o.end + 1e-9);
  const endOf = (o) => L.hhmm(endMin(o));
  const marg = (o) => SUNSET - endMin(o);
  const fits = (o) => marg(o) >= 0;
  const asis = opts[0];
  const fit = opts.find(fits);
  const brk = `Перерыв ${L.dur(to - from)}`;
  const say = fits(asis)
    ? `<span class="strong">Успеваем и так</span><span class="muted">${brk}, без сокращений конец около ${endOf(asis)}</span>`
    : fit
      ? `<span class="strong">Как есть — позже заката на ${L.durAcc(-marg(asis))}</span><span class="muted">${brk}. Успеваем, если ${fit.title.toLowerCase()}</span>`
      : `<span class="strong">До заката не успеваем</span><span class="muted">${brk}. Даже с сокращением конец около ${endOf(opts[opts.length - 1])}</span>`;
  paint($('dk-rain-say'), say);
  if (!opts.find((o) => o.key === st.pick)) pick = (fit || opts[0]).key;
  paint($('dk-opts'), opts.map((o) => {
    const on = o.key === pick;
    const m = marg(o);
    // сокращать нечего: день кончается раньше дождя — успеваем до него; иначе к дождю матчи уже начаты
    const verdict = o.nothingToCut ? (endMin(o) <= from ? 'успеваем до дождя: сокращать не&nbsp;нужно' : 'сокращать нечего: матчи уже начаты') : m >= 0 ? `успеваем · запас ${L.dur(m, true)}` : `позже заката на ${L.dur(-m, true)}`;
    return `<button class="row pick dk-opt${fits(o) ? ' fits' : ''}" type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-act="pick" data-k="${o.key}">
      <span class="grow"><span class="strong">${o.title}</span><span class="sub">${verdict}</span></span>
      <span class="num dk-oend">${endOf(o)}</span><span class="mark" aria-hidden="true">${icon('check')}</span></button>`;
  }).join(''));
  const liveStop = LIVE_ID && opts[0].day.byId.get(LIVE_ID).stopped;
  const sel = opts.find((o) => o.key === pick);
  const fine = `${sel.key === 'asis' || !sel.affected ? 'Без сокращений.' : `Затронет ${sel.affected} ${L.plural(sel.affected, 'матч', 'матча', 'матчей')}.`}${liveStop ? ' Прерванный матч за 3-е место доигрывается в своём формате.' : ''} Решает главный судья.`;
  if ($('dk-rain-fine').textContent !== fine) $('dk-rain-fine').textContent = fine;
  return { opts, pick, from, to };
}

// как считается прогноз — одной строкой внизу шторки
// (минуты на гейм — средний темп сыгранных сегодня матчей)
$('dk-assume').textContent = `Темп дня ${String(perGame.toFixed(1)).replace('.', ',')} мин на гейм, прогноз ±${DESK.band} мин`;
$('dk-rain-lead').textContent = `Что успеем до заката в ${D.TODAY.sunset}`;

const rainSheet = sheet($('dk-rain'), $('dk-rain-scrim'), { onClose: () => { $('dk-decide-msg').textContent = ''; } });
$('dk-rain-open').addEventListener('click', () => { renderRain(); rainSheet.open($('dk-rain-open')); });
$('dk-rain-close').addEventListener('click', () => rainSheet.close());

/* ---------- журнал ---------- */

const BEFORE = (() => {
  const callAt = {};
  return D.DAY_LOG.map(([t, kind, mid, pid]) => {
    const m = MID[mid];
    const at = L.toMin(t);
    if (kind === 'call') {
      callAt[mid] = at;
      return { at, kind, who: 'Директор', text: `Вызов на ${courtTo(m.court)}: ${titleLow(mid)} — ${D.pairName(m.pairs[0])} и ${D.pairName(m.pairs[1])}` };
    }
    const waited = at - callAt[mid];
    return { at, kind, who: 'Судья', waited, text: `${D.pairName(pid)} на корте — через ${L.durAcc(waited)} после вызова` };
  });
})();

let logOpen = false;
function renderLog() {
  // новые сверху; записи с одной минутой — в порядке, в каком случились
  const t0 = now();
  const all = [...BEFORE.filter((e) => e.at <= t0), ...st.log].map((e, i) => ({ ...e, i })).sort((a, b) => b.at - a.at || b.i - a.i);
  const t = L.averageTurnout(all);
  if (t) paint($('dk-turnout'), `<span class="strong">Выходят на корт за ${L.durAcc(t.avg)}</span><span class="muted">в среднем после вызова, по ${t.n} ${L.plural(t.n, 'отметке', 'отметкам', 'отметкам')} судей</span>`);
  $('dk-turnout-cap').textContent = `${all.length} ${L.plural(all.length, 'запись', 'записи', 'записей')}`;
  const shown = logOpen ? all : all.slice(0, 4);
  paint($('dk-log'), shown.map((e) => `<div class="row dk-ev${e.kind === 'decision' ? ' dk-dec' : ''}"><span class="num dk-t">${L.hhmm(e.at)}</span><span class="grow"><span class="cap">${esc(e.who)}</span><span class="dk-evt">${esc(e.text)}</span></span></div>`).join(''));
  const more = $('dk-log-more');
  more.hidden = all.length <= 4;
  const label = logOpen ? 'Свернуть' : `Весь журнал · ${all.length}`;
  if (more.textContent !== label) more.textContent = label;
  more.setAttribute('aria-expanded', String(logOpen));
}

/* ---------- ответы пар: приходят с телефонов игроков ---------- */

// у своей пары ответ даёт экран вызова; у остальных он приходит сам:
// на вызов в 18:45 — как записано в desk.data.js, на новый вызов — через несколько секунд
const SHOW = [{ read: 4, kind: 'go', at: 9 }, { read: 7, kind: 'five', at: 16 }];   // секунды после вызова
function planOf(mid, call, p, i) {
  const fixed = call.shared && (REPLIES[mid] || []).find((r) => r[0] === p);
  if (fixed) return { read: L.toMinSec(fixed[1]), kind: fixed[2], at: L.toMinSec(fixed[3]) };
  const x = SHOW[(i + (mid === 'final' ? 1 : 0)) % 2];
  return { read: call.at + x.read / 60, kind: x.kind, at: call.at + x.at / 60 };
}
function repliesArrive() {
  const t = now();
  const todo = [];
  if (D.CALLS.some((c) => !(st.shared || {})[c.match] && t >= L.toMin(c.at))) todo.push((s) => { S.sharedCalls(s); });
  for (const [mid, call] of Object.entries(st.calls)) {
    if (!call || call.closed) continue;
    MID[mid].pairs.forEach((p, i) => {
      if (p === ME) return;
      const plan = planOf(mid, call, p, i);
      const who = `Игрок · ${D.pairName(p)}`;
      if (t >= plan.read && !(call.reads || {})[p]) todo.push((s) => { const c = s.calls[mid]; c.reads = c.reads || {}; c.reads[p] = plan.read; S.addLog(s, { at: plan.read, who, text: 'Вызов прочитан на телефоне', kind: 'read' }); });
      if (t >= plan.at && !(call.replies || {})[p]) todo.push((s) => { const c = s.calls[mid]; c.replies = c.replies || {}; c.replies[p] = { kind: plan.kind, at: plan.at }; S.addLog(s, { at: plan.at, who, text: plan.kind === 'go' ? 'Ответ на вызов: «Иду»' : `Ответ на вызов: «Нужно 5 минут» — будут около ${L.hhmm(plan.at + 5)}`, kind: 'reply' }); });
    });
  }
  if (todo.length) st = S.update((s) => todo.forEach((f) => { try { f(s); } catch { /* вызов уже отменён */ } }));
  return todo.length > 0;
}

/* ---------- действия ---------- */

function doCall(mid) {
  const m = MID[mid];
  if (!m || m.state !== 'soon' || activeCall(mid)) return;
  st = S.update((s) => {
    s.calls[mid] = { at: S.nowOf(s), by: 'Директор', reads: {}, replies: {}, onCourt: {}, closed: false };
    S.addLog(s, { who: 'Директор', text: `Вызов на ${courtTo(m.court)}: ${titleLow(mid)} — ${D.pairName(m.pairs[0])} и ${D.pairName(m.pairs[1])}. Отправлено обеим парам`, kind: 'call' });
  });
  render();
}
function cancelCall(mid) {
  const m = MID[mid];
  st = S.update((s) => {
    if (!s.calls[mid]) return;
    delete s.calls[mid];
    S.addLog(s, { who: 'Директор', text: `Вызов отменён: ${titleLow(mid)}, ${courtTo(m.court)}`, kind: 'cancel' });
  });
  render();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, m, k } = b.dataset;
  if (act === 'call') return doCall(m);
  if (act === 'cancel') return cancelCall(m);
  if (act === 'pick') { st = S.update((s) => { s.pick = k; }); return render(); }
  if (act === 'step') {
    const d = Number(b.dataset.d);
    const { from, to } = rainInputs();
    st = S.update((s) => {
      if (k === 'rainAt') {
        const f = Math.min(Math.max(from + d, Math.ceil(S.nowOf(s) / 5) * 5), SUNSET);
        s.rain.rainAt = L.hhmm(f);
        if (to < f) s.rain.dryAt = L.hhmm(f);
      } else s.rain.dryAt = L.hhmm(Math.min(Math.max(to + d, from), SUNSET + 60));
    });
    render();
  }
});

// стрелки в группе вариантов дождя
$('dk-opts').addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const all = [...$('dk-opts').querySelectorAll('[role="radio"]')];
  const i = all.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const k = all[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length].dataset.k;
  st = S.update((s) => { s.pick = k; });
  render();
  const next = $('dk-opts').querySelector(`[data-k="${k}"]`);
  if (next) next.focus();
});

$('dk-log-more').addEventListener('click', () => { logOpen = !logOpen; renderLog(); });

$('dk-decide').addEventListener('click', () => {
  const name = $('dk-judge').value.trim();
  const msg = $('dk-decide-msg');
  const { opts, pick, from, to } = renderRain();
  const o = opts.find((x) => x.key === pick);
  if (!name) { msg.textContent = 'Впишите имя главного судьи: решение подписывает он'; $('dk-judge').focus(); return; }
  const end = Math.floor(o.end + 1e-9);
  st = S.update((s) => {
    S.addLog(s, { who: `Главный судья · ${name}`, text: `Дождь ${L.hhmm(from)}–${L.hhmm(to)}: «${o.title}». Конец дня около ${L.hhmm(end)}, ${SUNSET - end >= 0 ? `до заката ${L.dur(SUNSET - end)}` : `позже заката на ${L.durAcc(end - SUNSET)}`}`, kind: 'decision' });
  });
  msg.textContent = `Записано в журнал в ${L.hhmm(now())}. Формат матчей судьи меняют на своих экранах`;
  renderLog();
});

/* ---------- живой матч и часы ---------- */

function render() {
  const F = forecast();
  renderHero(F);
  renderCourts(F);
  renderTight(F);
  if (rainSheet.isOpen) renderRain();
  renderLog();
}

repliesArrive();
render();
// счёт плашки идёт сам (liveTiles); здесь — только прогноз конца по живому счёту
if (LIVE_ID) startLive((s, v) => { liveView = v; render(); });

setInterval(() => {
  repliesArrive();
  render();
}, 1000);

S.onChange((s) => { if (s && S.isMine(s)) { st = s; render(); } });
window.addEventListener('pageshow', (e) => { if (e.persisted) { st = S.own(); render(); } });
