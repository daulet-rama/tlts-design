// TLTS · «Коридор напарника» — чистая логика: правила по сезонам, проверка пары, расчёты для Совета.
// Без DOM и без данных страницы: всё нужное приходит аргументами. Тесты — ideas/tests/partner.test.mjs.

export const LEVELS = Object.freeze([3.0, 3.5, 4.0, 4.5, 5.0]);
export const STEP = 0.5;

const r1 = (x) => Math.round(x * 10) / 10;
export const fmtK = (x) => (x == null || Number.isNaN(x) ? '—' : r1(x).toFixed(1));

/** Коридор строкой: [7.5, 8.0] → «7.5–8.0», [8, 8] → «ровно 8.0». */
export function corridorText(c) {
  if (!c) return 'уточняется у лиги';
  return c[0] === c[1] ? `ровно ${fmtK(c[0])}` : `${fmtK(c[0])}–${fmtK(c[1])}`;
}

/**
 * Коридор суммы КПР сезона по турнирам из архива: самый частый диапазон регулярных турниров
 * (Итоговый и отдельные турниры с другим коридором — исключения, их возвращаем списком).
 * opts.final: true — коридор Итогового турнира сезона.
 */
export function seasonCorridor(corridorList, season, { final = false } = {}) {
  const rows = (corridorList || []).filter((t) => t.season === season && t.range && !!t.final === !!final);
  if (!rows.length) return { range: null, exceptions: [], tournaments: 0 };
  const count = new Map();
  for (const t of rows) { const k = t.range.join('|'); count.set(k, (count.get(k) || 0) + 1); }
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const range = best.split('|').map(Number);
  const exceptions = rows.filter((t) => t.range.join('|') !== best).map((t) => ({ id: t.id, name: t.name, date: t.date, range: t.range }));
  return { range, exceptions, tournaments: rows.length };
}

/**
 * Правила допуска пары по сезонам. Коридор берётся из архива (seasonCorridor), остальное — из текстов лиги:
 *   levels — какие личные КПР допускаются (null — в найденных документах не сказано);
 *   age    — минимальный суммарный возраст пары (null — правило не найдено, уточняется у лиги).
 */
export const RULE_SOURCES = Object.freeze({
  2023: {
    levels: [3.5, 4.5], levelsSrc: 'Положение о TLTS: личный КПР 3.5–4.5',
    age: 80, ageSrc: 'решение Попечительского совета (новость 24.07.2023): с середины сезона 2023',
    ageFrom: 'с середины сезона',
  },
  2024: {
    levels: null, levelsSrc: 'в документах сезона не сказано',
    age: 80, ageSrc: 'Положение Forbes Cup Open 2024: суммарный возраст не меньше 80',
  },
  2025: {
    levels: null, levelsSrc: 'в документах сезона не сказано',
    age: 70, ageSrc: 'новость о сезоне 2026: возраст пары «без изменений, минимум 70» — значит, в 2025 уже было 70',
    ageUnsure: true,
  },
  2026: {
    levels: [3.0, 5.0], levelsSrc: 'новость о сезоне 2026: допуск игроков с КПР 3.0, 3.5, 4.0, 4.5 и 5.0',
    age: 70, ageSrc: 'новость о сезоне 2026: суммарный возраст пары — минимум 70 лет',
  },
});

/** Собрать правило: season — год; final — Итоговый этого года. */
export function ruleFor(corridorList, season, { final = false } = {}) {
  const c = seasonCorridor(corridorList, season, { final });
  const src = RULE_SOURCES[season] || {};
  return {
    key: final ? `final${season}` : String(season),
    season, final,
    label: final ? `Итоговый ${season}` : String(season),
    corridor: c.range,
    exceptions: c.exceptions,
    levels: src.levels ?? null,
    levelsSrc: src.levelsSrc ?? 'в документах не сказано',
    // на Итоговом про возраст в найденных документах ничего нет
    age: final ? null : (src.age ?? null),
    ageSrc: final ? 'для Итогового правило не найдено' : (src.ageSrc ?? 'правило не найдено'),
    ageUnsure: final ? true : !!src.ageUnsure || src.age == null,
  };
}

export function inCorridor(sum, corridor) {
  if (!corridor) return null;
  const s = r1(sum);
  return s >= r1(corridor[0]) && s <= r1(corridor[1]);
}

/**
 * Можно ли двоим играть вместе по правилу сезона.
 * a, b: { kpr, age? } — возраст нужен только для ответа «проходит / не проходит» и наружу не отдаётся.
 * opts.withAge: false — возраст не проверять вовсе (ageOk: null): так считаем всё, что видит не участник пары.
 * → { ok: true | false, sum, sumOk, ageOk: true|false|null, levelOk: true|false|null, reasons: [строки], verdict }
 *   ok: false — хотя бы одно правило не выполнено; true — сумма в коридоре и ничего не нарушено.
 */
export function checkPair(a, b, rule, { withAge = true } = {}) {
  const sum = r1((a?.kpr ?? NaN) + (b?.kpr ?? NaN));
  const reasons = [];
  const sumOk = inCorridor(sum, rule.corridor);
  if (sumOk === false) {
    const c = rule.corridor;
    if (c[0] === c[1]) reasons.push(`сумма ${fmtK(sum)}, а нужна ровно ${fmtK(c[0])}`);
    else if (sum > c[1]) reasons.push(`сумма ${fmtK(sum)} выше коридора ${corridorText(c)}`);
    else reasons.push(`сумма ${fmtK(sum)} ниже коридора ${corridorText(c)}`);
  }
  let levelOk = null;
  if (rule.levels) {
    const bad = [a, b].filter((p) => p.kpr < rule.levels[0] || p.kpr > rule.levels[1]);
    levelOk = bad.length === 0;
    if (!levelOk) reasons.push(`КПР ${bad.map((p) => fmtK(p.kpr)).join(' и ')} в этом сезоне не допускался (только ${fmtK(rule.levels[0])}–${fmtK(rule.levels[1])})`);
  }
  let ageOk = null;
  if (withAge && rule.age != null && a?.age != null && b?.age != null) {
    ageOk = a.age + b.age >= rule.age;
    if (!ageOk) reasons.push('суммарный возраст пары не проходит');
  }
  const ok = sumOk !== false && levelOk !== false && ageOk !== false;
  const verdict = ok ? 'Можно' : `Нельзя, потому что ${reasons.join('; ')}`;
  return { ok, sum, sumOk, levelOk, ageOk, reasons, verdict };
}

/**
 * Можно ли показать зрителю ответ «возраст пары проходит / не проходит».
 * Только когда зритель — вошедший игрок и сам стоит в этой паре. Иначе перебором пар
 * можно вычислить возраст любого человека. viewer: { role, id }.
 */
export function canSeeAge(viewer, aId, bId) {
  if (!viewer || viewer.role !== 'player' || !viewer.id) return false;
  return viewer.id === aId || viewer.id === bId;
}

/** Какие уровни подходят в напарники игроку уровня level при коридоре. */
export function partnerLevels(level, corridor, levels = LEVELS) {
  if (!corridor) return [];
  return levels.filter((m) => inCorridor(level + m, corridor));
}

/**
 * Предупреждение самому игроку: что будет с его напарниками, если КПР станет next.
 * partners: [{ id, short, kpr }] → { next, leave: [...], stay: [...], levels: [уровни, которые останутся] } | null
 */
export function riseWarning(me, partners, corridor, levels = LEVELS) {
  const next = r1(me.kpr + STEP);
  if (!levels.includes(next) || !corridor) return null;
  const leave = [], stay = [];
  for (const p of partners || []) {
    if (p.kpr == null) continue;
    const was = inCorridor(me.kpr + p.kpr, corridor);
    const now = inCorridor(next + p.kpr, corridor);
    if (was && !now) leave.push({ ...p, sum: r1(next + p.kpr) });
    else if (was && now) stay.push({ ...p, sum: r1(next + p.kpr) });
  }
  return { next, leave, stay, levels: partnerLevels(next, corridor, levels) };
}

/** Все суммы, которые бывают у пары при шкале 3.0–5.0: 6.0 … 10.0. */
export function possibleSums(levels = LEVELS) {
  const out = new Set();
  for (const a of levels) for (const b of levels) out.add(r1(a + b));
  return [...out].sort((x, y) => x - y);
}

/** Сколько из bySum ({ '7.5': 33, '8.0': 219 }) не прошли бы коридор. */
export function failing(bySum, corridor) {
  let out = 0, total = 0;
  for (const [k, n] of Object.entries(bySum || {})) {
    total += n;
    if (!inCorridor(Number(k), corridor)) out += n;
  }
  return { out, total, pass: total - out };
}

/**
 * Для Совета: у игроков какого уровня сколько допустимых напарников при коридоре.
 * byLevel: { '3.0': 11, ... } — сколько игроков каждого уровня. Себя в напарники не считаем.
 * → [{ level, players, partnerLevels, pool, none }]
 */
export function levelPools(byLevel, corridor, levels = LEVELS) {
  return levels.map((level) => {
    const players = byLevel?.[fmtK(level)] ?? 0;
    const pl = partnerLevels(level, corridor, levels);
    const pool = pl.reduce((s, m) => s + (byLevel?.[fmtK(m)] ?? 0) - (m === level ? 1 : 0), 0);
    return { level, players, partnerLevels: pl, pool: Math.max(0, pool), none: players > 0 && Math.max(0, pool) === 0 };
  });
}

/** Полная сводка симулятора. */
export function simulate(data, corridor) {
  const lo = r1(corridor[0]), hi = r1(corridor[1]);
  const c = lo <= hi ? [lo, hi] : [hi, lo];
  const entries = failing(data.entries.bySum, c);
  const pairs = failing(data.pairs.bySum, c);
  const pools = levelPools(data.players.byLevel, c);
  return {
    corridor: c,
    entries, pairs, pools,
    stranded: pools.filter((p) => p.none),
    strandedPlayers: pools.filter((p) => p.none).reduce((s, p) => s + p.players, 0),
  };
}

/** Кто ищет пару: только числа по уровням. seekers: [{ kpr }] → [{ level, seeking, options }] */
export function seekingByLevel(seekers, corridor, levels = LEVELS) {
  return levels.map((level) => {
    const same = seekers.filter((s) => s.kpr === level).length;
    const options = seekers.filter((s) => inCorridor(level + s.kpr, corridor)).length - (inCorridor(level * 2, corridor) && same ? 1 : 0);
    return { level, seeking: same, options: same ? Math.max(0, options) : null };
  });
}

/**
 * Замена выбывшего напарника. daysToDraw — сколько дней до жеребьёвки (отрицательное или 'after' — уже прошла).
 * Правила: предупредить директора не позже чем за 10 календарных дней до жеребьёвки; после жеребьёвки
 * состав пары не меняется — если выбывает один, снимается вся пара.
 */
export function replacementState(daysToDraw) {
  if (daysToDraw === 'after' || daysToDraw < 0) return { phase: 'after', canReplace: false };
  if (daysToDraw >= 10) return { phase: 'early', canReplace: true };
  return { phase: 'late', canReplace: null };   // меньше 10 дней: сообщить сразу; можно ли заменить — уточняется у лиги
}
