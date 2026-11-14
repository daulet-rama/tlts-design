// «Результаты»: проверить счёт всех матчей и исправить ошибку.
// Счёт — факт матча: сохранённый и исправленный счёт игроки видят сразу (ЧТО-КУДА, правило 2).
// Исправление не стирает прежний счёт: строка помечена «Счёт исправлен · было 6:4», причина — в журнал.
// Матч — пара над парой, как плашка «пара против пары» в приложении; фамилии не сжимаются.
// Места в группе — по правилам лиги (app-v2/js/tour.logic.js, как в приложении).
// Счёт — в общем состоянии: scores.<матч> = { sets, winner, was, why, confirmed } со строкой журнала.
// Тот же счёт видят «Сегодня» (там подтверждают и исправляют матч за 5–8 места), «Расписание» и «День турнира».
import { D, state, esc, icon, toast, whereHtml, hydrate, fitText, keepTheme, dayWords, gen, MON_GEN, rangeShort, confirmAction, toMin } from '../admin.js';
import { rankGroup } from '../../app-v2/js/tour.logic.js';
import { GROUPS } from './tournament.logic.js';
import { matchNow, courtLow } from './tournament.data.js';
import { scorePad, scoreText, tbWords } from './tournament.score.js';
import { livePreview, appTab } from './tournament.preview.js';
import { tabsHtml, showCurrentTab } from './tournament.tabs.js';
import { stageNoNow } from './start.js';

const $ = (s, r = document) => r.querySelector(s);
const Q = new URLSearchParams(location.search);
const NO_MATCHES = Q.get('t') === 'jul-4';   // «Июльский кубок»: матчей ещё нет
const TID = NO_MATCHES ? 'jul-4' : 'jun-3';
const ST = D.stageNow(TID);               // этап сезона: даты и игровые дни — с переносом в календаре; запись
const TW = D.tournament(TID);
const dm = (iso) => `${+iso.slice(8)} ${MON_GEN[+iso.slice(5, 7) - 1]}`;
const ON_SRF = { clay: 'на грунте', hard: 'на харде', grass: 'на траве' };
const pv = livePreview($('#pv'));
const low1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// матч сейчас: мир, поверх — счёт из общего состояния
const cur = (id) => matchNow(id);
const all = () => D.MATCHES.map((m) => matchNow(m.id));
const fixOf = (m) => (m.score && m.score.was ? { was: m.score.was, reason: m.score.why } : null);
let last = null;         // последний исправленный — его показывает предпросмотр
let mode = { kind: 'list' };
// своё действие страница рисует сама; правку с «Сегодня», из другой вкладки и «Отменить» ловит подписка
let mine = 0;
const act = (fn) => { mine += 1; try { return fn(); } finally { mine -= 1; } };

const name = (id) => D.pairName(id);
const judgeSent = (id) => D.JUDGE.sent.includes(id);
const wFirst = (m) => scoreText(m.sets, m.winner);  // «6:4» — счёт победителя первым
// «полуфинала», «матча за 3-е место», «матча группы C» — для строки журнала
const GEN = { 'Финал': 'финала', 'Полуфинал': 'полуфинала', 'Четвертьфинал': 'четвертьфинала' };
const matchGen = (m) => GEN[m.title] || (/^За /.test(m.title) ? `матча ${low1(m.title)}` : /^Группа /.test(m.title) ? `матча группы ${m.title.slice(7)}` : `матча «${m.title}»`);

/* ---------- строки: пара над парой ---------- */
const two = (a, b, { lose } = {}) => `<span class="rpairs"><span class="rp${lose === 0 ? ' lose' : ''}">${esc(name(a))}</span><span class="rp${lose === 1 ? ' lose' : ''}">${esc(name(b))}</span></span>`;
function doneRow(m) {
  const meta = (m.round === 'group' ? [m.day] : [m.title, m.court ? courtLow(m.court) : '', m.time || '']).filter(Boolean).join(' · ');
  const fx = fixOf(m);
  const who = fx ? `<span class="tag warn">Счёт исправлен · было ${esc(fx.was)}</span>` : m.entered ? '<span class="tag ok">Счёт введён вами</span>' : m.score && m.score.confirmed ? '<span>подтверждён вами</span>' : judgeSent(m.id) ? '<span>прислал судья</span>' : '';
  const w = m.winner;
  return `<li class="row rrow" id="r-${m.id}"><span class="rsc"><span class="num">${esc(wFirst(m))}${m.sets[0][2] !== undefined ? `<sup>${m.sets[0][2]}</sup>` : ''}</span></span>
    <span class="grow">${two(m.pairs[w], m.pairs[1 - w], { lose: 1 })}<span class="s">${esc(meta)}${who ? ' · ' : ''}${who}</span></span>
    <span class="acts"><button class="btn text fix-link" type="button" data-fix="${m.id}" aria-label="Исправить счёт: ${esc(name(m.pairs[0]))} — ${esc(name(m.pairs[1]))}">Исправить</button></span></li>`;
}
function liveRow(m) {
  return `<li class="row rrow" id="r-${m.id}"><span class="rsc live"><span class="lv">Идёт</span><span class="num">${m.games[0]}:${m.games[1]}</span></span>
    <span class="grow">${two(m.pairs[0], m.pairs[1])}<span class="s">${esc(m.title)} · ${esc(courtLow(m.court))} · счёт ведёт судья корта</span></span></li>`;
}
function soonRow(m) {
  return `<li class="row rrow" id="r-${m.id}"><span class="rsc"><span class="num">${esc(m.time)}</span></span>
    <span class="grow">${two(m.pairs[0], m.pairs[1])}<span class="s">${esc(m.title)} · ${esc(courtLow(m.court))}</span></span>
    <span class="acts"><button class="btn quiet" type="button" data-enter="${m.id}">${icon('plus')}Ввести счёт</button></span></li>`;
}

/* ---------- группы: места и «почему так» ---------- */
function groupData(g) {
  const ids = D.PAIRS.filter((p) => p.group === g).map((p) => p.id);
  const ms = all().filter((m) => m.round === 'group' && m.group === g && m.state === 'done');
  return { ids, ms, all: ms.map((m) => [ids.indexOf(m.pairs[0]), ids.indexOf(m.pairs[1]), m.sets[0][0], m.sets[0][1]]) };
}
function whyGroup(G, r) {
  if (!r.ties.length) return 'Места — по числу побед, равных нет.';
  return r.ties.map((t) => {
    const who = t.members.map((i) => name(G.ids[i]));
    if (t.by === 'h2h') { const [a, b] = t.members; const m = t.h2h; const sc = m[0] === a ? `${m[2]}:${m[3]}` : `${m[3]}:${m[2]}`; return `У пар ${who.join(' и ')} поровну побед — выше ${name(G.ids[a])}: выиграли личную встречу ${sc}.`; }
    if (t.by === 'pct') return `У пар ${who.join(', ')} поровну побед — решил процент выигранных геймов.`;
    return `У пар ${who.join(' и ')} поровну побед — место утвердит главный судья.`;
  }).join(' ');
}
function groupCard(g) {
  const G = groupData(g); const r = rankGroup(G.ids.length, G.all);
  const before = D.groupTable(g).filter((x) => x.through).map((x) => x.pair).sort().join();
  const now = r.order.slice(0, 2).map((i) => G.ids[i]).sort().join();
  const changed = before !== now;
  // на телефоне столбца «Геймы» нет: геймы — строкой под парой
  const rows = r.order.map((i, k) => { const row = r.rows[i]; const id = G.ids[i]; return `<tr class="${k < 2 ? 'through' : ''}"><td class="num">${k + 1}</td><td><span class="who">${esc(name(id))}</span><span class="gm">геймы <span class="num">${row.gw}:${row.gl}</span></span></td><td class="num r">${row.w}</td><td class="num r">${row.gw}:${row.gl}</td></tr>`; }).join('');
  const ms = G.ms.map((m) => doneRow(m)).join('');
  return `<section class="rgroup" aria-label="Группа ${g}">
    <div class="table-wrap"><table class="table"><caption>Группа ${g}</caption><thead><tr><th>Место</th><th>Пара</th><th class="r">Победы</th><th class="r">Геймы</th></tr></thead><tbody>${rows}<tr class="why"><td colspan="4">Почему так: ${esc(whyGroup(G, r))}</td></tr></tbody></table></div>
    ${changed ? `<p class="note bad">${icon('alert')}<span>После исправления в плей-офф выходят другие пары, а четвертьфиналы уже сыграны. Сайт ничего не переставляет — решение за главным судьёй.</span></p>` : ''}
    <details class="rmatches"><summary>Матчи группы ${g} <span class="num">· ${G.ms.length}</span>${icon('down')}</summary><ul class="list">${ms}</ul></details>
  </section>`;
}

/* ---------- список ---------- */
const byTime = (a, b) => (a.time || '').localeCompare(b.time || '') || (a.court || '').localeCompare(b.court || '');
function listBody() {
  if (NO_MATCHES) return `<div class="empty"><span class="ic">${icon('cup')}</span><p>Матчей ещё нет. Счёт появится здесь с ${esc(dm(ST.play[0]))}</p><a class="btn quiet" href="${esc(keepTheme('results.html'))}">Результаты «${esc(gen('Июньский кубок'))}»</a></div>`;
  const list = all();
  const today = list.filter((m) => m.day === D.TODAY.dayMonth);
  const live = today.filter((m) => m.state === 'live');
  const soon = today.filter((m) => m.state === 'soon').sort(byTime);
  const done = today.filter((m) => m.state === 'done').sort(byTime).reverse();
  const qf = list.filter((m) => m.round === 'qf').sort(byTime);
  return `<div class="stack loose">
    <section class="sec" aria-labelledby="h-now"><div class="sec-head"><h2 class="h2" id="h-now">${esc(dayWords(D.TODAY.iso, { cap: true }))}</h2><span class="muted">сыграно ${done.length} из ${today.length}</span><button class="btn quiet preview-open" type="button">${icon('eye')}Посмотреть, как увидят</button></div>
      <ul class="list">${live.map(liveRow).join('')}${soon.map(soonRow).join('')}${done.map(doneRow).join('')}</ul></section>
    <section class="sec" aria-labelledby="h-qf"><div class="sec-head"><h2 class="h2" id="h-qf">${esc(dayWords('2027-06-18', { cap: true }))} · четвертьфиналы</h2></div><ul class="list">${qf.map(doneRow).join('')}</ul></section>
    <section class="sec" aria-labelledby="h-gr"><div class="sec-head"><h2 class="h2" id="h-gr">Группы · 12–14 июня</h2><span class="muted">места пересчитываются сами</span></div><div class="rgroups">${GROUPS.map(groupCard).join('')}</div></section>
    ${whereHtml([{ icon: 'phone', b: 'Приложение', s: '«Матч сыгран», «Турнир» → «Сетка» и «Группы», «Я» и «Игрок»' }, { icon: 'site', b: 'Сайт', s: 'матч, страница турнира, игрок' }, { icon: 'board', b: 'Табло в клубе', s: 'итог матча' }])}
  </div>`;
}

/* ---------- ввод и исправление ---------- */
let pad = null;
// «Полуфинал · Корт 1 · грунт · сегодня в 10:00» — строкой под заголовком ввода
function whereLine(m) {
  const c = m.court ? D.COURTS[m.court] : null;
  return [m.title, c ? D.courtLine(m.court) : '', m.day === D.TODAY.dayMonth ? `сегодня${m.time ? ' в ' + m.time : ''}` : m.day].filter(Boolean).join(' · ');
}
function entryBody() {
  return `<div class="wiz sc-wiz">
    <div id="pad" class="stack loose"></div>
    <div class="wiz-foot glass sc-foot"><span class="sum" id="sum"></span><div class="sc-btns"><button class="btn quiet back-btn" type="button" data-back>${icon('back')}Назад</button><button class="btn main" type="button" data-save>Сохранить счёт</button></div></div>
  </div>`;
}
function openEntry(id, fix) {
  mode = { kind: 'entry', id, fix };
  const u = new URL(location.href); u.searchParams.set('m', id); if (fix) u.searchParams.set('fix', '1'); else u.searchParams.delete('fix'); history.replaceState(null, '', u);
  // старая полоса «Сохранено» не закрывает кнопки нового экрана
  document.querySelectorAll('.toasts .toast').forEach((t) => t.remove());
  render();
  scrollTo({ top: 0 });
}
function closeEntry() {
  const id = mode.id;
  mode = { kind: 'list' };
  const u = new URL(location.href); u.searchParams.delete('m'); u.searchParams.delete('fix'); history.replaceState(null, '', u);
  render();
  const row = document.getElementById(`r-${id}`);
  if (row) { const d = row.closest('details'); if (d) d.open = true; row.scrollIntoView({ block: 'center' }); }
}
function paintFoot(api, msg) {
  const sum = $('#sum'); const btn = $('[data-save]');
  if (!sum || !btn) return;
  btn.innerHTML = `${icon('check')}${esc(api.button())}`;
  const r = api.get(); const miss = api.missing();
  const invalid = !msg && miss && /^Счёт \d/.test(miss);
  sum.classList.toggle('bad', !!msg || invalid);
  if (msg) sum.textContent = msg;
  else if (invalid) sum.textContent = 'Такого счёта не бывает — поправьте геймы';
  else if (r && !miss) {
    const m = cur(mode.id);
    sum.textContent = mode.fix ? `${fixWords(m, r)}. Игроки увидят сразу` : `${name(m.pairs[r.winner])} выиграли ${scoreText(r.sets, r.winner)}. Игроки увидят сразу`;
  } else sum.textContent = miss || '';
  pv.update();
}
// «Белов / Вершинин: было 6:4, станет 7:6»; победитель другой — обе пары словами
const fixWords = (m, r) => (r.winner === m.winner
  ? `${name(m.pairs[r.winner])}: было ${wFirst(m)}, станет ${scoreText(r.sets, r.winner)}`
  : `Было: ${name(m.pairs[m.winner])} ${wFirst(m)}. Станет: ${name(m.pairs[r.winner])} ${scoreText(r.sets, r.winner)}`);
// сохранить: scores.<матч> со строкой журнала; «Отменить» вернёт и счёт, и строку.
// Матч по программе ещё впереди — сначала вопрос: счёт будущего матча вводят по ошибке
function save(sure = false) {
  const miss = pad.missing();
  if (miss) { const sum = $('#sum'); sum.textContent = miss; sum.classList.add('bad'); return; }
  const r = pad.get(); const id = mode.id; const m = cur(id); const w = D.match(id); const isFix = !!mode.fix;
  if (!sure && !isFix && m.state === 'soon' && m.time && m.day === D.TODAY.dayMonth && toMin(m.time) > toMin(state.now())) {
    confirmAction({
      kind: 'main', title: `Матч по программе в ${m.time}. Записать счёт?`,
      text: `Сейчас ${state.now()}. Игроки сразу увидят: ${name(m.pairs[r.winner])} выиграли ${scoreText(r.sets, r.winner)}.`,
      action: `Записать счёт ${scoreText(r.sets, r.winner)}`, cancel: 'Назад', onConfirm: () => save(true),
    });
    return;
  }
  const prev = state.get(`scores.${id}`) || null;
  const text = `${name(m.pairs[r.winner])} — ${name(m.pairs[1 - r.winner])} ${scoreText(r.sets, r.winner)}`;
  const where = `${matchGen(m)}${m.court ? ` (${courtLow(m.court)})` : ''}`;
  const why = r.reason ? `. Причина — ${low1(r.reason)}` : '';
  const asWorld = w.state === 'done' && w.winner === r.winner && JSON.stringify(w.sets) === JSON.stringify(r.sets);
  let val; let say;
  if (isFix && asWorld) { val = prev && prev.confirmed ? { confirmed: true } : undefined; say = `вернули прежний счёт ${where}: ${text}${why}`; }
  else if (isFix) { const was = (prev && prev.was) || wFirst(m); val = { sets: r.sets, winner: r.winner, was, ...(r.reason ? { why: r.reason } : {}), confirmed: true }; say = `исправили счёт ${where}: ${text}, было ${was}${why}`; }
  else { val = { sets: r.sets, winner: r.winner, confirmed: true }; say = `ввели счёт ${where}: ${text}`; }
  last = id;
  const undo = act(() => state.set(`scores.${id}`, val, { say, href: `results.html?m=${id}` }));
  closeEntry();
  const row = document.getElementById(`r-${id}`); if (row) row.classList.add('just');
  toast(`${isFix ? 'Счёт исправлен' : 'Счёт сохранён'}: ${text}. Игроки видят сразу`, { undo });
}

/* ---------- предпросмотр ---------- */
// сыгранный матч — экран «Матч сыгран» приложения; несыгранный — его плашка в «Турнире»
function previewFor(id, pending) {
  const orig = D.match(id);
  const now = () => { const m = cur(id); if (pending && mode.kind === 'entry' && mode.id === id) { const r = pad && pad.get(); if (r) return { ...m, sets: r.sets, winner: r.winner, state: 'done' }; } return m; };
  const changed = () => { const m = now(); return m.state === 'done' && (orig.state !== 'done' || JSON.stringify(m.sets) !== JSON.stringify(orig.sets)); };
  const word = () => (mode.kind === 'entry' && mode.id === id ? (pad && pad.get() && !pad.same() ? 'Станет так' : 'Сейчас так') : fixOf(cur(id)) ? 'Исправлено' : cur(id).entered ? 'Новое' : 'Сейчас так');
  if (orig.state === 'done') {
    pv.show({
      page: `match-done.html?m=${id}`, title: 'Приложение: Матч сыгран',
      get banner() { return mode.kind === 'entry' ? 'Так игроки увидят матч после сохранения' : 'Так игроки видят матч сейчас'; },
      patch: (doc, mark) => {
        const m = now(); const w = m.winner; const s = m.sets[0];
        const fin = doc.getElementById('mx-final');
        [0, 1].forEach((i) => {
          const sd = fin && fin.querySelector(`.side[data-side="${i}"]`); if (!sd) return;
          sd.classList.toggle('lead', i === w); sd.classList.toggle('trail', i !== w);
          const n = sd.querySelector('.hero-num span'); if (n) n.textContent = s[i];
        });
        const rows = doc.querySelectorAll('#mx-record .record-row');
        const won = doc.querySelector('#mx-record .mx-won');
        rows.forEach((row, i) => {
          row.classList.toggle('win', i === w); row.classList.toggle('trail', i !== w);
          const n = row.querySelector('.num'); if (n) n.innerHTML = `${s[i]}${s[2] !== undefined && i !== w ? `<sup>${s[2]}</sup>` : ''}`;
          if (won && i === w) { const who = row.querySelector('.who'); if (who && !who.contains(won)) who.querySelector('.n')?.after(won); }
        });
        const say = doc.getElementById('mx-say');
        if (changed()) {
          if (say) say.textContent = `${name(m.pairs[w])} выиграли ${scoreText(m.sets, w)} · счёт исправлен`;
          ['flow', 'feed', 'stats', 'mx-segbar'].forEach((x) => { const e = doc.getElementById(x); if (e) e.hidden = true; });
          const only = doc.getElementById('mx-only'); if (only) { only.hidden = false; only.textContent = 'Счёт исправлен — ленты геймов нет, только итог'; }
        }
        mark(fin ? fin.closest('.match-hero') || fin : null, word());
      },
    });
    return;
  }
  // финал — в «Сетке», матч за 5-е место — в «Расписании»
  const tab = orig.round === 'cons' ? 'raspisanie' : 'setka';
  pv.show({
    page: 'tournament.html', title: 'Приложение: Турнир',
    get banner() { return mode.kind === 'entry' ? 'Так игроки увидят итог после сохранения' : 'Так игроки видят матч сейчас'; },
    patch: (doc, mark) => {
      appTab(doc, tab);
      const m = now();
      const t = doc.querySelector(`#pane-${tab} .mt[data-match="${id}"]`); if (!t) return;
      if (m.state === 'done') {
        t.dataset.state = 'done';
        t.querySelectorAll('.mt-srf, .mt-when').forEach((x) => x.remove());
        [0, 1].forEach((i) => {
          const sd = t.querySelector(`.mt-side[data-side="${i}"]`); if (!sd) return;
          sd.classList.toggle('win', i === m.winner); sd.classList.toggle('lose', i !== m.winner);
          let n = sd.querySelector('.mt-set'); if (!n) { n = doc.createElement('span'); n.className = 'num mt-set'; sd.append(n); }
          n.innerHTML = `${m.sets[0][i]}${m.sets[0][2] !== undefined && i !== m.winner ? `<sup>${m.sets[0][2]}</sup>` : ''}`;
        });
      }
      mark(t, word());
    },
  });
}

/* ---------- отрисовка ---------- */
function head(entry) {
  const tag = $('#r-tag'); const sub = $('#r-sub');
  if (entry) {
    const m = cur(mode.id);
    $('#r-title').textContent = mode.fix ? 'Исправить счёт' : 'Ввести счёт';
    tag.className = `tag lg ${mode.fix ? 'ok' : 'draft'}`; tag.textContent = mode.fix ? `Игроки видят ${wFirst(m)}${tbWords(m.sets)}` : 'Счёта ещё нет';
    $('#r-back').setAttribute('href', '#'); $('#r-back span').textContent = 'Результаты';
    sub.hidden = false; sub.textContent = whereLine(m);
    $('#tabs').hidden = true;
    return;
  }
  $('#r-title').textContent = ST.name;
  if (NO_MATCHES) { tag.className = 'tag lg ok'; tag.textContent = `Запись открыта · до ${dm(ST.signupTo)}`; } else { tag.className = 'tag lg live'; tag.textContent = 'Идёт · финальный день'; }
  $('#r-back').setAttribute('href', keepTheme('season.html')); $('#r-back span').textContent = 'Турниры';
  // одна строка под заголовком, без плавающей полосы
  sub.hidden = false;
  sub.innerHTML = NO_MATCHES ? `Этап ${stageNoNow(TID)} · ${esc(rangeShort(ST.from, ST.to))} · финалы ${ON_SRF[TW.surface]}` : `${icon('eye')}Счёт игроки видят сразу: приложение, сайт и табло в клубе`;
  $('#tabs').hidden = false;
  $('#tabs').innerHTML = tabsHtml(TID, 'results');
  showCurrentTab();
}
function render() {
  const body = $('#body');
  document.body.classList.toggle('sc-entry', mode.kind === 'entry');
  if (mode.kind === 'entry') {
    head(true);
    const m = cur(mode.id);
    body.innerHTML = entryBody();
    hydrate(body);
    pad = scorePad($('#pad'), { match: m, fix: mode.fix, onChange: (api, msg) => { const p = $('#pad'); if (!p) return; hydrate(p); requestAnimationFrame(() => { if (p.isConnected) fitText(p); }); paintFoot(api, msg); } });
    previewFor(mode.id, true);
    return;
  }
  pad = null;
  head(false);
  body.innerHTML = listBody();
  hydrate(body);
  requestAnimationFrame(() => fitText(body));
  document.title = `Результаты · ${ST.name} · Раздел организатора`;
  if (!NO_MATCHES) previewFor(last || 'sf1', false);
  else pv.show({ page: 'tournaments.html', title: 'Приложение: Турниры', banner: 'Так это видят игроки сейчас', patch: (doc, mark) => mark(doc.querySelector('#path > li.st-stage[data-state="open"]'), 'Здесь') });
}
// счёт подтвердили или исправили на «Сегодня», в другой вкладке, «Отменить» — список заново
let queued = false;
state.on('', () => { if (mine || queued || mode.kind !== 'list') return; queued = true; requestAnimationFrame(() => { queued = false; if (mode.kind === 'list') render(); }); });

document.addEventListener('click', (e) => {
  const f = e.target.closest('[data-fix]'); if (f) { openEntry(f.dataset.fix, true); return; }
  const n = e.target.closest('[data-enter]'); if (n) { openEntry(n.dataset.enter, false); return; }
  if (e.target.closest('[data-back]') || (mode.kind === 'entry' && e.target.closest('#r-back'))) { e.preventDefault(); closeEntry(); return; }
  if (e.target.closest('[data-save]')) save();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && mode.kind === 'entry' && !document.querySelector('.scrim')) closeEntry(); });

// прямая ссылка на ввод: results.html?m=sf1&fix=1 (сыгранный — исправить, будущий — ввести)
if (!NO_MATCHES && Q.get('m') && D.match(Q.get('m'))) {
  const m = cur(Q.get('m'));
  mode = m.state === 'done' ? { kind: 'entry', id: m.id, fix: true } : m.state === 'soon' ? { kind: 'entry', id: m.id, fix: false } : { kind: 'list' };
}
render();
