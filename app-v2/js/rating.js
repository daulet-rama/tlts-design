// «Рейтинг»: ваше место крупно, линия очков с соседями, поиск и первая тридцатка.
// Гость и вошедший (ответ сервера без me): табло «Ваше место» и строки «Вы» нет — поиск и тридцатка.
import { D, ME, isMe, avHtml, icon, ballSvg, hydrate, keepTheme, playerHref, setTick } from '../app.js';
import { searchPlayers, plural } from './rating.logic.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const rows = D.RATING;
// ваша строка рейтинга — только в показе (в ответе сервера есть me)
const mine = ME ? rows.find((r) => r.player === ME.player) : null;

// ---------- табло: место, сдвиг за неделю, отрыв ----------
// RATING.delta — изменение места за неделю (12–19 июня — неделя июньского этапа)

function hero() {
  const above = rows.find((r) => r.place === mine.place - 1);
  const gap = above ? above.points - mine.points : 0;
  const d = mine.delta;
  $('delta').innerHTML = d ? `${icon(d > 0 ? 'up' : 'down')}${d > 0 ? '+' : '−'}${Math.abs(d)} за неделю` : 'Без изменений';
  $('say').textContent = above
    ? `До ${above.place}-го места — ${D.fmt(gap)} ${plural(gap, 'балл', 'балла', 'баллов')}`
    : 'Вы первый в лиге';
  $('hero').setAttribute('aria-label', `Ваше место ${mine.place}${d ? `, ${d > 0 ? 'плюс' : 'минус'} ${Math.abs(d)} за неделю` : ''}. ${$('say').textContent}. Показать в списке`);

  // линия очков: соседи по местам на одной шкале, вы — мяч на линии
  (function line() {
    const near = rows.filter((r) => r.place >= mine.place - 2 && r.place <= mine.place + 1);
    const pts = near.map((r) => r.points);
    const lo = Math.min(...pts), hi = Math.max(...pts);
    const pad = (hi - lo) * 0.14 || 20;
    const x = (p) => ((p - (lo - pad)) / (hi - lo + pad * 2)) * 100;
    const xm = x(mine.points);
    let html = '<span class="rt-base"></span>';
    if (above) html += `<span class="rt-gap" style="left:${xm}%;width:${x(above.points) - xm}%"><span class="cap">${D.fmt(gap)}</span></span>`;
    for (const r of near) {
      if (r.player === mine.player) continue;
      html += `<span class="rt-tick" style="left:${x(r.points)}%">${avHtml(r.player, 'xs')}<span class="cap">${r.place}</span></span>`;
    }
    html += `<span class="rt-me" style="left:${xm}%">${ballSvg('glow')}<span class="cap">Вы</span></span>`;
    $('line').innerHTML = html;
  })();

  // место «доезжает» до нынешнего: неделю назад было на d ниже
  (function count() {
    const el = $('place');
    if (!d || still()) return;
    let n = mine.place + d;
    el.textContent = n;
    const step = () => {
      n += d > 0 ? -1 : 1;
      setTick(el, n);
      if (n !== mine.place) setTimeout(step, 420);
    };
    setTimeout(step, 650);
  })();
}
// без me табло нет: экран начинается с поиска
if (mine) hero(); else $('hero').remove();

// ---------- список ----------
// строка: место и сдвиг за неделю под ним · кружок · имя (переносится, а не обрезается) · баллы и КПР

const DELTA = Object.fromEntries(rows.map((r) => [r.player, r.delta]));
const moveHtml = (dl) => (dl
  ? `<span class="cap delta"><span aria-hidden="true">${icon(dl > 0 ? 'up' : 'down')}</span>${Math.abs(dl)}<span class="vh"> ${dl > 0 ? 'вверх' : 'вниз'} за неделю</span></span>`
  : '');
function rowHtml(p, place, points) {
  const me = isMe(p.id);
  return `<a class="row rank-row${me ? ' me' : ''}" href="${keepTheme(playerHref(p.id))}" data-pid="${p.id}"${me ? ' id="me"' : ''}>`
    + `<span class="rt-pos"><span class="num place${me ? '' : ' muted'}">${place}</span>${moveHtml(DELTA[p.id] || 0)}</span>`
    + avHtml(p.id, 'sm')
    + `<span class="grow strong rt-name">${me ? 'Вы · ' : ''}${esc(p.name)}</span>`
    + `<span class="end stack"><span class="rt-pts">${D.fmt(points)}</span><span class="cap">КПР ${p.kpr.toFixed(1)}</span></span></a>`;
}

const list = $('list');
const top = () => rows.map((r) => rowHtml(D.player(r.player), r.place, r.points)).join('');
list.innerHTML = top();
hydrate(list);

// ---------- поиск ----------

const q = $('q');
const found = $('found');
const none = $('none');
const TOP = 'Первая тридцатка';

function render() {
  const hits = searchPlayers(q.value);
  if (!hits) {
    list.innerHTML = top();
    list.hidden = false;
    none.hidden = true;
    found.textContent = TOP;
    return;
  }
  list.innerHTML = hits.map((p) => rowHtml(p, p.place, p.points)).join('');
  list.hidden = !hits.length;
  none.hidden = !!hits.length;
  found.textContent = hits.length ? `Найдено: ${hits.length} ${plural(hits.length, 'игрок', 'игрока', 'игроков')}` : 'Никого не нашли';
}
q.addEventListener('input', render);
q.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && q.value) { q.value = ''; render(); }
  if (e.key === 'Enter') {
    const first = list.querySelector('a.row');
    if (first && q.value.trim()) location.href = first.href;
  }
});

// табло ведёт к вашей строке
if (mine) $('hero').addEventListener('click', (e) => {
  e.preventDefault();
  if (q.value) { q.value = ''; render(); }
  const row = $('me');
  if (!row) return;
  row.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'center' });
  row.classList.remove('flash');
  void row.offsetWidth;
  row.classList.add('flash');
});
