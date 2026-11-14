// Вход и вступление: welcome.html, login.html, join.html.
// Утверждённый путь (без ?trial): состояние (аккаунт, черновик анкеты, шаг заявки) — в этом браузере
// под JOIN_KEY; адрес ?step=… показывает нужный шаг заявки, ?step=code — шаг ввода кода.
// Пробная версия (?trial) — этап «Пользователи», сборка 0.3.0 на показном сервере: код пробной версии
// и согласие при входе, код входа на экране, анкета без телефона и даты рождения, фото и уровень
// из профиля, отзыв заявки, членская карта с фото и уровнем КПР, «Отказ» и «Подать заявку снова».
// Её состояние — общее с «Я», «Профилем» и «Настройками» (js/me.js, ключ USERS_KEY).
import { D, keepTheme, hydrate, icon } from '../app.js';
import { JOIN_KEY, STATES, TRIAL } from './join.data.js';
import { eligibility, checkForm, stepViews, doneCount, maskBirth, maskPhone, emailOk, yearsText, plural, stateOf, checkTrialForm } from './join.logic.js';
import {
  loadU, saveU, account, appKey, seedFromUrl, setShow, trialHref, themeHref, goBack,
  passHtml, memberCardHtml, photoHtml, levelText, openConsent, confirmSheet,
} from './me.js';

const A = D.APPLICANT;
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
const go = (href) => { location.href = keepTheme(href); };
const TODAY_ISO = D.TODAY.iso;
const TRIAL_ON = params.has('trial');

function load() {
  try { return JSON.parse(localStorage.getItem(JOIN_KEY) || '{}') || {}; } catch { return {}; }
}
function save(s) {
  try { localStorage.setItem(JOIN_KEY, JSON.stringify(s)); } catch { /* без хранилища путь работает до перезагрузки */ }
}
let S = load();

const page = document.body.dataset.page;
if (page === 'welcome') pageWelcome();
if (page === 'login') { if (TRIAL_ON) pageLoginTrial(); else pageLogin(); }
if (page === 'join') { if (TRIAL_ON) pageJoinTrial(); else pageJoin(); }

/* ------------------------------------------------------------ первый экран */

function pageWelcome() {
  $('[data-league]').textContent = D.LEAGUE.name;
  $('[data-discipline]').textContent = D.LEAGUE.discipline;
  if (!TRIAL_ON) return;
  // пробная версия: пометка от сервера, пути внутри пробной версии, тихая ссылка в показ
  document.body.classList.add('jn-trial');
  const note = $('[data-trial-note]');
  note.querySelector('span').textContent = TRIAL.note;
  note.hidden = false;
  $('[data-path="join"]').href = trialHref('join.html');
  $('[data-path="login"]').href = trialHref('login.html?from=welcome');
  $('[data-path="guest"]').href = keepTheme('index.html?as=guest');
  const show = $('[data-path="show"]');
  show.href = themeHref('index.html');
  show.hidden = false;
  show.addEventListener('click', () => setShow(true));
}

/* ------------------------------------------------------------ вход */

function pageLogin() {
  const toJoin = params.get('next') === 'join';
  const next = toJoin ? 'join.html' : 'index.html';
  const back = toJoin ? 'join.html' : 'welcome.html';
  if (toJoin) {
    $('[data-h]').textContent = 'Сначала аккаунт';
    $('[data-lead]').textContent = 'Пришлём код на почту. Потом — анкета в лигу.';
  }
  // шторку закрывают крестик и тап по затемнению
  $('[data-back]').href = keepTheme(back);
  $('[data-scrim]').addEventListener('click', () => go(back));
  const panes = { email: $('[data-pane="email"]'), code: $('[data-pane="code"]') };
  const form = $('[data-email-form]');
  const field = $('[data-email-field]');
  const emailIn = form.elements.email;
  const hint = $('[data-email-hint]');
  const codeBox = $('[data-code]');
  const codeIn = $('[data-code-in]');
  const cells = [...codeBox.querySelectorAll('.otp-cell')];
  const say = $('[data-code-say]');
  const timerEl = $('[data-timer]');
  const resend = $('[data-resend]');
  let timer = null;
  let wait = null;
  let left = 59;
  let busy = false;

  emailIn.value = S.pendingEmail || '';

  // новый код — чистые клетки: прежние цифры, ошибка и проверка не переходят в новую попытку
  const resetCode = () => {
    clearTimeout(wait);
    busy = false;
    codeIn.value = '';
    say.textContent = ' ';
    paint();
  };

  const show = (name) => {
    panes.email.hidden = name !== 'email';
    panes.code.hidden = name !== 'code';
    resetCode();
    if (name === 'code') {
      $('[data-email-out]').textContent = S.pendingEmail || A.email;
      startTimer();
      codeIn.focus({ preventScroll: true });
    } else {
      clearInterval(timer);
    }
  };

  // после входа «назад» не возвращает к коду: шаги входа заменяются следующим экраном
  const signedIn = (account) => {
    S = load();
    S.account = { ...account, at: `${D.TODAY.dayMonth}, ${D.TODAY.now}` };
    if (!S.step || S.step === 'start') S.step = 'form';
    save(S);
    location.replace(keepTheme(next));
  };

  // шаг 1: почта
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = emailIn.value.trim();
    if (!emailOk(v)) {
      field.classList.add('error');
      hint.hidden = false;
      emailIn.focus();
      return;
    }
    S.pendingEmail = v;
    save(S);
    history.pushState({ pane: 'code' }, '', keepTheme('login.html?step=code' + (toJoin ? '&next=join' : '')));
    show('code');
  });
  emailIn.addEventListener('input', () => { field.classList.remove('error'); hint.hidden = true; });

  // Apple и Google отдают имя и почту сами: анкета откроется уже с именем
  document.querySelectorAll('[data-provider]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.provider;
    document.querySelectorAll('[data-provider]').forEach((x) => { x.disabled = true; });
    b.querySelector('span').textContent = p === 'apple' ? 'Входим через Apple…' : 'Входим через Google…';
    setTimeout(() => signedIn({ provider: p, email: A.email, name: `${A.first} ${A.last}` }), 700);
  }));

  // шаг 2: шесть клеток кода. Следующая клетка отмечена сразу, как только шаг открылся
  function paint(state = '') {
    const v = codeIn.value;
    cells.forEach((c, i) => {
      c.querySelector('.hero-num').textContent = v[i] || '';
      c.classList.toggle('now', !state && !busy && i === v.length && v.length < 6);
    });
    codeBox.classList.toggle('err', state === 'err');
    codeBox.classList.toggle('ok', state === 'ok');
  }
  codeIn.addEventListener('input', () => {
    if (busy) return;
    codeIn.value = codeIn.value.replace(/\D/g, '').slice(0, 6);
    say.textContent = ' ';
    paint();
    if (codeIn.value.length === 6) check();
  });
  function check() {
    busy = true;
    paint();
    say.textContent = 'Проверяем…';
    wait = setTimeout(() => {
      // здесь код не отправляется: подходит любой, кроме шести нулей — на них видно ошибку
      if (codeIn.value === '000000') {
        busy = false;
        paint('err');
        say.textContent = 'Не тот код. Проверьте последнее письмо';
        codeIn.select();
        return;
      }
      paint('ok');
      say.textContent = 'Готово';
      wait = setTimeout(() => signedIn({ provider: 'email', email: S.pendingEmail || A.email }), 650);
    }, 550);
  }

  function startTimer() {
    clearInterval(timer);
    left = 59;
    resend.hidden = true;
    timerEl.hidden = false;
    const tick = () => {
      timerEl.textContent = `Новый код через 0:${String(left).padStart(2, '0')}`;
      if (left <= 0) { clearInterval(timer); timerEl.hidden = true; resend.hidden = false; }
      left -= 1;
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  resend.addEventListener('click', () => {
    resetCode();
    say.textContent = 'Отправили новый код';
    startTimer();
    codeIn.focus();
  });
  // «Изменить почту»: назад к первому шагу, почта остаётся в поле
  $('[data-change]').addEventListener('click', () => {
    if (history.state && history.state.pane === 'code') { history.back(); return; }
    history.replaceState(null, '', keepTheme('login.html' + (toJoin ? '?next=join' : '')));
    show('email');
    emailIn.focus();
  });
  addEventListener('popstate', () => show(new URLSearchParams(location.search).get('step') === 'code' ? 'code' : 'email'));

  show(params.get('step') === 'code' ? 'code' : 'email');
}

/* ------------------------------------------------------------ вступление */

function pageJoin() {
  const asked = params.get('step');
  let key = STATES[asked] ? asked : (STATES[S.step] ? S.step : (S.account ? 'form' : 'start'));
  const body = $('[data-body]');
  // имя знают Apple и Google; при входе по почте его спросит анкета
  const known = S.account ? S.account.name || '' : `${A.first} ${A.last}`;
  const draft = Object.assign({
    name: known, phone: '', birth: '', pairYears: '', hand: 'right', backhand: 'two',
    amateur: false, pd: false, publish: false,
  }, S.form || {});
  if (!draft.name && known) draft.name = known;

  // «назад»: пока заявка не подана — к первому экрану; потом — к турнирам (их видят все)
  const backHref = (k) => (k === 'start' || k === 'form' ? 'welcome.html' : 'tournaments.html');

  function render() {
    const st = STATES[key];
    const member = key === 'member';
    document.title = `${member ? 'Член лиги' : 'Вступление'} · Теннисная лига`;
    $('[data-back]').href = keepTheme(backHref(key));
    $('[data-nav-t]').textContent = member ? 'Членство' : 'Вступление';
    $('[data-pass]').hidden = member;
    $('[data-mcard]').hidden = !member;

    if (member) renderCard(st);
    else renderPass(st);
    $('[data-lead]').textContent = member ? `${st.lead} После первого турнира — звание «${D.RANKS[0].label}».` : st.lead;

    if (key === 'start') body.innerHTML = startHtml();
    else if (key === 'form') body.innerHTML = formHtml();
    else if (member) body.innerHTML = memberHtml();
    else body.innerHTML = reviewHtml();
    hydrate(body);
    if (key === 'form') bindForm();
  }

  // карточка заявки: шаг, что дальше, полоса шагов
  function renderPass(st) {
    $('[data-big]').textContent = st.big;
    $('[data-of]').textContent = st.of;
    $('[data-step-title]').textContent = st.title;
    const pill = $('[data-pill]');
    pill.hidden = !st.pill;
    pill.classList.toggle('jn-no', !!st.no);
    $('[data-pill-text]').textContent = st.pill || '';
    $('[data-pill-dot]').hidden = !st.live;
    // в начале пути полоса — просто шесть шагов впереди; дальше — пройденные и текущий
    const done = doneCount(key);
    [...$('[data-stepbar]').children].forEach((el, i) => {
      el.className = i < done ? 'done' : i === done && key !== 'start' ? (st.no ? 'no' : 'now') : '';
    });
    $('[data-next]').textContent = st.next;
    $('[data-next]').hidden = !st.next;
  }

  // членская карта: имя из анкеты, год вступления, статус
  function renderCard(st) {
    const name = String((S.form && S.form.name) || `${A.first} ${A.last}`).trim().split(/\s+/);
    const first = name[0] || A.first;
    const rest = name.slice(1).join(' ') || A.last;
    $('[data-m-name]').innerHTML = `${esc(first)}<br>${esc(rest)}`;
    $('[data-m-initials]').textContent = `${first[0] || ''}${rest[0] || ''}`.toUpperCase();
    $('[data-m-since]').textContent = `В лиге с ${TODAY_ISO.slice(0, 4)}`;
    $('[data-m-pill]').textContent = st.pill;
  }

  const stepsHtml = () => {
    const rows = stepViews(key, { email: S.account ? S.account.email : A.email, sentAt: S.sentAt || D.TODAY.dayMonth });
    return `<section class="section" aria-labelledby="jn-path-h">
      <span class="cap" id="jn-path-h">Шаги заявки</span>
      <ol class="card steps jn-steps">${rows.map((r) => `<li class="step ${r.status}"${r.status === 'now' ? ' aria-current="step"' : ''}>
        <span class="mark">${r.status === 'done' ? '<i data-icon="check" style="display:contents"></i>' : r.status === 'no' ? '<i data-icon="close" style="display:contents"></i>' : r.n}</span>
        <span><span class="strong">${r.name}</span><span class="sub">${esc(r.sub)}</span></span>
      </li>`).join('')}</ol>
    </section>`;
  };

  const startHtml = () => `
    <div class="section jn-act"><a class="btn main" href="login.html?next=join">Создать аккаунт</a></div>
    ${stepsHtml()}`;

  // путь пройден: главная кнопка сразу под картой
  const memberHtml = () => '<div class="section jn-act"><a class="btn main" href="tournaments.html">Турниры сезона</a></div>';

  const field = (k, label, input, hint = '') => `<label class="field" data-field="${k}">
      <span class="cap">${label}</span>${input}<span class="hint" data-hint="${k}"${hint ? '' : ' hidden'}>${hint}</span></label>`;
  const seg = (k, label, opts) => `<div class="field"><span class="cap" id="jn-${k}-l">${label}</span>
      <div class="tabs glass fill" role="radiogroup" aria-labelledby="jn-${k}-l">${opts.map(([v, t]) => `<button type="button" role="radio" data-seg="${k}" data-val="${v}" aria-checked="${draft[k] === v}" tabindex="${draft[k] === v ? 0 : -1}">${t}</button>`).join('')}</div></div>`;
  const sw = (k, title, sub) => `<label class="row" data-row="${k}"><span class="grow"><span class="strong">${title}</span><span class="sub" data-sub="${k}">${sub}</span></span><input class="switch" type="checkbox" data-f="${k}"${draft[k] ? ' checked' : ''} aria-label="${title}"></label>`;

  const HINT = {
    name: '',
    phone: '',
    birth: 'По Положению — от 25 лет',
    pairYears: 'В любительских турнирах, от года',
    pd: 'Без согласия заявку не принять',
  };

  const formHtml = () => `
    <form class="jn-form" novalidate data-form>
      <section class="section" aria-labelledby="jn-form-h">
        <span class="cap" id="jn-form-h">Анкета</span>
        <div class="card jn-fields">
          ${field('name', 'Имя и фамилия', `<input class="input" name="name" autocomplete="name" value="${esc(draft.name)}">`, HINT.name)}
          ${field('phone', 'Телефон', `<input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7" value="${esc(draft.phone)}">`, HINT.phone)}
          ${field('birth', 'Дата рождения', `<input class="input" name="birth" inputmode="numeric" autocomplete="bday" placeholder="дд.мм.гггг" maxlength="10" value="${esc(draft.birth)}">`, HINT.birth)}
          ${field('pairYears', 'Опыт парной игры, лет', `<input class="input" name="pairYears" inputmode="numeric" maxlength="2" placeholder="Например, 5" value="${esc(draft.pairYears)}">`, HINT.pairYears)}
          ${seg('hand', 'Рука', [['right', 'Правша'], ['left', 'Левша']])}
          ${seg('backhand', 'Бэкхенд', [['one', 'Одноручный'], ['two', 'Двуручный']])}
        </div>
      </section>
      <section class="section" aria-label="Отметки и согласия">
        <div class="card">
          ${sw('amateur', 'Не играл в профессиональных турнирах', 'Разряды и звания — уже не любительский уровень')}
          ${sw('pd', 'Согласен на обработку персональных данных', HINT.pd)}
          ${sw('publish', 'Согласен на публикацию результатов', 'По желанию. Без согласия их видит только лига')}
        </div>
      </section>
      <div class="section jn-act">
        <p class="jn-err" data-err hidden></p>
        <button class="btn main" type="submit">Подать заявку</button>
      </div>
    </form>`;

  const HAND = { right: 'Правша', left: 'Левша' };
  const BACK = { one: 'одноручный', two: 'двуручный' };
  // заявка у лиги: путь, сводка анкеты; турниры и счёт открыты всем и до решения
  const reviewHtml = () => {
    const f = S.form || {};
    const name = f.name || `${A.first} ${A.last}`;
    const yrs = f.pairYears || A.pairYears;
    return `${stepsHtml()}
      <section class="section" aria-labelledby="jn-sum-h">
        <span class="cap" id="jn-sum-h">Ваша анкета</span>
        <div class="card kv jn-sum">
          <div class="row"><span class="muted">Имя</span><span class="strong ellipsis">${esc(name)}</span></div>
          <div class="row"><span class="muted">Телефон</span><span>${esc(maskPhone(f.phone, A.phoneTail))}</span></div>
          <div class="row"><span class="muted">Опыт парной игры</span><span>${esc(yearsText(yrs))}</span></div>
          <div class="row"><span class="muted">Рука</span><span>${HAND[f.hand || A.hand]}, ${BACK[f.backhand || A.backhand]} бэкхенд</span></div>
        </div>
        <p class="jn-hint">Телефон и дату рождения видит только админ лиги.</p>
      </section>
      <div class="section jn-act"><a class="btn quiet" href="tournaments.html">Смотреть турниры и счёт</a></div>`;
  };

  // подсказки по условиям Положения — по мере ввода
  function hints() {
    const el = eligibility(draft, TODAY_ISO);
    const set = (k, ok, good, bad) => {
      const h = $(`[data-hint="${k}"]`);
      const f = $(`[data-field="${k}"]`);
      if (!h || f.classList.contains('error')) return;
      h.textContent = ok === true ? good : ok === false ? bad : HINT[k];
      f.classList.toggle('jn-warn', ok === false);
    };
    set('birth', el.age, 'Возраст подходит по Положению', 'Моложе 25 лет. Решение за лигой');
    set('pairYears', el.exp, 'Опыт подходит по Положению', 'Меньше года. Решение за лигой');
  }

  function bindForm() {
    const form = $('[data-form]');
    const err = $('[data-err]');
    const keep = () => { S.form = { ...draft }; save(S); };
    form.addEventListener('input', (e) => {
      const t = e.target;
      if (t.name === 'birth') { const pos = t.value.length; t.value = maskBirth(t.value); if (pos === t.value.length) t.setSelectionRange(pos, pos); }
      if (t.name === 'pairYears') t.value = t.value.replace(/\D/g, '');
      if (t.name) draft[t.name] = t.value;
      if (t.dataset.f) draft[t.dataset.f] = t.checked;
      const f = t.closest('[data-field]');
      if (f && f.classList.contains('error')) {
        // ошибка ушла — вернуть обычную подсказку
        f.classList.remove('error');
        const h = $(`[data-hint="${f.dataset.field}"]`);
        h.textContent = HINT[f.dataset.field] || '';
        h.hidden = !HINT[f.dataset.field];
      }
      if (t.dataset.f === 'pd' && t.checked) { const r = $('[data-row="pd"]'); r.classList.remove('jn-bad'); $('[data-sub="pd"]').textContent = HINT.pd; }
      if (!form.querySelector('.field.error, .jn-bad')) err.hidden = true;
      hints();
      keep();
    });
    const pick = (b) => {
      draft[b.dataset.seg] = b.dataset.val;
      form.querySelectorAll(`[data-seg="${b.dataset.seg}"]`).forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
      keep();
    };
    form.addEventListener('click', (e) => { const b = e.target.closest('[data-seg]'); if (b) pick(b); });
    // переключатель «Рука» и «Бэкхенд» — стрелками, как радиокнопки
    form.addEventListener('keydown', (e) => {
      const b = e.target.closest('[data-seg]');
      if (!b || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      const all = [...form.querySelectorAll(`[data-seg="${b.dataset.seg}"]`)];
      const n = all[(all.indexOf(b) + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      pick(n);
      n.focus();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = checkForm(draft);
      form.querySelectorAll('[data-field]').forEach((f) => f.classList.remove('error', 'jn-warn'));
      Object.entries(bad).forEach(([k, text]) => {
        if (k === 'pd') { $('[data-row="pd"]').classList.add('jn-bad'); $('[data-sub="pd"]').textContent = text; return; }
        const f = $(`[data-field="${k}"]`);
        f.classList.add('error');
        const h = $(`[data-hint="${k}"]`);
        h.textContent = text;
        h.hidden = false;
      });
      const n = Object.keys(bad).length;
      if (n) {
        err.hidden = false;
        err.textContent = `Осталось заполнить: ${n} ${plural(n, 'поле', 'поля', 'полей')}`;
        const first = form.querySelector('.field.error .input') || form.querySelector('[data-f="pd"]');
        if (first) first.focus();
        hints();
        return;
      }
      // заявка подана: дальше её ведёт лига
      S.form = { ...draft };
      S.step = 'level';
      S.sentAt = D.TODAY.dayMonth;
      if (!S.account) S.account = { provider: 'email', email: A.email };
      save(S);
      key = 'level';
      history.replaceState(null, '', keepTheme('join.html'));
      render();
      scrollTo({ top: 0, behavior: 'smooth' });
    });
    hints();
  }

  render();
}

/* ------------------------------------------------------------ вход: пробная версия */

// login.html?trial — шаг почты: код пробной версии (если его ещё нет на телефоне), согласие, «Что хранится».
// ?step=code&trial — шаг кода: «Код входа», код на экране, шесть клеток (сами не заполняются).
// ?next=join — вход ради заявки: после кода сразу анкета. ?from=welcome | me — откуда пришли:
// новый аккаунт открывает «Я», прежний возвращается туда, откуда пришёл.
// Состояния для снимков: ?saved — код пробной версии уже сохранён; ?offline — нет связи; ?what — шторка
// «Что хранится»; ?error=trial | consent | many — ошибки шага почты; ?error=wrong | expired | blocked — шага кода.
// Здесь код никуда не уходит: код пробной версии подходит любой от 10 знаков (короче — неверный),
// код входа — тот, что на экране; пять ошибок — код больше не действует.
function pageLoginTrial() {
  let U = loadU();
  const CODE = TRIAL.code.replace(/\D/g, '');
  let forced = params.get('error') || '';
  const offline = params.has('offline');
  const toJoin = params.get('next') === 'join';
  const from = params.get('from') || '';
  const back = toJoin ? trialHref('join.html') : from === 'me' ? themeHref('me.html') : trialHref('welcome.html');
  const needTrial = forced === 'trial' || !(U.trialCode || params.has('saved'));
  const tail = (toJoin ? '&next=join' : '') + (from ? `&from=${encodeURIComponent(from)}` : '');

  document.body.classList.add('jn-trial');
  if (toJoin) $('[data-h]').textContent = 'Сначала аккаунт';
  $('[data-lead]').textContent = 'Код из шести цифр покажем на экране. Аккаунта ещё нет — создадим.';
  $('[data-alt]').hidden = true;   // Apple и Google — не на этом этапе
  // шторку закрывают крестик и тап по затемнению
  const closer = $('[data-back]');
  closer.href = back;
  $('[data-scrim]').addEventListener('click', () => { location.href = back; });

  const panes = { email: $('[data-pane="email"]'), code: $('[data-pane="code"]') };
  const form = $('[data-email-form]');
  const field = $('[data-email-field]');
  const emailIn = form.elements.email;
  const hint = $('[data-email-hint]');
  const trialField = $('[data-trial-field]');
  const trialIn = form.elements.trial;
  const trialHint = $('[data-trial-hint]');
  const agree = $('[data-agree]');
  const agreeIn = form.elements.agree;
  const agreeErr = $('[data-agree-err]');
  const formSay = $('[data-form-say]');
  const send = $('.jn-send', form);

  trialField.hidden = !needTrial;
  agree.hidden = false;
  const TRIAL_HINT = 'Его даёт организатор лиги';
  const TRIAL_BAD = 'Неверный код пробной версии. Спросите его у организатора лиги';
  const MANY = 'Слишком много попыток. Попробуйте через 25 мин';
  const setMailErr = (on) => { field.classList.toggle('error', on); hint.hidden = !on; };
  const setTrialErr = (on) => { trialField.classList.toggle('error', on); trialHint.textContent = on ? TRIAL_BAD : TRIAL_HINT; };
  const setAgreeErr = (on) => { agreeErr.hidden = !on; agree.classList.toggle('jn-bad', on); };
  const setSay = (text, err = false) => { formSay.textContent = text || ''; formSay.hidden = !text; formSay.classList.toggle('err', err); };

  emailIn.value = U.pendingEmail || '';
  if (['trial', 'consent', 'many'].includes(forced) && !emailIn.value) emailIn.value = A.email;
  if (forced === 'trial') { agreeIn.checked = true; setTrialErr(true); }
  if (forced === 'consent') setAgreeErr(true);
  if (forced === 'many') { agreeIn.checked = true; setSay(MANY, true); }
  if (offline) { setSay('Войти можно, когда есть связь с сервером'); send.disabled = true; }

  const what = $('[data-what]');
  what.addEventListener('click', () => openConsent(what));
  if (params.has('what')) openConsent(what);

  emailIn.addEventListener('input', () => setMailErr(false));
  trialIn.addEventListener('input', () => setTrialErr(false));
  agreeIn.addEventListener('change', () => { if (agreeIn.checked) setAgreeErr(false); });

  // шаг почты: почту и согласие проверяет само приложение, код пробной версии — сервер (первым делом)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (offline) return;
    const v = emailIn.value.trim();
    const badMail = !emailOk(v);
    setMailErr(badMail);
    setAgreeErr(!agreeIn.checked);
    if (badMail) { emailIn.focus(); return; }
    if (!agreeIn.checked) { agreeIn.focus(); return; }
    if (needTrial && trialIn.value.trim().length < 10) { setTrialErr(true); trialIn.focus(); trialIn.select(); return; }
    if (forced === 'many') { setSay(MANY, true); return; }
    setSay('');
    U = loadU();
    U.pendingEmail = v;
    saveU(U);
    history.pushState({ pane: 'code' }, '', trialHref(`login.html?step=code${tail}`));
    show('code');
  });

  /* шаг кода */
  const codeBox = $('[data-code]');
  const codeIn = $('[data-code-in]');
  const cells = [...codeBox.querySelectorAll('.otp-cell')];
  const say = $('[data-code-say]');
  const timerEl = $('[data-timer]');
  const resend = $('[data-resend]');
  $('[data-code-h]').textContent = 'Код входа';
  $('[data-code-lead]').innerHTML = `Пробная версия: письма пока не отправляются. Ваш код — <b class="jn-code">${esc(TRIAL.code)}</b>`;
  codeIn.setAttribute('aria-label', 'Код входа, шесть цифр');
  resend.textContent = 'Получить код';
  let timer = null;
  let wait = null;
  let left = 59;
  let busy = false;
  let dead = false;      // код больше не действует: нужен новый
  let misses = 0;        // неверных попыток этого кода

  function paint(state = '') {
    const v = codeIn.value;
    cells.forEach((c, i) => {
      c.querySelector('.hero-num').textContent = v[i] || '';
      c.classList.toggle('now', !state && !busy && !dead && i === v.length && v.length < 6);
    });
    codeBox.classList.toggle('err', state === 'err');
    codeBox.classList.toggle('ok', state === 'ok');
  }
  const resetCode = () => {
    clearTimeout(wait);
    busy = false; dead = false; misses = 0;
    codeIn.disabled = false;
    codeIn.value = '';
    say.textContent = ' ';
    paint();
  };
  function startTimer() {
    clearInterval(timer);
    left = 59;
    resend.hidden = true;
    timerEl.hidden = false;
    const tick = () => {
      timerEl.textContent = `Новый код через 0:${String(left).padStart(2, '0')}`;
      if (left <= 0) { clearInterval(timer); timerEl.hidden = true; resend.hidden = false; }
      left -= 1;
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  // код больше не действует (10 минут или 5 ошибок): клетки закрыты, сразу можно получить новый
  function expire() {
    dead = true;
    paint('err');
    codeIn.disabled = true;
    say.textContent = 'Код больше не действует. Получите новый';
    clearInterval(timer);
    timerEl.hidden = true;
    resend.hidden = false;
  }
  function show(name) {
    panes.email.hidden = name !== 'email';
    panes.code.hidden = name !== 'code';
    resetCode();
    if (name === 'code') { startTimer(); codeIn.focus({ preventScroll: true }); } else clearInterval(timer);
  }

  // после верного кода: новый аккаунт — «Я», прежний — откуда пришёл, вход ради заявки — анкета
  const signedIn = () => {
    U = loadU();
    const typed = (U.pendingEmail || A.email).trim();
    const known = Object.keys(U.server).find((k) => k.toLowerCase() === typed.toLowerCase());
    const email = known || typed;
    if (!known) U.server[email] = { email, profile: { name: '', about: '', level: null, photo: false, removed: false }, app: null, last: null };
    if (U.draft && U.draft.email !== email) U.draft = null;   // вошёл другим аккаунтом — черновик анкеты стёрт
    U.session = { email };
    U.trialCode = true;
    U.show = false;
    saveU(U);
    const to = toJoin ? trialHref('join.html?open=form') : !known ? themeHref('me.html') : from === 'welcome' ? themeHref('index.html') : themeHref('me.html');
    location.replace(to);
  };

  function check() {
    busy = true;
    paint();
    say.textContent = 'Проверяем…';
    wait = setTimeout(() => {
      busy = false;
      if (forced === 'expired' || misses >= 5) { expire(); return; }
      if (codeIn.value !== CODE) {
        misses += 1;
        paint('err');
        say.textContent = 'Не тот код. Проверьте код на экране';
        codeIn.select();
        return;
      }
      if (forced === 'blocked') {
        paint('err');
        say.textContent = 'Вход закрыт. Напишите организатору лиги';
        return;
      }
      paint('ok');
      say.textContent = 'Готово';
      wait = setTimeout(signedIn, 650);
    }, 550);
  }
  codeIn.addEventListener('input', () => {
    if (busy || dead) return;
    codeIn.value = codeIn.value.replace(/\D/g, '').slice(0, 6);
    say.textContent = ' ';
    paint();
    if (codeIn.value.length === 6) check();
  });
  resend.addEventListener('click', () => {
    if (forced === 'expired' || forced === 'wrong') forced = '';
    resetCode();
    startTimer();
    codeIn.focus();
  });
  // «Изменить почту»: назад к первому шагу, почта остаётся в поле
  $('[data-change]').addEventListener('click', () => {
    if (history.state && history.state.pane === 'code') { history.back(); return; }
    history.replaceState(null, '', trialHref(`login.html${tail ? `?${tail.slice(1)}` : ''}`));
    show('email');
    emailIn.focus();
  });
  addEventListener('popstate', () => show(new URLSearchParams(location.search).get('step') === 'code' ? 'code' : 'email'));

  if (params.get('step') === 'code') {
    show('code');
    if (forced === 'wrong') { codeIn.value = '000000'; misses = 1; paint('err'); say.textContent = 'Не тот код. Проверьте код на экране'; }
    if (forced === 'expired') { codeIn.value = '000000'; expire(); }
    if (forced === 'blocked') { codeIn.value = CODE; paint('err'); say.textContent = 'Вход закрыт. Напишите организатору лиги'; }
  } else {
    show('email');
  }
}

/* ------------------------------------------------------------ вступление: пробная версия */

// join.html?trial — путь в лигу пробной версии. Состояние — общее с «Я» (js/me.js).
// ?step=start | form | level | council | fee | member | declined | declined-level — готовые состояния
// (Арман Есенов); ?as=guest — гость; ?open=form — сразу анкета (после входа ради заявки,
// «Заполнить анкету», «Подать заявку снова»). Шаги после подачи двигает лига: здесь — только адресом ?step=.
function pageJoinTrial() {
  const HAND = { right: 'Правша', left: 'Левша' };
  const BACK = { one: 'одноручный', two: 'двуручный' };
  const asked = params.get('step');
  let U = (params.get('as') === 'guest' ? seedFromUrl('as') : null) || seedFromUrl('step') || loadU();
  let view = asked === 'form' || params.get('open') === 'form' ? 'form' : null;
  const root = $('[data-join]');
  const back = $('[data-back]');

  const acc = () => account(U);
  const key = () => {
    const a = acc();
    if (view === 'form' && a) return 'form';
    if (!a || !a.app) return 'start';
    return appKey(a.app);
  };
  // «назад»: на шаг внутри приложения; пришли не отсюда — к «Я» (гость — к первому экрану)
  const fallback = () => (acc() ? themeHref('me.html') : trialHref('welcome.html'));
  back.addEventListener('click', (e) => { e.preventDefault(); goBack(fallback()); });
  let wdSheet = null;

  // черновик анкеты — на телефоне до отправки, привязан к аккаунту; после отказа и отзыва — прошлые ответы
  function draftOf(a) {
    const base = { name: '', pairYears: '', hand: 'right', backhand: 'two', amateur: false, age25: false, consentData: false, consentPublish: false };
    const last = a.app && a.app.status === 'declined' ? a.app.form : a.last;
    const kept = U.draft && U.draft.email === a.email ? U.draft.form : null;
    const d = { ...base, ...(last || {}), ...(kept || {}) };
    d.name = (kept && kept.name) || a.profile.name || (last && last.name) || '';
    return d;
  }

  const stepsHtml = (k, a) => {
    const rows = stepViews(k, { trial: true, email: a ? a.email : '', sentAt: a && a.app ? a.app.sentAt : D.TODAY.dayMonth, signedIn: !!a });
    return `<section class="section" aria-labelledby="jn-path-h">
      <span class="cap" id="jn-path-h">Шаги заявки</span>
      <ol class="card steps jn-steps">${rows.map((r) => `<li class="step ${r.status}"${r.status === 'now' ? ' aria-current="step"' : ''}>
        <span class="mark">${r.status === 'done' ? icon('check') : r.status === 'no' ? icon('close') : r.n}</span>
        <span><span class="strong">${r.name}</span><span class="sub">${esc(r.sub)}</span></span>
      </li>`).join('')}</ol>
    </section>`;
  };

  const startHtml = (a) => `
    <div class="section jn-act">${a
    ? '<button class="btn main" type="button" data-open-form>Заполнить анкету</button>'
    : `<a class="btn main" href="${trialHref('login.html?next=join')}">Создать аккаунт</a>`}</div>
    ${stepsHtml('start', a)}`;

  const field = (k, label, input, hint = '') => `<label class="field" data-field="${k}">
      <span class="cap">${label}</span>${input}<span class="hint" data-hint="${k}"${hint ? '' : ' hidden'}>${hint}</span></label>`;
  const seg = (k, label, opts, d) => `<div class="field"><span class="cap" id="jn-${k}-l">${label}</span>
      <div class="tabs glass fill" role="radiogroup" aria-labelledby="jn-${k}-l">${opts.map(([v, t]) => `<button type="button" role="radio" data-seg="${k}" data-val="${v}" aria-checked="${d[k] === v}" tabindex="${d[k] === v ? 0 : -1}">${t}</button>`).join('')}</div></div>`;
  // выключатель: вся строка нажимается; со ссылкой внутри («Что хранится») — только подпись
  const sw = (k, title, sub, d, extra = '') => {
    const text = `<span class="strong">${title}</span>${sub ? `<span class="sub" data-sub="${k}">${sub}</span>` : ''}`;
    const input = `<input class="switch" type="checkbox" data-f="${k}" id="jn-sw-${k}"${d[k] ? ' checked' : ''}>`;
    return extra
      ? `<div class="row jn-sw" data-row="${k}"><span class="grow"><label for="jn-sw-${k}">${text}</label>${extra}</span>${input}</div>`
      : `<label class="row jn-sw" data-row="${k}"><span class="grow">${text}</span>${input}</label>`;
  };

  // анкета: имя (из профиля, можно поправить), фото и уровень с текстом — из профиля, опыт, рука, отметки
  const formHtml = (a) => {
    const d = draftOf(a);
    const p = a.profile;
    const lv = p.level ? `Мой уровень ${esc(levelText(p.level))}` : 'Мой уровень';
    return `<form class="jn-form" novalidate data-form>
      <section class="section" aria-labelledby="jn-form-h">
        <span class="cap" id="jn-form-h">Анкета</span>
        <div class="card jn-fields">
          ${field('name', 'Имя и фамилия', `<input class="input" name="name" autocomplete="name" maxlength="60" value="${esc(d.name)}">`)}
          ${field('pairYears', 'Опыт парной игры, лет', `<input class="input" name="pairYears" inputmode="numeric" maxlength="2" placeholder="Например, 5" value="${esc(d.pairYears)}">`, 'В любительских турнирах, от года')}
          ${seg('hand', 'Рука', [['right', 'Правша'], ['left', 'Левша']], d)}
          ${seg('backhand', 'Бэкхенд', [['one', 'Одноручный'], ['two', 'Двуручный']], d)}
          <p class="jn-nophone">${icon('info')}<span>Телефон спросим при запуске лиги</span></p>
        </div>
      </section>
      <section class="section" aria-labelledby="jn-prof-h">
        <span class="cap" id="jn-prof-h">Профиль</span>
        <div class="card jn-prof">
          <div class="row">${photoHtml(p, 'lg')}
            <span class="grow"><span class="strong">${lv}</span><span class="sub">По вашей оценке</span></span>
          </div>
          ${p.about ? `<p class="me-text">${esc(p.about)}</p>` : ''}
          <div class="jn-prof-acts">
            ${p.photo ? '' : `<a class="btn quiet small" href="${trialHref('profile.html?from=join&sheet')}">Добавить фото</a>`}
            <a class="btn quiet small" href="${trialHref('profile.html?from=join')}">Изменить профиль</a>
          </div>
        </div>
      </section>
      <section class="section" aria-label="Отметки и согласия">
        <div class="card">
          ${sw('amateur', 'Не играл в профессиональных турнирах', 'Разряды и звания — уже не любительский уровень', d)}
          ${sw('age25', 'Мне 25 лет или больше', 'По Положению — от 25 лет. Решение за лигой', d)}
          ${sw('consentData', 'Согласен на обработку персональных данных', 'Без согласия заявку не принять', d, '<button class="jn-what tap-area" type="button" data-what>Что хранится</button>')}
          ${sw('consentPublish', 'Согласен на публикацию результатов и фото', 'По желанию. Без согласия их видит только лига', d)}
        </div>
      </section>
      <div class="section jn-act">
        <p class="jn-err" data-err hidden></p>
        <button class="btn main" type="submit">Подать заявку</button>
      </div>
    </form>`;
  };

  // заявка у лиги: путь, «Отозвать заявку» под шагами, сводка анкеты
  const reviewHtml = (k, a) => {
    const f = a.app.form || {};
    return `${stepsHtml(k, a)}
      <div class="section jn-act"><button class="btn quiet" type="button" data-withdraw>Отозвать заявку</button></div>
      <section class="section" aria-labelledby="jn-sum-h">
        <span class="cap" id="jn-sum-h">Ваша анкета</span>
        <div class="card kv jn-sum">
          <div class="row"><span class="muted">Имя</span><span class="strong ellipsis">${esc(a.profile.name || f.name)}</span></div>
          <div class="row"><span class="muted">Опыт парной игры</span><span>${esc(yearsText(f.pairYears || A.pairYears))}</span></div>
          <div class="row"><span class="muted">Рука</span><span>${HAND[f.hand || A.hand]}, ${BACK[f.backhand || A.backhand]} бэкхенд</span></div>
        </div>
        <p class="jn-hint">Анкету видят только вы и организаторы лиги.</p>
      </section>`;
  };

  // отказ: «Подать заявку снова» — анкета с прошлыми ответами
  const declinedHtml = (k, a) => `
    <div class="section jn-act"><button class="btn quiet" type="button" data-again>Подать заявку снова</button></div>
    ${stepsHtml(k, a)}`;

  // путь пройден: главная кнопка сразу под картой, ниже — пройденный путь
  const memberHtml = (a) => `
    <div class="section jn-act"><a class="btn main" href="${keepTheme('tournaments.html')}">Турниры сезона</a></div>
    ${stepsHtml('member', a)}`;

  function render() {
    const a = acc();
    const k = key();
    const st = stateOf(k, true);
    const member = k === 'member';
    document.title = `${member ? 'Член лиги' : 'Вступление'} · Теннисная лига`;
    $('[data-nav-t]').textContent = member ? 'Членство' : 'Вступление';
    back.href = fallback();
    let html = member ? memberCardHtml(a.profile) : passHtml(k, { signedIn: !!a, h: 'h1' });
    html += `<p class="jn-lead">${esc(st.lead)}</p>`;
    if (k === 'start') html += startHtml(a);
    else if (k === 'form') html += formHtml(a);
    else if (member) html += memberHtml(a);
    else if (st.no) html += declinedHtml(k, a);
    else html += reviewHtml(k, a);
    root.innerHTML = html;
    hydrate(root);
    bind(k);
  }

  const openForm = () => {
    view = 'form';
    history.pushState({ view: 'form' }, '', trialHref('join.html?open=form'));
    render();
    scrollTo({ top: 0 });
  };

  function bind(k) {
    const of = $('[data-open-form]', root);
    if (of) of.addEventListener('click', openForm);
    const again = $('[data-again]', root);
    if (again) again.addEventListener('click', openForm);
    const wd = $('[data-withdraw]', root);
    if (wd) wd.addEventListener('click', () => withdrawAsk(wd));
    if (k === 'form') bindForm();
  }

  // «Отозвать заявку» на шагах 3–5: подтверждение; после — обычное «Я» и путь с начала
  function withdrawAsk(opener) {
    if (!wdSheet) {
      wdSheet = confirmSheet({
        title: 'Отозвать заявку?',
        text: 'Подать снова можно в любой момент',
        ok: 'Отозвать заявку',
        onOk: () => {
          const a = acc();
          if (!a || !a.app) return;
          a.last = a.app.form;
          a.app = null;
          saveU(U);
          view = null;
          render();
          scrollTo({ top: 0 });
          const first = $('.jn-act .btn', root);
          if (first) first.focus({ preventScroll: true });
        },
      });
    }
    wdSheet.open(opener);
  }

  function bindForm() {
    const a = acc();
    const d = draftOf(a);
    const form = $('[data-form]', root);
    const err = $('[data-err]', root);
    const keep = () => { U.draft = { email: a.email, form: { ...d } }; saveU(U); };
    const HINT = { name: '', pairYears: 'В любительских турнирах, от года' };
    const what = $('[data-what]', root);
    what.addEventListener('click', () => openConsent(what));
    form.addEventListener('input', (e) => {
      const t = e.target;
      if (t.name === 'pairYears') t.value = t.value.replace(/\D/g, '');
      if (t.name) d[t.name] = t.value;
      if (t.dataset.f) d[t.dataset.f] = t.checked;
      const f = t.closest('[data-field]');
      if (f && f.classList.contains('error')) {
        f.classList.remove('error');
        const h = $(`[data-hint="${f.dataset.field}"]`, root);
        h.textContent = HINT[f.dataset.field] || '';
        h.hidden = !HINT[f.dataset.field];
      }
      if (t.dataset.f === 'consentData' && t.checked) $('[data-row="consentData"]', root).classList.remove('jn-bad');
      if (!form.querySelector('.field.error, .jn-bad')) err.hidden = true;
      keep();
    });
    const pick = (b) => {
      d[b.dataset.seg] = b.dataset.val;
      form.querySelectorAll(`[data-seg="${b.dataset.seg}"]`).forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
      keep();
    };
    form.addEventListener('click', (e) => { const b = e.target.closest('[data-seg]'); if (b) pick(b); });
    form.addEventListener('keydown', (e) => {
      const b = e.target.closest('[data-seg]');
      if (!b || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      const all = [...form.querySelectorAll(`[data-seg="${b.dataset.seg}"]`)];
      const n = all[(all.indexOf(b) + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      pick(n);
      n.focus();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = checkTrialForm(d);
      form.querySelectorAll('[data-field]').forEach((f) => f.classList.remove('error'));
      $('[data-row="consentData"]', root).classList.remove('jn-bad');
      Object.entries(bad).forEach(([k, text]) => {
        if (k === 'consentData') { $('[data-row="consentData"]', root).classList.add('jn-bad'); return; }
        $(`[data-field="${k}"]`, root).classList.add('error');
        const h = $(`[data-hint="${k}"]`, root);
        h.textContent = text;
        h.hidden = false;
      });
      const n = Object.keys(bad).length;
      if (n) {
        err.hidden = false;
        err.textContent = `Осталось заполнить: ${n} ${plural(n, 'поле', 'поля', 'полей')}`;
        const first = form.querySelector('.field.error .input') || form.querySelector('[data-f="consentData"]');
        if (first) first.focus();
        return;
      }
      // подача: сначала профиль (имя), затем заявка — сразу шаг «Оценка уровня»
      a.profile.name = d.name.trim().replace(/\s+/g, ' ');
      a.app = { status: 'level', sentAt: D.TODAY.dayMonth, form: { ...d, name: a.profile.name } };
      a.last = null;
      U.draft = null;
      saveU(U);
      view = null;
      history.replaceState(null, '', trialHref('join.html'));
      render();
      scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  addEventListener('popstate', () => { view = new URLSearchParams(location.search).get('open') === 'form' ? 'form' : null; render(); });
  // вернулись «назад» (из профиля или из входа) — перечитать: профиль мог измениться
  addEventListener('pageshow', (e) => { if (e.persisted) { U = loadU(); render(); } });
  render();
  // ?withdraw — окно «Отозвать заявку?» открыто (для снимков)
  const wd = $('[data-withdraw]', root);
  if (wd && params.has('withdraw')) withdrawAsk(wd);
}
