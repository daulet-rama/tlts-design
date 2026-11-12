# TLTS 3D kit

Общий набор моделей для вариантов сайта на three.js 0.160.0. Всё собрано скриптами Blender 5.2 из `src/`.
Все GLB: Y вверх, метры, трансформации применены, текстуры встроены (JPEG, у сетки PNG с альфой),
PBR metallic-roughness, **без Draco и meshopt** — грузятся обычным `GLTFLoader` без декодеров.
Проверено в браузере: three r160, `GLTFLoader` + `RGBELoader`, WebGL2.

## Файлы

| Файл | Размер | Треугольники | Что внутри |
|---|---|---|---|
| `court.glb` | 903 КБ | 7 014 | грунтовый корт для пар, линии ITF, сетка, столбы |
| `ball.glb` | 370 КБ | 3 872 | мяч Ø 6,7 см, текстуры 1024 запечены в Cycles |
| `racket.glb` | 373 КБ | 11 124 | ракетка 100 кв. дюймов, струны 16×19 геометрией |
| `clay_albedo.jpg` | 216 КБ | — | грунт, цвет, 1024², бесшовная, sRGB |
| `clay_normal.jpg` | 297 КБ | — | грунт, нормали (OpenGL/glTF, +Y вверх), 1024², бесшовная |
| `clay_roughness.jpg` | 168 КБ | — | грунт, шероховатость (серая), 1024², бесшовная |
| `court-aerial.jpg` | 184 КБ | — | рендер 1920×1080, вид сверху под углом, закат |
| `court-low.jpg` | 351 КБ | — | рендер 1920×1080, низкий ракурс у сетки, день |
| `ball-macro.png` | 989 КБ | — | рендер 1200×1200, прозрачный фон |
| `racket-ball.png` | 1085 КБ | — | рендер 1600×1600, прозрачный фон, ракетка и мяч |
| `../hdr/belfast_sunset_puresky_1k.hdr` | 1,2 МБ | — | закат, Poly Haven, CC0 |
| `../hdr/kloofendal_48d_partly_cloudy_puresky_1k.hdr` | 1,4 МБ | — | день, облака, Poly Haven, CC0 |

Один тайл текстур грунта = **3 × 3 м**. Для своей плоскости: `repeat = размер_в_метрах / 3`.

## Узлы, меши, материалы

Имена ниже — как их видит three.js после `GLTFLoader`. Если у меша несколько материалов, three.js делает из него
`Group`, а дети называются `<имя>_1`, `<имя>_2`… — надёжнее искать их по `material.name`.

### court.glb — начало координат: центр корта под сеткой, на поверхности грунта

Корт вдоль оси **Z** (задние линии на z = ±11,885), ширина вдоль **X** (боковые для пар x = ±5,485),
сетка вдоль X при z = 0, грунт на y = 0.

| Узел | Треуг. | Материал | Что это |
|---|---|---|---|
| `court` | — | — | корневой узел |
| `clay` | 3 610 | `clay` | плита 36,57 × 18,29 м (корт + 6,40 м за задними линиями + 3,66 м по бокам), толщина 8 см (низ на y = −0,08). Цвет × вершинные цвета `COLOR_0` (крупные пятна, вытоптанные зоны у задних линий — убирают повтор тайла) |
| `lines` | 22 | `line_paint` | линии ITF: 5 см, задние 10 см, центральная метка 10 см; все размеры по внешнему краю. Лежат на 3 мм выше грунта |
| `net` (Group) | 1 894 | `net_mesh` | полотно сетки: ячейка 45 мм, PNG с альфой, `alphaMode BLEND`, двустороннее |
| | | `net_band` | белая лента 6,4 см сверху, центральный ремень, боковые ленты |
| | | `net_cable` | стальной трос от ленты через столбы к лебёдке |
| `posts` | 1 488 | `post_paint` | два круглых столба Ø 8 см на x = ±6,399 м (0,914 м за боковыми), высота 1,092 м, лебёдка с ручкой на столбе +X |

Высота сетки: 0,914 м в центре, 1,07 м у столбов.

### ball.glb — начало координат: центр мяча

| Узел | Треуг. | Материал | Что это |
|---|---|---|---|
| `ball` | 3 872 | `ball_felt` | сфера R = 0,0335 м, нормали точные. Albedo, normal и roughness 1024 (JPEG) запечены с процедурного ворса; белый шов — классическая кривая теннисного мяча, слегка утоплен. `KHR_materials_sheen` (three.js создаст `MeshPhysicalMaterial`) |

### racket.glb — начало координат: торец ручки

Ракетка вдоль **+Y**, длина 0,687 м, голова 0,276 × 0,35 м, центр струнной поверхности на y ≈ 0,51 м,
струнная плоскость смотрит в ±Z. Точка баланса ≈ y 0,32 м — удобная ось для вращения в витрине.

| Узел | Треуг. | Материал | Что это |
|---|---|---|---|
| `racket` | — | — | корневой узел |
| `racket_frame` (Group) | 10 656 | `frame_graphite` | обод, горло, мост, шафт, торец; графит с лаком (`KHR_materials_clearcoat`) |
| | | `frame_white` | белые акценты на «плечах» обода и мост |
| | | `bumper_rubber` | чёрный бампер сверху обода |
| `racket_grip` | 48 | `grip_overgrip` | белая намотка, текстуры 512 (спиральные витки — normal + AO в цвете) |
| `racket_strings` | 420 | `strings` | 16 продольных + 19 поперечных струн Ø 1,3 мм, геометрия |

## Рекомендуемые настройки three.js (r160)

- `renderer.outputColorSpace = THREE.SRGBColorSpace` (по умолчанию в r160).
- `renderer.toneMapping = THREE.ACESFilmicToneMapping`, `toneMappingExposure = 1`.
  `AgXToneMapping` в r160 делает грунт розовато-лососевым, а мяч оливковым. Если обновитесь до r162+,
  `NeutralToneMapping` ближе всего к рендерам мяча и ракетки (в Blender они сделаны в Khronos PBR Neutral).
- Свет: `scene.environment` из HDR через `PMREMGenerator`. Для заката добавьте тёплый `DirectionalLight`
  (`#ffa866`, интенсивность 2–3, солнце низко, ~7°): в `belfast_sunset` солнце в дымке и почти не даёт теней.
  На телефоне можно вообще не качать HDR: `pmrem.fromScene(new RoomEnvironment(), 0.04)`.
- Тени (только компьютер): `PCFSoftShadowMap`, карта 2048, камера тени ±22 м по корту.
  **Полотну сетки тени не включайте** (`material.name === 'net_mesh'` → `castShadow = false`): в three.js
  прозрачный материал отбрасывает сплошную тень. Лента, трос и столбы дают правильную тень, как в рендере.
- Линии на 3 мм выше грунта. Если на дальних планах мерцают, поднимите `camera.near` (0,1–0,5 м для корта)
  или включите `polygonOffset` на `line_paint` (`polygonOffsetFactor = -1`, `polygonOffsetUnits = -4`).
- Камера корта: `near 0.1`, `far 500`. Мяч и ракетка: `near 0.01`.
- Телефон: `setPixelRatio(Math.min(devicePixelRatio, 1.5))`, без теней. `sheen` у мяча и `clearcoat` у ракетки
  дороже обычного PBR — при нехватке FPS замените на `MeshStandardMaterial`, скопировав `map/normalMap/roughnessMap`.

## Код загрузки

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
} }
</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const KIT = '../assets/3d/kit/';
const HDR = '../assets/3d/hdr/';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 500);
camera.position.set(-15, 10, 31);          // как в court-aerial.jpg
camera.lookAt(1.5, -1, -1);

// окружение
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader().load(HDR + 'belfast_sunset_puresky_1k.hdr', (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.background = hdr;
});

// низкое тёплое солнце
const sun = new THREE.DirectionalLight(0xffa866, 3);
sun.position.set(8, 7, -58);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 140 });
sun.shadow.normalBias = 0.02;
scene.add(sun);

const loader = new GLTFLoader();

loader.load(KIT + 'court.glb', (gltf) => {
  const court = gltf.scene;                       // корень "court"
  court.traverse((o) => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    o.castShadow = o.name !== 'clay' && o.material.name !== 'net_mesh';
  });
  scene.add(court);

  const net = court.getObjectByName('net');       // Group: net_mesh, net_band, net_cable
  const lines = court.getObjectByName('lines');
  const posts = court.getObjectByName('posts');
  // подсветка линий, например:
  // lines.material.emissive.set(0xffffff); lines.material.emissiveIntensity = 0.4;
});

loader.load(KIT + 'ball.glb', (gltf) => {
  const ball = gltf.scene.getObjectByName('ball'); // центр мяча в начале координат
  ball.position.set(1, 1.2, 4);
  ball.castShadow = true;
  scene.add(gltf.scene);
});

loader.load(KIT + 'racket.glb', (gltf) => {
  const racket = gltf.scene.getObjectByName('racket'); // начало координат на торце ручки
  const strings = racket.getObjectByName('racket_strings');
  racket.position.set(-2, 0.9, 3);
  scene.add(gltf.scene);
});

renderer.setAnimationLoop(() => renderer.render(scene, camera));
</script>
```

Текстуры грунта отдельно (например, для своей большой плоскости):

```js
const tl = new THREE.TextureLoader();
const tex = (f, srgb) => {
  const t = tl.load('../assets/3d/kit/' + f);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(18.29 / 3, 36.57 / 3);              // 1 тайл = 3 м
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const clayMat = new THREE.MeshStandardMaterial({
  map: tex('clay_albedo.jpg', true),
  normalMap: tex('clay_normal.jpg'),
  roughnessMap: tex('clay_roughness.jpg'),
  metalness: 0,
});
```

## Рендеры

Сделаны в Cycles (OPTIX) из тех же GLB. Только для рендера добавлены: тёмная земля вокруг корта с дымкой
к горизонту, тёплый солнечный свет по направлению солнца HDRI (закат), студийные источники для мяча и ракетки.
Корт — AgX, мяч и ракетка — Khronos PBR Neutral.

## Пересборка

Нужны Blender 5.2 и ffmpeg (JPEG 4:4:4 для карт нормалей). Промежуточные файлы идут в `$KIT_BUILD`.

```bash
cd assets/3d/kit/src
./build_all.sh            # или по шагам:
blender -b --factory-startup --python tex_court.py       # текстуры грунта, линий, сетки
blender -b --factory-startup --python build_court.py     # court.glb
blender -b --factory-startup --python build_ball.py      # ball.glb (запекание в Cycles)
blender -b --factory-startup --python build_racket.py    # racket.glb
blender -b --factory-startup --python render_previews.py # 4 рендера
python3 inspect_glb.py ../court.glb ../ball.glb ../racket.glb   # меши, треугольники, текстуры
```

## Ограничения

- Ворс мяча — только normal, roughness и sheen, без «пушистого» силуэта.
- На ракетке нет логотипов и надписей: бренд не выбран.
- HDR в Blender и three.js повёрнуты по-разному (на 180° вокруг вертикали), поэтому положение солнца
  на рендерах и в браузере совпадает только если задать свет вручную, как в примере выше.
- HDRI: Poly Haven, CC0. Kloofendal 48d Partly Cloudy (Pure Sky) — Greg Zaal, Jarod Guest;
  Belfast Sunset (Pure Sky) — Dimitrios Savva, Greg Zaal, Jarod Guest.
