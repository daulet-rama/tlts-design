// Арифметика группы — чистые расчёты без страницы.
// Места в группе по регламенту лиги:
//   - место — по числу побед;
//   - у двух пар поровну побед — выше та, что выиграла личную встречу;
//   - у трёх и больше — по проценту выигранных геймов от всех сыгранных в группе;
//     если процент равен у двух из них — личная встреча.
// Матч группы: [i, j, ga, gb] — индексы пар в группе и геймы.

/** Все законные итоги одного сета для победителя: 6:0 … 6:4, 7:5, 7:6. */
export const WIN_SCORES = Object.freeze([[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]]);
const OUTCOMES = [...WIN_SCORES.map(([w, l]) => [w, l]), ...WIN_SCORES.map(([w, l]) => [l, w])];

/** Строки таблицы: победы, поражения, геймы, процент. */
export function tableRows(n, matches) {
  const rows = Array.from({ length: n }, (_, i) => ({ i, w: 0, l: 0, gw: 0, gl: 0, played: 0 }));
  for (const [a, b, ga, gb] of matches) {
    const ra = rows[a];
    const rb = rows[b];
    ra.gw += ga; ra.gl += gb; rb.gw += gb; rb.gl += ga;
    ra.played += 1; rb.played += 1;
    if (ga > gb) { ra.w += 1; rb.l += 1; } else if (gb > ga) { rb.w += 1; ra.l += 1; }
  }
  for (const r of rows) { r.games = r.gw + r.gl; r.pct = r.games ? (r.gw / r.games) * 100 : 0; }
  return rows;
}

// сравнение процентов без округления
function cmpPct(r1, r2) {
  const t1 = r1.games || 1;
  const t2 = r2.games || 1;
  const x = (r1.games ? r1.gw : 0) * t2;
  const y = (r2.games ? r2.gw : 0) * t1;
  return x === y ? 0 : x > y ? -1 : 1;
}

/** Личная встреча двух пар: победитель или null. */
export function headToHead(matches, x, y) {
  for (const m of matches) {
    const [a, b, ga, gb] = m;
    if ((a === x && b === y) || (a === y && b === x)) {
      if (ga === gb) return { winner: null, match: m };
      return { winner: ga > gb ? a : b, match: m };
    }
  }
  return { winner: null, match: null };
}

/**
 * Места по регламенту.
 * → { order, place, rows, ties, unresolved, preliminary }
 *   ties: [{ wins, members, by: 'h2h' | 'pct' | 'pending' | 'none', h2h?, sub? }]
 */
export function rankGroup(n, matches) {
  const rows = tableRows(n, matches);
  const byWins = [...rows].sort((a, b) => b.w - a.w || a.i - b.i);
  const order = [];
  const ties = [];
  let unresolved = false;
  let preliminary = false;
  for (let s = 0; s < byWins.length;) {
    let e = s;
    while (e < byWins.length && byWins[e].w === byWins[s].w) e += 1;
    let block = byWins.slice(s, e).map((r) => r.i);
    if (block.length === 2) {
      const h = headToHead(matches, block[0], block[1]);
      if (h.match === null) {
        preliminary = true;
        block = block.map((i) => rows[i]).sort((a, b) => cmpPct(a, b) || a.i - b.i).map((r) => r.i);
        ties.push({ wins: byWins[s].w, members: block, by: 'pending', h2h: null });
      } else if (h.winner === null) {
        unresolved = true;
        ties.push({ wins: byWins[s].w, members: block, by: 'none', h2h: h.match });
      } else {
        block = [h.winner, block.find((x) => x !== h.winner)];
        ties.push({ wins: byWins[s].w, members: block, by: 'h2h', h2h: h.match });
      }
    } else if (block.length >= 3) {
      const sorted = block.map((i) => rows[i]).sort((a, b) => cmpPct(a, b) || a.i - b.i);
      const res = [];
      const sub = [];
      for (let k = 0; k < sorted.length;) {
        let m = k;
        while (m < sorted.length && cmpPct(sorted[m], sorted[k]) === 0) m += 1;
        let part = sorted.slice(k, m).map((r) => r.i);
        if (part.length === 2) {
          const h = headToHead(matches, part[0], part[1]);
          if (h.match === null) { preliminary = true; sub.push({ members: part, by: 'pending', h2h: null }); }
          else if (h.winner === null) { unresolved = true; sub.push({ members: part, by: 'none', h2h: h.match }); }
          else { part = [h.winner, part.find((x) => x !== h.winner)]; sub.push({ members: part, by: 'h2h', h2h: h.match }); }
        } else if (part.length > 2) {
          unresolved = true;
          sub.push({ members: part, by: 'none', h2h: null });
        }
        res.push(...part);
        k = m;
      }
      block = res;
      ties.push({ wins: byWins[s].w, members: block, by: 'pct', sub });
    }
    order.push(...block);
    s = e;
  }
  const place = {};
  order.forEach((i, k) => { place[i] = k + 1; });
  return { order, place, rows, ties, unresolved, preliminary };
}

/** Регламент не решает, по какую сторону черты стоит пара. */
export function openAtCut(rank, me, cut = 2) {
  if (!rank.unresolved) return false;
  const groups = [];
  for (const t of rank.ties) {
    if (t.by === 'none') groups.push(t.members);
    for (const s of t.sub || []) if (s.by === 'none') groups.push(s.members);
  }
  return groups.some((g) => {
    if (!g.includes(me)) return false;
    const pl = g.map((i) => rank.place[i]);
    return Math.min(...pl) <= cut && Math.max(...pl) > cut;
  });
}

/**
 * «Что вам нужно»: перебирает все законные счета оставшихся матчей (каждый — полный сет)
 * и отвечает категориями, без точного счёта.
 * → { mine, others, total,
 *     byWins: [{ wins, of, result: 'always'|'never'|'depends', on, places: [мин, макс], by: Set('wins'|'h2h'|'pct'…) }] }
 */
export function whatYouNeed(n, played, remaining, me, cut = 2) {
  const myIdx = remaining.map((m, k) => (m[0] === me || m[1] === me ? k : -1)).filter((k) => k >= 0);
  const others = remaining.map((_, k) => k).filter((k) => !myIdx.includes(k));
  const buckets = new Map();
  let total = 0;
  const pick = new Array(remaining.length);
  const walk = (k) => {
    if (k === remaining.length) {
      total += 1;
      const ms = played.concat(remaining.map(([a, b], x) => [a, b, pick[x][0], pick[x][1]]));
      const r = rankGroup(n, ms);
      const inTop = r.place[me] <= cut;
      const res = openAtCut(r, me, cut) ? 'open' : inTop ? 'in' : 'out';
      let myWins = 0;
      for (const x of myIdx) {
        const [a, b] = remaining[x];
        const [ga, gb] = pick[x];
        if ((a === me && ga > gb) || (b === me && gb > ga)) myWins += 1;
      }
      const winners = others.map((x) => { const [a, b] = remaining[x]; return pick[x][0] > pick[x][1] ? a : b; });
      const mine = myIdx.map((x) => { const [a, b] = remaining[x]; return pick[x][0] > pick[x][1] ? a : b; });
      if (!buckets.has(myWins)) buckets.set(myWins, { map: new Map(), places: new Set(), by: new Set() });
      const bk = buckets.get(myWins);
      bk.places.add(r.place[me]);
      const tie = r.ties.find((t) => t.members.includes(me));
      bk.by.add(!tie ? 'wins' : tie.by);
      const key = mine.join(',') + '|' + winners.join(',');
      if (!bk.map.has(key)) bk.map.set(key, { winners, mine, results: new Set() });
      bk.map.get(key).results.add(res);
      return;
    }
    for (const o of OUTCOMES) { pick[k] = o; walk(k + 1); }
  };
  walk(0);

  const verdict = (set) => (set.size === 1 && set.has('in') ? 'always' : set.size === 1 && set.has('out') ? 'never' : 'depends');
  const byWins = [];
  for (let w = myIdx.length; w >= 0; w -= 1) {
    const bk = buckets.get(w);
    if (!bk) continue;
    const all = new Set();
    let gamesMatter = false;
    const perOthers = new Map();
    for (const { winners, results } of bk.map.values()) {
      results.forEach((x) => all.add(x));
      if (results.size > 1 || results.has('open')) gamesMatter = true;
      const k = winners.join(',');
      if (!perOthers.has(k)) perOthers.set(k, new Set());
      results.forEach((x) => perOthers.get(k).add(x));
    }
    const result = verdict(all);
    const othersMatter = new Set([...perOthers.values()].map(verdict)).size > 1;
    const on = result !== 'depends' ? null : gamesMatter && othersMatter ? 'both' : gamesMatter ? 'games' : 'others';
    const pl = [...bk.places];
    byWins.push({ wins: w, of: myIdx.length, result, on, places: [Math.min(...pl), Math.max(...pl)], by: bk.by });
  }
  return { mine: myIdx.length, others: others.map((k) => remaining[k]), byWins, total };
}

/** Сколько выигранных геймов вместо проигранных нужно было паре rowLow, чтобы обойти rowHigh по проценту. */
export function gamesToPass(rowLow, rowHigh) {
  for (let k = 0; k <= rowLow.gl; k += 1) {
    if ((rowLow.gw + k) * rowHigh.games > rowHigh.gw * rowLow.games) return k;
  }
  return null;
}

/* ---------- сетка плей-офф ----------
   Круги записаны от первого к финалу: [{ key, ids }]. Матч k круга r+1 ждёт победителей
   матчей 2k и 2k+1 круга r — так сетка записана в data.js (BRACKET). */

/**
 * Дерево сетки. → { rounds: [{ key, ids, from: [[a, b], …] | null }], ok }
 * ok — круги сходятся как надо: n, n/2, …, 1 (8 пар — 4, 2, 1; 16 пар — 8, 4, 2, 1; 4 пары — 2, 1).
 */
export function bracketTree(rounds) {
  const out = rounds.map((r, i) => ({ ...r, from: i ? r.ids.map((_, k) => [2 * k, 2 * k + 1]) : null }));
  const ok = rounds.length > 0
    && rounds[rounds.length - 1].ids.length === 1
    && rounds.every((r, i) => r.ids.length > 0 && (i === 0 || r.ids.length * 2 === rounds[i - 1].ids.length));
  return { rounds: out, ok };
}

/**
 * Путь пары по сетке. match(id) → { pairs, state, winner }.
 * → { steps: [{ r, k, id, won }], end }
 *   won: true / false — выиграла / проиграла, null — матч ещё не сыгран;
 *   end: 'champion' — выиграла финал, 'out' — проиграла, 'ahead' — ближайший матч впереди, null — пары нет в сетке.
 */
export function pairPath(rounds, match, pair) {
  const steps = [];
  for (let r = 0; r < rounds.length; r += 1) {
    const k = rounds[r].ids.findIndex((id) => (match(id)?.pairs || []).includes(pair));
    if (k < 0) { if (steps.length) break; continue; }
    const m = match(rounds[r].ids[k]);
    const won = m.state === 'done' ? m.pairs[m.winner] === pair : null;
    steps.push({ r, k, id: rounds[r].ids[k], won });
    if (won !== true) break;
  }
  const last = steps[steps.length - 1];
  const end = !last ? null : last.won === false ? 'out' : last.won === null ? 'ahead' : 'champion';
  return { steps, end };
}

/** Победитель сыгранного матча или null. */
export const winnerOf = (m) => (m && m.state === 'done' ? m.pairs[m.winner] : null);

/** Процент по-русски: 66,67 %. */
export const fmtPct = (x, digits = 2) => `${x.toFixed(digits).replace('.', ',')} %`;

/** Склонение: plural(3, 'победа', 'победы', 'побед'). */
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
