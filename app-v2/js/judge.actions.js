// Пульт судьи со шторкой особых случаев: штраф, снятие пары, перерыв из-за дождя.
// Пульт тот же, что в judge.html (две клавиши «очко паре», геймы на стекле, «Отмена»), счёт ведёт
// тот же движок score.js; журнал пульта живёт в этой вкладке, поэтому «Выйти» и «Продолжить»
// возвращают на тот же счёт, а конец сета ведёт к «Итогу матча».
// Идущий матч из общего мира начинается с того счёта, что в эту секунду на «Сегодня»;
// остальные — с нуля, подача и стороны — как выбрал судья перед началом.
import { ptsOf, keyPtsOf, setTick, icon, hydrate, pairInfo, phrase, keepTheme, sheet } from '../app.js';
import { tryApply, view, replay, applyEvent } from '../score.js';
import { D, store, pickMatch, phaseOf, params, go, esc, courtOf, pultScore, pultLog, pickHtml, openStill, buzz } from './judge.js';

const id = pickMatch('live') || 'third';
const ph = phaseOf(id);
if (ph === 'soon') go(`judge-start.html?m=${id}`, true);
else if (ph === 'sent' || (ph === 'done' && !pultLog(id))) go(`judge-end.html?m=${id}`, true);
else pult();

function pult() {
  const m = D.match(id);
  const c = courtOf(m);
  const own = store.get(id);
  const PP = m.pairs.map(pairInfo);

  // ---------- счёт ----------
  let s = pultScore(id);
  // журнал пишется с первого действия судьи: пока он ничего не нажал, пульт ничего не меняет
  const save = () => store.set(id, { pult: { init: s.init, log: s.log } });
  // перерыв из-за дождя — событие stop в журнале: очки и подача замирают до resume
  let rain = view(s).stopped ? { v: view(replay(s.init, s.log.slice(0, -1))) } : null;

  // ---------- пульт ----------
  document.getElementById('where').textContent = `${c.name} · сет до 6`;
  document.title = `Пульт · ${m.title} · Судья · Теннисная лига`;
  const keysEl = document.getElementById('keys');
  const keys = [0, 1].map((i) => keysEl.querySelector(`.key[data-side="${i}"]`));
  // стороны: дальняя пара — верхняя клавиша (как выбрал судья перед началом)
  if (own.far === 1) { keysEl.prepend(keys[1]); keysEl.append(keys[0]); }
  keys.forEach((k, i) => {
    k.querySelector('.who').textContent = PP[i].names;
    k.setAttribute('aria-label', `Очко паре ${PP[i].names}`);
  });
  const float = keysEl.querySelector('.games-float');
  const msgEl = float.querySelector('.msg');
  const undo = document.getElementById('undo');
  const undoNote = undo.querySelector('.muted');
  const resume = document.getElementById('resume');
  const toEnd = document.getElementById('toEnd');
  const more = document.getElementById('more');
  let flashing = false;
  let msgTimer = null;
  let prevText = '';

  const over = () => { const v = view(s); return v.finished && !v.stopped; };

  function floatShow() {
    if (rain) {
      float.classList.add('flashmsg');
      msgEl.textContent = `Перерыв · дождь · ${rain.v.games[0]}:${rain.v.games[1]}`;
      return;
    }
    if (flashing) return;
    float.classList.remove('flashmsg');
    msgEl.textContent = '';
    const v = view(s);
    setTick(float.querySelector('[data-g="0"]'), v.games[0]);
    setTick(float.querySelector('[data-g="1"]'), v.games[1]);
  }
  function say(text) {
    flashing = true;
    float.classList.add('flashmsg');
    msgEl.textContent = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { flashing = false; floatShow(); }, 1800);
  }

  function draw() {
    const v = view(s);
    const shown = rain ? rain.v : v;
    const done = over();
    keys.forEach((k, i) => {
      k.classList.toggle('serving', !rain && !done && shown.server === i);
      k.classList.toggle('has-adv', !rain && !done && shown.advantage === i);
      setTick(k.querySelector('[data-pts]'), done ? (v.winner === i ? '✓' : '') : keyPtsOf(shown)[i]);
      k.setAttribute('aria-disabled', rain || done ? 'true' : 'false');
    });
    // решающее очко (второе «ровно»): на капсуле геймов вместо «геймы» — плашка «Решающее очко»
    float.classList.toggle('deciding', !rain && !done && v.decidingPoint);
    keysEl.classList.toggle('jd-paused', !!rain);
    floatShow();
    // низ пульта: «Отмена» и круглая «Ещё»; в перерыве — «Продолжить матч»; после сета — «Итог матча»
    undo.hidden = !!rain;
    undo.disabled = !v.canUndo;
    undo.classList.toggle('jd-round', done);
    undo.setAttribute('aria-label', done ? 'Отмена последнего очка' : 'Отмена');
    undoNote.textContent = prevText && !done ? `было ${prevText}` : '';
    resume.hidden = !rain;
    toEnd.hidden = !done;
    more.hidden = done;
  }

  function finishPlayed(v) {
    const tb = v.tiebreak ? Math.min(...v.tiebreak) : null;
    store.set(id, { phase: 'done', outcome: 'played', games: v.games.slice(), tb, by: null, fixed: false, was: null, ok: [false, false] });
    toEnd.setAttribute('href', keepTheme(`judge-end.html?m=${id}`));
  }

  keys.forEach((k, i) => {
    k.addEventListener('pointerdown', (e) => {
      const r = k.getBoundingClientRect();
      k.style.setProperty('--x', `${e.clientX - r.left}px`);
      k.style.setProperty('--y', `${e.clientY - r.top}px`);
    });
    k.addEventListener('click', () => {
      if (rain || over()) return;
      const before = view(s);
      const res = tryApply(s, { t: 'point', side: i });
      if (!res.accepted) return;
      prevText = before.inTiebreak ? before.tiebreak.join(':') : ptsOf(before).join(':');
      s = res.state; save();
      k.classList.remove('hit'); void k.offsetWidth; k.classList.add('hit');
      buzz();
      const v = view(s);
      if (v.finished) { finishPlayed(v); say(`Сет · ${v.games[0]}:${v.games[1]}`); }
      else if (v.games[i] > before.games[i]) say(`Гейм · ${v.games[0]}:${v.games[1]} · смена подачи`);
      draw();
    });
  });

  undo.addEventListener('click', () => {
    const wasOver = over();
    const res = tryApply(s, { t: 'undo' });
    if (!res.accepted) return;
    s = res.state; save();
    prevText = '';
    flashing = false; clearTimeout(msgTimer);
    if (wasOver && !over()) store.set(id, { phase: 'live', outcome: null, games: null, ok: null });
    buzz(8);
    draw();
  });

  resume.addEventListener('click', () => {
    if (!rain) return;
    const r = tryApply(s, { t: 'resume' });
    if (r.accepted) { s = r.state; save(); }
    rain = null;
    buzz(20);
    say('Матч продолжен');
    draw();
  });

  // ---------- шторка особых случаев ----------
  const sheetEl = document.getElementById('sheet');
  const scrimEl = document.getElementById('scrim');
  const sh = sheet(sheetEl, scrimEl);
  const body = document.getElementById('sheetBody');
  let step = 'list';
  let pick = null;   // выбранная пара
  let kind = null;   // вид штрафа

  // сколько нарушений уже у пары: предупреждения ей и штрафы в пользу соперника
  const offences = (side) => { const v = view(s); return v.warnings[side] + v.penalties.filter((p) => p.to === 1 - side).length; };
  // лестница: первое нарушение — предупреждение, второе — очко сопернику, дальше — гейм
  const ladder = (side) => ['warning', 'penaltyPoint', 'penaltyGame'][Math.min(offences(side), 2)];
  // что будет со счётом после штрафа: «Станет 40:15», «Гейм, станет 5:3 по геймам», «Матч окончен, 6:3»
  function preview(t, to) {
    const v = view(s);
    const nv = view(applyEvent(s, { t, to }));
    if (nv.finished) return `Матч окончен, ${nv.games[0]}:${nv.games[1]}`;
    if (nv.games[0] !== v.games[0] || nv.games[1] !== v.games[1]) return `${t === 'penaltyPoint' ? 'Гейм, станет' : 'Станет'} ${nv.games[0]}:${nv.games[1]} по геймам`;
    return `Станет ${ptsOf(nv).join(':')}`;
  }
  const nowText = () => {
    const v = rain ? rain.v : view(s);
    return `${v.games[0]}:${v.games[1]}${v.points ? `, ${ptsOf(v).join(':')}` : ''}`;
  };
  const picks = () => `<div class="picks">${pickHtml(m, 0, pick === 0)}${pickHtml(m, 1, pick === 1)}</div>`;
  const foot = (label, ic, enabled) => `<button type="button" class="btn main" data-ok${enabled ? '' : ' disabled'}>${icon(ic)}${esc(label)}</button>
    <button type="button" class="btn quiet jd-back" data-back>Назад</button>`;

  const STEPS = {
    list() {
      const v = view(s);
      const rows = [
        ['penalty', 'card', 'Штраф', 'Предупреждение, очко или гейм', !!rain],
        ['retire', 'leave', 'Снятие пары', 'Победа сопернику', false],
        ['rain', 'rain', 'Перерыв из-за дождя', rain ? 'Матч уже прерван' : 'Счёт и подача сохранятся', !!rain],
      ];
      const lead = rain ? `Перерыв при ${nowText()}` : phrase(s, v, PP);
      return `<div class="title" id="sheetTitle">Особые случаи</div>
        <p class="lead">${esc(lead)}</p>
        <div class="jd-acts">${rows.map(([to, ic, t, sub, off]) => `<button type="button" class="row jd-act" data-go="${to}"${off ? ' disabled' : ''}>
          <span class="jd-act-ic" aria-hidden="true">${icon(ic)}</span>
          <span class="grow"><span class="strong">${esc(t)}</span><span class="sub">${esc(sub)}</span></span>
          <span class="go" aria-hidden="true">${icon('chev')}</span></button>`).join('')}</div>
        <button type="button" class="btn quiet jd-back" data-close>Закрыть</button>`;
    },
    penalty() {
      let kinds = '';
      let then = 'Штраф получает нарушитель, очко или гейм — соперник';
      if (pick !== null) {
        const to = 1 - pick;
        const opts = [
          ['warning', 'Предупреждение', 'Счёт не меняется'],
          ['penaltyPoint', 'Очко сопернику', preview('penaltyPoint', to)],
          ['penaltyGame', 'Гейм сопернику', preview('penaltyGame', to)],
        ];
        kinds = `<div class="jd-kinds" role="radiogroup" aria-label="Вид штрафа">${opts.map(([k, t, sub]) => `<button type="button" class="row pick jd-kind" data-kind="${k}" role="radio" aria-checked="${kind === k}">
          <span class="grow"><span class="strong">${esc(t)}</span><span class="sub">${esc(sub)}</span></span>
          <span class="mark" aria-hidden="true">${icon('check')}</span></button>`).join('')}</div>`;
        const n = offences(pick);
        then = n === 0 ? 'Первое нарушение этой пары' : `У пары уже ${n === 1 ? 'одно нарушение' : `${n} нарушения`}`;
      }
      return `<div class="title" id="sheetTitle">Штраф</div>
        <p class="lead">Кто нарушил?</p>
        ${picks()}
        ${kinds}
        <p class="jd-then">${esc(then)}</p>
        ${foot('Записать штраф', 'card', pick !== null && kind !== null)}`;
    },
    retire() {
      const v = rain ? rain.v : view(s);
      return `<div class="title" id="sheetTitle">Снятие пары</div>
        <p class="lead">Какая пара снялась?</p>
        ${picks()}
        <p class="jd-then">${pick === null ? 'Победа сопернику, матч окончен' : `Победа — ${esc(PP[1 - pick].names)}. В протоколе: снятие при ${v.games[0]}:${v.games[1]}`}</p>
        ${foot('Записать снятие', 'leave', pick !== null)}`;
    },
    rain() {
      const v = view(s);
      return `<div class="title" id="sheetTitle">Перерыв из-за дождя</div>
        <p class="lead">Сейчас ${esc(nowText())}${v.server !== null ? `, подают ${esc(PP[v.server].names)}` : ''}</p>
        <p class="jd-then">Победителя нет. Счёт и подача сохранятся</p>
        ${foot('Прервать матч', 'rain', true)}`;
    },
  };

  function render(focusSel) {
    body.innerHTML = STEPS[step]();
    body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { step = b.dataset.go; pick = null; kind = null; render('.picks button, [data-ok]'); }));
    body.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { step = 'list'; render('[data-go]'); }));
    body.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => sh.close()));
    body.querySelectorAll('.picks button').forEach((b) => b.addEventListener('click', () => {
      pick = +b.dataset.side;
      if (step === 'penalty') kind = ladder(pick);
      buzz(8); render(`.picks button[data-side="${pick}"]`);
    }));
    body.querySelectorAll('.jd-kind').forEach((b) => b.addEventListener('click', () => { kind = b.dataset.kind; buzz(8); render(`.jd-kind[data-kind="${kind}"]`); }));
    const ok = body.querySelector('[data-ok]');
    if (ok) ok.addEventListener('click', apply);
    if (focusSel && sh.isOpen) { const f = body.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); }
  }

  function apply() {
    if (step === 'penalty' && pick !== null && kind) {
      const before = view(s);
      const ev = kind === 'warning' ? { t: 'warning', to: pick, note: 'Нарушение правил' } : { t: kind, to: 1 - pick };
      const res = tryApply(s, ev);
      if (!res.accepted) return;
      s = res.state; save();
      const v = view(s);
      sh.close(); buzz(30);
      if (v.finished) { finishPlayed(v); say(`Сет · ${v.games[0]}:${v.games[1]}`); }
      else if (kind === 'warning') say(`Предупреждение · ${PP[pick].a} / ${PP[pick].b}`);
      else if (v.games[0] !== before.games[0] || v.games[1] !== before.games[1]) say(`Штраф · гейм · ${v.games[0]}:${v.games[1]}`);
      else say(`Штрафное очко · ${ptsOf(v).join(':')}`);
      draw();
      return;
    }
    if (step === 'retire' && pick !== null) {
      const at = (rain ? rain.v : view(s)).games.slice();
      // в перерыве матч остановлен: сначала продолжаем его в журнале, потом записываем снятие
      const from = view(s).stopped ? applyEvent(s, { t: 'resume' }) : s;
      const res = tryApply(from, { t: 'walkover', winner: 1 - pick, kind: 'retired', reason: 'Снятие пары' });
      if (!res.accepted) return;
      s = res.state; save();
      rain = null;
      store.set(id, { phase: 'done', outcome: 'retired', by: pick, games: at, tb: null, fixed: false, was: null, ok: [false, false] });
      buzz(40);
      go(`judge-end.html?m=${id}`);
      return;
    }
    if (step === 'rain') {
      const v = view(s);
      const res = tryApply(s, { t: 'stop', reason: 'Дождь' });
      if (!res.accepted) return;
      s = res.state; save();
      rain = { v };
      sh.close(); buzz(40); draw();
    }
  }

  more.addEventListener('click', (e) => { step = 'list'; pick = null; kind = null; render(); sh.open(e.currentTarget); });

  // ---------- запуск ----------
  render();
  // по умолчанию пульт открыт со шторкой (экран редких действий); ?sheet=0 и сыгранный сет — без неё.
  // Фокус в шторку не переносим сразу: первый Tab ведёт в неё, Esc закрывает её откуда угодно.
  if (params.get('sheet') !== '0' && !over() && !rain) {
    openStill(sheetEl, scrimEl);
    const still = (e) => {
      if (!sh.isOpen) { removeEventListener('keydown', still); return; }
      if (sheetEl.contains(document.activeElement)) return;
      if (e.key === 'Escape') { e.preventDefault(); sh.close(); }
      else if (e.key === 'Tab') { e.preventDefault(); (body.querySelector('button') || sheetEl).focus(); }
    };
    addEventListener('keydown', still);
  }
  if (over()) toEnd.setAttribute('href', keepTheme(`judge-end.html?m=${id}`));
  hydrate(document.querySelector('.app'));
  draw();
}
