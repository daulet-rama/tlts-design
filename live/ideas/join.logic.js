// TLTS · join.html — чистая логика шага «Это вы?», заявки на членство и очереди склеек.
// Без DOM и без localStorage: экран передаёт сюда состояние и получает новое. Тесты — ideas/tests/join.test.mjs.
//
// Главные правила (условия критиков):
// - «Да, это я» — только заявка. Историю присоединяет человек: админ кнопкой «Подтвердить».
// - До подтверждения о записи видно только написание имени, число турниров и годы (publicRecord, profileView).
// - Склейка обратима: «Разъединить» возвращает всё как было. Каждое действие пишется в журнал.
// - Никаких вопросов-проверок вида «с кем играли в мае 2024».

export const JOIN_KEY = 'tlts-join-v1';
export const STATE_VERSION = 1;
export const LOG_LIMIT = 200;

/* ------------------------------------------------------------------ имена */

// Та же свёртка, что в core/tools/build-archive.py: казахские буквы сводим к русским только для сравнения.
const FOLD = { 'ё': 'е', 'і': 'и', 'ә': 'а', 'ө': 'о', 'ү': 'у', 'ұ': 'у', 'қ': 'к', 'ғ': 'г', 'ң': 'н', 'һ': 'х' };
export function fold(s) {
  return String(s ?? '').toLowerCase().replace(/[ёіәөүұқғңһ]/g, (c) => FOLD[c]).replace(/\s+/g, ' ').trim();
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
export const toursText = (n) => `${n} ${plural(n, 'турнир', 'турнира', 'турниров')}`;
export function yearsText(years) {
  if (!Array.isArray(years) || years.length !== 2 || years[0] == null) return 'годы неизвестны';
  return years[0] === years[1] ? String(years[0]) : `${years[0]}–${years[1]}`;
}

/** Что можно показать о записи архива до подтверждения: имя, написания имени, турниры, годы. Больше ничего. */
export function publicRecord(rec) {
  if (!rec) return null;
  const spellings = (rec.spellings || []).map((s) => (typeof s === 'string' ? s : s.text)).filter(Boolean);
  return {
    id: rec.id || rec.key,
    demo: !!rec.demo,
    name: rec.name || [rec.last, rec.first].filter(Boolean).join(' '),
    spellings: [...new Set(spellings)],
    tours: Number(rec.tours) || 0,
    years: Array.isArray(rec.years) ? [rec.years[0], rec.years[1]] : null,
  };
}

/** Строка вида «Фамилия Имя — 14 турниров, 2023–2026». */
export function recordLine(rec) {
  const r = publicRecord(rec);
  if (!r) return '';
  return r.tours > 0 ? `${r.name} — ${toursText(r.tours)}, ${yearsText(r.years)}` : `${r.name} — в сетках архива нет, есть в рейтинге`;
}

/**
 * Поиск записей по фамилии (и, если введено, по началу имени).
 * list — записи с полями last / first / spellings; query — «Ким», «абенов д», «Төлбасы».
 * Возвращает publicRecord, самые длинные истории сверху.
 */
export function searchRecords(list, query, { limit = 12 } = {}) {
  const q = fold(query).replace(/\./g, '');
  if (q.length < 2) return [];
  const [sur, ini = ''] = q.split(' ');
  const hits = [];
  for (const rec of list || []) {
    const last = fold(rec.last);
    if (!last.startsWith(sur)) continue;
    if (ini) {
      const firsts = [rec.first, ...(rec.spellings || []).map((s) => String(typeof s === 'string' ? s : s.text).split(' ')[1])]
        .filter(Boolean).map((x) => fold(x).replace(/\./g, ''));
      if (!firsts.some((f) => f.startsWith(ini))) continue;
    }
    hits.push(rec);
  }
  hits.sort((a, b) => (Number(b.tours) || 0) - (Number(a.tours) || 0) || String(a.name || a.last).localeCompare(String(b.name || b.last), 'ru'));
  return hits.slice(0, limit).map(publicRecord);
}

/** Сколько людей носят фамилию (после свёртки) — для подсказки «однофамильцев N». */
export function namesakes(list, surname) {
  const s = fold(surname);
  if (!s) return 0;
  return (list || []).filter((r) => fold(r.last) === s).length;
}

/** Итог по выбранным записям: сумма турниров и общие годы (записи одного человека не пересекаются по турнирам). */
export function summarize(records) {
  const rs = (records || []).map(publicRecord).filter(Boolean);
  const tours = rs.reduce((a, r) => a + r.tours, 0);
  const ys = rs.flatMap((r) => (r.years ? r.years : [])).filter((y) => y != null);
  return { count: rs.length, tours, years: ys.length ? [Math.min(...ys), Math.max(...ys)] : null };
}

/* ------------------------------------------------------------------ анкета */

/** Полных лет на дату (ISO). */
export function ageOn(birthIso, onIso) {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthIso || '');
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(onIso || '');
  if (!b || !d) return null;
  let age = Number(d[1]) - Number(b[1]);
  if (Number(d[2]) < Number(b[2]) || (Number(d[2]) === Number(b[2]) && Number(d[3]) < Number(b[3]))) age -= 1;
  return age;
}

/**
 * Подсказка по условиям членства (Положение, р. 7): мужчина 25–80 лет, опыт парной игры в любительских
 * турнирах от года, не выступал в профессиональных турнирах (анкета). Решение — за лигой, сайт только подсказывает.
 * Возраст наружу — только «проходит / не проходит», без цифры.
 */
export function eligibility(form, todayIso) {
  const out = [];
  const age = ageOn(form && form.birth, todayIso);
  out.push({ key: 'age', label: 'Возраст 25–80 лет', ok: age == null ? null : age >= 25 && age <= 80 });
  const exp = Number(form && form.pairYears);
  out.push({ key: 'exp', label: 'Опыт парной игры от 1 года', ok: form && form.pairYears !== '' && form.pairYears != null && Number.isFinite(exp) ? exp >= 1 : null });
  // это заявление из анкеты: без отметки — «не заполнено», а не «не подходит»
  out.push({ key: 'amateur', label: 'Не выступал в профессиональных турнирах', ok: form && form.amateur ? true : null });
  return { items: out, ready: out.every((x) => x.ok === true) };
}

/* ------------------------------------------------------------------ состояние */

export function initialState(seedQueue = []) {
  return {
    v: STATE_VERSION,
    account: null,       // { first, last, phone, at }
    consent: { pd: false, publish: false, results: 'members', photo: 'members' },
    claim: null,         // { kind: 'records' | 'notfound', records: [ids], at }
    membership: null,    // { path: 'member' | 'new', invite: 'invite' | 'letter', form, at }
    queue: seedQueue.map((q) => ({ note: null, ...q, records: [...(q.records || [])] })),
    aliases: {},         // pid → [написания], только после «Подтвердить»
    checks: {},          // ключ записи архива → { at, who } — «взято на сверку»
    log: [],             // { at, who, what }
  };
}

/** Прочитать сохранённое состояние; испорченное или старое — заменить исходным. */
export function restore(raw, seedQueue = []) {
  try {
    const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!s || s.v !== STATE_VERSION || !Array.isArray(s.queue) || !Array.isArray(s.log)) return initialState(seedQueue);
    const base = initialState(seedQueue);
    return { ...base, ...s, consent: { ...base.consent, ...(s.consent || {}) }, aliases: { ...(s.aliases || {}) }, checks: { ...(s.checks || {}) } };
  } catch {
    return initialState(seedQueue);
  }
}

const ME_ITEM = (pid) => `q-${pid}`;

function upsert(queue, item) {
  const i = queue.findIndex((q) => q.id === item.id);
  if (i < 0) return [item, ...queue];
  const next = queue.slice();
  next[i] = { ...queue[i], ...item };
  return next;
}
function patch(queue, id, fn) {
  return queue.map((q) => (q.id === id ? { ...q, ...fn(q) } : q));
}
function addLog(state, ctx, what) {
  const entry = { at: ctx.now || new Date().toISOString(), who: ctx.who || 'Игрок', what };
  return [entry, ...state.log].slice(0, LOG_LIMIT);
}

/**
 * Одно действие → новое состояние. Вход не меняется.
 * ctx: { now: ISO, who: 'Игрок · Ерлан Сарсенбаев' | 'Админ (демо)', recordOf(id) → запись, nameOf(pid) → «Имя Фамилия» }
 */
export function reduce(state, action, ctx = {}) {
  const s = state;
  const recordOf = ctx.recordOf || (() => null);
  const nameOf = ctx.nameOf || ((pid) => pid);
  const listText = (ids) => ids.map((id) => recordLine(recordOf(id)) || id).join('; ');
  const item = (id) => s.queue.find((q) => q.id === id) || null;

  switch (action.type) {
    case 'account': {
      const first = String(action.first || '').trim();
      const last = String(action.last || '').trim();
      if (!first || !last || !action.consent || !action.consent.pd) return s;
      const consent = { ...s.consent, ...action.consent };
      return {
        ...s, account: { first, last, phone: String(action.phone || ''), at: ctx.now || new Date().toISOString() }, consent,
        log: addLog(s, ctx, `Создан аккаунт: ${first} ${last}. Публикация результатов: ${consent.publish ? 'согласен' : 'не согласен'}`),
      };
    }
    case 'consent': {
      const consent = { ...s.consent, ...action.consent, pd: s.consent.pd };
      return { ...s, consent, log: addLog(s, ctx, `Изменено «что видно другим»: результаты — ${consentText(consent.publish ? consent.results : 'none')}, фото — ${consentText(consent.photo)}`) };
    }
    case 'claim': {
      if (!s.account || !Array.isArray(action.records) || !action.records.length) return s;
      const pid = action.pid;
      const prev = item(ME_ITEM(pid));
      if (prev && prev.status === 'confirmed') return s;   // сначала «Разъединить»
      const records = [...new Set(action.records)];
      const q = { id: ME_ITEM(pid), pid, kind: 'records', records, status: 'pending', note: null, at: ctx.now || new Date().toISOString(), membership: prev ? prev.membership : 'none', path: prev ? prev.path : null };
      return {
        ...s, claim: { kind: 'records', records, at: q.at }, queue: upsert(s.queue, q),
        log: addLog(s, ctx, `«Да, это я»: ${listText(records)}`),
      };
    }
    case 'notfound': {
      if (!s.account) return s;
      const pid = action.pid;
      const prev = item(ME_ITEM(pid));
      if (prev && prev.status === 'confirmed') return s;
      const q = { id: ME_ITEM(pid), pid, kind: 'notfound', records: [], status: 'pending', note: null, at: ctx.now || new Date().toISOString(), membership: prev ? prev.membership : 'none', path: prev ? prev.path : null };
      return { ...s, claim: { kind: 'notfound', records: [], at: q.at }, queue: upsert(s.queue, q), log: addLog(s, ctx, '«Меня нет в списке» — проверит админ') };
    }
    case 'membership': {
      if (!s.account) return s;
      const pid = action.pid;
      const prev = item(ME_ITEM(pid));
      const m = { path: action.path === 'new' ? 'new' : 'member', invite: action.invite === 'letter' ? 'letter' : 'invite', form: { ...(action.form || {}) }, at: ctx.now || new Date().toISOString() };
      const q = prev
        ? { ...prev, membership: 'pending', path: m.path }
        : { id: ME_ITEM(pid), pid, kind: 'none', records: [], status: 'none', note: null, at: m.at, membership: 'pending', path: m.path };
      return { ...s, membership: m, queue: upsert(s.queue, q), log: addLog(s, ctx, `Заявка на членство отправлена (${m.path === 'new' ? 'вступаю впервые' : 'играл в лиге раньше'}, ${m.invite === 'letter' ? 'письмо-заявление' : 'по приглашению'})`) };
    }
    case 'confirm': {
      const q = item(action.id);
      if (!q || q.kind === 'none' || (q.status !== 'pending' && q.status !== 'asked')) return s;
      const aliases = { ...s.aliases };
      if (q.kind === 'records') {
        const sp = [];
        for (const id of q.records) for (const x of (publicRecord(recordOf(id)) || { spellings: [] }).spellings) if (!sp.includes(x)) sp.push(x);
        aliases[q.pid] = sp;
      }
      const what = q.kind === 'records'
        ? `Подтвердил склейку: ${nameOf(q.pid)} ← ${listText(q.records)}`
        : `Подтвердил: ${nameOf(q.pid)} — в архиве нет, новый игрок`;
      return { ...s, aliases, queue: patch(s.queue, q.id, () => ({ status: 'confirmed', note: null })), log: addLog(s, ctx, what) };
    }
    case 'reject': {
      const q = item(action.id);
      if (!q || (q.status !== 'pending' && q.status !== 'asked')) return s;
      return { ...s, queue: patch(s.queue, q.id, () => ({ status: 'rejected', note: action.note || null })), log: addLog(s, ctx, `Отклонил склейку: ${nameOf(q.pid)}${action.note ? ` — ${action.note}` : ''}`) };
    }
    case 'ask': {
      const q = item(action.id);
      const note = String(action.note || '').trim();
      if (!q || !note || (q.status !== 'pending' && q.status !== 'asked')) return s;
      return { ...s, queue: patch(s.queue, q.id, () => ({ status: 'asked', note })), log: addLog(s, ctx, `Спросил игрока ${nameOf(q.pid)}: «${note}»`) };
    }
    case 'unmerge': {
      const q = item(action.id);
      if (!q || q.status !== 'confirmed') return s;
      const aliases = { ...s.aliases };
      delete aliases[q.pid];
      return { ...s, aliases, queue: patch(s.queue, q.id, () => ({ status: 'pending' })), log: addLog(s, ctx, `Разъединил: ${nameOf(q.pid)} — записи снова отдельно, заявка вернулась в очередь`) };
    }
    case 'reopen': {
      const q = item(action.id);
      if (!q || q.status !== 'rejected') return s;
      return { ...s, queue: patch(s.queue, q.id, () => ({ status: 'pending', note: null })), log: addLog(s, ctx, `Вернул в очередь: ${nameOf(q.pid)}`) };
    }
    case 'member': {
      const q = item(action.id);
      const d = action.decision;
      if (!q || !['approved', 'declined', 'pending'].includes(d) || q.membership === 'none') return s;
      const text = d === 'approved' ? 'внёс решение Совета: членство одобрено' : d === 'declined' ? 'внёс решение Совета: в членстве отказано' : 'отменил решение по членству — снова на рассмотрении';
      return { ...s, queue: patch(s.queue, q.id, () => ({ membership: d })), log: addLog(s, ctx, `${nameOf(q.pid)}: ${text}`) };
    }
    case 'check': {
      const checks = { ...s.checks };
      if (action.on) checks[action.key] = { at: ctx.now || new Date().toISOString(), who: ctx.who || '' };
      else delete checks[action.key];
      return { ...s, checks, log: addLog(s, ctx, `${action.on ? 'Взял на сверку' : 'Снял со сверки'}: ${action.label || action.key}`) };
    }
    default:
      return s;
  }
}

export function consentText(v) {
  return v === 'all' ? 'всем' : v === 'members' ? 'членам лиги' : 'только мне и админу';
}

/* ------------------------------------------------------------------ что видит игрок */

export const HISTORY_TEXT = {
  none: 'История не отмечена',
  pending: 'История ждёт подтверждения',
  asked: 'Админ задал вопрос',
  confirmed: 'История подтверждена',
  rejected: 'Склейка отклонена',
  notfoundPending: 'Нет в архиве — проверит админ',
  notfoundConfirmed: 'Новый игрок: истории в архиве нет',
};
export const MEMBER_TEXT = {
  none: 'Членство: заявка не подана',
  pending: 'Членство на рассмотрении',
  approved: 'Членство одобрено',
  declined: 'В членстве отказано',
};

/** Три строки статуса: «Аккаунт есть · Членство на рассмотрении · История ждёт подтверждения». */
export function statusOf(state, pid) {
  const q = state.queue.find((x) => x.id === ME_ITEM(pid)) || null;
  const account = state.account ? 'Аккаунт есть' : 'Аккаунта нет';
  const memberKey = !q || !q.membership || q.membership === 'none' ? (state.membership ? 'pending' : 'none') : q.membership;
  let historyKey = 'none';
  if (q && q.kind === 'records') historyKey = q.status;
  else if (q && q.kind === 'notfound') historyKey = q.status === 'confirmed' ? 'notfoundConfirmed' : q.status === 'asked' ? 'asked' : q.status === 'rejected' ? 'rejected' : 'notfoundPending';
  const parts = [account, MEMBER_TEXT[memberKey], HISTORY_TEXT[historyKey]];
  return { account: !!state.account, member: memberKey, history: historyKey, note: q ? q.note : null, item: q, line: parts.join(' · '), parts };
}

/**
 * Профиль игрока, каким его видят до и после подтверждения.
 * До: только имя, число турниров и годы — других полей в ответе нет.
 * После: ещё прежние написания имени (псевдонимы); результаты берутся уже из профиля лиги.
 */
export function profileView(state, pid, { name, recordOf = () => null } = {}) {
  const st = statusOf(state, pid);
  const q = st.item;
  const sum = q && q.kind === 'records' ? summarize(q.records.map(recordOf)) : { tours: 0, years: null };
  const base = { name, tours: sum.tours, years: sum.years };
  if (st.history === 'confirmed') return { ...base, confirmed: true, aliases: [...(state.aliases[pid] || [])] };
  return base;
}

export { ME_ITEM as meItemId };
