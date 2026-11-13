// TLTS · главная · 3D-сцена первого экрана «мяч пары в сетке».
// Собрана из трёх макетов:
//   s2 «Сетка и сеть»  — сетка-ткань на интегрировании Верле, курсор толкает, бросок мяча (физика — home-net.js);
//   s5 «Мяч пары»      — шейдер двух половин по настоящей кривой шва на модели ball.glb;
//   s4 «Прямой эфир»   — грунтовый корт court.glb, закатное небо, низкое солнце, пыль в контровом свете.
// Настроение — как у кадров assets/3d/keyvisual: закат, глубокий тёмно-синий, мяч в кармане сетки.
// Всё здесь — украшение (canvas с aria-hidden): смысл первого экрана живёт в HTML.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { createWorld, CELL, BALL_R, NET_BOTTOM, clothTop } from './home-net.js';

const ASSET = new URL('../assets/3d/', import.meta.url).href;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// солнце низко за сеткой, чуть справа от оси кадра; направленный свет идёт оттуда же, чуть выше горизонта
const SUN = new THREE.Vector3(-0.2, 0.125, -1).normalize();
const LIGHT = new THREE.Vector3(-0.22, 0.14, -1).normalize();

// ракурс ключевого кадра: камера сбоку и чуть ниже мяча, оптическая ось смотрит на мяч,
// а сдвиг объектива ставит его в правую нижнюю треть — слева сверху остаётся место под заголовок
const VIEW = { yaw: 25, pitch: -1.8, dist: 0.88, fov: 32.3, shiftX: 0.15, shiftY: 0.21 };
const VIEW_TALL = { yaw: 22, pitch: -1.8, dist: 0.95, fov: 42, shiftX: 0.1, shiftY: 0.2 };
// Сцена сменяет готовый кадр hero-16x9.webp, и мяч не должен при этом «сжиматься».
// Кадр стоит с object-fit: cover, поэтому на окне шире 16:9 он растянут по ширине — объектив
// приближаем так же. STILL_ZOOM — разница масштаба на 16:9 (мяч 135 px в кадре против 107 px в сцене на 1440×900).
const STILL_ZOOM = 1.26;
const STILL_ASPECT = 2400 / 1350;
// Брошенный мяч ловится правее текста (заголовок, кнопки, плашка результата): между текстом
// и краем мяча остаётся не меньше TEXT_GAP px
const TEXT_GAP = 28;

/* ------------------------------------------------------------------ общие мелочи */

function cssToken(name, fallback) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch { return fallback; }
}
// цвет как есть (sRGB), для шейдеров без тонмаппинга и для canvas
function rawRGB(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex).trim());
  return m ? new THREE.Vector3(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255) : new THREE.Vector3(0.06, 0.08, 0.14);
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const loadGLB = (url) => new Promise((res, rej) => new GLTFLoader().load(url, res, undefined, rej));

/* ------------------------------------------------------------------ небо (s4) */

function makeSky(zenith) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    uniforms: { uSun: { value: SUN.clone() }, uZen: { value: zenith } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vDir; uniform vec3 uSun; uniform vec3 uZen;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 mid = vec3(0.150, 0.135, 0.255), low = vec3(0.50, 0.25, 0.24), hor = vec3(0.90, 0.47, 0.24);
        float s = max(dot(d, uSun), 0.0);
        vec3 c = mix(hor, low, smoothstep(0.0, 0.06, h));
        c = mix(c, mid, smoothstep(0.035, 0.15, h));
        c = mix(c, uZen, smoothstep(0.10, 0.34, h));
        // закат горит только в стороне солнца; остальное небо — уже ночь
        float side = 0.10 + 0.90 * pow(s, 5.0);
        c = mix(mix(uZen, mid, 0.3), c, side);
        c += vec3(1.0, 0.56, 0.27) * pow(s, 14.0) * 0.34 + vec3(1.0, 0.74, 0.46) * pow(s, 110.0) * 0.38
           + vec3(1.0, 0.90, 0.72) * pow(s, 2600.0) * 0.9;
        c = mix(c, vec3(0.07, 0.06, 0.08), smoothstep(0.0, -0.08, h));
        c += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), m);
  sky.renderOrder = -10; sky.frustumCulled = false;
  return sky;
}

/* ------------------------------------------------------------------ ограждение и деревья (s4) */

function windscreenTex(pal) {
  return canvasTex(1024, 296, (x, w, h) => {
    x.fillStyle = pal.screen; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.022)' : 'rgba(0,0,0,.07)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    x.fillStyle = pal.clay; x.globalAlpha = 0.5; x.fillRect(0, 0, w, 8); x.globalAlpha = 1;
    x.fillStyle = 'rgba(255,255,255,.035)'; x.fillRect(0, h - 30, w, 2);
  });
}
function makeWindscreens(pal) {
  const W = 9.25, Z = 18.4, Hh = 2.5;
  const tex = windscreenTex(pal); tex.wrapS = THREE.RepeatWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide, fog: true });
  const g = new THREE.Group();
  const mk = (len, x, z, ry) => {
    const geo = new THREE.PlaneGeometry(len, Hh); geo.translate(0, Hh / 2, 0);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 8.6);
    const m = new THREE.Mesh(geo, mat); m.rotation.y = ry; m.position.set(x, 0, z); g.add(m);
  };
  mk(2 * W, 0, -Z, 0); mk(2 * Z, -W, 0, Math.PI / 2); mk(2 * Z, W, 0, -Math.PI / 2);
  return g;
}
// кольцо силуэтов вокруг корта: kind 'trees' — кромка леса с пирамидальными тополями,
// 'ridge' — далёкий хребет Заилийского Алатау (к югу, слева от заката)
function skyline(R, Hh, seed, dark, lit, rep, kind = 'trees') {
  let sd = seed; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const tex = canvasTex(2048, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#fff';
    if (kind === 'ridge') {
      // профиль хребта: выше к югу, сходит на нет к закату; зубцы — сумма синусов и мелкий шум
      const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
      const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
      x.beginPath(); x.moveTo(0, h);
      for (let px = 0; px <= w; px += 2) {
        const u = px / w, a = u * Math.PI * 2;
        const env = 0.1 + 0.9 * sm(0.47, 0.7, u) * (1 - sm(0.86, 0.99, u));
        const jag = 0.56 + 0.2 * Math.sin(a * 9 + ph[0]) + 0.13 * Math.sin(a * 23 + ph[1]) + 0.07 * Math.sin(a * 57 + ph[2]) + 0.04 * Math.sin(a * 131 + ph[3]);
        x.lineTo(px, h - h * 0.94 * env * jag);
      }
      x.lineTo(w, h); x.closePath(); x.fill();
    } else {
      x.fillRect(0, h * 0.62, w, h);
      const blob = (cx, cy, rw, rh) => {
        for (const ox of [0, w, -w]) { x.beginPath(); x.ellipse(cx + ox, cy, rw, rh, 0, 0, Math.PI * 2); x.fill(); }
      };
      // кроны: много мелких пятен вдоль плавной волны — кромка леса, а не ряд куполов
      const ph1 = rnd() * 6.28, ph2 = rnd() * 6.28;
      for (let i = 0; i < 1100; i++) {
        const cx = rnd() * w, u = cx / w * Math.PI * 2;
        const crest = 0.5 + 0.28 * Math.sin(u * 3 + ph1) + 0.22 * Math.sin(u * 7 + ph2);
        const r = 6 + rnd() * 15;
        blob(cx, h * 0.62 - rnd() * h * (0.05 + 0.2 * crest), r, r * (0.8 + rnd() * 0.5));
      }
      // пирамидальные тополя: узкие веретёна
      for (let i = 0; i < 20; i++) {
        const cx = rnd() * w, rh = 17 + rnd() * 15, rw = 4.5 + rnd() * 3;
        blob(cx, h * 0.62 - rh * 1.2, rw, rh);
      }
    }
    x.globalCompositeOperation = 'source-atop';
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(150,150,150,1)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }, false);
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(rep, 1);
  const geo = new THREE.CylinderGeometry(R, R, Hh, 96, 1, true); geo.translate(0, Hh / 2 - 0.2, 0);
  const col = new Float32Array(geo.attributes.position.count * 3), c = new THREE.Color(), cd = new THREE.Color(dark), cl = new THREE.Color(lit);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vz = p.getZ(i), l = Math.hypot(vx, vz) || 1;
    const facing = (1 - (vx / l * SUN.x + vz / l * SUN.z)) / 2;   // 0 — против солнца (силуэт), 1 — освещённая сторона
    c.copy(cd).lerp(cl, Math.pow(facing, 1.6)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, fog: kind !== 'ridge' }));
  m.renderOrder = kind === 'ridge' ? -7 : -5;
  return m;
}

/* ------------------------------------------------------------------ мяч пары (s5) */

// шов настоящего теннисного мяча: та же кривая, что в текстуре ball.glb и в SVG-мяче card.js
const SEAM = (() => {
  const a = 0.7, b = 0.3, c = 2 * Math.sqrt(a * b), N = 720;
  const P = new Float32Array(N * 3), L = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = i / N * Math.PI * 2;
    const x = a * Math.cos(t) + b * Math.cos(3 * t), y = c * Math.sin(2 * t), z = -(a * Math.sin(t) - b * Math.sin(3 * t));
    const l = Math.hypot(x, y, z); P[i * 3] = x / l; P[i * 3 + 1] = y / l; P[i * 3 + 2] = z / l;
  }
  for (let i = 0; i < N; i++) {
    const n = (i + 1) % N, m = (i - 1 + N) % N;
    const tx = P[n * 3] - P[m * 3], ty = P[n * 3 + 1] - P[m * 3 + 1], tz = P[n * 3 + 2] - P[m * 3 + 2];
    const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
    L[i * 3] = py * tz - pz * ty; L[i * 3 + 1] = pz * tx - px * tz; L[i * 3 + 2] = px * ty - py * tx;
  }
  return { P, L, N };
})();
function seamAt(x, y, z) {
  const { P, L, N } = SEAM; let best = -2, bi = 0;
  for (let i = 0; i < N; i++) { const d = P[i * 3] * x + P[i * 3 + 1] * y + P[i * 3 + 2] * z; if (d > best) { best = d; bi = i; } }
  const dist = Math.acos(Math.min(1, best));
  return (L[bi * 3] * x + L[bi * 3 + 1] * y + L[bi * 3 + 2] * z) >= 0 ? dist : -dist;
}
// знак расстояния до шва на каждой вершине: по нему шейдер красит половины
function addSeam(geo) {
  const pos = geo.attributes.position, n = pos.count, sd = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v), l = Math.hypot(x, y, z) || 1;
    sd[v] = seamAt(x / l, y / l, z / l);
  }
  geo.setAttribute('aSeam', new THREE.BufferAttribute(sd, 1));
  return geo;
}
// мяч смотрит швом на зрителя: S-образная линия, половины видны поровну
const Q_BASE = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeRotationZ(-20 * D2R).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));

const BALL_V_PARS = 'attribute float aSeam; varying float vSeam; varying vec3 vObjP;';
const BALL_V_MAIN = 'vSeam = aSeam; vObjP = position;';
const BALL_F_PARS = `
varying float vSeam; varying vec3 vObjP;
uniform vec3 uColA; uniform vec3 uColB; uniform float uSeamW;
float pbHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float pbNoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
return mix(mix(mix(pbHash(i), pbHash(i + vec3(1,0,0)), f.x), mix(pbHash(i + vec3(0,1,0)), pbHash(i + vec3(1,1,0)), f.x), f.y),
mix(mix(pbHash(i + vec3(0,0,1)), pbHash(i + vec3(1,0,1)), f.x), mix(pbHash(i + vec3(0,1,1)), pbHash(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
const BALL_F_MAP = `
float pbSd = vSeam;
float pbAA = max(fwidth(pbSd) * 1.25, 0.0015);
float pbSide = smoothstep(-pbAA, pbAA, pbSd);
vec3 pbHalf = mix(uColB, uColA, pbSide);
float pbSeam; float pbTone; vec3 pbSeamCol;
#ifdef USE_MAP
vec4 pbTx = texture2D(map, vMapUv);
pbSeam = smoothstep(0.07, 0.30, pbTx.b);
pbTone = clamp((pbTx.g - 0.55) / 0.31, 0.0, 1.0);
pbSeamCol = pbTx.rgb * vec3(1.02, 1.02, 1.06);
#else
pbSeam = 1.0 - smoothstep(uSeamW - pbAA, uSeamW + pbAA, abs(pbSd));
pbTone = pbNoise(vObjP * 38.0) * 0.6 + pbNoise(vObjP * 7.0) * 0.4;
pbSeamCol = vec3(0.84, 0.84, 0.80);
#endif
vec3 pbFelt = pbHalf * mix(0.66, 0.9, pbTone);
diffuseColor.rgb = mix(pbFelt, pbSeamCol, pbSeam);
`;
const BALL_F_ROUGH = 'roughnessFactor = mix(roughnessFactor, 0.55, pbSeam);';

function ballMaterial(kit) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: kit ? 1 : 0.94,
    sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.75, 0.75, 0.75),
    map: kit ? kit.map : null, normalMap: kit ? kit.normalMap : null, roughnessMap: kit ? kit.roughnessMap : null,
  });
  if (kit) m.normalScale.copy(kit.normalScale);
  m.envMapIntensity = 0.36;
  const u = { uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uSeamW: { value: 0.068 } };
  m.userData.u = u;
  const lights = THREE.ShaderChunk.lights_physical_fragment.replace('material.sheenColor = sheenColor;', 'material.sheenColor = sheenColor * (1.0 - pbSeam) * mix(vec3(1.0), pbHalf, 0.72);');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + BALL_V_PARS).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + BALL_V_MAIN);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + BALL_F_PARS)
      .replace('#include <map_fragment>', BALL_F_MAP)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + BALL_F_ROUGH)
      .replace('#include <lights_physical_fragment>', lights);
  };
  m.customProgramCacheKey = () => 'tlts-pairball|' + (kit ? 'kit' : 'proc');
  return m;
}

/* ------------------------------------------------------------------ сетка: нити рисует шейдер (s2) */

const NET_VS = `
varying vec2 vCell; varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vCell = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const NET_FS = `
uniform float uThick; uniform float uKnot; uniform vec3 uSun;
uniform vec3 uCord; uniform vec3 uLit; uniform vec3 uRim; uniform float uOpacity;
varying vec2 vCell; varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 g = vCell;
  vec2 sg = fract(g + 0.5) - 0.5;            // смещение от ближайшей нити, в ячейках
  vec2 f = abs(sg);
  vec2 aa = max(fwidth(g), vec2(1e-4)) * 0.75;
  float hw = uThick * 0.5;
  vec2 line = 1.0 - smoothstep(vec2(hw) - aa, vec2(hw) + aa, f);
  line *= min(vec2(1.0), 5.0 * hw / aa);     // вдали нить тоньше пикселя: не даём сетке слиться в завесу
  float kaa = max(aa.x, aa.y);
  float knot = (1.0 - smoothstep(uKnot - kaa, uKnot + kaa, length(f))) * min(1.0, 4.0 * uKnot / kaa);
  float cov = max(max(line.x, line.y), knot);
  if (cov < 0.012) discard;

  // контровой свет: чем ближе взгляд к солнцу, тем светлее нить; у нити светится кромка со стороны света
  vec3 vd = normalize(vWorld - cameraPosition);
  float back = pow(max(dot(vd, uSun), 0.0), 2.5);
  float sideV = clamp(sg.x / hw, -1.0, 1.0);            // вертикальная нить: кромка справа, к солнцу
  float sideH = clamp(-sg.y / hw, -1.0, 1.0);           // горизонтальная нить: кромка сверху, к небу
  float rim = line.x >= line.y ? smoothstep(0.05, 0.95, sideV) : smoothstep(0.05, 0.95, sideH) * 0.75;
  rim = mix(rim, 0.6, knot);
  vec3 col = mix(uCord, uLit, 0.06 + 0.5 * back);
  col += uRim * rim * (0.07 + 0.8 * back);

  gl_FragColor = vec4(col, cov * uOpacity);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function netMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uThick: { value: 0.058 }, uKnot: { value: 0.05 }, uSun: { value: SUN.clone() }, uOpacity: { value: 1 },
      uCord: { value: new THREE.Color(0x08090d) }, uLit: { value: new THREE.Color(0x574739) }, uRim: { value: new THREE.Color(0xff9d5c) },
    }]),
    vertexShader: NET_VS, fragmentShader: NET_FS,
    side: THREE.DoubleSide, transparent: true, depthWrite: false, fog: true,
  });
  m.extensions.derivatives = true;    // fwidth на старом WebGL 1
  return m;
}

// живой участок сетки: вершины обновляются каждый кадр
function liveNetGeometry(world) {
  const { rx, ry } = world, n = rx * ry;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let j = 0; j < ry; j++) {
    for (let i = 0; i < rx; i++) {
      const k = j * rx + i;
      uv[k * 2] = (world.x0 + i * world.dx / 2) / CELL;
      uv[k * 2 + 1] = j / 4;
    }
  }
  const idx = new Uint16Array((rx - 1) * (ry - 1) * 6);
  let q = 0;
  for (let j = 0; j < ry - 1; j++) {
    for (let i = 0; i < rx - 1; i++) {
      const a = j * rx + i, b = a + 1, c = a + rx, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3); attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  world.fillRender(pos);
  return geo;
}
// остальная сетка до столбов: неподвижная полоса
function staticNetGeometry(xa, xb, rows) {
  const n = Math.max(2, Math.ceil(Math.abs(xb - xa) / 0.18) + 1);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    const x = lerp(xa, xb, i / (n - 1));
    pos.push(x, clothTop(x), 0, x, NET_BOTTOM, 0);
    uv.push(x / CELL, 0, x / CELL, rows);
    if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/* ------------------------------------------------------------------ пыль в контровом свете (s4) */

function makeDust(center, count) {
  const dp = new Float32Array(count * 3), ph = new Float32Array(count), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    dp[i * 3] = center.x + (Math.random() - 0.62) * 3.4;
    dp[i * 3 + 1] = Math.random() * 1.5;
    dp[i * 3 + 2] = 0.8 - Math.pow(Math.random(), 1.5) * 6.5;
    ph[i] = Math.random();
    sz[i] = Math.random() < 0.14 ? 2.2 + Math.random() * 2.6 : 0.5 + Math.random() * 1.1;   // редкие крупные — как блики вне фокуса
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  geo.setAttribute('aSz', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uT: { value: 0 }, uPx: { value: 400 }, uSun: { value: SUN.clone() } },
    vertexShader: `attribute float aPh; attribute float aSz; uniform float uT; uniform float uPx; uniform vec3 uSun; varying float vA; varying float vSoft;
      void main(){
        vec3 p = position;
        p.x += sin(uT * 0.13 + aPh * 6.2831) * 0.22;
        p.z += cos(uT * 0.11 + aPh * 12.566) * 0.22;
        p.y = mod(p.y + uT * (0.012 + 0.03 * aPh), 1.5) + 0.03;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = aSz * uPx * 0.0042 / max(0.25, -mv.z);
        gl_PointSize = clamp(size, 1.0, 26.0);
        vec3 vd = normalize(p - cameraPosition);
        float back = pow(max(dot(vd, uSun), 0.0), 3.0);
        vSoft = aSz > 2.0 ? 1.0 : 0.0;
        vA = (0.10 + 1.25 * back) * smoothstep(1.52, 1.1, p.y) * (0.6 + 0.4 * sin(uT * 1.3 + aPh * 40.0)) * (aSz > 2.0 ? 0.34 : 0.8)
           * smoothstep(0.25, 0.6, -mv.z);
      }`,
    fragmentShader: `varying float vA; varying float vSoft;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float k = mix(smoothstep(0.5, 0.05, d), smoothstep(0.5, 0.38, d), vSoft);
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.46) * k * vA, k * vA);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 1;
  return pts;
}

/* ================================================================== сцена */

/**
 * Поставить сцену в host.
 *   host      блок, куда встаёт canvas
 *   section   блок, на котором слушаем указатель (весь первый экран)
 *   champion  { a, b } — цвета половин мяча, который лежит в сетке
 *   nextPair  () => { a, b, ... } — цвета мяча для следующего броска
 *   onThrow   (пара) — мяч брошен; onState ('live' | 'lost' | 'slow') — что со сценой
 *   force     не сдаваться на медленной графике (проверка в headless-браузере, ?3d=force)
 * Возвращает управление сценой или null, если WebGL не завёлся.
 */
export async function mountHeroScene({ host, section, champion, nextPair, onThrow, onState, force = false }) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.tabIndex = -1;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: !force });
  } catch (e) {
    return null;
  }
  host.appendChild(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const pal = {
    air: cssToken('--c-air', '#0F1424'), screen: cssToken('--c-air', '#0F1424'), clay: cssToken('--c-clay', '#BF4F27'),
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x3d3348, 0.0062);
  const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.05, 700);

  /* ---- свет: низкое солнце из-за сетки, холодное небо сверху, мягкий «телевизионный» свет на мяч ---- */
  const hemi = new THREE.HemisphereLight(0x6f7fbd, 0x6b3520, 0.16);
  const sun = new THREE.DirectionalLight(0xffa25e, 2.6);
  sun.position.copy(LIGHT).multiplyScalar(45);
  const key = new THREE.DirectionalLight(0xdbe4ff, 1.25);
  const rim = new THREE.DirectionalLight(0xff8a45, 2.0);
  scene.add(hemi, sun, sun.target, key, key.target, rim, rim.target);

  scene.add(makeSky(rawRGB(pal.air)));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0f1014, roughness: 1, envMapIntensity: 0.1 }));
  ground.position.y = -0.09; scene.add(ground);
  scene.add(makeWindscreens(pal));
  scene.add(skyline(320, 128, 29, 0x2b2542, 0x1b1a33, 1, 'ridge'));
  scene.add(skyline(40, 12, 3, 0x090c13, 0x2a3040, 3, 'trees'));

  /* ---- мир: участок сетки с физикой и мяч чемпионов в кармане ---- */
  const world = createWorld({ x0: 1.5, x1: 5.0 });
  const champ = world.addLodged({ x: 4.095, y: 0.29, depth: 0.14, data: champion });
  const focus = new THREE.Vector3(champ.ax, champ.ay, champ.az);
  key.position.set(focus.x - 1.9, focus.y + 1.5, focus.z + 0.9); key.target.position.copy(focus);
  rim.position.set(focus.x + 1.6, focus.y + 0.28, focus.z - 0.9); rim.target.position.copy(focus);
  sun.target.position.set(0, 0, 0);

  const netMat = netMaterial();
  const netGeo = liveNetGeometry(world);
  const netMesh = new THREE.Mesh(netGeo, netMat);
  netMesh.frustumCulled = false; netMesh.renderOrder = 3;
  scene.add(netMesh);
  for (const [xa, xb] of [[-6.35, world.x0], [world.x1, 6.35]]) {
    const m = new THREE.Mesh(staticNetGeometry(xa, xb, (world.ny - 1) / 2), netMat);
    m.frustumCulled = false; m.renderOrder = 3; scene.add(m);
  }
  const netPos = netGeo.attributes.position.array;

  const dust = makeDust(focus, 520);
  scene.add(dust);

  /* ---- корт (s4): модель из Blender; её неподвижное полотно сетки заменяет наша ткань ---- */
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function setupCourt(root) {
    const meshes = [];
    root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      const mn = (o.material && o.material.name) || o.name || '';
      if (/net_mesh/.test(mn)) { o.visible = false; continue; }
      if (o.material) o.material.envMapIntensity = 0.5;
      if (/clay/.test(mn)) {
        o.material.color.setRGB(0.74, 0.6, 0.55); o.material.envMapIntensity = 0.22;
        for (const t of [o.material.map, o.material.normalMap, o.material.roughnessMap]) if (t) t.anisotropy = maxAniso;
      } else if (/line/.test(mn)) {
        o.material.polygonOffset = true; o.material.polygonOffsetFactor = -1; o.material.polygonOffsetUnits = -4;
        if (o.material.map) o.material.map.anisotropy = maxAniso;
      }
    }
    scene.add(root);
  }

  /* ---- мячи ---- */
  const ballRig = new Map();   // id мяча из мира → { group, mat }
  let ballGeo = addSeam(new THREE.SphereGeometry(1, 64, 48)), ballKit = null;
  const qCam = new THREE.Quaternion(), qTmp = new THREE.Quaternion(), qRoll = new THREE.Quaternion(), vTmp = new THREE.Vector3();
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  function rigFor(b) {
    let r = ballRig.get(b.id);
    if (r) return r;
    const mat = ballMaterial(ballKit);
    const d = b.data || champion;
    mat.userData.u.uColA.value.set(d.a); mat.userData.u.uColB.value.set(d.b);
    const mesh = new THREE.Mesh(ballGeo, mat);
    const group = new THREE.Group(); group.add(mesh); scene.add(group);
    r = { group, mesh, mat, roll: b.permanent ? 0 : (Math.random() - 0.5) * 1.2, axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), faced: !!b.permanent };
    if (!b.permanent) group.quaternion.setFromAxisAngle(r.axis, Math.random() * 6.28);
    ballRig.set(b.id, r);
    return r;
  }
  function rebuildBalls() {      // пришла модель мяча: меняем геометрию и материал у уже стоящих
    for (const r of ballRig.values()) {
      const old = r.mat;
      r.mat = ballMaterial(ballKit);
      r.mat.userData.u.uColA.value.copy(old.userData.u.uColA.value); r.mat.userData.u.uColB.value.copy(old.userData.u.uColB.value);
      r.mesh.geometry = ballGeo; r.mesh.material = r.mat; old.dispose();
    }
  }
  function syncBalls(dt) {
    const alive = new Set();
    for (const b of world.balls) {
      alive.add(b.id);
      const r = rigFor(b);
      r.group.position.set(b.x, b.y, b.z);
      r.group.scale.setScalar(BALL_R * b.scale);
      if (b.phase === 'fly') { qTmp.setFromAxisAngle(r.axis, dt * 13); r.group.quaternion.premultiply(qTmp); }
      else if (b.phase === 'held') {
        // в кармане мяч поворачивается швом к зрителю: видны обе половины пары
        qRoll.setFromAxisAngle(Z_AXIS, r.roll); qTmp.copy(qCam).multiply(qRoll).multiply(Q_BASE);
        if (r.faced) r.group.quaternion.copy(qTmp);
        else { r.group.quaternion.slerp(qTmp, 1 - Math.exp(-9 * dt)); if (r.group.quaternion.angleTo(qTmp) < 0.01) r.faced = true; }
      } else { qTmp.setFromAxisAngle(r.axis, dt * 4); r.group.quaternion.premultiply(qTmp); r.faced = false; }
    }
    for (const [id, r] of ballRig) {
      if (alive.has(id)) continue;
      scene.remove(r.group); r.mat.dispose(); ballRig.delete(id);
    }
  }

  /* ---- камера трансляции: неподвижный план, лёгкий параллакс от курсора, медленное «дыхание» ---- */
  let W = 0, H = 0, view = VIEW;
  let px = 0, py = 0, tpx = 0, tpy = 0, clock = 0;
  function placeCamera() {
    const yaw = (view.yaw + px * 1.5 + Math.sin(clock * 0.17) * 0.3) * D2R;
    const pitch = (view.pitch - py * 0.7 + Math.sin(clock * 0.13 + 1.3) * 0.12) * D2R;
    const d = view.dist * (1 + Math.sin(clock * 0.11) * 0.008);
    camera.position.set(focus.x + d * Math.sin(yaw) * Math.cos(pitch), focus.y + d * Math.sin(pitch), focus.z + d * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(focus);
  }
  function baseFace() {          // ориентация мячей считается от спокойной камеры, чтобы шов не «плавал» вместе с параллаксом
    const yaw = view.yaw * D2R, pitch = view.pitch * D2R;
    vTmp.set(focus.x + Math.sin(yaw) * Math.cos(pitch), focus.y + Math.sin(pitch), focus.z + Math.cos(yaw) * Math.cos(pitch));
    qCam.setFromRotationMatrix(new THREE.Matrix4().lookAt(vTmp, focus, camera.up));
  }
  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    if (w === W && h === H) return false;
    W = w; H = h;
    renderer.setSize(W, H, false);
    view = W / H < 0.95 ? VIEW_TALL : VIEW;
    const zoom = view === VIEW ? STILL_ZOOM * Math.max(1, (W / H) / STILL_ASPECT) : 1;
    camera.fov = 2 * Math.atan(Math.tan(view.fov * D2R / 2) / zoom) / D2R;
    camera.aspect = W / H;
    camera.setViewOffset(W, H, -view.shiftX * W, -view.shiftY * H, W, H);
    camera.updateProjectionMatrix();
    dust.material.uniforms.uPx.value = H * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * D2R / 2));
    baseFace();
    return true;
  }

  /* ---- указатель: курсор толкает сетку, клик бросает мяч ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  let cur = null, curPrev = null, moved = false;
  function netPoint(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  }
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    tpx = clamp(((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2, -1, 1);
    tpy = clamp(((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2, -1, 1);
    const p = netPoint(e.clientX, e.clientY);
    if (p) { cur = { x: p.x, y: p.y }; moved = true; }
  };
  const onLeave = () => { cur = null; curPrev = null; tpx = 0; tpy = 0; };
  // Брошенный мяч не должен вставать под заголовок и мешать его читать (FIXES В18).
  // радиус мяча в сетке на экране, px (мячи висят примерно на том же расстоянии, что и мяч чемпионов)
  const ballPx = () => (BALL_R / view.dist) / Math.tan(camera.fov * D2R / 2) * H / 2;
  const rectsOf = (sel) => [...section.querySelectorAll(sel)].map((el) => el.getBoundingClientRect()).filter((b) => b.width && b.height);
  // где кончается текст левой колонки (заголовок, кнопки, плашка результата)
  function textEdge(r) {
    let edge = r.left;
    for (const b of rectsOf('[data-scene-avoid="text"]')) if (b.bottom > r.top && b.top < r.bottom) edge = Math.max(edge, b.right);
    edge += TEXT_GAP + ballPx() * 1.15;
    // текст во всю ширину (узкое окно) — свободной полосы справа нет
    return r.right - edge < r.width * 0.22 ? null : edge;
  }
  // клик левее текста переносится в свободную правую часть: левый край окна → сразу за текстом
  function freeX(clientX, r) {
    const edge = textEdge(r);
    if (edge === null || clientX >= edge) return clientX;
    const room = r.right - r.width * 0.04 - edge;
    return edge + clamp((clientX - r.left) / Math.max(1, edge - r.left), 0, 1) * room * 0.45;
  }
  // Можно ли ловить мяч в точке сетки (x, y): мяч в кармане (на глубине мяча чемпионов) целиком в кадре
  // и не заходит на текст первого экрана и подсказку (элементы с data-scene-avoid).
  const vP = new THREE.Vector3();
  function catchTest() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const avoid = rectsOf('[data-scene-avoid]');
    // левее правого края текста мячи не ловятся вовсе (и над заголовком тоже), если справа есть место
    let line = r.left;
    if (textEdge(r) !== null) for (const t of rectsOf('[data-scene-avoid="text"]')) line = Math.max(line, t.right + TEXT_GAP);
    const toScreen = (x, y) => { vP.set(x, y, focus.z).project(camera); return [r.left + (vP.x + 1) / 2 * r.width, r.top + (1 - vP.y) / 2 * r.height]; };
    return (x, y) => {
      const [sx, sy] = toScreen(x, y), rad = Math.abs(toScreen(x + BALL_R, y)[0] - sx) * 1.08;
      if (sx - rad < Math.max(r.left + 6, line) || sx + rad > r.right - 6 || sy - rad < r.top + 6 || sy + rad > r.bottom - 6) return false;
      return !avoid.some((b) => sx + rad > b.left - TEXT_GAP && sx - rad < b.right + TEXT_GAP && sy + rad > b.top - TEXT_GAP && sy - rad < b.bottom + TEXT_GAP);
    };
  }
  function throwBall(x, y) {
    const pair = nextPair ? nextPair() : champion;
    camera.updateMatrixWorld();
    const b = world.throwAt(x, y, { data: pair, ok: catchTest() });
    if (onThrow) onThrow(pair, b);
    return b;
  }
  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('a, button, input, select, textarea, label, summary, [data-no-throw]')) return;
    if (!running) return;                    // сцена стоит (потерян контекст, вне экрана) — бросать некуда
    const fx = freeX(e.clientX, canvas.getBoundingClientRect());
    const p = netPoint(fx, e.clientY);
    if (p) throwBall(p.x, p.y);
  };
  section.addEventListener('pointermove', onMove, { passive: true });
  section.addEventListener('pointerleave', onLeave);
  section.addEventListener('pointerdown', onDown);

  /* ---- цикл: кадр только когда сцена на экране и вкладка видна ---- */
  let running = false, inView = true, lost = false, paused = false, ready = false, dead = false;
  let last = 0, frames = 0, slowT = 0, slowN = 0, stage = 0;
  function frame(now) {
    const dt = last ? Math.min(0.05, Math.max(0.001, (now - last) / 1000)) : 1 / 60;
    last = now; clock += dt;
    resize();
    if (cur && moved && curPrev) world.poke(cur.x, cur.y, (cur.x - curPrev.x) / dt, (cur.y - curPrev.y) / dt, dt);
    if (cur) curPrev = { x: cur.x, y: cur.y };
    moved = false;
    world.step(dt);
    world.fillRender(netPos);
    netGeo.attributes.position.needsUpdate = true;
    syncBalls(dt);
    px += (tpx - px) * Math.min(1, dt * 3.5); py += (tpy - py) * Math.min(1, dt * 3.5);
    placeCamera();
    dust.material.uniforms.uT.value = clock;
    renderer.render(scene, camera);
    frames++;
    if (ready && frames === 2 && onState) onState('live');
    watchSpeed(dt);
  }
  // слабая графика: сначала снижаем плотность пикселей, потом уступаем место готовому кадру
  function watchSpeed(dt) {
    if (force || stage > 1 || !ready || frames < 30) return;
    slowT += dt; slowN++;
    if (slowT < 2.5) return;
    const fps = slowN / slowT; slowT = 0; slowN = 0;
    if (fps >= 30) { if (frames > 600) stage = 2; return; }
    if (stage === 0) { stage = 1; renderer.setPixelRatio(1); W = 0; return; }
    stage = 2; dead = true; sync();
    if (onState) onState('slow');
  }
  function sync() {
    const want = inView && !document.hidden && !lost && !paused && !dead;
    if (want && !running) { running = true; last = 0; renderer.setAnimationLoop(frame); }
    else if (!want && running) { running = false; renderer.setAnimationLoop(null); }
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((en) => { inView = en[en.length - 1].isIntersecting; sync(); }, { threshold: 0.01 }).observe(host);
  const onVisibility = () => sync();
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; sync(); if (onState) onState('lost'); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; W = 0; frames = 0; scene.environment = null; loadEnvironment(); sync(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (!running && !lost && !dead && ready) { resize(); placeCamera(); renderer.render(scene, camera); } }).observe(host);

  /* ---- загрузка: корт и мяч обязательны, HDR заката — по готовности ---- */
  resize(); placeCamera();
  const court = loadGLB(ASSET + 'kit/court.glb').then((g) => setupCourt(g.scene));
  const ball = loadGLB(ASSET + 'kit/ball.glb').then((g) => {
    let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) return;
    const geo = mesh.geometry.clone(); const s = 1 / BALL_R; geo.scale(s, s, s); addSeam(geo);
    const m = mesh.material;
    for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = Math.min(8, maxAniso);
    ballGeo = geo;
    ballKit = { map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, normalScale: m.normalScale ? m.normalScale.clone() : new THREE.Vector2(1, 1) };
    rebuildBalls();
  }).catch((e) => { console.warn('[tlts 3d] ball.glb не загрузился — мяч рисуется процедурно', e && e.message); });
  function loadEnvironment() {   // отражения и общий свет заката; без HDR сцена живёт на трёх источниках
    new RGBELoader().load(ASSET + 'hdr/belfast_sunset_puresky_1k.hdr', (hdr) => {
      if (dead || lost) { hdr.dispose(); return; }
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose(); pmrem.dispose();
    }, undefined, () => {});
  }
  loadEnvironment();

  try {
    await court;                 // без корта сцены нет: остаётся готовый кадр
  } catch (e) {
    console.warn('[tlts 3d] court.glb не загрузился — остаётся готовый кадр', e && e.message);
    dead = true; sync(); renderer.dispose(); canvas.remove();
    section.removeEventListener('pointermove', onMove); section.removeEventListener('pointerleave', onLeave); section.removeEventListener('pointerdown', onDown);
    document.removeEventListener('visibilitychange', onVisibility);
    return null;
  }
  await Promise.race([ball, new Promise((r) => setTimeout(r, 4000))]);
  ready = true; frames = 0;
  sync();

  return {
    /** Бросить мяч случайной пары в случайное место сетки (кнопка для клавиатуры). */
    throwRandom() {
      if (!running) return null;
      // точка выбирается на экране — правее текста, рядом с мячом чемпионов, — и переводится в плоскость сетки
      const r = canvas.getBoundingClientRect();
      const fx = Math.random() < 0.7 ? 0.45 + Math.random() * 0.14 : 0.74 + Math.random() * 0.16;
      const edge = textEdge(r);
      const x = edge === null ? r.left + r.width * fx : edge + (r.right - r.width * 0.04 - edge) * Math.random();
      const y = r.top + r.height * (0.34 + Math.random() * 0.42);
      const p = netPoint(x, y);
      return p ? throwBall(p.x, p.y) : throwBall(focus.x - 0.5, 0.5);
    },
    pause() { paused = true; sync(); },
    resume() { paused = false; sync(); },
    get running() { return running; },
    /** Сцена исправна: загружена, контекст на месте, графика справляется. */
    get alive() { return ready && !lost && !dead; },
    /** Состояние для проверки: сколько мячей, идёт ли кадр. */
    probe() {
      return {
        running, ready, lost, dead, frames, stage, size: [W, H], pixelRatio: renderer.getPixelRatio(),
        balls: world.balls.map((b) => ({ id: b.id, phase: b.phase, x: +b.x.toFixed(3), y: +b.y.toFixed(3), z: +b.z.toFixed(3) })),
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      };
    },
    world, renderer, scene, camera,
  };
}
