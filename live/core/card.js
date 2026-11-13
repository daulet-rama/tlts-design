// TLTS · core/card.js — карточка игрока, плашка пары, мяч пары, монограмма, портреты.
// Только разметка: все стили лежат в core/theme.css. Модуль не импортирует data.js и принимает обычные объекты.
// Каждая функция возвращает DOM-элемент; рядом есть вариант ...HTML, который возвращает строку.
// Как пользоваться — core/LOOK.md, как выглядит — core/kit.html.

const HAS_DOM = typeof document !== 'undefined' && typeof window !== 'undefined';
const PORTRAIT_DIR = new URL('../portraits/', import.meta.url);
const BALL3D_DIR = new URL('../../assets/3d/pairballs/', import.meta.url);
const LS_KEY = 'tlts-portraits-v1';

/* ------------------------------------------------------------------ общее */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => (Math.round(n * 100) / 100).toString();
function toElement(html) {
  if (!HAS_DOM) throw new Error('card.js: DOM недоступен — используйте варианты ...HTML');
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
const ICON_CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.6 8.6l3.5 3.4 7.3-7.6" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';

/* ------------------------------------------------------------------ шкала КПР */

// Канон из договора: по этим же цветам рендерятся 3D-мячи в Blender.
export const KPR_SCALE = Object.freeze({ '3.0': '#7FD3EA', '3.5': '#19AFD6', '4.0': '#E6E3DA', '4.5': '#E07A4E', '5.0': '#BF4F27' });
const KPR_RGB = { '3.0': '127 211 234', '3.5': '25 175 214', '4.0': '230 227 218', '4.5': '224 122 78', '5.0': '191 79 39' };

function kprKey(k) {
  if (k === null || k === undefined || k === '') return null;
  const n = Number(k);
  if (!Number.isFinite(n)) return null;
  const key = n.toFixed(1);
  return KPR_SCALE[key] ? key : null;
}
export function kprColor(k) {
  const key = kprKey(k);
  return key ? KPR_SCALE[key] : null;
}
function kprText(k) {
  const n = Number(k);
  return k === null || k === undefined || k === '' || !Number.isFinite(n) ? '' : n.toFixed(1);
}
function kprFill(k) {
  const key = kprKey(k);
  return key ? `var(--kpr-${key.replace('.', '')},${KPR_SCALE[key]})` : 'var(--kpr-none,#8A93A6)';
}
// переменные --k и --k-rgb: цвет уровня игрока для полоски КПР и света монограммы
function kprVars(k) {
  const key = kprKey(k);
  if (!key) return '--k:var(--kpr-none,#8A93A6);--k-rgb:var(--kpr-none-rgb,138 147 166)';
  const t = key.replace('.', '');
  return `--k:var(--kpr-${t},${KPR_SCALE[key]});--k-rgb:var(--kpr-${t}-rgb,${KPR_RGB[key]})`;
}

/** Значок КПР для таблиц и строк: точка цвета уровня и цифра. label: true — с видимым словом «КПР». */
export function kprChipHTML(kpr, { label = false } = {}) {
  const t = kprText(kpr);
  if (!t) return '';
  return `<span class="kpr" style="${kprVars(kpr)}">${label ? 'КПР ' : '<span class="vh">КПР </span>'}${t}</span>`;
}
export function kprChip(kpr, opts = {}) { return toElement(kprChipHTML(kpr, opts) || '<span class="kpr"></span>'); }

/* ------------------------------------------------------------------ мяч пары */

// Шов — та же кривая, что у 3D-мяча (s5 и Blender): на единичной сфере
//   x = a·cos t + b·cos 3t,  y = c·sin 2t,  z = −(a·sin t − b·sin 3t),  b = 0.30, a = 1 − b, c = 2√(ab).
// Смотрим вдоль оси x (как Q_BASE в s5) и поворачиваем на −20°: шов ложится S-образно, половины равны.
// Белая полоса — не обводка, а настоящая полоса на сфере шириной 4,8 мм: к краям диска она сужается.
const BALL = (() => {
  const b = 0.3, a = 1 - b, c = 2 * Math.sqrt(a * b);
  const TILT = -20 * Math.PI / 180, ct = Math.cos(TILT), st = Math.sin(TILT);
  const R = 50, C = 50;
  const S = (u) => [a * Math.sin(u) - b * Math.sin(3 * u), c * Math.sin(2 * u), a * Math.cos(u) + b * Math.cos(3 * u)];
  const dS = (u) => [a * Math.cos(u) - 3 * b * Math.cos(3 * u), 2 * c * Math.cos(2 * u), -a * Math.sin(u) - 3 * b * Math.sin(3 * u)];
  // точка на угловом расстоянии d от шва (d > 0 — половина первого игрока)
  const E = (u, d) => {
    const p = S(u);
    if (!d) return p;
    const t = dS(u);
    const l = [p[1] * t[2] - p[2] * t[1], p[2] * t[0] - p[0] * t[2], p[0] * t[1] - p[1] * t[0]];
    const n = Math.hypot(l[0], l[1], l[2]), cd = Math.cos(d), sd = Math.sin(d) / n;
    return [p[0] * cd + l[0] * sd, p[1] * cd + l[1] * sd, p[2] * cd + l[2] * sd];
  };
  const scr = (p, r = R) => [C + r * (p[0] * ct - p[1] * st), C - r * (p[0] * st + p[1] * ct)];
  const xy = (p) => `${num(p[0])} ${num(p[1])}`;
  // край видимой дуги: идём от центра диска, пока точка смотрит на зрителя
  const limit = (d, dir) => {
    const step = dir * Math.PI / 720;
    let u = 0;
    while (Math.abs(u) < Math.PI && E(u + step, d)[2] > 0) u += step;
    let lo = u, hi = u + step;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (E(m, d)[2] > 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  // видимая дуга кривой как цепочка кубических Безье (эрмитова интерполяция, касательные численные)
  const arc = (d, n = 16) => {
    const us = limit(d, -1), ue = limit(d, 1), h = 1e-4, pts = [];
    for (let i = 0; i <= n; i++) {
      const u = us + (ue - us) * i / n;
      const p = scr(E(u, d)), q1 = scr(E(u + h, d)), q0 = scr(E(u - h, d));
      pts.push({ p, t: [(q1[0] - q0[0]) / (2 * h), (q1[1] - q0[1]) / (2 * h)] });
    }
    const k = (ue - us) / n / 3, segs = [];
    for (let i = 0; i < n; i++) {
      const A = pts[i], B = pts[i + 1];
      segs.push([A.p, [A.p[0] + A.t[0] * k, A.p[1] + A.t[1] * k], [B.p[0] - B.t[0] * k, B.p[1] - B.t[1] * k], B.p]);
    }
    return segs;
  };
  const fwd = (segs) => segs.map((s) => `C${xy(s[1])} ${xy(s[2])} ${xy(s[3])}`).join('');
  const rev = (segs) => segs.slice().reverse().map((s) => `C${xy(s[2])} ${xy(s[1])} ${xy(s[0])}`).join('');
  // дуга по краю диска из P в Q, короткой дорогой
  const limb = (P, Q, r = R) => {
    const cross = (P[0] - C) * (Q[1] - C) - (P[1] - C) * (Q[0] - C);
    return `A${num(r)} ${num(r)} 0 0 ${cross > 0 ? 1 : 0} ${xy(Q)}`;
  };
  const mid = arc(0);
  const start = mid[0][0], end = mid[mid.length - 1][3];
  // на какой стороне хорды лежит половина A
  const chord = [end[0] - start[0], end[1] - start[1]], len = Math.hypot(chord[0], chord[1]);
  let nx = -chord[1] / len, ny = chord[0] / len;
  const side = scr(E(0, 0.3));
  if ((side[0] - C) * nx + (side[1] - C) * ny < 0) { nx = -nx; ny = -ny; }
  const half = (sign, closed, r = R) => {
    const k = r / R, sc = (p) => [C + (p[0] - C) * k, C + (p[1] - C) * k];
    const m = [C + r * nx * sign, C + r * ny * sign], s = sc(start), e = sc(end);
    return closed
      ? `M${xy(start)}${fwd(mid)}${limb(end, m)}${limb(m, start)}Z`
      : `M${xy(e)}${limb(e, m, r)}${limb(m, s, r)}`;
  };
  const band = (d) => {
    const e1 = arc(d), e2 = arc(-d);
    const s1 = e1[0][0], t1 = e1[e1.length - 1][3], s2 = e2[0][0], t2 = e2[e2.length - 1][3];
    return `M${xy(s1)}${fwd(e1)}${limb(t1, t2)}${rev(e2)}${limb(s2, s1)}Z`;
  };
  const SEAM_HALF = 0.0024 / 0.0335;   // полуширина шва, радианы: 4,8 мм на мяче Ø 67 мм
  const cache = {};
  // три начертания шва: точное для крупных мячей, плотнее — для мелких, чтобы шов читался с 20 px
  const variant = (name) => {
    if (cache[name]) return cache[name];
    const w = name === 'fine' ? SEAM_HALF : name === 'mid' ? 0.09 : 0.112;
    const g = name === 'fine' ? 0.032 : name === 'mid' ? 0.04 : 0.05;
    return (cache[name] = { a: half(1, true), b: half(-1, true), band: band(w), groove: band(w + g) });
  };
  // тень-полумесяц справа снизу: намёк на объём без градиентов и идентификаторов
  const shade = (() => {
    const o = 7.5, r2 = R + 1.2, ex = -Math.SQRT1_2, ey = -Math.SQRT1_2;
    const along = (R * R - r2 * r2 + o * o) / (2 * o), h = Math.sqrt(R * R - along * along);
    const p1 = [C + along * ex + h * -ey, C + along * ey + h * ex], p2 = [C + along * ex - h * -ey, C + along * ey - h * ex];
    return `M${xy(p1)}A${R} ${R} 0 0 1 ${xy(p2)}A${num(r2)} ${num(r2)} 0 0 0 ${xy(p1)}Z`;
  })();
  return { variant, half, shade };
})();

// Порядок половин. По умолчанию — как переданы: kprA слева сверху, kprB справа снизу (так мяч стоял всегда,
// и на главной от этого зависит сборка мяча из половин). order: 'level' — меньший уровень слева, как на 3D-рендерах.
function ballOrder(kprA, kprB, order) {
  if (order !== 'level') return [kprA, kprB];
  const a = Number(kprA), b = Number(kprB);
  return kprKey(kprA) && kprKey(kprB) && a > b ? [kprB, kprA] : [kprA, kprB];
}
const ringStyle = 'stroke:var(--ball-ring,rgba(22,25,29,.3))';
const ballSize = (opts) => (Number(opts.size) > 0 ? Number(opts.size) : 32);
const ballVariant = (size) => (size < 28 ? 'bold' : size < 64 ? 'mid' : 'fine');
// половина мяча одного игрока: side 'left' — на месте первой половины пары, 'right' — второй.
// Порядок детей SVG не менять: по нему страницы прятали части раньше (теперь есть классы pball__*).
function halfBody(kpr, right, size) {
  const name = ballVariant(size), g = BALL.variant(name);
  const ring = Math.max(0.9, 100 / size);
  return `<path class="pball__ghost" d="${right ? g.a : g.b}" style="fill:var(--ball-ghost,rgba(127,134,148,.14));${ringStyle}" stroke-width="${num(ring * 1.6)}" stroke-dasharray="5 4.4"/>`
    + `<path class="${right ? 'pball__b' : 'pball__a'}" d="${right ? g.b : g.a}" style="fill:${kprFill(kpr)}"/>`
    + `<path class="pball__groove" d="${g.groove}" fill="rgba(22,25,29,${name === 'fine' ? 0.16 : 0.22})"/>`
    + `<path class="pball__seam" d="${g.band}" style="fill:var(--c-seam,#F4F3EC)"/>`
    + `<path class="pball__ring" d="${BALL.half(right ? -1 : 1, false, 50 - ring / 2)}" fill="none" style="${ringStyle}" stroke-width="${num(ring)}"/>`;
}

/**
 * Мяч пары: половины по уровням КПР партнёров, между ними белый шов. Один КПР — половина мяча игрока.
 *   size        диаметр в px (32) · decorative: true — скрыт от скринридера · label — своя подпись
 *   order       'given' (по умолчанию) — kprA слева сверху · 'level' — меньший уровень слева, как на 3D-рендерах
 *   shade       false — без тени-полумесяца на крупных мячах
 * Части SVG подписаны классами: pball__a, pball__b (половины), pball__groove, pball__seam (шов), pball__shade,
 * pball__ring (обводка), pball__ghost (пустая половина у мяча одного игрока).
 */
export function pairBallHTML(kprA, kprB, opts = {}) {
  const size = ballSize(opts);
  const name = ballVariant(size);
  const g = BALL.variant(name);
  const single = kprB === null || kprB === undefined || kprB === false;
  const ring = Math.max(0.9, 100 / size);                 // в единицах viewBox: не тоньше 1 px
  const ta = kprText(kprA), tb = kprText(kprB);
  const label = opts.label ?? (single ? `Половина мяча, КПР ${ta || 'не указан'}` : `Мяч пары, КПР ${ta || '—'} и ${tb || '—'}`);
  const aria = opts.decorative ? 'aria-hidden="true"' : `role="img" aria-label="${esc(label)}"`;
  const cls = `pball${single ? ' pball--half' : ''}${opts.className ? ' ' + esc(opts.className) : ''}`;
  let body;
  if (single) {
    body = halfBody(kprA, false, size);
  } else {
    const [a, b] = ballOrder(kprA, kprB, opts.order);
    body = `<circle class="pball__b" cx="50" cy="50" r="50" style="fill:${kprFill(b)}"/>`
      + `<path class="pball__a" d="${g.a}" style="fill:${kprFill(a)}"/>`
      + `<path class="pball__groove" d="${g.groove}" fill="rgba(22,25,29,${name === 'fine' ? 0.16 : 0.22})"/>`
      + `<path class="pball__seam" d="${g.band}" style="fill:var(--c-seam,#F4F3EC)"/>`
      + (size >= 48 && opts.shade !== false ? `<path class="pball__shade" d="${BALL.shade}" fill="rgba(22,25,29,.11)"/>` : '')
      + `<circle class="pball__ring" cx="50" cy="50" r="${num(50 - ring / 2)}" fill="none" style="${ringStyle}" stroke-width="${num(ring)}"/>`;
  }
  return `<svg class="${cls}" viewBox="0 0 100 100" width="${num(size)}" height="${num(size)}" ${aria} focusable="false">${body}</svg>`;
}
export function pairBall(kprA, kprB, opts = {}) { return toElement(pairBallHTML(kprA, kprB, opts)); }

/**
 * Половина мяча одного игрока в нужной стороне: side 'left' (0) — место первой половины, 'right' (1) — второй.
 * pairBallHalf(k, 'left') рисует то же, что pairBall(k, null). Две половины одной пары складываются в целый мяч
 * pairBall(kL, kR) — удобно для анимации «мяч собирается из половин».
 */
export function pairBallHalfHTML(kpr, side = 'left', opts = {}) {
  const right = side === 'right' || side === 1 || side === 'b';
  const size = ballSize(opts);
  const t = kprText(kpr);
  const label = opts.label ?? `Половина мяча, КПР ${t || 'не указан'}`;
  const aria = opts.decorative ? 'aria-hidden="true"' : `role="img" aria-label="${esc(label)}"`;
  const cls = `pball pball--half pball--${right ? 'right' : 'left'}${opts.className ? ' ' + esc(opts.className) : ''}`;
  return `<svg class="${cls}" viewBox="0 0 100 100" width="${num(size)}" height="${num(size)}" ${aria} focusable="false">${halfBody(kpr, right, size)}</svg>`;
}
export function pairBallHalf(kpr, side, opts = {}) { return toElement(pairBallHalfHTML(kpr, side, opts)); }

/** Адрес 3D-рендера мяча пары или null (уровень не из шкалы). variant: 'sm' — 160 px, 'full' — 640 px. */
export function pairBall3dUrl(kprA, kprB, variant = 'sm') {
  const a = kprKey(kprA), b = kprKey(kprB);
  if (!a || !b) return null;
  const [lo, hi] = [a, b].sort((x, y) => Number(x) - Number(y)).map((k) => k.replace('.', ''));
  return new URL(`ball-${lo}-${hi}${variant === 'full' ? '' : '-sm'}.webp`, BALL3D_DIR).href;
}
/**
 * Мяч пары 3D-рендером из assets/3d/pairballs (меньший уровень всегда слева). Размер коробки — как у SVG-мяча того же size.
 * Если уровня нет в шкале или картинка не загрузилась — SVG-мяч с order: 'level'.
 */
export function pairBall3dHTML(kprA, kprB, opts = {}) {
  const size = ballSize(opts);
  const sm = pairBall3dUrl(kprA, kprB, 'sm');
  if (!sm || kprB === null || kprB === undefined || kprB === false) return pairBallHTML(kprA, kprB, { ...opts, order: 'level' });
  const full = pairBall3dUrl(kprA, kprB, 'full');
  const label = opts.label ?? `Мяч пары, КПР ${kprText(kprA)} и ${kprText(kprB)}`;
  const aria = opts.decorative ? 'aria-hidden="true"' : `role="img" aria-label="${esc(label)}"`;
  const sizes = opts.sizes || '(min-width: 1600px) 200px, 80px';
  return `<span class="pball pball--3d${opts.className ? ' ' + esc(opts.className) : ''}" style="--ball-d:${num(size)}px" ${aria}`
    + ` data-k="${esc(kprText(kprA))},${esc(kprText(kprB))}" data-size="${num(size)}">`
    + `<img src="${esc(sm)}" srcset="${esc(sm)} 160w, ${esc(full)} 640w" sizes="${esc(sizes)}" alt="" decoding="async" draggable="false"></span>`;
}
export function pairBall3d(kprA, kprB, opts = {}) { return toElement(pairBall3dHTML(kprA, kprB, opts)); }

/* ------------------------------------------------------------------ имена */

// Ширины заглавных букв Fira Sans Extra Condensed ExtraBold Italic в сотых долях em (из таблицы hmtx шрифта).
// По ним фамилия подгоняется под ширину карточки без измерений в браузере.
const ADVANCE = (() => {
  const table = {
    17: ' ', 22: ".'’", 25: 'IІ', 27: 'J', 35: '-', 39: '7', 40: '1F', 42: 'ELГЕЁ', 43: '2/Ғ', 44: '3', 45: 'TZЗТ', 46: '5Э',
    48: '4CSVСУ', 49: '689XХ', 50: 'APYАБРЬҰҮ', 51: 'BRВЯ', 52: '0Ч', 53: 'NUИЙЛӘҺ', 54: 'GHКНП', 55: 'DKД', 57: 'ЦҚҢ',
    58: 'OQОӨ', 60: 'Ъ', 66: 'MМ', 71: 'W', 72: 'ФЫ', 73: 'Ш', 77: 'Щ', 78: 'Ю', 79: 'Ж',
  };
  const m = new Map();
  for (const [w, chars] of Object.entries(table)) for (const ch of chars) m.set(ch, Number(w) / 100);
  return m;
})();
/** Ширина строки эфирным шрифтом в em (заглавными, с разрядкой и запасом 3%). */
export function emWidth(text) {
  let w = 0;
  for (const ch of String(text ?? '').toUpperCase()) w += (ADVANCE.get(ch) ?? 0.56) + 0.02;
  return Math.max(1, Math.round(w * 103) / 100);
}

function nameOf(p) {
  const last = String(p?.last ?? '').trim();
  const first = String(p?.first ?? '').trim();
  const patronymic = String(p?.patronymic ?? '').trim();
  if (last) return { last, first, rest: [first, patronymic].filter(Boolean).join(' '), full: [last, first, patronymic].filter(Boolean).join(' ') };
  const whole = String(p?.name ?? p?.short ?? '').trim() || '—';
  return { last: whole, first: '', rest: '', full: whole };
}
/** Инициалы для монограммы: имя и фамилия, как на афише. */
export function initials(p) {
  const n = nameOf(p);
  const a = n.first ? [...n.first][0] : '';
  const b = [...n.last][0] ?? '';
  return (a + b || '—').toUpperCase();
}

/* ------------------------------------------------------------------ портреты */

// Запасная копия portraits/manifest.json: карточки рисуются синхронно. Файл главнее — он подгружается следом,
// и если отличается, портреты на странице перерисовываются.
let MANIFEST = {
  d01: { full: 'd01.webp', sm: 'd01-sm.webp', facing: 'right', focus: [0.575, 0.25] },
  d02: { full: 'd02.webp', sm: 'd02-sm.webp', facing: 'front', focus: [0.51, 0.23] },
  d03: { full: 'd03.webp', sm: 'd03-sm.webp', facing: 'front', focus: [0.495, 0.21] },
  d04: { full: 'd04.webp', sm: 'd04-sm.webp', facing: 'right', focus: [0.53, 0.21] },
  d05: { full: 'd05.webp', sm: 'd05-sm.webp', facing: 'left', focus: [0.53, 0.245] },
  d06: { full: 'd06.webp', sm: 'd06-sm.webp', facing: 'right', focus: [0.51, 0.215] },
  d07: { full: 'd07.webp', sm: 'd07-sm.webp', facing: 'right', focus: [0.53, 0.26] },
  d08: { full: 'd08.webp', sm: 'd08-sm.webp', facing: 'left', focus: [0.52, 0.235] },
  d09: { full: 'd09.webp', sm: 'd09-sm.webp', facing: 'right', focus: [0.5, 0.24] },
  d10: { full: 'd10.webp', sm: 'd10-sm.webp', facing: 'right', focus: [0.58, 0.28] },
};

let overridesCache = null;
function readOverrides() {
  if (overridesCache) return overridesCache;
  let data = {};
  try {
    const raw = HAS_DOM ? window.localStorage.getItem(LS_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') data = parsed;
  } catch { /* хранилище недоступно или повреждено — работаем без загруженных фото */ }
  return (overridesCache = data);
}
function overrideOf(id) {
  const v = id ? readOverrides()[id] : null;
  if (!v) return null;
  if (typeof v === 'string') return { url: v };
  return v.url ? v : null;
}
const playerId = (p) => (typeof p === 'string' ? p : p?.id ?? '');
const portraitKey = (p) => (typeof p === 'string' ? p : p?.portrait ?? null);

// предпросмотр фото до сохранения: только в этой вкладке и только в памяти
const previews = new Map();

function resolvePortrait(player, variant = 'sm') {
  const id = playerId(player);
  const ov = previews.get(id) || overrideOf(id);
  if (ov) {
    return {
      type: 'override', url: ov.url, facing: ov.facing || 'front',
      focus: Array.isArray(ov.focus) && ov.focus.length === 2 ? ov.focus : [0.5, 0.32],
      zoom: Number(ov.zoom) >= 1 ? Number(ov.zoom) : OVERRIDE_ZOOM,
    };
  }
  const entry = MANIFEST[portraitKey(player)];
  if (entry) {
    const file = entry[variant === 'full' ? 'full' : 'sm'] || entry.full || entry.sm;
    return {
      type: 'file', url: new URL(file, PORTRAIT_DIR).href, facing: entry.facing || 'front',
      focus: Array.isArray(entry.focus) ? entry.focus : [0.5, 0.25],
      sm: entry.sm ? new URL(entry.sm, PORTRAIT_DIR).href : null,
      full: entry.full ? new URL(entry.full, PORTRAIT_DIR).href : null,
    };
  }
  return { type: 'mono' };
}

/** Адрес портрета с учётом загруженного фото. null — портрета нет, нужна монограмма. */
export function portraitUrl(player, variant = 'sm') {
  const r = resolvePortrait(player, variant);
  return r.type === 'mono' ? null : r.url;
}
/** Сведения о портрете: { has, override, facing, focus }. Нужны странице, которая сама кадрирует фото. */
export function portraitMeta(player) {
  const r = resolvePortrait(player, 'sm');
  return r.type === 'mono'
    ? { has: false, override: false, facing: null, focus: null }
    : { has: true, override: r.type === 'override', facing: r.facing, focus: r.focus.slice() };
}
export function hasPortraitOverride(id) { return !!overrideOf(playerId(id)); }

/**
 * Предпросмотр: показать фото во всех карточках игрока на этой странице, ничего не сохраняя
 * (другие вкладки его не видят, после перезагрузки его нет). Удобно, пока игрок двигает кадр в редакторе.
 * meta: { focus: [x, y], facing, zoom } — как у setPortraitOverride. clearPortraitPreview — вернуть как было.
 */
export function setPortraitPreview(id, url, meta = {}) {
  id = playerId(id);
  if (!HAS_DOM || !id || !url) return false;
  const item = { url: String(url) };
  if (Array.isArray(meta.focus) && meta.focus.length === 2) item.focus = [Number(meta.focus[0]), Number(meta.focus[1])];
  if (meta.facing === 'left' || meta.facing === 'right' || meta.facing === 'front') item.facing = meta.facing;
  if (Number(meta.zoom) >= 1) item.zoom = Number(meta.zoom);
  previews.set(id, item);
  refreshPortraits(id);
  return true;
}
export function clearPortraitPreview(id) {
  id = playerId(id);
  if (!HAS_DOM || !id || !previews.has(id)) return false;
  previews.delete(id);
  refreshPortraits(id);
  return true;
}
export function hasPortraitPreview(id) { return previews.has(playerId(id)); }

function emitPortraitChange(id) {
  if (!HAS_DOM) return;
  refreshPortraits(id);
  window.dispatchEvent(new CustomEvent('tlts:portraits', { detail: { playerId: id ?? null } }));
}
function writeOverrides(next) {
  try {
    if (Object.keys(next).length) window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(LS_KEY);
    overridesCache = next;
    return true;
  } catch {
    return false;   // чаще всего — фото не поместилось в localStorage
  }
}
/**
 * Подменить портрет игрока загруженным фото. Хранится в localStorage и сразу появляется во всех карточках
 * на странице и в других вкладках. meta: { focus: [x, y], facing } — необязательно.
 * Возвращает false, если сохранить не удалось (например, фото слишком большое) — сожмите его через fileToPortrait.
 */
export function setPortraitOverride(id, dataUrl, meta = {}) {
  id = playerId(id);
  if (!HAS_DOM || !id || !dataUrl) return false;
  const next = { ...readOverrides() };
  const item = { url: String(dataUrl) };
  if (Array.isArray(meta.focus) && meta.focus.length === 2) item.focus = [Number(meta.focus[0]), Number(meta.focus[1])];
  if (meta.facing === 'left' || meta.facing === 'right' || meta.facing === 'front') item.facing = meta.facing;
  if (Number(meta.zoom) >= 1) item.zoom = Number(meta.zoom);
  next[id] = item;
  if (!writeOverrides(next)) return false;
  emitPortraitChange(id);
  return true;
}
export function clearPortraitOverride(id) {
  id = playerId(id);
  if (!HAS_DOM || !id) return false;
  const next = { ...readOverrides() };
  if (!(id in next)) return true;
  delete next[id];
  if (!writeOverrides(next)) return false;
  emitPortraitChange(id);
  return true;
}
/** Подписка на смену портретов (в этой и в других вкладках). Возвращает функцию отписки. */
export function onPortraitChange(fn) {
  if (!HAS_DOM) return () => {};
  const h = (e) => fn(e.detail?.playerId ?? null);
  window.addEventListener('tlts:portraits', h);
  return () => window.removeEventListener('tlts:portraits', h);
}
/**
 * Подготовить фото к загрузке: обрезать в кадр 3:4 и сжать, чтобы поместилось в localStorage. Возвращает data:URL.
 *   source  File или Blob; можно и уже загруженную картинку: <img>, <canvas>, ImageBitmap
 *   width   ширина результата в px (896 — как у готовых портретов; высота — как у них: 896×1200, 448×600)
 *   crop    какую часть снимка взять: { x, y, width, height } в пикселях снимка (годятся и имена sx, sy, cw, ch)
 *           или в долях от 0 до 1. Кадр подгоняется к 3:4 вокруг своего центра и не выходит за края снимка.
 *           Без crop — середина по ширине, по высоте сверху оставляется доля focusY (лицо обычно в верхней трети).
 */
export async function fileToPortrait(source, { width = 896, quality = 0.84, focusY = 0.25, crop = null } = {}) {
  let url = null, img = source;
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    url = URL.createObjectURL(source);
    img = await new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error('Не удалось прочитать изображение'));
      i.src = url;
    });
  }
  try {
    const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height;
    if (!iw || !ih) throw new Error('Не удалось прочитать изображение');
    // кадр готовых портретов — 896×1200 (почти 3:4); загруженное фото режем в тот же кадр, без полос и растяжения
    const W = Math.round(width), H = Math.round(W * 1200 / 896), ratio = W / H;
    let sw = iw, sh = ih, sx = 0, sy = 0;
    if (crop && typeof crop === 'object') {
      let x = Number(crop.x ?? crop.sx ?? 0), y = Number(crop.y ?? crop.sy ?? 0);
      let w = Number(crop.width ?? crop.w ?? crop.cw ?? crop.sw ?? 0), h = Number(crop.height ?? crop.h ?? crop.ch ?? crop.sh ?? 0);
      if ([x, y, w, h].every((v) => v >= 0 && v <= 1)) { x *= iw; w *= iw; y *= ih; h *= ih; }
      if (!(w > 0)) w = iw;
      if (!(h > 0)) h = ih;
      const cx = x + w / 2, cy = y + h / 2;
      if (w / h > ratio) w = h * ratio; else h = w / ratio;           // 3:4 вокруг центра кадра
      const k = Math.min(1, iw / w, ih / h); w *= k; h *= k;
      sw = w; sh = h;
      sx = Math.min(iw - w, Math.max(0, cx - w / 2));
      sy = Math.min(ih - h, Math.max(0, cy - h / 2));
    } else if (sw / sh > ratio) { const w = sh * ratio; sx = (sw - w) / 2; sw = w; }
    else { const h = sw / ratio; sy = (sh - h) * Math.min(1, Math.max(0, focusY)); sh = h; }
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    let out = canvas.toDataURL('image/webp', quality);
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', quality);
    return out;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

const AVATAR_ZOOM = 1.95;  // круглый аватар: лицо крупно, с воздухом вокруг головы
const OVERRIDE_ZOOM = 1.8; // загруженное фото обычно снято чуть крупнее сгенерированного портрета
const SIZES = { xl: '(min-width: 860px) 24vw, 46vw', lg: '(min-width: 700px) 320px, 42vw', md: '200px', round: '110px' };

function mediaInner(d) {
  const r = d.forceMono ? { type: 'mono' } : resolvePortrait({ id: d.pid, portrait: d.pkey || null }, d.variant);
  if (r.type === 'mono') return { mono: true, html: `<span class="mono__t" data-t="${esc(d.init || '—')}" aria-hidden="true">${esc(d.init || '—')}</span>` };
  const flip = !!d.toward && (r.facing === 'left' || r.facing === 'right') && r.facing !== d.toward;
  const fx = flip ? 1 - r.focus[0] : r.focus[0], fy = r.focus[1];
  const cls = `pmedia__img${flip ? ' is-flip' : ''}`;
  const common = `alt="" decoding="async" loading="${d.eager ? 'eager' : 'lazy'}" draggable="false"`;
  let src = `src="${esc(r.url)}"`;
  if (r.type === 'file' && r.sm && r.full && r.sm !== r.full) {
    src = `src="${esc(d.variant === 'full' ? r.full : r.sm)}" srcset="${esc(r.sm)} 448w, ${esc(r.full)} 896w" sizes="${esc(d.sizes || SIZES.md)}"`;
  }
  if (d.kind === 'round' && (r.type === 'file' || r.type === 'override')) {
    // кадр 3:4 увеличиваем и ставим лицо в центр круга, не выходя за края снимка.
    // Загруженное фото — тоже: лицо крупно, как у готовых портретов (центр лица — focus, по умолчанию верхняя треть)
    const Z = r.type === 'override' ? r.zoom : AVATAR_ZOOM;
    const left = Math.min(0, Math.max(1 - Z, 0.5 - fx * Z)) * 100;
    const top = Math.min(0, Math.max(1 - Z * 4 / 3, 0.5 - fy * Z * 4 / 3)) * 100;
    return { mono: false, html: `<img class="${cls} is-zoom" ${src} ${common} style="width:${num(Z * 100)}%;left:${num(left)}%;top:${num(top)}%">` };
  }
  // объектная позиция считается до зеркала, поэтому берём исходный фокус
  return { mono: false, html: `<img class="${cls}" ${src} ${common} style="object-position:${num(r.focus[0] * 100)}% ${num(fy * 100)}%">` };
}

function mediaHTML(player, o = {}) {
  const d = {
    pid: playerId(player), pkey: portraitKey(player) || '', init: initials(player), kpr: kprText(player?.kpr),
    kind: o.kind === 'round' ? 'round' : 'frame', toward: o.toward === 'left' || o.toward === 'right' ? o.toward : '',
    variant: o.variant === 'full' ? 'full' : 'sm', eager: !!o.eager, sizes: o.sizes || '', forceMono: !!o.forceMono,
  };
  const inner = mediaInner(d);
  const style = [kprVars(player?.kpr)];
  if (d.kind === 'round' && Number(o.ava) > 0) style.push(`--ava:${num(Number(o.ava))}px`);
  const a11y = o.label ? `role="img" aria-label="${esc(o.label)}"` : 'aria-hidden="true"';
  return `<span class="pmedia pmedia--${d.kind}${inner.mono ? ' is-mono' : ''}" data-pslot data-pid="${esc(d.pid)}" data-pkey="${esc(d.pkey)}"`
    + ` data-init="${esc(d.init)}" data-kind="${d.kind}" data-toward="${d.toward}" data-variant="${d.variant}" data-sizes="${esc(d.sizes)}"`
    + `${d.eager ? ' data-eager' : ''}${d.forceMono ? ' data-mono' : ''} ${a11y} style="${style.join(';')}">${inner.html}</span>`;
}

function redrawSlot(slot, forceMono) {
  const s = slot.dataset;
  const inner = mediaInner({
    pid: s.pid || '', pkey: s.pkey || '', init: s.init || '', kind: s.kind === 'round' ? 'round' : 'frame',
    toward: s.toward || '', variant: s.variant === 'full' ? 'full' : 'sm', eager: 'eager' in s, sizes: s.sizes || '',
    forceMono: forceMono || 'mono' in s,
  });
  slot.innerHTML = inner.html;
  slot.classList.toggle('is-mono', inner.mono);
}
/** Перерисовать портреты на странице: все или одного игрока. Вызывается само при смене фото. */
export function refreshPortraits(id) {
  if (!HAS_DOM) return;
  const pid = id ? playerId(id) : null;
  for (const slot of document.querySelectorAll('[data-pslot]')) {
    if (pid && slot.dataset.pid !== pid) continue;
    redrawSlot(slot, false);
  }
}

/**
 * Монограмма — заглушка вместо портрета: инициалы в контровом свете цвета уровня КПР.
 * size: 'sm' или число (диаметр в px) — круг; 'md' | 'lg' | 'xl' — кадр 3:4 во всю ширину родителя.
 */
export function monogramHTML(player, { size = 'md' } = {}) {
  const round = size === 'sm' || typeof size === 'number';
  return mediaHTML(player, {
    kind: round ? 'round' : 'frame', forceMono: true, ava: typeof size === 'number' ? size : undefined,
    label: `${nameOf(player).full}: фото нет`,
  });
}
export function monogram(player, opts = {}) { return toElement(monogramHTML(player, opts)); }

/* ------------------------------------------------------------------ ранг */

// В rankA поле, переданное явно как null, прячет свою ячейку; поле, которого нет, берётся из player.rating и player.titles.
function rankAOf(player, given) {
  const src = given && typeof given === 'object' ? given : {};
  const r = player?.rating || {};
  const pick = (k, fallback) => (Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined ? src[k] : fallback);
  let titles = pick('titles', player?.titles ?? null);
  if (titles && typeof titles === 'object') titles = ['stage', 'final', 'second'].reduce((s, k) => s + (Number(titles[k]) || 0), 0);
  const n = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  return { kpr: pick('kpr', player?.kpr ?? null), place: n(pick('place', r.place)), alphaPlace: n(pick('alphaPlace', r.alphaPlace)), titles: n(titles) };
}
/** Ступени звания: закрашено столько, сколько пройдено. */
export function pipsHTML(level, max = 7) {
  const lv = Math.max(0, Math.min(max, Number(level) || 0));
  let s = '';
  for (let i = 1; i <= max; i++) s += `<i${i <= lv ? ' class="on"' : ''}></i>`;
  return `<span class="pips" role="img" aria-label="Ступень ${lv} из ${max}">${s}</span>`;
}
const titlesWord = (n) => plural(n, 'титул', 'титула', 'титулов');

/* ------------------------------------------------------------------ карточка игрока */

/**
 * Карточка игрока.
 *   size   'xl' — афиша матча · 'lg' — профиль · 'md' — списки · 'sm' — строка с круглым аватаром
 *   toward 'left' | 'right' | null — куда игрок должен смотреть; портрет зеркалится, если снят в другую сторону
 *   rank   'A' — КПР главной цифрой, места и титулы · 'B' — звание и ступень · 'kpr' — только КПР · 'none'
 *   rankA  { kpr, place, alphaPlace, titles } — необязательно: по умолчанию берётся из player.rating и player.titles;
 *          поле со значением null прячет свою ячейку (например { alphaPlace: null })
 *   rankB  { label, level, max, next: { label, need } | null } — результат rankB(player) из data.js
 *   state  null | 'winner' | 'loser' | 'serving'
 *   demoMark  false — не ставить пометку «демо-рейтинг». По умолчанию при rank 'A' у игрока с rating.demo === true
 *          рядом с местами Беты и Альфы стоит «демо-рейтинг»: места выдуманы и могут совпадать с настоящими
 *   href   если задан, карточка становится ссылкой; short: true — в строке sm имя вида «Сарсенбаев Е.»
 */
export function playerCardHTML(player, opts = {}) {
  const p = player || {};
  const size = ['xl', 'lg', 'md', 'sm'].includes(opts.size) ? opts.size : 'md';
  const rank = opts.rank === 'B' ? 'B' : opts.rank === 'none' ? 'none' : opts.rank === 'kpr' ? 'kpr' : 'A';
  const state = ['winner', 'loser', 'serving'].includes(opts.state) ? opts.state : null;
  const n = nameOf(p);
  const kpr = kprText(p.kpr);
  const A = rank === 'A' ? rankAOf(p, opts.rankA) : null;
  const B = rank === 'B' && opts.rankB && typeof opts.rankB === 'object' ? opts.rankB : null;
  const tag = opts.href ? 'a' : size === 'sm' ? 'span' : 'article';
  const cls = `pcard pcard--${size} pcard--rank-${rank.toLowerCase()}${state ? ` is-${state}` : ''}${opts.className ? ' ' + esc(opts.className) : ''}`;
  const em = emWidth(n.last);
  const open = `<${tag} class="${cls}"${opts.href ? ` href="${esc(opts.href)}"` : ''} data-pid="${esc(playerId(p))}" data-em="${em}" style="${kprVars(p.kpr)};--em:${em}">`;
  const stateText = state === 'winner' ? 'Победа' : state === 'serving' ? 'Подача' : '';
  // места демо-игроков выдуманы: помечаем их прямо в карточке (FIXES-2, О5)
  const demoRating = !!(A && p.rating && p.rating.demo === true && opts.demoMark !== false && (A.place != null || A.alphaPlace != null));
  const loserNote = state === 'loser' ? '<span class="vh">Поражение. </span>' : '';

  if (size === 'sm') {
    const title = opts.short && p.short ? p.short : n.full;
    let sub = '';
    if (A && A.place != null) sub = `№${A.place} Бета${A.alphaPlace != null ? ` · №${A.alphaPlace} Альфа` : ''}${demoRating ? ' · демо-рейтинг' : ''}`;
    else if (B && B.label) sub = `${B.label}${B.level ? ` · ${B.level}/${B.max || 7}` : ''}`;
    return open
      + mediaHTML(p, { kind: 'round', toward: opts.toward, variant: 'sm', sizes: SIZES.round, ava: opts.avatar })
      + `<span class="pcard__names">${loserNote}<span class="pcard__name">${esc(title)}`
      + (state === 'serving' ? '<span class="pcard__dot" role="img" aria-label="Подаёт"></span>' : '')
      + (state === 'winner' ? `<span class="pcard__mark" role="img" aria-label="Победа">${ICON_CHECK}</span>` : '')
      + `</span>${sub ? `<span class="pcard__sub">${esc(sub).replace('демо-рейтинг', '<span style="white-space:nowrap">демо-рейтинг</span>')}</span>` : ''}</span>`
      + (kpr ? kprChipHTML(p.kpr) : '')
      + `</${tag}>`;
  }

  if (size === 'lg') {
    const meta = [];
    if (Number.isFinite(Number(p.age)) && p.age !== null && p.age !== '') meta.push(`${p.age} ${plural(Number(p.age), 'год', 'года', 'лет')}`);
    if (p.hand === 'R') meta.push('правша'); else if (p.hand === 'L') meta.push('левша');
    if (p.since) meta.push(p.sinceApprox ? `в лиге с ${p.since} или раньше` : `в лиге с ${p.since}`);
    let block = '';
    if (A) {
      const cells = [];
      if (kpr) cells.push(`<div class="is-kpr"><dt>КПР</dt><dd>${kpr}</dd></div>`);
      if (A.place != null) cells.push(`<div><dt>Бета</dt><dd>№${A.place}</dd></div>`);
      if (A.alphaPlace != null) cells.push(`<div><dt>Альфа</dt><dd>№${A.alphaPlace}</dd></div>`);
      if (A.titles != null) cells.push(`<div><dt>Титулы</dt><dd>${A.titles}</dd></div>`);
      block = cells.length ? `<dl class="pcard__stats">${cells.join('')}</dl>` : '';
      if (block && demoRating) block += '<p class="pcard__demo">места — демо-рейтинг</p>';
    } else if (B) {
      const max = B.max || 7;
      const next = B.next && B.next.label
        ? `<p class="pcard__rankb-next">Следующее — <b>${esc(B.next.label)}</b>${B.next.need ? `. ${esc(B.next.need)}` : ''}</p>`
        : '<p class="pcard__rankb-next">Высшая ступень лестницы</p>';
      block = '<div class="pcard__rankb">'
        + `<p class="pcard__rankb-title">${esc(B.label || '—')}</p>`
        + `<p class="pcard__rankb-step">${pipsHTML(B.level, max)}<span class="cap">ступень ${Number(B.level) || 0} из ${max}</span>${kpr ? kprChipHTML(p.kpr, { label: true }) : ''}</p>`
        + next + '</div>';
    } else if (kpr) {
      block = `<dl class="pcard__stats"><div class="is-kpr"><dt>КПР</dt><dd>${kpr}</dd></div></dl>`;
    }
    return open
      + mediaHTML(p, { kind: 'frame', toward: opts.toward, variant: 'full', sizes: SIZES.lg, eager: true })
      + '<div class="pcard__info">'
      + (n.rest ? `<p class="pcard__first cap">${esc(n.rest)}</p>` : '')
      + `<p class="pcard__last">${loserNote}${esc(n.last)}</p>`
      + (meta.length ? `<p class="pcard__meta">${esc(meta.join(' · '))}</p>` : '')
      + (stateText ? `<span class="tag ${state === 'winner' ? 'tag--gm' : 'tag--soon'} pcard__state">${stateText}</span>` : '')
      + block
      + `</div></${tag}>`;
  }

  // xl и md: портрет во весь кадр, подписи поверх
  const xl = size === 'xl';
  let rankHTML = '';
  if (A) {
    if (xl) {
      const cells = [];
      if (A.place != null) cells.push(`<span class="pcard__stat"><b>№${A.place}</b><i>Бета</i></span>`);
      if (A.alphaPlace != null) cells.push(`<span class="pcard__stat"><b>№${A.alphaPlace}</b><i>Альфа</i></span>`);
      if (A.titles) cells.push(`<span class="pcard__stat"><b>${A.titles}</b><i>${titlesWord(A.titles)}</i></span>`);
      rankHTML = cells.length ? `<span class="pcard__rank">${cells.join('')}</span>` : '';
    } else if (A.place != null) {
      rankHTML = `<span class="pcard__line">№${A.place} Бета${A.titles ? ` · ${A.titles} ${titlesWord(A.titles)}` : ''}</span>`;
    }
    if (rankHTML && demoRating) rankHTML += '<span class="pcard__demo">демо-рейтинг</span>';
  } else if (B && B.label) {
    rankHTML = xl
      ? `<span class="pcard__rank pcard__rank--b"><span class="pcard__title">${esc(B.label)}</span>${pipsHTML(B.level, B.max || 7)}</span>`
      : `<span class="pcard__line">${esc(B.label)}${B.level ? ` · ${B.level}/${B.max || 7}` : ''}</span>`;
  }
  const chip = kpr
    ? `<span class="pcard__kpr${rank === 'A' || rank === 'kpr' ? '' : ' pcard__kpr--sm'}"><b>${kpr}</b><i>КПР</i></span>`
    : '<span></span>';
  const flag = stateText ? `<span class="pcard__flag${state === 'serving' ? ' pcard__flag--serve' : ''}">${stateText}</span>` : '';
  return open
    + mediaHTML(p, { kind: 'frame', toward: opts.toward, variant: xl ? 'full' : 'sm', sizes: xl ? SIZES.xl : SIZES.md, eager: xl })
    + `<span class="pcard__top">${chip}${flag}</span>`
    + `<span class="pcard__body">${loserNote}${n.rest ? `<span class="pcard__first">${esc(n.rest)}</span>` : ''}<span class="pcard__last">${esc(n.last)}</span>${rankHTML}</span>`
    + `</${tag}>`;
}
export function playerCard(player, opts = {}) { return toElement(playerCardHTML(player, opts)); }

/* ------------------------------------------------------------------ плашка пары */

function plateState(o) {
  let games = null, points = null, tiebreak = false;
  let serving = o.serving, winner = o.winner;
  const v = o.view, side = o.side;
  if (v && (side === 0 || side === 1)) {
    if (Array.isArray(v.games)) games = v.games[side];
    if (Array.isArray(v.tiebreak) && (v.inTiebreak || !v.finished)) { points = v.tiebreak[side]; tiebreak = true; }
    else if (Array.isArray(v.points)) points = v.points[side];
    if (serving === undefined) serving = v.server === side;
    if (winner === undefined && v.finished && (v.winner === 0 || v.winner === 1)) winner = v.winner === side;
    if (v.finished) { points = null; tiebreak = false; }
  }
  const s = o.score;
  if (typeof s === 'number' || typeof s === 'string') games = s;
  else if (s && typeof s === 'object') {
    if (s.games !== undefined) games = s.games;
    if (s.tiebreak !== undefined && s.tiebreak !== null) { points = s.tiebreak; tiebreak = true; }
    else if (s.points !== undefined) points = s.points;
  }
  const has = (x) => x !== null && x !== undefined && x !== '';
  return { games: has(games) ? String(games) : null, points: has(points) ? String(points) : null, tiebreak, serving: !!serving, winner: winner === true, loser: winner === false };
}
const hasScore = (st) => st.games !== null || st.points !== null;
function plateTail(st) {
  const marks = (st.serving ? '<span class="plate__serve" role="img" aria-label="Подают"></span>' : '')
    + (st.winner ? `<span class="plate__win" role="img" aria-label="Победа">${ICON_CHECK}</span>` : '');
  return (marks ? `<span class="plate__marks">${marks}</span>` : '')
    + (st.games !== null ? `<span class="plate__games"><span class="vh">Геймы: </span><b>${esc(st.games)}</b></span>` : '')
    + (st.points !== null ? `<span class="plate__pts"><span class="vh">${st.tiebreak ? 'Тай-брейк' : 'Очки'}: </span><span>${esc(st.points)}</span>${st.tiebreak ? '<small aria-hidden="true">ТБ</small>' : ''}</span>` : '');
}
// место под мяч, отметки и счёт в em. Под отметки место держим всегда, когда есть счёт:
// иначе фамилии «дышали» бы при каждом переходе подачи
const plateFixed = (st, seed = false) => num(3.6 + (st.serving || st.winner || st.games !== null ? 1.4 : 0) + (st.games !== null ? 2 : 0) + (st.points !== null ? 2.1 : 0)
  + (seed && !hasScore(st) ? 3 : 0));
const plateClass = (st) => `${st.winner ? ' is-winner' : ''}${st.loser ? ' is-loser' : ''}${st.serving ? ' is-serving' : ''}${hasScore(st) ? ' has-score' : ''}`;

/**
 * Плашка пары в две строки: мяч пары, фамилии, счёт.
 *   layer   'air' | 'paper' — если плашка должна быть своего слоя; без него берёт слой родителя
 *   size    'lg' | 'md' | 'sm'. Все размеры внутри в em: на табло увеличивайте font-size плашки
 *   score   число геймов или { games, points, tiebreak }
 *   view + side  вместо score/serving/winner: view(state) из score.js и сторона 0 | 1
 *   serving true — жёлтая точка подачи · winner true — победа, false — поражение
 *   seed    true — посев пары подписью «посев 4» (или число). Виден, только пока на плашке нет счёта · href — плашка-ссылка
 *   ball3d  true — мяч 3D-рендером из assets/3d/pairballs (меньший уровень слева); без рендера — SVG
 *   bump    true — ячейка счёта, которая изменилась при updatePairPlate, коротко «подпрыгивает» (класс .plate--bump)
 */
export function pairPlateHTML(pair, players = [], opts = {}) {
  const ps = (Array.isArray(players) ? players : []).filter(Boolean).slice(0, 2);
  const size = ['lg', 'md', 'sm'].includes(opts.size) ? opts.size : 'md';
  const st = plateState(opts);
  // обе фамилии одного кегля: подгоняем по самой длинной
  const texts = ps.map((p) => p.last || p.short || p.name || '—');
  const em = texts.length ? Math.max(...texts.map(emWidth)) : 5;
  const names = texts.map((text) => `<span class="plate__n">${esc(text)}</span>`).join('') || '<span class="plate__n">—</span>';
  const ballArgs = [ps[0]?.kpr ?? null, ps.length > 1 ? ps[1].kpr ?? '' : null, { size: size === 'lg' ? 64 : size === 'md' ? 42 : 30, decorative: true }];
  const ball = opts.ball3d ? pairBall3dHTML(...ballArgs) : pairBallHTML(...ballArgs);
  const seedRaw = opts.seed === true ? pair?.seed : typeof opts.seed === 'number' ? opts.seed : null;
  const seed = seedRaw !== null && seedRaw !== undefined && seedRaw !== '' ? seedRaw : null;
  const tag = opts.href ? 'a' : 'div';
  const layer = opts.layer === 'air' || opts.layer === 'paper' ? ` data-layer="${opts.layer}"` : '';
  const label = ps.map((p) => nameOf(p).last).join(' и ');
  return `<${tag} class="plate plate--${size}${plateClass(st)}${opts.bump ? ' plate--bump' : ''}${opts.className ? ' ' + esc(opts.className) : ''}"${layer}${opts.href ? ` href="${esc(opts.href)}"` : ' role="group"'}`
    + ` aria-label="${esc(label)}" data-pair="${esc(pair?.id ?? '')}" style="--plate-fixed:${plateFixed(st, seed !== null)}em">`
    + `<span class="plate__ball">${ball}</span>`
    + `<span class="plate__names" style="--em:${em}">${names}</span>`
    + (seed !== null ? `<span class="plate__seed">посев ${esc(seed)}</span>` : '')
    + plateTail(st)
    + `</${tag}>`;
}
export function pairPlate(pair, players = [], opts = {}) { return toElement(pairPlateHTML(pair, players, opts)); }

/**
 * Обновить счёт, подачу и победителя на уже стоящей плашке — без перерисовки мяча и фамилий.
 * Ячейка, значение которой изменилось, получает класс .is-changed (до следующего обновления).
 */
export function updatePairPlate(el, opts = {}) {
  if (!el || !el.classList || !el.classList.contains('plate')) return el;
  const st = plateState(opts);
  const was = {
    games: el.querySelector('.plate__games b')?.textContent ?? null,
    points: el.querySelector('.plate__pts > span:not(.vh)')?.textContent ?? null,
  };
  for (const node of el.querySelectorAll('.plate__marks, .plate__games, .plate__pts')) node.remove();
  el.insertAdjacentHTML('beforeend', plateTail(st));
  if (st.games !== null && st.games !== was.games) el.querySelector('.plate__games')?.classList.add('is-changed');
  if (st.points !== null && st.points !== was.points) el.querySelector('.plate__pts')?.classList.add('is-changed');
  el.classList.toggle('is-winner', st.winner);
  el.classList.toggle('is-loser', st.loser);
  el.classList.toggle('is-serving', st.serving);
  el.classList.toggle('has-score', hasScore(st));
  el.style.setProperty('--plate-fixed', `${plateFixed(st, !!el.querySelector('.plate__seed'))}em`);
  return el;
}

/* ------------------------------------------------------------------ подгонка фамилий после шрифтов */

// Ширину фамилии card.js считает по таблице ширин эфирного шрифта (--em). Пока шрифт грузится или если он
// не загрузился, запасной может оказаться шире: тогда меряем фактическую ширину и уменьшаем кегль так,
// чтобы фамилия влезла одной строкой. Когда фирменный шрифт пришёл — возвращаем расчётную ширину.
const FIT_SEL = '.pcard--xl .pcard__last, .pcard--md .pcard__last';
function fitOne(last) {
  const card = last.closest('.pcard');
  if (!card || !card.dataset.em) return;
  card.style.setProperty('--em', card.dataset.em);
  const cw = last.clientWidth, sw = last.scrollWidth;
  if (!cw || sw <= cw + 0.5) return;
  const f = parseFloat(getComputedStyle(last).fontSize) || 0, W = card.clientWidth;
  if (!f || !W) return;
  const target = f * (cw / sw) * 0.98;
  card.style.setProperty('--em', String(Math.round((0.86 * W / target) * 1000) / 1000));
}
/** Пересчитать подгонку фамилий в карточках xl и md (все на странице или внутри root). Вызывается сама после загрузки шрифтов. */
export function refitNames(root) {
  if (!HAS_DOM) return;
  const scope = root && root.querySelectorAll ? root : document;
  const list = [...scope.querySelectorAll(FIT_SEL)];
  if (root && root.matches && root.matches(FIT_SEL)) list.push(root);
  for (const el of list) fitOne(el);
}

/* ------------------------------------------------------------------ служебное */

if (HAS_DOM) {
  // портрет не загрузился — ставим монограмму; 3D-мяч не загрузился — ставим SVG-мяч
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    if (img.classList.contains('pmedia__img')) {
      const slot = img.closest('[data-pslot]');
      if (slot) redrawSlot(slot, true);
      return;
    }
    const box = img.parentElement;
    if (box && box.classList.contains('pball--3d')) {
      const [a, b] = (box.dataset.k || '').split(',');
      const label = box.getAttribute('aria-label');
      const svg = toElement(pairBallHTML(a || null, b || '', { size: Number(box.dataset.size) || 32, order: 'level', decorative: !label, label: label || undefined }));
      for (const c of box.classList) if (c !== 'pball--3d' && c !== 'pball') svg.classList.add(c);
      box.replaceWith(svg);
    }
  }, true);
  // шрифты: эфирные начертания с кириллицей запрашиваем сразу, а не при первом показе (иначе фамилии на кнопках
  // первые секунды стоят запасным шрифтом); после загрузки и при ошибке — пересчёт фамилий
  if (document.fonts) {
    try {
      for (const w of [800, 900]) document.fonts.load(`italic ${w} 16px "Fira Sans Extra Condensed"`, 'АЯая09').catch(() => {});
    } catch { /* старый браузер */ }
    // фирменный эфирный шрифт с кириллицей загружен — подгонка по таблице ширин точна, мерить не нужно
    const airReady = () => {
      const faces = [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === 'Fira Sans Extra Condensed' && /U\+0?400/i.test(f.unicodeRange) && (f.weight === '800' || f.weight === '900'));
      return faces.length > 0 && faces.every((f) => f.status === 'loaded');
    };
    let raf = 0;
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => refitNames()); };
    document.fonts.addEventListener?.('loadingdone', later);
    document.fonts.addEventListener?.('loadingerror', later);
    document.fonts.ready?.then(later);
    // карточки, появившиеся позже, проверяем тоже — но только если шрифты ещё грузятся или не загрузились
    if (typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver((recs) => {
        if (airReady()) return;
        for (const r of recs) for (const n of r.addedNodes) if (n.nodeType === 1 && (n.matches(FIT_SEL) || n.querySelector(FIT_SEL))) { later(); return; }
      });
      const start = () => mo.observe(document.body, { childList: true, subtree: true });
      if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
    }
  }
  // фото сменили в другой вкладке
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== LS_KEY) return;
    overridesCache = null;
    emitPortraitChange(null);
  });
  // сверяем запасную копию манифеста с файлом
  fetch(new URL('manifest.json', PORTRAIT_DIR)).then((r) => (r.ok ? r.json() : null)).then((json) => {
    if (!json || typeof json !== 'object') return;
    const clean = {};
    for (const [key, v] of Object.entries(json)) if (v && typeof v === 'object' && (v.full || v.sm)) clean[key] = v;
    if (!Object.keys(clean).length || JSON.stringify(clean) === JSON.stringify(MANIFEST)) return;
    MANIFEST = clean;
    refreshPortraits();
  }).catch(() => { /* файла нет — остаётся запасная копия */ });
}
