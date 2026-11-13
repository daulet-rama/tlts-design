// TLTS · player.html — карточка и профиль игрока.
// Данные — только core/data.js и хранилище core/store.js; карточки, плашки, мячи — только core/card.js.

import { players, pairs, playerOf, playersOfPair, rankA, rankB, ratingGap, RANK_B_LADDER, DEMO_NOTE, RATING_DATE } from './core/data.js';
import { createStore } from './core/store.js';
import {
  playerCard, pairPlate, updatePairPlate, pairBallHTML, pairBall3dHTML, pipsHTML,
  hasPortraitOverride, setPortraitOverride, clearPortraitOverride, onPortraitChange,
  setPortraitPreview, clearPortraitPreview, fileToPortrait,
} from './core/card.js';
import { mountProtoBar } from './core/protobar.js';
// роль и «я» — общий модуль; своё имя onIdentityChange занято перерисовкой страницы
import { role as getRole, playerId as getMe, me as meId, setRole, setMe, onIdentityChange as onIdChange } from './core/identity.js';

mountProtoBar({ current: 'player', demo: true });

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
const fmtNum = (n) => Number(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : 'дата — нет данных'; };
const NO_DATA = '<span class="pl-nodata">нет данных</span>';
// словарь (core/LOOK.md): «1/2 финала», а не «полуфинал» — страховка для текстов правил из core/data.js
const semiWord = (s) => String(s ?? '').replace(/(^|[\s(«])[Пп]олуфинал[а-я]*/g, (m, pre) => `${pre}1/2 финала`);

/* ------------------------------------------------------------------ состояние прототипа */

const LS_RANK = 'tlts-player-rank';
// кнопки переключателя — как в PAGES §5: Гость · Игрок · Админ · Суперадмин. Судья входит на экране судьи.
const ROLES = [
  { id: 'guest', label: 'Гость', rights: 'Смотрит профили, рейтинг и матчи. Ничего не меняет, «вы здесь» не подсвечивается.' },
  { id: 'player', label: 'Игрок', rights: 'Всё, что гость, плюс меняет своё фото и видит себя янтарём «вы здесь» на всех экранах.' },
  { id: 'admin', label: 'Админ', rights: 'Меняет фото любого игрока лиги, в том числе архивного, и может вернуть прежнее.' },
  { id: 'superadmin', label: 'Суперадмин', rights: 'Всё, что админ, плюс в готовой платформе назначает админов и судей.' },
];
// роль «Судья» выбирают на экране судьи; здесь она только описана: судья — не игрок, фото не меняет
const JUDGE = { id: 'judge', label: 'Судья', rights: 'Ведёт счёт матчей на экране судьи. Фото не меняет, «вы здесь» не подсвечивается.' };
const roleInfo = (r) => ROLES.find((x) => x.id === r) || (r === 'judge' ? JUDGE : ROLES[1]);
const lsGet = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* хранилище недоступно — работаем без него */ } };

// getRole() — роль; getMe() — за кого вошли (чей профиль открыть); meId() — «вы здесь», только у роли «Игрок»

const params = new URLSearchParams(location.search);
const asked = params.get('p');
let pid = asked && playerOf(asked) ? asked : getMe();
const notFound = !!asked && !playerOf(asked);
const player = playerOf(pid);

let variant = (() => {
  const q = (params.get('rank') || '').toUpperCase();
  if (q === 'A' || q === 'B') return q;
  const s = lsGet(LS_RANK);
  return s === 'B' ? 'B' : 'A';
})();

const store = createStore();

/* ------------------------------------------------------------------ подготовка игрока */

// «в лиге с 2023 или раньше» у архивных игроков карточка пишет сама по sinceApprox
const sinceWords = (p) => (p.since ? (p.sinceApprox ? `в лиге с ${p.since} или раньше` : `в лиге с ${p.since}`) : null);
const isDemoRating = (p) => !!p?.rating?.demo;
const B = rankB(player);
const A = rankA(player);

function mainPair(p) {
  const own = pairs.filter((x) => x.players.includes(p.id));
  const demoPair = own.find((x) => x.demo);
  if (demoPair) return { pair: demoPair, mates: playersOfPair(demoPair.id), partnerName: null };
  const firstPartner = (p.partners || [])[0];
  if (firstPartner) {
    const viaPair = own.find((x) => x.players.includes(firstPartner.id));
    const mate = playerOf(firstPartner.id);
    const mates = [p, mate].filter(Boolean);
    // партнёра нет в прототипе — его КПР всё равно есть в рейтинге лиги (partners[].kpr)
    return { pair: viaPair || null, mates, partnerName: mate ? null : firstPartner.name || null, partnerKpr: mate ? null : firstPartner.kpr ?? null, matches: firstPartner.matches };
  }
  if (own[0]) return { pair: own[0], mates: playersOfPair(own[0].id), partnerName: null };
  return { pair: null, mates: [p], partnerName: null };
}

/* ------------------------------------------------------------------ 01 · карточка */

// предпросмотр фото до сохранения — setPortraitPreview из основы: он сам попадает во все карточки игрока на странице

function renderCard() {
  const el = playerCard(player, { size: 'lg', rank: variant, rankB: B, demoMark: false });
  el.id = 'pl-card-el';
  if (meId() === pid) el.classList.add('pl-is-me');
  const kids = [el];
  if (variant === 'A' && isDemoRating(player) && (A.place != null || A.alphaPlace != null)) {
    // карточка основы не знает про демо-рейтинг: подпишем под ней, чтобы не было двух «№1»
    const note = document.createElement('p');
    note.className = 'pl-card__note';
    note.textContent = 'Места Беты и Альфы — демо-рейтинг: выдуманы и могут совпадать с местами настоящих игроков.';
    kids.push(note);
  }
  $('pl-card').replaceChildren(...kids);
  for (const b of document.querySelectorAll('.pl-seg .seg__btn')) b.setAttribute('aria-pressed', String(b.dataset.rank === variant));
  renderExplain();
}

function renderHead() {
  document.title = `${player.last} · Игрок · TLTS`;
  const full = [player.last, player.first, player.patronymic].filter(Boolean).join(' ');
  $('pl-name').textContent = full;
  const tags = [];
  if (player.demo) tags.push(`<span class="tag tag--demo">${esc(DEMO_NOTE)}</span>`);
  else tags.push('<span class="tag tag--done">Архив лиги · настоящие данные</span>');
  if (meId() === pid) tags.push('<span class="you-pin">вы здесь</span>');
  $('pl-tags').innerHTML = tags.join(' ');
  const bits = [];
  if (player.kpr != null) bits.push(`КПР ${player.kpr.toFixed(1)}`);
  if (player.rating?.place != null) bits.push(isDemoRating(player) ? `№${player.rating.place} в демо-рейтинге` : `№${player.rating.place} в общем рейтинге`);
  bits.push(B.label);
  $('pl-sub').textContent = bits.join(' · ');
  if (notFound) {
    const nf = $('pl-notfound');
    nf.hidden = false;
    nf.textContent = `Игрока «${asked}» в данных прототипа нет. Открыт ваш профиль.`;
  }
}

function renderExplain() {
  const k = player.kpr != null ? player.kpr.toFixed(1) : null;
  let html;
  if (variant === 'A') {
    html = `<p class="cap cap--strong">Вариант А · как в лиге</p>
      <p class="pl-explain__lead">Главная цифра — <b>КПР</b>, личный уровень игры. Рядом два места: Бета — общий рейтинг лиги, Альфа — рейтинг внутри своего уровня КПР. И число титулов.</p>
      <ul class="pl-explain__list">
        <li><span>У этого игрока</span><b>${k ? `КПР ${k}` : 'КПР нет'} · ${A.place != null ? `Бета №${A.place}` : 'Бета —'} · ${A.alphaPlace != null ? `Альфа №${A.alphaPlace}` : 'Альфа —'} · ${A.titles} ${plural(A.titles, 'титул', 'титула', 'титулов')}</b>${isDemoRating(player) ? ' (места — демо-рейтинг)' : ''}</li>
        <li><span>Плюс</span>Привычно: эти цифры лига уже ведёт и называет так же.</li>
        <li><span>Учесть</span>Места меняются после каждого турнира и могут падать. У новичка без мест карточка почти пустая.</li>
      </ul>`;
  } else {
    const next = B.next ? `«${esc(B.next.label)}» — ${esc(semiWord(B.next.need.charAt(0).toLowerCase() + B.next.need.slice(1)))}` : 'Высшая ступень — дальше некуда';
    html = `<p class="cap cap--strong">Вариант Б · звание по заслугам</p>
      <p class="pl-explain__lead">Главное — <b>звание</b>: путь игрока в лиге. Семь ступеней от «Дебютанта» до «Легенды лиги». Звание не падает и не повторяет КПР — КПР остаётся маленькой подписью.</p>
      <ul class="pl-explain__list">
        <li><span>У этого игрока</span><b>${esc(B.label)} · ступень ${B.level} из ${B.max}</b></li>
        <li><span>Следующее</span>${next}</li>
        <li><span>Плюс</span>Есть к чему стремиться любому, даже новичку: цель всегда видна.</li>
        <li><span>Учесть</span>Нужна история турниров каждого игрока. Наверху звания копятся: «Чемпионов этапа» будет много.</li>
      </ul>`;
  }
  $('pl-explain').innerHTML = html + '<p class="pl-explain__foot">Переключатель меняет ранг на карточке, в списке игроков ниже и в подписях. Оба варианта рядом — в разделе 02.</p>';
}

function renderPairBall() {
  const { pair, mates, partnerName, partnerKpr, matches } = mainPair(player);
  const ks = mates.map((m) => m.kpr).filter((x) => typeof x === 'number');
  if (typeof partnerKpr === 'number') ks.push(partnerKpr);
  const box = $('pl-pairball');
  const names = mates.map((m) => `<a class="pl-tap" href="player.html?p=${encodeURIComponent(m.id)}"${m.id === pid ? ' aria-current="page"' : ''}>${esc(m.last)}</a>`);
  if (partnerName) names.push(esc(partnerName));
  const sum = pair?.kprSum ?? (ks.length === 2 ? Math.round((ks[0] + ks[1]) * 10) / 10 : null);
  // мяч крупнее 96 px — 3D-рендер; основа сама подставит SVG, если картинки нет
  const ballHTML = ks.length === 2
    ? pairBall3dHTML(ks[0], ks[1], { size: 132, decorative: true, sizes: '132px' })
    : pairBallHTML(player.kpr, partnerName ? '' : null, { size: 132, decorative: true });
  const isMyPair = meId() && mates.some((m) => m.id === meId());
  box.innerHTML = `<div class="pl-pairball__ball">${ballHTML}</div>
    <div class="pl-pairball__text">
      <p class="cap">${pair?.demo ? `Пара демо-вечера · посев ${pair.seed ?? '—'}` : 'Основная пара'}</p>
      <p class="pl-pairball__names">${names.join(' <span aria-hidden="true">+</span><span class="vh">и</span> ')}${isMyPair ? ' <span class="you-pin">ваша пара</span>' : ''}</p>
      <p class="pl-pairball__meta">${sum != null ? `КПР пары ${sum.toFixed(1)}` : 'КПР пары — нет данных'}${matches ? ` · ${matches} ${plural(matches, 'матч', 'матча', 'матчей')} вместе` : ''}${pair && !pair.demo ? ' · сумма текущих КПР' : ''}</p>
    </div>`;
}

/* ------------------------------------------------------------------ 02 · оба варианта рядом */

function renderCompare() {
  const col = (v) => {
    const xl = playerCard(player, { size: 'xl', rank: v, rankB: B });
    const facts = v === 'A'
      ? [
        ['Главная цифра', player.kpr != null ? `КПР ${player.kpr.toFixed(1)}` : 'КПР — нет данных'],
        ['Рядом', `${A.place != null ? `Бета №${A.place}` : 'Бета —'}, ${A.alphaPlace != null ? `Альфа №${A.alphaPlace}` : 'Альфа —'}${isDemoRating(player) ? ' (демо-рейтинг)' : ''}, ${A.titles} ${plural(A.titles, 'титул', 'титула', 'титулов')}`],
        ['Может упасть', 'Да: места пересчитываются после турниров'],
        ['Отвечает на вопрос', '«Насколько он силён сейчас?»'],
      ]
      : [
        ['Главное слово', `${B.label} · ступень ${B.level} из ${B.max}`],
        ['Рядом', `КПР ${player.kpr != null ? player.kpr.toFixed(1) : '—'} мелко; ${B.next ? `до «${B.next.label}»: ${semiWord(B.next.need.charAt(0).toLowerCase() + B.next.need.slice(1))}` : 'высшая ступень'}`],
        ['Может упасть', 'Нет: звание остаётся навсегда'],
        ['Отвечает на вопрос', '«Чего он добился в лиге?»'],
      ];
    const wrap = document.createElement('article');
    wrap.className = `pl-variant${variant === v ? ' is-current' : ''}`;
    wrap.dataset.variant = v;
    wrap.innerHTML = `<header class="pl-variant__head">
        <p class="pl-variant__name">Вариант ${v === 'A' ? 'А' : 'Б'}</p>
        <p class="pl-variant__sub">${v === 'A' ? 'Как в лиге' : 'Звание по заслугам'}</p>
        <span class="pl-variant__now cap">${variant === v ? 'сейчас на карточке' : ''}</span>
      </header>
      <div class="pl-variant__xl"></div>
      <dl class="pl-variant__facts">${facts.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
      <button class="btn btn--secondary btn--sm pl-variant__use" type="button" data-rank="${v}" aria-pressed="${variant === v}">
        ${variant === v ? 'Показан на карточке' : 'Показать на карточке'}
      </button>`;
    wrap.querySelector('.pl-variant__xl').appendChild(xl);
    return wrap;
  };
  $('pl-compare').replaceChildren(col('A'), col('B'));
  // строки списка — во всю ширину: в половине экрана телефона фамилия в строке не помещается
  const rows = $('pl-rows');
  rows.innerHTML = '<p class="cap cap--strong">Тот же игрок в строке списка</p>';
  for (const v of ['A', 'B']) {
    const r = document.createElement('div');
    r.className = `pl-rows__row${variant === v ? ' is-current' : ''}`;
    r.innerHTML = `<span class="pl-rows__v">${v === 'A' ? 'А' : 'Б'}</span>`;
    r.appendChild(playerCard(player, { size: 'sm', rank: v, rankB: B }));
    rows.appendChild(r);
  }
}

/* ------------------------------------------------------------------ 03 · лестница */

function renderLadder() {
  const demoAt = new Map();
  const archAt = new Map();
  for (const p of players) {
    const lv = rankB(p).level;
    const map = p.demo ? demoAt : archAt;
    if (!map.has(lv)) map.set(lv, []);
    map.get(lv).push(p);
  }
  const me = meId();
  $('pl-ladder').innerHTML = RANK_B_LADDER.map((r) => {
    const state = r.level < B.level ? 'done' : r.level === B.level ? 'now' : r.level === B.level + 1 ? 'next' : 'later';
    const stateText = { done: 'пройдена', now: 'сейчас здесь', next: 'следующая', later: 'впереди' }[state];
    const here = (demoAt.get(r.level) || []).slice();
    if (!player.demo && r.level === B.level) here.push(player);   // архивный игрок — тоже на своей ступени
    const who = here.map((p) => {
      const cls = `pl-ladder__who${p.id === pid ? ' is-this' : ''}${p.id === me ? ' is-you' : ''}`;
      return `<a class="${cls}" href="player.html?p=${encodeURIComponent(p.id)}&rank=B" ${p.id === pid ? 'aria-current="page"' : ''}>${esc(p.last)}</a>`;
    }).join('');
    const arch = (archAt.get(r.level) || []).filter((p) => p.id !== pid).length;
    const need = state === 'next' && B.next ? `<p class="pl-ladder__need"><b>Что нужно:</b> ${esc(semiWord(B.next.need))}</p>` : '';
    return `<li class="pl-ladder__step is-${state}"${state === 'now' ? ' aria-current="step"' : ''}>
      <span class="pl-ladder__n" aria-hidden="true">${r.level}</span>
      <div class="pl-ladder__main">
        <p class="pl-ladder__label">${esc(r.label)} <span class="pl-ladder__state cap">${stateText}</span></p>
        <p class="pl-ladder__rule">${esc(semiWord(r.rule))}</p>
        ${need}
        <p class="pl-ladder__people">${who || (arch ? '' : '<span class="muted">пока никого</span>')}${arch ? `<span class="cap pl-ladder__arch">${here.length ? '+ ' : ''}${arch} ${plural(arch, 'игрок', 'игрока', 'игроков')} архива</span>` : ''}</p>
      </div>
      ${pipsHTML(r.level, 7)}
    </li>`;
  }).join('');
}

/* ------------------------------------------------------------------ 04 · профиль */

const wlHTML = (form) => (Array.isArray(form) && form.length
  ? `<span class="wl" role="img" aria-label="Последние матчи, новые справа: ${form.map((x) => (x === 'W' ? 'победа' : 'поражение')).join(', ')}">${form.map((x) => (x === 'W' ? '<i class="w">В</i>' : '<i class="l">П</i>')).join('')}</span>`
  : null);
const pct = (w, l) => (w + l ? Math.round((w / (w + l)) * 100) : null);

// отрыв до места выше — ratingGap из основы: Альфа по баллам Альфы, Бета по баллам Беты, отрицательным не бывает
function gapHTML(g) {
  if (!g) return NO_DATA;
  if (g.top) return '<b>Первое место</b> — выше никого';
  if (!g.above) return `До №${g.place - 1} — <span class="pl-nodata">нет в прототипе</span>`;
  const last = g.above.player ? g.above.player.last : String(g.above.name || '').split(' ').slice(-1)[0];
  const who = g.above.id ? `<a class="pl-tap" href="player.html?p=${encodeURIComponent(g.above.id)}">${esc(last)}</a>` : esc(last);
  const gap = g.gap === 0
    ? 'столько же баллов'
    : `<b class="num">${fmtNum(g.gap)}</b> ${plural(g.gap, 'балл', 'балла', 'баллов')}`;
  return g.exact
    ? `До №${g.above.place} (${who}) — ${gap}`
    : `№${g.place - 1} — <span class="pl-nodata">нет в прототипе</span>; ближайший выше — №${g.above.place} (${who}), ${gap}`;
}

function stat(n, label, small) {
  return `<div class="stat"><span class="stat__n">${n}${small ? ` <small>${small}</small>` : ''}</span><span class="cap">${label}</span></div>`;
}

let matchRows = [];   // { id, el, plates: [a, b], tag }

function statusTag(m) {
  if (m.status === 'live') return '<span class="tag tag--live">LIVE</span>';
  if (m.status === 'upcoming') return `<span class="tag tag--soon">Скоро${m.scheduled ? ` · ${esc(m.scheduled)}` : ''}</span>`;
  // неявка, снятие, прерванный матч — готовая подпись основы, без очков и подачи
  const v = store.view(m.id);
  if (v?.outcome && v.outcome !== 'played' && v.outcomeText) return `<span class="tag tag--done">${esc(v.outcomeText)}</span>`;
  return '<span class="tag tag--done">Завершён</span>';
}

function renderMatches(host) {
  const myPairs = new Set(pairs.filter((x) => x.players.includes(pid)).map((x) => x.id));
  const list = store.matches().filter((m) => m.pairs.some((id) => myPairs.has(id)));
  const me = meId();
  const mePairs = me ? new Set(pairs.filter((x) => x.players.includes(me)).map((x) => x.id)) : new Set();
  matchRows = [];
  if (!list.length) {
    host.innerHTML = `<p class="muted">Матчей этого игрока в демо-вечере и в архиве прототипа нет. В архиве — только 1/2 финала и финалы высшей категории двух турниров 2026 года.</p>`;
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'pl-matches';
  for (const m of list) {
    const v = store.view(m.id);
    const li = document.createElement('li');
    const isYou = m.pairs.some((id) => mePairs.has(id));
    li.className = `pl-match${isYou ? ' row is-you' : ''}`;
    const a = document.createElement('a');
    a.className = 'pl-match__link';
    a.href = `match.html?m=${encodeURIComponent(m.id)}`;
    const date = m.tournament?.date ? fmtDate(m.tournament.date) : '[ДАТА]';
    a.innerHTML = `<span class="pl-match__head">
        <span class="pl-match__tag"></span>
        <span class="cap cap--strong">${esc(m.stage || '')}${m.category ? ` · ${esc(m.category)}` : ''}</span>
        <span class="cap">${esc(m.tournament?.name || '')} · ${date}${m.court ? ` · ${esc(m.court)}` : ''}</span>
      </span>
      <span class="pl-match__plates"></span>
      <span class="pl-match__foot cap">${m.dataset === 'archive' ? 'Счёт по очкам не сохранился · ' : ''}Открыть афишу →</span>`;
    a.querySelector('.pl-match__tag').innerHTML = statusTag(m);
    const plates = m.pairs.map((id, side) => {
      const pair = pairs.find((x) => x.id === id);
      // у матча, который ещё не начался, счёта нет: плашка без цифр
      const pl = pairPlate(pair, playersOfPair(id), m.status === 'upcoming' ? { size: 'sm' } : { size: 'sm', view: v, side });
      if (myPairs.has(id)) pl.classList.add('pl-plate-own');
      return pl;
    });
    a.querySelector('.pl-match__plates').append(...plates);
    li.appendChild(a);
    ul.appendChild(li);
    matchRows.push({ id: m.id, plates, tag: a.querySelector('.pl-match__tag') });
  }
  host.replaceChildren(ul);
}

function updateMatch(id) {
  const row = matchRows.find((r) => r.id === id);
  if (!row) return;
  const m = store.match(id);
  const v = store.view(id);
  row.plates.forEach((el, side) => updatePairPlate(el, m.status === 'upcoming' ? {} : { view: v, side }));
  const html = statusTag(m);
  if (row.tag.innerHTML !== html) row.tag.innerHTML = html;
}

function renderProfile() {
  const p = player;
  const ws = p.wl?.season, wc = p.wl?.career;
  const form = wlHTML(p.form);
  const sinceText = p.since ? `${sinceWords(p)}${p.sinceApprox ? ' — данных лиги до 2023 нет' : ''}` : 'год вступления — нет данных';
  const t = p.titles || {};
  const finalYears = Array.isArray(p.finalYears) && p.finalYears.length ? p.finalYears.join(', ') : null;
  const gB = ratingGap(p, 'beta');
  const gA = ratingGap(p, 'alpha');
  const sw = p.stageWins || { tsCup: t.stage ?? 0, special: 0, specialNames: [] };
  const stageAll = (sw.tsCup || 0) + (sw.special || 0);
  const ratingNote = isDemoRating(p)
    ? 'Демо-рейтинг: места и баллы выдуманы и могут совпадать с местами настоящих игроков. Отрыв считается только среди демо-игроков.'
    : `Рейтинг лиги на ${fmtDate(RATING_DATE)}. Бета — общий рейтинг лиги, Альфа — рейтинг внутри своего уровня КПР.`;

  $('pl-profile-meta').textContent = p.demo ? 'Демо-игрок: цифры выдуманы' : 'Архив лиги 2023–2026';

  const partners = (p.partners || []).map((x) => {
    const mate = playerOf(x.id);
    const name = x.name || mate?.name || '—';
    // КПР партнёра — из рейтинга лиги, даже если самого партнёра в прототипе нет
    const kpr = x.kpr ?? mate?.kpr ?? null;
    const ball = pairBallHTML(p.kpr, kpr ?? '', { size: 34, decorative: true });
    const isYou = mate && mate.id === meId();
    return `<li class="pl-partner${isYou ? ' row is-you' : ''}">
      ${ball}
      <span class="pl-partner__name">${mate ? `<a class="pl-tap" href="player.html?p=${encodeURIComponent(mate.id)}">${esc(name)}</a>` : `<span class="pl-partner__plain">${esc(name)}</span>`}${isYou ? ' <span class="you-pin">вы</span>' : ''}
        <span class="cap">${kpr != null ? `КПР ${Number(kpr).toFixed(1)}` : 'КПР — нет данных'}${x.tournaments ? ` · ${x.tournaments} ${plural(x.tournaments, 'турнир', 'турнира', 'турниров')}` : ''}</span></span>
      <span class="pl-partner__n num">${x.matches ?? '—'} <span class="cap">${plural(x.matches ?? 0, 'матч', 'матча', 'матчей')}</span></span>
    </li>`;
  }).join('');

  $('pl-profile').innerHTML = `
    <article class="panel panel--pad pl-box pl-box--season">
      <h3 class="pl-box__title">Сезон</h3>
      <div class="stats">
        ${ws ? stat(`${ws[0]}–${ws[1]}`, 'Победы–поражения') : stat('—', 'Победы–поражения')}
        ${ws ? stat(`${pct(ws[0], ws[1])}%`, 'Побед в сезоне') : ''}
        ${stat(p.rating?.tournaments ?? '—', 'Турниров в рейтинге')}
      </div>
      <dl class="pl-dl">
        <div><dt>Форма</dt><dd>${form || `${NO_DATA}${p.demo ? '' : ': порядок матчей в группах не сохранился'}`}</dd></div>
        <div><dt>Карьера</dt><dd>${wc ? `<span class="num">${wc[0]}–${wc[1]}</span> · ${pct(wc[0], wc[1])}% побед` : NO_DATA}</dd></div>
        <div><dt>Турниров всего</dt><dd>${p.tournaments != null ? `<span class="num">${p.tournaments}</span>` : NO_DATA}</dd></div>
        <div><dt>В лиге</dt><dd>${esc(sinceText)}</dd></div>
        ${p.demo ? `<div><dt>Возраст, рука</dt><dd>${p.age} ${plural(p.age, 'год', 'года', 'лет')} · ${p.hand === 'L' ? 'левша' : 'правша'}</dd></div>` : `<div><dt>Возраст, рука</dt><dd>${NO_DATA}</dd></div>`}
      </dl>
    </article>

    <article class="panel panel--pad pl-box pl-box--titles">
      <h3 class="pl-box__title">Титулы и финалы</h3>
      <div class="stats">
        ${stat(stageAll, 'Победы в высшей')}
        ${stat(t.final ?? 0, 'Итоговые TS CUP')}
        ${stat(t.second ?? 0, 'Победы во второй')}
      </div>
      <dl class="pl-dl">
        <div><dt>Победы в турнирах высшей категории</dt><dd>этапы TS CUP — <span class="num">${sw.tsCup || 0}</span>; другие турниры — <span class="num">${sw.special || 0}</span>${sw.special && sw.specialNames?.length ? ` (${esc(sw.specialNames.join(', '))})` : ''}</dd></div>
        <div><dt>Финалы высшей</dt><dd>${p.finals != null ? `<span class="num">${p.finals}</span>` : NO_DATA}</dd></div>
        <div><dt>1/2 финала высшей</dt><dd>${p.semis != null ? `<span class="num">${p.semis}</span>` : NO_DATA}</dd></div>
        ${p.demo ? '' : `<div><dt>Итоговые, годы</dt><dd>${finalYears ? `<span class="num">${finalYears}</span>` : 'не выигрывал'}</dd></div>`}
      </dl>
      <p class="pl-box__note">Grand Masters — высшая категория, Masters — вторая; в 2023 году высшая категория называлась Masters, вторая — Futures. Итоговый TS CUP считается отдельно.${sw.special ? ' Даёт ли победа в другом турнире звание «Чемпион этапа» — уточняется у лиги.' : ''}</p>
    </article>

    <article class="panel panel--pad pl-box pl-box--rating">
      <h3 class="pl-box__title">Рейтинг${isDemoRating(p) ? ' <span class="tag tag--demo">демо-рейтинг</span>' : ''}</h3>
      <div class="stats">
        ${stat(p.rating?.place != null ? `№${p.rating.place}` : '—', 'Бета · общий')}
        ${stat(p.rating?.alphaPlace != null ? `№${p.rating.alphaPlace}` : '—', `Альфа · уровень ${p.kpr != null ? p.kpr.toFixed(1) : '—'}`)}
        ${stat(p.rating?.points != null ? fmtNum(p.rating.points) : '—', 'Баллы Беты')}
      </div>
      <dl class="pl-dl">
        <div><dt>Баллы Альфы</dt><dd>${p.rating?.alphaPoints != null ? `<span class="num">${fmtNum(p.rating.alphaPoints)}</span>` : NO_DATA}</dd></div>
        <div><dt>Отрыв, Бета</dt><dd>${gapHTML(gB)}</dd></div>
        <div><dt>Отрыв, Альфа</dt><dd>${gapHTML(gA)}</dd></div>
      </dl>
      <p class="pl-box__note">${ratingNote}</p>
    </article>

    <article class="panel panel--pad pl-box pl-box--partners">
      <h3 class="pl-box__title">Партнёры</h3>
      ${partners ? `<ul class="pl-partners">${partners}</ul>` : `<p>${NO_DATA}</p>`}
    </article>

    <article class="panel panel--pad pl-box pl-box--matches">
      <h3 class="pl-box__title">Матчи ${p.demo ? 'демо-вечера' : 'из архива'}</h3>
      <div id="pl-matches"></div>
    </article>`;
  renderMatches($('pl-matches'));
}

/* ------------------------------------------------------------------ фото */

function canEditPhoto() {
  const role = getRole();
  if (role === 'admin' || role === 'superadmin') return true;
  return role === 'player' && getMe() === pid;
}

function renderPhotoControls() {
  const can = canEditPhoto();
  const editing = !$('pl-editor').hidden;
  $('pl-photo-pick').hidden = !can || editing;
  $('pl-photo-revert').hidden = !can || editing || !hasPortraitOverride(pid);
  const role = getRole();
  let hint = '';
  if (!can) {
    hint = role === 'guest'
      ? 'Фото меняют сам игрок или админ. Сейчас вы гость — смените роль в разделе 05.'
      : role === 'judge'
      ? 'Фото меняют сам игрок или админ. Сейчас вы судья — судья фото не меняет. Смените роль в разделе 05.'
      : 'Фото меняет сам игрок или админ. Чтобы попробовать, войдите этим игроком или админом в разделе 05.';
  } else if (!editing) {
    hint = hasPortraitOverride(pid)
      ? 'Стоит загруженное фото. Оно видно в карточках на всех экранах этого браузера.'
      : (player.portrait ? 'Сейчас стоит сгенерированный портрет.' : 'Фото пока нет — стоит монограмма.')
        + (role === 'player' ? ' Это ваш профиль: фото можно заменить.' : ` Как ${role === 'admin' ? 'админ' : 'суперадмин'} вы можете заменить фото любого игрока.`);
  }
  $('pl-photo-hint').textContent = hint;
}

const ED = { img: null, url: null, w: 0, h: 0, z: 1, cx: 0, cy: 0, pointers: new Map(), pinch: null, raf: 0, prevTimer: 0, prevSeq: 0 };
const OUT_W = 896;   // как у готовых портретов: 896×1200
// у загруженного фото лицо в верхней трети кадра — так его ставит и круглый аватар
const PHOTO_META = { focus: [0.5, 0.3], facing: 'front' };
const msg = (t) => { $('pl-photo-msg').textContent = t; };

function cropBox() {
  const base = Math.min(ED.w, ED.h * 3 / 4);   // ширина кадра 3:4 при z = 1 (кадр вписан в снимок)
  const cw = base / ED.z, ch = cw * 4 / 3;
  ED.cx = Math.min(ED.w - cw / 2, Math.max(cw / 2, ED.cx));
  ED.cy = Math.min(ED.h - ch / 2, Math.max(ch / 2, ED.cy));
  return { sx: ED.cx - cw / 2, sy: ED.cy - ch / 2, cw, ch };
}
function drawTo(canvas, w, h) {
  const { sx, sy, cw, ch } = cropBox();
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ED.img, sx, sy, cw, ch, 0, 0, w, h);
}
function redraw() {
  cancelAnimationFrame(ED.raf);
  ED.raf = requestAnimationFrame(() => {
    const frame = $('pl-frame');
    const r = frame.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    drawTo($('pl-canvas'), Math.max(1, Math.round(r.width * dpr)), Math.max(1, Math.round(r.height * dpr)));
    $('pl-zoom').value = String(Math.round(ED.z * 100));
    clearTimeout(ED.prevTimer);
    ED.prevTimer = setTimeout(updatePreview, 90);
  });
}
async function updatePreview() {
  if (!ED.img) return;
  const seq = ++ED.prevSeq;
  const img = ED.img;
  let url;
  try { url = await fileToPortrait(img, { width: 448, quality: 0.8, crop: cropBox() }); } catch { return; }
  // пока считали, редактор закрыли или кадр сдвинули ещё раз — этот кадр уже не нужен
  if (seq !== ED.prevSeq || ED.img !== img || $('pl-editor').hidden) return;
  setPortraitPreview(pid, url, PHOTO_META);
}
function renderEditorCards() {
  // маленькие копии карточек прямо в редакторе: на телефоне большая карточка уходит за верх экрана
  const host = $('pl-editor-cards');
  const md = playerCard(player, { size: 'md', rank: 'kpr' });
  const sm = playerCard(player, { size: 'sm', rank: variant, rankB: B });
  host.replaceChildren(md, sm);
}
function setZoom(z, ax = 0.5, ay = 0.5) {
  // приближаем к точке (ax, ay) кадра — она остаётся на месте
  const before = cropBox();
  const px = before.sx + before.cw * ax, py = before.sy + before.ch * ay;
  ED.z = Math.min(4, Math.max(1, z));
  const base = Math.min(ED.w, ED.h * 3 / 4);
  const cw = base / ED.z, ch = cw * 4 / 3;
  ED.cx = px - cw * ax + cw / 2;
  ED.cy = py - ch * ay + ch / 2;
  redraw();
}
function panBy(dx, dy) {
  const r = $('pl-frame').getBoundingClientRect();
  const { cw } = cropBox();
  const k = cw / r.width;
  ED.cx -= dx * k; ED.cy -= dy * k;
  redraw();
}

async function openEditor(file) {
  msg('');
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) { msg('Это не картинка. Выберите фото: JPEG, PNG, WebP, GIF или AVIF.'); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  try {
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = url; });
  } catch {
    URL.revokeObjectURL(url);
    msg('Браузер не смог прочитать этот файл. Если это HEIC с айфона — сохраните его как JPEG и попробуйте снова.');
    return;
  }
  if (ED.url) URL.revokeObjectURL(ED.url);
  Object.assign(ED, { img, url, w: img.naturalWidth, h: img.naturalHeight, z: 1 });
  const base = Math.min(ED.w, ED.h * 3 / 4), ch = base * 4 / 3;
  ED.cx = ED.w / 2;
  ED.cy = ch / 2 + (ED.h - ch) * 0.2;   // лицо обычно в верхней части снимка
  $('pl-editor').hidden = false;
  renderEditorCards();
  renderPhotoControls();
  redraw();
  $('pl-frame').focus({ preventScroll: true });
  $('pl-editor').scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
  msg(`Фото открыто: ${ED.w}×${ED.h}. Подвиньте кадр и нажмите «Сохранить».`);
}

function closeEditor() {
  $('pl-editor').hidden = true;
  clearTimeout(ED.prevTimer);
  ED.prevSeq++;
  if (ED.url) URL.revokeObjectURL(ED.url);
  Object.assign(ED, { img: null, url: null });
  ED.pointers.clear();
  $('pl-editor-cards').replaceChildren();
  clearPortraitPreview(pid);
  renderPhotoControls();
}

let saving = false;
async function savePhoto() {
  if (!ED.img || saving) return;
  saving = true;
  $('pl-photo-save').disabled = true;
  const img = ED.img, crop = cropBox();
  // кадр 3:4 и сжатие — fileToPortrait из основы; если не влезло в хранилище, жмём сильнее
  const tries = [{ quality: 0.84 }, { quality: 0.7 }, { quality: 0.55 }, { quality: 0.55, width: 720 }];
  let ok = false, size = OUT_W;
  try {
    for (const t of tries) {
      const url = await fileToPortrait(img, { width: OUT_W, ...t, crop });
      if (setPortraitOverride(pid, url, PHOTO_META)) { ok = true; size = t.width || OUT_W; break; }
    }
  } catch { ok = false; }
  saving = false;
  $('pl-photo-save').disabled = false;
  if (ED.img !== img) return;   // редактор закрыли, пока сохраняли
  if (!ok) { msg('Не удалось сохранить: в браузере кончилось место для фото. Верните прежнее у других игроков и попробуйте снова.'); return; }
  closeEditor();
  msg(`Фото сохранено (${size}×${Math.round(size * 4 / 3)}). Оно уже стоит в карточках на всех экранах этого браузера.`);
  $('pl-photo-revert').focus?.();
}

function bindEditor() {
  $('pl-photo-pick').addEventListener('click', () => { $('pl-photo-file').value = ''; $('pl-photo-file').click(); });
  $('pl-photo-file').addEventListener('change', (e) => openEditor(e.target.files && e.target.files[0]));
  $('pl-photo-cancel').addEventListener('click', () => { closeEditor(); msg('Загрузка отменена, фото не изменилось.'); $('pl-photo-pick').focus(); });
  $('pl-photo-save').addEventListener('click', savePhoto);
  $('pl-photo-revert').addEventListener('click', () => {
    clearPortraitOverride(pid);
    msg(player.portrait ? 'Вернули прежний портрет.' : 'Загруженное фото убрано — снова монограмма.');
    renderPhotoControls();
    $('pl-photo-pick').focus();
  });
  $('pl-zoom').addEventListener('input', (e) => setZoom(Number(e.target.value) / 100));
  $('pl-zoom-in').addEventListener('click', () => setZoom(ED.z * 1.15));
  $('pl-zoom-out').addEventListener('click', () => setZoom(ED.z / 1.15));

  const frame = $('pl-frame');
  frame.addEventListener('pointerdown', (e) => {
    if (!ED.img) return;
    frame.setPointerCapture(e.pointerId);
    ED.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ED.pointers.size === 2) {
      const [a, b] = [...ED.pointers.values()];
      ED.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: ED.z };
    }
  });
  frame.addEventListener('pointermove', (e) => {
    const prev = ED.pointers.get(e.pointerId);
    if (!prev || !ED.img) return;
    const cur = { x: e.clientX, y: e.clientY };
    ED.pointers.set(e.pointerId, cur);
    if (ED.pointers.size >= 2 && ED.pinch) {
      const [a, b] = [...ED.pointers.values()];
      const r = frame.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(ED.pinch.z * (d / (ED.pinch.d || 1)), ((a.x + b.x) / 2 - r.left) / r.width, ((a.y + b.y) / 2 - r.top) / r.height);
    } else {
      panBy(cur.x - prev.x, cur.y - prev.y);
    }
  });
  const up = (e) => { ED.pointers.delete(e.pointerId); if (ED.pointers.size < 2) ED.pinch = null; };
  frame.addEventListener('pointerup', up);
  frame.addEventListener('pointercancel', up);
  frame.addEventListener('wheel', (e) => {
    if (!ED.img) return;
    e.preventDefault();
    const r = frame.getBoundingClientRect();
    setZoom(ED.z * Math.exp(-e.deltaY * 0.0015), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }, { passive: false });
  frame.addEventListener('keydown', (e) => {
    if (!ED.img) return;
    const step = e.shiftKey ? 40 : 12;
    const map = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (map[e.key]) { e.preventDefault(); panBy(...map[e.key]); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(ED.z * 1.1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(ED.z / 1.1); }
    else if (e.key === 'Enter') { e.preventDefault(); savePhoto(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeEditor(); $('pl-photo-pick').focus(); }
  });
  window.addEventListener('resize', () => { if (ED.img) redraw(); });
}

/* ------------------------------------------------------------------ 05 · роль и «я» */

function renderRole() {
  const role = getRole();
  const me = getMe();
  const demo = players.filter((p) => p.demo);
  const cur = roleInfo(role);
  $('pl-role').innerHTML = `
    <div class="pl-role__grid">
      <div class="stack">
        <p class="cap cap--strong" id="pl-role-label">Роль</p>
        <div class="seg pl-role__seg" role="group" aria-labelledby="pl-role-label">
          ${ROLES.map((r) => `<button class="seg__btn" type="button" data-role="${r.id}" aria-pressed="${r.id === role}">${r.label}</button>`).join('')}
        </div>
        <p class="pl-role__now"><b>${esc(cur.label)}.</b> ${esc(cur.rights)}${role === 'judge' ? ' Роль судьи выбрана на экране судьи; здесь можно сменить её на любую из четырёх.' : ''}</p>
        <ul class="pl-role__all">${ROLES.map((r) => `<li${r.id === role ? ' class="is-on"' : ''}><span class="cap cap--strong">${r.label}</span> ${esc(r.rights)}</li>`).join('')}</ul>
      </div>
      <div class="stack pl-role__me"${role === 'player' ? '' : ' hidden'}>
        <div class="field">
          <label class="field__label cap cap--strong" for="pl-me">Я вошёл как</label>
          <select class="input pl-select" id="pl-me">
            ${demo.map((p) => `<option value="${p.id}"${p.id === me ? ' selected' : ''}>${esc(p.name)} · КПР ${p.kpr.toFixed(1)}</option>`).join('')}
          </select>
          <p class="field__hint">Для входа в прототипе — только демо-игроки. Ваш профиль и пара подсвечены янтарём на всех экранах.</p>
        </div>
        ${pid !== me ? `<a class="more" href="player.html?p=${me}">Открыть мой профиль <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></a>` : '<p class="cap">Сейчас открыт ваш профиль</p>'}
      </div>
    </div>`;
  for (const b of $('pl-role').querySelectorAll('[data-role]')) {
    b.addEventListener('click', () => { refocusSel = `[data-role="${b.dataset.role}"]`; setRole(b.dataset.role); refocusSel = null; });
  }
  $('pl-me')?.addEventListener('change', (e) => { refocusSel = '#pl-me'; setMe(e.target.value); refocusSel = null; });
}

let refocusSel = null;   // какой элемент вернуть в фокус после перерисовки по своей же кнопке
function onIdentityChange(refocus) {
  renderHead();
  renderCard();
  renderPairBall();
  renderLadder();
  renderProfile();
  renderRole();
  renderList();
  if (!$('pl-editor').hidden && !canEditPhoto()) closeEditor();
  renderPhotoControls();
  if (refocus) $('pl-role').querySelector(refocus)?.focus();
}

/* ------------------------------------------------------------------ 06 · список игроков */

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').trim();

function renderList() {
  const q = norm($('pl-q').value);
  const me = meId();
  // каждое слово запроса — начало имени, фамилии или отчества (фамилия — и серединой): «Ерлан Сарсенбаев» = «Сарсенбаев Ерлан»
  const words = q.split(/\s+/).filter(Boolean);
  const match = (p) => {
    if (!words.length) return true;
    const last = norm(p.last), parts = [last, norm(p.first), norm(p.patronymic)].filter(Boolean);
    return words.every((w) => last.includes(w) || parts.some((x) => x.startsWith(w)));
  };
  const groups = [
    { title: 'Демо-игроки', note: 'Выдуманные люди со сгенерированными портретами. Их места — демо-рейтинг: могут совпадать с местами настоящих игроков.', list: players.filter((p) => p.demo && match(p)) },
    { title: 'Игроки архива', note: 'Настоящие игроки лиги: только настоящие цифры, вместо лица — монограмма.', list: players.filter((p) => !p.demo && match(p)) },
  ];
  const total = groups.reduce((a, g) => a + g.list.length, 0);
  $('pl-list-meta').textContent = `${players.length} ${plural(players.length, 'игрок', 'игрока', 'игроков')}`;
  $('pl-q-hint').textContent = q ? (total ? `Найдено: ${total}` : 'Никого не нашли. Проверьте фамилию или имя.') : 'Подпись под именем следует выбранному варианту ранга.';
  const host = $('pl-lists');
  host.replaceChildren(...groups.filter((g) => g.list.length).map((g) => {
    const box = document.createElement('div');
    box.className = 'pl-group';
    box.innerHTML = `<p class="cap cap--strong pl-group__title">${g.title} · ${g.list.length}</p><p class="pl-group__note">${g.note}</p>`;
    const ul = document.createElement('ul');
    ul.className = 'pl-list';
    for (const p of g.list) {
      const li = document.createElement('li');
      li.className = `pl-item${p.id === me ? ' row is-you' : ''}${p.id === pid ? ' is-this' : ''}`;
      const card = playerCard(p, { size: 'sm', rank: variant, rankB: rankB(p), demoMark: false, href: `player.html?p=${encodeURIComponent(p.id)}${variant === 'B' ? '&rank=B' : ''}` });
      if (p.id === pid) card.setAttribute('aria-current', 'page');
      li.appendChild(card);
      const tail = [];
      if (p.id === me) tail.push('<span class="you-pin">вы здесь</span>');
      if (p.id === pid) tail.push('<span class="cap cap--strong pl-item__open">открыт</span>');
      if (isDemoRating(p) && variant === 'A' && p.rating?.place != null) tail.push('<span class="cap pl-item__demo">места — демо-рейтинг</span>');
      if (!p.demo && !hasPortraitOverride(p.id)) tail.push('<span class="pl-item__nophoto">Фото появится, когда игрок или админ его загрузит</span>');
      if (tail.length) { const s = document.createElement('span'); s.className = 'pl-item__tail'; s.innerHTML = tail.join(''); li.appendChild(s); }
      ul.appendChild(li);
    }
    box.appendChild(ul);
    return box;
  }));
}

/* ------------------------------------------------------------------ сборка и подписки */

function setVariant(v, focusSel) {
  if (v === variant) return;
  variant = v;
  lsSet(LS_RANK, v);
  const u = new URL(location.href);
  u.searchParams.set('rank', v);
  history.replaceState(null, '', u);
  renderCard();
  renderCompare();
  renderList();
  if (focusSel) document.querySelector(focusSel)?.focus();
}

document.querySelector('.pl-seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rank]');
  if (b) setVariant(b.dataset.rank);
});
$('pl-compare').addEventListener('click', (e) => {
  const b = e.target.closest('.pl-variant__use');
  if (b) setVariant(b.dataset.rank, `.pl-variant__use[data-rank="${b.dataset.rank}"]`);
});
$('pl-q').addEventListener('input', renderList);

renderHead();
renderCard();
renderPairBall();
renderCompare();
renderLadder();
renderProfile();
renderRole();
renderList();
bindEditor();
renderPhotoControls();

store.subscribe(({ id }) => {
  if (id) updateMatch(id);
  else matchRows.forEach((r) => updateMatch(r.id));
});
onPortraitChange(() => {
  renderPhotoControls();
  // подпись «Фото появится…» у архивных игроков зависит от загруженного фото
  renderList();
});
// роль и «я» сменили здесь, в другой вкладке или страница вернулась кнопкой «Назад»
onIdChange(({ source }) => onIdentityChange(source === 'local' ? refocusSel : null));
