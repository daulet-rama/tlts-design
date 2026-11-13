/* ===================================================================
   «Листы на корте» — корт как фон всей страницы.
   1) Тема-покрытие: Грунт / Хард / Трава (переключатель в шапке).
   2) Геометрия кортов: линии корта стоят ровно на границах блоков,
      сетки корта — на трёх границах-сетках.
   3) Плоский корт во всю страницу (SVG + фактура темы).
   4) Прогресс перехода первого экрана (0…1) по прокрутке — для 3D.
   Всё украшение: aria-hidden, текст и смысл — в HTML.
   =================================================================== */
(function () {
  'use strict';
  const DOC = document.documentElement;
  const S = window.S2 || (window.S2 = {});
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const COURTS = [['clay', 'Грунт'], ['hard', 'Хард'], ['grass', 'Трава']];
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = {};
  const on = (n, f) => { (listeners[n] = listeners[n] || []).push(f); };
  const emit = (n, d) => { (listeners[n] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } }); };

  function hasWebGL() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }
  const GL = hasWebGL() && !/[?&]nogl/.test(location.search);
  const isStatic = () => mqReduce.matches || DOC.dataset.motion === 'off' || !GL;

  /* ---------- цвета темы (читаются из themes.css) ---------- */
  const probe = document.createElement('div'); probe.setAttribute('aria-hidden', 'true'); probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(probe);
  function vars(court) {
    probe.setAttribute('data-court', court);
    const cs = getComputedStyle(probe), g = (n) => cs.getPropertyValue(n).trim();
    const o = {};
    ['--c3-sky', '--c3-fog', '--c3-court', '--c3-surround', '--c3-lines', '--c3-screen', '--c3-post', '--c3-net', '--c3-tape', '--c3-grain', '--c3-grain-hi',
      '--c3-hemi-sky', '--c3-hemi-ground', '--c3-sun', '--c3-fill', '--c3-shade', '--paper', '--ink', '--wind', '--on-wind', '--soft', '--line2', '--model', '--amber', '--muted'].forEach((n) => { o[n.slice(2)] = g(n); });
    ['--c3-fog-near', '--c3-fog-far', '--c3-hemi-i', '--c3-sun-i', '--c3-sun-n', '--c3-fill-i', '--c3-exposure'].forEach((n) => { o[n.slice(2)] = parseFloat(g(n)); });
    return o;
  }
  const theme = () => DOC.getAttribute('data-court') || 'clay';

  /* ---------- значок покрытия и переключатель ---------- */
  function ico(c) {
    return '<svg viewBox="0 0 30 20" aria-hidden="true" focusable="false" data-court="' + c + '"><rect x=".5" y=".5" width="29" height="19" rx="2" fill="var(--ico-out)"/>' +
      '<rect x="4" y="3" width="22" height="14" fill="var(--ico-court)" stroke="var(--ico-line)" stroke-width="1.2"/>' +
      '<path d="M4 6h22M4 14h22M10 6v8M20 6v8M10 10h10" stroke="var(--ico-line)" stroke-width="1" fill="none"/>' +
      '<path d="M15 2.4v15.2" stroke="var(--ico-line)" stroke-width="1.8"/></svg>';
  }
  function paintSwitch() {
    const cur = theme();
    document.querySelectorAll('[data-cs]').forEach((g) => {
      if (!g.firstChild) g.innerHTML = COURTS.map(([c, n]) => '<button type="button" role="radio" data-set="' + c + '">' + ico(c) + '<span>' + n + '</span></button>').join('');
      g.querySelectorAll('button').forEach((b) => { const on = b.dataset.set === cur; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    });
    document.querySelectorAll('[data-cs-tog]').forEach((t) => {
      const nm = COURTS.find((x) => x[0] === cur)[1];
      t.innerHTML = ico(cur); t.setAttribute('aria-label', 'Покрытие сайта: ' + nm + '. Сменить');
    });
  }
  let animT = 0;
  function setTheme(c, save) {
    if (!COURTS.some((x) => x[0] === c)) return;
    const prev = theme();
    if (prev !== c && !isStatic()) { DOC.classList.add('court-anim'); clearTimeout(animT); animT = setTimeout(() => DOC.classList.remove('court-anim'), 750); }
    DOC.setAttribute('data-court', c);
    const m = $('#meta-tc'); if (m) m.setAttribute('content', vars(c)['paper']);
    if (save) { try { localStorage.setItem('tlts-court', c); } catch (e) { /* без хранилища */ } }
    paintSwitch();
    if (prev !== c) { emit('theme', c); if (S.bus) S.bus.dispatchEvent(new CustomEvent('court', { detail: c })); }
  }
  const closeTogs = (except) => document.querySelectorAll('.csw.open').forEach((w) => { if (w !== except) { w.classList.remove('open'); const t = w.querySelector('[data-cs-tog]'); if (t) t.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { const w = document.querySelector('.csw.open'); closeTogs(null); if (w) w.querySelector('[data-cs-tog]').focus(); return; }
    const b = e.target.closest && e.target.closest('[data-cs] button');
    if (b && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) { // радиогруппа: стрелки
      const all = Array.from(b.parentNode.querySelectorAll('button')), i = all.indexOf(b), d = /Right|Down/.test(e.key) ? 1 : -1;
      const n = all[(i + d + all.length) % all.length]; setTheme(n.dataset.set, true); n.focus(); e.preventDefault();
    }
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-cs-tog]');
    if (t) { const w = t.parentNode, op = !w.classList.contains('open'); closeTogs(w); w.classList.toggle('open', op); t.setAttribute('aria-expanded', String(op)); if (op) { const s = w.querySelector('[aria-checked=true]'); if (s) s.focus(); } return; }
    if (!e.target.closest('.csw')) closeTogs(null);
    const b = e.target.closest('[data-cs] button'); if (b) { setTheme(b.dataset.set, true); closeTogs(null); }
  });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (m) => {
    let saved = null; try { saved = localStorage.getItem('tlts-court'); } catch (e) { /* ok */ }
    if (!saved) setTheme(m.matches ? 'hard' : 'clay', false);
  });

  /* ---------- фактуры покрытий (одни и те же плитки — для плоского корта и для 3D) ---------- */
  function rgb(hex) { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  let tiles = {};
  function makeTiles(k) {
    const out = {};
    // грунт: крошка двух тонов, мелкая и редкая
    {
      const v = vars('clay'), c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const a = rgb(v['c3-grain']), b = rgb(v['c3-grain-hi']);
      for (let i = 0; i < 1500; i++) {
        const col = r() < 0.5 ? a : b, al = 0.35 + r() * 0.4, s = r() < 0.85 ? 1 : 2;
        g.fillStyle = 'rgba(' + col.join(',') + ',' + al.toFixed(2) + ')'; g.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), s, s);
      }
      out.clay = { c, w: 128, h: 128 };
    }
    // хард: матовый акрил — почти без фактуры
    {
      const v = vars('hard'), c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
      let seed = 5; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const a = rgb(v['c3-grain']), b = rgb(v['c3-grain-hi']);
      for (let i = 0; i < 700; i++) { const col = r() < 0.5 ? a : b; g.fillStyle = 'rgba(' + col.join(',') + ',' + (0.25 + r() * 0.3).toFixed(2) + ')'; g.fillRect(Math.floor(r() * 96), Math.floor(r() * 96), 1, 1); }
      out.hard = { c, w: 96, h: 96 };
    }
    // трава: полосы стрижки ~1,5 м поперёк корта
    {
      const v = vars('grass'), H = Math.max(24, Math.round(1.5 * k)), c = document.createElement('canvas'); c.width = 8; c.height = H * 2; const g = c.getContext('2d');
      const a = rgb(v['c3-grain']), b = rgb(v['c3-grain-hi']);
      g.fillStyle = 'rgba(' + b.join(',') + ',.55)'; g.fillRect(0, 0, 8, H);
      g.fillStyle = 'rgba(' + a.join(',') + ',.45)'; g.fillRect(0, H, 8, H);
      out.grass = { c, w: 8, h: H * 2 };
    }
    return out;
  }
  const tileURL = new Map();
  function urlOf(t) { if (!tileURL.has(t.c)) tileURL.set(t.c, t.c.toDataURL('image/png')); return tileURL.get(t.c); }

  /* ---------- геометрия: где на странице корты ---------- */
  let G = null;
  const REAL = { half: 11.885, svc: 6.4, width: 10.97 };
  function measure() {
    const vw = DOC.clientWidth, vh = window.innerHeight, mob = vw < 768, sy = window.scrollY;
    const hdrEl = $('#hdr'), hdr = hdrEl ? hdrEl.offsetHeight : 64;
    const first = $('#last-draw'); if (!first) return null;
    const st = isStatic();
    const T = Math.round(vh * (mob ? 0.9 : 1.0));
    const band = mob ? 14 : 18;
    const netScreenY = Math.round(hdr + (vh - hdr - (mob ? 60 : 0)) * (mob ? 0.42 : 0.48));
    // разбег: первая граница-сетка в конце перехода стоит почти посередине экрана
    const curRun = parseFloat(getComputedStyle(DOC).getPropertyValue('--runway')) || 0;
    const natural = first.getBoundingClientRect().top + sy - curRun;
    const run = st ? 0 : Math.max(0, Math.round(T + netScreenY - natural));
    if (Math.abs(run - curRun) > 0.5) DOC.style.setProperty('--runway', run + 'px');
    const sheet = first.querySelector('.ch-in').getBoundingClientRect();
    const L = sheet.left, xc = vw / 2;
    const dbl = mob ? [4, vw - 4] : [sheet.left - L * 0.62, sheet.right + L * 0.62];
    const sgl = mob ? dbl.slice() : [sheet.left - L * 0.24, sheet.right + L * 0.24];
    const post = mob ? [1.5, vw - 1.5] : [sheet.left - L * 0.88, sheet.right + L * 0.88];
    const k = (dbl[1] - dbl[0]) / REAL.width;
    const lw = mob ? 2 : 3;
    const edges = Array.from(document.querySelectorAll('[data-ball-edge]')).map((el) => ({ el, id: el.id || 'foot', kind: el.dataset.ballEdge === 'net' ? 'net' : 'line', y: el.getBoundingClientRect().top + sy }));
    // корты: сетка — середина корта; следом за ней — линия подачи и задняя; до следующей сетки — задняя и подача следующего корта
    const courts = [], role = new Map();
    const nets = edges.map((e, i) => (e.kind === 'net' ? i : -1)).filter((i) => i >= 0);
    const docH = DOC.scrollHeight;
    nets.forEach((ni, c) => {
      const net = edges[ni], nl = net.y + band;
      const nxt = c + 1 < nets.length ? nets[c + 1] : edges.length;
      const after = edges.slice(ni + 1, nxt);
      const C = { net: nl, edgeY: net.y, id: net.id, lines: [] };
      role.set(net.id, 'net');
      C.nearSvc = after[0] ? after[0].y : nl + REAL.svc * k; if (after[0]) role.set(after[0].id, 'svc');
      C.nearBase = after[1] ? after[1].y : nl + REAL.half * k; if (after[1]) role.set(after[1].id, 'base');
      C.nearSvcB = !!after[0]; C.nearBaseB = !!after[1];
      const prev = courts[c - 1];
      if (prev && prev.nextFar) { C.farBase = prev.nextFar.base; C.farBaseB = prev.nextFar.baseB; }
      else { C.farBase = nl - REAL.half * k; C.farBaseB = false; }
      if (prev) C.farBase = Math.max(C.farBase, prev.nearBase + 0.25 * (net.y - prev.nearBase));
      C.farSvc = Math.max(nl - REAL.svc * k, C.farBase + 0.45 * (net.y - C.farBase)); C.farSvcB = false;
      // линии после задней — начало следующего корта (или последнего, без сетки)
      const rest = after.slice(2);
      if (rest.length) {
        if (c + 1 < nets.length) { C.nextFar = { base: rest[rest.length - 1].y, baseB: true }; rest.forEach((e) => role.set(e.id, 'base')); }
        else { // хвост страницы: корт, который продолжается ниже подвала
          const T2 = { tail: true, farBase: rest[0].y, farBaseB: true, farSvc: rest[1] ? rest[1].y : rest[0].y + 0.45 * REAL.half * k, farSvcB: !!rest[1], net: docH + 400, nearSvc: docH + 900, nearBase: docH + 1400, lines: [] };
          role.set(rest[0].id, 'base'); if (rest[1]) role.set(rest[1].id, 'svc');
          rest.slice(2).forEach((e) => role.set(e.id, 'svc'));
          C.tailCourt = T2;
        }
      }
      courts.push(C);
      if (C.tailCourt) courts.push(C.tailCourt);
    });
    return { vw, vh, mob, hdr, T, band, netScreenY, run, k, xc, dbl, sgl, post, lw, edges, courts, role, docH, sheet: { l: sheet.left, r: sheet.right }, static: st };
  }

  /* ---------- плоский корт ---------- */
  let bg = null, svgFill = null, svgLines = null, texEls = {};
  function mountBg() {
    bg = document.createElement('div'); bg.id = 'court-bg'; bg.setAttribute('aria-hidden', 'true');
    const NS = 'http://www.w3.org/2000/svg';
    svgFill = document.createElementNS(NS, 'svg'); svgFill.setAttribute('class', 'cb-fill');
    bg.appendChild(svgFill);
    ['clay', 'hard', 'grass'].forEach((c) => { const d = document.createElement('div'); d.className = 'cb-tex cb-tex--' + c; bg.appendChild(d); texEls[c] = d; });
    svgLines = document.createElementNS(NS, 'svg'); svgLines.setAttribute('class', 'cb-lines');
    bg.appendChild(svgLines);
    document.body.insertBefore(bg, document.body.firstChild);
  }
  const f1 = (v) => Math.round(v * 10) / 10;
  function drawBg() {
    if (!G) return;
    const { vw, docH, courts, dbl, sgl, xc, lw, mob } = G;
    const H = Math.ceil(docH);
    [svgFill, svgLines].forEach((s) => { s.setAttribute('width', vw); s.setAttribute('height', H); s.setAttribute('viewBox', '0 0 ' + vw + ' ' + H); });
    let fill = '', ln = '';
    const R = (x, y, w, h) => '<rect class="cb-ln" x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '"/>';
    const half = lw / 2, mark = mob ? 8 : 14;
    courts.forEach((C) => {
      const top = Math.max(-10, C.farBase), bot = Math.min(H + 10, C.nearBase);
      if (bot <= top) return;
      fill += '<rect class="cb-court" x="' + f1(dbl[0]) + '" y="' + f1(top) + '" width="' + f1(dbl[1] - dbl[0]) + '" height="' + f1(bot - top) + '"/>';
      // боковые: парные и одиночные (на компьютере — обе видны в поле у листа)
      [dbl[0], dbl[1]].forEach((x) => { ln += R(x - half, top - half, lw, bot - top + lw); });
      if (!mob) [sgl[0], sgl[1]].forEach((x) => { ln += R(x - half * 0.85, top - half, lw * 0.85, bot - top + lw); });
      // средняя линия подачи — от подачи до подачи, под сеткой
      const s0 = Math.max(-10, C.farSvc), s1 = Math.min(H + 10, C.nearSvc);
      if (s1 > s0) ln += R(xc - half, s0, lw, s1 - s0);
      // метки центра на задних
      if (C.farBase > -10) ln += R(xc - half, C.farBase, lw, mark);
      if (C.nearBase < H + 10 && !C.tail) ln += R(xc - half, C.nearBase - mark, lw, mark);
      // поперечные линии, которых нет среди границ блоков (их рисует движок мячей)
      if (!C.farBaseB && C.farBase > -10) ln += R(dbl[0], C.farBase - half, dbl[1] - dbl[0], lw);
      if (!C.farSvcB && C.farSvc > -10 && C.farSvc < H) ln += R(sgl[0], C.farSvc - half, sgl[1] - sgl[0], lw);
      if (!C.tail) {
        if (!C.nearSvcB && C.nearSvc < H) ln += R(sgl[0], C.nearSvc - half, sgl[1] - sgl[0], lw);
        if (!C.nearBaseB && C.nearBase < H) ln += R(dbl[0], C.nearBase - half, dbl[1] - dbl[0], lw);
      }
    });
    svgFill.innerHTML = fill; svgLines.innerHTML = ln;
    ['clay', 'hard', 'grass'].forEach((c) => { const t = tiles[c]; if (!t) return; const el = texEls[c]; el.style.backgroundImage = 'url(' + urlOf(t) + ')'; el.style.backgroundSize = t.w + 'px ' + t.h + 'px'; });
  }

  /* ---------- прогресс перехода ---------- */
  /* [корт-4] Камера идёт за прокруткой с отставанием.
     rawP — настоящий прогресс (прокрутка / T). P (COURT.p) — сглаженный: взвешенное среднее rawP за последние
     W единиц «времени камеры» τ, веса — окно Ханна (приподнятый косинус) по давности.
     Хранятся не кадры, а скачки rawP: P = база + Σ Δr·K(давность), где K — накопленная доля окна Ханна
     (S-кривая от 0 до 1 за W, с нулевым наклоном на концах). Отсюда:
       - средняя задержка = W/2; ровно через W после последнего движения камера стоит на цели, хвоста нет;
       - P — смесь прошлых значений rawP с неотрицательными весами: за цель не выходит;
       - скорость камеры = Σ Δr·k(давность) — сумма гладких «горбов»: мягкий разгон и остановка, без изломов;
       - считается по меткам кадров (мс), а не по числу кадров: от частоты кадров не зависит.
     Время камеры идёт со скоростью s ≥ 1 (dτ = s·dt); s > 1 сжимает задержку:
       - быстрая прокрутка (быстрее V0): компьютер — задержка в пикселях дальше не растёт (s = скорость / V0);
         телефон — s = (скорость / V0)², не больше 4;
       - конец перехода (END): s плавно растёт, камера мягко догоняет, пока полоса сетки в верхней части экрана;
       - но s сразу ограничен сверху (LIM): камера не обгоняет саму прокрутку больше чем в LIM раз.
     Середина перехода при скорости до V0 — ровно W/2.
     Мгновенно камера встаёт только при программных прыжках: переход к якорю, S.scrollToEl, «Назад/Вперёд»,
     восстановление прокрутки при загрузке, новая раскладка, включение 3D. Человеческая прокрутка — только плавно.
     Сдвиг корта вдоль страницы в 3D берётся из настоящей прокрутки, сглаживаются только подъём и наклон камеры,
     поэтому в конце перехода 3D-корт совпадает с плоским при любой задержке. */
  const CAM = { crisp: { d: 0.04, m: 0.03 }, was: { d: 0.14, m: 0.09 }, mid: { d: 0.25, m: 0.20 }, soft: { d: 0.39, m: 0.34 } }; // средняя задержка, с: компьютер / телефон
  const CAMDEF = 'soft';
  const V0 = { d: 1000, m: 950 }; // px/с: при прокрутке быстрее задержка в пикселях дальше не растёт
  // сжатие в конце: прокрутка от a·T до b·T — s плавно растёт до s. На телефоне полоса сетки уходит под шапку
  // быстрее (экран ниже, касание быстрее), поэтому сжатие раньше и сильнее
  const END = { d: { a: 0.95, b: 1.25, s: 3 }, m: { a: 0.85, b: 1.15, s: 4 } };
  // предел догоняния: камера не быстрее LIM × скорости прокрутки (+60 px/с). Компьютер — средняя скорость за 0,5 с
  // (шаги колеса); телефон — большая из скоростей за 0,5 и за 0,2 с (касание быстро разгоняется)
  const LIM = { d: 1.2, m: 1.6 }, LIMADD = 60;
  const camDelay = () => { const c = CAM[(S.camMode && S.camMode()) || CAMDEF] || CAM[CAMDEF]; return G && G.mob ? c.m : c.d; };
  let P = 1, ready3d = false, raf = 0, lastT = 0, jumpTill = 0, lastEmit = -1, stripEl = null, rootSo = '', rootGo = '';
  let W = 0.78, tau = 0, s = 1, sS = 1, sF = 1, vS = 0, v5 = 0, base = 1, rLast = 1;
  const J = []; // скачки rawP: τ, Δr, τ, Δr, …
  const hist = []; // прокрутка: время (мс), scrollY, … — для скорости
  const TAU2 = 2 * Math.PI;
  const K = (a) => (a <= 0 ? 0 : a >= W ? 1 : a / W - Math.sin(TAU2 * a / W) / TAU2); // доля окна Ханна старше a
  const kd = (a) => (a <= 0 || a >= W ? 0 : (1 - Math.cos(TAU2 * a / W)) / W); // плотность окна
  function rawP() { if (!G || G.static || !ready3d) return 1; return clamp(window.scrollY / G.T, 0, 1); }
  function progress() { return freshP(); }
  function snapP() { base = rLast = P = rawP(); J.length = 0; tau = 0; s = sS = sF = 1; vS = v5 = 0; W = 2 * camDelay(); }
  function clock(now) { if (lastT && now > lastT) tau += s * Math.min((now - lastT) / 1000, 0.1); if (now > lastT) lastT = now; }
  function note(now) { // записать новое положение прокрутки (кадр или событие scroll)
    const sy = window.scrollY, n = hist.length;
    if (!n || hist[n - 1] !== sy) { hist.push(now, sy); }
    while (hist.length > 4 && now - hist[2] > 600) hist.splice(0, 2); // одна запись старше 0,6 с остаётся
    const r = rawP();
    if (r !== rLast) {
      J.push(tau, r - rLast); rLast = r;
      if (J.length > 400) { J[3] += J[1]; J.splice(0, 2); } // больше 200 скачков за окно: два самых старых — в один
    }
  }
  function syAt(t) { let y = hist.length ? hist[1] : window.scrollY; for (let i = 0; i < hist.length; i += 2) { if (hist[i] <= t) y = hist[i + 1]; else break; } return y; }
  function pAhead(h) { // каким будет P через h секунд без новых скачков. Компьютер: s = 1 — нижняя граница
    freshP();                // (s ≥ 1 всегда); телефон: s идёт к sF за 0,08 с — прогноз смелее, мячам нужно стартовать раньше
    const sm = G && G.mob ? sF + (s - sF) * (0.08 / h) * (1 - Math.exp(-h / 0.08)) : 1;
    let p = base; const t = tau + sm * h; for (let i = 0; i < J.length; i += 2) p += J[i + 1] * K(t - J[i]); return clamp(p, 0, 1);
  }
  function step(now) { // камера к кадру now — один раз за кадр (кто бы ни спросил COURT.p первым)
    if (lastT && now <= lastT) return;
    const w2 = 2 * camDelay(); if (w2 !== W) snapP(); // сменили режим — без догоняния
    const dts = lastT ? clamp((now - lastT) / 1000, 0.001, 0.1) : 1 / 60;
    clock(now); note(now);
    while (J.length && tau - J[0] >= W) { base += J[1]; J.splice(0, 2); } // скачок старше окна — уже весь в базе
    let p = base, vt = 0;
    for (let i = 0; i < J.length; i += 2) { const a = tau - J[i]; p += J[i + 1] * K(a); vt += J[i + 1] * kd(a); }
    P = J.length ? clamp(p, 0, 1) : rLast;
    // скорость времени камеры на следующий кадр
    const sy = window.scrollY, f = 1 - Math.exp(-dts / 0.05);
    vS += (Math.abs(sy - syAt(now - 200)) / 0.2 - vS) * f;
    v5 += (Math.abs(sy - syAt(now - 500)) / 0.5 - v5) * f;
    const sv = G.mob ? clamp((vS / V0.m) * (vS / V0.m), 1, 4) : Math.max(1, vS / V0.d); // телефон: быстрее V0 задержка падает резче (не меньше четверти)
    const E = G.mob ? END.m : END.d, se = 1 + (E.s - 1) * smooth(E.a, E.b, sy / G.T);
    const sT = Math.max(sv, se);
    sS += (sT - sS) * (1 - Math.exp(-dts / (sT > sS ? 0.08 : 0.3)));
    const vc = Math.abs(vt) * G.T; // скорость камеры при s = 1, px/с
    const cap = vc > 1 ? (G.mob ? LIM.m * (Math.max(v5, vS) + LIMADD) : LIM.d * (v5 + LIMADD)) / vc : Infinity;
    s = Math.max(1, Math.min(sS, cap));
    sF = Math.max(1, Math.min(sT, cap)); // куда s идёт — для прогноза pAhead
  }
  // COURT.p внутри кадра: если цикл камеры ещё не прошёл этот кадр (порядок rAF между модулями плавает),
  // шаг делается сейчас, по метке того же кадра — 3D и мячи не видят прошлого кадра
  function freshP() {
    if (raf && performance.now() < jumpTill) { snapP(); return P; }
    if (raf && G && !G.static && ready3d && lastT && document.timeline) { const ft = document.timeline.currentTime; if (ft > lastT && performance.now() >= jumpTill) step(ft); }
    return P;
  }
  function applyP(now) {
    raf = 0;
    now = now || performance.now(); // метка кадра rAF: шаги камеры ровные, как у самого кадра
    const st = !G || G.static || !ready3d;
    if (st || now < jumpTill) { snapP(); lastT = 0; } else step(now);
    // [корт-2] прозрачность — прямо на холст и полосу: смена переменной на <html> пересчитывала стили
    // всей страницы в каждом кадре догоняния (телефон ×4 терял кадры). На <html> — только крайние значения.
    const so = st ? '1' : smooth(0.86, 0.985, P).toFixed(3), go = st ? '0' : (1 - smooth(0.95, 1, P)).toFixed(3);
    const c3 = document.getElementById('court3d'); if (c3 && c3.style.opacity !== go) c3.style.opacity = go;
    if (!stripEl || !stripEl.isConnected) stripEl = document.querySelector('#bl .bl-edge[data-edge="last-draw"]');
    if (stripEl && stripEl.style.opacity !== so) stripEl.style.opacity = so;
    const so2 = +so >= 0.5 ? '1' : '0', go2 = +go > 0 ? '1' : '0';
    if (so2 !== rootSo) { rootSo = so2; DOC.style.setProperty('--strip-op', so2); }
    if (go2 !== rootGo) { rootGo = go2; DOC.style.setProperty('--g3-op', go2); }
    if (DOC.classList.contains('court-flat') !== (st || P >= 1)) DOC.classList.toggle('court-flat', st || P >= 1);
    if (P !== lastEmit) { lastEmit = P; emit('progress', P); }
    if (J.length) raf = requestAnimationFrame(applyP); // камера встала (скачков в окне нет, P = rawP) — цикл стоит
    else { lastT = 0; s = sS = sF = 1; vS = v5 = 0; }
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(applyP); };
  // прыжок по ссылке меню, к найденному игроку, «Назад», восстановление прокрутки: камера встаёт сразу
  const jump = () => { jumpTill = performance.now() + 1600; snapP(); lastT = 0; schedule(); };
  let userIn = false, loadT = document.readyState === 'complete' ? performance.now() : Infinity;
  window.addEventListener('load', () => { loadT = performance.now(); });
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((n) => window.addEventListener(n, () => { userIn = true; }, { passive: true, capture: true }));
  window.addEventListener('scroll', () => {
    const now = performance.now();
    if (!userIn && now < loadT + 1500) { jump(); return; } // прокрутку поставил браузер (восстановление после перезагрузки)
    schedule(); // само положение записывается в кадре: событие scroll приходит в том же кадре, перед rAF
  }, { passive: true });
  window.addEventListener('pageshow', (e) => { if (e.persisted) jump(); });
  window.addEventListener('popstate', jump);
  window.addEventListener('hashchange', jump);
  // [корт-2.1] только если такой якорь есть на странице: ссылки вроде #t-72 никуда не ведут и не должны выключать сглаживание
  const anchorJump = (e) => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return false; const h = a.getAttribute('href'); if (h.length < 2) return false; try { return !!document.getElementById(decodeURIComponent(h.slice(1))); } catch (x) { return false; } };
  S.anchorJump = anchorJump;
  document.addEventListener('click', (e) => { if (anchorJump(e)) jump(); }, true);
  if (S.scrollToEl) { const go0 = S.scrollToEl; S.scrollToEl = function (el) { jump(); return go0.apply(this, arguments); }; }

  /* ---------- пересборка ---------- */
  let lastSig = '';
  function relayout() {
    let g = measure(); if (!g) return;
    if (g.run !== G?.run) g = measure() || g; // разбег поменял высоту — перемерить
    const sig = g.vw + '|' + Math.round(g.k * 10) + '|' + g.docH + '|' + g.edges.map((e) => Math.round(e.y)).join(',') + '|' + g.static;
    G = g;
    DOC.classList.toggle('court-static', g.static);
    if (sig === lastSig) { schedule(); return; }
    lastSig = sig;
    tiles = makeTiles(g.k); tileURL.clear();
    drawBg();
    snapP(); lastT = 0; // [корт-2] новая раскладка — камера сразу на месте
    emit('layout', G);
    schedule();
  }
  let relT = 0;
  const later = () => { clearTimeout(relT); relT = setTimeout(relayout, 120); };

  /* ---------- мост для движка мячей и 3D ---------- */
  S.edgeX = (sec) => {
    if (!G) return null;
    const r = G.role.get(sec.id || 'foot');
    if (r === 'net') return [G.post[0], G.post[1]];
    if (r === 'svc') return [G.sgl[0], G.sgl[1]];
    return [G.dbl[0], G.dbl[1]];
  };
  S.heroEnd = () => (!G || G.static || !ready3d ? 16 : Math.round(G.T * 0.985));
  // [корт-2] «сглаженная прокрутка» перехода: мячи влетают в сетку, когда камера (а не колесо) дошла до конца
  // [корт-2.1] мячи стартуют раньше: прокрутка ≥ 95 % и камера ≥ 90 % (S.heroGo — порог, S.heroSY — камера с запасом 5 %),
  // чтобы вся очередь влетела в сетку, пока полоса в верхней половине экрана
  // [корт-4] S.heroSY(h): камера через h секунд (если прокрутка встанет сейчас) с запасом 5 %, в пикселях прокрутки.
  // Мячи летят h секунд — к удару камера будет не ниже этого (прокрутка дальше вниз только ускоряет её).
  S.heroSY = (h) => (!G || G.static || !ready3d || P >= 1 ? Infinity : Math.min(1, h > 0 ? pAhead(h) + 0.05 + (G.mob ? 0.12 * smooth(300, 1200, vS) : 0) : P + 0.05) * G.T); // телефон, прокрутка идёт: запас больше — к концу время камеры ускоряется
  S.heroGo = () => (!G || G.static || !ready3d ? 16 : Math.round(G.T * 0.9)); // [корт-4] 0,95 → 0,9: при быстрой прокрутке мячам нужно стартовать раньше; при медленной держит камера (S.heroSY)

  window.COURT = {
    on, theme, setTheme, vars, isStatic, get G() { return G; }, get p() { return progress(); }, get pRaw() { return rawP(); }, pAhead: (h) => pAhead(h || 0), camModes: () => CAM, camDef: CAMDEF, camDbg: () => [s, sS, vS, v5, J.length / 2], // camDbg — только для замеров
    tile: (c) => tiles[c], smooth, clamp,
    set3d(v) { ready3d = !!v; DOC.classList.toggle('court-3d-ready', ready3d); snapP(); if (raf) { cancelAnimationFrame(raf); raf = 0; } lastT = 0; applyP(); if (window.__balls) window.__balls.rebuild(); },
    relayout
  };

  /* ---------- запуск ---------- */
  mountBg();
  paintSwitch();
  relayout();
  const ro = new ResizeObserver(later);
  ro.observe(document.querySelector('main') || document.body);
  window.addEventListener('resize', later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  window.addEventListener('load', later);
  const onMotion = () => { later(); schedule(); };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onMotion);
  if (S.bus) S.bus.addEventListener('motion', onMotion);
  applyP();
})();
