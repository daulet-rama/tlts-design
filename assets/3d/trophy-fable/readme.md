# Кубок Итогового TS CUP — 3D-модель (trophy-fable)

Процедурная модель в Blender 5.2.2 по фото награждений (`research/raw/photos_original/storage__1399…`, `storage__1411…`):
восьмигранная коническая чаша с широким плоским бортом, две тонкие ручки-прутка, шейка с гранёным «яблоком»,
раструб-стопа, круглый поясок с гравировкой, тёмная точёная подставка из сосны.

## Файлы

| Файл | Что это |
|---|---|
| `trophy.glb` | glTF 2.0 binary, текстуры внутри, без Draco/meshopt, 359 580 байт (0,34 МБ) |
| `trophy-hero.png` | 1600×1600, прозрачный фон, героический ракурс |
| `trophy-front.png`, `trophy-34.png` | 800×800, прозрачный фон: спереди и 3/4 сверху (видна позолота внутри чаши) |
| `trophy-dark.jpg` | 1600×1000 на тёмном фоне #00132B — запасной вид для телефона |
| `../hdr/studio_small_09_1k.hdr` | HDRI Poly Haven, CC0 (общая папка) |
| `src/` | `gen_textures.py`, `build_trophy.py`, `render.py`, `verify_glb.py`, `tex/` |

## Модель

- Габариты: 0,258 × 0,600 × 0,258 м (X × Y × Z), Y вверх, метры. Начало координат — центр низа подставки.
- Лицо (табличка «TS CUP» и крупная надпись на пояске) смотрит на +Z, то есть на камеру three.js по умолчанию.
- 8 060 треугольников, один узел `Trophy`, один меш, 4 примитива (по материалу). Трансформации применены.
- Нормали: свои (custom split normals). Грани восьмигранника слегка «выгнуты» по нормалям (30 %), чтобы
  зеркальные грани не отражали одну точку окружения и не выглядели чёрными. Тангенсов в файле нет — three.js
  считает их в шейдере.

| Материал | Где | baseColor (linear) | metallic | roughness | Текстуры |
|---|---|---|---|---|---|
| `Silver` | чаша снаружи, борт, ручки, ножка, стопа | 0.955, 0.945, 0.925 | 1 | 0.17 | — |
| `Brass` | позолота внутри чаши, табличка «TS CUP» | 0.93, 0.70, 0.31 | 1 | 0.24 | — |
| `SilverEngraved` | поясок | 0.955, 0.945, 0.925 | 1 | 0.19 | normal map 2048×256 PNG: «TS CUP», «TLTS FINALS», «ALMATY» |
| `PineWood` | подставка | текстура | 0 | 0.5 | baseColor 1024×512 JPEG (тёмная морёная сосна) |

На фото кубок целиком серебряный (латунь под серебрением), поэтому основной металл — `Silver`, а `Brass` — акценты.
Нужен золотой кубок — перекрасьте серебро в коде:

```js
gltf.scene.traverse(o => {
  if (o.isMesh && o.material.name.startsWith('Silver')) {
    o.material.color.setRGB(0.93, 0.70, 0.31);   // латунь
    o.material.roughness = 0.24;
  }
});
```

## Настройки Three.js (three@0.160.0)

- `renderer.toneMapping = THREE.ACESFilmicToneMapping`, `renderer.toneMappingExposure = 1.0` (с RoomEnvironment — 1.15–1.3);
- `renderer.outputColorSpace = THREE.SRGBColorSpace`;
- окружение обязательно: без `scene.environment` металл будет чёрным. Лучше HDRI `studio_small_09_1k.hdr` через PMREM;
- `material.envMapIntensity`: 1.0–1.3 с HDRI, 1.5–2.0 с RoomEnvironment (она серая, серебро в ней тусклее);
- свет: один `DirectionalLight` (intensity ≈ 2, позиция (-2, 3, 3)) для блика; ambient не нужен;
- камера: fov 24–30°, расстояние 1.7–2.2 м, `lookAt(0, 0.3, 0)`; вращать кубок вокруг Y;
- на тёмном фоне хорошо работает медленное вращение: грани по очереди ловят софтбокс.

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader().load('../assets/3d/hdr/studio_small_09_1k.hdr', (hdr) => {
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  hdr.dispose();
  pmrem.dispose();
});

const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(-2, 3, 3);
scene.add(key);

new GLTFLoader().load('../assets/3d/trophy-fable/trophy.glb', (gltf) => {
  const trophy = gltf.scene;            // высота 0.6, низ в y = 0
  trophy.traverse((o) => { if (o.isMesh) o.material.envMapIntensity = 1.2; });
  scene.add(trophy);
});
```

## Пересборка

```bash
cd src
python3 gen_textures.py                                   # нужны numpy и Pillow (pip install numpy pillow)
blender -b --factory-startup --python build_trophy.py     # -> ../trophy.glb
blender -b --factory-startup --python render.py           # все рендеры; "-- preview hero" — быстрый черновик
blender -b --factory-startup --python verify_glb.py       # импорт GLB обратно и сверка
```

Рендеры: Cycles, OptiX (RTX 4070), 320 сэмплов + шумоподавление, AgX. Свет — HDRI плюс три софтбокса-панели,
невидимые для камеры (иначе плоские зеркальные грани отражают тёмный низ студии).

## Проверка

- Импорт обратно в Blender: 1 объект, 4 материала, 8 060 треугольников, bbox (−0.129, −0.129, 0)…(0.129, 0.129, 0.6) — совпадает.
- Headless Chrome (SwiftShader), three@0.160.0, `GLTFLoader.parse` из base64: грузится, нормали правильные,
  надписи читаются не зеркально, 4 материала. С RoomEnvironment серебро серое и тусклее, чем в Cycles;
  с `studio_small_09_1k.hdr` картинка близка к рендеру.

## Отличия от настоящего кубка

- Лент «TLTS FINALS» на ручках нет.
- На настоящем пояске — годы и фамилии победителей; здесь декоративные «TS CUP · TLTS FINALS · ALMATY».
- Табличка на чаше в оригинале серебряная с рельефным логотипом; здесь латунная, с простым текстом шрифтом DejaVu Sans Bold.
- Позолота внутри чаши — допущение: на фото нутро не видно.
- Поверхность оригинала — ручная выколотка с «живыми» кривыми отражениями; здесь грани ровные.
- Размеры сняты с двух фото на глаз (высота принята 0,6 м); задней стороны и вида сверху на фото нет.
