/* account-demo.js — поведение страниц аккаунта в макете (вход по номеру телефона, отсчёт «Выслать снова через 0:45»,
   код из SMS → анкета или «Я», выход — на index.html); на сервере это делает account.js.
   Показывает, как ведут себя страницы аккаунта со скриптом: включает кнопки [data-needs-js] (в разметке они выключены —
   без скрипта формы не уходят), переключает шаги входа по #kod, ведёт отсчёт «Новый код через 0:59», проверяет согласие
   на входе показного сервера. Никуда ничего не отправляет. */
(function () {
  'use strict';
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  $$('[data-needs-js]').forEach(function (b) { b.disabled = false; });

  /* вход: шаг «почта» → шаг «код» (образец: login.html#kod) */
  var panes = $$('[data-pane]');
  var timer = null;
  function countdown() {
    var t = document.querySelector('[data-timer]'), again = document.querySelector('[data-resend]');
    if (!t || !again) return;
    var left = 45; clearInterval(timer); t.hidden = false; again.hidden = true;
    var tick = function () {
      t.textContent = 'Выслать снова через 0:' + String(left).padStart(2, '0');
      if (left <= 0) { clearInterval(timer); t.hidden = true; again.hidden = false; }
      left -= 1;
    };
    tick(); timer = setInterval(tick, 1000);
  }
  function show() {
    var k = location.hash === '#kod' ? 'code' : 'email';
    panes.forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== k; });
    if (k === 'code') countdown(); else clearInterval(timer);
  }
  if (panes.length) { window.addEventListener('hashchange', show); show(); }
  $$('[data-resend]').forEach(function (b) { b.addEventListener('click', countdown); });

  /* код из SMS: шесть цифр — вход выполнен; метка входа и переход дальше по пути:
     пришли со «Вступить» (?next=anketa) — к анкете, иначе — в «Я» */
  $$('.otp-in').forEach(function (inp) {
    var cells = $$('.otp-cell', inp.closest('.otp'));
    var say = document.querySelector('.code-say');
    var paint = function () { var v = inp.value.replace(/\D/g, '').slice(0, 6); inp.value = v; cells.forEach(function (c, i) { c.textContent = v[i] || ''; c.classList.toggle('on', i === v.length); }); return v; };
    inp.addEventListener('input', function () {
      var v = paint();
      if (v.length === 6) {
        if (say) say.textContent = 'Код принят — входим…';
        var next = /vstupit|anketa/.test(location.search) ? 'join-anketa.html' : 'me.html';
        document.cookie = 'tlts_in=' + (next === 'me.html' ? '2' : '1') + '; path=/; max-age=86400';
        setTimeout(function () { location.href = next; }, 600);
      }
    });
    inp.addEventListener('focus', paint);
  });

  $$('form').forEach(function (f) {
    if (f.matches('.srch, .f-sel, .f-q')) return;           // поиск и отборы — обычные формы GET
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var agree = f.querySelector('#agree');
      if (agree && !agree.checked) {                   // показной сервер: без согласия кода нет
        var err = document.getElementById('agree-err');
        if (err) { err.hidden = false; agree.setAttribute('aria-invalid', 'true'); agree.setAttribute('aria-describedby', 'agree-err'); agree.focus(); }
        return;
      }
      if (f.hasAttribute('data-email-form')) location.hash = 'kod';
    });
  });
  $$('#agree').forEach(function (a) { a.addEventListener('change', function () { var err = document.getElementById('agree-err'); if (a.checked && err) { err.hidden = true; a.removeAttribute('aria-invalid'); a.removeAttribute('aria-describedby'); } }); });

  /* выход в образце: снять метку и открыть главную гостем */
  $$('[data-logout]').forEach(function (b) {
    b.addEventListener('click', function () { document.cookie = 'tlts_in=; max-age=0; path=/'; location.href = 'index.html'; });
  });
  $$('[data-delete], [data-withdraw]').forEach(function (b) { b.addEventListener('click', function () { var d = b.closest('dialog'); if (d) d.close(); }); });
})();
