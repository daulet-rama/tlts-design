# Шрифты прототипа

Файлы скачаны с Google Fonts 13.11.2026 и лежат рядом с сайтом, чтобы страницы открывались у корта при плохой связи и без серверов Google. Подключает их `core/theme.css` (раздел 1, `@font-face` с `font-display: swap`).

## Лицензии

Все три семейства распространяются по **SIL Open Font License 1.1** (OFL). Её можно свободно использовать, встраивать в сайт и распространять вместе с ним; нельзя продавать сами шрифты отдельно. Полный текст лицензии с правообладателем лежит рядом:

| Семейство | Правообладатель | Лицензия | Файл |
|---|---|---|---|
| Commissioner | The Commissioner Project Authors | SIL OFL 1.1 | `OFL-Commissioner.txt` |
| Fira Sans Extra Condensed | The Mozilla Foundation and Telefonica S.A. | SIL OFL 1.1 | `OFL-FiraSansExtraCondensed.txt` |
| Noto Sans Mono | The Noto Project Authors | SIL OFL 1.1 | `OFL-NotoSansMono.txt` |

## Что лежит

Те же начертания и наборы знаков, что раньше подключались через `@import` Google Fonts:

- `commissioner-<набор>.woff2` — Commissioner, переменная толщина 100–900;
- `fira-sans-xcond-700i|800i|900i-<набор>.woff2` — Fira Sans Extra Condensed, жирный курсив 700, 800, 900;
- `noto-sans-mono-<набор>.woff2` — Noto Sans Mono, переменные толщина 100–900 и ширина 62,5–100 %.

Наборы: `cyrillic`, `cyrillic-ext`, `latin`, `latin-ext`, `greek`, `greek-ext`, `vietnamese` (у Commissioner нет `greek-ext`). Браузер скачивает только те файлы, буквы из которых есть на странице (`unicode-range`). Обычной русской странице хватает `cyrillic` и `latin`; казахские буквы Ә Ғ Қ Ң Ө Ү Һ лежат в `cyrillic-ext`, а Ұ и І — в `cyrillic`.

Казахские буквы Ә Ғ Қ Ң Ө Ұ Ү Һ І (заглавные и строчные) проверены по таблице cmap каждого файла: все 18 есть во всех пяти начертаниях.
