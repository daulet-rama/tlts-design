(() => {
  const D = document, html = D.documentElement;
  const $ = (id) => D.getElementById(id);
  const RM = html.classList.contains('rm');
  const TEXT = { 1: 'В шапку', 2: 'Отсвет мяча', 3: 'Между строк', 4: 'Краска на корте' };
  const MODE = { mark: 'Отметка', auto: 'Само', scroll: 'По прокрутке' };
  const UDAR = { 0: 'Сейчас', A: 'А · за линией', B: 'Б · на линию и за неё', V: 'В · из корта за линию' };
  const udar0 = html.dataset.udar || new URLSearchParams(location.search).get('udar') || '0';
  const V = { text: TEXT[html.dataset.text] ? html.dataset.text : '4', mode: MODE[html.dataset.mode] ? html.dataset.mode : 'mark', udar: UDAR[udar0] ? udar0 : '0' };

  const vp = $('vp'), vpT = $('vp-t'), vpTn = $('vp-tn');
  let onChange = null;
  function paintPanel() {
    for (const b of vp.querySelectorAll('.vp-s button')) b.setAttribute('aria-pressed', String(V[b.parentNode.dataset.k] === b.dataset.v));
    vpTn.textContent = TEXT[V.text];
    const un = $('vp-un'); if (un) un.textContent = UDAR[V.udar];
  }
  function setOpen(o) { vp.dataset.open = o ? '1' : '0'; vpT.setAttribute('aria-expanded', String(!!o)); }
  function set(o) {
    if (o && o.udar != null && UDAR[o.udar] && String(o.udar) !== V.udar) {   // другой удар — другие кадры: страница загружается заново
      const u = new URL(location.href); if (String(o.udar) === '0') u.searchParams.delete('udar'); else u.searchParams.set('udar', o.udar);
      location.assign(u); return true;
    }
    const t = o && o.text != null ? String(o.text) : V.text, m = o && o.mode != null ? String(o.mode) : V.mode;
    if (!TEXT[t] || !MODE[m]) return false;
    const ch = { text: t !== V.text, mode: m !== V.mode };
    V.text = t; V.mode = m; html.dataset.text = t; html.dataset.mode = m;
    try { const u = new URL(location.href); u.searchParams.set('text', t); u.searchParams.set('mode', m); history.replaceState(null, '', u); } catch (e) {}
    paintPanel();
    if (onChange) onChange(ch);
    return true;
  }
  setOpen(innerWidth > 700);
  vpT.addEventListener('click', () => setOpen(vp.dataset.open !== '1'));
  vp.addEventListener('click', (e) => { const b = e.target.closest('.vp-s button'); if (b) set({ [b.parentNode.dataset.k]: b.dataset.v }); });
  paintPanel();
  if (RM) { $('vp-n').hidden = false; window.__top = { rm: true, set, V }; return; }

  const pin = D.querySelector('.pin'), stage = D.querySelector('.stage');
  const ball = $('ball'), still = $('still'), cv = $('seq'), info = $('info'), ql = $('ql');
  const far = $('far'), farCourt = $('far-court'), farTone = $('far-tone'), mid = $('mid'), det = $('det'), fx = $('fx'), veil = $('veil');
  const tint = $('tint'), glow = $('glow'), plines = $('plines'), sheet = D.querySelector('.court .sheet') || D.querySelector('.lane-probe');   // лист-заглушка или мерка поля (страница с блоками «Афиши»)
  const hdr = $('hdr'), logo = hdr.querySelector('.logo'), logoB = logo.querySelector('b');
  const name = D.querySelector('.name'), kicker = name.querySelector('.kicker'), h1 = $('h1');
  const ctx = cv.getContext('2d'), fctx = fx.getContext('2d');
  const DATA = html.dataset.data || (V.udar === '0' ? 'top/data/' : 'top/udar/' + V.udar + '/');   // папка кадров и seq.json этого варианта удара

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const inOut = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const px = (x) => x.toFixed(1) + 'px';

  h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
  let ci = 0;
  for (const ln of [...h1.children]) {
    const txt = ln.textContent; ln.textContent = ''; ln.setAttribute('aria-hidden', 'true');
    const inn = D.createElement('span'); inn.className = 'in';
    for (const c of txt) {
      if (c === ' ') { inn.appendChild(D.createTextNode(' ')); continue; }
      const s = D.createElement('span'); s.className = 'ch'; s.textContent = c; s.style.setProperty('--i', ci++); inn.appendChild(s);
    }
    ln.appendChild(inn);
  }
  h1.classList.add('split');
  const tw = D.createElement('div'); tw.className = 'tw'; h1.parentNode.insertBefore(tw, h1); tw.appendChild(h1);
  const tex = D.createElement('div'); tex.className = 'title split tex'; tex.setAttribute('aria-hidden', 'true'); tex.innerHTML = h1.innerHTML; tw.appendChild(tex);   // «краска» (текст 4)
  const front = name.cloneNode(true); front.classList.add('front'); front.setAttribute('aria-hidden', 'true');                                                      // строка перед мячом (текст 3)
  for (const e of front.querySelectorAll('[id]')) e.removeAttribute('id');
  for (const e of front.querySelectorAll('[aria-label]')) e.removeAttribute('aria-label');
  ball.parentNode.insertBefore(front, ball.nextSibling);
  const fly = D.createElement('div'); fly.className = 'fly'; fly.setAttribute('aria-hidden', 'true');                                                               // название, летящее в шапку (текст 1)
  const flyT = D.createElement('div'); flyT.className = 'title split'; flyT.innerHTML = h1.innerHTML; fly.appendChild(flyT); D.body.appendChild(fly);
  const l1s = [h1.querySelector('.l1'), front.querySelector('.title .l1')], l2s = [h1.querySelector('.l2'), front.querySelector('.title .l2')];

  let Q = null, F = [], DUR = 0, TC1 = 0, TSTOP = 0, TCAM = .4, TMARK = .2, IMARK = 4;
  let FXP = null;   // облегчённая копия слоя тени и пыли (top/data/pack.json, tools/pack-fx.py); нет её — берётся слой из seq.json
  const REAL_W = 10.97;                    // ширина парного корта, м (как REAL.width в court.js настоящей страницы)
  const PAGE_BALL = { d: 22, m: 16 };      // мячи на настоящей странице: средний размер (balls.js, SIZES)

  let G = null, dirty = true, fresh = true, drawnA = -1, drawnB = -1;
  function inkW(ln, pad) { const c = ln.querySelectorAll('.ch'); if (!c.length) return 0; const a = c[0], b = c[c.length - 1]; return b.offsetLeft + b.offsetWidth - a.offsetLeft - 2 * pad; }
  function mkLine(parent, cls) { const i = D.createElement('i'); i.className = 'ln ' + cls; parent.appendChild(i); return i; }
  let farLines = null;
  function measure() {
    const vw = innerWidth, vh = stage.clientHeight, mob = vw <= 700;
    const Sb = ball.offsetWidth, R0 = .396 * Sb;
    const c0x = ball.offsetLeft + Sb / 2, c0y = ball.offsetTop + Sb / 2;
    G = { vw, vh, mob, Sb, R0, c0x, c0y, pinTop: pin.offsetTop, pinScroll: Math.max(1, pin.offsetHeight - vh) };
    const fs0 = parseFloat(getComputedStyle(h1).fontSize), pad = .05 * fs0;
    const nL = name.offsetLeft, nT = name.offsetTop, nH = name.offsetHeight;
    const tL = nL + tw.offsetLeft, tT = nT + tw.offsetTop, tH = h1.offsetHeight;
    const w1 = inkW(l1s[0], pad), w2 = inkW(l2s[0], pad), tW = Math.max(w1, w2);
    Object.assign(G, { fs0, nL, nT, nH, tL, tT, tH, tW, w1, w2 });
    const hr = hdr.getBoundingClientRect();
    G.hdrBottom = hr.bottom;
    const s1 = (mob ? 14 : 16) / fs0;
    html.style.setProperty('--dockw', Math.ceil(tW * s1 + 2) + 'px');
    const lb = logoB.getBoundingClientRect();
    G.dock = { x0: tL, y0: tT, x1: lb.left, y1: hr.top + (hr.height - tH * s1) / 2 - .02 * fs0 * s1, s1 };
    const m = Math.round(.12 * fs0);
    G.tint = { x: tL - m, y: tT - m, w: tW + 2 * m, h: tH + 2 * m, Rg: 1.78 * R0 };
    tint.style.left = px(G.tint.x); tint.style.top = px(G.tint.y); tint.style.width = px(G.tint.w); tint.style.height = px(G.tint.h);
    glow.style.width = glow.style.height = px(2 * G.tint.Rg);
    if (mob) G.t3 = { x: 0, y: Math.round(.5 * fs0), par: 4 };
    else { const yc = tT + .75 * tH, hc = Math.sqrt(Math.max(0, R0 * R0 - (yc - c0y) * (yc - c0y))); G.t3 = { x: Math.round(c0x - hc - .34 * w2 - tL), y: 0, par: 6 }; }
    const res = mob ? 640 : ((devicePixelRatio || 1) >= 1.5 ? 768 : 512);
    if (cv.width !== res) { cv.width = cv.height = res; drawnA = -1; }
    ctx.imageSmoothingQuality = 'high';
    dirty = true; fresh = true;
    if (!Q) return;

    const lane = sheet.offsetLeft, dbl0 = mob ? 4 : lane * .38, dbl1 = vw - dbl0;
    const k1 = (dbl1 - dbl0) / REAL_W, xc = vw / 2, lw = mob ? 2 : 3;
    const f0 = F[0], fr = F[F.length - 1], fc = F[Q.contacts[0]];
    const xT = fc.x, yE = Q.lines.baseline[1], L0 = Q.lines;
    const S0 = 2 * R0 / f0.d;                                   // кадр 0 = мяч первого экрана того же размера
    const yBand = Math.round(tT + tH + (mob ? 40 : 46));         // задняя линия — сразу под названием
    const limit = mob ? vh - 104 : vh - 36;                      // лежащий мяч остаётся в кадре (на телефоне — над нижней панелью)
    const ysC = Q.contacts.map((i) => F[i].y).concat([fr.y]);
    const yHi = Math.max(...ysC) + fr.d * .75, yLo = Math.min(L0.baseline[0] - .03, Math.min(...ysC) - fr.d * .75);
    let SL = Math.min(.82 * S0, (limit - yBand) / (yE - fr.y + fr.d / 2)), ayL = yBand;
    if (yHi > yE + .02) { const topFree = tT + tH + (mob ? 18 : 26); SL = Math.min(.82 * S0, (limit - topFree) / (yHi - yLo)); ayL = Math.round(topFree + (yHi - yE) * SL); }
    const cam = {
      R: { ax: c0x + (xT - f0.x) * S0, ay: c0y + (f0.y - yE) * S0, s: S0 },
      L: { ax: (mob ? .5 : .56) * vw, ay: ayL, s: SL },
      P: { ax: xc + xT * k1, ay: yBand, s: k1 },
    };
    const dpd = mob ? clamp(Math.round(devicePixelRatio || 1), 1, 3) : 1;   // телефон: картинки в точках устройства
    const fxS = FXP || Q.fx, fp = mob ? fxS.ppm_m : fxS.ppm_d;
    const nat = { mid: (mob ? Q.court.ppm_m : Q.court.ppm_d) / dpd, det: (mob ? Q.detail.ppm_m : Q.detail.ppm_d) / dpd, fx: fp / dpd };
    const fr_ = Q.fx.rect, fw = Math.round((fr_[2] - fr_[0]) * fp), fh = Math.round((fr_[3] - fr_[1]) * fp);
    if (fx.width !== fw || fx.height !== fh) { fx.width = fw; fx.height = fh; drawnB = -1; }
    const pmk = Math.min(.3, .26 * vh / G.pinScroll);
    G.pm = { mark: pmk, up0: pmk + .055, up1: .93 };
    const size = (el, r, n) => { el.style.width = px((r[2] - r[0]) * n); el.style.height = px((r[3] - r[1]) * n); };
    size(mid, Q.court.rect, nat.mid); size(det, Q.detail.rect, nat.det); size(fx, Q.fx.rect, nat.fx);
    Object.assign(G, { lane, dbl0, dbl1, k1, xc, lw, xT, yE, S0, SL, cam, nat, yBand, zFar: 6,
      mEnd: Math.max(1, (mob ? PAGE_BALL.m : PAGE_BALL.d) / (fr.d * k1)) });
    const L = Q.lines, hB = (L.baseline[1] - L.baseline[0]) * k1, wS = (L.singles_sideline[1] - L.singles_sideline[0]) * k1;
    const xs = [-(L.doubles_sideline[0] + L.doubles_sideline[1]) / 2, -(L.singles_sideline[0] + L.singles_sideline[1]) / 2,
      (L.singles_sideline[0] + L.singles_sideline[1]) / 2, (L.doubles_sideline[0] + L.doubles_sideline[1]) / 2].map((x) => xc + x * k1);
    if (!farLines) farLines = { base: mkLine(far, 'b'), mark: mkLine(far, 'm'), side: [0, 1, 2, 3].map(() => mkLine(far, 's')) };
    const yb = cam.P.ay, deep = vh * 1.8;
    farCourt.style.cssText = `left:${px(dbl0)};top:${px(yb)};width:${px(dbl1 - dbl0)};height:${px(deep)}`;
    farLines.base.style.cssText = `left:${px(dbl0)};top:${px(yb)};width:${px(dbl1 - dbl0)};height:${px(hB)}`;
    farLines.mark.style.cssText = `left:${px(xc - wS / 2)};top:${px(yb)};width:${px(wS)};height:${px(hB + (mob ? 8 : 14))}`;
    farLines.side.forEach((el, i) => { el.style.cssText = `left:${px(xs[i] - wS / 2)};top:${px(yb)};width:${px(wS)};height:${px(deep)}`; });
    G.lineK = { base: lw / hB, side: lw / wS };                  // толщина линий: настоящая (10 и 5 см) → как на странице (3 или 2 px)
    plines.textContent = '';
    const pc = D.createElement('i'); pc.className = 'pc'; pc.style.cssText = `left:${px(dbl0)};width:${px(dbl1 - dbl0)}`; plines.appendChild(pc);
    xs.forEach((x) => { const l = mkLine(plines, 's'); l.style.cssText = `left:${px(x - lw / 2)};top:0;bottom:0;width:${lw}px`; });
    html.style.setProperty('--dbl', px(xs[0])); html.style.setProperty('--sgl', px(xs[1]));   // где боковые линии — блокам страницы ниже (top/bloki.css)
    const rho = mob ? .72 : .667;
    G.t4 = { rho, x: mob ? Math.round((vw - tW * rho) / 2) : Math.round(dbl0 + .06 * vw), y: Math.round(yb - (mob ? 16 : 26) - tH * rho), sHi: k1 * 3.2, sLo: k1 * 1.02 };
  }
  const CAM = { ax: 0, ay: 0, s: 1, E: 0, u: 0 };
  const LB = { cx: 0, cy: 0, d: 0 };   // где в сцене сейчас мяч и какого он размера — для мяча, прыгающего по блокам (top/bloki.js)
  function camera(c, e) {
    const { R, L, P } = G.cam, u = inOut(clamp(c / TCAM)), E = e * e * (3 - 2 * e);
    CAM.u = u; CAM.E = E;
    CAM.s = Math.exp(lerp(Math.log(R.s), Math.log(L.s), u) + (Math.log(P.s) - Math.log(L.s)) * E);
    CAM.ax = lerp(R.ax, L.ax, u) + (P.ax - L.ax) * E;
    CAM.ay = lerp(R.ay, L.ay, u) + (P.ay - L.ay) * E;
  }
  const sx = (x) => CAM.ax + (x - G.xT) * CAM.s, sy = (y) => CAM.ay - (y - G.yE) * CAM.s;
  const PARK = '0.004', born = new Map();
  function place(el, rect, n, o, park, now) {
    const img = el.tagName === 'IMG';
    if (img && !(el.complete && el.naturalWidth)) { el.style.opacity = '0'; return; }
    if (park || (img && !born.has(el))) { el.style.opacity = PARK; el.style.transform = 'translate3d(0,0,0) scale(1)'; if (img && !born.has(el)) born.set(el, park ? -1e9 : now); return; }
    if (img) { const r = clamp((now - born.get(el)) / 250); if (r < 1) dirty = true; o *= r; }
    el.style.opacity = o.toFixed(3);
    if (o > 0) el.style.transform = `translate3d(${sx(rect[0]).toFixed(2)}px,${sy(rect[3]).toFixed(2)}px,0) scale(${(CAM.s / n).toFixed(5)})`;
  }

  let A = [], B = [], setKey = '', loadedA = 0, loadedB = 0, needA = 0, needB = 0;
  function load() {
    if (!Q || !G) return;
    const f = G.mob ? 'm' : 'd';
    if (f === setKey) return;
    setKey = f; A = new Array(F.length).fill(null); B = new Array(F.length).fill(null); loadedA = loadedB = 0;
    born.clear(); fxBorn = 0; drawnA = drawnB = -1;
    mid.addEventListener('load', () => { try {
      const t = D.createElement('canvas'); t.width = 16; t.height = 12; const g = t.getContext('2d', { willReadFrequently: true });
      g.drawImage(mid, 0, 0, 16, 12); const d = g.getImageData(2, 7, 6, 4).data; let r = 0, gg = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4; farTone.style.backgroundColor = `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`;
    } catch (e) {} }, { once: true });
    det.src = DATA + (G.mob ? Q.detail.file_m : Q.detail.file_d);
    mid.src = DATA + (G.mob ? Q.court.file_m : Q.court.file_d);
    const firstA = Math.max(0, IMARK - 1), firstB = FXP ? FXP.first : 0, dirB = (FXP || Q.fx).dirs[f], cts = Q.contacts;
    const jobs = [];
    for (const s of [8, 4, 2, 1]) for (let i = firstA; i < F.length; i += s) if (!jobs.some((j) => j[0] === 'A' && j[1] === i)) jobs.push(['A', i]);
    for (const s of [8, 4, 2, 1]) for (let i = firstB; i < F.length; i += s) if (!jobs.some((j) => j[0] === 'B' && j[1] === i)) jobs.push(['B', i]);
    jobs.sort((p, q) => (p[1] <= cts[0] + 4 ? 0 : 1) - (q[1] <= cts[0] + 4 ? 0 : 1));
    needA = jobs.filter((j) => j[0] === 'A').length; needB = jobs.length - needA;
    let k = 0;
    const next = () => {
      if (k >= jobs.length || setKey !== f) return;
      const [kind, i] = jobs[k++], im = new Image();
      im.decoding = 'async'; im.fetchPriority = 'low';
      im.src = DATA + (kind === 'A' ? Q.sprite.dirs[f] + '/' + F[i].file : dirB + '/' + F[i].fx);
      im.decode().then(() => {
        if (setKey !== f) return;
        if (kind === 'A') { A[i] = im; loadedA++; drawnA = -1; } else { B[i] = im; loadedB++; drawnB = -1; }
        dirty = true;
      }, () => {}).then(next);
    };
    for (let n = 0; n < 3; n++) next();
  }
  const near = (arr, i, lim = 3) => { for (let s = 0; s <= lim; s++) { if (arr[i - s]) return i - s; if (arr[i + s]) return i + s; } return -1; };   // соседний кадр, если нужного ещё нет
  function frameAt(t) {
    let lo = 0, hi = F.length - 1;
    if (t <= F[0].t) return [0, 0, 0];
    if (t >= F[hi].t) return [hi, hi, 0];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (F[m].t <= t) lo = m; else hi = m; }
    return [lo, hi, (t - F[lo].t) / (F[hi].t - F[lo].t)];
  }
  function pick(t) {
    let [a, b, w] = frameAt(t);
    const fast = Math.abs(F[b].y - F[a].y) + Math.abs(F[b].d - F[a].d) > .012;
    if (fast) { if (w >= .5) a = b; w = 0; b = a; }
    return [a, b, w];
  }
  function drawSet(g, arr, canvas, a, b, w, was) {
    const key = a + w;
    if (key === was) return was;
    const ia = arr[a] ? a : near(arr, a);
    if (ia < 0) return was >= 0 && arr === B ? was : -1;   // слоя тени ещё нет — остаётся прежний кадр; мяча нет — летит картинка
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.globalAlpha = 1; g.drawImage(arr[ia], 0, 0, canvas.width, canvas.height);
    if (ia === a && w > .03 && b !== a && arr[b]) { g.globalAlpha = w; g.drawImage(arr[b], 0, 0, canvas.width, canvas.height); g.globalAlpha = 1; }
    return key;
  }

  const PT = { on: .035, off: .018, fall: .47, up0: { auto: .11, scroll: .47 }, up1: .93, tau: .13 };
  let c = 0, eC = 0, lastNow = 0, hold = null, phase = 'scrub', manual = false, vnow = 0;
  const WS = 13, WE = 11, PACE = .9, RAMP = .5;
  let cV = 0, eV = 0, playT = 0, playV0 = 1;
  function advance(now) {
    const dt = lastNow ? Math.min(.05, Math.max(0, (now - lastNow) / 1000)) : 0;
    lastNow = now;
    const y = scrollY, p = clamp((y - G.pinTop) / G.pinScroll), past = y > G.pinTop + G.pinScroll;
    if (hold) { c = hold.c; eC = hold.e; return p; }
    let et;
    if (V.mode === 'scroll') {
      c = clamp((p - PT.on) / (PT.fall - PT.on)) * DUR;
      et = clamp((p - PT.up0.scroll) / (PT.up1 - PT.up0.scroll));
    } else if (V.mode === 'auto') {
      if (p >= PT.on) c = Math.min(DUR, c + dt);
      else if (p < PT.off) c = Math.max(0, c - dt * 2.6);
      et = clamp((p - PT.up0.auto) / (PT.up1 - PT.up0.auto));
      if (!past) et *= smooth(TSTOP - .55, TSTOP - .1, c);
    } else {
      const m = G.pm, cs = TMARK * clamp(p / m.mark);            // где мяч по прокрутке, пока она его ведёт
      if (phase === 'scrub') {
        cV = clamp(cV + (WS * WS * (cs - c) - 2 * WS * cV) * dt, -TMARK / .35, TMARK / PACE); c = clamp(c + cV * dt, 0, TMARK);
        if (Math.abs(cs - c) < 2e-4 && Math.abs(cV) < 2e-3) { c = cs; cV = 0; }
        if (p >= m.mark) { phase = 'play'; playT = 0; playV0 = clamp(cV, 0, 2.5); }
      }
      else if (y <= G.pinTop + 3 && phase !== 'rewind') phase = 'rewind';   // вернулись в самый верх страницы
      if (phase === 'play') {
        const ahead = clamp((p - m.up0) / (m.up1 - m.up0));
        const rate = lerp(playV0, 1 + 1.5 * smooth(.2, .9, ahead) + (past ? 1.5 : 0), smooth(0, RAMP, playT));
        playT += dt;
        c = Math.min(DUR, c + dt * rate);
        if (c >= DUR) phase = 'done';
      } else if (phase === 'done') c = DUR;
      else if (phase === 'rewind') {
        if (p >= m.mark) phase = c < DUR ? 'play' : 'done';     // снова пошли вниз — сцена идёт вперёд с того места, где была
        else { c = Math.max(cs, c - dt * 2.8); if (c <= cs + 1e-6) { c = cs; cV = 0; phase = 'scrub'; } }
      }
      et = clamp((p - m.up0) / (m.up1 - m.up0));
      if (!past) et *= smooth(TSTOP - .55, TSTOP - .1, c);       // камера ждёт, пока мяч ляжет
    }
    eV += (WE * WE * (et - eC) - 2 * WE * eV) * dt; eC = clamp(eC + eV * dt);
    if (Math.abs(et - eC) < .0006 && Math.abs(eV) < .004) { eC = et; eV = 0; }
    return p;
  }

  let shakeT0 = 0;
  function resetText() {
    for (const e of [name, front, h1, tw, kicker, tex, tint, glow, fly, logoB, ...l1s, ...l2s]) { e.style.transform = ''; e.style.opacity = ''; e.style.visibility = ''; }
    name.style.transformOrigin = ''; tw.style.transformOrigin = ''; name.classList.remove('ink'); shakeT0 = 0;
  }
  function textFrame(prevC, now, Bst, past, lit) {
    const tx = V.text, R = Bst.R;
    if (tx === '1') {          // «В шапку»: название сжимается к точке под шапкой у знака и встаёт в шапку
      const d = G.dock, tt = clamp(c / .95);
      const s = Math.exp(Math.log(d.s1) * inOut(clamp(tt / .8))), w = (s - d.s1) / (1 - d.s1);
      const x = d.x1 + (d.x0 - d.x1) * w;
      const y = lerp(lerp(G.hdrBottom + 10, d.y0, w), d.y1, inOut(clamp((tt - .7) / .3)));
      const nx = clamp(Bst.cx, x, x + G.tW * s), ny = clamp(Bst.cy, y, y + G.tH * s);
      const hit = (Bst.cx - nx) * (Bst.cx - nx) + (Bst.cy - ny) * (Bst.cy - ny) < R * R * 1.1;
      const useFly = past || (tt > 0 && (!hit || y < G.hdrBottom + 4));
      h1.style.transform = `translate3d(${(x - d.x0).toFixed(2)}px,${(y - d.y0).toFixed(2)}px,0) scale(${s.toFixed(5)})`;
      fly.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${s.toFixed(5)})`;
      h1.style.opacity = useFly ? '0' : '';
      fly.style.visibility = useFly ? 'visible' : 'hidden';
      logoB.style.opacity = (1 - smooth(.4, .7, tt)).toFixed(3);
      const ko = 1 - smooth(.02, .2, c);
      kicker.style.opacity = ko.toFixed(3);
      kicker.style.transform = `translate3d(0,${(-(1 - ko) * 10).toFixed(1)}px,0)`;
    } else if (tx === '2') {   // «Отсвет мяча»: цвет мяча на буквах рядом с ним; в момент касания название вздрагивает
      const q = G.tint;
      glow.style.transform = `translate3d(${(Bst.cx - q.x - q.Rg * Bst.k).toFixed(1)}px,${(Bst.cy - q.y - q.Rg * Bst.k).toFixed(1)}px,0) scale(${Bst.k.toFixed(4)})`;
      glow.style.opacity = ((.1 + .9 * smooth(.36, .95, Bst.k)) * (1 - .85 * lit)).toFixed(3);
      if (prevC >= 0 && prevC < TC1 && c >= TC1) shakeT0 = now;
      let sy_ = 0;
      if (shakeT0) { const dt = now - shakeT0; if (dt < 430) { sy_ = (G.mob ? 3 : 5) * Math.exp(-dt / 95) * Math.cos(dt / 17.5); dirty = true; } else shakeT0 = 0; }
      name.style.transform = tint.style.transform = sy_ ? `translate3d(0,${sy_.toFixed(2)}px,0)` : '';
    } else if (tx === '3') {   // «Между строк»: мяч уходит между строк, вторая строка возвращается на место
      const back = 1 - smooth(.1, .62, c), a = smooth(0, .3, c), q = G.t3;
      const t2 = `translate3d(${(q.x * back).toFixed(1)}px,${(q.y * back + q.par * a * back).toFixed(1)}px,0)`;
      const t1 = `translate3d(0,${(-q.par * a).toFixed(1)}px,0)`;
      for (const l of l2s) l.style.transform = t2;
      for (const l of l1s) l.style.transform = t1;
    } else {                   // «Краска на корте»: на корте крупно название — краска; камера уходит вверх — оно перелетает на своё место на корте страницы
      const q = G.t4, w = 1 - smooth(Math.log(q.sLo), Math.log(q.sHi), Math.log(CAM.s));
      const sc = Math.exp(Math.log(q.rho) * w), x = lerp(G.tL, q.x, w), y = lerp(G.tT, q.y, w);
      tw.style.transformOrigin = '0 0';
      tw.style.transform = w > 0 ? `translate3d(${(x - G.tL).toFixed(2)}px,${(y - G.tT).toFixed(2)}px,0) scale(${sc.toFixed(5)})` : '';
      tex.style.opacity = lit.toFixed(3);
      kicker.style.opacity = (1 - smooth(0, .5, w)).toFixed(3);
    }
    name.classList.toggle('ink', lit > .6);
  }

  let lastC = -1, lastE = -1, lastY = -1, ready = false, t0 = 0;
  function tick(now) { requestAnimationFrame(tick); if (!manual) frame(now); }
  let swA = 0, lastFrameNow = 0, fxBorn = 0;
  function frame(now) {
    if (!G) return;
    const y = scrollY;
    if (!Q) {   // данные ещё не пришли: мяч стоит и покачивается
      if (ready) ball.style.transform = `rotate(${(Math.sin(((now - t0) / 1000) * (2 * Math.PI / 9)) * 1.4).toFixed(3)}deg)`;
      return;
    }
    const prevC = fresh ? -1 : c;
    const fdt = lastFrameNow ? Math.min(.05, Math.max(0, (now - lastFrameNow) / 1000)) : 0; lastFrameNow = now;
    advance(now);
    const past = y > G.pinTop + G.pinScroll + 1;
    const idle = ready && c === 0 && eC === 0;
    if (c === lastC && eC === lastE && y === lastY && !idle && !dirty) return;
    lastC = c; lastE = eC; lastY = y; dirty = false; fresh = false;
    camera(c, eC);
    const E = CAM.E, s = CAM.s;

    const o = 1 - smooth(0, .25, c);
    info.style.opacity = ql.style.opacity = o;
    info.style.transform = ql.style.transform = `translate3d(0,${((1 - o) * 26).toFixed(1)}px,0)`;
    info.style.visibility = ql.style.visibility = o < .01 ? 'hidden' : '';

    const lit = smooth(.04, .3, c);
    if (G.mob) stage.style.setProperty('--scrim', (1 - lit).toFixed(3));
    veil.style.opacity = lit.toFixed(3);
    const plates = mid.complete && mid.naturalWidth > 0 && born.has(mid);   // картинки корта из Blender уже на месте
    const park = lit === 0, z = plates ? Math.min(G.zFar, s / G.k1) : s / G.k1;   // крупнее zFar корт страницы не нужен: его целиком закрывают картинки из Blender
    far.style.opacity = park ? PARK : lit.toFixed(3);
    far.style.transform = park ? 'translate3d(0,0,0) scale(1)' : `translate3d(${(CAM.ax - G.cam.P.ax * z).toFixed(2)}px,${(CAM.ay - G.cam.P.ay * z).toFixed(2)}px,0) scale(${z.toFixed(5)})`;
    const tone = smooth(1.0 * G.k1, 1.6 * G.k1, s);
    farTone.style.opacity = (.93 * tone).toFixed(3);
    const lm = smooth(.5, 1, E), lo = lerp(1, .82, tone).toFixed(3);   // линии: настоящая толщина → как на странице
    farLines.base.style.transform = `scale(1,${lerp(1, G.lineK.base, lm).toFixed(4)})`;
    farLines.mark.style.transform = `scale(${lerp(1, G.lineK.side, lm).toFixed(4)},1)`;
    farLines.base.style.opacity = farLines.mark.style.opacity = lo;
    for (const el of farLines.side) { el.style.transform = `scale(${lerp(1, G.lineK.side, lm).toFixed(4)},1)`; el.style.opacity = lo; }
    const oDet = lit * smooth(.24 * G.SL, .5 * G.SL, s);
    place(mid, Q.court.rect, G.nat.mid, lit * smooth(1.6 * G.k1, 2.7 * G.k1, s), park, now);
    place(det, Q.detail.rect, G.nat.det, oDet, park, now);

    let force = -1;
    if (prevC >= 0 && c > prevC) for (let n = 0; n < Math.min(2, Q.contacts.length); n++) { const tc = F[Q.contacts[n]].t; if (prevC < tc && c >= tc && c - tc < .12) force = Q.contacts[n]; }
    const [a, b, w] = force >= 0 ? [force, force, 0] : frameAt(c), fa = F[a], fb = F[b];
    const bx = lerp(fa.x, fb.x, w), by = lerp(fa.y, fb.y, w), bd = lerp(fa.d, fb.d, w);
    const Dpx = bd * s * Math.exp(Math.log(G.mEnd) * E), k = Dpx / (2 * G.R0), cx = sx(bx), cy = sy(by);
    const swayK = ready ? 1 - smooth(0, .09, c) : 0;   // покачивание в покое плавно гаснет в начале падения
    const sway = swayK > 0 ? Math.sin(((now - t0) / 1000) * (2 * Math.PI / 9)) * 1.4 * swayK : 0;
    ball.style.transform = `translate3d(${(cx - G.c0x).toFixed(2)}px,${(cy - G.c0y).toFixed(2)}px,0) rotate(${sway.toFixed(3)}deg) scale(${k.toFixed(5)})`;
    LB.cx = cx; LB.cy = cy; LB.d = Dpx;
    const [pa, pb, pw] = force >= 0 ? [force, force, 0] : pick(c);
    let swT = 0;
    const okA = needA > 0 && loadedA >= needA, okB = needB > 0 && loadedB >= needB;   // набор кадров пришёл целиком — без мелькания между картинкой и кадрами
    if (c > TMARK && okA) { drawnA = drawSet(ctx, A, cv, pa, pb, pw, drawnA); if (drawnA >= 0) swT = smooth(TMARK, TMARK + .05, c); }
    swA = hold || !fdt ? swT : swA + clamp(swT - swA, -fdt / .1, fdt / .1);
    if (swA !== swT) dirty = true;
    cv.style.opacity = swA.toFixed(3);
    still.style.opacity = (1 - swA).toFixed(3);
    if (oDet > 0 && okB) drawnB = drawSet(fctx, B, fx, pa, pb, pw, drawnB);
    if (drawnB >= 0 && !fxBorn) fxBorn = park ? -1e9 : now;
    const fxRamp = fxBorn ? clamp((now - fxBorn) / 250) : 0;
    if (fxRamp > 0 && fxRamp < 1) dirty = true;
    place(fx, Q.fx.rect, G.nat.fx, drawnB >= 0 ? oDet * smooth(.02, .12, c) * fxRamp : 0, park, now);

    textFrame(prevC, now, { cx, cy, k, R: Dpx / 2 }, past, lit);
  }

  function intro() { html.classList.remove('go'); void html.offsetWidth; html.classList.add('go'); }
  onChange = (ch) => {
    resetText();
    if (ch.mode) { phase = 'scrub'; swA = 0; cV = 0; }   // другой режим времени: сцена пересчитывается от прокрутки
    measure(); frame(manual ? vnow : performance.now());
    if (ch.text && scrollY < 8) intro();
  };
  addEventListener('resize', () => { measure(); load(); });
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  measure();
  requestAnimationFrame(tick);
  let began = false;
  const begin = () => { if (began) return; began = true; measure(); frame(performance.now()); html.classList.add('go'); };
  (D.fonts && D.fonts.ready ? D.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(() => { if (began) { measure(); frame(manual ? vnow : performance.now()); } else begin(); }));
  setTimeout(begin, 900);
  let started = false;
  const go = () => { if (started || !Q) return; started = true; load(); };
  Promise.all([fetch(DATA + 'seq.json').then((r) => r.json()), fetch(DATA + 'pack.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)]).then(([q, pk]) => {
    Q = q; F = q.frames; DUR = q.duration; TC1 = q.first_contact; TSTOP = q.stop_time; TCAM = Math.min(.46, TC1 * 1.15);
    FXP = pk && pk.fx ? pk.fx : null;
    const h0 = F[0].h, hm = h0 * 2 / 3; TMARK = TC1 * .58;
    for (let i = 1; i < F.length; i++) if (F[i].h <= hm) { const a = F[i - 1], b = F[i]; TMARK = a.t + (b.t - a.t) * (a.h - hm) / (a.h - b.h); IMARK = i; break; }
    measure(); if (ready) go();
  }).catch((e) => { console.error('seq.json не загрузился', e); });
  const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(() => { ready = true; t0 = performance.now(); dirty = true; setTimeout(go, 150); }));
  (still.decode ? still.decode() : Promise.resolve()).then(afterPaint, afterPaint);
  setTimeout(go, 4000);

  window.__top = { V, TEXT, MODE, PT, set, intro, get c() { return c; }, get e() { return eC; }, get seq() { return Q; }, geo: () => G, cam: () => ({ ...CAM }),
    get phase() { return phase; }, get mark() { return { t: TMARK, i: IMARK }; }, get need() { return { a: needA, b: needB }; },
    manual: (on) => { manual = !!on; vnow = performance.now(); lastNow = lastFrameNow = vnow; }, step: (ms) => { vnow += ms; frame(vnow); },
    get loaded() { return loadedA + loadedB; }, get loadedA() { return loadedA; }, get loadedB() { return loadedB; }, get N() { return F.length; },
    at: (p) => Math.round(G.pinTop + clamp(p) * G.pinScroll), hold: (cc, ee) => { hold = cc == null ? null : { c: cc, e: ee || 0 }; dirty = true; },
    introAt: (ms) => { intro(); for (const a of D.getAnimations()) { a.pause(); a.currentTime = ms; } },
    introEnd: () => { for (const a of D.getAnimations()) { try { a.finish(); } catch (e) {} } },
    rest: () => { const r = stage.getBoundingClientRect(); return { x: r.left + LB.cx, y: r.top + LB.cy, d: LB.d, ok: !!Q && LB.d > 0 && c >= DUR - 1e-6 && eC > .985 }; } };
})();
