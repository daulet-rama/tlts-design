// TLTS · витрина идей — чистая логика: итог голосования критиков, группы идей, тексты.
// Ничего не знает о странице; тесты — ideas/tests/ideas.test.mjs (node --test).

/** Правило отбора: идея проходит, если её одобрили минимум двое и никто не нашёл серьёзного риска. */
export const RULE = { minYes: 2, seriousBlocks: true };

/** Итог по одной идее: { yes, of, serious: [id критика], avg, avgText, approved, why } */
export function tally(idea, critics) {
  const ids = critics.map((c) => c.id);
  const votes = ids.map((id) => idea.votes[id]).filter(Boolean);
  const yes = votes.filter((v) => v.yes).length;
  const serious = ids.filter((id) => idea.votes[id]?.serious);
  const avg = votes.length ? votes.reduce((s, v) => s + v.score, 0) / votes.length : 0;
  const approved = yes >= RULE.minYes && !(RULE.seriousBlocks && serious.length);
  let why;
  if (approved) why = `одобрили ${yes} из ${votes.length}, серьёзного риска нет`;
  else if (yes < RULE.minYes) why = `одобрил${yes === 1 ? '' : 'и'} ${yes} из ${votes.length}`;
  else why = `одобрили ${yes} из ${votes.length}, но ${serious.length === 1 ? 'один критик нашёл' : 'критики нашли'} серьёзный риск`;
  if (!approved && yes < RULE.minYes && serious.length) why += ', и есть серьёзный риск';
  return { yes, of: votes.length, serious, avg, avgText: fmtScore(avg), approved, why };
}

/** 8.333… → «8,3» (одна цифра после запятой, как в оценках критиков). */
export function fmtScore(x) {
  const r = Math.round(x * 10) / 10;
  return r.toFixed(1).replace('.', ',');
}

/** Где идея сейчас: 'built' — собран экран, 'waiting' — одобрена, ждёт решений лиги, 'rejected'. */
export function placeOf(idea, data) {
  const t = tally(idea, data.critics);
  if (!t.approved) return 'rejected';
  return data.screens.some((s) => s.ideas.includes(idea.id)) ? 'built' : 'waiting';
}

/** Все идеи с итогом и местом; порядок — как в IDEAS.md. */
export function annotate(data) {
  return data.ideas.map((idea) => ({
    ...idea,
    tally: tally(idea, data.critics),
    place: placeOf(idea, data),
    screen: data.screens.find((s) => s.ideas.includes(idea.id)) || null,
  }));
}

/** Три числа заголовка. */
export function headline(data) {
  const all = annotate(data);
  const approved = all.filter((i) => i.tally.approved).length;
  return {
    total: all.length,
    approved,
    rejected: all.length - approved,
    built: all.filter((i) => i.place === 'built').length,
    waiting: all.filter((i) => i.place === 'waiting').length,
    screens: data.screens.length,
  };
}

export const FILTERS = {
  all: { label: 'Все', test: () => true },
  built: { label: 'Собрано', test: (i) => i.place === 'built' },
  waiting: { label: 'Ждёт лигу', test: (i) => i.place === 'waiting' },
  rejected: { label: 'Отклонено', test: (i) => i.place === 'rejected' },
};

/** Фильтр строк матрицы голосов. Неизвестный ключ → «Все». */
export function filterIdeas(list, key) {
  const f = FILTERS[key] || FILTERS.all;
  return list.filter(f.test);
}

/** Сортировка матрицы: 'order' — как в IDEAS.md, 'score' — по средней оценке (при равенстве — по порядку). */
export function sortIdeas(list, by = 'order') {
  const out = [...list];
  if (by === 'score') out.sort((a, b) => (Math.round(b.tally.avg * 10) - Math.round(a.tally.avg * 10)) || a.n - b.n);
  else out.sort((a, b) => a.n - b.n);
  return out;
}

/** Текст вопросов для письма лиге (кнопка «Скопировать»). */
export function questionsText(data) {
  const byId = Object.fromEntries(data.ideas.map((i) => [i.id, i.title]));
  const lines = data.questions.map((q, k) => {
    const from = q.ideas.map((id) => byId[id]).filter(Boolean).join(', ');
    return `${k + 1}. ${q.q}${from ? ` (идея: ${from})` : ''}`;
  });
  return ['Вопросы к лиге по новым идеям платформы TLTS', '', ...lines].join('\n');
}

/** Склонение: plural(5, 'идея', 'идеи', 'идей') → «идей». */
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
