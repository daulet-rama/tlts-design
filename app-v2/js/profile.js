// «Профиль» (profile.html): фото, имя и фамилия, «О себе и достижения», свой уровень.
// Видят только сам человек и организаторы лиги. Фото меняется сразу (на сервере это своя загрузка),
// имя, текст и уровень — по «Сохранить»; после него — назад, откуда пришли («Я» или анкета).
// Адреса: ?as=user | user-nophoto | user-empty | removed — готовые состояния (Арман Есенов, см. js/me.js);
// ?sheet — шторка фото открыта; ?error=type | small | big | many — ошибка загрузки фото
// (её же покажет «Выбрать из галереи»); ?from=join — пришли из анкеты.
// Галерея здесь не открывается: «Выбрать из галереи» ставит снимок из примера (img/user-photo.webp).
import { hydrate, sheet, esc } from '../app.js';
import { LEVELS } from './join.data.js';
import { checkProfile, ABOUT_MAX } from './join.logic.js';
import { loadU, saveU, account, seedU, seedFromUrl, photoInner, editBadge, goBack, trialHref, themeHref } from './me.js';

const params = new URLSearchParams(location.search);
const $ = (sel, root = document) => root.querySelector(sel);

// ошибки загрузки фото — текстом сервера (поле message ответа)
const ERRORS = {
  type: 'Это не фото. Подойдут JPG или PNG',
  small: 'Фото слишком маленькое: нужно от 400 × 400 точек',
  big: 'Файл больше 8 МБ',
  many: 'Слишком много попыток. Попробуйте через 25 мин',
};
const errKey = ERRORS[params.get('error')] ? params.get('error') : null;
const fromJoin = params.get('from') === 'join';
const backTo = fromJoin ? trialHref('join.html?open=form') : themeHref('me.html');

let U = seedFromUrl('as') || loadU();
// профиль без входа не открыть: прямой заход — профиль пользователя из примера
if (!account(U)) { U = seedU('user'); saveU(U); }
const prof = () => account(U).profile;
const draft = { name: prof().name || '', about: prof().about || '', level: prof().level || null };

const back = $('[data-back]');
back.href = backTo;
back.addEventListener('click', (e) => { e.preventDefault(); goBack(backTo); });

const box = $('[data-pf]');
const tile = ([v, t]) => {
  const on = draft.level === v;
  const first = !draft.level && v === LEVELS[0][0];
  return `<button type="button" role="radio" data-lv="${v}" aria-checked="${on}" tabindex="${on || first ? 0 : -1}">${v === 'unknown' ? esc(t) : `<span class="num">${esc(t)}</span>`}</button>`;
};
box.innerHTML = `
  <p class="pf-who">Видите только вы и организаторы лиги</p>
  <section class="pf-photo" aria-label="Фото">
    <p class="pf-removed" data-removed hidden>Фото убрал организатор</p>
    <button class="me-photo xl" type="button" data-photo aria-haspopup="dialog" aria-label="Фото"></button>
    <p class="pf-err" data-photo-err role="alert" hidden></p>
  </section>
  <form class="pf-form" novalidate data-form>
    <section class="section">
      <div class="card pf-fields">
        <label class="field" data-field="name">
          <span class="cap">Имя и фамилия</span>
          <input class="input" name="name" autocomplete="name" maxlength="60" value="${esc(draft.name)}">
          <span class="hint" data-hint="name" hidden></span>
        </label>
        <label class="field" data-field="about">
          <span class="cap">О себе и достижения</span>
          <textarea class="input" name="about" rows="5" maxlength="${ABOUT_MAX}" placeholder="Например: играю в паре 6 лет, финал городского турнира 2024">${esc(draft.about)}</textarea>
          <span class="hint pf-count"><span data-hint="about"></span><span class="num-s" data-count></span></span>
        </label>
      </div>
    </section>
    <section class="section" aria-labelledby="pf-lv">
      <span class="cap" id="pf-lv">Мой уровень</span>
      <div class="card pf-fields">
        <div class="lv-tiles" role="radiogroup" aria-labelledby="pf-lv">${LEVELS.map(tile).join('')}</div>
      </div>
      <p class="pf-lv-hint">По вашей оценке. Уровень лиги назначают после просмотра игры</p>
    </section>
    <div class="cta"><button class="btn main" type="submit">Сохранить</button></div>
  </form>`;
hydrate(box);

const circle = $('[data-photo]');
const errEl = $('[data-photo-err]');
const removedEl = $('[data-removed]');
const form = $('[data-form]');
const count = $('[data-count]');

// кружок: фото, инициалы из поля имени или значок человека; значок «изменить» всегда
function paintPhoto() {
  const p = prof();
  circle.innerHTML = photoInner({ photo: p.photo, name: draft.name }) + editBadge();
  removedEl.hidden = !(p.removed && !p.photo);
}
const showErr = (k) => { errEl.textContent = k ? ERRORS[k] : ''; errEl.hidden = !k; };
const paintCount = () => { count.textContent = `${draft.about.length} / ${ABOUT_MAX}`; };
paintPhoto();
paintCount();
if (errKey) showErr(errKey);

/* ---------- шторка фото: «Выбрать из галереи», «Убрать фото», «Отмена» ---------- */
const scrim = document.createElement('div');
scrim.className = 'scrim';
const sh = document.createElement('div');
sh.className = 'bsheet float pf-sheet';
sh.setAttribute('role', 'dialog');
sh.setAttribute('aria-labelledby', 'pf-sheet-t');
sh.tabIndex = -1;
sh.innerHTML = `<span class="handle"></span>
  <div class="title" id="pf-sheet-t">Фото</div>
  <div class="pf-sheet-acts">
    <button class="btn quiet" type="button" data-pick>Выбрать из галереи</button>
    <button class="btn quiet" type="button" data-remove>Убрать фото</button>
    <button class="btn ghost" type="button" data-cancel>Отмена</button>
  </div>`;
$('.app').append(scrim, sh);
const s = sheet(sh, scrim);
const openSheet = () => { $('[data-remove]', sh).hidden = !prof().photo; s.open(circle); };
circle.addEventListener('click', openSheet);
$('[data-cancel]', sh).addEventListener('click', () => s.close());

const commit = (patch) => { Object.assign(prof(), patch); saveU(U); };
// снимок уходит на сервер сразу: пока он грузится, кружок тише и по краю бежит дуга
$('[data-pick]', sh).addEventListener('click', () => {
  s.close();
  showErr(null);
  circle.classList.add('busy');
  circle.setAttribute('aria-busy', 'true');
  setTimeout(() => {
    circle.classList.remove('busy');
    circle.removeAttribute('aria-busy');
    if (errKey) { showErr(errKey); return; }
    commit({ photo: true, removed: false });
    paintPhoto();
  }, 900);
});
$('[data-remove]', sh).addEventListener('click', () => {
  s.close();
  showErr(null);
  commit({ photo: false });
  paintPhoto();
});
if (params.has('sheet')) openSheet();

/* ---------- поля и уровень ---------- */
const fieldErr = (k, text) => {
  const f = $(`[data-field="${k}"]`);
  const h = $(`[data-hint="${k}"]`);
  f.classList.toggle('error', !!text);
  h.textContent = text || '';
  if (k === 'name') h.hidden = !text;
};
form.addEventListener('input', (e) => {
  const t = e.target;
  if (t.name === 'name') { draft.name = t.value; fieldErr('name', ''); if (!prof().photo) paintPhoto(); }
  if (t.name === 'about') { draft.about = t.value; fieldErr('about', ''); paintCount(); }
});
const tiles = [...form.querySelectorAll('[data-lv]')];
const pick = (b) => {
  draft.level = b.dataset.lv;
  tiles.forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
};
tiles.forEach((b) => b.addEventListener('click', () => pick(b)));
// плитки — стрелками, как радиокнопки (три в ряд: вверх и вниз — на ряд)
form.querySelector('.lv-tiles').addEventListener('keydown', (e) => {
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[e.key];
  const i = tiles.indexOf(document.activeElement);
  if (!step || i < 0) return;
  e.preventDefault();
  const n = tiles[(i + step + tiles.length) % tiles.length];
  pick(n);
  n.focus();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const bad = checkProfile(draft);
  fieldErr('name', bad.name);
  fieldErr('about', bad.about);
  if (bad.name) { form.elements.name.focus(); return; }
  if (bad.about) { form.elements.about.focus(); return; }
  commit({ name: draft.name.trim().replace(/\s+/g, ' '), about: draft.about.trim(), level: draft.level });
  goBack(backTo);
});
