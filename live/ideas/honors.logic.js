// TLTS · ideas/honors.logic.js — чистая логика экрана «Признание сезона».
// Без DOM и без localStorage: подбор кандидатов, путь номинации, журнал, строка «Вместе N-й турнир».
// Тесты: node --test ideas/tests/honors.test.mjs

/* ------------------------------------------------------------------ путь номинации */

export const STEPS = Object.freeze(['proposed', 'confirmed', 'agreed', 'published']);
export const STEP_LABELS = Object.freeze({
  proposed: 'Предложено сайтом',
  confirmed: 'Подтвердил директор',
  agreed: 'Номинант согласен',
  published: 'Опубликовано',
  declined: 'Номинант отказался',
});

/* ------------------------------------------------------------------ подбор кандидатов */

/**
 * Кого сайт сам не предлагает и почему.
 * founder / council — основателя и членов Совета сайт в кандидаты не ставит: по ним решает независимый человек.
 * unsure — игрок не определён однозначно (записан только фамилией, «Ким А.» и т. п.): требует сверки.
 */
export function exclusionOf(person) {
  if (!person) return null;
  if (person.founder) return 'founder';
  if (person.council) return 'council';
  if (person.unsure) return 'unsure';
  return null;
}

/**
 * Сайт предлагает n кандидатов из списка, уже отсортированного по счёту (главный показатель, потом второй).
 * key(x) → массив чисел для сравнения (больше — выше), например [тай-брейков, выиграно].
 * people(x) → люди строки (у пары — двое); если кто-то исключён, строка уходит в excluded.
 * Возвращает:
 *   candidates — первые n допустимых;
 *   reserve    — следующие допустимые (для «Заменить кандидата»), по порядку;
 *   excluded   — строки, которые по счёту вошли бы в первые n, но сайт их не предлагает: { item, reason };
 *   tieAtCut   — у первого запасного главный показатель тот же, что у последнего кандидата:
 *                место делят, решает директор.
 */
export function pickCandidates(list, { n = 3, key, people = (x) => [x], primary = (x) => key(x)[0] } = {}) {
  const candidates = [];
  const reserve = [];
  const excluded = [];
  for (const item of list || []) {
    const reasons = people(item).map(exclusionOf).filter(Boolean);
    if (reasons.length) {
      // в «excluded» попадает только тот, кто по счёту оказался бы среди первых n
      if (candidates.length < n) excluded.push({ item, reason: reasons.includes('founder') ? 'founder' : reasons.includes('council') ? 'council' : 'unsure' });
      continue;
    }
    if (candidates.length < n) candidates.push(item);
    else reserve.push(item);
  }
  const last = candidates[candidates.length - 1];
  const tieAtCut = !!(last && reserve[0] && primary(reserve[0]) === primary(last));
  return { candidates, reserve, excluded, tieAtCut };
}

/**
 * Какое равенство на границе тройки: у последнего кандидата и первого запасного.
 * 'full'   — равны оба числа: сайт никого выше не ставит, выбирает директор;
 * 'second' — главное число равно, второе различается: выше тот, у кого второе больше;
 * null     — равенства нет.
 */
export function tieKind(last, next, key) {
  if (!last || !next) return null;
  const a = key(last), b = key(next);
  if (a[0] !== b[0]) return null;
  return (a[1] ?? 0) === (b[1] ?? 0) ? 'full' : 'second';
}

/** Годы «2023–2026», а если первый и последний совпадают — просто «2026». */
export function yearsLabel(years) {
  if (!Array.isArray(years) || !years.length || years[0] == null) return 'нет данных';
  const [a, b = a] = years;
  return a === b ? `${a}` : `${a}–${b}`;
}

/* ------------------------------------------------------------------ демо-награды (раздел 01) */

/**
 * Демо-награды не спорят с профилями выдуманных игроков (core/data.js):
 * матчи и победы сезона, турниры в рейтинге и матчи пары вместе берутся из профиля,
 * вписано руками только число тай-брейков — его в профиле нет.
 */
export const DEMO_GLADIATOR = Object.freeze({ id: 'd06', tiebreaks: 5, won: 3 });
// dp1: 5 турниров сезона, как и у dp2 и dp5, но вместе дольше всех (38 матчей) — по правилу номинации выше она.
export const DEMO_DUO = Object.freeze({ pair: 'dp1' });

export function demoGladiatorFacts(p, { tiebreaks, won } = DEMO_GLADIATOR) {
  const [w, l] = p?.wl?.season || [0, 0];
  const matches = w + l;
  return {
    tiebreaks, won, matches, wins: w,
    tournaments: p?.rating?.tournaments ?? null,
    ok: Number.isInteger(tiebreaks) && Number.isInteger(won) && won <= tiebreaks && tiebreaks <= matches && won <= w,
  };
}

export function demoDuoFacts(a, b) {
  const seasonTournaments = Math.min(a?.rating?.tournaments ?? 0, b?.rating?.tournaments ?? 0);
  const mate = (a?.partners || []).find((x) => x.id === b?.id);
  const back = (b?.partners || []).find((x) => x.id === a?.id);
  const matchesTogether = mate ? mate.matches : null;
  const since = Math.max(a?.since ?? 0, b?.since ?? 0) || null;
  return {
    seasonTournaments, matchesTogether, since,
    ok: !!mate && !!back && mate.matches === back.matches && seasonTournaments > 0
      && seasonTournaments <= Math.min(a.tournaments, b.tournaments),
  };
}

/** Места с учётом равенства: одинаковый key — одно место («делят 2-е»). */
export function ranks(list, key) {
  const cmp = (a, b) => {
    const x = key(a), y = key(b);
    for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
      if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
    }
    return 0;
  };
  return list.map((item) => 1 + list.filter((o) => cmp(o, item) < 0).length);
}

/* ------------------------------------------------------------------ состояние очереди */

/**
 * Состояние одной номинации:
 * { slots: [id, id, id], steps: { id: 'proposed'|... }, used: [id…] (кто уже был в тройке), handover: [id…] }
 * Журнал общий для экрана: [{ at, who, nomination, what }].
 */
export function initialNomination(candidateIds) {
  const steps = {};
  for (const id of candidateIds) steps[id] = 'proposed';
  return { slots: [...candidateIds], steps, used: [...candidateIds], handover: [] };
}

export function initialState(noms) {
  const out = { v: 1, noms: {}, journal: [] };
  for (const [key, ids] of Object.entries(noms)) out.noms[key] = initialNomination(ids);
  return out;
}

const clone = (s) => JSON.parse(JSON.stringify(s));

/**
 * Применить действие директора. Вход не меняется. Возвращает { state, accepted, reason }.
 * action: { type, nom, id, reserve, who, at, title, name }
 *   confirm  proposed → confirmed
 *   consent  confirmed → agreed   (в платформе номинант нажмёт «Согласен» сам)
 *   decline  confirmed → declined (номинант отказался — публиковать нельзя, можно заменить)
 *   publish  agreed → published
 *   back     шаг назад (не из published и не из proposed)
 *   replace  id → первый неиспользованный из reserve; нельзя после согласия
 *   handover цифры по члену Совета переданы независимому человеку (только запись в журнал)
 */
export function applyAction(state, action) {
  const s = clone(state);
  const nom = s.noms?.[action.nom];
  const no = (reason) => ({ state, accepted: false, reason });
  if (!nom) return no('no-nomination');
  const id = action.id;
  const step = nom.steps[id];
  const log = (what) => s.journal.push({ at: action.at || new Date().toISOString(), who: action.who || 'Директор', nomination: action.title || action.nom, what });
  const nm = action.name || id;

  switch (action.type) {
    case 'confirm':
      if (step !== 'proposed') return no('wrong-step');
      nom.steps[id] = 'confirmed';
      log(`Подтвердил кандидата: ${nm}. Номинанту ушёл запрос согласия.`);
      break;
    case 'consent':
      if (step !== 'confirmed') return no('wrong-step');
      nom.steps[id] = 'agreed';
      log(`Номинант согласен: ${nm}.`);
      break;
    case 'decline':
      if (step !== 'confirmed') return no('wrong-step');
      nom.steps[id] = 'declined';
      log(`Номинант отказался: ${nm}. Публиковать нельзя.`);
      break;
    case 'publish':
      if (step !== 'agreed') return no('no-consent');
      nom.steps[id] = 'published';
      log(`Опубликовал: ${nm}.`);
      break;
    case 'back': {
      const back = { confirmed: 'proposed', agreed: 'confirmed', declined: 'confirmed' }[step];
      if (!back) return no('wrong-step');
      nom.steps[id] = back;
      log(`Вернул шаг назад: ${nm} — «${STEP_LABELS[back]}».`);
      break;
    }
    case 'replace': {
      if (!nom.slots.includes(id)) return no('not-in-slots');
      if (step === 'agreed' || step === 'published') return no('after-consent');
      const next = (action.reserve || []).find((r) => !nom.used.includes(r));
      if (!next) return no('no-reserve');
      nom.slots[nom.slots.indexOf(id)] = next;
      delete nom.steps[id];
      nom.steps[next] = 'proposed';
      nom.used.push(next);
      log(`Заменил кандидата: ${nm} → ${action.nextName || next}.`);
      break;
    }
    case 'handover':
      if (nom.handover.includes(id)) return no('already');
      nom.handover.push(id);
      log(`Передал цифры независимому человеку: ${nm} (член Совета — сайт его сам не предлагает).`);
      break;
    default:
      return no('bad-action');
  }
  return { state: s, accepted: true, reason: null };
}

/** Проверить состояние из хранилища: всё непонятное — к исходному. */
export function sanitizeState(raw, fresh) {
  try {
    if (!raw || raw.v !== 1 || typeof raw.noms !== 'object' || !Array.isArray(raw.journal)) return fresh;
    const out = clone(fresh);
    for (const key of Object.keys(fresh.noms)) {
      const n = raw.noms[key];
      if (!n || !Array.isArray(n.slots) || typeof n.steps !== 'object' || !Array.isArray(n.used)) continue;
      const okStep = (x) => STEPS.includes(x) || x === 'declined';
      if (n.slots.length !== fresh.noms[key].slots.length) continue;
      if (!n.slots.every((id) => typeof id === 'string' && okStep(n.steps[id]))) continue;
      out.noms[key] = { slots: [...n.slots], steps: { ...n.steps }, used: [...n.used], handover: Array.isArray(n.handover) ? [...n.handover] : [] };
    }
    out.journal = raw.journal.filter((j) => j && typeof j.what === 'string').slice(-200);
    return out;
  } catch {
    return fresh;
  }
}

/* ------------------------------------------------------------------ сыгранность */

export const TOGETHER_MIN_MATCHES = 5;

/**
 * Строка афиши «Вместе N-й турнир» — только факт и только когда пара сыграла вместе
 * не меньше пяти матчей до этого матча (условие критиков). Первый турнир вместе — без строки.
 */
export function togetherLine({ tournamentNo, matchesBefore }, min = TOGETHER_MIN_MATCHES) {
  if (!Number.isInteger(tournamentNo) || tournamentNo < 2) return null;
  if (!Number.isFinite(matchesBefore) || matchesBefore < min) return null;
  return `Вместе ${tournamentNo}-й турнир`;
}

/* ------------------------------------------------------------------ слова */

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}

/** Слова, которые экран не пишет никогда (тон лиги: не букмекер и не надзор). */
export const FORBIDDEN_WORDS = Object.freeze(['фаворит', 'шанс', 'ставк', 'рынок', 'ценник', 'индекс сыгранности', 'через не могу', 'верная пара', 'личные счёты', 'пропал']);

export function forbiddenIn(text) {
  const t = String(text || '').toLowerCase();
  const hits = FORBIDDEN_WORDS.filter((w) => t.includes(w));
  if (/\d\s*%|процент/.test(t)) hits.push('%');
  return hits;
}
