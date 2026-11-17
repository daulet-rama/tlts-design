/* Первый экран «Мяч»: падение, удар, подъём камеры. Копия hero/3-myach-fable/top/top.js без примечаний; пояснения — там. */
(() => {
  const D = document, html = D.documentElement;
  const $ = (id) => D.getElementById(id);
  const RM = html.classList.contains('rm');
  const TEXT = { 1: 'В шапку', 2: 'Отсвет мяча', 3: 'Между строк', 4: 'Краска на корте' };
  const MODE = { mark: 'Отметка', auto: 'Само', scroll: 'По прокрутке' };
  const UDAR = { 0: 'прежний: в корт', A: 'А · за линией', B: 'Б · на линию и за неё', V: 'В · из корта за линию' };
  const udar0 = html.dataset.udar || new URLSearchParams(location.search).get('udar') || '0';
  const V = { text: TEXT[html.dataset.text] ? html.dataset.text : '4', mode: MODE[html.dataset.mode] ? html.dataset.mode : 'mark', udar: UDAR[udar0] ? udar0 : '0' };
  const vp = $('vp'), vpT = $('vp-t'), vpTn = $('vp-tn');
  let onChange = null;
  function paintPanel() {
    if (!vp) return;
    for (const b of vp.querySelectorAll('.vp-s button')) b.setAttribute('aria-pressed', String(V[b.parentNode.dataset.k] === b.dataset.v));
    vpTn.textContent = TEXT[V.text];
    const un = $('vp-un'); if (un) un.textContent = UDAR[V.udar];
  }
  function setOpen(o) { if (!vp) return; vp.dataset.open = o ? '1' : '0'; vpT.setAttribute('aria-expanded', String(!!o)); }
  function set(o) {
    if (o && o.udar != null && UDAR[o.udar] && String(o.udar) !== V.udar) {
      const u = new URL(location.href); u.searchParams.set('udar', o.udar);
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
  if (vp) vpT.addEventListener('click', () => setOpen(vp.dataset.open !== '1'));
  if (vp) vp.addEventListener('click', (e) => { const b = e.target.closest('.vp-s button'); if (b) set({ [b.parentNode.dataset.k]: b.dataset.v }); });
  paintPanel();
  if (RM) { if ($('vp-n')) $('vp-n').hidden = false; window.__top = { rm: true, set, V }; return; }
  const pin = D.querySelector('.pin'), stage = D.querySelector('.stage');
  const ball = $('ball'), still = $('still'), cv = $('seq'), info = $('info'), ql = $('ql');
  const far = $('far'), farCourt = $('far-court'), farTone = $('far-tone'), mid = $('mid'), det = $('det'), fx = $('fx'), veil = $('veil');
  const rsh = $('rsh'), RSH = { w: 4.3227, h: 3.4582, top: [-1.1434, .6719], side: [-1.1433, .4658] };
  const tint = $('tint'), glow = $('glow'), plines = $('plines'), sheet = D.querySelector('.court .sheet') || D.querySelector('.lane-probe');
  const hdr = $('hdr'), logo = hdr.querySelector('.logo'), logoB = logo.querySelector('b');
  const name = D.querySelector('.name'), kicker = name.querySelector('.kicker'), h1 = $('h1');
  const ctx = cv.getContext('2d'), fctx = fx.getContext('2d');
  const DATA = (D.querySelector('.pin') || html).dataset.data || html.dataset.data || (V.udar === '0' ? 'top/data/' : 'top/udar/' + V.udar + '/');
  const REL = (pin.dataset.r || html.dataset.r) ? '?r=' + encodeURIComponent(pin.dataset.r || html.dataset.r) : '';
  const rel = (u) => (REL && u.indexOf('?') < 0 ? u + REL : u);
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
  const copyKids = (src, dst) => { for (const n of src.childNodes) dst.appendChild(n.cloneNode(true)); fixI(src, dst); };
  const fixI = (src, dst) => { const A = src.querySelectorAll('.ch'), B = dst.querySelectorAll('.ch'); B.forEach((e, k) => { e.removeAttribute('style'); if (A[k]) e.style.setProperty('--i', A[k].style.getPropertyValue('--i')); }); };
  const tex = D.createElement('div'); tex.className = 'title split tex'; tex.setAttribute('aria-hidden', 'true'); copyKids(h1, tex); tw.appendChild(tex);
  const front = name.cloneNode(true); fixI(name, front); front.classList.add('front'); front.setAttribute('aria-hidden', 'true');
  for (const e of front.querySelectorAll('[id]')) e.removeAttribute('id');
  for (const e of front.querySelectorAll('[aria-label]')) e.removeAttribute('aria-label');
  ball.parentNode.insertBefore(front, ball.nextSibling);
  const fly = D.createElement('div'); fly.className = 'fly'; fly.setAttribute('aria-hidden', 'true');
  const flyT = D.createElement('div'); flyT.className = 'title split'; copyKids(h1, flyT); fly.appendChild(flyT); D.body.appendChild(fly);
  const l1s = [h1.querySelector('.l1'), front.querySelector('.title .l1')], l2s = [h1.querySelector('.l2'), front.querySelector('.title .l2')];
  let Q = null, F = [], DUR = 0, TC1 = 0, TSTOP = 0, TCAM = .4, TMARK = .2, IMARK = 4;
  let FXP = null;
  const REAL_W = 10.97;
  const PAGE_BALL = { d: 22, m: 16 };
  let G = null, dirty = true, fresh = true, drawnA = -1, drawnB = -1, detPick = null;
  function inkW(ln, pad) { const c = ln.querySelectorAll('.ch'); if (!c.length) return 0; const a = c[0], b = c[c.length - 1]; return b.offsetLeft + b.offsetWidth - a.offsetLeft - 2 * pad; }
  function mkLine(parent, cls) { const i = D.createElement('i'); i.className = 'ln ' + cls; parent.appendChild(i); return i; }
  let farLines = null;
  function measure() {
    const vw = stage.clientWidth || innerWidth, vh = stage.clientHeight, mob = innerWidth <= 700;
    const tb = D.querySelector('.tabbar'), bar = mob || !!(tb && getComputedStyle(tb).display !== 'none');
    const Sb = ball.offsetWidth, R0 = .396 * Sb;
    const c0x = ball.offsetLeft + Sb / 2, c0y = ball.offsetTop + Sb / 2;
    G = { vw, vh, mob, Sb, R0, c0x, c0y, pinTop: Math.round(pin.getBoundingClientRect().top + scrollY), pinScroll: Math.max(1, pin.offsetHeight - vh) };
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
    const S0 = 2 * R0 / f0.d;
    const yBand = Math.round(tT + tH + (mob ? 40 : 46));
    const limit = bar ? vh - 104 : vh - 36;
    const ysC = Q.contacts.map((i) => F[i].y).concat([fr.y]);
    const yHi = Math.max(...ysC) + fr.d * .75, yLo = Math.min(L0.baseline[0] - .03, Math.min(...ysC) - fr.d * .75);
    let SL = Math.min(.82 * S0, (limit - yBand) / (yE - fr.y + fr.d / 2)), ayL = yBand;
    let panL = 0;
    if (yHi > yE + .02) {
      const topFree = tT + tH + (mob ? 18 : 26), win = Math.min(yHi - yLo, .53);
      SL = Math.min(.82 * S0, (limit - topFree) / win); ayL = Math.round(topFree + (yHi - yE) * SL); panL = (yHi - yLo - win) * SL;
    }
    const cam = {
      R: { ax: c0x + (xT - f0.x) * S0, ay: c0y + (f0.y - yE) * S0, s: S0 },
      L: { ax: (mob ? .5 : .56) * vw, ay: ayL, s: SL },
      P: { ax: xc + xT * k1, ay: yBand, s: k1 },
    };
    const dpd = mob ? clamp(Math.round(devicePixelRatio || 1), 1, 3) : 1;
    const fxS = FXP || Q.fx, fp = mob ? fxS.ppm_m : fxS.ppm_d;
    if (!detPick || detPick.mob !== mob) {
      const dl = Q.detail, lite = !mob && !!dl.file_d1 && SL * (devicePixelRatio || 1) <= dl.ppm_d1 * 1.12;
      detPick = { mob, file: mob ? dl.file_m : lite ? dl.file_d1 : dl.file_d, ppm: mob ? dl.ppm_m : lite ? dl.ppm_d1 : dl.ppm_d };
    }
    const nat = { mid: (mob ? Q.court.ppm_m : Q.court.ppm_d) / dpd, det: detPick.ppm / dpd, fx: fp / dpd };
    const fr_ = Q.fx.rect, fw = Math.round((fr_[2] - fr_[0]) * fp), fh = Math.round((fr_[3] - fr_[1]) * fp);
    if (fx.width !== fw || fx.height !== fh) { fx.width = fw; fx.height = fh; drawnB = -1; }
    const pmk = Math.min(.3, .26 * vh / G.pinScroll);
    G.pm = { mark: pmk, up0: pmk + .055, up1: .93 };
    const size = (el, r, n) => { el.style.width = px((r[2] - r[0]) * n); el.style.height = px((r[3] - r[1]) * n); };
    size(mid, Q.court.rect, nat.mid); size(det, Q.detail.rect, nat.det); size(fx, Q.fx.rect, nat.fx);
    Object.assign(G, { lane, dbl0, dbl1, k1, xc, lw, xT, yE, S0, SL, cam, nat, yBand, zFar: 6, panL, panY0: fc.y, panY1: fr.y,
      mEnd: Math.max(1, (mob ? PAGE_BALL.m : PAGE_BALL.d) / (fr.d * k1)) });
    const L = Q.lines, hB = (L.baseline[1] - L.baseline[0]) * k1, wS = (L.singles_sideline[1] - L.singles_sideline[0]) * k1;
    const cS = (L.singles_sideline[0] + L.singles_sideline[1]) / 2 * k1;
    const X0 = Math.round(dbl0), XS = Math.round(xc - cS - lw / 2), XM = Math.round(xc - lw / 2);
    const xs = [X0 + lw / 2, XS + lw / 2, vw - XS - lw / 2, vw - X0 - lw / 2];
    if (!farLines) farLines = { base: mkLine(far, 'b'), mark: mkLine(far, 'm'), side: [0, 1, 2, 3].map(() => mkLine(far, 's')) };
    const yb = cam.P.ay, deep = Math.round(vh * 1.8);
    farCourt.style.cssText = `left:${X0}px;top:${yb}px;width:${vw - 2 * X0}px;height:${deep}px`;
    farLines.base.style.cssText = `left:${X0}px;top:${yb}px;width:${vw - 2 * X0}px;height:${lw}px;transform-origin:50% 0`;
    farLines.mark.style.cssText = `left:${XM}px;top:${yb}px;width:${lw}px;height:${mob ? 12 : 24}px;transform-origin:50% 0`;
    farLines.side.forEach((el, i) => {
      el.style.cssText = `left:${[X0, XS, vw - XS - lw, vw - X0 - lw][i]}px;top:${yb}px;width:${lw}px;height:${deep}px;transform-origin:${i === 0 ? '0 0' : i === 3 ? '100% 0' : '50% 0'}`;
    });
    G.lineK = { base: hB / lw, side: wS / lw };
    if (plines) {
      plines.textContent = '';
      const pc = D.createElement('i'); pc.className = 'pc'; pc.style.cssText = `left:${X0}px;width:${vw - 2 * X0}px`; plines.appendChild(pc);
      xs.forEach((x) => { const l = mkLine(plines, 's'); l.style.cssText = `left:${x - lw / 2}px;top:0;bottom:0;width:${lw}px`; });
    }
    html.style.setProperty('--dl', X0 + 'px'); html.style.setProperty('--sl', XS + 'px'); html.style.setProperty('--lw', lw + 'px');
    const host = pin.parentNode.getBoundingClientRect(), dy = G.pinTop + G.pinScroll - (host.top + scrollY), mod = (v) => ((v % 720) + 720) % 720;
    const fbg = far.querySelector('.far-bg');
    if (fbg) { fbg.style.setProperty('--tx', px(-mod(-.4 * vw))); fbg.style.setProperty('--ty', px(-mod(dy - .4 * vh))); }
    farCourt.style.setProperty('--tx', px(-mod(X0))); farCourt.style.setProperty('--ty', px(-mod(dy + yb)));
    html.style.setProperty('--dbl', px(xs[0])); html.style.setProperty('--sgl', px(xs[1]));
    const rho = mob ? .72 : .667;
    G.t4 = { rho, x: mob ? Math.round((vw - tW * rho) / 2) : Math.round(dbl0 + .06 * vw), y: Math.round(yb - (mob ? 16 : 26) - tH * rho), sHi: k1 * 3.2, sLo: k1 * 1.02 };
  }
  const CAM = { ax: 0, ay: 0, s: 1, E: 0, u: 0 };
  const LB = { cx: 0, cy: 0, d: 0 };
  function camera(c, e) {
    const { R, L, P } = G.cam, u = inOut(clamp(c / TCAM)), E = e * e * (3 - 2 * e);
    CAM.u = u; CAM.E = E;
    CAM.s = Math.exp(lerp(Math.log(R.s), Math.log(L.s), u) + (Math.log(P.s) - Math.log(L.s)) * E);
    let Lay = L.ay;
    if (G.panL) { const [a, b, w] = frameAt(c), by = lerp(F[a].y, F[b].y, w); Lay -= G.panL * (1 - smooth(0, 1, (by - G.panY0) / (G.panY1 - G.panY0))); }
    CAM.ax = lerp(R.ax, L.ax, u) + (P.ax - L.ax) * E;
    CAM.ay = lerp(R.ay, Lay, u) + (P.ay - Lay) * E;
  }
  const sx = (x) => CAM.ax + (x - G.xT) * CAM.s, sy = (y) => CAM.ay - (y - G.yE) * CAM.s;
  const PARK = '0.004', born = new Map();
  function place(el, rect, n, o, park, now, step) {
    const img = el.tagName === 'IMG';
    if (img && !(el.complete && el.naturalWidth)) { el.style.opacity = '0'; return; }
    if (park && prepN < step) { el.style.opacity = '0'; return; }
    if (park || (img && !born.has(el))) { el.style.opacity = PARK; el.style.transform = 'translate3d(0,0,0) scale(1)'; if (img && !born.has(el)) born.set(el, park ? -1e9 : now); return; }
    if (img) { const r = clamp((now - born.get(el)) / 250); if (r < 1) dirty = true; o *= r; }
    el.style.opacity = o.toFixed(3);
    if (o > 0) el.style.transform = `translate3d(${sx(rect[0]).toFixed(2)}px,${sy(rect[3]).toFixed(2)}px,0) scale(${(CAM.s / n).toFixed(5)})`;
  }
  let A = [], B = [], BO = [], setKey = '', loadedA = 0, loadedB = 0, needA = 0, needB = 0;
  const BMP = typeof createImageBitmap === 'function' && typeof fetch === 'function' && typeof Blob === 'function';
  function viaImg(url) { const im = new Image(); im.decoding = 'async'; im.fetchPriority = 'low'; im.src = url; return im.decode().then(() => im); }
  function getFrame(url) {
    if (!BMP) return viaImg(url);
    return fetch(url, { priority: 'low' }).then((r) => (r.ok ? r.blob() : Promise.reject(new Error('нет кадра')))).then((b) => createImageBitmap(b)).catch(() => viaImg(url));
  }
  function load() {
    if (!Q || !G) return;
    const f = G.mob ? 'm' : 'd';
    if (f === setKey) return;
    for (const x of A.concat(B)) if (x && x.close) x.close();
    setKey = f; A = new Array(F.length).fill(null); B = new Array(F.length).fill(null); BO = new Array(F.length).fill(null); loadedA = loadedB = 0;
    const rectsB = FXP && FXP.rects ? FXP.rects[f] : null;
    born.clear(); fxBorn = 0; drawnA = drawnB = -1;
    const tone = Q.court.tone ? Q.court.tone[f] : null;
    if (tone) farTone.style.backgroundColor = `rgb(${tone[0]},${tone[1]},${tone[2]})`;
    else mid.addEventListener('load', () => { try {
      const t = D.createElement('canvas'); t.width = 16; t.height = 12; const g = t.getContext('2d', { willReadFrequently: true });
      g.drawImage(mid, 0, 0, 16, 12); const d = g.getImageData(2, 7, 6, 4).data; let r = 0, gg = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4; farTone.style.backgroundColor = `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`;
    } catch (e) {} }, { once: true });
    if (rsh && rsh.dataset.d) {
      const own = Q.track && rsh.dataset.d.indexOf('top/data/jump/') === 0;
      rsh.style.width = (RSH.w * 100) + 'px'; rsh.src = rel(own ? DATA + 'jump/s/' + f + '/s0.webp' : (G.mob ? rsh.dataset.m : rsh.dataset.d));
    }
    det.src = rel(DATA + detPick.file);
    mid.src = rel(DATA + (G.mob ? Q.court.file_m : Q.court.file_d));
    const firstA = Math.max(0, IMARK - 1), firstB = FXP ? FXP.first : 0, dirB = (FXP || Q.fx).dirs[f], cts = Q.contacts;
    const jobs = [];
    for (const s of [8, 4, 2, 1]) for (let i = firstA; i < F.length; i += s) if (!jobs.some((j) => j[0] === 'A' && j[1] === i)) jobs.push(['A', i]);
    for (const s of [8, 4, 2, 1]) for (let i = firstB; i < F.length; i += s) if (!jobs.some((j) => j[0] === 'B' && j[1] === i)) jobs.push(['B', i]);
    jobs.sort((p, q) => (p[1] <= cts[0] + 4 ? 0 : 1) - (q[1] <= cts[0] + 4 ? 0 : 1));
    needA = jobs.filter((j) => j[0] === 'A').length; needB = jobs.length - needA;
    let k = 0;
    const next = () => {
      if (k >= jobs.length || setKey !== f) return;
      const [kind, i] = jobs[k++];
      getFrame(rel(DATA + (kind === 'A' ? Q.sprite.dirs[f] + '/' + F[i].file : dirB + '/' + F[i].fx))).then((im) => {
        if (setKey !== f) { if (im.close) im.close(); return; }
        if (kind === 'A') { A[i] = im; loadedA++; drawnA = -1; } else { B[i] = im; BO[i] = rectsB ? rectsB[F[i].fx] || null : null; loadedB++; drawnB = -1; }
        dirty = true;
      }, () => {}).then(next);
    };
    for (let n = 0; n < 3; n++) next();
  }
  const near = (arr, i, lim = 3) => { for (let s = 0; s <= lim; s++) { if (arr[i - s]) return i - s; if (arr[i + s]) return i + s; } return -1; };
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
  function putFrame(g, arr, canvas, i, off) { const o = off && off[i]; if (o) g.drawImage(arr[i], o[0], o[1]); else g.drawImage(arr[i], 0, 0, canvas.width, canvas.height); }
  function drawSet(g, arr, canvas, a, b, w, was, off) {
    const key = a + w;
    if (key === was) return was;
    const ia = arr[a] ? a : near(arr, a);
    if (ia < 0) return was >= 0 && arr === B ? was : -1;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.globalAlpha = 1; putFrame(g, arr, canvas, ia, off);
    if (ia === a && w > .03 && b !== a && arr[b]) { g.globalAlpha = w; putFrame(g, arr, canvas, b, off); g.globalAlpha = 1; }
    return key;
  }
  let warmed = false, warmUntil = 0, warmI = -1, prepN = -1, prepAt = 0, prepT = 0;
  function warm(now) {
    if (warmed || c !== 0 || !(needA > 0 && loadedA >= needA && needB > 0 && loadedB >= needB)) return;
    warmed = true; warmI = 0; warmUntil = now + 250; dirty = true;
  }
  function warmStep(now) {
    if (c !== 0) { warmI = -1; return; }
    for (let k = 0; k < 6 && warmI < F.length; k++, warmI++) {
      for (const [g, arr, canvas, off] of [[ctx, A, cv, null], [fctx, B, fx, BO]]) {
        if (!arr[warmI]) continue;
        g.globalAlpha = 1; putFrame(g, arr, canvas, warmI, off);
        g.globalAlpha = .5; putFrame(g, arr, canvas, warmI, off); g.globalAlpha = 1;
      }
    }
    if (warmI >= F.length) warmI = -1;
    drawnA = drawnB = -1; warmUntil = now + 250; dirty = true;
  }
  const PT = { on: .035, off: .018, fall: .47, up0: { auto: .11, scroll: .47 }, up1: .93, tau: .13 };
  let c = 0, eC = 0, lastNow = 0, hold = null, phase = 'scrub', manual = false, vnow = 0;
  const WS = 13, WE = 11, PACE = .9, RAMP = .5;
  let cV = 0, eV = 0, playT = 0, playV0 = 1;
  const REV = { roll: 2.8, hops: 2.0, near: .42, c0: .30, c1: .75, tauv: .12, hyst: .014, we: 6.5 };
  let pV = 0, soft = 0, away = false, awayT = 0, needBall = false;
  let p0 = 0, pHi = 0, fromBelow = false;
  function revRate(cc) {
    if (cc >= TSTOP - .1) return REV.roll;
    if (cc >= REV.c1) return lerp(REV.hops, REV.roll, smooth(TSTOP - .5, TSTOP - .1, cc));
    return lerp(REV.near, REV.hops, smooth(REV.c0, REV.c1, cc));
  }
  const LIFT = { T: { 1: 2.3, 2: 3.3, 3: 4.7 },
    zoom: [.14, 2.3], zoomEnd: .80,
    ball: [.07, 3.2], move: [.2, 2.0],
    cover: .74, coverM: .82,
    dim: .2,
    info: [.55, .08], tauv: .16, hyst: .03 };
  const mkEase = (a, p) => { const N = 240, T = new Float32Array(N + 1); let acc = 0;
    for (let i = 1; i <= N; i++) { const u = (i - .5) / N; acc += smooth(0, a, u) * Math.pow(1 - u, p - 1); T[i] = acc; }
    for (let i = 1; i <= N; i++) T[i] /= acc;
    return (u) => { u = clamp(u); const x = u * N, i = Math.min(N - 1, x | 0); return T[i] + (T[i + 1] - T[i]) * (x - i); }; };
  const gZoom = mkEase(LIFT.zoom[0], LIFT.zoom[1]), gBall = mkEase(LIFT.ball[0], LIFT.ball[1]), gMove = mkEase(LIFT.move[0], LIFT.move[1]), gNear = mkEase(.2, 2.6);
  let tempo = 2; try { const v = new URLSearchParams(location.search).get('podem'); if (v === '1' || v === '3') tempo = +v; if (v) html.dataset.podem = String(tempo); } catch (e) {}
  let SKY = null, skyA = null, skyB = null, skyAsk = false, dustEl = null;
  function skyLoad() {
    if (skyAsk || !Q) return; skyAsk = true;
    fetch(rel(DATA + 'sky/sky.json')).then((r) => (r.ok ? r.json() : Promise.reject(new Error('нет корта с высоты')))).then((m) => {
      const mk = (lod) => { const im = new Image(); im.className = 'sky'; im.alt = ''; im.decoding = 'async'; im.setAttribute('aria-hidden', 'true'); im.width = lod.size[0]; im.height = lod.size[1]; im.src = rel(DATA + 'sky/' + lod.file); return im; };
      const fine = (devicePixelRatio || 1) >= 2.5;
      const a = mk(m.lods[0]), b = fine ? null : mk(m.lods[1]);
      Promise.all([a.decode(), b ? b.decode() : 0]).then(() => {
        far.parentNode.insertBefore(a, far.nextSibling); if (b) far.parentNode.insertBefore(b, a.nextSibling);
        dustEl = D.createElement('i'); dustEl.className = 'lift-dust'; dustEl.setAttribute('aria-hidden', 'true'); ball.parentNode.insertBefore(dustEl, rsh || ball);
        skyA = a; skyB = b; SKY = m; dirty = true; }, () => {});
    }).catch(() => {});
  }
  const LF = { t: 0, v: 0, T: 3.4, c0: 0, e0: 0, E0: 0, s0: 1, sN: 1, sEnd: 1, A: [0, 0], B0: [0, 0], Pe: [0, 0], d0: 1, w0: 0, sw0: 1, air: false, n: [0, 0], amp: 0, cov: 0, covT: -1 };
  function liftStart() {
    camera(c, eC);
    const [a, b, w] = frameAt(c), fa = F[a], fb = F[b];
    const bx = lerp(fa.x, fb.x, w), by = lerp(fa.y, fb.y, w), bd = lerp(fa.d, fb.d, w), bh = lerp(fa.h, fb.h, w);
    LF.T = LIFT.T[tempo]; LF.t = 0; LF.v = 0; LF.c0 = c; LF.e0 = eC; LF.E0 = CAM.E; LF.s0 = CAM.s; LF.sN = Math.min(CAM.s, G.k1);
    LF.sEnd = (G.mob ? LIFT.coverM : LIFT.cover) * G.R0 / Math.hypot(SKY.lit.hx, SKY.lit.hy);
    LF.A = [bx, by]; LF.B0 = [sx(bx), sy(by)]; LF.d0 = bd * CAM.s * Math.exp(Math.log(G.mEnd) * CAM.E); LF.air = bh > .012;
    const cc = SKY.court, vx = (0 - bx) * LF.sEnd, vy = -(cc.net_y - by) * LF.sEnd;
    LF.Pe = [G.c0x - vx, G.c0y - vy];
    const dx = G.c0x - LF.B0[0], dy = G.c0y - LF.B0[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len; if (ny > 0) { nx = -nx; ny = -ny; }
    LF.n = [nx, ny]; LF.amp = .13 * len + 18;
    const q = G.t4; LF.w0 = 1 - smooth(Math.log(q.sLo), Math.log(q.sHi), Math.log(CAM.s));
    LF.sw0 = swA; LF.cov = 0; LF.covT = -1; LF.lastNow = 0;
  }
  function liftEnd() {
    for (const el of [skyA, skyB, dustEl]) if (el) el.style.opacity = '0';
    rsh && (rsh.style.opacity = '0'); swA = 0; drawnA = -1; dirty = true; fresh = true;
  }
  const putSky = (el, ppm, o) => { if (!(o > .002)) { el.style.opacity = '0'; return; } el.style.opacity = o.toFixed(3);
    el.style.transform = `translate3d(${sx(SKY.rect[0]).toFixed(2)}px,${sy(SKY.rect[3]).toFixed(2)}px,0) scale(${(CAM.s / ppm).toFixed(5)})`; };
  function liftFrame(now) {
    const t = clamp(LF.t, 0, LF.T), T = LF.T, tz = Math.max(.6, LIFT.zoomEnd * T - .1);
    const gz = gZoom((t - .1) / tz), gn = gNear(t / Math.min(.9, .28 * T));
    const s = Math.exp(Math.log(LF.sN) + (Math.log(LF.s0) - Math.log(LF.sN)) * (1 - gn) + (Math.log(LF.sEnd) - Math.log(LF.sN)) * gz);
    const gp = gMove((t - .05) / tz), Px = lerp(LF.B0[0], LF.Pe[0], gp), Py = lerp(LF.B0[1], LF.Pe[1], gp);
    CAM.s = s; CAM.ax = Px - (LF.A[0] - G.xT) * s; CAM.ay = Py + (LF.A[1] - G.yE) * s;
    const E = clamp((Math.log(s) - Math.log(G.SL)) / (Math.log(G.k1) - Math.log(G.SL))); CAM.E = E; CAM.u = 1;
    const z = s / G.k1, zf = Math.min(G.zFar, z);
    const skyK = 1 - smooth(.86, 1, z), farK = smooth(.70, .86, z);
    far.style.opacity = farK.toFixed(3);
    if (farK > 0) far.style.transform = `translate3d(${(CAM.ax - G.cam.P.ax * zf).toFixed(2)}px,${(CAM.ay - G.cam.P.ay * zf).toFixed(2)}px,0) scale(${zf.toFixed(5)})`;
    const tone = smooth(1.0 * G.k1, 1.6 * G.k1, s);
    farTone.style.opacity = (.93 * tone).toFixed(3);
    const lm = Math.min(smooth(.5, 1, E), 1 - smooth(0, .3, t) * (1 - smooth(1.02, 1.3, z))), lo = lerp(1, .82, tone).toFixed(3);
    const kB = lerp(G.lineK.base, 1, lm), kS = lerp(G.lineK.side, 1, lm);
    farLines.base.style.transform = kB > 1.0005 ? `scale(1,${kB.toFixed(4)})` : 'none';
    farLines.mark.style.transform = kS > 1.0005 ? `scale(${kS.toFixed(4)},1)` : 'none';
    farLines.base.style.opacity = farLines.mark.style.opacity = lo;
    for (const el of farLines.side) { el.style.transform = kS > 1.0005 ? `scale(${kS.toFixed(4)},1)` : 'none'; el.style.opacity = lo; }
    const oDet = smooth(.24 * G.SL, .5 * G.SL, s);
    place(mid, Q.court.rect, G.nat.mid, smooth(1.6 * G.k1, 2.7 * G.k1, s), false, now, 1);
    place(det, Q.detail.rect, G.nat.det, oDet, false, now, 2);
    place(fx, Q.fx.rect, G.nat.fx, drawnB >= 0 ? oDet : 0, false, now, 3);
    const td = T - .15, gb = gBall(t / td), d = Math.exp(lerp(Math.log(LF.d0), Math.log(2 * G.R0), gb));
    const gm = gMove(t / td), arc = Math.sin(Math.PI * Math.pow(gm, .8)) * LF.amp;
    const cx = lerp(LF.B0[0], G.c0x, gm) + LF.n[0] * arc, cy = lerp(LF.B0[1], G.c0y, gm) + LF.n[1] * arc, k = d / (2 * G.R0);
    const swN = Math.sin(((now - t0) / 1000) * (2 * Math.PI / 9)) * 1.4, ang = swN * smooth(T - .7, T, t);
    ball.style.transform = `translate3d(${(cx - G.c0x).toFixed(2)}px,${(cy - G.c0y).toFixed(2)}px,0) rotate(${ang.toFixed(3)}deg) scale(${k.toFixed(5)})`;
    LB.cx = cx; LB.cy = cy; LB.d = d;
    const D2 = 2 * G.R0, dA = .36 * D2, dB = .74 * D2, ld = Math.log(d), tMin = F[Math.max(0, IMARK - 1)].t;
    const pS = clamp((ld - Math.log(LF.d0)) / Math.max(.05, Math.log(dA) - Math.log(LF.d0)));
    const tau = lerp(LF.c0, TMARK + .05, Math.pow(pS, 1.15)) - (TMARK + .05 - tMin) * smooth(Math.log(dA), Math.log(dB), ld);
    if (LF.sw0 > 0 && d < dB * 1.02) { let [pa, pb, pw] = pick(tau); if (F[pa].squash > 0) pa = pb = Math.min(F.length - 1, pa + 1); if (F[pb].squash > 0) { pb = pa; pw = 0; }
      const was = drawnA; drawnA = drawSet(ctx, A, cv, pa, pb, pw, drawnA); if (drawnA < 0) drawnA = was; }
    const sw = LF.sw0 * (1 - smooth(Math.log(dA), Math.log(dB), ld));
    swA = sw; cv.style.opacity = sw.toFixed(3); still.style.opacity = (LF.sw0 < 1 || d > .86 * dA) ? '1' : '0';
    const far2 = Math.hypot(SKY.lit.hx, SKY.lit.hy) * s, ccx = sx(0), ccy = sy(SKY.court.net_y);
    const covered = Math.hypot(ccx - cx, ccy - cy) + far2 < .46 * d;
    if (covered) { if (LF.covT < 0) LF.covT = now; } else LF.covT = -1;
    LF.cov = clamp(LF.cov + (covered ? 1 : -1) * (now - (LF.lastNow || now)) / 320); LF.lastNow = now;
    const dimK = 1 - LIFT.dim * gz, oSky = skyK * dimK * (1 - LF.cov);
    const ls = Math.log(s * Math.min(2, devicePixelRatio || 1)), wb = skyB ? 1 - smooth(Math.log(26), Math.log(33), ls) : 0, wa = skyB ? smooth(Math.log(21), Math.log(26), ls) : 1;
    putSky(skyA, SKY.lods[0].ppm, oSky * wa); if (skyB) putSky(skyB, SKY.lods[1].ppm, oSky * wb);
    const Dg = LF.d0 * s / LF.s0, mag = (d / LF.d0) / (s / LF.s0), hk = 1 - 1 / Math.max(1, mag);
    if (rsh && rsh.naturalWidth) {
      const q = Q.track ? RSH.top : RSH.side, sc = Dg / 100 * (1 + 2.4 * hk), o0 = Math.max(smooth(.7, 1, LF.E0), 1 - oDet);
      const X = Px + q[0] * Dg - .862 * 1.5 * hk * s, Y = Py + q[1] * Dg + .507 * 1.5 * hk * s;
      const o = LF.c0 >= DUR - 1e-6 ? o0 * (1 - smooth(.12, .8, hk)) : 0;
      rsh.style.opacity = o.toFixed(3);
      if (o > 0) rsh.style.transform = `translate3d(${(X - RSH.w * 50 * sc).toFixed(2)}px,${(Y - RSH.h * 50 * sc).toFixed(2)}px,0) scale(${sc.toFixed(5)})`;
    }
    if (dustEl) {
      const od = LF.air ? 0 : smooth(.02, .12, t) * (1 - smooth(.16, .62, t)) * .5, ds = Dg * (1.6 + 5 * smooth(0, .62, t)) / 100;
      dustEl.style.opacity = od.toFixed(3);
      if (od > 0) dustEl.style.transform = `translate3d(${(Px - 50 * ds).toFixed(2)}px,${(Py + .2 * Dg - 50 * ds).toFixed(2)}px,0) scale(${ds.toFixed(4)})`;
    }
    const q4 = G.t4, w = LF.w0 * (1 - smooth(0, Math.min(.9, .3 * T), t)), paint = 1 - smooth(.2 * T, .5 * T, t);
    const sc4 = Math.exp(Math.log(q4.rho) * w), x4 = lerp(G.tL, q4.x, w), y4 = lerp(G.tT, q4.y, w);
    tw.style.transformOrigin = '0 0';
    tw.style.transform = w > 0 ? `translate3d(${(x4 - G.tL).toFixed(2)}px,${(y4 - G.tT).toFixed(2)}px,0) scale(${sc4.toFixed(5)})` : '';
    tex.style.opacity = paint.toFixed(3); kicker.style.opacity = (1 - smooth(0, .5, w)).toFixed(3); name.classList.toggle('ink', paint > .6);
    veil.style.opacity = (1 - smooth(.3 * T, .62 * T, t)).toFixed(3); veil.style.setProperty('--g', (1 - E).toFixed(3));
    if (G.mob) stage.style.setProperty('--scrim', smooth(.70 * T, .92 * T, t).toFixed(3));
    const oi = smooth(T - LIFT.info[0], T - LIFT.info[1], t);
    info.style.opacity = ql.style.opacity = oi;
    info.style.transform = ql.style.transform = `translate3d(0,${((1 - oi) * 26).toFixed(1)}px,0)`;
    info.style.visibility = ql.style.visibility = oi < .01 ? 'hidden' : '';
    LF.out = { t: +t.toFixed(3), T, d: +(d / (2 * G.R0)).toFixed(4), s: +s.toFixed(2), sky: +oSky.toFixed(3), cov: +LF.cov.toFixed(2) };
  }
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
      const m = G.pm, liftable = !!SKY && !!skyA && V.text === '4';
      if (phase === 'scrub') p0 = Math.min(p0, p);
      const pe = Math.max(0, p - p0), upA = Math.min(m.up0 + p0, m.up1 - .12);
      const cs = TMARK * clamp(pe / m.mark);
      if (away) { if (p < m.mark - REV.hyst) { awayT += dt; if (awayT > 2.5 && window.__bloki && window.__bloki.recall) window.__bloki.recall(); } else awayT = 0; }
      const back = p < m.mark - REV.hyst && !away;
      if (phase === 'scrub') {
        cV = clamp(cV + (WS * WS * (cs - c) - 2 * WS * cV) * dt, -TMARK / .35, TMARK / PACE); c = clamp(c + cV * dt, 0, TMARK);
        if (Math.abs(cs - c) < 2e-4 && Math.abs(cV) < 2e-3) { c = cs; cV = 0; }
        if (pe >= m.mark) { phase = 'play'; playT = 0; playV0 = clamp(cV, 0, 2.5); soft = 0; pHi = p; }
      }
      else if (phase !== 'rewind' && phase !== 'lift' && liftable && !away && c >= .32 && p < m.up1 - .01 && (fromBelow || p < pHi - LIFT.hyst)) {
        phase = 'lift'; liftStart(); fromBelow = false; LF.dir = 1; LF.pRef = p;
      }
      else if (back && phase !== 'rewind' && phase !== 'lift') phase = 'rewind';
      else if (phase === 'lift') {
        if (LF.dir > 0) { LF.pRef = Math.min(LF.pRef, p); if (p > LF.pRef + LIFT.hyst) { LF.dir = -1; LF.pRef = p; } }
        else { LF.pRef = Math.max(LF.pRef, p); if (p < LF.pRef - LIFT.hyst) { LF.dir = 1; LF.pRef = p; } }
        LF.v += (LF.dir - LF.v) * (1 - Math.exp(-dt / LIFT.tauv)); LF.t += dt * LF.v;
        if (LF.t >= LF.T) { liftEnd(); phase = 'scrub'; c = 0; cV = 0; pV = 0; eC = 0; eV = 0; p0 = p; return p; }
        if (LF.t <= 0 && LF.dir < 0) { LF.t = 0; liftEnd(); swA = LF.sw0; drawnA = -1; phase = LF.c0 < DUR ? 'play' : 'done'; playT = RAMP; playV0 = 1; soft = .45; pV = 0; pHi = p; }
        else return p;
      }
      else if (phase === 'rewind' && p >= m.mark) { phase = c < DUR ? 'play' : 'done'; playT = RAMP; playV0 = 1; soft = .45; }
      if (phase === 'play') {
        const ahead = clamp((p - upA) / (m.up1 - upA));
        const rate = lerp(playV0, 1 + 1.5 * smooth(.2, .9, ahead) + (past ? 1.5 : 0), smooth(0, RAMP, playT));
        playT += dt;
        if (soft > 0) { soft -= dt; pV += (rate - pV) * (1 - Math.exp(-dt / REV.tauv)); } else pV = rate;
        c = Math.min(DUR, c + dt * pV);
        if (c >= DUR) { phase = 'done'; pV = 0; }
      } else if (phase === 'done') { c = DUR; pV = 0; }
      if (phase === 'play' || phase === 'done') { pHi = Math.max(pHi, p); if (p >= m.up1) fromBelow = false; }
      else if (phase === 'rewind') {
        pV += (-revRate(c) - pV) * (1 - Math.exp(-dt / REV.tauv));
        c = Math.min(DUR, c + dt * pV);
        if (c <= cs + 1e-6) { c = Math.max(c, Math.min(cs, TMARK)); cV = clamp(pV, -TMARK / .35, 0); pV = 0; phase = 'scrub'; }
      }
      et = clamp((p - upA) / (m.up1 - upA));
      if (!past) et *= smooth(TSTOP - .55, TSTOP - .1, c);
      needBall = away && (et < .97 || p < m.mark);
      if (away) et = 1;
    }
    const we = phase === 'rewind' ? REV.we : WE;
    eV += (we * we * (et - eC) - 2 * we * eV) * dt; eC = clamp(eC + eV * dt);
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
    if (tx === '1') {
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
    } else if (tx === '2') {
      const q = G.tint;
      glow.style.transform = `translate3d(${(Bst.cx - q.x - q.Rg * Bst.k).toFixed(1)}px,${(Bst.cy - q.y - q.Rg * Bst.k).toFixed(1)}px,0) scale(${Bst.k.toFixed(4)})`;
      glow.style.opacity = ((.1 + .9 * smooth(.36, .95, Bst.k)) * (1 - .85 * lit)).toFixed(3);
      if (prevC >= 0 && prevC < TC1 && c >= TC1) shakeT0 = now;
      let sy_ = 0;
      if (shakeT0) { const dt = now - shakeT0; if (dt < 430) { sy_ = (G.mob ? 3 : 5) * Math.exp(-dt / 95) * Math.cos(dt / 17.5); dirty = true; } else shakeT0 = 0; }
      name.style.transform = tint.style.transform = sy_ ? `translate3d(0,${sy_.toFixed(2)}px,0)` : '';
    } else if (tx === '3') {
      const back = 1 - smooth(.1, .62, c), a = smooth(0, .3, c), q = G.t3;
      const t2 = `translate3d(${(q.x * back).toFixed(1)}px,${(q.y * back + q.par * a * back).toFixed(1)}px,0)`;
      const t1 = `translate3d(0,${(-q.par * a).toFixed(1)}px,0)`;
      for (const l of l2s) l.style.transform = t2;
      for (const l of l1s) l.style.transform = t1;
    } else {
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
    if (!Q) {
      if (ready) ball.style.transform = `rotate(${(Math.sin(((now - t0) / 1000) * (2 * Math.PI / 9)) * 1.4).toFixed(3)}deg)`;
      return;
    }
    const prevC = fresh ? -1 : c;
    const fdt = lastFrameNow ? Math.min(.05, Math.max(0, (now - lastFrameNow) / 1000)) : 0; lastFrameNow = now;
    if (prepN < 4) { if (c > 0 || y > 2 || hold || manual) prepN = 4; else if (prepAt && now >= prepAt && now - prepT > 48) { prepN++; prepT = now; dirty = true; } }
    if (!warmed && prepN >= 4) warm(now);
    advance(now);
    if (warmI >= 0) warmStep(now);
    if (phase === 'lift') { liftFrame(now); lastC = -2; return; }
    if (!skyAsk && c >= DUR - 1e-6) skyLoad();
    if (skyA) { const o = c >= DUR - 1e-6 ? PARK : '0';
      if (skyA.style.opacity !== o) { for (const el of [skyA, skyB]) if (el) { el.style.opacity = o; el.style.transform = 'translate3d(0,0,0) scale(1)'; } } }
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
    veil.style.opacity = lit.toFixed(3); veil.style.setProperty('--g', (1 - CAM.E).toFixed(3));
    const plates = mid.complete && mid.naturalWidth > 0 && born.has(mid);
    const park = lit === 0, z = plates ? Math.min(G.zFar, s / G.k1) : s / G.k1;
    far.style.opacity = park ? (prepN >= 0 ? PARK : '0') : lit.toFixed(3);
    far.style.transform = park ? 'translate3d(0,0,0) scale(1)' : `translate3d(${(CAM.ax - G.cam.P.ax * z).toFixed(2)}px,${(CAM.ay - G.cam.P.ay * z).toFixed(2)}px,0) scale(${z.toFixed(5)})`;
    const tone = smooth(1.0 * G.k1, 1.6 * G.k1, s);
    farTone.style.opacity = (.93 * tone).toFixed(3);
    const lm = smooth(.5, 1, E), lo = lerp(1, .82, tone).toFixed(3);
    const kB = lerp(G.lineK.base, 1, lm), kS = lerp(G.lineK.side, 1, lm);
    farLines.base.style.transform = kB > 1.0005 ? `scale(1,${kB.toFixed(4)})` : 'none';
    farLines.mark.style.transform = kS > 1.0005 ? `scale(${kS.toFixed(4)},1)` : 'none';
    farLines.base.style.opacity = farLines.mark.style.opacity = lo;
    for (const el of farLines.side) { el.style.transform = kS > 1.0005 ? `scale(${kS.toFixed(4)},1)` : 'none'; el.style.opacity = lo; }
    const oDet = lit * smooth(.24 * G.SL, .5 * G.SL, s);
    place(mid, Q.court.rect, G.nat.mid, lit * smooth(1.6 * G.k1, 2.7 * G.k1, s), park, now, 1);
    place(det, Q.detail.rect, G.nat.det, oDet, park, now, 2);
    let force = -1;
    if (prevC >= 0 && c > prevC) for (let n = 0; n < Math.min(2, Q.contacts.length); n++) { const tc = F[Q.contacts[n]].t; if (prevC < tc && c >= tc && c - tc < .12) force = Q.contacts[n]; }
    const [a, b, w] = force >= 0 ? [force, force, 0] : frameAt(c), fa = F[a], fb = F[b];
    const bx = lerp(fa.x, fb.x, w), by = lerp(fa.y, fb.y, w), bd = lerp(fa.d, fb.d, w);
    const Dpx = bd * s * Math.exp(Math.log(G.mEnd) * E), k = Dpx / (2 * G.R0), cx = sx(bx), cy = sy(by);
    const swayK = ready ? 1 - smooth(0, .09, c) : 0;
    const sway = swayK > 0 ? Math.sin(((now - t0) / 1000) * (2 * Math.PI / 9)) * 1.4 * swayK : 0;
    ball.style.transform = `translate3d(${(cx - G.c0x).toFixed(2)}px,${(cy - G.c0y).toFixed(2)}px,0) rotate(${sway.toFixed(3)}deg) scale(${k.toFixed(5)})`;
    LB.cx = cx; LB.cy = cy; LB.d = Dpx;
    if (rsh) {
      const o = c >= DUR - 1e-6 && rsh.naturalWidth ? smooth(.7, 1, E) : 0;
      rsh.style.opacity = o.toFixed(3);
      if (o > 0) { const q = Q.track ? RSH.top : RSH.side, sc = Dpx / 100; rsh.style.transform = `translate3d(${(cx + q[0] * Dpx - RSH.w * 50 * sc).toFixed(2)}px,${(cy + q[1] * Dpx - RSH.h * 50 * sc).toFixed(2)}px,0) scale(${sc.toFixed(5)})`; }
    }
    const [pa, pb, pw] = force >= 0 ? [force, force, 0] : pick(c);
    let swT = 0;
    const okA = needA > 0 && loadedA >= needA, okB = needB > 0 && loadedB >= needB;
    if (c > TMARK && okA) { drawnA = drawSet(ctx, A, cv, pa, pb, pw, drawnA); if (drawnA >= 0) swT = smooth(TMARK, TMARK + .05, c); }
    swA = hold || !fdt ? swT : swA + clamp(swT - swA, -fdt / .1, fdt / .1);
    if (swA !== swT) dirty = true;
    cv.style.opacity = (now < warmUntil && swA < +PARK ? +PARK : swA).toFixed(3);
    if (warmUntil && now >= warmUntil) { warmUntil = 0; if (c === 0) { ctx.clearRect(0, 0, cv.width, cv.height); fctx.clearRect(0, 0, fx.width, fx.height); drawnA = drawnB = -1; } }
    else if (warmUntil) dirty = true;
    still.style.opacity = (1 - swA).toFixed(3);
    if (oDet > 0 && okB) drawnB = drawSet(fctx, B, fx, pa, pb, pw, drawnB, BO);
    if (drawnB >= 0 && !fxBorn) fxBorn = park ? -1e9 : now;
    const fxRamp = fxBorn ? clamp((now - fxBorn) / 250) : 0;
    if (fxRamp > 0 && fxRamp < 1) dirty = true;
    place(fx, Q.fx.rect, G.nat.fx, drawnB >= 0 ? oDet * smooth(.02, .12, c) * fxRamp : 0, park, now, 3);
    textFrame(prevC, now, { cx, cy, k, R: Dpx / 2 }, past, lit);
  }
  function intro() { html.classList.remove('go'); void html.offsetWidth; html.classList.add('go'); }
  onChange = (ch) => {
    resetText();
    if (ch.mode) { phase = 'scrub'; swA = 0; cV = 0; }
    measure(); frame(manual ? vnow : performance.now());
    if (ch.text && scrollY < 8) intro();
  };
  addEventListener('resize', () => { if (phase === 'lift') { liftEnd(); phase = 'scrub'; c = 0; cV = 0; pV = 0; eC = 0; eV = 0; } measure(); load(); });
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  measure();
  requestAnimationFrame(tick);
  let began = false;
  const painted = (fn) => {
    let done = false;
    const run = () => { if (done) return; done = true; const w = () => { if (html.classList.contains('ld') && scrollY < 3) return setTimeout(w, 40);
      requestAnimationFrame(() => requestAnimationFrame(fn)); }; w(); };
    try { if (performance.getEntriesByName('first-contentful-paint').length) return run();
      new PerformanceObserver((l, o) => { if (l.getEntriesByName('first-contentful-paint').length) { o.disconnect(); run(); } }).observe({ type: 'paint', buffered: true }); } catch (e) { return run(); }
    setTimeout(run, 700);
  };
  const begin = () => { if (began) return; began = true; measure(); frame(performance.now()); painted(() => {
    try { if (getComputedStyle(h1).visibility === 'visible') html.classList.add('go-now'); } catch (e) {}
    html.classList.add('go'); prepAt = performance.now() + 700; dirty = true; }); };
  const beginSoon = () => { if (html.classList.contains('fw')) return setTimeout(beginSoon, 50); begin(); };
  const refit = () => requestAnimationFrame(() => { if (began) { measure(); frame(manual ? vnow : performance.now()); } else beginSoon(); });
  (D.fonts && D.fonts.ready ? D.fonts.ready : Promise.resolve()).then(refit);
  if (D.fonts && D.fonts.addEventListener) D.fonts.addEventListener('loadingdone', refit);
  setTimeout(beginSoon, 900);
  let started = false;
  const go = () => { if (started || !Q) return;
    if (html.classList.contains('fw')) return void setTimeout(go, 60);
    started = true; load(); };
  Promise.all([fetch(rel(DATA + 'seq.json')).then((r) => r.json()), fetch(rel(DATA + 'pack.json')).then((r) => (r.ok ? r.json() : null)).catch(() => null)]).then(([q, pk]) => {
    Q = q; F = q.frames; DUR = q.duration; TC1 = q.first_contact; TSTOP = q.stop_time; TCAM = Math.min(.46, TC1 * 1.15);
    FXP = pk && pk.fx ? pk.fx : null;
    const h0 = F[0].h, hm = h0 * 2 / 3; TMARK = TC1 * .58;
    for (let i = 1; i < F.length; i++) if (F[i].h <= hm) { const a = F[i - 1], b = F[i]; TMARK = a.t + (b.t - a.t) * (a.h - hm) / (a.h - b.h); IMARK = i; break; }
    measure(); if (ready) go();
  }).catch((e) => { console.error('seq.json не загрузился', e); });
  const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(() => { ready = true; t0 = performance.now(); dirty = true; setTimeout(go, 150); }));
  (still.decode ? still.decode() : Promise.resolve()).then(afterPaint, afterPaint);
  setTimeout(go, 4000);
  if (html.dataset.podem) {
    const box = D.createElement('div'); box.className = 'pd-sw'; box.appendChild(D.createTextNode('Подъём:'));
    for (const n of [1, 2, 3]) { const bt = D.createElement('button'); bt.type = 'button'; bt.textContent = String(n); bt.setAttribute('aria-pressed', String(n === tempo));
      bt.addEventListener('click', () => { tempo = n; for (const x of box.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === bt));
        try { const u = new URL(location.href); u.searchParams.set('podem', String(n)); history.replaceState(null, '', u); } catch (e) {} });
      box.appendChild(bt); }
    stage.appendChild(box);
  }
  window.__top = { V, TEXT, MODE, PT, set, intro, data: DATA, rel: REL, get warmed() { return warmed && warmI < 0; }, bitmaps: BMP, get c() { return c; }, get e() { return eC; }, get seq() { return Q; }, geo: () => G, cam: () => ({ ...CAM }),
    get phase() { return phase; }, get mark() { return { t: TMARK, i: IMARK }; }, get need() { return { a: needA, b: needB }; },
    manual: (on) => { manual = !!on; vnow = performance.now(); lastNow = lastFrameNow = vnow; }, step: (ms) => { vnow += ms; frame(vnow); },
    get loaded() { return loadedA + loadedB; }, get loadedA() { return loadedA; }, get loadedB() { return loadedB; }, get N() { return F.length; },
    at: (p) => Math.round(G.pinTop + clamp(p) * G.pinScroll), hold: (cc, ee) => { hold = cc == null ? null : { c: cc, e: ee || 0 }; dirty = true; },
    introAt: (ms) => { intro(); for (const a of D.getAnimations()) { a.pause(); a.currentTime = ms; } },
    introEnd: () => { for (const a of D.getAnimations()) { try { a.finish(); } catch (e) {} } },
    home: () => { if (!G || !G.cam || !Q) return null; const fr = F[F.length - 1], r = stage.getBoundingClientRect(), end = G.pinTop + G.pinScroll;
      return { x: r.left + scrollX + G.cam.P.ax + (fr.x - G.xT) * G.k1, y: end + G.cam.P.ay - (fr.y - G.yE) * G.k1, d: fr.d * G.k1 * G.mEnd, end }; },
    needBall: () => needBall,
    away: (v) => { if (v == null) return away; v = !!v; if (v !== away) { away = v; awayT = 0; dirty = true; fromBelow = !v; html.classList.toggle('ball-away', away); } return away; },
    rest: () => { const r = stage.getBoundingClientRect(); return { x: r.left + LB.cx, y: r.top + LB.cy, d: LB.d, ok: !!Q && LB.d > 0 && c >= DUR - 1e-6 && eC > .985 && phase !== 'lift' }; },
    lift: () => (phase === 'lift' ? LF.out : null), get p0() { return p0; }, get tempo() { return tempo; }, set tempo(v) { if (LIFT.T[v]) tempo = +v; }, get sky() { return !!SKY; } };
})();
