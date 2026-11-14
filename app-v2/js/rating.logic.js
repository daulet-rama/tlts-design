// Раздел «Рейтинг»: расчёты по общему миру data.js — сезон игрока, титулы, встречи с вами,
// напарники, приглашение в пару и поиск. Своих данных здесь нет: карьера игроков до июня —
// D.CAREER, этапы — D.TOURNAMENTS, июньские матчи — D.MATCHES, приглашения — D.INVITES.
// Коридор пары считает та же функция, что на экране напарника (partner.logic.js).
import * as D from '../data.js';
import { checkPair, corridorText, fmtK } from './partner.logic.js';

export { corridorText, fmtK };

const NONE = { early: '', tours: 0, semis: 0, finals: 0, wins: 0, cup: 0, second: 0, mates: [], vs: null };
const career = (pid) => D.CAREER[pid] || NONE;

// ---------- матчи июньского этапа ----------

const DAY = (m) => parseInt(m.day, 10);
const ORDER = (m) => DAY(m) * 10000 + (m.time ? parseInt(m.time, 10) * 100 + parseInt(m.time.slice(3), 10) : 0);

// матчи июньского этапа пары игрока по порядку
export function stageMatches(pid) {
  const pr = D.pairOf(pid);
  if (!pr) return [];
  return D.MATCHES.filter((m) => m.pairs.includes(pr.id)).sort((a, b) => ORDER(a) - ORDER(b));
}

const roundWords = (m) => (m.round === 'group' ? `в группе ${m.group}`
  : m.round === 'qf' ? 'в четвертьфинале'
    : m.round === 'sf' ? 'в полуфинале'
      : m.round === 'f' ? 'в финале'
        : m.title.toLowerCase());

// сезон точками: апрель и май — из D.CAREER, июнь — сыгранные матчи этапа
export function season(pid) {
  if (D.pair(D.ME.pair).players.includes(pid)) {
    // ваш напарник сыграл весь сезон с вами: та же запись, что на вашей карте
    const s = D.ME.season;
    return { form: s.form.split(''), won: s.won, lost: s.lost, say: s.lastSay };
  }
  const pr = D.pairOf(pid);
  const done = stageMatches(pid).filter((m) => m.state === 'done');
  const june = done.map((m) => (m.pairs[m.winner] === pr.id ? 'W' : 'L'));
  const form = [...career(pid).early.split('').filter(Boolean), ...june];
  const won = form.filter((x) => x === 'W').length;
  const last = done[done.length - 1];
  const say = last ? `Последний — ${D.setsText(last, last.pairs.indexOf(pr.id))} ${roundWords(last)}` : '';
  return { form, won, lost: form.length - won, say };
}

// матч игрока, который идёт сейчас или будет сегодня
export function todayMatch(pid) {
  return stageMatches(pid).find((m) => m.state === 'live' || m.state === 'soon') || null;
}

// титулы: победы этапов 2027 года — из D.TOURNAMENTS, полуфинал июня — из D.MATCHES.
// Финал июньского этапа ещё не сыгран (20:00) — в «Финалы» он попадёт после игры.
export function titles(pid) {
  const x = career(pid);
  const won2027 = D.TOURNAMENTS.filter((t) => t.state === 'done' && t.winner && D.pair(t.winner).players.includes(pid));
  const juneSemi = stageMatches(pid).some((m) => m.round === 'sf' && m.state === 'done');
  return {
    wins: x.wins + won2027.length,
    won2027,
    finals: x.finals,
    semis: x.semis + (juneSemi ? 1 : 0),
    cup: x.cup,
    second: x.second,
    tours: x.tours,
  };
}

// встречи с вами: до июня — из D.CAREER, июнь — из D.MATCHES (счёт глазами вашей пары)
export function versusMe(pid) {
  const mine = D.ME.pair;
  const pr = D.pairOf(pid);
  if (!pr || pr.id === mine) return { won: 0, lost: 0, last: null, next: null, partner: true };
  const x = career(pid).vs;
  let won = x ? x[0] : 0;
  let lost = x ? x[1] : 0;
  let last = null;
  if (x) {
    const [where, score] = x[2].split(' · ');
    const [a, b] = score.split(':').map(Number);
    last = { where, score, won: a > b };
  }
  let next = null;
  for (const m of stageMatches(pid)) {
    if (!m.pairs.includes(mine)) continue;
    if (m.state !== 'done') { next = m; continue; }
    const side = m.pairs.indexOf(mine);
    if (m.winner === side) won += 1; else lost += 1;
    const where = m.round === 'group' ? `группа ${m.group}` : m.title.toLowerCase();
    last = { where: `${D.TOURNAMENT.name}, ${where}`, score: D.setsText(m, side), won: m.winner === side };
  }
  return { won, lost, last, next, partner: false };
}

// напарники за всё время: игрок и сколько матчей вместе
export function mates(pid) {
  return career(pid).mates.map(([id, n]) => ({ id, n }));
}

// ---------- приглашение в пару на ближайший этап ----------
// Приглашения живут на экране напарника (partner.html): карточка к нему ведёт и показывает
// то же состояние. В пределах вкладки он хранит его в sessionStorage (ключ tl-partner-vN,
// берём самый новый), иначе — приглашения из D.INVITES.
// Этап — как на экране напарника: открытый этап с коридором, то есть Июльский кубок.
export const nextStage = () => D.TOURNAMENTS.find((t) => t.state === 'open' && t.corridor) || D.tournament('jul-4');
export function partnerState(T = nextStage()) {
  try {
    const keys = Object.keys(sessionStorage).filter((k) => /^tl-partner-v\d+$/.test(k))
      .sort((a, b) => Number(b.slice(12)) - Number(a.slice(12)));
    const s = keys.length ? JSON.parse(sessionStorage.getItem(keys[0]) || 'null') : null;
    if (s && s.inv && typeof s.inv === 'object') return { inv: s.inv, app: s.app && D.player(s.app.with) ? s.app : null };
  } catch { /* хранилища нет — приглашения из data.js */ }
  const inv = D.INVITES.filter((x) => !x.tournament || x.tournament === T.id).map((x) => [x.player, { dir: x.dir, when: x.when }]);
  return { inv: Object.fromEntries(inv), app: null };
}

// что можно сделать с игроком на этом этапе — так же, как на экране напарника:
// app — ваша заявка с ним, busy — заявка с другим, in — он зовёт вас, out — вы позвали,
// ok — сумма уровней в коридоре, off — вне коридора («позвать всё равно»)
export function inviteState(pid, st = partnerState()) {
  const T = nextStage();
  const c = checkPair(D.player(D.ME.player).kpr, D.player(pid).kpr, T.corridor);
  const inv = st.inv[pid];
  const base = { T, c, corridor: T.corridor };
  if (st.app && st.app.with === pid) return { ...base, kind: 'app', out: !!st.app.out };
  if (st.app) return { ...base, kind: 'busy', with: st.app.with };
  if (inv && inv.dir === 'in') return { ...base, kind: 'in', when: inv.when };
  if (inv && inv.dir === 'out') return { ...base, kind: 'out', when: inv.when };
  return { ...base, kind: c.ok ? 'ok' : 'off' };
}

// ---------- слова ----------

// склонение: 1 матч, 2 матча, 5 матчей
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}

// поиск как в «Найти себя»: каждое слово запроса — начало имени или фамилии, фамилия — и серединой
const KZ = { 'ә': 'а', 'ғ': 'г', 'қ': 'к', 'ң': 'н', 'ө': 'о', 'ұ': 'у', 'ү': 'у', 'һ': 'х', 'і': 'и', 'ё': 'е' };
export const norm = (s) => String(s || '').toLowerCase().replace(/[әғқңөұүһіё]/g, (c) => KZ[c]).replace(/\s+/g, ' ').trim();
export function searchPlayers(q) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return null;
  const hits = [];
  for (const p of D.PLAYERS) {
    const last = norm(p.last);
    const first = norm(p.first);
    const all = words.every((w) => last.includes(w) || last.startsWith(w) || first.startsWith(w));
    if (!all) continue;
    const score = last.startsWith(words[0]) ? 0 : first.startsWith(words[0]) ? 1 : 2;
    hits.push([score, p]);
  }
  return hits.sort((a, b) => a[0] - b[0] || a[1].place - b[1].place).map((h) => h[1]);
}
