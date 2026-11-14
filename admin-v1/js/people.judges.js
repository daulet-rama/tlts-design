// ============================================================
// «Судьи и доступ»: кто судит матчи дня, судьи следующего этапа заранее, роли в разделе организатора.
// judges.html — сегодня (19 июня, «Июньский кубок»); judges.html?t=jul-4 — «Июльский кубок» заранее;
// judges.html?v=roles — роли: кто что может, дать доступ, сменить роль, забрать доступ (видит только админ).
// Назначить — кнопкой и плитками; перетаскивания здесь нет.
// Сделанное — в общем состоянии (state), каждое действие — строкой журнала и с «Отменить»:
//   judges.<матч>              кто судит матч дня (его же читает «Сегодня»)
//   judgesKept.<матч>          накладку судьи оставили так
//   judgeDays.<турнир>.<корт>  судьи этапа заранее: { день: судья }
//   staff.<человек>            роль в разделе; null — доступ забрали
// ============================================================
import {
  D, esc, icon, toast, hydrate, fitText, previewPanel, whereHtml, confirmAction, openSheet, closeLayer, plural, matchName,
  dayWords, rangeShort, WD, dow, toMin, hhmm, gen, state, ROLE,
} from '../admin.js';
import {
  $, $$, person, allPeople, av, matches, nameOf, lastOf, genName, genFirst, genLast, kprText, markIn, qrSvg, pvCaption, live,
} from './people.js';
import { LINK_UNTIL, JULY, ROLE_TEXT } from './people.data.js';
import { matchNow, dayMatchesNow } from './tournament.data.js';

// Матчи дня — мир вместе со сделанным (перенос с «Расписания», введённый счёт с «Результатов»):
// те же, что на «Сегодня» и «Дне турнира». Сыгранный матч судьи больше не ждёт.
const DAY = () => dayMatchesNow();
const M = (id) => matchNow(id) || D.match(id);

const params = new URLSearchParams(location.search);
const head = $('#head');
const work = $('#work');
const view = params.get('v') === 'roles' ? 'roles' : params.get('t') === JULY.id ? 'july' : 'today';

// ---------- кто судит матчи сегодняшнего дня ----------
// judges.<матч>: id игрока или 'me'; null — судью сняли. Нет записи — как в мире:
// судья дня (D.JUDGE) судит свои четыре матча, у остальных судьи нет.
function judgeOf(mid) {
  const v = state.get(`judges.${mid}`);
  if (v !== undefined) return v;
  return D.JUDGE.matches.includes(mid) ? D.JUDGE.player : null;
}
function jm() { const J = {}; DAY().forEach((m) => { J[m.id] = judgeOf(m.id); }); return J; }
// накладки, которые организатор решил оставить: { матч: судья }
const kept = () => state.get('judgesKept', {});
// «Германа Хвана», «у Хвана», «у Германа»; «Вы» — «вас»
const genOf = (pid) => (pid === 'me' ? 'вас' : genName(person(pid)));
const genLastOf = (pid) => (pid === 'me' ? 'вас' : genLast(person(pid).last));
const genFirstOf = (pid) => (pid === 'me' ? 'вас' : genFirst(person(pid).first));
const courtName = (c) => D.COURTS[c].name;
const lowCourt = (c) => courtName(c).toLowerCase();
const onCourt = (c) => `на ${lowCourt(c).replace('корт', 'корте')}`;   // «на корте 3»
const untilWords = `до конца дня ${dayWords(LINK_UNTIL, { noWeekday: true })}`;
const SLOT = D.RULES.slot || 50;   // матч — около 50 минут, как круг в расписании
const REST = 30;                   // отдых перед своим матчем — как «мало отдыха» в расписании дня
const ends = (m) => (m.state === 'live' ? toMin(D.FORECAST[m.id] || m.time) : toMin(m.time) + SLOT);
// что делает игрок в день турнира относительно матча m: свободен ли он к началу
function busyFor(pid, m, J = jm()) {
  const t0 = toMin(m.time);
  const pair = D.pairOf(pid);
  const mine = pair ? DAY().filter((x) => x.pairs.includes(pair.id)) : [];
  const judging = Object.entries(J).filter(([id, w]) => w === pid && id !== m.id).map(([id]) => M(id)).filter((x) => x.state !== 'done');
  const clashJ = judging.find((x) => toMin(x.time) < t0 + SLOT && ends(x) > t0);
  if (clashJ) return { rank: 3, warn: true, s: `В это время судит ${matchName(clashJ.title)} ${onCourt(clashJ.court)}` };
  const lv = mine.find((x) => x.state === 'live');
  const soon = mine.filter((x) => x.state === 'soon').sort((a, b) => toMin(a.time) - toMin(b.time));
  const near = soon.find((x) => toMin(x.time) < t0 + SLOT + REST && ends(x) > t0 - 10);
  if (near) return { rank: 3, warn: true, s: `Сам играет ${matchName(near.title)} в ${near.time}` };
  if (lv) {
    return ends(lv) <= t0 - 10
      ? { rank: 1, s: `Играет сейчас ${onCourt(lv.court)}, закончит около ${hhmm(ends(lv))} — успевает` }
      : { rank: 3, warn: true, s: `Играет сейчас, закончит около ${hhmm(ends(lv))}` };
  }
  if (soon.length) return { rank: 2, s: `Сам играет в ${soon[0].time}` };
  if (mine.length) return { rank: 0, s: 'Сегодня отыграл, свободен' };
  return { rank: 2, s: 'Сегодня не играет' };
}
// накладки у назначенного судьи — словами, как их скажет человек:
// «В 19:00 Хван ещё на корте 3: там матч идёт примерно до 19:05», «В 20:00 Хван сам играет финал»
function clashes(m, J = jm()) {
  const pid = J[m.id];
  if (!pid || m.state === 'done') return [];
  const t0 = toMin(m.time); const last = lastOf(pid); const out = [];
  Object.entries(J).forEach(([id, w]) => {
    if (w !== pid || id === m.id) return;
    const o = M(id);
    if (o.state !== 'done' && toMin(o.time) < t0 && ends(o) > t0) out.push(`В ${m.time} ${last} ещё ${onCourt(o.court)}: там матч идёт ${o.state === 'live' ? 'примерно ' : ''}до ${hhmm(ends(o))}`);
  });
  const pair = D.pairOf(pid);
  if (pair) {
    DAY().filter((x) => x.pairs.includes(pair.id) && x.state !== 'done' && x.id !== m.id).forEach((x) => {
      if (toMin(x.time) < ends(m) + REST && ends(x) > t0) out.push(`В ${x.time} ${last} сам играет ${matchName(x.title)}`);
    });
  }
  return out;
}
const isKept = (m, J = jm()) => kept()[m.id] && kept()[m.id] === J[m.id];

// ============================================================
if (view === 'roles') roles();
else if (view === 'july') july();
else today();

// ---------- шапка раздела: две вкладки ----------
function tabs(active) { return `<nav class="seg pp-tabs" aria-label="Судьи и доступ"><a href="judges.html"${active === 'judges' ? ' aria-current="true"' : ''}>${icon('board')}Судьи</a><a href="judges.html?v=roles"${active === 'roles' ? ' aria-current="true"' : ''}>${icon('key')}Роли и доступ</a></nav>`; }

// ============================================================
// СЕГОДНЯ: корты дня, матчи и кто их судит
// ============================================================
function today() {
  document.title = 'Судьи · Раздел организатора';
  let shownJudge = D.JUDGE.player;   // чей экран в рамке телефона
  let fresh = false;                 // только что назначили — в рамке метка «Новое»

  // сделанное здесь, после «Отменить» или в другой вкладке — экран перерисуется сам
  const draw = live(['judges', 'judgesKept', 'judgeDays', 'scores', 'moves'], () => {
    const J = jm();
    // в рамке — экран того, кто сейчас судит: судью сняли — показываем другого
    const judgesNow = [...new Set(Object.values(J).filter(Boolean))];
    if (!judgesNow.includes(shownJudge)) shownJudge = judgesNow.includes(D.JUDGE.player) ? D.JUDGE.player : judgesNow[0] || null;
    const left = DAY().filter((m) => m.state !== 'done').sort((a, b) => toMin(a.time) - toMin(b.time));
    // главное дело экрана — самый ранний матч без судьи (как первое дело на «Сегодня»);
    // судьи есть везде — самый ранний, где у судьи накладка. Замена — тихой кнопкой в строке матча
    const first = left.find((m) => !J[m.id]) || left.find((m) => clashes(m, J).length && !isKept(m, J));
    const firstCur = first && J[first.id];
    head.innerHTML = `<div class="head-row"><h1 class="h1">Судьи и доступ</h1>${tabs('judges')}
      ${first ? `<div class="head-act"><p class="who-sees">${icon('eye')}<span>${firstCur ? `Матч появится у нового судьи и пропадёт у ${esc(genLastOf(firstCur))}` : `Судья увидит ${esc(matchName(first.title))} у себя в приложении`}</span></p><button class="btn main" type="button" data-assign="${first.id}">${icon(firstCur ? 'user' : 'plus')}${firstCur ? `Заменить судью: ${esc(matchName(first.title))}` : `Назначить судью на ${esc(matchName(first.title))}`}</button></div>` : ''}</div>`;

    const played = DAY().filter((m) => m.state === 'done').length;
    const courts = Object.keys(D.COURTS).map((c) => {
      const all = DAY().filter((m) => m.court === c);
      const rest = all.filter((m) => m.state !== 'done').sort((a, b) => toMin(a.time) - toMin(b.time));
      const need = rest.some((m) => !J[m.id] || (clashes(m, J).length && !isKept(m, J)));
      const ms = rest.length ? rest.map((m) => {
        const w = J[m.id];
        const top = m.state === 'live'
          ? `<span class="tag live"><span>Идёт · <span class="num">${m.games.join(':')}</span></span></span><span>${esc(m.title)}</span>`
          : `<span class="num">${esc(m.time)}</span><span>${esc(m.title)}</span>`;
        const judge = w
          ? `<span class="jn">${av(w)}<span><span class="jl">Судья</span>${esc(nameOf(w))}</span></span><button class="btn quiet" type="button" data-assign="${m.id}">${icon('user')}Заменить</button>`
          : `<span class="tag bad">Судьи нет</span><button class="btn quiet" type="button" data-assign="${m.id}">${icon('plus')}Назначить судью</button>`;
        const cl = clashes(m, J);
        const ok = cl.length && isKept(m, J);
        const clash = cl.length ? `<div class="pp-clash${ok ? ' kept' : ''}" role="note">${cl.map((t) => `<p>${icon(ok ? 'info' : 'alert')}<span>${esc(t)}</span></p>`).join('')}${ok ? '<p class="k">Оставили так</p>' : `<button class="btn text" type="button" data-keep="${m.id}">Оставить так</button>`}</div>` : '';
        return `<div class="pp-m"><div class="what"><span class="top">${top}</span><span class="prs fit">${esc(D.pairName(m.pairs[0]))}</span><span class="prs fit">${esc(D.pairName(m.pairs[1]))}</span></div><div class="judge">${judge}</div>${clash}</div>`;
      }).join('') : `<p class="none">${all.length ? 'Матчи на сегодня сыграны' : 'Сегодня матчей нет'}</p>`;
      const x = D.COURTS[c];
      return `<li class="pp-court${need ? ' need' : ''}${rest.length ? '' : ' quiet'}" data-srf="${x.surface}"><div class="cn"><b>${esc(x.name)}${x.note ? ` · ${esc(x.note)}` : ''}</b><span>${esc(D.SURFACES[x.surface].label)}</span></div><div class="ms">${ms}</div></li>`;
    }).join('');

    // ссылки судей: кто, сколько матчей, что делает сейчас
    const byJudge = {};
    Object.entries(J).forEach(([mid, w]) => { if (w) (byJudge[w] = byJudge[w] || []).push(M(mid)); });
    const links = Object.entries(byJudge).map(([w, list]) => {
      const cs = [...new Set(list.map((m) => m.court.slice(1)))].sort();
      const sub = `${list.length} ${plural(list.length, 'матч', 'матча', 'матчей')} · ${cs.length > 1 ? 'корты' : 'корт'} ${cs.join(', ')}`;
      const lv = list.find((m) => m.state === 'live');
      const last = lv ? `Сейчас ведёт счёт ${onCourt(lv.court)}` : w === D.JUDGE.player ? 'Сегодня уже вёл счёт' : 'Ещё не заходил';
      return `<li class="row"><span>${av(w, 'pp56')}</span><span class="grow"><span class="t">${esc(nameOf(w))}</span><span class="s">${esc(sub)}</span><span class="s"><b>${esc(last)}</b></span></span><span class="acts"><button class="btn quiet${w === shownJudge ? ' shown' : ''}" type="button" data-show="${w}">${icon('phone')}Экран судьи</button><button class="btn quiet" type="button" data-revoke="${w}">Отозвать ссылку</button></span></li>`;
    }).join('');
    const jul = state.get(`judgeDays.${JULY.id}`, {});
    const julN = Object.values(jul).reduce((n, d) => n + Object.values(d || {}).filter(Boolean).length, 0);

    work.innerHTML = `<div class="with-preview">
      <div class="pp-form">
        <div class="line pp-pv-line"><button class="btn quiet preview-open" type="button">${icon('eye')}Посмотреть, как увидит судья</button></div>
        <div class="pp-day-title"><h2 class="h2">${esc(dayWords(D.NOW.iso, { cap: true }))} · сегодня</h2><span class="strong">«${esc(D.TOURNAMENT.name)}» · сыграно ${played} из ${DAY().length}</span></div>
        <ul class="pp-courts" aria-label="Корты сегодня">${courts}</ul>
        <section class="pp-card" aria-labelledby="h-links"><h2 class="h2" id="h-links">Ссылки судей <span class="pp-sub small">действуют ${esc(untilWords)}</span></h2>
          ${links ? `<ul class="list pp-links">${links}</ul>` : '<p class="muted">Ссылок нет. Назначьте судью — он сразу получит ссылку на пульт</p>'}
        </section>
        <ul class="list pp-list" aria-label="Дальше"><li><a class="row" href="judges.html?t=${JULY.id}"><span class="av pp56" aria-hidden="true">${icon('calendar')}</span><span class="grow"><span class="t">Судьи «${esc(gen(JULY.name))}»</span><span class="s">${esc(rangeShort(JULY.from, JULY.to))} · ${julN ? `назначено ${julN} из ${JULY.courts.length * JULY.play.length}` : 'судей пока нет'}</span></span>${icon('chev', 'go')}</a></li></ul>
        ${whereHtml([
    { icon: 'phone', b: 'Телефон судьи', s: '«Судья · Мои матчи»: его матчи, корт и время' },
    { icon: 'board', b: 'Сайт, приложение и табло в клубе', s: 'счёт, который ведёт судья, — сразу' },
  ])}
      </div>
      <aside class="preview-col" id="pv" aria-label="Так увидит судья"></aside>
    </div>`;
    hydrate(head); hydrate(work);
    drawPv();
    requestAnimationFrame(() => fitText(work));
  });

  // ---------- вид у судьи: «Мои матчи» в приложении ----------
  function drawPv() {
    const J = jm();
    const judges = [...new Set(Object.values(J).filter(Boolean))];
    if (!judges.includes(shownJudge)) shownJudge = judges.includes(D.JUDGE.player) ? D.JUDGE.player : judges[0] || null;
    if (!shownJudge) {
      $('#pv').innerHTML = `<div class="empty"><span class="ic">${icon('phone')}</span><p>Сегодня судей нет. Назначьте судью — здесь появится его экран</p></div>`;
      return;
    }
    const mine = Object.entries(J).filter(([, w]) => w === shownJudge).map(([mid]) => M(mid));
    const isBase = shownJudge === D.JUDGE.player;
    const same = isBase && D.JUDGE.matches.every((mid) => J[mid] === shownJudge) && mine.length === D.JUDGE.matches.length;
    previewPanel($('#pv'), {
      app: {
        page: 'judge-list.html', title: 'Приложение: судья, мои матчи',
        patch: (doc) => { if (!same) patchJudge(doc, mine); if (fresh) markIn(doc.querySelector('#next .jd-ticket'), 'Новое'); },
      },
      banner: shownJudge === 'me' ? 'Так видите вы — судья' : `Так видит судья ${nameOf(shownJudge)}`,
    });
    pvCaption('Так это увидит судья');
  }
  // «Мои матчи» другого судьи: ближайший матч крупно; чужие матчи убираем
  function patchJudge(doc, mine) {
    const keep = new Set(mine.map((m) => m.id));
    doc.querySelectorAll('[data-match]').forEach((x) => { if (!keep.has(x.dataset.match)) x.remove(); });
    ['#later', '#sent'].forEach((s) => { const sec = doc.querySelector(s); if (sec && !sec.querySelector('[data-match]')) sec.hidden = true; });
    const hero = mine.find((m) => m.state === 'live') || mine.filter((m) => m.state === 'soon').sort((a, b) => toMin(a.time) - toMin(b.time))[0];
    const art = doc.querySelector('#next .jd-ticket');
    if (!art) return;
    if (!hero) { doc.querySelector('#next').innerHTML = '<div class="card empty"><span class="strong">Матчей нет</span></div>'; return; }
    if (hero.state === 'live' && hero.id === 'third') return; // идущий матч уже на экране
    const c = D.COURTS[hero.court];
    art.dataset.surface = c.surface;
    art.setAttribute('aria-label', `${hero.title}, ${D.courtLine(hero.court)}, ${hero.time}`);
    const top = art.querySelector('.jd-ticket-top'); if (top) top.innerHTML = `<span class="cap">${esc(D.courtLine(hero.court))}</span>`;
    const cap = art.querySelector('.jd-who .cap'); if (cap) cap.textContent = hero.title;
    [0, 1].forEach((side) => {
      const row = art.querySelector(`.jd-pair[data-side="${side}"]`); if (!row) return;
      row.classList.remove('srv');
      const nm = row.querySelector('.strong'); if (nm) nm.textContent = D.pairName(hero.pairs[side]);
      const duo = row.querySelector('.duo');
      if (duo) duo.innerHTML = D.pair(hero.pairs[side]).players.map((x) => { const q = D.player(x); return q.portrait ? `<span class="av sm"><img class="face" src="img/${q.portrait}-sm.webp" alt=""></span>` : `<span class="av sm" aria-hidden="true">${esc(D.initials(q))}</span>`; }).join('');
    });
    const big = art.querySelector('.jd-big'); if (big) big.innerHTML = `<span class="hero-num">${esc(hero.time)}</span>`;
    const say = art.querySelector('.jd-say'); if (say) say.textContent = 'Ждём обе пары';
    const go = doc.querySelector('#next .jd-go'); if (go) { const svg = go.querySelector('svg'); go.textContent = 'Начать'; if (svg) go.prepend(svg); }
  }

  // ---------- назначить или заменить судью: человек плитками ----------
  function assign(mid) {
    const m = M(mid);
    // счёт уже записан (здесь, на «Результатах» или в другой вкладке) — судья этому матчу не нужен
    if (m.state === 'done') { const w = matchName(m.title); toast(`${w.charAt(0).toUpperCase()}${w.slice(1)} уже сыгран: судья не нужен`); draw(); return; }
    const J = jm();
    const cur = J[mid];
    const inMatch = new Set(m.pairs.flatMap((x) => D.pair(x).players));
    const cand = allPeople().filter((p) => !inMatch.has(p.id) && p.id !== cur && D.player(p.id))
      .map((p) => ({ p, b: busyFor(p.id, m, J) }))
      .sort((a, b) => a.b.rank - b.b.rank || (a.p.place || 99) - (b.p.place || 99));
    const top = cand.slice(0, 6);
    let pick = null;
    const tile = ({ p, b }) => `<button type="button" class="choice pp-who" role="radio" aria-checked="false" data-value="${p.id}"><span class="t">${av(p.id)}<span class="nm">${esc(p.name)}</span></span><span class="s${b.warn ? ' warn' : ''}">${esc(b.s)}</span><span class="dot" aria-hidden="true"></span></button>`;
    const s = openSheet({
      title: `Кто судит ${matchName(m.title)}?`,
      body: `<div class="stack tight"><p class="strong">${esc(D.courtFull(m.court))} · ${m.state === 'live' ? `идёт, ${m.games.join(':')}` : `в ${esc(m.time)}`}</p><p>${esc(D.pairName(m.pairs[0]))} — ${esc(D.pairName(m.pairs[1]))}</p></div>
        ${cur ? `<p class="note warn">${icon('warn')}<span>Сейчас судит ${esc(nameOf(cur))}. Матч перейдёт к новому судье${m.state === 'live' ? `, он продолжит с ${m.games.join(':')}` : ''}</span></p>` : ''}
        <div class="stack tight"><span class="sublabel">Свободны к началу</span><div class="choices pp-people" role="radiogroup" aria-label="Кто судит" id="as-top">${top.map(tile).join('')}</div></div>
        <div class="field search full"><label class="label" for="as-q">Другой человек — найти по фамилии</label>${icon('search')}<input class="input" id="as-q" type="search" autocomplete="off"></div>
        <div class="choices pp-people" role="radiogroup" aria-label="Найденные" id="as-res"></div>`,
      foot: `<p class="pick-msg" id="as-msg" role="alert" hidden></p><button class="btn main" type="button" data-ok>${icon('check')}<span>Назначить судью</span></button><button class="btn quiet" type="button" data-no>Отмена</button>`,
    });
    const ok = s.querySelector('[data-ok] span');
    const msg = $('#as-msg', s);
    const sync = () => { ok.textContent = pick ? `Назначить: ${nameOf(pick)}` : 'Назначить судью'; };
    s.addEventListener('change', (e) => {
      const g = e.target.closest('[role="radiogroup"]'); if (!g) return;
      pick = e.detail;
      // выбор — один на оба списка
      $$('[role="radio"]', s).forEach((x) => { if (!g.contains(x)) x.setAttribute('aria-checked', 'false'); });
      msg.hidden = true; sync();
    });
    const q = $('#as-q', s);
    q.addEventListener('input', () => {
      const v = q.value.trim();
      const found = v ? cand.filter((x) => matches(x.p, v) && !top.includes(x)).slice(0, 6) : [];
      const box = $('#as-res', s);
      box.innerHTML = found.length ? found.map(tile).join('') : (v ? `<p class="muted">Среди игроков лиги нет «${esc(v)}»</p>` : '');
      delete box.dataset.on; hydrate(box);
    });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
    s.querySelector('[data-ok]').addEventListener('click', () => {
      if (!pick) { msg.textContent = 'Выберите, кто будет судить: нажмите на плитку с фамилией'; msg.hidden = false; return; }
      const beforeShown = shownJudge;
      const what = matchName(m.title);
      const undo = state.set(`judges.${mid}`, pick, {
        say: cur ? `заменили судью на ${what}: ${nameOf(pick)} вместо ${genOf(cur)}` : `назначили судью на ${what}: ${nameOf(pick)}`,
        href: 'judges.html',
      });
      shownJudge = pick; fresh = true;
      closeLayer(true);
      draw();
      done(pick, m, () => { shownJudge = beforeShown; fresh = false; undo(); }, cur);
    });
  }

  // «Готово»: где теперь и ссылка для того, у кого нет приложения
  function done(pid, m, undo, was) {
    const nm = nameOf(pid);
    const url = `liga.example/j/${(pid + m.id + '7Kq2xR').split('').reverse().join('')}`;
    const s = openSheet({
      title: 'Судья назначен',
      body: `<div class="pp-done"><span class="done-mark">${icon('check')}</span><h3 class="h2">${esc(nm)} судит ${esc(matchName(m.title))}</h3>
        <ul class="where-now"><li>${icon('phone')}<span><b>У ${esc(genFirstOf(pid))} в приложении</b> — «Судья · Мои матчи»: ${esc(lowCourt(m.court))}, ${m.state === 'live' ? 'идёт сейчас' : `в ${esc(m.time)}`}</span></li>${was ? `<li>${icon('close')}<span><b>У ${esc(genFirstOf(was))}</b> — этого матча больше нет</span></li>` : ''}</ul></div>
        <div class="stack tight"><span class="sublabel">Нет приложения? Дайте ссылку или покажите QR-код</span>
        <div class="pp-link"><div class="pp-qr">${qrSvg(url)}</div><div class="stack tight"><span class="url">${esc(url)}</span><span class="s">Действует ${esc(untilWords)}. Если ссылка потеряется — выдайте новую</span></div></div></div>`,
      foot: `<button class="btn main" type="button" data-no>${icon('check')}Готово</button><button class="btn quiet" type="button" data-copy>${icon('copy')}Скопировать ссылку</button>`,
      onClose: () => toast(`Назначено: ${nm} — ${matchName(m.title)}, ${lowCourt(m.court)}`, { undo }),
    });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
    s.querySelector('[data-copy]').addEventListener('click', async () => {
      let okc = true;
      try { await navigator.clipboard.writeText(`https://${url}`); } catch { okc = false; }
      closeLayer(true);
      toast(okc ? `Ссылка скопирована. Назначено: ${nm} — ${matchName(m.title)}` : 'Не получилось скопировать: выделите адрес и скопируйте сами', okc ? { undo } : { kind: 'bad' });
    });
  }

  // ---------- действия ----------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-assign]');
    if (a) { assign(a.dataset.assign); return; }
    const k = e.target.closest('[data-keep]');
    if (k) {
      const mid = k.dataset.keep; const w = jm()[mid]; const what = matchName(M(mid).title);
      const undo = state.set(`judgesKept.${mid}`, w, { say: `оставили судью на ${what}, хотя у него накладка: ${nameOf(w)}`, href: 'judges.html' });
      draw();
      toast(`Оставили так: ${nameOf(w)} судит ${what}`, { undo });
      return;
    }
    const sh = e.target.closest('[data-show]');
    if (sh) {
      shownJudge = sh.dataset.show; fresh = false; drawPv();
      $$('[data-show]').forEach((b) => b.classList.toggle('shown', b.dataset.show === shownJudge));
      if (matchMedia('(max-width: 1279px)').matches) $('.preview-open')?.click();
      return;
    }
    const r = e.target.closest('[data-revoke]');
    if (r) {
      // ссылку отозвали — все матчи судьи сегодня без судьи (одна запись в журнале, одно «Отменить»)
      const w = r.dataset.revoke;
      const J = jm();
      const mids = Object.keys(J).filter((mid) => J[mid] === w);
      const lost = mids.filter((mid) => M(mid).state !== 'done');
      const names = lost.map((mid) => matchName(M(mid).title));
      const andWords = names.length > 1 ? `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}` : names[0];
      const undo = state.setMany(Object.fromEntries(mids.map((mid) => [`judges.${mid}`, null])), { say: `отозвали ссылку судьи ${genOf(w)}${lost.length ? ` — без судьи ${plural(lost.length, 'остался', 'остались', 'остались')} ${andWords}` : ''}`, href: 'judges.html' });
      if (shownJudge === w) shownJudge = D.JUDGE.player;
      draw();
      toast(`Ссылка ${w === 'me' ? 'отозвана' : `${genOf(w)} отозвана`}: ${lost.length} ${plural(lost.length, 'матч остался', 'матча остались', 'матчей остались')} без судьи`, { undo });
    }
  });
  draw();
}

// ============================================================
// «ИЮЛЬСКИЙ КУБОК» ЗАРАНЕЕ: корты × игровые дни плитками
// judgeDays.<турнир>.<корт> = { '2027-07-10': судья, … }
// ============================================================
function july() {
  document.title = 'Судьи «Июльского кубка» · Раздел организатора';
  const daysOf = () => state.get(`judgeDays.${JULY.id}`, {});
  // пустая плитка — только день недели, число и «+»; назначенная — фамилия судьи
  const dayTile = (d, w) => `<span class="wd">${WD[dow(d)]}</span><span class="dn">${+d.slice(8)}</span>${w ? `<span class="jd">${esc(lastOf(w))}</span>` : `<span class="add">${icon('plus')}</span>`}`;
  // «10, 11 и 12 июля»
  const daysWords = (list) => { const n = [...list].sort().map((d) => +d.slice(8)); return `${n.length > 1 ? `${n.slice(0, -1).join(', ')} и ${n[n.length - 1]}` : n[0]} июля`; };
  // один судья в один день на двух кортах — подсказка словами; решает человек
  const COUNT = { 2: 'двух', 3: 'трёх', 4: 'четырёх', 5: 'пяти' };
  const doubles = (J) => {
    const out = [];
    JULY.play.forEach((d) => {
      const by = {};
      JULY.courts.forEach((c) => { const w = J[c]?.[d]; if (w) (by[w] = by[w] || []).push(c); });
      Object.entries(by).forEach(([w, cs]) => { if (cs.length > 1) out.push({ d, w, cs }); });
    });
    return out;
  };
  const draw = live([`judgeDays.${JULY.id}`, 'judges'], () => {
    const J = daysOf();
    const n = Object.values(J).reduce((k, d) => k + Object.values(d || {}).filter(Boolean).length, 0);
    const total = JULY.courts.length * JULY.play.length;
    const dbl = doubles(J);
    const twice = (c, d) => dbl.some((x) => x.d === d && x.cs.includes(c));
    head.innerHTML = `<a class="back" href="judges.html">${icon('back')}Судьи сегодня</a>
      <div class="head-row"><h1 class="h1">Судьи «${esc(gen(JULY.name))}»</h1><span class="tag lg ${n ? (n === total ? 'ok' : 'warn') : 'past'}">${n ? `Назначено ${n} из ${total}` : 'Судей пока нет'}</span></div>`;
    const rows = JULY.courts.map((c) => {
      const x = D.COURTS[c]; const days = J[c] || {};
      const tiles = JULY.play.map((d) => `<button type="button" class="pp-dt${dow(d) > 4 ? ' we' : ''}${days[d] ? ' set' : ''}${twice(c, d) ? ' twice' : ''}" data-court="${c}" data-day="${d}" aria-label="${esc(courtName(c))}, ${esc(dayWords(d))}: ${days[d] ? `судит ${esc(nameOf(days[d]))}` : 'судьи нет, назначить'}">${dayTile(d, days[d])}</button>`).join('');
      return `<li class="pp-grow" data-srf="${x.surface}"><div class="cn"><b>${esc(x.name)}${x.note ? ` · ${esc(x.note)}` : ''}</b><span>${esc(D.SURFACES[x.surface].label)}</span><button class="btn text" type="button" data-court-all="${c}">На все дни</button></div><div class="pp-dts">${tiles}</div></li>`;
    }).join('');
    const dblHtml = dbl.length ? `<div class="note warn" role="note">${icon('warn')}<span>${dbl.slice(0, 3).map((x) => `${esc(lastOf(x.w))} ${esc(dayWords(x.d, { noWeekday: true }))} стоит на ${COUNT[x.cs.length] || x.cs.length} кортах: ${x.cs.map((c) => c.slice(1)).join(' и ')}`).join('. ')}${dbl.length > 3 ? ` и ещё ${dbl.length - 3}` : ''}</span></div>` : '';
    work.innerHTML = `<div class="stack" style="max-width:1180px">
      <p class="pp-hint"><b>${esc(rangeShort(JULY.from, JULY.to))}</b> · нажмите день корта, чтобы назначить судью</p>
      ${dblHtml}
      <ul class="pp-grid" aria-label="Корты и игровые дни">${rows}</ul>
      ${whereHtml([
    { icon: 'phone', b: 'Телефон судьи', s: '«Судья · Мои матчи» — когда появится расписание этих дней' },
    { icon: 'lock', b: 'Игрокам', s: 'не видно, пока судья не начнёт вести счёт' },
  ])}
    </div>`;
    hydrate(head); hydrate(work);
  });
  const sheet = (c, preset) => {
    const J = daysOf();
    const days = J[c] || {};
    // кого предложить: кто судит сегодня и кого уже назначили на июль
    const known = new Set([...Object.values(jm()).filter(Boolean), ...Object.values(J).flatMap((d) => Object.values(d || {}).filter(Boolean))]);
    const sug = [...known].filter((x) => person(x));
    let pick = null;
    const sel = new Set(preset);
    // занят ли человек в выбранные дни на другом корте
    const elsewhere = (pid) => JULY.courts.filter((c2) => c2 !== c && [...sel].some((d) => J[c2]?.[d] === pid)).map((c2) => c2.slice(1));
    const line = (pid) => { const e = elsewhere(pid); return e.length ? { warn: true, s: `В эти дни уже на ${e.length > 1 ? 'кортах' : 'корте'} ${e.join(' и ')}` } : { s: pid === D.JUDGE.player ? 'Судит в «Июньском кубке»' : 'Уже назначен судьёй' }; };
    const tile = (pid) => { const l = line(pid); return `<button type="button" class="choice pp-who" role="radio" aria-checked="false" data-value="${pid}"><span class="t">${av(pid)}<span class="nm">${esc(nameOf(pid))}</span></span><span class="s${l.warn ? ' warn' : ''}">${esc(l.s)}</span><span class="dot" aria-hidden="true"></span></button>`; };
    const relabel = () => $$('#jt-top [data-value]', document).forEach((b) => { const l = line(b.dataset.value); const s = $('.s', b); s.textContent = l.s; s.classList.toggle('warn', !!l.warn); });
    const s = openSheet({
      title: `Кто судит ${lowCourt(c)}?`,
      body: `<p class="strong">${esc(D.courtFull(c))} · «${esc(JULY.name)}»</p>
        <div class="stack tight"><span class="sublabel" id="jd-l">В какие дни</span><div class="pp-dpick" role="group" aria-labelledby="jd-l">${JULY.play.map((d) => `<button type="button" class="dtile${dow(d) > 4 ? ' we' : ''}" aria-pressed="${sel.has(d)}" data-d="${d}"><span class="wd">${WD[dow(d)]}</span><span class="dn">${+d.slice(8)}</span><span class="mo">июля</span>${days[d] ? `<span class="st">${esc(lastOf(days[d]))}</span>` : ''}</button>`).join('')}</div></div>
        ${sug.length ? `<div class="stack tight"><span class="sublabel">Судьи сезона</span><div class="choices pp-people" role="radiogroup" aria-label="Кто судит" id="jt-top">${sug.map(tile).join('')}</div></div>` : ''}
        <div class="field search full"><label class="label" for="jt-q">${sug.length ? 'Другой человек' : 'Кто будет судить'} — найти по фамилии</label>${icon('search')}<input class="input" id="jt-q" type="search" autocomplete="off"></div>
        <div class="choices pp-people" role="radiogroup" aria-label="Найденные" id="jt-res"></div>`,
      foot: `<p class="pick-msg" id="jt-msg" role="alert" hidden></p><button class="btn main" type="button" data-ok>${icon('check')}<span>Назначить судью</span></button><button class="btn quiet" type="button" data-no>Отмена</button>`,
    });
    const ok = s.querySelector('[data-ok] span'); const msg = $('#jt-msg', s);
    const sync = () => { ok.textContent = pick ? `Назначить: ${lastOf(pick)} — ${sel.size} ${plural(sel.size, 'день', 'дня', 'дней')}` : 'Назначить судью'; };
    s.addEventListener('click', (e) => { const t = e.target.closest('[data-d]'); if (!t) return; const d = t.dataset.d; if (sel.has(d)) sel.delete(d); else sel.add(d); t.setAttribute('aria-pressed', String(sel.has(d))); msg.hidden = true; sync(); relabel(); });
    s.addEventListener('change', (e) => { const g = e.target.closest('[role="radiogroup"]'); if (!g) return; pick = e.detail; $$('[role="radio"]', s).forEach((y) => { if (!g.contains(y)) y.setAttribute('aria-checked', 'false'); }); msg.hidden = true; sync(); });
    const q = $('#jt-q', s);
    q.addEventListener('input', () => {
      const v = q.value.trim();
      const found = v ? allPeople().filter((p) => D.player(p.id) && matches(p, v) && !sug.includes(p.id)).slice(0, 6) : [];
      const box = $('#jt-res', s);
      box.innerHTML = found.length ? found.map((p) => tile(p.id).replace(/<span class="s">[^<]*<\/span>/, `<span class="s">КПР ${kprText(p.kpr)} · в лиге с ${p.since}</span>`)).join('') : (v ? `<p class="muted">Среди игроков лиги нет «${esc(v)}»</p>` : '');
      delete box.dataset.on; hydrate(box);
    });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
    s.querySelector('[data-ok]').addEventListener('click', () => {
      if (!sel.size) { msg.textContent = 'Отметьте хотя бы один день'; msg.hidden = false; return; }
      if (!pick) { msg.textContent = 'Выберите, кто будет судить: нажмите на плитку с фамилией или найдите по фамилии'; msg.hidden = false; return; }
      const next = { ...(daysOf()[c] || {}) };
      sel.forEach((d) => { next[d] = pick; });
      const undo = state.set(`judgeDays.${JULY.id}.${c}`, next, { say: `назначили судью на «${JULY.name}»: ${nameOf(pick)} — ${lowCourt(c)}, ${daysWords(sel)}`, href: `judges.html?t=${JULY.id}` });
      closeLayer(true); draw();
      $$(`.pp-dt[data-court="${c}"]`).forEach((t) => { if (sel.has(t.dataset.day)) t.classList.add('just'); });
      toast(`Назначено: ${nameOf(pick)} — ${lowCourt(c)}, ${sel.size} ${plural(sel.size, 'день', 'дня', 'дней')}`, { undo });
    });
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.pp-dt'); if (t) { sheet(t.dataset.court, [t.dataset.day]); return; }
    const allB = e.target.closest('[data-court-all]'); if (allB) sheet(allB.dataset.courtAll, JULY.play);
  });
  draw();
}

// ============================================================
// РОЛИ: кто что может; дать доступ, сменить роль, забрать доступ. Экран видит только админ.
// Кто в какой роли — D.STAFF и правки отсюда: staff.<человек> = роль, null — доступ забрали.
// ============================================================
function roles() {
  document.title = 'Роли и доступ · Раздел организатора';
  const staff = () => {
    const ch = state.get('staff', {});
    const out = D.STAFF.filter((x) => ch[x.pid] !== null).map((x) => ({ pid: x.pid, role: ch[x.pid] || x.role }));
    Object.entries(ch).forEach(([pid, role]) => { if (role && !out.some((x) => x.pid === pid)) out.push({ pid, role }); });
    return out;
  };
  const ROLE_L = Object.fromEntries(D.ROLES.map((r) => [r.key, r]));
  const roleWord = (k) => (ROLE[k] ? ROLE[k].who : ROLE_L[k].label.toLowerCase());
  const roleTiles = (cur) => `<div class="choices one" role="radiogroup" aria-labelledby="g-role" id="g-roles">${['org', 'council', 'news', 'admin'].map((k) => `<button type="button" class="choice" role="radio" aria-checked="${k === cur}" data-value="${k}"><span class="t">${esc(ROLE_L[k].label)}${k === cur ? ' — сейчас' : ''}</span><span class="s">${esc(ROLE_TEXT[k].can)}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div>`;
  let flash = null;
  const draw = live(['staff', 'judges'], () => {
    const S = staff();
    head.innerHTML = `<div class="head-row"><h1 class="h1">Судьи и доступ</h1>${tabs('roles')}<span class="tag lg past pp-only">${icon('lock')}Видит только админ</span>
      <div class="head-act"><p class="who-sees">${icon('eye')}<span>Человек войдёт в раздел организатора со своей ролью</span></p><button class="btn main" type="button" id="grant">${icon('plus')}Дать доступ</button></div></div>`;
    const card = (key) => {
      const r = ROLE_L[key];
      const people = S.filter((x) => x.role === key);
      const row = (x) => {
        if (x.pid === 'me') return `<li${flash === x.pid ? ' class="just"' : ''}>${av('me', 'pp56')}<span class="grow"><span class="nm">Вы</span></span></li>`;
        const p = person(x.pid);
        return `<li${flash === x.pid ? ' class="just"' : ''}>${av(x.pid, 'pp56')}<span class="grow"><span class="nm">${esc(p.name)}</span></span><button class="btn text" type="button" data-role-of="${x.pid}">Изменить роль</button></li>`;
      };
      return `<section class="pp-role" aria-labelledby="r-${key}"><h2 class="h2" id="r-${key}">${esc(r.label)}</h2>
        <p class="can">${esc(ROLE_TEXT[key].can)}</p>
        ${people.length ? `<ul class="people">${people.map(row).join('')}</ul>` : '<p class="nobody">Пока никого. Нажмите «Дать доступ»</p>'}
      </section>`;
    };
    const judges = [...new Set(Object.values(jm()).filter(Boolean))];
    work.innerHTML = `<div class="stack loose">
      <div class="pp-roles">${['org', 'council', 'news', 'admin'].map(card).join('')}
        <section class="pp-role judge" aria-labelledby="r-judge"><h2 class="h2" id="r-judge">Судья</h2>
          <p class="can">В раздел организатора не входит. Ведёт счёт своих матчей в приложении: «Судья · Мои матчи»</p>
          ${judges.length ? `<ul class="people">${judges.map((pid) => `<li>${av(pid, 'pp56')}<span class="grow"><span class="nm">${esc(nameOf(pid))}</span><span class="s">судит сегодня</span></span></li>`).join('')}</ul>` : '<p class="nobody">Сегодня судей нет</p>'}
        </section>
      </div>
      ${whereHtml([{ icon: 'lock', b: 'Только раздел организатора', s: 'роли не видны ни на сайте, ни в приложении' }, { icon: 'log', b: 'Журнал действий', s: 'кто, когда и кому дал или забрал доступ' }])}
    </div>`;
    hydrate(head); hydrate(work);
    flash = null;
  });

  function grant() {
    let pick = null; let role = null;
    const S = staff();
    const s = openSheet({
      title: 'Дать доступ',
      body: `<div class="pp-step"><h3 class="ask-q" id="g-who">Кому?</h3>
          <div class="field search full"><label class="label" for="g-q">Найти по фамилии</label>${icon('search')}<input class="input" id="g-q" type="search" autocomplete="off" autofocus></div>
          <div class="choices pp-people" role="radiogroup" aria-labelledby="g-who" id="g-res"></div></div>
        <div class="pp-step"><h3 class="ask-q" id="g-role">Какая роль?</h3>${roleTiles(null)}</div>`,
      foot: `<p class="pick-msg" id="g-msg" role="alert" hidden></p><button class="btn main" type="button" data-ok>${icon('key')}<span>Дать доступ</span></button><button class="btn quiet" type="button" data-no>Отмена</button>`,
    });
    const ok = s.querySelector('[data-ok] span'); const msg = $('#g-msg', s);
    const sync = () => { ok.textContent = pick && role ? `Дать доступ: ${roleWord(role)} — ${lastOf(pick)}` : 'Дать доступ'; };
    const q = $('#g-q', s);
    q.addEventListener('input', () => {
      const v = q.value.trim();
      const found = v ? allPeople().filter((p) => matches(p, v)).slice(0, 6) : [];
      const box = $('#g-res', s);
      box.innerHTML = found.length ? found.map((p) => { const has = S.find((x) => x.pid === p.id); return `<button type="button" class="choice pp-who" role="radio" aria-checked="${pick === p.id}" data-value="${p.id}"><span class="t">${av(p.id)}<span class="nm">${esc(p.name)}</span></span><span class="s">${has ? `Сейчас: ${esc(roleWord(has.role))} — роль сменится` : `КПР ${kprText(p.kpr)} · в лиге с ${p.since}`}</span><span class="dot" aria-hidden="true"></span></button>`; }).join('') : (v ? `<p class="muted">Среди игроков лиги нет «${esc(v)}»</p>` : '');
      delete box.dataset.on; hydrate(box);
    });
    s.addEventListener('change', (e) => {
      const g = e.target.closest('[role="radiogroup"]'); if (!g) return;
      if (g.id === 'g-res') pick = e.detail; else role = e.detail;
      msg.hidden = true; sync();
    });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
    s.querySelector('[data-ok]').addEventListener('click', () => {
      if (!pick) { msg.textContent = 'Найдите человека по фамилии и нажмите на него'; msg.hidden = false; q.focus(); return; }
      if (!role) { msg.textContent = 'Выберите роль'; msg.hidden = false; return; }
      const had = S.find((x) => x.pid === pick);
      const undo = state.set(`staff.${pick}`, role, {
        say: had ? `сменили роль: ${nameOf(pick)} — ${roleWord(role)}` : `дали доступ к разделу организатора: ${nameOf(pick)} — ${roleWord(role)}`,
        href: 'judges.html?v=roles',
      });
      flash = pick;
      closeLayer(true); draw();
      toast(`Доступ выдан: ${nameOf(pick)} — ${roleWord(role)}`, { undo });
    });
  }

  // «Изменить роль»: другая роль плитками; «Забрать доступ» — здесь же, окном с именем человека
  function change(pid) {
    const p = person(pid);
    const cur = staff().find((x) => x.pid === pid)?.role;
    let role = cur;
    const s = openSheet({
      title: p.name,
      body: `<div class="pp-step"><h3 class="ask-q" id="g-role">Какая роль?</h3>${roleTiles(cur)}</div>
        <div class="pp-away"><span class="strong">Больше не работает в админке?</span><button class="btn quiet pp-no" type="button" data-take>${icon('close')}Забрать доступ</button></div>`,
      foot: `<p class="pick-msg" id="r-msg" role="alert" hidden></p><button class="btn main" type="button" data-ok>${icon('check')}<span>Сохранить роль</span></button><button class="btn quiet" type="button" data-no>Отмена</button>`,
    });
    const ok = s.querySelector('[data-ok] span'); const msg = $('#r-msg', s);
    s.addEventListener('change', (e) => {
      if (!e.target.closest('#g-roles')) return;
      role = e.detail; msg.hidden = true;
      ok.textContent = role === cur ? 'Сохранить роль' : `Сменить роль: ${roleWord(role)}`;
    });
    s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
    s.querySelector('[data-ok]').addEventListener('click', () => {
      if (role === cur) { msg.textContent = `Роль та же — «${ROLE_L[cur].label}». Выберите другую или нажмите «Отмена»`; msg.hidden = false; return; }
      const undo = state.set(`staff.${pid}`, role, { say: `сменили роль: ${p.name} — ${roleWord(role)}`, href: 'judges.html?v=roles' });
      flash = pid;
      closeLayer(true); draw();
      toast(`Роль изменена: ${p.name} — ${roleWord(role)}`, { undo });
    });
    s.querySelector('[data-take]').addEventListener('click', () => {
      confirmAction({
        title: `Забрать доступ у ${genName(p)}?`,
        text: `${p.first} больше не сможет войти в раздел организатора.`,
        consq: ['Его записи в журнале действий останутся'],
        action: 'Забрать доступ',
        onConfirm: () => {
          const undo = state.set(`staff.${pid}`, null, { say: `забрали доступ к разделу организатора у ${genName(p)}`, href: 'judges.html?v=roles' });
          draw();
          toast(`Доступ забран: ${p.name}`, { undo });
        },
      });
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#grant')) { grant(); return; }
    const t = e.target.closest('[data-role-of]');
    if (t) change(t.dataset.roleOf);
  });
  draw();
}
