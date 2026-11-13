// TLTS · group.html — «Арифметика группы» (моя идея, заказчик ещё не утверждал).
// Логика — ideas/group.logic.js (тесты ideas/tests/group.test.mjs), архив — ideas/group.data.js
// (собирает ideas/tools/build-group.py из research/data), демо-группа — ideas/group.demo.js.
// Карточки, плашки и мячи — только core/card.js.

import { playerOf, pairOf, playersOfPair } from './core/data.js';
import { pairBallHTML, pairPlateHTML } from './core/card.js';
import { mountProtoBar, mountIdeaNote } from './core/protobar.js';
import { role, me, setRole, setMe, onIdentityChange, ROLE_LABELS } from './core/identity.js';
import {
  rankGroup, reasonBetween, winsPattern, whatYouNeed, headToHead, isShortened, noWinner, gamesToPass,
} from './ideas/group.logic.js';
import { GROUP_ARCHIVE } from './ideas/group.data.js';
import { DEMO_PAIRS, DEMO_ROUNDS, DEMO_STATES, DEMO_GROUP, playedMatches, remainingMatches } from './ideas/group.demo.js';

/* ------------------------------------------------------------------ полоска и плашка идеи */

mountProtoBar({ current: 'group' });
mountIdeaNote(null, {
  title: 'Арифметика группы',
  score: 8.3,
  approvals: 3,
  why: 'Пара видит, что ей нужно для выхода в Grand Masters, а после группы — почему места распределились так. В 50 из 228 групп архива у 2-й и 3-й пары поровну побед, и границу решает правило, которое на корте вручную считать непросто.',
  changed: [
    'Во время последнего тура подсказка «Что вам нужно» скрыта у всех пар. Так всегда, это не настройка директора (Кодекс поведения, пункт 2.11).',
    '«Что вам нужно» — только словами, без точного счёта.',
    'Блок о разнице между местами назван «Что даёт место».',
    '«Почему так» видят только участники группы; на общем табло его нет.',
    'Матчи 0:0 и сокращённые матчи помечены «правило уточняется у лиги».',
  ],
  league: [
    'Как матч 0:0 (неявка или снятие пары) входит в процент выигранных геймов и кому записывается победа?',
    'Как сравнивать процент, если часть матчей группы сокращена из-за погоды?',
    'Какая шкала баллов действует в 2026 году: решения Совета 2023 года или регламент 2022 года?',
    'Что делать, если процент равен у всех трёх пар?',
  ],
});

/* ------------------------------------------------------------------ мелочи */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
const wins = (n) => `${n} ${plural(n, 'победа', 'победы', 'побед')}`;
const games = (n) => `${n} ${plural(n, 'гейм', 'гейма', 'геймов')}`;
const pctText = (x, d = 2) => `${x.toFixed(d).replace('.', ',')}%`;
// дробное число — «процентного пункта» (1,61 процентного пункта)
const ppText = (x) => `${x.toFixed(2).replace('.', ',')} процентного пункта`;
const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : '[ДАТА]'; };
const lsGet = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* без хранилища — просто не запоминаем */ } };
// «в 3 раза», «в 4,3 раза», «в 5 раз»: целое — по числу, дробное — «раза»
function timesText(x) {
  const v = Math.round(x * 10) / 10;
  if (Number.isInteger(v)) return `в ${v} ${plural(v, 'раз', 'раза', 'раз')}`;
  return `в ${String(v).replace('.', ',')} раза`;
}
const NUM = ['', 'одна', 'две', 'три', 'четыре', 'пять'];
const NUMF = ['', 'одной', 'двух', 'трёх', 'четырёх', 'пяти'];

/* ------------------------------------------------------------------ пары: демо и архив в одном виде */

// Архивный человек: только имя из сетки и КПР из рейтинга 2026 (у прошлых сезонов — нет).
function archivePerson(p) {
  const parts = p.name.trim().split(/\s+/);
  const last = parts[0], first = parts[1] || '';
  return { last, first, name: [first, last].filter(Boolean).join(' '), short: first ? `${last} ${[...first][0]}.` : last, kpr: p.kpr, demo: false };
}
function demoPair(id) {
  const pair = pairOf(id);
  const ps = playersOfPair(id);
  return { id, pair, players: ps, label: ps.map((p) => p.short).join(' · '), lastNames: ps.map((p) => p.last).join(' и '), demo: true };
}
function archivePairs(g) {
  return g.pairs.map((pp, i) => {
    const ps = pp.map(archivePerson);
    return { id: `${g.id}-${i}`, pair: { id: `${g.id}-${i}` }, players: ps, label: ps.map((p) => p.short).join(' · '), lastNames: ps.map((p) => p.last).join(' и '), demo: false };
  });
}
const ballOf = (P, size = 24) => pairBallHTML(P.players[0]?.kpr ?? null, P.players[1]?.kpr ?? null, { size, decorative: true, order: 'level' });
const shortPair = (P) => P.players.map((p) => p.last).join('/');

/* ------------------------------------------------------------------ таблица группы */

/**
 * Таблица с «=» у равных и подписью, чем решено.
 * opts: { cut: { up, down } | null, mine: индекс | null, live: bool }
 */
function tableHTML(P, matches, opts = {}) {
  const n = P.length;
  const r = rankGroup(n, matches);
  const tieOf = (i) => r.ties.find((t) => t.members.includes(i));
  const notes = new Map();   // индекс последней строки блока → html подписи
  r.ties.forEach((t, k) => {
    const last = t.members[t.members.length - 1];
    notes.set(last, (notes.get(last) || '') + tieNoteHTML(P, matches, r, t, k));
  });
  const rows = [];
  r.order.forEach((i, k) => {
    const row = r.rows[i];
    const t = tieOf(i);
    const isMine = opts.mine === i;
    const eq = t ? `<span class="gr-eq" title="Поровну побед" aria-label="поровну побед с соседней парой">=</span>` : '';
    rows.push(`<tr class="${isMine ? 'is-you' : ''}${t ? ' gr-tied' : ''}">`
      + `<td class="tbl__place"><span class="gr-place">${k + 1}${eq}</span></td>`
      + `<td class="gr-paircell"><span class="gr-pair">${ballOf(P[i])}<span class="gr-pair__names">${P[i].players.map((p) => `<span>${esc(p.short)}</span>`).join('')}</span></span>`
      + `${isMine ? '<span class="you-pin">ваша пара</span>' : ''}</td>`
      + `<td class="n r gr-w">${row.w}<span class="gr-sub">из ${row.played}</span></td>`
      + `<td class="n r gr-pct">${row.games ? pctText(row.pct) : '—'}<span class="gr-sub">${row.gw} из ${row.games}</span></td>`
      + '</tr>');
    if (notes.has(i)) rows.push(notes.get(i));
    if (opts.cut && k === 1 && n >= 3) {
      rows.push(`<tr class="gr-cut"><td colspan="4"><span class="gr-cut__up">↑ ${esc(opts.cut.up)}</span><span class="gr-cut__down">↓ ${esc(opts.cut.down)}</span></td></tr>`);
    }
  });
  const odd = matches.filter((m) => isShortened(m) || noWinner(m));
  const oddNote = odd.length
    ? `<p class="gr-flag"><span class="tag tag--soon">Правило уточняется у лиги</span> В группе ${odd.length === 1 ? 'есть матч' : `есть ${odd.length} ${plural(odd.length, 'матч', 'матча', 'матчей')}`} не полным сетом: ${odd.map((m) => `${m[2]}:${m[3]}`).join(', ')}. Как такие матчи входят в процент геймов, регламент не говорит.</p>`
    : '';
  return `<div class="tscroll gr-tscroll"><table class="tbl gr-tbl">
      <caption class="vh">Таблица группы: места, победы, процент выигранных геймов</caption>
      <thead><tr><th scope="col">№</th><th scope="col">Пара</th><th scope="col" class="r">Победы</th><th scope="col" class="r">Геймы</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></div>${oddNote}`;
}

function scoreOf(m, a) { return m[0] === a ? `${m[2]}:${m[3]}` : `${m[3]}:${m[2]}`; }

function tieNoteHTML(P, matches, r, t, k) {
  const cnt = t.members.length;
  const head = `${cnt === 2 ? 'Две пары' : `${NUM[cnt][0].toUpperCase()}${NUM[cnt].slice(1)} пары`} по ${t.wins} ${plural(t.wins, 'победе', 'победы', 'побед')}`;
  let body;
  if (t.by === 'h2h') {
    const [a, b] = t.members;
    body = `Решила личная встреча: ${esc(shortPair(P[a]))} — ${esc(shortPair(P[b]))} ${scoreOf(t.h2h, a)}. Процент геймов при двух равных не считается.`;
  } else if (t.by === 'pct') {
    const list = t.members.map((i) => `${esc(shortPair(P[i]))} ${pctText(r.rows[i].pct)}`).join(' · ');
    body = `Решил процент выигранных геймов: ${list}. Личная встреча при трёх равных не решает.`;
    for (const s of t.sub || []) {
      if (s.by === 'h2h') body += ` У ${esc(shortPair(P[s.members[0]]))} и ${esc(shortPair(P[s.members[1]]))} процент одинаковый — тогда решила личная встреча ${scoreOf(s.h2h, s.members[0])}.`;
      else if (s.by === 'pending') body += ` У ${esc(shortPair(P[s.members[0]]))} и ${esc(shortPair(P[s.members[1]]))} процент одинаковый, а личная встреча ещё впереди — место предварительное.`;
      else body += ` У ${s.members.map((i) => esc(shortPair(P[i]))).join(', ')} процент одинаковый, а личная встреча ничего не решает. <b>Правило уточняется у лиги.</b>`;
    }
  } else if (t.by === 'pending') {
    const list = t.members.map((i) => `${esc(shortPair(P[i]))} ${pctText(r.rows[i].pct)}`).join(' · ');
    body = `Пары ещё не встречались — место предварительное. Пока выше та, у которой больше процент геймов: ${list}. Когда сыграют, решит личная встреча.`;
  } else {
    body = `Личная встреча без победителя${t.h2h ? ` (${t.h2h[2]}:${t.h2h[3]})` : ''}. Регламент не говорит, как быть. <b>Правило уточняется у лиги.</b>`;
  }
  return `<tr class="gr-note"><td colspan="4"><span class="gr-note__mark" aria-hidden="true">=</span><span><b>${head}.</b> ${body}</span></td></tr>`;
}

function matchesHTML(P, matches, { title = 'Матчи группы' } = {}) {
  const li = matches.map((m) => {
    const [a, b, ga, gb] = m;
    const wa = ga > gb, wb = gb > ga;
    const flag = isShortened(m) || noWinner(m) ? ' <span class="gr-odd">не полный сет</span>' : '';
    return `<li class="gr-ml__row"><span class="gr-ml__p${wa ? ' is-win' : ''}">${esc(shortPair(P[a]))}</span>`
      + `<span class="gr-ml__s">${ga}:${gb}</span><span class="gr-ml__p${wb ? ' is-win' : ''}">${esc(shortPair(P[b]))}</span>${flag}</li>`;
  }).join('');
  return `<details class="gr-ml"><summary class="gr-ml__sum">${esc(title)} · ${matches.length}</summary><ol class="gr-ml__list">${li}</ol></details>`;
}

/* ------------------------------------------------------------------ 01 · цифры архива */

const S = GROUP_ARCHIVE.summary;
function renderFacts() {
  const pctBoundary = S.boundary.pct + S.boundary['pct-h2h'];
  const share = Math.round((S.tie23 / S.groups4Decided) * 100);
  $('gr-stats').innerHTML = [
    [S.tie23, `из ${S.groups4Decided} групп по 4 пары: у 2-й и 3-й пары поровну побед (${share}%)`],
    [pctBoundary, `из ${S.groups4Full} групп с полными сетами: выход в Grand Masters решил процент геймов`],
    [S.pctGapUpTo2, 'из них разрыв не больше двух процентных пунктов — около одного гейма'],
    [`${S.groupsMatched}<small>/${S.groupsChecked}</small>`, 'групп: пересчёт мест совпал с таблицей сайта лиги'],
  ].map(([n, t]) => `<div class="stat"><span class="stat__n">${n}</span><span class="cap">${t}</span></div>`).join('');
  $('gr-facts-note').innerHTML = `Раскладки побед: 3-2-1-0 — ${S.patterns['3-2-1-0']}, 2-2-1-1 — ${S.patterns['2-2-1-1']}, 2-2-2-0 — ${S.patterns['2-2-2-0']}, 3-1-1-1 — ${S.patterns['3-1-1-1']}. Если у 2-й и 3-й пары поровну побед, равных в группе из четырёх пар всегда трое — поэтому выход в Grand Masters решает процент, а личная встреча вступает, только когда процент совпал (так было ${S.boundary['pct-h2h']} раза). Медиана разрыва — ${ppText(S.pctGapMedian)}`;
}

/* ------------------------------------------------------------------ 02–03 · демо-группа */

const DP = DEMO_PAIRS.map(demoPair);
const narrow = window.matchMedia('(max-width: 719px)');
narrow.addEventListener?.('change', () => renderRounds());
const LS_STATE = 'tlts-group-state';
let stateId = (() => {
  const q = new URLSearchParams(location.search).get('state');
  if (DEMO_STATES.some((s) => s.id === q)) return q;
  const s = lsGet(LS_STATE);
  return DEMO_STATES.some((x) => x.id === s) ? s : 'r2';
})();
const stateOf = () => DEMO_STATES.find((s) => s.id === stateId);

function myIndex() {
  if (role() !== 'player') return null;
  const id = me();
  const k = DP.findIndex((P) => P.players.some((p) => p.id === id));
  return k >= 0 ? k : null;
}

function renderStates() {
  $('gr-states').innerHTML = DEMO_STATES.map((s, k) => `<button class="gr-state" type="button" data-state="${s.id}" aria-pressed="${s.id === stateId}">`
    + `<span class="gr-state__n">${k + 1}</span><span class="gr-state__t">${esc(s.label)}</span></button>`).join('');
}

function renderRounds() {
  const st = stateOf();
  const mine = myIndex();
  $('gr-rounds').innerHTML = DEMO_ROUNDS.map((rd, k) => {
    const played = k < st.played;
    const live = !played && st.live && k === st.played;
    const head = played ? `<span class="tag tag--done">Сыгран</span>` : live ? `<span class="tag tag--live">Идёт</span>` : `<span class="tag tag--soon">Скоро · ${rd.time}</span>`;
    const ms = rd.matches.map((m) => {
      const sc = played ? m.score : live ? m.live : null;
      const plate = (side) => {
        const idx = side === 0 ? m.a : m.b;
        const P = DP[idx];
        const opts = { layer: 'air', size: narrow.matches ? 'sm' : 'md' };
        if (sc) opts.score = sc[side];
        if (played) opts.winner = (side === 0 ? sc[0] > sc[1] : sc[1] > sc[0]);
        return `<div class="gr-match__side${mine === idx ? ' is-mine' : ''}">${pairPlateHTML(P.pair, P.players, opts)}</div>`;
      };
      const note = played && m.tb ? `<span class="cap">7:6, тай-брейк ${m.tb[0]}:${m.tb[1]}</span>` : live ? '<span class="cap">идёт · счёт по геймам</span>' : '';
      const you = mine === m.a || mine === m.b ? '<span class="tag tag--you">ваша пара</span>' : '';
      return `<li class="gr-match"><p class="cap gr-match__court"><span>${esc(m.court)}${note ? ' · ' : ''}${note}</span>${you}</p>${plate(0)}${plate(1)}</li>`;
    }).join('');
    return `<article class="gr-round${live ? ' is-live' : ''}${played ? ' is-played' : ''}"><header class="gr-round__head"><h3 class="gr-round__title">${rd.n}-й тур</h3>${head}</header><ul class="gr-round__list" role="list">${ms}</ul></article>`;
  }).join('');
}

function renderDemoTable() {
  const st = stateOf();
  const ms = playedMatches(st);
  const mine = myIndex();
  const sub = st.live
    ? '<p class="gr-tnote cap">В таблице только сыгранные матчи. Идущий тур войдёт в неё после финального счёта.</p>'
    : st.played < 3 ? '<p class="gr-tnote cap">Таблица по сыгранным матчам. Места окончательные только после всех шести матчей.</p>' : '';
  $('gr-table-meta').textContent = `${DEMO_GROUP.name} · ${st.short}`;
  $('gr-demo-table').innerHTML = `<div class="gr-tablehead"><p class="cap cap--strong">${esc(DEMO_GROUP.name)} · ${esc(DEMO_GROUP.tournament)}</p><span class="tag tag--demo">Демо-данные</span></div>`
    + tableHTML(DP, ms, { cut: { up: 'Grand Masters · высшая категория', down: 'Masters · вторая категория' }, mine })
    + sub
    + `<p class="gr-humans"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="6.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 17c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span>Сайт считает по регламенту и показывает расчёт. Места утверждает главный судья; если расчёт ошибся, директор правит место вручную, и правка остаётся в журнале.</span></p>`
    + `<p class="gr-board cap">На общем табло — только эта таблица со знаком «=» и подписью. Подсказки и объяснение справа там не показываются.</p>`;
}

/* ---------- блок «для вашей пары» */

function needLines(w, P, mine) {
  const lines = [];
  const m = w.mine;
  for (const b of w.byWins) {
    let s;
    if (m === 1) {
      const dep = b.on === 'games' ? 'процент геймов: важен каждый гейм' : b.on === 'others' ? 'соседний матч' : 'соседний матч, а затем процент геймов: важен каждый гейм';
      if (b.wins === 1) {
        s = b.result === 'always' ? 'Победа в последнем матче гарантирует Grand Masters — при любом исходе соседнего матча.'
          : b.result === 'never' ? 'Даже при победе в последнем матче — места 3–4 и плей-офф Masters.'
          : `Даже при победе всё решит ${dep}.`;
      } else {
        s = b.result === 'always' ? 'Даже при поражении в последнем матче вы остаётесь в Grand Masters.'
          : b.result === 'never' ? 'При поражении — места 3–4 и плей-офф Masters.'
          : `При поражении всё решит ${dep}.`;
      }
    } else {
      const subj = b.wins === m ? (m === 2 ? 'Две победы в двух оставшихся матчах' : `Победы во всех ${m} оставшихся матчах`) : b.wins === 0 ? 'Без побед в оставшихся матчах' : `${b.wins === 1 ? 'Одна победа' : `${b.wins} победы`} из ${m === 2 ? 'двух' : m}`;
      if (b.result === 'always') s = `${subj} — Grand Masters при любом исходе других матчей.`;
      else if (b.result === 'never') s = `${subj} — места 3–4 и плей-офф Masters.`;
      else s = `${subj} — всё зависит от ${b.on === 'games' ? 'процента геймов' : b.on === 'others' ? 'других матчей группы' : 'других матчей группы и процента геймов'}${b.on !== 'others' ? ': важен каждый гейм' : ''}.`;
    }
    lines.push({ s, result: b.result });
  }
  return lines;
}

function whyLines(P, matches, mine) {
  const r = rankGroup(P.length, matches);
  const row = r.rows[mine];
  const place = r.place[mine];
  const t = r.ties.find((x) => x.members.includes(mine));
  const cat = place <= 2 ? 'плей-офф Grand Masters, высшая категория' : 'плей-офф Masters, вторая категория';
  const out = [];
  if (!t) {
    out.push(`У вас ${wins(row.w)} из ${row.played}. Столько больше ни у кого в группе — место решили победы.`);
    out.push(`Процент геймов (${pctText(row.pct)}, ${row.gw} из ${row.games}) не понадобился: он считается только при равенстве у трёх пар.`);
  } else if (t.by === 'h2h') {
    const other = t.members.find((x) => x !== mine);
    const h = headToHead(matches, mine, other);
    const won = h.winner === mine;
    out.push(`У вас ${wins(row.w)} из ${row.played} — столько же у пары ${shortPair(P[other])}.`);
    out.push(`При равенстве у двух пар решает личная встреча: вы ${won ? 'выиграли' : 'проиграли'} ${scoreOf(h.match, mine)}. Процент геймов (у вас ${pctText(row.pct)}, у них ${pctText(r.rows[other].pct)}) здесь не считается.`);
  } else {
    const others = t.members.filter((x) => x !== mine);
    out.push(`У вас ${wins(row.w)} из ${row.played} — столько же у пар ${others.map((x) => shortPair(P[x])).join(' и ')}. Трое равных — решает процент выигранных геймов.`);
    const list = t.members.map((x) => `${x === mine ? 'у вас' : shortPair(P[x])} ${pctText(r.rows[x].pct)} (${r.rows[x].gw} из ${r.rows[x].games})`).join(', ');
    // победа над парой, которая всё равно выше: при трёх равных личная встреча не решает
    const beatAbove = others.find((x) => r.place[x] < place && headToHead(matches, mine, x).winner === mine);
    out.push(`Проценты: ${list}.${beatAbove !== undefined ? ` Ваша победа над парой ${shortPair(P[beatAbove])} ${scoreOf(headToHead(matches, mine, beatAbove).match, mine)} при трёх равных отдельно не учитывается — только её геймы.` : ''}`);
  }
  // третья строка: итог и цена разрыва у черты
  let last = `Итог: ${place}-е место — ${cat}.`;
  const above = r.order[place - 2];
  if (t && t.by === 'pct' && place === 3 && t.members.includes(above)) {
    const k = gamesToPass(row, r.rows[above]);
    const gap = r.rows[above].pct - row.pct;
    if (k !== null) last += ` Разница со 2-м местом — ${ppText(gap)}: хватило бы ${k === 1 ? 'одного выигранного гейма' : `${NUMF[k] || k} выигранных геймов`} вместо проигранного.`;
  } else if (t && t.by === 'pct' && place === 2) {
    const below = r.order[2];
    if (t.members.includes(below)) last += ` Запас над 3-м местом — ${ppText(row.pct - r.rows[below].pct)}.`;
  }
  out.push(last);
  return { lines: out, place, cat };
}

function renderSide() {
  const st = stateOf();
  const mine = myIndex();
  const box = $('gr-side');
  if (mine === null) {
    const roleName = ROLE_LABELS?.[role()] || role();
    const who = role() === 'player' ? `Вы вошли как игрок, но ваша пара не в этой группе.` : `Сейчас вы смотрите как «${esc(roleName)}».`;
    box.innerHTML = `<article class="panel panel--pad gr-card gr-card--closed">
      <p class="cap cap--strong">Для пары из группы</p>
      <h3 class="gr-card__title">Этот блок видят только участники группы</h3>
      <p>${who} Подсказку «Что вам нужно» видит только своя пара, объяснение «Почему так» — четыре пары группы. На общем табло их нет.</p>
      <button class="btn btn--secondary btn--sm" type="button" id="gr-as-player">Посмотреть как Сарсенбаев (игрок)</button>
    </article>`;
    $('gr-as-player').addEventListener('click', () => { setRole('player'); setMe('d01'); });
    return;
  }
  const P = DP[mine];
  const head = `<p class="cap cap--strong gr-card__who">${esc(P.label)} · ваша пара</p>`;
  if (st.live) {
    box.innerHTML = `<article class="panel panel--pad gr-card gr-card--hidden">
      ${head}
      <h3 class="gr-card__title">Идёт последний тур — расчёт скрыт</h3>
      <p>Пока играется последний тур, сайт не подсказывает ни одной паре, что ей нужно. Так всегда, у всех и на каждом турнире — это не настройка директора.</p>
      <p>Зачем: чтобы не было соблазна играть на нужный счёт. Кодекс поведения участника, пункт 2.11 «Неспортивное поведение».</p>
      <p class="gr-card__next">После финального счёта последнего матча здесь появится «Почему так» — объяснение мест с цифрами.</p>
    </article>`;
    return;
  }
  if (st.played >= 3) {
    const { lines } = whyLines(DP, playedMatches(st), mine);
    const text = [`${DEMO_GROUP.name}, ${DEMO_GROUP.tournament}. Почему так:`, ...lines.map((l, k) => `${k + 1}. ${l}`)].join('\n');
    box.innerHTML = `<article class="panel panel--pad gr-card gr-card--why">
      ${head}
      <h3 class="gr-card__title">Почему так</h3>
      <ol class="gr-why">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
      <div class="cluster gr-card__actions">
        <button class="btn btn--primary btn--sm" type="button" id="gr-copy">Отправить напарнику</button>
        <span class="gr-copy-msg" id="gr-copy-msg" role="status" aria-live="polite"></span>
      </div>
      <p class="gr-card__foot cap">Видят четыре пары группы. На общем табло этого блока нет.</p>
    </article>`;
    $('gr-copy').addEventListener('click', () => copyText(text));
    return;
  }
  const w = whatYouNeed(4, playedMatches(st), remainingMatches(st), mine);
  const lines = needLines(w, DP, mine);
  box.innerHTML = `<article class="panel panel--pad gr-card gr-card--need">
    ${head}
    <h3 class="gr-card__title">Что вам нужно</h3>
    <ul class="gr-need">${lines.map((l) => `<li class="gr-need__row is-${l.result}"><span class="gr-need__mark" aria-hidden="true"></span><span>${esc(l.s)}</span></li>`).join('')}</ul>
    <p class="gr-card__how">Как посчитано: сайт перебрал все ${w.total.toLocaleString('ru-RU')} законных ${plural(w.total, 'исход', 'исхода', 'исходов')} оставшихся ${remainingMatches(st).length} ${plural(remainingMatches(st).length, 'матча', 'матчей', 'матчей')} — каждый счёт от 6:0 до 7:6. Точный счёт не называем: только что важно.</p>
    <p class="gr-card__foot cap">Видит только ваша пара. В последнем туре подсказка скрывается у всех.</p>
  </article>`;
}

async function copyText(text) {
  const msg = $('gr-copy-msg');
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { /* запасной путь ниже */ }
  if (!ok) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'vh';
    document.body.append(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  msg.textContent = ok ? 'Текст скопирован — вставьте его в чат с напарником.' : 'Не удалось скопировать: выделите текст выше вручную.';
}

function renderDemo() {
  renderStates();
  renderRounds();
  renderDemoTable();
  renderSide();
}

$('gr-states').addEventListener('click', (e) => {
  const b = e.target.closest('[data-state]');
  if (!b) return;
  stateId = b.dataset.state;
  lsSet(LS_STATE, stateId);
  const u = new URL(location.href); u.searchParams.set('state', stateId); history.replaceState(null, '', u);
  renderDemo();
  $('gr-states').querySelector(`[data-state="${stateId}"]`)?.focus();
});
onIdentityChange(() => {
  renderRounds(); renderDemoTable(); renderSide();
  // сверка с фамилиями — только админу и суперадмину; раскрытую сверку оставляем раскрытой
  const wasOpen = document.querySelector('.gr-checkbox')?.open;
  renderArchive(); renderCheck();
  if (wasOpen) document.querySelector('.gr-checkbox').open = true;
});

/* ------------------------------------------------------------------ 04 · что даёт место */

function renderPoints() {
  const rows = [['Выход в 1/4 финала', 75, 25], ['Выход в 1/2 финала', 150, 35], ['Выход в финал', 250, 50], ['Победа в турнире', 450, 90]];
  $('gr-points').innerHTML = `<div class="gr-points__grid">
    <div class="tscroll"><table class="tbl gr-ptbl">
      <caption class="vh">Баллы рейтинга за стадии плей-офф в двух категориях</caption>
      <thead><tr><th scope="col">Стадия плей-офф</th><th scope="col" class="r">Grand Masters<span class="gr-th-sub">места 1–2</span></th><th scope="col" class="r">Masters<span class="gr-th-sub">места 3–4</span></th><th scope="col" class="r">Разница</th></tr></thead>
      <tbody>${rows.map(([s, a, b]) => `<tr><td>${s}</td><td class="n r"><b>${a}</b></td><td class="n r">${b}</td><td class="n r">${timesText(a / b)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="gr-points__notes">
      <p><b>Откуда цифры.</b> Решения Попечительского совета 2023 года: новости лиги и таблица рейтинга от 25.09.2023. Тогда категории назывались Masters и Futures, с 2024 года — Grand Masters и Masters.</p>
      <p><span class="tag tag--soon">Правило уточняется у лиги</span> Шкалы на 2026 год на сайте лиги нет. В регламенте 2022 года другая шкала: +100 / −100 и +50 / −50 за каждую стадию. Какая действует — спросим у лиги.</p>
      <p><b>Итоговый TS CUP</b> играется одной сеткой: пары с мест 1–2 выходят в плей-офф, с мест 3–4 турнир заканчивают (положение Итогового 2023; в архиве Итоговых 2025 и 2026 вторая сетка пустая — тоже уточняется у лиги).</p>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ 05 · архив */

const GROUPS = GROUP_ARCHIVE.groups;
const gById = (id) => GROUPS.find((g) => g.id === id);
const isFinal = (g) => /итогов/i.test(g.tournament);
function cutOf(g) {
  if (g.pairs.length !== 4) return null;
  if (isFinal(g)) return { up: 'плей-офф Итогового', down: 'места 3–4: без плей-офф' };
  if (g.season === 2023) return { up: 'Masters · тогда высшая категория', down: 'Futures · тогда вторая' };
  return { up: 'Grand Masters · высшая категория', down: 'Masters · вторая категория' };
}
const groupTitle = (g) => `${g.tournament} · ${fmtDate(g.date)} · ${g.group.replace('Группа', 'группа')}`;

function storyOf(g, P, r) {
  const b1 = reasonBetween(r, 1), b2 = reasonBetween(r, 2);
  const parts = [];
  if (b1 && b1.by === 'h2h') {
    const up = r.rows[b1.upper], lo = r.rows[b1.lower];
    parts.push(`${P[b1.upper].lastNames} выше пары ${P[b1.lower].lastNames}: у них ${pctText(up.pct)} геймов против ${pctText(lo.pct)}, но при двух равных решает личная встреча — ${scoreOf(b1.tie.h2h, b1.upper)}.`);
  }
  if (b2 && (b2.by === 'pct' || b2.by === 'pct-h2h')) {
    const up = r.rows[b2.upper], lo = r.rows[b2.lower];
    const gap = up.pct - lo.pct;
    parts.push(b2.by === 'pct'
      ? `Выход в высшую категорию решил процент: ${P[b2.upper].lastNames} — ${pctText(up.pct)} (${up.gw} из ${up.games}), ${P[b2.lower].lastNames} — ${pctText(lo.pct)} (${lo.gw} из ${lo.games}). Разрыв ${ppText(gap)} — ${gap * lo.games / 100 < 1 ? 'меньше одного гейма' : `около ${games(Math.round(gap * lo.games / 100))}`}.`
      : `У ${P[b2.upper].lastNames} и ${P[b2.lower].lastNames} процент одинаковый (${pctText(up.pct)}) — выше по личной встрече ${scoreOf(b2.sub.h2h, b2.upper)}.`);
  }
  if (b2 && b2.by === 'wins' && (!b1 || b1.by === 'wins')) parts.push('Здесь всё решили победы — правило равенства не понадобилось.');
  return parts.join(' ');
}

function archiveHTML(g) {
  const P = archivePairs(g);
  const r = rankGroup(P.length, g.matches);
  const same = g.archive && g.archive.order.join() === r.order.join();
  const mis = S.mismatches.find((m) => m.id === g.id);
  const badge = !g.archive ? '' : same
    ? `<span class="gr-ok"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>Совпало с таблицей сайта лиги</span>`
    : `<span class="gr-diff">Расходится с таблицей сайта лиги — см. «Сверка» ниже</span>`;
  const kprNote = g.season === 2026 ? 'КПР — по рейтингу лиги на 07.09.2026.' : 'КПР пар на тот турнир в архиве нет — мячи серые.';
  const story = storyOf(g, P, r);
  return `<article class="gr-agroup" aria-label="${esc(groupTitle(g))}">
    <header class="gr-agroup__head">
      <h3 class="gr-agroup__title">${esc(groupTitle(g))}</h3>
      <p class="cap">${P.length} ${plural(P.length, 'пара', 'пары', 'пар')} · раскладка побед ${winsPattern(r)} · ${kprNote}</p>
      ${badge}
    </header>
    ${story ? `<p class="gr-agroup__story">${esc(story)}</p>` : ''}
    ${mis ? `<p class="gr-agroup__mis">${isCouncil() ? misText(mis) : misShort(mis)}</p>` : ''}
    ${tableHTML(P, g.matches, { cut: cutOf(g) })}
    ${g.pairs.length !== 4 ? `<p class="gr-flag cap">В группе ${P.length} ${plural(P.length, 'пара', 'пары', 'пар')}: сколько пар из такой группы выходит в высшую категорию — уточняется у лиги, черта не проведена.</p>` : ''}
    ${matchesHTML(P, g.matches)}
  </article>`;
}

// Фамилии пар в местах, где расчёт расходится с таблицей сайта лиги, видят только админ и суперадмин (директор).
const isCouncil = () => ['admin', 'superadmin'].includes(role());
function misShort(m) {
  return `Таблица на сайте лиги расходится с регламентом на ${m.places[0]}-м и ${m.places[1]}-м месте: у двух пар процент одинаковый, а личную встречу таблица, похоже, не учла. Сетка плей-офф того турнира подтверждает регламент. Уточняется у лиги.`;
}
function misText(m) {
  const g = gById(m.id), P = archivePairs(g);
  const [a, b] = m.rule;
  const r = rankGroup(P.length, g.matches);
  const h = headToHead(g.matches, a, b);
  const where = (x) => (x === 'top' ? 'в верхней сетке' : x === 'second' ? 'во второй сетке' : 'в сетке не найдена');
  return `Таблица на сайте лиги ставит на ${m.places[0]}-е место пару ${esc(P[m.site[0]].lastNames)}, регламент — пару ${esc(P[a].lastNames)}: процент у них одинаковый (${pctText(r.rows[a].pct)}), а личную встречу выиграли ${esc(P[a].lastNames)} — ${scoreOf(h.match, a)}. `
    + `Сетка плей-офф того турнира: ${esc(P[a].lastNames)} — ${where(m.playoff[0])}, ${esc(P[b].lastNames)} — ${where(m.playoff[1])}. То есть на турнире места распределили по регламенту, расходится только таблица на сайте. Уточняется у лиги.`;
}

let archTab = 0;
const SHOW = GROUP_ARCHIVE.showcase;
const TOURS = [...new Map(GROUPS.map((g) => [g.tid, { tid: g.tid, name: g.tournament, date: g.date }])).values()]
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
let pick = { tid: TOURS[0].tid, gid: GROUPS.find((g) => g.tid === TOURS[0].tid).id };

function tabLabel(g) {
  const r = rankGroup(g.pairs.length, g.matches);
  const b = reasonBetween(r, 1)?.by === 'h2h' ? 'личная встреча' : 'процент геймов';
  return `${g.tournament.replace('ИТОГОВЫЙ TS CUP', 'Итоговый')} · ${g.group.replace('Группа ', '')}<span class="gr-tab-sub">${b}</span>`;
}

function renderArchive() {
  $('gr-arch-meta').textContent = `${S.groupsChecked} групп · 2023–2026`;
  const tabs = [...SHOW.map((id) => tabLabel(gById(id))), 'Любая группа<span class="gr-tab-sub">выбрать</span>'];
  $('gr-arch-tabs').innerHTML = tabs.map((t, k) => `<button class="tabs__tab" type="button" role="tab" id="gr-tab-${k}" aria-controls="gr-arch" aria-selected="${k === archTab}" tabindex="${k === archTab ? 0 : -1}">${t}</button>`).join('');
  $('gr-arch').setAttribute('aria-labelledby', `gr-tab-${archTab}`);
  if (archTab < SHOW.length) { $('gr-arch').innerHTML = archiveHTML(gById(SHOW[archTab])); return; }
  const tOpts = TOURS.map((t) => `<option value="${esc(t.tid)}"${String(t.tid) === String(pick.tid) ? ' selected' : ''}>${esc(t.name)} · ${fmtDate(t.date)}</option>`).join('');
  const gOpts = GROUPS.filter((g) => String(g.tid) === String(pick.tid)).map((g) => `<option value="${esc(g.id)}"${g.id === pick.gid ? ' selected' : ''}>${esc(g.group)}</option>`).join('');
  $('gr-arch').innerHTML = `<div class="gr-picker">
      <label class="field"><span class="field__label cap">Турнир</span><select class="input gr-select" id="gr-pick-t">${tOpts}</select></label>
      <label class="field"><span class="field__label cap">Группа</span><select class="input gr-select" id="gr-pick-g">${gOpts}</select></label>
    </div>${archiveHTML(gById(pick.gid))}`;
  $('gr-pick-t').addEventListener('change', (e) => {
    pick.tid = e.target.value; pick.gid = GROUPS.find((g) => String(g.tid) === String(pick.tid)).id; renderArchive(); $('gr-pick-t').focus();
  });
  $('gr-pick-g').addEventListener('change', (e) => { pick.gid = e.target.value; renderArchive(); $('gr-pick-g').focus(); });
}

function openGroup(id) {
  const g = gById(id);
  pick = { tid: g.tid, gid: g.id };
  archTab = SHOW.length;
  renderArchive();
  $('gr-arch-tabs').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  $(`gr-tab-${archTab}`).focus({ preventScroll: true });
}

$('gr-arch-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[role="tab"]');
  if (!b) return;
  archTab = Number(b.id.replace('gr-tab-', ''));
  renderArchive();
  $(`gr-tab-${archTab}`).focus();
});
$('gr-arch-tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const n = SHOW.length + 1;
  archTab = (archTab + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
  renderArchive();
  $(`gr-tab-${archTab}`).focus();
  e.preventDefault();
});

function renderCheck() {
  const council = isCouncil();
  const rows = S.mismatches.map((m) => {
    const g = gById(m.id);
    return `<li class="gr-check__row"><p><b>${esc(groupTitle(g))}.</b> ${misText(m)}</p><button class="btn btn--quiet btn--sm" type="button" data-open-group="${esc(m.id)}">Открыть группу</button></li>`;
  }).join('');
  const list = council
    ? `<ol class="gr-check__list">${rows}</ol><p class="cap">Список с фамилиями видят админ и суперадмин.</p>`
    : `<p class="cap">Какие это группы и пары, видят админ и суперадмин: сначала расхождения сверяет лига.</p>`;
  $('gr-check').innerHTML = `<details class="gr-checkbox panel">
    <summary class="gr-checkbox__sum"><span class="cap cap--strong">Сверка с архивом</span><span>Пересчёт совпал в ${S.groupsMatched} группах из ${S.groupsChecked}. В трёх — расхождение, и во всех трёх сетка плей-офф подтверждает регламент.</span></summary>
    <div class="gr-checkbox__body">
      <p>Сайт пересчитал места по регламенту во всех ${S.groupsChecked} группах архива 2023–2026 (по 3, 4 и 5 пар) и сравнил с таблицами сайта лиги. Три расхождения — один и тот же случай: у двух из трёх равных пар процент одинаковый, и регламент велит смотреть личную встречу. Таблица сайта её, похоже, не учла.</p>
      ${list}
    </div>
  </details>`;
}
// свой атрибут data-open-group: data-open ставит полоска прототипа на раскрытую плашку идеи
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open-group]');
  if (b && gById(b.dataset.openGroup)) openGroup(b.dataset.openGroup);
});

/* ------------------------------------------------------------------ 06 · где регламент молчит */

function renderOpen() {
  const zero = S.oddMatches.filter((o) => o.score === '0:0');
  const shortM = S.oddMatches.filter((o) => o.score !== '0:0');
  const g0 = GROUPS.find((g) => g.matches.filter(noWinner).length >= 3 && g.matches.some((m) => m[2] === 0 && m[3] === 0));
  const gs = gById('57-B');
  const rs = rankGroup(4, gs.matches);
  const bs = reasonBetween(rs, 2);
  const Ps = archivePairs(gs);
  $('gr-open').innerHTML = `<div class="gr-open__grid">
    <article class="panel panel--pad gr-q">
      <span class="tag tag--soon">Правило уточняется у лиги</span>
      <h3 class="gr-q__title">Матчи 0:0</h3>
      <p>Счёт 0:0 бывает при неявке и при снятии пары. Как такой матч входит в процент геймов — как 0 из 0 или иначе — и кому записывается победа, регламент не говорит.</p>
      <p class="gr-q__fact"><b>В архиве:</b> ${zero.length} ${plural(zero.length, 'матч', 'матча', 'матчей')} 0:0 в одной группе сезона 2026: причина в архиве не записана. Победитель в сетке тоже не записан, поэтому часть мест в той группе по регламенту не определяется.</p>
    </article>
    <article class="panel panel--pad gr-q">
      <span class="tag tag--soon">Правило уточняется у лиги</span>
      <h3 class="gr-q__title">Сокращённые матчи</h3>
      <p>Главный судья вправе сократить матч из-за погоды — до 4 или до 2 геймов. Тогда в одной группе процент складывается из матчей разной длины, и сравнивать его честно нельзя. Как быть — регламент не говорит.</p>
      <p class="gr-q__fact"><b>В архиве:</b> ${shortM.length} ${plural(shortM.length, 'матч', 'матча', 'матчей')} не полным сетом (${shortM.map((o) => o.score).join(', ')}). В ${esc(groupTitle(gs))} три пары с двумя победами, и выход в высшую категорию решил процент ${pctText(rs.rows[bs.upper].pct)} против ${pctText(rs.rows[bs.lower].pct)} — при этом в группе был матч 2:0.</p>
      <button class="btn btn--quiet btn--sm" type="button" data-open-group="57-B">Открыть группу</button>
    </article>
    <article class="panel panel--pad gr-q">
      <span class="tag tag--soon">Правило уточняется у лиги</span>
      <h3 class="gr-q__title">Процент равен у трёх</h3>
      <p>Регламент разбирает равный процент у двух из трёх пар (тогда личная встреча), но не у всех трёх. В архиве так не случалось ни разу, но сайт должен знать ответ заранее. Пока он пишет «правило уточняется у лиги» и оставляет решение главному судье.</p>
    </article>
  </div>`;
}

/* ------------------------------------------------------------------ старт */

renderFacts();
renderDemo();
renderPoints();
renderArchive();
renderCheck();
renderOpen();
