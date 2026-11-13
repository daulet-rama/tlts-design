// TLTS · ideas.html — витрина идей сверх утверждённого.
// Данные — ideas/ideas.data.js (собирает ideas/tools/build-ideas.py из разборов критиков и архива),
// расчёты — ideas/ideas.logic.js (тесты: ideas/tests/ideas.test.mjs).

import { mountProtoBar, mountIdeaNote } from './core/protobar.js';
import { IDEAS_DATA as D } from './ideas/ideas.data.js';
import { annotate, headline, filterIdeas, sortIdeas, questionsText, FILTERS, RULE, plural } from './ideas/ideas.logic.js';

mountProtoBar({ current: 'ideas', demo: false });   // на витрине нет выдуманных игроков
mountIdeaNote(null, {
  kind: 'overview',   // метка «Обзор» (основа, О8); пока основа её не знает — плашка как раньше
  title: 'Витрина идей',
  why: 'Это рассказ о том, что предложено сверх основы прототипа. Ни одна из этих идей пока не утверждена.',
  href: false,
});

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* без хранилища просто не запоминаем */ } };
const LS_FILTER = 'tlts-ideas-filter', LS_SORT = 'tlts-ideas-sort';

const ALL = annotate(D);
const H = headline(D);
const byId = Object.fromEntries(ALL.map((i) => [i.id, i]));
const CRITIC = Object.fromEntries(D.critics.map((c) => [c.id, c]));

const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const PLACE = {
  built: { label: 'Собрано', cls: 'built' },
  waiting: { label: 'Ждёт решений лиги', cls: 'waiting' },
  rejected: { label: 'Отклонено', cls: 'rejected' },
};
const SRC = {
  checked: 'пересчитано по архиву',
  rules: 'из документов лиги',
  authors: 'расчёт авторов идеи, не перепроверен',
};

/* ------------------------------------------------------------------ 00 · три числа и полоса идей */

function renderHero() {
  $('id-big').innerHTML = [
    [H.total, plural(H.total, 'идея придумана', 'идеи придуманы', 'идей придумано'), `из ${D.rawIdeas} черновых после объединения повторов`],
    [H.approved, 'одобрено критиками', `${H.built} собраны на ${H.screens} экранах, ${H.waiting} ждут решений лиги`],
    [H.rejected, 'отклонено', 'с причинами — в разделе 05'],
  ].map(([n, label, sub], k) => `<div class="id-big__item${k === 2 ? ' is-off' : ''}">`
    + `<span class="id-big__n">${n}</span>`
    + `<span class="id-big__label">${esc(label)}</span>`
    + `<span class="id-big__sub">${esc(sub)}</span></div>`).join('');

  // 14 ромбов: залитый — собрано, контур — ждёт лигу, перечёркнутый — отклонено
  $('id-strip').innerHTML = ALL.map((i) => `<button type="button" class="id-gem id-gem--${i.place}" data-go="${i.id}"`
      + ` aria-label="${esc(`${i.n}. ${i.title} — ${PLACE[i.place].label.toLowerCase()}, оценка ${i.tally.avgText}`)}" title="${esc(`${i.n}. ${i.title} · ${i.tally.avgText}`)}">`
      + `<span class="id-gem__mark" aria-hidden="true"></span><span class="id-gem__n" aria-hidden="true">${i.n}</span></button>`).join('')
    + `<p class="id-strip__legend" aria-hidden="true"><span><i class="id-gem__mark id-gem--built"></i>собрано</span>`
    + `<span><i class="id-gem__mark id-gem--waiting"></i>ждёт лигу</span><span><i class="id-gem__mark id-gem--rejected"></i>отклонено</span></p>`;
  $('id-strip').addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) goToIdea(b.dataset.go);
  });
}

/* ------------------------------------------------------------------ 01 · как шёл отбор */

function renderFlow() {
  const steps = [
    { n: D.rawIdeas, h: 'Четыре автора', body: `<ul class="id-flow__list">${D.authors.map((a) => `<li><b>${esc(a.name)}.</b> ${esc(a.asks)}</li>`).join('')}</ul>`, foot: 'по пять идей у каждого' },
    { n: H.total, h: 'Редактор', body: '<p>Слил повторы (например, две идеи о дожде и темпе дня стали одной), перепроверил главные цифры по архиву и пометил те, что не проверял.</p>', foot: 'идей после объединения' },
    { n: 3, h: 'Три критика', body: `<ul class="id-flow__list">${D.critics.map((c) => `<li><b>${esc(c.name)}.</b> ${esc(c.asks)}</li>`).join('')}</ul>`, foot: 'балл от 1 до 10, «да» или «нет», серьёзный риск' },
    { n: H.approved, h: 'Правило', body: `<p>Идея проходит, если её одобрили <b>минимум ${RULE.minYes}</b> критика из трёх и <b>никто</b> не нашёл серьёзного риска. Условия критиков обязательны; как они учтены — в плашке каждого экрана.</p>`, foot: `прошли, ${H.rejected} — нет` },
  ];
  $('id-flow').innerHTML = steps.map((s, k) => `<li class="id-flow__step">`
    + `<p class="id-flow__n"><span class="num">${s.n}</span><span class="cap">${esc(s.foot)}</span></p>`
    + `<h3 class="id-flow__h"><span class="cap">Шаг ${k + 1}</span>${esc(s.h)}</h3>${s.body}</li>`).join('');

  $('id-tone').innerHTML = '<p class="cap cap--strong">Что критики потребовали от всех идей сразу</p>'
    + '<ul class="id-tone__list">'
    + '<li><b>Без подачи как у букмекера.</b> Лига — «одна большая семья», а Кодекс поведения (пункт 2.13) запрещает букмекерские пари. Поэтому ни у одной пары и ни у одного человека нет процента побед и ярлыка «кто сильнее».</li>'
    + '<li><b>Без надзора.</b> Ни крупных таймеров у игроков, ни публичных списков опоздавших, ни автоматических наказаний.</li>'
    + '<li><b>Решают люди.</b> Сайт считает и подсказывает, а решение принимают главный судья, директор турнира или Совет — и это видно на каждом экране.</li>'
    + '<li><b>Настоящие люди — с осторожностью.</b> У игроков архива только монограммы и факты из открытых результатов; лица — только у выдуманных демо-игроков.</li>'
    + '</ul>';
}

/* ------------------------------------------------------------------ 02 · пять экранов */

function scoreLine(i) {
  return `<span class="id-score"><b class="num">${i.tally.avgText}</b><span> из 10 · одобрили ${i.tally.yes} из ${i.tally.of}</span></span>`;
}

function renderScreens() {
  $('id-built-meta').textContent = `${H.built} ${plural(H.built, 'идея', 'идеи', 'идей')} · ${H.screens} экранов`;
  $('id-screens').innerHTML = D.screens.map((s, k) => {
    const ideas = s.ideas.map((id) => byId[id]);
    return `<article class="id-scr" id="scr-${s.key}" aria-labelledby="scr-${s.key}-t">`
      + `<header class="id-scr__head"><p class="id-scr__idx"><span class="num">0${k + 1}</span><span class="tag tag--idea">Моя идея</span></p>`
      + `<h3 class="id-scr__title" id="scr-${s.key}-t"><a href="${esc(s.file)}" class="id-scr__link">${esc(s.title)}</a></h3>`
      + `<ul class="id-scr__ideas">${ideas.map((i) => `<li>${ideas.length > 1 ? `<span class="id-scr__iname">${esc(i.title)}</span>` : ''}${scoreLine(i)}</li>`).join('')}</ul></header>`
      + `<p class="id-scr__phrase">${esc(s.phrase)}</p>`
      + `<div class="id-anchor"><p class="id-anchor__n">${esc(s.anchor.n)}</p><p class="id-anchor__t">${esc(s.anchor.text)}</p>`
      + `<p class="cap id-anchor__src id-anchor__src--${s.anchor.src}">${esc(SRC[s.anchor.src])}</p></div>`
      + `<p class="id-scr__rule">${esc(s.rule)}</p>`
      + `<details class="id-scr__changed"><summary><span>Изменено по требованию критиков</span><span class="num">${s.changed.length}</span></summary>`
      + `<ol>${s.changed.map((c) => `<li>${esc(c)}</li>`).join('')}</ol></details>`
      + `<a class="btn btn--primary id-scr__open" href="${esc(s.file)}">Открыть экран ${ARROW}</a>`
      + `</article>`;
  }).join('');
  // на компьютере списки изменений и сверка (раздел 07) открыты сразу, на телефоне — по касанию
  const wide = window.matchMedia('(min-width: 900px)');
  const syncOpen = () => document.querySelectorAll('.id-scr__changed, #id-chk-fold').forEach((d) => { d.open = wide.matches; });
  syncOpen();
  wide.addEventListener('change', syncOpen);
}

/* ------------------------------------------------------------------ 03 · голоса */

let filterKey = FILTERS[lsGet(LS_FILTER)] ? lsGet(LS_FILTER) : 'all';
let sortKey = lsGet(LS_SORT) === 'score' ? 'score' : 'order';

function voteCell(i, cid) {
  const v = i.votes[cid];
  const c = CRITIC[cid];
  return `<div class="id-vote ${v.yes ? 'is-yes' : 'is-no'}${v.serious ? ' is-serious' : ''}" role="cell">`
    + `<span class="id-vote__who cap">${esc(c.name.replace('Критик ', ''))}</span>`
    + `<span class="id-vote__score num">${v.score}</span>`
    + `<span class="id-vote__yes">${v.yes ? 'да' : 'нет'}</span>`
    + (v.serious ? '<span class="id-vote__risk">серьёзный риск</span>' : '')
    + `</div>`;
}

function renderVotes() {
  const counts = { all: ALL.length, built: 0, waiting: 0, rejected: 0 };
  ALL.forEach((i) => { counts[i.place] += 1; });
  $('id-filter').innerHTML = Object.entries(FILTERS).map(([k, f]) => `<button class="seg__btn" type="button" data-filter="${k}" aria-pressed="${k === filterKey}">`
    + `<span>${esc(f.label)}</span><span class="id-seg__n num">${counts[k]}</span></button>`).join('');
  document.querySelectorAll('#id-sort [data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === sortKey)));

  const list = sortIdeas(filterIdeas(ALL, filterKey), sortKey);
  $('id-votes').innerHTML = `<div class="id-vrow id-vrow--head" role="row" aria-hidden="true"><span>Идея</span>`
    + D.critics.map((c) => `<span>${esc(c.name)}</span>`).join('') + '<span>Средняя</span><span>Итог по правилу</span></div>'
    + list.map((i) => {
      const where = i.place === 'built'
        ? `<a class="id-vrow__go" href="${esc(i.screen.file)}">${esc(i.screen.title)} ${ARROW}</a>`
        : `<a class="id-vrow__go" href="#${i.place === 'waiting' ? 'w' : 'r'}-${i.id}">${i.place === 'waiting' ? 'чего не хватает' : 'почему'} ${ARROW}</a>`;
      return `<div class="id-vrow id-vrow--${i.place}" role="row" id="v-${i.id}" tabindex="-1">`
        + `<div class="id-vrow__idea" role="cell"><span class="num id-vrow__n">${i.n}</span><span class="id-vrow__t">${esc(i.title)}</span></div>`
        + D.critics.map((c) => voteCell(i, c.id)).join('')
        + `<div class="id-vrow__avg" role="cell"><span class="cap">средняя</span><b class="num">${i.tally.avgText}</b></div>`
        + `<div class="id-vrow__res" role="cell"><span class="id-place id-place--${i.place}">${esc(PLACE[i.place].label)}</span>`
        + `<span class="id-vrow__why">${esc(i.tally.why)}</span>${where}</div>`
        + `</div>`;
    }).join('');
  $('id-votes').setAttribute('aria-label', `Показано идей: ${list.length}`);
}

function bindVotes() {
  $('id-rule').innerHTML = `Итог считается здесь же по правилу отбора: <b>минимум ${RULE.minYes} «да» из трёх</b> и <b>ни одного серьёзного риска</b>. Оценки и голоса взяты из сводных таблиц критиков как есть. Средняя — простое среднее трёх баллов.`;
  $('id-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    filterKey = b.dataset.filter; lsSet(LS_FILTER, filterKey); renderVotes();
  });
  $('id-sort').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sort]');
    if (!b) return;
    sortKey = b.dataset.sort; lsSet(LS_SORT, sortKey); renderVotes();
  });
}

function goToIdea(id) {
  const i = byId[id];
  if (!i) return;
  if (!FILTERS[filterKey].test(i)) { filterKey = 'all'; lsSet(LS_FILTER, filterKey); renderVotes(); }
  const row = $(`v-${id}`);
  if (!row) return;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  row.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  row.focus({ preventScroll: true });
  row.classList.remove('is-flash'); void row.offsetWidth; row.classList.add('is-flash');
}

/* ------------------------------------------------------------------ 04–05 · ждут лигу и отклонено */

function miniVotes(i) {
  return `<p class="id-card__votes">${D.critics.map((c) => {
    const v = i.votes[c.id];
    return `<span class="${v.yes ? 'is-yes' : 'is-no'}">${esc(c.name.replace('Критик ', ''))} <b class="num">${v.score}</b> ${v.yes ? 'да' : 'нет'}${v.serious ? ' · серьёзный риск' : ''}</span>`;
  }).join('')}</p>`;
}

function renderWaiting() {
  // порядок — как в задании к витрине (design/live-docs/IDEAS-PAGES.md, раздел 6)
  const list = Object.keys(D.waiting).map((id) => byId[id]).filter((i) => i && i.place === 'waiting');
  $('id-wait-meta').textContent = `${list.length} ${plural(list.length, 'идея', 'идеи', 'идей')}`;
  $('id-waiting').innerHTML = list.map((i) => {
    const w = D.waiting[i.id];
    return `<article class="id-card" id="w-${i.id}" aria-labelledby="w-${i.id}-t">`
      + `<header class="id-card__head"><span class="tag tag--idea">Моя идея</span>${scoreLine(i)}</header>`
      + `<h3 class="id-card__t" id="w-${i.id}-t">${esc(i.title)}</h3>`
      + `<p class="id-card__p">${esc(w.phrase)}</p>`
      + `<p class="cap cap--strong">Чего не хватает</p><ul class="id-card__list">${w.missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`
      + miniVotes(i) + `</article>`;
  }).join('');
}

function renderRejected() {
  const list = ALL.filter((i) => i.place === 'rejected');
  $('id-rej-meta').textContent = `${list.length} из ${ALL.length}`;
  $('id-rejected').innerHTML = list.map((i) => {
    const r = D.rejected[i.id];
    return `<article class="id-card id-card--rej" id="r-${i.id}" aria-labelledby="r-${i.id}-t">`
      + `<header class="id-card__head"><span class="id-place id-place--rejected">Отклонено</span><span class="id-score"><b class="num">${i.tally.avgText}</b><span> из 10 · ${esc(i.tally.why)}</span></span></header>`
      + `<h3 class="id-card__t" id="r-${i.id}-t">${esc(i.title)}</h3>`
      + `<p class="cap cap--strong">Почему</p><p class="id-card__p">${esc(r.reason)}</p>`
      + `<p class="cap cap--strong">Что сохранить</p><p class="id-card__p">${esc(r.kept)}</p>`
      + miniVotes(i) + `</article>`;
  }).join('');
}

/* ------------------------------------------------------------------ 06 · вопросы */

function renderQuestions() {
  $('id-q-meta').textContent = `${D.questions.length} ${plural(D.questions.length, 'вопрос', 'вопроса', 'вопросов')}`;
  $('id-qs').innerHTML = D.questions.map((q) => `<li class="id-q"><p class="id-q__q">${esc(q.q)}</p>`
    + (q.note ? `<p class="id-q__note">${esc(q.note)}</p>` : '')
    + `<p class="id-q__from cap">${q.ideas.map((id) => esc(byId[id]?.title)).join(' · ')}</p></li>`).join('');

  const msg = $('id-copy-msg');
  $('id-copy').addEventListener('click', async () => {
    const text = questionsText(D);
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* нет доступа — запасной путь ниже */ }
    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'vh';
      document.body.append(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    msg.textContent = ok ? `Скопировано: ${D.questions.length} ${plural(D.questions.length, 'вопрос', 'вопроса', 'вопросов')}. Можно вставить в письмо лиге.` : 'Браузер не дал скопировать. Выделите список вручную.';
  });
}

/* ------------------------------------------------------------------ 07 · сверка */

function renderChecks() {
  $('id-chk-count').textContent = String(D.checks.length);
  $('id-checks').innerHTML = D.checks.map((c) => `<article class="id-chk ${c.ok ? 'is-ok' : 'is-diff'}">`
    + `<p class="id-chk__state"><span class="id-chk__mark" aria-hidden="true">${c.ok ? '=' : '≠'}</span>${c.ok ? 'совпало' : 'не совпало'}</p>`
    + `<h3 class="id-chk__what">${esc(c.what)}</h3>`
    + `<dl class="id-chk__nums"><div><dt class="cap">В тексте идеи</dt><dd class="num">${esc(c.stated)}</dd></div>`
    + `<div><dt class="cap">Мой пересчёт</dt><dd class="num">${esc(c.got)}</dd></div></dl>`
    + (c.note ? `<p class="id-chk__note">${esc(c.note)}</p>` : '')
    + `<p class="cap id-chk__idea">${esc(byId[c.idea]?.title || '')}</p></article>`).join('');
}

renderHero();
renderFlow();
renderScreens();
bindVotes();
renderVotes();
renderWaiting();
renderRejected();
renderQuestions();
renderChecks();

// ссылка вида ideas.html#v-m-corridor открывает строку голосов
if (location.hash.startsWith('#v-')) goToIdea(location.hash.slice(3));
