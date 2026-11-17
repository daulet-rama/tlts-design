/* tz.js — немного поведения новых страниц показа. Без него всё видно и работает: вопросы раскрываются (<details>),
   поиск — форма GET, просмотр снимка открывается по якорю. Скрипт только улучшает:
   - «Вопросы и ответы»: отбор вопросов по слову сразу при наборе и по ?q= в адресе;
   - «Поиск» шапки: итог по ?q= из указателя js/poisk-data.js (игроки, турниры, новости, документы);
   - рейтинг и «Игроки»: отбор по ?q=; новости: отбор по ?tip=, ?god=, ?turnir=;
   - просмотр снимка: Esc закрывает, стрелки листают. */
(function () {
  'use strict';
  var all = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var norm = function (s) {
    s = String(s || '').toLowerCase().replace(/ё/g, 'е');
    var a = 'әіңғүұқөһ', b = 'аингуукох';
    for (var i = 0; i < a.length; i++) s = s.split(a[i]).join(b[i]);
    return s.replace(/\s+/g, ' ').trim();
  };
  var param = function (k) { var m = new RegExp('[?&]' + k + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; };

  /* вопросы и ответы */
  var fin = document.querySelector('input[data-faq]');
  var list = document.querySelector('[data-faq-list]');
  if (fin && list) {
    var none = document.querySelector('[data-faq-none]');
    var apply = function () {
      var q = norm(fin.value), shown = 0;
      all('.qa-t', list).forEach(function (sec) {
        var n = 0;
        all('li', sec).forEach(function (li) {
          var ok = !q || norm(li.textContent).indexOf(q) >= 0;
          li.hidden = !ok; if (ok) n++;
          var d = li.querySelector('details'); if (d && q && ok) d.open = true;
        });
        sec.hidden = !n; shown += n;
      });
      if (none) none.hidden = shown > 0;
    };
    fin.addEventListener('input', apply);
    var q0 = param('q'); if (q0 && !fin.value) { fin.value = q0; apply(); }
  }

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var hit = function (text, q) { var t = norm(text); return t.indexOf(q) === 0 || t.indexOf(' ' + q) >= 0 || t.indexOf('-' + q) >= 0; };
  var empty = function (title, text, href, link) {
    return '<div class="msg msg--empty"><h2 class="msg-h">' + esc(title) + '</h2><p>' + esc(text) + '</p>' + (href ? '<a class="more-link" href="' + href + '">' + esc(link) + ' <span class="arrow" aria-hidden="true">→</span></a>' : '') + '</div>';
  };
  var ru = function (n, a, b, c) { var m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : (m >= 2 && m <= 4 && (h < 12 || h > 14)) ? b : c); };

  /* поиск шапки: итог по ?q= из указателя js/poisk-data.js (указатель грузится отдельным файлом — ждём конца загрузки страницы) */
  var poisk = function () {
    var sin = document.querySelector('input[data-poisk]');
    var out = document.querySelector('[data-poisk-list]');
    if (!sin || !out || !window.TLTS_POISK) return;
    var say = document.querySelector('[data-poisk-say]');
    var run = function () {
      var q = norm(sin.value); if (q.length < 2) return;
      var groups = {}, n = 0;
      window.TLTS_POISK.forEach(function (x) { if (hit(x.t, q)) { (groups[x.k] = groups[x.k] || []).push(x); n++; } });
      var html = '';
      Object.keys(groups).forEach(function (k, i) {
        var items = groups[k].slice(0, 20);
        html += '<section class="sr-g" aria-labelledby="sr-' + i + '"><h2 id="sr-' + i + '" class="cap">' + esc(k) + ' · ' + groups[k].length + '</h2><ol class="sr-list">'
          + items.map(function (x) { return '<li><a class="sr-a" href="' + esc(x.h) + '"><b>' + esc(x.t) + '</b><span>' + esc(x.s) + '</span><span class="arrow" aria-hidden="true">→</span></a></li>'; }).join('')
          + '</ol></section>';
      });
      out.innerHTML = html || empty('Ничего не нашли', 'Проверьте слово: фамилия игрока, название турнира, новости или документа.');
      if (say) say.textContent = 'Найдено по «' + sin.value + '»: ' + n;
    };
    var q1 = param('q'); if (q1) { sin.value = q1; run(); }
    sin.addEventListener('input', run);
  };

  /* рейтинг: ?q= — строки игроков, у которых совпало имя или фамилия */
  var rating = function () {
    var inp = document.getElementById('rq'); var q = norm(param('q'));
    if (!inp || !q) return;
    inp.value = param('q');
    var rows = all('.rtab tbody tr'), n = 0;
    rows.forEach(function (tr) { var a = tr.querySelector('.rt-a'); var ok = !!a && hit(a.textContent, q); tr.hidden = !ok; if (ok) n++; });
    var h = document.querySelector('.rt-list .rt-h');
    if (h) h.textContent = 'Найдено по «' + param('q') + '»: ' + ru(n, 'игрок', 'игрока', 'игроков');
    var box = document.querySelector('.rt-list .rt2');
    if (!n && box) {
      box.insertAdjacentHTML('afterend', empty('Никого не нашли', 'В рейтинге сезона нет игрока «' + param('q') + '». Проверьте фамилию или имя — или найдите среди всех игроков.', 'igroki.html?q=' + encodeURIComponent(param('q')), 'Найти среди всех игроков'));
      box.hidden = true;
    }
  };

  /* игроки: ?q= — по всем игрокам лиги из указателя */
  var players = function () {
    var inp = document.getElementById('pq'); var q = norm(param('q'));
    var list = document.querySelector('[data-pl-list]');
    if (!inp || !q || !list || !window.TLTS_POISK) return;
    inp.value = param('q');
    var found = window.TLTS_POISK.filter(function (x) { return x.k === 'Игроки' && hit(x.t, q); });
    var say = document.querySelector('[data-pl-say]'); if (say) say.textContent = 'Найдено по «' + param('q') + '»: ' + ru(found.length, 'игрок', 'игрока', 'игроков');
    all('[data-pl-hide]').forEach(function (e) { e.hidden = true; });
    var html = found.map(function (x) { return '<li><a class="sr-a" href="' + esc(x.h) + '"><b>' + esc(x.t) + '</b><span>' + esc(x.s) + '</span><span class="arrow" aria-hidden="true">→</span></a></li>'; }).join('');
    list.outerHTML = found.length ? '<ol class="sr-list" data-pl-list>' + html + '</ol>' : empty('Никого не нашли', 'Игрока «' + param('q') + '» в лиге нет. Проверьте фамилию или имя.', 'igroki.html', 'Все игроки');
  };

  /* новости: отбор по типу, году и турниру (?tip= ?god= ?turnir=) из указателя */
  var news = function () {
    var list = document.querySelector('[data-news-list]');
    var tip = param('tip'), god = param('god'), tour = param('turnir');
    if (!list || !window.TLTS_NEWS || !(tip || god || tour)) return;
    var items = window.TLTS_NEWS.filter(function (x) { return (!tip || x.tip === tip) && (!god || x.y === god) && (!tour || x.tour === tour); });
    all('[data-news-hide]').forEach(function (e) { e.hidden = true; });
    var none = document.querySelector('[data-news-none]'); if (none) none.hidden = items.length > 0;
    var say = document.querySelector('[data-news-say]'); if (say) say.textContent = 'Отбор: ' + ru(items.length, 'материал', 'материала', 'материалов');
    list.innerHTML = items.map(function (x) {
      var d = x.d.split('-');
      return '<li class="nr"><a href="' + esc(x.h) + '"><time class="rd" datetime="' + x.d + '"><span class="num rd-d">' + d[2] + '.' + d[1] + '</span><span class="rd-y">' + d[0] + '</span></time>'
        + '<span class="nr-txt"><span class="meta"><span class="ty t-' + x.ty + '">' + esc(x.tl) + '</span></span><span class="nr-t">' + esc(x.t) + '</span><span class="nr-l">' + esc(x.l) + '</span></span><span class="arrow" aria-hidden="true">→</span></a></li>';
    }).join('');
    list.hidden = !items.length;
    var f = document.querySelector('[data-news-filters]');
    if (f) {
      all('.f-types .chip', f).forEach(function (c) {
        var h = c.getAttribute('href') || ''; var m = /tip=([a-z]+)/.exec(h); var t = m ? m[1] : (h.indexOf('news-tip') >= 0 ? 'itogi' : '');
        if (t === tip) c.setAttribute('aria-current', 'page'); else c.removeAttribute('aria-current');
      });
      var sy = f.querySelector('select[name=god]'); if (sy) sy.value = god;
      var st = f.querySelector('select[name=turnir]'); if (st) st.value = tour;
      var form = f.querySelector('form'); if (form && tip && !form.querySelector('input[name=tip]')) form.insertAdjacentHTML('afterbegin', '<input type="hidden" name="tip" value="' + esc(tip) + '">');
    }
  };

  /* «Попросить убрать фото»: снимок и альбом — из адреса (?a=альбом&n=номер) */
  var ask = function () {
    var fig = document.querySelector('[data-ask-photo]'); var a = param('a'), n = param('n');
    if (!fig || !a || !n || !window.TLTS_FOTO || !window.TLTS_FOTO[a] || !window.TLTS_FOTO[a].p[n]) return;
    var al = window.TLTS_FOTO[a], ph = al.p[n];
    var img = fig.querySelector('img'); if (img) { img.src = 'content/img/' + ph[0] + '-480.webp'; img.removeAttribute('srcset'); img.alt = ph[1]; }
    var c = fig.querySelector('[data-ask-cap]'); if (c) c.textContent = 'Снимок ' + n + ' · ' + al.t;
    var t = fig.querySelector('[data-ask-text]'); if (t) t.textContent = ph[1];
    var crumb = document.querySelector('.crumbs a[href$="' + al.f + '"], .crumbs a:nth-of-type(2)'); if (crumb) { crumb.textContent = al.t; crumb.setAttribute('href', al.f); }
  };

  /* язык: на казахскую главную пришли со страницы без перевода (?ru=страница) — «Рус» ведёт обратно на неё */
  var lang = function () {
    if (document.documentElement.lang !== 'kk') return;
    var ru = param('ru'); if (!/^[a-z0-9-]+\.html$/.test(ru)) return;
    all('a[hreflang="ru"]').forEach(function (a) { a.setAttribute('href', '../' + ru); });
  };

  /* страница перехода наружу: что именно откроется — по ссылке, с которой пришли (?to=трансляция, приложение, Telegram…) */
  var out = function () {
    var box = document.querySelector('[data-out]'); var to = param('to');
    if (!box || !/^[a-z-]+$/.test(to)) return;
    var li = box.querySelector('[data-out-list] [data-to="' + to + '"]'); if (!li) return;
    var h = box.querySelector('[data-out-h]'), pp = box.querySelector('[data-out-p]');
    if (h) h.textContent = li.getAttribute('data-h'); if (pp) pp.textContent = li.textContent;
  };

  var ready = function () { poisk(); rating(); players(); news(); ask(); lang(); out(); };
  /* скрипты страницы — с defer: tz.js исполняется раньше указателя js/poisk-data.js, поэтому ждём DOMContentLoaded (он — после всех defer) */
  if (document.readyState === 'complete') ready(); else document.addEventListener('DOMContentLoaded', ready);

  /* просмотр снимка */
  if (document.querySelector('.phv')) {
    document.addEventListener('keydown', function (e) {
      var cur = document.querySelector('.phv:target'); if (!cur) return;
      if (e.key === 'Escape') { location.hash = 'phg'; }
      if (e.key === 'ArrowRight') { var n = cur.querySelector('.phv-n'); if (n) location.hash = n.getAttribute('href').slice(1); }
      if (e.key === 'ArrowLeft') { var p = cur.querySelector('.phv-p'); if (p) location.hash = p.getAttribute('href').slice(1); }
    });
  }
})();
