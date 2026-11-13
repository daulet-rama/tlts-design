// TLTS · partner.html — «Коридор напарника» (идея m-corridor, заказчик ещё не утверждал).
// Данные: core/data.js (демо-игроки), ideas/partner.data.js (числа архива 2026), ideas/partner.demo.js (демо-сцена).
// Расчёты — ideas/partner.logic.js. Карточки и мячи — только core/card.js.

import { players, playerOf, tournaments, RATING_DATE } from './core/data.js';
import { playerCardHTML, pairBallHTML, pairBallHalfHTML, kprChipHTML } from './core/card.js';
import { mountProtoBar, mountIdeaNote } from './core/protobar.js';
import { role, playerId, setRole, onIdentityChange, ROLE_LABELS } from './core/identity.js';
import { PARTNER_DATA as D } from './ideas/partner.data.js';
import { DEMO_STAGE, DEMO_SEEKERS } from './ideas/partner.demo.js';
import {
  ruleFor, checkPair, canSeeAge, corridorText, fmtK, riseWarning, simulate, seekingByLevel,
  partnerLevels, replacementState, inCorridor, LEVELS,
} from './ideas/partner.logic.js';

mountProtoBar({ current: 'partner' });
mountIdeaNote(null, {
  title: 'Коридор напарника',
  score: 7.0,
  approvals: 3,
  why: 'Пары собираются в мессенджерах, а правило коридора каждый проверяет в уме. В 2026 году 219 заявок из 252 стояли ровно на потолке 8.0. Сайт подсказывает «можно / нельзя, потому что…», а Совету заранее показывает, кого затронет новый коридор.',
  changed: [
    'Проценты побед убраны совсем: их нет ни у пары, ни у человека, ни на заявке.',
    'Блок «Кто ищет пару» — только числа по уровням КПР, без имён.',
    'Год рождения не видит никто. Ответ «возраст пары проходит / не проходит» видит только сам игрок про свою пару; возраст чужих пар проверяет директор по анкетам.',
    'Имена тех, кто ищет пару, видят только вошедшие члены лиги. Гость видит только числа.',
    'Предупреждение «если ваш КПР вырастет» видит только сам игрок.',
    'Сайт заявку не отклоняет: утверждает админ, пару вне коридора — только с отметкой «исключение Совета».',
    'Оставлено главное: проверка пары, «Ищу напарника», замена выбывшего до срока и расчёт для Совета.',
  ],
  league: [
    'На Итоговом 2026 коридор «8.0» — это ровно 8.0 или не выше 8.0? Действует ли там правило возраста?',
    '«Возраст пары 70+» — это сумма возрастов не меньше 70? С какого турнира 80 сменилось на 70?',
    'Как КПР переходит на следующую ступень (в рейтинге сейчас уровни 3.0, 3.5, 4.0, 4.5 и 5.0) при правиле «±0.1 за 500 баллов»?',
    'Можно ли заменить напарника, если до жеребьёвки меньше 10 дней?',
    'Как проходит этап, если заявок меньше 32?',
    'Кто ставит отметку «исключение Совета» и где она записывается?',
  ],
});

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : '[ДАТА]'; };
// диапазон «7.5–8.0» не рвём по тире
const nb = (s) => String(s).replace(/(\d)–(\d)/g, '$1\u2060–\u2060$2');
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICON = {
  ok: '<svg class="pt-mark" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
  no: '<svg class="pt-mark" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
  ask: '<svg class="pt-mark" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.8 8a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="14.4" r="1" fill="currentColor"/></svg>',
};

/* ------------------------------------------------------------------ правила и состояние */

const RULES = [
  ruleFor(D.corridor, 2023), ruleFor(D.corridor, 2024), ruleFor(D.corridor, 2025),
  ruleFor(D.corridor, 2026), ruleFor(D.corridor, 2026, { final: true }),
];
const R2026 = RULES[3];
const ruleByKey = (k) => RULES.find((r) => r.key === k) || R2026;

const demoPlayers = players.filter((p) => p.demo);
const meId = () => { const id = playerId(); return playerOf(id)?.demo ? id : 'd01'; };
const demoT = tournaments.find((t) => t.id === DEMO_STAGE.tournamentId);

const LS = 'tlts-partner-v1';
const SEED_APPS = [   // демо-заявки других пар, чтобы очередь админа не была пустой
  { id: 'app-d02-d06', a: 'd02', b: 'd06', status: 'pending', exception: false, seed: true },
  { id: 'app-d08-d10', a: 'd08', b: 'd10', status: 'pending', exception: false, seed: true },
];
function load() {
  try {
    const s = JSON.parse(window.localStorage.getItem(LS) || 'null');
    if (s && typeof s === 'object' && s.invites && Array.isArray(s.apps)) return s;
  } catch { /* нет хранилища — работаем в памяти */ }
  return { invites: {}, apps: SEED_APPS.map((x) => ({ ...x })) };
}
let S = load();
function save() { try { window.localStorage.setItem(LS, JSON.stringify(S)); } catch { /* ничего */ } }

const ui = { season: '2026', a: meId(), b: 'd05', filter: 'all', drop: 'early', lo: 7.5, hi: 8.0 };

/* ------------------------------------------------------------------ роль */

const ROLE_SHOWN = ['guest', 'player', 'admin', 'superadmin'];
const ROLE_HINT = {
  guest: 'Гость видит проверку пары по КПР и общие числа, без имён тех, кто ищет пару. Приглашать не может.',
  player: 'Игрок проверяет пару, приглашает напарника и видит своё личное предупреждение.',
  judge: 'Судье этот экран не нужен: он видит то же, что гость.',
  admin: 'Админ утверждает заявки и видит расчёт для Совета.',
  superadmin: 'Суперадмин видит всё, что админ.',
};
const isCouncil = () => ['admin', 'superadmin'].includes(role());
const isPlayer = () => role() === 'player';

function renderRole() {
  const r = role();
  $('pt-role').innerHTML = ROLE_SHOWN.map((id) =>
    `<button class="seg__btn" type="button" data-role="${id}" aria-pressed="${id === r}">${esc(ROLE_LABELS[id])}</button>`).join('');
  $('pt-role-hint').textContent = ROLE_HINT[r] || '';
}
$('pt-role').addEventListener('click', (e) => {
  const b = e.target.closest('[data-role]');
  if (b) setRole(b.dataset.role);
});

/* ------------------------------------------------------------------ 01 · проверка пары */

function optionsHTML(sel, except) {
  return demoPlayers.filter((p) => p.id !== except).map((p) =>
    `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${esc(p.short)} · КПР ${fmtK(p.kpr)}</option>`).join('');
}

function renderSeasons() {
  $('pt-season').innerHTML = RULES.map((r) =>
    `<button class="seg__btn" type="button" data-season="${r.key}" aria-pressed="${r.key === ui.season}"><span>${esc(r.label)}</span><small class="pt-seg__sub">${esc(corridorText(r.corridor))}</small></button>`).join('');
}
$('pt-season').addEventListener('click', (e) => {
  const b = e.target.closest('[data-season]');
  if (!b) return;
  ui.season = b.dataset.season;
  renderSeasons(); renderCheck();
});

// Игрок видит себя первым, без выбора: «вы». Остальные роли выбирают обоих, но без ответа про возраст.
function renderPickers() {
  const mine = isPlayer();
  if (mine) ui.a = meId();
  if (ui.b === ui.a) ui.b = demoPlayers.find((p) => p.id !== ui.a).id;
  $('pt-a-me').hidden = !mine;
  $('pt-a-pick').hidden = mine;
  const meP = playerOf(ui.a);
  $('pt-a-me-box').textContent = mine ? `${meP.short} · КПР ${fmtK(meP.kpr)}` : '';
  $('pt-a').innerHTML = optionsHTML(ui.a, null);
  $('pt-b').innerHTML = optionsHTML(ui.b, ui.a);
}
const ageVisible = () => canSeeAge({ role: role(), id: meId() }, ui.a, ui.b);
$('pt-a').addEventListener('change', (e) => { ui.a = e.target.value; renderPickers(); renderCheck(); });
$('pt-b').addEventListener('change', (e) => { ui.b = e.target.value; renderCheck(); });

function ruleRow(state, title, text) {
  const ico = state === true ? ICON.ok : state === false ? ICON.no : ICON.ask;
  const cls = state === true ? 'is-ok' : state === false ? 'is-no' : 'is-ask';
  return `<li class="pt-rule ${cls}">${ico}<span class="pt-rule__body"><b>${esc(title)}</b> <span>${text}</span></span></li>`;
}

function renderCheck() {
  const rule = ruleByKey(ui.season);
  const a = playerOf(ui.a), b = playerOf(ui.b);
  const withAge = ageVisible();
  const r = checkPair(a, b, rule, { withAge });
  $('pt-check-meta').textContent = `Сезон ${rule.label} · коридор ${corridorText(rule.corridor)}`;

  const halves = $('pt-halves');
  const key = `${a.kpr}|${b.kpr}`;
  if (halves.dataset.key !== key) {
    halves.innerHTML = `<span class="pt-half pt-half--l">${pairBallHalfHTML(a.kpr, 'left', { size: 132, decorative: true })}</span>`
      + `<span class="pt-half pt-half--r">${pairBallHalfHTML(b.kpr, 'right', { size: 132, decorative: true })}</span>`
      + `<span class="pt-halves__k pt-halves__k--l num">${fmtK(a.kpr)}</span><span class="pt-halves__k pt-halves__k--r num">${fmtK(b.kpr)}</span>`;
    halves.dataset.key = key;
  }
  // половины сходятся, когда пара проходит
  if (reduceMotion()) halves.classList.add('no-anim');
  requestAnimationFrame(() => halves.classList.toggle('is-apart', !r.ok));

  const v = $('pt-verdict');
  v.classList.toggle('is-ok', r.ok);
  v.classList.toggle('is-no', !r.ok);
  $('pt-word').textContent = r.ok ? 'Можно' : 'Нельзя';
  $('pt-why').textContent = nb(r.ok
    ? `${a.last} и ${b.last}: сумма ${fmtK(r.sum)} в коридоре ${corridorText(rule.corridor)}.`
    : `Потому что ${r.reasons.join('; ')}.`);

  const rows = [];
  rows.push(ruleRow(r.sumOk, 'Сумма КПР', `${fmtK(a.kpr)} + ${fmtK(b.kpr)} = ${fmtK(r.sum)} · коридор сезона ${esc(corridorText(rule.corridor))}`));
  if (rule.levels) rows.push(ruleRow(r.levelOk, 'Личный КПР', `допускается от ${fmtK(rule.levels[0])} до ${fmtK(rule.levels[1])} <span class="pt-src">(${esc(rule.levelsSrc)})</span>`));
  else rows.push(ruleRow(null, 'Личный КПР', `какие уровни допускались, в документах сезона не сказано — <span class="pt-unsure">правило уточняется у лиги</span>`));
  if (rule.age == null) {
    rows.push(ruleRow(null, 'Возраст пары', `${esc(rule.ageSrc)} — <span class="pt-unsure">правило уточняется у лиги</span>`));
  } else if (!withAge) {
    rows.push(ruleRow(null, 'Возраст пары', `сумма возрастов двоих — не меньше ${rule.age} лет. Возраст пары проверяет директор по анкетам; ответ «проходит / не проходит» видит только сам игрок про свою пару`
      + (rule.ageUnsure ? ' — <span class="pt-unsure">правило уточняется у лиги</span>' : '')));
  } else {
    const word = r.ageOk === true ? 'проходит' : r.ageOk === false ? 'не проходит' : 'нет данных';
    rows.push(ruleRow(r.ageOk, 'Возраст пары', `<b class="pt-age">${word}</b> · сумма возрастов двоих — не меньше ${rule.age} лет <span class="pt-src">(${esc(rule.ageSrc)})</span>`
      + (rule.ageUnsure ? ' — <span class="pt-unsure">правило уточняется у лиги</span>' : '')));
  }
  for (const x of rule.exceptions) {
    rows.push(ruleRow(null, 'Особый турнир', `${esc(x.name)} (${fmtDate(x.date)}) шёл с коридором ${esc(corridorText(x.range))}`));
  }
  if (rule.final && rule.season === 2026) {
    rows.push(ruleRow(null, 'Итоговый', 'в карточке турнира стоит «8.0»: читаем как «ровно 8.0» — <span class="pt-unsure">уточняется у лиги</span>'));
  }
  rows.push(`<li class="pt-rule pt-rule--src"><span class="pt-rule__body">Коридор взят из карточек турниров сезона на сайте лиги. Решение по заявке принимает директор турнира; сайт только подсказывает.</span></li>`);
  $('pt-rules').innerHTML = nb(rows.join(''));
}

/* ------------------------------------------------------------------ 02 · ищу напарника */

function history(meP, other) {
  const n = (meP.partners || []).find((x) => x.id === other.id)?.matches
    ?? (other.partners || []).find((x) => x.id === meP.id)?.matches;
  return n ? `играли вместе ${n} ${plural(n, 'матч', 'матча', 'матчей')}` : 'вместе ещё не играли';
}

const myApp = () => S.apps.find((x) => !x.seed && x.a === meId() && ['pending', 'approved'].includes(x.status));

function invite(id) { S.invites[id] = 'sent'; save(); renderSeek(); }
function revoke(id) { delete S.invites[id]; save(); renderSeek(); }
function accept(id) {
  S.invites[id] = 'accepted';
  const out = !checkPair(playerOf(meId()), playerOf(id), R2026).ok;
  S.apps = S.apps.filter((x) => !(x.a === meId() && x.b === id));
  S.apps.unshift({ id: `app-${meId()}-${id}`, a: meId(), b: id, status: 'pending', exception: false, out });
  // остальные приглашения снимаются: у игрока одна заявка на этап
  for (const k of Object.keys(S.invites)) if (k !== id) delete S.invites[k];
  save(); renderAll();
}
function cancelApp(appId) {
  const app = S.apps.find((x) => x.id === appId);
  if (app) { delete S.invites[app.b]; S.apps = S.apps.filter((x) => x.id !== appId); }
  save(); renderAll();
}

function actionsHTML(p, check) {
  if (!isPlayer()) return '';
  const st = S.invites[p.id];
  const app = myApp();
  if (st === 'accepted' && app?.b === p.id) {
    const txt = app.status === 'approved' ? 'Заявка утверждена' : 'Заявка у директора турнира · ждёт утверждения';
    return `<p class="pt-state pt-state--app">${esc(txt)}</p>`;
  }
  if (app) return '<p class="pt-state">У вас уже есть заявка на этот этап</p>';
  if (st === 'sent') {
    return `<p class="pt-state">Приглашение отправлено</p>
      <span class="cluster pt-acts"><button class="btn btn--secondary btn--sm" type="button" data-act="accept" data-id="${p.id}">Демо: он принял</button>
      <button class="btn btn--quiet btn--sm" type="button" data-act="revoke" data-id="${p.id}">Отозвать</button></span>`;
  }
  if (check.ok) return `<button class="btn btn--primary btn--sm" type="button" data-act="invite" data-id="${p.id}">Пригласить</button>`;
  return `<button class="btn btn--quiet btn--sm" type="button" data-act="invite" data-id="${p.id}">Пригласить всё равно</button>
    <p class="pt-state pt-state--note">Заявка уйдёт директору с пометкой «вне коридора». Пропустить её может только решение Совета.</p>`;
}

function seekers() { return DEMO_SEEKERS.map(playerOf).filter((p) => p && p.id !== meId()); }

function renderSeek() {
  const meP = playerOf(meId());
  const stageName = demoT ? demoT.name : 'Демо-этап';
  $('pt-seek-meta').innerHTML = '<span class="tag tag--demo">Демо-данные</span>';
  const stage = `Этап «${esc(stageName)}»${demoT ? ` (${fmtDate(demoT.date)})` : ''}, правила сезона 2026.`;
  const member = isPlayer();
  $('pt-seek-lede').innerHTML = member
    ? `${stage} Вы — ${esc(meP.short)}, КПР ${fmtK(meP.kpr)}. Сайт показывает всех, кто ищет пару, и сразу пишет, можно ли с ним играть и почему. Принятое приглашение становится заявкой, её утверждает админ.`
    : `${stage} Кто именно ищет пару, видят только вошедшие члены лиги: у каждого сразу написано, можно ли с ним играть. Здесь — только числа.`;
  $('pt-seek-bar').hidden = !member;
  const nums = $('pt-seek-nums');
  nums.hidden = member;
  if (!member) {
    const seek = [meP, ...seekers()];
    const rows = seekingByLevel(seek, R2026.corridor).filter((x) => x.seeking);
    nums.innerHTML = `<p>Сейчас ищут пару: <b class="num">${seek.length}</b> ${plural(seek.length, 'игрок', 'игрока', 'игроков')}. По уровням:</p>
      <ul class="pt-seek__lvls">${rows.map((x) => `<li>${kprChipHTML(x.level)}<span class="num">— ${x.seeking}</span></li>`).join('')}</ul>`;
  }
  if (!member) {
    $('pt-list').innerHTML = '';
    const g = $('pt-guestnote');
    g.hidden = false;
    g.innerHTML = `Имена и проверку «можно / нельзя» видят только члены лиги. Войдите как член лиги. <button class="btn btn--secondary btn--sm" type="button" data-setrole="player">Войти как игрок (демо)</button>`;
    renderMine();
    renderDrop();
    return;
  }

  const list = seekers().map((p) => ({ p, c: checkPair(meP, p, R2026) }))
    .sort((x, y) => (y.c.ok - x.c.ok) || (x.p.kpr - y.p.kpr));
  const shown = ui.filter === 'ok' ? list.filter((x) => x.c.ok) : list;
  for (const b of $('pt-filter').querySelectorAll('.seg__btn')) b.setAttribute('aria-pressed', String(b.dataset.f === ui.filter));

  $('pt-list').innerHTML = nb(shown.map(({ p, c }) => `
    <li class="pt-row ${c.ok ? 'is-ok' : 'is-no'}" data-pid="${p.id}">
      <span class="pt-row__who">${pairBallHTML(meP.kpr, p.kpr, { size: 40, decorative: true })}${playerCardHTML(p, { size: 'sm', rank: 'none', short: true })}</span>
      <span class="pt-row__verdict">${c.ok ? ICON.ok : ICON.no}<span><b>${c.ok ? 'Можно' : 'Нельзя'}</b>${c.ok ? ` · сумма ${fmtK(c.sum)}` : `, потому что ${esc(c.reasons.join('; '))}`}</span></span>
      <span class="pt-row__fact cap">${esc(history(meP, p))}</span>
      <span class="pt-row__act">${actionsHTML(p, c)}</span>
    </li>`).join(''));

  const g = $('pt-guestnote');
  g.hidden = true;
  g.innerHTML = '';

  renderMine();
  renderDrop();
}

$('pt-filter').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (b) { ui.filter = b.dataset.f; renderSeek(); }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b) {
    const id = b.dataset.id;
    if (b.dataset.act === 'invite') invite(id);
    else if (b.dataset.act === 'revoke') revoke(id);
    else if (b.dataset.act === 'accept') accept(id);
    else if (b.dataset.act === 'cancel') cancelApp(id);
    else if (b.dataset.act === 'approve' || b.dataset.act === 'return') decide(id, b.dataset.act);
    else if (b.dataset.act === 'exception') toggleException(id);
    return;
  }
  const r = e.target.closest('[data-setrole]');
  if (r) setRole(r.dataset.setrole);
});

function renderMine() {
  const wrap = $('pt-mine-wrap');
  wrap.hidden = !isPlayer();
  if (!isPlayer()) return;
  const meP = playerOf(meId());
  const items = [];
  for (const [id, st] of Object.entries(S.invites)) {
    const p = playerOf(id);
    if (!p) continue;
    const app = S.apps.find((x) => x.a === meId() && x.b === id);
    const status = st === 'sent' ? 'ждём ответа'
      : app?.status === 'approved' ? (app.exception ? 'утверждена по решению Совета' : 'утверждена')
      : app?.status === 'returned' ? 'админ вернул на уточнение' : 'у директора турнира, ждёт утверждения';
    items.push(`<li class="pt-mine__row">${pairBallHTML(meP.kpr, p.kpr, { size: 32, decorative: true })}
      <span class="pt-mine__txt"><b>${esc(meP.last)} + ${esc(p.last)}</b> · сумма ${fmtK(meP.kpr + p.kpr)} · ${esc(status)}</span>
      ${app ? `<button class="btn btn--quiet btn--sm" type="button" data-act="cancel" data-id="${app.id}">Отменить заявку</button>` : ''}</li>`);
  }
  $('pt-mine').innerHTML = items.join('') || '<li class="pt-mine__empty">Пока пусто. Нажмите «Пригласить» у подходящего игрока.</li>';
}

/* ------------------------------------------------------------------ 02б · замена выбывшего */

const DROP_OPTS = [
  { id: 'early', label: `За ${DEMO_STAGE.daysToDraw} дней до жеребьёвки`, days: DEMO_STAGE.daysToDraw },
  { id: 'late', label: 'За 6 дней', days: 6 },
  { id: 'after', label: 'После жеребьёвки', days: 'after' },
];
function renderDrop() {
  const meP = playerOf(meId());
  const mate = playerOf((meP.partners || [])[0]?.id) || playerOf('d05');
  $('pt-drop-mate').textContent = mate.short;
  $('pt-drop-when').innerHTML = DROP_OPTS.map((o) => `<button class="seg__btn" type="button" data-drop="${o.id}" aria-pressed="${o.id === ui.drop}">${esc(o.label)}</button>`).join('');
  const st = replacementState(DROP_OPTS.find((o) => o.id === ui.drop).days);
  const fits = seekers().filter((p) => p.id !== mate.id && checkPair(meP, p, R2026).ok);
  const chips = fits.map((p) => `<li class="pt-fit">${pairBallHTML(meP.kpr, p.kpr, { size: 28, decorative: true })}<span>${esc(p.short)}</span>${kprChipHTML(p.kpr)}</li>`).join('');
  let html;
  if (st.phase === 'early') {
    html = `<p class="pt-drop__lead">${ICON.ok}<span>Время есть. Пара не снимается, вы ищете замену. Подходят по правилам сезона — ${fits.length} ${plural(fits.length, 'игрок', 'игрока', 'игроков')}:</span></p><ul class="pt-fits">${chips}</ul>`;
  } else if (st.phase === 'late') {
    html = `<p class="pt-drop__lead">${ICON.ask}<span>До жеребьёвки меньше 10 дней. Сообщить директору нужно сразу. Можно ли в эти дни заменить напарника — <span class="pt-unsure">правило уточняется у лиги</span>. Если директор разрешит, подходят:</span></p><ul class="pt-fits">${chips}</ul>`;
  } else {
    html = `<p class="pt-drop__lead">${ICON.no}<span>После жеребьёвки состав пары не меняется: пара снимается целиком. Подбор замены не предлагаем.</span></p>`;
  }
  $('pt-drop-out').innerHTML = html;
  $('pt-drop').hidden = !isPlayer();
}
$('pt-drop-when').addEventListener('click', (e) => {
  const b = e.target.closest('[data-drop]');
  if (b) { ui.drop = b.dataset.drop; renderDrop(); }
});

/* ------------------------------------------------------------------ 03 · кто ищет пару */

function renderCount() {
  const c = R2026.corridor;
  const seek = [playerOf(meId()), ...seekers()];
  const rows = seekingByLevel(seek, c).filter((r) => r.seeking);
  $('pt-count-demo').innerHTML = `
    <h3 class="pt-count__title">Сейчас на этап <span class="tag tag--demo">Демо-данные</span></h3>
    <p class="pt-count__lede">Ищут пару: ${seek.length} ${plural(seek.length, 'игрок', 'игрока', 'игроков')}. Коридор ${esc(corridorText(c))}.</p>
    <div class="tscroll"><table class="tbl pt-tbl">
      <thead><tr><th>Уровень</th><th class="r">Ищут пару</th><th class="r">Подходящих вариантов</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${kprChipHTML(r.level)}</td><td class="r n">${r.seeking}</td><td class="r n">${r.options}</td></tr>`).join('')}</tbody>
    </table></div>`;

  const pools = simulate(D, c).pools;
  $('pt-count-arch').innerHTML = `
    <h3 class="pt-count__title">Сезон 2026 · архив лиги</h3>
    <p class="pt-count__lede">Все, кто сыграл хотя бы один этап 2026: ${D.players.total} ${plural(D.players.total, 'игрок', 'игрока', 'игроков')}. Сколько у каждого уровня допустимых напарников при коридоре ${esc(corridorText(c))}.</p>
    <div class="tscroll"><table class="tbl pt-tbl">
      <thead><tr><th>Уровень</th><th class="r">Игроков</th><th>Подходят</th><th class="r">Вариантов</th></tr></thead>
      <tbody>${pools.map((r) => `<tr><td>${kprChipHTML(r.level)}</td><td class="r n">${r.players}</td><td>${r.partnerLevels.map((l) => kprChipHTML(l)).join(' ') || '—'}</td><td class="r n">${r.pool}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="pt-src">КПР — по рейтингу лиги на ${fmtDate(D.ratingDate || RATING_DATE)}, а не на день турнира.</p>`;
}

/* ------------------------------------------------------------------ 04 · личное предупреждение */

function renderWarn() {
  const box = $('pt-warn');
  if (!isPlayer()) {
    box.innerHTML = `<p class="pt-locked panel panel--pad">${ICON.ask}<span>Это предупреждение видит только сам игрок, и только про себя. Админ, судья и гость его не видят. <button class="btn btn--secondary btn--sm" type="button" data-setrole="player">Смотреть как игрок</button></span></p>`;
    return;
  }
  const meP = playerOf(meId());
  const partners = (meP.partners || []).map((x) => ({ id: x.id, short: x.short, kpr: x.kpr ?? playerOf(x.id)?.kpr, matches: x.matches }));
  const w = riseWarning(meP, partners, R2026.corridor);
  const how = 'Как КПР переходит на следующую ступень — <span class="pt-unsure">уточняется у лиги</span>. Здесь показано, что будет, если ваш КПР станет следующим уровнем из тех, что сейчас есть в рейтинге лиги.';
  if (!w) {
    box.innerHTML = `<div class="panel panel--pad pt-warn"><p>${esc(meP.short)}: КПР ${fmtK(meP.kpr)} — самый высокий уровень в рейтинге лиги сейчас.</p><p class="pt-src">Как КПР переходит на следующую ступень — <span class="pt-unsure">уточняется у лиги</span>.</p></div>`;
    return;
  }
  const leave = w.leave.map((p) => `<li>${pairBallHTML(w.next, p.kpr, { size: 28, decorative: true })}<span>ваша пара <b>${esc(meP.last)} и ${esc(playerOf(p.id)?.last || p.short)}</b>: сумма станет ${fmtK(w.next)} + ${fmtK(p.kpr)} = ${fmtK(p.sum)} — выше коридора ${esc(corridorText(R2026.corridor))}</span></li>`).join('');
  box.innerHTML = nb(`
    <div class="panel panel--pad pt-warn is-you">
      <p class="pt-warn__lead"><span class="tag tag--you">Видите только вы</span></p>
      <p class="pt-warn__main">Если ваш КПР вырастет до <b class="num">${fmtK(w.next)}</b>, ${w.leave.length ? (w.leave.length === 1 ? 'ваша постоянная пара выйдет из коридора:' : 'ваши постоянные пары выйдут из коридора:') : 'ваши постоянные пары останутся в коридоре.'}</p>
      ${leave ? `<ul class="pt-warn__list">${leave}</ul>` : ''}
      <p>Подходить будут напарники уровня ${w.levels.map((l) => kprChipHTML(l)).join(' ') || '— никого'}.</p>
      <p class="pt-src">${how}</p>
    </div>`);
}

/* ------------------------------------------------------------------ 05 · вид Совета */

const PRESETS = [
  { label: '2023', c: [7.0, 8.0] }, { label: '2024', c: [8.0, 8.5] },
  { label: '2025–2026', c: [7.5, 8.0] }, { label: 'Итоговый 2026', c: [8.0, 8.0] },
];

function simShell() {
  return `
    <div class="pt-sim">
      <div class="pt-sim__ctrl panel panel--pad">
        <p class="cap cap--strong">Как было</p>
        <div class="pt-presets" id="pt-presets">${PRESETS.map((p) => `<button class="btn btn--secondary btn--sm" type="button" data-lo="${p.c[0]}" data-hi="${p.c[1]}">${esc(p.label)} · ${esc(corridorText(p.c))}</button>`).join('')}</div>
        <p class="pt-sim__now"><span class="cap">Коридор суммы КПР</span><b class="pt-sim__range num" id="pt-range"></b></p>
        <label class="field pt-slider"><span class="field__label cap">Нижняя граница · <b class="num" id="pt-lo-v"></b></span>
          <input type="range" id="pt-lo" min="6" max="10" step="0.5" aria-describedby="pt-range"></label>
        <label class="field pt-slider"><span class="field__label cap">Верхняя граница · <b class="num" id="pt-hi-v"></b></span>
          <input type="range" id="pt-hi" min="6" max="10" step="0.5" aria-describedby="pt-range"></label>
        <p class="pt-decide">${ICON.ask}<span>Сайт считает, решает Совет. Новый коридор вступает в силу только решением Совета.</span></p>
      </div>
      <div class="pt-sim__out" aria-live="polite">
        <div class="stats pt-stats" id="pt-stats"></div>
        <h3 class="pt-sub__title">Заявки 2026 по сочетаниям уровней</h3>
        <ul class="pt-bars" id="pt-bars"></ul>
        <h3 class="pt-sub__title">У кого останутся напарники</h3>
        <div class="tscroll"><table class="tbl pt-tbl" id="pt-pools"></table></div>
      </div>
    </div>
    <div class="pt-sim__facts">
      <div class="panel panel--pad pt-fact">
        <p class="cap cap--strong">Потолок 8.0</p>
        <p class="pt-fact__n num">${D.entries.bySum['8.0']} <small>из ${D.entries.total}</small></p>
        <p>заявок 2026 года стояли ровно на потолке 8.0 — это ${Math.round(D.entries.bySum['8.0'] / D.entries.total * 100)}%. Если КПР любого из двоих вырастет, такая пара выйдет из коридора.</p>
      </div>
      <div class="panel panel--pad pt-fact">
        <p class="cap cap--strong">Этапы 2026 · пар в списке</p>
        <div class="tscroll"><table class="tbl pt-tbl pt-stages"><thead><tr><th>Этап</th><th class="r">Пар</th><th class="r">«Вакантно»</th></tr></thead>
        <tbody>${D.stages.filter((s) => s.listed).map((s) => `<tr><td>${esc(s.name.replace('ИТОГОВЫЙ', 'Итоговый'))} <span class="cap pt-date">${fmtDate(s.date)}</span></td><td class="r n">${s.entries}</td><td class="r n">${s.vacant || '—'}</td></tr>`).join('')}</tbody></table></div>
        <p class="pt-src">${(() => { const big = D.stages.filter((s) => s.listed && s.entries > 32); return big.length ? `Больше 32 пар в списке (${big.map((s) => `${esc(s.name)} — ${s.entries}`).join(', ')}): по FAQ лиги при 36 заявках и больше проводится квалификация, в основу проходят 32 пары. ` : ''; })()}На четырёх этапах пар было меньше 32. Как лига проводит такие этапы — уточняется у лиги.</p>
      </div>
    </div>
    <p class="pt-src">Источник: списки пар этапов 2026 на сайте лиги (${D.entries.total} ${plural(D.entries.total, 'заявка', 'заявки', 'заявок')}, ${D.pairs.total} ${plural(D.pairs.total, 'разная пара', 'разные пары', 'разных пар')}, ${D.players.total} ${plural(D.players.total, 'игрок', 'игрока', 'игроков')}). КПР — по рейтингу на ${fmtDate(D.ratingDate || RATING_DATE)}, не на день турнира. Список пар Итогового 2026 на сайте пуст, поэтому он не учтён.</p>`;
}

function renderSimOut() {
  const s = simulate(D, [ui.lo, ui.hi]);
  $('pt-lo').value = ui.lo; $('pt-hi').value = ui.hi;
  $('pt-lo-v').textContent = fmtK(ui.lo); $('pt-hi-v').textContent = fmtK(ui.hi);
  $('pt-range').textContent = corridorText(s.corridor);
  $('pt-stats').innerHTML = `
    <div class="stat"><span class="stat__n">${s.entries.out}<small> из ${s.entries.total}</small></span><span class="cap">заявок не прошли бы</span></div>
    <div class="stat"><span class="stat__n">${s.pairs.out}<small> из ${s.pairs.total}</small></span><span class="cap">разных пар не прошли бы</span></div>
    <div class="stat"><span class="stat__n">${s.strandedPlayers}<small> из ${D.players.total}</small></span><span class="cap">игроков без допустимого напарника</span></div>`;

  const combos = Object.entries(D.combos).map(([k, n]) => { const [x, y] = k.split('+').map(Number); return { x, y, n, sum: x + y }; })
    .sort((a, b) => b.n - a.n);
  const max = Math.max(...combos.map((c) => c.n));
  $('pt-bars').innerHTML = combos.map((c) => {
    const ok = inCorridor(c.sum, s.corridor);
    return `<li class="pt-bar ${ok ? 'is-in' : 'is-out'}" title="${fmtK(c.x)} + ${fmtK(c.y)} = ${fmtK(c.sum)}: ${c.n} ${plural(c.n, 'заявка', 'заявки', 'заявок')}">
      <span class="pt-bar__lbl">${pairBallHTML(c.x, c.y, { size: 24, decorative: true })}<span class="num">${fmtK(c.x)} + ${fmtK(c.y)} = ${fmtK(c.sum)}</span></span>
      <span class="pt-bar__track"><span class="pt-bar__fill" style="--w:${(c.n / max * 100).toFixed(1)}%"></span></span>
      <span class="pt-bar__n num">${c.n}</span>
      <span class="pt-bar__st cap">${ok ? 'проходит' : 'не прошли бы'}</span></li>`;
  }).join('');

  $('pt-pools').innerHTML = `<thead><tr><th>Уровень</th><th class="r">Игроков</th><th>Подходят</th><th class="r">Вариантов</th></tr></thead><tbody>${
    s.pools.map((r) => `<tr class="${r.none ? 'pt-none' : ''}"><td>${kprChipHTML(r.level)}</td><td class="r n">${r.players}</td><td>${r.partnerLevels.map((l) => kprChipHTML(l)).join(' ') || '<b>не осталось напарников</b>'}</td><td class="r n">${r.pool}</td></tr>`).join('')}</tbody>`;
}

let simMounted = false;
function renderSim() {
  const box = $('pt-sim');
  $('pt-sim-meta').textContent = isCouncil() ? `Видят ${ROLE_LABELS.admin.toLowerCase()} и ${ROLE_LABELS.superadmin.toLowerCase()}` : 'Только Совет и админы';
  if (!isCouncil()) {
    simMounted = false;
    box.innerHTML = `<p class="pt-locked panel panel--pad">${ICON.ask}<span>Этот расчёт видят Совет, админ и суперадмин. Игрокам он не нужен. <button class="btn btn--secondary btn--sm" type="button" data-setrole="admin">Смотреть как админ</button></span></p>`;
    return;
  }
  if (!simMounted) {
    box.innerHTML = simShell();
    simMounted = true;
    const onInput = (which) => (e) => {
      ui[which] = Number(e.target.value);
      if (ui.lo > ui.hi) { if (which === 'lo') ui.hi = ui.lo; else ui.lo = ui.hi; }
      renderSimOut();
    };
    $('pt-lo').addEventListener('input', onInput('lo'));
    $('pt-hi').addEventListener('input', onInput('hi'));
    $('pt-presets').addEventListener('click', (e) => {
      const b = e.target.closest('[data-lo]');
      if (!b) return;
      ui.lo = Number(b.dataset.lo); ui.hi = Number(b.dataset.hi);
      renderSimOut();
    });
  }
  renderSimOut();
}

/* ------------------------------------------------------------------ 06 · очередь заявок */

function decide(appId, act) {
  const app = S.apps.find((x) => x.id === appId);
  if (!app) return;
  const out = !checkPair(playerOf(app.a), playerOf(app.b), R2026).ok;
  if (act === 'approve' && out && !app.exception) return;   // кнопка в этом случае выключена
  app.status = act === 'approve' ? 'approved' : 'returned';
  save(); renderAll();
}
function toggleException(appId) {
  const app = S.apps.find((x) => x.id === appId);
  if (app) { app.exception = !app.exception; save(); renderQueue(); }
}

function renderQueue() {
  const box = $('pt-queue');
  if (!isCouncil()) {
    box.innerHTML = `<p class="pt-locked panel panel--pad">${ICON.ask}<span>Очередь заявок видит админ. <button class="btn btn--secondary btn--sm" type="button" data-setrole="admin">Смотреть как админ</button></span></p>`;
    return;
  }
  if (!S.apps.length) {
    box.innerHTML = '<p class="panel panel--pad">Заявок нет. Переключитесь на «Игрок», пригласите напарника и нажмите «Демо: он принял».</p>';
    return;
  }
  box.innerHTML = `<ul class="pt-queue">${S.apps.map((app) => {
    const a = playerOf(app.a), b = playerOf(app.b);
    const c = checkPair(a, b, R2026);
    const status = app.status === 'approved' ? (app.exception ? 'Утверждена · исключение Совета' : 'Утверждена')
      : app.status === 'returned' ? 'Возвращена игроку' : 'Ждёт решения';
    const canApprove = c.ok || app.exception;
    return `<li class="pt-q ${c.ok ? 'is-ok' : 'is-no'}">
      <div class="pt-q__head">${pairBallHTML(a.kpr, b.kpr, { size: 40, decorative: true })}
        <span class="pt-q__names"><b>${esc(a.short)} + ${esc(b.short)}</b><span class="cap">сумма ${fmtK(c.sum)} · ${esc(status)}${app.seed ? '' : ' · из приглашения'}</span></span></div>
      <p class="pt-q__check">${c.ok ? ICON.ok : ICON.no}<span>${c.ok ? 'Сайт: ничего не нарушено.' : `Сайт: ${esc(c.reasons.map((x) => (/возраст/.test(x) ? `${x} (по анкетам; видит только админ)` : x)).join('; '))}. Сам сайт заявку не отклоняет.`}</span></p>
      ${app.status === 'pending' ? `<div class="pt-q__acts">
        ${c.ok ? '' : `<button class="switch" type="button" role="switch" aria-checked="${app.exception}" data-act="exception" data-id="${app.id}"><span class="switch__track" aria-hidden="true"></span><span>Исключение Совета</span></button>`}
        <span class="cluster"><button class="btn btn--primary btn--sm" type="button" data-act="approve" data-id="${app.id}"${canApprove ? '' : ' disabled aria-describedby="pt-q-' + app.id + '"'}>Утвердить</button>
        <button class="btn btn--quiet btn--sm" type="button" data-act="return" data-id="${app.id}">Вернуть игроку</button></span>
        ${canApprove ? '' : `<p class="pt-state pt-state--note" id="pt-q-${app.id}">Пара вне коридора: утвердить можно только по решению Совета — поставьте отметку.</p>`}
      </div>` : ''}
    </li>`;
  }).join('')}</ul>`;
}

/* ------------------------------------------------------------------ сборка */

function renderAll() {
  renderRole();
  renderSeek();
  renderCount();
  renderWarn();
  renderSim();
  renderQueue();
}

renderSeasons();
renderPickers();
renderCheck();
renderAll();

onIdentityChange(() => {
  if (isPlayer()) ui.a = meId();
  renderPickers(); renderCheck();
  renderAll();
});
window.addEventListener('storage', (e) => { if (e.key === LS) { S = load(); renderAll(); } });

// для проверки сценариев
window.__partner = { ui, state: () => S, LEVELS, partnerLevels };
