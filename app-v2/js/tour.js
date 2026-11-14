// Турниры (tournaments.html) и Турнир (tournament.html).
// Данные — только из общего мира data.js. Места в группе и «что вам нужно» считает tour.logic.js.
// Гость и вошедший (ответ сервера без me): нет «Вы в финале», «Ваш путь · …», «Что вам нужно»,
// «Почему так» и строки «ваша стадия»; над вкладками — общий вывод, как у сервера без me.
// Четвёртая вкладка «Фото» — альбом этапа (js/news.js): она есть, только когда альбом показан
// (?album=0 — альбом не показан, вкладок три, как раньше).
import {
  D, ME, esc, duoHtml, tileHtml, hydrate, liveTiles, icon, startLive, setTick, sheet, shareSheet, storyCard, brandHtml, metaLines,
} from '../app.js';
import { rankGroup, whatYouNeed, headToHead, fmtPct, plural, bracketTree, pairPath, winnerOf } from './tour.logic.js';
import { albumFor, mountAlbum } from './news.js';

const $ = (id) => document.getElementById(id);
const lower1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const upper1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const CUR = D.TOURNAMENTS.find((t) => t.state === 'live');        // идущий этап
const STAGES = D.SEASON.order.map((id) => D.tournament(id));      // этапы сезона по порядку
const stageNo = (t) => D.SEASON.order.indexOf(t.id) + 1;
const CUT = D.CUT;
// ваша пара и напарник — только в показе; без me их нет
const ME_PAIR = ME ? ME.pair : null;
const PARTNER = ME ? D.player(D.pair(ME_PAIR).players.find((x) => x !== ME.player)) : null;
const FINAL = D.match(D.BRACKET.f[0]);
const LIVE = D.MATCHES.find((m) => m.state === 'live');
const FIN_COURT = D.court(FINAL.court);
const FIN_WHEN = FINAL.day === D.TODAY.dayMonth ? 'сегодня' : FINAL.day;
const FIN_VS = `${D.pairName(FINAL.pairs[0])} — ${D.pairName(FINAL.pairs[1])}`;

// «Орлову»
const dat = (last) => (/(ов|ев|ёв|ин|ын)$/.test(last) ? `${last}у` : last);
// счёт матча глазами пары: её геймы первыми
const scoreFor = (m, pairId) => {
  const i = m.pairs.indexOf(pairId);
  return m.sets.map((s) => (i === 1 ? `${s[1]}:${s[0]}` : `${s[0]}:${s[1]}`)).join(' ');
};
const ORD = ['', 'первые', 'вторые', 'третьи', 'четвёртые'];
const ORD_PLACE = ['', 'первое', 'второе', 'третье', 'четвёртое'];
const NUM_F = ['ни одной', 'одна', 'две', 'три', 'четыре'];
const NUM_GEN = ['', 'одного', 'двух', 'трёх', 'четырёх'];
const winsWords = (n) => (n === 0 ? 'ни одной победы' : `${NUM_F[n] ?? n} ${plural(n, 'победа', 'победы', 'побед')}`);
const winsNum = (n) => `${n} ${plural(n, 'победа', 'победы', 'побед')}`;
const pairsNum = (n) => `${n} ${plural(n, 'пара', 'пары', 'пар')}`;

/* =========================================================
   ТУРНИРЫ
   ========================================================= */

function renderList() {
  // герой: идущий этап — предмет-корт цвета покрытия его финалов
  const hero = $('hero');
  const mine = !!ME_PAIR && FINAL.pairs.includes(ME_PAIR) && FINAL.state !== 'done';
  hero.dataset.surface = CUR.surface;
  hero.setAttribute('aria-label', `${CUR.name}, ${lower1(CUR.stage)} из ${STAGES.length}, ${CUR.dates}. Финал ${FIN_WHEN} в ${FINAL.time}${mine ? ', вы играете' : ''}. Открыть турнир`);
  hero.innerHTML = `
    <span class="st-top"><span class="cap">${esc(CUR.stage)} из ${STAGES.length}</span>${mine ? '<span class="pill glass">Вы в финале</span>' : ''}</span>
    <span class="title">${esc(CUR.name)}</span>
    <span class="muted st-meta">${esc(CUR.dates)} · ${pairsNum(CUR.pairs)}</span>
    <span class="st-final"><span class="cap">Финал ${FIN_WHEN} · ${esc(FIN_COURT.name)}</span><span class="hero-num">${esc(FINAL.time)}</span><span class="st-vs">${esc(FIN_VS)}</span></span>
    <span class="court-line" aria-hidden="true"></span>
    ${LIVE ? `<span class="st-now"><span class="dot"></span><span class="cap">Идёт · ${esc(lower1(LIVE.title))}</span><span class="num" data-live-score>${LIVE.games[0]}:${LIVE.games[1]}</span></span>` : ''}`;

  // живой счёт идущего матча: тот же розыгрыш и те же часы, что на «Сегодня»
  const sc = hero.querySelector('[data-live-score]');
  if (sc) startLive((s, v) => setTick(sc, `${v.games[0]}:${v.games[1]}`));

  // путь сезона: цвет покрытия — только у идущего этапа, остальные — плитка тоном
  $('season-cap').textContent = `Сезон ${D.SEASON.year} · ${D.LEAGUE.short}`;
  $('path').innerHTML = STAGES.map((t) => {
    const n = stageNo(t);
    const live = t.state === 'live';
    const tile = live
      ? `<span class="srf-tile" data-surface="${t.surface}" aria-hidden="true"><span class="num">${n}</span><span class="base"></span></span>`
      : `<span class="st-tile" aria-hidden="true"><span class="num">${n}</span><span class="base"></span></span>`;
    let sub = '';
    let extra = '';
    let href = '';
    if (t.state === 'done') {
      sub = `<span class="sub">${icon('cup')}<span class="n"><span class="vh">Чемпионы: </span>${esc(D.pairName(t.winner))}</span></span>`;
    } else if (live) {
      href = 'tournament.html';
      sub = `<span class="sub"><span class="dot"></span><span class="n">Идёт · финал в ${esc(FINAL.time)}</span></span>`;
    } else {
      // заявка открыта: путь к ней — поиск напарника на этот этап (свой, только в показе: без me
      // звать в пару некому — строка без перехода)
      href = ME ? 'partner.html' : '';
      sub = `<span class="sub"><span class="n">${esc(t.note)}</span></span>`;
      extra = `<span class="st-fill"><span class="st-slots" aria-hidden="true">${Array.from({ length: t.slots }, (_, k) => `<i${k < t.pairs ? ' class="on"' : ''}></i>`).join('')}</span><span class="cap">${t.pairs} из ${t.slots} пар</span></span>`;
    }
    const body = `${tile}<span class="grow"><span class="cap"><span class="vh">Этап ${n}, </span>${esc(t.dates)} · ${esc(D.SURFACES[t.surface].label)}</span><span class="strong ellipsis">${esc(t.name)}</span>${sub}${extra}</span>`;
    const row = href
      ? `<a class="st-row has-go" href="${href}">${body}<i class="go" aria-hidden="true">${icon('chev')}</i></a>`
      : `<div class="st-row">${body}</div>`;
    return `<li class="st-stage" data-state="${t.state}">${row}</li>`;
  }).join('');
  hydrate(document.querySelector('.app'));
}

/* =========================================================
   ТУРНИР
   ========================================================= */

// альбом идущего этапа — показан и не пуст; нет — нет и вкладки «Фото»
const ALBUM = albumFor(CUR.id);
const TABS = ['setka', 'gruppy', 'raspisanie', ...(ALBUM ? ['foto'] : [])];

function renderHead() {
  const head = $('head');
  head.dataset.surface = CUR.surface;
  $('head-cap').textContent = `${CUR.stage} из ${STAGES.length}`;
  const finCap = `Финал ${FIN_WHEN} · ${esc(FIN_COURT.name)}`;
  // большая шапка — на «Сетке»; на «Группах» и «Расписании» — название, даты и одна строка о финале.
  // Обе части в разметке; при смене вкладки одна сворачивается, другая разворачивается
  $('head-body').innerHTML = `
    <h1 class="title">${esc(CUR.name)}</h1>
    <span class="muted tp-meta">${esc(CUR.dates)} · ${pairsNum(CUR.pairs)} · ${esc(lower1(D.TOURNAMENT.category))}</span>
    <div class="tp-swap" data-part="big"><div><div class="tp-final">
      <span class="cap">${finCap}</span>
      <span class="hero-num">${esc(FINAL.time)}</span>
      <span class="tp-vs">${esc(FIN_VS)}</span>
    </div></div></div>
    <div class="tp-swap off" data-part="small" aria-hidden="true"><div><div class="tp-line">
      <span class="cap">${finCap}</span>
      <span class="num">${esc(FINAL.time)}</span>
    </div></div></div>`;

  // «Поделиться»: афиша финала карточкой 9:16 — системное окно или ссылка в буфер
  const names = (id) => `<span class="strong">${D.pairLines(id).map(esc).join('<br>')}</span>`;
  shareSheet({
    trigger: $('share'),
    title: CUR.name,
    text: () => `${CUR.name}: ${lower1(FINAL.title)} ${FIN_WHEN} в ${FINAL.time}, ${FIN_COURT.name.toLowerCase()}. ${FIN_VS}`,
    card: () => storyCard({
      surface: FIN_COURT.surface,
      label: `${FINAL.title} в ${FINAL.time}: ${FIN_VS}`,
      hole: { w: 204, h: 92 },
      zones: {
        top: brandHtml(),
        bt: duoHtml(FINAL.pairs[0], 'sm'),
        st: names(FINAL.pairs[0]),
        net: `<span class="hero-num">${esc(FINAL.time)}</span>`,
        sb: names(FINAL.pairs[1]),
        bb: duoHtml(FINAL.pairs[1], 'sm'),
        bottom: metaLines(FINAL, [FINAL.day, FIN_COURT.name.toLowerCase()]),
      },
    }),
  });
}

// instant — без анимации шапки (первый показ и переход, когда переключатель уже держится сверху)
function showTab(tab, write, instant) {
  if (!TABS.includes(tab)) tab = TABS[0];
  TABS.forEach((k) => { $(`pane-${k}`).hidden = k !== tab; });
  document.querySelectorAll('#tabs [data-tab]').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
  const small = tab !== 'setka';
  const head = $('head');
  if (instant) head.classList.add('instant');
  head.classList.toggle('compact', small);
  [['big', !small], ['small', small]].forEach(([part, on]) => {
    const el = head.querySelector(`[data-part="${part}"]`);
    el.classList.toggle('off', !on);
    el.setAttribute('aria-hidden', String(!on));
  });
  if (instant) { void head.offsetHeight; head.classList.remove('instant'); }
  if (write) history.replaceState(null, '', `${location.pathname}${location.search}#${tab}`);
  // четыре вкладки не вошли в строку (крупный шрифт) — переключатель листается вбок: выбранная видна целиком
  const bar = $('tabs');
  const cur = bar.querySelector(`[data-tab="${tab}"]`);
  if (cur && bar.scrollWidth > bar.clientWidth + 1) {
    const pad = parseFloat(getComputedStyle(bar).paddingLeft) || 0;
    const l = cur.offsetLeft - pad;
    const r = cur.offsetLeft + cur.offsetWidth + pad;
    if (l < bar.scrollLeft) bar.scrollLeft = l;
    else if (r > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = r - bar.clientWidth;
  }
}

/* ---------- фото ---------- */

// Вкладка «Фото»: ссылка последней в переключателе, панель после «Расписания». Стену альбома,
// тихую строку в конце и просмотр на весь экран собирает js/news.js; ?view=N#foto — сразу N-е фото.
function renderFoto() {
  if (!ALBUM) return;
  $('tabs').insertAdjacentHTML('beforeend', '<a href="#foto" data-tab="foto">Фото</a>');
  $('pane-raspisanie').insertAdjacentHTML('afterend', '<div class="tp-pane" id="pane-foto" aria-label="Фото" hidden></div>');
  mountAlbum($('pane-foto'), CUR.id);
}

/* ---------- сетка ---------- */

const ROUND_IN = { qf: 'в четвертьфинале', sf: 'в полуфинале', f: 'в финале' };
const ROUND_TO = { qf: 'четвертьфинала', sf: 'полуфинала', f: 'финала' };

// день матча: «Сегодня» или «18 июня»
const dayOf = (m) => (m.day === D.TODAY.dayMonth ? 'Сегодня' : m.day);
// когда играется круг: «18 июня», «Сегодня», «Сегодня · 20:00» (у будущего — время)
const whenOf = (m) => (m.state === 'soon' ? `${dayOf(m)} · ${m.time}` : dayOf(m));

// круги сетки из данных — от первого к финалу
const bracketRounds = () => D.TOURNAMENT.rounds
  .map((r) => ({ key: r.key, label: r.label, ids: D.BRACKET[r.key] || [] }))
  .filter((r) => r.ids.length);

// подпись круга в своей половине: один матч — его название («Полуфинал»), несколько — круг («Четвертьфиналы»)
const roundName = (b) => (b.ids.length === 1 ? D.match(b.ids[0]).title : b.label);

/**
 * Сетка — дерево из двух половин: верхняя сходится вниз, нижняя — вверх, финал в центре.
 * В половине круг — ряд матчей; под парой матчей — скобка к матчу следующего круга.
 * R — круги от первого к финалу (bracketRounds), path — путь вашей пары (pairPath).
 */
function bracketHtml(R, path) {
  const won = (ri, k) => path.steps.some((s) => s.r === ri && s.k === k && s.won === true);
  const early = R.slice(0, -1);
  const fin = D.match(R[R.length - 1].ids[0]);
  // половина h (0 — верхняя, 1 — нижняя): в каждом круге — свои матчи
  const half = (h) => early.map((r, ri) => {
    const n = r.ids.length / 2;
    return { ri, label: r.label, ids: r.ids.slice(h * n, (h + 1) * n), k0: h * n };
  });
  // пара прошла дальше из пары матчей j, j + 1 этого ряда
  const upFrom = (b, j) => won(b.ri, b.k0 + j) || won(b.ri, b.k0 + j + 1);

  const slot = (id) => {
    const me = D.match(id).pairs.indexOf(ME_PAIR);
    return `<div class="bk-slot"${me >= 0 ? ` data-me="${me}"` : ''}>${tileHtml(id, { slim: true })}</div>`;
  };
  const row = (b) => `<div class="bk-row" data-n="${b.ids.length}" style="--n:${b.ids.length}">${b.ids.map(slot).join('')}</div>`;
  // подпись круга над его рядом; сквозь неё проходят линии к матчам ряда (по одной на матч),
  // thru — какие из них на пути вашей пары (ярче); без линий — подпись первого или замыкающего ряда
  const label = (b, thru = []) => {
    const lines = thru.length ? `<span class="bk-lines" aria-hidden="true">${thru.map((on) => `<i${on ? ' class="on"' : ''}></i>`).join('')}</span>` : '';
    return `<div class="bk-label" data-thru="${thru.length}" style="--n:${b.ids.length}">${lines}<span class="cap">${esc(roundName(b))}</span><span class="cap">${esc(whenOf(D.match(b.ids[0])))}</span></div>`;
  };
  // скобка под парой матчей: две ножки и линия к следующему кругу; в нижней половине — перевёрнута
  const join = (b, flip) => {
    let u = '';
    for (let j = 0; j < b.ids.length; j += 2) {
      u += `<span class="bk-u"><i class="a0${won(b.ri, b.k0 + j) ? ' on' : ''}"></i><i class="a1${won(b.ri, b.k0 + j + 1) ? ' on' : ''}"></i><i class="st${upFrom(b, j) ? ' on' : ''}"></i></span>`;
    }
    return `<div class="bk-join${flip ? ' flip' : ''}" data-n="${b.ids.length}" style="--n:${b.ids.length / 2}" aria-hidden="true">${u}</div>`;
  };
  const stem = (b) => `<div class="bk-stem${won(b.ri, b.k0) ? ' on' : ''}" aria-hidden="true"></div>`;

  const top = half(0);
  const bot = half(1);
  // верхняя половина: подпись, ряд, скобка — и так до полуфинала; линии в подписи идут к матчам из скобки выше
  let up = '';
  top.forEach((b, i) => {
    up += i ? join(top[i - 1]) + label(b, b.ids.map((_, t) => upFrom(top[i - 1], 2 * t))) : label(b);
    up += row(b);
  });
  up += stem(top[top.length - 1]);
  // нижняя половина — зеркало верхней, к финалу снизу вверх. Подпись — тоже над своим рядом
  // (линии в ней идут от матчей ряда вверх), у последнего ряда — замыкающая, под ним
  let down = stem(bot[bot.length - 1]);
  for (let i = bot.length - 1; i >= 0; i -= 1) {
    const b = bot[i];
    down += i ? label(b, b.ids.map((_, t) => won(b.ri, b.k0 + t))) + row(b) + join(bot[i - 1], true) : row(b) + label(b);
  }

  // финал — предмет цвета своего корта (глубокий: мелкий текст посередине держит контраст);
  // внизу, за линией корта, — чемпионы
  const champ = winnerOf(fin);
  const meFin = fin.pairs.indexOf(ME_PAIR);
  const final = `<div class="bk-final surface deep" data-surface="${D.court(fin.court).surface}"${meFin >= 0 ? ` data-me="${meFin}"` : ''}>
      <div class="bk-fhead"><span class="title">${esc(fin.title)}</span><span class="cap">${esc(dayOf(fin))}</span></div>
      ${tileHtml(fin)}
      <span class="court-line" aria-hidden="true"></span>
      <div class="vb-champ bk-champ"><span class="cup" aria-hidden="true">${icon('cup')}</span><span class="grow"><span class="cap">Чемпионы этапа</span>${champ ? `<span class="strong ellipsis">${esc(D.pairName(champ))}</span>` : '<span class="strong">Определятся в финале</span>'}</span></div>
    </div>`;

  return `<div class="bk-tree">
    <div class="bk-half" role="group" aria-label="Верхняя половина сетки">${up}</div>
    ${final}
    <div class="bk-half" role="group" aria-label="Нижняя половина сетки">${down}</div>
  </div>`;
}

// сетка, которая не сходится в дерево (круги не делятся пополам) или шире 16 пар: круги списком
function roundsListHtml(R) {
  return R.map((r) => `<div class="bk-label"><span class="cap">${esc(r.label)}</span><span class="cap">${esc(whenOf(D.match(r.ids[0])))}</span></div>
    <div class="mt-list">${r.ids.map((id) => tileHtml(id, { slim: true })).join('')}</div>`).join('');
}

// Сетка заново из данных: при открытии и после смены данных (ход турнира, проверка на 4 и 16 парах)
export function renderBracket() {
  const box = $('pane-setka');
  const R = bracketRounds();
  if (!R.length) { box.innerHTML = ''; return; }
  const tree = bracketTree(R);
  const path = pairPath(R, D.match, ME_PAIR);
  const champ = winnerOf(FINAL);

  // вывод словами: путь пары (только в показе — у гостя пары нет)
  const wonMs = path.steps.filter((s) => s.won === true).map((s) => D.match(s.id));
  const pathText = wonMs.map((m) => `${scoreFor(m, ME_PAIR)} ${ROUND_IN[m.round]}`).join(', ');
  let title = '';
  let say = '';
  if (!ME_PAIR) {
    // без me — общий вывод, как у сервера: его заголовок «Сетка плей-офф» и есть заголовок доски,
    // поэтому отдельным блоком над доской он не стоит — строка под заголовком доски
  } else if (FINAL.pairs.includes(ME_PAIR) && FINAL.state !== 'done') {
    const rival = D.pair(FINAL.pairs.find((p) => p !== ME_PAIR));
    title = 'Вы в финале';
    say = `${upper1(pathText)}.${rival.seed ? ` Соперники — ${ORD[rival.seed]} сеяные.` : ''}`;
  } else if (champ === ME_PAIR) {
    title = 'Вы чемпионы этапа';
    say = `${upper1(pathText)}.`;
  } else if (path.end === 'out') {
    title = `Ваш путь: до ${ROUND_TO[D.match(path.steps[path.steps.length - 1].id).round]}`;
    say = pathText ? `${upper1(pathText)}.` : '';
  } else if (path.end === 'ahead') {
    title = `Дальше — ${lower1(D.match(path.steps[path.steps.length - 1].id).title)}`;
    say = pathText ? `${upper1(pathText)}.` : '';
  }
  // общий вывод сервера без me: чемпионы или кто в финале (пара не рвётся на две строки)
  const whole = (id) => D.pairName(id).replace(/ \/ /g, ' / ');
  const general = ME_PAIR ? ''
    : champ ? `Чемпионы этапа — ${whole(champ)}.`
      : FINAL.pairs.length === 2 ? `В финале — ${whole(FINAL.pairs[0])} и ${whole(FINAL.pairs[1])}.` : '';

  // матч за 3-е место — после сетки, отдельно от дерева
  const third = D.BRACKET.third ? D.match(D.BRACKET.third) : null;
  const thirdHtml = third ? `
    <div class="bk-third" role="group" aria-labelledby="third-cap">
      <div class="sec-head"><span class="cap" id="third-cap">${esc(third.title)}</span><span class="cap">${esc(dayOf(third))}</span></div>
      <p class="muted bk-from">Играют проигравшие в полуфиналах</p>
      ${tileHtml(third)}
    </div>` : '';

  box.innerHTML = `
    ${title ? `<section class="section lead-say">
      <span class="cap">Ваш путь · ${esc(D.pairName(ME_PAIR))}</span>
      <p class="title">${esc(title)}</p>
      ${say ? `<p class="muted">${esc(say)}</p>` : ''}
    </section>` : ''}
    <section class="bk" aria-labelledby="bk-title"${general ? ' aria-describedby="bk-say"' : ''}>
      <div class="bk-head"><h2 class="title" id="bk-title">Сетка плей-офф</h2><span class="cap">${pairsNum(R[0].ids.length * 2)}</span></div>${general ? `
      <p class="muted bk-from" id="bk-say" style="margin-top:-10px">${esc(general)}</p>` : ''}
      ${tree.ok && R[0].ids.length <= 8 ? bracketHtml(R, path) : roundsListHtml(R)}
      ${thirdHtml}
    </section>`;
  liveTiles(box);   // счёт идущего матча идёт и после повторной отрисовки
}

/* ---------- группы ---------- */

// Группа: пары, сыгранные матчи [i, j, геймы i, геймы j] и несыгранные [i, j]
function groupData(g) {
  const ids = D.PAIRS.filter((p) => p.group === g).map((p) => p.id);
  const ms = D.MATCHES.filter((m) => m.round === 'group' && m.group === g);
  const done = ms.filter((m) => m.state === 'done');
  const left = ms.filter((m) => m.state !== 'done');
  return {
    g,
    ids,
    all: done.map((m) => [ids.indexOf(m.pairs[0]), ids.indexOf(m.pairs[1]), m.sets[0][0], m.sets[0][1]]),
    left: left.map((m) => [ids.indexOf(m.pairs[0]), ids.indexOf(m.pairs[1])]),
    leftLive: left.some((m) => m.state === 'live'),
    leftDay: left.length ? left[0].day : null,
  };
}
const shortPair = (G, i) => D.pairName(G.ids[i]);
const scoreOf = (m, a) => (m[0] === a ? `${m[2]}:${m[3]}` : `${m[3]}:${m[2]}`);

function tieNote(G, r, t) {
  const n = t.members.length;
  const who = n === 2 ? 'Две пары' : `${upper1(NUM_F[n] || String(n))} пары`;
  const head = t.wins ? `${who} по ${t.wins} ${plural(t.wins, 'победе', 'победы', 'побед')}` : `${who} без побед`;
  let body = '';
  if (t.by === 'h2h') body = `решила личная встреча: ${shortPair(G, t.members[0])} — ${shortPair(G, t.members[1])} ${scoreOf(t.h2h, t.members[0])}.`;
  else if (t.by === 'pct') body = `решил процент выигранных геймов: ${t.members.map((i) => `${shortPair(G, i)} ${fmtPct(r.rows[i].pct)}`).join(' · ')}.`;
  else if (t.by === 'pending') body = 'пары ещё не встречались — место предварительное.';
  else body = 'место утвердит главный судья.';
  return `<p class="gt-note"><b>=</b> ${esc(head)}: ${esc(body)}</p>`;
}

function tableHtml(G, { compact = false } = {}) {
  const r = rankGroup(G.ids.length, G.all);
  const rows = r.order.map((i, k) => {
    const id = G.ids[i];
    const row = r.rows[i];
    const me = id === ME_PAIR;
    const tie = r.ties.find((t) => t.members.includes(i));
    const [a, b] = D.pairLines(id);
    const line = `<div class="gt-row${me ? ' me' : ''}${k >= CUT ? ' out' : ''}" role="row">
      <span class="num place" role="cell">${k + 1}${tie ? '<span class="vh"> поровну побед</span>' : ''}</span>
      <span role="cell" class="gt-pair">${duoHtml(id, 'xs')}<span class="gt-name strong">${me ? '<span class="vh">Вы: </span>' : ''}<span>${esc(a)}</span><span><span class="vh"> / </span>${esc(b)}</span></span></span>
      <span class="t-num gt-games" role="cell"><span class="vh">геймы </span>${row.gw}:${row.gl}</span>
      <span class="num wins" role="cell"><span class="vh">победы </span>${row.w}</span>
    </div>`;
    const cut = k === CUT - 1 && G.ids.length > CUT
      ? '<div class="gt-cut" role="separator" aria-label="Выше черты — плей-офф высшей категории, ниже — вторая категория"><span class="cap">↑ Высшая</span><span class="court-line" aria-hidden="true"></span><span class="cap">Вторая ↓</span></div>'
      : '';
    return line + cut;
  }).join('');
  const notes = r.ties.map((t) => tieNote(G, r, t)).join('');
  const head = '<div class="gt-row gt-head" aria-hidden="true"><span></span><span class="cap">Пара</span><span class="cap">Геймы</span><span class="cap">Победы</span></div>';
  return { html: `<div class="card gt${compact ? ' compact' : ''}" role="table" aria-label="Группа ${G.g}">${head}${rows}</div>${notes}`, r };
}

// «Почему так» после последнего матча группы: две-три строки с цифрами
function whyLines(G, r, me) {
  const row = r.rows[me];
  const place = r.place[me];
  const t = r.ties.find((x) => x.members.includes(me));
  const out = [];
  if (!t) {
    out.push(`${winsNum(row.w)} из ${row.played} — ${place === 1 ? 'больше всех в группе' : 'столько больше ни у кого в группе'}`);
  } else if (t.by === 'h2h') {
    const other = t.members.find((x) => x !== me);
    const h = headToHead(G.all, me, other);
    out.push(`${winsNum(row.w)} из ${row.played} — столько же у пары ${shortPair(G, other)}`);
    out.push(`Решила личная встреча: вы ${h.winner === me ? 'выиграли' : 'проиграли'} ${scoreOf(h.match, me)}`);
  } else if (t.by === 'pct') {
    const others = t.members.filter((x) => x !== me);
    out.push(`${winsNum(row.w)} из ${row.played} — столько же у пар ${others.map((x) => shortPair(G, x)).join(' и ')}`);
    out.push(`Решил процент геймов: ${t.members.map((x) => `${x === me ? 'у вас' : shortPair(G, x)} ${fmtPct(r.rows[x].pct)}`).join(', ')}`);
  } else {
    out.push(`${winsNum(row.w)} из ${row.played} — столько же у пары ${shortPair(G, t.members.find((x) => x !== me))}`);
  }
  out.push(`${place}-е место — плей-офф ${place <= CUT ? 'высшей' : 'второй'} категории`);
  return out;
}

// «Что вам нужно»: пока в группе есть несыгранные матчи и последний тур ещё не начался
function needLines(G, me) {
  const w = whatYouNeed(G.ids.length, G.all, G.left, me, CUT);
  if (!w.mine) return null;
  const best = w.byWins[0];
  return w.byWins.map((b) => {
    const label = w.mine === 1 ? (b.wins === 1 ? 'При победе' : 'При поражении') : `${upper1(winsWords(b.wins))} из ${NUM_GEN[w.mine] || w.mine}`;
    const one = b.places[0] === b.places[1];
    const placeTxt = one ? `${ORD_PLACE[b.places[0]]} место` : 'высшая категория';
    const same = b !== best && one && best.places[0] === best.places[1] && best.places[0] === b.places[0];
    let text;
    if (b.result === 'always') {
      if (b.by.has('h2h') && !b.by.has('wins')) {
        // у двух равных решают уже сыгранные личные встречи
        const beaten = G.all.filter((m) => (m[0] === me && m[2] > m[3]) || (m[1] === me && m[3] > m[2]));
        text = `${same ? `Тоже ${placeTxt}` : upper1(placeTxt)}: у двух равных решает личная встреча, а ваши — ${beaten.map((m) => scoreOf(m, me)).join(' и ')}.`;
      } else {
        text = `${upper1(placeTxt)} при любом исходе других матчей.`;
      }
    } else if (b.result === 'never') {
      text = 'Места 3–4 — вторая категория.';
    } else {
      text = `Всё решат ${b.on === 'games' ? 'проценты геймов: важен каждый гейм' : b.on === 'others' ? 'другие матчи группы' : 'другие матчи и проценты геймов'}.`;
    }
    return { label, text, result: b.result };
  });
}

// Вывод над группами без me — общий, как у сервера (groupsHeadlineGeneral): все сыграны,
// все впереди или групповой этап идёт; ниже — что даёт место.
function groupsGeneral(span) {
  const st = D.TOURNAMENT.groups.map((g) => { const x = groupData(g); return !x.left.length ? 'over' : x.all.length ? 'live' : 'ahead'; });
  const title = st.every((s) => s === 'over') ? 'Группы сыграны' : st.every((s) => s === 'ahead') ? 'Группы впереди' : 'Идёт групповой этап';
  return `<section class="section lead-say">
      <span class="cap">Группы · ${esc(span)}</span>
      <p class="title">${title}</p>
      <p class="muted">Места 1–${CUT} — плей-офф высшей категории, ниже — второй.</p>
    </section>`;
}

function renderGroups() {
  const box = $('pane-gruppy');
  // главная группа — ваша; без me — первая, как у сервера без me
  const myGroup = ME_PAIR ? D.pair(ME_PAIR).group : D.TOURNAMENT.groups[0];
  const G = groupData(myGroup);
  const me = ME_PAIR ? G.ids.indexOf(ME_PAIR) : -1;
  const { html, r } = tableHtml(G);
  const days = D.TOURNAMENT.groupDays;
  const span = `${days[0].split(' ')[0]}–${days[days.length - 1]}`;
  const over = !G.left.length;
  const need = me >= 0 && !over && !G.leftLive ? needLines(G, me) : null;
  const mark = { always: icon('check'), never: '–', depends: '?' };
  // вывод над группами: ваше место в группе; без me — общий
  let lead;
  if (me >= 0) {
    const place = r.place[me];
    const row = r.rows[me];
    const say = over
      ? `${upper1(winsWords(row.w))} из ${NUM_GEN[row.played] || row.played} — плей-офф ${place <= CUT ? 'высшей' : 'второй'} категории.`
      : `${upper1(winsWords(row.w))} из ${NUM_GEN[row.played] || row.played}. Впереди ещё ${G.left.length} ${plural(G.left.length, 'матч', 'матча', 'матчей')} группы.`;
    lead = `<section class="section lead-say">
      <span class="cap">Групповой этап · ${esc(span)}</span>
      <p class="title">${over ? 'Вы' : 'Пока вы'} ${ORD[place]} в группе ${G.g}</p>
      <p class="muted">${esc(say)}</p>
    </section>`;
  } else {
    lead = groupsGeneral(span);
  }

  box.innerHTML = `
    ${lead}

    <section class="section" aria-labelledby="gt-cap">
      <div class="sec-head"><span class="cap" id="gt-cap">Группа ${G.g}</span><button class="cap tap-area tp-how" type="button" id="how" aria-haspopup="dialog">${icon('info')}<span>Как считаются места</span></button></div>
      ${html}
    </section>

    ${need ? `<section class="section" aria-labelledby="need-cap">
      <div class="sec-head"><span class="cap" id="need-cap">Что вам нужно</span><span class="cap">${esc(G.leftDay || '')}</span></div>
      <ul class="card why">${need.map((l) => `<li><span class="mk${l.result === 'always' ? ' in' : ''}" aria-hidden="true">${mark[l.result]}</span><span class="txt"><span class="strong">${esc(l.label)}</span><span class="muted">${esc(l.text)}</span></span></li>`).join('')}</ul>
    </section>` : ''}

    ${D.TOURNAMENT.groups.filter((g) => g !== myGroup).map((g) => `
    <section class="section" aria-label="Группа ${g}">
      <div class="sec-head"><span class="cap">Группа ${g}</span></div>
      ${tableHtml(groupData(g), { compact: true }).html}
    </section>`).join('')}`;

  renderRules(G, r, me, over);
}

// Шторка «Как считаются места»: правило, «Почему так» для вашей группы, «Что даёт место»
function renderRules(G, r, me, over) {
  // «Почему так» и «ваша стадия» — про вашу пару; без me их нет, остаются правило и «Что даёт место»
  const why = over && me >= 0 ? whyLines(G, r, me) : [];
  const myStage = ME_PAIR && FINAL.pairs.includes(ME_PAIR) ? (FINAL.state === 'done' && FINAL.pairs[FINAL.winner] === ME_PAIR ? 'win' : 'f') : null;
  const ratio = D.STAGE_POINTS.map((p) => p.top / p.second);
  const times = `в ${Math.floor(Math.min(...ratio))}–${Math.round(Math.max(...ratio))} раз`;

  $('rules-lead').textContent = 'Места — по победам. У двух равных решает личная встреча, у трёх — процент геймов. Утверждает главный судья.';
  $('rules-body').innerHTML = `
    ${why.length ? `<section class="tp-sh" aria-labelledby="why-cap">
      <span class="cap" id="why-cap">Почему так · группа ${G.g}</span>
      <ol class="why" id="why-list">${why.map((l, k) => `<li><span class="mk t-num" aria-hidden="true">${k + 1}</span><span class="txt">${esc(l)}</span></li>`).join('')}</ol>
      <div class="why-foot"><button class="btn quiet small" type="button" id="send-why">${icon('send')}<span>Отправить ${esc(dat(PARTNER.last))}</span></button></div>
    </section>` : ''}
    <section class="tp-sh" aria-labelledby="pts-cap">
      <span class="cap" id="pts-cap">Что даёт место</span>
      <p class="pts-lead"><span class="strong">Второе и третье место — разные турниры</span><span class="muted">Места 1–${CUT} играют плей-офф высшей категории, ниже — второй. За ту же стадию там баллов ${times} меньше.</span></p>
      <div class="pts" role="table" aria-label="Баллы рейтинга за стадию плей-офф">
        <div class="pts-row head" role="row"><span class="cap" role="columnheader">Стадия</span><span class="cap" role="columnheader">Высшая</span><span class="cap" role="columnheader">Вторая</span></div>
        ${D.STAGE_POINTS.map((p) => `<div class="pts-row${p.key === myStage ? ' me' : ''}" role="row"><span role="cell">${esc(p.label)}${p.key === myStage ? '<span class="vh"> — ваша стадия</span>' : ''}</span><span class="t-num" role="cell">${p.top}</span><span class="t-num second" role="cell">${p.second}</span></div>`).join('')}
      </div>
    </section>`;

  const s = sheet($('rules'), $('rules-scrim'));
  $('how').addEventListener('click', (e) => s.open(e.currentTarget));
  $('rules-close').addEventListener('click', () => s.close());

  // «Отправить напарнику»: текст «Почему так» — системное окно, иначе буфер, иначе выделить текст
  const send = $('send-why');
  if (!send) return;
  const label = send.querySelector('span');
  const text = [`${CUR.name}, группа ${G.g}. Почему так:`, ...why.map((l, k) => `${k + 1}. ${l}.`)].join('\n');
  send.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(text);
      label.textContent = 'Текст скопирован';
    } catch {
      // буфер закрыт: текст выделен — его можно скопировать вручную
      const sel = getSelection();
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents($('why-list'));
      sel.addRange(range);
      label.textContent = 'Текст выделен';
    }
  });
}

/* ---------- расписание ---------- */

function renderSchedule() {
  const box = $('pane-raspisanie');
  const day = D.SCHEDULE.map((id) => D.match(id));
  const live = day.filter((m) => m.state === 'live');
  const soon = day.filter((m) => m.state === 'soon');
  const done = day.filter((m) => m.state === 'done');
  const title = live.length ? `Идёт матч ${lower1(live[0].title)}` : soon.length ? `Дальше — ${lower1(soon[0].title)}` : 'Все матчи дня сыграны';
  const next = soon.length ? `${live.length ? 'Дальше' : 'Потом'}: ${soon.map((m) => `${lower1(m.title)} в ${m.time}`).join(', ')}.` : '';
  const tiles = (ms) => ms.map((m) => tileHtml(m)).join('');
  // вход на пульт дня — только у директора турнира (?role=director)
  const director = new URLSearchParams(location.search).get('role') === 'director';

  box.innerHTML = `
    <section class="section lead-say">
      <span class="cap">${esc(D.TODAY.label)}</span>
      <p class="title">${esc(title)}</p>
      ${next ? `<p class="muted">${esc(next)}</p>` : ''}
    </section>
    ${live.length ? `<section class="section" aria-label="Идёт"><div class="mt-list">${tiles(live)}</div></section>` : ''}
    ${soon.length ? `<section class="section" aria-labelledby="soon-cap"><span class="cap" id="soon-cap">Дальше</span><div class="mt-list">${tiles(soon)}</div></section>` : ''}
    ${done.length ? `<section class="section" aria-label="Сыграно">
      <div class="card"><button class="row tp-fold" type="button" id="fold" aria-expanded="false" aria-controls="done-list">
        <span class="grow strong">Сыграно сегодня</span><span class="num">${done.length}</span>${icon('down')}
      </button></div>
      <div class="mt-list tp-done" id="done-list" hidden>${tiles(done)}</div>
    </section>` : ''}
    ${director ? `<section class="section"><div class="card"><a class="row" href="desk.html"><span class="grow"><span class="strong">Пульт дня</span><span class="sub">Корты, вызовы, программа</span></span><i class="go" aria-hidden="true">${icon('chev')}</i></a></div></section>` : ''}`;

  const fold = $('fold');
  if (fold) {
    fold.addEventListener('click', () => {
      const open = fold.getAttribute('aria-expanded') !== 'true';
      fold.setAttribute('aria-expanded', String(open));
      $('done-list').hidden = !open;
    });
  }
}

function renderTournament() {
  renderHead();
  renderBracket();
  renderGroups();
  renderSchedule();
  renderFoto();
  const tabs = $('tabs');
  const head = $('head');
  // переключатель прилипает, когда его верх доходит до 10 px; он лежит на краю шапки — половиной выше её низа
  const stickAt = () => Math.round(head.getBoundingClientRect().bottom + scrollY - tabs.offsetHeight / 2 - 10);
  tabs.addEventListener('click', (e) => {
    const a = e.target.closest('[data-tab]');
    if (!a) return;
    e.preventDefault();
    // если переключатель уже держится сверху — новый раздел открывается с начала, под ним
    const deep = scrollY > stickAt();
    showTab(a.dataset.tab, true, deep);
    if (deep) window.scrollTo(0, stickAt());
  });
  addEventListener('hashchange', () => showTab(location.hash.slice(1), false, true));
  showTab(location.hash.slice(1), false, true);
  const app = document.querySelector('.app');
  hydrate(app);
  liveTiles(app);
}

// Переход «Турниры» ↔ «Турнир» (tour.css, @view-transition): герой этапа раскрывается в шапку.
// Другие экраны перехода не заказывают — к ним уходим без него, иначе браузер прерывает переход с ошибкой.
addEventListener('pageswap', (e) => {
  const vt = e.viewTransition;
  if (!vt) return;
  vt.ready.catch(() => {});
  vt.finished.catch(() => {});
  const to = e.activation && e.activation.entry ? e.activation.entry.url : '';
  if (!/\/tournaments?\.html$/.test(to ? new URL(to).pathname : '')) vt.skipTransition();
});

const page = document.body.dataset.page;
if (page === 'tournaments') renderList();
if (page === 'tournament') renderTournament();
