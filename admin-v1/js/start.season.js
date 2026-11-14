// ============================================================
// «Календарь сезона»: сезон, месяц или список, создать турнир с нужного дня,
// перенести турнир — кнопкой (выбор дат в шторке) или перетаскиванием пилюли.
// Основа — seasonCalendar из admin.js; здесь — полоса сезона крупными кнопками,
// карточка турнира с «Перенести», перенос с сохранённой длиной и что после него меняется.
// Перенос — в общем состоянии (cups.<турнир>) со строкой журнала; календарь
// перерисовывается, когда турниры или заявки пар меняются здесь или в другой вкладке.
// ============================================================
import {
  D, state, seasonCalendar, popover, closePop, drag, openSheet, closeLayer, datePicker, toast, stateWords, esc, icon,
  rangeShort, dayWords, cap1, plural, addDays, daysBetween, instr, isPhone, keepTheme, el, MON, MON_GEN, fixLinks,
} from '../admin.js';
import { $, $$, seasonStages, moveStage, getCup, putCup, playPattern, pairsWord, isNewId, rangeLine, plainRange, seasonHref, stepState, stageNoFor, stagesShift, shiftWords } from './start.js';

const TODAY = D.NOW.iso;
const q = new URLSearchParams(location.search);
let STAGES = seasonStages();
let root = $('#cal');
let cal = null;
let month = q.get('m') || TODAY.slice(0, 7);
let suppress = 0; // клик сразу после перетаскивания не открывает карточку

const byId = (id) => STAGES.find((s) => s.id === id);
const byName = (name) => STAGES.find((s) => s.name === name);
// турнир из мастера: черновик «Августовского кубка» мира и созданные заново
const isCup = (s) => s.id === 'aug-5' || isNewId(s.id);
// страница турнира есть у идущего и следующего этапов мира и у опубликованного турнира из мастера;
// прошедшие — их месяц в календаре
const PAGES = ['jun-3', 'jul-4'];
const hasPage = (s) => PAGES.includes(s.id) || (isCup(s) && s.state === 'open');
const canOpen = (s) => s.state === 'draft' || hasPage(s);
const openHref = (s) => (s.state === 'draft' ? `new-tournament.html?draft=${s.id}` : hasPage(s) ? `tournament.html?t=${s.id}` : `season.html?m=${s.from.slice(0, 7)}`);
const createHref = (iso) => `new-tournament.html?from=${iso}`;
// переносить можно то, что ещё не началось: черновик и турнир с открытой записью
const movable = (s) => (s.state === 'draft' || s.state === 'open') && s.from > TODAY;
const isStage = (s) => s.kind !== 'separate' && s.kind !== 'final';
const pad = (n) => String(n).padStart(2, '0');
const dim = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
const WIDE = matchMedia('(min-width: 1280px)');

// ---------- календарь ----------
let shown = ''; // что сейчас нарисовано: календарь перерисовывается, только если турниры правда поменялись
let dragging = false;
function mount(m) {
  if (m) month = m;
  STAGES = seasonStages();
  shown = JSON.stringify(STAGES);
  const fresh = root.cloneNode(false);
  root.replaceWith(fresh);
  root = fresh;
  cal = seasonCalendar(root, { stages: STAGES, month, openHref, createHref, onMonth: (ym) => { month = ym; } });
  enhance();
  new MutationObserver(enhance).observe(root, { childList: true });
  return cal;
}

// ---------- полоса сезона: этап — одна кнопка 56 px на всю ширину своего месяца ----------
// Заливка — цвет покрытия, внутри белым название и «даты · состояние»; прошедшие — приглушённо
// с тёмной подписью; черновик — пунктиром. «Сегодня» — тёмная линия с ярлыком цвета мяча.
function seasonBar() {
  const year = +TODAY.slice(0, 4);
  const pub = STAGES.filter((s) => s.state !== 'draft' && isStage(s));
  const cur = pub.find((s) => s.from <= TODAY && s.to >= TODAY);
  const curNo = cur ? cur.no : pub.filter((s) => s.to < TODAY).length;
  const firstM = STAGES.map((s) => s.from.slice(0, 7)).sort()[0];
  const lastM = STAGES.map((s) => s.from.slice(0, 7)).sort().pop();
  const months = []; for (let ym = firstM; ym <= lastM;) { months.push(ym); const y = +ym.slice(0, 4); const mm = +ym.slice(5, 7) + 1; ym = mm > 12 ? `${y + 1}-01` : `${y}-${pad(mm)}`; }
  const btn = (s) => {
    const w = stateWords(s);
    const st = w.low;
    const cls = ['ssn-st', s.surface && s.state !== 'draft' ? 'srf-fill' : '', s.to < TODAY ? 'past' : '', s.state === 'draft' ? 'draft' : '', s.state === 'live' ? 'live' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" data-srf="${s.surface || ''}" data-sid="${s.id}" aria-label="${esc(s.name)}, ${esc(rangeShort(s.from, s.to))}, ${esc(st)}"><b>${esc(s.name)}</b><span>${esc(rangeShort(s.from, s.to))} · ${esc(st)}</span></button>`;
  };
  const node = el(`<section class="ssn-bar card" aria-label="Сезон ${year}, этап ${curNo} из ${pub.length}">
      <ol class="ssn-bar-m" style="grid-template-columns:repeat(${months.length},minmax(0,1fr))">${months.map((ym) => {
    const list = STAGES.filter((s) => s.from.slice(0, 7) === ym).sort((a, b) => (a.from < b.from ? -1 : 1));
    const on = ym === month && !root.querySelector('.slist'); // месяц, который показан ниже
    return `<li data-m="${ym}"${on ? ' class="on"' : ''}><span class="mn">${esc(cap1(MON[+ym.slice(5, 7) - 1]))}</span>${list.length ? list.map(btn).join('') : `<button type="button" class="ssn-st none" data-m="${ym}">Турниров нет</button>`}</li>`;
  }).join('')}</ol>
    </section>`);
  // «Сегодня»: линия 2 px от ярлыка до кнопки месяца
  const tm = TODAY.slice(0, 7);
  const col = $(`li[data-m="${tm}"]`, node);
  if (col) {
    const x = ((+TODAY.slice(8) - 0.5) / dim(tm)) * 100;
    const full = `Сегодня, ${+TODAY.slice(8)} ${MON_GEN[+tm.slice(5) - 1]}`;
    col.insertAdjacentHTML('beforeend', `<span class="ssn-today" style="left:${x}%" aria-hidden="true"><span class="lab">${full}</span></span>`);
    // Ярлык не наезжает ни на своё название месяца, ни на соседнее: рядом с «Июнь» — целиком
    // или коротко; не помещается и коротко (узкий экран, крупный текст) — строкой выше месяцев.
    const fit = () => {
      const t = $('.ssn-today', node); if (!t) return;
      const lab = $('.lab', t); const mn = $('.mn', col);
      node.classList.remove('ssn-up');
      lab.textContent = full;
      const cw = col.clientWidth; const lx = t.offsetLeft; const gap = mn.offsetWidth + 10;
      let w = lab.offsetWidth;
      if (w > cw - gap) { lab.textContent = 'Сегодня'; w = lab.offsetWidth; }
      if (w > cw - gap) {
        node.classList.add('ssn-up');
        lab.textContent = full; w = lab.offsetWidth;
        // строкой выше — над линией, но не за краем полосы
        const ol = $('.ssn-bar-m', node); const colX = col.offsetLeft;
        const left = Math.max(-colX, Math.min(ol.clientWidth - colX - w, lx - w / 2));
        lab.style.left = `${left - lx}px`;
        return;
      }
      const left = Math.max(gap, Math.min(cw - w, lx - w / 2));
      lab.style.left = `${left - lx}px`;
    };
    requestAnimationFrame(fit);
    new ResizeObserver(fit).observe(node);
  }
  // Название и даты на кнопке не обрезаются: сначала уже шрифт, потом перенос строки,
  // и только если одно слово длиннее кнопки («Августовский» при крупном тексте) — на 2 px мельче.
  const fitBtns = () => $$('.ssn-st b, .ssn-st span', node).forEach((x) => {
    x.style.fontStretch = ''; x.style.whiteSpace = ''; x.style.fontSize = '';
    const over = () => x.scrollWidth > x.clientWidth + 1;
    if (over()) x.style.fontStretch = '87.5%';
    if (over()) x.style.fontStretch = '75%';
    if (over()) x.style.whiteSpace = 'normal';
    for (let fs = parseFloat(getComputedStyle(x).fontSize); over() && fs - 2 >= 16; fs -= 2) x.style.fontSize = `${fs - 2}px`;
  });
  requestAnimationFrame(fitBtns);
  new ResizeObserver(fitBtns).observe(node);
  return node;
}
// нажали этап на полосе: месяц внизу переходит к нему, и открывается карточка турнира
function onBar(e) {
  const b = e.target.closest('.ssn-st'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (b.dataset.m) { month = b.dataset.m; cal.setMonth(month); enhance(); return; }
  const s = byId(b.dataset.sid); if (!s) return;
  const ym = s.from.slice(0, 7);
  if (ym !== month) { month = ym; cal.setMonth(ym); enhance(); }
  const again = $(`.ssn-bar .ssn-st[data-sid="${s.id}"]`, root) || b;
  stageCard(again, s);
}

// После каждой отрисовки основы: полоса сезона — своя, пилюли узнают свой турнир,
// у переносимых — перетаскивание, в списке — «Перенести» рядом с «Открыть».
function enhance() {
  // «Месяц · Список» — в шапке рядом с заголовком: месяц целиком помещается в экран.
  // Уже 1280 шапке тесно — переключатель остаётся над месяцем, шапка в одну строку.
  const sw = root.querySelector(':scope > .line');
  if (sw && WIDE.matches) $('#ssn-view').replaceChildren(sw);
  else if (!WIDE.matches) $('#ssn-view').replaceChildren();
  const sbar = root.querySelector(':scope > .sbar');
  if (sbar) { const bar = seasonBar(); sbar.replaceWith(bar); bar.addEventListener('click', onBar); fixLinks(bar); }
  $$('.sm-t', root).forEach((b) => {
    if (b.dataset.sid) return;
    const s = byName((b.getAttribute('aria-label') || '').split(',')[0]);
    if (!s) return;
    b.dataset.sid = s.id;
    if (movable(s)) { b.classList.add('ssn-can'); dragPill(b, s); }
    nameEachWeek(b, s);
  });
  // подпись цветов: тонкая линия — дни турнира без игр
  const leg = $('.sm-foot .legend', root);
  if (leg && !$('.ssn-thin', leg)) leg.insertAdjacentHTML('beforeend', '<span class="ssn-thin"><i aria-hidden="true"></i>тонкая линия — дни без игр</span>');
  $$('div.st-row', root).forEach((row) => {
    if (row.dataset.sid) return;
    const s = byName($('.nm', row)?.textContent || '');
    if (!s) return;
    row.dataset.sid = s.id;
    const open = $('a.btn', row);
    if (!canOpen(s) && open) { open.remove(); }
    if (!movable(s)) return;
    const wrap = el('<div class="ssn-row-acts"></div>');
    const mv = el(`<button class="btn quiet" type="button" data-move="${s.id}">${icon('calendar')}Перенести</button>`);
    if (open && open.isConnected) { open.replaceWith(wrap); wrap.append(open, mv); } else { row.append(wrap); wrap.append(mv); }
  });
  // телефон: в строке списка — короткий ярлык, полная фраза — на странице турнира;
  // под строкой турнира, который ещё не начался, — «Перенести на другие даты» (та же шторка, что на ноутбуке)
  if (isPhone()) {
    $$('a.st-row', root).forEach((row) => {
      const tag = $('.tag', row); if (!tag || tag.dataset.short) return;
      tag.dataset.short = '1';
      const s = byName($('.nm', row)?.textContent || '');
      if (!s) return;
      if (s.state === 'open') tag.textContent = `Запись до ${rangeShort(s.signupTo).replace(/⁠/g, '')}`;
      if (s.state === 'draft') tag.textContent = 'Черновик';
      if (movable(s) && !(row.nextElementSibling && row.nextElementSibling.matches('.ssn-mv'))) {
        row.insertAdjacentElement('afterend', el(`<div class="ssn-mv"><button class="btn quiet" type="button" data-move="${s.id}">${icon('calendar')}Перенести «${esc(s.name)}» на другие даты</button></div>`));
      }
    });
  }
}
// Название — и в начале недели, где есть игровые дни: 14 июня — тоже «Июньский кубок».
function nameEachWeek(btn, s) {
  const lab = $('.lab', btn); if (!lab) return;
  const ps = $$('.p', btn); const n = ps.length; if (!n) return;
  if (ps[0].classList.contains('thin') || parseFloat(lab.style.left) === 0) return;
  let run = 0; while (run < n && !ps[run].classList.contains('thin')) run += 1;
  btn.insertAdjacentHTML('beforeend', `<span class="lab ssn-lab2" style="left:0%;width:${(run / n) * 100}%"><b>${esc(s.name)}</b></span>`);
  requestAnimationFrame(() => fitName($('.ssn-lab2', btn)));
}
// Кусок короткий (один день, 1024, крупный текст): название не режется — сначала уже шрифт,
// потом две строки («Июньский / кубок»), потом на 2 px мельче. Не встаёт и так — не пишется:
// тонкая линия ведёт к пилюле с названием в той же неделе.
function fitName(l2) {
  if (!l2 || !l2.isConnected) return;
  const pill = l2.closest('.sm-t');
  const two = (on) => { l2.classList.toggle('two', on); pill.classList.toggle('ssn-tall', on); };
  l2.hidden = false; two(false); l2.style.fontStretch = ''; l2.style.fontSize = '';
  const over = () => l2.scrollWidth > l2.clientWidth + 1 || l2.scrollHeight > l2.clientHeight + 1;
  if (over()) l2.style.fontStretch = '87.5%';
  if (over()) l2.style.fontStretch = '75%';
  // две строки — пилюля этой недели чуть выше, чтобы строкам было просторно
  if (over()) { two(true); l2.style.fontStretch = '87.5%'; }
  if (over()) l2.style.fontStretch = '75%';
  if (over()) l2.style.fontSize = `${Math.max(16, parseFloat(getComputedStyle(l2).fontSize) - 2)}px`;
  if (over()) { two(false); l2.hidden = true; }
}
let refitT = null;
addEventListener('resize', () => { clearTimeout(refitT); refitT = setTimeout(() => $$('.ssn-lab2', root).forEach(fitName), 150); });

// ---------- карточка турнира ----------
function stageCard(anchor, s) {
  const w = stateWords(s);
  const clash = STAGES.filter((t) => t !== s && t.from <= s.to && t.to >= s.from);
  const pairs = s.state === 'open' ? `${s.pairs} из ${s.slots} пар` : s.state === 'draft' ? `Сохранён ${s.savedAt || ''}` : s.pairs ? pairsWord(s.pairs) : '';
  const why = s.state === 'live' ? 'Турнир идёт: целиком его не переносят. Матчи двигают в расписании дня' : '';
  const p = popover(anchor, `<p>${esc(cap1(dayWords(s.from)))} — ${esc(dayWords(s.to))}</p>
      <div class="line"><span class="tag ${w.tag}">${esc(w.label)}</span></div>
      ${pairs ? `<p class="muted">${esc(pairs)}</p>` : ''}
      ${clash.map((t) => `<p class="strong" style="color:var(--bad-ink)">Пересекается с «${esc(instr(t.name))}» (${esc(rangeShort(t.from, t.to))})</p>`).join('')}
      ${why ? `<p class="muted">${esc(why)}</p>` : ''}
      ${canOpen(s) || movable(s) ? `<div class="ssn-pop-acts">
        ${canOpen(s) ? `<a class="btn quiet wide" href="${esc(keepTheme(openHref(s)))}">${s.state === 'draft' ? 'Продолжить черновик' : 'Открыть турнир'}${icon('arrow')}</a>` : ''}
        ${movable(s) ? `<button class="btn quiet wide" type="button" data-move="${s.id}">${icon('calendar')}Перенести на другие даты</button>` : ''}
      </div>` : ''}`, { title: s.name });
  // карточка выросла от второй кнопки — не уходит за низ окна
  const r = p.getBoundingClientRect();
  if (r.bottom > innerHeight - 12) p.style.top = `${Math.max(scrollY + 12, scrollY + innerHeight - r.height - 12)}px`;
}

document.addEventListener('click', (e) => {
  const mv = e.target.closest('[data-move]');
  if (mv) { const s = byId(mv.dataset.move); closePop(); if (s) moveSheet(s); return; }
  const t = e.target.closest('#cal .sm-t, #cal .sm-day[data-iso]');
  if (!t) return;
  if (Date.now() < suppress) { e.stopPropagation(); e.preventDefault(); return; }
  let s = t.dataset.sid ? byId(t.dataset.sid) : null;
  if (!s && t.matches('.sm-day')) s = STAGES.find((x) => x.from <= t.dataset.iso && x.to >= t.dataset.iso) || null;
  if (!s) return; // пустой день — карточка «Создать турнир с этого дня» из основы
  e.stopPropagation();
  stageCard(t, s);
}, true);

// ---------- перенос: что изменится ----------
function shiftPlay(s, from, to) {
  if (!s.play || !s.play.length) return [];
  const n = daysBetween(from, to) + 1;
  if (n === daysBetween(s.from, s.to) + 1) return s.play.map((d) => addDays(from, daysBetween(s.from, d)));
  return playPattern(from, to);
}
// Что изменится и где — одним списком. Номер этапа — тот, что будет на новых датах;
// встанет раньше другого этапа — сказано, чей номер сдвинется.
// Срок записи этапа мира перенос не меняет: если новое начало не позже конца записи — это ошибка словами.
// У турнира из мастера срок записи — отдельным блоком окна (signBlock).
function consequences(s, from) {
  if (s.state === 'draft') return [{ t: 'Это черновик — его видите только вы. Игроки ничего не заметят' }];
  const out = [];
  const stage = s.kind !== 'separate' && s.kind !== 'final';
  const no = stage ? stageNoFor({ id: s.id, from: from || s.from }) : null;
  const where = stage ? `в приложении («Турниры», этап ${no}) и на сайте` : 'на сайте';
  if (s.pairs) out.push({ t: `${pairsWord(s.pairs)} с заявками ${plural(s.pairs, 'увидит', 'увидят', 'увидят')} новые даты — ${where}` });
  else out.push({ t: `Новые даты появятся ${where}` });
  const shift = stage && from ? stagesShift({ id: s.id, from, kind: s.kind }) : [];
  if (shift.length) out.push({ t: `${shiftWords(shift)}: этапы в приложении идут по датам` });
  out.push({ t: 'Расписание игровых дней нужно будет проверить' });
  if (!isCup(s) && s.signupTo) {
    if (from && s.signupTo >= from) out.push({ t: `Запись идёт до ${rangeShort(s.signupTo)}: турнир может начаться не раньше ${rangeShort(addDays(s.signupTo, 1))}`, bad: true });
    else out.push({ t: `Запись — до ${rangeShort(s.signupTo)}${s.draw ? `, жеребьёвка — ${rangeShort(s.draw)}` : ''}: сроки не меняются` });
  }
  return out;
}
// Перенести: черновик и созданное в мастере — правка самого турнира; этап мира — новые дни поверх.
// sign — срок записи и жеребьёвки из окна переноса; без него они сдвигаются вместе с датами.
// Отложенные правки опубликованного турнира (edit) сдвигаются на столько же дней.
// Строка журнала — вместе с переносом: «Отменить» убирает и то и другое.
function applyMove(s, from, to, sign) {
  const sw = sign ? `; запись до ${plainRange(sign.signupTo)}${sign.draw ? `, жеребьёвка ${plainRange(sign.draw)}` : ''}` : '';
  const opts = { say: `перенесли ${s.state === 'draft' ? 'черновик ' : ''}«${s.name}» на ${plainRange(from, to)}${sw}`, href: isCup(s) && s.state === 'open' ? `tournament.html?t=${s.id}` : seasonHref(from) };
  if (isCup(s)) {
    const c = getCup(s.id);
    const was = { from: c.from, signupTo: c.signupTo, draw: c.draw };
    const delta = daysBetween(c.from, from);
    c.play = (c.play || []).length ? shiftPlay({ ...s, play: c.play }, from, to) : [];
    c.from = from; c.to = to;
    if (c.signupTo) c.signupTo = addDays(c.signupTo, delta);
    if (c.draw) c.draw = addDays(c.draw, delta);
    if (sign) { c.signupTo = sign.signupTo; c.draw = sign.draw; }
    if (c.daySet) c.daySet = null;
    if (c.edit) {
      const e = c.edit; const sameSign = e.signupTo === was.signupTo && e.draw === was.draw;
      if (e.from) e.from = addDays(e.from, delta);
      if (e.to) e.to = addDays(e.to, delta);
      e.play = (e.play || []).map((d) => addDays(d, delta)); e.daySet = null;
      if (sameSign) { e.signupTo = c.signupTo; e.draw = c.draw; } else { if (e.signupTo) e.signupTo = addDays(e.signupTo, delta); if (e.draw) e.draw = addDays(e.draw, delta); }
    }
    return putCup(c, opts);
  }
  // этап мира: новые дни поверх; черновые дни расписания (days.<этап>.<день>) и судьи по дням
  // (judgeDays.<этап>.<корт>.<день>) переезжают на те же по счёту игровые дни — одним делом
  const play = shiftPlay(s, from, to);
  const old = s.play || [];
  const day = (d) => { const i = old.indexOf(d); return i >= 0 && play[i] ? play[i] : d; };
  const remap = (o) => Object.fromEntries(Object.entries(o).map(([d, v]) => [day(d), v]));
  const changes = { [`cups.${s.id}`]: { id: s.id, from, to, play, moved: true } };
  // черновые дни — и сделанные в разделе, и дни мира (D.daysNow): после переноса они лежат на новых датах
  const days = D.daysNow(s.id);
  if (days && Object.keys(days).length) changes[`days.${s.id}`] = remap(days);
  const jd = state.get(`judgeDays.${s.id}`);
  if (jd && Object.keys(jd).length) changes[`judgeDays.${s.id}`] = Object.fromEntries(Object.entries(jd).map(([c, o]) => [c, remap(o || {})]));
  return state.setMany(changes, opts);
}
function doMove(s, from, to, sign) {
  const was = month;
  const undo = applyMove(s, from, to, sign);
  mount(from.slice(0, 7));
  // перенесённый турнир — отмечен; полоса «Готово» не закрывает ни его, ни красную строку
  // «Пересекается с …» под ним (основа прокрутит или встанет наверх)
  const moved = [...$$(`.sm-t[data-sid="${s.id}"]`, root), ...$$('.st-row', root).filter((r) => ($('.nm', r)?.textContent || '') === s.name)];
  moved.forEach((x) => x.classList.add('just'));
  const keep = moved.map((x) => x.closest('.sm-tw') || x);
  const word = s.state === 'draft' ? 'Черновик перенесён' : 'Турнир перенесён';
  const sw = sign ? `. Запись до ${rangeShort(sign.signupTo)}` : '';
  toast(`${word}: «${s.name}» — ${rangeShort(from, to)}${sw}${s.state === 'open' ? '. Игроки видят новые даты' : ''}`, { near: keep, undo: () => { undo(); mount(was); } });
}

// ---------- срок записи при переносе (турнир из мастера) ----------
// По умолчанию запись и жеребьёвка сдвигаются вместе с датами — окно говорит это словами:
// «Запись продлится до 12 июля, жеребьёвка — 14 июля». Можно оставить прежний срок
// («Оставить до 5 июля») или выбрать свой — на день раньше или позже, прямо в окне.
function signBlock(s, sheet, getPick) {
  const c = isCup(s) ? getCup(s.id) : null;
  const box = $('.ssn-sign', sheet);
  if (!c || !c.signupTo || !box) return null;
  const sg = { mode: 'shift', own: null };
  const rs = (iso) => (iso ? rangeShort(iso) : 'не выбрана');
  box.innerHTML = `<p class="ssn-sign-line strong" aria-live="polite"></p>
    <p class="ssn-sign-err" role="alert" hidden></p>
    <div class="btns ssn-sign-btns">
      <button class="btn quiet" type="button" data-sign="keep"></button>
      <button class="btn quiet" type="button" data-sign="shift">${icon('calendar')}Сдвинуть вместе с датами</button>
      <button class="btn quiet" type="button" data-sign="own">${icon('edit')}Другой срок</button>
    </div>
    <div class="ssn-sign-own" hidden>
      ${[['signupTo', 'Запись до'], ['draw', 'Жеребьёвка']].map(([f, t]) => `<div class="ssn-step"><span class="who">${t}</span><button class="btn quiet step" type="button" data-f="${f}" data-d="-1" aria-label="${t} — на день раньше">−</button><span class="v num" data-v="${f}"></span><button class="btn quiet step" type="button" data-f="${f}" data-d="1" aria-label="${t} — на день позже">+</button></div>`).join('')}
    </div>`;
  const dates = () => { const p = getPick(); return p && p.from && p.to ? p : { from: s.from, to: s.to }; };
  const keepV = { signupTo: c.signupTo, draw: c.draw };
  const shiftV = (from) => { const d = daysBetween(s.from, from); return { signupTo: addDays(c.signupTo, d), draw: c.draw ? addDays(c.draw, d) : null }; };
  const value = () => { const { from } = dates(); return sg.mode === 'keep' ? { ...keepV } : sg.mode === 'own' && sg.own ? { ...sg.own } : shiftV(from); };
  const errOf = (v) => { const { from, to } = dates(); const st = stepState({ ...c, from, to, signupTo: v.signupTo, draw: v.draw }, 'signup'); return st.st === 'missing' ? st.t : ''; };
  const paint = () => {
    const v = value(); const err = errOf(v);
    const moved = dates().from !== s.from;
    let line;
    if (v.signupTo === c.signupTo && v.draw === c.draw) line = `Запись — до ${rs(v.signupTo)}, жеребьёвка — ${rs(v.draw)}${moved ? ', как сейчас' : ''}`;
    else if (v.signupTo > c.signupTo) line = `Запись продлится до ${rs(v.signupTo)}, жеребьёвка — ${rs(v.draw)}`;
    else line = `Запись закончится раньше: до ${rs(v.signupTo)}, жеребьёвка — ${rs(v.draw)}`;
    $('.ssn-sign-line', box).textContent = line;
    const e = $('.ssn-sign-err', box); e.hidden = !err; e.textContent = err;
    box.classList.toggle('bad', !!err);
    const keep = $('[data-sign="keep"]', box);
    keep.textContent = `Оставить до ${rangeShort(c.signupTo).replace(/⁠/g, '')}`;
    keep.hidden = !moved || (v.signupTo === c.signupTo && v.draw === c.draw) || !!errOf(keepV);
    const sv = shiftV(dates().from);
    $('[data-sign="shift"]', box).hidden = !moved || (v.signupTo === sv.signupTo && v.draw === sv.draw);
    const own = $('.ssn-sign-own', box);
    $('[data-sign="own"]', box).hidden = !own.hidden;
    $$('[data-v]', box).forEach((x) => { x.textContent = rs(v[x.dataset.v]); });
  };
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sign]');
    if (b) {
      const k = b.dataset.sign;
      if (k === 'own') { sg.own = value(); sg.mode = 'own'; $('.ssn-sign-own', box).hidden = false; paint(); $('.ssn-step .step', box).focus(); return; }
      sg.mode = k; sg.own = null; $('.ssn-sign-own', box).hidden = true;
      paint(); return;
    }
    const st = e.target.closest('[data-f]'); if (!st) return;
    const v = value();
    if (!v[st.dataset.f]) v[st.dataset.f] = st.dataset.f === 'draw' ? addDays(v.signupTo, 2) : addDays(dates().from, -1);
    v[st.dataset.f] = addDays(v[st.dataset.f], +st.dataset.d);
    sg.mode = 'own'; sg.own = v;
    paint();
  });
  paint();
  return { paint, value, error: () => errOf(value()) };
}

// Шторка «Перенести»: длина турнира сохраняется — одно нажатие на новый первый день даёт все даты.
// Нынешние дни обведены и подписаны «сейчас здесь»; «На неделю раньше» и «На неделю позже» — кнопками.
function moveSheet(s, preset) {
  const len = daysBetween(s.from, s.to);
  const n = len + 1;
  let pick = preset || null;
  const others = STAGES.filter((t) => t.id !== s.id);
  const sheet = openSheet({
    title: `Перенести «${s.name}»`,
    body: `<div class="ssn-now"><p class="lead">Сейчас: <b>${esc(rangeShort(s.from, s.to))} · ${n} ${plural(n, 'день', 'дня', 'дней')}</b></p>
        <div class="btns"><button class="btn quiet" type="button" data-week="-7">${icon('back')}На неделю раньше</button><button class="btn quiet" type="button" data-week="7">На неделю позже${icon('chev')}</button></div></div>
      ${isCup(s) && (getCup(s.id) || {}).signupTo ? '<section class="ssn-sign" aria-label="Запись и жеребьёвка"></section>' : ''}
      <div class="ssn-dp"></div>`,
    // что изменится — в нижней полосе, над кнопкой: видно сразу, без прокрутки окна под календари
    foot: `<p class="ssn-sum strong" aria-live="polite"></p><ul class="ssn-cq" aria-label="Что изменится"></ul><button class="btn main" type="button" data-ok>Перенести турнир</button><button class="btn quiet" type="button" data-no>Отмена</button>`,
  });
  sheet.classList.add('ssn-sheet');
  const ok = $('[data-ok]', sheet); const sum = $('.ssn-sum', sheet); const cq = $('.ssn-cq', sheet);
  // на телефоне нижняя полоса и так высокая (две кнопки во всю ширину): «что изменится» — над календарём,
  // сразу под «На неделю раньше / позже»
  if (isPhone()) $('.ssn-dp', sheet).before(cq);
  const word = s.state === 'draft' ? 'Перенести черновик' : 'Перенести турнир';
  let sb = null; // срок записи — у турнира из мастера
  const paint = (r) => {
    pick = r && r.from && r.to ? r : null;
    sum.textContent = r && r.from && r.to ? `Новые даты: ${r.clash ? r.words : rangeLine(r.from, r.to)}` : r && r.error ? r.words : `Нажмите новый первый день — ${n === 1 ? 'один день' : `все ${n} ${plural(n, 'день', 'дня', 'дней')}`} встанут сами`;
    sum.classList.toggle('bad', !!(r && (r.clash || r.error)));
    ok.textContent = pick ? `${word} на ${rangeShort(pick.from, pick.to)}` : word;
    cq.innerHTML = consequences(s, pick && pick.from).map((c) => `<li class="${c.bad ? 'bad' : ''}">${icon(c.bad ? 'alert' : 'info')}<span>${esc(c.t)}</span></li>`).join('');
    if (sb) sb.paint();
  };
  const box = $('.ssn-dp', sheet);
  // окно открывается так, чтобы были видны и нынешние, и новые даты
  const startM = (preset && preset.from < s.from ? preset.from : s.from).slice(0, 7);
  const dp = datePicker(box, {
    id: 'mv', bare: true, month: startM, from: preset ? preset.from : null, to: preset ? preset.to : null,
    self: s.id, others, onChange: paint,
  });
  // «Раньше» и «Позже» — в строке названий месяцев, подсказка календаря — в строке итога
  const months = $('.dp-months', box); const nav = $('.dp-nav', box);
  const wrap = el('<div class="ntc-cal"></div>'); nav.before(wrap); wrap.append(nav, months);
  const msg = $('.dp-msg', box);
  new MutationObserver(() => { if (msg.textContent) { sum.textContent = msg.textContent; sum.classList.toggle('bad', msg.classList.contains('bad')); } }).observe(msg, { childList: true, characterData: true, subtree: true });
  // нынешние дни турнира — рамкой и словами «сейчас здесь» (слова — один раз в месяце, под самым длинным куском)
  const markHere = () => {
    $$('.dp-day[data-iso]', months).forEach((c) => {
      const d = c.dataset.iso; const on = d >= s.from && d <= s.to;
      c.classList.toggle('ssn-cur', on);
      c.classList.toggle('ssn-cur-a', on && (d === s.from || c.style.gridColumn.startsWith('1')));
      c.classList.toggle('ssn-cur-b', on && (d === s.to || c.style.gridColumn.startsWith('7')));
      if (on && !$('.ssn-box', c)) c.insertAdjacentHTML('afterbegin', '<i class="ssn-box" aria-hidden="true"></i>');
      const lbl = c.getAttribute('aria-label') || '';
      if (on && !/сейчас здесь/.test(lbl)) c.setAttribute('aria-label', `${lbl.replace(/, свободная суббота$/, '')}, сейчас здесь`);
    });
    $$('.dp-month', months).forEach((mo) => {
      if ($('.ssn-here', mo)) return;
      const parts = $$('.dp-week', mo).map((wk) => {
        const days = $$('.dp-day[data-iso]', wk).map((c) => c.dataset.iso).filter((d) => d >= s.from && d <= s.to);
        if (!days.length) return null;
        const col = (d) => parseInt($(`.dp-day[data-iso="${d}"]`, wk).style.gridColumn, 10);
        return { wk, a: col(days[0]), b: col(days[days.length - 1]) };
      }).filter(Boolean);
      if (!parts.length) return;
      const best = parts.reduce((x, y) => (y.b - y.a > x.b - x.a ? y : x));
      parts.forEach((p) => p.wk.insertAdjacentHTML('beforeend', `<span class="dp-band ssn-here${p === best ? '' : ' ntc-mini'}" style="grid-column:${p.a} / ${p.b + 1}" aria-hidden="true">${p === best ? 'сейчас здесь' : ''}</span>`));
    });
    // название другого турнира — тоже один раз в месяце
    const span = (b) => { const m = /(\d+)\s*\/\s*(\d+)/.exec(b.style.gridColumn); return m ? +m[2] - +m[1] : 0; };
    $$('.dp-month', months).forEach((mo) => {
      const by = {};
      $$('.dp-band:not(.ssn-here)', mo).forEach((b) => { if (!b.dataset.name) b.dataset.name = b.textContent; (by[b.dataset.name] = by[b.dataset.name] || []).push(b); });
      Object.values(by).forEach((list) => {
        if (list.length < 2) return;
        const top = list.reduce((a, b) => (span(b) > span(a) ? b : a));
        list.forEach((b) => { b.classList.toggle('ntc-mini', b !== top); b.textContent = b === top ? b.dataset.name : ''; });
      });
    });
  };
  markHere();
  new MutationObserver(markHere).observe(months, { childList: true });
  // одно нажатие — новый первый день; длина та же. Наведение показывает, куда встанет турнир.
  const hov = (d) => $$('.dp-day[data-iso]', months).forEach((c) => c.classList.toggle('ssn-hov', !!d && c.dataset.iso >= d && c.dataset.iso <= addDays(d, len)));
  box.addEventListener('click', (e) => {
    const c = e.target.closest('.dp-day[data-iso]'); if (!c) return;
    e.stopPropagation();
    const d = c.dataset.iso;
    if (d <= TODAY) { dp.say('Прошедшие дни выбрать нельзя', true); sum.textContent = 'Прошедшие дни выбрать нельзя'; sum.classList.add('bad'); return; }
    hov(null);
    dp.set(d, addDays(d, len));
  }, true);
  months.addEventListener('pointerover', (e) => { const c = e.target.closest('.dp-day[data-iso]'); hov(c && c.dataset.iso > TODAY ? c.dataset.iso : null); });
  months.addEventListener('pointerleave', () => hov(null));
  $$('[data-week]', sheet).forEach((b) => b.addEventListener('click', () => {
    const base = pick ? pick.from : s.from;
    let from = addDays(base, +b.dataset.week);
    if (from <= TODAY) { sum.textContent = `Раньше нельзя: ${rangeShort(from)} уже прошло`; sum.classList.add('bad'); return; }
    if (from === s.from) from = addDays(from, +b.dataset.week);
    if (from <= TODAY) { sum.textContent = 'Раньше нельзя: эти дни уже прошли'; sum.classList.add('bad'); return; }
    dp.set(from, addDays(from, len));
  }));
  sb = signBlock(s, sheet, () => pick);
  paint(dp.get());
  ok.addEventListener('click', () => {
    const r = dp.get();
    if (!r.from || !r.to) { sum.textContent = 'Нажмите новый первый день турнира'; sum.classList.add('bad'); return; }
    if (r.from === s.from && r.to === s.to) { sum.textContent = 'Это те же даты. Выберите новые или нажмите «Отмена»'; sum.classList.add('bad'); return; }
    // этап мира: запись не должна кончаться после нового начала
    if (!isCup(s) && s.state !== 'draft' && s.signupTo && s.signupTo >= r.from) { sum.textContent = `Запись идёт до ${rangeShort(s.signupTo)}: выберите начало позже`; sum.classList.add('bad'); return; }
    // турнир из мастера: срок записи на новых датах должен быть верным
    const err = sb ? sb.error() : '';
    if (err) { sum.textContent = `Запись и жеребьёвка: ${err.charAt(0).toLowerCase()}${err.slice(1)}`; sum.classList.add('bad'); $('.ssn-sign', sheet).scrollIntoView({ block: 'nearest' }); return; }
    closeLayer(true);
    doMove(s, r.from, r.to, sb ? sb.value() : undefined);
  });
  $('[data-no]', sheet).addEventListener('click', () => closeLayer());
}

// ---------- перетаскивание пилюли (только мышь на ноутбуке; путь кнопкой есть всегда) ----------
function dragPill(btn, s) {
  let grab = 0;
  const len = daysBetween(s.from, s.to);
  btn.addEventListener('pointerdown', (e) => {
    const day = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.matches && n.matches('.sm-day[data-iso]'));
    grab = day ? Math.max(0, Math.min(len, daysBetween(s.from, day.dataset.iso))) : 0;
  });
  const clear = () => $$('.sm-day.ssn-drop', root).forEach((d) => d.classList.remove('ssn-drop', 'bad'));
  drag(btn, {
    ghost: () => { dragging = true; return el(`<div class="ssn-ghost" aria-hidden="true"><b>${esc(s.name)}</b><span>Ведите к новому первому дню</span></div>`); },
    over: (x, y, ghost) => {
      clear();
      const line = $('span', ghost);
      ghost.classList.remove('bad');
      const day = document.elementsFromPoint(x, y).find((n) => n.matches && n.matches('.sm-day[data-iso]'));
      if (!day) { line.textContent = 'Наведите на день месяца'; return null; }
      const from = addDays(day.dataset.iso, -grab); const to = addDays(from, len);
      if (from <= TODAY) { line.textContent = 'Прошедшие дни выбрать нельзя'; ghost.classList.add('bad'); return null; }
      if (from === s.from) { line.textContent = 'Это те же даты'; return null; }
      const clash = STAGES.find((t) => t.id !== s.id && t.from <= to && t.to >= from);
      $$('.sm-day[data-iso]', root).forEach((d) => { if (d.dataset.iso >= from && d.dataset.iso <= to) d.classList.add('ssn-drop', ...(clash ? ['bad'] : [])); });
      line.textContent = `Новые даты: ${rangeShort(from, to)}${clash ? ` · пересекается с «${instr(clash.name)}»` : ''}`;
      if (clash) ghost.classList.add('bad');
      return { from, to };
    },
    drop: (t) => {
      clear(); suppress = Date.now() + 400; dragging = false;
      // черновик — сразу и с «Отменить»; опубликованный — через «Проверьте» с последствиями
      if (s.state === 'draft') doMove(s, t.from, t.to); else moveSheet(s, t);
    },
    cancel: () => { clear(); suppress = Date.now() + 400; dragging = false; },
  });
}

// ---------- пришли из мастера ----------
const saved = q.get('saved'); const pub = q.get('published'); const del = q.get('deleted');
const came = (saved || pub) ? seasonStages().find((s) => s.id === (saved || pub)) : null;
mount(came ? came.from.slice(0, 7) : undefined);
if (came) toast(saved ? `Черновик «${came.name}» сохранён — в календаре он пунктиром` : `«${came.name}» опубликован: запись открыта до ${rangeShort(came.signupTo)}`);
else if (saved) {
  const c = getCup(saved);
  toast(`Черновик «${(c && c.name) || 'Новый турнир'}» сохранён. В календаре он появится, когда будут даты`);
}
// удалили в мастере (запись и строка журнала — там): здесь — что удалено
if (del) {
  const name = (getCup(del) || {}).name || (D.stage(del) || {}).name;
  toast(name ? `Черновик «${name}» удалён` : 'Черновик удалён', { kind: 'bad' });
}
if (saved || pub || del) history.replaceState(null, '', location.pathname + location.search.replace(/[?&](saved|published|deleted)=[^&]*/g, '').replace(/^&/, '?'));
// Турниры и заявки пар поменялись здесь, на соседней странице или в другой вкладке — календарь
// показывает то же (и во вкладке в фоне). Пока тянут пилюлю, не перерисовываем.
let queued = false;
const again = () => {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; if (!dragging && JSON.stringify(seasonStages()) !== shown) mount(); }, 0);
};
state.on('cups', again);
state.on('pairs', again);
// окно стало шире или уже 1280: переключатель «Месяц · Список» встаёт на своё место
WIDE.addEventListener('change', () => { if (!dragging) mount(); });
// телефон: список открывается на нужном месяце; «Создать турнир» и вкладки — одна панель внизу
if (isPhone()) {
  requestAnimationFrame(() => {
    const m = $(`.slist-month[data-m="${month}"]`, root) || $(`.slist-month[data-m="${TODAY.slice(0, 7)}"]`, root);
    const pin = $('.today-pin', root);
    if (m) scrollTo({ top: Math.max(0, m.getBoundingClientRect().top + scrollY - (pin ? pin.offsetHeight + 24 : 16)) });
  });
}
document.body.insertAdjacentHTML('beforeend', '<div class="ssn-dock glass" aria-hidden="true"></div>');
