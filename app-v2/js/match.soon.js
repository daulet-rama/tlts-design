// Афиша матча: матч ещё не начался. По умолчанию — финал дня (D.ME.match), ?m=<id> — другой.
// Герой — время начала и корт; отсчёт идёт по общим часам мира (app.js).
// Пары на корте отмечает судья, на вызов игрок отвечает на экране вызова. Здесь до вызова —
// только «Напомнить о матче»; когда вашу пару вызвали — «Вас ждут на корте» и «Иду».
// Гость и вошедший (ответ сервера без me): «вашей» стороны нет — «Посев 4» вместо «Вы · посев 4»,
// «Последнюю выиграли …» вместо «Последняя встреча — ваша», вызова «Вас ждут на корте» нет.
import { D, ME, esc, duoHtml, avHtml, tileHtml, matchHref, hydrate, liveTiles, worldSec, clockText, playerHref, keepTheme, segSpy, shareSheet, storyCard, brandHtml, metaLines } from '../app.js';
import * as X from './match.js';

const m = X.pickMatch('soon', D.ME.match);
const court = D.court(m.court);
const srf = court.surface;
const me = ME ? m.pairs.indexOf(ME.pair) : -1;   // ваша сторона: 0, 1 или -1 (без me — -1)
const start = X.toMin(m.time) * 60;          // начало, секунды дня
// Вызов на корт: из журнала дня (data.js), а пока его не было — по программе, за 20 минут
// до начала (Кодекс: 20 минут на выход), как на экране вызова.
const logged = D.CALLS.find((c) => c.match === m.id);
const callAt = logged ? X.toMin(logged.at) * 60 : start - D.RULES.callLimit * 60;
const courtNo = court.name.replace(/\D/g, '');
const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* память закрыта — только на экране */ } },
};

// ---------- пары на этапе ----------
const paths = m.pairs.map((id) => X.pairPath(id, m));
const recs = paths.map(X.pairRecord);
const meet = X.meetingsOf(m);

function sayText() {
  const unbeaten = recs.map((r) => r.won > 0 && r.lost === 0);
  if (unbeaten[0] && unbeaten[1]) return 'Обе пары без поражений на этапе';
  if (unbeaten[0] || unbeaten[1]) return `${D.pairName(m.pairs[unbeaten[0] ? 0 : 1])} без поражений на этапе`;
  if (meet.record) return `Личные встречи ${meet.record[0]}–${meet.record[1]}`;
  if (recs[0].won === recs[1].won && recs[0].lost === recs[1].lost) return `У обеих пар ${recs[0].won}–${recs[0].lost} на этапе`;
  return `${D.pairName(m.pairs[0])} против ${X.pairGen(m.pairs[1])}`;
}

// ---------- шапка ----------
document.querySelector('.court-head').dataset.surface = srf;
$('mx-title').innerHTML = `${esc(m.title)}<br>${esc(D.TOURNAMENT.name)}`;
$('mx-say').textContent = sayText();
$('mx-time').textContent = m.time;
$('mx-court').textContent = court.name;
$('mx-court-sub').textContent = [court.note, D.SURFACES[srf].label].filter(Boolean).join(' · ');
$('mx-when-vh').textContent = `, ${court.name}, ${D.SURFACES[srf].label}`;
document.title = `${m.title} в ${m.time} · ${D.pairName(m.pairs[0])} — ${D.pairName(m.pairs[1])} · Теннисная лига`;

// ---------- карточки пар ----------
// С портретами — предмет с двумя фото; если портретов нет — низкая карточка: два кружка с инициалами.
const photos = m.pairs.every((id) => D.pair(id).players.every((x) => !!D.player(x).portrait));
function cardHtml(side) {
  const id = m.pairs[side];
  const pr = D.pair(id);
  const ps = pr.players.map(D.player);
  const kpr = ps.reduce((s, p) => s + p.kpr, 0);
  const form = paths[side].slice(-5);
  const wins = form.filter((r) => r.win).length;
  const link = (p, inner) => `<a href="${keepTheme(playerHref(p.id))}" aria-label="${esc(p.name)}, КПР ${p.kpr.toFixed(1)}">${inner}</a>`;
  const top = photos
    ? `<div class="mx-ph">${ps.map((p) => link(p, `<img src="${D.portraitSrc(p)}" alt="">`)).join('')}</div>`
    : `<div class="mx-avs">${ps.map((p) => link(p, avHtml(p.id, 'sm'))).join('')}</div>`;
  const who = side === me ? (pr.seed ? `Вы · посев ${pr.seed}` : 'Вы') : (pr.seed ? `Посев ${pr.seed}` : `Группа ${pr.group}`);
  const dots = form.map((r) => `<i class="${r.win ? 'w' : ''}"></i>`).join('');
  return `<article class="mx-card obj${photos ? '' : ' mx-low'}" aria-label="${esc(D.pairName(id))}">
    ${top}
    <div class="mx-cb">
      <span class="cap mx-who">${esc(who)}</span>
      <span class="strong mx-names">${ps.map((p) => `<span>${esc(p.last)} <span class="mx-k">${p.kpr.toFixed(1)}</span></span>`).join('')}</span>
      <span class="mx-lvl"><span class="num">${kpr.toFixed(1)}</span><span class="cap">КПР пары</span></span>
      <span class="mx-form" role="img" aria-label="Последние матчи: ${wins} ${X.plural(wins, 'победа', 'победы', 'побед')} из ${form.length}">${dots}<span class="cap">${form.length ? `${wins} из ${form.length}` : 'нет матчей'}</span></span>
    </div>
  </article>`;
}
$('mx-cards').innerHTML = cardHtml(0) + cardHtml(1);

// ---------- «Напомнить» и вызов на корт ----------
// До вызова единственное действие — тихий выключатель «Напомнить о матче»: за час до начала,
// а если час уже прошёл — за 10 минут. Когда вашу пару вызвали, внизу — «Вас ждут на корте»
// и главная кнопка «Иду»: она ведёт на экран вызова, где идёт отсчёт на выход.
const REMIND_KEY = `tl-remind:${m.id}`;
const remindAt = (t) => {
  const now = Math.floor(t / 60), s = start / 60;
  return s - 60 > now ? s - 60 : s - 10 > now ? s - 10 : null;
};
$('mx-act').innerHTML = `<div class="card kv mx-remind" id="mx-remind-card"><label class="row"><span class="grow"><span class="strong">Напомнить о матче</span><span class="sub" id="mx-remind-sub">&nbsp;</span></span><input class="switch" type="checkbox" id="mx-remind" aria-describedby="mx-remind-sub"></label></div>`;
const remind = $('mx-remind');
remind.checked = !!store.get(REMIND_KEY);
remind.addEventListener('change', () => {
  const at = remindAt(worldSec());
  store.set(REMIND_KEY, remind.checked && at !== null ? X.hhmm(at) : null);
});

let cta = null;
function callBar(on) {
  if (on && !cta) {
    cta = document.createElement('div');
    cta.className = 'cta mx-cta';
    cta.innerHTML = `<span class="wait">Вас ждут на корте ${esc(courtNo)}</span><a class="btn main" href="${keepTheme('call.html')}">Иду</a>`;
    document.querySelector('.app').append(cta);
  }
  if (cta) cta.hidden = !on;
  document.body.classList.toggle('mx-called', on);
}

// ---------- отсчёт ----------
const left = $('mx-left');
let shown = '';
function tick() {
  const t = worldSec();
  const d = start - t;
  left.textContent = d > 0 ? `Через ${clockText(Math.ceil(d - 1e-6))}` : 'Ждём начала';
  const called = me >= 0 && t >= callAt;
  const at = remindAt(t);
  const key = `${called}|${at}`;
  if (key !== shown) {
    shown = key;
    $('mx-remind-card').hidden = called || at === null;
    $('mx-remind-sub').textContent = at === null ? '' : `${at === start / 60 - 60 ? 'За час до начала' : 'За 10 минут до начала'}, в ${X.hhmm(at)}`;
    callBar(called);
  }
  setTimeout(tick, 1000 - Math.floor((t % 1) * 1000) + 20);
}
tick();

// ---------- личные встречи ----------
// Строка встречи: лица победителей, турнир, круг и когда, счёт со стороны левой пары.
// Круг и время переносятся целиком, без многоточия.
function h2hHtml() {
  const head = (text, sub) => `<div class="mx-h2h-head"><span class="num">${esc(text)}</span><span class="muted">${esc(sub)}</span></div>`;
  if (!meet.record) {
    // счёта встреч в данных нет: говорим только то, что видно по этапу
    const met = D.MATCHES.filter((x) => x.state === 'done' && m.pairs.every((id) => x.pairs.includes(id)));
    if (!met.length) return '<div class="row"><span class="grow muted">На этапе пары ещё не встречались</span></div>';
    return met.map((x) => `<a class="row" href="${keepTheme(matchHref(x))}">${duoHtml(x.pairs[x.winner], 'sm')}<span class="grow"><span class="strong ellipsis">${esc(x.title)}</span><span class="sub">${esc(x.day)}</span></span><span class="num">${esc(D.setsText(x, x.pairs.indexOf(m.pairs[0])))}</span></a>`).join('');
  }
  const [a, b] = meet.record;
  const lastW = meet.list.length ? meet.list[0].winner : null;
  const sub = lastW === null ? `Последняя — ${meet.last}` : lastW === me ? 'Последняя встреча — ваша' : `Последнюю выиграли ${D.pairName(m.pairs[lastW])}`;
  const rows = meet.list.length ? meet.list.map((x) => `<div class="row mx-meet" role="listitem" aria-label="${esc(`${x.tournament}, ${x.stage}, ${x.when}: выиграли ${D.pairName(m.pairs[x.winner])}, ${x.score}`)}">
      ${duoHtml(m.pairs[x.winner], 'sm')}
      <span class="grow" aria-hidden="true"><span class="strong ellipsis">${esc(x.tournament)}</span><span class="sub mx-parts"><span>${esc(X.upFirst(x.stage))} ·</span> <span>${esc(x.when)}</span></span></span>
      <span class="num" aria-hidden="true">${esc(x.score)}</span>
    </div>`).join('')
    : `<div class="row"><span class="grow muted">${esc(meet.last)}</span></div>`;
  return head(`${a}–${b}`, sub) + (meet.list.length ? `<div role="list">${rows}</div>` : rows);
}
$('mx-h2h').innerHTML = h2hHtml();

// ---------- пары по цифрам: как «Цифры» идущего матча ----------
function cmpHtml() {
  const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
  const kpr = m.pairs.map((id) => D.pair(id).players.reduce((s, x) => s + D.player(x).kpr, 0));
  const pts = m.pairs.map((id) => D.pair(id).players.reduce((s, x) => s + D.player(x).points, 0));
  const diff = recs.map((r) => r.gf - r.ga);
  const rows = [
    ['КПР пары', kpr[0].toFixed(1), kpr[1].toFixed(1), kpr[0], kpr[1]],
    ['Баллы рейтинга', D.fmt(pts[0]), D.fmt(pts[1]), pts[0], pts[1]],
    ['Победы на этапе', recs[0].won, recs[1].won, recs[0].won, recs[1].won],
    ['Разница геймов', signed(diff[0]), signed(diff[1]), diff[0], diff[1]],
  ];
  const top = `<div class="mx-cmp-head" aria-hidden="true">${duoHtml(m.pairs[0], 'xs')}<span class="cap">${esc(D.pairLines(m.pairs[0])[0])}</span><span class="cap r">${esc(D.pairLines(m.pairs[1])[0])}</span>${duoHtml(m.pairs[1], 'xs')}</div>`;
  return top + rows.map(([label, a, b, x, y]) => {
    const lo = Math.min(x, y, 0);
    const max = Math.max(x - lo, y - lo, 1);
    return `<div class="stat-row"><div class="stat-top"><span class="num">${a}</span><span class="cap">${label}</span><span class="num">${b}</span></div><div class="stat-bars" aria-hidden="true"><span><i class="${x > y ? 'more' : ''}" style="width:${((x - lo) / max) * 100}%"></i></span><span><i class="${y > x ? 'more' : ''}" style="width:${((y - lo) / max) * 100}%"></i></span></div></div>`;
  }).join('');
}
$('mx-cmp').innerHTML = cmpHtml();

// ---------- ещё сегодня ----------
const others = D.SCHEDULE.map(D.match).filter((x) => x.id !== m.id && x.state !== 'done');
$('mx-day').innerHTML = others.map((x) => tileHtml(x)).join('');
$('day').hidden = !others.length;

// ---------- поделиться афишей: карточка 9:16 ----------
// пары на своих половинах корта, время начала — на сетке
const names = (side) => `<span class="strong">${D.pairLines(m.pairs[side]).map(esc).join('<br>')}</span>`;
shareSheet({
  trigger: $('mx-share'),
  title: 'Афиша матча',
  text: `${D.TOURNAMENT.name}, ${m.title.toLowerCase()} · ${m.day}, ${m.time} · ${court.name} · ${D.pairName(m.pairs[0])} — ${D.pairName(m.pairs[1])}`,
  card: () => storyCard({
    surface: srf,
    label: `${m.title}, ${m.day}, ${m.time}, ${court.name}: ${D.pairName(m.pairs[0])} против ${X.pairGen(m.pairs[1])}`,
    hole: { w: 204, h: 92 },
    zones: {
      top: brandHtml(),
      bt: duoHtml(m.pairs[0], 'sm'),
      st: names(0),
      net: `<span class="hero-num">${m.time}</span>`,
      sb: names(1),
      bb: duoHtml(m.pairs[1], 'sm'),
      bottom: metaLines(m, [m.day, court.name.toLowerCase()]),
    },
  }),
});

['mx-cards', 'mx-h2h', 'mx-cmp', 'mx-day'].forEach((id) => hydrate($(id)));
liveTiles($('mx-day'));
segSpy(document.querySelector('.seg'));
