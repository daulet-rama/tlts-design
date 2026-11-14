// «Турнир» для турнира из мастера после публикации (?t=new-1; ?t=aug-5, если черновик мира опубликовали).
// Шаги работы те же — «Участники · Группы · Сетка · Расписание · Результаты», но пока пустые:
// заявок ещё нет, группы и сетка — после жеребьёвки, расписание — после групп.
// «Изменить» — мастер на проверке: правки лежат отдельно (cups.<турнир>.edit), игроки видят прежнее,
// пока их не покажут. «Снять с показа» — турнир снова черновик: его видите только вы.
// Всё — в общем состоянии (cups.<турнир>), со строкой журнала и «Отменить».
import {
  D, state, esc, icon, toast, openSheet, closeLayer, confirmAction, whereHtml, hydrate, keepTheme,
  rangeShort, rangeWords, MON_GEN, cap1,
} from '../admin.js';
import {
  getCup, putCup, stageNoNow, whereFor, courtsLine, ON_SURFACE, surfaceOf, daysShort, FORMATS, matchCount, matchesWord, patchSeasonPath,
} from './start.js';
import { TABS, tabsHtml, showCurrentTab } from './tournament.tabs.js';
import { livePreview } from './tournament.preview.js';

const $ = (s, r = document) => r.querySelector(s);
const Q = new URLSearchParams(location.search);
const TID = Q.get('t');
let step = TABS.some((x) => x.key === Q.get('step')) ? Q.get('step') : 'pairs';
const cup = () => getCup(TID);
const dm = (iso) => `${+iso.slice(8)} ${MON_GEN[+iso.slice(5, 7) - 1]}`;
const editHref = () => `new-tournament.html?cup=${TID}&edit=1`;
const stripEdit = (x) => { const { edit, ...rest } = x || {}; return rest; };
// правки, которые игроки ещё не видят
const EDIT_FIELDS = ['name', 'kind', 'from', 'to', 'courts', 'finalCourt', 'play', 'start', 'round', 'daySet', 'format', 'third', 'places', 'signupTo', 'draw', 'fee'];
const hasEdits = (c) => !!(c && c.edit && EDIT_FIELDS.some((f) => JSON.stringify(c.edit[f] ?? null) !== JSON.stringify(c[f] ?? null)));
const isStage = (c) => (c.kind || 'stage') === 'stage';
const kindWord = (c) => (isStage(c) ? `Этап ${stageNoNow(TID)}` : c.kind === 'final' ? 'Итоговый турнир сезона' : 'Отдельный турнир');

// ---------- шаги: подписи под названием шага ----------
function states(c) {
  const groups = c.format !== 'bracket';
  return {
    pairs: { now: true, s: 'идёт сейчас' },
    groups: { s: groups ? (c.draw ? dm(c.draw) : 'после записи') : 'без групп' },
    bracket: { s: groups ? 'после групп' : (c.draw ? dm(c.draw) : 'после записи') },
    schedule: { s: c.play && c.play.length ? `с ${dm(c.play.slice().sort()[0])}` : 'после жеребьёвки' },
    results: { s: 'нет матчей' },
  };
}

// ---------- шапка ----------
function renderHead(c) {
  $('#t-name').textContent = c.name;
  document.title = `${c.name} · Раздел организатора`;
  const tag = $('#t-tag');
  if (c.state === 'open') { tag.className = 'tag lg ok'; tag.textContent = c.signupTo ? `Запись открыта · до ${dm(c.signupTo)}` : 'Видно игрокам'; }
  else { tag.className = 'tag lg draft'; tag.textContent = 'Черновик — видите только вы'; }
  const srf = surfaceOf(c.finalCourt);
  $('#t-sub').textContent = [kindWord(c), c.from && c.to ? rangeShort(c.from, c.to) : '', srf ? `финал ${ON_SURFACE[srf]}` : ''].filter(Boolean).join(' · ');
  $('#t-act').innerHTML = ''; $('#t-act').hidden = true;
}

// ---------- «О турнире»: что видят игроки, одна кнопка «Изменить» ----------
function aboutHtml(c) {
  const first = c.play && c.play.length ? c.play.slice().sort()[0] : null;
  const rows = [
    ['Даты', c.from && c.to ? rangeWords(c.from, c.to) : ''],
    ['Корты', courtsLine(c.courts, c.finalCourt)],
    ['Игровые дни', c.play && c.play.length ? `${daysShort(c.play.slice().sort())}${first ? ` · начало ${(c.daySet && c.daySet[first] && c.daySet[first].start) || c.start}` : ''}` : ''],
    ['Формат', c.format ? `${cap1(FORMATS[c.format].short)} · 16 пар · ${matchesWord(matchCount(c).total)}` : ''],
    ['Запись', c.signupTo ? `До ${rangeShort(c.signupTo)}${c.draw ? ` · жеребьёвка ${rangeShort(c.draw)}` : ''} · сумма уровней пары ${D.RULES.corridor.map((x) => x.toFixed(1)).join('–')}` : ''],
    ...(c.fee ? [['Взнос', `${c.fee} с пары`]] : []),
  ];
  return `<section class="sec" aria-labelledby="h-about">
      <div class="sec-head"><h2 class="h2" id="h-about">О турнире</h2><a class="btn quiet" href="${esc(keepTheme(editHref()))}">${icon('edit')}Изменить</a></div>
      ${hasEdits(c) ? `<div class="note warn tc-edits">${icon('warn')}<span class="grow"><b>Есть правки — игроки их ещё не видят</b><a class="btn quiet" href="${esc(keepTheme(editHref()))}">${icon('edit')}Продолжить правку</a></span></div>` : ''}
      <dl class="review tc-about">${rows.map(([t, v]) => `<div class="rv"><dt>${esc(t)}</dt><dd class="${v ? '' : 'none'}">${v ? esc(v) : 'не указано'}</dd></div>`).join('')}</dl>
    </section>`;
}

// ---------- шаги ----------
const toPairs = `<button class="btn quiet" type="button" data-step="pairs">${icon('players')}Заявки пар</button>`;
const emptyHtml = (ic, line, btn) => `<div class="empty"><span class="ic">${icon(ic)}</span><p>${esc(line)}</p>${btn}</div>`;
function bodyHtml(c) {
  const until = c.signupTo ? rangeShort(c.signupTo) : '';
  const groups = c.format !== 'bracket';
  if (step === 'pairs') {
    return `<section class="sec" aria-labelledby="h-pairs">
        <div class="sec-head"><h2 class="h2" id="h-pairs">Заявки пар <span class="num">· 0 из 16</span></h2><button class="btn quiet preview-open" type="button">${icon('eye')}Посмотреть, как увидят</button></div>
        ${emptyHtml('players', `Заявок пока нет. Пары подают их в приложении${until ? ` до ${until}` : ''}`, `<button class="btn quiet" type="button" data-share>${icon('share')}Поделиться ссылкой на запись</button>`)}
      </section>
      ${aboutHtml(c)}
      ${whereHtml(whereFor(c, stageNoNow(TID)))}
      <div class="tc-off"><button class="btn quiet" type="button" data-unpublish>${icon('close')}Снять с показа</button></div>`;
  }
  const draw = c.draw ? rangeShort(c.draw) : '';
  if (step === 'groups') return emptyHtml('players', groups ? `Группы появятся после жеребьёвки${draw ? ` ${draw}` : ''}: сначала нужны принятые пары` : 'В этом турнире групп нет: пары сразу встают в сетку', toPairs);
  if (step === 'bracket') return emptyHtml('cup', groups ? 'Сетка появится после групп' : `Сетка появится после жеребьёвки${draw ? ` ${draw}` : ''}`, toPairs);
  if (step === 'schedule') return emptyHtml('calendar', `Расписание игровых дней составят после жеребьёвки${c.play && c.play.length ? `. Играют: ${daysShort(c.play.slice().sort())}` : ''}`, toPairs);
  return emptyHtml('cup', `Матчей ещё не было${c.play && c.play.length ? `. Первый игровой день — ${rangeShort(c.play.slice().sort()[0])}` : ''}`, toPairs);
}

// ---------- так увидят: «Путь сезона» в приложении и страница турнира на сайте ----------
const pv = livePreview($('#pv'));
function siteHtml(c) {
  return `<div class="site-t"><b>${esc(c.name)}</b><span>${esc(c.from && c.to ? rangeShort(c.from, c.to) : '')} · Список пар · 0 из 16</span></div>
    <p class="muted">Пар пока нет${c.signupTo ? `: запись до ${esc(rangeShort(c.signupTo))}` : ''}</p>`;
}
function refreshPreview(c) {
  pv.show({
    page: 'tournaments.html', title: 'Приложение: Турниры', banner: 'Так это видят игроки сейчас',
    patch: (doc, mark) => { const r = patchSeasonPath(doc); const li = r.li[TID]; if (li) mark(li.querySelector('.st-row') || li, 'Здесь'); },
    site: () => siteHtml(cup() || c),
  });
}

// ---------- черновик и нет турнира ----------
function renderDraft(c) {
  renderHead(c);
  $('#tabs').innerHTML = '';
  $('#body').innerHTML = emptyHtml('edit', 'Это черновик: игроки его не видят', `<a class="btn main" href="${esc(keepTheme(`new-tournament.html?draft=${TID}`))}">${icon('edit')}Открыть черновик</a>`);
  hydrate($('#body'));
  $('#pv').hidden = true;
}
function renderGone() {
  $('#t-name').textContent = 'Турнира нет';
  $('#t-tag').hidden = true; $('#t-sub').textContent = ''; $('#t-act').hidden = true;
  $('#tabs').innerHTML = '';
  $('#body').innerHTML = emptyHtml('calendar', 'Такого турнира нет в сезоне', `<a class="btn quiet" href="${esc(keepTheme('season.html'))}">${icon('calendar')}Открыть календарь</a>`);
  hydrate($('#body'));
  $('#pv').hidden = true;
}

function render() {
  const c = cup();
  if (!c || c.state === 'removed') { renderGone(); return; }
  if (c.state !== 'open') { renderDraft(c); return; }
  $('#pv').hidden = false;
  renderHead(c);
  $('#tabs').innerHTML = tabsHtml(TID, step, { states: states(c), inPage: TABS.map((x) => x.key) });
  showCurrentTab();
  $('#body').innerHTML = bodyHtml(c);
  hydrate($('#body'));
  refreshPreview(c);
}
function go(k) {
  step = k;
  const u = new URL(location.href); u.searchParams.set('step', k); history.replaceState(null, '', u);
  render();
  scrollTo({ top: 0 });
}

// ---------- действия ----------
function share() {
  const c = cup();
  const s = openSheet({
    title: 'Поделиться',
    body: `<div class="linkcard" data-srf="${surfaceOf(c.finalCourt) || 'clay'}"><div class="lc-top"><b>${esc(c.name)}</b></div><div class="lc-body"><b>${esc(rangeShort(c.from, c.to))}${isStage(c) ? ` · этап ${stageNoNow(TID)}` : ''}</b><span class="s">${esc(D.LEAGUE.name)}${c.signupTo ? ` · запись открыта до ${esc(rangeShort(c.signupTo))}` : ''}</span></div></div><p class="muted">Так ссылка выглядит в мессенджере</p>`,
    foot: `<button class="btn main" type="button" data-copy>${icon('copy')}Скопировать ссылку</button><button class="btn quiet" type="button" data-no>Готово</button>`,
  });
  s.querySelector('[data-copy]').addEventListener('click', () => { closeLayer(true); toast('Ссылка скопирована — вставьте её в чат'); });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
}
// Снять с показа: турнир — снова черновик (с правками, если они были). Игроки его больше не видят.
function unpublish() {
  const c = cup();
  confirmAction({
    title: `Снять «${c.name}» с показа?`,
    text: 'Турнир станет черновиком: его будете видеть только вы. Опубликовать снова можно из черновика.',
    consq: ['Турнир пропадёт из календаря на сайте и из приложения', 'Запись на турнир закроется', 'Заявок пока нет — никто не записан'],
    action: 'Снять с показа',
    onConfirm: () => {
      const rec = cup();
      const draft = { ...stripEdit(rec), ...(rec.edit ? stripEdit(rec.edit) : {}), state: 'draft', savedAt: `сегодня в ${state.now()}` };
      const undo = putCup(draft, { say: `сняли с показа турнир «${rec.name}»: теперь это черновик`, href: `new-tournament.html?draft=${TID}` });
      render();
      toast(`«${rec.name}» снят с показа — теперь это черновик. Игроки его не видят`, { undo });
    },
  });
}
document.addEventListener('click', (e) => {
  const st = e.target.closest('[data-step]');
  if (st && !st.closest('.sheet, .pop')) { go(st.dataset.step); return; }
  if (e.target.closest('[data-share]')) { share(); return; }
  if (e.target.closest('[data-unpublish]')) unpublish();
});
// турнир поменяли в мастере, в календаре, в другой вкладке или «Отменить» — здесь то же
let queued = false;
state.on(`cups.${TID}`, () => { if (queued) return; queued = true; setTimeout(() => { queued = false; render(); }, 0); });

render();
