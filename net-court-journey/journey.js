/* ===================================================================
   «Путь по кортам» — четыре стиля по ходу страницы, без выбора темы.
   Белый (первый экран) → Грунт (корт 1) → Хард (корт 2, вечер) → Трава (корты 3–4).

   1) Блоки: у каждого section свой стиль (атрибут data-court), лист
      целиком в одном стиле и не меняется, пока его читают.
   2) Корт-фон: каждый корт — своим покрытием и фактурой; между кортами
      проход с ограждением, поле вокруг перетекает из стиля в стиль
      на участке 300–500 px (рисуется здесь, поверх слоя court.js).
   3) Шапка, нижняя панель, theme-color: стиль по положению прокрутки.
      Белый → Грунт — за прокруткой (оба светлые). В «Хард» и из него —
      короткая плавная смена 0,5 с у границы зоны: фон перетекает, текст
      меняет цвет одним шагом посередине (не бывает «серого на сером»).
   4) Линии и сетки движка мячей — стиль своего блока.
   5) 3D первого экрана: доля «белый → грунт» — JOURNEY.heroMix(p).
   Подключается до court.js. Всё украшение — aria-hidden.
   =================================================================== */
(function () {
  'use strict';
  const DOC = document.documentElement;
  const ORDER = ['white', 'clay', 'hard', 'grass'];
  const DARK = { hard: 1 };
  // какой блок в каком стиле (id блока → стиль)
  const ZONES = {
    top: 'white',
    'last-draw': 'clay', final: 'clay', rating: 'clay',
    kpr: 'hard', network: 'hard', calendar: 'hard', about: 'hard',
    join: 'grass', press: 'grass', photos: 'grass', partners: 'grass', foot: 'grass'
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => mqReduce.matches || DOC.dataset.motion === 'off';

  /* ---------- 1. стили блоков — сразу, до первой отрисовки ---------- */
  function markSections() {
    Object.keys(ZONES).forEach((id) => {
      const el = id === 'foot' ? document.querySelector('footer.foot') : document.getElementById(id);
      if (el) el.setAttribute('data-court', ZONES[id]);
    });
  }
  markSections();

  const J = window.JOURNEY = {
    zones: ZONES,
    // доля «белый → грунт» на первом экране (p — прогресс перехода 0…1)
    heroMix: (p) => smooth(0.12, 0.9, p),
    z: 0
  };

  /* ---------- палитры (из themes.css) ---------- */
  const BG = ['paper', 'card', 'model', 'line', 'line2', 'btn', 'btn-hover', 'wind', 'wind-hover', 'wind-line', 'amber', 'amber-soft', 'path-edge', 'c3-surround', 'c3-court'];
  const TX = ['ink', 'muted', 'placeholder', 'btn-ink', 'on-wind', 'soft', 'path-ink', 'sel', 'sel-ink', 'k-ring', 'k-ring-amber', 'k-ring-wind'];
  const PAL = {};
  function hexToRgb(h) { h = (h || '#000').trim().replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  const toHex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  // OKLab: смешение светлого и тёмного без серой середины
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const gam = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055);
  function toOk(c) {
    const r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function fromOk(o) {
    const L = o[0], a = o[1], b = o[2];
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((v) => clamp(gam(v), 0, 255));
  }
  // цвет сумерек: середина смены светлый ↔ тёмный идёт через лиловый, а не через серый
  const DUSK = '#4B3566', DUSK_OK = toOk(hexToRgb(DUSK)), BUMP = { paper: 0.9, card: 0.9, model: 0.9 };
  function readPalettes() {
    const pr = document.createElement('div'); pr.setAttribute('aria-hidden', 'true'); pr.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.appendChild(pr);
    ORDER.forEach((c) => {
      pr.setAttribute('data-court', c);
      const cs = getComputedStyle(pr), o = {};
      BG.concat(TX).forEach((n) => { o[n] = hexToRgb(cs.getPropertyValue('--' + n)); });
      PAL[c] = o;
    });
    pr.remove();
  }

  // смешение фона для пары светлый ↔ тёмный в OKLab (+ лиловый в середине)
  function okMix(a, b, n, f) {
    const A = toOk(a), Bk = toOk(b), k = (BUMP[n] || 0) * Math.sin(Math.PI * f);
    return fromOk([A[0] + (Bk[0] - A[0]) * f, A[1] + (Bk[1] - A[1]) * f + k * DUSK_OK[1], A[2] + (Bk[2] - A[2]) * f + k * DUSK_OK[2]]);
  }
  const bestInk = (pa, pb, bg) => Math.max(contrast(pa.ink, bg), contrast(pb.ink, bg));
  // полоса доли, где ни старые, ни новые чернила не дают 4,5 на фоне шапки: её фон перескакивает за один кадр
  const BAND = {};
  function findBands() {
    for (let i = 0; i < 3; i++) {
      const a = PAL[ORDER[i]], b = PAL[ORDER[i + 1]]; if (!(DARK[ORDER[i]] || DARK[ORDER[i + 1]])) continue;
      let f0 = -1, f1 = -1;
      for (let s = 0; s <= 400; s++) {
        const f = s / 400; if (bestInk(a, b, okMix(a.paper, b.paper, 'paper', f)) >= 4.6) continue;
        if (f0 < 0) f0 = f; f1 = f;
      }
      if (f0 >= 0) BAND[i] = [Math.max(0, f0 - 1 / 400), Math.min(1, f1 + 1 / 400)];
    }
  }

  /* ---------- 2. корт-фон: покрытия по кортам, проходы и стыки ---------- */
  let layer = null, tileUrl = new Map();
  function urlOf(t) { if (!t) return ''; if (!tileUrl.has(t.c)) tileUrl.set(t.c, t.c.toDataURL('image/png')); return tileUrl.get(t.c); }
  const px = (v) => Math.round(v * 10) / 10 + 'px';
  function texStyle(style, left, top) {
    const t = window.COURT.tile(style); if (!t) return '';
    // фактура привязана к странице: плитка к плитке через все слои
    const bx = -(left % t.w), by = -(top % t.h);
    return 'background-image:url(' + urlOf(t) + ');background-size:' + t.w + 'px ' + t.h + 'px;background-position:' + px(bx) + ' ' + px(by) + ';';
  }
  function courtStyle(C) {
    if (C.tail) return ZONES.partners;
    return ZONES[C.id] || 'clay';
  }
  let geo = null;
  // низ последнего блока стиля s на странице
  function lastBottom(s) {
    const ids = Object.keys(ZONES).filter((k) => ZONES[k] === s), id = ids[ids.length - 1];
    const el = id === 'foot' ? document.querySelector('footer.foot') : document.getElementById(id);
    return el ? el.getBoundingClientRect().bottom + window.scrollY : -Infinity;
  }
  function drawLayer(G) {
    if (!G || !G.courts || !G.courts.length) return;
    const bg = document.getElementById('court-bg'); if (!bg) return;
    if (!layer || !layer.isConnected) {
      layer = document.createElement('div'); layer.className = 'j-bg'; layer.setAttribute('aria-hidden', 'true');
      const ln = bg.querySelector('.cb-lines'); bg.insertBefore(layer, ln || null);
    }
    tileUrl = new Map();
    const H = Math.ceil(G.docH), vw = G.vw, mob = G.mob;
    const courts = G.courts.map((C) => ({ C, s: courtStyle(C) }));
    // зоны поля: подряд идущие корты одного стиля — одна зона
    const zones = [];
    courts.forEach((c, i) => {
      const last = zones[zones.length - 1];
      if (last && last.s === c.s) { last.to = i; return; }
      zones.push({ s: c.s, from: i, to: i });
    });
    let html = '';
    const seams = [];
    // верх каждой зоны и длина перетекания (стык — середина прохода между кортами)
    zones.forEach((z, zi) => {
      z.top = 0; z.fade = 0;
      if (zi > 0) {
        const a = courts[zones[zi - 1].to].C, b = courts[z.from].C;
        const gap = Math.max(0, b.farBase - a.nearBase);
        z.fade = clamp(gap * 0.55, 300, 500); z.top = (a.nearBase + b.farBase) / 2 - z.fade / 2;
      }
    });
    zones.forEach((z, zi) => {
      let top = 0, fade = 0;
      if (zi > 0) {
        const a = courts[zones[zi - 1].to].C, b = courts[z.from].C;
        const g0 = a.nearBase, g1 = b.farBase, gap = Math.max(0, g1 - g0), mid = (g0 + g1) / 2;
        fade = clamp(gap * 0.55, 300, 500);
        top = mid - fade / 2;
        seams.push({ y: mid, a: zones[zi - 1].s, b: z.s, fade, g0, g1 });
      }
      const bot = zi < zones.length - 1 ? zones[zi + 1].top + zones[zi + 1].fade + 2 : H;
      const t0 = Math.max(0, top), h = Math.max(0, bot - t0);
      const mask = fade ? 'linear-gradient(to bottom,transparent 0,#000 ' + px(fade) + ')' : '';
      html += '<div class="j-zone" data-court="' + z.s + '" style="top:' + px(t0) + ';height:' + px(h) + ';' + texStyle(z.s, 0, t0) +
        (mask ? '-webkit-mask-image:' + mask + ';mask-image:' + mask + ';' : '') + '"></div>';
    });
    // светлый ↔ тёмный: поле в проходе — сплошной градиент в oklch (через лиловый сумерек), а не наложение по маске:
    // иначе посередине рыжий под синим даёт бурую муть. Фактура следующего стиля лежит сверху.
    seams.forEach((sm) => {
      if (!(DARK[sm.a] || DARK[sm.b]) || !PAL[sm.a] || !PAL[sm.b]) return;
      const top = sm.y - sm.fade / 2, ca = toHex(PAL[sm.a]['c3-surround']), cb = toHex(PAL[sm.b]['c3-surround']);
      const mid = DARK[sm.b] ? ',' + DUSK + ' 50%' : '';
      const t = window.COURT.tile(sm.b);
      const tex = t ? 'url(' + urlOf(t) + '),' : '';
      html += '<div class="j-seam" data-court="' + sm.b + '" style="top:' + px(top) + ';height:' + px(sm.fade) + ';background-image:' + tex + 'linear-gradient(in oklch to bottom,' + ca + ' 0%' + mid + ',' + cb + ' 100%)' +
        (t ? ';background-size:' + t.w + 'px ' + t.h + 'px,100% 100%;background-repeat:repeat,no-repeat;background-position:0 ' + px(-(top % t.h)) + ',0 0' : '') + '"></div>';
    });
    // покрытие каждого корта
    courts.forEach(({ C, s }) => {
      const top = Math.max(-10, C.farBase), bot = Math.min(H + 10, C.nearBase); if (bot <= top) return;
      const l = G.dbl[0], w = G.dbl[1] - G.dbl[0];
      html += '<div class="j-court" data-court="' + s + '" style="left:' + px(l) + ';top:' + px(top) + ';width:' + px(w) + ';height:' + px(bot - top) + ';' + texStyle(s, l, top) + '"></div>';
    });
    // вечер и утро: перед «Хардом» конец светлого корта темнеет (сумерки), после него начало следующего светлеет из ночи (рассвет)
    for (let i = 0; i + 1 < courts.length; i++) {
      const A = courts[i], Bc = courts[i + 1]; if (A.s === Bc.s) continue;
      const g0 = A.C.nearBase, g1 = Bc.C.farBase, L = mob ? 320 : 420;
      const gp = Math.max(0, g1 - g0);
      // вуаль держится и над проходом, иначе поле за последней линией выглядело бы светлее корта
      if (DARK[Bc.s] && !DARK[A.s]) html += '<div class="j-tint j-dusk" data-court="' + Bc.s + '" style="top:' + px(g0 - L) + ';height:' + px(L + gp) + ';--l:' + px(L) + '"></div>';
      // рассвет: ночь держится до низа последнего тёмного листа («О лиге»), светлеет только под первым светлым («Вступить»)
      if (DARK[A.s] && !DARK[Bc.s]) {
        const night = Math.max(gp, lastBottom(A.s) - g0);
        html += '<div class="j-tint j-dawn" data-court="' + A.s + '" style="top:' + px(g0) + ';height:' + px(night + L) + ';--l:' + px(night) + '"></div>';
      }
    }
    // проходы между кортами: ограждение с ветрозащитой посередине прохода
    for (let i = 0; i + 1 < courts.length; i++) {
      const a = courts[i].C, b = courts[i + 1].C;
      const g0 = a.nearBase, g1 = b.farBase; if (g1 - g0 < 40) continue;
      const mid = (g0 + g1) / 2, hh = mob ? 6 : 8;
      const s = courts[i + 1].s;
      html += '<div class="j-fence" data-court="' + s + '" style="top:' + px(mid - hh / 2) + ';height:' + px(hh) + '"></div>';
    }
    // без 3D (уменьшить движение, «Без анимации»): первый экран — «Белый» и на корте-фоне
    if (G.static) {
      const hero = document.getElementById('top');
      if (hero) {
        const hb = hero.getBoundingClientRect().bottom + window.scrollY, f = 320, hgt = hb + f;
        const m = 'linear-gradient(to bottom,#000 ' + px(hb) + ',transparent ' + px(hgt) + ')';
        html += '<div class="j-white" data-court="white" style="top:0;height:' + px(hgt) + ';background-image:linear-gradient(to right,var(--c3-surround) ' + px(G.dbl[0]) + ',var(--c3-court) ' + px(G.dbl[0]) + ',var(--c3-court) ' + px(G.dbl[1]) + ',var(--c3-surround) ' + px(G.dbl[1]) + ');-webkit-mask-image:' + m + ';mask-image:' + m + '"></div>';
      }
    }
    layer.style.height = H + 'px';
    layer.innerHTML = html;
    geo = { seams, vw };
    J.seams = seams;
  }

  /* ---------- 3. шапка, нижняя панель, theme-color ---------- */
  let hdr = null, tab = null, meta = null;
  let B = { hard: Infinity, grass: Infinity, heroBot: 0 };
  function measureBounds() {
    const sy = window.scrollY, top = (id) => { const el = document.getElementById(id); return el ? el.getBoundingClientRect().top + sy : Infinity; };
    const hero = document.getElementById('top');
    B = { hard: top('kpr'), grass: top('join'), heroBot: hero ? hero.getBoundingClientRect().bottom + sy : 0 };
  }
  let zone = -1;      // дискретная зона под строкой чтения (1 грунт, 2 хард, 3 трава)
  let z = -1, zFrom = 0, zTo = 0, animT = 1, lastT = 0, raf = 0;
  const HYST = 28;
  function readLine() { const h = hdr ? hdr.offsetHeight : 64; return window.scrollY + h + (window.innerHeight - h) * 0.3; }
  function target() {
    const y = readLine();
    const cut = [B.hard, B.grass];
    let d = 1; if (y >= cut[0]) d = 2; if (y >= cut[1]) d = 3;
    // гистерезис: у самой границы зона не дрожит
    if (zone > 0 && d !== zone) {
      const c = d > zone ? cut[d - 2] : cut[zone - 2];
      if (Math.abs(y - c) < HYST) d = zone;
    }
    zone = d;
    if (d > 1) return d;
    // первый экран: белый → грунт идёт за прокруткой
    const C = window.COURT;
    if (!C || !C.G || C.G.static || still()) return window.scrollY + (hdr ? hdr.offsetHeight : 64) >= B.heroBot - 1 ? 1 : 0;
    return J.heroMix(C.p);
  }
  const lum = (c) => { const q = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2]; };
  const contrast = (x, y) => { const p = lum(x), q = lum(y); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05); };
  function palAt(v) {
    const i = clamp(Math.floor(v), 0, 2), f = clamp(v - i, 0, 1);
    const a = PAL[ORDER[i]], b = PAL[ORDER[i + 1]], dark = DARK[ORDER[i]] || DARK[ORDER[i + 1]];
    // светлый ↔ тёмный: фон проходит середину быстро (двойная плавная кривая), текст — одним шагом
    const s1 = f * f * (3 - 2 * f);
    let fb = dark ? s1 * s1 * (3 - 2 * s1) : f;
    // светлый ↔ тёмный: фон перескакивает «серую» полосу, где текст не держит 4,5
    const bd = dark && BAND[i];
    if (bd && fb > bd[0] && fb < bd[1]) fb = fb < (bd[0] + bd[1]) / 2 ? bd[0] : bd[1];
    const out = {};
    BG.forEach((n) => { out[n] = dark ? okMix(a[n], b[n], n, fb) : a[n].map((x, k) => x + (b[n][k] - x) * fb); });
    // шаг текста: те чернила, что читаются на текущем фоне лучше (вне «серой» полосы это всегда не ниже 4,5)
    const useB = dark ? contrast(b.ink, out.paper) >= contrast(a.ink, out.paper) : f >= 0.5;
    TX.forEach((n) => { out[n] = dark ? (useB ? b[n] : a[n]) : a[n].map((x, k) => x + (b[n][k] - x) * f); });
    return { out, name: ORDER[useB ? i + 1 : i] };
  }
  let lastName = '', lastSig = '';
  function paint(v) {
    const { out, name } = palAt(v);
    const sig = v.toFixed(4);
    if (sig === lastSig) return; lastSig = sig;
    const hex = BG.concat(TX).map((n) => ['--' + n, toHex(out[n])]);
    [hdr, tab].forEach((el) => { if (!el) return; hex.forEach(([n, v]) => el.style.setProperty(n, v)); if (el.getAttribute('data-court') !== name) el.setAttribute('data-court', name); });
    const tc = toHex(out.paper);
    if (meta && meta.getAttribute('content') !== tc) meta.setAttribute('content', tc);
    if (name !== lastName) { lastName = name; DOC.setAttribute('data-court', name); }
    J.z = v;
  }
  const DUR = 0.5;
  function frame(t) {
    raf = 0;
    const tg = target();
    // первый показ, «уменьшить движение» и прокрутка, которую сделал не человек (браузер восстановил место
    // после перезагрузки) — сразу нужный стиль, без 0,5 с «Белого» поверх «Харда»
    if (z < 0 || still() || !touched) { z = tg; zTo = tg; animT = 1; paint(z); return; }
    if (tg <= 1 && z <= 1 && animT >= 1) { z = tg; paint(z); return; }
    if (tg !== zTo) { zFrom = z; zTo = tg; animT = 0; lastT = t; }
    if (animT < 1) {
      const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
      animT = Math.min(1, animT + dt / DUR);
      z = zFrom + (zTo - zFrom) * animT;
      paint(z);
      if (animT < 1) raf = requestAnimationFrame(frame);
      return;
    }
    z = tg; paint(z);
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(frame); };
  // сразу, без ожидания кадра
  const paintNow = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } frame(performance.now()); };
  let touched = false;   // человек уже сам крутил, нажимал или касался
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((e) => window.addEventListener(e, () => { touched = true; }, { passive: true, capture: true }));

  /* ---------- 4. линии и сетки мячей: стиль своего блока ---------- */
  function markEdges(root) {
    root.querySelectorAll('.bl-edge').forEach((e) => { const s = ZONES[e.getAttribute('data-edge')]; if (s && e.getAttribute('data-court') !== s) e.setAttribute('data-court', s); });
  }
  function watchBalls() {
    const hook = (bl) => { markEdges(bl); new MutationObserver(() => markEdges(bl)).observe(bl, { childList: true }); };
    const bl = document.getElementById('bl');
    if (bl) { hook(bl); return; }
    const mo = new MutationObserver(() => { const b = document.getElementById('bl'); if (b) { mo.disconnect(); hook(b); } });
    mo.observe(document.body, { childList: true });
  }

  /* ---------- запуск ---------- */
  // ранний показ: journey.js выполняется сразу после разметки блоков, до court.js и до загрузки страницы.
  // Если браузер уже вернул место прокрутки (перезагрузка в середине), шапка и страница сразу в стиле этого места.
  function early() {
    try {
      readPalettes(); findBands();
      hdr = document.getElementById('hdr'); tab = document.querySelector('.tabbar'); meta = document.getElementById('meta-tc');
      if (window.scrollY > 0) { measureBounds(); paintNow(); }
    } catch (e) { /* не вышло — покрасит start() */ }
  }
  // прокрутку, которую сделал не человек (браузер восстанавливает место, пока страница грузится и растёт),
  // красим в том же кадре и с новыми границами блоков
  window.addEventListener('scroll', () => { if (touched || !PAL.white) schedule(); else { measureBounds(); paintNow(); } }, { passive: true });
  if (document.body) early();
  function start() {
    markSections();
    readPalettes(); findBands();
    hdr = document.getElementById('hdr'); tab = document.querySelector('.tabbar'); meta = document.getElementById('meta-tc');
    const C = window.COURT;
    const relay = () => { measureBounds(); if (C && C.G) drawLayer(C.G); lastSig = ''; schedule(); };
    if (C) { C.on('layout', relay); C.on('progress', schedule); }
    relay(); paintNow();
    watchBalls();
    window.addEventListener('resize', () => { measureBounds(); schedule(); });
    // после загрузки браузер восстанавливает место прокрутки: перекрасить сразу; то же при возврате «Назад» (bfcache)
    window.addEventListener('load', () => { relay(); paintNow(); requestAnimationFrame(() => { measureBounds(); paintNow(); }); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) { touched = false; z = -1; } relay(); paintNow(); });
    if (window.ResizeObserver) new ResizeObserver(() => { measureBounds(); schedule(); }).observe(document.querySelector('main') || document.body);
    const onMotion = () => { lastSig = ''; schedule(); };
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', onMotion);
    new MutationObserver(onMotion).observe(DOC, { attributes: true, attributeFilter: ['data-motion'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
