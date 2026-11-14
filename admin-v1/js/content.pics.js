// Картинки мест: где именно появится материал.
// Схема экрана без слов; место, куда ляжет материал, обведено тёмной рамкой.
// Цвета — переменные темы (css/content.css, «картинки мест»), покрытие — data-srf.
import { esc } from '../admin.js';

const svg = (body, attrs = '') => `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"${attrs}>${body}</svg>`;
const r = (cls, x, y, w, h, rx = 3) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
// своё фото прямо в месте показа: «вот здесь будет ваша новость»
let uid = 0;
const shot = (x, y, w, h, rx, src) => {
  if (!src) return r('ph', x, y, w, h, rx);
  uid += 1;
  return `<clipPath id="ctp${uid}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath><image href="${esc(src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#ctp${uid})"/>`;
};

// окно браузера: рамка и полоска с тремя точками
const browser = (x, y, w, h) => `${r('b', x, y, w, h, 10)}<path class="m" d="M${x + 1} ${y + 15}V${y + 10}a9 9 0 0 1 9-9h${w - 20}a9 9 0 0 1 9 9v5z"/>`
  + [0, 1, 2].map((i) => `<circle class="d" cx="${x + 11 + i * 8}" cy="${y + 8}" r="2.4"/>`).join('');
// телефон: корпус уходит вниз за край картинки
const phone = (x, y, w) => r('b', x, y, w, 150, 14);

// Приложение → «Сегодня»: внизу экрана карточка новости
export function picApp(src) {
  return svg(`${phone(84, 8, 72)}
    ${r('l', 94, 20, 30, 6)}
    ${r('m', 94, 32, 52, 26, 7)}
    ${r('m', 94, 62, 52, 20, 7)}
    ${r('l', 94, 87, 52, 4, 2)}
    ${r('hl', 90, 96, 60, 22, 6)}
    ${shot(94, 100, 13, 13, 3, src)}
    ${r('l', 111, 102, 33, 4, 2)}${r('l', 111, 109, 22, 3, 1.5)}`);
}

// Сайт → главная, блок «Новости»: три карточки, новая — первая
export function picSite(src) {
  const card = (x, hl) => `${r(hl ? 'hl' : 'c', x, 74, 58, 44, 6)}${hl ? shot(x + 5, 79, 48, 18, 3, src) : r('ph', x + 5, 79, 48, 18, 3)}${r('l', x + 5, 102, 40, 4, 2)}${r('l', x + 5, 109, 28, 3, 1.5)}`;
  return svg(`${browser(14, 6, 212, 140)}
    ${r('l', 26, 29, 30, 6)}${r('l', 160, 30, 54, 4, 2)}
    ${r('m', 26, 42, 188, 24, 6)}
    ${card(26, true)}${card(91, false)}${card(156, false)}`);
}

// Сайт → страница турнира: шапка цвета покрытия, «Новости турнира»
export function picTour(srf, src) {
  return svg(`${browser(14, 6, 212, 140)}
    <rect class="s" x="15" y="21" width="210" height="30"/>
    ${r('w', 26, 30, 70, 6)}${r('w', 26, 40, 44, 4, 2)}
    ${r('m', 26, 58, 34, 9, 4.5)}${r('m', 66, 58, 34, 9, 4.5)}${r('m', 106, 58, 34, 9, 4.5)}
    ${r('hl', 22, 74, 196, 40, 6)}
    ${shot(28, 80, 40, 28, 4, src)}${r('l', 76, 84, 104, 5, 2.5)}${r('l', 76, 95, 72, 4, 2)}`, srf ? ` data-srf="${esc(srf)}"` : ' data-srf="none"');
}

// Сайт → «Пресса о лиге»: список статей, новая — сверху
export function picPress() {
  const row = (y, hl) => `${r(hl ? 'hl' : 'c', 26, y, 188, 26, 6)}${r('m', 32, y + 8, 30, 10, 3)}${r('l', 70, y + 7, 110, 4, 2)}${r('l', 70, y + 15, 70, 3, 1.5)}`;
  return svg(`${browser(14, 6, 212, 140)}
    ${r('l', 26, 29, 70, 6)}
    ${row(42, true)}${row(74, false)}${row(106, false)}`);
}

// Новость: сайт — главная, блок «Новостей», новая — первая. Телефона нет: в приложении новости
// появятся только со следующей версии, а картинка не должна обещать больше подписи под ней
export function picNews(src) {
  return picSite(src);
}

// Альбом на сайте: настоящие фото сеткой (обложка — крупно)
export function picAlbum(photos) {
  const ph = photos.slice(0, 5);
  return `<span class="ct-alb" aria-hidden="true"><span class="ct-alb-bar"><i></i><i></i><i></i></span><span class="ct-alb-grid">${ph.map((p, i) => `<img src="${esc(p.src)}" alt=""${i === 0 ? ' class="first"' : ''} loading="lazy">`).join('')}</span></span>`;
}
