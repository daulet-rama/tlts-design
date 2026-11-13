// TLTS · join.html — регистрация с шагом «Это вы?» (Моя идея: fair-one-person).
// Утверждено заказчиком: аккаунт создаётся сразу, членство — после одобрения. Идея — шаг «Это вы?» и очередь склеек у админа.
// Логика — ideas/join.logic.js (тесты ideas/tests/join.test.mjs), архив — ideas/join.data.js (собирает ideas/tools/build-join.py),
// выдуманные записи — ideas/join.demo.js. Состояние — localStorage 'tlts-join-v1', синхронно между вкладками.

import { playerOf } from './core/data.js';
import { playerCardHTML, monogramHTML } from './core/card.js';
import { mountProtoBar, mountIdeaNote } from './core/protobar.js';
import { role, playerId, setRole, onIdentityChange, ROLE_LABELS } from './core/identity.js';
import {
  JOIN_KEY, fold, plural, toursText, yearsText, publicRecord, recordLine, searchRecords, namesakes, summarize,
  eligibility, initialState, restore, reduce, statusOf, profileView, consentText, meItemId,
} from './ideas/join.logic.js';
import { DEMO_RECORDS, DEMO_QUEUE } from './ideas/join.demo.js';
import { JOIN_ARCHIVE } from './ideas/join.data.js';

/* ------------------------------------------------------------------ мелочи */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtNum = (n) => Number(n).toLocaleString('ru-RU').replace(/\s/g, ' ');
const pct = (a, b) => (b ? (100 * a / b).toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : '0');
const pad = (n) => String(n).padStart(2, '0');
function fmtDT(iso, withTime = true) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '[ДАТА]';
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  return withTime ? `${date}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
function maskPhone(p) {
  const digits = String(p || '').replace(/\D/g, '');
  return digits.length >= 4 ? `+7 ••• ••• •• ${digits.slice(-2)}` : 'телефон не указан';
}
const tbd = (q) => `<span class="jn-tbd"><span class="jn-tbd__k">Правило уточняется у лиги</span>${q}</span>`;
function say(text) { const el = $('jn-live'); el.textContent = ''; requestAnimationFrame(() => { el.textContent = text; }); }

const ICON = {
  check: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
  wait: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 4.6V8l2.4 1.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  dash: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 8h8" stroke="currentColor" stroke-width="2"/></svg>',
  ask: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 3.5h11v7H7l-3 2.5v-2.5H2.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  search: '<svg class="findme__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.6 12.6L17 17" stroke="currentColor" stroke-width="1.8"/></svg>',
  chev: '<svg class="jn-step__chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

/* ------------------------------------------------------------------ данные */

const ARCH = JOIN_ARCHIVE;
const ST = ARCH.stats;
const demoById = Object.fromEntries(DEMO_RECORDS.map((r) => [r.id, r]));
const archByKey = Object.fromEntries(ARCH.people.map((p) => [p.key, { ...p, id: p.key, name: `${p.last} ${p.first}` }]));
const recordOf = (id) => demoById[id] || archByKey[id] || null;
const archList = Object.values(archByKey);

// «Фамилия И.» одинакова у нескольких людей — такую запись без сверки не различить
const sameInitial = (() => {
  const g = new Map();
  for (const p of archList) {
    const k = `${fold(p.last)} ${fold(p.first)[0]}`;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(p);
  }
  return [...g.entries()].filter(([, ps]) => ps.length > 1).map(([key, ps]) => ({ key, short: `${ps[0].last} ${ps[0].first[0]}.`, people: ps.sort((a, b) => b.tours - a.tours) }));
})();
const sameInitialKeys = new Set(sameInitial.flatMap((g) => g.people.map((p) => p.key)));
const ABBR = /\s\S\.$/;
const multiSpelled = archList.filter((p) => new Set(p.spellings.map((s) => s.text).filter((t) => !ABBR.test(t))).size > 1)
  .sort((a, b) => b.tours - a.tours);

const sameInitialPeople = sameInitial.reduce((a, g) => a + g.people.length, 0);

mountProtoBar({ current: 'join' });
mountIdeaNote(null, {
  title: 'Шаг «Это вы?» в регистрации',
  score: 7.7,
  approvals: 3,
  approved: 'порядок регистрации: аккаунт создаётся сразу, членство — после одобрения',
  why: `У игроков лиги нет одного номера: в сетках плей-офф ${Math.round(100 * ST.playoffAbbrev / ST.playoffMentions)}% записей — «Фамилия И.», ${ST.sharedSurnames} фамилий носят ${ST.sharedPeople} человек. Игрок сам отмечает свои записи архива, админ подтверждает — и рейтинг, история и награды больше не путают однофамильцев.`,
  changed: [
    'Убран вопрос-проверка «С кем играли в паре в мае 2024?»: взрослый человек не обязан это помнить, а сетки открыты всем — проверкой он не был.',
    '«Да, это я» — только просьба. Историю присоединяет админ кнопкой «Подтвердить»; сайт сам ничего не склеивает.',
    'До подтверждения видно только написание имени, число турниров и годы — ни результатов, ни напарников, ни возраста.',
    'Любую склейку можно разъединить; каждое действие пишется в журнал: кто, когда, что.',
    'Отдельное согласие на публикацию результатов и выбор «что видно другим».',
    'Шаг встроен в регистрацию, а не отдельная функция.',
  ],
  league: [
    'Кто в лиге подтверждает склейки: генеральный менеджер или админ сайта?',
    'Когда новичок платит взнос — до решения Совета или после?',
    'Проходит ли действующий член одобрение заново на каждый год?',
    `Кто сверяет архив вручную: ${sameInitialPeople} ${plural(sameInitialPeople, 'человек', 'человека', 'человек')} с одинаковой фамилией и первой буквой имени и ${ARCH.unresolved.length} ${plural(ARCH.unresolved.length, 'запись', 'записи', 'записей')} без полного имени?`,
  ],
});

/* ------------------------------------------------------------------ состояние */

let S = load();
function load() {
  let raw = null;
  try { raw = window.localStorage.getItem(JOIN_KEY); } catch { /* хранилище недоступно */ }
  return restore(raw, DEMO_QUEUE);
}
function save() {
  try { window.localStorage.setItem(JOIN_KEY, JSON.stringify(S)); } catch { /* работаем без сохранения */ }
}

const pid = () => playerId();
const me = () => playerOf(pid());
const isAdmin = () => role() === 'admin' || role() === 'superadmin';
const nameOf = (id) => { const p = playerOf(id); return p ? p.name : id; };
function ctx() {
  const who = isAdmin() ? `${ROLE_LABELS[role()]} (демо)` : `Игрок · ${S.account ? `${S.account.first} ${S.account.last}` : nameOf(pid())}`;
  return { now: new Date().toISOString(), who, recordOf, nameOf };
}
function act(action, message) {
  const next = reduce(S, action, ctx());
  if (next === S) return false;
  S = next;
  save();
  render();
  if (message) say(message);
  return true;
}

// Черновики полей: перерисовка не стирает введённое
const p0 = me() || { first: '', last: '', hand: 'R' };
const ui = {
  open: null,
  editClaim: false,
  query: S.account ? S.account.last : p0.last,
  selected: new Set(),
  asking: null,
  draft: {
    first: p0.first, last: p0.last, phone: '+7 701 555 01 23', code: '',
    pd: false, publish: false, results: 'members', photo: 'members',
    path: null, invite: 'invite',
    birth: p0.demo && p0.age ? `${new Date().getFullYear() - p0.age}-03-14` : '', pairYears: p0.demo ? String(Math.max(1, new Date().getFullYear() - (p0.since || 2023) + 3)) : '',
    hand: p0.hand === 'L' ? 'L' : 'R', backhand: 'one', amateur: false,
  },
};

function currentStep() {
  if (!S.account) return 1;
  if (!S.claim) return 2;
  if (!S.membership) return 3;
  return 4;
}

/* ------------------------------------------------------------------ шапка: шаги и вид */

const STEP_NAMES = ['Аккаунт', 'Это вы?', 'Членство', 'Статус'];
function renderSteps() {
  const cur = currentStep();
  const done = [!!S.account, !!S.claim, !!S.membership, false];
  $('jn-steps').innerHTML = STEP_NAMES.map((n, i) => {
    const k = i + 1;
    const state = done[i] ? 'done' : k === cur ? 'current' : 'next';
    const sub = state === 'done' ? 'готово' : state === 'current' ? 'сейчас' : k === 4 ? 'после заявки' : 'дальше';
    const idea = k === 2 ? '<span class="jn-steps__idea" title="Моя идея">идея</span>' : '';
    const reach = k === 4 || done[i] || k === cur;
    return `<li class="jn-steps__item is-${state}">`
      + `<button class="jn-steps__btn" type="button" data-goto="${k}"${reach ? '' : ' disabled'}${k === cur ? ' aria-current="step"' : ''}>`
      + `<span class="jn-steps__n">${state === 'done' ? ICON.check : k}</span>`
      + `<span class="jn-steps__txt"><span class="jn-steps__name">${n}${idea}</span><span class="jn-steps__sub">${sub}</span></span>`
      + '</button></li>';
  }).join('');
}

function renderView() {
  const admin = isAdmin();
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String((b.dataset.view === 'admin') === admin));
  $('jn-player').hidden = admin;
  $('jn-admin').hidden = !admin;
  $('jn-steps').hidden = admin;
  const r = role();
  $('jn-view-hint').textContent = admin
    ? `Вы смотрите как «${ROLE_LABELS[r]}»: очередь заявок и склеек, журнал и сверка архива. Видят только админ и суперадмин.`
    : r === 'player'
      ? `Путь показан на выдуманном игроке: ${nameOf(pid())}. Настоящие фамилии в поиске находят настоящие записи архива — только имя, число турниров и годы.`
      : `Вы смотрите как «${ROLE_LABELS[r]}». Регистрация открыта всем; путь показан на выдуманном игроке ${nameOf(pid())}.`;
}

/* ------------------------------------------------------------------ шаги игрока */

function stepShell(k, title, state, summary, body, extraTag = '') {
  const open = ui.open === k;
  const locked = state === 'next';
  return `<section class="jn-step is-${state}${open ? ' is-open' : ''}" id="jn-step-${k}" aria-labelledby="jn-step-${k}-h">`
    + `<h2 class="jn-step__h" id="jn-step-${k}-h">`
    + `<button class="jn-step__head" type="button" data-toggle="${k}" aria-expanded="${open}" aria-controls="jn-step-${k}-body"${locked ? ' disabled' : ''}>`
    + `<span class="jn-step__n">${state === 'done' ? ICON.check : `0${k}`}</span>`
    + `<span class="jn-step__titles"><span class="jn-step__title">${title}${extraTag}</span>`
    + `<span class="jn-step__sum">${summary}</span></span>${locked ? '' : ICON.chev}</button></h2>`
    + `<div class="jn-step__body" id="jn-step-${k}-body"${open ? '' : ' hidden'}>${open ? body() : ''}</div>`
    + '</section>';
}

function seg(name, value, options, label) {
  return `<div class="seg jn-seg" role="group" aria-label="${esc(label)}">`
    + options.map(([v, t]) => `<button class="seg__btn" type="button" data-seg="${name}" data-val="${v}" aria-pressed="${v === value}">${t}</button>`).join('')
    + '</div>';
}
function sw(name, checked, label, hint, { disabled = false } = {}) {
  return `<div class="jn-sw"><button class="switch" type="button" role="switch" data-sw="${name}" aria-checked="${!!checked}"${disabled ? ' disabled' : ''} aria-describedby="jn-sw-${name}-h">`
    + `<span class="switch__track" aria-hidden="true"></span><span>${label}</span></button>`
    + `<p class="field__hint" id="jn-sw-${name}-h">${hint}</p></div>`;
}

function visibilityHTML(c) {
  return '<div class="jn-vis">'
    + '<p class="cap cap--strong">Что видно другим</p>'
    + `<div class="jn-vis__row"><span class="jn-vis__lbl">Результаты и статистика</span>${c.publish
      ? seg('results', c.results, [['all', 'Всем'], ['members', 'Членам лиги']], 'Кому видны результаты')
      : '<span class="jn-vis__fixed">только вам и админу — нет согласия на публикацию</span>'}</div>`
    + `<div class="jn-vis__row"><span class="jn-vis__lbl">Фото в профиле</span>${seg('photo', c.photo, [['all', 'Всем'], ['members', 'Членам лиги'], ['none', 'Только мне']], 'Кому видно фото')}</div>`
    + '<div class="jn-vis__row"><span class="jn-vis__lbl">Телефон и дата рождения</span><span class="jn-vis__fixed">никому — только админу лиги</span></div>'
    + '</div>';
}

function step1() {
  if (S.account) {
    const c = S.consent;
    return `<p class="jn-done">Аккаунт создан ${fmtDT(S.account.at, false)}: <b>${esc(S.account.first)} ${esc(S.account.last)}</b> · ${maskPhone(S.account.phone)}. Публикация результатов: ${c.publish ? 'согласие дано' : 'согласия нет'}.</p>`
      + sw('publish-live', c.publish, 'Согласен на публикацию результатов и статистики', 'Можно включить или выключить в любой момент. Без согласия ваши результаты видит только лига.')
      + visibilityHTML(c)
      + '<p class="field__hint">Настройки сохраняются сразу.</p>';
  }
  const d = ui.draft;
  return '<form class="jn-form" id="jn-f-account" novalidate>'
    + '<p class="jn-p">Аккаунт создаётся сразу — это вход на сайт и ваш профиль. Членом лиги он вас ещё не делает: членство одобряет лига на шаге 3.</p>'
    + '<div class="jn-fields">'
    + `<div class="field"><label class="field__label" for="a-first">Имя</label><input class="input" id="a-first" data-draft="first" autocomplete="given-name" value="${esc(d.first)}" required></div>`
    + `<div class="field"><label class="field__label" for="a-last">Фамилия</label><input class="input" id="a-last" data-draft="last" autocomplete="family-name" value="${esc(d.last)}" required></div>`
    + `<div class="field"><label class="field__label" for="a-phone">Телефон</label><input class="input" id="a-phone" data-draft="phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(d.phone)}" placeholder="+7 701 123 45 67" required></div>`
    + `<div class="field"><label class="field__label" for="a-code">Код из СМС, 4 цифры</label><input class="input input--num" id="a-code" data-draft="code" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="••••" value="${esc(d.code)}" required></div>`
    + '</div>'
    + '<p class="field__hint">В прототипе подходит любой код из четырёх цифр, СМС не отправляется. Телефон и имя — демо.</p>'
    + '<div class="jn-consents">'
    + sw('pd', d.pd, 'Согласен на сбор и обработку персональных данных', 'Обязательно по закону РК «О персональных данных и их защите». В готовой платформе данные планируется хранить на серверах в Казахстане.')
    + sw('publish', d.publish, 'Согласен на публикацию результатов и статистики', 'Отдельное согласие, по желанию. Можно включить позже. Без него результаты видит только лига.')
    + '</div>'
    + visibilityHTML({ publish: d.publish, results: d.results, photo: d.photo })
    + '<p class="jn-err" id="jn-err-1" role="alert" hidden></p>'
    + '<button class="btn btn--primary btn--block jn-submit" type="submit">Создать аккаунт</button>'
    + '</form>';
}

function recHTML(rec, { selectable = false, pressed = false, readonly = false } = {}) {
  const r = publicRecord(rec);
  const mono = monogramHTML({ id: `rec-${r.id}`, last: rec.last, first: rec.first || '', name: r.name, portrait: null, kpr: null }, { size: 'sm' });
  const spell = r.spellings.length ? `<span class="jn-rec__sp">Как записан: ${r.spellings.map(esc).join(' · ')}</span>` : '';
  const meta = r.tours > 0 ? `${toursText(r.tours)} · ${yearsText(r.years)}` : 'в сетках нет · есть в рейтинге';
  const flags = [];
  if (r.demo) flags.push('<span class="tag tag--demo">Демо</span>');
  if (!r.demo && sameInitialKeys.has(r.id)) flags.push('<span class="jn-flag">требует сверки</span>');
  const why = rec.why ? `<span class="jn-rec__why">${esc(rec.why)}</span>` : '';
  const inner = `${selectable ? '<span class="jn-rec__box" aria-hidden="true">' + ICON.check + '</span>' : ''}${mono}`
    + `<span class="jn-rec__main"><span class="jn-rec__name">${esc(r.name)} ${flags.join(' ')}</span>`
    + `<span class="jn-rec__meta">${meta}</span>${spell}${why}</span>`;
  if (selectable) return `<li><button class="jn-rec is-pick" type="button" data-pick="${esc(r.id)}" aria-pressed="${pressed}">${inner}</button></li>`;
  return `<li><div class="jn-rec${readonly ? ' is-readonly' : ''}">${inner}</div></li>`;
}

function whyStats() {
  const kim = ARCH.shared.find((s) => s.surname === 'Ким');
  return '<div class="jn-why">'
    + '<p class="cap">Почему этот шаг · архив лиги</p>'
    + '<dl class="jn-why__grid">'
    + `<div><dt>${Math.round(100 * ST.playoffAbbrev / ST.playoffMentions)}%</dt><dd>записей в сетках плей-офф — «Фамилия И.»: ${fmtNum(ST.playoffAbbrev)} из ${fmtNum(ST.playoffMentions)}</dd></div>`
    + `<div><dt>${ST.sharedSurnames}</dt><dd>${plural(ST.sharedSurnames, 'фамилию', 'фамилии', 'фамилий')} носят ${ST.sharedPeople} ${plural(ST.sharedPeople, 'человек', 'человека', 'человек')}${kim ? `; ${kim.surname} — ${kim.people}` : ''}</dd></div>`
    + `<div><dt>${ST.multiSpelled}</dt><dd>${plural(ST.multiSpelled, 'игрок записан', 'игрока записаны', 'игроков записаны')} полным именем по-разному: разница бывает в одной букве</dd></div>`
    + '</dl>'
    + `<p class="jn-why__src">Сетки ${ST.tournaments} турниров ${ST.seasons[0]}–${ST.seasons.at(-1)} с сайта лиги. Без этого шага рейтинг и история могут записать победу не тому Киму.</p>`
    + '</div>';
}

function step2() {
  const st = statusOf(S, pid());
  let out = '<p class="jn-p">В старых сетках лиги одного человека записывали по-разному. Найдите себя и отметьте свои записи — админ лиги проверит и присоединит их к вашему профилю. Отвечать на вопросы о прошлых матчах не нужно.</p>';
  out += whyStats();
  if (st.note && st.history === 'asked') {
    out += `<div class="jn-note" role="note">${ICON.ask}<div><p class="cap cap--strong">Админ спрашивает</p><p>${esc(st.note)}</p><p class="field__hint">Поправьте выбор ниже и отправьте снова — или ответьте админу в чате лиги.</p></div></div>`;
  }
  const claimed = S.claim && !ui.editClaim;
  if (claimed) {
    if (S.claim.kind === 'notfound') {
      out += '<div class="jn-sent"><p class="cap cap--strong">Отправлено админу</p><p>«Меня нет в списке». Админ поищет вас вручную — может быть, под другим написанием. Если вы новичок, истории в архиве и не должно быть.</p></div>';
    } else {
      const recs = S.claim.records.map(recordOf).filter(Boolean);
      const sum = summarize(recs);
      out += `<div class="jn-sent"><p class="cap cap--strong">Вы отметили · ${recs.length} ${plural(recs.length, 'запись', 'записи', 'записей')} · ${toursText(sum.tours)} · ${yearsText(sum.years)}</p>`
        + `<ul class="jn-recs">${recs.map((r) => recHTML(r, { readonly: true })).join('')}</ul></div>`;
    }
    out += `<p class="jn-state"><span class="jn-state__mark is-${st.history === 'confirmed' || st.history === 'notfoundConfirmed' ? 'ok' : 'wait'}">${st.history === 'confirmed' || st.history === 'notfoundConfirmed' ? ICON.check : ICON.wait}</span>${esc(statusOf(S, pid()).parts[2])}</p>`;
    if (st.history !== 'confirmed' && st.history !== 'notfoundConfirmed') out += '<button class="btn btn--secondary btn--sm" type="button" data-act="edit-claim">Изменить выбор</button>';
    else out += '<p class="field__hint">Заметили ошибку? Напишите админу: склейку можно разъединить.</p>';
    return out;
  }

  const q = ui.query;
  out += '<div class="findme jn-find">'
    + '<label class="findme__label" for="jn-q">Фамилия в архиве лиги</label>'
    + `<span class="findme__field">${ICON.search}<input class="findme__input" id="jn-q" type="search" autocomplete="off" value="${esc(q)}" placeholder="Например, Сарсенбаев или Ким"></span>`
    + '<p class="jn-try"><span class="cap">Попробуйте:</span> '
    + [[nameOf(pid()).split(' ').at(-1), 'демо'], ['Ким', '']]
      .map(([n, t]) => `<button class="jn-chip" type="button" data-q="${esc(n)}">${esc(n)}${t ? ` <small>${t}</small>` : ''}</button>`).join('')
    + '</p></div>';
  out += `<div id="jn-results" aria-live="polite">${resultsHTML()}</div>`;
  out += '<div class="jn-rule"><p class="cap cap--strong">Что видно до подтверждения</p>'
    + '<p>Только написание имени, число турниров и годы. Ни результатов, ни напарников, ни возраста — ни вам, ни другим. «Да, это я» — просьба присоединить историю: присоединяет админ, сайт сам ничего не склеивает.</p></div>';
  const n = ui.selected.size;
  out += '<div class="jn-actions">'
    + `<button class="btn btn--primary" type="button" data-act="claim"${n ? '' : ' disabled'} id="jn-claim">Да, это я${n ? ` · ${n} ${plural(n, 'запись', 'записи', 'записей')}` : ''}</button>`
    + '<button class="btn btn--secondary" type="button" data-act="notfound">Меня нет в списке</button>'
    + (S.claim ? '<button class="btn btn--quiet btn--sm" type="button" data-act="cancel-edit">Оставить как было</button>' : '')
    + '</div>';
  return out;
}

function resultsHTML() {
  const q = ui.query.trim();
  if (fold(q).length < 2) return '<p class="jn-empty">Введите хотя бы две буквы фамилии.</p>';
  const demo = searchRecords(DEMO_RECORDS, q);
  const real = searchRecords(archList, q, { limit: 8 });
  let out = '';
  if (demo.length) {
    const sur = demo[0].name.split(' ')[0];
    out += `<p class="cap jn-res__head">Найдено ${demo.length} ${plural(demo.length, 'запись', 'записи', 'записей')} · <span class="tag tag--demo">Демо-данные</span></p>`;
    if (namesakes(DEMO_RECORDS, sur) > 1) out += `<p class="jn-p jn-p--sm">Записей с фамилией «${esc(sur)}» несколько. Отметьте все свои — чужие не трогайте: админ всё равно проверит.</p>`;
    out += `<ul class="jn-recs">${demo.map((r) => recHTML(demoById[r.id], { selectable: true, pressed: ui.selected.has(r.id) })).join('')}</ul>`;
  }
  if (real.length) {
    const sur = real[0].name.split(' ')[0];
    const total = namesakes(archList, sur);
    out += `<p class="cap jn-res__head">Настоящий архив лиги · ${total} ${plural(total, 'человек', 'человека', 'человек')} с фамилией «${esc(sur)}»${total > real.length ? `, показаны ${real.length}` : ''}</p>`
      + `<ul class="jn-recs">${real.map((r) => recHTML(archByKey[r.id], { readonly: true })).join('')}</ul>`
      + '<p class="field__hint">Настоящую запись в прототипе присвоить нельзя: путь показан на выдуманном игроке. Видно ровно то, что увидит человек до подтверждения, — имя, число турниров и годы.</p>';
  }
  if (!demo.length && !real.length) {
    out += `<p class="jn-empty">В архиве нет фамилии «${esc(q)}». Играли в лиге? Нажмите «Меня нет в списке» — админ поищет вручную. Новичку здесь искать нечего.</p>`;
  }
  return out;
}

function step3() {
  const d = ui.draft;
  if (S.membership) {
    const m = S.membership;
    return `<p class="jn-done">Заявка отправлена ${fmtDT(m.at, false)} · ${m.path === 'new' ? 'вступаю впервые' : 'играл в лиге раньше'} · ${m.invite === 'letter' ? 'письмо-заявление' : 'по приглашению генерального менеджера'}.</p>`
      + `<p class="jn-state"><span class="jn-state__mark is-wait">${ICON.wait}</span>${esc(statusOf(S, pid()).parts[1])}</p>`
      + '<p class="field__hint">Ответ — в течение 10 календарных дней (Регламент о членстве, п. 3.6).</p>';
  }
  const path = d.path || (S.claim && S.claim.kind === 'records' ? 'member' : 'new');
  const el = eligibility({ birth: d.birth, pairYears: d.pairYears, amateur: d.amateur }, todayIso());
  return '<form class="jn-form" id="jn-f-member" novalidate>'
    + '<div class="field"><span class="field__label">Вы уже играли в турнирах лиги?</span>'
    + seg('path', path, [['member', 'Да, играл'], ['new', 'Вступаю впервые']], 'Играли ли вы в лиге') + '</div>'
    + (path === 'member'
      ? '<p class="jn-p jn-p--sm">Членство годовое: с 1 января по 31 декабря. Заявка — на 2027 год.</p>' + tbd('Проходит ли действующий член одобрение заново каждый год?')
      : '<p class="jn-p jn-p--sm">Новичку лига назначает входящий КПР: 3.5, 4.0 или 4.5 (Регламент о КПР). КПР — личный уровень игры; у игроков лиги сейчас уровни от 3.0 до 5.0. Уровень оценивает спортивный директор или член Совета.</p>' + tbd('Как КПР меняется после сезона?'))
    + '<div class="jn-who"><p class="cap cap--strong">Кто может стать членом лиги · Положение, раздел 7</p>'
    + `<ul class="jn-checks" id="jn-elig">${eligHTML(el)}</ul>`
    + '<p class="field__hint">Сайт только подсказывает по анкете. Решение принимает лига. Возраст никому не показывается — только «подходит» или «нет».</p>'
    + tbd('В Положении — «не моложе 25 и не старше 80», в Регламенте о членстве — «старше 25». Какой текст действует?') + '</div>'
    + '<p class="cap cap--strong jn-sub">Анкета члена лиги</p>'
    + '<div class="jn-fields">'
    + `<div class="field"><label class="field__label" for="m-birth">Дата рождения</label><input class="input" id="m-birth" type="date" data-draft="birth" value="${esc(d.birth)}" max="${todayIso()}"><span class="field__hint">Видит только админ лиги.</span></div>`
    + `<div class="field"><label class="field__label" for="m-exp">Опыт парной игры в любительских турнирах, лет</label><input class="input" id="m-exp" type="number" inputmode="numeric" min="0" max="70" data-draft="pairYears" value="${esc(d.pairYears)}"></div>`
    + `<div class="field"><span class="field__label">Рука</span>${seg('hand', d.hand, [['R', 'Правша'], ['L', 'Левша']], 'Рука')}</div>`
    + `<div class="field"><span class="field__label">Бэкхенд</span>${seg('backhand', d.backhand, [['one', 'Одноручный'], ['two', 'Двуручный']], 'Бэкхенд')}</div>`
    + '</div>'
    + sw('amateur', d.amateur, 'Не выступал в профессиональных турнирах, спортивных званий нет', 'Из анкеты члена лиги: кмс, мс и другие разряды — не любительский уровень.')
    + `<div class="field"><span class="field__label">Как вы пришли в лигу</span>${seg('invite', d.invite, [['invite', 'По приглашению генерального менеджера'], ['letter', 'Сам, письмом-заявлением']], 'Как пришли')}`
    + '<span class="field__hint">Так в Регламенте о членстве (п. 3.2 и 3.5): приглашение или своё письмо генеральному менеджеру.</span></div>'
    + '<div class="jn-fee"><p class="cap cap--strong">Членский взнос</p>'
    + '<p><b>Сумму взноса называет лига.</b> Размер на год утверждает Попечительский совет до 1 декабря. Оплатить нужно до 1 февраля, иначе членство прекращается. Взносы не возвращаются.</p>'
    + tbd('Когда платит новичок — до решения Совета или после?') + '</div>'
    + '<div class="jn-next"><p class="cap cap--strong">Что будет дальше</p><ol class="jn-ol">'
    + '<li>Генеральный менеджер проверяет анкету и передаёт её в Попечительский совет — совет лиги, который утверждает членство.</li>'
    + '<li>Ответ — в течение 10 календарных дней.</li>'
    + '<li>Решение Совета вносит в платформу админ, и статус меняется у вас на экране.</li>'
    + '<li>Членство — на календарный год. За год нужно сыграть хотя бы один турнир серии.</li>'
    + '</ol></div>'
    + '<p class="jn-err" id="jn-err-3" role="alert" hidden></p>'
    + '<button class="btn btn--primary btn--block jn-submit" type="submit">Отправить заявку на членство</button>'
    + '</form>';
}

function eligHTML(el) {
  return el.items.map((x) => `<li class="jn-check is-${x.ok === true ? 'ok' : x.ok === false ? 'no' : 'unk'}"><span class="jn-check__mark">${x.ok === true ? ICON.check : ICON.dash}</span>`
    + `<span>${esc(x.label)} — <b>${x.ok === true ? 'подходит' : x.ok === false ? 'не подходит' : 'не заполнено'}</b></span></li>`).join('')
    + '<li class="jn-check is-fixed"><span class="jn-check__mark">' + ICON.dash + '</span><span>Входящий КПР 3.5–4.5 — <b>назначает лига</b></span></li>';
}

function renderFlow() {
  const cur = currentStep();
  // всё пройдено — открыт шаг «Это вы?»: там видно, что отмечено и что ждёт админа
  if (ui.open === null) ui.open = cur <= 3 ? cur : 2;
  const st = statusOf(S, pid());
  const s1 = S.account ? `${esc(S.account.first)} ${esc(S.account.last)} · создан ${fmtDT(S.account.at, false)}` : 'имя, телефон, код из СМС';
  const s2 = !S.claim ? 'найдите свои записи в архиве' : `${esc(st.parts[2])}`;
  const s3 = S.membership ? esc(st.parts[1]) : 'анкета, взнос, решение Совета';
  const state = (k, done) => (done ? 'done' : k === cur ? 'current' : 'next');
  $('jn-flow').innerHTML = stepShell(1, 'Аккаунт', state(1, !!S.account), s1, step1)
    + stepShell(2, 'Это вы?', state(2, !!S.claim), s2, step2, ' <span class="tag tag--idea">Моя идея</span>')
    + stepShell(3, 'Заявка на членство', state(3, !!S.membership), s3, step3);
}

/* ------------------------------------------------------------------ статус */

function renderStatus() {
  const st = statusOf(S, pid());
  const p = me();
  const name = S.account ? `${S.account.first} ${S.account.last}` : (p ? p.name : '');
  const view = profileView(S, pid(), { name, recordOf });
  const row = (ok, text, sub) => `<li class="jn-srow is-${ok}"><span class="jn-state__mark is-${ok}">${ok === 'ok' ? ICON.check : ok === 'wait' ? ICON.wait : ok === 'ask' ? ICON.ask : ICON.dash}</span><span><b>${esc(text)}</b>${sub ? `<small>${sub}</small>` : ''}</span></li>`;
  const histOk = { confirmed: 'ok', notfoundConfirmed: 'ok', pending: 'wait', notfoundPending: 'wait', asked: 'ask', rejected: 'no', none: 'no' }[st.history];
  const memOk = { approved: 'ok', pending: 'wait', declined: 'no', none: 'no' }[st.member];
  const card = p ? playerCardHTML({ ...p, first: S.account ? S.account.first : p.first, last: S.account ? S.account.last : p.last, name, kpr: null }, { size: 'sm', rank: 'none' }) : '';
  let profile = '';
  if (!S.account) {
    profile = '<p class="jn-p jn-p--sm">Профиль появится, как только будет создан аккаунт.</p>';
  } else if (view.confirmed) {
    profile = `<div class="jn-prof">${card}<p class="jn-prof__meta">${toursText(view.tours)} · ${yearsText(view.years)} · история подтверждена</p></div>`
      + `<p class="jn-p jn-p--sm">Прежние написания стали псевдонимами — по любому из них поиск найдёт вас:</p><p class="jn-alias">${view.aliases.map(esc).join(' · ')}</p>`
      + `<p class="jn-p jn-p--sm">Результаты, напарники и рейтинг теперь берутся из подтверждённой истории${S.consent.publish ? ` и видны ${consentText(S.consent.results)}` : ' и видны только вам и лиге — согласия на публикацию нет'}.</p>`
      + `<a class="more" href="player.html?p=${esc(pid())}">Открыть профиль</a>`;
  } else {
    const meta = view.tours ? `${toursText(view.tours)} · ${yearsText(view.years)}` : st.history === 'notfoundPending' || st.history === 'notfoundConfirmed' ? 'истории в архиве нет' : 'история не отмечена';
    profile = `<div class="jn-prof">${card}<p class="jn-prof__meta">${meta}${view.tours ? ' · ждёт подтверждения' : ''}</p></div>`
      + '<p class="jn-p jn-p--sm">Больше в профиле ничего нет: результаты, напарники и рейтинг появятся только после того, как админ подтвердит историю.</p>';
  }
  $('jn-status').innerHTML = '<div class="jn-status panel">'
    + '<p class="sec-head__idx"><b class="sec-head__n">04</b><span>Статус</span></p>'
    + '<h2 class="jn-status__title" id="jn-status-title">Ваш статус</h2>'
    + `<p class="jn-status__line">${esc(st.line)}</p>`
    + '<ul class="jn-srows">'
    + row(st.account ? 'ok' : 'no', st.parts[0], st.account ? `с ${fmtDT(S.account.at, false)} · вход и профиль работают` : 'имя, телефон, код из СМС')
    + row(memOk, st.parts[1], st.member === 'pending' ? 'решает Попечительский совет, ответ до 10 дней' : st.member === 'approved' ? 'можно заявляться на турниры' : st.member === 'declined' ? 'причину сообщит лига' : 'анкета на шаге 3')
    + row(histOk, st.parts[2], st.history === 'pending' ? 'проверяет админ лиги' : st.history === 'asked' ? 'ответ — на шаге 2' : st.history === 'rejected' ? 'админ не подтвердил; можно отметить заново' : st.history === 'none' ? 'найдите себя в архиве на шаге 2' : '')
    + '</ul>'
    + (st.history === 'asked' && st.note ? `<div class="jn-note">${ICON.ask}<div><p class="cap cap--strong">Админ спрашивает</p><p>${esc(st.note)}</p><button class="btn btn--secondary btn--sm" type="button" data-act="answer">Изменить выбор</button></div></div>` : '')
    + (st.history === 'rejected' ? '<button class="btn btn--secondary btn--sm" type="button" data-act="answer">Отметить записи заново</button>' : '')
    + '<div class="jn-status__prof"><p class="cap cap--strong">Так ваш профиль видят сейчас</p>' + profile + '</div>'
    + '</div>';
}

/* ------------------------------------------------------------------ админ */

const STATUS_TAG = {
  pending: '<span class="jn-qtag is-wait">ждёт решения</span>',
  asked: '<span class="jn-qtag is-ask">спросили игрока</span>',
  confirmed: '<span class="jn-qtag is-ok">подтверждено</span>',
  rejected: '<span class="jn-qtag is-no">отклонено</span>',
  none: '',
};
const MEMBER_LINE = { pending: 'на рассмотрении', approved: 'одобрено', declined: 'отказ', none: 'заявки нет' };

function queueItemHTML(q) {
  const p = playerOf(q.pid);
  const isMeItem = q.id === meItemId(pid());
  const nm = isMeItem && S.account ? `${S.account.first} ${S.account.last}` : (p ? p.name : q.pid);
  const card = p ? playerCardHTML({ ...p, name: nm, kpr: null }, { size: 'sm', rank: 'none' }) : esc(nm);
  let body = '';
  if (q.kind === 'records') {
    const recs = q.records.map(recordOf).filter(Boolean);
    const sum = summarize(recs);
    body += `<p class="cap">Считает своими · ${recs.length} ${plural(recs.length, 'запись', 'записи', 'записей')} · всего ${toursText(sum.tours)}, ${yearsText(sum.years)}</p>`
      + `<ul class="jn-recs jn-recs--tight">${recs.map((r) => recHTML(r, { readonly: true })).join('')}</ul>`;
  } else if (q.kind === 'notfound') {
    body += '<p class="jn-p jn-p--sm">«Меня нет в списке». Проверьте, нет ли его в архиве под другим написанием. Если нет — подтвердите: новый игрок, истории нет.</p>';
  } else {
    body += '<p class="jn-p jn-p--sm">Записи архива не отмечены — только заявка на членство.</p>';
  }
  if (q.status === 'confirmed' && q.kind === 'records') {
    body += `<p class="jn-p jn-p--sm">Псевдонимы игрока: <span class="jn-alias">${(S.aliases[q.pid] || []).map(esc).join(' · ')}</span></p>`;
  }
  if (q.note && (q.status === 'asked' || q.status === 'rejected')) body += `<p class="jn-qnote">${q.status === 'asked' ? 'Вопрос игроку' : 'Причина'}: «${esc(q.note)}»</p>`;

  let actions = '';
  if (q.kind !== 'none') {
    if (q.status === 'pending' || q.status === 'asked') {
      actions = `<button class="btn btn--primary btn--sm" type="button" data-qa="confirm" data-id="${q.id}">Подтвердить</button>`
        + `<button class="btn btn--secondary btn--sm" type="button" data-qa="ask" data-id="${q.id}">Спросить игрока</button>`
        + `<button class="btn btn--quiet btn--sm" type="button" data-qa="reject" data-id="${q.id}">Отклонить</button>`;
    } else if (q.status === 'confirmed') {
      actions = `<button class="btn btn--secondary btn--sm" type="button" data-qa="unmerge" data-id="${q.id}">${q.kind === 'records' ? 'Разъединить' : 'Отменить подтверждение'}</button>`;
    } else if (q.status === 'rejected') {
      actions = `<button class="btn btn--secondary btn--sm" type="button" data-qa="reopen" data-id="${q.id}">Вернуть в очередь</button>`;
    }
  }
  const asking = ui.asking === q.id
    ? `<form class="jn-askform" data-askform="${q.id}"><label class="field__label" for="ask-${q.id}">Вопрос игроку</label>`
      + `<textarea class="input jn-textarea" id="ask-${q.id}" rows="3">Подскажите, все ли эти записи ваши? Если какая-то чужая — снимите с неё отметку и отправьте заново.</textarea>`
      + '<p class="field__hint">Это просьба уточнить, а не проверка памяти: не спрашивайте о прошлых матчах и напарниках.</p>'
      + '<div class="jn-actions"><button class="btn btn--primary btn--sm" type="submit">Отправить вопрос</button><button class="btn btn--quiet btn--sm" type="button" data-qa="ask-cancel">Отмена</button></div></form>'
    : '';
  const mem = q.membership && q.membership !== 'none'
    ? `<div class="jn-qmem"><p><span class="cap">Членство на 2027</span> <b>${MEMBER_LINE[q.membership]}</b> · ${q.path === 'new' ? 'вступает впервые' : 'играл в лиге'}</p>`
      + '<div class="jn-actions">'
      + (q.membership === 'pending'
        ? `<button class="btn btn--secondary btn--sm" type="button" data-qm="approved" data-id="${q.id}">Совет одобрил</button><button class="btn btn--quiet btn--sm" type="button" data-qm="declined" data-id="${q.id}">Совет отказал</button>`
        : `<button class="btn btn--quiet btn--sm" type="button" data-qm="pending" data-id="${q.id}">Отменить решение</button>`)
      + '</div><p class="field__hint">Членство утверждает Попечительский совет; админ вносит его решение.</p></div>'
    : '';
  return `<article class="jn-q${isMeItem ? ' is-me' : ''}" id="jn-${q.id}">`
    + `<header class="jn-q__head">${card}<span class="jn-q__tags">${STATUS_TAG[q.status] || ''}<span class="tag tag--demo">Демо</span></span></header>`
    + `<p class="jn-q__when cap">Подал ${fmtDT(q.at)}${isMeItem ? ' · это вы в виде игрока' : ''}</p>`
    + body
    + (actions ? `<div class="jn-actions">${actions}</div>` : '')
    + asking + mem
    + '</article>';
}

function renderAdmin() {
  const open = S.queue.filter((q) => q.status === 'pending' || q.status === 'asked' || q.membership === 'pending').length;
  $('jn-queue-meta').textContent = `ждут решения: ${open} · всего ${S.queue.length}`;
  $('jn-queue').innerHTML = S.queue.length ? S.queue.map(queueItemHTML).join('') : '<p class="jn-empty">Заявок нет.</p>';

  $('jn-log').innerHTML = S.log.length
    ? `<div class="tscroll jn-logwrap"><table class="tbl jn-log"><thead><tr><th scope="col">Когда</th><th scope="col">Кто</th><th scope="col">Что</th></tr></thead><tbody>${S.log.map((l) => `<tr><td class="n">${fmtDT(l.at)}</td><td>${esc(l.who)}</td><td>${esc(l.what)}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="jn-empty">Пока пусто. Действия игрока и админа появятся здесь: кто, когда и что сделал.</p>';

  renderNames();
}

function renderNames() {
  $('jn-names-meta').textContent = `${ST.tournaments} турниров · ${ST.seasons[0]}–${ST.seasons.at(-1)}`;
  $('jn-names-lede').textContent = `Настоящие цифры архива. В сетках ${ST.tournaments} турниров ${fmtNum(ST.people)} человек; в сетках плей-офф ${fmtNum(ST.playoffAbbrev)} из ${fmtNum(ST.playoffMentions)} упоминаний (${pct(ST.playoffAbbrev, ST.playoffMentions)}%) записаны как «Фамилия И.». Пока у игроков нет одного номера, такую запись приходится угадывать по составу турнира. Здесь — что админу сверить вручную, прежде чем писать о человеке.`;
  const chk = (key, label) => {
    const on = !!S.checks[key];
    return `<button class="btn btn--${on ? 'secondary' : 'quiet'} btn--sm jn-chk" type="button" data-chk="${esc(key)}" data-label="${esc(label)}" aria-pressed="${on}">${on ? 'На сверке · снять' : 'Взять на сверку'}</button>`;
  };
  const line = (p) => `${esc(p.last)} ${esc(p.first)} — ${p.tours ? `${toursText(p.tours)}, ${yearsText(p.years)}` : 'только в рейтинге'}`;

  const g1 = sameInitial.map((g) => `<li class="jn-nrow"><div><p class="jn-nrow__t">«${esc(g.short)}» <span class="jn-flag">требует сверки</span></p>`
    + `<p class="jn-nrow__s">${g.people.map(line).join('<br>')}</p></div>${chk(`ini:${g.key}`, g.short)}</li>`).join('');
  const g2 = ARCH.unresolved.map((u) => `<li class="jn-nrow"><div><p class="jn-nrow__t">«${esc(u.text)}»</p>`
    + `<p class="jn-nrow__s">${u.mentions} ${plural(u.mentions, 'упоминание', 'упоминания', 'упоминаний')} в ${u.tours} ${plural(u.tours, 'турнире', 'турнирах', 'турнирах')} · ${u.text.split(' ').length === 1 ? 'записана только фамилия' : 'полного имени нет нигде в архиве'}</p></div>${chk(`unres:${u.text}`, u.text)}</li>`).join('');
  const g3 = ARCH.shared.map((s) => `<li class="jn-chip jn-chip--static">${esc(s.surname)} <b>${s.people}</b></li>`).join('');
  const g4 = multiSpelled.map((p) => `<li class="jn-nrow"><div><p class="jn-nrow__t">${esc(p.last)} ${esc(p.first)} · ${toursText(p.tours)}</p>`
    + `<p class="jn-nrow__s">${p.spellings.map((s) => `${esc(s.text)} <small>(${s.n})</small>`).join(' · ')}</p></div></li>`).join('');

  $('jn-names').innerHTML = '<div class="jn-names">'
    + `<div class="jn-nblock"><h3 class="jn-nblock__h">Одна фамилия и одна буква имени <span class="jn-nblock__n">${sameInitial.reduce((a, g) => a + g.people.length, 0)}</span></h3>`
    + '<p class="jn-p jn-p--sm">В записи «Фамилия И.» этих людей не различить. Сейчас сайт угадывает по тому, кто играл в группах того же турнира.</p>'
    + `<ul class="jn-nlist">${g1}</ul></div>`
    + `<div class="jn-nblock"><h3 class="jn-nblock__h">Записи без человека <span class="jn-nblock__n">${ARCH.unresolved.length}</span></h3>`
    + '<p class="jn-p jn-p--sm">Нет ни в рейтинге, ни полным именем в сетках — к кому отнести, решает только человек.</p>'
    + `<ul class="jn-nlist">${g2}</ul></div>`
    + `<div class="jn-nblock"><h3 class="jn-nblock__h">Однофамильцы <span class="jn-nblock__n">${ST.sharedSurnames} ${plural(ST.sharedSurnames, 'фамилия', 'фамилии', 'фамилий')} · ${ST.sharedPeople} ${plural(ST.sharedPeople, 'человек', 'человека', 'человек')}</span></h3>`
    + '<p class="jn-p jn-p--sm">Сетки и рейтинг вместе. У таких игроков шаг «Это вы?» показывает список на выбор.</p>'
    + `<ul class="jn-chips">${g3}</ul></div>`
    + `<div class="jn-nblock"><h3 class="jn-nblock__h">Одно имя — разные написания <span class="jn-nblock__n">${multiSpelled.length}</span></h3>`
    + '<p class="jn-p jn-p--sm">Сайт уже сводит их в одного человека по списку известных вариантов. Шаг «Это вы?» даёт подтвердить это самому игроку. В скобках — сколько раз встречается написание.</p>'
    + `<ul class="jn-nlist">${g4}</ul></div>`
    + '</div>'
    + '<p class="field__hint jn-src">Источник: сетки сайта лиги. Видно только имя и число турниров.</p>';
}

/* ------------------------------------------------------------------ отрисовка */

function render() {
  renderView();
  renderSteps();
  if (isAdmin()) renderAdmin();
  else { renderFlow(); renderStatus(); }
}

/* ------------------------------------------------------------------ события */

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t || t.disabled) return;
  const ds = t.dataset;

  if (ds.view) {
    if (ds.view === 'admin' && !isAdmin()) setRole('admin');
    else if (ds.view === 'player' && isAdmin()) setRole('player');
    ui.asking = null;
    render();
    say(ds.view === 'admin' ? 'Вид админа лиги' : 'Вид игрока');
    return;
  }
  if (ds.goto) {
    const k = Number(ds.goto);
    if (isAdmin()) return;
    if (k === 4) { $('jn-status').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    ui.open = k;
    renderFlow();
    const h = document.querySelector(`#jn-step-${k} .jn-step__head`);
    if (h) { h.focus({ preventScroll: true }); $(`jn-step-${k}`).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    return;
  }
  if (ds.toggle) {
    const k = Number(ds.toggle);
    ui.open = ui.open === k ? 0 : k;
    renderFlow();
    document.querySelector(`#jn-step-${k} .jn-step__head`)?.focus();
    return;
  }
  if (ds.seg) {
    ui.draft[ds.seg] = ds.val;
    if (S.account && (ds.seg === 'results' || ds.seg === 'photo')) {
      act({ type: 'consent', consent: { [ds.seg]: ds.val } }, 'Настройка сохранена');
    } else {
      renderFlow();
    }
    document.querySelector(`[data-seg="${ds.seg}"][data-val="${ds.val}"]`)?.focus();
    return;
  }
  if (ds.sw) {
    const on = t.getAttribute('aria-checked') !== 'true';
    if (ds.sw === 'publish-live') {
      act({ type: 'consent', consent: { publish: on } }, on ? 'Согласие на публикацию дано' : 'Согласие на публикацию отозвано');
      document.querySelector('[data-sw="publish-live"]')?.focus();
      return;
    }
    ui.draft[ds.sw] = on;
    renderFlow();
    document.querySelector(`[data-sw="${ds.sw}"]`)?.focus();
    return;
  }
  if (ds.q) {
    ui.query = ds.q;
    renderFlow();
    $('jn-q')?.focus();
    return;
  }
  if (ds.pick) {
    if (ui.selected.has(ds.pick)) ui.selected.delete(ds.pick); else ui.selected.add(ds.pick);
    $('jn-results').innerHTML = resultsHTML();
    refreshClaimButton();
    document.querySelector(`[data-pick="${CSS.escape(ds.pick)}"]`)?.focus();
    return;
  }
  if (ds.act === 'claim') {
    const ids = [...ui.selected].filter((id) => demoById[id]);
    if (act({ type: 'claim', pid: pid(), records: ids }, 'Отправлено админу: история ждёт подтверждения')) {
      ui.editClaim = false;
      ui.open = S.membership ? null : 3;
      renderFlow();
      focusStep(ui.open || 2);
    }
    return;
  }
  if (ds.act === 'notfound') {
    if (act({ type: 'notfound', pid: pid() }, 'Отправлено админу: «Меня нет в списке»')) {
      ui.editClaim = false;
      ui.open = S.membership ? null : 3;
      renderFlow();
      focusStep(ui.open || 2);
    }
    return;
  }
  if (ds.act === 'edit-claim' || ds.act === 'answer') {
    ui.editClaim = true;
    ui.selected = new Set(S.claim && S.claim.kind === 'records' ? S.claim.records : []);
    ui.open = 2;
    renderFlow();
    focusStep(2);
    return;
  }
  if (ds.act === 'cancel-edit') {
    ui.editClaim = false;
    renderFlow();
    focusStep(2);
    return;
  }
  if (ds.qa) {
    const id = ds.id;
    if (ds.qa === 'ask') { ui.asking = id; renderAdmin(); document.getElementById(`ask-${id}`)?.focus(); return; }
    if (ds.qa === 'ask-cancel') { const was = ui.asking; ui.asking = null; renderAdmin(); document.querySelector(`[data-qa="ask"][data-id="${was}"]`)?.focus(); return; }
    const msg = { confirm: 'Склейка подтверждена', reject: 'Отклонено', unmerge: 'Разъединено: записи снова отдельно', reopen: 'Заявка вернулась в очередь' }[ds.qa];
    act({ type: ds.qa, id }, msg);
    focusQueue(id);
    return;
  }
  if (ds.qm) {
    act({ type: 'member', id: ds.id, decision: ds.qm }, 'Решение по членству внесено');
    focusQueue(ds.id);
    return;
  }
  if (ds.chk) {
    const on = !S.checks[ds.chk];
    act({ type: 'check', key: ds.chk, on, label: ds.label }, on ? 'Взято на сверку' : 'Снято со сверки');
    document.querySelector(`[data-chk="${CSS.escape(ds.chk)}"]`)?.focus();
    return;
  }
  if (t.id === 'jn-reset') {
    S = initialState(DEMO_QUEUE);
    save();
    ui.open = 1; ui.editClaim = false; ui.selected = new Set(); ui.asking = null; ui.query = p0.last;
    ui.draft.code = ''; ui.draft.pd = false; ui.draft.publish = false; ui.draft.path = null; ui.draft.amateur = false;
    render();
    say('Регистрация начата заново');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

function focusStep(k) {
  const h = document.querySelector(`#jn-step-${k} .jn-step__head`);
  if (h) h.focus({ preventScroll: false });
}
function focusQueue(id) {
  const el = document.querySelector(`#jn-${CSS.escape(id)} .jn-actions button`);
  if (el) el.focus({ preventScroll: true });
}
function refreshClaimButton() {
  const b = $('jn-claim');
  if (!b) return;
  const n = ui.selected.size;
  b.disabled = !n;
  b.textContent = `Да, это я${n ? ` · ${n} ${plural(n, 'запись', 'записи', 'записей')}` : ''}`;
}

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'jn-q') {
    ui.query = t.value;
    $('jn-results').innerHTML = resultsHTML();
    return;
  }
  if (t.dataset && t.dataset.draft) {
    ui.draft[t.dataset.draft] = t.value;
    if (t.dataset.draft === 'birth' || t.dataset.draft === 'pairYears') {
      const el = $('jn-elig');
      if (el) el.innerHTML = eligHTML(eligibility({ birth: ui.draft.birth, pairYears: ui.draft.pairYears, amateur: ui.draft.amateur }, todayIso()));
    }
  }
});

document.addEventListener('submit', (e) => {
  const f = e.target;
  e.preventDefault();
  if (f.id === 'jn-f-account') {
    const d = ui.draft;
    const err = [];
    if (!d.first.trim() || !d.last.trim()) err.push('Впишите имя и фамилию.');
    if (String(d.phone).replace(/\D/g, '').length < 10) err.push('Проверьте телефон: нужно 10–11 цифр.');
    if (!/^\d{4}$/.test(d.code)) err.push('Код из СМС — четыре цифры.');
    if (!d.pd) err.push('Без согласия на обработку персональных данных аккаунт не создать.');
    const box = $('jn-err-1');
    if (err.length) { box.textContent = err.join(' '); box.hidden = false; return; }
    if (act({ type: 'account', first: d.first, last: d.last, phone: d.phone, consent: { pd: true, publish: d.publish, results: d.results, photo: d.photo } }, 'Аккаунт создан')) {
      ui.query = d.last.trim();
      ui.open = 2;
      renderFlow();
      focusStep(2);
    }
    return;
  }
  if (f.id === 'jn-f-member') {
    const d = ui.draft;
    const path = d.path || (S.claim && S.claim.kind === 'records' ? 'member' : 'new');
    const el = eligibility({ birth: d.birth, pairYears: d.pairYears, amateur: d.amateur }, todayIso());
    const box = $('jn-err-3');
    if (el.items.some((x) => x.ok === null)) { box.textContent = 'Заполните анкету: дату рождения, опыт парной игры и отметку о профессиональных турнирах.'; box.hidden = false; return; }
    // Даже если по анкете что-то «не подходит», заявку можно отправить: решает лига, а не сайт.
    if (act({ type: 'membership', pid: pid(), path, invite: d.invite, form: { birth: d.birth, pairYears: d.pairYears, hand: d.hand, backhand: d.backhand, amateur: d.amateur } }, 'Заявка на членство отправлена')) {
      ui.open = 0;
      renderFlow();
      $('jn-status').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('jn-status-title')?.setAttribute('tabindex', '-1');
      $('jn-status-title')?.focus({ preventScroll: true });
    }
    return;
  }
  if (f.dataset.askform) {
    const id = f.dataset.askform;
    const note = f.querySelector('textarea').value;
    ui.asking = null;
    if (!act({ type: 'ask', id, note }, 'Вопрос отправлен игроку')) renderAdmin();
    focusQueue(id);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.asking) { const was = ui.asking; ui.asking = null; renderAdmin(); document.querySelector(`[data-qa="ask"][data-id="${was}"]`)?.focus(); }
});

// Другая вкладка: админ подтвердил — игрок видит сразу
window.addEventListener('storage', (e) => {
  if (e.key === JOIN_KEY || e.key === null) { S = load(); render(); }
});
onIdentityChange(() => { ui.asking = null; render(); });

render();
