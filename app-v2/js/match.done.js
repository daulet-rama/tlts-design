// Матч сыгран. По умолчанию — ваш полуфинал (sf1), ?m=<id> — другой сыгранный матч.
// Итог, корт, время и длительность — из data.js; геймы, брейки и цифры — розыгрыш по очкам
// (pointLog из data.js через matchStory() основы). Розыгрыша нет — экран показывает только итог.
import { D, esc, avHtml, duoHtml, tileHtml, icon, hydrate, liveTiles, matchStory, segSpy, shareSheet, storyCard, brandHtml, metaLines } from '../app.js';
import * as X from './match.js';

const m = X.pickMatch('done', 'sf1');
const srf = X.surfaceOf(m);
const court = m.court ? D.court(m.court) : null;
const w = m.winner;
const story = matchStory(m);
const lines = m.pairs.map(D.pairLines);
const $ = (id) => document.getElementById(id);

// ---------- шапка ----------
document.querySelector('.court-head').dataset.surface = srf;
$('mx-title').innerHTML = `${esc(m.title)}<br>${court ? esc(D.courtLine(m.court)) : esc(D.TOURNAMENT.name)}`;
const when = m.day === D.TODAY.dayMonth ? (m.duration || 'сегодня') : m.day;
$('mx-state').textContent = `Сыгран · ${when}`;
$('mx-say').textContent = X.doneSay(m, story);
document.title = `${m.title} · ${D.pairName(m.pairs[0])} — ${D.pairName(m.pairs[1])}, ${D.setsText(m)} · Теннисная лига`;

// итог в той же раскладке, что счёт идущего матча: цифра, лица пары, фамилии; проигравшие тише
const games = m.sets.reduce((a, s) => [a[0] + s[0], a[1] + s[1]], [0, 0]);
const big = m.sets.length === 1 ? games : [0, 1].map((i) => m.sets.filter((s) => s[i] > s[1 - i]).length);
const side = (i) => `<div class="side ${i === w ? 'lead' : 'trail'}" data-side="${i}">
    <div class="hero-num"><span>${big[i]}</span></div>
    <div class="pair">${D.pair(m.pairs[i]).players.map((x) => avHtml(x)).join('')}</div>
    <div class="names">${lines[i].map(esc).join('<br>')}</div>
  </div>`;
$('mx-final').innerHTML = `${side(0)}<div class="mx-mid" aria-hidden="true"><i></i><i></i></div>${side(1)}`;
$('mx-final').setAttribute('role', 'img');
$('mx-final').setAttribute('aria-label', `${D.pairName(m.pairs[w])} выиграли ${D.setsText(m, w)}`);

// ---------- теннисная запись: у победителя галочка, у проигравшего тай-брейка — маленькая цифра ----------
const format = D.TOURNAMENT.format.split(',')[0];
$('mx-record').innerHTML = `<div class="record-head"><span class="cap">${esc(format)}</span>${m.sets.map((s, k) => `<span class="cap">${m.sets.length > 1 ? `${k + 1}-й` : 'Сет'}</span>`).join('')}</div>`
  + [0, 1].map((i) => `<div class="record-row${i === w ? ' win' : ' trail'}">
      <span class="who"><span class="n">${esc(D.pairName(m.pairs[i]))}</span>${i === w ? `<span class="mx-won" aria-hidden="true">${icon('check')}</span><span class="vh">, победа</span>` : ''}</span>
      ${m.sets.map(([a, b, tb]) => { const g = i ? b : a; const lost = i ? b < a : a < b; return `<span class="num">${g}${tb !== undefined && lost ? `<sup>${tb}</sup>` : ''}</span>`; }).join('')}
    </div>`).join('');

// ---------- ход сета и лента ----------
const ord = (n) => `${n}-м`;
if (story) {
  // ход сета: клетка у победителя гейма, брейк — цветом мяча; пара — два кружка
  const g13 = Math.max(13, story.games.length);
  let cells = '';
  [0, 1].forEach((i) => {
    cells += `<span class="mx-flow-who">${duoHtml(m.pairs[i], 'xs')}</span>`;
    for (let n = 0; n < g13; n++) {
      const g = story.games[n];
      cells += `<span class="cell${g && g.winner === i ? ` won${g.brk ? ' brk' : ''}` : ''}"></span>`;
    }
  });
  const grid = document.querySelector('#mx-flow .flow-grid');
  grid.innerHTML = cells;
  grid.setAttribute('role', 'img');
  grid.setAttribute('aria-label', story.games.map((g) => `гейм ${g.n}: ${D.pairName(m.pairs[g.winner])}${g.brk ? ', брейк' : ''}`).join('; '));
  const byPair = [0, 1].map((i) => story.games.filter((g) => g.brk && g.winner === i).map((g) => ord(g.n)));
  // «Брейки: Громов / Юсупов в 3-м гейме, Хван / Орлов в 8-м и 10-м»
  const say = [0, 1].filter((i) => byPair[i].length).sort((a, b) => parseInt(byPair[a][0], 10) - parseInt(byPair[b][0], 10)).map((i, k) => {
    const ns = byPair[i];
    const list = ns.length > 1 ? `${ns.slice(0, -1).join(', ')} и ${ns[ns.length - 1]}` : ns[0];
    return `${D.pairName(m.pairs[i])} в ${list}${k === 0 ? ' гейме' : ''}`;
  });
  document.querySelector('#mx-flow .flow-say').textContent = say.length ? `${byPair.flat().length > 1 ? 'Брейки' : 'Брейк'}: ${say.join(', ')}` : 'Все геймы на своей подаче';

  // хвост розыгрыша гейма: последние очки; не входит в строку — переносится на вторую
  // по очкам целиком, последнее (главное) очко не обрезается
  const trailHtml = (arr) => {
    const last = arr.slice(-4);
    const items = last.map((x, k) => (k === last.length - 1 ? `<b>${esc(x)}</b>` : `${esc(x)} ·`));
    return (arr.length > last.length ? '<span>…</span> ' : '') + items.map((x) => `<span>${x}</span>`).join(' ');
  };
  // минута гейма — доля сыгранных очков от длительности; у матча без длительности колонки нет
  const timed = story.games.some((g) => g.min);
  $('mx-feed').innerHTML = story.games.map((g) => {
    const tag = g.tb ? `Тай-брейк ${Math.max(...g.tb)}:${Math.min(...g.tb)}`
      : g.brk ? (g.last ? 'Брейк · сет' : 'Брейк')
      : g.saved ? `Спасли брейк-пойнт${g.saved > 1 ? 'ы' : ''}`
      : g.last ? 'Сет' : `Гейм ${g.n}`;
    return `<div class="ev${g.brk ? ' brk' : ''}${g.last ? ' set' : ''}" role="listitem">${timed ? `<span class="cap t">${g.min}′</span>` : ''}<span class="txt"><span class="tag">${tag}</span>${esc(D.pairName(m.pairs[g.winner]))}<span class="sub">${g.trail.length ? trailHtml(g.trail) : 'к нулю'}</span></span><span class="num sc">${g.score[0]}:${g.score[1]}</span></div>`;
  }).join('');
  $('mx-feed').setAttribute('role', 'list');
  $('mx-feed').classList.toggle('no-min', !timed);

  // ---------- цифры ----------
  const pct = (i) => Math.round((story.srvWon[i] / Math.max(1, story.srvPts[i])) * 100);
  const rows = [
    ['Очков выиграно', story.won[0], story.won[1], story.won[0], story.won[1]],
    ['На своей подаче', `${pct(0)}%`, `${pct(1)}%`, pct(0), pct(1)],
    ['Брейк-пойнты', `${story.bpWon[0]}/${story.bp[0]}`, `${story.bpWon[1]}/${story.bp[1]}`, story.bpWon[0], story.bpWon[1]],
    ['Геймов подряд', story.best[0], story.best[1], story.best[0], story.best[1]],
  ];
  const head = `<div class="mx-cmp-head" aria-hidden="true">${duoHtml(m.pairs[0], 'xs')}<span class="cap">${esc(lines[0][0])}</span><span class="cap r">${esc(lines[1][0])}</span>${duoHtml(m.pairs[1], 'xs')}</div>`;
  $('mx-stats').innerHTML = head + rows.map(([label, a, b, x, y]) => {
    const max = Math.max(x, y, 1);
    return `<div class="stat-row"><div class="stat-top"><span class="num">${a}</span><span class="cap">${label}</span><span class="num">${b}</span></div><div class="stat-bars" aria-hidden="true"><span><i class="${x > y ? 'more' : ''}" style="width:${(x / max) * 100}%"></i></span><span><i class="${y > x ? 'more' : ''}" style="width:${(y / max) * 100}%"></i></span></div></div>`;
  }).join('');
} else {
  // розыгрыша нет — честно: только итог. Ленты и цифр нет, переключать нечего.
  $('flow').hidden = true;
  $('feed').hidden = true;
  $('stats').hidden = true;
  $('mx-segbar').hidden = true;
  document.body.classList.add('mx-noseg');
  $('mx-only').textContent = `Судья внёс только итог: ${D.setsText(m, w)}`;
  $('mx-only').hidden = false;
}

// ---------- дальше: следующий матч каждой пары ----------
const nexts = [w, 1 - w].map((i) => X.nextMatchOf(m.pairs[i], m)).filter(Boolean)
  .filter((x, k, arr) => arr.indexOf(x) === k);
$('mx-next').innerHTML = nexts.map((x) => tileHtml(x)).join('');
$('next').hidden = !nexts.length;

// ---------- поделиться итогом: карточка 9:16 ----------
// победители — на верхней половине корта, счёт с их стороны — на сетке
const names = (i, cls = '') => `<span class="strong${cls}">${lines[i].map(esc).join('<br>')}</span>`;
const tb = m.sets[0][2];
shareSheet({
  trigger: $('mx-share'),
  title: 'Итог матча',
  text: `${D.TOURNAMENT.name}, ${m.title.toLowerCase()}: ${D.pairName(m.pairs[w])} — ${D.pairName(m.pairs[1 - w])}, ${D.setsText(m, w)}`,
  card: () => storyCard({
    surface: srf,
    label: `${m.title}: ${D.pairName(m.pairs[w])} обыграли ${X.pairGen(m.pairs[1 - w])}, ${D.setsText(m, w)}`,
    hole: { w: 112, h: 16 },
    zones: {
      top: brandHtml(),
      bt: duoHtml(m.pairs[w], 'sm'),
      st: names(w),
      net: `<span class="hero-num">${big[w]}:${big[1 - w]}${tb !== undefined ? `<sup>${tb}</sup>` : ''}</span>`,
      sb: names(1 - w, ' lose'),
      bb: duoHtml(m.pairs[1 - w], 'sm'),
      bottom: metaLines(m, [m.day]),
    },
  }),
});

['mx-final', 'mx-record', 'mx-flow', 'mx-stats', 'mx-next'].forEach((id) => hydrate($(id)));
liveTiles($('mx-next'));
if (story) segSpy(document.querySelector('.seg'));
