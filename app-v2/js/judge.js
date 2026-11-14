// Путь судьи: общее для четырёх экранов — где судья с каждым своим матчем, счёт на пульте,
// строка пары с отметкой и выбор пары плиткой.
// Страница подключает app.js (основа) и свой модуль js/judge.<экран>.js.
// Все факты — из data.js: какие матчи ведёт судья (D.JUDGE), правила (D.RULES), вызовы на корт
// (D.DAY_LOG); здесь только то, что судья сделал сам в этой вкладке.
import { D, duoHtml, icon, keepTheme, startLive } from '../app.js';
import { createScore, replay, FORMAT_LEAGUE } from '../score.js';

export { D };
export const JUDGE = D.JUDGE;
export const RULES = D.RULES;

// ---------- что судья сделал в этой вкладке ----------
// Матч: «скоро» → «идёт» (после «Начать матч») → «сыгран» (итог с пульта) → «отправлен».
// Экраны пути — отдельные страницы, а судья проходит их подряд, поэтому память — sessionStorage.
// Пишем только по действию судьи: открытая страница ничего не меняет.
const KEY = 'tl-judge-v2';
export const store = {
  all() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
  },
  get(id) { return this.all()[id] || {}; },
  set(id, patch) {
    const all = this.all();
    all[id] = { ...(all[id] || {}), ...patch, at: Date.now() };   // at — когда судья трогал матч последним
    try { sessionStorage.setItem(KEY, JSON.stringify(all)); } catch { /* память закрыта: живём без неё */ }
    return all[id];
  },
};

// Где судья с матчем: soon | live | done | sent.
// Пока судья ничего не делал — как в data.js: утренние результаты отправлены, матч за 3-е место
// идёт (4:3, 30:15 в 18:47), за 5-е место — скоро. Дальше правда — то, что судья сделал сам.
export function phaseOf(id) {
  const own = store.get(id).phase;
  if (own) return own;
  if (JUDGE.sent.includes(id)) return 'sent';
  const st = D.match(id).state;
  return st === 'live' ? 'live' : st === 'done' ? 'sent' : 'soon';
}

// ---------- адрес и матч ----------
export const params = new URLSearchParams(location.search);
// ?m=<id> из матчей судьи; иначе — матч в нужном состоянии (phases — по порядку):
// тот, что судья трогал последним, а если не трогал — первый по времени
export function pickMatch(...phases) {
  const id = params.get('m');
  if (id && JUDGE.matches.includes(id)) return id;
  for (const ph of phases) {
    const hits = JUDGE.matches.filter((x) => phaseOf(x) === ph);
    const last = hits.filter((x) => store.get(x).at).sort((a, b) => store.get(b).at - store.get(a).at)[0];
    if (last || hits[0]) return last || hits[0];
  }
  return null;
}
export const go = (href, replace = false) => {
  const url = keepTheme(href);
  if (replace) location.replace(url); else location.href = url;
};
export const courtOf = (m) => D.COURTS[m.court];
export const pairOf = (m, side) => ({ id: m.pairs[side], name: D.pairName(m.pairs[side]), lines: D.pairLines(m.pairs[side]) });
// «Назарова / Гасанова» — для «Ждём …»
export const pairGen = (m, side) => D.pairLines(m.pairs[side]).map((x) => D.genitive(x)).join(' / ');
export const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- вызов на корт и пары на месте ----------
const hm = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
// когда пары вызваны на корт (журнал дня) и с какой минуты можно записать неявку (Кодекс, 2.1)
export function callOf(id) {
  const row = D.DAY_LOG.find(([, kind, mid]) => kind === 'call' && mid === id);
  if (!row) return null;
  return { at: row[0], noshow: hhmm(hm(row[0]) + RULES.callLimit) };
}
// какие пары на корте: отметки судьи в журнале дня, поверх — отметки в этой вкладке
export function hereOf(id) {
  const own = store.get(id).here;
  if (Array.isArray(own)) return own.slice();
  const m = D.match(id);
  return m.pairs.map((p) => D.DAY_LOG.some(([, kind, mid, pid]) => kind === 'oncourt' && mid === id && pid === p));
}

// ---------- счёт на пульте ----------
export const pultHref = (id) => `judge-actions.html?m=${id}&sheet=0`;
export function pultLog(id) {
  const p = store.get(id).pult;
  return p && p.init && Array.isArray(p.log) ? p : null;
}
// Счёт матча, каким его увидит судья на пульте: свой журнал, если судья уже вёл счёт в этой вкладке;
// у идущего матча — счёт общего мира в эту секунду (тот же, что на «Сегодня»); иначе — с нуля,
// первыми подают те, кого выбрал судья перед началом.
export function pultScore(id) {
  const p = pultLog(id);
  if (p) return replay(p.init, p.log);
  if (D.match(id).state === 'live') {
    let snap = null;
    startLive((s) => { if (!snap) snap = s; });
    return snap;
  }
  return createScore({ format: FORMAT_LEAGUE, mode: 'points', firstServer: store.get(id).server === 1 ? 1 : 0 });
}

// ---------- строка пары с отметкой («на месте», «подтвердили») ----------
// .row.pick[aria-pressed] из основы; text — [когда отмечено, когда нет]
export function markRowHtml(m, side, on, [yes, no]) {
  const p = pairOf(m, side);
  return `<button type="button" class="row pick" data-side="${side}" aria-pressed="${on ? 'true' : 'false'}">
    ${duoHtml(p.id, 'sm')}
    <span class="grow"><span class="strong ellipsis">${esc(p.name)}</span><span class="sub" data-yes="${esc(yes)}" data-no="${esc(no)}">${esc(on ? yes : no)}</span></span>
    <span class="mark" aria-hidden="true">${icon('check')}</span>
  </button>`;
}
export function setMark(row, on) {
  row.setAttribute('aria-pressed', on ? 'true' : 'false');
  const sub = row.querySelector('.sub');
  if (sub) sub.textContent = on ? sub.dataset.yes : sub.dataset.no;
}

// ---------- выбор пары плиткой (в шторке): .picks > button из основы ----------
export function pickHtml(m, side, on = false) {
  const p = pairOf(m, side);
  return `<button type="button" data-side="${side}" aria-pressed="${on ? 'true' : 'false'}">
    ${duoHtml(p.id, 'sm')}
    <span class="names"><span>${esc(p.lines[0])} /</span><span>${esc(p.lines[1])}</span></span>
  </button>`;
}

// Шторка, открытая с самого начала (пульт с редкими действиями): без выезда и без переноса фокуса.
// Закрывает и открывает её дальше sheet() основы.
export function openStill(el, scrim) {
  [el, scrim].forEach((x) => { x.style.transition = 'none'; x.classList.remove('off'); });
  el.removeAttribute('inert');
  el.setAttribute('aria-modal', 'true');
  void el.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => [el, scrim].forEach((x) => { x.style.transition = ''; })));
}

// лёгкая отдача в руку, если телефон умеет
export const buzz = (ms = 12) => {
  try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(ms); } catch { /* не умеет */ }
};
