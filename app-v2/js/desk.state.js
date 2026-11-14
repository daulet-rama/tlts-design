// Общий день пульта и экрана вызова: вызовы, ответы пар, журнал, расчёт дождя.
// Время — часы мира из app.js (worldSec): те же, что у «Матча», табло и плашек.
// В состоянии записано, когда по часам браузера в мире было 18:47:12 (t0): экран вызова
// в соседней вкладке идёт ровно по тем же часам, что и пульт, который сделал вызов.
// В дне уже есть вызов на корт 2 в 18:45 из журнала дня (D.CALLS) — его видят и табло, и пульт.
// Хранится в этом браузере 45 минут и сбрасывается вместе с часами мира.
// Если хранилище недоступно, всё работает в памяти страницы.
import { D, worldSec, WORLD_START } from '../app.js';
import { toMin } from './desk.logic.js';

const KEY = 'tl-desk-day-v2';
const WORLD_KEY = 'tl-world-v1';   // когда начался мир (app.js): мир начался заново — и день тоже
const TTL = 45 * 60 * 1000;

// когда (по часам браузера) на этой странице в мире было 18:47:12
export const pageT0 = () => Date.now() - (worldSec() - WORLD_START) * 1000;
// минуты дня в мире по часам состояния (дробные)
export const nowOf = (s) => (WORLD_START + (Date.now() - s.t0) / 1000) / 60;

const worldKey = () => { try { return Number(window.localStorage.getItem(WORLD_KEY)) || 0; } catch { return 0; } };
// ?now=19:36 — пульт в другой момент дня: его день живёт по своим часам и не ждёт общих
const NOW = new URLSearchParams(location.search).has('now');

function fresh() {
  const s = { v: 2, created: Date.now(), t0: pageT0(), w: NOW ? null : worldKey(), calls: {}, shared: {}, log: [], rain: null, pick: null };
  sharedCalls(s);
  return s;
}

// Вызовы из журнала дня (D.CALLS): появляются в дне, когда до них дошло время, — один раз
// (отменённый директором вызов сам не возвращается).
export function sharedCalls(s) {
  let added = false;
  s.shared = s.shared || {};
  for (const c of D.CALLS) {
    const at = toMin(c.at);
    if (s.shared[c.match] || nowOf(s) < at) continue;
    s.shared[c.match] = true;
    if (!s.calls[c.match]) s.calls[c.match] = { at, by: 'Директор', reads: {}, replies: {}, onCourt: {}, shared: true };
    added = true;
  }
  return added;
}

// день действителен 45 минут и, если он идёт по общим часам, — пока эти часы не начались заново
function read() {
  try {
    const s = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (s && s.v === 2 && Number.isFinite(s.t0) && Number.isFinite(s.created)
      && Date.now() - s.created < TTL && (s.w === null || s.w === worldKey())) {
      return { ...s, calls: s.calls || {}, log: Array.isArray(s.log) ? s.log : [] };
    }
  } catch { /* хранилище недоступно или испорчено */ }
  return null;
}

function write(s) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* только в памяти */ }
}

let mem = null;
const mine = (s) => s && Math.abs(s.t0 - pageT0()) < 2000;   // день идёт по часам этой страницы

// Пульт: день по часам этой страницы (чужой или устаревший начинается заново).
export function own() {
  const s = read();
  if (mine(s)) { mem = s; return s; }
  if (mine(mem)) return mem;
  mem = fresh();
  write(mem);
  return mem;
}

// Экран вызова: день любого открытого пульта, если он есть (сам день не заводит).
export function peek() {
  return read() || mem;
}

// any: true — экран вызова меняет день пульта, по чьим бы часам он ни шёл (сам день не заводит)
export function update(fn, any = false) {
  const r = read();
  const s = any ? (r || mem) : ((mine(r) && r) || (mine(mem) && mem) || fresh());
  if (!s) return null;
  fn(s);
  mem = s;
  write(s);
  return s;
}

// запись журнала; at — минуты дня (по умолчанию «сейчас»)
export function addLog(s, entry) {
  s.log.push({ at: nowOf(s), ...entry });
  if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
}

// изменения из соседней вкладки
export function onChange(fn) {
  window.addEventListener('storage', (e) => { if (e.key === KEY) fn(read()); });
}
export const isMine = mine;
