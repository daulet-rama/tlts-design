// TLTS · «Арифметика группы» — чистая логика без DOM.
// Места в группе по регламенту о проведении турнира, раздел 3:
//   - место — по числу побед;
//   - равенство у двух пар — выше та, что выиграла личную встречу;
//   - равенство у трёх (и больше) — по проценту выигранных геймов от сыгранных во всех матчах группы;
//     если процент равен у двух из них — личная встреча.
// Матч группы: [i, j, ga, gb] — индексы пар и геймы. Матч без победителя (0:0, 3:3) в победы не идёт.

/** Все законные итоги полного сета для победителя (6:0 … 6:4, 7:5, 7:6). */
export const WIN_SCORES = Object.freeze([[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]]);

/** Полный сет по регламенту (одна сторона 6 при разнице от двух или 7:5, 7:6). */
export function isFullSet(a, b) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6));
}

/** Матч без победителя: 0:0 (неявка без записанного победителя) или ничья в сокращённом матче. */
export const noWinner = (m) => m[2] === m[3];
/** Сокращённый или нестандартный счёт: не полный сет и не 0:0. */
export const isShortened = (m) => !noWinner(m) && !isFullSet(m[2], m[3]);

/** Строки таблицы: победы, поражения, геймы, процент (дробь gw / (gw + gl)). */
export function tableRows(n, matches) {
  const rows = Array.from({ length: n }, (_, i) => ({ i, w: 0, l: 0, gw: 0, gl: 0, played: 0 }));
  for (const [a, b, ga, gb] of matches) {
    const ra = rows[a], rb = rows[b];
    ra.gw += ga; ra.gl += gb; rb.gw += gb; rb.gl += ga;
    ra.played += 1; rb.played += 1;
    if (ga > gb) { ra.w += 1; rb.l += 1; } else if (gb > ga) { rb.w += 1; ra.l += 1; }
  }
  for (const r of rows) { r.games = r.gw + r.gl; r.pct = r.games ? (r.gw / r.games) * 100 : 0; }
  return rows;
}

// сравнение процентов без округления: gw1/t1 против gw2/t2
function cmpPct(r1, r2) {
  const t1 = r1.games || 1, t2 = r2.games || 1;
  const x = (r1.games ? r1.gw : 0) * t2, y = (r2.games ? r2.gw : 0) * t1;
  return x === y ? 0 : x > y ? -1 : 1;     // -1 — у r1 процент выше
}

/** Победитель личной встречи двух пар или null (не сыграна или без победителя). */
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
 * → { order: [индексы пар сверху вниз], place: { [i]: место }, rows, ties, unresolved, preliminary }
 *   ties: [{ wins, members: [i…] в итоговом порядке, by: 'h2h' | 'pct' | 'none', h2h?, sub?: [{ members, by, h2h }] }]
 *     by 'h2h' — двое равных, решила личная встреча (h2h — матч);
 *     by 'pct' — трое и больше, решил процент; sub — подгруппы с равным процентом, решённые личной встречей;
 *     by 'none' — регламент не даёт ответа (нет победителя в личной встрече или процент равен у трёх);
 *     by 'pending' — личная встреча ещё не сыграна: место предварительное, у двух равных пока выше пара
 *       с большим процентом геймов (preliminary: true). Регламент тут не молчит — встреча просто впереди.
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
        // личная встреча ещё не сыграна (группа в игре): место предварительное, пока — по проценту геймов
        preliminary = true;
        block = block.map((i) => rows[i]).sort((a, b) => cmpPct(a, b) || a.i - b.i).map((r) => r.i);
        ties.push({ wins: byWins[s].w, members: block, by: 'pending', h2h: null });
      } else if (h.winner === null) { unresolved = true; ties.push({ wins: byWins[s].w, members: block, by: 'none', h2h: h.match }); }
      else {
        block = [h.winner, block.find((x) => x !== h.winner)];
        ties.push({ wins: byWins[s].w, members: block, by: 'h2h', h2h: h.match });
      }
    } else if (block.length >= 3) {
      const sorted = block.map((i) => rows[i]).sort((a, b) => cmpPct(a, b) || a.i - b.i);
      const res = [], sub = [];
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
          unresolved = true; sub.push({ members: part, by: 'none', h2h: null });
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

/**
 * Чем решено, что пара на месте k выше пары на месте k + 1.
 * → { by: 'wins' | 'h2h' | 'pct' | 'pct-h2h' | 'pending' | 'none', upper, lower, tie }
 */
export function reasonBetween(rank, k) {
  const upper = rank.order[k - 1], lower = rank.order[k];
  if (upper === undefined || lower === undefined) return null;
  const tie = rank.ties.find((t) => t.members.includes(upper) && t.members.includes(lower));
  if (!tie) return { by: 'wins', upper, lower, tie: null };
  if (tie.by === 'h2h' || tie.by === 'pending' || (tie.members.length === 2 && tie.by === 'none')) return { by: tie.by, upper, lower, tie };
  const sub = (tie.sub || []).find((x) => x.members.includes(upper) && x.members.includes(lower));
  if (sub) return { by: sub.by === 'h2h' ? 'pct-h2h' : sub.by === 'pending' ? 'pending' : 'none', upper, lower, tie, sub };
  return { by: 'pct', upper, lower, tie };
}

/** Раскладка побед группы: «3-2-1-0», «2-2-1-1» … */
export function winsPattern(rank) {
  return rank.order.map((i) => rank.rows[i].w).join('-');
}

/** Регламент не решает, по какую сторону черты стоит пара: она в неразрешённом равенстве, которое пересекает черту. */
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

/* ------------------------------------------------------------------ «Что вам нужно»: перебор оставшихся матчей */

// все исходы одного матча: [ga, gb] — 7 побед первой пары и 7 второй
const OUTCOMES = [...WIN_SCORES.map(([w, l]) => [w, l]), ...WIN_SCORES.map(([w, l]) => [l, w])];

/**
 * Перебирает все законные счета оставшихся матчей (каждый — полный сет) и отвечает словами-категориями,
 * без точного счёта. Только для «до последнего тура»: во время последнего тура экран это не вызывает.
 *
 * @param n        число пар
 * @param played   сыгранные матчи [i, j, ga, gb]
 * @param remaining оставшиеся матчи [i, j]
 * @param me       индекс «моей» пары
 * @param cut      сколько мест идут в высшую категорию (2)
 * → {
 *     mine: число моих оставшихся матчей,
 *     byWins: [{ wins, of, result: 'always' | 'never' | 'depends', on: null | 'others' | 'games' | 'both',
 *                others: [{ winners: [индекс победителя каждого чужого матча], result }] }],
 *     total: число перебранных исходов
 *   }
 */
export function whatYouNeed(n, played, remaining, me, cut = 2) {
  const myIdx = remaining.map((m, k) => (m[0] === me || m[1] === me ? k : -1)).filter((k) => k >= 0);
  const others = remaining.map((_, k) => k).filter((k) => !myIdx.includes(k));
  const buckets = new Map();   // myWins → Map(winnersKey → Set(result))
  let total = 0;
  const pick = new Array(remaining.length);
  const walk = (k) => {
    if (k === remaining.length) {
      total += 1;
      const ms = played.concat(remaining.map(([a, b], x) => [a, b, pick[x][0], pick[x][1]]));
      const r = rankGroup(n, ms);
      const inTop = r.place[me] <= cut;
      // при нерешённом равенстве регламент не отвечает: считаем как «зависит»
      const res = openAtCut(r, me, cut) ? 'open' : inTop ? 'in' : 'out';
      let myWins = 0;
      for (const x of myIdx) {
        const [a, b] = remaining[x]; const [ga, gb] = pick[x];
        if ((a === me && ga > gb) || (b === me && gb > ga)) myWins += 1;
      }
      const winners = others.map((x) => { const [a, b] = remaining[x]; return pick[x][0] > pick[x][1] ? a : b; });
      // кто выиграл каждый мой матч — тоже часть «исхода без счёта»
      const mine = myIdx.map((x) => { const [a, b] = remaining[x]; return pick[x][0] > pick[x][1] ? a : b; });
      if (!buckets.has(myWins)) buckets.set(myWins, new Map());
      const key = mine.join(',') + '|' + winners.join(',');
      const bm = buckets.get(myWins);
      if (!bm.has(key)) bm.set(key, { winners, mine, results: new Set() });
      bm.get(key).results.add(res);
      return;
    }
    for (const o of OUTCOMES) { pick[k] = o; walk(k + 1); }
  };
  walk(0);

  const byWins = [];
  for (let w = myIdx.length; w >= 0; w -= 1) {
    const bm = buckets.get(w);
    if (!bm) continue;
    const all = new Set();
    let gamesMatter = false;
    const perOthers = new Map();
    for (const { winners, results } of bm.values()) {
      results.forEach((x) => all.add(x));
      if (results.size > 1 || results.has('open')) gamesMatter = true;
      const k = winners.join(',');
      if (!perOthers.has(k)) perOthers.set(k, { winners, results: new Set() });
      results.forEach((x) => perOthers.get(k).results.add(x));
    }
    const verdict = (set) => (set.size === 1 && set.has('in') ? 'always' : set.size === 1 && set.has('out') ? 'never' : 'depends');
    const result = verdict(all);
    const othersList = [...perOthers.values()].map((x) => ({ winners: x.winners, result: verdict(x.results) }));
    const othersMatter = new Set(othersList.map((x) => x.result)).size > 1;
    const on = result !== 'depends' ? null : gamesMatter && othersMatter ? 'both' : gamesMatter ? 'games' : 'others';
    byWins.push({ wins: w, of: myIdx.length, result, on, others: othersList });
  }
  return { mine: myIdx.length, others: others.map((k) => remaining[k]), byWins, total };
}

/* ------------------------------------------------------------------ «Почему так»: числа для объяснения */

/** Сколько геймов «весит» разница в проценте для пары: gap п. п. × сыгранные геймы / 100. */
export function gapInGames(rowLow, rowHigh) {
  const gapPct = rowHigh.pct - rowLow.pct;
  return { gapPct, games: (gapPct * rowLow.games) / 100 };
}

/**
 * Сколько ещё выигранных геймов (за счёт проигранных — сыгранных геймов столько же) нужно было паре rowLow,
 * чтобы её процент стал выше процента rowHigh. Например, 4:6 → 5:6 не бывает, поэтому это мера разрыва, а не совет.
 */
export function gamesToPass(rowLow, rowHigh) {
  for (let k = 0; k <= rowLow.gl; k += 1) {
    const gw = rowLow.gw + k;
    if (gw * rowHigh.games > rowHigh.gw * rowLow.games) return k;
  }
  return null;
}

/** Процент по-русски: 48,57 %. */
export function fmtPct(x, digits = 2) {
  return `${x.toFixed(digits).replace('.', ',')}%`;
}
