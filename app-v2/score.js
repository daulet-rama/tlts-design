// Движок счёта TLTS: один сет, правила лиги (CONTRACT.md, раздел 3).
// Чистые функции. Состояние — обычный JSON. Вход никогда не меняется.
// Отмена — через журнал: состояние хранит все принятые события (log),
// undo пересчитывает матч с нуля без последнего события.

export const FORMAT_LEAGUE = Object.freeze({ gamesToWin: 6, tiebreakTo: 7, deuce: 'league' });

export const MODES = ['points', 'games', 'final'];

// Версия формы состояния. 2 — добавлены лента геймов, остановка, предупреждения, вид неявки.
export const SCORE_VERSION = 2;

const POINT_NAMES = ['0', '15', '30', '40'];

// Почему событие не принято: код → понятная фраза для экрана.
export const REASONS = Object.freeze({
  'bad-event': 'Непонятное действие',
  'finished': 'Матч уже окончен',
  'wrong-mode': 'При этом способе счёта так нельзя',
  'bad-side': 'Не указана пара',
  'illegal-final': 'Такой итог сета невозможен',
  'illegal-tiebreak': 'Такой счёт тай-брейка невозможен',
  'no-tiebreak': 'Тай-брейк сейчас не идёт',
  'same-mode': 'Этот способ счёта уже выбран',
  'not-stopped': 'Матч не был прерван',
  'nothing-to-undo': 'Отменять нечего',
});

export function reasonText(code) {
  return REASONS[code] || code || '';
}

export function makeFormat({ gamesToWin = 6, deuce = 'league', tiebreakTo = 7 } = {}) {
  const g = [6, 4, 2].includes(Number(gamesToWin)) ? Number(gamesToWin) : 6;
  const d = deuce === 'deciding' ? 'deciding' : 'league';
  const tb = Number(tiebreakTo) >= 5 ? Number(tiebreakTo) : 7;
  return { gamesToWin: g, tiebreakTo: tb, deuce: d };
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const other = (s) => (s === 0 ? 1 : 0);
const isSide = (s) => s === 0 || s === 1;

export function createScore({ format, mode = 'points', firstServer = 0 } = {}) {
  const f = makeFormat(format || FORMAT_LEAGUE);
  const m = MODES.includes(mode) ? mode : 'points';
  const fs = isSide(firstServer) ? firstServer : 0;
  return {
    v: SCORE_VERSION,
    init: { format: f, mode: m, firstServer: fs },
    format: f,
    mode: m,
    log: [],
    games: [0, 0],
    pts: [0, 0],          // очки текущего гейма (числами)
    deuceCount: 0,        // сколько раз в этом гейме было «ровно»
    deciding: false,      // следующий розыгрыш решает гейм
    tb: null,             // [a, b] — очки тай-брейка, когда он идёт
    tbScore: null,        // [a, b] — итог сыгранного тай-брейка
    tbStarter: null,      // кто подавал первым в тай-брейке
    gameServer: fs,       // кто подаёт текущий гейм (в режимах points/games)
    gameNo: 0,            // сыгранных геймов (для подачи)
    finished: false,
    winner: null,
    walkover: null,       // { reason, kind: 'noshow' | 'retired', gamesAtStop: [a, b] }
    stopped: null,        // { reason, games: [a, b] } — матч прерван без победителя
    penalties: [],        // [{ t, to, games: [a, b] }]
    warnings: [],         // [{ to, note, games: [a, b] }] — to: кому вынесено предупреждение
    sequence: [],         // кто выиграл каждый гейм: [0, 1, 1, ...] (внутреннее, для старых экранов)
    glog: [],             // лента геймов: [{ n, winner, server, tiebreak, penalty }]
    curPen: null,         // в текущем гейме было штрафное очко
  };
}

// ---------- проверка итогового счёта ----------

export function isLegalFinal(format, games) {
  const f = makeFormat(format || FORMAT_LEAGUE);
  if (!Array.isArray(games) || games.length !== 2) return false;
  const [a, b] = games.map(Number);
  if (![a, b].every((x) => Number.isInteger(x) && x >= 0)) return false;
  const n = f.gamesToWin;
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (w === n) return l <= n - 2;
  if (w === n + 1) return l === n - 1 || l === n;
  return false;
}

export function isLegalTiebreak(format, tb) {
  const f = makeFormat(format || FORMAT_LEAGUE);
  if (!Array.isArray(tb) || tb.length !== 2) return false;
  const [a, b] = tb.map(Number);
  if (![a, b].every((x) => Number.isInteger(x) && x >= 0)) return false;
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (w < f.tiebreakTo) return false;
  if (w === f.tiebreakTo) return l <= f.tiebreakTo - 2;
  return w - l === 2;
}

// ---------- внутренние шаги (мутируют свою копию) ----------

function resetGame(s) {
  s.pts = [0, 0];
  s.deuceCount = 0;
  s.deciding = false;
  s.curPen = null;
}

function finish(s, winner) {
  s.finished = true;
  s.winner = winner;
  s.tb = null;
  resetGame(s);
}

function hasProgress(s) {
  return s.glog.length > 0 || s.games[0] + s.games[1] > 0 || s.pts[0] + s.pts[1] > 0 || !!(s.tb && s.tb[0] + s.tb[1] > 0);
}

// penalty: 'game' — гейм присуждён штрафом
function winGame(s, side, penalty = null) {
  const n = s.format.gamesToWin;
  const pen = penalty || s.curPen || null;
  const entry = {
    n: s.glog.length + 1,
    winner: side,
    server: s.tb ? s.tbStarter : s.gameServer,
    tiebreak: s.tb ? s.tb.slice() : null,
    penalty: pen,
  };
  s.glog.push(entry);
  if (s.tb) {
    s.tbScore = s.tb.slice();
    s.games[side] += 1;
    s.sequence.push(side);
    s.gameNo += 1;
    finish(s, side);
    return;
  }
  s.games[side] += 1;
  s.sequence.push(side);
  s.gameNo += 1;
  s.gameServer = other(s.gameServer);
  resetGame(s);
  const [a, b] = s.games;
  if (s.games[side] >= n && s.games[side] - s.games[other(side)] >= 2) {
    finish(s, side);
  } else if (a === n && b === n) {
    s.tb = [0, 0];
    s.tbStarter = s.gameServer;
  }
}

function winPoint(s, side) {
  if (s.tb) {
    s.tb[side] += 1;
    const to = s.format.tiebreakTo;
    if (s.tb[side] >= to && s.tb[side] - s.tb[other(side)] >= 2) winGame(s, side);
    return;
  }
  if (s.deciding) {
    winGame(s, side);
    return;
  }
  s.pts[side] += 1;
  const [a, b] = s.pts;
  if (s.pts[side] >= 4 && s.pts[side] - s.pts[other(side)] >= 2) {
    winGame(s, side);
    return;
  }
  if (a === b && a >= 3) {
    s.deuceCount += 1;
    if (s.format.deuce === 'deciding' || s.deuceCount >= 2) s.deciding = true;
  }
}

// Применяет одно событие к копии. Возвращает true, если событие принято,
// иначе — код причины (см. REASONS).
function step(s, ev) {
  if (!ev || typeof ev !== 'object' || typeof ev.t !== 'string') return 'bad-event';
  const t = ev.t;
  if (t === 'resume') {
    if (!s.stopped) return 'not-stopped';
    s.stopped = null;
    s.finished = false;
    s.winner = null;
    return true;
  }
  if (s.finished) return 'finished';
  switch (t) {
    case 'point':
      if (s.mode !== 'points') return 'wrong-mode';
      if (!isSide(ev.side)) return 'bad-side';
      winPoint(s, ev.side);
      return true;
    case 'game': {
      if (s.mode !== 'games') return 'wrong-mode';
      if (!isSide(ev.side)) return 'bad-side';
      const wasTb = !!s.tb; // в режиме games тай-брейк вводится одной кнопкой
      let tb = null;
      if (ev.tiebreak != null) {
        if (!wasTb) return 'no-tiebreak';
        if (!isLegalTiebreak(s.format, ev.tiebreak)) return 'illegal-tiebreak';
        tb = ev.tiebreak.map(Number);
        if ((tb[0] > tb[1] ? 0 : 1) !== ev.side) return 'illegal-tiebreak';
      }
      winGame(s, ev.side);
      if (wasTb) {
        s.tbScore = tb;
        s.glog[s.glog.length - 1].tiebreak = tb ? tb.slice() : null;
      }
      return true;
    }
    case 'penaltyPoint':
      if (s.mode !== 'points') return 'wrong-mode';
      if (!isSide(ev.to)) return 'bad-side';
      s.penalties.push({ t, to: ev.to, games: s.games.slice() });
      s.curPen = 'point';
      winPoint(s, ev.to);
      return true;
    case 'penaltyGame': {
      if (s.mode === 'final') return 'wrong-mode';
      if (!isSide(ev.to)) return 'bad-side';
      s.penalties.push({ t, to: ev.to, games: s.games.slice() });
      const wasTb = !!s.tb;
      winGame(s, ev.to, 'game');
      if (wasTb) { // тай-брейк присуждён целиком, счёта по очкам нет
        s.tbScore = null;
        s.glog[s.glog.length - 1].tiebreak = null;
      }
      return true;
    }
    case 'final': {
      const g = Array.isArray(ev.games) ? ev.games.map(Number) : null;
      if (!isLegalFinal(s.format, g)) return 'illegal-final';
      const n = s.format.gamesToWin;
      const hasTb = Math.max(g[0], g[1]) === n + 1 && Math.min(g[0], g[1]) === n;
      let tb = null;
      if (hasTb && ev.tiebreak) {
        if (!isLegalTiebreak(s.format, ev.tiebreak)) return 'illegal-tiebreak';
        tb = ev.tiebreak.map(Number);
        if ((tb[0] > tb[1]) !== (g[0] > g[1])) return 'illegal-tiebreak';
      }
      s.games = g;
      s.tbScore = tb;
      s.sequence = [];
      s.glog = [];
      finish(s, g[0] > g[1] ? 0 : 1);
      return true;
    }
    case 'walkover': {
      if (!isSide(ev.winner)) return 'bad-side';
      let kind = ev.kind === 'noshow' || ev.kind === 'retired' ? ev.kind : null;
      if (!kind) {
        const r = String(ev.reason || '');
        if (/снят/i.test(r)) kind = 'retired';
        else if (/неявк|не явил/i.test(r)) kind = 'noshow';
        else kind = hasProgress(s) ? 'retired' : 'noshow';
      }
      s.walkover = { reason: ev.reason || null, kind, gamesAtStop: s.games.slice() };
      s.games = [0, 0];
      s.tbScore = null;
      s.sequence = [];           // итог без счёта — старые экраны не рисуют ленту под 0:0
      if (kind === 'noshow') s.glog = [];
      finish(s, ev.winner);
      return true;
    }
    case 'stop':
      // матч прерван (погода, темнота): победителя нет, очки и подача скрыты,
      // но сохранены внутри — после 'resume' игра продолжается с того же места
      s.stopped = { reason: ev.reason || null, games: s.games.slice() };
      s.finished = true;
      s.winner = null;
      return true;
    case 'warning':
      if (!isSide(ev.to)) return 'bad-side';
      s.warnings.push({ to: ev.to, note: ev.note == null ? null : String(ev.note), games: s.games.slice() });
      return true;
    case 'setMode':
      if (!MODES.includes(ev.mode)) return 'bad-event';
      if (ev.mode === s.mode) return 'same-mode';
      s.mode = ev.mode;
      resetGame(s);
      if (s.tb) s.tb = [0, 0];
      return true;
    default:
      return 'bad-event';
  }
}

// Пересчитать матч с нуля по журналу.
export function replay(init, log) {
  const s = createScore(init);
  for (const ev of log || []) {
    if (step(s, ev) === true) s.log.push(clone(ev));
  }
  return s;
}

export function rebuild(state) {
  return replay(state.init, state.log);
}

// Похоже ли на состояние движка (для проверки записей из хранилища).
export function isScoreShape(s) {
  return !!(s && typeof s === 'object' && s.init && typeof s.init === 'object'
    && Array.isArray(s.log) && Array.isArray(s.games) && s.games.length === 2
    && s.format && typeof s.format === 'object' && Number.isFinite(s.format.gamesToWin));
}

// Привести состояние старой формы к текущей: пересчёт по журналу.
// Бросает ошибку, если состояние не похоже на состояние движка.
export function upgradeScore(s) {
  if (!s || typeof s !== 'object' || !s.init || typeof s.init !== 'object' || !Array.isArray(s.log)) throw new Error('upgradeScore: нет init или log');
  if (s.v === SCORE_VERSION && isScoreShape(s)) return s;
  return replay(s.init, s.log);
}

/** Применить событие. → { accepted, state, reason } — reason: код из REASONS или null. */
export function tryApply(state, event) {
  if (!state) throw new Error('tryApply: нет состояния');
  if (event && event.t === 'undo') {
    if (!state.log.length) return { accepted: false, state, reason: 'nothing-to-undo' };
    return { accepted: true, state: replay(state.init, state.log.slice(0, -1)), reason: null };
  }
  const s = clone(state);
  let ev;
  try { ev = clone(event || {}); } catch { return { accepted: false, state, reason: 'bad-event' }; }
  const r = step(s, ev);
  if (r !== true) return { accepted: false, state, reason: r };
  s.log.push(ev);
  return { accepted: true, state: s, reason: null };
}

export function applyEvent(state, event) {
  if (!state) throw new Error('applyEvent: нет состояния');
  return tryApply(state, event).state; // событие не принято — то же состояние
}

export function canApply(state, event) {
  return tryApply(state, event).accepted;
}

/** Код причины, по которой событие не будет принято, или null. */
export function whyNot(state, event) {
  return tryApply(state, event).reason;
}

// ---------- подача ----------

export function serverOf(s) {
  if (s.finished || s.mode === 'final') return null;
  if (s.tb) {
    const n = s.tb[0] + s.tb[1];
    const flips = Math.ceil(n / 2);
    return flips % 2 === 0 ? s.tbStarter : other(s.tbStarter);
  }
  return s.gameServer;
}

// ---------- показ ----------

const pair = (g) => `${g[0]}:${g[1]}`;

function outcomeOf(s) {
  if (s.stopped) return 'stopped';
  if (!s.finished) return null;
  if (s.walkover) return s.walkover.kind === 'retired' ? 'retired' : 'walkover';
  return 'played';
}

export function view(s) {
  const n = s.format.gamesToWin;
  const inTb = !!s.tb && !s.finished;
  let points = null;
  let advantage = null;
  let deuce = 0;
  if (!s.finished && !inTb && s.mode === 'points') {
    const [a, b] = s.pts;
    if (s.deciding) {
      points = ['40', '40'];
      deuce = 2;
    } else if (a >= 3 && b >= 3) {
      deuce = s.deuceCount >= 2 ? 2 : 1;
      if (a === b) points = ['40', '40'];
      else {
        advantage = a > b ? 0 : 1;
        points = advantage === 0 ? ['Б', '40'] : ['40', 'Б'];
      }
    } else {
      points = [POINT_NAMES[Math.min(a, 3)], POINT_NAMES[Math.min(b, 3)]];
    }
  }
  const decidingPoint = !s.finished && !inTb && s.mode === 'points' && s.deciding;
  const server = serverOf(s);

  const wo = s.walkover || null;
  const woKind = wo ? (wo.kind === 'retired' ? 'retired' : 'noshow') : null;
  const woAt = wo && Array.isArray(wo.gamesAtStop) ? wo.gamesAtStop.slice() : [0, 0];
  const stopped = s.stopped || null;
  const outcome = outcomeOf(s);

  let label = null;
  if (wo) label = woKind === 'retired' ? 'Снятие' : 'Неявка';
  else if (stopped) label = 'Матч прерван';
  else if (s.finished) label = 'Матч окончен';
  else if (inTb) label = 'Тай-брейк';
  else if (decidingPoint) label = 'Решающее очко';
  else if (advantage !== null) label = 'Больше';
  else if (deuce > 0 && points && points[0] === '40' && points[1] === '40') label = 'Ровно';

  let outcomeText = null;
  if (outcome === 'walkover') outcomeText = 'Неявка';
  else if (outcome === 'retired') outcomeText = `Снятие при счёте ${pair(woAt)}`;
  else if (outcome === 'stopped') outcomeText = `Прерван при ${pair(stopped.games || s.games)}`;

  // матчбол / геймбол — подсказка для показа, не обязательна
  let matchPoint = null;
  if (!s.finished && s.mode === 'points') {
    for (const side of [0, 1]) {
      const t = applyEvent(s, { t: 'point', side });
      if (t.finished && t.winner === side) { matchPoint = side; break; }
    }
  }

  const tbDone = s.tbScore && s.finished && !wo ? s.tbScore : null;
  let scoreText;
  if (wo) scoreText = woKind === 'retired' ? 'снятие' : 'неявка';
  else scoreText = pair(s.games) + (tbDone ? ` (${Math.min(...tbDone)})` : '');
  let scoreLong;
  if (outcome === 'walkover') scoreLong = 'неявка';
  else if (outcome === 'retired') scoreLong = `снятие при счёте ${pair(woAt)}`;
  else if (outcome === 'stopped') scoreLong = `прерван при ${pair(s.games)}`;
  else scoreLong = pair(s.games) + (tbDone ? `, тай-брейк ${pair(tbDone)}` : '');

  const warnings = s.warnings || [];
  const glog = s.glog || [];

  return {
    mode: s.mode,
    format: { ...s.format },
    games: s.games.slice(),
    points,
    pointsRaw: s.mode === 'points' && !s.finished && !inTb ? s.pts.slice() : null,
    tiebreak: inTb ? (s.mode === 'points' ? s.tb.slice() : null) : (s.tbScore && !stopped ? s.tbScore.slice() : null),
    inTiebreak: inTb,
    deuce,
    decidingPoint,
    advantage,
    server,
    finished: s.finished,
    winner: s.winner,
    walkover: wo ? { reason: wo.reason ?? null, kind: woKind, gamesAtStop: woAt } : null,
    stopped: stopped ? { reason: stopped.reason ?? null, games: (stopped.games || s.games).slice() } : null,
    outcome,
    outcomeText,
    matchPoint,
    label,
    scoreText,
    scoreLong,
    gameLog: glog.map((g) => ({ n: g.n, winner: g.winner, server: g.server, tiebreak: g.tiebreak ? g.tiebreak.slice() : null, penalty: !!g.penalty, penaltyKind: g.penalty || null })),
    penalties: s.penalties.map((p) => ({ ...p, games: p.games.slice() })),
    warnings: [0, 1].map((side) => warnings.filter((w) => w.to === side).length),
    warningLog: warnings.map((w) => ({ to: w.to, note: w.note ?? null, games: w.games.slice() })),
    canUndo: s.log.length > 0,
    events: s.log.length,
    lastEvent: s.log.length ? { ...s.log[s.log.length - 1] } : null,
    gamesToWin: n,
  };
}

// Проверка состояния на допустимость — для тестов и отладки.
export function isConsistent(s) {
  const n = s.format.gamesToWin;
  const [a, b] = s.games;
  if (s.stopped) {
    if (!s.finished || s.winner !== null || s.walkover) return false;
    return isConsistent({ ...s, stopped: null, finished: false });
  }
  if (s.finished) {
    if (s.walkover) return a === 0 && b === 0 && isSide(s.winner) && s.sequence.length === 0;
    if (!isLegalFinal(s.format, s.games)) return false;
    if ((a > b ? 0 : 1) !== s.winner) return false;
    if (s.tbScore && !isLegalTiebreak(s.format, s.tbScore)) return false;
    if (s.glog && s.glog.length && s.glog.length !== a + b) return false;
    return true;
  }
  if (a > n || b > n) return false;
  if ((a >= n && a - b >= 2) || (b >= n && b - a >= 2)) return false;
  if (s.tb && !(a === n && b === n)) return false;
  if (a === n && b === n && !s.tb) return false;
  if (s.tb) {
    const to = s.format.tiebreakTo;
    const [x, y] = s.tb;
    if ((x >= to || y >= to) && Math.abs(x - y) >= 2) return false;
  }
  if (s.glog && s.glog.length !== a + b) return false;
  return true;
}
