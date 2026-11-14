// ============================================================
// «Сегодня» в игровой день — пульт дня сверху, дела ниже.
// Сегодня суббота, 19 июня — финальный день «Июньского кубка». Часы — общие часы примера
// (state.now(): 18:47 и минута на каждое сделанное дело, не дальше 19:04), те же, что на «Дне турнира».
// День — тот же, что на «Дне турнира» (day.html): матчи дня — мир вместе со сделанным
// (dayMatchesNow: перенос с «Расписания», счёт с «Результатов»), прогноз — тот же расчёт
// (tournament.logic.js) с решением по дождю и ранним вызовом (readyAt из tournament.calls.js),
// вывод «Идём по программе» / «Отстаём на …» — общее правило основы dayPace: на обеих страницах
// одни и те же слова.
// Путь на «День турнира» — кнопка «Вызов на корт» в шапке (ставит admin.js).
// Дела — по срочности, из общего состояния раздела: судьи (judges.<матч>), счёт (scores.<матч>),
// заявки пар и в лигу, черновики турниров (cups.<турнир>), новости и фото (contentTodos() раздела
// «Новости и фото»). Больше пяти — остальные за кнопкой «Ещё 2 дела». Сделанное уходит из списка
// строкой «Готово»; правка на другой странице или в другой вкладке видна сразу.
// Роль «Новости и фото» (today.html?role=news) видит только свои дела.
// ============================================================
import { D, state, esc, icon, hydrate, openSheet, closeLayer, toast, plural, choicesHtml, stateWords, rangeShort, MON_GEN, duoHtml, fitText, fixLinks, matchName, dayPace, dayPaceLine, gen } from '../admin.js';
import { $, seasonStages, courtsWords, pairsWord, tasksLeft, andList, openDrafts, cups, isNewId, byDate } from './start.js';

const NEWS_ONLY = document.body.dataset.role === 'news';
// Куда ведут кнопки: соседние разделы админки
const LINK = {
  judges: 'judges.html',
  pairs: 'tournament.html?t=jul-4&step=pairs',
  join: 'applications.html',
  draft: (id) => `new-tournament.html?draft=${id}`,
  schedule: 'schedule.html',
  tour: (id) => `tournament.html?t=${id}`,
};
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.round(min) % 60)}`;
const r5 = (min) => Math.round(min / 5) * 5;
// «25 минут» не рвётся строкой
const minWords = (n, acc) => `${n} ${plural(n, acc ? 'минуту' : 'минута', 'минуты', 'минут')}`;
const srfWord = (c) => D.SURFACES[D.COURTS[c].surface].label;
const nowMin = () => toMin(state.now());
// корт в тексте — как назван в «Настройках»: «корт 3», «корт Арена» (имя с заглавной остаётся)
const courtLow = (c) => { const n = D.COURTS[c].name; return n.charAt(0).toLowerCase() + n.slice(1); };
// «корты 4–5»; у корта название без номера — по именам: «корт 5 и корт Арена»
const freeWords = (ids) => (ids.every((c) => /\d/.test(D.COURTS[c].name)) ? courtsWords(ids) : andList(ids.map(courtLow)));

// ---------- кто судит матч дня — как на «Судьях и доступе» ----------
// judges.<матч>: id игрока или 'me'; null — судью сняли. Нет записи — как в мире: судья дня судит
// четыре матча, у финала судьи нет.
function judgeOf(id) {
  const v = state.get(`judges.${id}`);
  if (v !== undefined) return v;
  return D.JUDGE.matches.includes(id) ? D.JUDGE.player : null;
}
const personName = (pid) => { if (pid === 'me') return 'вы'; const p = D.player(pid); return p ? `${p.first} ${p.last}` : ''; };

// ---------- день: тот же мир и тот же расчёт, что на «Дне турнира» ----------
// Расчёты — файлы раздела турнира; не загрузились — пульт остаётся со словами мира («Финал в 20:00»).
let L = null; let T = null; let model = null;
try {
  [L, T] = await Promise.all([import('./tournament.logic.js'), import('./tournament.data.js')]);
  model = L.dayModel(T.stageScores(), T.todayPace().perGame);
} catch { L = null; T = null; model = null; }
// вызов на корт раньше обычного — в прогнозе, как на «Дне турнира»; не загрузился — прогноз по программе
let K = null;
try { K = await import('./tournament.calls.js'); } catch { K = null; }
// дела «Новостей и фото»
let C = null;
try { C = await import('./content.data.js'); } catch { C = null; }

const FIN_ID = 'final';
const SLOT = (L && L.SLOT_MIN) || D.RULES.slot || 50;
const LIMIT = D.RULES.callLimit || 20;
const RAIN = `days.jun-3.${D.TODAY.iso}.rain`;   // решение по дождю — его пишет «День турнира»
// матчи дня сейчас: мир и сделанное
const dayNow = () => (T ? T.dayMatchesNow() : D.DAY_MATCHES.map((m) => ({ ...m })));
const rainNow = () => { const r = state.get(RAIN); return r && r.pick ? r : null; };
// прогноз — как на «Дне турнира»: те же матчи, «сейчас» — часы примера, прогноз сервера для идущего матча;
// пары вызвали раньше обычного — матч начнётся, когда они выйдут на корт (ready), а не по программе
function forecast(day) {
  if (!L || !model) return null;
  try {
    const now = nowMin();
    const matches = day.map((m) => ({ id: m.id, court: m.court, at: toMin(m.time), state: m.state, pairs: m.pairs, length: m.duration ? parseInt(m.duration, 10) : SLOT, ready: K && m.state === 'soon' ? K.readyAt(m.id) : null }));
    const lv = day.find((m) => m.state === 'live');
    const live = lv && D.FORECAST[lv.id] ? { id: lv.id, left: Math.max(0, toMin(D.FORECAST[lv.id]) - now) } : null;
    const r = rainNow();
    if (r) {
      const o = L.rainOptions({ matches, now, model, live, from: r.from, to: r.to, lightEnd: toMin(D.TODAY.sunset) }).find((x) => x.key === r.pick);
      if (o) return { F: o.day, rain: { ...r, title: o.title } };
    }
    return { F: L.forecastDay({ matches, now, model, live }), rain: null };
  } catch { return null; }
}
// вызовы на корт — живые: мир и вызовы со страницы «День турнира» (calls.<матч>)
const calledAt = (id) => { const c = D.CALLS.find((x) => x.match === id); return c ? toMin(c.at) : null; };
// пары вызвали раньше обычного — матч начнётся раньше программы: около скольки (по прогнозу F), иначе null.
// Те же слова, что на «Дне турнира»: «Вызваны в 18:58 · начнут около 19:20», «Финал раньше — около 19:20»
function earlyStart(m, F) {
  const f = F && m.state === 'soon' ? F.byId.get(m.id) : null;
  if (!f) return null;
  const s = r5(f.start);
  return s <= toMin(m.time) - 5 ? s : null;
}

function drawDay() {
  const box = $('#tdy-day');
  $('#tdy-date .tdy-now-t').textContent = ` · сейчас ${state.now()}`;
  if (NEWS_ONLY) { box.hidden = true; return; }
  const day = dayNow();
  const live = day.filter((m) => m.state === 'live');
  const soon = day.filter((m) => m.state === 'soon').sort((a, b) => toMin(a.time) - toMin(b.time));
  const played = day.filter((m) => m.state === 'done').length;
  const fin = day.find((m) => m.id === FIN_ID);
  const fc = forecast(day); const F = fc ? fc.F : null;
  const now = nowMin();
  // как идёт день и успеваем ли до заката — то же правило и те же слова, что на «Дне турнира»
  let verdict = ''; let line = fin && fin.state !== 'done' ? `Финал в ${esc(fin.time)}` : 'Финал сыгран';
  if (F) {
    const P = dayPace(day, F, { slot: SLOT });
    verdict = `<p class="tdy-verdict ${P.ok ? 'ok' : 'warn'}">${icon(P.ok ? 'check' : 'warn')}<span>${esc(P.text)}</span></p>`;
    // те же слова, что на «Дне турнира»: «Финал вовремя — в 20:00 · конец дня около 20:45 · за 25 минут до заката»
    line = dayPaceLine(P);
  }
  const rainLine = fc && fc.rain ? `<p class="note warn tdy-rain">${icon('warn')}<span>Дождь ${hhmm(fc.rain.from)}–${hhmm(fc.rain.to)} · решение главного судьи: «${esc(fc.rain.title)}»</span></p>` : '';
  const fOf = (m) => (F ? F.byId.get(m.id) : null);
  const liveEnd = (m) => { const f = fOf(m); return f ? r5(f.end) : toMin(D.FORECAST[m.id] || m.time); };
  const liveCard = (m) => {
    const end = liveEnd(m); const f = fOf(m);
    const over = r5(end - (toMin(m.time) + SLOT));
    return `<article class="tdy-card" data-srf="${D.COURTS[m.court].surface}">
      <header class="tdy-ch"><b class="ct">${esc(D.COURTS[m.court].name)}</b><span class="muted">${esc(srfWord(m.court))} · ${esc(m.title)}</span><span class="tag live">Идёт</span></header>
      <div class="tdy-prs">${[0, 1].map((i) => `<div class="tdy-pr">${duoHtml(m.pairs[i])}<span class="nm">${esc(D.pairName(m.pairs[i]))}</span><b class="num sc">${m.games[i]}</b></div>`).join('')}</div>
      <p class="tdy-st"><b>Закончится около ${hhmm(end)}</b>${f && f.stopped ? ' · с перерывом на дождь' : over >= 5 ? ` · на ${minWords(over, true)} дольше программы` : ' · по программе'}</p>
    </article>`;
  };
  // вызов: вызваны — сколько прошло из 20 минут, а раньше обычного — когда начнут; не вызваны, а пора — так и сказано
  const callLine = (m) => {
    const f = fOf(m); const late = f ? r5(f.start - toMin(m.time)) : 0;
    const at = calledAt(m.id); const due = toMin(m.time) - LIMIT; const early = earlyStart(m, F);
    if (at != null && early != null) return `<b>Вызваны в ${hhmm(at)}</b> · начнут около ${hhmm(early)}`;
    if (at != null) return `<b>Вызваны в ${hhmm(at)}</b> · прошло ${Math.max(0, now - at)} мин из ${LIMIT}`;
    if (now >= due) return `<b>Пора вызывать на корт</b> · по программе с ${hhmm(due)}`;
    return `<b>${late >= 5 ? `Начнётся около ${hhmm(r5(f.start))}` : 'Начнётся вовремя'}</b> · вызов на корт в ${hhmm(due)}`;
  };
  const soonCard = (m) => `<article class="tdy-card soon" data-srf="${D.COURTS[m.court].surface}">
      <header class="tdy-ch"><b class="num tm">${esc(m.time)}</b><b class="ct">${esc(D.COURTS[m.court].name)}</b><span class="muted">${esc(srfWord(m.court))} · ${esc(m.title)}</span></header>
      <p class="tdy-vs"><span>${esc(D.pairName(m.pairs[0]))}&nbsp;<i class="vs-x">—</i></span> <span>${esc(D.pairName(m.pairs[1]))}</span></p>
      <p class="tdy-st">${callLine(m)}</p>
    </article>`;
  const freeLater = Object.keys(D.COURTS).filter((c) => !D.COURTS[c].removed && !day.some((m) => m.court === c && m.state !== 'done'));
  const lv = live[0];
  box.hidden = false;
  box.innerHTML = `
    <div class="tdy-stat card">
      <span class="sublabel">Сыграно</span>
      <span class="hero">${played} <span>из ${day.length}</span></span>
      ${verdict}
      <p class="tdy-line">${line}</p>
      ${rainLine}
      <div class="tdy-mini">
        ${lv ? `<p class="tdy-line">${icon('clock')}<span><b>Сейчас:</b> ${esc(courtLow(lv.court))}, ${esc(lv.title.toLowerCase())} · <span class="num">${lv.games[0]}:${lv.games[1]}</span> · закончится около <span class="num">${hhmm(liveEnd(lv))}</span></span></p>` : ''}
        ${soon.length ? `<p class="tdy-line">${icon('calendar')}<span><b>Дальше:</b> ${soon.map((m) => `<span class="num">${esc(m.time)}</span> ${esc(m.title.toLowerCase())}, ${esc(courtLow(m.court))}${calledAt(m.id) != null ? ` — пары вызваны${earlyStart(m, F) != null ? `, начнут около&nbsp;${hhmm(earlyStart(m, F))}` : ''}` : ''}`).join(' · ')}</span></p>` : ''}
      </div>
      <div class="tdy-links"><a class="btn quiet" href="${LINK.schedule}">${icon('calendar')}Расписание по кортам</a></div>
    </div>
    <section class="tdy-col" aria-labelledby="tdy-now-h">
      <h2 class="h2" id="tdy-now-h">Сейчас на кортах</h2>
      ${live.length ? live.map(liveCard).join('') : '<p class="muted">Сейчас на кортах никого</p>'}
      ${freeLater.length ? `<p class="tdy-free">Свободны до конца дня: ${esc(freeWords(freeLater))}</p>` : ''}
    </section>
    <section class="tdy-col" aria-labelledby="tdy-next-h">
      <h2 class="h2" id="tdy-next-h">Дальше</h2>
      ${soon.length ? soon.map(soonCard).join('') : '<p class="muted">Матчей сегодня больше нет</p>'}
    </section>`;
  hydrate(box);
  requestAnimationFrame(() => fitText(box));
}

// ---------- дела ----------
// Заголовок — что случилось, кнопка — что сделать. Числа и сроки — из мира и общего состояния.
const SCORE_MATCH = D.match('c5b'); // «За 5–8 места», корт 4, 13:00 — итог никто не подтвердил
const m = SCORE_MATCH;
// «на финале», «на матче за 5-е место» · «на финал», «на матч за 5-е место»
const matchWord = (x) => (/^За /.test(x.title) ? `матче ${x.title.toLowerCase()}` : x.title === 'Финал' ? 'финале' : `матче «${x.title}»`);
const matchAcc = (x) => (/^За /.test(x.title) ? `матч ${x.title.toLowerCase()}` : x.title === 'Финал' ? 'финал' : `матч «${x.title}»`);
// счёт: «7:5» — сначала геймы победителя
const scoreOf = (sets, w) => `${sets[0][w]}:${sets[0][1 - w]}`;
const winLine = (w, sc) => `${D.pairName(m.pairs[w])} — ${D.pairName(m.pairs[1 - w])} ${sc}`;
const WAS = scoreOf(m.sets, m.winner);
// счёт матча сейчас: мир или исправленный (scores.<матч>)
function scoreNow() {
  const s = state.get(`scores.${m.id}`) || {};
  const sets = s.sets || m.sets; const w = s.sets ? s.winner : m.winner;
  return { sets, w, sc: scoreOf(sets, w), fixed: !!s.sets, done: !!(s.confirmed || s.sets) };
}

// Дела «Новостей и фото» — contentTodos() раздела. Он называет первый черновик новости;
// черновиков несколько — у каждого своё дело (свежий — первым), теми же словами.
function contentTodos() {
  if (!C) return [];
  let list = [];
  try { list = C.contentTodos(); } catch { return []; }
  try {
    const i = list.findIndex((t) => t.key === 'news');
    const drafts = C.newsAll().filter((r) => r.state === 'draft').sort((a, b) => (b.ts || 0) - (a.ts || 0));
    if (i >= 0 && drafts.length > 1) {
      list.splice(i, 1, ...drafts.map((r) => ({ ...list[i], key: `news-${r.id}`, title: r.kind === 'press' ? 'Дописать статью о лиге' : 'Дописать новость', line: `«${r.title.trim() || 'Без заголовка'}» — сохранено ${r.saved || 'сегодня'}`, href: `post.html?id=${r.id}` })));
    }
  } catch { /* как в contentTodos() */ }
  return list;
}
// сделанное в «Новостях и фото» — строкой «Готово»: опубликованная новость, альбом на сайте
function contentReady() {
  if (!C) return [];
  const out = [];
  try {
    C.newsAll().filter((r) => r.state === 'live' && (state.get(`news.${r.id}`) || {}).state === 'live' && !(C.news(r.id) && C.news(r.id).state === 'live'))
      .forEach((r) => out.push({ kind: 'news', t: `${r.kind === 'press' ? 'статья о лиге' : 'новость'} «${r.title.trim() || 'Без заголовка'}» ${r.kind === 'press' ? 'на сайте' : 'опубликована'}` }));
    const jun = C.albumRec('jun-3');
    if (jun && jun.state === 'live' && (state.get('albums.jun-3') || {}).state === 'live') out.push({ kind: 'albums', t: `фото «${jun.name}» видно игрокам` });
  } catch { /* без «Готово» */ }
  return out;
}

function todoList() {
  const list = [];
  const ready = [];
  if (NEWS_ONLY) return { list: contentTodos(), ready: contentReady() };
  const day = dayNow();
  // судья: первый матч дня, у которого его нет; назначенный в «Судьях и доступе» — строкой «Готово»
  const noJudge = day.filter((x) => x.state !== 'done' && !judgeOf(x.id)).sort((a, b) => toMin(a.time) - toMin(b.time))[0] || null;
  const judged = day.filter((x) => x.state !== 'done' && !D.JUDGE.matches.includes(x.id) && judgeOf(x.id));
  // пары вызвали раньше обычного — те же слова, что в строке дня: «Финал раньше — около 19:20, корт 1»
  const fc = noJudge ? forecast(day) : null;
  const early = noJudge && fc ? earlyStart(noJudge, fc.F) : null;
  if (noJudge) list.push({ key: 'judge', title: `На ${matchWord(noJudge)} нет судьи`, line: `${noJudge.title} ${early != null ? `раньше — около ${hhmm(early)}` : `в ${noJudge.time}`}, ${courtLow(noJudge.court)}`, action: 'Назначить судью', href: LINK.judges });
  judged.forEach((x) => ready.push({ kind: 'judges', t: `на ${matchAcc(x)} назначен судья${personName(judgeOf(x.id)) ? ` — ${personName(judgeOf(x.id))}` : ''}` }));
  // счёт, который никто не подтвердил
  const S = scoreNow();
  if (!S.done) list.push({ key: 'score', title: 'Счёт матча не подтверждён', line: `«${m.title}», ${courtLow(m.court)} · ${S.sc}`, action: 'Проверить счёт', run: 'score' });
  else ready.push({ kind: 'scores', t: S.fixed ? `счёт «${m.title}» исправлен: ${winLine(S.w, S.sc)}` : `счёт «${m.title}» подтверждён: ${S.sc}` });
  // заявки пар на ближайший этап — живое число
  const jul = D.stage('jul-4');
  if (jul.waiting) list.push({ key: 'pairs', title: `${jul.waiting} ${plural(jul.waiting, 'заявка пары ждёт', 'заявки пар ждут', 'заявок пар ждут')} ответа`, line: `«${jul.name}» · запись до ${rangeShort(jul.signupTo)}`, action: 'Посмотреть заявки', href: LINK.pairs });
  else ready.push({ kind: 'pairs', t: `заявки пар на «${jul.name}» разобраны` });
  // заявки в лигу
  const join = D.joinOpen();
  if (join.length) {
    const first = join.map((a) => a.at).filter(Boolean).sort()[0];
    list.push({ key: 'join', title: `${join.length} ${plural(join.length, 'заявка в лигу ждёт', 'заявки в лигу ждут', 'заявок в лигу ждут')} решения`, line: first ? `Первая пришла сегодня в ${first}` : 'Первая подана 19 июня', action: 'Посмотреть заявки', href: LINK.join });
  } else ready.push({ kind: 'join', t: 'заявки в лигу разобраны' });
  // накладки в черновом расписании «Июльского кубка» — то же правило, что на «Расписании»
  const clash = T ? T.draftClashes('jul-4') : [];
  if (clash.length) {
    const c = clash[0]; const n = clash.length;
    const days = [...new Set(clash.map((x) => x.day))];
    const dm = (iso) => `${+iso.slice(8)} ${MON_GEN[+iso.slice(5, 7) - 1]}`;
    const at = c.row ? `${c.row.about ? 'около' : 'в'} ${c.row.t}` : '';
    list.push({
      key: 'clash',
      title: `${n} ${plural(n, 'накладка', 'накладки', 'накладок')} в расписании ${days.length === 1 ? `на ${dm(days[0])}` : `«${jul.name}»`}`,
      line: `«${jul.name}», черновик: ${c.kind === 'court' ? `на ${T.courtAt(c.court)} ${at} — два матча` : `матч на ${T.courtAt(c.court)} ${at} попал в перерыв`}`,
      action: 'Исправить накладку', href: `schedule.html?t=jul-4&day=${c.day}`,
    });
  } else if (T && state.get('days.jul-4') && T.draftClashes('jul-4', D.DAY_DRAFTS['jul-4'] || {}).length) ready.push({ kind: 'days', t: `накладок в расписании «${gen(jul.name)}» нет` });
  // черновики турниров: что осталось — те же задачи, что в мастере
  openDrafts().forEach((c) => {
    const left = tasksLeft(c);
    list.push({ key: `draft-${c.id}`, title: `«${c.name || 'Новый турнир'}» — ещё черновик`, line: left.length ? `${plural(left.length, 'Осталась', 'Осталось', 'Осталось')} ${left.length} ${plural(left.length, 'задача', 'задачи', 'задач')}: ${andList(left.map((t) => t.short))}` : 'Всё заполнено — осталось проверить и опубликовать', action: 'Продолжить', href: LINK.draft(c.id) });
  });
  Object.values(cups()).filter((c) => (c.id === 'aug-5' || isNewId(c.id)) && c.state === 'open').forEach((c) => ready.push({ kind: 'cups', t: `«${c.name}» опубликован` }));
  // новости и фото
  list.push(...contentTodos());
  ready.push(...contentReady());
  return { list, ready };
}

// «Готово» — два последних: чьё дело записано в журнал позже, то и выше (строка журнала знает раздел — kind)
const READY = 2;
function lastReady(ready) {
  const log = state.journal().filter((e) => e.who === 'me');
  const when = (r) => { const i = log.findIndex((e) => e.kind === r.kind); return i < 0 ? Infinity : i; };
  return ready.map((r, i) => ({ ...r, i })).sort((a, b) => when(a) - when(b) || a.i - b.i).slice(0, READY);
}

// На «Сегодня» — до пяти дел, остальные за кнопкой «Ещё 2 дела» (ПРИНЦИПЫ, «Сколько вещей на экране»)
const SHOW = 5;
let allOpen = false;
function drawTodos() {
  const { list, ready } = todoList();
  const ol = $('#tdy-todos');
  // «Готово» не копится: два последних сделанных дела, остальное — в журнале действий
  const last = lastReady(ready);
  const more = ready.length - last.length;
  const readyHtml = last.map((r) => `<li class="tdy-ready"><span class="ic">${icon('check')}</span><span><b>Готово:</b> ${esc(r.t)}</span></li>`).join('')
    + (more ? `<li class="tdy-ready tdy-ready-more"><a class="btn text" href="log.html">Ещё ${more} ${plural(more, 'сделанное дело', 'сделанных дела', 'сделанных дел')} — в журнале действий</a></li>` : '');
  if (!list.length) {
    const near = NEWS_ONLY ? null : nearest();
    ol.innerHTML = NEWS_ONLY
      ? `<li class="empty"><span class="ic">${icon('check')}</span><p>Дел по новостям и фото нет</p><a class="btn quiet" href="content.html">${icon('news')}Открыть «Новости и фото»</a></li>${readyHtml}`
      : `<li class="empty"><span class="ic">${icon('check')}</span><p>Срочных дел нет.${near ? ` Ближайшее — «${esc(near.name)}», ${esc(rangeShort(near.from))}` : ''}</p><a class="btn quiet" href="season.html">${icon('calendar')}Открыть календарь</a></li>${readyHtml}`;
    hydrate(ol);
    fixLinks(ol);
    return;
  }
  const shown = allOpen || list.length <= SHOW ? list : list.slice(0, SHOW);
  const rest = list.length - shown.length;
  // главная кнопка — одна, у самого срочного дела
  ol.innerHTML = shown.map((t, i) => {
    const cls = `btn ${i === 0 ? 'main' : 'quiet'}`;
    const btn = t.href ? `<a class="${cls}" href="${esc(t.href)}">${esc(t.action)}</a>` : `<button class="${cls}" type="button" data-run="${t.run}">${esc(t.action)}</button>`;
    return `<li class="todo tdy-todo" data-k="${esc(t.key)}"><div class="grow"><h3 class="h2">${esc(t.title)}</h3><p class="s">${esc(t.line)}</p></div>${btn}</li>`;
  }).join('')
    + (rest ? `<li class="tdy-more"><button class="btn quiet" type="button" data-all aria-expanded="false">${icon('down')}Ещё ${rest} ${plural(rest, 'дело', 'дела', 'дел')}</button></li>` : '')
    + readyHtml;
  hydrate(ol);
  fixLinks(ol);
}
$('#tdy-todos').addEventListener('click', (e) => {
  if (e.target.closest('[data-all]')) {
    allOpen = true; drawTodos();
    const next = $(`#tdy-todos > li:nth-child(${SHOW + 1}) a, #tdy-todos > li:nth-child(${SHOW + 1}) button`); if (next) next.focus();
    return;
  }
  const b = e.target.closest('[data-run]'); if (!b) return;
  if (b.dataset.run === 'score') checkScore();
});

// ---------- «Проверить счёт»: подтвердить или исправить ----------
// Сделанное — в общем состоянии (scores.c5b) и строкой журнала; «Отменить» возвращает и то и другое.
// «матча за 5–8 места (корт 4)»
const where = () => `${matchName(m.title).replace(/^матч /, 'матча ')} (${courtLow(m.court)})`;
function checkScore() {
  const S = scoreNow();
  const s = openSheet({
    title: 'Проверить счёт',
    body: `<p class="lead strong">${esc(m.title)} · ${esc(D.courtLine(m.court))} · в ${esc(m.time)}</p>
      <div class="tdy-card done-m" data-srf="${D.COURTS[m.court].surface}">
        <div class="tdy-prs">${[0, 1].map((i) => `<div class="tdy-pr${S.w === i ? ' win' : ''}">${duoHtml(m.pairs[i])}<span class="nm">${esc(D.pairName(m.pairs[i]))}</span><b class="num sc">${S.sets[0][i]}</b></div>`).join('')}</div>
      </div>
      <p class="lead">Игроки уже видят этот счёт. Если он верный — подтвердите.</p>`,
    foot: `<button class="btn main" type="button" data-ok>${icon('check')}Подтвердить счёт ${esc(S.sc)}</button><button class="btn quiet" type="button" data-fix>${icon('edit')}Счёт другой — исправить</button>`,
  });
  s.querySelector('[data-ok]').addEventListener('click', () => {
    closeLayer(true);
    const undo = state.set(`scores.${m.id}`, { confirmed: true }, { say: `подтвердили счёт ${where()}: ${winLine(S.w, S.sc)}`, href: 'today.html' });
    toast(`Счёт подтверждён: ${winLine(S.w, S.sc)}`, { undo });
  });
  s.querySelector('[data-fix]').addEventListener('click', () => fixScore());
}
const SCORES = ['6:0', '6:1', '6:2', '6:3', '6:4', '7:5', '7:6'];
const WHY = ['Перепутали пары', 'Ошиблись в счёте', 'Другое'];
function fixScore() {
  const S = scoreNow();
  const st = { win: S.w, sc: S.sc, why: null };
  const s = openSheet({
    title: 'Исправить счёт',
    body: `<p class="lead strong">${esc(m.title)} · ${esc(D.courtLine(m.court))}</p>
      <p class="muted">Было: ${esc(winLine(S.w, S.sc))}</p>
      <div class="field full"><span class="label">Кто выиграл?</span>${choicesHtml('Кто выиграл', m.pairs.map((p, i) => ({ value: String(i), t: D.pairName(p), checked: i === S.w })), 'one stx-compact')}</div>
      <div class="field full"><span class="label">С каким счётом?</span><div class="chips" role="radiogroup" aria-label="Счёт" data-g="sc">${SCORES.map((x) => `<button type="button" class="chip" role="radio" aria-checked="${x === S.sc}" data-value="${x}">${icon('check')}<span class="num">${x}</span></button>`).join('')}</div></div>
      <div class="field full"><span class="label">Почему исправляете?</span><div class="chips" role="radiogroup" aria-label="Почему исправляете" data-g="why">${WHY.map((x) => `<button type="button" class="chip" role="radio" aria-checked="false" data-value="${x}">${icon('check')}${x}</button>`).join('')}</div><span class="hint">Причина останется в журнале действий</span></div>`,
    foot: `<p class="pick-msg" role="alert" hidden></p><button class="btn main" type="button" data-save>Сохранить исправленный счёт</button><button class="btn quiet" type="button" data-back>${icon('back')}Назад</button>`,
  });
  const save = s.querySelector('[data-save]'); const msg = s.querySelector('.pick-msg');
  const paint = () => { save.textContent = `Сохранить исправленный счёт ${st.sc}`; msg.hidden = true; };
  s.querySelector('.choices').addEventListener('change', (e) => { st.win = +e.detail; paint(); });
  s.querySelector('[data-g="sc"]').addEventListener('change', (e) => { st.sc = e.detail; paint(); });
  s.querySelector('[data-g="why"]').addEventListener('change', (e) => { st.why = e.detail; paint(); });
  paint();
  save.addEventListener('click', () => {
    const tell = (t) => { msg.textContent = t; msg.hidden = false; };
    if (st.win === S.w && st.sc === S.sc) { tell(`Счёт тот же — ${S.sc}. Выберите другой счёт или нажмите «Назад»`); return; }
    if (!st.why) { tell('Выберите, почему исправляете: причина останется в журнале'); return; }
    closeLayer(true);
    const [a, b] = st.sc.split(':').map(Number);
    const sets = [st.win === 0 ? [a, b] : [b, a]];
    const why = st.why === 'Другое' ? '' : `. Причина — ${st.why.toLowerCase()}`;
    const undo = state.set(`scores.${m.id}`, { sets, winner: st.win, was: WAS, why: st.why, confirmed: true }, { say: `исправили счёт ${where()}: ${winLine(st.win, st.sc)}, было ${WAS}${why}`, href: 'today.html' });
    toast(`Счёт исправлен: ${winLine(st.win, st.sc)}. Игроки видят новый счёт`, { undo });
  });
  s.querySelector('[data-back]').addEventListener('click', () => checkScore());
}

// ---------- ближайший турнир ----------
function nearest() {
  return seasonStages().filter((s) => s.state !== 'draft' && s.from > D.NOW.iso).sort(byDate)[0] || null;
}
function drawNext() {
  const box = $('#tdy-next');
  if (NEWS_ONLY) { box.closest('.sec').hidden = true; box.closest('.tdy-cols').classList.add('solo'); return; }
  const s = nearest();
  if (!s) { box.innerHTML = `<div class="empty"><p>Следующих турниров пока нет</p><a class="btn quiet" href="new-tournament.html">${icon('plus')}Создать турнир</a></div>`; hydrate(box); return; }
  const w = stateWords(s);
  const same = s.from.slice(0, 7) === s.to.slice(0, 7);
  const big = same ? `${+s.from.slice(8)}–${+s.to.slice(8)}` : rangeShort(s.from, s.to);
  const extra = s.state === 'open'
    ? `${s.pairs} из ${s.slots} пар${s.draw ? ` · жеребьёвка ${esc(rangeShort(s.draw))}` : ''}`
    : `${pairsWord(s.pairs || 0)}`;
  // страница турнира — у идущего и следующего этапов мира и у опубликованного турнира из мастера
  const page = ['jun-3', 'jul-4'].includes(s.id) || isNewId(s.id) || s.id === 'aug-5' ? LINK.tour(s.id) : `season.html?m=${s.from.slice(0, 7)}`;
  const kind = s.kind === 'separate' ? 'Отдельный турнир' : s.kind === 'final' ? 'Итоговый турнир сезона' : `Этап ${s.no}`;
  box.innerHTML = `<article class="card tdy-cup" data-srf="${s.surface || ''}">
      <span class="sublabel">${esc([kind, D.SURFACES[s.surface]?.label].filter(Boolean).join(' · '))}</span>
      <h3 class="h2">${esc(s.name)}</h3>
      <p class="tdy-cup-d"><span class="num">${esc(big)}</span>${same ? `<span>${esc(MON_GEN[+s.to.slice(5, 7) - 1])}</span>` : ''}</p>
      <span class="tag ${w.tag}">${esc(w.label)}</span>
      <p>${extra}</p>
      <a class="btn quiet" href="${esc(page)}">Открыть турнир${icon('chev')}</a>
    </article>`;
  hydrate(box);
}

function drawAll() { drawDay(); drawTodos(); drawNext(); fixLinks($('.work')); }
drawAll();

// Сделанное здесь, на соседних страницах и в других вкладках — сразу на экране
// (таймер, а не кадр отрисовки: вкладка в фоне тоже обновляется, пока на неё не смотрят)
let queued = false;
state.on('', () => { if (queued) return; queued = true; setTimeout(() => { queued = false; drawAll(); }, 0); });
// часы примера идут с делами: «сейчас 18:52», «прошло 5 мин из 20» — подписка выше перерисует всё;
// таймер — запасной. Пульт не перерисовывается, пока в нём фокус
let minute = state.now();
setInterval(() => {
  if (state.now() === minute) return;
  minute = state.now();
  if (!$('#tdy-day').contains(document.activeElement)) drawDay();
}, 15000);
