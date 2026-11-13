/* ===================================================================
   net-court-a · «Текст на корте»: тема-покрытие, закрепление первого
   экрана на время перехода, плоский корт-фон на всю страницу.
   Порядок: themes.css → court.css → (страница) → court.js → balls.js.
   =================================================================== */
(function () {
  'use strict';
  const DOC = document.documentElement;
  const S = window.S2 || (window.S2 = {});
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !mqReduce.matches && DOC.dataset.motion !== 'off';
  // [корт-3] без пробного WebGL-контекста: признак поддержки, а настоящую неудачу сообщает сама 3D-сцена (Court.noGL)
  let hasGL = !!(window.WebGLRenderingContext || window.WebGL2RenderingContext);
  const FORCE_STATIC = /[?&]static\b/.test(location.search);

  /* ---------------- темы ---------------- */
  const COURTS = [['clay', 'Грунт'], ['hard', 'Хард'], ['grass', 'Трава']];
  const courtIco = (c) => '<svg data-court="' + c + '" viewBox="0 0 30 20" aria-hidden="true" focusable="false"><rect x=".5" y=".5" width="29" height="19" style="fill:var(--ico-out);stroke:var(--line2)"/><rect x="4" y="3.5" width="22" height="13" style="fill:var(--ico-court);stroke:var(--ico-line)" stroke-width="1.1"/><path d="M15 3.5v13M9 5.4v9.2M21 5.4v9.2M9 10h12" style="stroke:var(--ico-line)" stroke-width="1"/></svg>';
  // цвета любой темы — с невидимого «образца», без ожидания CSS-перелива
  const probeCache = {};
  const PROBE_KEYS = ['c3-sky', 'c3-fog', 'c3-court', 'c3-lines', 'c3-screen', 'c3-post', 'c3-net', 'c3-tape', 'c3-hemi-sky', 'c3-hemi-ground', 'c3-sun', 'c3-fill',
    'court-surf', 'court-tex-a', 'court-tex-b', 'court-grain-a', 'court-grain-b', 'court-line', 'ink', 'c3-fog-near', 'c3-fog-far', 'c3-hemi-i', 'c3-sun-i', 'c3-sun-n', 'c3-fill-i', 'court-line-a', 'theme-color'];
  function colors(court) {
    if (probeCache[court]) return probeCache[court];
    const el = document.createElement('div'); el.setAttribute('data-court', court); el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
    document.body.appendChild(el);
    const cs = getComputedStyle(el), out = {};
    PROBE_KEYS.forEach((k) => { out[k] = cs.getPropertyValue('--' + k).trim(); });
    el.remove();
    return (probeCache[court] = out);
  }
  // [корт-2] смена темы без серого кадра: новая тема раскрывается кругом от нажатой кнопки,
  // старая под ней не гаснет — цвета не смешиваются (рыжее + синее давали серый)
  let lastPt = null;
  document.addEventListener('pointerdown', (e) => { lastPt = [e.clientX, e.clientY]; }, true);
  document.addEventListener('keydown', () => { lastPt = null; }, true);
  function setCourt(c, save, anim) {
    if (!COURTS.some((x) => x[0] === c)) c = 'clay';
    if (anim && document.startViewTransition && motionOK() && DOC.getAttribute('data-court') !== c) {
      const W = window.innerWidth, H = window.innerHeight;
      let x = W - 60, y = 30;
      const sw = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-cs] button');
      if (lastPt) { x = lastPt[0]; y = lastPt[1]; } else if (sw) { const r = sw.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
      lastPt = null;
      const R = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 8;
      const vt = document.startViewTransition(() => apply(c, save, anim));
      vt.ready.then(() => {
        DOC.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 620, easing: 'cubic-bezier(.45,0,.2,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(() => {});
      return;
    }
    apply(c, save, anim);
  }
  function apply(c, save, anim) {
    DOC.setAttribute('data-court', c);
    const tc = $('#meta-tc'); if (tc) tc.setAttribute('content', colors(c)['theme-color'] || '#F3ECE2');
    if (save) { try { localStorage.setItem('tlts-court', c); } catch (e) { /* без хранилища */ } }
    paintSwitches();
    document.dispatchEvent(new CustomEvent('court:change', { detail: { court: c, anim: !!anim } }));
  }
  function paintSwitches() {
    const cur = DOC.getAttribute('data-court');
    $$('[data-cs]').forEach((g) => {
      if (!g.firstChild) g.innerHTML = COURTS.map(([c, n]) => '<button type="button" role="radio" data-set="' + c + '">' + courtIco(c) + '<span>' + n + '</span></button>').join('');
      g.querySelectorAll('button').forEach((b) => { const on = b.dataset.set === cur; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    });
    $$('[data-cs-tog]').forEach((t) => { const nm = (COURTS.find((x) => x[0] === cur) || COURTS[0])[1]; t.innerHTML = courtIco(cur); t.setAttribute('aria-label', 'Покрытие сайта: ' + nm + '. Сменить'); });
  }
  const closeTogs = (except) => $$('.csw.open').forEach((w) => { if (w !== except) { w.classList.remove('open'); const t = w.querySelector('[data-cs-tog]'); if (t) t.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { const w = $('.csw.open'); closeTogs(null); if (w) w.querySelector('[data-cs-tog]').focus(); return; }
    const b = e.target.closest && e.target.closest('[data-cs] button');
    if (b && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) { // радиогруппа: стрелки
      e.preventDefault(); const list = Array.from(b.parentNode.children), i = list.indexOf(b), d = /Right|Down/.test(e.key) ? 1 : -1;
      const n = list[(i + d + list.length) % list.length]; setCourt(n.dataset.set, true, true); n.focus();
    }
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-cs-tog]');
    if (t) { const w = t.parentNode, op = !w.classList.contains('open'); closeTogs(w); w.classList.toggle('open', op); t.setAttribute('aria-expanded', String(op)); if (op) { const s = w.querySelector('[aria-checked=true]'); if (s) s.focus(); } return; }
    if (!e.target.closest('.csw')) closeTogs(null);
    const b = e.target.closest('[data-cs] button');
    if (b) { if (b.dataset.set !== DOC.getAttribute('data-court')) setCourt(b.dataset.set, true, true); closeTogs(null); }
  });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (m) => { let saved = null; try { saved = localStorage.getItem('tlts-court'); } catch (e) { /* ok */ } if (!saved) setCourt(m.matches ? 'hard' : 'clay', false, true); });

  /* ---------------- геометрия корта ---------------- */
  const Court = window.Court = { p: 1, D: 0, hdr: 0, pinned: false, geo: null, colors,
    pageSY: () => (Court.pinned ? Math.max(window.scrollY, Court.D) : window.scrollY) };
  // мячи живут в координатах «после перехода»: так их границы совпадают со страницей, когда она отпущена
  S.pageSY = Court.pageSY;
  S.heroEdgeTh = () => (Court.pinned ? Court.D - 2 : 16);

  const IDS = ['last-draw', 'final', 'rating', 'kpr', 'network', 'calendar', 'about', 'join', 'press', 'photos', 'partners'];
  function geometry() {
    const pin = $('#pin'), pr = pin.getBoundingClientRect();
    const relY = (el) => (el ? el.getBoundingClientRect().top - pr.top : 0);
    const ld = $('#last-draw'), inn = $('.ch-in', ld), iq = inn.getBoundingClientRect(), cs = getComputedStyle(inn);
    const x0 = iq.left + parseFloat(cs.paddingLeft), x1 = iq.right - parseFloat(cs.paddingRight);
    const mob = window.innerWidth < 768, band = mob ? 14 : 18, s = (x1 - x0) / 12.8, cx = (x0 + x1) / 2;
    const T = {}; IDS.forEach((id) => { T[id] = relY(document.getElementById(id)); });
    T.foot = relY($('.foot')); T.facts = relY($('#about .facts'));
    const hv = $('#hero-vis').getBoundingClientRect();
    return { x0, x1, s, cx, band, mob, T, Y0: T['last-draw'] + band, H: pin.offsetHeight, W: DOC.clientWidth, hvTopRel: hv.top - pr.top, hvH: hv.height, gap: mob ? 24 : 40 };
  }

  /* [корт-2] фактура покрытия (как в варианте B): крошка грунта, матовый акрил, травинки.
     Полосы стрижки травы — отдельный слой, его под текстом не гасим (иначе пятна). */
  function tile(court) {
    const v = colors(court), N = 128, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'); let seed = court === 'clay' ? 11 : court === 'hard' ? 23 : 37;
    const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const A = v['court-grain-a'] || v['court-tex-a'], B = v['court-grain-b'] || v['court-tex-b'];
    // тёмная и светлая крошка симметричны вокруг цвета покрытия: средний тон = покрытие, «чистое поле» не светлее
    if (court === 'clay') {
      for (let i = 0; i < 2300; i++) { g.globalAlpha = 0.35 + rr() * 0.5; g.fillStyle = rr() < 0.5 ? A : B; const sz = rr() < 0.8 ? 1 : 2; g.fillRect(Math.floor(rr() * N), Math.floor(rr() * N), sz, sz); }
    } else if (court === 'hard') {
      for (let i = 0; i < 3600; i++) { g.globalAlpha = 0.3 + rr() * 0.45; g.fillStyle = rr() < 0.5 ? A : B; g.fillRect(Math.floor(rr() * N), Math.floor(rr() * N), 1, 1); }
    } else {
      for (let i = 0; i < 1300; i++) { g.globalAlpha = 0.3 + rr() * 0.4; g.fillStyle = rr() < 0.5 ? A : B; g.fillRect(Math.floor(rr() * N), Math.floor(rr() * N), 1, 2 + Math.floor(rr() * 3)); }
    }
    return c.toDataURL('image/png');
  }
  let built = false;
  function buildLayers() {
    const court = $('#court'); if (!court || built) return;
    court.innerHTML = '<div class="st"></div><div class="cm"><div class="tx tx-clay"></div><div class="tx tx-hard"></div><div class="tx tx-grass"></div></div><div class="lm"><svg class="lines" aria-hidden="true" focusable="false"></svg></div>';
    ['clay', 'hard', 'grass'].forEach((c) => { court.querySelector('.tx-' + c).style.backgroundImage = 'url(' + tile(c) + ')'; });
    built = true;
  }
  /* [корт-2] «чистое поле» под текстом — не плашка, а маска: под буквами гаснут крошка и линии корта,
     край мягкий (маска в 3–4 раза мельче страницы + размытие). Цвет под буквами — то же покрытие. */
  const PLATES = '.br-wrap,.rate-b,.rate-a,.kp-pick,.kp-out,.tl,.more .tscroll,.press,.partners,.ch.dark>.ch-in,.ql,.next-row,.fin,.btn,.seg,.bp,.vh,[aria-hidden="true"]';
  function textRects(pr) {
    const out = [], root = $('#pin');
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const rg = document.createRange();
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!/\S/.test(n.textContent)) continue;
      const el = n.parentElement; if (!el || el.closest(PLATES) || el.closest('script,style,svg')) continue;
      rg.selectNodeContents(n);
      const rs = rg.getClientRects();
      for (let i = 0; i < rs.length; i++) { const q = rs[i]; if (q.width > 1 && q.height > 1) out.push([q.left - pr.left, q.top - pr.top, q.width, q.height]); }
    }
    // заголовок первого экрана: видимые строки (сам h1 спрятан для чтения с экрана)
    $$('.hero-h1 .ln').forEach((el) => { const q = el.getBoundingClientRect(); out.push([q.left - pr.left, q.top - pr.top, q.width, q.height]); });
    return out;
  }
  function buildMask(g) {
    const cm = $('#court .cm'); if (!cm) return;
    const pr = $('#pin').getBoundingClientRect(), k = g.mob ? 3 : 4;
    const cw = Math.ceil(g.W / k), ch = Math.ceil(g.H / k);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, cw, ch);
    x.globalCompositeOperation = 'destination-out';
    x.filter = 'blur(' + (g.mob ? 2.4 : 2.2) + 'px)';
    const px = g.mob ? 9 : 14, py = g.mob ? 6 : 9;
    x.beginPath();
    textRects(pr).forEach(([l, t, w, h]) => { x.rect((l - px) / k, (t - py) / k, (w + 2 * px) / k, (h + 2 * py) / k); });
    x.fill();
    x.filter = 'none'; x.globalCompositeOperation = 'source-over';
    const url = c.toDataURL('image/png');
    cm.style.webkitMaskImage = cm.style.maskImage = 'url(' + url + ')';
    cm.style.webkitMaskSize = cm.style.maskSize = '100% 100%';
    // [корт-3] линии: та же маска с порогом — под буквами линия гаснет полностью, мягкий край остаётся
    const lm = $('#court .lm'); if (!lm) return;
    const id = x.getImageData(0, 0, cw, ch), d = id.data, LUT = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) { const t = clamp((i / 255 - 0.42) / (0.95 - 0.42), 0, 1); LUT[i] = Math.round(255 * t * t * (3 - 2 * t)); }
    for (let i = 3; i < d.length; i += 4) d[i] = LUT[d[i]];
    x.putImageData(id, 0, 0);
    const url2 = c.toDataURL('image/png');
    lm.style.webkitMaskImage = lm.style.maskImage = 'url(' + url2 + ')';
    lm.style.webkitMaskSize = lm.style.maskSize = '100% 100%';
  }
  let edgeStyle = null;
  function drawCourt(g) {
    buildLayers();
    const court = $('#court'), svg = court.querySelector('svg.lines');
    const s = g.s, cx = g.cx, T = g.T, wS = Math.max(2, 0.05 * s), wB = Math.max(3, 0.1 * s);
    const sx = 4.115 * s, dx = 5.485 * s, f = (v) => Math.round(v * 10) / 10;
    let out = '';
    const H = (y, half, w) => { if (y < -w || y > g.H) return; out += '<rect class="ln" x="' + f(cx - half) + '" y="' + f(y - w / 2) + '" width="' + f(half * 2) + '" height="' + f(w) + '"/>'; };
    const V = (x, y0, y1, w) => { y0 = Math.max(0, y0); if (y1 <= y0) return; out += '<rect class="ln" x="' + f(x - w / 2) + '" y="' + f(y0) + '" width="' + f(w) + '" height="' + f(y1 - y0) + '"/>'; };
    const sides = (y0, y1) => { [-dx, -sx, sx, dx].forEach((o) => V(cx + o, y0, y1, wS)); };
    // корт 1: дальняя половина — в настоящем масштабе (её видно в 3D), ближняя — до границ блоков
    const B1f = g.Y0 - 11.885 * s, S1f = g.Y0 - 6.4 * s;
    H(B1f, dx, wB); H(S1f, sx, wS); sides(B1f, T.rating); V(cx, S1f, T.final, wS);
    // [корт-2] корты стоят спиной друг к другу на ОДНОЙ задней линии (её рисует граница блока) — без второй черты
    sides(T.rating, T.about); V(cx, T.kpr, T.calendar, wS);
    // корт 3: линия подачи — верх фактов «О лиге»
    H(T.facts, sx, wS); sides(T.about, T.photos); V(cx, T.facts, T.press, wS);
    // корт 4: начинается у «Партнёров» и уходит под ограждение (подвал)
    sides(T.partners, T.foot);
    svg.setAttribute('width', g.W); svg.setAttribute('height', g.H); svg.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);
    svg.innerHTML = out;
    // полосы стрижки: шаг 3 м, граница полос — на основании сетки (как в 3D); под текстом не гаснут
    const P = 3 * s, st = court.querySelector('.st'), v = colors('grass');
    st.style.backgroundImage = 'repeating-linear-gradient(180deg,' + v['court-tex-a'] + ' 0,' + v['court-tex-a'] + ' ' + f(P / 2) + 'px,' + v['court-tex-b'] + ' ' + f(P / 2) + 'px,' + v['court-tex-b'] + ' ' + f(P) + 'px)';
    st.style.backgroundSize = '100% ' + f(P) + 'px';
    st.style.backgroundPosition = '0 ' + f(((g.Y0 % P) + P) % P) + 'px';
    buildMask(g);
    // границы блоков, которые рисует движок мячей: толщина по роли; [корт-2] только между боковыми линиями, концы мягкие
    const role = { final: 's', rating: 'b', kpr: 's', calendar: 's', about: 'b', press: 's', photos: 'b', partners: 'b', foot: 'f' };
    let css = '';
    Object.keys(role).forEach((id) => {
      const r = role[id], half = r === 's' ? sx : dx, w = r === 's' ? wS : wB;
      css += '#bl [data-edge="' + id + '"]{--lw:' + f(w) + 'px';
      if (r !== 'f') { const L = f(cx - half - w / 2), R = f(cx + half + w / 2), fd = 10; const gr = 'linear-gradient(90deg,transparent ' + f(L - fd) + 'px,#000 ' + L + 'px,#000 ' + R + 'px,transparent ' + f(R + fd) + 'px)'; css += ';-webkit-mask-image:' + gr + ';mask-image:' + gr; }
      css += '}\n';
    });
    if (!edgeStyle) { edgeStyle = document.createElement('style'); edgeStyle.id = 'court-edges'; document.head.appendChild(edgeStyle); }
    edgeStyle.textContent = css;
  }

  /* ---------------- закрепление и прогресс перехода ---------------- */
  const hero = () => $('.hero');
  let lastHp = '';
  function decide() {
    const want = motionOK() && hasGL && !FORCE_STATIC;
    Court.pinned = want;
    DOC.classList.toggle('court-pin', want);
    measure();
  }
  function measure() {
    const hdr = $('#hdr');
    Court.hdr = hdr ? hdr.offsetHeight : 68;
    const pin = $('#pin'); if (pin) pin.style.setProperty('--pin-top', Court.hdr + 'px');
    Court.D = Court.pinned ? Math.round(window.innerHeight) : 0;
    DOC.style.setProperty('--pin-d', Court.D + 'px');
    Court.geo = geometry();
    drawCourt(Court.geo);
    snapCam();
    document.dispatchEvent(new CustomEvent('court:layout'));
  }

  /* [корт-2] камера с лёгким отставанием от прокрутки.
     Два последовательных сглаживания (каждое — экспонента с половиной постоянной времени):
     разгон и торможение мягкие, перелёта нет. Отставание сходит на нет к концу перехода,
     чтобы 3D и плоский корт совпали без скачка; большой отрыв (бросок) догоняется за ≤ 0,25 с,
     прыжок по меню — сразу. Кадры считаются только пока камера движется. */
  const CAM = [['sharp', 'чётко', 0.05], ['smooth', 'плавно', 0.14], ['lazy', 'лениво', 0.17]]; // [корт-3] «лениво» встаёт ≤ 0,6 с
  const CAM_KEY = 'tlts-court-cam';
  let camMode = 'smooth';
  try { const v = localStorage.getItem(CAM_KEY); if (CAM.some((c) => c[0] === v)) camMode = v; } catch (e) { /* без хранилища */ }
  const tauNow = () => (CAM.find((c) => c[0] === camMode) || CAM[1])[2] * (window.innerWidth < 768 ? 0.7 : 1);
  S.cam = { modes: CAM.map((c) => ({ id: c[0], name: c[1], tau: c[2] })), rec: 'smooth', get: () => camMode,
    set: (v) => { if (!CAM.some((c) => c[0] === v)) return; camMode = v; try { localStorage.setItem(CAM_KEY, v); } catch (e) { /* ok */ } } };
  let p1 = 1, camRaf = 0, camLast = 0, jumpAt = 0;
  const target = () => (Court.pinned && Court.D ? clamp(window.scrollY / Court.D, 0, 1) : 1);
  function snapCam() { const t = target(); p1 = t; Court.p = t; Court.pt = t; apply3(true); shiftBalls(); }
  function camStep(now) {
    camRaf = 0;
    const dt = camLast ? Math.min(0.05, Math.max(0.001, (now - camLast) / 1000)) : 1 / 60; camLast = now;
    const t = target(); Court.pt = t;
    let p = Court.p;
    const D = Math.max(1, Court.D), err = Math.abs(t - p) * D;
    if (!Court.pinned || now < jumpAt || err > 0.6 * D) { p1 = t; p = t; }
    else {
      // [корт-3] к концу перехода отставание сжимается мягче (не до 0,3, а до 0,55): корт не «подтягивается рывком»
      let tau = tauNow() * Math.max(0.55, 1 - 0.45 * smooth(0.6, 1, Math.max(t, p)));
      const maxLag = (window.innerWidth < 768 ? 0.16 : 0.2) * D;      // бросок: отрыв больше — догоняем быстрее
      if (err > maxLag) tau = Math.min(tau, tauNow() * maxLag / err * 0.6);
      const a = 1 - Math.exp(-dt / Math.max(0.004, tau / 2));
      p1 += (t - p1) * a; p += (p1 - p) * a;
      if (Math.abs(t - p) * D < 1 && Math.abs(t - p1) * D < 1) { p = t; p1 = t; } // [корт-3] доля пикселя никому не видна
    }
    Court.p = p;
    apply3(false);
    if (Court.kick3d) Court.kick3d();
    if (p !== t || p1 !== t) camRaf = requestAnimationFrame(camStep); else camLast = 0;
  }
  function wake() { if (!camRaf) { camRaf = requestAnimationFrame(camStep); } }
  function apply3(force) {
    const p = Court.p;
    const hp = Court.pinned ? (1 - smooth(0.05, 0.25, p)).toFixed(3) : '0'; // [корт-3] бумага панели гаснет быстрее
    if (hp !== lastHp || force) { const h = hero(); if (h) h.style.setProperty('--hp', hp); lastHp = hp; }
    const landed = !Court.pinned || (window.scrollY >= Court.D - 3 && p >= 0.997);
    if (DOC.classList.contains('court-landed') !== landed) DOC.classList.toggle('court-landed', landed);
    const mid = Court.pinned && !landed && p > 0.04; // [корт-3] середина перехода: текст первого экрана — с ореолом цвета покрытия
    if (DOC.classList.contains('court-mid') !== mid) DOC.classList.toggle('court-mid', mid);
  }
  let lastSY = window.scrollY;
  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    if (Math.abs(sy - lastSY) > 0.6 * Math.max(1, Court.D)) jumpAt = performance.now() + 80; // прыжок одним движением
    lastSY = sy; wake(); shiftBalls();
  }, { passive: true });
  // [корт-2] слой мячей живёт в координатах «после перехода»: пока страница закреплена, сдвигаем его вместе с ней,
  // чтобы мячи, уходящие из сетки вверх, не уезжали вниз вместе с прокруткой документа
  let lastShift = '';
  function shiftBalls() {
    const bl = document.getElementById('bl'); if (!bl) return;
    const d = Court.pinned ? Math.min(0, window.scrollY - Court.D) : 0;
    const t = d ? 'translate3d(0,' + d + 'px,0)' : '';
    if (t !== lastShift) { bl.style.transform = t; lastShift = t; }
  }
  // переход по ссылке-якорю (меню): встаём сразу
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (a) jumpAt = performance.now() + 1500; }, true);
  let relT = 0;
  const later = () => { clearTimeout(relT); relT = setTimeout(measure, 160); };
  window.addEventListener('resize', later);
  if (S.bus) S.bus.addEventListener('motion', decide);
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', decide);

  // [корт-3] 3D-сцена не создалась (нет WebGL на деле) — без закрепления, сразу корт-фон
  Court.noGL = () => { if (!hasGL) return; hasGL = false; decide(); };
  function init() {
    setCourt(DOC.getAttribute('data-court') || 'clay', false, false);
    decide();
    const ro = new ResizeObserver(later); const m = $('main'); if (m) ro.observe(m);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
    window.addEventListener('load', later);
    $$('main img').forEach((im) => { if (!im.complete) im.addEventListener('load', later, { once: true }); });
  }
  init();
})();
