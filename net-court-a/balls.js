/* ===================================================================
   «Мячи по блокам» — как это устроено:
   для каждого блока сверху вниз:
     1) удар о верхнюю границу блока (линия — жёстко, сетка — ловит);
     2) листаем в раздел — мячи проходят через границу и встают
        у подразделов (места заданы в разметке: data-ball-spot);
     3) листаем дальше — мячи снимаются с мест, падают и бьются
        о границу следующего блока.
   Назад — те же шаги в обратном порядке.
   Мячи живут в координатах страницы (слой #bl едет вместе с текстом),
   расчёт идёт, только пока что-то движется.
   =================================================================== */
(function () {
  'use strict';
  if (/[?&]noballs/.test(location.search)) return; // для замеров: страница без мячей
  const S = window.S2 || {};
  const DOC = document.documentElement;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !mqReduce.matches && DOC.dataset.motion !== 'off';
  const isMob = () => window.innerWidth < 768;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- настройки и пульт ---------- */
  const SIZES = { d: [16, 22, 30], m: [12, 16, 20] };
  const DEF = { d: { size: 1, count: 5, bounce: 'calm' }, m: { size: 1, count: 3, bounce: 'calm' } };
  const BOUNCE = { calm: { e: 0.5, cap: 400, roll: 1 }, live: { e: 0.7, cap: 720, roll: 0.55 } };
  const LSK = 'tlts-nethome-balls-v1';
  let store = { d: Object.assign({}, DEF.d), m: Object.assign({}, DEF.m) };
  try { const raw = JSON.parse(localStorage.getItem(LSK) || 'null'); if (raw && raw.d && raw.m) store = raw; } catch (e) { /* без хранилища */ }
  const saveStore = () => { try { localStorage.setItem(LSK, JSON.stringify(store)); } catch (e) { /* ok */ } };
  const ff = () => (isMob() ? 'm' : 'd');
  const cfg = () => store[ff()];
  const radius = () => SIZES[ff()][cfg().size] / 2;
  const bounce = () => BOUNCE[cfg().bounce] || BOUNCE.calm;
  const N = () => cfg().count;
  const MAXSPOTS = () => (isMob() ? 3 : 5);
  function pl(n, a, b, c) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c); }

  /* ---------- рисунок мяча (из «Сетка ловит»: ворс, шов, мягкая тень, объём) ---------- */
  const spriteCache = new Map();
  function sprites(r) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const key = r + '@' + dpr;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const R = r * dpr, sz = Math.ceil(R * 2 + 2 * dpr), c0 = sz / 2;
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = sz; return c; };
    const body = mk(), g = body.getContext('2d');
    g.save(); g.beginPath(); g.arc(c0, c0, R, 0, 7); g.clip();
    const gr = g.createRadialGradient(c0 - R * 0.25, c0 - R * 0.3, R * 0.1, c0, c0, R * 1.05);
    gr.addColorStop(0, '#EEF77A'); gr.addColorStop(0.55, '#D6E23C'); gr.addColorStop(1, '#AFC21F');
    g.fillStyle = gr; g.fillRect(0, 0, sz, sz);
    let seed = 7; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < R * R * 0.9; i++) { // ворс
      const a = rr() * 6.283, d = Math.sqrt(rr()) * R;
      g.fillStyle = rr() < 0.5 ? 'rgba(255,255,220,.16)' : 'rgba(120,135,20,.14)';
      g.fillRect(c0 + Math.cos(a) * d, c0 + Math.sin(a) * d, Math.max(1, dpr * 0.8), Math.max(1, dpr * 0.8));
    }
    const pts = []; const aa = 1, bb = 0.42, cc = 2 * Math.sqrt(aa * bb);
    const rx = 0.95, ry = 0.5, cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry);
    for (let i = 0; i <= 200; i++) {
      const t = i / 200 * Math.PI * 2;
      let x = aa * Math.cos(t) + bb * Math.cos(3 * t), y = aa * Math.sin(t) - bb * Math.sin(3 * t), z = cc * Math.sin(2 * t);
      const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      const y2 = y * cX - z * sX, z2 = y * sX + z * cX; const x3 = x * cY + z2 * sY, z3 = -x * sY + z2 * cY;
      pts.push([x3, y2, z3]);
    }
    g.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1]; const z = (p[2] + q[2]) / 2; if (z < 0.02) continue;
        g.strokeStyle = pass === 0 ? 'rgba(110,122,18,' + (0.35 * z).toFixed(3) + ')' : 'rgba(250,251,240,' + (0.45 + 0.55 * z).toFixed(3) + ')';
        g.lineWidth = pass === 0 ? R * 0.2 : R * 0.1;
        g.beginPath(); g.moveTo(c0 + p[0] * R * 0.97, c0 + p[1] * R * 0.97); g.lineTo(c0 + q[0] * R * 0.97, c0 + q[1] * R * 0.97); g.stroke();
      }
    }
    g.restore();
    const shade = mk(), h = shade.getContext('2d');
    const hl = h.createRadialGradient(c0 - R * 0.38, c0 - R * 0.42, 0, c0 - R * 0.38, c0 - R * 0.42, R * 0.75);
    hl.addColorStop(0, 'rgba(255,255,235,.55)'); hl.addColorStop(1, 'rgba(255,255,235,0)');
    h.fillStyle = hl; h.beginPath(); h.arc(c0, c0, R, 0, 7); h.fill();
    const rim = h.createRadialGradient(c0 - R * 0.2, c0 - R * 0.25, R * 0.55, c0, c0, R * 1.02);
    rim.addColorStop(0, 'rgba(60,70,10,0)'); rim.addColorStop(1, 'rgba(60,70,10,.42)');
    h.fillStyle = rim; h.beginPath(); h.arc(c0, c0, R, 0, 7); h.fill();
    h.strokeStyle = 'rgba(22,25,29,.55)'; h.lineWidth = Math.max(1, dpr * 0.8); h.beginPath(); h.arc(c0, c0, R - h.lineWidth / 2, 0, 7); h.stroke();
    const shw = document.createElement('canvas'); shw.width = Math.ceil(R * 3); shw.height = Math.ceil(R * 1.4);
    const s = shw.getContext('2d'); s.filter = 'blur(' + Math.max(1.5, R * 0.18) + 'px)';
    s.fillStyle = 'rgba(22,25,29,.30)'; s.beginPath(); s.ellipse(shw.width / 2, shw.height / 2, R * 0.95, R * 0.3, 0, 0, 7); s.fill();
    const out = { body: 'url(' + body.toDataURL() + ')', shade: 'url(' + shade.toDataURL() + ')', shw: 'url(' + shw.toDataURL() + ')', box: sz / dpr, sw: shw.width / dpr, shh: shw.height / dpr };
    spriteCache.set(key, out);
    return out;
  }

  /* ---------- слой ---------- */
  const layer = document.createElement('div'); layer.id = 'bl'; layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- замер текста: прямоугольники букв и «запретных» блоков ---------- */
  function collectText(sy) {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || p.closest('#bl,.bp,script,style,noscript,.vh,[hidden],.hdr,.tabbar')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const rg = document.createRange(); let n;
    while ((n = w.nextNode())) {
      rg.selectNodeContents(n);
      const rs = rg.getClientRects();
      for (let i = 0; i < rs.length; i++) { const q = rs[i]; if (q.width < 1 || q.height < 1) continue; out.push([q.left, q.top + sy, q.right, q.bottom + sy]); }
    }
    return out;
  }
  function collectAvoid(sy) {
    const out = [];
    document.querySelectorAll('main img, main canvas, main input, .kp-stage, .kp-glow, .net-stage, .fin-trophy, [data-ball-avoid]').forEach((el) => {
      if (el.closest('#top')) return;
      const q = el.getBoundingClientRect(); if (q.width < 2 || q.height < 2) return;
      out.push([q.left, q.top + sy, q.right, q.bottom + sy]);
    });
    return out;
  }
  const hits = (a, list, pad) => { for (let i = 0; i < list.length; i++) { const b = list[i]; if (a[0] < b[2] + pad && a[2] > b[0] - pad && a[1] < b[3] + pad && a[3] > b[1] - pad) return true; } return false; };

  /* ---------- места посадки из разметки ---------- */
  // data-ball-spot / -d / -m = "режим[:доли]|запасной режим"; режимы: top, top-r, after, right, before
  function lastLine(el, sy) {
    const rg = document.createRange(); rg.selectNodeContents(el);
    const rs = Array.from(rg.getClientRects()).filter((q) => q.width > 2 && q.height > 4);
    if (!rs.length) return null;
    let best = rs[0];
    rs.forEach((q) => { if (q.bottom > best.bottom + 2 || (Math.abs(q.bottom - best.bottom) <= 2 && q.right > best.right)) best = q; });
    return { left: best.left, right: best.right, top: best.top + sy, bottom: best.bottom + sy, h: best.height };
  }
  function findSpots(sec, mob, r, txt, avoid, sy, vw, taken) {
    const out = [];
    const sr = sec.getBoundingClientRect(), sTop = sr.top + sy, sBot = sr.bottom + sy;
    const els = sec.querySelectorAll('[data-ball-spot],[data-ball-spot-d],[data-ball-spot-m]');
    const step = Math.max(4, r * 0.7);
    els.forEach((el) => {
      const spec = (mob ? el.dataset.ballSpotM : el.dataset.ballSpotD) ?? el.dataset.ballSpot;
      if (!spec || spec === '-') return;
      const q = el.getBoundingClientRect(); if (q.width < 1 && q.height < 1) return;
      const E = { left: q.left, right: q.right, top: q.top + sy, bottom: q.bottom + sy, w: q.width, h: q.height };
      const alts = spec.split('|').map((a) => { const [m, f] = a.trim().split(':'); return { m, f: f ? f.trim().split(/\s+/).map(Number) : null }; });
      const fracs = alts[0].f || [null];
      fracs.forEach((frac) => {
        let got = null;
        for (const alt of alts) {
          const f = alt.f ? frac : null;
          let x0, fy, dir, center = false;
          if (alt.m === 'top' || alt.m === 'top-r') {
            fy = E.top - 1;
            if (f != null) { x0 = E.left + E.w * f; center = true; dir = 1; }
            else if (alt.m === 'top') { x0 = E.left + r + 10; dir = 1; } else { x0 = E.right - r - 10; dir = -1; }
          } else if (alt.m === 'after') {
            const L = lastLine(el, sy); if (!L) continue;
            x0 = L.right + r + 10; fy = L.bottom - L.h * 0.2; dir = 1;
          } else if (alt.m === 'right') {
            x0 = E.right + r + 10; fy = E.top + E.h * 0.5 + r; dir = 1;
          } else if (alt.m === 'before') {
            x0 = E.left - r - 10; fy = E.bottom - E.h * 0.25; dir = -1;
          } else continue;
          for (let k = 0; k < 26 && !got; k++) {
            const off = center ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step : dir * k * step;
            const x = x0 + off, cy = fy - r;
            if (x - r < 3 || x + r > vw - 3) continue;
            if (cy - r < sTop + 6 || cy + r > sBot - 4) continue;
            const box = [x - r, cy - r, x + r, cy + r];
            if (hits(box, txt, 3) || hits(box, avoid, 0) || hits(box, taken, 4)) continue;
            got = { x, y: cy, fy, el };
            taken.push(box);
          }
          if (got) break;
        }
        if (got) out.push(got);
      });
    });
    return out.slice(0, MAXSPOTS());
  }

  /* ---------- коридор первого экрана: мячи выходят из 3D-сетки, не задевая текст ---------- */
  function heroLane(sy, r, vw, txt) {
    const panel = document.querySelector('.hero-panel'), hv = document.getElementById('hero-vis');
    if (!panel || !hv) return null;
    const pr = panel.getBoundingClientRect(), vr = hv.getBoundingClientRect();
    const y0 = pr.top + sy, y1 = pr.bottom + sy;
    const occ = txt.filter((t) => t[3] > y0 && t[1] < y1).map((t) => [t[0] - 6, t[2] + 6]).sort((a, b) => a[0] - b[0]);
    const free = []; let x = 2;
    occ.forEach((o) => { if (o[0] > x) free.push([x, o[0]]); x = Math.max(x, o[1]); });
    if (vw - 2 > x) free.push([x, vw - 2]);
    const want = isMob() ? vw : vw * 0.45;
    const ok = free.filter((f) => f[1] - f[0] >= 2 * r + 2);
    if (!ok.length) return null;
    ok.sort((a, b) => Math.abs((a[0] + a[1]) / 2 - want) - Math.abs((b[0] + b[1]) / 2 - want));
    const f = ok[0], cx = (f[0] + f[1]) / 2;
    // буквы заголовка над коридором: мяч появляется ниже них
    let topText = vr.top + sy + 20;
    txt.forEach((t) => { if (t[0] < cx + r + 4 && t[2] > cx - r - 4 && t[3] < y0 && t[3] > vr.top + sy) topText = Math.max(topText, t[3] + r + 6); });
    return { x0: f[0], x1: f[1], cx, yBot: y1, yTop: topText, visTop: vr.top + sy, visBot: vr.bottom + sy };
  }

  /* ---------- граница: линия или сетка (струна из узлов) ---------- */
  function makeEdge(kind, y, x0, x1, vw, dark, mob, r) {
    const hx = mob ? 14 : 20, n = Math.max(8, Math.round((x1 - x0) / hx));
    const e = {
      kind, y, x0, x1, vw, dark, n, hx: (x1 - x0) / n,
      w: new Float32Array(n + 1), v: new Float32Array(n + 1), active: false, dirty: true,
      band: mob ? 14 : 18, nest: kind === 'net' ? r * 0.55 : 0
    };
    if (kind === 'net') { e.c2 = (mob ? 700 : 900) ** 2 / (e.hx * e.hx); e.k0 = 80; e.damp = 12; e.lo = -10; e.hi = mob ? 20 : 26; }
    else { e.c2 = (mob ? 1800 : 2400) ** 2 / (e.hx * e.hx); e.k0 = 900; e.damp = 34; e.lo = -5; e.hi = 5; }
    return e;
  }
  function wAt(e, x) {
    if (x <= e.x0 || x >= e.x1) return 0;
    const f = (x - e.x0) / e.hx, k = Math.floor(f), t = f - k;
    return e.w[k] * (1 - t) + e.w[Math.min(e.n, k + 1)] * t;
  }
  function vAt(e, x) {
    if (x <= e.x0 || x >= e.x1) return 0;
    const f = (x - e.x0) / e.hx, k = Math.floor(f), t = f - k;
    return e.v[k] * (1 - t) + e.v[Math.min(e.n, k + 1)] * t;
  }
  function kick(e, x, amt) {
    if (!e || x <= e.x0 || x >= e.x1) return;
    const f = (x - e.x0) / e.hx, k = Math.floor(f), t = f - k;
    if (k > 0 && k < e.n) e.v[k] += amt * (1 - t);
    if (k + 1 > 0 && k + 1 < e.n) e.v[k + 1] += amt * t;
    e.active = true; e.dirty = true;
  }
  function stepEdge(e, h) {
    const n = e.n, w = e.w, v = e.v;
    const dm = e.calm ? e.damp * 2.2 : e.damp;
    for (let i = 1; i < n; i++) v[i] += (e.c2 * (w[i - 1] - 2 * w[i] + w[i + 1]) - e.k0 * w[i] - dm * v[i]) * h;
    for (let i = 1; i < n; i++) w[i] = clamp(w[i] + v[i] * h, e.lo, e.hi);
    e.dirty = true;
  }
  const surfY = (e, x) => e.y + e.nest + wAt(e, x) - (e.kind === 'line' ? 0.75 : 0);
  const restY = (e, x, r) => surfY(e, x) - r;

  /* ---------- геометрия страницы ---------- */
  let G = null, balls = [], cur = 0;
  function build() {
    const mob = isMob(), vw = DOC.clientWidth, vh = window.innerHeight, sy = S.pageSY ? S.pageSY() : window.scrollY, r = radius(); // court-a: координаты «после перехода»
    const txt = collectText(sy), avoid = collectAvoid(sy);
    const secs = Array.from(document.querySelectorAll('[data-ball-edge]'));
    if (!secs.length) return null;
    const blocks = [], taken = [];
    secs.forEach((sec) => {
      const q = sec.getBoundingClientRect(), y = q.top + sy;
      const inn = sec.querySelector('.ch-in, .wrap') || sec, iq = inn.getBoundingClientRect(), cs = getComputedStyle(inn);
      const x0 = iq.left + parseFloat(cs.paddingLeft), x1 = iq.right - parseFloat(cs.paddingRight);
      const end = sec.hasAttribute('data-ball-end');
      const edge = makeEdge(sec.dataset.ballEdge === 'net' ? 'net' : 'line', y, x0, x1, vw, sec.classList.contains('dark'), mob, r);
      const spots = end ? [] : findSpots(sec, mob, r, txt, avoid, sy, vw, taken);
      blocks.push({ id: sec.id || 'foot', el: sec, edge, spots, end, name: sec.dataset.ballName || '', top: y, bot: q.bottom + sy });
    });
    const lane = heroLane(sy, r, vw, txt);
    // станции: 0 — первый экран; дальше у каждого блока «граница», потом «места»
    const st = [{ t: 'hero' }];
    blocks.forEach((b, i) => { st.push({ t: 'edge', b: i }); if (b.spots.length) st.push({ t: 'spots', b: i }); });
    const hdr = (document.getElementById('hdr') || { offsetHeight: 64 }).offsetHeight;
    const tab = mob ? 60 : 0, use = vh - hdr - tab;
    const docH = DOC.scrollHeight, maxS = Math.max(1, docH - vh);
    const th = st.map((s, j) => {
      if (j === 0) return -Infinity;
      if (j === 1) return S.heroEdgeTh ? S.heroEdgeTh() : 16; // court-a: мячи выходят, когда сетка легла
      const e = blocks[s.b].edge;
      return e.y - hdr - use * (s.t === 'edge' ? 0.74 : 0.42);
    });
    for (let j = 2; j < th.length; j++) th[j] = Math.max(th[j], th[j - 1] + 70);
    for (let j = th.length - 1; j >= 2; j--) th[j] = Math.min(th[j], maxS - (th.length - 1 - j) * 50 - 4, j + 1 < th.length ? th[j + 1] - 40 : Infinity);
    for (let j = 2; j < th.length; j++) th[j] = Math.max(th[j], 17 + j);
    layer.style.height = Math.ceil(docH) + 'px';
    return { mob, vw, vh, r, blocks, st, th, lane, docH, hdr, sig: sigOf(blocks, r, vw) };
  }
  const sigOf = (blocks, r, vw) => vw + '|' + r + '|' + blocks.map((b) => Math.round(b.edge.y) + ':' + b.spots.map((s) => Math.round(s.x) + ',' + Math.round(s.y)).join(';')).join('/');

  /* ---------- сколько мячей на каждой станции ---------- */
  const cSpots = (bi) => Math.min(G.blocks[bi].spots.length, N());
  function countAt(j) {
    const s = G.st[j];
    if (s.t === 'hero') return 0;
    if (s.t === 'spots') return cSpots(s.b);
    for (let k = s.b - 1; k >= 0; k--) if (G.blocks[k].spots.length) return cSpots(k);
    return N();
  }

  /* ---------- мячи ---------- */
  let pool = [];
  function makeBall() {
    let b = pool.pop();
    if (!b) {
      const el = document.createElement('div'); el.className = 'bl-ball';
      const rot = document.createElement('i'); rot.className = 'r';
      const lit = document.createElement('i'); lit.className = 'l';
      el.appendChild(rot); el.appendChild(lit);
      const sh = document.createElement('div'); sh.className = 'bl-sh';
      b = { el, rot, lit, sh };
    }
    const r = G.r, sp = sprites(r);
    b.el.style.width = b.el.style.height = sp.box + 'px';
    b.rot.style.backgroundImage = sp.body; b.lit.style.backgroundImage = sp.shade;
    b.sh.style.backgroundImage = sp.shw; b.sh.style.width = sp.sw + 'px'; b.sh.style.height = sp.shh + 'px';
    b.box = sp.box; b.sw = sp.sw; b.shh = sp.shh;
    layer.appendChild(b.sh); layer.appendChild(b.el);
    Object.assign(b, { x: 0, y: 0, vx: 0, vy: 0, r, a: Math.random() * 6.28, w: 0, s: 1, sT: 1, op: 1, mode: 'rest', tgt: null, delay: 0, still: 0,
      armed: true, lane: false, exitVx: 0, dieOnRest: false, dieT: 0, wp: null, last: '', lastR: '', lastS: '', shOn: false, py: 0, contact: false, hitN: 0 });
    b.el.style.opacity = ''; b.el.style.visibility = '';
    balls.push(b);
    return b;
  }
  function killBall(b) { b.mode = 'dead'; b.el.remove(); b.sh.remove(); b.shOn = false; b.last = ''; b.lastR = ''; pool.push(b); }
  const alive = () => balls.filter((b) => b.mode !== 'dead' && b.mode !== 'die');
  const visibleY = (y) => y > window.scrollY - 60 && y < window.scrollY + window.innerHeight + 60;

  function restPose(b) {
    if (!b.tgt) return;
    if (b.tgt.p) { b.x = b.tgt.p.x; b.y = b.tgt.p.y; }
    else { const e = b.tgt.e; b.x = clamp(b.x, e.x0 + b.r + 2, e.x1 - b.r - 2); b.y = restY(e, b.x, b.r); }
  }
  function sleep(b) { b.mode = 'rest'; b.vx = b.vy = 0; b.w = 0; b.still = 0; restPose(b); if (b.dieOnRest) startDie(b); }
  function startDie(b) { b.mode = 'die'; b.dieT = 0; b.y0 = b.y; if (b.tgt && b.tgt.e) kick(b.tgt.e, b.x, b.tgt.e.kind === 'net' ? 160 : 40); }

  /* ---------- сопоставление мячей и мест по порядку слева направо ---------- */
  function matchOrdered(A, B) { // A.length >= B.length; возвращает для каждого B индекс в A
    const n = A.length, m = B.length, INF = 1e18;
    const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF));
    const ch = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
    for (let i = 0; i <= n; i++) dp[i][0] = 0;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= Math.min(i, m); j++) {
      const skip = dp[i - 1][j], take = dp[i - 1][j - 1] + Math.abs(A[i - 1] - B[j - 1]);
      if (take <= skip) { dp[i][j] = take; ch[i][j] = 1; } else { dp[i][j] = skip; ch[i][j] = 0; }
    }
    const res = new Array(m); let i = n, j = m;
    while (j > 0) { if (ch[i][j]) { res[j - 1] = i - 1; j--; } i--; }
    return res;
  }

  /* ---------- броски ---------- */
  const grav = () => (G.mob ? 2000 : 2400);
  function throwDown(b, tx, ty, vy0) { // падение в точку ниже
    const g = grav(), H = ty - b.y;
    if (H < 4) { tossTo(b, tx, ty, 30); return; }
    const t = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * H)) / g;
    b.vy = vy0; b.vx = (tx - b.x) / Math.max(0.08, t);
  }
  function tossTo(b, tx, ty, lift) { // бросок по дуге: вершина выше и старта, и цели
    const g = grav(), apex = Math.min(b.y, ty) - lift;
    const vy0 = -Math.sqrt(2 * g * Math.max(4, b.y - apex));
    const t = -vy0 / g + Math.sqrt(2 * Math.max(1, ty - apex) / g);
    b.vy = vy0; b.vx = (tx - b.x) / t;
  }
  function fly(b, tgt, armed) { b.mode = 'fly'; b.tgt = tgt; b.armed = armed; b.still = 0; b.contact = false; b.hitN = 0; }

  /* ---------- переходы между станциями ---------- */
  function spawnFromHero() { // [корт-2] мячи прилетают сверху, от края экрана, в упавшую сетку — в разных местах по ширине
    // [корт-3] в покое в сетке столько мячей, сколько выбрано (как при мгновенной расстановке);
    // лишние летят для красоты и гаснут в сетке (dieOnRest), а не пропадают на следующем шаге
    const e = G.blocks[0].edge, r = G.r, keep = countAt(1), n = Math.max(keep, G.mob ? 4 : 5);
    const top = (S.pageSY ? S.pageSY() : window.scrollY) + G.hdr - 2 * r - 4;                // из-под шапки: верхний край видимой страницы
    const H = Math.max(0, e.y - top);
    const vy0 = H > 420 ? 260 : 0;                                  // полёт виден ≥ 0,35 с
    const order = n === 4 ? [1, 3, 0, 2] : [2, 0, 4, 1, 3, 5, 7, 6].filter((i) => i < n);
    const w = e.x1 - e.x0 - 4 * r;
    let d = 0;
    order.forEach((slot, k) => {
      const b = makeBall();
      b.x = e.x0 + 2 * r + w * ((slot + 0.5) / n) + rnd(-0.18, 0.18) * w / n;
      b.y = top - (vy0 ? 0 : Math.max(0, 300 - H)); b.vx = rnd(-25, 25); b.vy = vy0 * rnd(0.9, 1.1);
      b.s = 1; b.sT = 1; b.delay = d; d += rnd(0.08, 0.15); b.lane = false; b.a = rnd(0, 6);
      fly(b, { e }, true); b.dieOnRest = k >= keep;
    });
  }
  function dropToSpots(bi) {
    const B = G.blocks[bi], e = B.edge, c = cSpots(bi), spots = B.spots.slice(0, c).sort((p, q) => p.x - q.x);
    const have = alive().filter((b) => b.tgt && b.tgt.e === e).sort((p, q) => p.x - q.x);
    let pairs = [];
    if (have.length >= c) {
      const idx = matchOrdered(have.map((b) => b.x), spots.map((s) => s.x));
      const used = new Set(idx);
      have.forEach((b, i) => { if (!used.has(i)) { if (b.mode === 'fly') b.dieOnRest = true; else startDie(b); } });
      pairs = idx.map((i, j) => [have[i], spots[j]]);
    } else {
      const idx = matchOrdered(spots.map((s) => s.x), have.map((b) => b.x)); // какие места займут имеющиеся
      const used = new Set(idx);
      have.forEach((b, j) => pairs.push([b, spots[idx[j]]]));
      let m = 0;
      spots.forEach((s, i) => {
        if (used.has(i)) return;
        const b = makeBall(); b.x = clamp(s.x, e.x0 + G.r, e.x1 - G.r); b.y = e.y + G.r * 0.4; b.s = 0.3; b.sT = 1; b.delay = 0.18 + m * 0.14; m++;
        kick(e, b.x, e.kind === 'net' ? 220 : 60);
        pairs.push([b, s]);
      });
    }
    pairs.forEach(([b, s], k) => {
      b.dieOnRest = false; b.lane = false;
      if (b.mode === 'die') return;
      if (!b.delay) b.delay = k * 0.05;
      fly(b, { p: s }, true);
      throwDown(b, s.x, s.y, e.kind === 'net' ? 30 : 70);
      kick(e, b.x, e.kind === 'net' ? 260 : 70);
    });
  }
  function fallToEdge(bi) {
    const e = G.blocks[bi].edge;
    alive().forEach((b, k) => {
      if (b.mode === 'pull') return;
      const g = grav(), H = Math.max(0, restY(e, b.x, b.r) - b.y), t = Math.sqrt(2 * H / g) + 0.08;
      let dir = Math.random() < 0.5 ? -1 : 1, vx = rnd(90, 170);
      if (b.x + dir * vx * t > e.x1 - 3 * b.r || b.x + dir * vx * t < e.x0 + 3 * b.r) dir = -dir;
      b.lane = false; b.dieOnRest = false;
      fly(b, { e }, b.y + b.r <= surfY(e, b.x) + 1);
      b.vx = dir * vx; b.vy = -rnd(40, 70); b.delay = k * 0.05;
    });
  }
  function tossToEdge(bi) { // назад: с мест вверх через границу и на неё
    const e = G.blocks[bi].edge, need = countAt(stIndex('edge', bi));
    const have = alive().filter((b) => b.mode !== 'pull');
    have.forEach((b, k) => {
      const lx = clamp(b.x + rnd(-30, 30), e.x0 + 2 * b.r, e.x1 - 2 * b.r);
      fly(b, { e }, false); b.lane = false; b.dieOnRest = k >= need;
      tossTo(b, lx, restY(e, lx, b.r), rnd(40, 75)); b.delay = k * 0.05;
    });
    for (let k = have.length; k < need; k++) { // граница выпускает недостающие
      const b = makeBall(); const lx = e.x0 + (e.x1 - e.x0) * ((k + 0.5) / need);
      b.x = lx; b.y = e.y + b.r * 0.5; b.s = 0.3; b.sT = 1; b.delay = 0.25 + (k - have.length) * 0.12;
      fly(b, { e }, false); tossTo(b, lx + rnd(-20, 20), restY(e, lx, b.r), 34);
      kick(e, lx, e.kind === 'net' ? -160 : -40);
    }
  }
  function tossToSpots(bi) { // назад: с границы следующего блока вверх на места этого блока
    const B = G.blocks[bi], c = cSpots(bi), spots = B.spots.slice(0, c).sort((p, q) => p.x - q.x);
    const have = alive().filter((b) => b.mode !== 'pull').sort((p, q) => p.x - q.x);
    let pairs = [];
    if (have.length >= c) {
      const idx = matchOrdered(have.map((b) => b.x), spots.map((s) => s.x)), used = new Set(idx);
      have.forEach((b, i) => { if (!used.has(i)) startDie(b); });
      pairs = idx.map((i, j) => [have[i], spots[j]]);
    } else {
      const idx = matchOrdered(spots.map((s) => s.x), have.map((b) => b.x)), used = new Set(idx);
      have.forEach((b, j) => pairs.push([b, spots[idx[j]]]));
      const src = G.blocks[bi + 1] ? G.blocks[bi + 1].edge : null;
      spots.forEach((s, i) => { if (used.has(i)) return; const b = makeBall(); b.x = clamp(s.x, 4, G.vw - 4); b.y = src ? restY(src, b.x, b.r) : s.y + 60; b.s = 0.3; b.sT = 1; b.delay = 0.15; pairs.push([b, s]); });
    }
    pairs.forEach(([b, s], k) => {
      if (b.mode === 'die') return;
      fly(b, { p: s }, false); b.dieOnRest = false; b.lane = false;
      tossTo(b, s.x, s.y, rnd(36, 60)); b.delay = Math.max(b.delay, k * 0.05);
    });
  }
  function pullToHero() { // [корт-2] назад: мячи уходят из сетки вверх за край экрана
    const e = G.blocks[0].edge, top = (S.pageSY ? S.pageSY() : window.scrollY) + G.hdr - 3 * G.r - 30;
    alive().forEach((b, k) => {
      b.mode = 'pull'; b.tgt = null; b.delay = k * 0.05; b.lane = false;
      b.wp = [[b.x, e.y - b.r - 24], [b.x + rnd(-24, 24), top]];
    });
  }
  function stIndex(t, bi) { return G.st.findIndex((s) => s.t === t && s.b === bi); }

  function forward(j) { // j → j+1
    const s = G.st[j + 1];
    if (s.t === 'edge' && s.b === 0) spawnFromHero();
    else if (s.t === 'spots') dropToSpots(s.b);
    else if (s.t === 'edge') fallToEdge(s.b);
  }
  function backward(j) { // j → j-1
    const s = G.st[j], p = G.st[j - 1];
    if (p.t === 'hero') pullToHero();
    else if (s.t === 'spots') tossToEdge(s.b);
    else if (s.t === 'edge' && p.t === 'spots') tossToSpots(p.b);
    else if (s.t === 'edge' && p.t === 'edge') { // блок без мест: прыжок с границы на границу
      const e = G.blocks[p.b].edge; alive().forEach((b) => { fly(b, { e }, false); tossTo(b, b.x, restY(e, b.x, b.r), 50); });
    }
  }

  /* ---------- мгновенно правильное состояние (быстрая прокрутка, меню, старт) ---------- */
  function poseFor(j) {
    const s = G.st[j], c = countAt(j);
    if (s.t === 'hero' || !c) return [];
    const B = G.blocks[s.b];
    if (s.t === 'spots') return B.spots.slice(0, c).map((p) => ({ x: p.x, y: p.y, tgt: { p } }));
    const e = B.edge;
    const ref = B.spots.length >= c ? B.spots.slice(0, c).map((p) => p.x).sort((a, b) => a - b) : null;
    const out = [];
    for (let k = 0; k < c; k++) {
      let x = ref ? ref[k] : e.x0 + (e.x1 - e.x0) * ((k + 0.5) / c);
      x = clamp(x, e.x0 + 2 * G.r, e.x1 - 2 * G.r);
      out.push({ x, y: 0, tgt: { e } });
    }
    return out;
  }
  function snap(j) {
    cur = j;
    const pose = poseFor(j).sort((p, q) => p.x - q.x);
    balls.slice().forEach((b) => { if (b.mode === 'die' || b.mode === 'pull') killBall(b); });
    balls = balls.filter((b) => b.mode !== 'dead');
    const have = balls.slice().sort((p, q) => p.x - q.x);
    while (have.length > pose.length) killBall(have.pop());
    balls = balls.filter((b) => b.mode !== 'dead');
    G.blocks.forEach((B) => { B.edge.w.fill(0); B.edge.v.fill(0); B.edge.active = false; B.edge.dirty = true; });
    pose.forEach((p, k) => {
      const b = have[k] || makeBall();
      b.tgt = p.tgt; b.x = p.x; b.y = p.y; b.delay = 0; b.s = b.sT = 1; b.lane = false; b.dieOnRest = false; b.armed = true;
      if (p.tgt.e) { const e = p.tgt.e; if (e.kind === 'net') sagUnder(e, b.x); }
      sleep(b);
    });
    G.blocks.forEach((B) => { if (B.edge.kind === 'net') balls.forEach((b) => { if (b.tgt && b.tgt.e === B.edge) b.y = restY(B.edge, b.x, b.r); }); });
    updNow();
  }
  function sagUnder(e, x) { // статический прогиб сетки под лежащим мячом
    for (let i = 1; i < e.n; i++) { const d = (e.x0 + i * e.hx - x) / (G.mob ? 30 : 42); e.w[i] = Math.min(e.hi, e.w[i] + (G.mob ? 4 : 5) * Math.exp(-d * d)); }
    e.dirty = true;
  }

  /* ---------- позиция прокрутки → станция ---------- */
  const HYST = 40;
  function targetSt() {
    const sy = window.scrollY, th = G.th, n = th.length;
    let c = cur;
    while (c < n - 1 && sy >= th[c + 1]) c++;
    while (c > 0 && sy < th[c] - (c === 1 ? 10 : HYST)) c--;
    return c;
  }

  /* ---------- физика ---------- */
  function simulate(dt) {
    const g = grav(), B = bounce(), e0 = B.e, cap = B.cap;
    // задержки, рост, гаснущие мячи, подъём в сетку первого экрана
    balls.forEach((b) => {
      if (b.mode === 'dead') return;
      if (b.delay > 0) { b.delay -= dt; if (b.delay < 0) b.delay = 0; }
      if (b.delay > 0) return;
      if (b.s !== b.sT) b.s = b.s < b.sT ? Math.min(b.sT, b.s + dt * 2.8) : Math.max(b.sT, b.s - dt * 2.8);
      if (b.mode === 'die') {
        b.dieT += dt; const q = Math.min(1, b.dieT / 0.55), k = q * q * (3 - 2 * q);
        const net = b.tgt && b.tgt.e && b.tgt.e.kind === 'net';
        b.y = b.y0 + (net ? b.r * 1.1 : b.r * 0.2) * k; b.s = 1 - 0.8 * k; b.op = 1 - k;
        if (q >= 1) killBall(b);
      }
      if (b.mode === 'pull') {
        const p = b.wp[0], kx = 130, c = 21;
        b.vx += (kx * (p[0] - b.x) - c * b.vx) * dt; b.vy += (kx * (p[1] - b.y) - c * b.vy) * dt;
        const sp = Math.hypot(b.vx, b.vy); if (sp > 2200) { b.vx *= 2200 / sp; b.vy *= 2200 / sp; }
        b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.vx / b.r * dt;
        if (Math.hypot(p[0] - b.x, p[1] - b.y) < 10) {
          b.wp.shift();
          if (!b.wp.length) { b.mode = 'die'; b.dieT = 0; b.y0 = b.y; b.tgt = null; if (S.netPoke) S.netPoke(b.x - window.scrollX, b.y - window.scrollY, 0.6); }
        }
      }
    });
    balls = balls.filter((b) => b.mode !== 'dead');
    const movers = balls.filter((b) => b.mode === 'fly' && b.delay <= 0);
    const edges = G.blocks.map((x) => x.edge).filter((e) => e.active);
    const maxV = movers.reduce((m, b) => Math.max(m, Math.abs(b.vx) + Math.abs(b.vy)), 0);
    const sub = clamp(Math.ceil(maxV * dt / (G.r * 0.5)), 4, 14), h = dt / sub;
    const allE = G.blocks.map((x) => x.edge);
    movers.forEach((b) => { b.fx = b.x; b.fy = b.y; });
    edges.forEach((e) => { e.calm = !balls.some((b) => b.mode === 'fly' && b.tgt && b.tgt.e === e); });
    const sitters = balls.filter((b) => b.mode === 'rest' && b.tgt && b.tgt.e && b.tgt.e.kind === 'net' && b.tgt.e.active);
    for (let s = 0; s < sub; s++) {
      sitters.forEach((b) => kick(b.tgt.e, b.x, g * h * 0.55)); // лежащий мяч продолжает давить на сетку
      edges.forEach((e) => stepEdge(e, h));
      for (const b of movers) {
        if (b.mode !== 'fly') continue;
        const py = b.y;
        b.vy += g * h; b.x += b.vx * h; b.y += b.vy * h;
        // коридор первого экрана
        if (b.lane && G.lane) {
          const L = G.lane;
          if (b.y + b.r < L.yBot) {
            if (b.x < L.x0 + b.r) { b.x = L.x0 + b.r; b.vx = Math.abs(b.vx) * 0.3; }
            if (b.x > L.x1 - b.r) { b.x = L.x1 - b.r; b.vx = -Math.abs(b.vx) * 0.3; }
          } else { b.lane = false; b.vx = b.exitVx; }
        }
        // пролёт сквозь границы: граница вздрагивает
        for (const e of allE) {
          if ((py < e.y && b.y >= e.y) || (py > e.y && b.y <= e.y)) {
            if (b.tgt && b.tgt.e === e) continue;
            kick(e, b.x, (b.y > py ? 1 : -1) * (e.kind === 'net' ? 120 : 40));
          }
        }
        b.contact = false;
        const T = b.tgt;
        if (T && T.e) {
          const e = T.e, sf = surfY(e, b.x);
          if (!b.armed && b.y + b.r <= sf + 1 && b.vy > -40) b.armed = true;
          if (!b.armed && b.y + b.r <= sf - 2) b.armed = true;
          if (b.armed) {
            const pen = b.y + b.r - sf;
            if (e.kind === 'line') {
              if (pen > 0) {
                b.y -= pen; b.contact = true;
                if (b.vy > 80) {
                  kick(e, b.x, Math.min(260, b.vy * 0.16));
                  b.vy = -Math.min(e0 * b.vy, cap * Math.pow(0.45, b.hitN)); b.hitN++; b.vx *= 0.9;
                } else if (b.vy > 0) b.vy = 0;
              }
            } else if (pen > 0) { // сетка: мягкий упор, сетка проседает и пружинит
              const rel = b.vy - vAt(e, b.x), F = Math.max(0, 9000 * pen + 110 * rel);
              b.vy -= F * h; kick(e, b.x, F * h * 0.55); b.contact = true;
              if (b.vy < -cap * 0.9) b.vy = -cap * 0.9;
            }
            if (b.contact || pen > -1.5) {
              const roll = (e.kind === 'net' ? 300 : 150) + (e.kind === 'net' ? 6 : 2.6) * Math.abs(b.vx);
              const dec = Math.min(Math.abs(b.vx), roll * B.roll * h); b.vx -= Math.sign(b.vx) * dec; b.w = b.vx / b.r;
            }
            if (b.x < e.x0 + b.r) { b.x = e.x0 + b.r; b.vx = Math.abs(b.vx) * 0.4; }
            if (b.x > e.x1 - b.r) { b.x = e.x1 - b.r; b.vx = -Math.abs(b.vx) * 0.4; }
          }
        } else if (T && T.p) {
          const p = T.p;
          if (!b.armed && b.y + b.r <= p.fy - 1) b.armed = true;
          if (b.vy > 0 && b.y > p.y - 4 * b.r) { const k = Math.min(1, 12 * h); b.x += (p.x - b.x) * k; b.vx *= 1 - k; }
          if (b.y > p.y + 4 * b.r && b.vy > 0) { b.x = p.x; b.y = p.y - 2.5 * b.r; b.vx = 0; b.vy = 0; } // промах: мяч ловит своё место
          if (b.armed && b.y + b.r > p.fy && Math.abs(b.x - p.x) < 3 * b.r) {
            b.y = p.fy - b.r; b.contact = true;
            if (b.vy > 70) { b.vy = -Math.min(e0 * b.vy, cap * 0.55 * Math.pow(0.5, b.hitN)); b.hitN++; b.vx *= 0.25; } else if (b.vy > 0) b.vy = 0;
            b.vx += (90 * (p.x - b.x) - 18 * b.vx) * h * 6; b.w = b.vx / b.r;
          }
        }
        if (b.x < b.r + 1) { b.x = b.r + 1; b.vx = Math.abs(b.vx) * 0.4; }
        if (b.x > G.vw - b.r - 1) { b.x = G.vw - b.r - 1; b.vx = -Math.abs(b.vx) * 0.4; }
        if (!b.contact) b.w *= 1 - 0.5 * h;
        b.a += b.w * h;
      }
      // мячи на одной границе толкают друг друга
      for (let i = 0; i < movers.length; i++) {
        const p = movers[i]; if (p.mode !== 'fly' || !p.tgt || !p.tgt.e || !p.armed) continue;
        for (let j = i + 1; j < movers.length; j++) {
          const q = movers[j]; if (q.mode !== 'fly' || !q.tgt || q.tgt.e !== p.tgt.e || !q.armed) continue;
          const dx = q.x - p.x, dy = q.y - p.y, R2 = p.r + q.r; if (Math.abs(dx) > R2 || Math.abs(dy) > R2) continue;
          const d = Math.hypot(dx, dy); if (d >= R2 || d < 1e-6) continue;
          const nx = dx / d, ny = dy / d, pen = R2 - d;
          p.x -= nx * pen / 2; p.y -= ny * pen / 2; q.x += nx * pen / 2; q.y += ny * pen / 2;
          const vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
          if (vn < 0) { const jj = -vn * 0.75; p.vx -= jj * nx; p.vy -= jj * ny; q.vx += jj * nx; q.vy += jj * ny; }
        }
        // со спящими соседями на той же границе — просто не наезжать
        balls.forEach((q) => {
          if (q === p || q.mode !== 'rest' || !q.tgt || q.tgt.e !== p.tgt.e) return;
          const dx = p.x - q.x, R2 = p.r + q.r; if (Math.abs(dx) < R2 && Math.abs(p.y - q.y) < R2) { const sgn = dx >= 0 ? 1 : -1; p.x = q.x + sgn * R2; p.vx = sgn * Math.abs(p.vx) * 0.4; }
        });
      }
    }
    // засыпание
    movers.forEach((b) => {
      if (b.mode !== 'fly') return;
      const moved = Math.hypot(b.x - b.fx, b.y - b.fy);
      if (b.contact && moved < 0.35 && Math.abs(b.vy) < 40) { b.still += dt; if (b.still > 0.18) sleep(b); } else b.still = 0;
    });
    // струны успокаиваются
    edges.forEach((e) => {
      let sv = 0; for (let i = 1; i < e.n; i++) sv += Math.abs(e.v[i]);
      const onIt = balls.some((b) => b.mode === 'fly' && b.tgt && b.tgt.e === e && b.armed && b.contact);
      balls.forEach((b) => { if (b.mode === 'rest' && b.tgt && b.tgt.e === e && e.kind === 'net') { b.y = restY(e, b.x, b.r); } });
      if (sv < e.n * (e.kind === 'net' ? 0.6 : 0.25) && !onIt) {
        e.active = false; e.v.fill(0);
        if (e.kind === 'line') e.w.fill(0);
        else { const rest = balls.filter((b) => b.mode === 'rest' && b.tgt && b.tgt.e === e); if (!rest.length) e.w.fill(0); else rest.forEach((b) => { b.y = restY(e, b.x, b.r); b.last = ''; }); }
        e.dirty = true;
      }
    });
  }
  function forceRest() { // жёсткий предел: всё на места, расчёт выключен
    balls.slice().forEach((b) => {
      if (b.mode === 'die' || b.mode === 'pull') { killBall(b); return; }
      if (b.mode === 'fly') { b.delay = 0; b.s = b.sT = 1; sleep(b); }
      b.s = b.sT;
    });
    balls = balls.filter((b) => b.mode !== 'dead');
    G.blocks.forEach((B) => {
      const e = B.edge; e.v.fill(0); e.w.fill(0); e.active = false; e.dirty = true;
      const on = balls.filter((b) => b.tgt && b.tgt.e === e);
      if (e.kind === 'net') on.forEach((b) => sagUnder(e, b.x));
      on.sort((p, q) => p.x - q.x).forEach((b, i, arr) => { if (i && b.x - arr[i - 1].x < 2 * b.r) b.x = arr[i - 1].x + 2 * b.r; b.y = restY(e, b.x, b.r); });
    });
  }
  function busy() {
    if (G.blocks.some((B) => B.edge.active)) return true;
    return balls.some((b) => b.mode === 'fly' || b.mode === 'pull' || b.mode === 'die' || b.delay > 0 || b.s !== b.sT);
  }

  /* ---------- отрисовка ---------- */
  const f1 = (v) => Math.round(v * 10) / 10;
  function mountEdges() {
    layer.querySelectorAll('.bl-edge').forEach((x) => x.remove());
    G.blocks.forEach((B) => {
      const e = B.edge, top = e.y - 40, H = 40 + e.band + 34;
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'bl-edge bl-' + e.kind + (e.dark ? ' on-dark' : '')); svg.setAttribute('data-edge', B.id); // court-a: роль линии корта
      svg.setAttribute('width', e.vw); svg.setAttribute('height', H); svg.style.transform = 'translate(0,' + top + 'px)';
      const mk = (tag, cls) => { const p = document.createElementNS(NS, tag); if (cls) p.setAttribute('class', cls); svg.appendChild(p); return p; };
      e.top = top;
      if (e.kind === 'net') {
        e.pMesh = mk('path', 'mesh'); e.pRope = mk('path', 'rope');
        [e.x0, e.x1].forEach((x) => { const r = mk('rect', 'post'); r.setAttribute('x', f1(x - 1.25)); r.setAttribute('y', 40 - 7); r.setAttribute('width', 2.5); r.setAttribute('height', e.band + 9); });
      } else e.pRope = mk('path', 'line');
      layer.insertBefore(svg, layer.firstChild); e.svg = svg; e.dirty = true;
    });
  }
  function drawEdge(e) {
    if (!e.dirty || !e.svg) return; e.dirty = false;
    const oy = e.top, n = e.n;
    if (e.kind === 'line') {
      let d = 'M0 ' + f1(e.y - oy) + 'L' + f1(e.x0) + ' ' + f1(e.y - oy);
      for (let k = 1; k <= n; k++) d += 'L' + f1(e.x0 + k * e.hx) + ' ' + f1(e.y + e.w[k] - oy);
      d += 'L' + e.vw + ' ' + f1(e.y - oy);
      e.pRope.setAttribute('d', d); return;
    }
    let rope = '', r1 = '', r2 = '', vert = '';
    const half = e.band / 2;
    for (let k = 0; k <= n; k++) {
      const x = f1(e.x0 + k * e.hx), w = e.w[k];
      rope += (k ? 'L' : 'M') + x + ' ' + f1(e.y + w - oy);
      r1 += (k ? 'L' : 'M') + x + ' ' + f1(e.y + half + w * 0.8 - oy);
      r2 += (k ? 'L' : 'M') + x + ' ' + f1(e.y + e.band + w * 0.6 - oy);
    }
    const cell = G.mob ? 7 : 9, cnt = Math.floor((e.x1 - e.x0) / cell);
    for (let k = 1; k < cnt; k++) {
      const x = e.x0 + k * cell, w = wAt(e, x);
      vert += 'M' + f1(x) + ' ' + f1(e.y + w - oy) + 'L' + f1(x) + ' ' + f1(e.y + e.band + w * 0.6 - oy);
    }
    e.pRope.setAttribute('d', rope); e.pMesh.setAttribute('d', r1 + r2 + vert);
  }
  function supportY(b) {
    const T = b.tgt; if (!T) return null;
    if (T.p) return Math.abs(b.x - T.p.x) < 4 * b.r ? T.p.fy : null;
    const e = T.e; if (!b.armed) return null;
    return e.kind === 'net' ? surfY(e, b.x) - b.r * 0.15 : e.y + wAt(e, b.x);
  }
  function drawBall(b) {
    if (b.delay > 0) { if (b.el.style.visibility !== 'hidden') { b.el.style.visibility = 'hidden'; b.sh.style.opacity = '0'; b.shOn = false; } return; }
    if (b.el.style.visibility) b.el.style.visibility = '';
    const sc = b.s, half = b.box / 2;
    const t = 'translate3d(' + f1(b.x - half) + 'px,' + f1(b.y - half) + 'px,0)' + (sc !== 1 ? ' scale(' + sc.toFixed(3) + ')' : '');
    if (t !== b.last) { b.el.style.transform = t; b.last = t; }
    const rt = 'rotate(' + b.a.toFixed(2) + 'rad)';
    if (rt !== b.lastR) { b.rot.style.transform = rt; b.lastR = rt; }
    const op = b.mode === 'die' ? b.op.toFixed(2) : '';
    if (op !== b.lastS) { b.el.style.opacity = op; b.lastS = op; }
    const sy = supportY(b);
    if (sy == null || (b.tgt && b.tgt.e && b.tgt.e.dark)) { if (b.shOn) { b.sh.style.opacity = '0'; b.shOn = false; } return; }
    const gap = Math.max(0, sy - (b.y + b.r)), k = clamp(1 - gap / (5 * b.r), 0, 1) * sc * (b.mode === 'die' ? b.op : 1);
    b.sh.style.transform = 'translate3d(' + f1(b.x - b.sw / 2 + b.r * 0.25) + 'px,' + f1(sy - b.shh / 2) + 'px,0) scale(' + (0.6 + 0.4 * k).toFixed(2) + ')';
    b.sh.style.opacity = k.toFixed(2); b.shOn = k > 0;
  }
  function drawAll() { G.blocks.forEach((B) => drawEdge(B.edge)); balls.forEach(drawBall); }

  /* ---------- цикл ---------- */
  let raf = 0, lastT = 0, staticMode = !motionOK();
  let lastScrollT = 0, lastScrollY = window.scrollY, scrollV = 0, jumpUntil = 0, lastMove = 0;
  const fpsLog = [];
  const FAST = 2600;
  function schedule() { if (!raf && !document.hidden && G && !staticMode) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (!G || staticMode) return;
    const dt = lastT ? Math.min(0.034, Math.max(0.001, (now - lastT) / 1000)) : 1 / 60; lastT = now;
    fpsLog.push(now); if (fpsLog.length > 300) fpsLog.shift();
    const T = targetSt();
    if (T !== cur) {
      const fast = scrollV > FAST || now < jumpUntil;
      if (fast || Math.abs(T - cur) >= 3) snap(T);
      else { if (T > cur) { forward(cur); cur++; } else { backward(cur); cur--; } updNow(); }
      lastMove = now;
    }
    simulate(dt);
    const quiet = now - Math.max(lastScrollT, lastMove);
    if (quiet > 2000 && busy()) forceRest();
    drawAll();
    scrollV *= 0.82;
    if (busy() || targetSt() !== cur) schedule(); else lastT = 0;
  }
  function onScroll() {
    if (!G || staticMode) return;
    const now = performance.now(), dy = Math.abs(window.scrollY - lastScrollY), dtm = Math.max(8, now - lastScrollT);
    const v = dy / dtm * 1000; scrollV = Math.max(v, scrollV * 0.6);
    lastScrollY = window.scrollY; lastScrollT = now;
    if (busy() || targetSt() !== cur) schedule();
  }

  /* ---------- пульт ---------- */
  let bp = null;
  function updNow() {
    if (!bp || !G) return;
    const now = bp.querySelector('.bp-now'); if (!now) return;
    if (staticMode) { now.innerHTML = 'Движение выключено: мячи стоят у подразделов каждого блока.'; return; }
    const s = G.st[cur];
    if (s.t === 'hero') { const k = Math.max(N(), G.mob ? 4 : 5); now.innerHTML = 'Прокрутите вниз — <b>' + k + '</b> ' + pl(k, 'мяч прилетит', 'мяча прилетят', 'мячей прилетят') + ' сверху в сетку.'; return; } // [корт-2]
    const B = G.blocks[s.b], n = countAt(cur), kind = B.edge.kind === 'net' ? 'сетке' : 'линии';
    if (s.t === 'edge') now.innerHTML = 'Сейчас: <b>' + n + '</b> ' + pl(n, 'мяч', 'мяча', 'мячей') + ' на ' + kind + ' над блоком «' + B.name + '».';
    else now.innerHTML = 'Сейчас: «' + B.name + '» — <b>' + n + '</b> ' + pl(n, 'мяч', 'мяча', 'мячей') + ' у подразделов' + (n < B.spots.length ? ' (мест ' + B.spots.length + ', ограничено числом мячей)' : '') + '.';
  }
  function mountPanel() {
    bp = document.createElement('aside'); bp.className = 'bp'; bp.setAttribute('aria-label', 'Настройка мячей');
    bp.innerHTML = '<div class="bp-body" id="bp-body" hidden></div><button type="button" class="bp-tg" aria-expanded="false" aria-controls="bp-body">' +
      '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5"/><rect x="5.5" y="3" width="3" height="4" fill="var(--card)" stroke="currentColor" stroke-width="1.4"/><rect x="11.5" y="8" width="3" height="4" fill="var(--card)" stroke="currentColor" stroke-width="1.4"/><rect x="7.5" y="13" width="3" height="4" fill="var(--card)" stroke="currentColor" stroke-width="1.4"/></svg>' +
      '<span class="lbl">Настройка мячей</span></button>';
    placePanel();
    const body = bp.querySelector('.bp-body'), tg = bp.querySelector('.bp-tg');
    tg.addEventListener('click', () => { const o = body.hidden; body.hidden = !o; tg.setAttribute('aria-expanded', String(o)); if (o) renderPanel(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !body.hidden) { body.hidden = true; tg.setAttribute('aria-expanded', 'false'); tg.focus(); } });
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      const c = cfg();
      if (btn.dataset.size != null) c.size = +btn.dataset.size;
      else if (btn.dataset.count != null) c.count = +btn.dataset.count;
      else if (btn.dataset.bounce) c.bounce = btn.dataset.bounce;
      else if (btn.dataset.cam) { if (S.cam) S.cam.set(btn.dataset.cam); renderPanel(); return; } // [корт-2] камера: без пересборки мячей
      else if (btn.dataset.reset != null) { store[ff()] = Object.assign({}, DEF[ff()]); if (S.cam) S.cam.set(S.cam.rec); }
      else if (btn.dataset.close != null) { body.hidden = true; tg.setAttribute('aria-expanded', 'false'); return; }
      else return;
      saveStore(); renderPanel(); restart();
    });
  }
  function placePanel() { // телефон — в подвале у «Без анимации», компьютер — узкий ярлык у правого края
    const mob = isMob(), host = mob ? (document.querySelector('.foot [data-motion-toggle]') || {}).parentElement : document.body;
    bp.classList.toggle('bp--foot', !!mob);
    if (host && bp.parentElement !== host) host.appendChild(bp);
  }
  function renderPanel() {
    const body = bp.querySelector('.bp-body'), c = cfg(), d = DEF[ff()], sz = SIZES[ff()];
    const opt = (attr, val, on, label, sub, rec) => '<button type="button" data-' + attr + '="' + val + '" aria-pressed="' + on + '">' + label + (sub ? '<small>' + sub + '</small>' : '') + (rec ? '<em>советую</em>' : '') + '</button>';
    body.innerHTML =
      '<div class="bp-hd"><b>Настройка мячей</b><button type="button" class="bp-x" data-close aria-label="Закрыть">×</button></div>' +
      '<div><h4>Размер мяча · ' + (isMob() ? 'телефон' : 'компьютер') + '</h4><div class="bp-opts">' +
      ['Мелкий', 'Средний', 'Крупный'].map((l, i) => opt('size', i, c.size === i, l, sz[i] + ' px', d.size === i)).join('') + '</div></div>' +
      '<div><h4>Сколько мячей</h4><div class="bp-opts">' + [3, 5, 8].map((n) => opt('count', n, c.count === n, String(n), '', d.count === n)).join('') + '</div></div>' +
      '<div><h4>Упругость</h4><div class="bp-opts">' + opt('bounce', 'calm', c.bounce === 'calm', 'Спокойно', 'отскок 0.5', d.bounce === 'calm') + opt('bounce', 'live', c.bounce === 'live', 'Живо', 'отскок 0.7', d.bounce === 'live') + '</div></div>' +
      (S.cam ? '<div><h4>Камера</h4><div class="bp-opts">' + S.cam.modes.map((m) => opt('cam', m.id, S.cam.get() === m.id, m.name[0].toUpperCase() + m.name.slice(1), '', S.cam.rec === m.id)).join('') + '</div></div>' : '') + // [корт-2]
      '<p class="bp-now"></p><div class="bp-row"><span class="bp-note">В блоке мячей столько, сколько у него мест, но не больше выбранного.</span><button type="button" class="bp-reset" data-reset>Сбросить</button></div>';
    updNow();
  }

  /* ---------- запуск и пересборка ---------- */
  function clearAll() { balls.slice().forEach(killBall); balls = []; }
  function restart() {
    staticMode = !motionOK();
    const g2 = build(); if (!g2) return;
    G = g2; clearAll(); mountEdges();
    DOC.classList.add('balls-on');
    // заранее: рисунок мяча и запас элементов, чтобы первое движение колеса не ждало подготовки
    sprites(G.r); const warm = []; for (let k = 0; k < Math.max(N(), 5); k++) warm.push(makeBall()); warm.forEach((b) => { b.x = -99; drawBall(b); killBall(b); }); balls = [];
    if (staticMode) { // без движения: в каждом блоке мячи сразу у своих подразделов
      G.blocks.forEach((B, i) => { if (!B.spots.length) return; B.spots.slice(0, cSpots(i)).forEach((p) => { const b = makeBall(); b.tgt = { p }; sleep(b); }); });
      cur = 0;
    } else { cur = 0; snap(Math.max(0, (function () { let c = 0; while (c < G.th.length - 1 && window.scrollY >= G.th[c + 1]) c++; return c; })())); }
    G.blocks.forEach((B) => { B.edge.dirty = true; });
    drawAll(); updNow();
    lastT = 0;
  }
  let relayouts = 0;
  function relayout() {
    if (!G) return; relayouts++;
    if (isMob() !== G.mob) { placePanel(); restart(); return; }
    const vw = DOC.clientWidth;
    const g2 = build(); if (!g2) return;
    if (g2.sig === G.sig && vw === G.vw) { G.th = g2.th; G.docH = g2.docH; return; }
    const keep = cur; G = g2; clearAll(); mountEdges();
    if (staticMode) restart(); else { snap(Math.min(keep, G.st.length - 1)); drawAll(); }
  }
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 60));
  let relT = 0;
  const later = () => { clearTimeout(relT); relT = setTimeout(() => idle(relayout, { timeout: 600 }), 220); };
  const ro = new ResizeObserver(later);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', later);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastT = 0; schedule(); } });
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (a) jumpUntil = performance.now() + 1600; }, true);
  const onMotion = () => restart();
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onMotion);
  if (S.bus) S.bus.addEventListener('motion', onMotion);

  function init() {
    mountPanel();
    restart();
    ro.observe(document.querySelector('main') || document.body);
    // картинки и поздняя вёрстка (сетка турнира, таблицы) — пересчитать места, когда всё встанет
    setTimeout(later, 1200);
    document.querySelectorAll('main img').forEach((im) => { if (!im.complete) im.addEventListener('load', later, { once: true }); });
    window.__balls = {
      get cur() { return cur; }, get st() { return G.st[cur]; }, get n() { return balls.length; }, get busy() { return busy(); },
      stations: () => G.st.map((s, j) => ({ j, t: s.t, id: s.b != null ? G.blocks[s.b].id : 'hero', th: Math.round(G.th[j]), kind: s.b != null ? G.blocks[s.b].edge.kind : '', y: s.b != null ? Math.round(G.blocks[s.b].edge.y) : 0 })),
      blocks: () => G.blocks.map((B) => ({ id: B.id, kind: B.edge.kind, y: Math.round(B.edge.y), spots: B.spots.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), el: p.el.tagName.toLowerCase() + (p.el.id ? '#' + p.el.id : '') + (p.el.className && typeof p.el.className === 'string' ? '.' + p.el.className.split(' ')[0] : '') })) })),
      state: () => balls.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), m: b.mode, r: b.r, s: +b.s.toFixed(2), d: +b.delay.toFixed(2), t: b.tgt ? (b.tgt.p ? 'spot' : 'edge') : '' })),
      why: () => ({ e: G.blocks.filter((B) => B.edge.active).map((B) => B.id + ':' + Array.from(B.edge.v).reduce((m, v) => m + Math.abs(v), 0).toFixed(1)), b: balls.filter((b) => b.mode !== 'rest').map((b) => b.mode + (b.tgt ? (b.tgt.p ? ' spot' : ' edge') : '') + ' c' + (b.contact ? 1 : 0) + ' a' + (b.armed ? 1 : 0) + ' v' + Math.round(b.vx) + ',' + Math.round(b.vy) + ' y' + Math.round(b.y) + ' d' + b.delay.toFixed(2)) }),
      rebuild: () => { relayout(); return G.sig; },
      lane: () => G.lane, r: () => G.r, get relayouts() { return relayouts; },
      fps: () => { const a = fpsLog.slice(-120); if (a.length < 10) return null; return Math.round((a.length - 1) / ((a[a.length - 1] - a[0]) / 1000)); },
      set: (k, v) => { cfg()[k] = v; saveStore(); if (bp) renderPanel(); restart(); },
      reset: () => { store[ff()] = Object.assign({}, DEF[ff()]); saveStore(); restart(); }
    };
  }
  const go = () => { const f = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(); f.then(() => idle(init, { timeout: 500 })); };
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
