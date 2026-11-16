/* Первый экран «Мяч»: до первого кадра ставит отметки, по которым работают стили. Встроенных скриптов на странице нет.
   js — скрипты работают (иначе показывается заглушка каркаса); rm — «уменьшить движение» (то же); остальное — надпись и режим. */
(function () {
  var d = document.documentElement; d.classList.add('js');
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) d.classList.add('rm'); } catch (e) {}
  d.setAttribute('data-text', '4'); d.setAttribute('data-ball', 'top'); d.setAttribute('data-mode', 'mark');
})();
