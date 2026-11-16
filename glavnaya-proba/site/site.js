/* site.js — немного поведения для сайта «Афиша». Страница работает и без него: всё видно, все ссылки ведут куда надо,
   меню «Меню» открывается (<details>). Скрипт только улучшает: кто смотрит (классы на <html>), меню закрывается по Esc
   и щелчку мимо, разделы турнира по прокрутке, клетки кода, счётчик знаков, окна подтверждения, «скопировать ссылку».
   Действия аккаунта (код, вход, профиль, заявка, выход, удаление) делает account.js сервера — он же включает их кнопки. */
(function () {
  'use strict';
  var html = document.documentElement;
  html.classList.add('js');

  /* кто смотрит. Открытые страницы одинаковы для всех и cookie не читают, поэтому шапку, панель и подвал переключает скрипт
     по метке tlts_in без секрета (её ставит и снимает сервер): 1 — вошёл, заявки нет; 2 — есть заявка или член лиги.
     Личные страницы сервер отдаёт сразу с классами — скрипт их не снимает. */
  var m = /(?:^|;\s*)tlts_in=([12])(?:;|$)/.exec(document.cookie);
  if (m) { html.classList.add('in'); if (m[1] === '2') html.classList.add('in-league'); }

  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  /* элемент по ссылке-якорю: пустая ссылка «#» или кривой якорь не роняют скрипт */
  var byHref = function (a) {
    var h = a.getAttribute('href') || '';
    if (!/^#[A-Za-z][\w-]*$/.test(h)) return null;
    try { return document.querySelector(h); } catch (e) { return null; }
  };

  /* «Меню»: закрыть по Esc, щелчку мимо и переходу по ссылке внутри (якоря той же страницы) */
  $$('details.menu').forEach(function (d) {
    var sum = d.querySelector('summary');
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && d.open) { d.open = false; if (sum) sum.focus(); } });
    document.addEventListener('click', function (e) { if (d.open && !d.contains(e.target)) d.open = false; });
    $$('a', d).forEach(function (a) { a.addEventListener('click', function () { d.open = false; }); });
  });

  /* разделы турнира: подсветка по прокрутке; вкладки категорий сетки */
  if ('IntersectionObserver' in window) {
    var tn = $$('.tnav a');
    var secs = tn.map(byHref).filter(Boolean);
    if (secs.length) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          tn.forEach(function (a) { if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      secs.forEach(function (s) { io.observe(s); });
    }
    var tabs = $$('.dr-tabs .chip');
    var cats = tabs.map(byHref).filter(Boolean);
    if (cats.length) {
      var pick = function (id) { tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('href') === '#' + id)); }); };
      var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) pick(e.target.id); }); }, { rootMargin: '-45% 0px -50% 0px' });
      cats.forEach(function (c) { io2.observe(c); });
    }
  }

  /* код из шести цифр: клетки повторяют поле */
  $$('[data-otp]').forEach(function (box) {
    var inp = box.querySelector('input'); var cells = $$('.otp-cell', box);
    var draw = function () {
      var v = inp.value.replace(/\D/g, '').slice(0, 6);
      if (v !== inp.value) inp.value = v;
      cells.forEach(function (c, i) { c.textContent = v[i] || ''; c.classList.toggle('on', document.activeElement === inp && i === Math.min(v.length, 5)); });
    };
    inp.addEventListener('input', draw); inp.addEventListener('focus', draw); inp.addEventListener('blur', draw); draw();
  });

  /* счётчик знаков у длинного текста */
  $$('[data-count-for]').forEach(function (out) {
    var t = document.getElementById(out.getAttribute('data-count-for')); if (!t) return;
    var max = t.getAttribute('maxlength');
    var draw = function () { out.textContent = t.value.length + ' / ' + max; };
    t.addEventListener('input', draw); draw();
  });

  /* окна подтверждения: <dialog id>; открывает [data-dlg="id"] (кнопку включает account.js), закрывает [data-dlg-close]; фокус — на «Отмене» */
  $$('[data-dlg]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      var d = document.getElementById(b.getAttribute('data-dlg'));
      if (d && d.showModal) { e.preventDefault(); d.showModal(); var c = d.querySelector('[data-dlg-close]'); if (c) c.focus(); }
    });
  });
  $$('dialog [data-dlg-close]').forEach(function (b) { b.addEventListener('click', function () { var d = b.closest('dialog'); if (d) d.close(); }); });

  /* фото профиля: показать выбранный снимок сразу (blob: — политика источников сервера это разрешает) */
  $$('input[type="file"][data-photo]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; var av = document.getElementById(inp.getAttribute('data-photo'));
      if (!f || !av || !/^image\//.test(f.type)) return;
      var img = new Image(); img.alt = ''; img.src = URL.createObjectURL(f); av.textContent = ''; av.appendChild(img);
    });
  });

  /* поделиться: скопировать ссылку (без скрипта кнопки нет — она в разметке hidden) */
  $$('[data-copy]').forEach(function (b) {
    b.hidden = false;
    b.addEventListener('click', function () {
      var s = b.querySelector('span') || b;
      (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(function () { s.textContent = 'Скопировано'; }, function () { s.textContent = location.host; });
    });
  });
})();
