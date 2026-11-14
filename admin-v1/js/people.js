// ============================================================
// Игроки, заявки в лигу, судьи и роли — общее для трёх страниц.
// Всё, что человек сделал здесь, лежит в общем состоянии примера (state из admin.js):
// его видят остальные страницы и вкладки, меню, «Сегодня» и журнал действий.
// Мир примеров — D (../app-v2/data.js + data.js админки); он не меняется.
//
// Свои пути в state (общие — join.<заявка> и judges.<матч> — описаны в ADMIN-SYSTEM.md):
//   players.<игрок>           опубликованные правки карточки: { first, last, kpr, rank, hand, since, photo, at }
//                             (только то, что отличается от мира; photo: data:… или 'none')
//   newPlayers.<игрок>        игрок, добавленный здесь: { id, first, last, kpr, hand, since }
//   judgesKept.<матч>         накладку судьи оставили так: id судьи
//   judgeDays.<турнир>.<корт> судьи этапа заранее: { '2027-07-10': id судьи, … }
//   staff.<человек>           роль в разделе: 'org' | 'council' | 'news' | 'admin'; null — доступ забрали
// ============================================================
import { D, esc, icon, at, plural, state, whoWords } from '../admin.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Значки: из основы, плюс облачко сообщения для «Спросить» (в основе такого нет).
// Тот же рисунок 24 × 24, линия 2 — как у значков admin.js.
const OWN = {
  msg: '<path d="M5.5 4.5h13a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H11l-4.5 3.5V17h-1a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/><path d="M8.5 9.5h7M8.5 12.5h4.5"/>',
};
export function ic(k, cls = '') {
  if (!OWN[k]) return icon(k, cls);
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${OWN[k]}</svg>`;
}

// ---------- поиск по фамилии: казахские буквы и «ё» сводим к русским только для сравнения ----------
const FOLD = { 'ё': 'е', 'і': 'и', 'ә': 'а', 'ө': 'о', 'ү': 'у', 'ұ': 'у', 'қ': 'к', 'ғ': 'г', 'ң': 'н', 'һ': 'х' };
export const fold = (s) => String(s ?? '').toLowerCase().replace(/[ёіәөүұқғңһ]/g, (c) => FOLD[c]).replace(/\s+/g, ' ').trim();
// «Хван», «хван г», «герман», «Жақсыбеков» — подходит ли игрок
export function matches(p, query) {
  const q = fold(query).replace(/\./g, '');
  if (!q) return true;
  const [a, b = ''] = q.split(' ');
  const last = fold(p.last); const first = fold(p.first);
  if (last.startsWith(a) && (!b || first.startsWith(b))) return true;
  if (first.startsWith(a) && (!b || last.startsWith(b))) return true;
  return false;
}

// ---------- игроки: мир + опубликованные правки + добавленные здесь ----------
export const edits = () => state.get('players', {});
export const added = () => Object.values(state.get('newPlayers', {}));
export function person(pid) {
  const base = D.player(pid) || state.get(`newPlayers.${pid}`);
  if (!base) return null;
  const p = { ...base, ...(edits()[pid] || {}) };
  p.name = `${p.first} ${p.last}`;
  return p;
}
export const allPeople = () => [...D.PLAYERS.map((p) => person(p.id)), ...added().map((p) => person(p.id))];
export const ini = (p) => `${(p.first || ' ')[0]}${(p.last || ' ')[0]}`.toUpperCase();
export const kprText = (k) => Number(k).toFixed(1);
export const rankName = (lvl) => (lvl ? D.rankLabel(lvl) : '');
// фото: маленькое — для кружков, большое — для карточки (портреты карты игрока лежат в приложении)
export function photoSrc(p, size = 'sm') {
  if (p.photo === 'none') return null;
  if (p.photo) return p.photo;
  if (!p.portrait) return null;
  if (size === 'sm') return at(`img/${p.portrait}-sm.webp`);
  return p.portrait === 'd03' ? at('img/d03.webp') : at(`../app-v2/img/rating-${p.portrait}.webp`);
}
export function av(pid, cls = '') {
  if (pid === 'me') return `<span class="av me ${cls}" aria-hidden="true">${icon('user')}</span>`;
  const p = person(pid);
  if (!p) return `<span class="av ${cls}" aria-hidden="true"></span>`;
  const src = photoSrc(p, 'sm');
  return src ? `<span class="av ${cls}"><img src="${esc(src)}" alt="" loading="lazy"></span>` : `<span class="av ${cls}" aria-hidden="true">${esc(ini(p))}</span>`;
}
export const nameOf = (pid) => (pid === 'me' ? 'Вы' : person(pid)?.name || '');
export const lastOf = (pid) => (pid === 'me' ? 'Вы' : person(pid)?.last || '');
// «Максима Орлова» — для «Спросить», «у кого»: только частые окончания, иначе как есть
export function genName(p) {
  const g1 = (w) => (/й$/.test(w) ? w.replace(/й$/, 'я') : /[ая]$/.test(w) ? w : /ь$/.test(w) ? w.replace(/ь$/, 'я') : `${w}а`);
  const g2 = (w) => (/(ов|ев|ин|ёв)$/.test(w) ? `${w}а` : /(ий|ой)$/.test(w) ? w.replace(/(ий|ой)$/, 'ого') : /[бвгджзклмнпрстфхцчшщ]$/.test(w) ? `${w}а` : w);
  return `${g1(p.first)} ${g2(p.last)}`;
}
// «с Орловым», «с Хваном», «с Демченко» — творительный падеж фамилии
export function withWhom(last) {
  if (/(ов|ев|ёв|ин|ын)$/.test(last)) return `${last}ым`;
  if (/ий$/.test(last)) return last.replace(/ий$/, 'им');
  if (/й$/.test(last)) return last.replace(/й$/, 'ем');
  if (/[оеиуыэюя]$/.test(last)) return last;
  if (/а$/.test(last)) return last.replace(/а$/, 'ой');
  return `${last}ом`;
}
// «Арману» — дательный падеж имени для «Задать вопрос Арману»
export const dat = (first) => (/й$/.test(first) ? first.replace(/й$/, 'ю') : /[ая]$/.test(first) ? first.replace(/[ая]$/, 'е') : /ь$/.test(first) ? first.replace(/ь$/, 'ю') : `${first}у`);
// «Есенову» — дательный падеж фамилии
export const datLast = (last) => (/(ов|ев|ёв|ин|ын)$/.test(last) ? `${last}у` : /ий$/.test(last) ? last.replace(/ий$/, 'ому') : /[бвгджзклмнпрстфхцчшщ]$/.test(last) ? `${last}у` : last);
// «Армана» — родительный падеж имени: «Спросить Армана», «у Армана»
export const genFirst = (first) => (/й$/.test(first) ? first.replace(/й$/, 'я') : /а$/.test(first) ? first.replace(/а$/, 'ы') : /я$/.test(first) ? first.replace(/я$/, 'и') : /ь$/.test(first) ? first.replace(/ь$/, 'я') : `${first}а`);
// «Хвана» — родительный падеж фамилии: «пропадёт у Хвана»
export const genLast = (last) => (/(ов|ев|ёв|ин|ын)$/.test(last) ? `${last}а` : /ий$/.test(last) ? last.replace(/ий$/, 'ого') : /[бвгджзклмнпрстфхцчшщ]$/.test(last) ? `${last}а` : last);

// ---------- вкладки раздела «Игроки»: все игроки и заявки в лигу ----------
// На телефоне слова короче: «Все 32», «Заявки 3» — вкладка не переносится в две строки.
export function sectionTabs(active) {
  const n = allPeople().length;
  const waiting = D.joinOpen().length;
  return `<nav class="seg pp-tabs" aria-label="Игроки">
    <a href="players.html"${active === 'players' ? ' aria-current="true"' : ''}>${icon('players')}<span class="pp-long">Все игроки</span><span class="pp-short">Все</span><span class="n" data-n="players">${n}</span></a>
    <a href="applications.html"${active === 'apps' ? ' aria-current="true"' : ''}>${icon('user')}<span class="pp-long">Заявки в лигу</span><span class="pp-short">Заявки</span>${waiting ? `<span class="n" data-n="apps">${waiting}</span>` : ''}</a>
  </nav>`;
}

// ---------- строки журнала — те же, что на «Журнале действий» (log.html) ----------
// «**Вы** записали уровень …», «**Арман Есенов** подал анкету» с подписью «кандидат»
export function journalRows(list, { link = true } = {}) {
  return list.map((e) => {
    const w = whoWords(e);
    const body = `<span class="num log-t">${esc(e.at)}</span><span class="log-body"><span class="log-what"><b>${esc(w.name)}</b> ${esc(e.what)}</span>${w.role && e.who !== 'me' ? `<span class="log-role">${esc(w.role)}</span>` : ''}</span>`;
    return link && e.href ? `<li><a class="log-row" href="${esc(e.href)}">${body}${icon('chev', 'go')}</a></li>` : `<li><div class="log-row">${body}</div></li>`;
  }).join('');
}

// Метка «Новое» на месте в рамке приложения — без прокрутки (место и так наверху экрана).
// У карточек приложения края обрезаны (overflow: hidden), поэтому ярлык — отдельной плашкой над карточкой,
// а обводка — та же, что у основы (.adm-mark).
export function markIn(node, word = 'Новое', on = true) {
  if (!node) return;
  const doc = node.ownerDocument;
  if (!doc.getElementById('pp-mark-css')) {
    const st = doc.createElement('style');
    st.id = 'pp-mark-css';
    st.textContent = '.adm-mark.pp-in::after{display:none}.pp-newtag{display:flex;justify-content:flex-end;margin:0 18px -15px;position:relative;z-index:30;pointer-events:none}.pp-newtag span{height:30px;padding:0 12px;border-radius:15px;background:#C9E82A;color:#11170A;font:700 16px/30px "Ubuntu Sans App","Ubuntu Sans",system-ui,sans-serif;box-shadow:inset 0 0 0 2px #11170A}';
    doc.head.append(st);
  }
  const prev = node.previousElementSibling;
  const has = prev && prev.classList.contains('pp-newtag');
  node.classList.toggle('adm-mark', on);
  node.classList.toggle('pp-in', on);
  node.dataset.adm = word;
  if (on && !has) node.insertAdjacentHTML('beforebegin', `<div class="pp-newtag" aria-hidden="true"><span>${esc(word)}</span></div>`);
  if (on && has) prev.firstElementChild.textContent = word;
  if (!on && has) prev.remove();
}

// Подпись под телефоном «Так это увидят…» — по делу экрана: основа пишет «игроки»,
// а здесь смотрит кандидат или судья. Следим и за шторкой «Посмотреть, как увидят».
let capText = null; let capMo = null;
export function pvCaption(text) {
  capText = text;
  const fix = () => document.querySelectorAll('.pv-app figcaption').forEach((f) => {
    const t = [...f.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (t && t.textContent !== capText) t.textContent = capText;
  });
  fix();
  if (!capMo) { capMo = new MutationObserver(fix); capMo.observe(document.body, { childList: true, subtree: true }); }
}

// ---------- мелочи ----------
export const nWord = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;

// Экран следит за своими путями: сделанное изменилось после «Отменить» или в другой вкладке —
// экран перерисуется сам (одна перерисовка за кадр). live(пути, draw) → draw, который помнит,
// что уже нарисовано: после своего state.set экран рисуется сразу и второй раз не мигает.
export function live(paths, draw) {
  let sig = null; let queued = false;
  const now = () => JSON.stringify(paths.map((p) => state.get(p) ?? null));
  const run = (...a) => { sig = now(); return draw(...a); };
  paths.forEach((p) => state.on(p, () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; if (now() !== sig) run(); });
  }));
  return run;
}

// Фото с диска → уменьшенная копия data:… (лежит в общем состоянии и видна в рамке приложения)
export function shrinkPhoto(file, max = 600) {
  return new Promise((res, rej) => {
    if (!file || !file.type || !file.type.startsWith('image/')) { rej(new Error('not image')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      try { res(c.toDataURL('image/jpeg', 0.82)); } catch (e) { rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}

// QR-код ссылки судьи: рисунок для экрана телефона (три угла-метки и поле точек по адресу ссылки)
export function qrSvg(text, n = 29) {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const cells = [];
  const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) if (!finder(x, y) && !(x === 7 || y === 7 || x === n - 8 || y === n - 8) && rnd() > 0.52) cells.push(`M${x} ${y}h1v1h-1z`);
  const eye = (x, y) => `<path d="M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5z" fill-rule="evenodd"/><path d="M${x + 2} ${y + 2}h3v3h-3z"/>`;
  return `<svg viewBox="0 0 ${n} ${n}" role="img" aria-label="QR-код ссылки" shape-rendering="crispEdges"><g fill="#0F1512">${eye(0, 0)}${eye(n - 7, 0)}${eye(0, n - 7)}<path d="${cells.join('')}"/></g></svg>`;
}
