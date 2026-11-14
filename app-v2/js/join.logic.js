// Путь в лигу: чистая логика без страницы. Анкета, подсказки по условиям, шаги заявки.
// Условия — подсказка по анкете, решение принимает лига: даже если что-то «не подходит»,
// заявку можно подать. Возраст наружу не показывается, только «подходит» или нет.
import { STEPS, STATES, TRIAL } from './join.data.js';

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}
export const yearsText = (n) => `${n} ${plural(Number(n), 'год', 'года', 'лет')}`;

// «14.03.1988» → «1988-03-14»; неполная или невозможная дата → null
export function parseBirth(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(s || '').trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// цифры даты по мере ввода: «140319» → «14.03.19»
export function maskBirth(s) {
  const d = String(s || '').replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('.');
}

// полных лет на дату
export function ageOn(birthIso, onIso) {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthIso || '');
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(onIso || '');
  if (!b || !d) return null;
  let age = Number(d[1]) - Number(b[1]);
  if (Number(d[2]) < Number(b[2]) || (Number(d[2]) === Number(b[2]) && Number(d[3]) < Number(b[3]))) age -= 1;
  return age;
}

/**
 * Подсказка по условиям Положения лиги. ok: true — подходит, false — нет, null — не заполнено.
 * Возраст: «от 25 лет» — общее для Положения и Регламента о членстве (верхняя граница в них
 * расходится, поэтому её здесь нет).
 */
export function eligibility(form, todayIso) {
  const birth = parseBirth(form.birth);
  const age = birth ? ageOn(birth, todayIso) : null;
  const yrs = String(form.pairYears ?? '').trim();
  const exp = yrs === '' ? null : Number(yrs);
  return {
    age: age == null || age < 0 ? null : age >= 25,
    exp: exp == null || !Number.isFinite(exp) ? null : exp >= 1,
    amateur: form.amateur ? true : null,
  };
}

export const phoneDigits = (p) => String(p || '').replace(/\D/g, '');
export const phoneOk = (p) => { const n = phoneDigits(p).length; return n >= 10 && n <= 11; };
export function maskPhone(p, tail) {
  const d = phoneDigits(p);
  const t = d.length >= 2 ? d.slice(-2) : tail;
  return t ? `+7 ••• ••• •• ${t}` : '';
}
export const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

/** Что не так в анкете: { поле: текст }. Пусто — можно подавать. */
export function checkForm(f) {
  const err = {};
  if (String(f.name || '').trim().split(/\s+/).filter(Boolean).length < 2) err.name = 'Нужны имя и фамилия';
  if (!phoneOk(f.phone)) err.phone = 'Нужен номер из 10–11 цифр';
  if (!parseBirth(f.birth)) err.birth = 'Дата в виде 14.03.1988';
  const y = String(f.pairYears ?? '').trim();
  if (y === '' || !Number.isFinite(Number(y)) || Number(y) < 0 || Number(y) > 70) err.pairYears = 'Сколько лет играете в паре';
  if (!f.pd) err.pd = 'Без согласия заявку не принять';
  return err;
}

/**
 * Состояние заявки с текстами. trial — пробная версия: тексты STATES с заменами TRIAL.states
 * (и отказ не на шаге Совета — 'declined-level').
 */
export function stateOf(key, trial = false) {
  const base = STATES[key] || (trial && key === 'declined-level' ? STATES.declined : STATES.start);
  const t = trial ? TRIAL.states[key] : null;
  return t ? { ...base, ...t } : base;
}

/**
 * Шаги заявки для состояния: номер, имя, статус (done | now | next | no) и подпись.
 * ctx: email — почта аккаунта, sentAt — «19 июня», trial — слова пробной версии,
 * signedIn — вошёл, заявки ещё нет: шаг «Регистрация» пройден, «Анкета» — сейчас.
 */
export function stepViews(stateKey, ctx = {}) {
  const st = stateOf(stateKey, ctx.trial);
  const at = ctx.signedIn && st.at === 1 ? 2 : st.at;
  return STEPS.map((s0, i) => {
    const s = ctx.trial && TRIAL.steps[s0.key] ? { ...s0, ...TRIAL.steps[s0.key] } : s0;
    const n = i + 1;
    let status = n < at ? 'done' : n === at ? 'now' : 'next';
    if (st.no && n === at) status = 'no';
    let sub = s[status === 'no' ? 'no' : status] || s.next;
    if (status === 'done' && s.key === 'account') sub = ctx.email || 'Аккаунт создан';
    if (status === 'done' && s.key === 'form') sub = ctx.sentAt ? `Подана ${ctx.sentAt}` : 'Анкета подана';
    return { n, key: s.key, name: s.name, status, sub };
  });
}

// сколько шагов пройдено — для полосы шагов
export const doneCount = (stateKey, trial = false) => Math.min(6, Math.max(0, stateOf(stateKey, trial).at - 1));

/* ---------- этап «Пользователи»: профиль и анкета пробной версии ---------- */

// инициалы из имени: «Арман Есенов» → «АЕ»; без имени — пусто (в кружке значок человека)
export function initialsOf(name) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return w.length ? `${w[0][0]}${w.length > 1 ? w[w.length - 1][0] : ''}`.toUpperCase() : '';
}

// имя на карте — в две строки: имя и всё остальное
export function nameLines(name) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return [w[0] || '', w.slice(1).join(' ')];
}

const twoWords = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length >= 2;
export const ABOUT_MAX = 500;

/** Профиль: имя можно оставить пустым; если есть — 2–60 знаков, не меньше двух слов. О себе — до 500. */
export function checkProfile(p) {
  const err = {};
  const name = String(p.name || '').trim();
  if (name && (name.length < 2 || name.length > 60 || !twoWords(name))) err.name = 'Нужны имя и фамилия';
  if (String(p.about || '').length > ABOUT_MAX) err.about = `До ${ABOUT_MAX} знаков`;
  return err;
}

/** Анкета пробной версии: без телефона и даты рождения; имя — из профиля, его можно поправить. */
export function checkTrialForm(f) {
  const err = {};
  if (!twoWords(f.name) || String(f.name).trim().length > 60) err.name = 'Нужны имя и фамилия';
  const y = String(f.pairYears ?? '').trim();
  if (y === '' || !Number.isFinite(Number(y)) || Number(y) < 0 || Number(y) > 70) err.pairYears = 'Сколько лет играете в паре';
  if (!f.consentData) err.consentData = 'Без согласия заявку не принять';
  return err;
}
