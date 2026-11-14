// «День турнира» с телефона: что идёт на кортах, вызов на корт, отстаём ли от программы, «пошёл дождь».
// Содержание и расчёты — пульт турнирного дня (design/site/live/desk.html, desk.js, ideas/desk.logic.js):
// часы вызова идут, только когда свободны обе пары и корт; 20 минут на выход (Кодекс, 2.1);
// неявку ставит только судья; прогноз — «около»; решение по дождю подписывает главный судья,
// сайт сам ничего не переставляет. Мир — D: 19 июня, 18:47, на корте 3 идёт матч за 3-е место.
// Сделанное — в общем состоянии: вызов — calls.<матч> (тот же на «Расписании» и «Сегодня»),
// решение по дождю — days.jun-3.<день>.rain, перенос и счёт с других страниц — moves.<матч>, scores.<матч>.
// Журнал дня — журнал действий за сегодня и отметки судей «на корте» из мира.
import { D, state, esc, icon, plural, toast, confirmAction, openSheet, closeLayer, duoHtml, hydrate, fitText, keepTheme, whoWords, dayPace, dayPaceLine, dayWords } from '../admin.js';
import { dayModel, forecastDay, rainOptions, toMin, hhmm, round5, durWords, durAcc, CALL_LIMIT, SLOT_MIN } from './tournament.logic.js';
import { stageScores, todayPace, dayMatchesNow, courtLow, pairTight } from './tournament.data.js';
import { dayNow, forecastList, callOf, callIds, callState, call as doCall, uncall, callTime, tooEarly, clockStartNow, dutyWords, dutyLines } from './tournament.calls.js';

const $ = (s, r = document) => r.querySelector(s);
const RAIN = `days.jun-3.${D.TODAY.iso}.rain`;   // { from, to, pick, judge } — минуты от полуночи
const SUNSET = toMin(D.TODAY.sunset);
const pace = todayPace();
const model = dayModel(stageScores(), pace.perGame);
const RAIN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 15.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.8 8a3.75 3.75 0 0 1-.3 7.5z"/><path d="M8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2"/></svg>';

// прогноз сервера для идущего матча — «около 19:05»; сколько ему осталось — от «сейчас» часов примера
const liveLeft = (now) => ({ id: 'third', left: Math.max(0, toMin(D.FORECAST.third) - now) });
// «выйдут на корт до 19:10»: срок на выход — вверх до 5 минут, чтобы не обещать раньше
const ceil5 = (x) => Math.ceil(x / 5) * 5;
const name = (id) => D.pairName(id);
const srfLabel = (c) => D.SURFACES[D.COURTS[c].surface].label;
const low1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const rainNow = () => state.get(RAIN) || null;
// своё действие страница рисует сама; вызов из «Расписания», другой вкладки и «Отменить» ловит подписка
let mine = 0;
const act = (fn) => { mine += 1; try { return fn(); } finally { mine -= 1; } };

/* ---------- прогноз ---------- */
// матчи — с ранним вызовом (forecastList): вызвали финал в 18:58 — он начнётся около 19:20, а не в 20:00.
// «Сейчас» — часы примера (dayNow): матч, который ещё не начался, не начнётся раньше этого времени
const rainOpts = (r) => { const now = dayNow(); return rainOptions({ matches: forecastList(), now, model, live: liveLeft(now), from: r.from, to: r.to, lightEnd: SUNSET }); };
function forecast() {
  const rain = rainNow();
  const pick = rain && rain.pick ? rainOpts(rain).find((o) => o.key === rain.pick) : null;
  const now = dayNow();
  return pick ? pick.day : forecastDay({ matches: forecastList(), now, model, live: liveLeft(now) });
}

/* ---------- карточки ---------- */
const pairsHtml = (m, live) => `<div class="dpairs">${[0, 1].map((i) => `<div class="dp">${duoHtml(m.pairs[i])}<span class="nm fit">${esc(name(m.pairs[i]))}</span>${live ? `<b class="num sc">${m.games[i]}</b>` : ''}</div>`).join('')}</div>`;
function liveCard(m, F) {
  const f = F.byId.get(m.id); const over = round5(f.end - (toMin(m.time) + SLOT_MIN));
  return `<article class="dcard" data-srf="${D.COURTS[m.court].surface}" id="c-${m.id}">
    <header class="dch"><span class="tag live">Идёт · ${esc(D.COURTS[m.court].name)}</span><span class="muted">${esc(srfLabel(m.court))} · ${esc(m.title)}</span></header>
    ${pairsHtml(m, true)}
    <p class="dline"><b>Закончится около ${hhmm(round5(f.end))}</b>${f.stopped ? ' · с перерывом на дождь' : over >= 5 ? ` · на ${durAcc(over)} дольше программы` : ''}</p>
    <p class="muted">Счёт ведёт судья корта</p>
  </article>`;
}
function callBox(id) {
  const cs = callState(id);
  return `<div class="dcall${cs.expired ? ' over' : ''}">
    <div class="dcall-top"><b data-cstat="${id}">${esc(cs.text)}</b></div>
    <p class="clock" data-clock="${id}">${esc(cs.clock)}</p>
    <div class="dcall-acts"><button class="btn quiet" type="button" data-uncall="${id}">Отменить вызов</button><span class="muted">Неявку ставит судья</span></div>
  </div>`;
}
function soonCard(m, F) {
  const f = F.byId.get(m.id); const plan = toMin(m.time); const late = round5(f.start - plan);
  const c = callOf(m.id);
  // вызвали — когда и когда начнут; вызвали раньше обычного — начнут раньше программы:
  // «Вызваны в 18:58 · начнут около 19:20» (у пар 20 минут на выход). Время — из того же прогноза,
  // что строка дня («Финал раньше — около 19:20»): на экране одна цифра
  // игрок пары сейчас судит другой корт — так и сказано: «Хван судит корт 3 — освободится около 19:05»
  const duty = dutyWords(m.id);
  let when = late >= 5 ? `<b>Начнётся около ${hhmm(round5(f.start))}</b> · позже программы на ${durAcc(late)}` : `<b>Начнётся вовремя</b> · ${duty ? esc(duty) : 'пары и корт свободны'}`;
  if (c) when = `<b>Вызваны в ${hhmm(c.at)}</b> · ${late <= -5 ? `начнут около ${hhmm(round5(f.start))}` : late >= 5 ? `начнётся около ${hhmm(round5(f.start))}` : 'начнётся вовремя'}`;
  return `<article class="dcard" data-srf="${D.COURTS[m.court].surface}" id="c-${m.id}">
    <header class="dch"><span class="num tm">${esc(m.time)}</span><span class="ct">${esc(D.COURTS[m.court].name)}</span><span class="muted">${esc(srfLabel(m.court))} · ${esc(m.title)}</span></header>
    ${pairsHtml(m, false)}
    <p class="dline">${when}${f.shortened ? ` · ${esc(rainFmtWord(f.fmt))}` : ''}</p>
    ${c ? callBox(m.id) : `<button class="btn quiet big wide" type="button" data-call="${m.id}">${icon('bell')}Вызвать на ${esc(courtLow(m.court))}</button><p class="muted">Вызывают за ${CALL_LIMIT} минут — в ${hhmm(callTime(m.id))}</p>`}
    <a class="btn text" href="${esc(keepTheme(`results.html?m=${m.id}`))}">Ввести счёт после матча</a>
  </article>`;
}
const rainFmtWord = (fmt) => (fmt.gamesToWin === 4 ? (fmt.deuce === 'deciding' ? 'до 4 геймов и решающее очко' : 'сет до 4 геймов') : 'сразу решающее очко');

// как идёт день — общее правило основы (dayPace): те же слова, что на «Сегодня»
function statusHtml(day, F) {
  const played = day.filter((m) => m.state === 'done').length;
  const P = dayPace(day, F, { slot: SLOT_MIN });
  const verdict = { cls: P.ok ? 'ok' : 'warn', t: P.text };
  const rain = rainNow();
  return `<section class="dstat" aria-label="Как идёт день">
    <div class="bignum"><span class="sublabel">Сыграно матчей сегодня</span><span class="hero">${played} <span>из ${day.length}</span></span></div>
    <p class="dverdict ${verdict.cls}">${icon(verdict.cls === 'ok' ? 'check' : 'warn')}<span>${esc(verdict.t)}</span></p>
    <p class="dline">${dayPaceLine(P)}</p>
    ${rain && rain.pick ? `<p class="note warn">${RAIN_ICON}<span>Дождь ${hhmm(rain.from)}–${hhmm(rain.to)} · решение главного судьи: «${esc(rainPickTitle(rain))}»</span></p>` : ''}
  </section>`;
}
const rainPickTitle = (rain) => (rainOpts(rain).find((o) => o.key === rain.pick) || {}).title || '';

function freeCourts(day) {
  const busyLater = (c) => day.some((m) => m.court === c && m.state !== 'done');
  return Object.keys(D.COURTS).filter((c) => !busyLater(c));
}
// журнал дня: что сделали в разделе сегодня (вызовы, переносы, счёт, дождь, судьи) и отметки судей «на корте»
// Только этот день турнира: расписание других этапов («Июльский кубок», черновик) — в «Весь журнал»
const DAY_KINDS = ['day', 'calls', 'moves', 'scores', 'days', 'judges'];
const thisDay = (e) => e.day === D.TODAY.iso && DAY_KINDS.includes(e.kind) && !(e.kind === 'days' && /[?&]t=/.test(e.href || ''));
function dayLog() {
  const done = state.journal().filter(thisDay).map((e) => ({ at: e.at, who: whoWords(e).name, t: e.what }));
  const marks = D.DAY_LOG.filter(([, kind]) => kind === 'oncourt').map(([at, , , pid]) => ({ at, who: 'Судья корта', t: `отметил: ${pairTight(pid)} на корте` }));
  return [...done, ...marks].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
function logHtml() {
  const all = dayLog();
  return `<section class="sec dlog" aria-labelledby="h-log"><div class="sec-head"><h2 class="h2" id="h-log">Журнал дня</h2><a class="btn text" href="${esc(keepTheme(`log.html?day=${D.TODAY.iso}`))}">Весь журнал</a></div>
    <ol class="list">${all.slice(0, 4).map((e) => `<li class="row"><span class="num lt">${esc(e.at)}</span><span class="grow"><span><b>${esc(e.who)}</b> ${esc(e.t)}</span></span></li>`).join('')}</ol></section>`;
}

/* ---------- отрисовка ---------- */
function render() {
  const day = dayMatchesNow();
  const F = forecast();
  const live = day.filter((m) => m.state === 'live');
  const soon = day.filter((m) => m.state === 'soon').sort((a, b) => toMin(a.time) - toMin(b.time));
  const called = soon.filter((m) => callOf(m.id)); const later = soon.filter((m) => !callOf(m.id));
  const free = freeCourts(day);
  const rain = rainNow();
  // «День турнира» — так её зовут кнопка «Вызов на корт» и меню; дата и турнир — строкой ниже
  $('#d-sub').textContent = `${dayWords(D.TODAY.iso, { cap: true })} · «${D.TOURNAMENT.name}» · финальный день`;
  // сюда ведёт «Вызов на корт»: слева — кого вызвали и кого вызывать дальше, справа — что идёт на кортах
  $('#day').innerHTML = `
    <div class="dcol">
      ${statusHtml(day, F)}
      ${called.length ? `<section class="sec" aria-labelledby="h-call"><h2 class="h2" id="h-call">Вызов на корт</h2>${called.map((m) => soonCard(m, F)).join('')}</section>` : ''}
      ${later.length ? `<section class="sec" aria-labelledby="h-next"><h2 class="h2" id="h-next">Дальше</h2>${later.map((m) => soonCard(m, F)).join('')}</section>` : ''}
      ${!soon.length ? '<p class="muted">Матчей сегодня больше нет</p>' : ''}
    </div>
    <div class="dcol">
      <section class="sec" aria-labelledby="h-now"><h2 class="h2" id="h-now">Сейчас на кортах</h2>${live.length ? live.map((m) => liveCard(m, F)).join('') : '<p class="muted">Сейчас на кортах никого</p>'}</section>
      <section class="sec" aria-labelledby="h-free"><h2 class="h2" id="h-free">Свободны до конца дня</h2><ul class="list">${free.map((c) => `<li class="row dfree" data-srf="${D.COURTS[c].surface}"><span class="srf-dot" aria-hidden="true"></span><span class="grow"><span class="t">${esc(D.COURTS[c].name)}${D.COURTS[c].note ? ' · ' + esc(D.COURTS[c].note) : ''}</span><span class="s">${esc(srfLabel(c))}</span></span></li>`).join('')}</ul></section>
      <button class="btn quiet big wide drain" type="button" data-rain>${RAIN_ICON}${rain && rain.pick ? 'Дождь: изменить решение' : 'Пошёл дождь'}</button>
      ${logHtml()}
      <nav class="dlinks" aria-label="Ещё о дне"><a class="btn quiet wide" href="${esc(keepTheme('schedule.html'))}">${icon('calendar')}Расписание дня по кортам</a><a class="btn quiet wide" href="${esc(keepTheme('results.html'))}">${icon('cup')}Результаты</a></nav>
    </div>`;
  hydrate($('#day'));
  requestAnimationFrame(() => fitText($('#day')));
}
// часы вызова: «Прошло 2 мин из 20 на выход» — раз в 5 секунд; смена состояния — перерисовка
setInterval(() => {
  callIds().forEach((id) => {
    const cs = callState(id); if (!cs) return;
    const el = document.querySelector(`[data-clock="${id}"]`); if (el && el.textContent !== cs.clock) el.textContent = cs.clock;
    const s = document.querySelector(`[data-cstat="${id}"]`); if (s && s.textContent !== cs.text) render();
  });
}, 5000);
// вызвали на «Расписании», в другой вкладке, «Отменить» — здесь то же
let queued = false;
state.on('', () => { if (mine || queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); });

/* ---------- действия ---------- */
function callNow(id) {
  const m = dayMatchesNow().find((x) => x.id === id);
  const undo = act(() => doCall(id));
  render();
  const card = document.getElementById(`c-${id}`); if (card) card.scrollIntoView({ block: 'center' });
  toast(`Вызов отправлен обеим парам: ${low1(m.title)}, ${courtLow(m.court)}`, { undo });
}
function call(id) {
  const m = dayMatchesNow().find((x) => x.id === id);
  if (tooEarly(id)) {
    // раньше обычного: сказать, когда начнут, если вызвать сейчас, — а не «у пар 20 минут»
    const t0 = clockStartNow(id); const plan = toMin(m.time);
    const by = t0 != null ? ceil5(t0 + CALL_LIMIT) : null;
    const then = by != null && by < plan
      ? `Если вызвать сейчас, пары выйдут на корт до ${hhmm(by)} и ${low1(m.title)} начнётся раньше программы на ${durAcc(plan - by)}.`
      : 'Если вызвать сейчас, часы на выход пойдут, когда освободятся корт и обе пары.';
    confirmAction({
      kind: 'main', title: `Вызвать на ${low1(m.title)} сейчас?`,
      text: `По программе ${low1(m.title)} в ${m.time}, обычно вызывают в ${hhmm(callTime(id))}. ${then}`,
      // игрок пары судит другой корт — кто и до какого времени, чей матч останется без судьи
      consq: dutyLines(id),
      action: 'Вызвать сейчас', cancel: 'Подождать', onConfirm: () => callNow(id),
    });
    return;
  }
  callNow(id);
}
function cancelCall(id) {
  const m = dayMatchesNow().find((x) => x.id === id);
  const undo = act(() => uncall(id));
  render();
  toast(`Вызов отменён: ${low1(m.title)}`, { undo });
}

// «Пошёл дождь» → когда корты снова готовы → что сократить и чьё решение → журнал
function rainStep1() {
  const was = rainNow(); const t0 = Math.ceil(dayNow() / 5) * 5;
  const r = { from: was ? was.from : t0, to: was ? was.to : t0 + 60 };
  const body = () => `<div class="stepper dt"><span class="who">Дождь начался</span><button class="btn quiet step" type="button" data-t="from" data-d="-5" aria-label="На 5 минут раньше">−</button><span class="num v">${hhmm(r.from)}</span><button class="btn quiet step" type="button" data-t="from" data-d="5" aria-label="На 5 минут позже">+</button></div>
    <div class="stepper dt"><span class="who">Корты снова готовы</span><button class="btn quiet step" type="button" data-t="to" data-d="-10" aria-label="На 10 минут раньше">−</button><span class="num v">${hhmm(r.to)}</span><button class="btn quiet step" type="button" data-t="to" data-d="10" aria-label="На 10 минут позже">+</button></div>
    <p class="strong">Перерыв ${durWords(r.to - r.from)}</p>`;
  const s = openSheet({ title: 'Пошёл дождь', body: `<div class="stack" id="rain1">${body()}</div>`, foot: `<button class="btn main big" type="button" data-next>Дальше${icon('arrow')}</button><button class="btn quiet" type="button" data-no>Отмена</button>` });
  s.querySelector('#rain1').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    r[b.dataset.t] += +b.dataset.d;
    const low = Math.ceil((dayNow() - 60) / 5) * 5;
    if (r.from < low) r.from = low;
    if (r.to < r.from) r.to = r.from;
    s.querySelector('#rain1').innerHTML = body();
  });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  s.querySelector('[data-next]').addEventListener('click', () => rainStep2(r));
}
function rainStep2(r) {
  const opts = rainOpts(r);
  const was = rainNow();
  let pick = was && was.pick ? was.pick : null; let judge = was ? was.judge || '' : '';
  const tile = (o) => { const e = round5(o.end); const mg = SUNSET - e; return `<button type="button" class="choice rain-o" role="radio" aria-checked="${pick === o.key}" data-o="${o.key}"><span class="t">${esc(o.title)}</span><span class="s">${esc(o.rule)}</span><span class="re ${mg >= 0 ? 'ok' : 'bad'}">Конец около ${hhmm(e)} · ${mg >= 0 ? `до заката ${durWords(mg)}` : `позже заката на ${durAcc(-mg)}`}</span>${o.affected ? `<span class="s">Затронет ${o.affected} ${plural(o.affected, 'матч', 'матча', 'матчей')}</span>` : ''}<span class="dot" aria-hidden="true"></span></button>`; };
  const s = openSheet({
    title: 'Что сократить?',
    body: `<p class="muted">Дождь ${hhmm(r.from)}–${hhmm(r.to)} · закат в ${esc(D.TODAY.sunset)}. Идущий матч доигрывается в своём формате.</p>
      <p class="pick-msg" role="alert" hidden></p>
      <div class="rain-opts" role="radiogroup" aria-label="Что сократить">${opts.map(tile).join('')}</div>
      <div class="field"><label class="label" for="judge">Главный судья</label><input class="input" id="judge" autocomplete="off" value="${esc(judge)}"><span class="hint">Решение подписывает он</span></div>`,
    foot: '<button class="btn main big" type="button" data-ok>Записать решение в журнал</button><button class="btn quiet" type="button" data-back>Назад</button>',
  });
  const msg = s.querySelector('.pick-msg');
  s.querySelector('.rain-opts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-o]'); if (!b) return;
    pick = b.dataset.o; s.querySelectorAll('[data-o]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); msg.hidden = true;
  });
  s.querySelector('[data-back]').addEventListener('click', () => rainStep1());
  s.querySelector('[data-ok]').addEventListener('click', () => {
    judge = s.querySelector('#judge').value.trim();
    if (!pick) { msg.textContent = 'Выберите, что сократить'; msg.hidden = false; msg.scrollIntoView({ block: 'nearest' }); return; }
    if (!judge) { msg.textContent = 'Впишите имя главного судьи: решение подписывает он'; msg.hidden = false; s.querySelector('#judge').focus(); return; }
    const o = opts.find((x) => x.key === pick);
    const undo = act(() => state.set(RAIN, { from: r.from, to: r.to, pick, judge }, {
      say: `записали решение по дождю ${hhmm(r.from)}–${hhmm(r.to)}: «${o.title}», конец дня около ${hhmm(round5(o.end))}. Подписал главный судья ${judge}`,
      href: 'day.html',
    }));
    closeLayer(true); render();
    toast(`Решение записано в журнал: «${o.title}». Сайт сам ничего не переставил`, { undo });
  });
}

document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-call]'); if (c) { call(c.dataset.call); return; }
  const u = e.target.closest('[data-uncall]'); if (u) { cancelCall(u.dataset.uncall); return; }
  if (e.target.closest('[data-rain]')) rainStep1();
});

render();
