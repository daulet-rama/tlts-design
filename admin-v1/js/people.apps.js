// ============================================================
// «Заявки в лигу»: очередь заявок и одна заявка.
// applications.html — очередь: каждая заявка — карточка-ссылка: кто (фото), шаг пути, одна строка фактов
//   («… · сам оценивает 4.0») и следующий шаг словом («Назначить уровень»). Решают внутри заявки.
// applications.html?a=esenov — вступление: в начале фото кандидата и путь одной строкой, вопрос шага
//   и кнопка прямо под ним, анкета с блоком «Со слов кандидата», история и рядом настоящие экраны
//   приложения в рамке телефона: «Вступление» и вкладка «Я» (join.html?trial, me.html);
// applications.html?a=zhaksybekov — «похоже, это один и тот же человек»: объединить или развести.
// Шаг заявки — join.<заявка> в общем состоянии: { step, level, asked, from }. Мир и сделанное — D.joinNow().
// Профиль кандидата — то, что он написал о себе сам: фото, «О себе и достижения», самооценка (OWN).
// Фото убрали — profiles.<заявка> = { photo: 'removed', why, at }.
// Обычное — сразу и с «Отменить»; отказ — окном со словами и красной кнопкой; «Убрать фото» — окном
// с причиной и без «Отменить»: фото стирается сразу (на сервере это команда photos:remove).
// ============================================================
import {
  D, esc, icon, toast, hydrate, previewPanel, whereHtml, confirmAction, openSheet, closeLayer, plural, MON_GEN, state, at, currentTheme,
} from '../admin.js';
import {
  $, person, av, ini, kprText, rankName, sectionTabs, journalRows, genFirst, genName, dat, datLast, markIn, pvCaption, ic, live,
} from './people.js';
import { appOf, appNow, STEP_AT, NEWCOMER_KPR, OWN, PHOTO_WHY, APP_USERS_KEY } from './people.data.js';

const params = new URLSearchParams(location.search);
const head = $('#head');
const work = $('#work');
const A = D.APPLICANT;
// путь одной строкой — короткими словами; полные названия шагов — в ярлыке у заголовка
const STEPS = ['Регистрация', 'Анкета', 'Уровень', 'Совет', 'Взнос', 'В лиге'];
const OPEN = { join: ['level', 'council', 'fee'], merge: ['match'] };

// ---------- шаг заявки: мир и сделанное ----------
const st = (a) => appNow(a.id);
const isOpen = (a, s = st(a)) => OPEN[a.kind].includes(s.step);
const hrefOf = (a) => `applications.html?a=${a.id}`;
// номер шага на пути: отказ — там, где отказали («Оценка уровня» или «Решение Совета»)
const stepNo = (s) => (s.step === 'declined' ? (s.from === 'level' ? 3 : 4) : STEP_AT[s.step]);
// выбранный, но ещё не записанный уровень — только на этой странице
const picks = {};

// ---------- что кандидат написал о себе сам ----------
const PHOTO = OWN.photo ? at(OWN.photo) : null;
const goneOf = (a) => { const g = state.get(`profiles.${a.id}`, null); return g && g.photo === 'removed' ? g : null; };
const hasPhoto = (a) => a.kind === 'join' && !!PHOTO && !goneOf(a);
// самооценка: «4.0», «не знает», «не указал»
const selfLevel = () => (OWN.level === 'unknown' ? 'не знает' : OWN.level || 'не указал');
// в строке фактов очереди — «сам оценивает 4.0»
const selfFact = () => (OWN.level === 'unknown' ? 'свой уровень не знает' : OWN.level ? `сам оценивает ${OWN.level}` : '');
const whyOf = (v) => PHOTO_WHY.find((r) => r.v === v) || null;
// кружок кандидата: его фото (кадр сервера — середина по центру) или инициалы
const candAv = (a, cls = 'pp56') => (hasPhoto(a)
  ? `<span class="av ${cls} pp-uav"><img src="${esc(PHOTO)}" alt="" loading="lazy"></span>`
  : `<span class="av ${cls}" aria-hidden="true">${esc(ini(who(a)))}</span>`);

// ---------- слова ----------
const who = (a) => (a.kind === 'join' ? { first: A.first, last: A.last, name: `${A.first} ${A.last}` } : { ...a.typed, name: `${a.typed.first} ${a.typed.last}` });
const pl = (a) => person(a.player);
const gf = (a) => genFirst(who(a).first);      // «Армана»
function stateTag(a, detail = false) {
  const s = st(a);
  if (a.kind === 'merge') return { match: `<span class="tag warn">${detail ? 'Ждёт решения' : 'Один человек?'}</span>`, merged: '<span class="tag ok">Объединено</span>', apart: '<span class="tag past">Разные люди</span>' }[s.step];
  return {
    level: '<span class="tag warn">Шаг 3 из 6: оценка уровня</span>',
    council: '<span class="tag warn">Шаг 4 из 6: решение Совета</span>',
    fee: '<span class="tag info">Шаг 5 из 6: взнос</span>',
    member: '<span class="tag ok">Член лиги</span>',
    declined: '<span class="tag bad">Отказ</span>',
  }[s.step];
}
const birthWords = (s) => { const [d, m, y] = s.split('.').map(Number); return `${d} ${MON_GEN[m - 1]} ${y}`; };
const ageOn = (birth, on) => { const [d, m, y] = birth.split('.').map(Number); const [yy, mm, dd] = on.split('-').map(Number); let age = yy - y; if (mm < m || (mm === m && dd < d)) age -= 1; return age; };
const fit = (ok, t) => (ok === true ? `<span class="fit-ok">${icon('check')}${t}</span>` : ok === false ? `<span class="fit-no">${icon('alert')}${t}</span>` : `<span class="fit-un">${icon('info')}${t}</span>`);
const years = () => `${A.pairYears} ${plural(+A.pairYears, 'год', 'года', 'лет')}`;
const ageOk = () => ageOn(A.birth, D.NOW.iso) >= 25;   // условие Положения: от 25 лет
// что видит кандидат после отказа — те же слова, что в приложении (app-v2/js/join.data.js)
const refusedWords = (from) => (from === 'level' ? 'Лига отказала в членстве. Причину сообщит лига' : 'Совет отказал в членстве. Причину сообщит лига');
// следующий шаг словом — в очереди на карточке
function nextOf(a) {
  const s = st(a);
  if (a.kind === 'merge') return s.step === 'match' ? 'Сравнить и решить' : null;
  return { level: 'Назначить уровень', council: 'Внести решение Совета', fee: 'Отметить взнос' }[s.step] || null;
}
// главное действие шага внутри заявки: вопрос, слово на кнопке и что увидит человек
function goOf(a) {
  const s = st(a); const n = who(a).first;
  if (a.kind === 'merge') return s.step === 'match' ? { q: `Похоже, это ${pl(a).name}`, t: 'Объединить', sees: `${n} войдёт и увидит свою карту игрока` } : null;
  return {
    level: { q: `Какой уровень КПР дать ${dat(n)}?`, t: picks[a.id] ? `Записать уровень ${kprText(picks[a.id])}` : 'Записать уровень', sees: `${n} увидит: шаг 4 из 6 — решение Совета` },
    council: { q: `Совет одобрил членство ${gf(a)}?`, t: 'Совет одобрил', sees: `${n} увидит: «Членство одобрено», дальше взнос` },
    fee: { q: `${n} заплатил взнос?`, t: 'Взнос получен — принять в лигу', sees: `${n} станет членом лиги и увидит свою членскую карту` },
  }[s.step] || null;
}

// ============================================================
// ДЕЙСТВИЯ — каждое пишет шаг в общее состояние и строку журнала («Вы …»)
// ============================================================
let redraw = () => {};
let paint = () => {};            // перерисовать заявку на месте, без прокрутки
let justChanged = null;          // заявка, которая только что сменила шаг: в рамке приложения — метка «Новое»
let justAsked = false;           // изменился только вопрос — шаг тот же
let justPhoto = null;            // у этой заявки только что убрали фото: в рамке — вкладка «Я» с меткой «Новое»
let pvView = 'join';             // какой экран приложения в рамке: 'join' — «Вступление», 'me' — вкладка «Я»
let mountPv = () => {};          // заново собрать рамку «Так увидит» (после переключения экрана)
function act(a, patch, say, toastText) {
  const s = st(a);
  const next = { step: s.step, level: s.level ?? null, asked: s.asked ?? null, ...patch };
  justChanged = a.id;
  justPhoto = null;
  justAsked = Object.keys(patch).length === 1 && 'asked' in patch;
  if (patch.step) delete picks[a.id];
  const undo = state.set(`join.${a.id}`, next, { say, href: hrefOf(a) });
  redraw(a);
  toast(toastText, { undo: () => { justChanged = null; undo(); } });
}
// чего не хватает — строкой под главной кнопкой шага
function pickMsg(a, text) {
  const box = document.querySelector(`[data-msg="${a.id}"]`);
  if (!box) return;
  box.textContent = text; box.hidden = !text;
  if (text) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function advance(a) {
  const s = st(a); const w = who(a);
  if (a.kind === 'merge') { const p = pl(a); act(a, { step: 'merged', asked: null }, `объединили вход «${w.name}» с карточкой игрока лиги: ${p.name}`, `Объединено: это ${p.name}`); return; }
  if (s.step === 'level') {
    const k = picks[a.id];
    if (!k) { pickMsg(a, 'Сначала выберите уровень: 3.5, 4.0 или 4.5'); document.querySelector(`[data-kpr="${a.id}"] .chip`)?.focus({ preventScroll: true }); return; }
    act(a, { step: 'council', level: k }, `записали ${dat(w.first)} ${datLast(w.last)} уровень КПР при вступлении — ${kprText(k)}`, `Уровень ${kprText(k)} записан`);
  } else if (s.step === 'council') {
    act(a, { step: 'fee' }, `внесли решение Совета: членство ${genName(w)} одобрено`, 'Записано: Совет одобрил');
  } else if (s.step === 'fee') {
    act(a, { step: 'member', asked: null }, `приняли ${genName(w)} в лигу: взнос получен`, `${w.name} принят в лигу`);
  }
}
function decline(a) {
  const w = who(a);
  if (a.kind === 'merge') { const p = pl(a); act(a, { step: 'apart', asked: null }, `решили, что вход «${w.name}» и игрок лиги ${p.name} — разные люди`, 'Записано: это разные люди'); return; }
  // отказ на шаге «Оценка уровня» — от лиги, на шаге Совета — решение Совета; кандидат видит разные слова
  const from = st(a).step === 'level' ? 'level' : 'council';
  confirmAction({
    title: `Отказать ${dat(A.first)} ${datLast(A.last)} в членстве?`,
    text: `${A.first} увидит это в приложении сразу.`,
    consq: [`«${refusedWords(from)}»`],
    action: 'Отказать в членстве',
    onConfirm: () => act(a, { step: 'declined', asked: null, from },
      from === 'level' ? `отказали ${dat(w.first)} ${datLast(w.last)} в членстве на шаге оценки уровня` : `внесли решение Совета: ${dat(w.first)} ${datLast(w.last)} отказано в членстве`,
      `Отказ записан: ${w.name}`),
  });
}
// «Спросить»: короткий вопрос словами, человек увидит его у себя
function ask(a) {
  const w = who(a); const name = w.first;
  const quick = a.kind === 'join'
    ? ['Вы играли в профессиональных турнирах?', 'Где вы играли в паре последние годы?']
    : [`Это вы — ${pl(a).name}, игрок лиги с ${pl(a).since} года?`];
  const s = openSheet({
    title: `Вопрос ${dat(name)}`,
    body: `<div class="field full" id="q-f"><label class="label" for="q-t">Ваш вопрос</label><span class="err">${icon('alert')}<span>Напишите вопрос</span></span><textarea class="input" id="q-t" rows="4" autofocus></textarea></div>
      <div class="stack tight"><span class="sublabel">Или возьмите готовый</span><div class="chips">${quick.map((q) => `<button type="button" class="chip pp-qchip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`,
    foot: `<p class="who-sees pp-sees">${icon('eye')}<span>${esc(name)} увидит вопрос в приложении${a.kind === 'join' ? ', на экране «Вступление»' : ' при входе'}</span></p><button class="btn main" type="button" data-ok>${ic('msg')}Задать вопрос ${esc(dat(name))}</button><button class="btn quiet" type="button" data-no>Отмена</button>`,
  });
  const t = $('#q-t', s); const f = $('#q-f', s);
  s.addEventListener('click', (e) => { const c = e.target.closest('[data-q]'); if (c) { t.value = c.dataset.q; f.classList.remove('error'); t.focus(); } });
  t.addEventListener('input', () => f.classList.remove('error'));
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  s.querySelector('[data-ok]').addEventListener('click', () => {
    const q = t.value.trim();
    if (!q) { f.classList.add('error'); t.focus(); return; }
    closeLayer(true);
    act(a, { asked: q }, `спросили ${genName(w)}: «${q}»`, `Вопрос задан — ${name} увидит его в приложении`);
  });
}
// «Принять в лигу сразу»: Совет уже решил и взнос получен — одно окно вместо трёх шагов
function acceptAll(a) {
  const s0 = st(a);
  const needK = s0.step === 'level';
  let k = needK ? picks[a.id] || null : s0.level;
  const box = (id, t, on) => `<label class="check"><input type="checkbox" id="${id}"${on ? ' checked' : ''}><span class="box">${icon('check')}</span><span>${t}</span></label>`;
  const s = openSheet({
    title: `Принять ${genName(A)} в лигу`,
    body: `${needK
      ? `<div class="field full"><span class="label" id="aa-kl">Уровень КПР при вступлении</span><div class="chips pp-kchips" role="radiogroup" aria-labelledby="aa-kl" id="aa-k">${NEWCOMER_KPR.map((v) => `<button type="button" class="chip" role="radio" aria-checked="${k === v}" data-value="${v}">${icon('check')}${kprText(v)}</button>`).join('')}</div></div>`
      : `<p class="pp-line">Уровень КПР при вступлении — <b class="num">${kprText(k)}</b></p>`}
      <div class="stack tight"><span class="label">Отметьте, что уже есть</span><div class="checks">${box('aa-c', 'Совет одобрил членство', s0.step === 'fee')}${box('aa-f', 'Взнос получен', false)}</div></div>`,
    foot: `<p class="pick-msg" id="aa-msg" role="alert" hidden></p><p class="who-sees pp-sees">${icon('eye')}<span>${esc(A.first)} увидит свою членскую карту</span></p><button class="btn main" type="button" data-ok>${icon('check')}Принять в лигу</button><button class="btn quiet" type="button" data-no>Отмена</button>`,
  });
  const msg = $('#aa-msg', s);
  s.addEventListener('change', (e) => { if (e.target.closest('#aa-k')) k = +e.detail; msg.hidden = true; });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  s.querySelector('[data-ok]').addEventListener('click', () => {
    const miss = [];
    if (!k) miss.push('уровень');
    if (!$('#aa-c', s).checked) miss.push('решение Совета');
    if (!$('#aa-f', s).checked) miss.push('взнос');
    if (miss.length) { msg.textContent = `Чтобы принять, отметьте: ${miss.join(', ')}`; msg.hidden = false; return; }
    closeLayer(true);
    act(a, { step: 'member', level: k, asked: null }, `приняли ${genName(A)} в лигу: уровень ${kprText(k)}, Совет одобрил, взнос получен`, `${who(a).name} принят в лигу · уровень ${kprText(k)}`);
  });
}
function back(a, to) {
  const w = who(a);
  if (a.kind === 'merge') {
    const p = pl(a);
    if (to === 'unmerge') act(a, { step: 'match' }, `разъединили вход «${w.name}» и карточку игрока лиги ${p.name}`, 'Разъединено: заявка снова ждёт решения');
    else act(a, { step: 'match' }, `вернули в очередь вход «${w.name}»: снова ждёт решения`, 'Заявка снова ждёт решения');
    return;
  }
  if (to === 'fee') act(a, { step: 'fee' }, `отменили решение: ${w.name} снова ждёт взноса`, 'Решение отменено: снова ждём взнос');
  else if (to === 'level') act(a, { step: 'level' }, `вернули заявку ${genName(w)} в очередь: снова ждёт оценки уровня`, 'Заявка снова ждёт оценки уровня');
  else act(a, { step: 'council' }, `вернули заявку ${genName(w)} в очередь: снова ждёт решения Совета`, 'Заявка снова ждёт решения Совета');
}

// «Убрать фото»: окно с причиной (те же три, что у команды сервера). «Отменить» нет: фото стирается сразу.
// Кандидат видит в профиле «Фото убрал организатор» и может загрузить другое; причина — в журнале действий.
function photoSheet(a) {
  const w = who(a); const name = w.first;
  let pick = null;
  const s = openSheet({
    title: `Убрать фото ${genFirst(name)}?`,
    body: `<div class="pp-rm-who"><span class="pp-cphoto sm">${PHOTO ? `<img src="${esc(PHOTO)}" alt="">` : ''}</span><b class="h3">${esc(w.name)}</b></div>
      <div class="stack tight"><h3 class="h3" id="rm-why">Почему?</h3>
      <div class="choices one pp-why" role="radiogroup" aria-labelledby="rm-why">${PHOTO_WHY.map((r) => `<button type="button" class="choice" role="radio" aria-checked="false" data-value="${r.v}"><span class="t">${esc(r.t)}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div></div>
      <div class="pp-say"><span class="k">${esc(name)} увидит в профиле</span><b>«Фото убрал организатор»</b><span class="s">и сможет загрузить другое. Причину он не увидит — она останется в журнале действий</span></div>`,
    // что фото не вернуть — рядом с красной кнопкой: на телефоне низ шторки виден всегда
    foot: `<p class="pick-msg" role="alert" hidden></p><p class="pp-rm-warn">${icon('alert')}<span>Фото сотрётся сразу — вернуть его нельзя</span></p><button class="btn danger" type="button" data-ok>${icon('trash')}Убрать фото</button><button class="btn quiet" type="button" data-no autofocus>Отмена</button>`,
  });
  const msg = s.querySelector('.pick-msg');
  s.querySelector('[role="radiogroup"]').addEventListener('change', (e) => { pick = e.detail; msg.hidden = true; });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  s.querySelector('[data-ok]').addEventListener('click', () => {
    if (!pick) { msg.textContent = 'Выберите причину'; msg.hidden = false; s.querySelector('.pp-why [role="radio"]').focus(); return; }
    closeLayer(true);
    removePhoto(a, pick);
  });
}
function removePhoto(a, why) {
  const w = who(a); const r = whyOf(why);
  justPhoto = a.id; justChanged = null; pvView = 'me';
  // «Отменить» не даём: на сервере фото уже стёрто. Вернуть пример целиком — «Начать пример заново»
  state.set(`profiles.${a.id}`, { photo: 'removed', why, at: state.now() }, { say: `убрали фото ${genName(w)}: ${r ? r.log : why}`, href: hrefOf(a) });
  paint();
  document.getElementById('photo-gone')?.focus({ preventScroll: true });
  toast(`Фото убрано. ${w.first} видит в профиле «Фото убрал организатор»`);
}

// одна точка для всех кнопок: data-act + data-app (на кнопке или на карточке)
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const host = b.closest('[data-app]');
  const a = host && appOf(host.dataset.app);
  if (!a) return;
  const k = b.dataset.act;
  if (k === 'go') advance(a);
  else if (k === 'ask') ask(a);
  else if (k === 'decline') decline(a);
  else if (k === 'all') acceptAll(a);
  else if (k === 'back') back(a, b.dataset.to);
  else if (k === 'photo') photoSheet(a);
});
// уровень: выбор сразу виден на главной кнопке — «Записать уровень 4.0»
document.addEventListener('change', (e) => {
  const g = e.target.closest('[data-kpr]');
  if (!g) return;
  const a = appOf(g.dataset.kpr);
  picks[a.id] = +e.detail;
  const b = document.querySelector(`[data-app="${a.id}"] .pp-go [data-act="go"] span`);
  if (b) b.textContent = goOf(a).t;
  pickMsg(a, '');
});

// ============================================================
// РАМКА «ТАК УВИДИТ»: настоящие экраны пробной версии приложения
// Страницы приложения (join.html?trial, me.html) читают аккаунт, профиль и заявку из памяти браузера —
// той же, что у страниц приложения (APP_USERS_KEY). Чтобы показать кандидата таким, как здесь (шаг,
// уровень, фото убрано), и не тронуть пример приложения в этом браузере, перед загрузкой рамки страница
// кладёт туда кандидата, а как только рамка загрузилась — возвращает прежнее.
// ============================================================
let lendWhat = null;   // () => состояние приложения для рамки
let lent;              // что лежало до рамки: строка, null — записи не было; undefined — ничего не брали
let lendTimer = 0; let backTimer = 0;
function giveBack() {
  clearTimeout(lendTimer); clearTimeout(backTimer);
  if (lent === undefined) return;
  try { if (lent === null) localStorage.removeItem(APP_USERS_KEY); else localStorage.setItem(APP_USERS_KEY, lent); } catch { /* память закрыта — и брать было нечего */ }
  lent = undefined;
}
function lend() {
  if (!lendWhat) return;
  try {
    if (lent === undefined) lent = localStorage.getItem(APP_USERS_KEY);
    localStorage.setItem(APP_USERS_KEY, JSON.stringify(lendWhat()));
  } catch { return; }
  clearTimeout(lendTimer); clearTimeout(backTimer);
  lendTimer = setTimeout(giveBack, 8000);   // рамка так и не загрузилась — всё равно вернуть
}
// рамка загрузилась — вернуть чуть позже: следом может грузиться вторая рамка (шторка «Так увидит»)
const giveBackSoon = () => { clearTimeout(backTimer); backTimer = setTimeout(giveBack, 1200); };
// рамку вставили или переставили (шторка «Так увидит» на узком экране) — она загрузится заново
new MutationObserver((list) => {
  if (list.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1 && (n.matches('iframe') || n.querySelector('iframe'))))) lend();
}).observe(document.body, { childList: true, subtree: true });
// сменили тему — рамка загрузится заново в новой теме
let themeNow = currentTheme();
document.addEventListener('adm:view', () => { if (currentTheme() !== themeNow) { themeNow = currentTheme(); lend(); } });
addEventListener('pagehide', giveBack);
// кандидат так, как его видит приложение пробной версии (app-v2/js/me.js): аккаунт, профиль, заявка
function appState(a) {
  const s = st(a); const w = who(a);
  const app = {
    status: s.step, sentAt: D.TODAY.dayMonth,
    form: { name: w.name, pairYears: A.pairYears, hand: A.hand, backhand: A.backhand, amateur: false, age25: ageOk(), consentData: true, consentPublish: false },
  };
  if (s.step === 'declined') app.at = s.from === 'level' ? 'level' : 'council';
  const gone = !!goneOf(a);
  return {
    trialCode: true, show: false, session: { email: A.email }, draft: null, pendingEmail: '', seed: 'admin',
    server: { [A.email]: { email: A.email, profile: { name: w.name, about: OWN.about, level: OWN.level, photo: hasPhoto(a), removed: gone }, app, last: null } },
  };
}

// ============================================================
const id = params.get('a');
if (id && appOf(id)) one(appOf(id));
else queue();

// ============================================================
// ОЧЕРЕДЬ: карточки-ссылки «кто · шаг · факты · следующий шаг» и решённые
// ============================================================
function queue() {
  document.title = 'Заявки в лигу · Раздел организатора';
  const draw = live(['join', 'newPlayers', 'profiles'], () => {
    const all = D.JOIN_APPS;
    const open = all.filter((a) => isOpen(a));
    const closed = all.filter((a) => !isOpen(a));
    head.innerHTML = `<div class="head-row"><h1 class="h1">Игроки</h1>${sectionTabs('apps')}</div>`;
    work.innerHTML = `<div class="pp-queue">
        <section class="stack tight" aria-labelledby="h-open"><h2 class="h2" id="h-open">Ждут решения</h2>
        ${open.length ? `<ul class="pp-qlist">${open.map(qcard).join('')}</ul>`
    : `<div class="empty"><span class="ic">${icon('check')}</span><p>Все заявки разобраны. Новая появится здесь, когда кто-то подаст анкету</p><a class="btn quiet" href="players.html">${icon('players')}Все игроки</a></div>`}
        </section>
        ${closed.length ? `<section class="stack tight" aria-labelledby="h-done"><h2 class="h2" id="h-done">Решено</h2><ul class="list pp-list">${closed.map(drow).join('')}</ul></section>` : ''}
      </div>`;
    hydrate(head); hydrate(work);
  });
  redraw = draw;
  draw();
}
// карточка заявки в очереди: нажимается целиком; справа — следующий шаг словом
function qcard(a) {
  const s = st(a); const w = who(a);
  let pic; let name; let facts;
  if (a.kind === 'join') {
    pic = candAv(a);
    name = esc(w.name);
    // строка переносится только между фактами: «сам оценивает 4.0» не рвётся посередине
    facts = s.step === 'level' ? [`Анкета сегодня в ${a.at}`, `${years()} в парах`, `по возрасту ${ageOk() ? 'подходит' : 'не подходит'}`, selfFact()].filter(Boolean).map((t) => esc(t).replace(/ /g, '\u00a0')).join(' · ')
      : s.step === 'council' ? `Уровень ${kprText(s.level)} · ${years()} в парах`
        : `Совет одобрил · уровень ${kprText(s.level)}`;
  } else {
    const p = pl(a);
    pic = `<span class="pp-two" aria-hidden="true"><span class="av pp56">${esc(ini(w))}</span>${av(a.player, 'pp56')}</span>`;
    name = `${esc(w.first)} ${esc(w.last).replace(a.letter, `<mark>${a.letter}</mark>`)}`;
    facts = `Похож на игрока лиги: ${esc(p.name)}, в лиге с ${p.since}`;
  }
  const asked = s.asked ? `<span class="pp-qasked">${ic('msg')}Вы спросили ${esc(gf(a))} — ответа пока нет</span>` : '';
  return `<li><a class="pp-qcard" href="${hrefOf(a)}" data-app="${a.id}">
    <span class="pic">${pic}</span>
    <span class="grow"><span class="nm">${name}</span>${stateTag(a)}<span class="facts">${facts}</span>${asked}</span>
    <span class="next">${esc(nextOf(a))}</span>${icon('chev', 'go')}
  </a></li>`;
}
// решённая заявка — строка-ссылка
function drow(a) {
  const s = st(a); const w = who(a);
  const pic = a.kind === 'join' ? candAv(a) : av(a.player, 'pp56');
  const sub = a.kind === 'join'
    ? (s.step === 'member' ? `Уровень ${kprText(s.level)}` : 'В членстве отказано')
    : (s.step === 'merged' ? `Это ${esc(pl(a).name)}` : `Вход отдельно от ${esc(genName(pl(a)))}`);
  return `<li><a class="row" href="${hrefOf(a)}">${pic}<span class="grow"><span class="t">${esc(w.name)}</span><span class="s">${sub}</span></span>${stateTag(a)}${icon('chev', 'go')}</a></li>`;
}

// ============================================================
// ОДНА ЗАЯВКА
// ============================================================
function one(a) {
  const w = who(a);
  document.title = `${w.name} · Заявки в лигу · Раздел организатора`;
  // история заявки — строки «Журнала действий» про неё: мир и сделанное, новое сверху
  const history = () => journalRows(state.journal().filter((e) => e.href === hrefOf(a)), { link: false });
  const render = live(['join', 'profiles'], () => {
    const s = st(a);
    if (a.kind === 'join') renderJoin(s); else renderMerge(s);
    hydrate(head); hydrate(work);
    $('#log').innerHTML = history();
  });
  paint = render;
  // после шага: на ноутбуке — к началу страницы; на телефоне вопрос нового шага — наверх экрана,
  // чтобы полоса «Отменить» внизу не легла на его кнопку
  redraw = () => {
    render();
    const d = $('#decide');
    if (d && matchMedia('(max-width: 759px)').matches) window.scrollTo({ top: Math.max(0, d.getBoundingClientRect().top + scrollY - 12) });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const headHtml = (title, tag) => `<a class="back" href="applications.html">${icon('back')}Заявки в лигу</a>
      <div class="head-row"><h1 class="h1">${esc(title)}</h1>${tag.replace('class="tag ', 'class="tag lg ')}</div>`;
  // вопрос шага: вопрос, (плитки), главная кнопка прямо под ними и строка «кто увидит» над ней
  // all — рядом тихой кнопкой «Принять в лигу сразу»: когда Совет уже решил и взнос получен
  const goHtml = (G, all = false) => `<div class="pp-go"><p class="who-sees">${icon('eye')}<span>${esc(G.sees)}</span></p><div class="row-go"><button class="btn main" type="button" data-act="go">${icon('check')}<span>${esc(G.t)}</span></button>${all ? `<button class="btn quiet" type="button" data-act="all">${icon('check')}Принять в лигу сразу</button>` : ''}</div><p class="pick-msg" data-msg="${a.id}" role="alert" hidden></p></div>`;
  const askedHtml = (s) => (s.asked && isOpen(a, s) ? `<div class="pp-asked">${ic('msg')}<span><b>Вы спросили ${esc(gf(a))}:</b> <q>${esc(s.asked)}</q> Ответа пока нет — решить можно и без него</span></div>` : '');

  // ---------- вступление ----------
  function renderJoin(s) {
    const name = A.first;
    const now = stepNo(s);
    const G = goOf(a);
    head.innerHTML = headHtml(w.name, stateTag(a));
    const steps = STEPS.map((t, i) => {
      const n = i + 1;
      let c = n < now ? 'done' : n === now ? 'now' : '';
      if (s.step === 'declined') c = n < now ? 'done' : n === now ? 'no' : 'off';
      const m = c === 'done' ? icon('check') : c === 'no' ? icon('close') : n;
      return `<li class="${c}"${c === 'now' ? ' aria-current="step"' : ''}><span class="st"><span class="m">${m}</span>${esc(t)}</span></li>`;
    }).join('');
    // в начале — фото, которое кандидат загрузил сам, и путь заявки; у фото — тихое «Убрать фото»
    const gone = goneOf(a);
    const why = gone && whyOf(gone.why);
    const photoActs = gone
      ? `<div class="pp-gone" id="photo-gone" tabindex="-1"><p class="t">${icon('check')}<span>Вы убрали фото в ${esc(gone.at)}${why ? `: ${esc(why.log)}` : ''}</span></p><p class="s">${esc(name)} видит в профиле «Фото убрал организатор» и может загрузить другое</p></div>`
      : PHOTO ? `<button class="btn quiet" type="button" data-act="photo">${icon('trash')}Убрать фото</button>`
        : `<p class="pp-nophoto">${esc(name)} не загрузил фото</p>`;
    const cand = `<div class="pp-cand">
        <span class="pp-cphoto">${hasPhoto(a) ? `<img src="${esc(PHOTO)}" alt="Фото ${esc(genName(w))}">` : `<span class="ini" aria-hidden="true">${esc(ini(w))}</span>`}</span>
        <ol class="pp-steps" aria-label="Путь заявки">${steps}</ol>
        <div class="pp-cacts">${photoActs}</div>
      </div>`;
    // анкета: сначала то, что кандидат написал о себе сам, — с пометкой «со слов»; уровень КПР ставит лига
    const own = `<div class="pp-own" role="group" aria-labelledby="h-own">
        <h3 class="pp-own-h" id="h-own">Со слов кандидата</h3>
        <div class="pp-own-a"><span class="k">О себе и достижения</span>${OWN.about ? `<p class="pp-about">«${esc(OWN.about)}»</p>` : '<p class="pp-about none">Ничего не написал</p>'}</div>
        <p class="pp-own-lv"><span>Сам оценивает уровень: <b class="num">${esc(selfLevel())}</b></span><span class="muted">Уровень КПР ставит лига после просмотра игры</span></p>
      </div>`;
    const answers = `<div class="pp-answers">
        <div class="a"><span class="k">Опыт парной игры</span><span class="vl"><span class="v">${esc(years())}</span>${fit(+A.pairYears >= 1, 'подходит')}</span></div>
        <div class="a"><span class="k">${icon('lock')}Дата рождения</span><span class="vl"><span class="v">${esc(birthWords(A.birth))}</span>${fit(ageOk(), 'подходит')}</span></div>
        <div class="a"><span class="k">Рука</span><span class="v">${A.hand === 'left' ? 'Левша' : 'Правша'}, ${A.backhand === 'one' ? 'одноручный' : 'двуручный'} бэкхенд</span></div>
        <div class="a"><span class="k">${icon('lock')}Телефон</span><span class="v num">+7 ••• ••• •• ${esc(A.phoneTail)}</span></div>
        <div class="a"><span class="k">Профессиональные турниры</span><span class="vl"><span class="v none">Не отмечено</span>${fit(null, 'можно спросить')}</span></div>
        <div class="a"><span class="k">${icon('lock')}Почта</span><span class="v">${esc(A.email)}</span></div>
      </div>`;
    const other = (no) => `<div class="pp-other"><button class="btn quiet" type="button" data-act="ask">${ic('msg')}Спросить ${esc(gf(a))}</button>${no ? `<button class="btn quiet pp-no" type="button" data-act="decline">${icon('close')}${esc(no)}</button>` : ''}</div>`;
    let decide;
    if (s.step === 'level') {
      decide = `<section class="pp-card pp-decide" id="decide" aria-labelledby="h-dec">
        <h2 class="ask-q" id="h-dec">${esc(G.q)}</h2>
        <p class="pp-line muted">КПР — коэффициент парного разряда: уровень игры в паре</p>
        <div class="chips pp-kchips" role="radiogroup" aria-labelledby="h-dec" data-kpr="${a.id}">${NEWCOMER_KPR.map((k) => `<button type="button" class="chip" role="radio" aria-checked="${picks[a.id] === k}" data-value="${k}">${icon('check')}${kprText(k)}</button>`).join('')}</div>
        ${askedHtml(s)}${goHtml(G, true)}${other('Отказать')}</section>`;
    } else if (s.step === 'council') {
      decide = `<section class="pp-card pp-decide" id="decide" aria-labelledby="h-dec">
        <h2 class="ask-q" id="h-dec">${esc(G.q)}</h2>
        <p class="pp-line">Уровень КПР при вступлении — <b class="num">${kprText(s.level)}</b></p>
        ${askedHtml(s)}${goHtml(G, true)}${other('Совет отказал')}</section>`;
    } else if (s.step === 'fee') {
      decide = `<section class="pp-card pp-decide" id="decide" aria-labelledby="h-dec">
        <h2 class="ask-q" id="h-dec">${esc(G.q)}</h2>
        <p class="pp-line">Совет одобрил · уровень КПР <b class="num">${kprText(s.level)}</b></p>
        ${askedHtml(s)}${goHtml(G)}${other('')}</section>`;
    } else if (s.step === 'member') {
      decide = `<section class="pp-card" id="decide"><div class="pp-done"><span class="done-mark">${icon('check')}</span><h2 class="h1">${esc(w.name)} — член лиги</h2>
        <ul class="where-now"><li>${icon('phone')}<span><b>Приложение</b> — у ${esc(gf(a))} членская карта: уровень КПР ${kprText(s.level)}</span></li></ul>
        <div class="btns"><a class="btn quiet" href="applications.html">${icon('back')}К заявкам</a><button class="btn text" type="button" data-act="back" data-to="fee">${icon('undo')}Отменить решение</button></div></div></section>`;
    } else {
      decide = `<section class="pp-card" id="decide"><div class="pp-done"><span class="done-mark bad">${icon('close')}</span><h2 class="h1">Отказ записан</h2>
        <p class="pp-line">${esc(name)} видит в приложении: «${esc(refusedWords(s.from))}».</p>
        <div class="btns"><a class="btn quiet" href="applications.html">${icon('back')}К заявкам</a><button class="btn text" type="button" data-act="back" data-to="${s.from === 'level' ? 'level' : 'council'}">${icon('undo')}Вернуть в очередь</button></div></div></section>`;
    }
    work.innerHTML = `<div class="with-preview">
      <div class="pp-form" data-app="${a.id}">
        <div class="line pp-pv-line"><button class="btn quiet preview-open" type="button">${icon('eye')}Посмотреть, как увидит ${esc(name)}</button></div>
        ${cand}
        ${decide}
        <section class="pp-card" aria-labelledby="h-form"><h2 class="h2" id="h-form">Анкета</h2>${own}${answers}</section>
        <section class="stack tight" aria-labelledby="h-hist"><h2 class="h2" id="h-hist">История заявки</h2><ol class="log-list" id="log"></ol></section>
        <div id="where">${whereHtml([
    { icon: 'phone', b: 'Приложение и сайт', s: `только у ${gf(a)}: шаг пути и что дальше` },
    { icon: 'lock', b: 'Другим игрокам не видно', s: `фото, «О себе и достижения», самооценка и анкета: их видят только ${name} и организаторы лиги` },
  ])}</div>
      </div>
      <aside class="preview-col" id="pv" aria-label="Так увидит кандидат">
        <div class="seg pp-pvseg" role="group" aria-label="Экран приложения">
          <button type="button" data-pv="join" aria-pressed="${pvView === 'join'}">Вступление</button>
          <button type="button" data-pv="me" aria-pressed="${pvView === 'me'}">Вкладка «Я»</button>
        </div>
        <div class="pp-pvin" id="pv-in"></div>
      </aside>
    </div>`;
    mountPv = () => mountJoinPv(st(a));
    mountPv();
  }
  // рамка: «Вступление» (шаги заявки) или вкладка «Я» (заявка и профиль: фото, текст, самооценка)
  function mountJoinPv(s) {
    const name = A.first;
    const me = pvView === 'me';
    const banner = me
      ? (justPhoto === a.id ? `Фото у ${gf(a)} уже убрано` : justChanged === a.id && !justAsked ? `${name} уже видит новый шаг` : `Так ${name} видит вкладку «Я» сейчас`)
      : (justChanged === a.id ? `${name} уже видит ${justAsked ? 'вопрос' : 'новый шаг'}` : `Так ${name} видит заявку сейчас`);
    lendWhat = () => appState(a);
    lend();
    previewPanel($('#pv-in'), {
      app: { page: me ? 'me.html' : 'join.html?trial', title: me ? 'Приложение: вкладка «Я»' : 'Приложение: вступление', patch: me ? patchMe : patchJoin },
      banner,
    });
    pvCaption(`Так это видит ${name}`);
  }
  // приложение в рамке загрузилось: память браузера — на место, уровень КПР на членской карте — записанный здесь
  function framed(doc) {
    if (!doc.body || !/^(join|me)$/.test(doc.body.dataset.page || '')) return false;
    giveBackSoon();
    // в рамке только смотрят: нажатия не доходят до приложения — иначе «Отозвать заявку» или шестерёнка
    // записали бы в память приложения в этом браузере. Листать экран телефона можно
    if (!doc.ppLook) {
      doc.ppLook = true;
      ['click', 'submit'].forEach((t) => doc.addEventListener(t, (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true));
      const css = doc.createElement('style'); css.textContent = 'a, button, label, input, [role="button"] { cursor: default !important; }'; doc.head.append(css);
    }
    const s = st(a);
    if (s.level) doc.querySelectorAll('.jn-mcard .lvl .hero-num').forEach((x) => { x.textContent = kprText(s.level); });
    return true;
  }
  // «Вступление»: вопрос лиги — над шагами (такого места в приложении пока нет: так его предлагаем показать)
  function patchJoin(doc) {
    if (!framed(doc)) return;
    const s = st(a);
    if (s.asked && isOpen(a, s)) {
      const lead = doc.querySelector('[data-join] .jn-lead, [data-lead]');
      if (lead && !doc.getElementById('adm-q')) {
        const sec = doc.createElement('section');
        sec.className = 'section'; sec.id = 'adm-q';
        sec.innerHTML = `<span class="cap">Вопрос лиги</span><div class="card" style="padding:16px 18px;display:grid;gap:6px"><span class="strong">${esc(s.asked)}</span><span class="muted">Ответьте в письме или позвоните организатору</span></div>`;
        lead.after(sec);
        markIn(sec);
        return;
      }
    }
    if (justChanged === a.id) markIn(doc.querySelector('[data-join] .jn-pass, [data-join] .jn-mcard'));
  }
  // вкладка «Я»: фото убрали — отмечен профиль (фото → инициалы); сменился шаг — карточка заявки
  function patchMe(doc) {
    if (!framed(doc)) return;
    const row = doc.querySelector('.me-prow');
    if (justPhoto === a.id) markIn(row ? row.closest('.me-about') : doc.querySelector('.me-mcard'));
    else if (justChanged === a.id && !justAsked) markIn(doc.querySelector('[data-me] .me-pass, [data-me] .jn-pass, [data-me] .me-mcard'));
    // профиль (фото, текст, самооценка) — в экране, над нижней панелью приложения; карточка заявки — выше
    const sec = row && row.closest('.section');
    const w = doc.defaultView;
    if (sec && w) {
      const r = sec.getBoundingClientRect(); const room = w.innerHeight - 110;
      w.scrollTo(0, Math.max(0, r.height <= room - 12 ? r.bottom + w.scrollY - room : r.top + w.scrollY - 12));
    }
  }

  // ---------- «это один человек?» ----------
  function renderMerge(s) {
    const p = pl(a);
    const first = w.first;
    const G = goOf(a);
    head.innerHTML = headHtml('Это один человек?', stateTag(a, true));
    const hl = (t) => esc(t).replace(a.letter, `<mark>${a.letter}</mark>`);
    const same = `<div class="pp-same">
        <div class="pp-side"><span class="cap">Новый вход в приложение</span><div class="pp-whois"><span class="av pp56" aria-hidden="true">${esc(ini(w))}</span><span class="nm">${esc(first)} ${hl(w.last)}</span></div>
          <ul><li>${icon('clock')}<span>Вошёл сегодня в ${esc(a.at)}, ${esc(a.via)}</span></li><li>${icon('user')}<span>Заявки на вступление нет</span></li></ul></div>
        <span class="eq" aria-hidden="true">=</span>
        <div class="pp-side"><span class="cap">Игрок лиги</span><div class="pp-whois">${av(a.player, 'pp56')}<span class="nm">${esc(p.name)}</span></div>
          <ul><li>${icon('star')}<span>КПР ${kprText(p.kpr)} · ${esc(rankName(p.rank))}</span></li><li>${icon('calendar')}<span>В лиге с ${p.since} · ${D.CAREER[a.player].tours} ${plural(D.CAREER[a.player].tours, 'турнир', 'турнира', 'турниров')}</span></li><li>${icon('cup')}<span>№${p.place} в рейтинге</span></li></ul></div>
      </div>`;
    let decide;
    if (G) {
      decide = `<section class="pp-card pp-decide" id="decide" aria-labelledby="h-dec">
        <h2 class="ask-q" id="h-dec">${esc(G.q)}</h2>
        <p class="pp-line">Имя и фамилия совпадают. Разъединить можно в любой момент.</p>
        ${askedHtml(s)}${goHtml(G)}
        <div class="pp-other"><button class="btn quiet" type="button" data-act="ask">${ic('msg')}Спросить ${esc(gf(a))}</button><button class="btn quiet pp-no" type="button" data-act="decline">${icon('close')}Это разные люди</button></div>
      </section>`;
    } else if (s.step === 'merged') {
      decide = `<section class="pp-card" id="decide"><div class="pp-done"><span class="done-mark">${icon('check')}</span><h2 class="h1">Объединено: ${esc(p.name)}</h2>
        <ul class="where-now"><li>${icon('phone')}<span><b>Приложение</b> — вход ${esc(gf(a))} открывает его карту игрока</span></li><li>${icon('search')}<span><b>Поиск</b> — найдёт и «${esc(w.last)}», и «${esc(p.last)}»</span></li></ul>
        <div class="btns"><a class="btn quiet" href="applications.html">${icon('back')}К заявкам</a><button class="btn text" type="button" data-act="back" data-to="unmerge">${icon('undo')}Разъединить</button></div></div></section>`;
    } else {
      decide = `<section class="pp-card" id="decide"><div class="pp-done"><span class="done-mark bad">${icon('close')}</span><h2 class="h1">Это разные люди</h2>
        <p class="pp-line">Вход «${esc(w.name)}» остаётся отдельным. Карточка игрока ${esc(p.name)} не меняется.</p>
        <div class="btns"><a class="btn quiet" href="applications.html">${icon('back')}К заявкам</a><button class="btn text" type="button" data-act="back" data-to="reopen">${icon('undo')}Вернуть в очередь</button></div></div></section>`;
    }
    work.innerHTML = `<div class="with-preview">
      <div class="pp-form" data-app="${a.id}">
        <div class="line pp-pv-line"><button class="btn quiet preview-open" type="button">${icon('eye')}Посмотреть, как увидит ${esc(first)}</button></div>
        ${same}
        ${decide}
        <section class="stack tight" aria-labelledby="h-hist"><h2 class="h2" id="h-hist">История</h2><ol class="log-list" id="log"></ol></section>
        <div id="where">${whereHtml([
    { icon: 'phone', b: 'Приложение', s: `у ${gf(a)} во вкладке «Я» — его карта игрока, рейтинг и история` },
    { icon: 'site', b: 'Сайт', no: true, s: 'для других ничего не меняется' },
  ])}</div>
      </div>
      <aside class="preview-col" id="pv" aria-label="Так увидит игрок"></aside>
    </div>`;
    previewPanel($('#pv'), {
      app: { page: `player-other.html?p=${a.player}`, title: 'Приложение: карта игрока', patch: (doc) => { if (justChanged === a.id && s.step === 'merged') markIn(doc.querySelector('section.member'), 'Его карта'); } },
      banner: s.step === 'merged' ? `${first} видит эту карту у себя во вкладке «Я»` : `После объединения ${first} увидит эту карту у себя`,
    });
    pvCaption(`Так это увидит ${first}`);
  }

  render();
}

// ---------- переключатель экрана в рамке: «Вступление» · «Вкладка «Я»» ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pv]');
  if (!b || b.dataset.pv === pvView) return;
  pvView = b.dataset.pv;
  document.querySelectorAll('[data-pv]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.pv === pvView)));
  mountPv();
});
// шторка «Так увидит» на узком экране — словами того, кто смотрит
document.addEventListener('click', (e) => {
  if (!e.target.closest('.preview-open') || !id) return;
  const h = document.querySelector('.sheet .sheet-head .h2');
  const a = appOf(id);
  if (h && a && h.textContent === 'Так увидят игроки') { h.textContent = `Так увидит ${who(a).first}`; h.closest('.sheet').setAttribute('aria-label', h.textContent); }
});
