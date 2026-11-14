// Поиск напарника: можно ли нам играть вместе, приглашения, кто ищет пару на этап
// и что делать, если напарник выбудет.
// Мир — data.js (через app.js): этап, его коридор и жеребьёвка, кто ищет пару, приглашения, правила.
// Расчёты — partner.logic.js.
import { D, avHtml, icon, esc, setTick, keepTheme, playerHref, sheet, worldTime } from '../app.js';
import { checkPair, corridorText, fmtK, replacementPhase, daysBetween, shiftDays, dayMonth, plural } from './partner.logic.js';

const $ = (id) => document.getElementById(id);
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const ME = D.player(D.ME.player);
// ближайший этап, на который идёт заявка (Июльский кубок): коридор, жеребьёвка, корт финалов
const T = D.TOURNAMENTS.find((t) => t.state === 'open' && t.corridor) || D.tournament('jul-4');
const C = T.corridor;
const q = new URLSearchParams(location.search);

// сколько матчей сыграли вместе (за всё время в лиге)
const together = (id) => D.ME.partners.find((x) => x.player === id)?.together || 0;
const togetherText = (n) => `${n} ${plural(n, 'матч', 'матча', 'матчей')} вместе`;
// фамилия после «с»: Савельев → с Савельевым, Хван → с Хваном
const withName = (last) => (/(ов|ев|ёв|ин|ын)$/.test(last) ? `${last}ым` : /й$/.test(last) ? `${last.slice(0, -1)}ем` : /[бвгджзклмнпрстфхцчшщ]$/.test(last) ? `${last}ом` : last);
const where = (c) => (c.ok ? 'в коридоре' : c.where === 'above' ? 'выше коридора' : 'ниже коридора');

// ---------- состояние: выбранный напарник, приглашения, заявка ----------
// В пределах вкладки состояние живёт в sessionStorage: вернулись из карточки игрока — всё на месте.
const KEY = 'tl-partner-v2';
const fresh = () => ({
  sel: null,
  inv: Object.fromEntries(D.INVITES.filter((x) => !x.tournament || x.tournament === T.id).map((x) => [x.player, { dir: x.dir, when: x.when }])),
  app: null,
  more: false,
});
function load() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (s && s.inv && typeof s.inv === 'object') return s;
  } catch { /* хранилища нет — начинаем заново */ }
  return fresh();
}
const S = load();
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ничего */ } };

// Кого проверяем. ?p=<id> — из карточки игрока. Иначе при заходе на экран — того, кто зовёт вас
// в пару (самое срочное), если заявки ещё нет. Вернулись назад — прежний выбор.
// Иначе — частого напарника.
const valid = (id) => !!id && !!D.player(id) && id !== ME.id;
const asked = q.get('p');
const incoming = () => Object.keys(S.inv).find((id) => S.inv[id].dir === 'in');
const navType = (performance.getEntriesByType('navigation')[0] || {}).type || 'navigate';
if (valid(asked)) S.sel = asked;
else if (navType === 'navigate' && !S.app && incoming()) S.sel = incoming();
if (!valid(S.sel)) S.sel = incoming() || D.ME.partners[0].player;

// ---------- герой: корт этапа ----------
// отрезок возможных сумм: коридор и по 1.0 с каждой стороны
const MIN = C[0] - 1;
const MAX = C[1] + 1;
const pos = (v) => Math.min(100, Math.max(0, ((v - MIN) / (MAX - MIN)) * 100));

function buildCourt() {
  $('pt-hero').dataset.surface = T.surface || D.court(T.court).surface;
  const inEl = $('pt-in');
  inEl.style.left = `${pos(C[0])}%`;
  inEl.style.width = `${pos(C[1]) - pos(C[0])}%`;
  let html = '';
  for (let v = MIN; v <= MAX + 1e-9; v += 0.5) {
    if (v === C[0] || v === C[1]) continue;               // на границах — боковые линии
    html += `<span class="pt-tick${v > C[0] && v < C[1] ? ' in' : ''}" style="left:${pos(v)}%"></span>`;
  }
  html += `<span class="cap pt-lbl" style="left:${pos(C[0])}%">${fmtK(C[0])}</span><span class="cap pt-lbl" style="left:${pos(C[1])}%">${fmtK(C[1])}</span>`;
  $('pt-court').insertAdjacentHTML('afterbegin', html);
}

function paintSide(i, p) {
  setTick($(`pt-k${i}`), fmtK(p.kpr));
  const av = $(`pt-av${i}`);
  if (av.dataset.id !== p.id) { av.innerHTML = avHtml(p.id); av.dataset.id = p.id; }
  $(`pt-n${i}`).innerHTML = `${esc(p.first)}<br>${esc(p.last)}`;
  const who = $(`pt-who${i}`);
  who.href = keepTheme(playerHref(p.id));
  who.setAttribute('aria-label', p.id === ME.id ? `Вы, КПР ${fmtK(p.kpr)}: моя карта` : `${p.name}, КПР ${fmtK(p.kpr)}: карточка игрока`);
}

// что связывает двоих — капсула над выводом
function tieText(p) {
  const inv = S.inv[p.id];
  if (S.app && S.app.with === p.id) return 'Ваша заявка';
  if (inv) return inv.dir === 'in' ? 'Зовёт вас в пару' : 'Вы позвали · ждём ответа';
  const n = together(p.id);
  return n ? togetherText(n) : 'Вместе ещё не играли';
}

// вывод словами — над цифрами, как фраза в шапке матча
const sayText = (c) => `${c.ok ? 'Можно' : 'Нельзя'}: сумма ${fmtK(c.sum)} ${where(c)} ${corridorText(C)}`;

let shownSum = null;
function renderHero() {
  const p = D.player(S.sel);
  const c = checkPair(ME.kpr, p.kpr, C);
  paintSide(0, ME);
  paintSide(1, p);
  $('pt-tie').textContent = tieText(p);
  $('pt-hero').classList.toggle('is-out', !c.ok);
  $('pt-ball').style.left = `${pos(c.sum)}%`;
  // мяч перелетает к новой сумме; при открытии экрана — падает на линию
  const anim = shownSum === null ? 'drop' : shownSum !== c.sum ? 'go' : '';
  if (anim && !still()) {
    for (const el of $('pt-ball').querySelectorAll('.pt-hop, .pt-shade')) { el.classList.remove('go', 'drop'); void el.offsetWidth; el.classList.add(anim); }
  }
  shownSum = c.sum;
  setTick($('pt-sum'), fmtK(c.sum));
  setTick($('pt-say'), sayText(c));
}

// ---------- главное действие для пары в герое ----------
function renderAct() {
  const p = D.player(S.sel);
  const c = checkPair(ME.kpr, p.kpr, C);
  const inv = S.inv[p.id];
  let html;
  let note;
  if (S.app && S.app.with === p.id) {
    html = '<button class="btn quiet" type="button" data-act="cancel">Отменить заявку</button>';
    note = S.app.out ? 'Заявка у директора турнира с пометкой «вне коридора»: решает Совет' : 'Заявка у директора турнира, ждёт утверждения';
  } else if (S.app) {
    html = `<button class="btn quiet" type="button" disabled>${icon('plus')}Позвать в пару</button>`;
    note = `У вас уже есть заявка на этап — с ${withName(D.player(S.app.with).last)}`;
  } else if (inv && inv.dir === 'in') {
    // когда пришло — в строке приглашения ниже
    html = `<div class="btn-row"><button class="btn main" type="button" data-act="accept">${icon('check')}Принять</button><button class="btn quiet" type="button" data-act="decline">Отклонить</button></div>`;
    note = c.ok ? 'Принятое приглашение станет заявкой пары' : 'Заявка уйдёт директору с пометкой «вне коридора»';
  } else if (inv && inv.dir === 'out') {
    html = '<button class="btn quiet" type="button" data-act="revoke">Отозвать приглашение</button>';
    note = 'Когда примет, станет заявкой пары';
  } else if (c.ok) {
    html = `<button class="btn main" type="button" data-act="invite">${icon('plus')}Позвать в пару</button>`;
    note = `Заявлено ${T.pairs} ${plural(T.pairs, 'пара', 'пары', 'пар')} из ${T.slots} · ${T.note.toLowerCase()}`;
  } else {
    html = '<button class="btn quiet" type="button" data-act="invite">Позвать всё равно</button>';
    note = 'Заявка уйдёт директору с пометкой «вне коридора». Пропустить её может только Совет';
  }
  $('pt-act').innerHTML = `${html}<p class="pt-note">${esc(note)}</p>`;
}

// ---------- строки списков ----------
// подпись из кусочков: строка переносится только между ними
const subHtml = (bits) => bits.map((b) => `<span class="pt-bit">${esc(b)}</span>`).join(' · ');
// строка-выбор: выбранная (в герое) — на тон светлее
function rowHtml(p, bits, { ok = true, level = true } = {}) {
  return `<button class="row pick tone pt-row${ok ? '' : ' no'}" type="button" data-pick="${p.id}" aria-pressed="${p.id === S.sel}">`
    + `${avHtml(p.id)}<span class="grow"><span class="strong ellipsis">${esc(p.name)}</span><span class="sub">${subHtml(bits)}</span></span>`
    + `${level ? `<span class="num"><span class="vh">КПР </span>${fmtK(p.kpr)}</span>` : ''}</button>`;
}

// Приглашения: заявка (принятое приглашение), входящие, исходящие. Пусто — раздела нет.
function renderInv() {
  const rows = [];
  // принятое приглашение: когда приняли (статус заявки — под кнопкой)
  if (S.app) rows.push(rowHtml(D.player(S.app.with), ['Принято', S.app.when || nowText()], { level: false }));
  const all = Object.entries(S.inv).map(([id, x]) => ({ p: D.player(id), x })).filter((r) => r.p);
  for (const { p, x } of all.filter((r) => r.x.dir === 'in')) rows.push(rowHtml(p, ['Зовёт вас', x.when], { level: false }));
  for (const { p, x } of all.filter((r) => r.x.dir === 'out')) rows.push(rowHtml(p, ['Вы позвали', x.when], { level: false }));
  $('pt-inv').innerHTML = rows.join('');
  $('pt-inv-sec').hidden = !rows.length;
}

// Кто ищет пару: без тех, кто уже в приглашениях или в заявке. Есть заявка — раздел свёрнут в строку.
function renderSeek() {
  const busy = (id) => !!S.inv[id] || (S.app && S.app.with === id);
  const all = D.SEEKERS.map((id) => D.player(id)).filter((p) => p && p.id !== ME.id);
  const list = all.filter((p) => !busy(p.id))
    .map((p) => ({ p, c: checkPair(ME.kpr, p.kpr, C) }))
    .sort((a, b) => (b.c.ok - a.c.ok) || (a.p.kpr - b.p.kpr));
  const okN = list.filter((x) => x.c.ok).length;
  const others = list.length < all.length;
  const folded = !!S.app;
  const open = !folded || S.more;
  $('pt-seek-t').textContent = others ? 'Ещё ищут пару' : 'Ищут пару на этап';
  $('pt-seek-n').textContent = `${okN} из ${list.length} подходят`;
  $('pt-seek-head').hidden = folded;
  const more = $('pt-more');
  more.hidden = !folded;
  if (folded) {
    more.setAttribute('aria-expanded', String(open));
    more.innerHTML = `<span class="grow"><span class="strong">Ещё ищут пару · ${list.length}</span><span class="sub">${okN} ${plural(okN, 'подходит', 'подходят', 'подходят')} по уровню</span></span>${icon('down')}`;
  }
  $('pt-seek').hidden = !open;
  $('pt-seek').innerHTML = !open ? '' : list.map(({ p, c }) => {
    const bits = c.ok ? ['Подходит', `сумма ${fmtK(c.sum)}`] : ['Не подходит', `сумма ${fmtK(c.sum)} ${c.where === 'above' ? 'выше' : 'ниже'} коридора`];
    const n = together(p.id);
    if (n) bits.push(togetherText(n));
    return rowHtml(p, bits, { ok: c.ok });
  }).join('');
  $('pt-seek-sec').hidden = !list.length;
}

// ---------- если напарник выбудет: три срока до жеребьёвки ----------
function dropSteps() {
  const toDraw = daysBetween(D.TODAY.iso, T.draw);
  const phase = replacementPhase(toDraw, D.RULES.replaceDays);
  const lastDay = shiftDays(T.draw, -D.RULES.replaceDays);
  const left = daysBetween(D.TODAY.iso, lastDay);
  const steps = [
    { key: 'early', t: `До ${dayMonth(lastDay)}`, s: 'Замена — напишите директору', left: `ещё ${left} ${plural(left, 'день', 'дня', 'дней')}` },
    { key: 'late', t: `С ${dayMonth(shiftDays(lastDay, 1))} до жеребьёвки`, s: 'Замена с разрешения директора' },
    { key: 'after', t: `После жеребьёвки ${T.drawLabel || dayMonth(T.draw)}`, s: 'Снимается вся пара' },
  ];
  const at = steps.findIndex((x) => x.key === phase);
  // прошедший срок отмечен как пройденный, текущий — цветом мяча
  return steps.map((x, i) => {
    const now = i === at;
    const cls = now ? ' now' : i < at ? ' done' : '';
    const t = now && x.left ? `${x.t} · ${x.left}` : x.t;
    const mark = i < at ? icon('check') : String(i + 1);
    return `<li class="step${cls}"${now ? ' aria-current="step"' : ''}><span class="mark">${mark}</span>`
      + `<span><span class="strong">${esc(t)}</span><span class="sub">${esc(x.s)}</span></span></li>`;
  }).join('');
}
function renderDrop() {
  const mate = S.app ? D.player(S.app.with) : null;
  $('pt-drop-sec').hidden = !mate;
  if (!mate) return;
  $('pt-drop-t').textContent = `Если ${mate.last} выбудет`;
  $('pt-drop').innerHTML = dropSteps();
}

// ---------- шторка «Правила этапа» ----------
const srfLabel = D.SURFACES[T.surface || D.court(T.court).surface].label;
// «Июльского кубка»: родительный падеж названия этапа — из списка этапов сезона
const tGen = (D.PAST_SEASON.tournaments.find((x) => x.name === T.name) || {}).gen || T.name;
function renderRules() {
  // покрытие этапа — покрытие корта его финалов: отсюда цвет героя
  const courtNo = (/\d+/.exec(D.court(T.court).name) || [''])[0];
  const on = { трава: 'траве', хард: 'харде', грунт: 'грунте' }[srfLabel] || srfLabel;
  $('pt-rules-lead').innerHTML = `<span>${esc(T.name)}, ${esc(T.dates)}</span><span>Финалы на ${esc(on)}, корт ${esc(courtNo)}</span>`;
  const by = (/до .+$/.exec(T.note || '') || [''])[0];
  const kv = [
    ['Сумма уровней пары', `<span class="num">${corridorText(C)}</span>`],
    ['Заявки', `<span class="strong">${esc(by)}</span>`],
    ['Возраст пары в сумме', `<span class="strong">от ${D.RULES.ageSum} лет</span>`],
  ];
  $('pt-rules-kv').innerHTML = kv.map(([k, v]) => `<div class="row"><span class="muted">${k}</span>${v}</div>`).join('');
  // коридор — правило этого этапа: на идущем этапе играют и пары с большей суммой (в финале — 9.0)
  const top = Math.max(...D.PAIRS.map((x) => x.players.reduce((s, id) => s + D.player(id).kpr, 0)));
  const prep = (name) => (/ий кубок$/.test(name) ? name.replace(/ий кубок$/, 'ом') : `этапе «${name}»`);
  const was = top > C[1] ? `: на ${prep(D.TOURNAMENT.name)} играют и пары с суммой ${fmtK(top)}` : '';
  $('pt-rules-note').textContent = `У ${tGen} свой коридор${was}. `
    + 'Пару вне коридора пропускает только Совет, возраст по анкетам сверяет директор.';
  $('pt-rules-drop').innerHTML = dropSteps();
}
const rules = sheet($('pt-rules'), $('pt-scrim'));
$('pt-rules-open').addEventListener('click', (e) => rules.open(e.currentTarget));
$('pt-rules-close').addEventListener('click', () => rules.close());

// ---------- действия ----------
// время по часам мира (те же, что у «Сегодня» и «Матча»)
function nowText() { return `сегодня в ${worldTime()}`; }
const ACT = {
  invite: (id) => { S.inv[id] = { dir: 'out', when: nowText() }; },
  revoke: (id) => { delete S.inv[id]; },
  decline: (id) => { delete S.inv[id]; },
  // принятое приглашение становится заявкой; у игрока одна заявка на этап — остальные приглашения снимаются
  accept: (id) => { S.app = { with: id, out: !checkPair(ME.kpr, D.player(id).kpr, C).ok, when: nowText() }; S.inv = {}; S.more = false; },
  cancel: () => { S.app = null; },
};

function renderAll() {
  renderHero();
  renderAct();
  renderInv();
  renderDrop();
  renderSeek();
}

function pick(id, byKeys) {
  if (!valid(id)) return;
  S.sel = id;
  save();
  // герой наверху: если он ушёл за край, сначала возвращаемся к нему, потом мяч летит
  const away = $('pt-hero').getBoundingClientRect().bottom < 120;
  if (away) scrollTo({ top: 0, behavior: still() ? 'auto' : 'smooth' });
  const go = () => { renderAll(); if (byKeys) $('pt-hero').focus({ preventScroll: true }); };
  if (away && !still()) setTimeout(go, 380); else go();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]');
  if (a && ACT[a.dataset.act]) {
    ACT[a.dataset.act](S.sel);
    save();
    renderAll();
    // кнопка заменилась: с клавиатуры переводим фокус на новую, чтобы не потерять место
    const next = $('pt-act').querySelector('button:not([disabled])');
    if (next && e.detail === 0) next.focus({ preventScroll: true });
    return;
  }
  if (e.target.closest('#pt-more')) {
    S.more = !S.more;
    save();
    renderSeek();
    return;
  }
  const r = e.target.closest('[data-pick]');
  if (r) pick(r.dataset.pick, e.detail === 0);
});

$('pt-stage').textContent = `${T.name} · ${srfLabel}`;
$('pt-hero').tabIndex = -1;
buildCourt();
renderRules();
renderAll();
save();
