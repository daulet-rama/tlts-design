// «Лестница званий»: ваша ступень крупно («4 из 7»), семь ступеней с мячом на вашей,
// шаг до следующего звания и все звания списком. Звание по заслугам говорит о пути в лиге:
// не повторяет КПР и не падает.
// Гость и вошедший (ответ сервера без me): нет «Ваше звание» и «Шаг до …» — только все звания,
// ступени без отметок «пройдено» и «вы здесь».
import { D, ME, isMe, avHtml, icon, ballSvg, tileHtml, hydrate, liveTiles, keepTheme, playerHref, sheet } from '../app.js';
import { plural } from './rating.logic.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const me = ME ? D.player(ME.player) : null;
const level = me ? me.rank : 0;
const MAX = D.RANKS.length;
const cur = D.RANKS[level - 1];
const next = D.RANKS[level] || null;
const quote = (s) => `«${s}»`;
// родительный падеж для «До …» и «Шаг до …»
const GEN = { 'Игрок лиги': 'Игрока лиги', 'Претендент': 'Претендента', 'Призёр': 'Призёра', 'Чемпион этапа': 'Чемпиона этапа', 'Чемпион лиги': 'Чемпиона лиги', 'Легенда лиги': 'Легенды лиги' };
const gen = (label) => quote(GEN[label] || label);
// без me у ступеней нет состояний: все — просто ступени лестницы
const stateOf = (lv) => (!me ? 'later' : lv < level ? 'done' : lv === level ? 'now' : lv === level + 1 ? 'next' : 'later');

// ---------- табло: «4 из 7», звание, сколько осталось, ступени ----------

function hero() {
  $('rk-level').textContent = level;
  $('rk-of').textContent = `из ${MAX}`;
  $('rk-name').textContent = cur.label;

  const stairs = $('stairs');
  stairs.setAttribute('role', 'img');
  stairs.setAttribute('aria-label', `Ступень ${level} из ${MAX}: ${cur.label}`);
  stairs.innerHTML = D.RANKS.map((r) => {
    const st = stateOf(r.level);
    return `<span class="rk-bar ${st}" style="--i:${r.level - 1}">${st === 'now' ? ballSvg('glow') : ''}</span>`;
  }).join('');
  $('nums').innerHTML = D.RANKS.map((r) => `<span class="cap${r.level === level ? ' on' : ''}">${r.level}</span>`).join('');

  // ваш финал сегодня — победа в нём и есть следующая ступень («Победа на этапе в высшей категории»)
  const final = D.match(ME.match);
  const stageFinal = next && next.level === 5 && final && final.round === 'f' && final.state !== 'done'
    && D.TOURNAMENT.category === 'Высшая категория';
  if (!next) {
    $('say').textContent = 'Высшая ступень лиги';
  } else if (stageFinal) {
    // где и когда финал — в плашке под табло, здесь только вывод
    $('say').textContent = `До ${gen(next.label)} — одна победа`;
  } else {
    $('say').textContent = `Дальше — ${quote(next.label)}`;
    $('say2').textContent = next.rule;
    $('say2').hidden = false;
  }

  // ---------- шаг до следующего звания ----------

  if (next && stageFinal) {
    $('next-cap').textContent = `Шаг до ${gen(next.label)}`;
    $('next').innerHTML = tileHtml(final);
    liveTiles($('next'));
  } else if (next) {
    $('next-cap').textContent = `Что нужно для ${gen(next.label)}`;
    $('next').innerHTML = `<div class="card row"><span class="grow strong">${esc(next.rule)}</span></div>`;
  } else {
    $('next-sec').hidden = true;
  }
}
// без me табло и шага до следующего звания нет: экран начинается со всех званий
if (me) hero();
else {
  document.querySelector('.rk-hero').remove();
  $('next-sec').remove();
}

// ---------- все ступени ----------

const byLevel = (lv) => D.PLAYERS.filter((p) => p.rank === lv).sort((a, b) => a.place - b.place);
const steps = $('steps');
steps.innerHTML = D.RANKS.map((r) => {
  const st = stateOf(r.level);
  const n = byLevel(r.level).length;
  const mark = st === 'done' ? icon('check') : r.level;
  const label = `${r.label}: ${n ? `${n} ${plural(n, 'игрок', 'игрока', 'игроков')}` : 'пока никого'}${st === 'now' ? ', вы здесь' : ''}`;
  return `<li class="step ${st === 'later' ? '' : st}"${st === 'now' ? ' aria-current="step"' : ''}>`
    + `<span class="mark">${mark}</span>`
    + `<span><span class="strong">${esc(r.label)}${st === 'now' ? ' · вы' : ''}</span><span class="sub">${esc(r.rule)}</span></span>`
    + `<span class="rk-who" aria-hidden="true">${icon('me')}<span class="cap">${n}</span>${icon('chev')}</span>`
    + `<button class="rk-hit" type="button" data-level="${r.level}" aria-label="${esc(label)}" aria-haspopup="dialog"></button></li>`;
}).join('');

// ---------- шторка: кто на ступени ----------

const panel = sheet($('sheet'), $('scrim'));
function openLevel(lv, opener) {
  const r = D.RANKS[lv - 1];
  const people = byLevel(lv);
  $('sheet-t').textContent = r.label;
  $('sheet-lead').textContent = `${r.rule}. ${people.length ? `${people.length} ${plural(people.length, 'игрок', 'игрока', 'игроков')} лиги` : 'Пока никого'}`;
  $('people').innerHTML = people.map((p) => {
    const mine = isMe(p.id);
    return `<a class="row rank-row${mine ? ' me' : ''}" href="${keepTheme(playerHref(p.id))}"><span class="num place${mine ? '' : ' muted'}">${p.place}</span>${avHtml(p.id, 'sm')}`
      + `<span class="grow"><span class="strong ellipsis">${mine ? 'Вы · ' : ''}${esc(p.name)}</span><span class="sub">КПР ${p.kpr.toFixed(1)}</span></span></a>`;
  }).join('');
  $('people').hidden = !people.length;
  $('people').scrollTop = 0;
  panel.open(opener);
}
steps.addEventListener('click', (e) => {
  const b = e.target.closest('.rk-hit');
  if (b) openLevel(Number(b.dataset.level), b);
});
$('close').addEventListener('click', () => panel.close());

hydrate(document.querySelector('.app'));
