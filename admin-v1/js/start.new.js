// ============================================================
// «Новый турнир» — мастер по шагам: один вопрос на шаг, справа всё время
// настоящий экран приложения «Турниры» с этим турниром.
// Начало · Название · Даты · Корты · Игровые дни · Формат · Запись · Проверка → «Готово».
// Что заполнено — одно состояние на всё (stepState в start.js): по нему шкала шагов,
// проверка, список задач черновика и дело на «Сегодня» говорят одно и то же.
// Турнир сохраняется сам при каждой правке — в общее состояние раздела (cups.<турнир>);
// в журнал действий попадают начало черновика, «Сохранить и выйти», публикация и удаление.
// Адреса: ?from=2027-08-21 — с этого дня; ?draft=aug-5 — список задач черновика;
// ?cup=aug-5&step=check — сразу на шаг; ?cup=new-1&edit=1 — правка опубликованного турнира:
// правки лежат отдельно (cups.<турнир>.edit), игроки видят прежнее до «Показать правки игрокам».
// ============================================================
import {
  D, state, esc, icon, el, hydrate, toast, openSheet, closeLayer, confirmAction, previewPanel, whereHtml,
  datePicker, dateField, playDays, progressHtml, rangeShort, rangeWords, cap1, plural,
  addDays, gen, dow, keepTheme, dayWords, hhmm, MON_GEN, instr, isPhone,
} from '../admin.js';
import {
  $, $$, getCup, putCup, freshCup, seasonStages, cupToStage, TEMPLATES, tplOf, applyTemplate,
  SIGNUP_BEFORE, DRAW_BEFORE, playPattern, daysShort, rangeLine, courtsWords, surfaceOf, surfaceWord, COURT_IDS,
  blocksFor, planDays, daySetOf, matchCount, FORMATS, KINDS, whereFor, TASKS, tasksLeft, stepState, STEP_KEYS,
  andList, matchesWord, stageNoFor, prep, openDrafts, PREV, plainRange, seasonHref, isNewId,
  surfacesWords, courtsLine, ON_SURFACE, stagesShift, shiftWords, patchSeasonPath, courtLow,
} from './start.js';

const TODAY = D.NOW.iso;
const q = new URLSearchParams(location.search);
const STEPS = [
  { key: 'start', name: 'Начало' },
  { key: 'name', name: 'Название' },
  { key: 'dates', name: 'Даты' },
  { key: 'courts', name: 'Корты' },
  { key: 'days', name: 'Игровые дни' },
  { key: 'format', name: 'Формат' },
  { key: 'signup', name: 'Запись' },
  { key: 'check', name: 'Проверка' },
];
const idx = (k) => STEPS.findIndex((s) => s.key === k);
const stepName = (k) => STEPS[idx(k)].name;
const clone = (x) => JSON.parse(JSON.stringify(x));
const low1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);

let C = null;         // турнир в работе
let step = 0;
let back2check = false;
let dp = null;        // выбор дат
let draftLine = [];   // начатые черновики — строкой над мастером
// Правка опубликованного турнира: EDIT.pub — что видят игроки, C — правки (cups.<турнир>.edit).
let EDIT = null;
const stripEdit = (x) => { const { edit, ...rest } = x || {}; return rest; };
// что сравниваем у правок: поля каждого шага
const EDIT_KEYS = { name: ['name', 'kind'], dates: ['from', 'to'], courts: ['courts', 'finalCourt'], days: ['play', 'start', 'round', 'daySet'], format: ['format', 'third', 'places'], signup: ['signupTo', 'draw', 'fee'] };
const editedSteps = () => (EDIT ? Object.keys(EDIT_KEYS).filter((k) => EDIT_KEYS[k].some((f) => JSON.stringify(C[f] ?? null) !== JSON.stringify(EDIT.pub[f] ?? null))) : []);
const editDirty = () => editedSteps().length > 0;
const tourHref = () => `tournament.html?t=${C.id}`;

// ---------- номер этапа, слова ----------
// номер — тот, что увидят игроки после публикации: опубликованные этапы раньше этого плюс один
const stageNo = () => (C.kind === 'stage' ? stageNoFor(C) : null);
const kindWord = () => (C.kind === 'stage' ? `этап ${stageNo()}` : C.kind === 'final' ? 'Итоговый турнир сезона' : 'отдельный турнир');
// «как в «Июльском кубке» — проверьте»: так помечено подставленное из шаблона
const likeNote = () => { const t = tplOf(C); return t ? `как в «${prep(t.name)}» — проверьте` : 'предложено по прошлому этапу — проверьте'; };

// ---------- сохранение ----------
// Каждая правка — сразу в общее состояние (без строки журнала). Строкой журнала — только дела:
// «начали черновик», «сохранили черновик», «опубликовали турнир», «удалили черновик».
// lastSaved — что записали мы сами: по нему видно, что турнир поменяли в другой вкладке.
let saveT = null;
let lastSaved = '';
let selfWrite = false;
// своя запись в общее состояние (и её «Отменить») — не «правка из другой вкладки»
const own = (fn) => { selfWrite = true; try { return fn(); } finally { selfWrite = false; } };
const savedWords = (at) => (/^сегодня в /.test(at || '') ? `Сохранено в ${at.slice(10)}` : `Сохранено ${at || ''}`);
// opts — { say, href }: строка журнала; возвращает «Отменить» (и значение, и строку журнала)
function save(opts) {
  C.savedAt = `сегодня в ${state.now()}`;
  lastSaved = JSON.stringify(C);
  // правка опубликованного: игроки видят прежнее, правки — рядом; без правок — запись как была
  const rec = EDIT ? (editDirty() ? { ...EDIT.pub, edit: stripEdit(C) } : EDIT.pub) : C;
  const back = own(() => putCup(rec, opts));
  const lab = $('#nt-saved');
  lab.hidden = C.state === 'open' && !EDIT;
  lab.innerHTML = `${icon('clock')}Сохраняется…`;
  clearTimeout(saveT);
  saveT = setTimeout(() => { lab.innerHTML = `${icon('check')}${esc(savedWords(C.savedAt))}`; }, 800);
  if (EDIT) editTag();
  return () => own(back);
}
// строка журнала про этот турнир ведёт туда, где его потом найти
const cupHref = () => (C.state === 'draft' ? `new-tournament.html?draft=${C.id}` : isNewId(C.id) ? tourHref() : seasonHref(C.from));
const cupName = () => C.name || 'Новый турнир';

// ---------- низ мастера ----------
function sum(text, bad = false) { const s = $('#nt-sum'); s.textContent = text || ''; s.classList.toggle('bad', !!bad); }

// ---------- «Дальше»: чего не хватает — словами ----------
function gate(key) {
  if (key === 'start') return C.base ? { ok: true } : { ok: false, t: 'Выберите, с чего начнём' };
  if (key === 'dates' && dp) { const m = dp.missing(); if (m) return { ok: false, t: m }; }
  const s = stepState(C, key);
  return s.st === 'missing' ? { ok: false, t: s.t } : { ok: true };
}

// ---------- шаблон «Как …» ----------
function setBase(v) {
  if (v === C.base) return;
  C.base = v;
  applyTemplate(C, { force: true });
  save(); paint(); sum(footText());
}
// даты сменились: подставленное (дни, запись) — заново; вписанное самим — что не вписывается, снимается
function datesChanged() {
  if (C.play.length) C.play = C.play.filter((d) => d >= C.from && d <= C.to);
  if (!C.play.length) { delete C.done.days; C.auto = C.auto || {}; C.auto.days = null; }
  if (C.daySet) C.daySet = null;
  // вписанный руками срок записи позже нового начала — снимается, шаг «Запись» снова пустой
  if (C.signupTo && C.signupTo >= C.from && !(C.auto && C.auto.signup)) { C.signupTo = null; C.draw = null; delete C.done.signup; }
  applyTemplate(C);
}

// ============================================================
// ШАГИ
// ============================================================
const render = {};

// С чего начнём: «Как …» для каждого покрытия и «С чистого листа». Слева у плитки — полоса покрытия.
// Корты у турниров-образцов одни и те же — одной строкой над плитками; на плитке — чем образец
// отличается: корт финала и сроки записи («Финал — корт 1, грунт · сроки записи впишете сами»).
const tplLine = (t) => `Финал — ${courtLow(t.court)}, ${surfaceWord(t.court)} · ${t.signupTo ? `запись закрывается за ${SIGNUP_BEFORE} ${plural(SIGNUP_BEFORE, 'день', 'дня', 'дней')} до начала` : 'сроки записи впишете сами'}`;
render.start = (body) => {
  const opts = [
    ...TEMPLATES.map((t) => ({ v: t.id, t: `Как «${t.name}»`, s: tplLine(t), srf: t.surface })),
    { v: 'new', t: 'С чистого листа', s: 'Все ответы вписываете сами' },
  ];
  const courts = surfacesWords(COURT_IDS).replace(/^Корты? /, '');
  body.innerHTML = `<p class="nt-line">${icon('info')}<span>Корты у ${TEMPLATES.length > 1 ? 'этих турниров одни и те же' : 'этого турнира'}: ${esc(courts)}</span></p>
    <div class="choices nt-tpls" role="radiogroup" aria-label="С чего начнём?">${opts.map((o) => `<button type="button" class="choice nt-tpl" role="radio" aria-checked="${C.base === o.v}" data-value="${o.v}"${o.srf ? ` data-srf="${o.srf}"` : ''}><span class="t">${esc(o.t)}</span><span class="s">${esc(o.s)}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div>`;
  hydrate(body);
  $('.choices', body).addEventListener('change', (e) => setBase(e.detail));
};

render.name = (body) => {
  const no = stageNoFor(C);
  body.innerHTML = `<div class="field" id="nt-name-f"><label class="label" for="nt-name">Название</label><span class="err">${icon('alert')}<span></span></span><input class="input nt-name" id="nt-name" autocomplete="off" value="${esc(C.name)}"><span class="hint"${C.name ? ' hidden' : ''}>Например: Осенний кубок</span></div>
    <div class="stack tight nt-kind"><span class="label">Какой это турнир?</span>
    <div class="choices nt-kinds" role="radiogroup" aria-label="Какой это турнир?">${[
    { value: 'stage', t: KINDS.stage.t, s: `Встанет в путь сезона этапом ${no}` },
    { value: 'separate', t: KINDS.separate.t, s: KINDS.separate.s },
    { value: 'final', t: KINDS.final.t, s: KINDS.final.s },
  ].map((o) => `<button type="button" class="choice" role="radio" aria-checked="${C.kind === o.value}" data-value="${o.value}"><span class="t">${esc(o.t)}</span><span class="s">${esc(o.s)}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div>
    <p class="note" id="nt-kind-note"${C.kind === 'separate' ? '' : ' hidden'}>${icon('info')}<span>Пойдёт ли отдельный турнир в рейтинг, решит Совет</span></p></div>`;
  hydrate(body);
  const inp = $('#nt-name', body);
  inp.addEventListener('input', () => {
    C.name = inp.value.trim().replace(/\s+/g, ' ');
    $('#nt-name-f').classList.remove('error');
    $('#nt-name-f .hint').hidden = !!C.name; // пример нужен пустому полю
    $('#nt-h1').textContent = C.name || 'Новый турнир';
    save(); paintPreview(); sum(footText());
  });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } });
  $('.nt-kinds', body).addEventListener('change', (e) => {
    C.kind = e.detail;
    $('#nt-kind-note').hidden = C.kind !== 'separate';
    save(); setupPreview(); sum(footText());
  });
  if (!C.name) setTimeout(() => inp.focus({ preventScroll: true }), 60);
};

// Даты: предложение и быстрые кнопки сверху, подпись отметок — над календарём,
// «Раньше» и «Позже» — в строке названий месяцев. Открывается на этом и следующем месяце.
function suggestion() {
  if (C.from && !C.to) {
    const to = addDays(C.from, 7);
    return { from: C.from, to, text: `С ${dayWords(C.from).replace(/^(\S+),/, (m, w) => `${{ понедельник: 'понедельника', вторник: 'вторника', среда: 'среды', четверг: 'четверга', пятница: 'пятницы', суббота: 'субботы', воскресенье: 'воскресенья' }[w] || w},`)} — 8 дней, как прошлый этап` };
  }
  const prior = seasonStages().filter((s) => s.id !== C.id && s.kind !== 'separate' && s.kind !== 'final').sort((a, b) => (a.from < b.from ? -1 : 1)).pop();
  const from = addDays(prior.from, 28); const to = addDays(from, 7);
  return { from, to, text: `Через четыре недели после «${gen(prior.name)}», как обычно` };
}
render.dates = (body) => {
  body.innerHTML = '<div class="nt-dp"></div>';
  const root = $('.nt-dp', body);
  const sug = suggestion();
  const others = seasonStages().filter((s) => s.id !== C.id);
  const words = (r) => (r.from && r.to && !r.clash ? rangeLine(r.from, r.to) : r.words);
  dp = datePicker(root, {
    id: 'nt', month: (C.from || TODAY).slice(0, 7), from: C.from, to: C.to, self: C.id, others, suggest: sug,
    onChange: (r) => {
      let changed = false;
      if (r.from && r.to) {
        changed = r.from !== C.from || r.to !== C.to;
        C.from = r.from; C.to = r.to; C.clash = r.clash ? r.clash.name : null;
        if (changed) datesChanged();
      } else if (r.from) { changed = r.from !== C.from || !!C.to; C.from = r.from; C.to = null; }
      $('.dp-type .hint', root).hidden = !!(r.from && r.to);
      sum(words(r) || `Нажмите первый день или впишите даты ${typeWhere()}`, !!(r.clash || r.error));
      if (changed) { save(); paintPreview(); }
    },
  });
  arrangePicker(root, sug);
  const r = dp.get();
  $('.dp-type .hint', root).hidden = !!(r.from && r.to);
  sum(words(r) || `Нажмите первый день или впишите даты ${typeWhere()}`, !!(r.clash || r.error));
};
// поле «Или впишите даты»: на ноутбуке — под календарём, на телефоне — над ним
const typeWhere = () => (isPhone() ? 'над календарём' : 'под календарём');
// Перестановка выбора дат основы: только порядок и слова, работа календаря — её
function arrangePicker(root, sug) {
  const take = $('[data-take]', root);
  if (take && sug) take.innerHTML = `${icon('check')}Взять ${esc(plainRange(sug.from, sug.to))}`;
  const nav = $('.dp-nav', root); const months = $('.dp-months', root); const legend = $('.dp-legend', root);
  const cal = el('<div class="ntc-cal"></div>');
  nav.before(cal); cal.append(nav, months);
  cal.before(legend);
  // название чужого турнира — один раз в месяце, под самым длинным его куском; короткий кусок — штриховкой без слов
  const span = (b) => { const m = /(\d+)\s*\/\s*(\d+)/.exec(b.style.gridColumn); return m ? +m[2] - +m[1] : 0; };
  const bands = () => {
    $$('.dp-month', months).forEach((mo) => {
      const by = {};
      $$('.dp-band', mo).forEach((b) => { if (!b.dataset.name) b.dataset.name = b.textContent; (by[b.dataset.name] = by[b.dataset.name] || []).push(b); });
      Object.values(by).forEach((list) => {
        if (list.length < 2) return;
        const best = list.reduce((a, b) => (span(b) > span(a) ? b : a));
        list.forEach((b) => { const mini = b !== best; b.classList.toggle('ntc-mini', mini); b.textContent = mini ? '' : b.dataset.name; });
      });
    });
  };
  bands();
  new MutationObserver(bands).observe(months, { childList: true });
  // подсказка календаря («Прошедшие дни выбрать нельзя») — в строке итога внизу, там, куда смотрят
  const msg = $('.dp-msg', root);
  new MutationObserver(() => { if (msg.textContent) sum(msg.textContent, msg.classList.contains('bad')); }).observe(msg, { childList: true, characterData: true, subtree: true });
}

const courtPic = (c) => `<span class="nt-cpic srf-fill" data-srf="${D.COURTS[c].surface}" aria-hidden="true"><i></i></span>`;
// Быстрый выбор: все корты или только одно покрытие (если на нём хотя бы два корта)
function courtSets() {
  const by = {};
  COURT_IDS.forEach((c) => { const s = surfaceOf(c); (by[s] = by[s] || []).push(c); });
  return [
    { k: 'all', t: 'Все корты', ids: COURT_IDS.slice() },
    ...Object.keys(D.SURFACES).filter((s) => (by[s] || []).length > 1).map((s) => ({ k: s, t: `Только ${D.SURFACES[s].label}`, ids: by[s] })),
  ];
}
render.courts = (body) => {
  const t = tplOf(C);
  const fromTpl = t && C.auto && C.auto.courts && !C.done.courts;
  const sets = courtSets();
  const same = (ids) => ids.length === C.courts.length && ids.every((c) => C.courts.includes(c));
  body.innerHTML = `${fromTpl ? `<p class="nt-line" id="nt-cline">${icon('info')}<span>Отмечено как в «${esc(prep(t.name))}». Покрытие у кортов разное — проверьте</span></p>` : ''}
    <div class="dp-quick nt-cquick" role="group" aria-label="Быстрый выбор кортов"><span class="lbl">Быстро:</span>${sets.map((x) => `<button type="button" class="chip" aria-pressed="${same(x.ids)}" data-set="${x.k}">${icon('check')}${esc(x.t)}</button>`).join('')}</div>
    <div class="nt-courts" role="group" aria-label="Корты турнира">${COURT_IDS.map((c) => {
    const ct = D.COURTS[c];
    return `<button type="button" class="choice nt-court" aria-pressed="${C.courts.includes(c)}" data-c="${c}"><span class="pic">${courtPic(c)}</span><span class="t">${esc(ct.name)}</span><span class="s">${esc([ct.note, D.SURFACES[ct.surface].label].filter(Boolean).join(' · '))}</span><span class="dot" aria-hidden="true">${icon('check')}</span></button>`;
  }).join('')}</div>
    <div class="field full nt-final"><span class="label">Где играют финал?</span><div class="chips" role="radiogroup" aria-label="Корт финала" id="nt-final"></div><span class="hint">Цвет турнира в календаре и в приложении — покрытие корта финала</span></div>`;
  const drawFinal = () => {
    const box = $('#nt-final', body);
    box.innerHTML = C.courts.length ? C.courts.map((c) => `<button type="button" class="chip" role="radio" aria-checked="${C.finalCourt === c}" data-value="${c}">${icon('check')}<span class="srf-dot" data-srf="${D.COURTS[c].surface}"></span>${esc(D.COURTS[c].name)} · ${esc(surfaceWord(c))}</button>`).join('') : '<span class="muted">Сначала отметьте корты выше</span>';
    hydrate(box.parentNode);
  };
  drawFinal();
  // отметили корты сами — строка «Отмечено как в …» больше не правда: её нет, выбор — в строке внизу
  const touched = () => { if (C.auto) C.auto.courts = false; if (C.daySet) Object.values(C.daySet).forEach((x) => { x.courts = C.courts.slice(); }); $('#nt-cline', body)?.remove(); };
  const paintSets = () => $$('.nt-cquick [data-set]', body).forEach((b) => b.setAttribute('aria-pressed', String(same(sets.find((x) => x.k === b.dataset.set).ids))));
  $('.nt-courts', body).addEventListener('click', (e) => {
    const b = e.target.closest('.nt-court'); if (!b) return;
    const c = b.dataset.c; const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    C.courts = COURT_IDS.filter((x) => (x === c ? on : C.courts.includes(x)));
    if (!C.courts.includes(C.finalCourt)) C.finalCourt = C.courts.length === 1 ? C.courts[0] : null;
    touched(); drawFinal(); paintSets(); save(); paintPreview(); sum(footText());
  });
  // «Только грунт»: корты этого покрытия, финал — на первом из них (если прежний корт финала не подходит)
  $('.nt-cquick', body).addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    const x = sets.find((s) => s.k === b.dataset.set);
    C.courts = x.ids.slice();
    if (!C.courts.includes(C.finalCourt)) C.finalCourt = C.courts[0];
    $$('.nt-court', body).forEach((t2) => t2.setAttribute('aria-pressed', String(C.courts.includes(t2.dataset.c))));
    touched(); drawFinal(); paintSets(); save(); paintPreview(); sum(footText());
  });
  $('#nt-final', body).addEventListener('change', (e) => { C.finalCourt = e.detail; touched(); save(); paintPreview(); sum(footText()); });
};

// Игровые дни: плитки и настройки дня — из основы (playDays); итог словами и решения — свои:
// у короткого турнира день считается до вечера, а если матчи не успевают, под ошибкой — кнопки-решения.
render.days = (body) => {
  body.innerHTML = '<div class="nt-pd"></div><section class="nt-dsum card" aria-live="polite" aria-label="Итог"></section>';
  const pd = $('.nt-pd', body);
  if (!C.play.length && C.from && C.to) C.play = playPattern(C.from, C.to, C.base);
  const first = C.play.length ? daySetOf(C, C.play.slice().sort()[0]) : null;
  let ready = false; // первый итог приходит при отрисовке — это ещё не правка человека
  playDays(pd, {
    from: C.from, to: C.to, play: C.play, start: first ? first.start : C.start, round: first ? first.round : C.round,
    courts: first ? first.courts : (C.courts.length ? C.courts : COURT_IDS), blocks: blocksFor(C),
    onChange: (r) => {
      C.play = r.play; C.daySet = r.set;
      const f = r.set[r.play[0]]; if (f) { C.start = f.start; C.round = f.round; }
      drawDaySum(body);
      if (!ready) return;
      if (C.auto) C.auto.days = false;
      save(); paintPreview(); drawScale();
    },
  });
  ready = true;
  tidyDays(pd);
  drawDaySum(body);
};
// слова основы проще: «круг 50 минут» → «на матч 50 минут», без «или 0845»
function tidyDays(pd) {
  const fix = () => {
    $$('.dset-line', pd).forEach((x) => { if (/круг /.test(x.textContent)) x.textContent = x.textContent.replace('круг ', 'на матч '); });
    $$('.label', pd).forEach((x) => { if (x.textContent === 'Начало первого круга') x.textContent = 'Начало игр'; if (x.textContent === 'Круг длится') x.textContent = 'Время на матч'; });
    $$('.hint', pd).forEach((x) => { if (/или 0845/.test(x.textContent)) x.textContent = 'например: 08:45'; });
    $$('[role="radiogroup"][aria-label="Круг длится"]', pd).forEach((x) => x.setAttribute('aria-label', 'Время на матч'));
  };
  fix();
  new MutationObserver(fix).observe(pd, { childList: true, subtree: true, characterData: true });
}
const dayHead = (d) => `${cap1(dayWords(d)).replace(/^(\S+),/, (m, w) => `${{ Понедельник: 'Пн', Вторник: 'Вт', Среда: 'Ср', Четверг: 'Чт', Пятница: 'Пт', Суббота: 'Сб', Воскресенье: 'Вс' }[w] || w},`)}`;
function drawDaySum(body) {
  const box = $('.nt-dsum', body); if (!box) return;
  const p = planDays(C);
  const grp = p.grp; const total = p.total;
  const lines = p.lines.map((l) => {
    if (l.spare) return `<li class="spare"><b>${esc(dayHead(l.d))}</b> — запасной день, матчей нет</li>`;
    if (l.none) return `<li class="bad"><b>${esc(dayHead(l.d))}</b> — ${esc(l.label)}: не выбран ни один корт</li>`;
    return `<li${l.bad ? ' class="bad"' : ''}><b>${esc(dayHead(l.d))}</b> — ${esc(l.label)}: ${matchesWord(l.n)}, с&nbsp;<span class="num">${esc(l.from)}</span> до&nbsp;<span class="num">${hhmm(l.end)}</span>${l.end >= 24 * 60 ? ' (уже после полуночи)' : ''}</li>`;
  }).join('');
  const fixes = p.ok ? [] : dayFixes(p);
  box.innerHTML = `<h3 class="h3">Итог</h3>
    <p><b>Всего ${matchesWord(total)}:</b> ${grp ? `${grp} в группах и ${total - grp} в плей-офф и за места` : 'сетка и матчи за места'}</p>
    <ul class="nt-dlines">${lines}</ul>
    ${p.ok ? `<p class="verdict ok">${icon('check')}<span>Успеваем</span></p>`
    : `<p class="verdict bad">${icon('alert')}<span>${esc(p.err)}${/кончатся/.test(p.err) ? '. Играть можно до 23:00' : ''}</span></p>
       ${fixes.length ? `<div class="nt-fixes"><span class="label">Как исправить</span><div class="btns">${fixes.map((f, i) => `<button class="btn quiet" type="button" data-fix="${i}">${esc(f.t)}</button>`).join('')}</div></div>` : ''}`}`;
  hydrate(box);
  $$('[data-fix]', box).forEach((b) => b.addEventListener('click', () => {
    const f = fixes[+b.dataset.fix]; const before = clone(C);
    f.run();
    if (C.auto) C.auto.days = false;
    const undo = save(); paintPreview();
    render.days($('.nt-step[data-step="days"] .nt-body'));
    const r = planDays(C); sum(r.short, !r.ok); drawScale();
    toast(`${f.done}${r.ok ? ' — теперь успеваем' : ''}`, { undo: () => { undo(); C = before; lastSaved = JSON.stringify(C); go(idx('days')); } });
  }));
  if (step === idx('days')) sum(C.play.length ? p.short : 'Отметьте хотя бы один игровой день', !p.ok);
}
// Решения, если матчи не успевают: ещё игровой день, без матчей за 5–8 места, все корты
function dayFixes(p) {
  const out = [];
  const inside = []; for (let d = C.from; d <= C.to; d = addDays(d, 1)) if (!C.play.includes(d)) inside.push(d);
  const label = (d) => `${dayWords(d)}`;
  if (inside.length) {
    const d = inside.find((x) => x > (p.errDay || C.from)) || inside[0];
    out.push({ t: `Играть и в ${accWd(d)}, ${+d.slice(8)} ${MON_GEN[+d.slice(5, 7) - 1]}`, done: `Добавлен игровой день: ${label(d)}`, run: () => { C.play = [...C.play, d].sort(); C.daySet = null; } });
  } else {
    const before = addDays(C.from, -1); const after = addDays(C.to, 1);
    const pick = dow(C.to) === 5 && C.from === C.to ? after : before > TODAY ? before : after;
    out.push({ t: `Добавить ${accWd(pick)}, ${+pick.slice(8)} ${MON_GEN[+pick.slice(5, 7) - 1]}`, done: `Добавлен игровой день: ${label(pick)}`, run: () => { if (C.auto) C.auto.days = false; if (pick < C.from) C.from = pick; else C.to = pick; C.play = [...C.play, pick].sort(); C.daySet = null; if (C.auto && C.auto.signup) applyTemplate(C); } });
  }
  if (C.places !== false && C.format) out.push({ t: 'Не играть матчи за 5–8 места', done: 'Матчи за 5–8 места не играются', run: () => { C.places = false; if (C.auto) C.auto.format = false; } });
  const narrow = C.play.some((d) => daySetOf(C, d).courts.length < COURT_IDS.length);
  if (narrow) out.push({ t: `Играть на всех ${COURT_IDS.length} кортах`, done: 'Во все игровые дни — все корты', run: () => { C.courts = COURT_IDS.slice(); C.daySet = null; if (C.auto) C.auto.courts = false; } });
  return out.slice(0, 3);
}
const accWd = (d) => ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'][dow(d)];

// рисунки формата: группы → сетка; одна сетка
const svgGroups = () => {
  const box = (x, y, l) => `<g transform="translate(${x} ${y})"><rect width="58" height="46" rx="9" fill="none" stroke="currentColor" stroke-width="2"/><text x="8" y="19" font-size="16" font-weight="700" fill="currentColor">${l}</text>${[0, 1, 2, 3].map((k) => `<circle cx="${10 + k * 13}" cy="34" r="4.5" ${k < 2 ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.6"'}/>`).join('')}</g>`;
  const br = 'M176 14h22v28h-22M176 70h22v28h-22M198 28h24v56h-24M222 56h24';
  return `<svg viewBox="0 0 290 112" class="nt-fpic" aria-hidden="true">${box(4, 4, 'A')}${box(70, 4, 'B')}${box(4, 62, 'C')}${box(70, 62, 'D')}<path d="M138 56h26m-7-6 7 6-7 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="${br}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>${cupMark(262, 56)}</svg>`;
};
const svgBracket = () => {
  const ys = [8, 21, 34, 47, 65, 78, 91, 104];
  let d = '';
  for (let i = 0; i < 8; i += 2) d += `M14 ${ys[i]}h44v${ys[i + 1] - ys[i]}h-44M58 ${(ys[i] + ys[i + 1]) / 2}h24`;
  const qq = [(ys[0] + ys[1]) / 2, (ys[2] + ys[3]) / 2, (ys[4] + ys[5]) / 2, (ys[6] + ys[7]) / 2];
  d += `M82 ${qq[0]}v${qq[1] - qq[0]}M82 ${qq[2]}v${qq[3] - qq[2]}M82 ${(qq[0] + qq[1]) / 2}h40M82 ${(qq[2] + qq[3]) / 2}h40`;
  const s = [(qq[0] + qq[1]) / 2, (qq[2] + qq[3]) / 2];
  d += `M122 ${s[0]}v${s[1] - s[0]}M122 ${(s[0] + s[1]) / 2}h46`;
  return `<svg viewBox="0 0 290 112" class="nt-fpic" aria-hidden="true">${ys.map((y) => `<circle cx="8" cy="${y}" r="4" fill="currentColor"/>`).join('')}<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>${cupMark(186, (s[0] + s[1]) / 2)}</svg>`;
};
// кубок в конце сетки — тёмной линией: цвет мяча только у главной кнопки, «сегодня» и «сейчас»
function cupMark(x, y) {
  return `<g transform="translate(${x - 14} ${y - 15})" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h12v8a6 6 0 0 1-12 0V3z" fill="currentColor"/><path d="M8 6H4a4 4 0 0 0 4 5M20 6h4a4 4 0 0 1-4 5M14 17v6M9 27h10"/></g>`;
}
render.format = (body) => {
  // формат подставлен из образца — так и сказано, как на шаге «Корты»; поменяли — строки нет
  const t = tplOf(C);
  const fromTpl = t && C.auto && C.auto.format && !C.done.format;
  body.innerHTML = `${fromTpl ? `<p class="nt-line" id="nt-fline">${icon('info')}<span>Отмечено как в «${esc(prep(t.name))}» — проверьте</span></p>` : ''}<div class="choices nt-formats" role="radiogroup" aria-label="Как играют турнир">${['groups', 'bracket'].map((k) => `<button type="button" class="choice" role="radio" aria-checked="${C.format === k}" data-value="${k}"><span class="pic">${k === 'groups' ? svgGroups() : svgBracket()}</span><span class="t">${esc(FORMATS[k].t)}</span><span class="s">${esc(FORMATS[k].s)}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div>
    <div class="nt-toggles">
      <label class="toggle"><span class="grow"><span class="strong">Матч за 3-е место</span><span class="muted">Ещё 1 матч в финальный день</span></span><input type="checkbox" data-k="third"${C.third ? ' checked' : ''}><span class="sw" aria-hidden="true"></span></label>
      <label class="toggle"><span class="grow"><span class="strong">Матчи за 5–8 места</span><span class="muted">Ещё 4 матча в финальный день</span></span><input type="checkbox" data-k="places"${C.places ? ' checked' : ''}><span class="sw" aria-hidden="true"></span></label>
    </div>
    <p class="nt-line">${icon('info')}<span>Матч — ${esc(low1(D.TOURNAMENT.format))}, как во всех турнирах лиги</span></p>`;
  hydrate(body);
  const touched = () => { if (C.auto) C.auto.format = false; $('#nt-fline', body)?.remove(); };
  $('.nt-formats', body).addEventListener('change', (e) => { C.format = e.detail; touched(); save(); paintPreview(); sum(footText()); });
  $$('.nt-toggles input', body).forEach((x) => x.addEventListener('change', () => { C[x.dataset.k] = x.checked; touched(); save(); paintPreview(); sum(footText()); }));
};

// Запись: правило пары — одной строкой; сроки — полем с предложением «как в «Июльском кубке»»
render.signup = (body) => {
  const [lo, hi] = D.RULES.corridor;
  const sugS = C.from ? addDays(C.from, -SIGNUP_BEFORE) : null;
  const sugD = C.from ? addDays(C.from, -DRAW_BEFORE) : null;
  const like = `Как в «${prep(PREV.name)}»`;
  body.innerHTML = `<p class="nt-ruleline">${icon('info')}<span>Подходят пары с суммой уровней <b class="num">${lo.toFixed(1)}–${hi.toFixed(1)}</b> и вместе от ${D.RULES.ageSum} лет (решение Совета)</span></p>
    <div class="nt-signf">
      <div class="stack tight"><div id="nt-f-sign"></div>${sugS && sugS > TODAY ? `<div class="nt-sug" data-for="sign"><span>${esc(like)}: за ${SIGNUP_BEFORE} ${plural(SIGNUP_BEFORE, 'день', 'дня', 'дней')} до начала</span><button class="btn quiet" type="button" data-take="sign">${icon('check')}Взять ${esc(plainRange(sugS))}</button></div>` : ''}</div>
      <div class="stack tight"><div id="nt-f-draw"></div>${sugD && sugD > TODAY ? `<div class="nt-sug" data-for="draw"><span>${esc(like)}: за ${DRAW_BEFORE} ${plural(DRAW_BEFORE, 'день', 'дня', 'дней')} до начала</span><button class="btn quiet" type="button" data-take="draw">${icon('check')}Взять ${esc(plainRange(sugD))}</button></div>` : ''}</div>
      <div class="field"><label class="label" for="nt-fee">Взнос с пары (необязательно)</label><input class="input" id="nt-fee" inputmode="numeric" autocomplete="off" value="${esc(C.fee || '')}"></div>
    </div>`;
  hydrate(body);
  const others = seasonStages().filter((s) => s.id !== C.id);
  // после выбора дня пример под полем прячется: под полем и так «Дата: …»
  const tidy = () => {
    $$('.nt-sug', body).forEach((x) => { x.hidden = (x.dataset.for === 'sign' ? C.signupTo === sugS : C.draw === sugD); });
    [['sign', C.signupTo], ['draw', C.draw]].forEach(([k, v]) => {
      const f = $(`#nt-f-${k}`); f.classList.remove('error');
      const h = $('.hint', f); if (h) h.hidden = !!v;
    });
  };
  const changed = () => { if (C.auto) C.auto.signup = false; tidy(); save(); paintPreview(); sum(footText()); };
  const fSign = dateField($('#nt-f-sign', body), { label: 'Запись до', id: 'nt-sign', value: C.signupTo, hint: 'например: 2 августа или 02.08', others, month: (C.from || TODAY).slice(0, 7), onChange: (iso) => { C.signupTo = iso; changed(); } });
  const fDraw = dateField($('#nt-f-draw', body), { label: 'Жеребьёвка', id: 'nt-draw', value: C.draw, hint: 'например: 4 августа или 04.08', others, month: (C.from || TODAY).slice(0, 7), onChange: (iso) => { C.draw = iso; changed(); } });
  body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-take]'); if (!t) return;
    if (t.dataset.take === 'sign') fSign.set(sugS); else fDraw.set(sugD);
  });
  $('#nt-fee', body).addEventListener('input', (e) => { C.fee = e.target.value.trim(); save(); });
  tidy();
};

// Пересечение по датам — словами: «Пересекается с «Июльским кубком»»; корты те же —
// «Корты 1–5 в эти дни заняты «Июльским кубком»». Так можно, но проверьте.
function clashWords() {
  if (!C.clash) return '';
  const other = seasonStages().find((x) => x.name === C.clash && x.id !== C.id);
  const theirs = other ? clashCourts(other) : [];
  const both = (C.courts || []).filter((c) => theirs.includes(c));
  if (!both.length) return `Пересекается с «${instr(C.clash)}» — так можно, но проверьте`;
  // «Корты 1–5», «Корты 1 и 3», «Корт 2»
  const nums = both.map((c) => String(D.COURTS[c].name).replace(/\D/g, '') || D.COURTS[c].name);
  const run = both.length > 2 && courtsWords(both).includes('–');
  const w = both.length === 1 ? `Корт ${nums[0]}` : run ? cap1(courtsWords(both)) : `Корты ${andList(nums)}`;
  return `${w} в эти дни ${both.length > 1 ? 'заняты' : 'занят'} «${instr(C.clash)}» — так можно, но проверьте`;
}
// корты другого турнира: из мастера — как отмечены, этап мира — «корты 1–5» словами
function clashCourts(other) {
  const c = getCup(other.id);
  if (c && Array.isArray(c.courts) && c.courts.length) return c.courts;
  const m = String(other.courts || '').replace(/[\u2060\u00a0]/g, ' ').match(/(\d+)\s*[–-]\s*(\d+)/);
  if (m) return COURT_IDS.filter((id) => { const n = +String(D.COURTS[id].name).replace(/\D/g, ''); return n >= +m[1] && n <= +m[2]; });
  return [];
}
// Проверка: строки «что — значение — Изменить». Подставленное из шаблона — значением
// с жёлтой полосой и одной строкой над списком, незаполненное — красным «не указано»; ошибка дней — красной строкой.
function reviewRows() {
  const p = C.from && C.to && C.play.length ? planDays(C) : null;
  const mc = C.format ? matchCount(C) : null;
  const place = [C.third && 'за 3-е место', C.places && '5–8 места'].filter(Boolean);
  const firstSet = C.play.length ? daySetOf(C, C.play.slice().sort()[0]) : null;
  // турнир встаёт в путь сезона раньше других этапов — их номера сдвинутся: так и пишем
  const shift = C.kind === 'stage' && C.from ? shiftWords(stagesShift(C)) : '';
  return [
    { k: 'name', t: 'Название', v: C.name ? `${C.name} · ${kindWord()}` : '', info: shift },
    { k: 'dates', t: 'Даты', v: C.from && C.to ? rangeWords(C.from, C.to) : '', warn: clashWords() },
    { k: 'courts', t: 'Корты', v: courtsLine(C.courts, C.finalCourt) },
    { k: 'days', t: 'Игровые дни', v: C.play.length && C.from ? `${daysShort(C.play.slice().sort())} · начало ${firstSet.start}${p && p.ok ? ` · ${p.short}` : ''}` : '' },
    { k: 'format', t: 'Формат', v: C.format ? `${cap1(FORMATS[C.format].short)} · 16 пар · ${matchesWord(mc.total)}${place.length ? ` · матчи ${andList(place)}` : ''}` : '' },
    { k: 'signup', t: 'Запись', v: C.signupTo ? `До ${rangeShort(C.signupTo)}${C.draw ? ` · жеребьёвка ${rangeShort(C.draw)}` : ''} · сумма уровней пары ${D.RULES.corridor.map((x) => x.toFixed(1)).join('–')}` : '' },
    { k: 'fee', t: 'Взнос', v: C.fee ? `${C.fee} с пары` : '', optional: true },
  ];
}
render.check = (body) => {
  const rows = reviewRows();
  // подставленное из шаблона — одной строкой над списком, у строк — только жёлтая полоса слева
  const auto = rows.filter((r) => !r.optional && stepState(C, r.k).st === 'auto');
  const tpl = tplOf(C);
  const autoLine = auto.length ? `<p class="nt-autonote">${icon('info')}<span>${esc(cap1(andList(auto.map((r) => r.t.toLowerCase()))))} — ${esc(tpl ? `как в «${prep(tpl.name)}»` : 'предложено по прошлому этапу')}. Проверьте</span></p>` : '';
  body.innerHTML = `${autoLine}<dl class="review nt-review">${rows.map((r) => {
    const s = r.optional ? { st: 'ok' } : stepState(C, r.k);
    const miss = s.st === 'missing';
    const cls = miss || s.err ? ' nt-miss' : s.st === 'auto' ? ' nt-auto' : '';
    const note = miss && r.v ? `<span class="warnline">${esc(s.t)}</span>`
      : s.err ? `<span class="warnline">${esc(s.err)}</span>` : '';
    const warn = r.warn ? `<span class="warnline">${esc(r.warn)}</span>` : '';
    const info = r.info ? `<span class="infoline">${icon('info')}${esc(r.info)}</span>` : '';
    const edit = r.k === 'fee' ? 'signup' : r.k;
    return `<div class="rv${cls}"><dt>${esc(r.t)}</dt><dd class="${r.v ? '' : 'none'}">${r.v ? esc(r.v) : 'не указано'}${note}${warn}${info}</dd><button class="btn text" type="button" data-edit="${edit}">Изменить<span class="vh"> — ${esc(r.t.toLowerCase())}</span></button></div>`;
  }).join('')}</dl>${EDIT && editDirty() ? `<div class="nt-del"><button class="btn quiet" type="button" id="nt-revert">${icon('undo')}Вернуть опубликованное</button></div>` : ''}`;
  body.querySelector('.nt-review').addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit]'); if (!b) return;
    back2check = true; go(idx(b.dataset.edit));
  });
  const rv = body.querySelector('#nt-revert'); if (rv) rv.addEventListener('click', revertEdits);
};
// правка опубликованного: «Вернуть опубликованное» — правки убраны, в мастере то, что видят игроки
function revertEdits() {
  const before = clone(C);
  C = clone(EDIT.pub);
  const undo = save();
  go(idx('check'), { quiet: true });
  toast('Вернули опубликованное: правки убраны', { undo: () => { undo(); C = before; lastSaved = JSON.stringify(C); editTag(); go(idx('check'), { quiet: true }); } });
}
// Что мешает опубликовать: незаполненное и ошибки — по тем же строкам, что на проверке
const missing = () => STEP_KEYS.filter((k) => stepState(C, k).st === 'missing');
const errors = () => STEP_KEYS.filter((k) => stepState(C, k).err);
const whoSees = () => (C.kind === 'stage' ? 'Увидят все: сайт и приложение · запись откроется сразу' : 'Увидят все на сайте · запись откроется сразу');
function checkFoot() {
  const nx = $('#nt-next'); const p2 = $('#nt-pub2');
  const m = missing(); const e = errors();
  p2.hidden = true;
  if (m.length) {
    sum(`Не заполнено: ${andList(m.map((k) => stepName(k).toLowerCase()))}`, true);
    nx.innerHTML = `Заполнить ${esc(stepName(m[0]).toLowerCase())}${icon('arrow')}`;
  } else if (e.length) {
    sum(stepState(C, e[0]).err, true);
    nx.innerHTML = `Исправить ${esc(stepName(e[0]).toLowerCase())}${icon('arrow')}`;
    p2.hidden = !!EDIT;
  } else if (EDIT) {
    // правка опубликованного: главная — показать правки; правок нет — вернуться к турниру
    const ch = editedSteps();
    if (ch.length) {
      sum(`Изменено: ${andList(ch.map((k) => stepName(k).toLowerCase()))}. Игроки увидят после «Показать правки игрокам»`);
      nx.textContent = 'Показать правки игрокам';
    } else {
      sum('Правок нет — игроки видят турнир таким');
      nx.innerHTML = `Вернуться к турниру${icon('arrow')}`;
    }
  } else {
    sum(whoSees());
    nx.textContent = 'Опубликовать турнир и открыть запись';
  }
}

// ============================================================
// ПЕРЕХОДЫ
// ============================================================
function footText() {
  const k = STEPS[step].key;
  const t = tplOf(C);
  if (k === 'start') {
    if (!t) return 'Дальше — по шагам, один вопрос за раз';
    // остальное берётся из выбранного турнира — спросим только это (корты — всегда: покрытие у них разное;
    // формат — всегда: сколько матчей, человек видит до проверки)
    return `Дальше — ${andList(['название', 'даты', 'корты', 'формат', ...(t.signupTo ? [] : ['запись'])])}`;
  }
  if (k === 'name') return C.name ? `«${C.name}» · ${kindWord()}` : 'Впишите название';
  if (k === 'courts') return C.courts.length ? `${courtsLine(C.courts, C.finalCourt)}${C.finalCourt ? '' : ' · выберите корт финала'}` : 'Отметьте корты';
  if (k === 'format') { if (!C.format) return 'Выберите формат'; const m = matchCount(C); return C.format === 'groups' ? `${matchesWord(m.total)}: ${m.grp} в группах, ${m.play} в плей-офф и за места` : `${matchesWord(m.total)} в сетке и за места`; }
  if (k === 'signup') return C.signupTo && C.draw ? `Запись до ${rangeShort(C.signupTo)} · жеребьёвка ${rangeShort(C.draw)}` : 'Впишите сроки записи и жеребьёвки';
  return '';
}
// «Как …»: подставленное не спрашиваем — оно на проверке с пометкой; незаполненное и ошибки — спрашиваем.
// Корты спрашиваем всегда: у кортов шаблона разное покрытие. Формат — тоже: на нём видно, сколько матчей
// («36 матчей: 24 в группах, 12 в плей-офф и за места»). Игровые дни — только если матчи не успевают.
// С чистого листа — каждый шаг по очереди.
const askAlways = (k) => k === 'courts' || k === 'format';
function nextIndex() {
  if (back2check) return idx('check');
  const fast = !!tplOf(C);
  for (let i = step + 1; i < STEPS.length; i += 1) {
    const k = STEPS[i].key;
    if (k === 'check') return i;
    const s = stepState(C, k);
    if (s.st === 'missing' || s.err) return i;
    if ((!fast || askAlways(k)) && !C.done[k]) return i;
  }
  return idx('check');
}
function next() {
  const k = STEPS[step].key;
  if (k === 'check') { checkMain(); return; }
  const r = gate(k);
  if (!r.ok) {
    sum(r.t, true);
    if (k === 'name') { const f = $('#nt-name-f'); f.classList.add('error'); $('.err span', f).textContent = r.t; $('#nt-name').focus(); }
    if (k === 'signup') { const f = !C.signupTo || /Запись|прошло/.test(r.t) ? $('#nt-f-sign') : $('#nt-f-draw'); f.classList.add('error'); $('.err span', f).textContent = r.t; }
    return;
  }
  // новый турнир получил название — это уже черновик: строкой в журнал, делом на «Сегодня»
  const begun = k === 'name' && !C.done.name && isNewId(C.id);
  C.done[k] = 1;
  if (k === 'dates') applyTemplate(C);
  save(begun ? { say: `начали черновик «${C.name}»`, href: `new-tournament.html?draft=${C.id}` } : undefined);
  const to = nextIndex();
  back2check = false;
  go(to);
}
function checkMain() {
  const m = missing(); const e = errors();
  if (m.length) { back2check = false; go(idx(m[0])); return; }
  if (e.length) { back2check = true; go(idx(e[0])); return; }
  if (EDIT) { if (editDirty()) publishEdits(); else location.href = keepTheme(tourHref()); return; }
  publish();
}
// quiet — перерисовать тот же шаг (турнир поменяли в другой вкладке): без прокрутки и фокуса
function go(i, { quiet = false } = {}) {
  step = i;
  C.seen = Math.max(C.seen || 0, i);
  STEPS.forEach((s, k) => { $(`.nt-step[data-step="${s.key}"]`).hidden = k !== i; });
  const key = STEPS[i].key;
  const sec = $(`.nt-step[data-step="${key}"]`);
  dp = null;
  render[key]($('.nt-body', sec));
  drawScale();
  $('#nt-progress').innerHTML = progressHtml(i + 1, STEPS.length);
  $('#nt-stepno').textContent = `Шаг ${i + 1} из ${STEPS.length} · ${EDIT ? 'Правки' : C.state === 'open' ? 'Опубликован' : 'Черновик'}`;
  $('#nt-back').hidden = i === 0;
  $('#nt-pub2').hidden = true;
  const nx = $('#nt-next');
  $('#nt-foot').classList.toggle('nt-foot-final', key === 'check');
  if (key === 'check') checkFoot();
  else if (back2check) nx.innerHTML = `Вернуться к проверке${icon('arrow')}`;
  else nx.innerHTML = `Дальше${icon('arrow')}`;
  if (!['dates', 'days', 'check'].includes(key)) sum(footText());
  $('#nt-drafts').hidden = !(draftLine.length && key === 'start' && C.state !== 'open');
  drawWhere();
  paintPreview();
  if (quiet) return;
  scrollTo({ top: 0 });
  $('.ask', sec).focus({ preventScroll: true });
}
// Шкала шагов: пройденное — галочкой, незаполненное и ошибка — красной точкой со словом для чтения с экрана
function drawScale() {
  const onCheck = STEPS[step].key === 'check';
  $('#nt-steps').innerHTML = STEPS.map((s, k) => {
    let mark = '';
    if (k !== step && s.key !== 'check') {
      if (s.key === 'start') mark = C.base ? 'done' : '';
      else {
        const st = stepState(C, s.key);
        if (st.err) mark = 'bad';
        else if (st.st === 'missing') mark = (k < step || onCheck || (C.seen || 0) > k) ? 'bad' : '';
        else if (C.done[s.key] || k <= (C.seen || 0)) mark = 'done';
      }
    }
    const can = k !== step && (mark || k <= (C.seen || 0));
    const cls = k === step ? 'now' : mark;
    const sr = mark === 'bad' ? '<span class="vh"> — нужно заполнить или исправить</span>' : mark === 'done' ? '<span class="vh"> — готово</span>' : '';
    const inner = `${mark === 'done' ? icon('check') : mark === 'bad' ? '<i class="nt-dot" aria-hidden="true"></i>' : ''}<span>${esc(s.name)}</span>${sr}`;
    return `<li class="${cls}"${k === step ? ' aria-current="step"' : ''}>${can ? `<button type="button" data-go="${k}">${inner}</button>` : inner}</li>`;
  }).join('');
}
$('#nt-steps').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) { back2check = false; go(+b.dataset.go); } });
$('#nt-next').addEventListener('click', next);
$('#nt-back').addEventListener('click', () => { back2check = false; if (step > 0) go(step - 1); });
$('#nt-pub2').addEventListener('click', () => {
  const e = errors(); const why = e.length ? stepState(C, e[0]).why : '';
  confirmAction({
    title: `Опубликовать, хотя ${why}?`,
    text: 'Игроки увидят турнир и смогут записаться. Игровые дни можно поправить и после публикации.',
    action: 'Опубликовать турнир и открыть запись', kind: 'main', cancel: 'Отмена',
    onConfirm: () => publish(),
  });
});

// «Где появится» — на «Начале» и на «Проверке»: там решают, а не вписывают
function drawWhere() {
  const k = STEPS[step] && STEPS[step].key;
  $('#nt-where').innerHTML = ['start', 'check'].includes(k) ? whereHtml(whereFor(C, stageNo())) : '';
}

// ============================================================
// ПУБЛИКАЦИЯ И «ГОТОВО»
// ============================================================
function publish() {
  const before = clone(C);
  C.state = 'open'; C.publishedAt = state.now();
  STEP_KEYS.forEach((k) => { C.done[k] = 1; });
  const undo = save({ say: `опубликовали турнир «${C.name}», ${plainRange(C.from, C.to)}: запись открыта до ${plainRange(C.signupTo)}`, href: seasonHref(C.from) });
  showDone();
  // «Отменить» возвращает черновик и убирает строку журнала
  toast(`«${C.name}» опубликован: запись открыта до ${rangeShort(C.signupTo)}`, {
    undo: () => { undo(); C = before; lastSaved = JSON.stringify(C); setupPreview(); openWizard(idx('check')); },
  });
}
// Правки опубликованного турнира показаны игрокам: одна строка журнала со списком изменённого,
// «Отменить» возвращает и прежний турнир, и правки в мастере.
function publishEdits() {
  const ch = editedSteps();
  const before = { pub: clone(EDIT.pub), C: clone(C) };
  const rec = { ...stripEdit(C), state: 'open', publishedAt: EDIT.pub.publishedAt };
  const undo = own(() => putCup(rec, { say: `изменили турнир «${C.name}»: ${andList(ch.map((k) => stepName(k).toLowerCase()))}`, href: tourHref() }));
  EDIT.pub = stripEdit(clone(rec)); C = clone(rec); lastSaved = JSON.stringify(C);
  showEdited(ch);
  toast(`Правки видны игрокам: ${andList(ch.map((k) => stepName(k).toLowerCase()))}`, {
    undo: () => { own(undo); EDIT.pub = before.pub; C = before.C; lastSaved = JSON.stringify(C); setupPreview(); openWizard(idx('check')); },
  });
}
function showEdited(ch) {
  $('#nt-wiz').hidden = true; $('#nt-tasks').hidden = true; $('#nt-drafts').hidden = true;
  const box = $('#nt-done'); box.hidden = false;
  box.innerHTML = `<div class="done-box">
      <span class="done-mark">${icon('check')}</span>
      <h2 class="h1" id="nt-done-h" tabindex="-1">Готово: правки видны игрокам</h2>
      <p class="lead">Изменено: ${esc(andList(ch.map((k) => stepName(k).toLowerCase())))}</p>
      <ul class="where-now">${whereFor(C, stageNo()).map((w) => `<li${w.no ? ' class="no"' : ''}>${icon(w.icon)}<span><b>${esc(w.b)}</b> — ${esc(w.s)}</span></li>`).join('')}</ul>
      <div class="btns"><a class="btn main" href="${esc(keepTheme(tourHref()))}">${icon('cup')}Открыть турнир</a></div>
    </div>`;
  hydrate(box);
  headState('done');
  setupPreview('Так это видят игроки');
  scrollTo({ top: 0 });
  $('#nt-done-h').focus({ preventScroll: true });
}
// ярлык у заголовка при правке: «Есть правки — игроки их ещё не видят» или «Видно игрокам»
function editTag() {
  const tag = $('#nt-tag');
  if (editDirty()) { tag.className = 'tag lg warn'; tag.innerHTML = '<span class="long">Есть правки — игроки их ещё не видят</span><span class="short">Есть правки</span>'; }
  else { tag.className = 'tag lg ok'; tag.innerHTML = `<span class="long">Видно игрокам с ${esc(C.publishedAt || state.now())}</span><span class="short">Опубликован</span>`; }
  const b = $$('.pv-banner span'); const t = editDirty() ? 'Предпросмотр правок — игроки увидят после «Показать правки игрокам»' : 'Так это видят игроки';
  b.forEach((x) => { x.textContent = t; });
  if (PVC) PVC.banner = t;
}
// «Изменить» на странице турнира: мастер открывается на проверке, правки — отдельно от показанного
function startEdit(stepKey) {
  EDIT = { pub: stripEdit(clone(C)) };
  C = C.edit ? { ...clone(C.edit), state: 'open' } : stripEdit(clone(C));
  lastSaved = JSON.stringify(C);
  setupPreview();
  openWizard(stepKey && idx(stepKey) >= 0 ? idx(stepKey) : idx('check'));
}
// шапка: состояние словом; в мастере выход один — «Сохранить и выйти», в списке задач — главная кнопка «Продолжить с …»
function headState(view = 'wiz') {
  const tag = $('#nt-tag');
  if (C.state === 'open') { tag.className = 'tag lg ok'; tag.innerHTML = `<span class="long">Видно игрокам с ${esc(C.publishedAt || state.now())}</span><span class="short">Опубликован</span>`; }
  else { tag.className = 'tag lg draft'; tag.innerHTML = '<span class="long">Черновик — видите только вы</span><span class="short">Черновик</span>'; }
  if (EDIT && view === 'wiz') editTag();
  $('#nt-exit').hidden = (C.state === 'open' && !EDIT) || view !== 'wiz';
  // «Сохранено …» — когда турнир правда сохранён; в списке задач это сказано строкой под заголовком
  const lab = $('#nt-saved');
  lab.hidden = (C.state === 'open' && !EDIT) || view === 'tasks' || !C.savedAt;
  if (C.savedAt) lab.innerHTML = `${icon('check')}${esc(savedWords(C.savedAt))}`;
  $('#nt-continue').hidden = view !== 'tasks';
  $('.page-head .back').hidden = view === 'wiz';
  $('.page-head').classList.toggle('nt-head-wiz', view === 'wiz');
  $('#nt-h1').textContent = C.name || 'Новый турнир';
}
function showDone() {
  $('#nt-wiz').hidden = true; $('#nt-tasks').hidden = true; $('#nt-drafts').hidden = true;
  const box = $('#nt-done'); box.hidden = false;
  const mon = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'][+C.from.slice(5, 7) - 1];
  box.innerHTML = `<div class="done-box">
      <span class="done-mark">${icon('check')}</span>
      <h2 class="h1" id="nt-done-h" tabindex="-1">Готово: турнир опубликован. Запись открыта до ${esc(rangeShort(C.signupTo))}</h2>
      <ul class="where-now">
        <li>${icon('site')}<span><b>Сайт</b> — календарь сезона, ${esc(mon)}</span></li>
        ${C.kind === 'stage' ? `<li>${icon('phone')}<span><b>Приложение</b> — «Турниры», этап ${stageNo()}</span></li>` : ''}
      </ul>
      <p class="lead">Что дальше: заявки пар появятся на «Сегодня» и на странице турнира.</p>
      <div class="btns"><a class="btn main" href="${esc(keepTheme(tourHref()))}">${icon('cup')}Открыть турнир</a><a class="btn quiet" href="${esc(keepTheme(`season.html?published=${C.id}`))}">${icon('calendar')}Посмотреть в календаре</a><button class="btn quiet" type="button" data-share>${icon('share')}Поделиться ссылкой</button></div>
    </div>`;
  box.querySelector('[data-share]').addEventListener('click', share);
  headState('done');
  setupPreview('Так это видят игроки');
  scrollTo({ top: 0 });
  $('#nt-done-h').focus({ preventScroll: true });
}
function share() {
  const s = openSheet({
    title: 'Поделиться',
    body: `<div class="linkcard" data-srf="${surfaceOf(C.finalCourt) || 'clay'}"><div class="lc-top"><b>${esc(C.name)}</b></div><div class="lc-body"><b>${esc(rangeShort(C.from, C.to))}${C.kind === 'stage' ? ` · этап ${stageNo()}` : ''}</b><span class="s">${esc(D.LEAGUE.name)} · запись открыта до ${esc(rangeShort(C.signupTo))}</span></div></div><p class="muted">Так ссылка выглядит в мессенджере</p>`,
    foot: `<button class="btn main" type="button" data-copy>${icon('copy')}Скопировать ссылку</button><button class="btn quiet" type="button" data-no>Готово</button>`,
  });
  s.querySelector('[data-copy]').addEventListener('click', () => { closeLayer(true); toast('Ссылка скопирована — вставьте её в чат'); });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
}

// ============================================================
// ЧЕРНОВИК: СПИСОК ЗАДАЧ — те же строки, что на проверке
// ============================================================
function taskValue(key) {
  if (key === 'name') return C.name ? `${C.name} · ${kindWord()}` : '';
  if (key === 'dates') return C.from && C.to ? rangeShort(C.from, C.to) : '';
  if (key === 'courts') return courtsLine(C.courts, C.finalCourt);
  if (key === 'days') return C.play.length ? daysShort(C.play.slice().sort()) : '';
  if (key === 'format') return C.format ? `${cap1(FORMATS[C.format].short)} · 16 пар` : '';
  if (key === 'signup') return C.signupTo ? `До ${rangeShort(C.signupTo)}` : '';
  return '';
}
function showTasks() {
  $('#nt-wiz').hidden = true; $('#nt-done').hidden = true; $('#nt-tasks').hidden = false; $('#nt-drafts').hidden = true;
  headState('tasks');
  const left = tasksLeft(C);
  $('#nt-tasks-lead').textContent = left.length
    ? `Сохранён ${C.savedAt}. ${plural(left.length, 'Осталась', 'Осталось', 'Осталось')} ${left.length} ${plural(left.length, 'задача', 'задачи', 'задач')}: ${andList(left.map((t) => t.short))}.`
    : `Сохранён ${C.savedAt}. Всё заполнено — осталось проверить и опубликовать.`;
  const firstLeft = left[0];
  const rows = TASKS.map((t, i) => {
    const s = stepState(C, t.key);
    const val = taskValue(t.key);
    const isNext = t === firstLeft;
    let tag; let why = val;
    if (s.err) { tag = '<span class="tag bad">Ошибка</span>'; why = s.err; }
    else if (s.st === 'missing') tag = '<span class="tag bad">Не заполнено</span>';
    else if (s.st === 'auto') { tag = '<span class="tag warn">Проверьте</span>'; why = `${val} — ${likeNote().replace(/ — проверьте$/, '')}`; }
    else tag = '<span class="tag ok">Готово</span>';
    const ready = s.st !== 'missing' && !s.err;
    return `<li><a class="task${ready ? ' ready' : ''}${isNext ? ' next' : ''}" href="#" data-task="${t.key}"><span class="n">${ready ? icon('check') : i + 1}</span><span class="t">${esc(t.t)}</span>${tag}${icon('chev')}${why ? `<span class="why">${esc(why)}</span>` : ''}</a></li>`;
  }).join('');
  const last = left.length
    ? `<li><div class="task locked"><span class="n">${TASKS.length + 1}</span><span class="t">Проверить и опубликовать</span><span class="tag past">Пока нельзя</span><span class="why">Сначала заполните ${esc(andList(left.map((t) => t.short)))}</span></div></li>`
    : `<li><a class="task next" href="#" data-task="check"><span class="n">${TASKS.length + 1}</span><span class="t">Проверить и опубликовать</span><span class="tag ok">Можно</span>${icon('chev')}</a></li>`;
  $('#nt-task-list').innerHTML = rows + last;
  const cont = $('#nt-continue');
  cont.textContent = firstLeft ? `Продолжить с «${firstLeft.t}»` : 'Проверить и опубликовать';
  cont.onclick = () => openWizard(idx(firstLeft ? firstLeft.key : 'check'));
  setupPreview();
  $('#nt-tasks-h').focus({ preventScroll: true });
}
$('#nt-task-list').addEventListener('click', (e) => {
  const a = e.target.closest('[data-task]'); if (!a) return;
  e.preventDefault();
  openWizard(idx(a.dataset.task));
});
// Удалённый черновик остаётся в общем состоянии с пометкой removed: календарь, «Сегодня»
// и мастер его больше не показывают, а в журнале — строка «удалили черновик …».
$('#nt-del').addEventListener('click', () => confirmAction({
  title: `Удалить черновик «${cupName()}»?`,
  text: 'Это нельзя вернуть.',
  consq: ['Всё, что вписано в черновик, пропадёт', 'Игроки его не видели — у них ничего не изменится'],
  action: 'Удалить черновик',
  onConfirm: () => {
    own(() => putCup({ ...C, state: 'removed' }, { say: `удалили черновик «${cupName()}»`, href: 'season.html' }));
    location.href = keepTheme(`season.html?deleted=${C.id}`);
  },
}));
// черновик удалили в другой вкладке — здесь его больше нет
function showGone() {
  $('#nt-wiz').hidden = true; $('#nt-tasks').hidden = true; $('#nt-drafts').hidden = true;
  const box = $('#nt-done'); box.hidden = false;
  box.innerHTML = `<div class="empty"><span class="ic">${icon('trash')}</span><p>Черновик «${esc(cupName())}» удалён</p><a class="btn quiet" href="${esc(keepTheme('season.html'))}">${icon('calendar')}Открыть календарь</a></div>`;
  hydrate(box);
  headState('done');
  $('#nt-tag').hidden = true; $('#nt-saved').hidden = true;
  $('#nt-pv').hidden = true;
}

// Начатые черновики — строкой над мастером: главное здесь — новый турнир, а черновик рядом
function drawDrafts() {
  const box = $('#nt-drafts');
  box.innerHTML = draftLine.map((d) => `<div class="nt-draftline"><span class="ic">${icon('edit')}</span><span class="grow">Есть черновик <b>«${esc(d.name || 'Новый турнир')}»</b>${d.from ? ` · ${esc(rangeShort(d.from, d.to || d.from))}` : ''} · сохранён ${esc(d.savedAt || `сегодня в ${state.now()}`)}</span><a class="btn quiet" href="${esc(keepTheme(`new-tournament.html?draft=${d.id}`))}">Продолжить черновик${icon('chev')}</a></div>`).join('');
  hydrate(box);
}

// ============================================================
// «ТАК УВИДЯТ»: настоящий экран «Турниры» приложения с этим турниром
// ============================================================
let PVC = null;
const docsPv = new Set();
// Турнир в «Пути сезона» приложения: на своём месте по датам, номера других этапов — заново
const pathStage = () => ({ id: C.id, name: C.name, from: C.from, to: C.to, surface: surfaceOf(C.finalCourt), signupTo: C.signupTo, state: 'open' });
function patchApp(doc, mark) {
  if (!doc.getElementById('path')) return;
  docsPv.add(doc);
  const r = patchSeasonPath(doc, C.kind === 'stage' ? pathStage() : null);
  // отметка — на самой строке: у пункта пути своя линия-связка (::after)
  if (r.mine) mark(r.mine.querySelector('.st-row') || r.mine, EDIT ? (editDirty() ? 'Правки' : 'Здесь') : C.state === 'open' ? 'Опубликовано' : 'Новое');
}
function siteHtml() {
  const me = { ...cupToStage(C, stageNo()), name: C.name || 'Название турнира', state: 'open', signupTo: C.signupTo };
  const list = seasonStages().filter((s) => s.id !== C.id && s.state !== 'draft' && s.to >= TODAY);
  if (C.from && C.to) list.push(me);
  list.sort((a, b) => (a.from < b.from ? -1 : 1));
  const row = (s) => {
    const same = s.from.slice(0, 7) === s.to.slice(0, 7);
    const st = s.state === 'live' ? 'идёт' : s.signupTo ? `запись открыта до ${rangeShort(s.signupTo)}` : 'запись откроется после публикации';
    return `<div class="site-row${s.id === C.id ? ' new' : ''}"><span class="d">${same ? `${+s.from.slice(8)}–${+s.to.slice(8)}` : `${+s.from.slice(8)}.${s.from.slice(5, 7)}`}<small>${esc(rangeShort(s.to).replace(/^[\d–⁠]+\s/, ''))}</small></span><span class="t">${esc(s.name)}</span><span class="s">${s.no && s.kind !== 'separate' && s.kind !== 'final' ? `Этап ${s.no} · ` : ''}${esc(st)} · Подробнее</span></div>`;
  };
  const mc = C.format ? matchCount(C) : null;
  return `<span class="nt-site-h">Календарь сезона</span>${list.map(row).join('')}${C.from && C.to ? '' : '<p class="muted">Строка турнира появится, когда выберете даты</p>'}
    <span class="nt-site-h">Страница турнира</span>
    <div class="nt-site-tour" data-srf="${surfaceOf(C.finalCourt) || ''}">
      <b>${esc(C.name || 'Название турнира')}</b>
      <span>${esc(C.from && C.to ? rangeWords(C.from, C.to) : 'даты не выбраны')}</span>
      <span>${C.courts.length ? esc(courtsLine(C.courts, C.finalCourt)) : 'корты не выбраны'}</span>
      <span>${C.format ? `${esc(cap1(FORMATS[C.format].short))} · 16 пар · ${mc.total} матчей` : 'формат не выбран'}</span>
      <span>Пары с суммой уровней ${D.RULES.corridor.map((x) => x.toFixed(1)).join('–')}${C.signupTo ? ` · запись до ${esc(rangeShort(C.signupTo))}` : ''}</span>
    </div>`;
}
function setupPreview(banner) {
  docsPv.clear();
  const editWords = EDIT && editDirty() ? 'Предпросмотр правок — игроки увидят после «Показать правки игрокам»' : 'Так это видят игроки';
  PVC = {
    app: { page: 'tournaments.html', title: 'Приложение: Турниры', patch: patchApp },
    site: siteHtml(),
    start: C.kind === 'stage' ? 'app' : 'site',
    banner: banner || (EDIT ? editWords : C.state === 'open' ? 'Так это видят игроки' : 'Предпросмотр — игроки увидят после публикации'),
  };
  previewPanel($('#nt-pv'), PVC);
}
// правка в мастере — строка турнира в уже открытой рамке приложения встаёт на новое место
const markPv = (node, word) => { node.classList.add('adm-mark'); node.dataset.adm = word; };
function paintPreview() {
  if (!PVC) return;
  PVC.site = siteHtml();
  $$('.pv-site .page').forEach((p) => { p.innerHTML = PVC.site; });
  docsPv.forEach((doc) => {
    try {
      if (!doc.defaultView || !doc.defaultView.frameElement || !doc.defaultView.frameElement.isConnected) { docsPv.delete(doc); return; }
      doc.querySelectorAll('.adm-mark').forEach((x) => { x.classList.remove('adm-mark'); delete x.dataset.adm; });
      patchApp(doc, markPv);
    } catch { docsPv.delete(doc); }
  });
}
function paint() { paintPreview(); drawWhere(); drawScale(); }

// ============================================================
// ЗАПУСК
// ============================================================
function openWizard(i) {
  $('#nt-tasks').hidden = true; $('#nt-done').hidden = true; $('#nt-wiz').hidden = false;
  headState();
  if (!PVC) setupPreview();
  go(Math.max(0, i));
}
function firstUndone() {
  const fast = !!tplOf(C);
  const i = STEPS.findIndex((s) => {
    if (s.key === 'check') return false;
    if (s.key === 'start') return !C.base;
    const st = stepState(C, s.key);
    return st.st === 'missing' || !!st.err || ((!fast || askAlways(s.key)) && !C.done[s.key]);
  });
  return i < 0 ? idx('check') : i;
}
// «Сохранить и выйти»: пустой турнир (ни названия, ни дат) никому не виден — строки в журнале нет
$('#nt-exit').addEventListener('click', () => {
  // правка опубликованного: правки остаются отложенными, игроки видят прежнее; выход — на страницу турнира
  if (EDIT) { save(); location.href = keepTheme(tourHref()); return; }
  save(C.name || C.from ? { say: `сохранили черновик «${cupName()}»`, href: cupHref() } : undefined);
  location.href = keepTheme(`season.html?saved=${C.id}`);
});

// Турнир поменяли в другой вкладке или на календаре (перенос): здесь то же, без прокрутки наверх
function watchCup() {
  state.on(`cups.${C.id}`, () => {
    if (selfWrite) return;
    const rec = getCup(C.id);
    // правка опубликованного: показанное — отдельно, правки — в C
    if (EDIT && rec && rec.state === 'open') {
      EDIT.pub = stripEdit(clone(rec));
      const work = rec.edit ? { ...clone(rec.edit), state: 'open' } : stripEdit(clone(rec));
      if (JSON.stringify(work) === lastSaved) { editTag(); return; }
      C = work; lastSaved = JSON.stringify(C);
      if (!$('#nt-wiz').hidden) { headState(); go(step, { quiet: true }); }
      return;
    }
    if (EDIT) EDIT = null;
    const fresh = rec;
    if (!fresh || JSON.stringify(fresh) === lastSaved) return;
    C = fresh; lastSaved = JSON.stringify(C);
    if (C.state === 'removed') { showGone(); return; }
    if (C.state === 'open') { showDone(); return; }
    if (!$('#nt-tasks').hidden) { showTasks(); return; }
    if (!$('#nt-wiz').hidden) { headState(); go(step, { quiet: true }); }
  });
}

(function boot() {
  const draft = q.get('draft'); const from = q.get('from'); const cupQ = q.get('cup'); const stepQ = q.get('step');
  const open = (id) => getCup(id) || freshCup();
  if (draft || cupQ) {
    C = open(draft || cupQ);
    lastSaved = JSON.stringify(C);
    watchCup();
    // удалённый — словами; опубликованный — «Готово» и где он теперь, а с ?edit=1 — правка
    if (C.state === 'removed') { showGone(); return; }
    if (C.state === 'open') { if (q.get('edit') === '1') startEdit(stepQ); else showDone(); return; }
    if (draft) { setupPreview(); showTasks(); return; }
    openWizard(stepQ && idx(stepQ) >= 0 ? idx(stepQ) : firstUndone());
    return;
  }
  // «Создать турнир»: мастер всегда начинает новый турнир; начатые черновики — строкой над ним
  draftLine = openDrafts();
  C = freshCup(TEMPLATES[0].id, from && from > TODAY ? from : null);
  watchCup();
  drawDrafts();
  openWizard(0);
}());

// телефон: «Продолжить с …» и вкладки — одна матовая панель внизу (видна, когда есть эта кнопка)
document.body.insertAdjacentHTML('beforeend', '<div class="ssn-dock glass" aria-hidden="true"></div>');
