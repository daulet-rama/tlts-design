// Расписание дня по кортам — своя версия общего dayPlan (admin.js) для страниц турнира:
// • все корты на экране, предпросмотр — шторкой; «Корты 4–5 ›» — над сеткой, а не поверх столбца;
// • в идущий день сыгранное свёрнуто в одну строку, «сейчас» на виду, кнопка «Сейчас» — в шапке;
// • время словами без «кругов»: «08:45», «около 09:35»;
// • корт и время выбираются в одном окне; в черновике перенос — сразу и с «Отменить»;
// • накладка спрашивается до переноса: «Поставить на свободный корт 5», «Поменять местами», «Всё равно сюда»;
// • на карточке с накладкой главная — «Исправить: корт 5 в 19:00 свободен», «Оставить так» — вторая;
// • в окне матча идущего дня — «Вызвать на корт» (общий вызов с «Днём турнира»);
// • в черновом дне с финалом (план.finalCourt — корт финала этапа) финал на другом корте — на его карточке
//   словами «Финал «…» играют на траве — на корте 4» и «Переставить на корт 4» (занят — «Поменять местами»).
// Сделанное сохраняет страница: o.save(день, { say, kind }) пишет в общее состояние и возвращает undo
// для «Отменить»; kind — что изменилось: place (где стоят матчи), breaks, kept, publish, revert, layout.
// o.act(fn) — своё действие (страница не перерисовывает его второй раз по подписке).
// tourPlan(узел, { ...план, onDay, onChange, arrange, calls, save, act }) → { state, draw, load }
import {
  D, state, esc, icon, plural, el, hydrate, fitText, drag, isPhone, openSheet, closeLayer, toast, vsHtml,
  dayWords, WD, WD_ACC, MON_GEN, dow, toMin, hhmm, parseTime, choicesHtml, matchName, pairAnd, confirmAction, keepTheme, nowTagAside, gen,
} from '../admin.js';
import { callState, call as doCall, uncall, callTime, tooEarly, clockStartNow, dutyLines } from './tournament.calls.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NB = '\u00a0';   // неразрывный пробел: «10 июля» не рвётся
const low1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
// после двоеточия — со строчной, но фамилии остаются с заглавной: «на корте 1 …», «Белов и Вершинин …»
const lowLead = (s) => (/^(На|В|Пара|Корт|Перерыв|Открытие) /.test(s) ? low1(s) : s);
const minutesWords = (n) => `${n} ${plural(n, 'минута', 'минуты', 'минут')}`;
const BREAK_KINDS = { all: 'Перерыв на всех кортах', court: 'Корт закрыт', open: 'Открытие или награждение' };
const ON_SRF = { clay: 'на грунте', hard: 'на харде', grass: 'на траве' };
const dayNo = (iso) => +iso.slice(8);
const monIdx = (iso) => +iso.slice(5, 7) - 1;

// строки времени: { key, min, t: '09:35', about: true } — «около 09:35»
const normRow = (r) => {
  if (r.t) return { ...r };
  const s = String(r.s || '');
  const t = (/\d\d:\d\d/.exec(s) || /\d\d:\d\d/.exec(r.b || '') || [hhmm(r.min)])[0];
  return { key: r.key, min: r.min, t, about: /около/.test(s) };
};

export function tourPlan(root, o) {
  let S; let bSeq = 0; let gridRO = null; let nowIO = null;
  const normBreak = (b) => ({ ...b, id: b.id || `b${Date.now().toString(36)}${(bSeq += 1)}`, from: typeof b.from === 'number' ? b.from : toMin(b.from), to: typeof b.to === 'number' ? b.to : toMin(b.to), court: b.court || null, kind: b.kind || (b.court ? 'court' : 'all') });
  // где стоят матчи: { id: [корт, строка] } — то, что видят игроки после публикации
  const placeOf = () => Object.fromEntries(S.matches.filter((m) => m.court && m.row).map((m) => [m.id, [m.court, m.row]]));
  const init = (p) => {
    S = { ...p, matches: p.matches.map((m) => ({ ...m })), rows: (p.rows || []).map(normRow), kept: new Set(p.kept || []), published: p.mode === 'published' ? (p.publishedAt || 'в 18:42') : null, dirty: !!p.dirty, manual: !!p.manual, showPlayed: !!p.showPlayed };
    S.breaks = (p.breaks || []).map(normBreak);
    // что видят игроки: где стоят матчи, время и перерывы на момент публикации
    S.shown = p.shown || (p.mode === 'published' ? { place: placeOf(), rows: S.rows.map((r) => ({ ...r })), breaks: S.breaks.map((b) => ({ ...b })) } : null);
  };
  init(o);
  // сохранить сделанное в общем состоянии: вернёт undo для «Отменить»
  const run = o.act || ((f) => f());
  const persist = (say, kind = 'place') => (o.save ? run(() => o.save(S, { say, kind })) : () => {});
  const onWhat = () => `на ${WD_ACC[dow(S.day)]}, ${dayNo(S.day)}${NB}${MON_GEN[monIdx(S.day)]}`;
  const isLive = () => S.mode === 'live';
  const isDone = () => S.mode === 'done';
  const isToday = () => S.day === D.NOW.iso;
  const rowOf = (key) => S.rows.find((r) => r.key === key);
  const rowIndex = (key) => S.rows.findIndex((r) => r.key === key);
  const mdur = (m) => m.duration || S.round || 50;
  const start = (m) => (rowOf(m.row) ? rowOf(m.row).min : null);
  // «19:00» или «около 09:35» — время для людей; «в 19:00» — в фразе
  const rowT = (r) => (r ? `${r.about ? 'около ' : ''}${r.t}` : '');
  const atWords = (r) => (r ? (r.about ? `около ${r.t}` : `в ${r.t}`) : '');
  const stageWord = (m) => (m.tour ? `${m.title} · ${m.tour}` : m.title);
  const courtName = (c) => D.COURTS[c].name;
  const lowCourt = (c) => courtName(c).toLowerCase();
  const courtLoc = (c) => lowCourt(c).replace('корт', 'корте');
  const courtNo = (c) => courtName(c).replace('Корт ', '');
  const placed = () => S.matches.filter((m) => m.court && m.row);
  const players = (m) => (m.pairs ? m.pairs.flatMap((p) => D.pair(p).players) : []);
  const pairs2 = (m) => (m.pairs ? `${D.pairName(m.pairs[0])} — ${D.pairName(m.pairs[1])}` : (m.tbd || 'Пары ещё не известны'));
  const dayStart = () => (S.rows[0] ? S.rows[0].min : 0);
  const rowEnd = (i) => (S.rows[i + 1] ? S.rows[i + 1].min : S.rows[i].min + (S.round || 60));
  const breakWhen = (b) => (b.kind === 'court' && b.from <= dayStart() ? `до ${hhmm(b.to)}` : `${hhmm(b.from)}–${hhmm(b.to)}`);
  const breakText = (b) => (b.kind === 'court' ? `${courtName(b.court)} закрыт ${b.from <= dayStart() ? `до ${hhmm(b.to)}` : `с ${hhmm(b.from)} до ${hhmm(b.to)}`}` : `${b.label || BREAK_KINDS[b.kind]} · ${breakWhen(b)}`);
  const breakPhrase = (b) => (b.kind === 'court' ? breakText(b) : `В это время ${low1(b.label || BREAK_KINDS[b.kind])} (${breakWhen(b)})`);
  const pastRow = (r) => isLive() && S.now && r && r.min < S.now.min;
  const changed = () => { if (o.onChange) o.onChange(S); };

  // ---------- финал — на корте финала этапа (S.finalCourt; есть только у черновых дней) ----------
  const offFinal = (m) => !!(S.finalCourt && D.COURTS[S.finalCourt] && m.stage === 'final' && m.state === 'soon' && m.court && rowOf(m.row) && m.court !== S.finalCourt);
  // номер корта и время не отрываются от слова: «на корте 4», «около 10:05»
  const keepNum = (s) => s.replace(/ (\d)/g, `${NB}$1`);
  // «Финал «Июльского кубка» играют на траве — на корте 4» и, если корт в это время занят, — чем
  const finWords = (m) => {
    const fc = S.finalCourt; const on = ON_SRF[D.COURTS[fc].surface]; const busy = busyText(fc, m.row, m);
    return keepNum(`Финал${S.cupName ? ` «${gen(S.cupName)}»` : ''} играют ${on ? `${on} — ` : ''}на ${courtLoc(fc)}${busy ? `. ${courtName(fc)} ${atWords(rowOf(m.row))} занят: ${busy}` : ''}`);
  };
  // как вернуть финал на его корт: свободен — переставить; там матч — поменять местами; закрыт — выбрать время
  const finFix = (m) => {
    const fc = S.finalCourt;
    if (okAt(m, fc, m.row)) return `<button class="btn fix" type="button" data-fix="${esc(fc)}|${esc(m.row)}">${esc(keepNum(`Переставить на ${lowCourt(fc)}`))}</button>`;
    const x = placed().find((y) => y !== m && y.court === fc && y.row === m.row && y.state === 'soon');
    if (x) return `<button class="btn fix" type="button" data-swap="${esc(x.id)}">${esc(keepNum(`Поменять местами с «${x.title}»`))}</button>`;
    return `<button class="btn fix" type="button" data-move="${esc(fc)}">${esc(keepNum(`Выбрать время на ${courtLoc(fc)}`))}</button>`;
  };
  // в окне публикации: «Финал стоит на корте 1 (грунт), а играют его на траве — на корте 4»
  const finPub = () => {
    const m = placed().find(offFinal); if (!m) return '';
    const on = ON_SRF[D.COURTS[S.finalCourt].surface];
    return keepNum(`Финал стоит на ${courtLoc(m.court)} (${D.SURFACES[D.COURTS[m.court].surface].label}), а играют его ${on ? `${on} — ` : ''}на ${courtLoc(S.finalCourt)}`);
  };

  // ---------- накладки ----------
  const issues = (m) => {
    if (!m.court || !m.row || m.state === 'done') return [];
    const out = []; const t0 = start(m); const r = rowOf(m.row);
    placed().forEach((x) => {
      if (x === m) return;
      if (x.court === m.court && x.row === m.row) out.push({ k: `court:${x.id}`, bad: true, occ: x, t: `На ${courtLoc(m.court)} ${atWords(r)} уже ${matchName(x.title)}` });
      else if (x.row === m.row && players(m).some((p) => players(x).includes(p))) {
        const shared = m.pairs.find((p) => x.pairs && x.pairs.includes(p));
        out.push({ k: `pair:${x.id}`, bad: true, t: `${shared ? pairAnd(shared) : 'Пара'} ${atWords(r)} ${shared ? 'играют' : 'играет'} ${matchName(x.title)} на ${courtLoc(x.court)}` });
      }
      if (x.state === 'live' && x.court === m.court && x.ends && x.row !== m.row && start(x) < t0 && toMin(x.ends) > t0) out.push({ k: `live:${x.id}`, bad: true, t: `На ${courtLoc(m.court)} до ${x.ends} идёт ${matchName(x.title)}` });
    });
    S.breaks.forEach((b) => { if ((!b.court || b.court === m.court) && t0 < b.to && t0 + mdur(m) > b.from) out.push({ k: `brk:${b.id}`, bad: true, t: breakPhrase(b) }); });
    // финал — на корте финала этапа: стоит на другом — сказать словами (это не накладка, «Оставить так» можно)
    if (offFinal(m)) out.push({ k: `fin:${m.court}`, fin: true, warn: true, t: finWords(m) });
    // мало отдыха между матчами пары (порог — настройка организатора)
    if (m.pairs && t0 !== null) {
      placed().forEach((x) => {
        if (x === m || !x.pairs || start(x) === null) return;
        m.pairs.filter((p) => x.pairs.includes(p)).forEach((p) => {
          const gap = start(x) < t0 ? t0 - (start(x) + mdur(x)) : start(x) - (t0 + mdur(m));
          if (gap >= 0 && gap < (S.rest || 30)) out.push({ k: `rest:${x.id}:${p}`, warn: true, t: `${pairAnd(p)} отдыхают между матчами ${minutesWords(gap)}` });
        });
      });
    }
    return out;
  };
  const openIssues = (m) => issues(m).filter((x) => !S.kept.has(`${m.id}|${x.k}`));
  // одна накладка — одна, даже если её видят обе карточки
  const countIssues = () => {
    const bad = new Set(); let warn = 0; let fin = 0;
    placed().forEach((m) => openIssues(m).forEach((x) => {
      if (x.bad) bad.add(x.k.startsWith('court:') || x.k.startsWith('pair:') ? [m.id, x.k.split(':')[1]].sort().join('|') + x.k.split(':')[0] : `${m.id}|${x.k}`);
      else if (x.fin) fin += 1;
      else warn += 1;
    }));
    return { bad: bad.size, warn, fin };
  };
  // примерить матч на место: какие накладки там будут
  const tryAt = (m, c, rk) => { const was = [m.court, m.row]; m.court = c; m.row = rk; const iss = issues(m); [m.court, m.row] = was; return iss; };
  const okAt = (m, c, rk) => !pastRow(rowOf(rk)) && !(c === m.court && rk === m.row) && !tryAt(m, c, rk).some((i) => i.bad);
  // ближайшее свободное место: другой корт в то же время (финалу — сначала корт финала), потом тот же корт позже
  const freeSpot = (m, rk) => {
    const order = S.finalCourt && m.stage === 'final' && S.courts.includes(S.finalCourt) ? [S.finalCourt, ...S.courts.filter((c) => c !== S.finalCourt)] : S.courts;
    for (const c of order) if (okAt(m, c, rk)) return { court: c, row: rk };
    const c0 = m.court || S.courts[0];
    for (const r of S.rows.slice(rowIndex(rk) + 1)) if (okAt(m, c0, r.key)) return { court: c0, row: r.key };
    return null;
  };
  const spotWords = (sp) => `${lowCourt(sp.court)} ${atWords(rowOf(sp.row))}`;

  // ---------- карточка ----------
  const issueBox = (m, { big } = {}) => {
    const open = openIssues(m);
    const kept = issues(m).filter((x) => S.kept.has(`${m.id}|${x.k}`));
    const bad = open.filter((x) => x.bad); const warn = open.filter((x) => x.warn);
    let html = '';
    if (bad.length) {
      const sp = freeSpot(m, m.row);
      html += `<div class="mc-issue bad" role="note">${bad.map((x) => `<span>${esc(x.t)}</span>`).join('')}${sp ? `<button class="btn fix" type="button" data-fix="${esc(sp.court)}|${esc(sp.row)}">Исправить: ${esc(spotWords(sp))} свободен</button>` : `<button class="btn fix" type="button" data-move>Выбрать другое время</button>`}<button class="btn" type="button" data-keepall>Оставить так</button></div>`;
    } else if (warn.length) {
      html += `<div class="mc-issue warn" role="note">${warn.map((x) => `<span>${esc(x.t)}</span>`).join('')}${warn.some((x) => x.fin) ? finFix(m) : ''}<button class="btn" type="button" data-keepall>Оставить так</button></div>`;
    }
    html += kept.map((x) => `<span class="mc-kept">Оставлено так: ${esc(x.fin ? keepNum(`финал — на ${courtLoc(m.court)}`) : lowLead(x.t))}</span>`).join('');
    // финал не на своём корте — только запись на карточке, без жёлтой полосы снизу: она в легенде значит «Мало отдыха»
    return { cls: bad.length ? 'issue-bad' : warn.some((x) => !x.fin) ? 'issue-warn' : warn.length ? 'issue-fin' : '', html, big };
  };
  const lines = (m, { inStack } = {}) => {
    const r = rowOf(m.row);
    if (m.state === 'live') { const g = m.games ? m.games.join(':') : ''; return { top: `<span class="lv">Идёт · ${g}</span>`, foot: m.ends ? `закончится около ${m.ends}` : '', st: `идёт · ${g}${m.ends ? ' · закончится около ' + m.ends : ''}` }; }
    if (m.state === 'done') { const sc = m.sets ? m.sets.map(([a, b]) => `${a}:${b}`).join(' ') : ''; return { top: `Сыгран · ${sc}`, foot: m.duration ? minutesWords(m.duration) : '', st: `сыгран · ${sc}` }; }
    if (inStack || !r) return { top: 'ещё не в расписании', foot: sameTbd() ? '' : (m.tour || ''), st: 'ещё не в расписании' };
    const before = placed().find((x) => x !== m && x.court === m.court && x.state === 'live' && x.ends && start(x) < r.min && toMin(x.ends) > r.min);
    const cs = o.calls && isLive() && isToday() && D.match(m.id) ? callState(m.id) : null;
    const foot = before ? `начнётся около ${before.ends}` : cs ? `вызваны в ${cs.at}` : sameTbd() ? '' : (m.tour || '');
    return { top: esc(rowT(r)), foot, st: foot || rowT(r) };
  };
  // у всех матчей одна и та же строка «Пары — после жеребьёвки» — она стоит один раз над сеткой
  const sameTbd = () => (S.matches.length > 1 && S.matches.every((m) => !m.pairs && m.tbd && m.tbd === S.matches[0].tbd) ? S.matches[0].tbd : '');
  const pairLine = (m, i) => {
    if (!m.pairs && sameTbd()) return i === 0 ? `<span class="mc-pair tbd">${esc(m.tour || m.title)}</span>` : '';
    if (!m.pairs) return i === 0 ? `<span class="mc-pair tbd">${esc(m.tbd || 'Пара ещё не известна')}</span>` : '';
    const lose = m.state === 'done' && m.winner !== i;
    return `<span class="mc-pair${lose ? ' lose' : ''}">${esc(D.pairName(m.pairs[i]))}</span>`;
  };
  const labelOf = (m) => {
    const r = rowOf(m.row);
    const where = m.court && r ? `${courtName(m.court)}, ${rowT(r)}` : 'ещё не в расписании';
    return `${stageWord(m)}${m.pairs ? `: ${D.pairName(m.pairs[0])} против ${D.pairName(m.pairs[1])}` : ''}, ${where}`;
  };
  const cardHtml = (m, { inStack } = {}) => {
    const L = lines(m, { inStack });
    const I = inStack ? { cls: '', html: '' } : issueBox(m);
    return `<div class="mcard${I.cls ? ' ' + I.cls : ''}" data-id="${esc(m.id)}" data-stage="${m.stage}" data-state="${m.state}"${I.cls ? ' data-issue' : ''}>
      <button type="button" class="mc-open" aria-label="${esc(labelOf(m))}">
        <span class="mc-top">${L.top}<span class="stg">${esc(m.title)}</span></span>
        ${pairLine(m, 0)}${pairLine(m, 1)}
        <span class="mc-foot">${esc(L.foot)}</span>
        <span class="mc-where"></span>
      </button>${I.html}</div>`;
  };

  // ---------- шапка: две строки ----------
  const freeNow = () => (isLive() && S.now ? S.courts.filter((c) => !S.matches.some((m) => m.court === c && m.state === 'live')) : []);
  const headHtml = () => {
    const nav = !!o.onDay;
    const n = countIssues();
    const tile = (d) => {
      const inner = `<span class="wd">${WD[dow(d)]}</span><span class="dn">${dayNo(d)}</span>`;
      const cls = d === D.NOW.iso ? 'is-today' : '';
      const cur = d === S.day ? ' aria-current="true"' : '';
      return nav ? `<button type="button" data-day="${d}" class="${cls}"${cur} aria-label="${esc(dayWords(d, { cap: true }))}${d === D.NOW.iso ? ', сегодня' : ''}">${inner}</button>` : `<span class="${cls}"${cur} aria-label="${esc(dayWords(d, { cap: true }))}">${inner}</span>`;
    };
    let say = '';
    const free = freeNow();
    if (isLive()) say = `<span class="tag live lg">День идёт</span><span class="tp-say">изменения видны сразу${free.length ? `<span class="tp-free"> · свободны ${free.length > 1 ? 'корты' : 'корт'} ${free.map(courtNo).join(', ')}</span>` : ''}</span>`;
    else if (isDone()) say = `<span class="tag past lg">День сыгран</span><span class="tp-say">сыграно ${S.matches.filter((m) => m.state === 'done').length} из ${S.matches.length}</span>`;
    else if (S.published && !S.dirty) say = `<span class="tag ok lg">Опубликовано ${esc(S.published)}</span>`;
    else if (S.published && S.dirty) say = `<span class="tag warn lg">Есть правки — игроки их ещё не видят</span>`;
    // пустой день — состояния нет: сказать нечего, пока матчей нет; «Сохранено» — только когда что-то сохранили
    else if (!(S.empty && !placed().length && !S.manual)) say = `<span class="tag draft lg">Черновик — игроки не видят</span>${S.saved ? `<span class="saved">${icon('check')}Сохранено в ${esc(S.saved)}</span>` : ''}`;
    const iss = n.bad ? `<button type="button" class="btn text tp-iss bad" data-issues>${icon('alert')}${n.bad} ${plural(n.bad, 'накладка', 'накладки', 'накладок')}</button>` : n.warn ? `<button type="button" class="btn text tp-iss warn" data-issues>${icon('warn')}Мало отдыха: ${n.warn}</button>` : n.fin ? `<button type="button" class="btn text tp-iss warn" data-issues>${icon('warn')}${esc(keepNum(`Финал не на ${courtLoc(S.finalCourt)}`))}</button>` : '';
    const canPublish = !isLive() && !isDone() && placed().length && (!S.published || S.dirty);
    const acts = [];
    // «Сейчас 18:47» и «Пары — после жеребьёвки» — в строке дня: над сеткой две строки, а не четыре
    const nowBtn = S.now && isLive() ? `<button class="btn quiet tp-now" type="button" data-tonow>${icon('clock')}Сейчас ${esc(S.now.label)}</button>` : '';
    if (S.published && S.dirty) acts.push(`<button class="btn quiet" type="button" data-revert>${icon('undo')}Вернуть опубликованное</button>`);
    if (canPublish) acts.push(`<div class="head-act tp-act${isPhone() ? ' glass' : ''}"><p class="who-sees">${icon('eye')}<span>Увидят игроки, сайт и табло</span></p><button class="btn main" type="button" data-publish>${icon('eye')}${S.published ? 'Опубликовать правки' : 'Опубликовать день'}</button></div>`);
    const tbd = sameTbd();
    const tbdHtml = tbd && placed().length ? `<p class="tp-tbd">${icon('info')}<span>${esc(tbd)}</span></p>` : '';
    return `<div class="tp-day"><h2 class="h1">${esc(dayWords(S.day, { cap: true }))}</h2><div class="plan-days tp-days${nav ? '' : ' still'}" role="${nav ? 'group' : 'list'}" aria-label="Игровые дни турнира">${S.days.map(tile).join('')}</div>${tbdHtml}${nowBtn ? `<span class="push"></span>${nowBtn}` : ''}</div>
      ${say || iss || acts.length ? `<div class="tp-state">${say}${iss}${acts.length ? `<span class="push"></span>${acts.join('')}` : ''}</div>` : ''}`;
  };

  // ---------- стопка «Ещё не в расписании» ----------
  const rest = () => S.matches.filter((m) => !m.court || !m.row);
  const stackHtml = () => {
    const list = rest();
    const by = {}; list.forEach((m) => { const k = stageWord(m); (by[k] = by[k] || []).push(m); });
    return `<aside class="pstack" aria-label="Ещё не в расписании"><h3 class="h3">Ещё не в расписании <span class="num">· ${list.length}</span></h3>${Object.entries(by).map(([k, l], i) => `<details${i === 0 ? ' open' : ''}><summary><span class="stp" data-stage="${l[0].stage}" aria-hidden="true"></span>${esc(k)}<span class="n">${l.length}</span></summary><div class="cards">${l.map((m) => cardHtml(m, { inStack: true })).join('')}</div></details>`).join('')}<p class="muted">Нажмите на матч, чтобы поставить его${isPhone() ? '' : ', или перетащите в клетку'}</p></aside>`;
  };

  // ---------- сыгранное в идущий день — одной строкой ----------
  const playedRows = () => {
    if (!isLive()) return [];
    const out = [];
    for (const r of S.rows) {
      const here = S.matches.filter((m) => m.row === r.key);
      if (pastRow(r) && here.length && here.every((m) => m.state === 'done')) out.push(r); else break;
    }
    return out;
  };
  const playedCount = (rows) => S.matches.filter((m) => rows.some((r) => r.key === m.row)).length;

  // ---------- сетка ----------
  const movable = (c, rk) => S.matches.filter((m) => m.state === 'soon' && !(m.court === c && m.row === rk));
  const gridHtml = () => {
    const cols = S.courts.length;
    const fold = playedRows(); const hide = fold.length && !S.showPlayed;
    let h = `<div class="pgrid-box"><div class="pg-nav" hidden><span class="pg-seen"></span><span class="push"></span><button type="button" class="btn quiet" data-more="-1" hidden></button><button type="button" class="btn quiet" data-more="1" hidden></button></div><div class="pgrid-wrap"><div class="pgrid" style="--courts:${cols}" role="grid" aria-label="Расписание по кортам"><div class="pg-corner"></div>`;
    S.courts.forEach((c) => { const x = D.COURTS[c]; h += `<div class="pg-court" data-srf="${x.surface}" data-court="${c}" role="columnheader"><b>${esc(x.name)}${x.note ? ' · ' + esc(x.note) : ''}</b><span>${esc(D.SURFACES[x.surface].label)}</span></div>`; });
    if (fold.length) {
      const n = playedCount(fold);
      h += `<div class="pg-time fold" role="rowheader"><b>${esc(fold[0].t)}</b><span>— ${esc(fold[fold.length - 1].t)}</span></div><div class="pg-cell fold" style="grid-column:2 / span ${cols}"><button type="button" class="btn text" data-played aria-expanded="${!hide}">${icon(hide ? 'down' : 'up')}${hide ? `Сыграно ${n} ${plural(n, 'матч', 'матча', 'матчей')} — показать` : `Скрыть ${n} ${plural(n, 'сыгранный матч', 'сыгранных матча', 'сыгранных матчей')}`}</button></div>`;
    }
    const common = S.breaks.filter((b) => !b.court).sort((a, b) => a.from - b.from);
    let bi = 0;
    const breakRow = (b) => `<div class="pg-time brk" role="rowheader"><b>${hhmm(b.from)}</b><span>до ${hhmm(b.to)}</span></div><div class="pg-cell brk" style="grid-column:2 / span ${cols}"><div class="pg-break">${icon(b.kind === 'open' ? 'star' : 'pause')}${esc(breakText(b))}</div></div>`;
    S.rows.forEach((r, ri) => {
      if (hide && fold.includes(r)) return;
      while (bi < common.length && common[bi].from <= r.min) { h += breakRow(common[bi]); bi += 1; }
      const past = pastRow(r);
      h += `<div class="pg-time${past ? ' past' : ''}" data-row="${esc(r.key)}" role="rowheader">${r.about ? '<span>около</span>' : ''}<b>${esc(r.t)}</b></div>`;
      S.courts.forEach((c) => {
        const here = S.matches.filter((m) => m.court === c && m.row === r.key);
        const shut = S.breaks.filter((b) => b.court === c && b.from < rowEnd(ri) && b.to > r.min);
        const can = !isDone() && !past && !here.length && !shut.length && movable(c, r.key).length;
        h += `<div class="pg-cell${can ? ' empty-slot' : ''}${past ? ' past' : ''}" data-court="${c}" data-row="${esc(r.key)}" role="gridcell">${shut.map((b) => `<div class="pg-break">${icon('lock')}${esc(breakText(b))}</div>`).join('')}${here.map((m) => cardHtml(m)).join('')}${can ? `<button type="button" class="slot-add" data-slot aria-label="${esc(courtName(c))}, ${esc(rowT(r))}: свободно — поставить матч">${icon('plus')}Свободно</button>` : ''}</div>`;
      });
    });
    while (bi < common.length) { h += breakRow(common[bi]); bi += 1; }
    h += '</div></div></div>';
    return h;
  };
  const legend = `<div class="legend plan-legend" aria-label="Что значат цвета"><span><i class="stg-sw" data-stage="group"></i>Группы</span><span><i class="stg-sw" data-stage="play"></i>Плей-офф и матчи за места</span><span><i class="stg-sw" data-stage="final"></i>Финал</span><span><i class="iss-sw bad"></i>Накладка</span><span><i class="iss-sw warn"></i>Мало отдыха</span></div>`;

  // ---------- телефон: день списком, сыгранное свёрнуто ----------
  const phoneItem = (m) => {
    const L = lines(m); const I = issueBox(m, { big: true }); const r = rowOf(m.row); const c = D.COURTS[m.court];
    const who = m.pairs ? `<span class="pr${m.state === 'done' && m.winner !== 0 ? ' lose' : ''}">${esc(D.pairName(m.pairs[0]))}</span><span class="pr${m.state === 'done' && m.winner !== 1 ? ' lose' : ''}">${esc(D.pairName(m.pairs[1]))}</span>` : sameTbd() ? '' : `<span class="s">${esc(m.tbd || 'Пара ещё не известна')}</span>`;
    return `<div class="plist-item${I.cls ? ' ' + I.cls : ''}" data-id="${esc(m.id)}" data-stage="${m.stage}" data-state="${m.state}" data-srf="${c.surface}"${I.cls ? ' data-issue' : ''}>
      <button type="button" class="pl-open" aria-label="${esc(labelOf(m))}"><span class="ct">${esc(courtName(m.court))}<span class="when num">${esc(rowT(r))}</span></span>${who}<span class="s"><i class="stc" data-stage="${m.stage}" aria-hidden="true"></i>${esc(stageWord(m))}${L.st && L.st !== rowT(r) ? ' · ' + esc(L.st) : ''}</span></button>${I.html}</div>`;
  };
  const phoneHtml = () => {
    const fold = playedRows(); const hide = fold.length && !S.showPlayed;
    const list = placed().filter((m) => !(hide && fold.some((r) => r.key === m.row))).sort((a, b) => start(a) - start(b) || a.court.localeCompare(b.court));
    const items = list.map((m) => ({ t: start(m), h: phoneItem(m) }));
    S.breaks.forEach((b) => items.push({ t: b.from - 0.5, h: `<div class="plist-break">${icon(b.kind === 'court' ? 'lock' : b.kind === 'open' ? 'star' : 'pause')}<span>${esc(breakText(b))}</span></div>` }));
    items.sort((a, b) => a.t - b.t);
    let h = '<div class="plist">';
    if (fold.length) { const n = playedCount(fold); h += `<button type="button" class="btn quiet wide pl-fold" data-played aria-expanded="${!hide}">${icon(hide ? 'down' : 'up')}${hide ? `Сыграно ${n} ${plural(n, 'матч', 'матча', 'матчей')} — показать` : 'Скрыть сыгранные'}</button>`; }
    let nowPut = false;
    items.forEach((x) => {
      if (S.now && isLive() && !nowPut && x.t > S.now.min) { h += `<div class="plist-now" id="plan-now"><span class="now-tag">${esc(S.now.label)}</span></div>`; nowPut = true; }
      h += x.h;
    });
    if (S.now && isLive() && !nowPut) h += `<div class="plist-now" id="plan-now"><span class="now-tag">${esc(S.now.label)}</span></div>`;
    h += '</div>';
    if (S.now && isLive()) h += `<button class="btn quiet to-now" type="button" data-tonow hidden>${icon('clock')}К текущему</button>`;
    return h;
  };
  const doneListHtml = () => `<div class="plan-done">${S.matches.map((m) => vsHtml(m.id)).join('')}</div>`;

  // ---------- отрисовка ----------
  const draw = () => {
    if (!root.isConnected && root.dataset.drawn) return;
    root.dataset.drawn = '1';
    root.classList.add('tplan');
    const phoneView = isPhone();
    const head = `<div class="plan-head tp-head">${headHtml()}</div>`;
    if (nowIO) { nowIO.disconnect(); nowIO = null; }
    if (S.empty && !placed().length && !S.manual) {
      root.innerHTML = `<div class="plan">${head}<div class="plan-empty"><p>Матчей ещё нет. Сайт расставит ${S.matches.length}${NB}${plural(S.matches.length, 'матч', 'матча', 'матчей')} по ${S.courts.length}${NB}кортам, потом вы поправите</p><div class="btns"><button class="btn main" type="button" data-layout>${icon('month')}Расставить автоматически</button><button class="btn text" type="button" data-manual>Расставлю сам</button></div></div></div>`;
      hydrate(root);
      return;
    }
    if (isDone() && !placed().length) {
      root.innerHTML = `<div class="plan">${head}${doneListHtml()}</div>`;
      requestAnimationFrame(() => fitText(root));
      return;
    }
    const hasRest = rest().length > 0;
    const tools = isDone() ? '' : `<div class="line">${'<button class="btn text" type="button" data-addbreak>' + icon('pause') + 'Добавить перерыв</button>'}</div>`;
    root.innerHTML = `<div class="plan">${head}
      ${phoneView ? (hasRest ? stackHtml() : '') + phoneHtml() + tools : `<div class="plan-body${hasRest ? '' : ' flat'}">${hasRest ? stackHtml() : ''}<div class="stack">${gridHtml()}${legend}${tools}</div></div>`}</div>`;
    hydrate(root);
    if (!phoneView) {
      fitText(root); placeNow();
      requestAnimationFrame(() => { fitText(root); placeNow(); moreHint(); });
      const wrap = $('.pgrid-wrap', root); const grid = $('.pgrid', root);
      if (wrap) wrap.addEventListener('scroll', moreHint, { passive: true });
      if (gridRO) gridRO.disconnect();
      if (grid) { gridRO = new ResizeObserver(() => { placeNow(); moreHint(); }); gridRO.observe(grid); }
      if (!isDone()) $$('.mcard', root).forEach((c) => { const m = S.matches.find((x) => x.id === c.dataset.id); if (m && m.state === 'soon') wireDrag(c, m); });
    } else {
      requestAnimationFrame(() => fitText(root));
      // «К текущему» — только когда ни «сейчас», ни идущий матч не видны над нижней панелью:
      // кнопка не ложится на карточку текущего матча
      const marks = [$('#plan-now', root), ...$$('.plist-item[data-state="live"]', root)].filter(Boolean); const btn = $('.to-now', root);
      if (marks.length && btn && 'IntersectionObserver' in window) {
        const seen = new Set();
        nowIO = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); }); btn.hidden = seen.size > 0; }, { rootMargin: '0px 0px -150px 0px' });
        marks.forEach((x) => nowIO.observe(x));
      }
    }
    const tiles = $('.plan-days', root); const curT = tiles && $('[aria-current="true"]', tiles);
    if (tiles && curT && tiles.scrollWidth > tiles.clientWidth) tiles.scrollLeft = curT.offsetLeft - (tiles.clientWidth - curT.offsetWidth) / 2;
  };
  // корты не помещаются (1024): над сеткой «Видны корты 1–3 из 5» и кнопки
  const moreHint = () => {
    const wrap = $('.pgrid-wrap', root); const nav = $('.pg-nav', root); if (!wrap || !nav) return;
    const heads = $$('.pg-court', wrap);
    const tw = ($('.pg-corner', wrap) || {}).offsetWidth || 0;
    const seen = heads.filter((x) => x.offsetLeft >= wrap.scrollLeft + tw - 4 && x.offsetLeft + x.offsetWidth <= wrap.scrollLeft + wrap.clientWidth + 4);
    const right = heads.filter((x) => x.offsetLeft + x.offsetWidth > wrap.scrollLeft + wrap.clientWidth + 4);
    const left = heads.filter((x) => x.offsetLeft < wrap.scrollLeft + tw - 4);
    nav.hidden = !right.length && !left.length;
    if (nav.hidden) return;
    const nums = (list) => list.map((x) => courtNo(x.dataset.court));
    const say = (list) => { const n = nums(list); return n.length > 1 ? `Корты ${n[0]}–${n[n.length - 1]}` : `Корт ${n[0]}`; };
    const sn = nums(seen);
    $('.pg-seen', nav).textContent = sn.length ? `Видны ${sn.length > 1 ? `корты ${sn[0]}–${sn[sn.length - 1]}` : `корт ${sn[0]}`} из ${heads.length}` : '';
    const r = $('[data-more="1"]', nav); const l = $('[data-more="-1"]', nav);
    r.hidden = !right.length; if (right.length) r.innerHTML = `${say(right)}${icon('chev')}`;
    l.hidden = !left.length; if (left.length) l.innerHTML = `${icon('back')}${say(left)}`;
  };
  const placeNow = () => {
    if (!S.now || !isLive() || isPhone()) return;
    const grid = $('.pgrid', root); if (!grid) return;
    let line = $('.pg-now', grid); let tag = $('.pg-nowtag', grid);
    const idx = S.rows.findIndex((r, i) => r.min <= S.now.min && (!S.rows[i + 1] || S.rows[i + 1].min > S.now.min));
    const r = S.rows[idx]; const cell = r && $(`.pg-time[data-row="${CSS.escape(r.key)}"]`, grid);
    if (idx < 0 || !cell) { if (line) line.remove(); if (tag) tag.remove(); return; }
    const nx = S.rows[idx + 1];
    const frac = nx ? (S.now.min - r.min) / (nx.min - r.min) : 0.5;
    if (!line) { line = el('<div class="pg-now" id="plan-now" aria-hidden="true"></div>'); grid.append(line); }
    if (!tag) { tag = el(`<div class="pg-nowtag"><span class="now-tag" role="img" aria-label="Сейчас ${esc(S.now.label)}">${esc(S.now.label)}</span></div>`); grid.append(tag); }
    const y = `${cell.offsetTop + frac * cell.offsetHeight}px`;
    line.style.top = y; tag.style.top = y;
    nowTagAside(grid, tag);
  };

  // ---------- действия ----------
  const posWords = (m) => (m.court && rowOf(m.row) ? `${lowCourt(m.court)}, ${rowT(rowOf(m.row))}` : 'не стоял');
  const flash = (ids) => requestAnimationFrame(() => ids.forEach((id) => { const c = $(`[data-id="${CSS.escape(id)}"]`, root); if (c) c.classList.add('just'); }));
  // «Группа A» 1-й тур, «финал» — для строки журнала
  const sayName = (m) => (isLive() ? matchName(m.title) : `«${m.title}»${m.tour ? ' ' + m.tour : ''}`);
  const commit = (m, court, row) => {
    const before = m.court;
    m.court = court; m.row = row;
    if (!isLive()) { S.dirty = true; S.saved = state.now(); }
    closeLayer(true);
    draw(); flash([m.id]);
    const at = `${lowCourt(court)}, ${rowT(rowOf(row))}`;
    const undo = persist(isLive() ? `перенесли ${sayName(m)} на ${at}` : `${before ? 'перенесли' : 'поставили'} ${sayName(m)} на ${at} — черновик расписания ${onWhat()}`);
    toast(`${isLive() ? 'Перенесено и показано игрокам' : before ? 'Перенесено' : 'Поставлено'}: «${m.title}»${m.tour ? ' ' + m.tour : ''} — ${at}`, { undo });
    changed();
  };
  const swap = (m, x) => {
    const a = { court: m.court, row: m.row }; const b = { court: x.court, row: x.row };
    m.court = b.court; m.row = b.row; x.court = a.court; x.row = a.row;
    if (!isLive()) { S.dirty = true; S.saved = state.now(); }
    closeLayer(true);
    draw(); flash([m.id, x.id]);
    const undo = persist(`поменяли местами ${sayName(m)} и ${sayName(x)}: ${sayName(m)} — ${posWords(m)}, ${sayName(x)} — ${posWords(x)}`);
    toast(`${isLive() ? 'Поменяли местами и показали игрокам' : 'Поменяли местами'}: «${m.title}» — ${posWords(m)}; «${x.title}» — ${posWords(x)}`, { undo });
    changed();
  };
  // куда бы ни поставили: накладка — спросить до переноса; идущий день — «Проверьте»; черновик — сразу
  const go = (m, c, rk) => {
    const iss = tryAt(m, c, rk);
    if (iss.some((i) => i.bad)) { conflictSheet(m, c, rk, iss); return; }
    if (isLive()) checkSheet(m, c, rk, iss); else commit(m, c, rk);
  };
  const wireDrag = (card, m) => {
    drag(card, {
      ghost: () => { const g = card.cloneNode(true); g.classList.add('lifted'); g.classList.remove('issue-bad', 'issue-warn'); $$('.mc-issue, .mc-kept', g).forEach((x) => x.remove()); return g; },
      over: (x, y, ghost) => {
        $$('.pg-cell.target', root).forEach((t) => t.classList.remove('target', 'bad', 'warn'));
        const cell = document.elementFromPoint(x, y)?.closest('.pg-cell[data-court]');
        const w = $('.mc-where', ghost);
        if (!cell) { w.textContent = ''; ghost.classList.remove('bad'); return null; }
        const r = rowOf(cell.dataset.row);
        if (pastRow(r)) { w.textContent = `${rowT(r)} — уже прошло`; ghost.classList.add('bad'); return null; }
        const iss = tryAt(m, cell.dataset.court, cell.dataset.row);
        const bad = iss.some((i) => i.bad); const warn = !bad && iss.some((i) => i.warn);
        cell.classList.add('target'); if (bad) cell.classList.add('bad'); if (warn) cell.classList.add('warn');
        ghost.classList.toggle('bad', bad);
        w.textContent = `${lowCourt(cell.dataset.court)}, ${rowT(r)}${iss[0] ? ' — ' + lowLead(iss[0].t) : ''}`;
        return cell;
      },
      drop: (cell) => {
        cell.classList.remove('target', 'bad', 'warn');
        if (cell.dataset.court === m.court && cell.dataset.row === m.row) return;
        go(m, cell.dataset.court, cell.dataset.row);
      },
      cancel: () => $$('.pg-cell.target', root).forEach((t) => t.classList.remove('target', 'bad', 'warn')),
    });
  };

  // окно матча: где стоит, вызов на корт (идущий день), перенести
  const openMatch = (m) => {
    const r = rowOf(m.row);
    const where = m.court && r ? `${D.courtFull(m.court)} · ${rowT(r)}` : 'Ещё не в расписании';
    // мир приложения знает только матчи «Июньского кубка»; у черновых дней пар ещё нет
    const world = isLive() || isDone() ? D.match(m.id) : null;
    const vs = m.pairs ? (world ? vsHtml({ ...world, state: m.state, sets: m.sets, winner: m.winner, court: m.court, time: r ? rowT(r) : '', day: D.TODAY.dayMonth }) : `<div class="vs"><span class="vs-side"><span class="nm">${esc(D.pairName(m.pairs[0]))}</span></span><span class="vs-side"><span class="nm">${esc(D.pairName(m.pairs[1]))}</span></span></div>`) : `<div class="note">${icon('info')}<span>${esc(m.tbd)}</span></div>`;
    const canMove = m.state === 'soon' && !isDone();
    const callable = o.calls && isLive() && isToday() && m.state === 'soon' && m.pairs && world;
    const cs = callable ? callState(m.id) : null;
    let callHtml = '';
    let main = '';
    if (callable && cs) callHtml = `<div class="mw-call${cs.expired ? ' over' : ''}"><b>${esc(cs.text)}</b><span>Вызваны в ${esc(cs.at)} · ${esc(cs.clock)}</span></div>`;
    else if (callable) { callHtml = `<p class="muted">Вызывают за 20 минут — в ${hhmm(callTime(m.id))}</p>`; main = `<button class="btn main" type="button" data-call>${icon('bell')}Вызвать на ${esc(lowCourt(m.court))}</button>`; }
    if (!main && canMove && !isLive()) main = `<button class="btn main" type="button" data-move>${icon('move')}${m.court ? 'Перенести' : 'Поставить в расписание'}</button>`;
    const s = openSheet({
      title: stageWord(m),
      body: `${vs}<p class="lead"><b>${esc(where)}</b></p>${m.state === 'live' ? '<p class="muted">Матч идёт — перенести нельзя. Счёт ведёт судья корта</p>' : ''}${m.state === 'done' && world ? `<a class="btn text" href="${esc(keepTheme(`results.html?m=${m.id}&fix=1`))}">Исправить счёт</a>` : ''}${callHtml}`,
      foot: `${main}${callable && cs ? '<button class="btn quiet" type="button" data-uncall>Отменить вызов</button>' : ''}${canMove && isLive() ? `<button class="btn quiet" type="button" data-move>${icon('move')}Перенести</button>` : ''}${m.court && canMove && !isLive() ? '<button class="btn quiet" type="button" data-unplace>Убрать из расписания</button>' : ''}`,
    });
    const on = (sel, f) => { const b = s.querySelector(sel); if (b) b.addEventListener('click', f); };
    on('[data-move]', () => moveSheet(m));
    on('[data-unplace]', () => {
      m.court = null; m.row = null; S.dirty = true; S.saved = state.now();
      closeLayer(true); draw();
      const undo = persist(`убрали ${sayName(m)} из черновика расписания ${onWhat()}`);
      toast(`«${m.title}» убран из расписания`, { undo });
      changed();
    });
    on('[data-back]', () => closeLayer());
    on('[data-call]', () => {
      const go1 = () => { const undo = run(() => doCall(m.id)); closeLayer(true); draw(); toast(`Вызов отправлен обеим парам: ${low1(m.title)}, ${lowCourt(m.court)}`, { undo }); };
      if (tooEarly(m.id)) {
        // раньше обычного: сказать, когда начнут, если вызвать сейчас (у пар 20 минут на выход)
        const t0 = clockStartNow(m.id); const by = t0 != null ? Math.ceil((t0 + 20) / 5) * 5 : null; const plan = r ? r.min : toMin(m.time || '23:59');
        const then = by != null && by < plan ? `Если вызвать сейчас, пары выйдут на корт до ${hhmm(by)} и ${low1(m.title)} начнётся раньше расписания.` : 'Если вызвать сейчас, часы на выход пойдут, когда освободятся корт и обе пары.';
        confirmAction({ kind: 'main', title: `Вызвать на ${low1(m.title)} сейчас?`, text: `По расписанию ${low1(m.title)} ${atWords(r)}, обычно вызывают в ${hhmm(callTime(m.id))}. ${then}`, consq: dutyLines(m.id), action: 'Вызвать сейчас', cancel: 'Подождать', onConfirm: go1 });
      } else go1();
    });
    on('[data-uncall]', () => { const undo = run(() => uncall(m.id)); closeLayer(true); draw(); toast(`Вызов отменён: ${low1(m.title)}`, { undo }); });
  };
  // что занимает корт в это время — словами
  const busyText = (c, rk, m) => {
    const r = rowOf(rk); const ri = rowIndex(rk);
    const x = placed().find((y) => y !== m && y.court === c && y.row === rk);
    if (x) return matchName(x.title);
    const b = S.breaks.find((y) => (!y.court || y.court === c) && y.from < rowEnd(ri) && y.to > r.min);
    if (b) return b.kind === 'court' ? `корт закрыт ${breakWhen(b)}` : low1(breakText(b));
    const lv = placed().find((y) => y.court === c && y.state === 'live' && y.ends && toMin(y.ends) > r.min && start(y) < r.min);
    if (lv) return `до ${lv.ends} ${matchName(lv.title)}`;
    return '';
  };
  // корт и время — в одном окне: свободное время — обычные кнопки, занятое — серым словами, прошедшее скрыто
  const moveSheet = (m, pick) => {
    let c = pick || m.court || S.courts[0];
    const r0 = rowOf(m.row);
    const times = () => {
      const list = S.rows.filter((r) => !pastRow(r));
      return list.map((r) => {
        const here = c === m.court && r.key === m.row;
        const b = here ? '' : busyText(c, r.key, m);
        if (here) return `<span class="slot here"><b class="num">${esc(rowT(r))}</b><span>матч стоит здесь</span></span>`;
        if (b) return `<span class="slot busy"><b class="num">${esc(rowT(r))}</b><span>занято: ${esc(b)}</span></span>`;
        const warn = tryAt(m, c, r.key).some((i) => i.bad);
        return `<button type="button" class="slot free${warn ? ' warn' : ''}" data-r="${esc(r.key)}"><b class="num">${esc(rowT(r))}</b><span>${warn ? 'свободно, но есть накладка' : 'свободно'}</span></button>`;
      }).join('') || '<p class="muted">Свободного времени в этот день нет</p>';
    };
    const s = openSheet({
      title: m.court ? 'Куда перенести?' : 'Куда поставить?',
      body: `<p class="mv-what"><b>${esc(stageWord(m))}</b><span class="muted">${esc(pairs2(m))}${m.court && r0 ? ` · сейчас ${esc(lowCourt(m.court))}, ${esc(rowT(r0))}` : ''}</span></p>
        <h3 class="h3">Корт</h3>
        <div class="mv-courts" role="radiogroup" aria-label="Корт">${S.courts.map((x) => `<button type="button" class="choice" role="radio" aria-checked="${x === c}" data-value="${x}"><span class="t">${esc(courtName(x))}${D.COURTS[x].note ? ' · ' + esc(D.COURTS[x].note) : ''}</span><span class="s">${esc(D.SURFACES[D.COURTS[x].surface].label)}${x === m.court ? ' · матч стоит здесь' : ''}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div>
        <h3 class="h3 mv-th">Время на ${esc(courtLoc(c))}</h3>
        <div class="mv-times">${times()}</div>
        ${isLive() ? '<p class="muted">Игроки увидят перенос сразу</p>' : ''}`,
      foot: '<button class="btn quiet" type="button" data-back>Назад</button>',
    });
    s.querySelector('.mv-courts').addEventListener('change', (e) => { c = e.detail; s.querySelector('.mv-th').textContent = `Время на ${courtLoc(c)}`; s.querySelector('.mv-times').innerHTML = times(); e.stopPropagation(); });
    s.querySelector('.mv-times').addEventListener('click', (e) => { const b = e.target.closest('.slot.free'); if (b) go(m, c, b.dataset.r); });
    s.querySelector('[data-back]').addEventListener('click', () => openMatch(m));
  };
  // идущий день: игроки увидят сразу — сначала «Проверьте»
  const checkSheet = (m, c, rk, iss = tryAt(m, c, rk)) => {
    const r = rowOf(rk);
    const t = `${m.court ? 'Перенести' : 'Поставить'} «${m.title}»${m.tour ? ' ' + m.tour : ''} на ${lowCourt(c)}, ${rowT(r)}?`;
    const s = openSheet({
      title: 'Проверьте',
      body: `<p class="mv-sum">${esc(t)}</p><p class="muted">Игроки увидят сразу: приложение, сайт и табло в клубе</p>${iss.map((x) => `<div class="note ${x.bad ? 'bad' : 'warn'}">${icon(x.bad ? 'alert' : 'warn')}<span>${esc(x.t)}</span></div>`).join('')}`,
      // накладка — главное «Выбрать другое время», перенос — второе
      foot: iss.some((x) => x.bad)
        ? '<button class="btn main" type="button" data-back>Выбрать другое время</button><button class="btn quiet" type="button" data-go>Всё равно перенести</button>'
        : `<button class="btn main${isPhone() ? ' big' : ''}" type="button" data-go>${icon('eye')}Перенести и показать игрокам</button><button class="btn quiet" type="button" data-back>Назад</button>`,
    });
    s.querySelector('[data-go]').addEventListener('click', () => commit(m, c, rk));
    s.querySelector('[data-back]').addEventListener('click', () => moveSheet(m, c));
  };
  // накладка: спросить до переноса
  const conflictSheet = (m, c, rk, iss) => {
    const r = rowOf(rk);
    const occ = (iss.find((i) => i.occ) || {}).occ;
    const sp = freeSpot(m, rk);
    const canSwap = occ && occ.state === 'soon' && m.court && m.row;
    const courtBusy = iss.some((i) => i.bad && /^(court|live|brk):/.test(i.k));
    const title = courtBusy ? `${courtName(c)} ${atWords(r)} занят` : iss.some((i) => /^pair:/.test(i.k)) ? 'Пара в это время играет' : 'Здесь накладка';
    const s = openSheet({
      title,
      body: `<p class="mv-sum">«${esc(m.title)}»${m.tour ? ' ' + esc(m.tour) : ''} → ${esc(lowCourt(c))}, ${esc(rowT(r))}</p>${iss.filter((x) => x.bad).map((x) => `<div class="note bad">${icon('alert')}<span>${esc(x.t)}</span></div>`).join('')}${isLive() ? '<p class="muted">Что бы вы ни выбрали, игроки увидят сразу</p>' : ''}`,
      foot: `${sp ? `<button class="btn main" type="button" data-sp>Поставить на ${esc(spotWords(sp))} — свободно</button>` : `<button class="btn main" type="button" data-pick>Выбрать другое время</button>`}${canSwap ? '<button class="btn quiet" type="button" data-swap>Поменять их местами</button>' : ''}<button class="btn quiet" type="button" data-anyway>Всё равно сюда</button><button class="btn quiet" type="button" data-no>Отмена</button>`,
    });
    const on = (sel, f) => { const b = s.querySelector(sel); if (b) b.addEventListener('click', f); };
    on('[data-sp]', () => commit(m, sp.court, sp.row));
    on('[data-pick]', () => moveSheet(m, c));
    on('[data-swap]', () => swap(m, occ));
    on('[data-anyway]', () => commit(m, c, rk));
    on('[data-no]', () => closeLayer());
  };
  // нажатие на свободную клетку: что поставить сюда
  const stepSlot = (c, rk) => {
    const list = movable(c, rk);
    const r = rowOf(rk);
    const s = openSheet({
      title: 'Что поставить сюда?',
      body: `<p class="muted">${esc(courtName(c))} · ${esc(rowT(r))}</p><div class="stack tight">${list.map((m) => `<button type="button" class="choice" data-id="${esc(m.id)}"><span class="t">${esc(stageWord(m))}</span><span class="s">${m.court ? `сейчас ${esc(lowCourt(m.court))}, ${esc(rowT(rowOf(m.row)))}` : 'ещё не в расписании'}${m.pairs ? ' · ' + esc(pairs2(m)) : ''}</span></button>`).join('')}</div>`,
      foot: '<button class="btn quiet" type="button" data-back>Назад</button>',
    });
    s.addEventListener('click', (ev) => { const b = ev.target.closest('.choice[data-id]'); if (b) go(S.matches.find((x) => x.id === b.dataset.id), c, rk); });
    s.querySelector('[data-back]').addEventListener('click', () => closeLayer());
  };
  // «Расставлю сам»: пустые строки времени с начала дня
  const emptyRows = () => {
    const per = S.courts.length; const n = Math.ceil(S.matches.length / per);
    const t0 = toMin(S.start || '08:45'); const dur = S.round || 50;
    return Array.from({ length: n }, (_, i) => ({ key: `r${i + 1}`, min: t0 + i * dur, t: hhmm(t0 + i * dur), about: i > 0 }));
  };
  // публикация дня: кто увидит, что изменится, оставшиеся накладки
  const publish = () => {
    const n = countIssues();
    // что изменится для игроков: опубликованное (S.shown) против нынешнего
    const sh = S.published && S.shown ? S.shown : null;
    const shownRow = (k) => (sh ? (sh.rows || []).find((r) => r.key === k) : null);
    const changes = sh ? S.matches.map((m) => {
      const w = sh.place[m.id];
      const was = w ? `${lowCourt(w[0])}, ${rowT(shownRow(w[1]))}` : 'не стоял';
      const is = m.court && m.row ? `${lowCourt(m.court)}, ${rowT(rowOf(m.row))}` : 'убран из дня';
      return was === is ? null : `«${m.title}»${m.tour ? ' ' + m.tour : ''} — ${was} → ${is}`;
    }).filter(Boolean) : [];
    const byTime = placed().slice().sort((a, b) => start(a) - start(b) || a.court.localeCompare(b.court));
    const s = openSheet({
      title: `Опубликовать расписание на ${WD_ACC[dow(S.day)]}, ${dayNo(S.day)}${NB}${MON_GEN[monIdx(S.day)]}?`,
      wide: true,
      body: `<ul class="where"><li>${icon('phone')}<span><b>Игроки</b> — в приложении: «Турнир» → «Расписание», у себя — «Ваш матч»</span></li><li>${icon('site')}<span><b>Сайт</b> — страница «${esc(S.cupName || '')}» → «Расписание»</span></li><li>${icon('board')}<span><b>Табло в клубе</b> — «Все корты»</span></li></ul>
        <figure class="pub-site"><figcaption class="pv-cap">${icon('site')}Так будет на сайте</figcaption><div class="browser"><div class="bar-top"><i></i><i></i><i></i><span>Сайт лиги · Расписание</span></div><div class="page">${byTime.slice(0, 4).map((m) => `<div class="site-row"><span class="d">${esc(rowOf(m.row).t)}</span><span class="t">${esc(courtName(m.court))} · ${esc(m.title)}</span><span class="s">${esc(pairs2(m))}</span></div>`).join('')}${byTime.length > 4 ? `<p class="muted">и ещё ${byTime.length - 4} ${plural(byTime.length - 4, 'матч', 'матча', 'матчей')}</p>` : ''}</div></div></figure>
        ${changes.length ? `<div class="stack tight"><h3 class="h3">Что изменится для игроков</h3><ul class="where">${changes.map((c) => `<li>${icon('arrow')}<span>${esc(c)}</span></li>`).join('')}</ul></div>` : ''}
        ${n.bad ? `<div class="note bad">${icon('alert')}<span>Осталось ${n.bad} ${plural(n.bad, 'накладка', 'накладки', 'накладок')} — игроки увидят расписание с ними</span></div>` : ''}
        ${n.fin ? `<div class="note warn">${icon('warn')}<span>${esc(finPub())}</span></div>` : ''}`,
      foot: `<button class="btn main" type="button" data-ok>${icon('eye')}${S.published ? 'Опубликовать правки' : 'Опубликовать день'}</button><button class="btn quiet" type="button" data-no>Отмена</button>`,
    });
    s.querySelector('[data-ok]').addEventListener('click', () => {
      closeLayer(true);
      const again = !!S.published;
      S.published = `в ${state.now()}`; S.dirty = false;
      S.shown = { place: placeOf(), rows: S.rows.map((r) => ({ ...r })), breaks: S.breaks.map((b) => ({ ...b })) };
      draw();
      persist(`${again ? 'опубликовали правки расписания' : 'опубликовали расписание'} ${onWhat()}${S.cupName ? ` — «${S.cupName}»` : ''}`, 'publish');
      changed();
    });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  };
  // «Вернуть опубликованное»: матчи и время — как видят игроки
  const revert = () => {
    const sh = S.shown; if (!sh) return;
    S.matches.forEach((x) => { const p = sh.place[x.id]; x.court = p ? p[0] : null; x.row = p ? p[1] : null; });
    S.rows = (sh.rows || S.rows).map((r) => ({ ...r })); S.dirty = false;
    if (sh.breaks) S.breaks = sh.breaks.map(normBreak);
    draw();
    const undo = persist(`вернули опубликованное расписание ${onWhat()}: черновые правки убраны`, 'revert');
    toast('Вернули опубликованное: черновые правки убраны', { undo });
    changed();
  };
  // «Добавить перерыв» → что это → с и до → какие корты закрыты
  const choiceMsg = (s, t) => { const p = s.querySelector('.pick-msg'); if (p) { p.textContent = t; p.hidden = !t; } };
  const addBreak = () => {
    const s = openSheet({ title: 'Что это?', body: `<p class="pick-msg" role="alert" hidden></p>${choicesHtml('Что это', Object.entries(BREAK_KINDS).map(([v, t]) => ({ value: v, t })), 'one')}`, foot: `<button class="btn main" type="button" data-next>Дальше${icon('arrow')}</button><button class="btn quiet" type="button" data-no>Отмена</button>` });
    let kind = null;
    s.addEventListener('change', (e) => { if (e.detail) { kind = e.detail; choiceMsg(s, ''); } });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
    s.querySelector('[data-next]').addEventListener('click', () => (kind ? stepWhen(kind) : choiceMsg(s, 'Выберите, что это: перерыв, закрытый корт или открытие')));
  };
  const stepWhen = (kind) => {
    const next = S.rows.find((r) => !pastRow(r)) || S.rows[0];
    const f0 = next ? next.min : toMin(S.start || '08:45');
    const timeField = (k, label, v) => `<div class="field" data-f="${k}"><label class="label" for="brk-${k}">${label}</label><span class="err">${icon('alert')}<span></span></span><input class="input num" id="brk-${k}" inputmode="numeric" value="${hhmm(v)}" style="max-width:200px"></div>`;
    const s = openSheet({
      title: 'Когда?',
      body: `<p class="muted">${esc(BREAK_KINDS[kind])}</p><div class="line" style="align-items:flex-start;gap:20px">${timeField('from', 'С', f0)}${timeField('to', 'До', f0 + 30)}</div>`,
      foot: `<button class="btn main" type="button" data-ok>${kind === 'court' ? `Дальше${icon('arrow')}` : 'Добавить перерыв'}</button><button class="btn quiet" type="button" data-back>Назад</button>`,
    });
    const readT = (k) => {
      const f = s.querySelector(`[data-f="${k}"]`); const v = $('input', f).value; const t = parseTime(v);
      f.classList.toggle('error', !t); if (!t) $('.err span', f).textContent = `Не понял время «${v}». Например: 13:00`;
      return t ? toMin(t) : null;
    };
    s.querySelector('[data-ok]').addEventListener('click', () => {
      const a = readT('from'); const b = readT('to');
      if (a === null || b === null) return;
      if (b <= a) { const f = s.querySelector('[data-f="to"]'); f.classList.add('error'); $('.err span', f).textContent = `Конец раньше начала. Например: с ${hhmm(a)} до ${hhmm(a + 30)}`; return; }
      if (kind === 'court') stepShut(a, b); else addB([{ kind, from: a, to: b }]);
    });
    s.querySelector('[data-back]').addEventListener('click', addBreak);
  };
  const stepShut = (a, b) => {
    const s = openSheet({
      title: 'Какие корты закрыты?',
      body: `<p class="muted">${hhmm(a)}–${hhmm(b)}</p><p class="pick-msg" role="alert" hidden></p><div class="checks">${S.courts.map((c) => `<label class="check"><input type="checkbox" data-c="${c}"><span class="box">${icon('check')}</span><span class="srf" style="background:linear-gradient(160deg,var(--srf),var(--srf-2))" data-srf="${D.COURTS[c].surface}"></span><span>${esc(D.courtFull(c))}</span></label>`).join('')}</div>`,
      foot: '<button class="btn main" type="button" data-ok>Добавить перерыв</button><button class="btn quiet" type="button" data-back>Назад</button>',
    });
    s.querySelector('[data-ok]').addEventListener('click', () => {
      const cs = $$('input[data-c]:checked', s).map((x) => x.dataset.c);
      if (!cs.length) { choiceMsg(s, 'Отметьте хотя бы один корт'); return; }
      addB(cs.map((c) => ({ kind: 'court', court: c, from: a, to: b })));
    });
    s.querySelector('[data-back]').addEventListener('click', () => stepWhen('court'));
  };
  const addB = (list) => {
    const nb = list.map(normBreak);
    S.breaks.push(...nb);
    if (!isLive()) { S.dirty = true; S.saved = state.now(); }
    closeLayer(true); draw();
    const what = nb.map(breakText).join('; ');
    const undo = persist(`добавили в расписание ${onWhat()}: ${lowLead(what)}`, 'breaks');
    toast(`${isLive() ? 'Добавлено и показано игрокам' : 'Добавлено'}: ${what}`, { undo });
    changed();
  };
  const toNow = () => { const n = $('#plan-now', root) || $('.pgrid-wrap', root); if (n) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  root.addEventListener('click', (e) => {
    const t = e.target;
    const card = t.closest('[data-id]');
    const m = card ? S.matches.find((x) => x.id === card.dataset.id) : null;
    if (t.closest('[data-keepall]') && m) {
      const iss = openIssues(m);
      // накладка двух матчей — одна: «Оставить так» снимает её и с другой карточки
      iss.forEach((x) => {
        S.kept.add(`${m.id}|${x.k}`);
        const [kind, other, rest] = x.k.split(':');
        if (['court', 'pair', 'rest'].includes(kind) && other) S.kept.add(`${other}|${kind}:${m.id}${rest ? ':' + rest : ''}`);
      });
      draw();
      const undo = persist(`оставили так: ${sayName(m)} — ${iss[0] ? lowLead(iss[0].t) : ''}`, 'kept');
      toast('Оставлено так', { undo });
      return;
    }
    const fx = t.closest('[data-fix]');
    if (fx && m) { const [c, rk] = fx.dataset.fix.split('|'); if (isLive()) checkSheet(m, c, rk); else commit(m, c, rk); return; }
    // финал — на корт финала, а там стоит другой матч: поменять их местами
    const sw = t.closest('[data-swap]');
    if (sw && m) { const x = S.matches.find((y) => y.id === sw.dataset.swap); if (x) swap(m, x); return; }
    const mv = t.closest('[data-move]');
    if (mv && m) { moveSheet(m, mv.dataset.move || undefined); return; }
    const dayB = t.closest('[data-day]');
    if (dayB) { if (o.onDay && dayB.dataset.day !== S.day) o.onDay(dayB.dataset.day); return; }
    const open = t.closest('.mc-open, .pl-open');
    if (open && m) { openMatch(m); return; }
    if (t.closest('[data-publish]')) { publish(); return; }
    if (t.closest('[data-revert]')) { revert(); return; }
    if (t.closest('[data-layout]')) { if (o.arrange) o.arrange(); return; }
    if (t.closest('[data-manual]')) { S.rows = emptyRows(); S.manual = true; S.saved = state.now(); draw(); persist('', 'layout'); changed(); return; }
    if (t.closest('[data-tonow]')) { toNow(); return; }
    if (t.closest('[data-played]')) { S.showPlayed = !S.showPlayed; draw(); return; }
    if (t.closest('[data-issues]')) { const c = $('[data-issue]', root); if (c) { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); $('.mc-open, .pl-open', c).focus({ preventScroll: true }); } return; }
    if (t.closest('[data-addbreak]')) { addBreak(); return; }
    const more = t.closest('[data-more]');
    if (more) { const w = $('.pgrid-wrap', root); const col = $('.pg-court', root); if (w && col) w.scrollBy({ left: +more.dataset.more * col.offsetWidth * 2, behavior: 'smooth' }); return; }
    const slot = t.closest('[data-slot]');
    if (slot) { const cell = slot.closest('.pg-cell'); stepSlot(cell.dataset.court, cell.dataset.row); }
  });
  draw();
  let wasPhone = isPhone();
  addEventListener('resize', () => { if (!root.isConnected) return; if (isPhone() !== wasPhone) { wasPhone = isPhone(); draw(); } else { placeNow(); moreHint(); } });
  document.addEventListener('adm:view', () => { if (root.isConnected) draw(); });
  return { get state() { return S; }, draw, load(p) { init(p); draw(); }, rowT };
}
