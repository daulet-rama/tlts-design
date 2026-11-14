// Вызов на корт — один на «День турнира», «Расписание» и «Сегодня»: calls.<матч> в общем состоянии
// (мир — вызов в 18:45 на матч за 5-е место; D.callsNow() — мир и сделанное).
// Часы — часы примера: state.now(), 18:47 и минута на каждое сделанное дело, не дальше 19:04.
// Расчёты часов — пульт турнирного дня (design/site/live/ideas/desk.logic.js):
// часы идут, только когда свободны обе пары и корт; 20 минут на выход (Кодекс, 2.1).
import { D, state, matchName } from '../admin.js';
import { matchClocks, callStatus, leadClock } from '../../live/ideas/desk.logic.js';
import { toMin, hhmm, CALL_LIMIT, SLOT_MIN } from './tournament.logic.js';
import { matchNow, dayMatchesNow, courtLow, courtAt, pairTight } from './tournament.data.js';

// часы дня — часы примера; от них же считается прогноз дня («День турнира», «Сегодня»)
export const dayNow = () => toMin(state.now());
// вызовы, по которым матч ещё не начался
const calls = () => D.callsNow().filter((c) => { const m = matchNow(c.match); return m && m.state === 'soon'; });
export const callOf = (id) => { const c = calls().find((x) => x.match === id); return c ? { at: toMin(c.at) } : null; };
export const callIds = () => calls().map((c) => c.match);

// матчи дня в минутах — для часов вызова; прогноз берёт их с ранним вызовом (forecastList ниже)
export const dayList = () => dayMatchesNow().map((m) => ({ id: m.id, court: m.court, at: toMin(m.time), state: m.state, pairs: m.pairs, length: m.duration ? parseInt(m.duration, 10) : SLOT_MIN }));
// когда пара освободилась: конец её последнего сыгранного матча; играет сейчас — null
function pairFree(day, pid, except) {
  if (day.some((m) => m.id !== except && m.state === 'live' && m.pairs.includes(pid))) return null;
  const ends = day.filter((m) => m.id !== except && m.state === 'done' && m.pairs.includes(pid)).map((m) => m.at + m.length);
  return ends.length ? Math.max(...ends) : -Infinity;
}
function courtFree(day, c, except) {
  if (day.some((m) => m.id !== except && m.court === c && m.state === 'live')) return null;
  const ends = day.filter((m) => m.id !== except && m.court === c && m.state === 'done').map((m) => m.at + m.length);
  return ends.length ? Math.max(...ends) : -Infinity;
}
export function clocksOf(id, calledAt) {
  const m = matchNow(id); const c = calledAt != null ? { at: calledAt } : callOf(id);
  if (!c) return null;
  const day = dayList();
  return matchClocks({ calledAt: c.at, pairs: m.pairs.map((p) => ({ freeAt: pairFree(day, p, id), onCourtAt: null })), courtFreeAt: courtFree(day, m.court, id), now: dayNow() });
}
// если вызвать сейчас: когда пойдут часы на выход (минуты) или null — заняты корт или пары
export function clockStartNow(id) {
  const cs = clocksOf(id, dayNow()); const c = cs && cs.find((x) => x.from != null);
  return c ? c.from : null;
}
// словами: «Ждём обе пары» и «Прошло 2 мин из 20 на выход»
export function callState(id) {
  const cs = clocksOf(id);
  if (!cs) return null;
  const s = callStatus(cs); const lead = leadClock(cs);
  const min = lead ? Math.floor(lead.elapsed) : null;
  return {
    key: s.key, text: s.text, at: hhmm(callOf(id).at),
    clock: lead ? `Прошло ${min} мин из ${CALL_LIMIT} на выход` : 'Часы стоят, пока заняты корт или пары',
    expired: s.key === 'expired', min,
    // когда пошли часы на выход: пары выйдут на корт не позже from + 20 минут
    from: lead ? lead.from : null,
  };
}
// когда обычно вызывают: за 20 минут до начала
export const callTime = (id) => toMin(matchNow(id).time) - CALL_LIMIT;
export const tooEarly = (id) => dayNow() < callTime(id) - 5;

// Вызвали раньше обычного, и часы на выход идут: пары выйдут на корт до «часы + 20 минут»
// (вверх до 5 минут, чтобы не обещать раньше) — матч начнётся около этого времени, раньше программы.
// Иначе null: матч начнётся по программе или когда освободятся корт и пары.
export function readyAt(id) {
  const c = callOf(id); const cs = c ? callState(id) : null;
  if (!cs || cs.from == null) return null;
  const by = Math.ceil((cs.from + CALL_LIMIT) / 5) * 5;
  return c.at < callTime(id) - 5 && by < toMin(matchNow(id).time) ? by : null;
}
// Матчи дня для прогноза (forecastDay, rainOptions) — с ранним вызовом: одна цифра в карточке вызова
// («Вызваны в 18:58 · начнут около 19:20») и в строке дня («Финал раньше — около 19:20 · конец дня около 20:05»).
export const forecastList = () => dayList().map((m) => (m.state === 'soon' ? { ...m, ready: readyAt(m.id) } : m));

// ---------- игрок матча судит другой матч ----------
// Судьи матчей дня — как на «Судьях и доступе»: judges.<матч> в общем состоянии; нет записи — мир:
// судья дня (D.JUDGE) судит свои матчи. В мире Герман Хван судит корт 3 и сам играет финал.
export function judgeOf(mid) {
  const v = state.get(`judges.${mid}`);
  if (v !== undefined) return v;
  return D.JUDGE.matches.includes(mid) ? D.JUDGE.player : null;
}
// Кто из игроков матча судит: now — идущий матч (до какого времени, минуты), later — ещё не начатые
// матчи, которые по программе раньше этого
export function dutiesOf(id) {
  const me = matchNow(id); const out = { now: [], later: [] };
  if (!me) return out;
  const players = me.pairs.flatMap((p) => D.pair(p).players);
  const t0 = toMin(me.time);
  dayMatchesNow().forEach((m) => {
    if (m.id === id || m.state === 'done') return;
    const j = judgeOf(m.id);
    if (!j || !players.includes(j)) return;
    if (m.state === 'live') out.now.push({ pid: j, m, until: D.FORECAST[m.id] ? toMin(D.FORECAST[m.id]) : toMin(m.time) + SLOT_MIN });
    else if (toMin(m.time) < t0) out.later.push({ pid: j, m });
  });
  return out;
}
const lastName = (pid) => (D.player(pid) || {}).last || '';
// в карточке матча вместо «пары и корт свободны»: «Хван судит корт 3 — освободится около 19:05»
export function dutyWords(id) {
  const d = dutiesOf(id).now[0];
  return d ? `${lastName(d.pid)} судит ${courtLow(d.m.court)} — освободится около ${hhmm(d.until)}` : '';
}
// в окне раннего вызова — строками: кто судит сейчас и чей матч останется без судьи
export function dutyLines(id) {
  const d = dutiesOf(id);
  return [
    ...d.now.map((x) => `${lastName(x.pid)} сейчас судит ${courtLow(x.m.court)} — освободится около ${hhmm(x.until)}`),
    ...d.later.map((x) => `В ${x.m.time} ${lastName(x.pid)} — судья на ${courtAt(x.m.court)}: на тот матч нужен другой судья`),
  ];
}

// Вызвать и отменить вызов — сразу, со строкой журнала; вернут undo() для «Отменить»
export function call(id) {
  const m = matchNow(id);
  return state.set(`calls.${id}`, { at: state.now() }, { say: `вызвали на ${courtLow(m.court)}: ${matchName(m.title)} — ${pairTight(m.pairs[0])} и ${pairTight(m.pairs[1])}`, href: 'day.html' });
}
export function uncall(id) {
  const m = matchNow(id);
  return state.set(`calls.${id}`, null, { say: `отменили вызов на ${courtLow(m.court)}: ${matchName(m.title)}`, href: 'day.html' });
}
