// Ряд «Участники · Группы · Сетка · Расписание · Результаты» — на всех страницах турнира,
// чтобы человек всегда видел, где он. Вид — общий (.ttabs в admin.css).
// Подписи — из мира и общего состояния: что сделали на одной странице турнира, видно на всех трёх.
import { D, state, esc, icon, keepTheme, MON_GEN, openSheet, closeLayer } from '../admin.js';
import { matchNow } from './tournament.data.js';

const dm = (iso) => `${+iso.slice(8)} ${MON_GEN[+iso.slice(5, 7) - 1]}`;
export const TABS = [
  { key: 'pairs', t: 'Участники' },
  { key: 'groups', t: 'Группы' },
  { key: 'bracket', t: 'Сетка' },
  { key: 'schedule', t: 'Расписание' },
  { key: 'results', t: 'Результаты' },
];
const isLive = (tid) => tid === 'jun-3';

export function tabHref(tid, key) {
  if (key === 'schedule') return isLive(tid) ? 'schedule.html' : 'schedule.html?t=jul-4';
  if (key === 'results') return isLive(tid) ? 'results.html' : 'results.html?t=jul-4';
  return `tournament.html?t=${tid}&step=${key}`;
}

// Группы и сетка «Июльского кубка» словами: «черновик», «видно игрокам», «есть правки»
const same = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
export function groupsWord(tid) {
  const g = state.get(`groups.${tid}`);
  if (!g || !g.groups) return { s: dm(D.tournament(tid).draw) };
  if (g.state !== 'shown') return { s: 'черновик' };
  return same(g.groups, g.shown) ? { done: true, s: 'видно игрокам' } : { s: 'есть правки' };
}
export function bracketWord(tid) {
  const b = state.get(`bracket.${tid}`);
  if (!b) return { s: 'после групп' };
  return b.state === 'shown' ? { done: true, s: 'видно игрокам' } : { s: 'черновик' };
}
function scheduleWord(tid) {
  const st = D.stageNow(tid);
  const days = D.daysNow(tid);
  const pub = st.play.filter((d) => days[d] && days[d].state === 'published').length;
  if (pub) return { done: pub === st.play.length, s: `опубликовано ${pub} из ${st.play.length}` };
  if (Object.keys(days).length) return { s: 'черновик' };
  return { s: `с ${dm(st.play[0])}` };
}

export function tabStates(tid, over = {}) {
  const st = D.stageNow(tid);
  if (isLive(tid)) {
    const done = D.MATCHES.filter((m) => matchNow(m.id).state === 'done').length;
    return {
      pairs: { done: true, s: `${D.PAIRS.length} из ${st.slots || 16}` },
      groups: { done: true, s: 'видно игрокам' },
      bracket: { done: true, s: 'видно игрокам' },
      schedule: { now: true, s: 'идёт сейчас' },
      results: { s: `${done} из ${D.MATCHES.length}` },
      ...over,
    };
  }
  return {
    pairs: { now: true, s: 'идёт сейчас' },
    groups: groupsWord(tid),
    bracket: bracketWord(tid),
    schedule: scheduleWord(tid),
    results: { s: 'нет матчей' },
    ...over,
  };
}

// inPage — вкладки, которые переключаются на этой же странице (кнопки), остальные — ссылки.
// На телефоне вместо ряда — кнопка «Шаг 4 из 5: Расписание» (нажали — шторка со всеми шагами)
// и две кнопки со словами: «‹ Сетка», «Результаты ›» (ряд из пяти на узком экране резал слова по краю).
let shown = null; // что нарисовано сейчас — для шторки «Шаги турнира»
export function tabsHtml(tid, current, { states, inPage = [] } = {}) {
  const S = states || tabStates(tid);
  shown = { tid, current, S, inPage };
  const go = (x, cls, inner, label) => (inPage.includes(x.key)
    ? `<button type="button" class="${cls}" data-step="${x.key}" aria-label="${esc(label)}">${inner}</button>`
    : `<a class="${cls}" href="${esc(keepTheme(tabHref(tid, x.key)))}" aria-label="${esc(label)}">${inner}</a>`);
  const strip = `<nav class="ttabs" aria-label="Разделы турнира"><ol>${TABS.map((x) => {
    const st = S[x.key] || {};
    const cur = x.key === current;
    const inner = `<span class="tt-t">${st.done ? icon('check') : ''}<span>${esc(x.t)}</span></span><span class="tt-s${st.now ? ' now' : ''}">${esc(st.s || '')}</span>`;
    const attrs = `class="ttab${st.done ? ' done' : ''}${st.now ? ' is-now' : ''}"${cur ? ' aria-current="page"' : ''}`;
    return `<li>${inPage.includes(x.key)
      ? `<button type="button" ${attrs} data-step="${x.key}">${inner}</button>`
      : `<a ${attrs} href="${esc(keepTheme(tabHref(tid, x.key)))}">${inner}</a>`}</li>`;
  }).join('')}</ol></nav>`;
  const i = Math.max(0, TABS.findIndex((x) => x.key === current));
  const now = TABS[i]; const st = S[now.key] || {};
  const prev = TABS[i - 1]; const next = TABS[i + 1];
  // одной строкой: «‹ Сетка» · «Расписание / шаг 4 из 5» (все шаги — шторкой) · «Результаты ›»
  const phone = `<nav class="ttabs-m" aria-label="Разделы турнира">
    ${prev ? go(prev, 'btn quiet tm-go prev', `${icon('back')}<span>${esc(prev.t)}</span>`, `Шаг ${i}: ${prev.t}`) : '<span></span>'}
    <button type="button" class="tm-cur" data-steps aria-haspopup="dialog" aria-label="Шаг ${i + 1} из ${TABS.length}: ${esc(now.t)}${st.s ? `, ${esc(st.s)}` : ''}. Все шаги"><b>${esc(now.t)}</b><span class="tm-n">шаг ${i + 1} из ${TABS.length}${icon('down')}</span></button>
    ${next ? go(next, 'btn quiet tm-go next', `<span>${esc(next.t)}</span>${icon('chev')}`, `Шаг ${i + 2}: ${next.t}`) : '<span></span>'}
  </nav>`;
  return strip + phone;
}
// Шторка «Шаги турнира» (телефон): все пять шагов строками; шаг на этой же странице — его кнопкой в ряду
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-steps]') || !shown) return;
  const { tid, current, S, inPage } = shown;
  const rows = TABS.map((x, i) => {
    const st = S[x.key] || {}; const cur = x.key === current;
    const inner = `<span class="num tm-i">${i + 1}</span><span class="grow"><span class="t">${st.done ? icon('check') : ''}${esc(x.t)}</span><span class="s">${esc(st.s || '')}</span></span>${cur ? '<span class="tm-here">Вы здесь</span>' : icon('chev', 'go')}`;
    const attrs = `class="row tm-row"${cur ? ' aria-current="step"' : ''}`;
    return `<li>${inPage.includes(x.key) ? `<button type="button" ${attrs} data-goto-step="${x.key}">${inner}</button>` : `<a ${attrs} href="${esc(keepTheme(tabHref(tid, x.key)))}">${inner}</a>`}</li>`;
  }).join('');
  const s = openSheet({ title: 'Шаги турнира', body: `<ol class="list tm-list">${rows}</ol>` });
  s.addEventListener('click', (ev) => {
    const g = ev.target.closest('[data-goto-step]'); if (!g) return;
    closeLayer(true);
    if (g.dataset.gotoStep === current) return;
    const t = document.querySelector(`.ttabs [data-step="${g.dataset.gotoStep}"]`); if (t) t.click();
  });
});
// на телефоне ряд листается вбок: открытая вкладка — на виду
export function showCurrentTab(root = document) {
  const nav = root.querySelector('.ttabs ol'); const cur = nav && nav.querySelector('[aria-current="page"]');
  if (cur && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = cur.parentElement.offsetLeft - 16;
}
