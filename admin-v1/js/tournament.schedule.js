// «Расписание»: корты — столбцы, время — строки, матчи — плашки одной высоты.
// Сетку, перенос (мышью и кнопками), накладки словами, перерывы и публикацию дня
// делает tourPlan (js/tournament.plan.js — своя версия общего dayPlan).
// Здесь — какой день показать, «Расставить автоматически» с волнами финального дня (финал — на корт
// финала этапа), «Готово» после публикации и предпросмотр шторкой «Как увидят игроки».
// По умолчанию — «Июньский кубок», сегодня (день идёт); ?t=jul-4 — дни «Июльского кубка», черновик.
//
// Сделанное — в общем состоянии:
// • идущий день: перенос — moves.<матч> = { court, time }; перерывы и «Оставить так» —
//   days.jun-3.<день>.breaks и .kept; счёт, введённый на «Результатах», — scores.<матч>;
// • дни «Июльского кубка» (матчей в мире ещё нет): days.jul-4.<день> = { state: 'draft' | 'published',
//   rows, place, breaks, kept, manual, saved, published, dirty, shown }.
// Правка в другой вкладке и «Отменить» — расписание перерисовывается из общего состояния.
import { D, state, esc, icon, plural, toast, whereHtml, hydrate, planForDay, keepTheme, MON_GEN, dayWords, gen, openSheet, closeLayer, WD_ACC, dow, rangeShort } from '../admin.js';
import { GROUPS, TOURS, QF, LATER, placeWords, layoutDay, hhmm, toMin, RAIN_OPTIONS } from './tournament.logic.js';
import { matchNow, courtAt } from './tournament.data.js';
import { livePreview, appHead, appTab } from './tournament.preview.js';
import { tourPlan } from './tournament.plan.js';
import { tabsHtml, showCurrentTab } from './tournament.tabs.js';
import { stageNoNow, publishedStages } from './start.js';

const $ = (s, r = document) => r.querySelector(s);
const Q = new URLSearchParams(location.search);
const TID = Q.get('t') === 'jul-4' ? 'jul-4' : 'jun-3';
const LIVE = TID === 'jun-3';
const ST = D.stageNow(TID);               // этап сезона: даты и игровые дни — с переносом в календаре; запись
const TW = D.tournament(TID);
const dm = (iso) => `${+iso.slice(8)} ${MON_GEN[+iso.slice(5, 7) - 1]}`;
const COURTS = Object.keys(D.COURTS);
const ON_SRF = { clay: 'на грунте', hard: 'на харде', grass: 'на траве' };
// корт финала этапа (покрытие этапа — покрытие этого корта): у «Июльского кубка» — корт 4, трава
const FINAL_COURT = TW && TW.court && D.COURTS[TW.court] ? TW.court : null;
const pv = livePreview($('#pv'));
const KEY = (iso) => `days.${TID}.${iso}`;
// своё действие страница рисует сама; правку из другой вкладки и «Отменить» ловит подписка
let mine = 0;
const act = (fn) => { mine += 1; try { return fn(); } finally { mine -= 1; } };

/* ---------- шапка турнира и вкладки ---------- */
$('#s-back').setAttribute('href', keepTheme('season.html'));
$('#t-name').textContent = ST.name;
const tag = $('#t-tag');
tag.className = `tag lg ${LIVE ? 'live' : 'ok'}`;
tag.textContent = LIVE ? 'Идёт · финальный день' : `Запись открыта · до ${dm(ST.signupTo)}`;
$('#t-sub').textContent = `Этап ${stageNoNow(TID)} · ${rangeShort(ST.from, ST.to)} · финалы ${ON_SRF[TW.surface]}`;
// решение по дождю (days.jun-3.<день>.rain, пишет «День турнира») — строкой над вкладками, теми же словами
const rainNote = () => { const r = LIVE && state.get(`${KEY(D.TODAY.iso)}.rain`); const o = r && r.pick && RAIN_OPTIONS.find((x) => x.key === r.pick); let n = $('#s-rain'); if (!o) { if (n) n.remove(); return; } if (!n) { n = document.createElement('p'); n.id = 's-rain'; n.className = 'note warn'; $('#tabs').before(n); } n.innerHTML = `${icon('warn')}<span>Сегодня дождь ${hhmm(r.from)}–${hhmm(r.to)} · решение главного судьи: «${esc(o.title)}»</span>`; };
const drawTabs = () => { $('#tabs').innerHTML = tabsHtml(TID, 'schedule'); showCurrentTab(); rainNote(); };
drawTabs();
document.title = `Расписание · ${ST.name} · Раздел организатора`;

/* ---------- дни «Июльского кубка»: пары станут известны после жеребьёвки ---------- */
const FD_WAVES = [['sf1', 'sf2', 'c5a', 'c5b'], ['final', 'third', 'p5', 'p7']];
const AFTER = { sf1: 'Победители четвертьфиналов', sf2: 'Победители четвертьфиналов', c5a: 'Проигравшие четвертьфиналов', c5b: 'Проигравшие четвертьфиналов', final: 'Победители полуфиналов', third: 'Проигравшие полуфиналов', p5: 'Победители матчей за 5–8 места', p7: 'Проигравшие матчей за 5–8 места' };
function julyPlan(iso) {
  const k = ST.play.indexOf(iso);
  const block = D.BLOCKS[k];
  const matches = [];
  if (block.stage === 'group') {
    GROUPS.forEach((g) => TOURS[k].forEach((_, j) => matches.push({ id: `g${g}${k + 1}${j + 1}`, court: null, row: null, pairs: null, title: `Группа ${g}`, stage: 'group', state: 'soon', tbd: `Пары — после жеребьёвки ${dm(TW.draw)}`, tour: `${k + 1}-й тур` })));
  } else if (block.key === 'qf') {
    QF.forEach((q) => matches.push({ id: q.id, court: null, row: null, pairs: null, title: 'Четвертьфинал', stage: 'play', state: 'soon', tbd: `${placeWords(q.a)} — ${placeWords(q.b)}` }));
  } else {
    FD_WAVES.flat().forEach((id) => { const L = LATER.find((x) => x.id === id); matches.push({ id, court: null, row: null, pairs: null, title: L.title, stage: id === 'final' ? 'final' : 'play', state: 'soon', tbd: AFTER[id] }); });
  }
  // finalCourt — финал стоит не там: расписание говорит об этом на карточке финала и предлагает переставить
  return { day: iso, days: ST.play, mode: 'draft', cupName: ST.name, empty: true, courts: COURTS, start: '08:45', round: 50, rows: [], matches, breaks: [], now: null, rest: 30, finalCourt: FINAL_COURT };
}
const wavesOf = (st) => (st.matches.some((m) => m.id === 'final') ? FD_WAVES.map((w) => w.map((id) => st.matches.find((m) => m.id === id))) : [st.matches]);

/* ---------- день: мир и сделанное ---------- */
// черновой день «Июльского кубка» — из days.jul-4.<день> или день мира (D.dayDraftNow)
function draftDay(iso) {
  const base = julyPlan(iso);
  const s = D.dayDraftNow(TID, iso);
  if (!s) return base;
  const place = s.place || {};
  return {
    ...base,
    mode: s.state === 'published' ? 'published' : 'draft',
    publishedAt: s.published || null, dirty: !!s.dirty, manual: !!s.manual, saved: s.saved,
    rows: s.rows || [],
    matches: base.matches.map((m) => (place[m.id] ? { ...m, court: place[m.id][0], row: place[m.id][1] } : m)),
    breaks: s.breaks || [], kept: s.kept || [], shown: s.shown || null,
  };
}
// идущий день «Июньского кубка»: мир, поверх — переносы, введённый счёт, перерывы, «Оставить так»
function liveDay(iso) {
  const p = planForDay(iso);
  if (p.mode !== 'live') return p;
  const extra = state.get(KEY(iso)) || {};
  p.matches = p.matches.map((m) => {
    const n = matchNow(m.id); if (!n) return m;
    const out = { ...m };
    if (n.moved && p.rows.some((r) => r.key === n.time)) { out.court = n.court; out.row = n.time; }
    if (n.score && n.score.sets) { out.state = 'done'; out.sets = n.sets; out.winner = n.winner; out.games = undefined; out.ends = null; }
    return out;
  });
  p.breaks = extra.breaks || [];
  p.kept = extra.kept || [];
  p.now = { min: toMin(state.now()), label: state.now() };
  return p;
}
const planOf = (iso) => (LIVE ? liveDay(iso) : draftDay(iso));
// черновой день целиком — для days.jul-4.<день>
const pack = (st) => ({
  state: st.published ? 'published' : 'draft',
  saved: st.saved || state.now(), published: st.published || null, dirty: !!st.dirty, manual: !!st.manual,
  rows: st.rows.map((r) => ({ key: r.key, min: r.min, t: r.t, about: !!r.about })),
  place: Object.fromEntries(st.matches.filter((m) => m.court && m.row).map((m) => [m.id, [m.court, m.row]])),
  breaks: st.breaks.map((b) => ({ id: b.id, kind: b.kind, court: b.court, from: b.from, to: b.to, ...(b.label ? { label: b.label } : {}) })),
  kept: [...st.kept],
  shown: st.shown || null,
});
const breaksOf = (st) => st.breaks.map((b) => ({ id: b.id, kind: b.kind, court: b.court, from: b.from, to: b.to }));
// сохранить сделанное; вернёт undo для «Отменить»
function save(st, { say, kind }) {
  const href = LIVE ? 'schedule.html' : `schedule.html?t=${TID}&day=${st.day}`;
  if (!LIVE) return state.set(KEY(st.day), pack(st), { say, href });
  if (kind === 'breaks') return state.set(`${KEY(st.day)}.breaks`, breaksOf(st), { say, href });
  if (kind === 'kept') return state.set(`${KEY(st.day)}.kept`, [...st.kept], { say, href });
  // перенос: где матч стоит не по программе — запись moves.<матч>; вернули на место — записи нет
  const next = { ...(state.get('moves') || {}) };
  st.matches.forEach((m) => {
    const w = D.match(m.id); if (!w || w.state !== 'soon') return;
    if (m.court === w.court && m.row === w.time) delete next[m.id];
    else if (m.court && m.row) next[m.id] = { court: m.court, time: m.row };
  });
  return state.set('moves', next, { say, href });
}

const root = $('#plan');
const first = LIVE ? D.TODAY.iso : (ST.play.includes(Q.get('day')) ? Q.get('day') : ST.play[0]);
// «Готово» после «Опубликовать день»: что сделано и где это теперь
let wasPub = null;
function onPlanChange(st) {
  if (st.published && st.published !== wasPub && !st.dirty && st.mode !== 'live') {
    const next = st.days[st.days.indexOf(st.day) + 1];
    const s = openSheet({
      title: 'Готово',
      body: `<div class="done-box"><span class="done-mark">${icon('check')}</span><h3 class="h1">Расписание на ${esc(WD_ACC[dow(st.day)])}, ${esc(dm(st.day))} опубликовано</h3>
        <ul class="where-now"><li>${icon('phone')}<span><b>Приложение</b> — «Турнир» → «Расписание», у игроков — «Ваш матч»</span></li><li>${icon('site')}<span><b>Сайт</b> — страница «${esc(gen(ST.name))}» → «Расписание»</span></li><li>${icon('board')}<span><b>Табло в клубе</b> — «Все корты»</span></li></ul></div>`,
      foot: next ? `<button class="btn main" type="button" data-x4>${icon('arrow')}Дальше: ${esc(dayWords(next))}</button>` : `<a class="btn main" href="${esc(keepTheme(`tournament.html?t=${TID}&step=bracket`))}">${icon('cup')}Открыть турнир</a>`,
    });
    const nx = s.querySelector('[data-x4]');
    if (nx) nx.addEventListener('click', () => { closeLayer(true); const b = root.querySelector(`.plan-days [data-day="${next}"]`); if (b) b.click(); });
  }
  wasPub = st.published;
  drawTabs();
  pv.update();
}
const plan = tourPlan(root, {
  ...planOf(first),
  calls: LIVE,
  save, act,
  onChange: (st) => onPlanChange(st),
  arrange: () => arrange(),
  onDay: (iso) => {
    plan.load(planOf(iso));
    wasPub = plan.state.published;
    pv.update();
    const u = new URL(location.href); u.searchParams.set('day', iso); history.replaceState(null, '', u);
  },
});
wasPub = plan.state.published;
// правка в другой вкладке, на «Результатах», «Отменить» — тот же день заново из общего состояния
function reload() {
  const showPlayed = plan.state.showPlayed;
  // корты, до которых человек пролистал сетку вбок (1024), остаются на месте
  const wrap = root.querySelector('.pgrid-wrap'); const left = wrap ? wrap.scrollLeft : 0;
  plan.load({ ...planOf(plan.state.day), showPlayed });
  const w2 = root.querySelector('.pgrid-wrap'); if (w2 && left) w2.scrollLeft = left;
  wasPub = plan.state.published;
  drawTabs();
  pv.update();
}
let queued = false;
state.on('', () => { if (mine || queued) return; queued = true; requestAnimationFrame(() => { queued = false; reload(); }); });
// часы примера идут с делами: после своего дела (подписка его пропускает) линия «сейчас» и «Сейчас 18:52»
// в шапке догоняют часы здесь; пока открыто окно, тащат матч или в сетке фокус — не трогаем
if (LIVE) {
  let minute = state.now();
  setInterval(() => {
    if (state.now() === minute || document.querySelector('.scrim, .lifted') || root.contains(document.activeElement)) return;
    minute = state.now(); reload();
  }, 15000);
}

/* ---------- «Расставить автоматически» ---------- */
const S = () => plan.state;
const timeRow = (i, min) => ({ key: `r${i + 1}`, min, t: hhmm(min), about: i > 0 });
function busy(st, c, rk) {
  const ri = st.rows.findIndex((r) => r.key === rk); const r = st.rows[ri];
  const end = st.rows[ri + 1] ? st.rows[ri + 1].min : r.min + (st.round || 50);
  return st.matches.some((m) => m.court === c && m.row === rk) || st.breaks.some((b) => (!b.court || b.court === c) && b.from < end && b.to > r.min);
}
function arrange() {
  const st = S();
  const todo = st.matches.filter((m) => m.state === 'soon' && (!m.court || !m.row));
  if (!todo.length) { toast('Все матчи дня уже в расписании'); return; }
  if (!st.rows.length || !st.matches.some((m) => m.court && m.row)) {
    // пустой день: матчи друг за другом с начала дня, финал — на корт финала этапа, остальные —
    // на свободные корты по порядку; в финальный день вторая волна — после первой и 30 минут отдыха пар
    const pin = FINAL_COURT && st.courts.includes(FINAL_COURT) ? { final: FINAL_COURT } : {};
    const items = layoutDay(wavesOf(st), { start: toMin(st.start || '08:45'), round: st.round || 50, courts: st.courts, rest: 30, pin });
    const mins = [...new Set(items.map((x) => x.min))].sort((a, b) => a - b);
    st.rows = mins.map((min, i) => timeRow(i, min));
    items.forEach((x) => { const m = st.matches.find((y) => y.id === x.id); m.court = x.court; m.row = `r${mins.indexOf(x.min) + 1}`; });
  } else {
    // часть уже стоит: оставшиеся — в свободные клетки по порядку, нет места — новое время
    for (const m of todo) {
      let put = false;
      for (const r of st.rows) { for (const c of st.courts) { if (!busy(st, c, r.key)) { m.court = c; m.row = r.key; put = true; break; } } if (put) break; }
      if (!put) { const last = st.rows[st.rows.length - 1]; const i = st.rows.length; st.rows.push(timeRow(i, last.min + (st.round || 50))); m.court = st.courts[0]; m.row = `r${i + 1}`; }
    }
  }
  st.dirty = true; st.manual = true; st.saved = state.now();
  plan.draw();
  const t0 = st.rows[0] ? st.rows[0].t : '';
  const n = `${todo.length} ${plural(todo.length, 'матч', 'матча', 'матчей')}`;
  const undo = act(() => save(st, { say: `расставили ${n} на ${WD_ACC[dow(st.day)]}, ${dm(st.day)} — черновик расписания «${gen(ST.name)}»`, kind: 'place' }));
  drawTabs();
  pv.update();
  // финал встал на свой корт — так и сказать; не встал — об этом скажет карточка финала
  const fin = st.matches.find((m) => m.stage === 'final' && m.court && m.row);
  const finSay = fin && fin.court === FINAL_COURT ? ` Финал — на ${courtAt(FINAL_COURT)}, ${D.SURFACES[D.COURTS[FINAL_COURT].surface].label}.` : '';
  toast(`Расставлено: ${n}, первые в ${t0}.${finSay} Это черновик — поправьте как нужно`, { undo });
}

/* ---------- предпросмотр: шторка «Как увидят игроки» ---------- */
const placedOf = (st) => st.matches.filter((m) => m.court && m.row).sort((a, b) => {
  const ra = st.rows.find((r) => r.key === a.row); const rb = st.rows.find((r) => r.key === b.row);
  return (ra ? ra.min : 0) - (rb ? rb.min : 0) || a.court.localeCompare(b.court);
});
const timeOf = (st, m) => { const r = st.rows.find((x) => x.key === m.row); return r ? `${r.about ? 'около ' : ''}${r.t || r.key}` : ''; };
const whoOf = (m) => (m.pairs ? `${D.pairName(m.pairs[0])} — ${D.pairName(m.pairs[1])}` : m.tbd || 'Пары ещё не известны');
const stageWord = (m) => (m.tour ? `${m.title}, ${m.tour}` : m.title);
function showPreview() {
  pv.show({
    page: 'tournament.html', title: 'Приложение: Турнир, Расписание',
    get banner() { const st = S(); return st.mode === 'live' ? 'День идёт: игроки видят изменения сразу' : st.mode === 'done' ? 'Так это видят игроки' : st.published && !st.dirty ? 'Так это видят игроки сейчас' : 'Предпросмотр — игроки увидят после «Опубликовать день»'; },
    patch: (doc, mark) => {
      appTab(doc, 'raspisanie');
      const st = S();
      const pane = doc.getElementById('pane-raspisanie'); if (!pane) return;
      if (LIVE) {
        if (st.day !== D.TODAY.iso) { mark(pane.querySelector('.lead-say'), 'Сегодня'); return; }
        let moved = null;
        st.matches.filter((m) => m.state === 'soon' && m.court && m.row).forEach((m) => {
          const t = pane.querySelector(`.mt[data-match="${m.id}"]`); if (!t) return;
          const o = D.match(m.id); const time = timeOf(st, m);
          const cap = t.querySelector('.mt-head .cap'); if (cap) cap.textContent = D.courtLine(m.court);
          t.querySelectorAll('[data-surface]').forEach((x) => { x.dataset.surface = D.COURTS[m.court].surface; });
          const w = t.querySelector('.mt-when .num'); if (w) w.textContent = time;
          if (o.court !== m.court || o.time !== time) moved = t;
        });
        if (moved) mark(moved, 'Перенесено');
        else mark(pane.querySelector('.mt[data-state="live"]') || pane.querySelector('.lead-say'), 'Сейчас');
        return;
      }
      appHead(doc, { surface: TW.surface, cap: `Этап ${stageNoNow(TID)} из ${publishedStages().length}`, title: ST.name, meta: `${LIVE ? TW.dates : rangeShort(ST.from, ST.to).replace(/\u2060/g, '')} · 16 пар`, line: dayWords(st.day, { cap: true }) });
      const list = placedOf(st);
      // одна и та же строка «Пары — после жеребьёвки» у всех матчей — один раз сверху
      const same = list.length && list.every((m) => !m.pairs && m.tbd === list[0].tbd) ? list[0].tbd : '';
      pane.innerHTML = `<section class="section lead-say"><span class="cap">${esc(dayWords(st.day, { cap: true }))}</span><p class="title">${list.length ? 'Расписание дня' : 'Расписания ещё нет'}</p><p class="muted">${list.length ? `${list.length} ${plural(list.length, 'матч', 'матча', 'матчей')} · первый в ${esc(timeOf(st, list[0]))}${same ? '. ' + esc(same) : ''}` : 'Появится, когда вы его опубликуете'}</p></section>`
        + (list.length ? `<section class="section"><div class="card">${list.map((m) => `<div class="row"><span class="num" style="min-width:64px;font-size:22px">${esc(timeOf(st, m).replace('около ', ''))}</span><span class="grow"><span class="strong">${esc(D.COURTS[m.court].name)} · ${esc(stageWord(m))}</span>${same ? '' : `<span class="sub">${esc(whoOf(m))}</span>`}</span></div>`).join('')}</div></section>` : '');
      mark(pane.querySelector('.lead-say'), st.published && !st.dirty ? 'Видно' : 'Черновик');
    },
    site: () => {
      const st = S(); const list = placedOf(st);
      return `<div class="site-t"><b>${esc(ST.name)}</b><span>Расписание · ${esc(dayWords(st.day))}</span></div>${list.length ? list.slice(0, 6).map((m) => `<div class="site-row"><span class="d">${esc(timeOf(st, m).replace('около ', ''))}</span><span class="t">${esc(D.COURTS[m.court].name)} · ${esc(stageWord(m))}</span><span class="s">${esc(whoOf(m))}</span></div>`).join('') : '<p class="muted">Расписания этого дня ещё нет</p>'}`;
    },
  });
}
showPreview();
// кнопка «Как увидят игроки» — в шапке на ноутбуке, под расписанием на телефоне
document.querySelectorAll('.s-pv').forEach((b) => { b.innerHTML = `${icon('eye')}Как увидят игроки`; });
$('#s-where').innerHTML = `${whereHtml([
  { icon: 'phone', b: 'Приложение', s: '«Турнир» → «Расписание», «Сегодня» → «Ваш матч», афиша матча' },
  { icon: 'site', b: 'Сайт', s: `страница «${gen(ST.name)}» → «Расписание»; главная → «Сейчас на кортах»` },
  { icon: 'board', b: 'Табло в клубе', s: '«Все корты»' },
])}`;
hydrate($('#s-where'));
