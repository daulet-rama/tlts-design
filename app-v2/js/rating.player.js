// Карточка другого игрока: членская карта, позвать в пару, матч сегодня, «подпись — значение»
// (место, баллы, титулы, встречи с вами, напарник) и сезон точками.
// Игрок — из адреса: player-other.html?p=p12. Без него — Максим Орлов, ваш напарник.
// Гость и вошедший (ответ сервера без me): нет «Позвать в пару» и «Встречи с вами»; Хван для них —
// такой же игрок лиги, его карта открывается здесь.
import { D, ME, isMe, avHtml, icon, tileHtml, hydrate, liveTiles, keepTheme, playerHref, shareSheet } from '../app.js';
import { season, todayMatch, titles, versusMe, mates, inviteState, corridorText, fmtK, plural } from './rating.logic.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n3 = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;

const asked = new URLSearchParams(location.search).get('p');
const pid = asked && D.player(asked) ? asked : 'p12';
const p = D.player(pid);
const me = ME ? D.player(ME.player) : null;
// снимок для карты: обрезанный под карточку (img/rating-…); у Хвана такого нет — его снимок карты «Я»
const cardPhoto = (x) => (x.portrait === 'd03' ? 'img/d03.webp' : `img/rating-${x.portrait}.webp`);

// себя не показываем здесь: ваша карта — «Я»
if (isMe(pid)) location.replace(keepTheme('player.html'));
else main();

function main() {
  document.title = `${p.name} · Теннисная лига`;

  // ---------- карта ----------
  const card = $('card');
  if (p.portrait) {
    const img = document.createElement('img');
    img.className = 'photo';
    img.src = cardPhoto(p);
    img.alt = p.name;
    card.prepend(img);
  } else {
    card.insertAdjacentHTML('afterbegin', `<span class="initials" aria-hidden="true">${D.initials(p)}</span>`);
  }
  $('name').innerHTML = `${esc(p.first)}<br>${esc(p.last)}`;
  $('since').textContent = `В лиге с ${p.since}`;
  $('kpr').textContent = p.kpr.toFixed(1);
  const rank = $('rank');
  rank.textContent = D.rankLabel(p.rank);
  rank.setAttribute('aria-label', `${D.rankLabel(p.rank)}: лестница званий`);

  // ---------- позвать в пару: то же состояние, что на экране напарника, и ссылка туда ----------
  // Само приглашение отправляется там (partner.html?p=…): одна проверка коридора, один путь.
  function renderAct() {
    const st = inviteState(pid);
    const T = st.T;
    const go = keepTheme(`partner.html?p=${pid}`);
    const where = st.c.where === 'above' ? 'выше' : 'ниже';
    let btn;
    let note;
    if (st.kind === 'ok') {
      btn = `<a class="btn main" href="${go}">${icon('plus')}<span>Позвать в пару</span></a>`;
      note = `${T.name} · сумма ${fmtK(st.c.sum)} в коридоре`;
    } else if (st.kind === 'off') {
      btn = `<a class="btn quiet" href="${go}">Позвать всё равно</a>`;
      note = `Сумма ${fmtK(st.c.sum)} ${where} коридора ${corridorText(st.corridor)}. Заявка уйдёт директору с пометкой «вне коридора»`;
    } else if (st.kind === 'in') {
      btn = `<a class="btn main" href="${go}">${icon('check')}<span>Ответить на приглашение</span></a>`;
      note = `Зовёт вас в пару · ${st.when}`;
    } else if (st.kind === 'out') {
      btn = `<a class="btn quiet" href="${go}">Вы позвали · ждём ответа</a>`;
      note = `${T.name} · отправлено ${st.when}`;
    } else if (st.kind === 'app') {
      btn = `<a class="btn quiet" href="${go}">Ваша пара на ${T.name}</a>`;
      note = st.out ? 'Заявка у директора с пометкой «вне коридора»: решает Совет' : 'Заявка у директора турнира, ждёт утверждения';
    } else {
      btn = `<button class="btn quiet" type="button" disabled>${icon('plus')}<span>Позвать в пару</span></button>`;
      note = `У вас уже есть заявка на этап: ${esc(me.last)} / ${esc(D.player(st.with).last)}`;
    }
    $('act').innerHTML = `${btn}<p class="po-note">${note}</p>`;
  }
  if (me) {
    renderAct();
    // вернулись с экрана напарника «Назад»: страница поднята из памяти браузера — состояние могло измениться
    addEventListener('pageshow', (e) => { if (e.persisted) renderAct(); });
  } else {
    // звать в пару некому: без me на карте нет действия
    $('act').remove();
  }

  // ---------- поделиться: та же карта ----------
  shareSheet({
    trigger: $('share'),
    title: 'Карта игрока',
    text: () => `${p.name} — ${D.LEAGUE.name}: КПР ${p.kpr.toFixed(1)}, «${D.rankLabel(p.rank)}», №${p.place} в рейтинге`,
    card: () => {
      const c = card.cloneNode(true);
      c.removeAttribute('id');
      c.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      const r = c.querySelector('a.rank');
      if (r) r.outerHTML = `<span class="rank">${esc(r.textContent)}</span>`;
      return c.outerHTML;
    },
  });

  // ---------- сегодня ----------
  const tm = todayMatch(pid);
  if (tm) {
    $('today-sec').hidden = false;
    $('today-cap').textContent = tm.state === 'live' ? 'Сейчас играет' : 'Сегодня';
    // плашка ведёт по состоянию матча и с его номером: match.html?m=…, match-soon.html?m=…
    $('today').innerHTML = tileHtml(tm);
    liveTiles($('today'));
  }

  // ---------- подпись — значение: место, баллы, титулы, встречи с вами, напарник ----------
  const kv = (label, value, sub = '') => `<div class="row"><span class="grow"><span class="muted">${label}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span>${value}</div>`;
  const num = (n) => `<span class="num${n ? '' : ' muted'}">${n}</span>`;
  const rowsHtml = [
    kv('Место в лиге', `<span class="num">№${p.place}</span>`),
    kv('Баллы', `<span class="num">${D.fmt(p.points)}</span>`),
  ];
  const t = titles(pid);
  if (t.wins) {
    const lastWin = t.won2027[t.won2027.length - 1];
    const sub = lastWin ? `${t.wins > 1 ? 'Последняя — ' : ''}${lastWin.name} ${D.SEASON.year}` : '';
    rowsHtml.push(kv('Победы на этапах', num(t.wins), sub));
  }
  if (t.cup) rowsHtml.push(kv('Победы в Итоговом турнире', num(t.cup)));
  if (t.second) rowsHtml.push(kv('Победы во второй категории', num(t.second)));
  if (t.finals || t.semis) {
    rowsHtml.push(kv('Финалы', num(t.finals)));
    rowsHtml.push(kv('Полуфиналы', num(t.semis)));
  } else {
    rowsHtml.push(kv('Турниров в лиге', num(t.tours), 'Пока без полуфиналов'));
  }

  // встречи с вами — одна строка: вы и он, счёт встреч справа; с напарником — сколько вместе.
  // Без me строки нет: встречаться не с кем
  const vs = me ? versusMe(pid) : null;
  if (vs) {
    const duo = `<span class="duo" aria-hidden="true">${avHtml(me.id, 'sm')}${avHtml(pid, 'sm')}</span>`;
    const who = (title, sub, end = '') => `<div class="row po-who">${duo}<span class="grow"><span class="strong">${title}</span><span class="sub">${sub}</span></span>${end}</div>`;
    if (vs.partner) {
      const together = ME.partners.find((x) => x.player === pid)?.together || 0;
      rowsHtml.push(who('Вы в паре', `${n3(together, 'матч', 'матча', 'матчей')} вместе`));
    } else if (!vs.won && !vs.lost) {
      rowsHtml.push(who('Встречи с вами', 'Ещё не встречались', '<span class="num muted">0–0</span>'));
    } else {
      const l = vs.last;
      // где — только турнир: «Кубок открытия, полуфинал» → «Кубок открытия»
      const sub = l ? `Последняя — вы ${l.won ? 'выиграли' : 'проиграли'} ${l.score}, ${esc(l.where.split(', ')[0])}` : '';
      rowsHtml.push(who('Встречи с вами', sub, `<span class="num">${vs.won}–${vs.lost}</span>`));
    }
  }

  // напарник — одна строка: чаще всего в паре; если вы в паре с ним, «вы» здесь не повторяетесь
  const partner = !!vs && vs.partner;
  const list = mates(pid).filter((x) => !(partner && isMe(x.id)));
  const mate = list[0];
  if (mate) {
    const m = D.player(mate.id);
    const label = partner ? 'Ещё в паре' : 'Чаще всего в паре';
    rowsHtml.push(`<a class="row po-who" href="${keepTheme(playerHref(m.id))}">${avHtml(m.id, 'sm')}`
      + `<span class="grow"><span class="strong ellipsis">${isMe(m.id) ? 'Вы · ' : ''}${esc(m.name)}</span><span class="sub">${label} · ${n3(mate.n, 'матч', 'матча', 'матчей')}</span></span>`
      + `<i data-icon="chev" class="go"></i></a>`);
  }
  $('kv').innerHTML = rowsHtml.join('');

  // ---------- сезон точками ----------
  const s = season(pid);
  $('wl').textContent = `${n3(s.won, 'победа', 'победы', 'побед')} · ${n3(s.lost, 'поражение', 'поражения', 'поражений')}`;
  const dots = $('dots');
  dots.setAttribute('role', 'img');
  dots.setAttribute('aria-label', `${n3(s.form.length, 'матч', 'матча', 'матчей')} сезона: ${n3(s.won, 'победа', 'победы', 'побед')}, ${n3(s.lost, 'поражение', 'поражения', 'поражений')}`);
  dots.innerHTML = s.form.map((x, i) => `<i class="${x === 'W' ? 'w' : ''}${i === s.form.length - 1 ? ' last' : ''}"></i>`).join('');
  $('last').textContent = s.say || 'Сезон ещё не начался';

  hydrate(document.querySelector('.app'));
}
