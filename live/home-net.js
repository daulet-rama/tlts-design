// TLTS · главная · физика сцены «мяч пары в сетке».
// Сетка — ткань на интегрировании Верле из макета «Сетка и сеть» (s2-bold-net-network), пересчитанная
// под крупный план: настоящая ячейка 45 мм, узлы через пол-ячейки, мяч настоящего размера.
// Мяч не пролетает сквозь ячейку: сетка ловит его в карман и держит.
// Здесь только расчёты, без Three.js и DOM — модуль можно прогнать в Node.

export const CELL = 0.045;          // ячейка сетки, м
export const BALL_R = 0.0335;       // радиус мяча, м
const RC = BALL_R + 0.002;          // радиус контакта: мяч плюс половина толщины нити
const POST_X = 6.399, NET_CENTER = 0.914, NET_POST = 1.07;   // как в assets/3d/kit/src/build_court.py
export const NET_BOTTOM = 0.02;
const TOP_INSET = 0.05;             // верхний ряд узлов прячется под белой лентой (6,4 см)
const SUB = 2;                      // узлов на ячейку по каждой оси
const H = 1 / 120;                  // шаг расчёта, с
const ITER = 5;                     // проходов по связям за шаг
const G = 9.8;

/** Высота троса сетки: 0,914 м в центре, 1,07 м у столбов (та же формула, что у court.glb). */
export function netTop(x) {
  const t = Math.min(Math.abs(x) / POST_X, 1);
  return NET_CENTER + (NET_POST - NET_CENTER) * (0.25 * t + 0.75 * Math.pow(t, 1.6));
}
/** Верхний край полотна (под лентой). */
export const clothTop = (x) => netTop(x) - TOP_INSET;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Мир сцены: участок сетки от x0 до x1 (остальная сетка неподвижна) и мячи.
 *   rows — рядов ячеек по высоте; random — генератор [0, 1) для бросков.
 */
export function createWorld({ x0 = 1.0, x1 = 5.2, rows = 21, random = Math.random, wind = 1 } = {}) {
  x0 = Math.round(x0 / CELL) * CELL;
  x1 = Math.round(x1 / CELL) * CELL;
  const cols = Math.round((x1 - x0) / CELL);
  const nx = cols * SUB + 1, ny = rows * SUB + 1, N = nx * ny;
  const dx = CELL / SUB;
  const pos = new Float32Array(N * 3), prev = new Float32Array(N * 3), base = new Float32Array(N * 3);
  const pin = new Uint8Array(N);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3, x = x0 + i * dx, top = clothTop(x);
      pos[k] = x;
      pos[k + 1] = top - (top - NET_BOTTOM) * j / (ny - 1);
      pos[k + 2] = 0;
      pin[j * nx + i] = (j === 0 || i === 0 || i === nx - 1) ? 1 : 0;
    }
  }
  prev.set(pos); base.set(pos);

  // связи: сосед справа и сосед снизу
  const A = [], B = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (i < nx - 1) { A.push(k); B.push(k + 1); }
      if (j < ny - 1) { A.push(k); B.push(k + nx); }
    }
  }
  const cA = Int32Array.from(A), cB = Int32Array.from(B), cL = new Float32Array(A.length);
  for (let c = 0; c < cA.length; c++) {
    const a = cA[c] * 3, b = cB[c] * 3;
    cL[c] = Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]);
  }

  const balls = [];
  let nextId = 1, acc = 0, time = 0;
  const world = {
    x0, x1, nx, ny, N, dx, pos, base, pin, balls,
    rx: nx * 2 - 1, ry: ny * 2 - 1,
    wind,                       // 0 — без ветра
    still: false,               // true — сетка и мячи замирают (prefers-reduced-motion)
  };

  /* ---------------- сетка ---------------- */

  function integrate(h, t) {
    const h2 = h * h, damp = 0.991, w = world.wind;
    for (let k = 0; k < N; k++) {
      if (pin[k]) continue;
      const i3 = k * 3, x = pos[i3], y = pos[i3 + 1], z = pos[i3 + 2];
      const vx = (x - prev[i3]) * damp, vy = (y - prev[i3 + 1]) * damp, vz = (z - prev[i3 + 2]) * damp;
      prev[i3] = x; prev[i3 + 1] = y; prev[i3 + 2] = z;
      const bx = base[i3], by = base[i3 + 1];
      const wz = w ? w * windAt(t, bx, by) : 0;
      pos[i3] = x + vx - (x - bx) * 2.2 * h2;
      pos[i3 + 1] = y + vy + (-1.6 - (y - by) * 7.0) * h2;
      pos[i3 + 2] = z + vz + (wz - (z - base[i3 + 2]) * 10.0) * h2;
    }
  }

  // лёгкий вечерний ветер: медленная волна вдоль сетки и мелкая рябь
  function windAt(t, bx, by) {
    return (Math.sin(t * 0.9 + bx * 0.55) * 0.5 + Math.sin(t * 2.3 + bx * 1.9 + by * 5.0) * 0.22) * 0.16;
  }

  function relax() {
    for (let c = 0; c < cA.length; c++) {
      const ka = cA[c], kb = cB[c], pa = pin[ka], pb = pin[kb];
      if (pa && pb) continue;
      const a = ka * 3, b = kb * 3;
      let ex = pos[b] - pos[a], ey = pos[b + 1] - pos[a + 1], ez = pos[b + 2] - pos[a + 2];
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6;
      const s = ((d - cL[c]) / d) * (pa || pb ? 1 : 0.5);
      ex *= s; ey *= s; ez *= s;
      if (!pa) { pos[a] += ex; pos[a + 1] += ey; pos[a + 2] += ez; }
      if (!pb) { pos[b] -= ex; pos[b + 1] -= ey; pos[b + 2] -= ez; }
    }
  }

  // Мяч прилетел с дальней стороны (−z) и давит на сетку в сторону зрителя (+z):
  // узлы над мячом не могут оказаться ниже его передней полусферы.
  // Проверка идёт по высоте над мячом, а не по расстоянию до центра, поэтому быстрый мяч не проскочит сетку.
  function collide(h) {
    for (const b of balls) {
      if (!b.touch) continue;
      const rc = RC * b.scale, rc2 = rc * rc;
      if (b.z + rc < -0.02) continue;
      const i0 = Math.max(1, Math.floor((b.x - rc - x0) / dx)), i1 = Math.min(nx - 2, Math.ceil((b.x + rc - x0) / dx));
      if (i1 < i0) continue;
      const top = clothTop(b.x), span = (top - NET_BOTTOM) / (ny - 1);
      const j0 = Math.max(1, Math.floor((top - (b.y + rc)) / span) - 2), j1 = Math.min(ny - 1, Math.ceil((top - (b.y - rc)) / span) + 2);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = (j * nx + i) * 3;
          const ex = pos[k] - b.x, ey = pos[k + 1] - b.y, d2 = ex * ex + ey * ey;
          if (d2 >= rc2) continue;
          const zmin = b.z + Math.sqrt(rc2 - d2);
          if (pos[k + 2] < zmin) {
            pos[k + 2] = zmin;
            const vz = b.vz > 0 ? b.vz : 0;           // сетка идёт вместе с мячом, а не отлетает от него
            if (pos[k + 2] - prev[k + 2] > vz * h) prev[k + 2] = zmin - vz * h;
          }
        }
      }
    }
  }

  // нижний край сетки не уходит в грунт
  function floor() {
    for (let j = ny - 4; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = (j * nx + i) * 3 + 1;
        if (pos[k] < 0.006) pos[k] = 0.006;
      }
    }
  }

  /** Толчок сетки: узлы в радиусе R от точки (px, py) получают скорость. dz < 0 — от зрителя. */
  function impulse(px, py, R, dz, ddx, ddy) {
    const R2 = R * R;
    const i0 = Math.max(1, Math.floor((px - R - x0) / dx)), i1 = Math.min(nx - 2, Math.ceil((px + R - x0) / dx));
    for (let j = 1; j < ny; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = (j * nx + i) * 3;
        const ex = pos[k] - px, ey = pos[k + 1] - py, d2 = ex * ex + ey * ey;
        if (d2 > R2) continue;
        const f = 1 - Math.sqrt(d2) / R, ff = f * f;
        prev[k + 2] -= dz * ff; prev[k] -= ddx * ff; prev[k + 1] -= ddy * ff;
      }
    }
    // мячи в сетке качаются вместе с ней
    for (const b of balls) {
      if (b.phase !== 'held') continue;
      const d = Math.hypot(b.x - px, b.y - py);
      if (d > R) continue;
      const f = 1 - d / R;
      b.vz += dz * f * f / H * 0.8;
    }
  }

  /* ---------------- мячи ---------------- */

  // кольцо узлов вокруг кармана: по нему мяч узнаёт, куда качнулась сетка
  function ringOf(ax, ay) {
    const list = [];
    const i0 = Math.max(1, Math.floor((ax - 0.34 - x0) / dx)), i1 = Math.min(nx - 2, Math.ceil((ax + 0.34 - x0) / dx));
    for (let j = 1; j < ny; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * nx + i, d = Math.hypot(base[k * 3] - ax, base[k * 3 + 1] - ay);
        if (d >= 0.25 && d <= 0.33) list.push(k);
      }
    }
    return Int32Array.from(list);
  }
  function ringShift(b) {
    const r = b.ring;
    if (!r || !r.length) return 0;
    let s = 0;
    for (let n = 0; n < r.length; n++) s += pos[r[n] * 3 + 2];
    return s / r.length;
  }

  function hold(b, x, y, depth) {
    b.phase = 'held'; b.t = 0; b.touch = true;
    b.ax = x; b.ay = y; b.az = depth;
    b.ring = ringOf(x, y);
    b.ringRef = ringShift(b);
    b.follow = 0;
  }

  /** Мяч, который уже лежит в сетке (мяч чемпионов): остаётся навсегда. */
  function addLodged({ x, y, depth = 0.105, data = null }) {
    [x, y] = snap(x, y);
    const b = { id: nextId++, x, y, z: -RC, vx: 0, vy: 0, vz: 0, scale: 1, phase: 'held', t: 0, age: 0, permanent: true, touch: true, hit: 0, data };
    hold(b, x, y, depth);
    b.settling = true; b.z = depth;
    balls.push(b);
    // Сетка должна обтянуть мяч до первого кадра. Чтобы не считать это долго, сразу ставим узлы
    // в форму кармана (у натянутой сетки прогиб спадает по логарифму расстояния) и даём ей коротко осесть.
    const tip = depth + RC, R0 = 0.5, r0 = 0.02, k = Math.log(R0 / r0);
    for (let n = 0; n < N; n++) {
      if (pin[n]) continue;
      const r = Math.hypot(base[n * 3] - x, base[n * 3 + 1] - y);
      if (r >= R0) continue;
      const z = tip * Math.log(R0 / Math.max(r, r0)) / k;
      pos[n * 3 + 2] = z; prev[n * 3 + 2] = z;
    }
    const wasWind = world.wind; world.wind = 0;
    for (let s = 0; s < 110; s++) substep(H);
    world.wind = wasWind;
    b.settling = false; b.ringRef = ringShift(b); b.follow = 0; b.vz = 0;
    return b;
  }

  /** Ближайшее перекрестье нитей: мяч ложится на крест из двух нитей, как на ключевом кадре. */
  function snap(x, y) {
    const i = clamp(Math.round((x - x0) / CELL), 6, cols - 6);
    const sx = x0 + i * CELL, top = clothTop(sx), ch = (top - NET_BOTTOM) / rows;
    const j = clamp(Math.round((top - y) / ch), 3, rows - 3);
    return [sx, top - j * ch];
  }

  /**
   * Куда можно бросить: свободное перекрестье в пределах живого участка сетки.
   * ok(x, y) — можно ли тут ловить: сцена не даёт мячу встать под текст или уйти за край кадра.
   */
  function aim(x, y, ok = null) {
    x = clamp(x, x0 + 0.3, x1 - 0.3);
    y = clamp(y, 0.16, clothTop(x) - 0.14);
    const free = (cx, cy) => !ok || ok(cx, cy);
    const [sx, sy] = snap(x, y);
    const takerOf = (px, py) => balls.find((o) => {
      if (o.phase === 'fall' || o.phase === 'gone') return false;
      const ox = o.phase === 'fly' ? o.tx : o.ax, oy = o.phase === 'fly' ? o.ty : o.ay;
      return Math.hypot(px - ox, py - oy) < 0.15;
    }) || null;
    if (free(sx, sy) && !takerOf(sx, sy)) return [sx, sy, null];
    // занято или нельзя — ищем ближайшее свободное перекрестье по кругу, шагом в две ячейки.
    // Свободного нет — мяч встаёт на место старого (не мяча чемпионов), а старый выпадает.
    const step = 2 * CELL;
    let spare = null;
    for (let ring = 1; ring <= 9; ring++) {
      for (let dj = -ring; dj <= ring; dj++) {
        for (let di = -ring; di <= ring; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
          const [cx, cy] = snap(sx + di * step, sy + dj * step);
          if (!free(cx, cy)) continue;
          const t = takerOf(cx, cy);
          if (!t) return [cx, cy, null];
          if (!spare && !t.permanent) spare = [cx, cy, t];
        }
      }
    }
    return spare || [sx, sy, null];
  }

  /**
   * Курсор толкает сетку: точка (x, y) в плоскости сетки и скорость курсора в ней, м/с.
   * Чем быстрее движение, тем сильнее толчок; сетка уходит от зрителя и чуть тянется за курсором.
   */
  function poke(x, y, vx, vy, dt) {
    if (world.still) return;
    if (x < x0 - 0.2 || x > x1 + 0.2 || y < 0 || y > clothTop(x) + 0.1) return;
    const f = clamp(dt * 60, 0.25, 3), sp = Math.hypot(vx, vy);
    if (sp < 0.03) return;
    impulse(x, y, 0.2, -(0.0002 + Math.min(0.012, sp * 0.0016)) * f, clamp(vx, -5, 5) * 0.0001 * f, clamp(vy, -5, 5) * 0.0001 * f);
  }

  /** Бросок мяча в точку сетки (x, y). Мяч летит с дальней половины корта к зрителю. */
  function throwAt(x, y, { data = null, hold: holdFor = 9, from = null, ok = null } = {}) {
    let bump;
    [x, y, bump] = aim(x, y, ok);
    if (bump) release(bump);                     // новый мяч выбивает старый с этого места
    const T = 0.72 + random() * 0.14;
    const sx = from ? from[0] : x - 0.4 - random() * 1.6;
    const sy = from ? from[1] : 0.75 + random() * 0.5;
    const sz = from ? from[2] : -(5.0 + random() * 1.2);
    const b = {
      id: nextId++, x: sx, y: sy, z: sz,
      vx: (x - sx) / T, vy: (y - sy) / T + 0.5 * G * T, vz: (-RC - sz) / T,
      scale: 1, phase: 'fly', t: 0, age: 0, permanent: false, touch: false, hit: 0,
      tx: x, ty: y, holdFor, data,
    };
    balls.push(b);
    // слишком много мячей в сетке — самый старый выпадает
    const caught = balls.filter((o) => !o.permanent && o.phase !== 'fall');
    if (caught.length > 5) release(caught[0]);
    return b;
  }

  function release(b) {
    if (b.phase === 'fall') return;
    b.phase = 'fall'; b.t = 0;
    b.vz = -0.9; b.vx = (random() - 0.5) * 0.3; b.vy = 0;
  }

  function stepBall(b, h) {
    b.age += h; b.t += h;
    if (b.phase === 'fly') {
      b.vy -= G * h;
      b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      if (b.y < BALL_R) { b.y = BALL_R; if (b.vy < 0) b.vy = -b.vy * 0.45; }
      if (b.z + RC >= 0) {                       // коснулся сетки
        b.hit = Math.hypot(b.vx, b.vy, b.vz);
        hold(b, b.tx, b.ty - 0.012, 0.12 + random() * 0.02);
        b.vx *= 0.35; b.vy *= 0.35;
      }
      return;
    }
    if (b.phase === 'held') {
      // сетка — пружина с затуханием: гасит удар, прогибается и возвращает мяч в карман
      const wz = 21, zz = 0.62, wxy = 15, zxy = 0.95;
      // мяч качается вместе с сеткой: быстрые волны вокруг кармана передаются мячу, медленная усадка — нет
      const shift = ringShift(b);
      if (b.settling || b.t < 0.3) { b.ringRef = shift; b.follow = 0; }
      else {
        b.ringRef += (shift - b.ringRef) * h / 1.0;
        b.follow = clamp((shift - b.ringRef) * 0.6, -0.022, 0.022);
      }
      const tz = b.az + b.follow;
      b.vz += (-wz * wz * (b.z - tz) - 2 * zz * wz * b.vz) * h;
      b.vx += (-wxy * wxy * (b.x - b.ax) - 2 * zxy * wxy * b.vx) * h;
      b.vy += (-wxy * wxy * (b.y - b.ay) - 2 * zxy * wxy * b.vy) * h;
      b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      if (!b.permanent && b.t > b.holdFor) release(b);
      return;
    }
    if (b.phase === 'fall') {
      b.vy -= G * h;
      b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      if (b.y < BALL_R) {
        b.y = BALL_R;
        if (b.vy < 0) b.vy = -b.vy * 0.42;
        b.vx *= 0.985; b.vz *= 0.985;
      }
      if (b.z > -RC) { b.z = -RC; if (b.vz > 0) b.vz = 0; }   // обратно сквозь сетку не возвращается
      if (b.z + RC < -0.03) b.touch = false;
      if (b.t > 2.4) b.scale = clamp(1 - (b.t - 2.4) / 0.45, 0, 1);
      if (b.scale <= 0) b.phase = 'gone';
    }
  }

  /* ---------------- шаг ---------------- */

  function substep(h) {
    time += h;
    for (const b of balls) stepBall(b, h);
    integrate(h, time);
    for (let it = 0; it < ITER; it++) { relax(); collide(h); }
    floor();
  }

  /** Продвинуть мир на dt секунд. Возвращает число сделанных шагов. */
  function step(dt) {
    if (world.still) return 0;
    acc += Math.min(Math.max(dt, 0), 0.05);
    let n = 0;
    while (acc >= H && n < 6) { substep(H); acc -= H; n++; }
    if (n === 6) acc = 0;
    for (let i = balls.length - 1; i >= 0; i--) if (balls[i].phase === 'gone') balls.splice(i, 1);
    return n;
  }

  /**
   * Позиции для отрисовки: сетка узлов, сглаженная вдвое (сплайн Катмулла — Рома),
   * чтобы нити плавно огибали мяч. out — Float32Array(rx * ry * 3).
   */
  const tmp = new Float32Array((nx * 2 - 1) * ny * 3);
  function fillRender(out) {
    const rx = world.rx, ry = world.ry;
    // 1) вдоль ряда
    for (let j = 0; j < ny; j++) {
      const src = j * nx * 3, dst = j * rx * 3;
      for (let i = 0; i < nx; i++) {
        const s = src + i * 3, d = dst + i * 6;
        tmp[d] = pos[s]; tmp[d + 1] = pos[s + 1]; tmp[d + 2] = pos[s + 2];
        if (i === nx - 1) break;
        const a = src + Math.max(i - 1, 0) * 3, c = s + 3, e = src + Math.min(i + 2, nx - 1) * 3;
        for (let q = 0; q < 3; q++) tmp[d + 3 + q] = (9 * (pos[s + q] + pos[c + q]) - pos[a + q] - pos[e + q]) / 16;
      }
    }
    // 2) между рядами
    const rowLen = rx * 3;
    for (let j = 0; j < ny; j++) {
      const s = j * rowLen, d = j * 2 * rowLen;
      for (let q = 0; q < rowLen; q++) out[d + q] = tmp[s + q];
      if (j === ny - 1) break;
      const a = Math.max(j - 1, 0) * rowLen, c = s + rowLen, e = Math.min(j + 2, ny - 1) * rowLen, m = d + rowLen;
      for (let q = 0; q < rowLen; q++) out[m + q] = (9 * (tmp[s + q] + tmp[c + q]) - tmp[a + q] - tmp[e + q]) / 16;
    }
    return out;
  }

  Object.assign(world, { step, impulse, poke, addLodged, throwAt, release, aim, snap, fillRender, H, RC });
  return world;
}
