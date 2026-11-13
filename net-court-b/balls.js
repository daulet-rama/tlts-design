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
  const DEF = { d: { size: 1, count: 5, bounce: 'calm', cam2: 'soft', rise: 1.5 }, m: { size: 1, count: 3, bounce: 'calm', cam2: 'soft', rise: 1.5 } }; // [корт-4] cam2 — задержка камеры (старое поле cam не читается)
  const CAMS = [['crisp', 'Чётко · '], ['was', 'Как было · '], ['mid', ''], ['soft', 'Мягко · ']]; // [корт-4] режимы камеры: числа — из COURT.camModes()
  const RISES = [[1, '1 экран'], [1.5, '1,5 экрана'], [2, '2 экрана']]; // [корт-5] длина подъёма камеры, в экранах прокрутки
  const BOUNCE = { calm: { e: 0.5, cap: 400, roll: 1 }, live: { e: 0.7, cap: 720, roll: 0.55 } };
  const LSK = 'tlts-nethome-balls-v1';
  let store = { d: Object.assign({}, DEF.d), m: Object.assign({}, DEF.m) };
  try { const raw = JSON.parse(localStorage.getItem(LSK) || 'null'); if (raw && raw.d && raw.m) store = raw; } catch (e) { /* без хранилища */ }
  ['d', 'm'].forEach((f) => { if (!store[f] || typeof store[f] !== 'object') store[f] = Object.assign({}, DEF[f]); const c = store[f]; if (!CAMS.some((m) => m[0] === c.cam2)) c.cam2 = DEF[f].cam2; delete c.cam; if (![0, 1, 2].includes(c.size)) c.size = DEF[f].size; if (![3, 5, 8].includes(c.count)) c.count = DEF[f].count; if (!Object.prototype.hasOwnProperty.call(BOUNCE, c.bounce)) c.bounce = DEF[f].bounce; if (!RISES.some((r) => r[0] === c.rise)) c.rise = DEF[f].rise; }); // [корт-5] rise // [корт-4] настройки прошлых версий: размер, число и отскок остаются, камера — по умолчанию; испорченные значения — по умолчанию
  const saveStore = () => { try { localStorage.setItem(LSK, JSON.stringify(store)); } catch (e) { /* ok */ } };
  const ff = () => (isMob() ? 'm' : 'd');
  const cfg = () => store[ff()];
  const radius = () => SIZES[ff()][cfg().size] / 2;
  const bounce = () => BOUNCE[cfg().bounce] || BOUNCE.calm;
  const N = () => cfg().count;
  const MAXSPOTS = () => (isMob() ? 3 : 5);
  S.camMode = () => cfg().cam2 || 'soft'; // [корт-2] пульт «Камера» читается в court.js; [корт-4] поле cam2
  S.camRise = () => cfg().rise || DEF[ff()].rise; // [корт-5] пульт «Подъём камеры» читается в court.js (длина подъёма T)
  if (window.COURT && window.COURT.G && window.COURT.G.K !== S.camRise()) window.COURT.relayout(); // [корт-5] court.js мерил раньше, чем прочитан пульт
  const intoNet = () => !!(S.heroEnd && S.heroEnd() > 16); // [корт-2] 3D-корт есть: мячи влетают в сетку сверху
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
    // [корт-3] из версии 2: кружки с номерами шагов «Вступить» нарисованы через li::before — их тоже не закрывать
    document.querySelectorAll('.steps li').forEach((li) => {
      const cs = getComputedStyle(li, '::before'); if (!cs || cs.content === 'none') return;
      const q = li.getBoundingClientRect(), w = parseFloat(cs.width), h = parseFloat(cs.height);
      if (!(w > 1 && h > 1)) return;
      const l = q.left + li.clientLeft + (parseFloat(cs.left) || 0), t = q.top + li.clientTop + (parseFloat(cs.top) || 0);
      out.push([l - 3, t + sy - 3, l + w + 3, t + h + sy + 3]); // [корт-3] +3 px: на корте листы уже, и без зазора мяч касался кружка вплотную
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
    const mob = isMob(), vw = DOC.clientWidth, vh = window.innerHeight, sy = window.scrollY, r = radius();
    const txt = collectText(sy), avoid = collectAvoid(sy);
    const secs = Array.from(document.querySelectorAll('[data-ball-edge]'));
    if (!secs.length) return null;
    const blocks = [], taken = [];
    secs.forEach((sec) => {
      const q = sec.getBoundingClientRect(), y = q.top + sy;
      const inn = sec.querySelector('.ch-in, .wrap') || sec, iq = inn.getBoundingClientRect(), cs = getComputedStyle(inn);
      const cx = S.edgeX ? S.edgeX(sec) : null; // [корт] граница идёт от боковой линии до боковой линии корта
      const x0 = cx ? cx[0] : iq.left + parseFloat(cs.paddingLeft), x1 = cx ? cx[1] : iq.right - parseFloat(cs.paddingRight);
      const end = sec.hasAttribute('data-ball-end');
      const edge = makeEdge(sec.dataset.ballEdge === 'net' ? 'net' : 'line', y, x0, x1, vw, sec.classList.contains('dark'), mob, r);
      const spots = end ? [] : findSpots(sec, mob, r, txt, avoid, sy, vw, taken);
      blocks.push({ id: sec.id || 'foot', el: sec, edge, spots, end, name: sec.dataset.ballName || '', top: y, bot: q.bottom + sy, exit: sec.dataset.ballExit || '' }); // [корт-3] exit — уход сбоку
    });
    const lane = heroLane(sy, r, vw, txt);
    // станции: 0 — первый экран; дальше у каждого блока «граница», потом «места»
    const st = [{ t: 'hero' }];
    blocks.forEach((b, i) => { st.push({ t: 'edge', b: i }); if (b.spots.length) st.push({ t: 'spots', b: i }); });
    const hdr = (document.getElementById('hdr') || { offsetHeight: 64 }).offsetHeight;
    const tab = mob ? 60 : 0, use = vh - hdr - tab;
    layer.style.height = '0px'; // [корт-5] слой мячей сам растягивает документ: перед замером высоты его надо сложить, иначе страница не может стать короче
    const docH = DOC.scrollHeight, maxS = Math.max(1, docH - vh);
    const th = st.map((s, j) => {
      if (j === 0) return -Infinity;
      if (j === 1) return intoNet() && S.heroGo ? S.heroGo() : (S.heroEnd ? S.heroEnd() : 16); // [корт] мячи выходят, когда 3D-сетка легла на границу; [корт-2.1] в сетку — чуть раньше, на 95 %
      const e = blocks[s.b].edge;
      return e.y - hdr - use * (s.t === 'edge' ? 0.74 : 0.42);
    });
    if (intoNet() && th.length > 2) th[2] = Math.max(th[2], th[1] + use * 0.25); // [корт-2] мячам нужно время долететь до сетки и лечь в неё
    for (let j = 2; j < th.length; j++) th[j] = Math.max(th[j], th[j - 1] + 70);
    for (let j = th.length - 1; j >= 2; j--) th[j] = Math.min(th[j], maxS - (th.length - 1 - j) * 50 - 4, j + 1 < th.length ? th[j + 1] - 40 : Infinity);
    for (let j = 2; j < th.length; j++) th[j] = Math.max(th[j], 17 + j);
    layer.style.height = Math.ceil(docH) + 'px';
    return { mob, vw, vh, r, blocks, st, th, lane, docH, hdr, sig: sigOf(blocks, r, vw), block: txt.concat(avoid) }; // [корт-2.1] block — текст и картинки: путь сбоку их обходит
  }
  const sigOf = (blocks, r, vw) => vw + '|' + r + '|' + blocks.map((b) => Math.round(b.edge.y) + ':' + b.spots.map((s) => Math.round(s.x) + ',' + Math.round(s.y)).join(';')).join('/');

  /* ---------- сколько мячей на каждой станции ---------- */
  const cSpots = (bi) => Math.min(G.blocks[bi].spots.length, N());
  function countAt(j) {
    const s = G.st[j];
    if (s.t === 'hero') return 0;
    if (s.t === 'spots') return cSpots(s.b);
    if (s.b === 0 && intoNet()) return nHero(); // [корт-2]
    for (let k = s.b - 1; k >= 0; k--) if (G.blocks[k].spots.length) return cSpots(k);
    return N();
  }

  function nHero() { // [корт-2] в сетку влетают 5 (телефон — 4) или выбранное в пульте, но не меньше мест первого блока
    const c = cfg().count, base = c === DEF[ff()].count ? (G.mob ? 4 : 5) : c;
    return Math.max(base, G.blocks[0] ? Math.min(G.blocks[0].spots.length, MAXSPOTS()) : 0);
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
      armed: true, lane: false, exitVx: 0, dieOnRest: false, dieT: 0, wp: null, enter: null, t: 0, last: '', lastR: '', lastS: '', shOn: false, py: 0, contact: false, hitN: 0, side: null, wide: false, slide: null, next: null, touched: false, fast: false, sep: false }); // [корт-3] side/wide/slide — путь сбоку; [корт-2.1] next/touched/fast — удар в сетку по пути к подразделам
    b.el.style.opacity = ''; b.el.style.visibility = '';
    balls.push(b);
    return b;
  }
  function killBall(b) { b.mode = 'dead'; b.el.remove(); b.sh.remove(); b.shOn = false; b.last = ''; b.lastR = ''; pool.push(b); }
  const alive = () => balls.filter((b) => b.mode !== 'dead' && b.mode !== 'die' && b.mode !== 'out'); // [корт-2] out — улетает вверх
  const visibleY = (y) => y > window.scrollY - 60 && y < window.scrollY + window.innerHeight + 60;

  function restPose(b) {
    if (!b.tgt) return;
    if (b.tgt.p) { b.x = b.tgt.p.x; b.y = b.tgt.p.y; }
    else { const e = b.tgt.e; b.x = clamp(b.x, e.x0 + b.r + 2, e.x1 - b.r - 2); b.y = restY(e, b.x, b.r); }
  }
  function sleep(b) { b.side = null; b.wide = false; b.slide = null; /* [корт-3] */ b.mode = 'rest'; b.vx = b.vy = 0; b.w = 0; b.still = 0; if (b.sep) spread(b); restPose(b); if (b.dieOnRest) startDie(b); }
  function spread(b) { // [корт-2.1] мяч из сетки сверху или после падения сбоку не ложится вплотную к соседу: между центрами не меньше 3r
    b.sep = false;
    const e = b.tgt && b.tgt.e; if (!e || b.dieOnRest) return;
    const lo = e.x0 + 2 * b.r, hi = e.x1 - 2 * b.r, D = 3 * b.r;
    const nb = balls.filter((q) => q !== b && q.mode === 'rest' && q.tgt && q.tgt.e === e && !q.dieOnRest).map((q) => q.x);
    const ok = (x) => nb.every((qx) => Math.abs(qx - x) >= D - 0.5);
    if (ok(b.x)) return;
    for (let s = 1; s <= 40; s++) for (const sg of [1, -1]) { const x = b.x + sg * s * b.r * 0.5; if (x >= lo && x <= hi && ok(x)) { b.x = x; return; } }
  }
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
  function fly(b, tgt, armed) { if (b.enter) { const f = b.enter; b.enter = null; f(); } /* [корт-2] ещё не влетел — встаёт к краю экрана */ b.side = null; b.wide = false; b.slide = null; /* [корт-3] */ b.next = null; /* [корт-2.1] */ b.mode = 'fly'; b.tgt = tgt; b.armed = armed; b.still = 0; b.contact = false; b.hitN = 0; }

  /* ---------- переходы между станциями ---------- */
  function flightGuess() { // [корт-4] сколько лететь первому мячу до сетки, если стартовать сейчас (как в dropIntoNet): камера к удару — не ниже S.heroSY(это)
    if (!G || !G.blocks.length || !intoNet()) return 0;
    const avail = (G.blocks[0].edge.y - window.scrollY - G.hdr - 50) / Math.max(1, scrollRate() * 1.3);
    const tt = scrollIdle() || scrollRate() <= 300 ? 0.35 : 0.2; // [корт-4] на ходу полёт короче
    return 0.02 + clamp(Math.min(tt, avail * 0.85), tMin(), tt); // 0,02 — пауза перед первым мячом
  }
  function tMin() { return scrollRate() > 1600 ? 0.12 : 0.14; } // [корт-4] самый короткий полёт; очень быстрая прокрутка — 0,12 с
  function dropIntoNet() { // [корт-2] мячи прилетают сверху, из-под шапки, и падают в полосу сетки
    const e = G.blocks[0].edge, n = nHero(), r = G.r;
    const span = e.x1 - e.x0 - 4 * r, slot = span / n, jit = G.mob ? 0.12 : 0.22; // [корт-2.1] на телефоне разброс меньше: мячи не слипаются
    const order = Array.from({ length: n }, (_, k) => k);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    let d = 0.02;
    const Q = { last: 0 }; // [корт-4] время последнего удара очереди: удары идут друг за другом, а не пачкой
    order.forEach((k) => {
      const b = makeBall();
      const tx = e.x0 + 2 * r + slot * (k + 0.5) + rnd(-jit, jit) * slot;
      b.x = tx; b.y = -9999; b.s = b.sT = 1; b.sep = true; b.delay = d; const sr = scrollIdle() ? 0 : scrollRate(); d += sr > 1600 ? rnd(0.005, 0.01) : sr > 900 ? rnd(0.01, 0.02) : sr > 300 ? rnd(0.012, 0.02) : rnd(0.05, 0.09); // [корт-4] прокрутка уже встала — паузы как при остановке // [корт-4] прокрутка идёт — паузы короче: вся очередь бьётся, пока полоса высоко // [корт-2.1] паузы короче (было 0,08–0,15 с), при быстрой прокрутке — ещё короче
      fly(b, { e }, true);
      const enterFn = (mayWait) => { // [корт-4] mayWait — очередь из simulate: можно отложить старт; старт — когда подошла очередь: от верхнего края экрана, как он стоит сейчас
        const side = Math.random() < 0.5 ? -1 : 1, drift = side * rnd(20, 70), ry = restY(e, tx, r);
        b.x = clamp(tx - drift, r + 2, G.vw - r - 2);
        b.y = Math.min(window.scrollY + G.hdr - 2 * r - rnd(6, 40), ry - 4 * r); // [корт-2.1] сетка уже под шапкой — всё равно сверху
        // [корт-2.1] полёт 0,35–0,45 с (было 0,45–0,6): начальная скорость вниз из времени полёта; догоняющие — быстрее
        // при быстрой прокрутке — успеть до того, как сетка уйдёт под шапку (запас 50 px и скорость с запасом 30 %)
        const avail = (ry - window.scrollY - G.hdr - 50) / Math.max(1, scrollRate() * 1.3);
        let t = clamp(Math.min(b.fast || !(scrollIdle() || scrollRate() <= 300) ? rnd(0.2, 0.26) : rnd(0.35, 0.45), avail * 0.85), tMin(), 0.45); const H = ry - b.y, g = grav(); // [корт-4] tMin; прокрутка идёт — полёт короче: камера к удару предсказана точнее
        // [корт-4] удар не раньше чем через gap после удара прошлого мяча: при остановке 0,05 с, на ходу 0,025–0,035
        // (быстрее 900 px/с или полоса близко к шапке — 0,02 с, но не в один кадр). Не успевает дольше лететь (сверху низко) — стартует позже
        const now = performance.now() / 1000, still = scrollIdle() || scrollRate() <= 300;
        const gap = still ? 0.05 : avail * 0.85 < tMin() + 0.08 || scrollRate() > 900 ? 0.02 : rnd(0.025, 0.035);
        if (mayWait && Q.last && now + t < Q.last + gap) {
          const want = Q.last + gap - now, tff = Math.sqrt(2 * Math.max(1, H) / g); // дольше свободного падения не растянуть
          if (want <= Math.min(0.45, tff, Math.max(t, avail * 0.85))) t = want;
          else { b.delay = Math.max(0.004, Q.last + gap - now - t); b.enter = enterFn; b.y = -9999; return; }
        }
        Q.last = now + Math.min(t, Math.sqrt(2 * Math.max(1, H) / g));
        let vy0 = Math.max(0, (H - g * t * t / 2) / t);
        if (b.fast) vy0 = Math.max(vy0, rnd(350, 600) * (G.mob ? 0.85 : 1));
        throwDown(b, tx, ry, vy0);
        b.w = side * rnd(7, 13); b.hitN = 0; b.contact = false; b.touched = false;
      };
      b.enter = enterFn;
    });
  }
  function tossOut() { // [корт-2] назад: мячи выпрыгивают из сетки вверх и улетают за верхний край экрана
    const e = G.blocks[0].edge;
    balls.slice().forEach((b, k) => {
      if (b.mode === 'dead') return;
      if (b.enter) { killBall(b); return; }
      if (b.mode === 'die') return;
      if (b.y > e.y - 60 && b.y < e.y + 60) kick(e, b.x, -150);
      const top = window.scrollY + G.hdr - 3 * b.r, D = Math.max(60, b.y - top) + 280;
      b.mode = 'out'; b.tgt = null; b.lane = false; b.dieOnRest = false; b.delay = k * 0.06; b.t = 0; b.wp = null;
      b.vy = -Math.min(3200, Math.sqrt(2 * grav() * D)); b.vx = rnd(-90, 90); b.w = rnd(-14, 14);
    });
    balls = balls.filter((b) => b.mode !== 'dead');
  }
  function spawnFromHero() {
    if (intoNet()) { dropIntoNet(); return; } // [корт-2]
    const e = G.blocks[0].edge, L = G.lane, n = countAt(1), r = G.r;
    const cx = L ? L.cx : G.vw / 2;
    let sy0 = L ? L.visBot - 60 : e.y - 200;
    if (S.netTapeAt) { const ty = S.netTapeAt(cx - window.scrollX); if (ty != null) sy0 = ty + window.scrollY + r * 0.6; }
    if (L && !S.heroEnd) sy0 = clamp(sy0, L.yTop, L.yBot - 2 * r);
    if (S.heroEnd) sy0 = e.y + r * 0.6; // [корт] сетка уже лежит на границе: мячи выпрыгивают из неё
    for (let k = 0; k < n; k++) {
      const b = makeBall();
      b.x = cx + (L ? rnd(-1, 1) * Math.max(0, (L.x1 - L.x0) / 2 - r - 2) : 0); b.y = sy0; b.vx = 0; b.vy = -rnd(120, 220);
      b.s = 0.3; b.sT = 1; b.delay = k * 0.1; b.lane = !!L && !S.heroEnd; b.exitVx = (k % 2 ? 1 : -1) * rnd(120, 260) + (G.mob ? -120 : 0);
      fly(b, { e }, true);
    }
    if (S.netPoke) S.netPoke(cx - window.scrollX, sy0 - window.scrollY, 1);
  }
  function dropToSpots(bi) {
    const B = G.blocks[bi], e = B.edge, c = cSpots(bi), spots = B.spots.slice(0, c).sort((p, q) => p.x - q.x);
    const have = alive().filter((b) => b.tgt && b.tgt.e === e).sort((p, q) => p.x - q.x);
    // [корт-2.1] мячи, которые ещё летят в сетку сверху (или ещё не стартовали), сначала бьются о неё, потом — к подразделам
    const net1 = bi === 0 && intoNet(), late = (b) => net1 && b.mode === 'fly' && (b.enter || !b.touched);
    if (net1) { // ещё не стартовавшие — без лишних пауз: вся очередь успевает удариться, пока сетка на экране
      const gap = scrollRate() > 300 ? 0.012 : 0.05; // [корт-4] прокрутка идёт — почти без пауз (было 0,05 всегда)
      have.filter((b) => b.enter).sort((p, q) => p.delay - q.delay).forEach((b, k) => { b.delay = Math.min(b.delay, k * gap); b.fast = true; });
    }
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
      if (late(b)) { b.next = s; return; } // [корт-2.1] к своему месту — после удара о сетку (simulate)
      if (!b.delay) b.delay = k * 0.05;
      fly(b, { p: s }, true);
      throwDown(b, s.x, s.y, e.kind === 'net' ? 30 : 70);
      kick(e, b.x, e.kind === 'net' ? 260 : 70);
    });
  }
  function fallToEdge(bi) {
    if (bi > 0 && G.blocks[bi - 1].exit) { sideFall(bi, G.blocks[bi - 1]); return; } // [корт-3] уход сбоку — по коридору корта
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
      if (B.exit && sideClimb(b, s, k, pairs.length, B, bi)) return; // [корт-3] назад — вверх по коридору корта
      fly(b, { p: s }, false); b.dieOnRest = false; b.lane = false;
      tossTo(b, s.x, s.y, rnd(36, 60)); b.delay = Math.max(b.delay, k * 0.05);
    });
  }
  function pullToHero() {
    if (intoNet()) { tossOut(); return; } // [корт-2]
    const e = G.blocks[0].edge, L = G.lane, cx = L ? L.cx : G.vw / 2;
    let top = L ? L.yTop : e.y - 300;
    if (S.netTapeAt && L) { const ty = S.netTapeAt(cx - window.scrollX); if (ty != null) top = clamp(ty + window.scrollY + G.r * 0.6, L.yTop, L.yBot - 2 * G.r); }
    alive().forEach((b, k) => {
      b.mode = 'pull'; b.tgt = null; b.delay = k * 0.06; b.lane = false;
      b.wp = S.heroEnd ? [[clamp(b.x, e.x0 + b.r, e.x1 - b.r), e.y + b.r * 0.6]] : [[cx, e.y - b.r - 6], [cx, top]]; // [корт] назад — в ту же полосу сетки
    });
  }
  /* ---------- [корт-3] из версии 2: уход сбоку (блоки с data-ball-exit="left|right") ----------
     вперёд: места → короткая дуга к боковому краю → падение по полю сбоку от содержимого →
     удар о границу следующего блока у угла → раскатывание по ней внутрь.
     назад: граница → прыжок к углу → вверх вдоль боковой стороны → дуга на место. */
  // [корт-3] на корте боковое поле — коридор корта между краем листа и краем экрана (на компьютере ~86 px,
  // там парная и одиночная боковые). Мяч идёт по середине коридора, а не вплотную к листу.
  // На телефоне коридор 10 px — мяч (16 px) идёт у самого края экрана, как в версии 2: 1 px от края.
  function sideLane(B, dir) {
    const q = (B.el.querySelector('.ch-in') || B.el).getBoundingClientRect(), r = G.r;
    const mid = dir > 0 ? (q.right + G.vw) / 2 : q.left / 2;
    return dir > 0 ? Math.min(mid, G.vw - r - 1) : Math.max(mid, r + 1);
  }
  function sideFall(bi, P) {
    const e = G.blocks[bi].edge, dir = P.exit === 'left' ? -1 : 1, lane = sideLane(P, dir);
    const list = alive().filter((b) => b.mode !== 'pull').sort((p, q) => Math.abs(p.x - lane) - Math.abs(q.x - lane));
    // v2.1: куда каждый мяч раскатится по следующей границе. Первый упавший уходит дальше всех, последний остаётся у угла.
    const n = list.length, d0 = G.r * 3, span = Math.max(0, (e.x1 - e.x0) - 2 * G.r - d0 - 2 * G.r);
    const gap = n > 1 ? Math.min(G.mob ? 78 : 112, span / (n - 1)) : 0;
    const hb = (document.getElementById('hdr') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom;
    const sy = window.scrollY, under = sy + Math.max(0, hb) + G.r + 60; // запас: колесо ещё крутится
    // точки раската — по порядку удара о границу: первый ударившийся получает дальнюю
    const stops = list.map((_, k) => clamp(lane - dir * (d0 + (n - 1 - k) * gap + rnd(-8, 8)), e.x0 + 2 * G.r, e.x1 - 2 * G.r));
    list.forEach((b, k) => {
      fly(b, { e }, b.y + b.r <= surfY(e, b.x) + 1);
      b.lane = false; b.dieOnRest = false; b.wide = true; b.sep = true; // [корт-2.1] sep
      b.side = { dir, lane, st: 'arc', e, stops };
      const lift = clamp(Math.abs(lane - b.x) * 0.08, 18, 70), rp = rollPath(b, lane, e, under, dir, P);
      if (rp) { // [корт-2.1] не дугой над текстом: в сторону по строке, вниз до просвета, по нему к краю листа, там падение в коридор
        b.vx = 0; b.vy = rp.sx !== b.x ? 0 : 520; b.side.st = rp.sx !== b.x ? 'shift' : 'sink'; b.side.ry = rp.ry; b.side.sx = rp.sx; b.side.y0 = b.y; b.side.x0 = b.x;
        b.side.v = clamp(Math.abs(lane - rp.sx) / 0.24, 450, 2600); b.side.v1 = Math.max(420, Math.abs(rp.sx - b.x) / 0.18);
      } else if (b.y - lift < under) { // дуга ушла бы под шапку сайта: бросок к краю идёт вниз, по видимой части экрана
        const ty = Math.min(e.y - 3 * G.r, sy + Math.max(0, hb) + (window.innerHeight - Math.max(0, hb)) * 0.55);
        throwDown(b, lane, Math.max(b.y + 40, ty), 160);
      } else tossTo(b, lane, b.y + 14, Math.min(lift, 1.5 * G.r)); // [корт-2.1] запасная дуга — низкая, не выше 1,5 r (было до 70 px)
      b.delay = k * 0.07;
    });
  }
  // [корт-2.1] путь к коридору не над текстом: (1) по своей строке чуть в сторону от коридора, пока под мячом не будет
  // свободного спуска, (2) вниз до просвета между строками, (3) по просвету катится к краю листа и (4) за краем падает в коридор
  function rollPath(b, lane, e, from, dir, B) {
    const r = b.r, pad = r + 3, away = -dir, sq = (B.el.querySelector('.ch-in') || B.el).getBoundingClientRect();
    const xEnd = away > 0 ? sq.right - r - 8 : sq.left + r + 8, y0 = Math.max(b.y, from), lim = Math.min(y0 + 240, e.y - 3 * r);
    const xa = Math.min(lane, b.x, xEnd) - pad, xb = Math.max(lane, b.x, xEnd) + pad;
    const near = G.block.filter((q) => q[2] > xa && q[0] < xb && q[3] > b.y - pad && q[1] < lim + pad);
    const hit = (x0, x1, y0_, y1_) => near.some((q) => q[2] > x0 && q[0] < x1 && q[3] > y0_ && q[1] < y1_);
    // докуда мяч может пройти по своей строке в обе стороны (от коридора — не дальше 280 px; к коридору — до края листа)
    const xIn = dir > 0 ? sq.right - r - 8 : sq.left + r + 8, ends = [];
    for (const [sg, lim2, mx] of [[away, xEnd, 280], [dir, xIn, 2000]]) {
      let reach = b.x;
      for (let x = b.x; (sg > 0 ? x <= lim2 : x >= lim2) && Math.abs(x - b.x) <= mx; x += sg * 6) { if (hit(x - pad, x + pad, b.y - pad, b.y + pad)) break; reach = x; }
      ends.push([sg, reach]);
    }
    let best = null, bc = Infinity;
    for (let y = y0; y <= lim; y += 3) {
      if ((y - b.y) * 0.5 >= bc) break;
      for (const [sg, reach] of ends) {
        for (let sx = b.x; sg > 0 ? sx <= reach : sx >= reach; sx += sg * 12) {
          const c = Math.abs(sx - b.x) * (sg === dir ? 0.3 : 1) + (y - b.y) * 0.5; if (c >= bc) break; // самый короткий путь; к коридору — дешевле
          if (hit(sx - pad, sx + pad, b.y, y)) continue; // спуск
          if (hit(Math.min(lane, sx) - r, Math.max(lane, sx) + r, y - pad, y + pad)) continue; // просвет до коридора
          best = { sx, ry: y }; bc = c; break;
        }
      }
    }
    return best;
  }
  function sideClimb(b, s, k, n, B, bi) {
    const nx = G.blocks[bi + 1], e = b.tgt && b.tgt.e ? b.tgt.e : (nx ? nx.edge : null);
    if (!e) return false;
    const dir = B.exit === 'left' ? -1 : 1, lane = sideLane(B, dir);
    fly(b, { e }, true); b.dieOnRest = false; b.lane = false; b.wide = true;
    b.side = { dir, lane, st: 'hop', e, p: s, apex: s.y - rnd(30, 48) };
    tossTo(b, lane, restY(e, lane, b.r), clamp(Math.abs(lane - b.x) * 0.1, 22, 110));
    b.delay = Math.max(b.delay, (dir > 0 ? n - 1 - k : k) * 0.05);
    return true;
  }
  function sideStep(b, g) { // после шага движения: смена стадий пути сбоку
    const S = b.side, past = S.dir > 0 ? b.x >= S.lane : b.x <= S.lane;
    if (S.st === 'shift') { const sg = Math.sign(S.sx - S.x0) || 1; b.y = S.y0; b.vy = 0; b.vx = sg * S.v1; b.w = b.vx / b.r; if ((S.sx - b.x) * sg <= 0) { b.x = S.sx; b.vx = 0; b.vy = 520; S.st = 'sink'; } } // [корт-2.1]
    else if (S.st === 'sink') { b.x = S.sx; b.vx = 0; if (b.y >= S.ry) { b.y = S.ry; b.vy = 0; b.vx = S.dir * S.v; b.w = b.vx / b.r; S.st = 'roll'; } } // [корт-2.1]
    else if (S.st === 'roll') { b.y = S.ry; b.vy = 0; b.vx = S.dir * S.v; b.w = b.vx / b.r; if (past) { b.x = S.lane; b.vx = 0; b.vy = 450; S.st = 'drop'; } } // скорость держим: сосед в коридоре не разворачивает мяч // [корт-2.1] катится по просвету
    else if (S.st === 'arc') { if (past) { b.x = S.lane; b.vx = 0; S.st = 'drop'; } }
    else if (S.st === 'drop') { b.x = S.lane; b.vx = 0; }
    else if (S.st === 'hop') {
      if (past) {
        b.x = S.lane; b.vx = 0; b.tgt = null; S.st = 'rise';
        b.vy = -Math.sqrt(2 * g * Math.max(20, b.y - S.apex));
        kick(S.e, S.dir > 0 ? S.e.x1 - S.e.hx * 1.2 : S.e.x0 + S.e.hx * 1.2, S.e.kind === 'net' ? -160 : -40);
      }
    } else if (S.st === 'rise') {
      // v2.1: за 260 px до верхней точки мяч уже сворачивает к своему месту; вершина та же, подъём не обрывается
      if (b.vy >= 0 || b.y - S.apex < 260) { const p = S.p; fly(b, { p }, false); tossTo(b, p.x, p.y, Math.max(16, p.y - S.apex)); }
    }
  }
  function sideLand(b) { // первый удар у угла: граница вздрагивает, мяч раскатывается внутрь
    const S = b.side, e = S.e;
    kick(e, S.dir > 0 ? e.x1 - e.hx * 1.2 : e.x0 + e.hx * 1.2, Math.min(260, Math.abs(b.vy) * 0.2 + 60));
    // v2.1: раскат к своей точке с ровным торможением (как трение), за T секунд — мячи рассыпаются и встают сами
    const stop = S.stops.length ? S.stops.shift() : b.x - S.dir * 3 * b.r;
    const d = Math.abs(stop - b.x), T = G.mob ? 0.45 : 0.5; // [корт-2.1] было 0,55 / 0,6: засыпали на краю нормы 2 с
    b.slide = { x: stop, a: 2 * d / (T * T) };
    b.vx = -S.dir * (2 * d / T); b.w = b.vx / b.r; b.side = null;
    if (b.vy < -bounce().cap * 0.6) b.vy = -bounce().cap * 0.6; // отскок у угла пониже, чтобы раскат был по линии
  }
  function slideStep(b) { // v2.1: скорость раската = sqrt(2·a·остаток), у точки — ноль
    const L = b.slide, rem = (L.x - b.x) * Math.sign(b.vx || (L.x - b.x));
    if (rem <= 0.5 || Math.abs(b.vx) < 2) { b.vx = 0; b.w = 0; b.slide = null; return; }
    b.vx = Math.sign(L.x - b.x) * Math.sqrt(2 * L.a * rem); if (b.contact) b.w = b.vx / b.r;
  }
  function sideEnd(b) { // жёсткий предел или прыжок: путь сбоку обрывается, мяч встаёт куда положено
    const S = b.side; b.side = null; b.wide = false;
    if (S && S.p && (S.st === 'hop' || S.st === 'rise')) b.tgt = { p: S.p };
  }
  function stByScroll() { // [корт-3] из версии 2: шаг — по положению прокрутки; первый шаг — по сглаженной камере, как в targetSt
    const sy = window.scrollY, th = G.th, n = th.length, hs = S.heroSY ? S.heroSY(flightGuess()) : Infinity; // [корт-4]
    const at = (j) => (j === 1 && (n < 3 || sy < th[2]) ? Math.min(sy, hs) : sy);
    let c = 0; while (c < n - 1 && at(c + 1) >= th[c + 1]) c++; return c;
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
    balls.slice().forEach((b) => { if (b.mode === 'die' || b.mode === 'pull' || b.mode === 'out' || b.enter) killBall(b); }); // [корт-2] out/enter
    balls = balls.filter((b) => b.mode !== 'dead');
    const have = balls.slice().sort((p, q) => p.x - q.x);
    while (have.length > pose.length) killBall(have.pop());
    balls = balls.filter((b) => b.mode !== 'dead');
    G.blocks.forEach((B) => { B.edge.w.fill(0); B.edge.v.fill(0); B.edge.active = false; B.edge.dirty = true; });
    pose.forEach((p, k) => {
      const b = have[k] || makeBall();
      b.side = null; b.wide = false; b.slide = null; b.next = null; b.fast = false; b.sep = false; /* [корт-2.1] */ b.tgt = p.tgt; b.x = p.x; b.y = p.y; b.delay = 0; b.s = b.sT = 1; b.lane = false; b.dieOnRest = false; b.armed = true;
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
    // [корт-2] первый шаг — по сглаженной камере: мячи ждут, пока сетка действительно легла
    const hs = S.heroSY ? S.heroSY(flightGuess()) : Infinity, at = (j) => (j === 1 && (n < 3 || sy < th[2]) ? Math.min(sy, hs) : sy);
    let c = cur;
    while (c < n - 1 && at(c + 1) >= th[c + 1]) c++;
    while (c > 0 && at(c) < th[c] - (c === 1 ? 10 : HYST)) c--;
    return c;
  }

  /* ---------- физика ---------- */
  function simulate(dt) {
    const g = grav(), B = bounce(), e0 = B.e, cap = B.cap;
    // задержки, рост, гаснущие мячи, подъём в сетку первого экрана
    balls.forEach((b) => {
      if (b.mode === 'dead') return;
      if (b.delay > 0) { b.delay -= dt; if (b.delay < 0) b.delay = 0; }
      if (b.delay <= 0 && b.enter) { const f = b.enter; b.enter = null; f(true); } // [корт-2] очередь мяча — старт сверху; [корт-4] f(true) — можно отложить
      if (b.delay > 0) return;
      if (b.mode === 'out') { // [корт-2] полёт вверх за край экрана
        b.t += dt; b.vy += grav() * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
        if (b.y + b.r < window.scrollY + G.hdr - 4 || b.t > 1.6) { killBall(b); return; }
        if (b.vy > 0) { b.mode = 'die'; b.dieT = 0; b.y0 = b.y; b.tgt = null; }
        return;
      }
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
        if (b.side) { sideStep(b, g); if (b.mode !== 'fly') continue; } // [корт-3]
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
            } else if (pen > 0 && b.next) { // [корт-2.1] удар о сетку по пути к подразделам: сетка прогибается, мяч проваливается к месту
              const p = b.next; b.next = null; kick(e, b.x, 260); fly(b, { p }, true); throwDown(b, p.x, p.y, 30); b.touched = true; netHits.length < 200 && netHits.push([Math.round(performance.now()), Math.round(b.y - window.scrollY)]);
              continue;
            } else if (pen > 0) { // сетка: мягкий упор, сетка проседает и пружинит
              if (!b.touched) { b.touched = true; netHits.length < 200 && netHits.push([Math.round(performance.now()), Math.round(b.y - window.scrollY)]); } // [корт-2.1]
              const rel = b.vy - vAt(e, b.x), F = Math.max(0, 9000 * pen + 110 * rel);
              b.vy -= F * h; kick(e, b.x, F * h * 0.55); b.contact = true;
              if (b.vy < -cap * 0.9) b.vy = -cap * 0.9;
            }
            if (b.contact || pen > -1.5) {
              const roll = (e.kind === 'net' ? 300 : 150) + (e.kind === 'net' ? 6 : 2.6) * Math.abs(b.vx);
              const dec = Math.min(Math.abs(b.vx), roll * B.roll * h); b.vx -= Math.sign(b.vx) * dec; b.w = b.vx / b.r;
            }
            if (b.wide && !b.side && b.x >= e.x0 + b.r && b.x <= e.x1 - b.r) b.wide = false; // [корт-3] мяч из коридора вкатился на линию
            if (!b.wide) {
              if (b.x < e.x0 + b.r) { b.x = e.x0 + b.r; b.vx = Math.abs(b.vx) * 0.4; }
              if (b.x > e.x1 - b.r) { b.x = e.x1 - b.r; b.vx = -Math.abs(b.vx) * 0.4; }
            }
            if (b.side && b.side.st === 'drop' && b.contact) sideLand(b);
            else if (b.slide) slideStep(b);
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
      if (b.mode === 'die' || b.mode === 'pull' || b.mode === 'out') { killBall(b); return; } // [корт-2] out
      if (b.enter) { const f = b.enter; b.enter = null; f(); } // [корт-2]
      if (b.next) { b.tgt = { p: b.next }; b.next = null; } // [корт-2.1]
      if (b.mode === 'fly') { if (b.side) sideEnd(b); /* [корт-3] */ b.delay = 0; b.s = b.sT = 1; sleep(b); }
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
    return balls.some((b) => b.mode === 'fly' || b.mode === 'pull' || b.mode === 'die' || b.mode === 'out' || b.delay > 0 || b.s !== b.sT); // [корт-2] out
  }

  /* ---------- отрисовка ---------- */
  const f1 = (v) => Math.round(v * 10) / 10;
  function mountEdges() {
    layer.querySelectorAll('.bl-edge').forEach((x) => x.remove());
    G.blocks.forEach((B) => {
      const e = B.edge, top = e.y - 40, H = 40 + e.band + 34;
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'bl-edge bl-' + e.kind + (e.dark ? ' on-dark' : '')); svg.setAttribute('data-edge', B.id);
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
      const lx0 = S.edgeX ? e.x0 : 0, lx1 = S.edgeX ? e.x1 : e.vw; // [корт] линия корта — только между боковыми линиями
      let d = 'M' + f1(lx0) + ' ' + f1(e.y - oy) + 'L' + f1(e.x0) + ' ' + f1(e.y - oy);
      for (let k = 1; k <= n; k++) d += 'L' + f1(e.x0 + k * e.hx) + ' ' + f1(e.y + e.w[k] - oy);
      d += 'L' + f1(lx1) + ' ' + f1(e.y - oy);
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
  function drawAll() { G.blocks.forEach((B) => drawEdge(B.edge)); balls.forEach(drawBall); dodgePanel(); } // [корт-3] dodgePanel
  let bpDodge = false;
  function dodgePanel() { // [корт-3] из версии 2: мяч идёт по правому полю — ярлык пульта уезжает за край, чтобы не прятать мяч
    if (!bp) return;
    const body = bp.querySelector('.bp-body');
    const on = !G.mob && !!body && body.hidden && !bp.matches(':hover, :focus-within') && balls.some((b) => b.mode === 'fly' && (b.side || b.wide) && b.x > G.vw - 70);
    if (on !== bpDodge) { bpDodge = on; bp.classList.toggle('bp--dodge', on); }
  }

  /* ---------- цикл ---------- */
  let raf = 0, lastT = 0, staticMode = !motionOK();
  let lastScrollT = 0, lastScrollY = window.scrollY, scrollV = 0, jumpUntil = 0, lastMove = 0;
  const sHist = []; // [корт-2.1] скорость прокрутки вниз за последние 0,3 с (рывки колеса не обманывают)
  function scrollIdle() { const n = sHist.length; return !n || performance.now() - sHist[n - 1][0] > 300; } // [корт-4] прокрутка стоит дольше 0,3 с (шаги колеса реже не бывают) (sHist пишется на каждое событие scroll)
  function scrollRate() { const now = performance.now(); if (!sHist.length || now - sHist[sHist.length - 1][0] > 200) return 0; const a = sHist[0], z = sHist[sHist.length - 1], dt = Math.max(60, now - a[0]); return Math.max(0, (z[1] - a[1]) / dt * 1000); }
  const fpsLog = [], netHits = []; // [корт-2.1] netHits — для проверки: когда и где на экране мяч ударился о сетку первого блока
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
    sHist.push([now, window.scrollY]); while (sHist.length > 2 && now - sHist[0][0] > 300) sHist.shift(); // [корт-2.1]
    if (busy() || targetSt() !== cur) schedule();
  }

  /* ---------- пульт ---------- */
  let bp = null;
  function updNow() {
    if (!bp || !G) return;
    const now = bp.querySelector('.bp-now'); if (!now) return;
    if (staticMode) { now.innerHTML = 'Движение выключено: мячи стоят у подразделов каждого блока.'; return; }
    const s = G.st[cur];
    if (s.t === 'hero' && intoNet()) { const k = nHero(); now.innerHTML = 'Прокрутите вниз — <b>' + k + '</b> ' + pl(k, 'мяч прилетит', 'мяча прилетят', 'мячей прилетят') + ' сверху в сетку над «Последней сеткой».'; return; } // [корт-2]
    if (s.t === 'hero') { now.innerHTML = 'Прокрутите вниз — <b>' + N() + '</b> ' + pl(N(), 'мяч выйдет', 'мяча выйдут', 'мячей выйдут') + ' из сетки первого экрана.'; return; }
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
      else if (btn.dataset.rise) { setRise(+btn.dataset.rise); return; } // [корт-5] длина подъёма: новая раскладка и мячи заново
      else if (btn.dataset.cam2) { c.cam2 = btn.dataset.cam2; saveStore(); renderPanel(); return; } // [корт-2] камера: мячи не трогаем; [корт-4] cam2
      else if (btn.dataset.reset != null) { const k0 = c.rise; store[ff()] = Object.assign({}, DEF[ff()]); if (k0 !== cfg().rise) { saveStore(); renderPanel(); riseLayout(); return; } } // [корт-5] сброс меняет длину подъёма — раскладка заново
      else if (btn.dataset.close != null) { body.hidden = true; tg.setAttribute('aria-expanded', 'false'); return; }
      else return;
      saveStore(); renderPanel(); restart();
    });
  }
  function riseLayout() { if (window.COURT && window.COURT.rerise) window.COURT.rerise(); restart(); } // [корт-5] раскладка, прокрутка на месте, мячи заново
  function setRise(v) { if (!RISES.some((r) => r[0] === v)) return; cfg().rise = v; saveStore(); if (bp) renderPanel(); riseLayout(); }
  function placePanel() { // телефон — в подвале у «Без анимации», компьютер — узкий ярлык у правого края
    const mob = isMob(), host = mob ? (document.querySelector('.foot [data-motion-toggle]') || {}).parentElement : document.body;
    bp.classList.toggle('bp--foot', !!mob);
    if (host && bp.parentElement !== host) host.appendChild(bp);
  }
  function camSec(id) { // [корт-4] «0,39 с»: средняя задержка режима для этого вида (компьютер / телефон)
    const M = window.COURT && window.COURT.camModes ? window.COURT.camModes() : null, v = M && M[id] ? M[id][isMob() ? 'm' : 'd'] : null;
    return v == null ? '' : v.toFixed(2).replace('.', ',') + ' с';
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
      (!staticMode && intoNet() ? '<div><h4>Камера</h4><div class="bp-opts">' + CAMS.map(([id, nm]) => opt('cam2', id, (c.cam2 || d.cam2) === id, nm + camSec(id), '', d.cam2 === id)).join('') + '</div></div>' : '') +
      (!staticMode && intoNet() ? '<div><h4>Подъём камеры</h4><div class="bp-opts">' + RISES.map(([v, nm]) => opt('rise', v, (c.rise || d.rise) === v, nm, '', d.rise === v)).join('') + '</div></div>' : '') + // [корт-5] // [корт-2]; [корт-4] четыре режима, подпись — средняя задержка в секундах
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
    G = g2; clearAll(); mountEdges();
    if (staticMode) restart(); else { snap(stByScroll()); drawAll(); } // [корт-3] шаг — по положению прокрутки, а не прежний номер
  }
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 60));
  let relT = 0;
  const later = () => { clearTimeout(relT); relT = setTimeout(() => idle(relayout, { timeout: 600 }), 220); };
  const ro = new ResizeObserver(later);
  window.addEventListener('scroll', onScroll, { passive: true });
  if (window.COURT) window.COURT.on('progress', () => { if (G && !staticMode && targetSt() !== cur) schedule(); }); // [корт-2] камера догнала — мячи могут лететь
  window.addEventListener('resize', later);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastT = 0; schedule(); } });
  document.addEventListener('click', (e) => { if (S.anchorJump ? S.anchorJump(e) : (e.target.closest && e.target.closest('a[href^="#"]'))) jumpUntil = performance.now() + 1600; }, true); // [корт-2.1] только к существующему якорю
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
      get cur() { return cur; }, get st() { return G.st[cur]; }, get n() { return balls.length; }, get busy() { return busy(); }, netHits: () => netHits.splice(0),
      stations: () => G.st.map((s, j) => ({ j, t: s.t, id: s.b != null ? G.blocks[s.b].id : 'hero', th: Math.round(G.th[j]), kind: s.b != null ? G.blocks[s.b].edge.kind : '', y: s.b != null ? Math.round(G.blocks[s.b].edge.y) : 0 })),
      blocks: () => G.blocks.map((B) => ({ id: B.id, kind: B.edge.kind, y: Math.round(B.edge.y), spots: B.spots.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), el: p.el.tagName.toLowerCase() + (p.el.id ? '#' + p.el.id : '') + (p.el.className && typeof p.el.className === 'string' ? '.' + p.el.className.split(' ')[0] : '') })) })),
      state: () => balls.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), m: b.mode, r: b.r, s: +b.s.toFixed(2), d: +b.delay.toFixed(2), t: b.tgt ? (b.tgt.p ? 'spot' : 'edge') : '', sd: b.side ? b.side.st : '' })),
      why: () => ({ e: G.blocks.filter((B) => B.edge.active).map((B) => B.id + ':' + Array.from(B.edge.v).reduce((m, v) => m + Math.abs(v), 0).toFixed(1)), b: balls.filter((b) => b.mode !== 'rest').map((b) => b.mode + (b.tgt ? (b.tgt.p ? ' spot' : ' edge') : '') + ' c' + (b.contact ? 1 : 0) + ' a' + (b.armed ? 1 : 0) + ' v' + Math.round(b.vx) + ',' + Math.round(b.vy) + ' y' + Math.round(b.y) + ' d' + b.delay.toFixed(2)) }),
      rebuild: () => { relayout(); return G.sig; },
      lane: () => G.lane, r: () => G.r, get relayouts() { return relayouts; },
      fps: () => { const a = fpsLog.slice(-120); if (a.length < 10) return null; return Math.round((a.length - 1) / ((a[a.length - 1] - a[0]) / 1000)); },
      set: (k, v) => { if (k === 'rise') { setRise(v); return; } cfg()[k] = v; saveStore(); if (bp) renderPanel(); restart(); },
      reset: () => { store[ff()] = Object.assign({}, DEF[ff()]); saveStore(); restart(); }
    };
  }
  const go = () => { const f = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(); f.then(() => idle(init, { timeout: 500 })); };
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
