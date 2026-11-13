/* ===================================================================
   net-court-a · переход первого экрана (вызывается из mountNet)
   Прогресс p (0…1) считает court.js по прокрутке закреплённой страницы.
   0    — нынешняя 3D-сцена: корт в перспективе, сетка стоит;
   0–0.3  холст раскрывается из рамки первого экрана на весь экран;
   0.05–0.8 камера поднимается и наклоняется, пока не смотрит строго вниз;
   0.22–0.8 сетка падает «от нас» на корт, к 0.85 сжимается в полосу;
   0.15–0.97 свет уступает место ровному цвету покрытия (тон для чтения);
   1    — кадр совпадает с плоским корт-фоном: холст гаснет и засыпает.
   =================================================================== */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function attachCourt3D(ctx) {
  const { THREE, renderer, scene, camera, host, mobile, floorMat, lineMat, postMats, netMat, tapeMat, strapMat, netGroup, wind, sun, fill, hemi, extras, camA, lookA, fovA, netH } = ctx;
  const C = window.Court;
  if (!C) return null;
  const DOC = document.documentElement;
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  { const m = new THREE.Matrix4().lookAt(camA, lookA, new THREE.Vector3(0, 1, 0)); qA.setFromRotationMatrix(m); }
  const tanA = Math.tan(THREE.MathUtils.degToRad(fovA / 2));
  const camPos = new THREE.Vector3(), camB = new THREE.Vector3();

  /* ---- покрытие при p=1: цвет (и полосы стрижки) ровно как у плоского фона ---- */
  const surfCv = document.createElement('canvas'); surfCv.width = 1; surfCv.height = 2;
  const surfTex = new THREE.CanvasTexture(surfCv);
  surfTex.colorSpace = THREE.SRGBColorSpace; surfTex.magFilter = THREE.NearestFilter; surfTex.minFilter = THREE.LinearFilter; surfTex.generateMipmaps = false;
  surfTex.wrapS = surfTex.wrapT = THREE.RepeatWrapping;
  floorMat.emissiveMap = surfTex; floorMat.emissive = new THREE.Color(0x000000); floorMat.needsUpdate = true;
  lineMat.emissive = new THREE.Color(0x000000);
  netMat.emissive = new THREE.Color(0x000000);
  postMats.forEach((m) => { if (m.emissive) m.emissive.set(0x000000); });

  /* ---- цвета темы: из themes.css (через court.js), смена — плавно за 0,6 с ---- */
  const KEYS = ['c3-sky', 'c3-fog', 'c3-court', 'c3-lines', 'c3-screen', 'c3-post', 'c3-net', 'c3-tape', 'c3-hemi-sky', 'c3-hemi-ground', 'c3-sun', 'c3-fill', 'court-surf', 'court-tex-a', 'court-tex-b', 'court-line', 'ink'];
  const NUMS = ['c3-fog-near', 'c3-fog-far', 'c3-hemi-i', 'c3-sun-i', 'c3-sun-n', 'c3-fill-i', 'court-line-a'];
  function read(court) {
    const v = C.colors(court), out = { court };
    KEYS.forEach((k) => { out[k] = new THREE.Color().setStyle(v[k] || '#888888'); });
    NUMS.forEach((k) => { out[k] = parseFloat(v[k]) || 0; });
    out.stripes = court === 'grass';
    return out;
  }
  let pal = read(DOC.getAttribute('data-court') || 'clay'), from = null, to = null, tw = 1;
  const cur = {}; KEYS.forEach((k) => { cur[k] = pal[k].clone(); }); NUMS.forEach((k) => { cur[k] = pal[k]; });
  let curStripes = pal.stripes ? 1 : 0;
  function blendPal(t) {
    if (!from) return;
    KEYS.forEach((k) => cur[k].copy(from[k]).lerp(to[k], t));
    NUMS.forEach((k) => { cur[k] = from[k] + (to[k] - from[k]) * t; });
    curStripes = (from.stripes ? 1 : 0) + ((to.stripes ? 1 : 0) - (from.stripes ? 1 : 0)) * t;
  }
  document.addEventListener('court:change', (e) => {
    const nx = read(e.detail.court);
    from = {}; KEYS.forEach((k) => { from[k] = cur[k].clone(); }); NUMS.forEach((k) => { from[k] = cur[k]; }); from.stripes = curStripes > 0.5;
    to = nx; tw = 1; blendPal(1); // [корт-2] сразу: новую тему открывает круг смены темы, перелива цветов (через серый) нет
    surfDirty = true; ctx.mod.dirty = 40; ctx.kick();
  });

  let surfDirty = true, lastSurf = '';
  const hex = (c) => '#' + c.getHexString(THREE.SRGBColorSpace);
  function paintSurf(g) {
    // полосы стрижки: те же цвета и шаг, что в CSS (3 м на круг), граница полос — на линии сетки
    const a = cur['court-tex-a'], b = cur['court-tex-b'], s0 = cur['court-surf'];
    const k = curStripes, ca = s0.clone().lerp(a, k), cb = s0.clone().lerp(b, k);
    const key = hex(ca) + hex(cb);
    if (key !== lastSurf) {
      const x = surfCv.getContext('2d');
      x.fillStyle = hex(ca); x.fillRect(0, 0, 1, 1); x.fillStyle = hex(cb); x.fillRect(0, 1, 1, 1);
      surfTex.needsUpdate = true; lastSurf = key;
    }
    const R = 160 / 3; surfTex.repeat.set(1, R); surfTex.offset.set(0, -((80 / 3) % 1));
    surfDirty = false;
  }

  /* ---- мост для мячей: мячи выходят из упавшей сетки ---- */
  const S = window.S2 || {};
  const origPoke = S.netPoke;
  S.netTapeAt = () => (C.pinned ? C.hdr + C.geo.Y0 - C.geo.band - 64 : null);
  S.netPoke = (x, y, k) => { if (C.p < 0.3 && origPoke) origPoke(x, y, k); };
  C.kick3d = () => { ctx.mod.dirty = Math.max(ctx.mod.dirty, 2); ctx.kick(); }; // [корт-2] камера догоняет прокрутку и после её остановки

  let lastKey = '', fadeT = 0, wasLanded = false;
  const v3 = new THREE.Vector3();
  function frame(dt) {
    if (tw < 1) { tw = Math.min(1, tw + dt / 0.6); blendPal(smooth(0, 1, tw)); surfDirty = true; ctx.mod.dirty = Math.max(ctx.mod.dirty, 2); }
    const g = C.geo; if (!g) return;
    const p = C.pinned ? C.p : 1;
    const Wc = host.clientWidth || window.innerWidth, Vh = host.clientHeight || window.innerHeight;
    const hvTop = C.hdr + g.hvTopRel, hvBot = hvTop + g.hvH;
    const past = Math.max(0, window.scrollY - C.D);                // после закрепления мир едет вместе со страницей
    const Y0s = C.hdr + g.Y0 - past;                               // экранная линия основания сетки (z = 0)

    /* камера: из рамки первого экрана — в вид строго сверху */
    const e = smoother(clamp((p - 0.04) / (0.80 - 0.04), 0, 1));
    const eUp = 1 - Math.pow(1 - e, 1.7);
    const s = g.s, tanB = tanA, H = Vh / (2 * s * tanB);
    camB.set((Wc / 2 - g.cx) / s, H, (Vh / 2 - Y0s) / s);
    camPos.set(camA.x + (camB.x - camA.x) * e, camA.y + (camB.y - camA.y) * eUp, camA.z + (camB.z - camA.z) * e);
    camera.position.copy(camPos);
    camera.quaternion.copy(qA).slerp(qB, e);
    // кадр: на старте — ровно прежняя рамка первого экрана, к концу — весь экран
    const pt = 2 * tanA / Math.max(1, g.hvH);
    const A = { t: tanA + hvTop * pt, b: tanA - (Vh - hvTop) * pt, r: (Wc / 2) * pt };
    const B = { t: tanB, b: -tanB, r: tanB * Wc / Vh };
    let ft = A.t + (B.t - A.t) * e, fb = A.b + (B.b - A.b) * e;
    const fr = A.r + (B.r - A.r) * e;
    // [корт-3] телефон: в середине перехода кадр сдвинут вниз — корт с сеткой встаёт посреди экрана под заголовком,
    // а не прячется за карточками у нижнего края; к 82 % сдвиг уходит, сетка опускается на границу блока
    if (mobile) { const mb = smooth(0.1, 0.28, p) * (1 - smooth(0.5, 0.84, p)), dy = -0.42 * mb * (ft - fb); ft += dy; fb += dy; }
    const near = 0.05, far = 200;
    camera.near = near; camera.far = far;
    camera.projectionMatrix.makePerspective(-fr * near, fr * near, ft * near, fb * near, near, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld(true);

    /* сетка: падает от зрителя на корт и сжимается в полосу ширины блока */
    const fall = smoother(clamp((p - 0.22) / (0.80 - 0.22), 0, 1));
    const kEnd = g.band / (s * netH);
    netGroup.rotation.x = -fall * Math.PI / 2;
    netGroup.scale.set(1, 1 + (kEnd - 1) * smooth(0.42, 0.85, p), 1 - 0.97 * smooth(0.38, 0.8, p));
    const sh = netMat.userData.sh;
    if (sh && sh.uniforms.uCells) { if (!sh.uniforms.uCells.userData) sh.uniforms.uCells.userData = sh.uniforms.uCells.value.y; sh.uniforms.uCells.value.y = sh.uniforms.uCells.userData + (2 - sh.uniforms.uCells.userData) * smooth(0.5, 0.85, p); }
    const hide = 1 - smooth(0.3, 0.56, p);
    extras().forEach((o) => { if (!o.userData.s0) o.userData.s0 = o.scale.x; const v = o.userData.s0 * hide; o.scale.setScalar(Math.max(1e-4, v)); o.visible = hide > 0.01; });

    /* свет уступает ровному цвету покрытия */
    // [корт-2] покрытие светлеет к тону для чтения уже к 20 %: тёмный текст первого экрана не ложится на тёмный 3D-корт
    const m = 0.62 * smooth(0.0, 0.2, p) + 0.38 * smooth(0.3, 0.97, p), m2 = smooth(0.5, 0.95, p);
    if (surfDirty) paintSurf(g);
    floorMat.color.copy(cur['c3-court']).multiplyScalar(1 - m);
    floorMat.emissive.setRGB(m, m, m);
    const lineFlat = cur['court-surf'].clone().lerp(cur['court-line'], cur['court-line-a'] || 0.95);
    lineMat.color.copy(cur['c3-lines']).multiplyScalar(1 - m);
    lineMat.emissive.copy(lineFlat).multiplyScalar(m);
    netMat.color.copy(cur['c3-net']).multiplyScalar(1 - m2);
    netMat.emissive.copy(cur.ink).multiplyScalar(m2);
    tapeMat.color.copy(cur['c3-tape']).lerp(cur.ink, m2);
    if (strapMat) strapMat.color.copy(cur['c3-tape']).lerp(cur.ink, m2);
    postMats.forEach((pm) => { pm.color.copy(cur['c3-post']).multiplyScalar(1 - m2); if (pm.emissive) pm.emissive.copy(cur.ink).multiplyScalar(m2); });
    wind.material.color.copy(cur['c3-screen']);
    // ветрозащита у горизонта уходит, пока камера поднимается: не ложится полосой под заголовок
    // [корт-3] быстрее: тёмная полоса не ложится под «Лига TS»
    const wv = 1 - smooth(0.0, 0.05, p); wind.material.transparent = wv < 1; wind.material.opacity = wv; wind.visible = wv > 0.01;
    // [корт-3] над дальним краем корта — не бумага, а то же покрытие: горизонт не режет заголовок жёсткой чертой
    const sk = smooth(0.02, 0.16, p);
    scene.background.copy(cur['c3-sky']).lerp(cur['court-surf'], sk);
    const fo = smooth(0.05, 0.55, p);
    scene.fog.color.copy(cur['c3-fog']).lerp(cur['court-surf'], sk);
    scene.fog.near = cur['c3-fog-near'] * (mobile ? 0.6 : 1) + fo * 400; scene.fog.far = cur['c3-fog-far'] * (mobile ? 0.63 : 1) + fo * 800;
    const mk = mobile ? 1.45 : 1;
    hemi.color.copy(cur['c3-hemi-sky']); hemi.groundColor.copy(cur['c3-hemi-ground']); hemi.intensity = cur['c3-hemi-i'] * mk;
    sun.color.copy(cur['c3-sun']); sun.intensity = cur['c3-sun-i'] * (mobile ? 0.55 : 0.9) * (cur['c3-sun-n'] > 1 ? 1.25 : 1);
    fill.color.copy(cur['c3-fill']); fill.intensity = cur['c3-fill-i'];

    /* окно холста: сначала только рамка первого экрана, потом весь экран */
    // [корт-3] нижний край окна — не жёсткая черта, а мягкое затухание (до 110 px), и уходит за экран быстрее верхнего:
    // под «Последней сеткой» больше нет шва «3D-корт / плоский корт»
    const c = smooth(0, 0.3, p), cB = smooth(0, 0.14, p), F = Math.round(110 * smooth(0, 0.03, p));
    const ct = Math.round(hvTop * (1 - c)), bot = Math.round(hvBot + (Vh + F - hvBot) * cB);
    const key = ct + '|' + bot + '|' + F;
    if (key !== lastKey) {
      const mk = (ct > 0 || bot - F < Vh) ? 'linear-gradient(180deg,transparent ' + ct + 'px,#000 ' + ct + 'px,#000 ' + (bot - F) + 'px,transparent ' + bot + 'px)' : '';
      host.style.webkitMaskImage = host.style.maskImage = mk;
      lastKey = key;
    }
    const landed = DOC.classList.contains('court-landed');
    if (landed && !wasLanded) fadeT = 0.32;
    wasLanded = landed;
    if (fadeT > 0) { fadeT -= dt; ctx.mod.dirty = Math.max(ctx.mod.dirty, 2); }
  }
  // [корт-3] 3D-слой засыпает, когда ничего не меняется: камера стоит, тема не переливается, мячей и дрожи сетки нет.
  // Будят: камера (kick3d), смена темы, мышь/касание над первым экраном; после последнего события — ещё 2,5 с (сетка успокаивается).
  let wakeAt = performance.now();
  const wakeUp = () => { wakeAt = performance.now(); };
  const sect = document.querySelector('.hero') || document;
  ['pointermove', 'pointerdown'].forEach((t) => sect.addEventListener(t, wakeUp, { passive: true }));
  document.addEventListener('court:change', wakeUp);
  document.addEventListener('court:layout', wakeUp);
  const k3 = C.kick3d; C.kick3d = () => { wakeUp(); k3(); };
  function active() {
    if (!C.pinned) return false;
    if (tw < 1 || fadeT > 0 || ctx.mod.dirty > 0) return true;
    if (C.pt != null && C.p !== C.pt) return true;
    if (DOC.classList.contains('court-landed')) return false;
    if (ctx.busy && ctx.busy()) { wakeUp(); return true; }
    return performance.now() - wakeAt < 2500;
  }
  return { frame, active, p: () => (C.pinned ? C.p : 1) };
}
