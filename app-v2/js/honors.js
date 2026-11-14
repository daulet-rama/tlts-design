// Признание сезона: рассказ из пяти страниц, листается вертикально.
// Обложка → «Гладиатор корта» → «Дуэт сезона» → ваш сезон → карточка «Поделиться».
// Все факты — из data.js: люди и сегодняшний день, прошлый сезон — D.PAST_SEASON; расчёты — honors.logic.js.
import { D, esc, avHtml, duoHtml, tileHtml, hydrate, playerHref, wheelPaging } from '../app.js';
import { isPublished, leadKind, togetherLine, setParts, plural, numWord } from './honors.logic.js';

const PS = D.PAST_SEASON;
const $ = (s, r = document) => r.querySelector(s);
const TOUR = Object.fromEntries(PS.tournaments.map((t) => [t.id, t]));
const YEAR = PS.year;
const N_TOURS = PS.tournaments.length;
const rankOf = (p) => D.rankLabel(p.rank);
const pl = (n, a, b, c) => `${n} ${plural(n, a, b, c)}`;

/* ---------- факты ---------- */

// Гладиатор корта: число тай-брейков и выигранных считается из его матчей
const glad = (() => {
  const g = PS.gladiator;
  const p = D.player(g.player);
  const list = g.tiebreaks.map((x) => ({ ...x, ...setParts(x.score, x.tb), tour: TOUR[x.t], court: D.court(x.court) }));
  const n = list.length;
  const won = list.filter((x) => x.won).length;
  const row = PS.tiebreakTable.find((r) => r.player === p.id);
  const lead = row ? leadKind(PS.tiebreakTable, row, (r) => [r.tiebreaks, r.won]) : 'below';
  const ok = isPublished(g) && !!row && row.tiebreaks === n && row.won === won && n <= g.matches;
  return { ...g, p, list, n, won, lead, ok };
})();

// Дуэт сезона и сегодняшний финал. «Вместе N-й турнир»: турниры сезона, турниры 2027 года до
// Июньского (PAST_SEASON.duo.before) и сегодняшний; матчи до финала — те же плюс сыгранные в июне.
// Матчей вместе за всё время — то же число, что у напарника в CAREER: иначе строку не показываем.
const duo = (() => {
  const d = PS.duo;
  const pair = D.pair(d.pair);
  const [a, b] = pair.players.map((id) => D.player(id));
  const season = d.season.length;
  const row = PS.duoTable.find((r) => r.pair === pair.id);
  const lead = row ? leadKind(PS.duoTable, row, (r) => [r.tournaments]) : 'below';
  const played = D.MATCHES.filter((m) => m.state === 'done' && m.pairs.includes(pair.id)).length;
  const next = D.MATCHES.find((m) => m.state !== 'done' && m.pairs.includes(pair.id)) || null;
  const tournamentNo = season + d.before.length + 1;
  const matchesBefore = d.matches + d.before.reduce((s, x) => s + x.matches, 0) + played;
  const career = (D.CAREER[a.id]?.mates || []).find(([id]) => id === b.id);
  const sameAsCareer = !career || career[1] === matchesBefore;
  const line = next && sameAsCareer ? togetherLine({ tournamentNo, matchesBefore }) : null;
  const ok = isPublished(d) && !!row && row.tournaments === season && season <= N_TOURS;
  return { ...d, pair, a, b, season, lead, next, line, tournamentNo, matchesBefore, since: TOUR[d.since], ok };
})();

// Ваш сезон: победы, поражения и точки — из записи по турнирам
const me = (() => {
  const m = PS.me;
  const p = D.player(m.player);
  const tours = m.tournaments.map((t) => ({ ...t, tour: TOUR[t.t], won: [...t.form].filter((c) => c === 'W').length }));
  const form = tours.map((t) => t.form).join('');
  const won = [...form].filter((c) => c === 'W').length;
  const best = tours.find((t) => t.final) || null;
  const byMate = {};
  tours.forEach((t) => { byMate[t.partner] = (byMate[t.partner] || 0) + 1; });
  const [mateId, mateTours] = Object.entries(byMate).sort((x, y) => y[1] - x[1])[0];
  return { p, tours, won, matches: form.length, best, mate: D.player(mateId), mateTours, tb: m.tiebreaks, tbWon: m.tiebreaksWon };
})();

const awards = [glad.ok, duo.ok].filter(Boolean).length;

/* ---------- кусочки разметки ---------- */

// «7:6⁵» — выиграл, «6⁴:7» — проиграл; маленькая цифра — очки тай-брейка у проигравшего
const scoreHtml = (x) => `<span class="num hn-score">${x.a}${x.supA != null ? `<sup>${x.supA}</sup>` : ''}<span aria-hidden="true">:</span>${x.b}${x.supB != null ? `<sup>${x.supB}</sup>` : ''}</span>`;
const dotsHtml = (form) => [...form].map((c) => `<i class="${c === 'W' ? 'w' : ''}"></i>`).join('');
// «побед в 17 матчах» (подпись к числу побед) — одна запись на «Ваш сезон» и на карточке
const winsIn = (won, n, cap = false) => `${plural(won, cap ? 'Победа' : 'победа', cap ? 'Победы' : 'победы', cap ? 'Побед' : 'побед')} в ${pl(n, 'матче', 'матчах', 'матчах')}`;

/* ---------- 1. обложка: награды стопкой, как карты в кошельке ---------- */

function renderCover() {
  const pass = (href, cls, attrs, cap, name, sub, face) => `<a class="hn-pass ${cls}" href="${href}"${attrs}><span class="grow"><span class="cap">${cap}</span><span class="strong ellipsis">${name}</span><span class="sub">${sub}</span></span>${face}</a>`;
  const lede = awards === 2 ? 'Две награды и ваш сезон' : awards === 1 ? 'Награда и ваш сезон' : 'Ваш сезон';
  $('#season').innerHTML = `
    <div class="hn-head">
      <span class="cap">${esc(D.LEAGUE.name)}</span>
      <span class="hero-num">${YEAR}</span>
      <h1 class="title">Признание сезона</h1>
      <p class="hn-lede">${lede}</p>
    </div>
    <nav class="hn-deck" aria-label="Награды и ваш сезон">
      ${glad.ok ? pass('#gladiator', 'hn-pass-glad', '', esc(glad.title), esc(glad.p.name), pl(glad.n, 'тай-брейк', 'тай-брейка', 'тай-брейков'), '<img class="hn-pass-photo" src="img/honors-d06.webp" alt="">') : ''}
      ${duo.ok ? pass('#duo', 'surface deep', ' data-surface="clay"', esc(duo.title), esc(D.pairName(duo.pair.id)), `${pl(duo.season, 'турнир', 'турнира', 'турниров')} вместе`, duoHtml(duo.pair.id, 'lg')) : ''}
      ${pass('#you', 'hn-pass-you', '', 'Ваш сезон', esc(me.p.name), pl(me.won, 'победа', 'победы', 'побед'), avHtml(me.p.id, 'lg'))}
    </nav>`;
}

/* ---------- 2. гладиатор корта ---------- */

function renderGladiator() {
  const g = glad;
  const host = $('#gladiator');
  if (!g.ok) { host.remove(); return; }
  const say = `${numWord(g.n)} ${plural(g.n, 'матч', 'матча', 'матчей')} сезона — до тай-брейка.${g.lead === 'alone' ? ' Больше — ни у кого в лиге.' : ''}`;
  const tile = (x) => `<li class="hn-tb${x.won ? ' won' : ''}" aria-label="${esc(`${x.tour.name}${x.stage ? ', ' + x.stage : ''}, ${D.courtLine(x.court.id)}: ${x.won ? 'выиграл' : 'проиграл'} ${x.a}:${x.b}`)}">
      <span class="hn-tb-top" aria-hidden="true"><span class="srf-dot" data-surface="${x.court.surface}"></span><span class="cap">${esc(x.tour.short)}${x.stage ? ' ' + esc(x.stage) : ''}</span></span>
      <span aria-hidden="true">${scoreHtml(x)}</span>
    </li>`;
  host.innerHTML = `
    <h2 class="vh">${esc(g.title)} ${YEAR}</h2>
    <a class="member hn-award" href="${playerHref(g.p.id)}" aria-label="${esc(`${g.title} ${YEAR}: ${g.p.name}, ${pl(g.n, 'тай-брейк', 'тай-брейка', 'тай-брейков')}, выиграно ${g.won}`)}">
      <img class="photo" src="img/honors-d06.webp" alt="">
      <div class="inner" aria-hidden="true">
        <div class="brand"><i data-icon="cup" style="display:contents"></i><span class="cap">${esc(g.title)} · ${YEAR}</span></div>
        <div class="name title">${esc(g.p.first)}<br>${esc(g.p.last)}</div>
        <div class="since cap">${esc(rankOf(g.p))}</div>
        <div class="lvl">
          <div>
            <div class="cap">${plural(g.n, 'Тай-брейк', 'Тай-брейка', 'Тай-брейков')}</div>
            <div class="hero-num tick">${g.n}</div>
          </div>
          <span class="rank">Выиграно ${g.won}</span>
        </div>
      </div>
    </a>
    <p class="hn-say">${esc(say)}</p>
    <ul class="hn-tbs" aria-label="Тай-брейки сезона">${g.list.map(tile).join('')}</ul>
    <p class="hn-who muted">Подтвердил директор, игрок согласен</p>`;
}

/* ---------- 3. дуэт сезона ---------- */

function renderDuo() {
  const d = duo;
  const host = $('#duo');
  if (!d.ok) { host.remove(); return; }
  // под картой — только то, чего на карте нет
  const say = d.lead === 'alone' ? (d.season === N_TOURS ? 'Так не сыграла больше ни одна пара.' : 'Больше — ни у одной пары.') : '';
  // строка афиши есть только с пяти матчей вместе (togetherLine); здесь она про пару этой страницы
  const today = d.next && d.line ? `
    <div class="hn-today">
      <span class="cap">Сегодня — их ${d.tournamentNo}-й турнир вместе</span>
      ${tileHtml(d.next)}
    </div>` : '';
  host.innerHTML = `
    <h2 class="vh">${esc(d.title)} ${YEAR}</h2>
    <article class="surface deep hn-duo-card" data-surface="clay" aria-label="${esc(`${d.title} ${YEAR}: ${d.a.name} и ${d.b.name}, ${d.season} из ${N_TOURS} турниров сезона вместе`)}">
      <div class="hn-duo-top" aria-hidden="true"><i data-icon="cup" style="display:contents"></i><span class="cap">${esc(d.title)} · ${YEAR}</span></div>
      <div class="hn-duo-num" aria-hidden="true"><span class="hero-num tick">${d.season}</span><span class="cap">из ${pl(N_TOURS, 'турнира', 'турниров', 'турниров')}<br>сезона — вместе</span></div>
      <div class="hn-duo-who" aria-hidden="true">${duoHtml(d.pair.id, 'lg')}<span class="hn-duo-names"><span class="strong">${esc(d.a.name)}</span><span class="strong">${esc(d.b.name)}</span></span></div>
      <div class="court-line" aria-hidden="true"></div>
    </article>
    ${say ? `<p class="hn-say">${esc(say)}</p>` : ''}
    <div class="card kv hn-kv">
      <div class="row"><span class="muted">Матчей вместе за сезон</span><span class="num">${d.matches}</span></div>
      <div class="row"><span class="muted">Вместе играют</span><span class="strong">с ${esc(d.since.monthGen)} ${YEAR}</span></div>
    </div>
    ${today}
    <p class="hn-who muted">Подтвердил директор, оба согласны</p>`;
}

/* ---------- 4. ваш сезон ---------- */

function renderYou() {
  const m = me;
  const say = m.best ? `${m.best.result} ${m.best.tour.gen} — и звание «${rankOf(m.p)}»` : `${pl(m.tours.length, 'турнир', 'турнира', 'турниров')} из ${N_TOURS}`;
  const row = (t) => `<div class="hn-trow${t.final ? ' best' : ''}">
      <span class="cap hn-trow-m">${esc(t.tour.short)}</span>
      <span class="grow"><span class="strong ellipsis">${esc(t.tour.name)}</span><span class="sub">${esc(t.result)}</span></span>
      <span class="hn-trow-dots" role="img" aria-label="${esc(`${pl(t.won, 'победа', 'победы', 'побед')} из ${t.form.length}`)}">${dotsHtml(t.form)}</span>
    </div>`;
  $('#you').innerHTML = `
    <div class="hn-head">
      <h2 class="cap">Ваш сезон · ${YEAR}</h2>
      <span class="hero-num tick">${m.won}</span>
      <span class="hn-unit cap">${winsIn(m.won, m.matches)}</span>
      <p class="hn-say">${esc(say)}</p>
    </div>
    <div class="card hn-tours">${m.tours.map(row).join('')}</div>
    <div class="card kv hn-kv">
      <div class="row"><span class="muted">Тай-брейки</span><span class="num">${m.tbWon} из ${m.tb}</span></div>
      <a class="row" href="${playerHref(m.mate.id)}">${avHtml(m.mate.id, 'sm')}<span class="grow"><span class="strong ellipsis">${esc(m.mate.name)}</span><span class="sub">Чаще всего в паре</span></span><span class="end">${pl(m.mateTours, 'турнир', 'турнира', 'турниров')}</span></a>
    </div>`;
}

/* ---------- 5. поделиться ---------- */

const shareText = () => `Мой сезон ${YEAR} в лиге «${D.LEAGUE.name}»: ${pl(me.matches, 'матч', 'матча', 'матчей')}, ${pl(me.won, 'победа', 'победы', 'побед')}${me.best ? `, ${me.best.result.toLowerCase()} ${me.best.tour.gen}` : ''}.`;
// ссылка без выбранной темы и без своего момента дня: у получателя свои (как у «Поделиться» основы)
const shareUrl = () => {
  const u = new URL(location.href);
  u.hash = '';
  ['theme', 'share', 'now'].forEach((k) => u.searchParams.delete(k));
  return u.href;
};

function renderShare() {
  const m = me;
  $('#share').innerHTML = `
    <h2 class="cap hn-share-cap">Карточка сезона</h2>
    <article class="member hn-card" aria-label="${esc(`Сезон ${YEAR}: ${m.p.name}, ${winsIn(m.won, m.matches)}, ${rankOf(m.p)}`)}">
      <img class="photo" src="img/d03.webp" alt="">
      <div class="inner" aria-hidden="true">
        <div class="brand"><i data-ball="glow"></i><span class="cap">${esc(D.LEAGUE.name)}</span></div>
        <div class="name title">${esc(m.p.first)}<br>${esc(m.p.last)}</div>
        <div class="since cap">Сезон ${YEAR}</div>
        <div class="lvl">
          <div>
            <div class="cap">${winsIn(m.won, m.matches, true)}</div>
            <div class="hero-num">${m.won}</div>
          </div>
          <span class="rank">${esc(rankOf(m.p))}</span>
        </div>
      </div>
    </article>
    <div class="hn-share-acts">
      <button class="btn main" type="button" id="hn-share-btn"><i data-icon="share" style="display:contents"></i><span>Поделиться</span></button>
      <p class="hn-share-note muted" id="hn-share-note" role="status" aria-live="polite"></p>
    </div>`;
  $('#hn-share-btn').addEventListener('click', share);
}

// Как «Поделиться» в основе: системное окно, где его нет — текст и ссылка в буфер
// (надпись на кнопке говорит, что скопировано), где и буфер закрыт — адрес текстом под кнопкой.
async function share() {
  const label = $('#hn-share-btn span');
  const note = $('#hn-share-note');
  const url = shareUrl();
  const text = shareText();
  note.textContent = '';
  try {
    if (navigator.share) { await navigator.share({ title: `Признание сезона ${YEAR}`, text, url }); return; }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    label.textContent = 'Ссылка скопирована';
    setTimeout(() => { label.textContent = 'Поделиться'; }, 2400);
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    note.textContent = url;
  }
}

/* ---------- ход рассказа ---------- */

function watchPages() {
  const pages = [...document.querySelectorAll('.hn-page')];
  const bars = [...document.querySelectorAll('.hn-bar i')];
  bars.forEach((b, i) => { b.hidden = i >= pages.length; });
  const where = $('#hn-where');
  // «Поделиться» вверху ведёт к карточке; на самой карточке его нет — там главная кнопка
  // (строка тогда «без действия справа», .navbar.no-action: гаснет и свет под кнопкой)
  const topShare = $('.hn-top [data-to-share]');
  const bar = $('.hn-top .navbar');
  let cur = -1;
  const seen = new Set();
  const set = (i) => {
    if (i === cur) return;
    cur = i;
    bars.forEach((b, k) => { b.className = k < i ? 'done' : k === i ? 'now' : ''; });
    where.textContent = `${i + 1} из ${pages.length}: ${pages[i].getAttribute('aria-label')}`;
    const onCard = pages[i].id === 'share';
    topShare.classList.toggle('hn-gone', onCard);
    topShare.toggleAttribute('inert', onCard);
    bar.classList.toggle('no-action', onCard);
    // большое число страницы мягко появляется при первом показе
    if (!seen.has(i)) {
      seen.add(i);
      pages[i].querySelectorAll('.hero-num.tick').forEach((el) => { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); });
    }
  };
  const pick = () => {
    const h = innerHeight;
    let best = 0, bestV = -1;
    pages.forEach((p, i) => {
      const r = p.getBoundingClientRect();
      const v = Math.min(r.bottom, h) - Math.max(r.top, 0);
      if (v > bestV) { bestV = v; best = i; }
    });
    set(best);
  };
  let busy = false;
  const ask = () => { if (!busy) { busy = true; requestAnimationFrame(() => { busy = false; pick(); }); } };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask);
  pick();
  // колесо и тачпад листают ровно на страницу (общая деталь основы)
  wheelPaging(pages, () => cur);
}

/* ---------- запуск ---------- */

renderCover();
renderGladiator();
renderDuo();
renderYou();
renderShare();
hydrate($('.app'));
watchPages();
