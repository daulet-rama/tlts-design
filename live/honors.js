// TLTS · honors.html — «Признание сезона»: номинации, которые считает сайт, и сыгранность пары.
// Моя идея, заказчик ещё не утверждал. Цифры — из ideas/honors.data.js (собран ideas/tools/build-honors.py
// из research/data), логика — ideas/honors.logic.js. Карточки, плашки, мячи — только core/card.js.
// Списки настоящих людей — в ideas/honors.people.js; этот файл не публикуется (см. ниже).

import { playerOf, pairOf, playersOfPair, pairs as allPairs } from './core/data.js';
import { playerCard, pairPlate, pairBallHTML, pairBall3dHTML, kprChipHTML } from './core/card.js';
import { mountProtoBar, mountIdeaNote } from './core/protobar.js';
import { role, setRole, onIdentityChange, ROLES, ROLE_LABELS } from './core/identity.js';
import { HONORS as HONORS_NUMBERS } from './ideas/honors.data.js';
import {
  STEPS, STEP_LABELS, pickCandidates, initialState, applyAction, sanitizeState, togetherLine, plural,
  tieKind, yearsLabel, demoGladiatorFacts, demoDuoFacts, DEMO_GLADIATOR, DEMO_DUO,
} from './ideas/honors.logic.js';

// Настоящие люди лиги (Совет, кандидаты, дуэты) лежат отдельно от чисел — в ideas/honors.people.js.
// В опубликованной версии этого файла нет: по правилу этого же экрана имена номинантов показываются
// только с их согласия. Поэтому файл ищем лишь на своём компьютере или в своей сети.
// Без него вид директора закрыт, всё остальное работает как обычно.
const HOME_HOST = /^(localhost|127(\.\d+){3}|\[::1\]|10(\.\d+){3}|192\.168(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2}|[^.]+|.+\.(local|localhost|test|lan|home))$/i;
let PEOPLE = null;
if (HOME_HOST.test(window.location.hostname)) {
  try { ({ HONORS_PEOPLE: PEOPLE } = await import('./ideas/honors.people.js')); } catch { PEOPLE = null; }
}
const HAS_PEOPLE = Boolean(PEOPLE);
const HONORS = { ...HONORS_NUMBERS, council: [], staff: [], gladiators: [], duo: [], chemistryTop: [], ...(PEOPLE || {}) };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : '[ДАТА]'; };
const fmtNum = (n) => Number(n).toLocaleString('ru-RU').replace(/\s/g, ' ');
const fmtTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const L = HONORS.league;
const S = HONORS.season;
const N_TOURS = S.tournaments.length;

/* ------------------------------------------------------------------ полоска и плашка «Моя идея» */

mountProtoBar({ current: 'honors' });

const LEAGUE_QUESTIONS = [
  'Кто тот независимый человек, который решает по основателю лиги и членам Попечительского совета?',
  `Считать ли в номинациях сезона спецтурниры (Visa Open) и Итоговый? Сейчас посчитаны все ${N_TOURS} турниров 2026 года.`,
  '«Гладиаторы корта» — награда одному игроку или паре?',
  'При равенстве у кандидатов кто выше? Сейчас сайт ставит выше по второму числу, а при равенстве по обоим числам выбирает директор.',
  'Нужна ли третья номинация и из каких данных её считать?',
  'Кто и когда сверяет имена архива с членами лиги перед первым подсчётом?',
];

mountIdeaNote(null, {
  ideas: [
    { title: 'Номинации, которые считает сайт', score: 6.7, approvals: 3 },
    { title: 'Сыгранность пары', score: 6.0, approvals: 3 },
  ],
  why: 'Признание получают не только чемпионы: лига уже гордится «Гладиаторами корта» и рекордами тай-брейков, а долгие дуэты — часть «одной большой семьи».',
  changed: [
    'Из пяти номинаций первой версии оставлены две: «Гладиаторы корта» и «Дуэт сезона».',
    'Кандидатов подтверждает директор. Основателя и членов Совета сайт сам не предлагает: по ним решает независимый человек.',
    'Публикация — только после согласия номинанта. В общем виде — только выдуманные игроки.',
    'Цифр об игроках, которые перестали приходить, на экране нет нигде.',
    'Сыгранность — только факт «вместе N-й турнир», от пяти матчей вместе. Без оценок пары и сравнения с соперниками.',
    'Встречи человека с человеком видит только сам игрок — на общих экранах их нет.',
    'Считаются только игроки, определённые однозначно; однофамильцы помечены для сверки.',
    'Настоящие имена — только в виде директора. Гость и игрок видят цифры лиги и пример на выдуманных парах.',
    ...(HAS_PEOPLE ? [] : ['В опубликованной версии прототипа вид директора закрыт: списки настоящих игроков в неё не включены.']),
  ],
  league: LEAGUE_QUESTIONS,
});

/* ------------------------------------------------------------------ 01 · общий вид (демо) */

function renderPublic() {
  const host = $('hn-awards');
  host.textContent = '';
  const chain = (done) => `<ol class="hn-chain" aria-label="Путь награды">${STEPS.map((s, i) => `<li class="hn-chain__s${i < done ? ' is-done' : ''}">${esc(STEP_LABELS[s])}</li>`).join('')}</ol>`;

  // Гладиатор корта — один игрок
  const g = playerOf(DEMO_GLADIATOR.id);
  const gf = demoGladiatorFacts(g);
  const a = document.createElement('article');
  a.className = 'hn-award';
  a.innerHTML = `
    <div class="hn-award__head">
      <p class="cap">Номинация · демо-сезон</p>
      <h3 class="hn-award__title">Гладиатор корта</h3>
      <p class="hn-award__why">За тай-брейки: матчи, которые при 6:6 решались тай-брейком до семи очков.</p>
    </div>
    <div class="hn-award__body">
      <div class="hn-award__card" data-slot="card"></div>
      <div class="hn-award__facts">
        <div class="stats hn-award__stats">
          <div class="stat"><span class="stat__n">${gf.tiebreaks}</span><span class="cap">${plural(gf.tiebreaks, 'тай-брейк', 'тай-брейка', 'тай-брейков')} за сезон</span></div>
          <div class="stat"><span class="stat__n">${gf.won}</span><span class="cap">из них выиграно</span></div>
          <div class="stat"><span class="stat__n">${gf.matches}</span><span class="cap">${plural(gf.matches, 'матч', 'матча', 'матчей')} сезона</span></div>
        </div>
        <p class="hn-award__line"><span class="cap">Строка в профиле</span><span>Гладиатор корта демо-сезона: ${gf.tiebreaks} ${plural(gf.tiebreaks, 'тай-брейк', 'тай-брейка', 'тай-брейков')}, выиграно ${gf.won}</span></p>
        ${chain(4)}
        <p class="hn-award__who">Предложил сайт по счёту матчей · подтвердил директор лиги · номинант согласился на публикацию.</p>
      </div>
    </div>`;
  a.querySelector('[data-slot="card"]').append(playerCard(g, { size: 'xl', rank: 'kpr', toward: 'right' }));
  host.append(a);

  // Дуэт сезона — пара
  const ps = playersOfPair(DEMO_DUO.pair);
  const df = demoDuoFacts(ps[0], ps[1]);
  const b = document.createElement('article');
  b.className = 'hn-award';
  b.innerHTML = `
    <div class="hn-award__head">
      <p class="cap">Номинация · демо-сезон</p>
      <h3 class="hn-award__title">Дуэт сезона</h3>
      <p class="hn-award__why">Пара, которая сыграла вместе больше всех турниров сезона.</p>
    </div>
    <div class="hn-award__body hn-award__body--pair">
      <div class="hn-award__duo">
        <div class="hn-award__ball">${pairBall3dHTML(ps[0].kpr, ps[1].kpr, { size: 132, decorative: true })}</div>
        <div class="hn-award__mates" data-slot="mates"></div>
      </div>
      <div class="hn-award__facts">
        <div class="stats hn-award__stats">
          <div class="stat"><span class="stat__n">${df.seasonTournaments}</span><span class="cap">${plural(df.seasonTournaments, 'турнир', 'турнира', 'турниров')} вместе за сезон</span></div>
          <div class="stat"><span class="stat__n">${df.matchesTogether}</span><span class="cap">${plural(df.matchesTogether, 'матч', 'матча', 'матчей')} вместе с ${df.since}</span></div>
        </div>
        <p class="hn-award__line"><span class="cap">Строка в профиле обоих</span><span>Дуэт демо-сезона: ${df.seasonTournaments} ${plural(df.seasonTournaments, 'турнир', 'турнира', 'турниров')} вместе</span></p>
        ${chain(4)}
        <p class="hn-award__who">Согласие дали оба. Если один против — пару не публикуют.</p>
      </div>
    </div>`;
  const mates = b.querySelector('[data-slot="mates"]');
  ps.forEach((p, i) => mates.append(playerCard(p, { size: 'md', rank: 'kpr', toward: i ? 'left' : 'right' })));
  host.append(b);
}

/* ------------------------------------------------------------------ 02 · как это считается */

function bars(dist, { unit, label }) {
  const rows = Object.entries(dist).map(([k, v]) => [Number(k), v]).sort((x, y) => x[0] - y[0]);
  const max = Math.max(...rows.map((r) => r[1]));
  return `<figure class="hn-bars">
    <figcaption class="cap cap--strong">${esc(label)}</figcaption>
    <ul class="hn-bars__list" role="list">${rows.map(([k, v]) => `
      <li class="hn-bars__row"><span class="hn-bars__k num">${k}</span><span class="hn-bars__track" aria-hidden="true"><span class="hn-bars__bar" style="--w:${(v / max).toFixed(3)}"></span></span><span class="hn-bars__v num">${v}</span><span class="vh">: ${k} ${esc(unit(k))} — ${v}</span></li>`).join('')}
    </ul>
  </figure>`;
}

function renderHow() {
  $('hn-how-meta').textContent = `${L.tournaments} турниров · ${L.seasons[0]}–${L.seasons[1]}`;
  const tbMax = Math.max(...Object.keys(S.tiebreakDistribution).map(Number));
  const tbMaxN = S.tiebreakDistribution[String(tbMax)];
  const duoMax = Math.max(...Object.keys(S.duoDistribution).map(Number));
  const duoMaxN = S.duoDistribution[String(duoMax)];
  const unsure = S.unsureNames || [];
  const tbPerTour = S.tournaments.map((t) => `<li><span>${esc(t.name)}</span><span class="cap">${fmtDate(t.date)}</span><b class="num">${t.tiebreaks}</b></li>`).join('');

  $('hn-how-body').innerHTML = `
    <div class="hn-how__grid">
      <article class="hn-how__col panel panel--pad">
        <h3 class="hn-h3">Гладиаторы корта</h3>
        <p class="hn-rule"><b>Правило лиги.</b> Матч — один сет до шести геймов. При 6:6 играют тай-брейк до семи очков с разницей в два — счёт матча 7:6. Номинация — за такие матчи: кто чаще всех доводил борьбу до тай-брейка.</p>
        <div class="stats hn-how__stats">
          <div class="stat"><span class="stat__n">${L.groupTiebreaks}</span><span class="cap">из ${fmtNum(L.groupMatchesAll)} групповых матчей ${L.seasons[0]}–${L.seasons[1]} закончились 7:6</span></div>
          <div class="stat"><span class="stat__n">${S.tiebreaks}</span><span class="cap">${plural(S.tiebreaks, 'тай-брейк', 'тай-брейка', 'тай-брейков')} в ${S.matches} ${plural(S.matches, 'матче', 'матчах', 'матчах')} сезона ${S.year}</span></div>
          <div class="stat"><span class="stat__n">${S.playersWithTiebreak}</span><span class="cap">из ${S.players} ${plural(S.players, 'игрока', 'игроков', 'игроков')} сезона сыграли хотя бы один</span></div>
        </div>
        <p class="hn-note">Примерно каждый двенадцатый групповой матч лиги решается тай-брейком. Лига сама гордится этим: «рекордное количество тай-брейков» — заголовок её новости о TS CUP 2 сезона 2024.</p>
        ${bars(S.tiebreakDistribution, { label: `Игроков сезона ${S.year} по числу тай-брейков`, unit: (k) => plural(k, 'тай-брейк', 'тай-брейка', 'тай-брейков') })}
        <p class="hn-note">Больше всех — ${tbMax} ${plural(tbMax, 'тай-брейк', 'тай-брейка', 'тай-брейков')} за сезон: так у ${tbMaxN} ${plural(tbMaxN, 'игрока', 'игроков', 'игроков')}. ${HAS_PEOPLE ? 'Кто именно — видит только директор в разделе 03.' : 'Кто именно — в опубликованной версии прототипа не показано.'}</p>
        <details class="hn-more"><summary>Тай-брейки по турнирам ${S.year}</summary><ul class="hn-tours" role="list">${tbPerTour}</ul></details>
      </article>

      <article class="hn-how__col panel panel--pad">
        <h3 class="hn-h3">Дуэт сезона</h3>
        <p class="hn-rule"><b>Правило лиги.</b> Играют парами, и пару каждый собирает сам: сумма КПР двоих должна попасть в коридор сезона (в ${S.year} — от 7.5 до 8.0). Поэтому составы часто меняются, и пара, которая держится весь сезон, — редкость.</p>
        <div class="stats hn-how__stats">
          <div class="stat"><span class="stat__n">${S.pairs}</span><span class="cap">${plural(S.pairs, 'разная пара', 'разные пары', 'разных пар')} в сезоне ${S.year}</span></div>
          <div class="stat"><span class="stat__n">${duoMax}</span><span class="cap">турниров вместе — больше всех в сезоне</span></div>
          <div class="stat"><span class="stat__n">${duoMaxN}</span><span class="cap">${plural(duoMaxN, 'пара сыграла', 'пары сыграли', 'пар сыграли')} столько</span></div>
        </div>
        ${bars(S.duoDistribution, { label: `Пар сезона ${S.year} по числу турниров вместе`, unit: (k) => plural(k, 'турнир', 'турнира', 'турниров') })}
        <p class="hn-note">Турнир засчитан паре, если она стоит в группе этого турнира. За все годы рекорд — ${L.recordTournaments} турниров вместе (раздел 04).</p>
      </article>
    </div>

    <div class="hn-how__grid hn-how__grid--rules">
      <article class="hn-how__col">
        <h3 class="hn-h3">Что считается</h3>
        <ul class="hn-list" role="list">
          <li>Все ${N_TOURS} турниров ${S.year} года: этапы TS CUP 1–7, Visa Open и Итоговый. <span class="hn-ask">Брать ли спецтурниры и Итоговый — правило уточняется у лиги.</span></li>
          <li>Группы и плей-офф обеих категорий: Grand Masters — высшая категория, Masters — вторая.</li>
          <li>Неявки и несыгранные матчи (в архиве записаны как 0:0) не считаются: в сезоне ${S.year} таких ${S.notPlayed}.</li>
          <li>Тай-брейк засчитывается всем четверым на корте — и выигравшим, и проигравшим. Выигранные — второе число: оно решает только при равенстве.</li>
          <li>При равенстве сайт ставит обоих рядом и пишет «делят место». Кого взять — решает директор. <span class="hn-ask">Правило уточняется у лиги.</span></li>
        </ul>
      </article>
      <article class="hn-how__col">
        <h3 class="hn-h3">Кого сайт сам не предлагает</h3>
        <ul class="hn-list" role="list">
          <li><b>Основателя лиги и членов Попечительского совета</b> (${HONORS.councilCount} ${plural(HONORS.councilCount, 'человек', 'человека', 'человек')} по сайту лиги) — при любом счёте. По ним решает независимый человек: сайт только передаёт ему цифры. <span class="hn-ask">Кто это — уточняется у лиги.</span></li>
          <li><b>Неопознанных.</b> В ${S.year} году имена записаны ${fmtNum(S.nameMentions)} раз, из них ${S.nameAbbrev} — сокращённо («Фамилия И.»). Однозначно не определён ${unsure.length} ${plural(unsure.length, 'игрок', 'игрока', 'игроков')}: записан только фамилией (${unsure.map((u) => u.mentions).join(', ')} ${plural(unsure[0]?.mentions || 0, 'упоминание', 'упоминания', 'упоминаний')}). Такие — «требует сверки», в тройку не попадают.</li>
          <li><b>Однофамильцев</b> сайт предлагает, но помечает: до публикации директор сверяет, тот ли это человек.</li>
        </ul>
      </article>
    </div>

    <details class="hn-more hn-check"><summary>Сверка цифр</summary>
      <table class="tbl hn-check__tbl"><thead><tr><th>Что</th><th class="r">Было посчитано</th><th class="r">Пересчёт</th></tr></thead><tbody>
        <tr><td>Групповых матчей 7:6</td><td class="r n">126 из 1492</td><td class="r n">${L.groupTiebreaks} из ${L.groupMatchesAll}</td></tr>
        <tr><td>Разных пар за все годы</td><td class="r n">542</td><td class="r n">${L.pairs}</td></tr>
        <tr><td>Пар, сыгравших вместе 5 турниров и больше</td><td class="r n">32</td><td class="r n">${L.pairs5plus}</td></tr>
        <tr><td>Рекорд турниров вместе</td><td class="r n">28</td><td class="r n">${L.recordTournaments}</td></tr>
        <tr><td>Пар с одним турниром вместе</td><td class="r n">368</td><td class="r n">${L.pairsOnce}</td></tr>
      </tbody></table>
      <p class="hn-note">Расхождение в одну пару: в TS CUP 2 2023 одна пара записана сразу в двух группах (E и G). По записям пар с одним турниром вместе — 368, по турнирам — 369. Из ${L.groupMatchesAll} групповых матчей ${L.groupNotPlayed} не сыграны (0:0 и 3:3).</p>
    </details>`;
}

/* ------------------------------------------------------------------ 03 · очередь директора */

const LS_KEY = 'tlts-honors-v1';
const lsGet = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { window.localStorage.setItem(k, v); return true; } catch { return false; } };
const lsDel = (k) => { try { window.localStorage.removeItem(k); } catch { /* нет хранилища */ } };

const founderNames = new Set(HONORS.council.filter((c) => c.founder).map((c) => c.archiveName || c.name));

const NOMS = [
  {
    key: 'gladiators',
    title: 'Гладиаторы корта',
    rule: `Больше всех тай-брейков (7:6) за сезон ${S.year}. При равенстве выше тот, кто больше их выиграл.`,
    list: HONORS.gladiators,
    id: (g) => g.name,
    name: (g) => g.name,
    keyOf: (g) => [g.tiebreaks, g.won],
    people: (g) => [g],
  },
  {
    key: 'duo',
    title: 'Дуэт сезона',
    rule: `Больше всех турниров вместе за сезон ${S.year}. При равенстве выше пара, которая дольше играет вместе за все годы.`,
    list: HONORS.duo,
    id: (d) => d.players.map((p) => p.name).join(' + '),
    name: (d) => d.players.map((p) => p.name).join(' и '),
    keyOf: (d) => [d.tournaments, d.allTime],
    people: (d) => d.players.map((p) => ({ ...p, founder: p.founder || founderNames.has(p.name) })),
  },
];
for (const n of NOMS) {
  n.pick = pickCandidates(n.list, { n: 3, key: n.keyOf, people: n.people });
  n.byId = new Map(n.list.map((x) => [n.id(x), x]));
  n.reserveIds = n.pick.reserve.map(n.id);
}
const FRESH = initialState(Object.fromEntries(NOMS.map((n) => [n.key, n.pick.candidates.map(n.id)])));

let state = (() => {
  let raw = null;
  try { raw = JSON.parse(lsGet(LS_KEY) || 'null'); } catch { raw = null; }
  return sanitizeState(raw, FRESH);
})();
let flash = '';

const isDirector = () => role() === 'admin' || role() === 'superadmin';
// настоящие списки видит директор — и только там, где они есть (в опубликованной версии их нет)
const canSee = () => HAS_PEOPLE && isDirector();
const whoAmI = () => `Директор (роль «${ROLE_LABELS[role()] || role()}»)`;

function act(nom, type, id, extra = {}) {
  const n = NOMS.find((x) => x.key === nom);
  const item = n.byId.get(id);
  const r = applyAction(state, {
    type, nom, id, who: whoAmI(), title: n.title,
    name: item ? n.name(item) : id, reserve: n.reserveIds, ...extra,
  });
  let focusId = id;
  if (r.accepted) {
    if (type === 'replace') {
      const next = r.state.noms[nom].slots.find((x) => !state.noms[nom].slots.includes(x));
      focusId = next;
      const nx = n.byId.get(next);
      // имя нового кандидата — в последнюю запись журнала
      const last = r.state.journal[r.state.journal.length - 1];
      last.what = `Заменил кандидата: ${item ? n.name(item) : id} → ${nx ? n.name(nx) : next}.`;
    }
    state = r.state;
    lsSet(LS_KEY, JSON.stringify(state));
    flash = r.state.journal[r.state.journal.length - 1].what;
  } else {
    flash = {
      'no-reserve': 'Запасных кандидатов больше нет: выберите из этой тройки или напишите в Совет.',
      'after-consent': 'Номинант уже согласился — заменять поздно. Сначала верните шаг назад.',
      'no-consent': 'Без согласия номинанта публиковать нельзя.',
    }[r.reason] || 'Это действие сейчас недоступно.';
  }
  renderQueue();
  // фокус остаётся у того же кандидата (после замены — у нового), иначе на строке статуса
  const btn = document.querySelector(`[data-nom="${nom}"][data-focus="${CSS.escape(focusId)}"]`);
  if (btn) btn.focus({ preventScroll: true });
}

function renderRole() {
  const host = $('hn-role');
  const r = role();
  host.innerHTML = `
    <div class="hn-role__row">
      <p class="cap cap--strong" id="hn-role-l">Смотреть как</p>
      <div class="seg hn-seg" role="group" aria-labelledby="hn-role-l">
        ${ROLES.map((x) => `<button class="seg__btn" type="button" data-role="${x}" aria-pressed="${x === r}">${esc(ROLE_LABELS[x])}</button>`).join('')}
      </div>
    </div>
    <p class="hn-role__hint">${canSee()
      ? 'Вы смотрите как директор. Черновик видит только он: игроки и гости видят лишь опубликованное.'
      : !HAS_PEOPLE && isDirector()
        ? 'Вы смотрите как директор. В опубликованной версии прототипа черновик закрыт: в нём настоящие игроки лиги.'
        : `Сейчас вы — «${esc(ROLE_LABELS[r] || r)}». Очередь номинаций видят только админ и суперадмин: это черновик директора.`}</p>`;
  host.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => { setRole(b.dataset.role); }));
}

function stepsHTML(step) {
  const idx = STEPS.indexOf(step);
  return `<ol class="hn-steps" aria-label="Путь номинации">${STEPS.map((s, i) => {
    const cls = step === 'declined' && i === 2 ? ' is-no' : i < idx || (step === 'declined' && i < 2) ? ' is-done' : i === idx ? ' is-now' : '';
    const label = step === 'declined' && i === 2 ? STEP_LABELS.declined : STEP_LABELS[s];
    return `<li class="hn-steps__s${cls}"${i === idx ? ' aria-current="step"' : ''}><span class="hn-steps__n num">${i + 1}</span><span>${esc(label)}</span></li>`;
  }).join('')}</ol>`;
}

// однофамилец-напарник (братья в одной паре) путаницы не даёт: сверять нужно только с теми, кого рядом нет
const otherNamesakes = (p, mates = []) => (p.namesakes || []).filter((n) => !mates.some((m) => m.name === n));

function personLineHTML(p, mates = []) {
  const warn = [];
  const ns = otherNamesakes(p, mates);
  if (ns.length) warn.push(`в лиге есть однофамилец: ${ns.map(esc).join(', ')} — сверить`);
  if (p.spellings?.length > 1) warn.push(`в архиве пишется по-разному: ${p.spellings.map(esc).join(' · ')}`);
  return { warn };
}

function evidenceGladHTML(g) {
  return `<ul class="hn-ev" role="list">${g.evidence.map((e) => `
    <li class="hn-ev__row">
      <span class="hn-ev__score num${e.won ? ' is-won' : ''}">${esc(e.score)}</span>
      <span class="hn-ev__what"><b>${esc(e.tournament)}</b> · ${fmtDate(e.date)} · ${esc(e.stage)}<br>
      <span class="muted">напарник: ${esc(e.partner || 'нет данных')} · соперники: ${esc(e.opponents)} · ${e.won ? 'выиграли' : 'проиграли'}</span></span>
    </li>`).join('')}</ul>`;
}

function evidenceDuoHTML(d) {
  return `<ul class="hn-ev" role="list">${d.list.map((t, i) => `
    <li class="hn-ev__row"><span class="hn-ev__score num">${i + 1}</span><span class="hn-ev__what"><b>${esc(t.name)}</b> · ${fmtDate(t.date)}</span></li>`).join('')}
    <li class="hn-ev__row hn-ev__row--sum"><span class="hn-ev__score num">∑</span><span class="hn-ev__what">За все годы вместе: ${d.allTime} ${plural(d.allTime, 'турнир', 'турнира', 'турниров')}, ${yearsLabel(d.allYears)}</span></li>
  </ul>`;
}

function candidateHTML(n, id, place, total) {
  const item = n.byId.get(id);
  const step = state.noms[n.key].steps[id];
  const isGlad = n.key === 'gladiators';
  const people = isGlad ? [item] : item.players;
  const warns = people.flatMap((p) => personLineHTML(p, people).warn);
  const ball = isGlad ? pairBallHTML(item.kpr, null, { size: 40, decorative: true }) : pairBallHTML(item.players[0].kpr, item.players[1].kpr, { size: 40, order: 'level', decorative: true });
  const kpr = isGlad ? (item.kpr ? kprChipHTML(item.kpr) : '') : '';
  const big = isGlad ? item.tiebreaks : item.tournaments;
  const bigCap = isGlad ? plural(item.tiebreaks, 'тай-брейк', 'тай-брейка', 'тай-брейков') : `${plural(item.tournaments, 'турнир', 'турнира', 'турниров')} вместе`;
  const small = isGlad ? `выиграно ${item.won} · всего матчей в сезоне ${item.matches}` : `из ${N_TOURS} турниров сезона · за все годы ${item.allTime}`;
  const tied = n.list.filter((x) => n.keyOf(x)[0] === n.keyOf(item)[0] && n.keyOf(x)[1] === n.keyOf(item)[1]).length > 1;
  const done = step === 'published';
  const q = (t, label, cls = 'btn--secondary', extra = '') => `<button class="btn ${cls} btn--sm" type="button" data-nom="${n.key}" data-act="${t}" data-id="${esc(id)}" data-focus="${esc(id)}"${extra}>${esc(label)}</button>`;
  const buttons = [];
  if (step === 'proposed') buttons.push(q('confirm', 'Подтвердить', 'btn--primary'));
  if (step === 'confirmed') buttons.push(q('consent', 'Номинант согласен', 'btn--primary'), q('decline', 'Номинант против'));
  if (step === 'agreed') buttons.push(q('publish', 'Опубликовать', 'btn--primary'));
  if (step === 'proposed' || step === 'confirmed' || step === 'declined') buttons.push(q('replace', 'Заменить кандидата'));
  if (step === 'confirmed' || step === 'agreed' || step === 'declined') buttons.push(q('back', 'Шаг назад', 'btn--quiet'));
  const consentNote = step === 'confirmed' ? '<p class="hn-cand__note">Номинанту ушёл запрос согласия (макет). В платформе он сам нажмёт «Согласен» или «Не надо» у себя в профиле.</p>' : '';
  const declinedNote = step === 'declined' ? '<p class="hn-cand__note">Номинант отказался. Его не публикуют; номинацию можно отдать следующему по счёту.</p>' : '';
  const pubNote = done ? '<p class="hn-cand__note">Опубликовано: строка появится в разделе «Признание», в профиле и на карточке ведущему гала-ужина. В прототипе общий вид показывает только выдуманных игроков.</p>' : '';

  return `<li class="hn-cand${done ? ' is-pub' : ''}${step === 'declined' ? ' is-declined' : ''}">
    <div class="hn-cand__top">
      <span class="hn-cand__place num" aria-label="Место ${place}">${place}</span>
      <span class="hn-cand__ball">${ball}</span>
      <span class="hn-cand__who">
        <b class="hn-cand__name">${esc(n.name(item))}</b>
        <span class="hn-cand__meta">${kpr}${tied ? '<span class="hn-cand__tie">делит место по счёту</span>' : ''}</span>
      </span>
      <span class="hn-cand__big"><b class="num">${big}</b><span class="cap">${esc(bigCap)}</span></span>
    </div>
    <p class="hn-cand__small">${esc(small)}</p>
    ${warns.length ? `<p class="hn-cand__warn"><b>Требует сверки:</b> ${warns.join('; ')}</p>` : ''}
    <details class="hn-more"><summary>${isGlad ? `Доказательства: ${item.tiebreaks} ${plural(item.tiebreaks, 'матч', 'матча', 'матчей')} 7:6` : `Доказательства: ${item.tournaments} ${plural(item.tournaments, 'турнир', 'турнира', 'турниров')} сезона`}</summary>${isGlad ? evidenceGladHTML(item) : evidenceDuoHTML(item)}</details>
    ${stepsHTML(step)}
    ${consentNote}${declinedNote}${pubNote}
    <div class="cluster hn-cand__acts">${buttons.join('')}</div>
  </li>`;
}

function excludedHTML(n) {
  const nom = state.noms[n.key];
  const rows = n.pick.excluded.filter((e) => e.reason === 'council' || e.reason === 'founder');
  const unsure = n.pick.excluded.filter((e) => e.reason === 'unsure');
  const founderRow = `<li class="hn-ex__row"><span class="hn-ex__tag cap">Основатель лиги</span><span>В автоподбор не входит никогда. Его цифры сайт передаёт независимому человеку и сам не сравнивает.</span></li>`;
  const councilRows = rows.filter((e) => e.reason === 'council').map((e) => {
    const id = n.id(e.item);
    const it = e.item;
    const metric = n.key === 'gladiators' ? `${it.tiebreaks} ${plural(it.tiebreaks, 'тай-брейк', 'тай-брейка', 'тай-брейков')}, выиграно ${it.won}` : `${it.tournaments} ${plural(it.tournaments, 'турнир', 'турнира', 'турниров')} вместе`;
    const sent = nom.handover.includes(id);
    return `<li class="hn-ex__row">
      <span class="hn-ex__tag cap">Член Совета</span>
      <span>${n.key === 'duo'
        ? `${esc(n.name(it))} — по счёту пара вошла бы в тройку (${esc(metric)}). В паре член Совета (${esc(it.players.filter((p) => p.council).map((p) => p.name).join(', '))}), награда общая на двоих — сайт пару сам не предлагает.`
        : `${esc(n.name(it))} — по счёту вошёл бы в тройку (${esc(metric)}). Сайт его сам не предлагает.`} <b>По членам Совета решает независимый человек.</b></span>
      ${sent ? '<span class="hn-ex__done cap">Цифры переданы · в журнале</span>'
        : `<button class="btn btn--secondary btn--sm" type="button" data-nom="${n.key}" data-act="handover" data-id="${esc(id)}" data-focus="${esc(id)}">Передать цифры независимому</button>`}
    </li>`;
  }).join('');
  const unsureRows = unsure.map((e) => `<li class="hn-ex__row"><span class="hn-ex__tag cap">Требует сверки</span><span>${esc(n.name(e.item))} — определён неоднозначно, в тройку не ставится до сверки.</span></li>`).join('');
  return `<div class="hn-ex">
    <p class="cap cap--strong">Не в автоподборе</p>
    <ul class="hn-ex__list" role="list">${founderRow}${councilRows}${unsureRows}</ul>
  </div>`;
}

function renderQueue() {
  renderRole();
  const host = $('hn-queue-body');
  if (!canSee()) {
    host.innerHTML = HAS_PEOPLE
      ? `<div class="hn-locked panel panel--pad">
      <p class="hn-locked__t">Черновик номинаций закрыт</p>
      <p>Его видят только админ и суперадмин лиги. Игрокам и гостям сайт показывает лишь опубликованное — как в разделе 01.</p>
      <button class="btn btn--primary" type="button" data-role-go="admin">Посмотреть как админ</button>
    </div>`
      : `<div class="hn-locked panel panel--pad">
      <p class="hn-locked__t">В опубликованной версии черновик закрыт</p>
      <p>В черновике директора — настоящие игроки лиги: кандидаты, их матчи и пометки для сверки. Имена номинантов сайт показывает только с их согласия, поэтому в опубликованный прототип этот список не включён.</p>
      <p>Как выглядит опубликованная номинация, видно в разделе 01 на выдуманных игроках. Черновик с настоящим архивом работает в локальной версии прототипа.</p>
    </div>`;
    host.querySelector('[data-role-go]')?.addEventListener('click', () => setRole('admin'));
    return;
  }
  const journal = [...state.journal].reverse();
  host.innerHTML = `
    <p class="hn-draft"><span class="tag tag--idea">Моя идея</span><b>Черновик. Видит только директор. Публикуется после согласия номинанта.</b></p>
    <p class="hn-note">Административный и спортивный директор лиги в сетках ${L.seasons[0]}–${L.seasons[1]} не играли: подтверждать номинации им не мешает свой интерес.</p>
    <p class="hn-flash" role="status" aria-live="polite">${esc(flash)}</p>
    <div class="hn-noms">
      ${NOMS.map((n) => {
        const slots = state.noms[n.key].slots;
        const order = slots.map((id) => ({ id, item: n.byId.get(id) })).filter((x) => x.item);
        const rk = (x) => 1 + n.list.filter((o) => {
          const a = n.keyOf(o), b = n.keyOf(x.item);
          return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
        }).length;
        const left = n.reserveIds.filter((r) => !state.noms[n.key].used.includes(r)).length;
        const lastC = n.pick.candidates[n.pick.candidates.length - 1];
        const nextC = n.pick.reserve[0];
        const tk = n.pick.tieAtCut ? tieKind(lastC, nextC, n.keyOf) : null;
        const tie = tk ? `<p class="hn-tie"><b>Равенство на границе тройки.</b> ${tk === 'full'
          ? `Последний в тройке (${esc(n.name(lastC))}) и следующий по счёту (${esc(n.name(nextC))}) делят место: по обоим числам поровну (${n.keyOf(nextC)[0]} и ${n.keyOf(nextC)[1]}) — выбирает директор. Поменять их местами можно кнопкой «Заменить кандидата».`
          : `У следующего по счёту (${esc(n.name(nextC))}) столько же — ${n.keyOf(nextC)[0]}. Сайт поставил выше по второму числу; кого брать, решает директор.`}</p>` : '';
        return `<article class="hn-nom" aria-labelledby="hn-nom-${n.key}">
          <header class="hn-nom__head">
            <h3 class="hn-h3" id="hn-nom-${n.key}">${esc(n.title)}</h3>
            <p class="hn-nom__rule">${esc(n.rule)}</p>
            <p class="hn-nom__place">Цифра слева — место по счёту среди всех ${n.key === 'duo' ? 'пар' : 'игроков'} сезона, включая тех, кого сайт сам не предлагает.</p>
          </header>
          ${tie}
          <ol class="hn-cands" role="list">${order.map((x) => candidateHTML(n, x.id, rk(x))).join('')}</ol>
          <p class="hn-nom__reserve cap">Запасных по счёту: ${left}</p>
          ${excludedHTML(n)}
        </article>`;
      }).join('')}
    </div>
    <div class="hn-journal">
      <div class="hn-journal__head">
        <h3 class="hn-h3">Журнал решений</h3>
        <button class="btn btn--quiet btn--sm" type="button" id="hn-reset">Сбросить черновик</button>
      </div>
      <p class="hn-note">Кто, когда и что решил. Журнал открыт Совету: так видно, что номинации подтверждали люди, а не «система».</p>
      ${journal.length ? `<ol class="hn-log" role="list">${journal.map((j) => `<li class="hn-log__row"><span class="hn-log__t cap num">${esc(fmtTime(j.at))}</span><span class="hn-log__w"><b>${esc(j.nomination)}</b> · ${esc(j.what)}<br><span class="muted">${esc(j.who)}</span></span></li>`).join('')}</ol>`
        : '<p class="hn-log__empty">Пока пусто: сайт предложил кандидатов, решений ещё не было.</p>'}
    </div>`;

  host.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.nom, b.dataset.act, b.dataset.id)));
  $('hn-reset').addEventListener('click', () => {
    state = JSON.parse(JSON.stringify(FRESH));
    lsDel(LS_KEY);
    flash = 'Черновик сброшен: снова три кандидата от сайта, журнал пуст.';
    renderQueue();
    $('hn-reset').focus({ preventScroll: true });
  });
}

/* ------------------------------------------------------------------ 04 · сыгранность */

function renderChem() {
  $('hn-chem-meta').textContent = `${L.pairs} ${plural(L.pairs, 'пара', 'пары', 'пар')} · ${L.seasons[0]}–${L.seasons[1]}`;
  const director = canSee();
  let list;
  if (director) {
    // настоящий список — только в виде директора, с пометками для сверки
    const top = HONORS.chemistryTop.slice(0, 8);
    list = `<p class="hn-draft hn-chem__draft"><span class="tag tag--idea">Вид директора</span><b>Настоящие пары архива. В общий вид — только после согласия обоих и сверки имён.</b></p>
      <ol class="hn-duos" role="list">${top.map((c, i) => {
        const a = c.players[0], b = c.players[1];
        const unsure = c.unsure || c.players.some((p) => otherNamesakes(p, c.players).length);
        return `<li class="hn-duo">
          <span class="hn-duo__n num">${String(i + 1).padStart(2, '0')}</span>
          <span class="hn-duo__ball">${pairBallHTML(a.kpr, b.kpr, { size: 44, order: 'level', decorative: true })}</span>
          <span class="hn-duo__names"><b>${esc(a.name)}</b><b>${esc(b.name)}</b>${unsure ? '<span class="hn-duo__chk cap">однофамилец в лиге — сверить</span>' : ''}</span>
          <span class="hn-duo__big"><b class="num">${c.tournaments}</b><span class="cap">${plural(c.tournaments, 'турнир', 'турнира', 'турниров')} вместе</span><span class="hn-duo__yrs num">${yearsLabel(c.years)}</span></span>
        </li>`;
      }).join('')}</ol>
      <p class="hn-note muted">Пары считаются по группам турниров. Имена с инициалом склеены автоматически; ${L.pairsUnsure} ${plural(L.pairsUnsure, 'пара', 'пары', 'пар')} за все годы требуют сверки и в этот список не попали бы без неё.</p>`;
  } else {
    // гость и игрок: пример на выдуманных парах, как в разделе 01
    const demo = allPairs.filter((p) => p.demo).map((p) => {
      const ps = playersOfPair(p.id);
      return { ps, f: demoDuoFacts(ps[0], ps[1]) };
    }).filter((x) => x.f.ok).sort((x, y) => y.f.matchesTogether - x.f.matchesTogether).slice(0, 4);
    list = `<p class="hn-chem__demo"><span class="tag tag--demo">Демо-данные</span><span>Пример на выдуманных парах: так список будет выглядеть после запуска.</span></p>
      <ul class="hn-duos" role="list">${demo.map(({ ps, f }) => `<li class="hn-duo hn-duo--demo">
          <span class="hn-duo__ball">${pairBallHTML(ps[0].kpr, ps[1].kpr, { size: 44, order: 'level', decorative: true })}</span>
          <span class="hn-duo__names"><b>${esc(ps[0].name)}</b><b>${esc(ps[1].name)}</b></span>
          <span class="hn-duo__big"><b class="num">${f.matchesTogether}</b><span class="cap">${plural(f.matchesTogether, 'матч', 'матча', 'матчей')} вместе</span><span class="hn-duo__yrs num">с ${f.since}</span></span>
        </li>`).join('')}</ul>
      <p class="hn-note">Настоящих людей в этом списке сайт покажет только тех, кто дал согласие на публикацию, и только после сверки имён. ${HAS_PEOPLE ? 'Сейчас настоящий список видит лишь директор.' : 'В опубликованной версии прототипа настоящего списка нет.'}</p>`;
  }
  $('hn-chem-body').innerHTML = `
    <div class="hn-chem">
      <div class="hn-chem__list">${list}</div>
      <aside class="hn-chem__aside">
        <div class="stats">
          <div class="stat"><span class="stat__n">${L.recordTournaments}</span><span class="cap">турниров вместе — рекорд лиги</span></div>
          <div class="stat"><span class="stat__n">${L.pairs5plus}</span><span class="cap">${plural(L.pairs5plus, 'пара сыграла', 'пары сыграли', 'пар сыграли')} вместе 5 турниров и больше</span></div>
          <div class="stat"><span class="stat__n">${L.pairs}</span><span class="cap">${plural(L.pairs, 'разная пара', 'разные пары', 'разных пар')} за все годы</span></div>
        </div>
        <p class="hn-note">Большинство пар собираются на один-два турнира: лига любит менять составы. Поэтому долгий дуэт — повод сказать о нём вслух.</p>
        <p class="hn-note"><b>Чего здесь нет и не будет.</b> Оценки «кто сильнее вместе», сравнения пары с соперниками, встреч человека с человеком. Встречи на корте («мы с ним играли трижды») игрок видит только сам, у себя в профиле.</p>
      </aside>
    </div>`;
}

/* ------------------------------------------------------------------ 05 · строка на афише */

const MIN_PER_TOUR = 3;   // в группе у пары минимум три матча
let tourNo = 7;

function renderPoster() {
  const host = $('hn-poster-body');
  const p2 = playersOfPair('dp2'), p3 = playersOfPair('dp3');
  const before = (tourNo - 1) * MIN_PER_TOUR;
  const line = togetherLine({ tournamentNo: tourNo, matchesBefore: before });
  host.innerHTML = `
    <div class="hn-mini">
      <div class="hn-mini__card">
        <p class="hn-mini__head"><span class="cap">Демо · Весенний кубок · Группа B</span><span class="tag tag--soon">Скоро · 18:30</span></p>
        <div class="hn-mini__side" data-slot="a"></div>
        <p class="hn-mini__line" id="hn-line" aria-live="polite">${line ? esc(line) : '<span class="hn-mini__none">строки нет</span>'}</p>
        <p class="poster__vs hn-mini__vs"><span class="poster__vs-mark">VS</span></p>
        <div class="hn-mini__side" data-slot="b"></div>
        <p class="hn-mini__line"><span class="hn-mini__none">строки нет: эта пара играет вместе впервые</span></p>
      </div>
      <div class="hn-mini__ctrl">
        <p class="cap cap--strong" id="hn-step-l">Каким по счёту турниром вместе идёт верхняя пара</p>
        <div class="hn-stepper" role="group" aria-labelledby="hn-step-l">
          <button class="btn btn--secondary hn-stepper__b" type="button" id="hn-minus" aria-label="Меньше турниров вместе"${tourNo <= 1 ? ' disabled' : ''}>−</button>
          <output class="hn-stepper__v num" id="hn-tour" aria-live="polite">${tourNo}-й</output>
          <button class="btn btn--secondary hn-stepper__b" type="button" id="hn-plus" aria-label="Больше турниров вместе"${tourNo >= 12 ? ' disabled' : ''}>+</button>
        </div>
        <p class="hn-mini__why">До этого матча пара сыграла вместе не меньше <b class="num">${before}</b> ${plural(before, 'матча', 'матчей', 'матчей')} (по ${MIN_PER_TOUR} в группе каждого турнира). ${line
          ? 'Пять и больше — строка есть.'
          : tourNo < 2 ? 'Первый турнир вместе — строки нет.' : 'Меньше пяти — строки нет: так решили критики, чтобы не писать о случайных парах.'}</p>
        <ul class="hn-list" role="list">
          <li>Только факт: «Вместе 7-й турнир». Ни оценки пары, ни сравнения с соперниками.</li>
          <li>Строка появляется с пятого матча вместе. В архиве лиги до этого доходит ${L.pairsFiveMatches} ${plural(L.pairsFiveMatches, 'пара', 'пары', 'пар')} из ${L.pairs}.</li>
          <li>Посев и места не меняются — строка рядом, а не вместо них.</li>
        </ul>
      </div>
    </div>`;
  host.querySelector('[data-slot="a"]').append(pairPlate(pairOf('dp2'), p2, { size: 'lg', seed: true }));
  host.querySelector('[data-slot="b"]').append(pairPlate(pairOf('dp3'), p3, { size: 'lg', seed: true }));
  const go = (d, focusId) => { tourNo = Math.min(12, Math.max(1, tourNo + d)); renderPoster(); const f = $(focusId); (f && !f.disabled ? f : $('hn-tour')).focus?.({ preventScroll: true }); };
  $('hn-minus').addEventListener('click', () => go(-1, 'hn-minus'));
  $('hn-plus').addEventListener('click', () => go(1, 'hn-plus'));
}

/* ------------------------------------------------------------------ запуск */

renderPublic();
renderHow();
renderQueue();
renderChem();
renderPoster();

onIdentityChange(() => { flash = ''; renderQueue(); renderChem(); });
window.addEventListener('storage', (e) => {
  if (e.key !== LS_KEY) return;
  let raw = null;
  try { raw = JSON.parse(e.newValue || 'null'); } catch { raw = null; }
  state = sanitizeState(raw, FRESH);
  renderQueue();
});
