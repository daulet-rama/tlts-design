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
  var shown = 0;
  var img = function () { return document.getElementById('still'); };
  var here = function () { var s = img(); return !!s && s.complete; };          // картинка пришла (или не придёт вовсе — тогда и ждать нечего)
  var end = function () { d.classList.remove('ld'); d.classList.add('ld-out'); setTimeout(function () { d.classList.remove('ld-out'); }, 220); };
  var wait = function () {
    if (window.scrollY > 2) return end();
    if (!here() && Date.now() - shown < 20000) return setTimeout(wait, 50);
    var s = img(), hold = function () { setTimeout(end, Math.max(0, 400 - (Date.now() - shown))); };
    if (s && s.naturalWidth && s.decode) s.decode().then(hold, hold); else hold();
  };
  setTimeout(function () { if (here()) return; shown = Date.now(); d.classList.add('ld'); wait(); }, Math.max(0, 300 - performance.now()));
})();
