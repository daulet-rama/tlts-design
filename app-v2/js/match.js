// Общее для экранов «Афиша матча» и «Матч сыгран»: какой матч открыть, путь пар по этапу,
// личные встречи и вывод словами для сыгранного матча. Часы мира, шторка «Поделиться»,
// карточка 9:16, переключатель разделов и розыгрыш по очкам — общие, из app.js.
import { D } from '../app.js';

export const Q = new URLSearchParams(location.search);

// ---------- какой матч ----------
// ?m=<id> нужного состояния; иначе — матч по умолчанию
export function pickMatch(state, fallback) {
  const id = Q.get('m');
  const m = id ? D.match(id) : null;
  return m && m.state === state ? m : D.match(fallback);
}
// у групповых матчей корта в data.js нет — шапка грунтовая, как у «Матча»
export const surfaceOf = (m) => (m.court ? D.court(m.court).surface : 'clay');

// порядок матчей этапа: день, время, порядок в data.js (у групповых матчей времени нет)
const dayOf = (m) => parseInt(m.day, 10) || 0;
export const byTime = (a, b) => dayOf(a) - dayOf(b) || String(a.time || '').localeCompare(String(b.time || '')) || D.MATCHES.indexOf(a) - D.MATCHES.indexOf(b);

// ---------- путь пары по этапу ----------
// Сыгранные матчи пары до матча upto: победа или нет, геймы своими и чужими.
export function pairPath(pairId, upto = null) {
  return D.MATCHES
    .filter((x) => x.state === 'done' && x.pairs.includes(pairId) && (!upto || byTime(x, upto) < 0))
    .sort(byTime)
    .map((x) => {
      const i = x.pairs.indexOf(pairId);
      const gf = x.sets.reduce((s, set) => s + set[i], 0);
      const ga = x.sets.reduce((s, set) => s + set[1 - i], 0);
      return { m: x, win: x.winner === i, gf, ga, score: x.sets.map((set) => `${set[i]}:${set[1 - i]}`).join(' ') };
    });
}
export function pairRecord(path) {
  return {
    won: path.filter((r) => r.win).length,
    lost: path.filter((r) => !r.win).length,
    gf: path.reduce((s, r) => s + r.gf, 0),
    ga: path.reduce((s, r) => s + r.ga, 0),
  };
}
// следующий матч пары после матча m
export function nextMatchOf(pairId, m) {
  return D.MATCHES.filter((x) => x.pairs.includes(pairId) && byTime(x, m) > 0).sort(byTime)[0] || null;
}

// ---------- личные встречи ----------
// Счёт и список встреч — из data.js (h2h.record, h2h.list). Список показывается, только если
// сходится со счётом; иначе — одна последняя встреча (h2h.last).
export function meetingsOf(m) {
  if (!m.h2h) return { record: null, list: [], last: null };
  const record = m.h2h.record.split(/[–-]/).map(Number);
  let list = m.h2h.list || [];
  const w = [0, 1].map((i) => list.filter((x) => x.winner === i).length);
  if (w[0] !== record[0] || w[1] !== record[1]) list = [];
  return { record, list, last: m.h2h.last };
}

// ---------- слова ----------
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
const NUM = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'];
export const gamesWord = (n) => `${NUM[n] || n} ${plural(n, 'гейм', 'гейма', 'геймов')}`;
// «Громова / Юсупова» — родительный падеж фамилий пары
export const pairGen = (id) => D.pair(id).players.map((x) => D.genitive(D.player(x).last)).join(' / ');
export const upFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

// ---------- время дня ----------
const pad = (n) => String(n).padStart(2, '0');
export const toMin = (t) => { const [h, mm] = String(t).split(':').map(Number); return h * 60 + mm; };
export const hhmm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.floor(min) % 60)}`;

// ---------- сыгранный матч словами ----------
// Самое большое отставание победителя и чем оно кончилось: «с 2:4 — четыре гейма подряд».
export function comebackOf(story, w) {
  let worst = null;
  for (const g of story.games) {
    const d = g.score[1 - w] - g.score[w];
    if (d > 0 && (!worst || d >= worst.d)) worst = { d, at: [g.score[w], g.score[1 - w]], n: g.n };
  }
  if (!worst || worst.d < 2) return null;
  const after = story.games.filter((g) => g.n > worst.n);
  const streak = after.every((g) => g.winner === w) ? after.length : 0;
  return { ...worst, streak };
}

// Вывод словами: отыгрались, тай-брейк, ни одной отданной подачи, решающий брейк — или просто итог.
export function doneSay(m, story) {
  const w = m.winner;
  const set = m.sets[m.sets.length - 1];
  if (story) {
    const c = comebackOf(story, w);
    if (c) return `Отыгрались с ${c.at[0]}:${c.at[1]}${c.streak >= 3 ? ` — ${gamesWord(c.streak)} подряд` : ''}`;
  }
  if (set[2] !== undefined) return `Сет решил тай-брейк, ${Math.max(7, set[2] + 2)}:${set[2]}`;
  if (story) {
    if (!story.breaks[1 - w]) return `${D.pairName(m.pairs[w])} не отдали ни одной подачи`;
    const last = story.games.filter((g) => g.brk && g.winner === w).pop();
    if (last) return `Решил брейк в ${last.n}-м гейме`;
  }
  return `${D.pairName(m.pairs[w])} выиграли ${D.setsText(m, w)}`;
}
