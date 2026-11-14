// Турнирные экраны: что выводится из мира D и из общего состояния раздела.
// Пары «Июльского кубка» — в основе: D.ROSTER['jul-4'] (мир) и D.pairsNow('jul-4') (мир и решения).
// Матч сейчас — мир и сделанное: введённый или исправленный счёт (scores.<матч>) и перенос (moves.<матч>).
import { D, state } from '../admin.js';

export const CORRIDOR = D.RULES.corridor;                 // [7.0, 8.5] — правила сезона
export const pairPlayers = (id) => D.pair(id).players.map((p) => D.player(p));
export const kpr = (id) => pairPlayers(id).reduce((s, p) => s + p.kpr, 0);
export const points = (id) => pairPlayers(id).reduce((s, p) => s + p.points, 0);
export const kprText = (x) => x.toFixed(1);
export const corridorText = () => `${kprText(CORRIDOR[0])}–${kprText(CORRIDOR[1])}`;
// 'in' | 'above' | 'below'
export const where = (id) => { const s = kpr(id); return s > CORRIDOR[1] + 1e-9 ? 'above' : s < CORRIDOR[0] - 1e-9 ? 'below' : 'in'; };

// Матч сейчас: копия мира, поверх — перенос (только у ещё не сыгранного) и счёт из раздела.
// m.moved — где стоял по программе; m.score — как правили: { was, why, confirmed }.
export function matchNow(id) {
  const w = D.match(id);
  if (!w) return null;
  const m = JSON.parse(JSON.stringify(w));
  const mv = state.get(`moves.${id}`);
  if (mv && mv.court && mv.time && w.state === 'soon') { m.court = mv.court; m.time = mv.time; m.moved = { court: w.court, time: w.time }; }
  const sc = state.get(`scores.${id}`);
  if (sc && Array.isArray(sc.sets) && sc.sets.length) {
    m.sets = sc.sets; m.winner = sc.winner;
    if (w.state !== 'done') m.entered = true;
    m.state = 'done';
    delete m.games; delete m.points; delete m.server;
  }
  if (sc) m.score = sc;
  return m;
}
// матчи сегодняшнего дня в порядке программы
export const dayMatchesNow = () => D.DAY_MATCHES.map((m) => matchNow(m.id));

// Накладки в черновых днях этапа — то же правило, что на «Расписании» (tourPlan): два матча на одном корте
// в одно время, матч в перерыв или на закрытом корте. Накладка двух матчей — одна; оставленные так не считаются.
// days — черновые дни { день: { rows, place, breaks, kept } }, по умолчанию мир и сделанное (D.daysNow).
// → [{ day, court, row: { t, about }, ids, kind: 'court' | 'break' }] по порядку дней и времени
export function draftClashes(tid, days = D.daysNow(tid), round = D.RULES.slot || 50) {
  const out = [];
  D.stageNow(tid).play.forEach((iso) => {
    const d = days[iso]; if (!d || !d.place) return;
    const kept = new Set(d.kept || []);
    const rows = d.rows || [];
    const rowOf = (k) => rows.find((r) => r.key === k);
    const cells = {};
    Object.entries(d.place).forEach(([id, [c, r]]) => { (cells[`${c}|${r}`] = cells[`${c}|${r}`] || []).push(id); });
    Object.entries(cells).forEach(([cell, ids]) => {
      const [c, r] = cell.split('|');
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const a = ids[i]; const b = ids[j];
          if (!kept.has(`${a}|court:${b}`) || !kept.has(`${b}|court:${a}`)) out.push({ day: iso, court: c, row: rowOf(r), ids: [a, b], kind: 'court' });
        }
      }
    });
    (d.breaks || []).forEach((br) => {
      Object.entries(d.place).forEach(([id, [c, r]]) => {
        const row = rowOf(r); if (!row) return;
        if ((!br.court || br.court === c) && row.min < br.to && row.min + round > br.from && !kept.has(`${id}|brk:${br.id}`)) out.push({ day: iso, court: c, row, ids: [id], kind: 'break' });
      });
    });
  });
  return out.sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : (x.row ? x.row.min : 0) - (y.row ? y.row.min : 0)));
}

// Счёт сыгранных сетов этапа — для длины матча: { '6:4': 9, '7:6': 2, … }
export function stageScores() {
  const out = {};
  D.MATCHES.filter((m) => m.state === 'done').forEach((m) => {
    const [a, b] = m.sets[0]; const k = `${Math.max(a, b)}:${Math.min(a, b)}`;
    out[k] = (out[k] || 0) + 1;
  });
  return out;
}
// Темп сегодняшних сыгранных матчей: минут на гейм (длительность / геймы)
export function todayPace() {
  let min = 0; let games = 0;
  D.DAY_MATCHES.filter((m) => m.state === 'done' && m.duration).forEach((m) => {
    min += parseInt(m.duration, 10); games += m.sets[0][0] + m.sets[0][1];
  });
  return { min, games, perGame: min / games };
}

// «Хвана и Орлова» не нужно: везде «Хван / Орлов» (D.pairName) или «Хван и Орлов» (pairAnd)
export const courtWord = (c) => D.COURTS[c].name;               // «Корт 3»
export const courtLow = (c) => D.COURTS[c].name.toLowerCase();  // «корт 3»
export const courtAt = (c) => courtLow(c).replace('корт', 'корте');
export const courtShort = (c) => {
  const x = D.COURTS[c];
  return `${x.name}${x.note ? ' · ' + x.note : ''}`;
};
// «Ильин / Каримов» не рвётся строкой посередине пары — так же пишет журнал
export const pairTight = (id) => D.pairName(id).replace(/ \/ /g, ' / ');
