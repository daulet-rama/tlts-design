// Ввод счёта кнопками, без клавиатуры: «Кто выиграл?» → «С каким счётом?» → «Сохранить счёт 6:4».
// Формат лиги — один сет до 6, при 6:6 тай-брейк до 7 (D.TOURNAMENT.format).
// «Другой счёт» — два счётчика «−» и «+» с проверкой словами.
// Исправление: нынешний победитель и счёт уже выбраны, у нынешнего счёта — пометка «сейчас»;
// причина — по желанию, в конце (уходит в журнал, игроки её не видят).
// scorePad(узел, { match, fix, onChange }) → { get(), missing(), button(), same() }
import { D, esc, icon, duoHtml } from '../admin.js';
import { WIN_SCORES, checkSet, tbWin } from './tournament.logic.js';

const REASONS = ['Перепутали пары', 'Ошиблись в счёте', 'Другое'];

// «7:6» для строки; «, тай-брейк 7:5» словами
export const scoreText = (sets, side = 0) => sets.map(([a, b]) => (side === 0 ? `${a}:${b}` : `${b}:${a}`)).join(' ');
export const tbWords = (sets) => { const s = sets[0]; return s[2] !== undefined ? `, тай-брейк ${tbWin(s[2])}:${s[2]}` : ''; };

export function scorePad(root, { match, fix = false, onChange } = {}) {
  const m = match;
  const st = { reason: null, why: '', winner: null, pick: null, other: false, a: 6, b: 4, tb: null };
  // нынешний счёт — точкой отсчёта при исправлении
  const now = fix && m.sets ? { winner: m.winner, w: Math.max(m.sets[0][0], m.sets[0][1]), l: Math.min(m.sets[0][0], m.sets[0][1]), tb: m.sets[0][2] ?? null } : null;
  if (now) {
    st.winner = now.winner; st.a = m.sets[0][0]; st.b = m.sets[0][1]; st.tb = now.tb;
    if (WIN_SCORES.some(([w, l]) => w === now.w && l === now.l)) st.pick = [now.w, now.l]; else st.other = true;
  }
  const name = (i) => D.pairName(m.pairs[i]);
  const duo = (i) => duoHtml(m.pairs[i], '');
  // итог: { winner, sets: [[a, b, tb?]] } в порядке пар матча или null
  const result = () => {
    if (st.other) {
      const c = checkSet(st.a, st.b);
      if (!c.ok) return null;
      const set = [st.a, st.b]; if (c.tb && st.tb !== null) set.push(st.tb);
      return { winner: c.winner, sets: [set], tb: c.tb };
    }
    if (st.winner === null || !st.pick) return null;
    const [w, l] = st.pick; const set = st.winner === 0 ? [w, l] : [l, w];
    if (w === 7 && l === 6 && st.tb !== null) set.push(st.tb);
    return { winner: st.winner, sets: [set], tb: w === 7 && l === 6 };
  };
  const same = () => { const r = result(); return !!(now && r && r.winner === m.winner && JSON.stringify(r.sets) === JSON.stringify(m.sets)); };
  const missing = () => {
    if (st.other) { const c = checkSet(st.a, st.b); if (!c.ok) return c.msg; }
    else if (st.winner === null) return 'Выберите, кто выиграл';
    else if (!st.pick) return 'Выберите счёт';
    if (same()) return 'Счёт тот же — выберите новый';
    return null;
  };
  const isTb = () => { const r = result(); return !!(r && r.tb); };
  const isNow = (w, l) => now && now.w === w && now.l === l;

  const draw = () => {
    const r = result();
    const winScores = WIN_SCORES.map(([w, l]) => {
      const on = !st.other && st.pick && st.pick[0] === w && st.pick[1] === l;
      return `<button type="button" class="sc-tile" role="radio" aria-checked="${!!on}" data-w="${w}" data-l="${l}"${isNow(w, l) ? ` aria-label="${w}:${l}, сейчас"` : ''}>${on ? icon('check', 'ck') : ''}<span class="num">${w}:${l}</span>${isNow(w, l) ? '<span class="now-was">сейчас</span>' : ''}</button>`;
    }).join('');
    const counter = (i, v) => `<div class="stepper" role="group" aria-label="Геймы: ${esc(name(i))}"><span class="who">${duo(i)}<span class="nm fit">${esc(name(i))}</span></span><button type="button" class="btn quiet step" data-stp="${i}" data-d="-1" aria-label="Меньше геймов: ${esc(name(i))}">−</button><span class="num v" aria-live="polite">${v}</span><button type="button" class="btn quiet step" data-stp="${i}" data-d="1" aria-label="Больше геймов: ${esc(name(i))}">+</button></div>`;
    const otherMsg = st.other ? (() => { const c = checkSet(st.a, st.b); return c.ok ? `<p class="understood">${icon('check')}<span>Счёт: ${esc(name(c.winner))} ${c.winner === 0 ? `${st.a}:${st.b}` : `${st.b}:${st.a}`}</span></p>` : `<p class="pick-msg sc-err" role="alert">${icon('alert')}<span>${esc(c.msg)}</span></p>`; })() : '';
    root.innerHTML = `
      <section class="sc-q"><h2 class="ask sm">Кто выиграл?</h2>
        <div class="win-pick" role="radiogroup" aria-label="Кто выиграл">${[0, 1].map((i) => `<button type="button" class="choice wp" role="radio" aria-checked="${(st.other ? (r ? r.winner === i : false) : st.winner === i)}" data-win="${i}">${duo(i)}<span class="t">${esc(name(i))}</span><span class="dot" aria-hidden="true"></span></button>`).join('')}</div></section>
      <section class="sc-q"><h2 class="ask sm">С каким счётом?</h2>
        <p class="muted">${esc(D.TOURNAMENT.format)} · первым — счёт победителей</p>
        <div class="sc-tiles" role="radiogroup" aria-label="Счёт">${winScores}<button type="button" class="sc-tile other" role="radio" aria-checked="${st.other}" data-other>${st.other ? icon('check', 'ck') : ''}<span>Другой счёт</span></button></div>
        ${st.other ? `<div class="steppers">${counter(0, st.a)}${counter(1, st.b)}</div>${otherMsg}` : ''}
      </section>
      ${isTb() ? `<section class="sc-q"><h2 class="h3">Тай-брейк <span class="muted">(можно не указывать)</span></h2>
        <div class="stepper tb" role="group" aria-label="Очки тай-брейка у проигравших"><span class="who">Очки у проигравших</span><button type="button" class="btn quiet step" data-tb="-1" aria-label="Меньше очков">−</button><span class="num v">${st.tb === null ? '—' : st.tb}</span><button type="button" class="btn quiet step" data-tb="1" aria-label="Больше очков">+</button></div>
        <p class="muted">${st.tb === null ? 'Не указан — в счёте будет просто 7:6' : `Тай-брейк ${tbWin(st.tb)}:${st.tb}`}</p></section>` : ''}
      ${fix ? `<section class="sc-q"><h2 class="h3">Почему исправляете? <span class="muted">(можно не указывать)</span></h2>
        <div class="chips" role="radiogroup" aria-label="Почему исправляете">${REASONS.map((x) => `<button type="button" class="chip" role="radio" aria-checked="${st.reason === x}" data-reason="${esc(x)}">${icon('check')}${esc(x)}</button>`).join('')}</div>
        ${st.reason === 'Другое' ? `<div class="field"><label class="label" for="sc-why">Коротко, что случилось</label><input class="input" id="sc-why" value="${esc(st.why)}" autocomplete="off"><span class="hint">Уйдёт в журнал, игроки не видят</span></div>` : ''}</section>` : ''}`;
    if (onChange) onChange(api);
  };
  root.addEventListener('click', (e) => {
    const t = e.target;
    const rs = t.closest('[data-reason]'); if (rs) { st.reason = st.reason === rs.dataset.reason ? null : rs.dataset.reason; draw(); return; }
    const w = t.closest('[data-win]');
    if (w) {
      const i = +w.dataset.win;
      if (st.other) { // в «Другом счёте» победитель — из геймов: меняем их местами
        const c = checkSet(st.a, st.b); if (c.ok && c.winner !== i) [st.a, st.b] = [st.b, st.a];
        else if (!c.ok) { st.a = i === 0 ? 6 : 4; st.b = i === 0 ? 4 : 6; }
      } else st.winner = i;
      draw(); return;
    }
    const sc = t.closest('.sc-tile[data-w]');
    if (sc) {
      if (st.winner === null && !st.other) { st.pick = [+sc.dataset.w, +sc.dataset.l]; draw(); if (onChange) onChange(api, 'Счёт запомнил. Теперь выберите, кто выиграл'); return; }
      st.other = false; st.pick = [+sc.dataset.w, +sc.dataset.l]; if (!(st.pick[0] === 7 && st.pick[1] === 6)) st.tb = null; draw(); return;
    }
    if (t.closest('[data-other]')) { st.other = true; if (st.pick && st.winner !== null) { const [a, b] = st.pick; st.a = st.winner === 0 ? a : b; st.b = st.winner === 0 ? b : a; } draw(); return; }
    const sp = t.closest('[data-stp]');
    if (sp) { const i = +sp.dataset.stp; const d = +sp.dataset.d; if (i === 0) st.a = Math.max(0, Math.min(9, st.a + d)); else st.b = Math.max(0, Math.min(9, st.b + d)); draw(); return; }
    const tb = t.closest('[data-tb]');
    if (tb) { const d = +tb.dataset.tb; st.tb = st.tb === null ? (d > 0 ? 0 : null) : st.tb + d < 0 ? null : Math.min(30, st.tb + d); draw(); }
  });
  root.addEventListener('input', (e) => { if (e.target.id === 'sc-why') { st.why = e.target.value; if (onChange) onChange(api); } });
  const api = {
    get: () => { const r = result(); return r ? { ...r, reason: st.reason === 'Другое' && st.why.trim() ? `Другое: ${st.why.trim()}` : st.reason } : null; },
    missing,
    same,
    // слова на главной кнопке: «Сохранить счёт 6:4», «Сохранить исправленный счёт 7:5»
    button: () => { const r = result(); const s = r && !same() ? scoreText(r.sets, r.winner) : ''; return `${fix ? 'Сохранить исправленный счёт' : 'Сохранить счёт'}${s ? ' ' + s : ''}`; },
  };
  draw();
  return api;
}
