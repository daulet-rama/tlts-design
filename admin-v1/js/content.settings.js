// Настройки лиги: корты и покрытия, уровни игроков и звания, «Мой вид» (размер текста и тема).
// Корт меняется сразу — с полосой «Отменить»; убрать корт — только через окно со словом.
// Правило сезона — решение Совета: записывают Совет и админ (?role=council|admin); у организатора это справка.
// Кто работает в админке — один список на экране «Судьи и доступ» → «Роли и доступ».
// Сумм взносов и сроков здесь нет: лига их не подтвердила.
// Сделанное — в общем состоянии: видно после перезагрузки, в другой вкладке и в журнале.
//   courts.<корт>  { name, note, surface } — корт сейчас; { …, removed: true } — корт убран;
//                  у добавленного корта ещё { added: true, made }
//   rules.season   { from, to, age } — правило сезона: сумма КПР пары и возраст двоих
// «Мой вид» — те же плитки, что в шторке «Мой вид» из меню.
import {
  D, state, esc, icon, hydrate, toast, confirmAction, openSheet, closeLayer, previewPanel, whereHtml,
  matchName, gen, myViewHtml, bindMyView,
} from '../admin.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const MY = document.body.dataset.role || 'org';
const CAN_RULES = MY === 'council' || MY === 'admin';
const ONLY_VIEW = MY === 'news'; // у роли «Новости и фото» настроек лиги нет — только «Мой вид»
const SRF = ['clay', 'hard', 'grass'];
const HREF_COURTS = 'settings.html#courts';
const HREF_LEVELS = 'settings.html#levels';

// ============================================================
// КОРТЫ И ПОКРЫТИЯ
// ============================================================
// корты сейчас: мир и сделанное; добавленные — после кортов мира, по порядку добавления
function courtsNow() {
  const ch = state.get('courts') || {};
  const out = Object.values(D.COURTS).filter((c) => !(ch[c.id] && ch[c.id].removed)).map((c) => ({ ...c, ...(ch[c.id] || {}), id: c.id }));
  Object.entries(ch).filter(([id, v]) => v && v.added && !v.removed && !D.COURTS[id])
    .sort(([, a], [, b]) => (a.made || 0) - (b.made || 0))
    .forEach(([id, v]) => out.push({ ...v, id }));
  return out;
}
let COURTS = courtsNow();
let open = null; // какой корт правим
const court = (id) => COURTS.find((c) => c.id === id);
const srfWord = (s) => (s ? D.SURFACES[s].label : 'покрытие не выбрано');
const sub = (c) => [c.note, srfWord(c.surface)].filter(Boolean).join(' · ');
const no = (c) => (c.name.match(/\d+/) || ['·'])[0];
const low = (c) => c.name.charAt(0).toLowerCase() + c.name.slice(1); // «корт 4»
const full = (c) => [c.name, c.note].filter(Boolean).join(' · ');

// запись корта; own — запись этой страницы: подписка её пропускает
let own = false;
const rec = (c) => {
  const r = { name: c.name, note: c.note || '', surface: c.surface || null };
  if (!D.COURTS[c.id]) { r.added = true; r.made = c.made || Date.now(); }
  return r;
};
function put(path, value, opts) { own = true; try { return state.set(path, value, opts); } finally { own = false; } }
const putCourt = (c, opts) => put(`courts.${c.id}`, rec(c), opts);

// корт занят сегодня: идёт матч или матч ещё будет — убрать его нельзя до конца дня
function busy(id) {
  const m = D.MATCHES.find((x) => x.court === id && x.day === D.TODAY.dayMonth && x.state === 'live');
  if (m) return `Сейчас на корте идёт ${matchName(m.title)}`;
  const s = D.MATCHES.find((x) => x.court === id && x.day === D.TODAY.dayMonth && x.state === 'soon');
  if (s) return `Сегодня в ${s.time} здесь ${matchName(s.title)}`;
  return '';
}
// что изменится, если корт убрать: открытые турниры с финалами на этом корте
const finalsHere = (id) => D.TOURNAMENTS.filter((t) => t.court === id && t.state === 'open');

const courtPic = (c) => `<span class="ct-court" data-srf="${esc(c.surface || 'none')}"><span class="num">${esc(no(c))}</span></span>`;
// строка корта нажимается целиком: стрелка показывает, что она открывается
function rowHtml(c) {
  const isOpen = open === c.id;
  return `<li class="ct-citem${isOpen ? ' open' : ''}" data-court="${esc(c.id)}">
      <button type="button" class="row ct-crow" aria-expanded="${isOpen}" aria-controls="ce-${esc(c.id)}" data-edit>
        ${courtPic(c)}
        <span class="grow"><span class="t">${esc(c.name)}</span><span class="s">${esc(sub(c))}</span></span>
        <span class="ct-chev" aria-hidden="true">${icon(isOpen ? 'down' : 'chev')}</span>
      </button>
      ${isOpen ? editorHtml(c) : ''}
    </li>`;
}
function editorHtml(c) {
  const b = busy(c.id);
  return `<div class="ct-cedit" id="ce-${esc(c.id)}" data-for="${esc(c.id)}">
      <div class="two">
        <div class="field full" id="fe-name"><label class="label" for="ce-name">Название</label><span class="err">${icon('alert')}<span>Впишите название корта</span></span><input class="input" id="ce-name" value="${esc(c.name)}" autocomplete="off"></div>
        <div class="field full"><label class="label" for="ce-note">Подпись (необязательно)</label><input class="input" id="ce-note" value="${esc(c.note)}" autocomplete="off"><span class="hint">Например: центральный, под крышей</span></div>
      </div>
      <div class="field full"><span class="label" id="ce-srf-l">Покрытие</span>
        <div class="choices" role="radiogroup" aria-labelledby="ce-srf-l">${SRF.map((s) => `<button type="button" class="choice" role="radio" aria-checked="${c.surface === s}" data-value="${s}"><span class="pic"><span class="ct-court big" data-srf="${s}"></span></span><span class="t">${esc(D.SURFACES[s].Label)}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div>
      </div>
      ${b ? `<p class="note warn">${icon('warn')}<span>${esc(b)}. Убрать корт можно после игрового дня</span></p>` : ''}
      <div class="foot"><span class="saved" id="ce-saved">${icon('eye')}Игроки видят изменения сразу</span>${b ? '' : `<button class="btn quiet" type="button" data-remove>${icon('trash')}Убрать корт</button>`}<button class="btn quiet" type="button" data-done>${icon('check')}Готово</button></div>
    </div>`;
}
function drawCourts(focusSel) {
  $('#court-list').innerHTML = COURTS.map(rowHtml).join('');
  hydrate($('#court-list'));
  if (focusSel) $(focusSel)?.focus();
  updateCourtPreview();
}
function savedNow() { const s = $('#ce-saved'); if (s) s.innerHTML = `${icon('check')}Сохранено в ${esc(state.now())} — игроки уже видят`; }
// строка корта без перерисовки (фокус в поле не теряется)
function paintRow(c) {
  const li = $(`#court-list .ct-citem[data-court="${CSS.escape(c.id)}"]`); if (!li) return;
  li.querySelector('.ct-court').outerHTML = courtPic(c);
  $('.ct-crow .t', li).textContent = c.name; $('.ct-crow .s', li).textContent = sub(c);
}

// Название и подпись сохраняются сами через долю секунды после ввода.
// В журнале — одна строка на правку корта («изменили корт 4: теперь «Корт 4 · детский»»), а не на каждую букву.
let typing = null;
let edit = null; // { id, was: «Корт 4», low: «корт 4», line: снять строку журнала }
function startEdit(c) { edit = c ? { id: c.id, was: full(c), low: low(c), line: null } : null; }
function saveName() {
  clearTimeout(typing); typing = null;
  const c = edit && court(edit.id);
  const nameIn = $('#ce-name'); const noteIn = $('#ce-note');
  if (!c || !nameIn) return;
  const name = nameIn.value.trim();
  $('#fe-name').classList.toggle('error', !name);
  const s = $('#ce-saved');
  if (!name) { if (s) s.innerHTML = `${icon('alert')}Без названия корт не сохраняется`; return; }
  const note = noteIn.value.trim();
  if (name === c.name && note === (c.note || '')) { savedNow(); return; }
  c.name = name; c.note = note;
  putCourt(c);
  if (edit.line) { edit.line(); edit.line = null; }
  if (full(c) !== edit.was) edit.line = state.log(`изменили ${edit.low}: теперь «${full(c)}»`, { href: HREF_COURTS });
  paintRow(c); updateCourtPreview(); savedNow();
}
// закрыть правку: то, что ещё «Сохраняется…», сохраняем сразу
function closeEdit(focusSel) {
  if (typing) saveName();
  open = null; startEdit(null);
  drawCourts(focusSel);
}

$('#court-list').addEventListener('click', (e) => {
  const li = e.target.closest('[data-court]'); if (!li) return;
  const id = li.dataset.court; const c = court(id); if (!c) return;
  if (e.target.closest('[data-edit]')) {
    if (open === id) { closeEdit(`#court-list [data-court="${CSS.escape(id)}"] .ct-crow`); return; }
    if (typing) saveName();
    open = id; startEdit(c);
    drawCourts('#ce-name');
    return;
  }
  if (e.target.closest('[data-done]')) { closeEdit(`#court-list [data-court="${CSS.escape(id)}"] .ct-crow`); return; }
  if (e.target.closest('[data-remove]')) {
    if (typing) saveName();
    const fin = finalsHere(id);
    confirmAction({
      title: `Убрать ${low(c)}?`,
      text: 'Корт пропадёт из расписаний и с табло. Сыгранные на нём матчи останутся.',
      consq: fin.length ? fin.map((t) => `Здесь стоят финалы «${gen(t.name)}» — их придётся перенести`) : [],
      action: `Убрать ${low(c)}`,
      onConfirm: () => {
        const say = { say: `убрали ${low(c)}`, href: HREF_COURTS };
        const undo = D.COURTS[id] ? put(`courts.${id}`, { ...rec(c), removed: true }, say) : put(`courts.${id}`, undefined, say);
        COURTS = courtsNow(); open = null; startEdit(null);
        drawCourts();
        toast(`${c.name} убран`, { kind: 'bad', undo });
        $('#add').focus();
      },
    });
  }
});
// покрытие — сразу и с «Отменить»
$('#court-list').addEventListener('change', (e) => {
  const ed = e.target.closest('.ct-cedit'); if (!ed || !SRF.includes(e.detail)) return;
  const c = court(ed.dataset.for); if (!c || c.surface === e.detail) return;
  if (typing) saveName();
  const first = !c.surface;
  c.surface = e.detail;
  const undo = putCourt(c, { say: first ? `выбрали покрытие: ${low(c)} — ${srfWord(c.surface)}` : `поменяли покрытие: ${low(c)} — теперь ${srfWord(c.surface)}`, href: HREF_COURTS });
  paintRow(c); updateCourtPreview(); savedNow();
  toast(`${c.name} — теперь ${srfWord(c.surface)}`, { undo });
});
$('#court-list').addEventListener('input', (e) => {
  if (!e.target.closest('.ct-cedit')) return;
  const s = $('#ce-saved'); if (s) s.innerHTML = `${icon('clock')}Сохраняется…`;
  clearTimeout(typing);
  typing = setTimeout(saveName, 700);
});
// ушли со страницы, пока «Сохраняется…» — сохраняем сразу
addEventListener('pagehide', () => { if (typing) saveName(); });

function addCourt() {
  if (typing) saveName();
  const nums = COURTS.map((c) => +no(c)).filter(Boolean);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  const c = { id: `c${Date.now().toString(36)}`, name: `Корт ${n}`, note: '', surface: null, made: Date.now() };
  const undo = putCourt(c, { say: `добавили корт ${n}`, href: HREF_COURTS });
  COURTS = courtsNow(); open = c.id; startEdit(court(c.id));
  drawCourts('#ce-name');
  $(`#court-list [data-court="${CSS.escape(c.id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  toast(`Добавлен корт ${n}. Выберите покрытие`, { undo });
}
$('#add').addEventListener('click', () => {
  if (TAB === 'levels' && CAN_RULES) { editRule(); return; }
  if (TAB === 'courts') addCourt();
});

// корты поменяли извне: «Отменить», другая вкладка
state.on('courts', () => {
  if (own) return;
  COURTS = courtsNow();
  if (open && !court(open)) { open = null; startEdit(null); }
  if (!built.courts) return;
  const f = document.activeElement && document.activeElement.closest('#court-list') ? document.activeElement.id : '';
  drawCourts(f ? `#${f}` : null);
});

// так корт видят игроки: афиша матча в приложении — шапка цвета покрытия, «Корт 1», «центральный · грунт»
const markIn = () => (node, word) => {
  if (!node) return;
  node.classList.add('adm-mark'); node.dataset.adm = word;
};
function patchCourt(doc, mark) {
  const c = court(open) || COURTS[0];
  if (!c) return;
  const head = doc.querySelector('.court-head');
  if (head && c.surface) head.dataset.surface = c.surface;
  const name = doc.getElementById('mx-court'); const s = doc.getElementById('mx-court-sub');
  if (name) name.textContent = c.name;
  if (s) s.textContent = [c.note, c.surface ? D.SURFACES[c.surface].label : ''].filter(Boolean).join(' · ');
  const box = doc.querySelector('.mx-court');
  if (box && !box.classList.contains('adm-mark')) mark(box, 'Корт');
}
let pvT = null;
function updateCourtPreview() {
  const col = $('#pv-courts');
  const c = court(open) || COURTS[0];
  const off = col.querySelector('.ct-pv-off');
  if (off) off.hidden = !!(c && c.surface);
  clearTimeout(pvT);
  pvT = setTimeout(() => {
    const fr = col.querySelector('iframe');
    try { const doc = fr && fr.contentDocument; if (doc && doc.getElementById('mx-court')) patchCourt(doc, markIn(doc)); } catch { /* рамка грузится — вставит сама */ }
  }, 80);
}
function drawCourtPreview() {
  previewPanel($('#pv-courts'), { app: { page: 'match-soon.html?m=final', title: 'Приложение: афиша матча', patch: patchCourt }, banner: 'Изменения корта игроки видят сразу' });
  const a = $('#pv-courts .pv-app');
  if (a) { const n = document.createElement('div'); n.className = 'ct-pv-off'; n.textContent = 'Выберите покрытие — и покажем, как корт увидят игроки'; n.hidden = true; a.append(n); }
  const cap = $('#pv-courts figcaption'); if (cap) cap.lastChild.textContent = 'Так корт видят в афише матча';
}
function drawCourtsWhere() {
  $('#where-courts').innerHTML = whereHtml([
    { icon: 'phone', b: 'Приложение', s: 'афиша матча, расписание турнира, пульт судьи' },
    { icon: 'site', b: 'Сайт', s: 'расписание турнира, «Сейчас на кортах»' },
    { icon: 'board', b: 'Табло в клубе', s: 'названия кортов' },
  ], { title: 'Где виден корт' });
}

// ============================================================
// УРОВНИ И ЗВАНИЯ
// ============================================================
// правило сезона сейчас: мир (D.RULES) и записанное Советом
const ruleNow = () => ({ from: D.RULES.corridor[0], to: D.RULES.corridor[1], age: D.RULES.ageSum, ...(state.get('rules.season') || {}) });
const KPR = [...new Set(D.PLAYERS.map((p) => p.kpr))].sort((a, b) => a - b);
const f1 = (x) => x.toFixed(1);
// примеры пар из мира: финалисты дня
const ex = (pairId, rule) => {
  const ps = D.pair(pairId).players.map(D.player);
  const sum = ps.reduce((s, p) => s + p.kpr, 0);
  const ok = sum >= rule.from - 1e-9 && sum <= rule.to + 1e-9;
  return { names: ps.map((p) => p.last).join(' и '), parts: ps.map((p) => f1(p.kpr)).join(' + '), sum: f1(sum), ok, low: sum < rule.from };
};
function drawLevels() {
  const rule = ruleNow();
  const a = ex(D.ME.pair, rule); const b = ex('osv', rule);
  const exLine = (x) => `<li class="${x.ok ? 'ok' : 'no'}">${icon(x.ok ? 'check' : 'close')}<span><b>${esc(x.names)}</b>: ${esc(x.parts)} = <span class="num">${esc(x.sum)}</span> — ${x.ok ? 'можно играть вместе' : `нельзя, ${x.low ? `ниже ${f1(rule.from)}` : `выше ${f1(rule.to)}`}`}</span></li>`;
  $('#levels-box').innerHTML = `
    <section class="ct-card" aria-labelledby="lv-kpr">
      <div class="ct-card-head"><h2 class="h2" id="lv-kpr">Уровень игрока — КПР</h2><span class="ct-who">${icon('lock')}Решает Совет</span></div>
      <p class="lead">КПР — личный уровень игры. Сейчас в лиге уровни от ${f1(KPR[0])} до ${f1(KPR[KPR.length - 1])}.</p>
      <ol class="ct-ruler" style="--n:${KPR.length}" aria-label="Уровни КПР в лиге">${KPR.map((k) => `<li><span class="num">${f1(k)}</span></li>`).join('')}</ol>
    </section>
    <section class="ct-card" aria-labelledby="lv-pair">
      <div class="ct-card-head"><h2 class="h2" id="lv-pair">Пара на турнире</h2><span class="ct-who">${icon('lock')}Правило сезона ${D.YEAR} · решение Совета</span></div>
      <ul class="ct-rules">
        <li><span>Сумма КПР двоих</span><span class="v">от <span class="num">${f1(rule.from)}</span> до <span class="num">${f1(rule.to)}</span></span></li>
        <li><span>Возраст двоих вместе</span><span class="v">не меньше <span class="num">${rule.age}</span> лет</span></li>
      </ul>
      <ul class="ct-ex" aria-label="Например">${exLine(a)}${exLine(b)}</ul>
    </section>
    <section class="ct-card" aria-labelledby="lv-ranks">
      <div class="ct-card-head"><h2 class="h2" id="lv-ranks">Звания</h2><span class="ct-who">${icon('star')}Звание не падает</span></div>
      <ol class="ct-ranks">${D.RANKS.map((r) => `<li><span class="n">${r.level}</span><b>${esc(r.label)}</b><span>${esc(r.rule)}</span></li>`).join('')}</ol>
    </section>
    <button class="btn quiet preview-open" type="button" data-for="pv-levels"><i data-icon="eye"></i>Посмотреть, как увидят</button>
    <div id="where-levels"></div>`;
  $('#where-levels').innerHTML = whereHtml([
    { icon: 'phone', b: 'Приложение', s: 'карта игрока, «Лестница званий», «Напарник»' },
    { icon: 'site', b: 'Сайт', s: 'страница игрока, список пар турнира' },
  ]);
  hydrate($('#levels-box'));
}
// правило сезона — решение Совета: шторка со степперами, потом подтверждение словами
function editRule() {
  const v = ruleNow();
  const step = (k, d) => `<div class="ct-stepper" data-k="${k}"><span class="label">${k === 'from' ? 'Сумма КПР — от' : k === 'to' ? 'Сумма КПР — до' : 'Возраст двоих — не меньше'}</span><div class="ct-steps"><button class="btn quiet" type="button" data-d="-${d}" aria-label="Меньше">−</button><span class="num" data-v>${k === 'age' ? v[k] : f1(v[k])}</span><button class="btn quiet" type="button" data-d="${d}" aria-label="Больше">+</button></div></div>`;
  const s = openSheet({
    title: `Правило сезона ${D.YEAR}: пара`,
    body: `${step('from', 0.5)}${step('to', 0.5)}${step('age', 1)}<p class="muted" data-say></p>`,
    foot: '<button class="btn main" type="button" data-ok>Записать правило сезона</button><button class="btn quiet" type="button" data-no>Отмена</button>',
  });
  const say = () => { const p = $('[data-say]', s); p.textContent = v.from > v.to ? '«От» больше, чем «до» — так нельзя' : `Пара проходит, если сумма КПР от ${f1(v.from)} до ${f1(v.to)} и вместе им не меньше ${v.age} лет`; p.style.color = v.from > v.to ? 'var(--bad-ink)' : ''; };
  say();
  s.addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const k = b.closest('[data-k]').dataset.k;
    v[k] = Math.round((v[k] + +b.dataset.d) * 10) / 10;
    if (k !== 'age') v[k] = Math.min(10, Math.max(5, v[k])); else v[k] = Math.min(120, Math.max(40, v[k]));
    $('[data-v]', b.closest('[data-k]')).textContent = k === 'age' ? v[k] : f1(v[k]);
    say();
  });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  s.querySelector('[data-ok]').addEventListener('click', () => {
    if (v.from > v.to) { say(); return; }
    confirmAction({
      kind: 'main',
      title: `Записать правило: сумма КПР от ${f1(v.from)} до ${f1(v.to)}, возраст от ${v.age} лет?`,
      text: 'Это решение Совета. Новые заявки на турниры проверяются по нему.',
      action: 'Записать правило сезона',
      onConfirm: () => {
        const undo = state.set('rules.season', { from: v.from, to: v.to, age: v.age }, { say: `записали правило сезона ${D.YEAR}: сумма КПР пары от ${f1(v.from)} до ${f1(v.to)}, возраст двоих — от ${v.age} лет`, href: HREF_LEVELS });
        toast('Правило сезона записано', { undo });
      },
    });
  });
}
// правило записали здесь, «Отменили» или поменяли в другой вкладке — на экране то же
state.on('rules', () => { if (built.levels) drawLevels(); });
function drawLevelsPreview() {
  previewPanel($('#pv-levels'), { app: { page: 'ranks.html', title: 'Приложение: лестница званий', patch: (doc, mark) => mark(doc.getElementById('steps'), 'Звания') }, banner: 'Так звания видят игроки' });
  const cap = $('#pv-levels figcaption'); if (cap) cap.lastChild.textContent = 'Лестница званий в приложении';
}

// ============================================================
// МОЙ ВИД: размер текста и тема — те же плитки, что в шторке «Мой вид»
// ============================================================
function drawView() {
  $('#view-box').innerHTML = `<p class="muted">Только у вас, на этом устройстве</p>${myViewHtml()}`;
  hydrate($('#view-box'));
}
bindMyView($('#view-box'));
// размер или тему сменили здесь, в шторке или в другой вкладке — плитки показывают, что выбрано; фокус — в той же группе
document.addEventListener('adm:view', () => {
  if (TAB !== 'view') return;
  const g = document.activeElement?.closest?.('#view-box [data-myv]')?.dataset.myv;
  drawView();
  if (g) $(`#view-box [data-myv="${g}"] [aria-checked="true"]`)?.focus();
});

// ============================================================
// ВКЛАДКИ
// ============================================================
let TAB = 'courts';
const built = {};
const TABS = ONLY_VIEW ? ['view'] : ['courts', 'levels', 'view'];
if (ONLY_VIEW) $$('#tabs [data-tab]').forEach((a) => { if (a.dataset.tab !== 'view') a.remove(); });
function show(tab) {
  if (!TABS.includes(tab)) tab = TABS[0];
  if (TAB === 'courts' && tab !== 'courts' && typing) saveName();
  TAB = tab;
  $$('#tabs [data-tab]').forEach((a) => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  $$('.ct-pane').forEach((p) => { p.hidden = p.id !== `pane-${tab}`; });
  if (!built[tab]) {
    built[tab] = true;
    if (tab === 'courts') { drawCourtPreview(); drawCourts(); drawCourtsWhere(); }
    if (tab === 'levels') { drawLevels(); drawLevelsPreview(); }
  }
  if (tab === 'view') drawView();
  // главная кнопка — только там, где есть дело: корт добавить; правило записать (Совет и админ)
  const act = $('#act'); const who = $('#who'); const add = $('#add');
  if (tab === 'courts') { act.hidden = false; who.textContent = 'Игроки видят корт сразу'; add.innerHTML = `${icon('plus')}Добавить корт`; }
  else if (tab === 'levels' && CAN_RULES) { act.hidden = false; who.textContent = 'Правило увидят все игроки в «Напарнике»'; add.innerHTML = `${icon('edit')}Изменить правило сезона`; }
  else act.hidden = true;
  const label = { courts: 'Корты и покрытия', levels: 'Уровни и звания', view: 'Мой вид' }[tab];
  document.title = `${label} · Настройки лиги`;
}
$('#tabs').addEventListener('click', (e) => {
  const a = e.target.closest('[data-tab]'); if (!a) return;
  e.preventDefault();
  if (a.dataset.tab === TAB) return;
  history.pushState(null, '', `#${a.dataset.tab}`);
  show(a.dataset.tab);
});
addEventListener('popstate', () => show(location.hash.slice(1)));
addEventListener('hashchange', () => show(location.hash.slice(1)));
show(location.hash.slice(1));
