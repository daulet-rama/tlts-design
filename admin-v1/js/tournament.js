// «Турнир»: участники, группы, сетка. Один турнир, вкладки сверху — те же на «Расписании» и «Результатах».
// По умолчанию — «Июльский кубок» (идёт запись); ?t=jun-3 — «Июньский кубок» (идёт, всё готово).
// Вкладки 1–3 — на этой странице (?step=pairs|groups|bracket), 4–5 — свои страницы.
// Решения — в общем состоянии: pairs.jul-4.<пара>, fees.jul-4.<пара>, groups.jul-4, bracket.jul-4.
// Мир и решения вместе — D.pairsNow('jul-4'); сделанное в другой вкладке видно сразу.
import {
  D, state, esc, icon, plural, toast, openSheet, closeLayer, whereHtml, hydrate, fitText, drag, duoHtml,
  rangeShort, dayWords, keepTheme, MON_GEN, gen, confirmAction,
} from '../admin.js';
import { kpr, points, where, kprText, CORRIDOR, matchNow, pairTight } from './tournament.data.js';
import { drawGroups, GROUPS, QF, LATER, placeWords } from './tournament.logic.js';
import { livePreview, appDuo, appHead, appTab } from './tournament.preview.js';
import { tabsHtml, tabStates, showCurrentTab } from './tournament.tabs.js';
import { stageNoNow, publishedStages, patchSeasonPath } from './start.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const Q = new URLSearchParams(location.search);
const TID = Q.get('t') === 'jun-3' ? 'jun-3' : 'jul-4';
const LIVE = TID === 'jun-3';
const ST = D.stageNow(TID);               // этап сезона: даты и игровые дни — с переносом в календаре; запись
const TW = D.tournament(TID);            // этап мира приложения: покрытие, корт финалов, жеребьёвка
const ROSTER = D.ROSTER[TID] || { accepted: [], passed: [], paid: [], waiting: [] };
const ON_SRF = { clay: 'на грунте', hard: 'на харде', grass: 'на траве' };
const dm = (iso) => `${+iso.slice(8)} ${MON_GEN[+iso.slice(5, 7) - 1]}`;
const pname = (id) => D.pairName(id);
const pairsWord = (n) => `${n} ${plural(n, 'пара', 'пары', 'пар')}`;
// «10–17 июля» — даты этапа сейчас (перенесли в календаре — новые)
const datesNow = () => (LIVE ? TW.dates : rangeShort(ST.from, ST.to).replace(/\u2060/g, ''));
const LO = kprText(CORRIDOR[0]); const HI = kprText(CORRIDOR[1]);
let step = ['pairs', 'groups', 'bracket'].includes(Q.get('step')) ? Q.get('step') : LIVE ? 'bracket' : 'pairs';

/* ============================================================
   СОСТОЯНИЕ «Июльского кубка» — общее: мир и решения из state.
   Всё, что можно вернуть, — сразу и с «Отменить»; строка журнала пишется сама (say).
   ============================================================ */
const GK = `groups.${TID}`;
const BK = `bracket.${TID}`;
const href = (s) => `tournament.html?t=${TID}&step=${s}`;
const P = () => D.pairsNow(TID);         // { accepted, waiting, reserve, refused: [{ id, why }], council, removed, paid, passed }
const grp = () => state.get(GK) || null; // { state: 'draft' | 'shown', groups, seeds, lot, shown, at }
const brk = () => state.get(BK) || null; // { state: 'draft' | 'shown', at }
const slots = () => ST.slots || 16;
// порядок строк «Ждут ответа» не меняется: строка остаётся на месте, пока говорит «Принято»
const ORDER = [...new Set([...ROSTER.waiting, ...ROSTER.accepted])];
let leaving = {};                        // id → «Принято», «В резерве»… — строка ещё на месте
// свои действия перерисовывают страницу сами; правку из другой вкладки или «Отменить» ловит подписка
let mine = 0;
const act = (fn) => { mine += 1; try { return fn(); } finally { mine -= 1; } };

const groupsNow = () => {
  const g = grp(); if (!g || !g.groups) return null;
  const acc = P().accepted;
  return Object.fromEntries(GROUPS.map((x) => [x, (g.groups[x] || []).filter((id) => acc.includes(id))]));
};
const groupsShown = () => !!grp() && grp().state === 'shown';
const groupsDirty = () => groupsShown() && JSON.stringify(grp().groups) !== JSON.stringify(grp().shown);
const placed = () => { const G = groupsNow(); return G ? GROUPS.flatMap((g) => G[g]) : []; };
const pool = () => P().accepted.filter((id) => !placed().includes(id));
const groupOf = (id) => { const G = groupsNow(); return G ? GROUPS.find((g) => G[g].includes(id)) || null : null; };
const inRange = (id) => where(id) === 'in' || P().passed.includes(id);

/* ============================================================
   ШАПКА И ВКЛАДКИ
   ============================================================ */
// у названия турнира — всегда состояние турнира; черновик групп и сетки — над их блоком
const headTag = () => (LIVE ? { cls: 'live', t: 'Идёт · финальный день' } : { cls: 'ok', t: `Запись открыта · до ${dm(ST.signupTo)}` });
function mainFor() {
  if (LIVE) return { who: '', btn: '' };
  const G = grp(); const B = brk();
  if (step === 'groups') {
    // запись ещё идёт — жеребьёвка впереди: раскладка — тихой кнопкой и вопросом словами
    if (!G && D.NOW.iso <= ST.signupTo) return { who: `Жеребьёвка — ${dm(ST.draw || TW.draw)}. Разложить сейчас черновиком?`, ico: 'calendar', btn: `<button class="btn quiet" type="button" data-act="draw">${icon('players')}Разложить черновиком</button>` };
    if (!G) return { who: 'Это черновик: игроки его не увидят', btn: `<button class="btn main" type="button" data-act="draw">${icon('players')}Разложить по группам</button>` };
    if (!groupsShown()) return { who: 'Увидят все: приложение и сайт', btn: `<button class="btn main" type="button" data-act="show-groups">${icon('eye')}Показать группы игрокам</button>` };
    if (groupsDirty()) return { who: 'Игроки видят прежние группы', btn: `<button class="btn main" type="button" data-act="show-groups">${icon('eye')}Показать правки игрокам</button>` };
  }
  if (step === 'bracket' && G) {
    if (!B) return { who: 'Это черновик: игроки его не увидят', btn: `<button class="btn main" type="button" data-act="build">${icon('cup')}Собрать сетку</button>` };
    if (B.state !== 'shown') return { who: 'Увидят все: приложение и сайт', btn: `<button class="btn main" type="button" data-act="show-bracket">${icon('eye')}Показать сетку игрокам</button>` };
  }
  return { who: '', btn: '' };
}
function renderHead() {
  $('#t-name').textContent = ST.name;
  document.title = `${ST.name} · Раздел организатора`;
  const t = headTag();
  const tag = $('#t-tag'); tag.className = `tag lg ${t.cls}`; tag.textContent = t.t;
  $('#t-sub').textContent = `Этап ${stageNoNow(TID)} · ${rangeShort(ST.from, ST.to)} · финалы ${ON_SRF[TW.surface]}`;
  const m = mainFor();
  $('#t-act').innerHTML = `${m.who && m.btn ? `<p class="who-sees">${icon(m.ico || 'eye')}<span>${esc(m.who)}</span></p>` : ''}${m.btn}`;
  $('#t-act').hidden = !m.btn;
}

/* ============================================================
   1. УЧАСТНИКИ
   ============================================================ */
// одна строка про уровень (КПР пары): «Уровень подходит: 8.0» или красным «Уровень 9.0 — выше 8.5»;
// что решает Совет, говорят строка над списком и кнопка «Передать в Совет»
const levelLine = (id) => {
  const k = kprText(kpr(id)); const w = where(id);
  if (P().passed.includes(id)) return { cls: '', t: `Уровень ${k} · пропустил Совет` };
  if (w === 'in') return { cls: '', t: `Уровень подходит: ${k}` };
  return { cls: 'bad', t: `Уровень ${k} — ${w === 'above' ? `выше ${HI}` : `ниже ${LO}`}` };
};
// «Отклонить» — тихим словом, не того же веса, что «Принять»; откроет окно с причиной
const REFUSE = (id) => `<button class="btn text refuse-link" type="button" data-act="refuse" data-id="${id}" aria-label="Отклонить заявку: ${esc(pname(id))}">Отклонить</button>`;
// Решённая заявка остаётся на месте строкой той же высоты, пока человек на странице:
// «Принято · Отменить». Список не сдвигается — следующее нажатие не попадёт в чужую пару.
// Под фамилией — та же строка уровня, что до решения: строка не меняет высоту.
const LEAVE_WORD = { accepted: 'Принято', reserve: 'В резерве', council: 'Передано в Совет', refused: 'Отклонено' };
function waitingRow(id, p) {
  const lv = leaving[id];
  const k = levelLine(id);
  if (lv) return `<li class="row prow leaving${lv.kind === 'refused' ? ' refused' : ''}" id="a-${id}"${lv.h ? ` style="min-height:${lv.h}px"` : ''}>${duoHtml(id)}<span class="grow"><span class="t fit">${esc(pname(id))}</span><span class="s ${k.cls}">${esc(k.t)}</span></span><span class="acts"><span class="said">${lv.kind === 'refused' ? '' : icon('check')}${esc(LEAVE_WORD[lv.kind])}</span><button class="btn quiet" type="button" data-act="undo-leave" data-id="${id}" aria-label="Отменить решение: ${esc(pname(id))}">${icon('undo')}Отменить</button></span></li>`;
  const full = p.accepted.length >= slots();
  let acts;
  if (!inRange(id)) acts = `<button class="btn quiet" type="button" data-act="council" data-id="${id}">Передать в Совет</button>`;
  else if (full) acts = `<button class="btn quiet" type="button" data-act="reserve" data-id="${id}">В резерв — мест нет (${slots()} из ${slots()})</button>`;
  else acts = `<button class="btn quiet" type="button" data-act="accept" data-id="${id}">${icon('check')}Принять</button><button class="btn quiet" type="button" data-act="reserve" data-id="${id}">В резерв</button>`;
  return `<li class="row prow" id="a-${id}">${duoHtml(id)}<span class="grow"><span class="t fit">${esc(pname(id))}</span><span class="s ${k.cls}">${esc(k.t)}</span></span><span class="acts">${acts}${REFUSE(id)}</span></li>`;
}
function acceptedRow(id, n, p) {
  const paid = p.paid.includes(id);
  const k = p.passed.includes(id) ? `Уровень ${kprText(kpr(id))} · пропустил Совет` : `Уровень ${kprText(kpr(id))}`;
  return `<li class="row prow" id="a-${id}"><span class="pnum num" aria-hidden="true">${n}</span>${duoHtml(id)}<button class="pr-open" type="button" data-act="pair" data-id="${id}"><span class="t fit">${esc(pname(id))}</span><span class="s">${esc(k)}</span></button><span class="acts pay">${paid ? '<span class="tag ok">Оплачено</span>' : `<button class="btn quiet" type="button" data-act="pay" data-id="${id}">Отметить оплату</button>`}</span></li>`;
}
function liveRow(p, n) {
  const seed = p.seed ? ` · посев ${p.seed}` : '';
  return `<li class="row prow" id="a-${p.id}"><span class="pnum num" aria-hidden="true">${n}</span>${duoHtml(p.id)}<span class="grow"><span class="t fit">${esc(pname(p.id))}</span><span class="s">Уровень ${kprText(kpr(p.id))} · группа ${p.group}${seed}</span></span></li>`;
}
const simpleRow = (id, s, acts) => `<li class="row prow" id="a-${id}">${duoHtml(id)}<span class="grow"><span class="t fit">${esc(pname(id))}</span><span class="s">${esc(s)}</span></span><span class="acts">${acts}</span></li>`;
function pairsBody() {
  if (LIVE) {
    return `<section class="sec"><div class="sec-head"><h2 class="h2">Приняты <span class="num">· ${D.PAIRS.length} из ${slots()}</span></h2><span class="muted">Запись закрыта</span><button class="btn quiet preview-open" type="button">${icon('eye')}Посмотреть, как увидят</button></div>
      <ul class="list">${D.PAIRS.map((x, i) => liveRow(x, i + 1)).join('')}</ul></section>
      ${whereHtml([{ icon: 'phone', b: 'Приложение', s: '«Турниры» → «Июньский кубок»' }, { icon: 'site', b: 'Сайт', s: 'страница турнира → «Список пар»' }])}`;
  }
  const p = P();
  const out = p.waiting.filter((id) => !inRange(id));
  const paidN = p.accepted.filter((id) => p.paid.includes(id)).length;
  const order = [...ORDER, ...p.waiting.filter((id) => !ORDER.includes(id))];
  const rows = order.filter((id) => p.waiting.includes(id) || leaving[id]);
  return `${out.length ? `<p class="qline" role="note">${icon('warn')}<span>Решает Совет: ${out.map((id) => `<a href="#a-${id}">${esc(pname(id))}</a>`).join(', ')}</span></p>` : ''}
    <section class="sec" aria-labelledby="h-wait">
      <div class="sec-head"><h2 class="h2" id="h-wait">Ждут ответа <span class="num">· ${p.waiting.length}</span></h2><button class="btn quiet preview-open" type="button">${icon('eye')}Посмотреть, как увидят</button></div>
      ${rows.length ? `<ul class="list" id="wait-list">${rows.map((id) => waitingRow(id, p)).join('')}</ul>` : `<div class="empty slim"><p>Новых заявок нет. Пары подают их в приложении до ${esc(dm(ST.signupTo))}</p></div>`}
    </section>
    <section class="sec" aria-labelledby="h-acc">
      <div class="sec-head"><h2 class="h2" id="h-acc">Приняты <span class="num">· ${p.accepted.length} из ${slots()}</span></h2><span class="strong paid-sum">Взнос оплатили ${paidN} из ${p.accepted.length}</span></div>
      <ul class="list"><li class="list-head acc-head" aria-hidden="true"><span>Пара</span><span>Взнос</span></li>${p.accepted.map((id, i) => acceptedRow(id, i + 1, p)).join('')}</ul>
    </section>
    ${p.reserve.length ? `<section class="sec"><div class="sec-head"><h2 class="h2">Резерв <span class="num">· ${p.reserve.length}</span></h2></div><ul class="list">${p.reserve.map((id) => simpleRow(id, `${levelLine(id).t}. Пара видит «Вы в резерве»`, `${p.accepted.length < slots() ? `<button class="btn quiet" type="button" data-act="accept" data-id="${id}">${icon('check')}Принять</button>` : ''}${REFUSE(id)}`)).join('')}</ul></section>` : ''}
    ${p.council.length ? `<section class="sec"><div class="sec-head"><h2 class="h2">Ждут решения Совета <span class="num">· ${p.council.length}</span></h2></div><ul class="list">${p.council.map((id) => simpleRow(id, levelLine(id).t, `<span class="tag info">У Совета</span><button class="btn quiet" type="button" data-act="unwait" data-id="${id}">Вернуть</button>`)).join('')}</ul></section>` : ''}
    ${p.refused.length ? `<section class="sec"><div class="sec-head"><h2 class="h2">Отклонены <span class="num">· ${p.refused.length}</span></h2></div><ul class="list">${p.refused.map((r) => simpleRow(r.id, `Пара видит: «${r.why || 'Заявка отклонена организатором'}»`, `<button class="btn quiet" type="button" data-act="unwait" data-id="${r.id}">Вернуть заявку</button>`)).join('')}</ul></section>` : ''}
    ${p.removed.length ? `<section class="sec"><div class="sec-head"><h2 class="h2">Сняты <span class="num">· ${p.removed.length}</span></h2></div><ul class="list">${p.removed.map((id) => simpleRow(id, 'Пара видит, что снята с турнира', `<button class="btn quiet" type="button" data-act="restore" data-id="${id}">Вернуть в турнир</button>`)).join('')}</ul></section>` : ''}
    ${whereHtml([
    { icon: 'phone', b: 'Приложение', s: `«Турниры» → «${ST.name}»: «${p.accepted.length} из ${slots()} пар»; пара видит решение сразу` },
    { icon: 'site', b: 'Сайт', s: 'страница турнира → «Список пар»' },
    { icon: 'lock', b: 'Взнос', no: true, s: 'видят только пара и вы' },
  ])}`;
}

/* ============================================================
   2. ГРУППЫ
   ============================================================ */
const seedOf = (id) => (LIVE ? D.pair(id).seed : ((grp() && grp().seeds) || {})[id]);
function liveGroups() {
  const G = {}; GROUPS.forEach((g) => { G[g] = D.groupTable(g).map((r) => r.pair); }); return G;
}
function slotHtml(id, g, k) {
  const seed = seedOf(id);
  if (LIVE) {
    const r = D.groupTable(g).find((x) => x.pair === id);
    return `<li class="gslot static" data-id="${id}"><span class="gplace num">${k + 1}</span>${duoHtml(id)}<span class="grow"><span class="nm">${esc(pname(id))}</span><span class="s">${r.won} ${plural(r.won, 'победа', 'победы', 'побед')} · геймы ${r.games}${seed ? ` · посев ${seed}` : ''}</span></span>${r.through ? '<span class="tag ok">Плей-офф</span>' : ''}</li>`;
  }
  // фамилии — одним размером; «Перенести» — под фамилией
  return `<li><button type="button" class="gslot" data-id="${id}" aria-label="${esc(pname(id))}, группа ${g}. Перенести в другую группу"><span class="gplace num">${k + 1}</span>${duoHtml(id)}<span class="grow"><span class="nm">${esc(pname(id))}</span><span class="s">${seed ? `Посев ${seed} · ` : ''}<span class="go">Перенести</span></span></span></button></li>`;
}
function groupCard(g, G) {
  const list = G[g] || [];
  const free = LIVE ? 0 : Math.max(0, 4 - list.length);
  const seeds = list.filter((id) => seedOf(id)).length;
  const head = LIVE ? '' : free === 4 ? 'пусто' : free ? `${list.length} из 4` : 'полная';
  // свободные места — одна пунктирная область с номерами, без слов в каждом месте
  const freeHtml = free ? `<li class="gfree" aria-label="${free} ${plural(free, 'место свободно', 'места свободны', 'мест свободны')}"><span class="gf-n" aria-hidden="true">${Array.from({ length: free }, (_, i) => `<span class="num">${list.length + i + 1}</span>`).join('')}</span><span class="gf-t">${free} ${plural(free, 'место свободно', 'места свободны', 'мест свободны')}</span></li>` : '';
  return `<section class="gcard${seeds > 1 ? ' warn' : ''}" data-g="${g}" aria-label="Группа ${g}"><header><h3 class="h2">Группа ${g}</h3>${head ? `<span class="muted">${esc(head)}</span>` : ''}</header>
    <ol class="gslots">${list.map((id, k) => slotHtml(id, g, k)).join('')}${freeHtml}</ol></section>`;
}
function whyGroups() {
  if (LIVE) {
    return `<div class="whybox"><h3 class="h3">Почему так</h3><ul>
      <li>${icon('check')}<span>Места — по числу побед. У двух равных решает личная встреча, у трёх — процент геймов.</span></li>
      <li>${icon('check')}<span>Первые два места — плей-офф высшей категории.</span></li></ul></div>`;
  }
  const G = groupsNow(); const seeds = (grp() && grp().seeds) || {};
  const lines = [];
  lines.push({ t: 'Сеяные — по одной в группе: у них больше всего баллов рейтинга.' });
  lines.push({ t: 'Посев 1 и 2 — в группах A и D: встретятся только в финале.' });
  const others = placed().filter((id) => !seeds[id]).length;
  if (others) lines.push({ t: `Остальные ${others} ${plural(others, 'пара', 'пары', 'пар')} — жребием.` });
  const free = 16 - placed().length;
  if (free) lines.push({ t: `Свободно ${free} ${plural(free, 'место', 'места', 'мест')} — их займут пары, которых вы ещё примете.` });
  // проверки после ручной правки — словами, ничего не запрещаем
  GROUPS.forEach((g) => { const s = G[g].filter((id) => seeds[id]); if (s.length > 1) lines.push({ warn: true, t: `В группе ${g} ${s.length === 2 ? 'два' : s.length} сеяных: ${s.map((id) => `посев ${seeds[id]}`).join(' и ')}` }); });
  const sizes = GROUPS.map((g) => G[g].length);
  if (Math.max(...sizes) - Math.min(...sizes) > 1) {
    const big = GROUPS[sizes.indexOf(Math.max(...sizes))]; const small = GROUPS[sizes.indexOf(Math.min(...sizes))];
    lines.push({ warn: true, t: `Группы неровные: в группе ${big} — ${pairsWord(Math.max(...sizes))}, в группе ${small} — ${pairsWord(Math.min(...sizes))}` });
  }
  return `<div class="whybox"><h3 class="h3">Как разложено</h3><ul>${lines.map((l) => `<li class="${l.warn ? 'warn' : ''}">${icon(l.warn ? 'warn' : 'check')}<span>${esc(l.t)}</span></li>`).join('')}</ul></div>`;
}
// состояние групп — над их блоком, а не у названия турнира
function groupsState() {
  if (LIVE) return '<span class="tag ok">Видно игрокам</span>';
  const g = grp();
  if (!g) return '';
  if (g.state !== 'shown') return `<span class="tag draft">Черновик — игроки не видят</span><span class="saved">${icon('check')}Сохранено в ${esc(g.saved || D.NOW.time)}</span>`;
  if (groupsDirty()) return `<span class="tag warn">Есть правки — игроки их ещё не видят</span><button class="btn quiet" type="button" data-act="revert-groups">${icon('undo')}Вернуть опубликованное</button>`;
  return `<span class="tag ok">Видно игрокам ${esc(g.at || '')}</span>`;
}
function groupsBody() {
  const G = LIVE ? liveGroups() : (groupsNow() || Object.fromEntries(GROUPS.map((g) => [g, []])));
  const pl = LIVE ? [] : pool();
  const has = !LIVE && !!grp();
  const poolHtml = pl.length ? `<section class="gpool" data-g=""><div class="sec-head"><h2 class="h2">Не распределены <span class="num">· ${pl.length}</span></h2></div>
    <ul class="gchips">${pl.map((id) => `<li><button type="button" class="gslot chip-pair" data-id="${id}">${duoHtml(id)}<span class="grow"><span class="nm">${esc(pname(id))}</span><span class="s"><span class="go">В группу…</span></span></span></button></li>`).join('')}</ul></section>` : '';
  return `${poolHtml}
    <div class="sec"><div class="sec-head"><h2 class="h2">Группы</h2>${groupsState()}<button class="btn quiet preview-open" type="button">${icon('eye')}Посмотреть, как увидят</button></div>
    <div class="gcards">${GROUPS.map((g) => groupCard(g, G)).join('')}</div></div>
    ${LIVE || has ? whyGroups() : ''}
    ${has ? `<div class="line"><button class="btn quiet" type="button" data-act="redraw">${icon('undo')}Тянуть жребий заново</button><span class="muted">Сеяные останутся на местах</span></div>` : ''}
    ${whereHtml([{ icon: 'phone', b: 'Приложение', s: '«Турнир» → «Группы»' }, { icon: 'site', b: 'Сайт', s: 'страница турнира → «Группы»' }])}`;
}

/* ============================================================
   3. СЕТКА — рисунок из плашек
   ============================================================ */
const QF_DAY = LIVE ? '2027-06-18' : ST.play[3];
const FD_DAY = LIVE ? '2027-06-19' : ST.play[4];
function sideHtml(m, i) {
  if (!m.pairs) return `<span class="pl-side"><span class="nm tbd">${esc(m.labels[i])}</span></span>`;
  const id = m.pairs[i];
  let cls = 'pl-side'; let sc = '';
  if (m.state === 'done') { cls += m.winner === i ? ' win' : ' lose'; sc = `<span class="num sc">${m.sets[0][i]}${m.sets[0][2] !== undefined && m.winner !== i ? `<sup>${m.sets[0][2]}</sup>` : ''}</span>`; }
  if (m.state === 'live') sc = `<span class="num sc">${m.games[i]}</span>`;
  // фамилии не сжимаются: длинная переносится после «/»
  return `<span class="${cls}"><span class="nm">${esc(pname(id)).replace(' / ', ' /<wbr> ')}</span>${sc}</span>`;
}
function plateHtml(id) {
  const m = slotMatch(id);
  const c = m.court ? D.COURTS[m.court] : null;
  if (m.note) return `<div class="plate" data-state="tbd" data-id="${id}"><span class="pl-note">${esc(m.note)}</span></div>`;
  let top = '';
  if (m.state === 'live') top = `<span class="lv">Идёт${c ? ' · ' + esc(c.name) : ''}</span>`;
  else if (m.state === 'soon' && m.time) top = `<span class="num">${esc(m.time)}</span>${c ? ' · ' + esc(D.courtLine(m.court)) : ''}`;
  const strip = m.state === 'soon' && c ? `<span class="pl-srf" data-srf="${c.surface}" aria-hidden="true"></span>` : '';
  return `<div class="plate" data-state="${m.pairs ? m.state : 'tbd'}" data-id="${id}">${strip}${top ? `<span class="pl-top">${top}</span>` : ''}${sideHtml(m, 0)}${sideHtml(m, 1)}</div>`;
}
const FROM_WORDS = { sf1: 'Победители четвертьфиналов выше', sf2: 'Победители четвертьфиналов ниже', final: 'Победители полуфиналов', third: 'Проигравшие в полуфиналах', c5a: 'Проигравшие в нижних четвертьфиналах', c5b: 'Проигравшие в верхних четвертьфиналах', p5: 'Победители матчей за 5–8 места', p7: 'Проигравшие в матчах за 5–8 места' };
function slotMatch(id) {
  if (LIVE) return matchNow(id);
  const q = QF.find((x) => x.id === id);
  if (q) return { id, state: 'soon', pairs: null, labels: [placeWords(q.a), placeWords(q.b)] };
  return { id, state: 'soon', pairs: null, note: FROM_WORDS[id] || 'Пары ещё не известны' };
}
function bracketState() {
  if (LIVE) return '<span class="tag ok">Видно игрокам</span>';
  const b = brk();
  if (!b) return '';
  return b.state === 'shown' ? `<span class="tag ok">Видно игрокам ${esc(b.at || '')}</span>` : `<span class="tag draft">Черновик — игроки не видят</span><span class="saved">${icon('check')}Сохранено в ${esc(b.saved || D.NOW.time)}</span>`;
}
function bracketBody() {
  if (!LIVE && !grp()) return `<div class="empty"><span class="ic">${icon('cup')}</span><p>Сетка собирается из мест в группах. Сначала разложите пары по группам</p><button class="btn quiet" type="button" data-step="groups">${icon('players')}Перейти к группам</button></div>`;
  if (!LIVE && !brk()) return `<div class="empty"><span class="ic">${icon('cup')}</span><p>Сетки ещё нет. Сайт поставит первые места групп против вторых из соседней группы</p></div>${whereHtml([{ icon: 'phone', b: 'Приложение', s: '«Турнир» → «Сетка»' }, { icon: 'site', b: 'Сайт', s: 'страница турнира → «Сетка»' }])}`;
  const col = (title, iso, ids, cls = '') => `<div class="bk-col ${cls}"><h3 class="bk-h"><span>${esc(title)}</span><span class="muted">${esc(dayWords(iso))}</span></h3><div class="bk-cells">${ids}</div></div>`;
  const pair2 = (a, b) => `<div class="bk-pair">${plateHtml(a)}${plateHtml(b)}</div>`;
  const qf = col('Четвертьфиналы', QF_DAY, pair2('qf3', 'qf4') + pair2('qf1', 'qf2'), 'qf');
  const sf = col('Полуфиналы', FD_DAY, `<div class="bk-pair tall"><div class="bk-one">${plateHtml('sf1')}</div><div class="bk-one">${plateHtml('sf2')}</div></div>`, 'sf');
  const fin = col('Финал', FD_DAY, `<div class="bk-one full">${plateHtml('final')}</div>`, 'f');
  const cons = (title, ids) => `<div class="bk-place"><h3 class="h3">${esc(title)}</h3>${ids.map(plateHtml).join('')}</div>`;
  const why = LIVE ? '' : `<div class="whybox"><h3 class="h3">Как собрана</h3><ul>
      <li>${icon('check')}<span>Первые места групп играют со вторыми из соседней группы: A с B, C с D.</span></li>
      <li>${icon('check')}<span>Посев 1 и 2 — в разных половинах: встретятся только в финале.</span></li>
      <li>${icon('check')}<span>Пары появятся в сетке сами, когда сыграют группы.</span></li></ul></div>`;
  return `<div class="sec"><div class="sec-head"><h2 class="h2">Высшая категория</h2>${bracketState()}<button class="btn quiet preview-open" type="button">${icon('eye')}Посмотреть, как увидят</button></div>
    <div class="bk" role="group" aria-label="Сетка плей-офф">${qf}${sf}${fin}</div></div>
    <div class="sec"><h2 class="h2">Матчи за места</h2><div class="bk-places">${cons('За 3-е место', ['third'])}${cons('За 5–8 места', ['c5a', 'c5b'])}${cons('За 5-е и 7-е место', ['p5', 'p7'])}</div></div>
    ${why}
    ${whereHtml([{ icon: 'phone', b: 'Приложение', s: '«Турнир» → «Сетка»' }, { icon: 'site', b: 'Сайт', s: 'страница турнира → «Сетка»' }])}`;
}

/* ============================================================
   ПРЕДПРОСМОТР: настоящие экраны приложения в рамке
   ============================================================ */
const pv = livePreview($('#pv'));
// номер этапа и сколько их — с учётом турниров, созданных в разделе (этапы идут по датам)
const julyHead = (doc, line) => appHead(doc, { surface: TW.surface, cap: `Этап ${stageNoNow(TID)} из ${publishedStages().length}`, title: ST.name, meta: `${datesNow()} · ${slots()} пар`, line });
function appGroupsHtml(G) {
  const row = (id, k) => { const [a, b] = D.pairLines(id); return `<div class="gt-row" role="row"><span class="num place" role="cell">${k + 1}</span><span role="cell" class="gt-pair">${appDuo(D, id)}<span class="gt-name strong"><span>${esc(a)}</span><span><span class="vh"> / </span>${esc(b)}</span></span></span><span class="t-num gt-games" role="cell">0:0</span><span class="num wins" role="cell">0</span></div>`; };
  const free = (k) => `<div class="gt-row" role="row"><span class="num place" role="cell">${k + 1}</span><span role="cell" class="gt-pair"><span class="gt-name" style="color:var(--ink-2,#555)">Пара ещё не известна</span></span><span></span><span></span></div>`;
  return `<section class="section lead-say"><span class="cap">Групповой этап · ${esc(dm(ST.play[0]))}–${esc(dm(ST.play[2]))}</span><p class="title">Группы «${esc(gen(ST.name))}»</p><p class="muted">Матчи начнутся ${esc(dm(ST.play[0]))}</p></section>
    ${GROUPS.map((g) => `<section class="section" aria-label="Группа ${g}"><div class="sec-head"><span class="cap">Группа ${g}</span></div><div class="card gt compact" role="table" aria-label="Группа ${g}"><div class="gt-row gt-head" aria-hidden="true"><span></span><span class="cap">Пара</span><span class="cap">Геймы</span><span class="cap">Победы</span></div>${G[g].map(row).join('')}${Array.from({ length: Math.max(0, 4 - G[g].length) }, (_, k) => free(G[g].length + k)).join('')}</div></section>`).join('')}`;
}
function appBracketHtml() {
  const tile = (id) => { const m = slotMatch(id); const lines = m.labels || [m.note]; return `<li><span class="mt slim" data-state="soon" data-match="${id}"><span class="mt-head"><span class="cap">${esc(id.startsWith('qf') ? 'Четвертьфинал' : LATER.find((x) => x.id === id).title)}</span></span><span class="mt-body">${lines.map((l) => `<span class="mt-side"><span class="mt-name"><span>${esc(l)}</span></span></span>`).join('')}</span></span></li>`; };
  return `<section class="section lead-say"><span class="cap">Плей-офф · ${esc(dm(ST.play[3]))}–${esc(dm(ST.play[4]))}</span><p class="title">Сетка высшей категории</p><p class="muted">Пары встанут сюда после групп</p></section>
    <section class="section" aria-label="Сетка плей-офф"><ol class="vbracket">
      <li class="vb-round"><span class="cap">Четвертьфиналы</span><span class="cap">${esc(dm(ST.play[3]))}</span></li>${['qf3', 'qf4', 'qf1', 'qf2'].map(tile).join('')}
      <li class="vb-round"><span class="cap">Полуфиналы</span><span class="cap">${esc(dm(ST.play[4]))}</span></li>${['sf1', 'sf2'].map(tile).join('')}
      <li class="vb-round"><span class="cap">Финал</span><span class="cap">${esc(dm(ST.play[4]))}</span></li>${tile('final')}
    </ol></section>`;
}
function sitePairs() {
  const list = LIVE ? D.PAIRS.map((x) => x.id) : P().accepted;
  return `<div class="site-t"><b>${esc(ST.name)}</b><span>${esc(datesNow())} · Список пар · ${list.length} из ${slots()}</span></div><ol class="site-pairs">${list.map((id, i) => `<li class="${!LIVE && !ROSTER.accepted.includes(id) ? 'new' : ''}"><span class="n num">${i + 1}</span><span class="t">${esc(pname(id))}</span><span class="s num">${kprText(kpr(id))}</span></li>`).join('')}</ol>`;
}
function siteGroups() {
  const G = LIVE ? liveGroups() : groupsNow();
  return `<div class="site-t"><b>${esc(ST.name)}</b><span>${esc(datesNow())} · Группы</span></div><div class="site-groups">${GROUPS.map((g) => `<div><b>Группа ${g}</b><ol>${G[g].map((id) => `<li>${esc(pname(id))}</li>`).join('')}</ol></div>`).join('')}</div>`;
}
function refreshPreview() {
  if (step === 'pairs') {
    pv.show({
      page: 'tournaments.html', title: 'Приложение: Турниры', banner: LIVE ? 'Так это видят игроки сейчас' : 'Решения по заявкам игроки видят сразу',
      patch: (doc, mark) => {
        // путь сезона — с турнирами, созданными в разделе: номера по датам
        const li = patchSeasonPath(doc).li[TID];
        if (!li) return;
        const n = P().accepted.length;
        if (!LIVE) {
          const cap = li.querySelector('.st-fill .cap'); if (cap) cap.textContent = `${n} из ${slots()} пар`;
          li.querySelectorAll('.st-slots i').forEach((x, k) => x.classList.toggle('on', k < n));
        }
        // отметка — на самой строке: у пункта пути своя линия-связка (::after)
        mark(li.querySelector('.st-row') || li, !LIVE && n !== ROSTER.accepted.length ? `${n} из ${slots()}` : 'Здесь');
      },
      site: sitePairs,
    });
    return;
  }
  if (step === 'groups') {
    pv.show({
      page: 'tournament.html', title: 'Приложение: Турнир, Группы', get banner() { return LIVE || (groupsShown() && !groupsDirty()) ? 'Так это видят игроки сейчас' : 'Предпросмотр — игроки увидят после «Показать группы игрокам»'; },
      patch: (doc, mark) => {
        appTab(doc, 'gruppy');
        if (LIVE) { mark(doc.querySelector('#pane-gruppy .card.gt'), 'Группы'); return; }
        julyHead(doc, `Жеребьёвка ${dm(TW.draw)}`);
        const pane = doc.getElementById('pane-gruppy'); if (!pane) return;
        const G = groupsNow();
        if (!G) { pane.innerHTML = `<section class="section lead-say"><span class="cap">Жеребьёвка · ${esc(dm(TW.draw))}</span><p class="title">Группы появятся после жеребьёвки</p><p class="muted">Так игроки видят вкладку сейчас</p></section>`; mark(pane.querySelector('.lead-say'), 'Сейчас'); return; }
        pane.innerHTML = appGroupsHtml(G);
        mark(pane.querySelector('.card.gt'), groupsShown() && !groupsDirty() ? 'Видно' : 'Черновик');
      },
      site: () => (LIVE || groupsNow() ? siteGroups() : `<div class="site-t"><b>${esc(ST.name)}</b><span>Группы — после жеребьёвки ${esc(dm(TW.draw))}</span></div>`),
    });
    return;
  }
  pv.show({
    page: 'tournament.html', title: 'Приложение: Турнир, Сетка', get banner() { return LIVE || (brk() && brk().state === 'shown') ? 'Так это видят игроки сейчас' : 'Предпросмотр — игроки увидят после «Показать сетку игрокам»'; },
    patch: (doc, mark) => {
      appTab(doc, 'setka');
      if (LIVE) { mark(doc.querySelector('#pane-setka .vbracket'), 'Сетка'); return; }
      julyHead(doc, `Плей-офф ${dm(ST.play[3])}–${dm(ST.play[4])}`);
      const pane = doc.getElementById('pane-setka'); if (!pane) return;
      if (!brk()) { pane.innerHTML = `<section class="section lead-say"><span class="cap">Плей-офф · ${esc(dm(ST.play[3]))}</span><p class="title">Сетка появится после групп</p><p class="muted">Так игроки видят вкладку сейчас</p></section>`; mark(pane.querySelector('.lead-say'), 'Сейчас'); return; }
      pane.innerHTML = appBracketHtml();
      mark(pane.querySelector('.vbracket'), brk().state === 'shown' ? 'Видно' : 'Черновик');
    },
    site: () => `<div class="site-t"><b>${esc(ST.name)}</b><span>Сетка · высшая категория</span></div>${['qf3', 'qf4', 'qf1', 'qf2'].map((id) => { const m = slotMatch(id); const d = QF_DAY; return `<div class="site-row"><span class="d">${+d.slice(8)}<small>${esc(MON_GEN[+d.slice(5, 7) - 1])}</small></span><span class="t">Четвертьфинал</span><span class="s">${m.pairs ? esc(pname(m.pairs[0]) + ' — ' + pname(m.pairs[1])) : esc(m.labels[0] + ' — ' + m.labels[1])}</span></div>`; }).join('')}`,
  });
}

/* ============================================================
   ОТРИСОВКА
   ============================================================ */
function render() {
  renderHead();
  $('#tabs').innerHTML = tabsHtml(TID, step, { states: tabStates(TID), inPage: ['pairs', 'groups', 'bracket'] });
  showCurrentTab();
  const body = $('#body');
  body.innerHTML = step === 'pairs' ? pairsBody() : step === 'groups' ? groupsBody() : bracketBody();
  hydrate(body);
  requestAnimationFrame(() => fitText(body));
  if (step === 'groups' && !LIVE) wireDrag();
  refreshPreview();
}
function go(k) {
  step = k;
  const u = new URL(location.href); u.searchParams.set('step', k); history.replaceState(null, '', u);
  render();
  scrollTo({ top: 0 });
}
// правка из другой вкладки или «Отменить» — страница показывает то же, что общее состояние;
// решённая строка остаётся, пока решение то же (после «Отменить» пара снова ждёт ответа)
const statusOf = (id) => { const p = P(); return p.accepted.includes(id) ? 'accepted' : p.reserve.includes(id) ? 'reserve' : p.council.includes(id) ? 'council' : p.refused.some((r) => r.id === id) ? 'refused' : p.waiting.includes(id) ? 'waiting' : 'removed'; };
state.on('', () => {
  if (mine) return;
  Object.keys(leaving).forEach((id) => { if (statusOf(id) !== leaving[id].kind) delete leaving[id]; });
  render();
});

/* ============================================================
   ДЕЙСТВИЯ — каждое пишет в общее состояние со строкой журнала
   ============================================================ */
const flash = (id) => requestAnimationFrame(() => { const x = document.getElementById(`a-${id}`) || $(`.gslot[data-id="${id}"]`); if (x) { x.classList.add('just'); x.scrollIntoView({ block: 'nearest' }); } });
const decide = (id, status, sayText, why) => state.set(`pairs.${TID}.${id}`, why ? { status, why } : { status }, { say: sayText, href: href('pairs') });
// решение по заявке: строка остаётся на месте той же высоты и говорит «Принято · Отменить»
// до ухода со страницы; список под ней не едет. Фокус — на первую кнопку следующей пары.
// h — высота строки до решения (на телефоне кнопки решения занимают две строки).
function leave(id, kind, undo, h) {
  leaving[id] = { kind, undo, h: h || 0 };
  const next = ORDER.find((x) => x !== id && P().waiting.includes(x) && !leaving[x]);
  render();
  const nb = next && document.querySelector(`#a-${next} .acts .btn`);
  if (nb) nb.focus({ preventScroll: true });
}
const rowH = (id) => { const r = document.getElementById(`a-${id}`); return r ? +r.getBoundingClientRect().height.toFixed(2) : 0; };
// «Отменить» в строке: решение и строка журнала убраны, пара снова ждёт ответа на том же месте
function undoLeave(id) {
  const lv = leaving[id]; if (!lv) return;
  delete leaving[id];
  act(() => lv.undo && lv.undo());
  render(); flash(id);
  const b = document.querySelector(`#a-${id} .acts .btn`); if (b) b.focus({ preventScroll: true });
  toast(`${pname(id)}: заявка снова ждёт ответа`);
}
function accept(id) {
  const fromWaiting = P().waiting.includes(id);
  const h = rowH(id);
  const undo = act(() => decide(id, 'accepted', `приняли пару ${pairTight(id)} на «${ST.name}»`));
  if (fromWaiting) leave(id, 'accepted', undo, h); else { render(); flash(id); }
  toast(`${pname(id)} приняты · стало ${P().accepted.length} из ${slots()} пар`, { undo });
}
function toReserve(id) {
  const h = rowH(id);
  const undo = act(() => decide(id, 'reserve', `поставили в резерв пару ${pairTight(id)} — «${ST.name}»`));
  leave(id, 'reserve', undo, h);
  toast(`${pname(id)} — в резерве. Пара видит «Вы в резерве»`, { undo });
}
function toCouncil(id) {
  const h = rowH(id);
  const undo = act(() => decide(id, 'council', `передали в Совет заявку пары ${pairTight(id)} на «${ST.name}»`));
  leave(id, 'council', undo, h);
  toast(`${pname(id)}: заявка передана в Совет`, { undo });
}
function unwait(id) {
  const undo = act(() => decide(id, 'waiting', `вернули заявку пары ${pairTight(id)} — снова ждёт ответа`));
  render(); flash(id);
  toast(`${pname(id)}: заявка снова ждёт ответа`, { undo });
}
function setPaid(id, paid) {
  return act(() => state.set(`fees.${TID}.${id}`, paid, { say: paid ? `отметили взнос: ${pairTight(id)} — «${ST.name}»` : `сняли отметку взноса: ${pairTight(id)} — «${ST.name}»`, href: href('pairs') }));
}
function pay(id) {
  const undo = setPaid(id, true);
  render(); flash(id);
  toast(`Оплата ${pname(id)} отмечена`, { undo });
}
// отказ: 2–3 готовые причины и строка «Пара увидит: …»
function refuseSheet(id) {
  const lvl = `Уровень пары ${kprText(kpr(id))}, а нужно от ${LO} до ${HI}`;
  const R = [
    { v: 'level', t: `Уровень не подходит (нужно ${LO}–${HI})`, say: lvl, log: 'уровень не подходит' },
    { v: 'full', t: 'Нет мест', say: `Свободных мест нет: в турнире ${slots()} пар`, log: 'нет мест' },
    { v: 'other', t: 'Другое', say: '', log: '' },
  ];
  let pick = inRange(id) ? null : 'level'; let other = '';
  const sayOf = () => { const r = R.find((x) => x.v === pick); if (!r) return ''; return r.v === 'other' ? (other.trim() || 'Заявка отклонена организатором') : r.say; };
  const s = openSheet({
    title: 'Отклонить заявку?',
    body: `<div class="line">${duoHtml(id)}<b class="h3">${esc(pname(id))}</b></div>
      <h3 class="h3">Почему?</h3>
      <div class="choices one short" role="radiogroup" aria-label="Причина">${R.map((r) => `<button type="button" class="choice" role="radio" aria-checked="${pick === r.v}" data-value="${r.v}"><span class="t">${esc(r.t)}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div>
      <div class="field" id="rf-other" hidden><label class="label" for="rf-text">Что сказать паре</label><input class="input" id="rf-text" autocomplete="off"></div>
      <div class="say-box"><span class="label">Пара увидит в приложении</span><p id="rf-say"></p></div>`,
    foot: '<p class="pick-msg" role="alert" hidden></p><button class="btn danger" type="button" data-ok>Отклонить заявку</button><button class="btn quiet" type="button" data-no>Отмена</button>',
  });
  const paint = () => {
    s.querySelector('#rf-other').hidden = pick !== 'other';
    const say = sayOf();
    s.querySelector('#rf-say').textContent = say ? `«Заявка на «${ST.name}» отклонена. ${say}»` : 'Выберите причину — её увидит пара';
  };
  s.querySelector('[role="radiogroup"]').addEventListener('change', (e) => { pick = e.detail; s.querySelector('.pick-msg').hidden = true; paint(); });
  s.querySelector('#rf-text').addEventListener('input', (e) => { other = e.target.value; paint(); });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  s.querySelector('[data-ok]').addEventListener('click', () => {
    if (!pick) { const m = s.querySelector('.pick-msg'); m.textContent = 'Выберите причину — её увидит пара'; m.hidden = false; return; }
    const why = sayOf(); const r = R.find((x) => x.v === pick);
    const wasWaiting = P().waiting.includes(id);
    const h = rowH(id);
    const undo = act(() => decide(id, 'refused', `отклонили заявку пары ${pairTight(id)} на «${ST.name}»: ${r.log || why}`, why));
    closeLayer(true);
    if (wasWaiting) leave(id, 'refused', undo, h); else render();
    toast(`${pname(id)}: заявка отклонена. Пара увидит причину`, { undo });
  });
  paint();
}
// принятая пара: взнос и «Снять пару с турнира»
function pairSheet(id) {
  const paid = P().paid.includes(id);
  const s = openSheet({
    title: pname(id),
    body: `<div class="line">${duoHtml(id)}<span>${esc(levelLine(id).t)}</span></div>
      <label class="toggle"><span class="grow"><b>Взнос оплачен</b><span class="muted">Видят только пара и вы</span></span><input type="checkbox" data-paid${paid ? ' checked' : ''}><span class="sw" aria-hidden="true"></span></label>`,
    foot: '<button class="btn quiet" type="button" data-remove>Снять пару с турнира</button><button class="btn quiet" type="button" data-no>Закрыть</button>',
  });
  s.querySelector('[data-paid]').addEventListener('change', (e) => {
    const on = e.target.checked;
    const undo = setPaid(id, on);
    render();
    toast(on ? `Оплата ${pname(id)} отмечена` : `Отметка оплаты снята: ${pname(id)}`, { undo: () => { closeLayer(true); undo(); } });
  });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  s.querySelector('[data-remove]').addEventListener('click', () => {
    const g = groupOf(id);
    confirmAction({
      title: `Снять ${pname(id)} с турнира?`,
      consq: [`Место освободится: станет ${P().accepted.length - 1} из ${slots()} пар`, 'Пара увидит это в приложении', ...(g ? [`Пара уйдёт из группы ${g}`] : [])],
      action: 'Снять пару с турнира',
      onConfirm: () => {
        const undo = act(() => {
          const u1 = decide(id, 'removed', `сняли пару ${pairTight(id)} с «${gen(ST.name)}»`);
          const u2 = g ? state.update(GK, (v) => ({ ...v, groups: { ...v.groups, [g]: v.groups[g].filter((x) => x !== id) } })) : null;
          return () => { if (u2) u2(); u1(); };
        });
        render();
        toast(`${pname(id)} сняты с турнира · стало ${P().accepted.length} из ${slots()} пар`, { undo });
      },
    });
  });
}
function restore(id) {
  const undo = act(() => decide(id, 'accepted', `вернули пару ${pairTight(id)} в «${ST.name}»`));
  render(); flash(id);
  toast(`${pname(id)} снова в турнире`, { undo });
}
function draw(seed = 7) {
  const acc = P().accepted;
  if (!acc.length) { toast('Пока нет принятых пар — раскладывать некого', { kind: 'bad' }); return; }
  const r = drawGroups(acc, { points, size: 4, seed });
  const undo = act(() => state.set(GK, { state: 'draft', groups: r.groups, seeds: r.seeds, lot: seed, saved: state.now() }, { say: `разложили пары «${gen(ST.name)}» по группам — черновик`, href: href('groups') }));
  render();
  toast(`Разложено: ${pairsWord(acc.length)} по 4 группам. Это черновик — поправьте как нужно`, { undo });
}
function redraw() {
  const g = grp();
  const r = drawGroups(P().accepted, { points, size: 4, seed: (g.lot || 7) + 1 });
  const undo = act(() => state.update(GK, (v) => ({ ...v, groups: r.groups, lot: (v.lot || 7) + 1, saved: state.now() }), { say: `бросили жребий заново: группы «${gen(ST.name)}»`, href: href('groups') }));
  render();
  toast('Жребий брошен заново: сеяные на местах, остальные пары переставлены', { undo });
}
function moveTo(id, g, swapWith = null) {
  const from = groupOf(id);
  const undo = act(() => state.update(GK, (v) => {
    const G = v && v.groups ? JSON.parse(JSON.stringify(v.groups)) : Object.fromEntries(GROUPS.map((x) => [x, []]));
    if (swapWith) {
      const i = G[g].indexOf(swapWith); G[g][i] = id;
      if (from) G[from][G[from].indexOf(id)] = swapWith;
    } else {
      if (from) G[from] = G[from].filter((x) => x !== id);
      G[g].push(id);
    }
    return { ...(v || { state: 'draft', seeds: {}, lot: 7 }), groups: G, saved: state.now() };
  }, { say: swapWith ? `поменяли местами пары ${pairTight(id)} и ${pairTight(swapWith)}: ${pairTight(id)} — в группе ${g}` : `поставили пару ${pairTight(id)} в группу ${g}`, href: href('groups') }));
  closeLayer(true);
  render(); flash(id);
  toast(swapWith ? `${pname(id)} и ${pname(swapWith)} поменялись местами: ${pname(id)} — в группе ${g}` : `${pname(id)} — в группе ${g}`, { undo });
}
function moveSheet(id) {
  const from = groupOf(id); const G = groupsNow();
  const s = openSheet({
    title: 'В какую группу?',
    body: `<div class="line">${duoHtml(id)}<b class="h3">${esc(pname(id))}</b></div><p class="muted">${from ? `Сейчас в группе ${from}` : 'Пока не в группе'}${seedOf(id) ? ` · посев ${seedOf(id)}` : ''}</p>
      <div class="mv-groups">${GROUPS.map((g) => { const n = G ? G[g].length : 0; const here = g === from; return `<button type="button" class="choice" data-g="${g}"${here ? ' aria-current="true"' : ''}><span class="t">Группа ${g}</span><span class="s">${here ? 'пара здесь' : n >= 4 ? 'полная — поменяете местами' : `${pairsWord(n)} · есть место`}</span></button>`; }).join('')}</div>`,
    foot: '<button class="btn quiet" type="button" data-x2>Назад</button>',
  });
  s.querySelector('[data-x2]').addEventListener('click', () => closeLayer());
  s.querySelector('.mv-groups').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const g = b.dataset.g;
    if (g === from) { closeLayer(); return; }
    if (G && G[g].length >= 4) swapSheet(id, g); else moveTo(id, g);
  });
}
function swapSheet(id, g) {
  const G = groupsNow();
  const s = openSheet({
    title: 'С кем поменять местами?',
    body: `<p class="muted">Группа ${g} полная. ${esc(pname(id))} встанет на место выбранной пары, а она — ${groupOf(id) ? `в группу ${groupOf(id)}` : 'в «Не распределены»'}</p><div class="mv-groups">${G[g].map((x) => `<button type="button" class="choice" data-sw="${x}"><span class="t">${esc(pname(x))}</span><span class="s">${seedOf(x) ? `посев ${seedOf(x)}` : 'без посева'}</span></button>`).join('')}</div>`,
    foot: '<button class="btn quiet" type="button" data-x2>Назад</button>',
  });
  s.querySelector('[data-x2]').addEventListener('click', () => moveSheet(id));
  s.querySelector('.mv-groups').addEventListener('click', (e) => { const b = e.target.closest('[data-sw]'); if (b) moveTo(id, g, b.dataset.sw); });
}
// перетаскивание пары в другую группу — только мышь; путь кнопкой «Перенести» есть всегда
function wireDrag() {
  $$('#body button.gslot[data-id]').forEach((it) => drag(it, {
    ghost: () => { const gh = it.cloneNode(true); gh.classList.add('lifted'); gh.style.width = `${it.offsetWidth}px`; return gh; },
    over: (x, y, gh) => {
      $$('.gcard.over').forEach((c) => c.classList.remove('over'));
      const card = document.elementFromPoint(x, y)?.closest('.gcard');
      const tg = document.elementFromPoint(x, y)?.closest('.gslot[data-id]');
      if (!card) return null;
      card.classList.add('over');
      const g = card.dataset.g; const G = groupsNow(); const full = !!G && G[g].length >= 4;
      const sw = full && tg && tg.dataset.id !== it.dataset.id ? tg.dataset.id : null;
      const goEl = gh.querySelector('.go'); if (goEl) goEl.textContent = sw ? `поменять с ${pname(sw)}` : full ? 'группа полная' : `в группу ${g}`;
      return { g, sw, full };
    },
    drop: (t) => {
      $$('.gcard.over').forEach((c) => c.classList.remove('over'));
      const id = it.dataset.id;
      if (t.g === groupOf(id)) return;
      if (t.full && !t.sw) { swapSheet(id, t.g); return; }
      moveTo(id, t.g, t.sw);
    },
    cancel: () => $$('.gcard.over').forEach((c) => c.classList.remove('over')),
  }));
}
function showSheet(kind) {
  const groups = kind === 'groups';
  const again = groups && groupsShown();
  const s = openSheet({
    title: groups ? (again ? 'Показать правки игрокам?' : 'Показать группы игрокам?') : 'Показать сетку игрокам?',
    body: `<p class="lead"><b>${groups ? 'Группы' : 'Сетку'} «${esc(gen(ST.name))}» увидят:</b></p>
      <ul class="where"><li>${icon('phone')}<span><b>игроки</b> — в приложении: «Турнир» → «${groups ? 'Группы' : 'Сетка'}»</span></li><li>${icon('site')}<span><b>сайт</b> — страница турнира → «${groups ? 'Группы' : 'Сетка'}»</span></li></ul>
      ${groups ? `<div class="note warn">${icon('warn')}<span>Запись открыта до ${esc(dm(ST.signupTo))}. Если примете ещё пары, группы изменятся — игроки увидят и это.</span></div>` : ''}
      ${groups && placed().length < 16 ? `<p class="muted">Свободных мест — ${16 - placed().length}: игроки увидят «Пара ещё не известна».</p>` : ''}`,
    foot: `<button class="btn main" type="button" data-ok>${icon('eye')}${groups ? (again ? 'Показать правки игрокам' : 'Показать группы игрокам') : 'Показать сетку игрокам'}</button><button class="btn quiet" type="button" data-no>Отмена</button>`,
  });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  s.querySelector('[data-ok]').addEventListener('click', () => {
    const at = `с ${state.now()}`;
    act(() => {
      if (groups) state.update(GK, (v) => ({ ...v, state: 'shown', shown: v.groups, at }), { say: again ? `показали игрокам правки групп «${gen(ST.name)}»` : `показали игрокам группы «${gen(ST.name)}»`, href: href('groups') });
      else state.set(BK, { state: 'shown', at }, { say: `показали игрокам сетку «${gen(ST.name)}»`, href: href('bracket') });
    });
    closeLayer(true); render();
    doneSheet(groups);
  });
}
// «Готово»: что сделано и где это теперь
function doneSheet(groups) {
  const what = groups ? 'Группы' : 'Сетку';
  const s = openSheet({
    title: 'Готово',
    body: `<div class="done-box"><span class="done-mark">${icon('check')}</span><h3 class="h1">${what} видно игрокам</h3>
      <ul class="where-now"><li>${icon('phone')}<span><b>Приложение</b> — «Турнир» → «${groups ? 'Группы' : 'Сетка'}»</span></li><li>${icon('site')}<span><b>Сайт</b> — страница «${esc(gen(ST.name))}» → «${groups ? 'Группы' : 'Сетка'}»</span></li></ul>
      <p class="muted">Правки игроки увидят после «Показать правки игрокам».</p></div>`,
    foot: groups ? `<button class="btn main" type="button" data-next-step>${icon('cup')}Дальше: собрать сетку</button>` : `<a class="btn main" href="${esc(keepTheme('schedule.html?t=jul-4'))}">${icon('calendar')}Дальше: расписание</a>`,
  });
  const n = s.querySelector('[data-next-step]'); if (n) n.addEventListener('click', () => { closeLayer(true); go('bracket'); });
}
function revertGroups() {
  const undo = act(() => state.update(GK, (v) => ({ ...v, groups: v.shown }), { say: `вернули группы «${gen(ST.name)}», которые видят игроки: правки убраны`, href: href('groups') }));
  render();
  toast('Вернули опубликованное: правки групп убраны', { undo });
}
function build() {
  const undo = act(() => state.set(BK, { state: 'draft', saved: state.now() }, { say: `собрали сетку «${gen(ST.name)}» — черновик`, href: href('bracket') }));
  render();
  toast('Сетка собрана из мест в группах. Это черновик — игроки её не видят', { undo });
}

document.addEventListener('click', (e) => {
  const st = e.target.closest('[data-step]');
  if (st && !st.closest('.sheet, .pop')) { go(st.dataset.step); return; }
  const a = e.target.closest('[data-act]');
  if (a && !a.closest('.sheet')) {
    const id = a.dataset.id;
    ({
      accept: () => accept(id), reserve: () => toReserve(id), council: () => toCouncil(id), unwait: () => unwait(id), pay: () => pay(id), 'undo-leave': () => undoLeave(id),
      refuse: () => refuseSheet(id), pair: () => pairSheet(id), restore: () => restore(id),
      draw: () => draw(), redraw: () => redraw(), 'revert-groups': () => revertGroups(), 'show-groups': () => showSheet('groups'), build: () => build(), 'show-bracket': () => showSheet('bracket'),
    }[a.dataset.act] || (() => {}))();
    return;
  }
  const sl = e.target.closest('#body button.gslot[data-id]');
  if (sl && !LIVE) moveSheet(sl.dataset.id);
});
// «Решает Совет: …» → к строке пары, фокус на её первую кнопку
document.addEventListener('click', (e) => {
  const l = e.target.closest('.qline a[href^="#a-"]'); if (!l) return;
  e.preventDefault();
  const row = document.getElementById(l.getAttribute('href').slice(1));
  if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); const b = row.querySelector('.btn'); if (b) b.focus({ preventScroll: true }); row.classList.add('just'); }
});

render();
