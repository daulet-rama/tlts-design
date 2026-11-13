// TLTS · join.html — выдуманные записи архива для пути по умолчанию (Демо-данные).
// Фамилий Сарсенбаев, Гасанов, Назаров в настоящем архиве лиги нет (проверено по research/data).
// Записи устроены так же, как настоящие в ideas/join.data.js: имя, написания, число турниров, годы.
// owner — чья это запись на самом деле (знает только прототип, на экране не показывается).

export const DEMO_RECORDS = Object.freeze([
  {
    id: 'demo-sarsenbaev-erlan', demo: true, owner: 'd01',
    last: 'Сарсенбаев', first: 'Ерлан', name: 'Сарсенбаев Ерлан',
    spellings: ['Сарсенбаев Ерлан', 'Сарсенбаев Ерлан Болатович', 'Сарсенбаев Е.'],
    tours: 19, years: [2023, 2026],
  },
  {
    id: 'demo-sarsenbaev-e-2025', demo: true, owner: 'd01', unsure: true,
    last: 'Сарсенбаев', first: null, name: 'Сарсенбаев Е.',
    spellings: ['Сарсенбаев Е.'],
    tours: 3, years: [2025, 2025],
    // почему основа не привязала сама — без чужих результатов, только факт об именах
    why: 'В 2025 году в лиге два Сарсенбаева на «Е.»: по записи «Сарсенбаев Е.» не понять, кто играл.',
  },
  {
    id: 'demo-sarsenbaev-erbol', demo: true, owner: null,
    last: 'Сарсенбаев', first: 'Ербол', name: 'Сарсенбаев Ербол',
    spellings: ['Сарсенбаев Ербол'],
    tours: 1, years: [2025, 2025],
  },
  {
    id: 'demo-gasanov-eldar', demo: true, owner: 'd07',
    last: 'Гасанов', first: 'Эльдар', name: 'Гасанов Эльдар',
    spellings: ['Гасанов Эльдар', 'Гасанов Э.'],
    tours: 6, years: [2024, 2026],
  },
  {
    id: 'demo-gasanov-e', demo: true, owner: 'd07', unsure: true,
    last: 'Гасанов', first: null, name: 'Гасанов Э.',
    spellings: ['Гасанов Э.'],
    tours: 3, years: [2024, 2025],
    why: 'Полного имени в этих трёх турнирах нет — только «Гасанов Э.» в сетке плей-офф.',
  },
]);

// Очередь админа до того, как в неё попадёт «я». Другие демо-игроки уже подали заявки.
export const DEMO_QUEUE = Object.freeze([
  { id: 'q-d07', pid: 'd07', kind: 'records', records: ['demo-gasanov-eldar', 'demo-gasanov-e'], status: 'pending', membership: 'pending', path: 'member', at: '2026-11-11T19:42:00+05:00' },
  { id: 'q-d08', pid: 'd08', kind: 'notfound', records: [], status: 'pending', membership: 'pending', path: 'new', at: '2026-11-12T08:15:00+05:00' },
]);
