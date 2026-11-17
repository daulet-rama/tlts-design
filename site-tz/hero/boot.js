/* Первый экран «Мяч»: до первого кадра ставит отметки, по которым работают стили. Встроенных скриптов на странице нет.
   js — скрипты работают (иначе показывается заглушка каркаса); rm — «уменьшить движение» (то же); остальное — надпись и режим.
   Загрузка первого экрана — сам мяч: если через 0,3 с после начала перехода картинка мяча ещё не пришла, на её месте
   загорается контур мяча (класс ld; вид — в hero.css). Пришла — контур стоит не меньше 0,4 с с момента показа и гаснет
   за 0,15 с (класс ld-out), мяч проступает. Пришла быстрее 0,3 с — знака нет вовсе. Человек начал листать — знак убирается сразу.
   Тексты первого экрана (название, числа, плитки) ждут шрифт: пока его нет, они не показываются запасным шрифтом, чтобы потом
   не перестраиваться на глазах (класс fw; шрифт пришёл — fw-in на 0,4 с: тексты проступают). Не пришёл за 4 с — показываются как есть. */
(function () {
  var d = document.documentElement, rm = false; d.classList.add('js');
  try { rm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (rm) d.classList.add('rm');
  d.setAttribute('data-text', '4'); d.setAttribute('data-ball', 'top'); d.setAttribute('data-mode', 'mark');
  if (rm || !window.performance || !performance.now) return;
  var fw = true, unfw = function () { if (!fw) return; fw = false; d.classList.remove('fw'); d.classList.add('fw-in'); setTimeout(function () { d.classList.remove('fw-in'); }, 400); };
  try { d.classList.add('fw'); document.fonts.load('800 20px "Ubuntu Sans"').then(unfw, unfw); setTimeout(unfw, 4000); } catch (e) { unfw(); }
  /* Телефон (до 700 px), первый заход: первый экран показывается, когда сцена готова играть (класс scw; правила — в hero.css):
     до этого на нём знак загрузки, тексты и мяч скрыты, страница не листается. О готовности сообщает hero.js:
     __sceneReady(true). Страховки стоят здесь и от сцены не зависят: предел ожидания 7 с от начала перехода, любая ошибка
     скрипта или загрузки, прокрутка — первый экран показывается сразу, как раньше. Сцена уже была загружена этим
     браузером (повторный заход) — ожидания нет вовсе. */
  var gate = false, KEY = 'tlts-scene', REL = '1';
  try { REL = (document.currentScript.src.match(/[?&]r=(\d+)/) || [])[1] || '1'; } catch (e) {}   // номер выпуска — из адреса этого скрипта: новый выпуск ждёт сцену заново
  var fadeIn = function () { d.classList.add('fw-in'); setTimeout(function () { d.classList.remove('fw-in'); }, 400); };
  var ungate = function (ok) {
    if (ok === true) { try { localStorage.setItem(KEY, REL); } catch (e) {} }
    if (!gate) return; gate = false;
    if (!d.classList.contains('ld')) { d.classList.remove('scw'); fadeIn(); }   // знака на экране нет — показываем сразу; иначе класс снимется вместе со знаком
  };
  window.__sceneReady = ungate;
  try {
    var seen = false; try { seen = localStorage.getItem(KEY) === REL; } catch (e) {}
    if (!seen && matchMedia('(max-width: 700px)').matches) {
      gate = true; d.classList.add('scw');
      setTimeout(function () { ungate(); }, Math.max(0, 7000 - performance.now()));
      addEventListener('error', function () { ungate(); }, true); addEventListener('unhandledrejection', function () { ungate(); });
      // скрипт сцены выполнен (он отложенный, идёт до этого события), но о себе не заявил — значит, в памяти браузера лежит прежний, который о готовности не скажет: не ждём
      document.addEventListener('DOMContentLoaded', function () { if (!window.__sceneWaits) ungate(); });
      // пока стоит знак, страница не листается; сняли знак — первый же жест убирает эти обработчики
      var opt = { passive: false }, keys = function (e) { if (d.classList.contains('scw') && /^(ArrowDown|PageDown|End| |Spacebar)$/.test(e.key)) e.preventDefault(); };
      var stop = function (e) { if (d.classList.contains('scw')) { if (e.cancelable) e.preventDefault(); } else { removeEventListener('wheel', stop, opt); removeEventListener('touchmove', stop, opt); removeEventListener('keydown', keys); } };
      addEventListener('wheel', stop, opt); addEventListener('touchmove', stop, opt); addEventListener('keydown', keys);
    }
  } catch (e) { gate = false; d.classList.remove('scw'); }
  var shown = 0;
  var img = function () { return document.getElementById('still'); };
  var here = function () { var s = img(); return !gate && !!s && s.complete; };          // сцену не ждём, и картинка пришла (или не придёт вовсе — тогда и ждать нечего)
  var end = function () { var g = d.classList.contains('scw'); d.classList.remove('ld'); d.classList.remove('scw'); d.classList.add('ld-out'); if (g) fadeIn(); setTimeout(function () { d.classList.remove('ld-out'); }, 220); };
  var wait = function () {
    if (window.scrollY > 2) { gate = false; return end(); }
    if (!here() && Date.now() - shown < 20000) return setTimeout(wait, 50);
    var s = img(), hold = function () { setTimeout(end, Math.max(0, 400 - (Date.now() - shown))); };
    if (s && s.naturalWidth && s.decode) s.decode().then(hold, hold); else hold();
  };
  setTimeout(function () { if (here()) return; shown = Date.now(); d.classList.add('ld'); wait(); }, Math.max(0, 300 - performance.now()));
})();
