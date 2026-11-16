/* Мяч первого экрана перелетает по местам [data-ball-spot]. Копия hero/3-myach-fable/top/bloki.js без примечаний; пояснения — там.
   Этот файл и папку hero/data/jump/ можно не подключать: первый экран работает, мячи в местах лежат картинками каркаса. */
(() => {
  'use strict';
  const D = document, html = D.documentElement;
  const els = [...D.querySelectorAll('[data-ball-spot]')];
  if (!els.length) return;
  const RM = html.classList.contains('rm');
  const J0 = 'top/data/jump/';
  let J = ((D.querySelector('.pin[data-jump]') || {}).dataset || {}).jump || (window.__top && window.__top.data ? window.__top.data + 'jump/' : J0);
  const REL = (() => { const r = ((D.querySelector('.pin[data-r]') || {}).dataset || {}).r || html.dataset.r; return r ? '?r=' + encodeURIComponent(r) : ''; })();
  const rel = (u) => (REL && u.indexOf('?') < 0 ? u + REL : u);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease5 = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (6 * t - 15) + 10); };
  const P = {
    line: .80,
    back: .06,
    anchor: .5,
    wRoll: 13,
    wEnd: 5.2,
    clear: 8,
    farHop: 1.15,
    tMin: .80, tMax: 1.24, settle: .16,
    grow: .62,
    far: 2.7,
    apexM: .36,
    squash: .075,
    dust: .9,
    again: .8,
    edge: .3,
    edgeTo: .9,
    holdU: .55,
    holdMax: 2.5,
    moving: .25,
    trail: .12,
    trailLife: 2.6,
  };
  const HOPS = {
    big: { h: 1, grow: 1, t: 1, turns: 1 },
    arc: { h: .78, grow: .62, t: .94, turns: 1.5 },
    low: { h: .55, grow: .46, t: .8, turns: 1 },
    low2: { h: .42, grow: .34, t: .72, turns: .5 },
  };
  const U = 100;
  let Q = null, f = 'd', ready = false, quality = 2;
  let ballImgs = [], ballAng = [], rollImgs = [], lightImg = null, shImgs = [], shH = [], shC = [], duImgs = [], duAge = [];
  const layer = D.createElement('div'); layer.className = 'jb'; layer.setAttribute('aria-hidden', 'true');
  const mk = (w, h, host) => { const c = D.createElement('canvas'); c.width = w; c.height = h; (host || layer).appendChild(c); return c; };
  let under = null, ground = null, gx = 0, gy = 0;
  function groundLayer() {
    const sp = spots.find((q) => q.clay && q.el.closest('.court'));
    if (!sp) return;
    const court = sp.el.closest('.court'); let blk = sp.el;
    while (blk.parentNode !== court) blk = blk.parentNode;
    if (getComputedStyle(court).position === 'static') return;
    under = D.createElement('div'); under.className = 'jb jb--ground'; under.setAttribute('aria-hidden', 'true');
    const z = getComputedStyle(blk).zIndex; under.style.zIndex = z === 'auto' ? '0' : z;
    court.insertBefore(under, blk); ground = court;
  }
  let cSh = null, cDu = null, cBl = null, cTr = null, gSh = null, gDu = null, gBl = null, gTr = null;
  const eb = D.getElementById('ball');
  const ebs = D.getElementById('rsh');
  const top = () => (window.__top && !window.__top.rm && window.__top.rest ? window.__top : null);
  const spots = els.map((el) => ({ el, clay: el.getAttribute('data-ball-spot') === 'clay' }));
  const HOME = 0;
  let trig = [], vh = innerHeight, vhEff = innerHeight, hdrB = 0, mob = false;
  let legs = [], off = [0], obst = [], court = null, courtEnd = 0, home0 = null;
  function homeNow() {
    const h = top().rest(); return { x: h.x + scrollX, y: h.y + scrollY, d: h.d };
  }
  function placeOf(i) {
    if (i === HOME) { const h = home0 || homeNow(); return { x: h.x, y: h.y, d: h.d, clay: true }; }
    const r = spots[i - 1].el.getBoundingClientRect();
    return { x: r.left + r.width / 2 + scrollX, y: r.top + r.height / 2 + scrollY, d: r.width, clay: spots[i - 1].clay };
  }
  function obstacles(y0, y1) {
    const out = [], sx = scrollX, sy = scrollY, m = P.clear;
    const skip = (el) => !!el.closest('.jb, .pin, .hdr, .tabbar, .skip, .demo, script, style, noscript, [data-ball-spot]');
    const push = (q) => { if (q.width > 0 && q.height > 0 && q.bottom + sy > y0 && q.top + sy < y1) out.push([q.left + sx - m, q.top + sy - m, q.right + sx + m, q.bottom + sy + m]); };
    const w = D.createTreeWalker(D.body, NodeFilter.SHOW_TEXT), range = D.createRange(); let n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      const el = n.parentElement; if (!el || skip(el)) continue;
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) push(q);
    }
    for (const el of D.querySelectorAll('a, button, summary, input, select, textarea, img, picture, video, table')) if (!skip(el)) push(el.getBoundingClientRect());
    return out;
  }
  const hit = (x, y, r) => { for (const q of obst) { const nx = clamp(x, q[0], q[2]), ny = clamp(y, q[1], q[3]); if ((nx - x) * (nx - x) + (ny - y) * (ny - y) < r * r) return true; } return false; };
  function route(a, b, fx) {
    const n = Math.max(2, Math.ceil((b.y - a.y) / 4)), X = new Float32Array(n + 1), Y = new Float32Array(n + 1), S = new Float32Array(n + 1), TH = new Float32Array(n + 1);
    let stop = -1;
    for (let i = 0; i <= n; i++) {
      const y = a.y + (b.y - a.y) * i / n; X[i] = fx(y); Y[i] = y;
      TH[i] = Math.atan2(fx(y + .5) - fx(y - .5), 1);
      if (i) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
    }
    for (let i = 0; i <= n && stop < 0; i++) if (hit(X[i], Y[i], lerp(a.d, b.d, i / n) / 2 + 1)) stop = i;
    return { X, Y, S, TH, n, len: S[n], stop };
  }
  function buildLeg(k) {
    const a = placeOf(k), b = placeOf(k + 1);
    if (!(b.y > a.y + 8)) return null;
    let R = route(a, b, (y) => a.x + (b.x - a.x) * ease5(a.y, b.y, y));
    if (R.stop >= 0 && court) {
      const al = Math.abs(court.xr - a.x) <= Math.abs(court.xl - a.x) ? court.xr : court.xl, h = b.y - a.y;
      if (court.top < a.y + 80 && court.bottom > a.y + 300 && h > 360) {
        const d1 = clamp(.8 * Math.abs(al - a.x), 60, .3 * h), d2 = clamp(1.6 * Math.abs(b.x - al), 160, .35 * h);
        const R2 = route(a, b, (y) => (y < a.y + d1 ? a.x + (al - a.x) * ease5(a.y, a.y + d1, y) : y > b.y - d2 ? al + (b.x - al) * ease5(b.y - d2, b.y, y) : al));
        if (R2.stop < 0 || (R.stop >= 0 && R2.S[R2.stop] > R.S[R.stop] + 40)) R = R2;
      }
    }
    let lane = R.len, hop = false;
    if (R.stop >= 0) {
      hop = true; const lim = R.S[R.stop] - (.55 * Math.max(a.d, b.d) + 12); let i = R.stop;
      while (i > 0 && R.S[i] > lim) i--;
      lane = R.S[i] < 30 ? 0 : R.S[i];
    }
    const H = k === HOME && home0 ? a.y - home0.end : P.anchor * vhEff;
    return { a, b, X: R.X, Y: R.Y, S: R.S, TH: R.TH, n: R.n, len: R.len, lane, hop, H };
  }
  function measure() {
    vh = innerHeight; mob = innerWidth <= 700;
    const tb = D.querySelector('.tabbar'), tr = tb && getComputedStyle(tb).display !== 'none' ? tb.getBoundingClientRect() : null;
    vhEff = tr ? Math.min(vh, tr.top - 8) : vh;
    { const h0 = D.getElementById('hdr'); hdrB = h0 ? Math.max(0, h0.getBoundingClientRect().bottom) : 0; }
    if (ground) { const q = ground.getBoundingClientRect(); gx = q.left + scrollX; gy = q.top + scrollY; }
    const t = top();
    home0 = t && t.home ? t.home() : null;
    court = null; courtEnd = 0;
    const cq = D.querySelector('.court');
    if (cq) {
      const r = (sel) => { const e = cq.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return q.height > 0 ? q : null; };
      const d1 = r('.hb-d1'), s1 = r('.hb-s1'), d2 = r('.hb-d2'), s2 = r('.hb-s2');
      if (d1 && s1 && d2 && s2) court = { xl: (d1.right + s1.left) / 2 + scrollX, xr: (s2.right + d2.left) / 2 + scrollX,
        top: Math.max(d2.top, s2.top) + scrollY, bottom: Math.min(d2.bottom, s2.bottom) + scrollY };
      courtEnd = cq.getBoundingClientRect().bottom + scrollY;
    }
    const topSafe = hdrB + .06 * vh;
    let prev = home0 ? home0.y : null;
    trig = [-1e9];
    for (let i = 1; i <= spots.length; i++) {
      const y = placeOf(i).y, std = y - P.line * vhEff, lo = y - .96 * vhEff;
      let tg = std;
      if (prev != null && prev - topSafe >= lo) tg = Math.min(std, prev - topSafe);
      trig.push(Math.max(trig[i - 1] + 1, tg)); prev = y;
    }
    const y0 = (home0 ? home0.y : placeOf(1).y) - 200, y1 = placeOf(spots.length).y + 400;
    obst = obstacles(y0, y1);
    legs = []; off = [0];
    for (let k = 0; k < spots.length; k++) {
      const L = (k === HOME && !home0) ? null : buildLeg(k);
      legs.push(L); off.push(off[k] + (L ? L.len : 1));
    }
  }
  function homeAway() {
    const t = top(), G = t && t.geo ? t.geo() : null;
    return !!G && scrollY > G.pinTop + G.pinScroll + G.vh - 4;
  }
  let want = HOME;
  function wanted() {
    const y = scrollY; let a = want;
    while (a < spots.length && y >= trig[a + 1]) a++;
    while (a > 0 && y < trig[a] - P.back * vh) a--;
    return a;
  }
  function laneAt(k, y) {
    const L = legs[k]; if (!L || L.lane <= 0) return 0;
    const yy = y + L.H; if (yy <= L.Y[0]) return 0;
    let lo = 0, hi = L.n; if (yy >= L.Y[hi]) return Math.min(L.len, L.lane);
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.Y[m] <= yy) lo = m; else hi = m; }
    return Math.min(L.lane, lerp(L.S[lo], L.S[hi], (yy - L.Y[lo]) / (L.Y[hi] - L.Y[lo] || 1)));
  }
  const target = () => off[want] + (want < spots.length ? laneAt(want, scrollY) : 0);
  const legOf = (q) => { let k = 0; while (k < legs.length - 1 && q >= off[k + 1]) k++; return k; };
  function blocked(g0, g1) {
    const lo = Math.min(g0, g1), hi = Math.max(g0, g1);
    for (let k = 0; k < legs.length; k++) {
      if (off[k + 1] <= lo + .5 || off[k] >= hi - .5) continue;
      const L = legs[k]; if (!L) return true;
      if (L.hop && hi > off[k] + L.lane + .5) return true;
    }
    return false;
  }
  function groundAt(y, clay) {
    if (courtEnd) return y < courtEnd ? 1 - smooth(courtEnd - 300, courtEnd - 90, y) : 0;
    return clay ? 1 : 0;
  }
  function pointAt(q, out) {
    const o = out || {}, k = legOf(q), L = legs[k];
    if (!L) { const p = placeOf(q >= off[k + 1] - .5 ? k + 1 : k); o.x = p.x; o.y = p.y; o.d = p.d; o.th = 0; o.sh = groundAt(p.y, p.clay); return o; }
    const s = clamp(q - off[k], 0, L.len); let lo = 0, hi = L.n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.S[m] <= s) lo = m; else hi = m; }
    const w = (s - L.S[lo]) / (L.S[hi] - L.S[lo] || 1), u = s / (L.len || 1);
    o.x = lerp(L.X[lo], L.X[hi], w); o.y = lerp(L.Y[lo], L.Y[hi], w); o.d = lerp(L.a.d, L.b.d, u);
    o.th = lerp(L.TH[lo], L.TH[hi], w);
    if (k === HOME && s < 200 && top()) {
      const h = homeNow(), e = 1 - smooth(0, 200, s);
      o.x += (h.x - L.a.x) * e; o.y += (h.y - L.a.y) * e; o.d += (h.d - L.a.d) * e;
    }
    o.sh = groundAt(o.y, (u < .5 ? L.a.clay : L.b.clay));
    return o;
  }
  let g = 0, gv = 0, mode = 'home', fl = null, dust = null, drawnBall = '', drawnSh = -1, drawnDu = -1, auto = 0;
  const S = { x: 0, y: 0, d: 0, h: 0, phi: 0, th: 0, sh: 0, k: 1, o: 1 };
  const put = (el, x, y, s, o) => { el.style.opacity = o.toFixed(3); if (o > 0) el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${s.toFixed(5)})`; };
  function mix(gc, c, a, b, w) {
    gc.globalCompositeOperation = 'source-over'; gc.clearRect(0, 0, c.width, c.height);
    gc.globalAlpha = 1 - w; gc.drawImage(a, 0, 0, c.width, c.height);
    if (w > .01) { gc.globalCompositeOperation = 'lighter'; gc.globalAlpha = w; gc.drawImage(b, 0, 0, c.width, c.height); gc.globalCompositeOperation = 'source-over'; }
    gc.globalAlpha = 1;
  }
  function ballFrame(phi) {
    const a = (((phi % 1) + 1) % 1) * 360; let best = 0, bd = 1e9;
    for (let i = 0; i < ballAng.length; i++) { const d0 = Math.abs(ballAng[i] - a), d1 = Math.min(d0, 360 - d0); if (d1 < bd) { bd = d1; best = i; } }
    return best;
  }
  function drawBall(still) {
    const c = cBl.width, h = c / 2, gc = gBl;
    if (!rollImgs.length) {
      const bi = ballFrame(S.phi), key = 'o' + bi;
      if (key !== drawnBall) { gc.clearRect(0, 0, c, c); gc.drawImage(ballImgs[bi], 0, 0, c, c); drawnBall = key; }
      return;
    }
    const N = rollImgs.length, fr = ((((S.phi % 1) + 1) % 1) * N);
    let i0 = Math.floor(fr) % N, w = fr - Math.floor(fr), i1 = (i0 + 1) % N;
    if (still || quality < 2) { if (w >= .5) i0 = i1; w = 0; } else w = Math.round(w * 8) / 8;
    const th = Math.round(S.th * 90) / 90, key = i0 + ':' + w + ':' + th;
    if (key === drawnBall) return;
    drawnBall = key;
    gc.setTransform(1, 0, 0, 1, 0, 0); gc.globalCompositeOperation = 'source-over'; gc.globalAlpha = 1; gc.clearRect(0, 0, c, c);
    gc.translate(h, h); gc.rotate(-th);
    gc.drawImage(rollImgs[i0], -h, -h, c, c);
    if (w > 0) { gc.globalAlpha = w; gc.drawImage(rollImgs[i1], -h, -h, c, c); gc.globalAlpha = 1; }
    gc.setTransform(1, 0, 0, 1, 0, 0);
    if (lightImg) {
      gc.globalCompositeOperation = 'multiply'; gc.drawImage(lightImg, 0, 0, c, c);
      gc.globalCompositeOperation = 'destination-in'; gc.translate(h, h); gc.rotate(-th);
      gc.drawImage(rollImgs[w >= .5 ? i1 : i0], -h, -h, c, c);
      gc.setTransform(1, 0, 0, 1, 0, 0); gc.globalCompositeOperation = 'source-over';
    }
  }
  function draw(still) {
    const d = S.d, s = d / U;
    drawBall(still);
    const bs = s * S.k, side = U / Q.ball_share;
    put(cBl, S.x - side * bs / 2, S.y - side * bs / 2, bs, S.o);
    const hm = S.h * P.apexM; let n = 0;
    while (n < shH.length - 2 && hm > shH[n + 1]) n++;
    const w = quality ? clamp((hm - shH[n]) / (shH[n + 1] - shH[n])) : 0, key = n + Math.round(w * 12) / 12;
    if (key !== drawnSh) { mix(gSh, cSh, shImgs[n], shImgs[Math.min(shImgs.length - 1, n + 1)], w); drawnSh = key; }
    const sw = Q.shadow.size[0] * U, shh = Q.shadow.size[1] * U, c0 = shC[0], dir = Q.shadow.dir;
    const ox = (c0[0] + dir[0] * P.far * S.h) * d, oy = (c0[1] + dir[1] * P.far * S.h) * d;
    put(cSh, S.x + ox - sw * s / 2 - gx, S.y + oy - shh * s / 2 - gy, s, S.sh * (1 - .28 * S.h) * S.o);
  }
  function drawDust(now) {
    if (!dust) return;
    const age = (now - dust.t0) / 1000 / (Q.dust.life_s * 1.15);
    if (age >= 1) { dust = null; cDu.style.opacity = '0'; drawnDu = -1; return; }
    let n = 0; while (n < duAge.length - 2 && age > duAge[n + 1]) n++;
    const w = clamp((age - duAge[n]) / (duAge[n + 1] - duAge[n])), key = n + Math.round(w * 10) / 10;
    if (key !== drawnDu) { mix(gDu, cDu, duImgs[n], duImgs[n + 1], w); drawnDu = key; }
    const side = Q.dust.size * U, s = dust.d / U;
    put(cDu, dust.x + Q.dust.center[0] * dust.d - side * s / 2, dust.y + Q.dust.center[1] * dust.d - side * s / 2, s, P.dust * smooth(0, .04, age));
  }
  const TR = { pts: [], w: 256, h: 512, on: false };
  function trailAdd(now) {
    if (quality < 2 || !cTr || S.sh < .5 || S.h > .01) return;
    const p = TR.pts, last = p[p.length - 1];
    if (last && Math.hypot(S.x - last.x, S.y - last.y) < 5) return;
    p.push({ x: S.x, y: S.y, d: S.d, t: now, a: S.sh }); if (p.length > 200) p.shift();
  }
  function drawTrail(now) {
    if (!cTr) return false;
    const p = TR.pts;
    while (p.length && now - p[0].t > P.trailLife * 1000) p.shift();
    if (p.length < 2 || quality < 2) { if (TR.on) { cTr.style.opacity = '0'; TR.on = false; } if (quality < 2) p.length = 0; return p.length > 0; }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, dm = 0;
    for (const q of p) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); dm = Math.max(dm, q.d); }
    const pad = dm * .3 + 4, W = x1 - x0 + 2 * pad, H = y1 - y0 + 2 * pad, k = Math.min(1, TR.w / W, TR.h / H);
    gTr.setTransform(1, 0, 0, 1, 0, 0); gTr.clearRect(0, 0, TR.w, TR.h); gTr.setTransform(k, 0, 0, k, (pad - x0) * k, (pad - y0) * k);
    gTr.lineCap = 'butt'; gTr.strokeStyle = '#3A1206';
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], life = 1 - (now - b.t) / (P.trailLife * 1000);
      if (Math.hypot(b.x - a.x, b.y - a.y) > 60) continue;
      const al = P.trail * b.a * life * life, ex = (b.x - a.x) * .08, ey = (b.y - a.y) * .08;
      gTr.beginPath(); gTr.moveTo(a.x, a.y); gTr.lineTo(b.x + ex, b.y + ey);
      gTr.globalAlpha = al * .45; gTr.lineWidth = .4 * b.d; gTr.stroke();
      gTr.globalAlpha = al * .55; gTr.lineWidth = .2 * b.d; gTr.stroke();
    }
    gTr.globalAlpha = 1;
    put(cTr, x0 - pad - gx, y0 - pad - gy, 1 / k, 1); TR.on = true;
    return true;
  }
  function hide() { cBl.style.opacity = cSh.style.opacity = '0'; }
  function warm() {
    const h = home0 || placeOf(1);
    S.x = h.x; S.y = h.y; S.d = h.d; S.h = .2; S.k = 1; S.phi = .5 / (rollImgs.length || 1); S.th = .05; S.sh = 1; S.o = .004;
    drawnBall = ''; drawnSh = -1;
    draw(false);
    if (duImgs.length > 1) { mix(gDu, cDu, duImgs[0], duImgs[1], .5); put(cDu, h.x, h.y, .2, .004); }
    setTimeout(() => { if (!dust) { cDu.style.opacity = '0'; drawnDu = -1; } if (mode !== 'home') return; S.o = 1; S.h = 0; S.phi = 0; S.th = 0; drawnBall = ''; drawnSh = -1; hide(); }, 260);
  }
  function home(on) { for (const e of [eb, ebs]) if (e) e.style.visibility = on ? '' : 'hidden'; }
  function show(still) {
    pointAt(g, S); S.h = 0; S.k = 1; S.o = 1; home(false); draw(still);
  }
  function roll(dt, gT, rate) {
    const g0 = g, d0 = S.d || 1; let n = Math.max(1, Math.ceil(dt / .008)); const h = dt / n, kk = rate * rate, cc = 2 * rate;
    for (; n--;) { gv += (kk * (gT - g) - cc * gv) * h; g += gv * h; }
    if (Math.abs(gT - g) < .6 && Math.abs(gv) < 14) { g = gT; gv = 0; }
    pointAt(g, S); S.h = 0; S.k = 1; S.o = 1;
    S.phi += (g - g0) / (Math.PI * (S.d + d0) / 2);
    return gv !== 0 || g !== gT;
  }
  let lastHop = '', sinceHop = 1e9, hopY = 0;
  function ends(a, b) {
    const ay = a.sy != null ? a.sy : clamp(a.y - scrollY, -P.edge * a.dRest, vh + P.edge * a.dRest);
    return [ay, clamp(b.y - scrollY, -P.edgeTo * b.d, vh + P.edgeTo * b.d)];
  }
  const B = {};
  function hop(now) {
    const air = !!fl && fl.land == null;
    let a;
    if (air) a = { x: S.x, y: S.y, h: S.h, phi: S.phi, sh: S.sh, dRest: fl.dNow, th: S.th };
    else {
      if (mode === 'home') { const h = homeNow(); S.x = h.x; S.y = h.y; S.d = h.d; S.phi = 0; S.th = 0; S.sh = 1; }
      a = { x: S.x, y: S.y, h: 0, phi: S.phi, sh: S.sh, dRest: S.d, th: S.th };
    }
    const b = pointAt(target(), B), re = air ? P.again : 1, s0 = a.y - scrollY, dir = b.y >= a.y ? 1 : -1;
    if (s0 < -a.dRest || s0 > vh + a.dRest) {
      const edge = s0 < 0 ? -P.edge * b.d : vh + P.edge * b.d, tb = b.y - scrollY, k = clamp((edge - tb) / ((s0 - tb) || 1));
      a.sy = edge; a.x = b.x + (a.x - b.x) * k; a.h = Math.max(a.h, .6); a.dRest = lerp(b.d, a.dRest, .3); a.edge = true;
    } else if (air) a.sy = s0;
    let kind = air ? fl.kind : (mob || quality < 1 || sinceHop < vh ? 'low' : 'big');
    if (!air) { if (kind === lastHop) kind = kind === 'low' ? 'low2' : kind === 'big' ? 'arc' : 'low'; lastHop = kind; sinceHop = 0; }
    const hk = HOPS[kind], [ay, by] = ends(a, b), dist = Math.hypot(b.x - a.x, by - ay);
    const T = clamp(P.tMin + (P.tMax - P.tMin) * (dist / (1.1 * vh)), P.tMin, P.tMax) * re * hk.t;
    const turns = Math.max(.5, Math.round(hk.turns * 2 * clamp(dist / (.5 * vh), .5, 1)) / 2);
    fl = { a, t0: now, T, dir, kind, grow: P.grow * hk.grow, phi0: a.phi, u0: 0, phi1: a.phi + dir * turns, hc: 4 * hk.h * clamp(dist / (.62 * vh), .5, 1),
      dNow: a.dRest, fresh: a.h === 0, held: 0, wait: false, last: now, born: now, want };
    mode = 'fly'; gv = 0; home(false);
  }
  function fly(now) {
    if (fl.want !== want) hop(now);
    const a = fl.a, gT = target(), b = pointAt(gT, B), dt = Math.max(0, (now - fl.last) / 1000); fl.last = now;
    let u = clamp((now - fl.t0) / 1000 / fl.T);
    const tsy = b.y - scrollY, away = tsy < hdrB - .5 * b.d || tsy > vhEff + .5 * b.d;
    if (away && moving && u > P.holdU && fl.held < P.holdMax) {
      fl.held += dt; fl.t0 = now - P.holdU * fl.T * 1000; u = P.holdU;
      S.phi += fl.dir * dt / fl.T; fl.wait = true;
    } else if (fl.wait) { fl.wait = false; fl.u0 = u; fl.phi0 = S.phi; fl.phi1 = S.phi + fl.dir * .5; }
    const e = lerp(u, smooth(0, 1, u), .35), [ay, by] = ends(a, b);
    S.x = lerp(a.x, b.x, e); S.y = lerp(ay, by, e) + scrollY;
    const dR = lerp(a.dRest, b.d, b.d >= a.dRest ? smooth(0, .7, u) : smooth(.3, 1, u));
    fl.dNow = dR; S.d = dR;
    S.h = a.h * (1 - u) * (1 - u) + fl.hc * u * (1 - u);
    if (!fl.wait) S.phi = lerp(fl.phi0, fl.phi1, clamp((u - fl.u0) / (1 - fl.u0 || 1)));
    S.th = lerp(a.th, b.th, smooth(0, 1, u));
    S.sh = lerp(a.sh, b.sh, smooth(0, .5, u));
    const kick = fl.fresh ? 1 - smooth(0, .07, u) : 0;
    S.k = (1 + fl.grow * S.h) * (1 + P.squash * .6 * kick);
    if (mv > .001) { const sy = S.y - scrollY, m = .62 * dR * S.k, lo = hdrB + m, hi = Math.max(lo, vhEff - m); S.y = lerp(sy, clamp(sy, lo, hi), mv) + scrollY; }
    S.o = a.edge ? smooth(0, .14, (now - fl.born) / 1000) : 1;
    draw(false);
    if (u >= 1) {
      S.o = 1; g = gT; gv = 0;
      if (want === HOME && g < .5) { fl = null; mode = 'home'; hide(); home(true); return; }
      const sq = P.squash * clamp(fl.hc / 2.4, .35, 1);
      fl = { land: now, sq }; mode = 'settle';
      if (b.sh > .5 && quality > 1 && duImgs.length > 1) { dust = { t0: now, x: b.x, y: b.y, d: b.d }; drawnDu = -1; }
    }
  }
  function settle(now) {
    const v = (now - fl.land) / 1000 / P.settle;
    pointAt(g, S); S.h = 0; S.o = 1;
    S.k = 1 + fl.sq * (1 - smooth(0, 1, v));
    draw(true);
    if (v >= 1) { fl = null; mode = 'rest'; }
  }
  let raf = 0, manual = false, vnow = 0, nFrames = 0, moving = false, mv = 0, vel = 0, lastY = 0, lastT = 0, slow = 0, okN = 0;
  function frame(now) {
    if (!ready) return false;
    nFrames++;
    let dt = (now - lastT) / 1000;
    {
      const y = scrollY;
      if (lastT && dt > 0 && dt < .2) {
        vel = lerp(vel, (y - lastY) / dt, .45);
        const m1 = smooth(P.moving * vh, 2.4 * P.moving * vh, Math.abs(vel));
        mv += (m1 - mv) * (1 - Math.exp(-dt / (m1 > mv ? .07 : .25)));
        if (!manual && (mode === 'roll' || mode === 'fly')) {
          if (dt > .034) slow++; else okN++;
          if (slow + okN >= 90) { if (slow > 22 && quality > 0) { quality--; drawnBall = ''; drawnSh = -1; } slow = okN = 0; }
        }
      } else { vel = 0; mv = 0; dt = 0; }
      lastY = y; lastT = now; moving = Math.abs(vel) > P.moving * vh;
    }
    const w = wanted(); if (w !== want) { want = w; auto = now; }
    const gT = target(), t = top();
    let busy = false;
    if (mode === 'fly') { fly(now); busy = true; }
    else if (mode === 'settle') { settle(now); busy = true; }
    else if (mode === 'home') {
      if (gT > .5 && t) {
        if (t.rest().ok) {
          const h = homeNow(); S.x = h.x; S.y = h.y; S.d = h.d; S.phi = 0; S.th = 0; S.sh = 1; g = 0; gv = 0;
          if (blocked(0, gT) || (gT > P.farHop * vh && mv > .5)) hop(now); else { mode = 'roll'; home(false); }
        } else if (homeAway()) hop(now);
        busy = true;
      }
    } else if (want === HOME && gT < .5 && g < 60 && t && !t.rest().ok) { g = 0; gv = 0; mode = 'home'; hide(); home(true); }
    else if (g !== gT || gv !== 0) {
      if (blocked(g, gT) || (Math.abs(gT - g) > P.farHop * vh && mv > .5)) { hop(now); busy = true; }
      else {
        const place = Math.abs(gT - off[want]) < .5, since = (now - auto) / 1000;
        mode = 'roll'; busy = roll(dt || 1 / 60, gT, place ? P.wEnd : lerp(P.wEnd, P.wRoll, smooth(.15, .7, since)));
        if (!busy && want === HOME && g < .5) { mode = 'home'; hide(); home(true); }
        else { home(false); trailAdd(now); draw(!busy); if (!busy) mode = 'rest'; }
      }
    }
    drawDust(now);
    const tr = drawTrail(now);
    return busy || !!dust || tr;
  }
  function loop() { raf = 0; if (manual) return; if (frame(performance.now())) raf = requestAnimationFrame(loop); else lastT = 0; }
  function kick() { if (!raf && !manual && ready) raf = requestAnimationFrame(loop); }
  addEventListener('scroll', () => {
    if (!ready || RM) return;
    const y = scrollY; sinceHop += Math.abs(y - hopY); hopY = y;
    if (wanted() !== want || (mode === 'home' ? target() > .5 : target() !== g)) kick();
  }, { passive: true });
  function relayout() {
    if (!ready) return;
    if (RM) { measure(); still(); return; }
    const k = legOf(g), u = legs[k] ? (g - off[k]) / (legs[k].len || 1) : 0, place = Math.abs(g - off[want]) < .5;
    measure();
    if (mode !== 'home' && mode !== 'fly') { g = place ? off[want] : off[k] + u * (legs[k] ? legs[k].len : 1); gv = 0; if (mode !== 'settle') { show(true); mode = 'rest'; } }
    kick();
  }
  addEventListener('resize', relayout);
  function still() {
    for (const sp of spots) {
      if (sp.el.querySelector('img:not(.jb-still img)') && !sp.el.querySelector('.jb-still')) continue;
      let box = sp.el.querySelector('.jb-still');
      if (!box) {
        box = D.createElement('span'); box.className = 'jb-still';
        const sh = new Image(), bl = new Image(); sh.alt = bl.alt = ''; sh.src = shImgs[0].src; bl.src = ballImgs[0].src;
        if (!sp.clay) sh.style.display = 'none';
        box.appendChild(sh); box.appendChild(bl); sp.el.appendChild(box);
      }
      const b = sp.el.getBoundingClientRect().width, [sh, bl] = box.children, c0 = shC[0];
      const sw = Q.shadow.size[0] * b, shh = Q.shadow.size[1] * b, side = b / Q.ball_share;
      sh.style.cssText = `${sp.clay ? '' : 'display:none;'}width:${sw.toFixed(1)}px;height:${shh.toFixed(1)}px;left:${(b / 2 + c0[0] * b - sw / 2).toFixed(1)}px;top:${(b / 2 + c0[1] * b - shh / 2).toFixed(1)}px`;
      bl.style.cssText = `width:${side.toFixed(1)}px;height:${side.toFixed(1)}px;left:${((b - side) / 2).toFixed(1)}px;top:${((b - side) / 2).toFixed(1)}px`;
    }
  }
  let asked = false, pre = false;
  const img = (src) => { const im = new Image(); im.decoding = 'async'; im.src = rel(src); return im.decode().then(() => im, () => im); };
  const good = (im) => !!im && im.naturalWidth > 0;
  const desc = () => (Q ? Promise.resolve(Q) : fetch(rel(J + 'jump.json')).then((r) => (r.ok ? r.json() : Promise.reject())).catch(() => { J = J0; return fetch(rel(J + 'jump.json')).then((r) => r.json()); }).then((q) => { Q = Q || q; return Q; }));
  function stage() {
    if (cBl) return;
    const q = Q, dpr = devicePixelRatio || 1, res = f === 'm' ? 352 : (dpr >= 1.5 ? 448 : 288), sm = f === 'm' ? [288, 230, 256] : [432, 346, 384];
    groundLayer();
    cTr = mk(TR.w, TR.h, under); gTr = cTr.getContext('2d'); cTr.style.width = TR.w + 'px'; cTr.style.height = TR.h + 'px';
    cSh = mk(sm[0], sm[1], under); cDu = mk(sm[2], sm[2]); cBl = mk(res, res);
    gSh = cSh.getContext('2d'); gDu = cDu.getContext('2d'); gBl = cBl.getContext('2d'); gBl.imageSmoothingQuality = 'high';
    cSh.style.width = (q.shadow.size[0] * U) + 'px'; cSh.style.height = (q.shadow.size[1] * U) + 'px';
    cDu.style.width = cDu.style.height = (q.dust.size * U) + 'px';
    cBl.style.width = cBl.style.height = (U / q.ball_share) + 'px';
    if (getComputedStyle(D.body).position === 'static') D.body.style.position = 'relative';
    D.body.appendChild(layer);
  }
  function early() {
    if (pre || asked || RM) return; pre = true;
    f = innerWidth <= 700 ? 'm' : 'd';
    desc().then((q) => {
      const R = q.roll || null, sh = q.shadow.levels, du = q.dust.frames;
      if (!R || asked || sh.length < 2 || R.files.length < 2) return null;
      return Promise.all([img(J + R.dir + '/' + R.files[0]), img(J + R.dir + '/' + R.files[1]), img(J + R.dir + '/' + R.light),
        img(J + q.shadow.dirs[f] + '/' + sh[0].file), img(J + q.shadow.dirs[f] + '/' + sh[1].file),
        ...(du.length > 1 ? [img(J + q.dust.dirs[f] + '/' + du[0].file), img(J + q.dust.dirs[f] + '/' + du[1].file)] : [])]).then(([a0, a1, li, s0, s1, p0, p1]) => {
        const t = top();
        if (asked || !t || t.c !== 0 || ![a0, a1, s0, s1].every(good)) return;
        stage();
        rollImgs = [a0, a1]; lightImg = good(li) ? li : null; shImgs = [s0, s1]; shH = [sh[0].h, sh[1].h]; shC = [sh[0].center, sh[1].center];
        duImgs = good(p0) && good(p1) ? [p0, p1] : [];
        warm();
      });
    }).catch(() => {});
  }
  function load() {
    if (asked) return; asked = true;
    html.classList.add('af-img');
    f = innerWidth <= 700 ? 'm' : 'd';
    desc().then((q) => {
      const R = q.roll || null;
      const balls = RM ? [R ? J + R.dir + '/' + R.lit0 : J + q.ball.dirs[f] + '/' + q.ball.frames[0].file] : (R ? [] : q.ball.frames.map((b) => J + q.ball.dirs[f] + '/' + b.file));
      const shs = RM ? q.shadow.levels.slice(0, 1) : q.shadow.levels, dus = RM ? [] : q.dust.frames;
      return Promise.all([
        Promise.all(balls.map(img)),
        Promise.all(shs.map((s) => img(J + q.shadow.dirs[f] + '/' + s.file))),
        Promise.all(dus.map((p) => img(J + q.dust.dirs[f] + '/' + p.file))),
        Promise.all(R && !RM ? R.files.map((n) => img(J + R.dir + '/' + n)) : []),
        R && !RM ? img(J + R.dir + '/' + R.light) : null,
      ]).then(([b, s, p, r, li]) => {
        if (!s.every(good) || !b.every(good) || (R && !RM && r.filter(good).length < 8)) throw new Error('кадры мяча или тени не загрузились');
        ballImgs = b; ballAng = R || RM ? [0] : q.ball.frames.map((x) => x.a); shImgs = s; shH = shs.map((x) => x.h); shC = shs.map((x) => x.center); duImgs = p; duAge = dus.map((x) => x.age);
        rollImgs = r.filter(good); lightImg = good(li) ? li : null;
        if (!p.every(good)) { duImgs = []; duAge = []; }
        if (RM) { ready = true; measure(); still(); return; }
        for (const sp of spots) sp.el.classList.add('is-flying');
        stage();
        ready = true; measure(); want = HOME; g = 0; gv = 0; mode = 'home';
        warm();
        if (!top()) { want = Math.max(1, wanted()); g = target(); mode = 'rest'; show(true); }
        else if (homeAway() && wanted() > HOME) { want = wanted(); g = target(); mode = 'rest'; show(true); }
        kick();
        if (window.ResizeObserver) { let first = true; new ResizeObserver(() => { if (first) { first = false; return; } relayout(); }).observe(D.body); }
      });
    }).catch((e) => { console.error('кадры мяча для блоков не загрузились', e); });
  }
  if (RM) addEventListener('load', load);
  else {
    const wait = () => {
      const t = top();
      if (!window.__top || (t && t.seq && t.c >= t.seq.duration - 1e-3)) { load(); return; }
      if (t && t.warmed && t.c === 0) early();
      setTimeout(wait, 200);
    };
    setTimeout(wait, 300);
  }
  const where = () => (mode === 'home' ? 0 : mode === 'rest' && Math.abs(g - off[want]) < .5 ? want : -1);
  window.__bloki = {
    P, get ready() { return ready; }, get n() { return nFrames; }, get at() { return where(); }, get want() { return want; },
    get flying() { return mode === 'fly' || mode === 'settle' || mode === 'roll'; }, get dust() { return !!dust; }, get quality() { return quality; }, set quality(v) { quality = v; drawnBall = ''; drawnSh = -1; },
    get trig() { return trig.slice(); }, get legs() { return legs.map((L) => (L ? { len: Math.round(L.len), lane: Math.round(L.lane), hop: L.hop, H: Math.round(L.H), ax: Math.round(L.a.x), ay: Math.round(L.a.y), bx: Math.round(L.b.x), by: Math.round(L.b.y) } : null)); },
    get court() { return court; },
    state: () => ({ ...S, at: where(), want, mode, g: +g.toFixed(1), gT: +target().toFixed(1), gv: Math.round(gv),
      fl: mode === 'fly' ? 'полёт' : mode === 'settle' ? 'осадка' : mode === 'roll' ? 'качение' : '', T: fl && fl.T ? fl.T : 0, kind: fl && fl.kind ? fl.kind : '', wait: !!(fl && fl.wait), quality }),
    manual: (on) => { manual = !!on; vnow = performance.now(); lastT = 0; if (!manual) kick(); }, step: (ms) => { vnow += ms; frame(vnow); }, load,
  };
})();
