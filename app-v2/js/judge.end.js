// «Итог матча»: счёт на табло, подтверждение обеими парами, исправление с пометкой, отправка.
// Итог приходит с пульта (judge.js, store). Без него экран показывает матч за 3-е место,
// доигранный движком score.js от 4:3, 30:15 из data.js: Громов / Юсупов берут оставшиеся очки
// (брейк 5:3 и своя подача) — 6:3. Записывается только то, что судья нажал сам.
import { hydrate, icon, bronzeStart, duoHtml, worldTime, sheet } from '../app.js';
import { applyEvent, isLegalFinal, isLegalTiebreak, FORMAT_LEAGUE } from '../score.js';
import { D, RULES, store, pickMatch, phaseOf, go, esc, courtOf, pairOf, pairGen, pultLog, pultHref, markRowHtml, setMark, buzz } from './judge.js';

const id = pickMatch('done') || 'third';
const m = D.match(id);
const c = courtOf(m);
const ph = phaseOf(id);
const own = store.get(id);
const log = pultLog(id);

// где итога ещё нет: несыгранный — «Перед началом», идущий на пульте судьи — пульт
if (ph === 'soon') go(`judge-start.html?m=${id}`, true);
else if (ph === 'live' && (log || m.state !== 'live')) go(pultHref(id), true);
else show();

function defaultResult() {
  if (m.sets) { const [a, b, tb] = m.sets[0]; return { outcome: 'played', games: [a, b], tb: tb === undefined ? null : tb, by: null }; }
  let s = bronzeStart();
  for (let i = 0; i < 40 && !s.finished; i++) s = applyEvent(s, { t: 'point', side: 0 });
  return { outcome: 'played', games: s.games.slice(), tb: null, by: null };
}

function show() {
  const sent = ph === 'sent';
  const r = {
    ...defaultResult(),
    ...(own.games ? { outcome: own.outcome || 'played', games: own.games, tb: own.tb ?? null, by: own.by ?? null } : {}),
    fixed: !!own.fixed, was: own.was || null,
  };
  // кто подтвердил счёт: сначала никто — судья показывает телефон каждой паре
  let ok = sent ? [true, true] : Array.isArray(own.ok) ? own.ok.slice() : [false, false];
  if (r.outcome === 'noshow') ok[r.by] = false;

  const winner = () => (r.outcome === 'played' ? (r.games[0] > r.games[1] ? 0 : 1) : 1 - r.by);
  const scoreText = (g = r.games, tb = r.tb) => `${g[0]}:${g[1]}${tb !== null && tb !== undefined ? ` (${tb})` : ''}`;

  document.getElementById('where').textContent = `${c.name} · ${m.title.toLowerCase()}`;
  document.title = `Итог матча · ${m.title} · Судья · Теннисная лига`;

  // назад: неявка — «Перед началом»; счёт вёлся на пульте — к пульту (отменить последнее очко); иначе — мои матчи
  const back = document.getElementById('back');
  const backTo = sent ? ['judge-list.html', 'Мои матчи']
    : r.outcome === 'noshow' ? [`judge-start.html?m=${id}`, 'Перед началом']
      : log ? [pultHref(id), 'К пульту'] : ['judge-list.html', 'Мои матчи'];
  back.setAttribute('href', backTo[0]);
  back.setAttribute('aria-label', backTo[1]);

  // ---------- герой: итог на табло ----------
  const final = document.getElementById('final');
  final.dataset.surface = c.surface;
  const sideHtml = (s, num, win) => {
    const p = pairOf(m, s);
    return `<div class="jd-side${win ? ' win' : ''}" data-side="${s}">
      <span class="hero-num">${num}</span>
      ${duoHtml(p.id, 'sm')}
      <span class="jd-names"><span>${esc(p.lines[0])}</span><span>${esc(p.lines[1])}</span></span>
    </div>`;
  };
  function paintFinal() {
    const w = winner();
    let cap = sent ? 'Отправлено' : 'Матч окончен';
    let body = '';
    let say = `Выиграли ${pairOf(m, w).name}`;
    if (r.outcome === 'played' || r.outcome === 'retired') {
      // тай-брейк — маленькой цифрой у проигравших: 7:6⁴
      const g = r.games.map((x, i) => (r.outcome === 'played' && r.tb !== null && r.games[i] === 6 && r.games[1 - i] === 7 ? `${x}<sup>${r.tb}</sup>` : `${x}`));
      body = `<div class="jd-score" aria-label="${esc(r.outcome === 'played' ? `Счёт ${scoreText()}` : `Снятие при счёте ${r.games[0]}:${r.games[1]}`)}">
        ${sideHtml(0, g[0], w === 0)}<span class="hero-num jd-colon" aria-hidden="true">:</span>${sideHtml(1, g[1], w === 1)}
      </div>`;
      if (r.outcome === 'played' && r.fixed && r.was) say += ` · было ${r.was[0]}:${r.was[1]}`;
      if (r.outcome === 'retired') { cap = sent ? 'Отправлено · снятие' : 'Снятие при счёте'; say = `${pairOf(m, r.by).name} снялись, победа — ${pairOf(m, w).name}`; }
    } else {
      cap = sent ? 'Отправлено · без счёта' : 'Поражение без счёта';
      body = '<span class="hero-num jd-word">Неявка</span>';
      say = `${pairOf(m, r.by).name} не явились, победа — ${pairOf(m, w).name}`;
    }
    final.setAttribute('aria-label', `${m.title}, ${D.courtLine(m.court)}`);
    // мини-корт основы — где играли: номер корта на его покрытии
    const tile = `<span class="srf-tile" data-surface="${c.surface}" aria-hidden="true"><span class="num">${esc(c.name.replace(/\D/g, ''))}</span><span class="base"></span></span>`;
    final.innerHTML = `
      <div class="jd-board-top">${tile}${r.fixed && !sent ? `<span class="pill">${icon('edit')}Исправлено</span>` : `<span class="cap grow">${cap}</span>`}</div>
      ${body}
      <p class="jd-say">${esc(say)}</p>`;
  }

  // ---------- подтверждение ----------
  const oks = document.getElementById('oks');
  const sendBtn = document.getElementById('send');
  const wait = document.getElementById('wait');
  const need = () => [0, 1].filter((s) => !(r.outcome === 'noshow' && s === r.by));
  function paintOks() {
    oks.innerHTML = [0, 1].map((s) => {
      if (r.outcome === 'noshow' && s === r.by) {
        return `<div class="row jd-absent">${duoHtml(m.pairs[s], 'sm')}<span class="grow"><span class="strong ellipsis">${esc(pairOf(m, s).name)}</span><span class="sub">Не явились</span></span></div>`;
      }
      return markRowHtml(m, s, ok[s], ['Подтвердили', 'Ждём']);
    }).join('');
    if (sent) oks.querySelectorAll('button.pick').forEach((b) => { b.disabled = true; });
    else {
      oks.querySelectorAll('button.pick').forEach((row) => row.addEventListener('click', () => {
        const s = +row.dataset.side;
        ok[s] = !ok[s];
        setMark(row, ok[s]); buzz();
        store.set(id, { phase: 'done', outcome: r.outcome, games: r.games, tb: r.tb, by: r.by ?? null, fixed: r.fixed, was: r.was, ok });
        paintSend();
      }));
    }
    paintSend();
  }
  function paintSend() {
    const req = need();
    const n = req.filter((s) => ok[s]).length;
    document.getElementById('okN').textContent = `${n} из ${req.length}`;
    if (sent) return;
    const missing = req.filter((s) => !ok[s]);
    sendBtn.disabled = missing.length > 0;
    wait.textContent = missing.length === 2 ? 'Ждём обе пары' : missing.length ? `Ждём ${pairGen(m, missing[0])}` : '';
    wait.hidden = !missing.length;
  }

  if (sent) {
    // отправленный результат: только посмотреть
    document.getElementById('okCap').textContent = 'Счёт подтвердили';
    document.getElementById('fix').hidden = true;
    wait.textContent = own.sentAt ? `Отправлено в ${own.sentAt}` : 'Результат отправлен';
    wait.hidden = false;
    sendBtn.outerHTML = `<a class="btn quiet" id="send" href="judge-list.html">${icon('back')}Мои матчи</a>`;
  } else {
    sendBtn.innerHTML = `${icon('send')}Отправить результат`;
    sendBtn.addEventListener('click', () => {
      if (sendBtn.disabled) return;
      const text = r.outcome === 'played' ? `${m.title}, ${scoreText()}` : `${m.title}, ${r.outcome === 'noshow' ? 'неявка' : `снятие при ${r.games[0]}:${r.games[1]}`}`;
      store.set(id, { phase: 'sent', outcome: r.outcome, games: r.games, tb: r.tb, by: r.by ?? null, fixed: r.fixed, was: r.was, ok, sentAt: worldTime() });
      store.set('_flash', { text: `Отправлено: ${text.charAt(0).toLowerCase()}${text.slice(1)}` });
      buzz(30);
      go('judge-list.html');
    });
  }

  // ---------- исправить счёт ----------
  const fixBtn = document.getElementById('fix');
  if (sent) { /* отправлено — не правится */ } else if (r.outcome !== 'played') {
    // неявку и снятие не правят счётом — их отменяют
    document.getElementById('fixLabel').textContent = r.outcome === 'noshow' ? 'Отменить неявку' : 'Отменить снятие';
    const ic = fixBtn.querySelector('[data-icon]');
    if (ic) { ic.dataset.icon = 'undo'; ic.innerHTML = icon('undo'); }
    fixBtn.addEventListener('click', () => {
      // снятие записано в журнале пульта последним событием — убираем его, матч продолжается с того же счёта
      const pult = log ? { ...log, log: log.log.slice() } : null;
      if (pult && pult.log.length && pult.log[pult.log.length - 1].t === 'walkover') pult.log.pop();
      store.set(id, { phase: r.outcome === 'noshow' ? 'soon' : 'live', outcome: null, games: null, by: null, ok: null, ...(pult ? { pult } : {}) });
      go(r.outcome === 'noshow' ? `judge-start.html?m=${id}` : pultHref(id));
    });
  } else {
    const sh = sheet(document.getElementById('sheet'), document.getElementById('scrim'));
    const steppers = document.getElementById('steppers');
    const msg = document.getElementById('fixMsg');
    const okBtn = document.getElementById('fixOk');
    document.getElementById('fixLead').textContent = `${RULES.set}, ${RULES.tiebreak.replace('При', 'при')}`;
    let draft = null;
    const N = FORMAT_LEAGUE.gamesToWin;
    const problem = (g) => {
      const [a, b] = g; const w = Math.max(a, b); const l = Math.min(a, b);
      if (isLegalFinal(FORMAT_LEAGUE, g)) return null;
      if (w < N) return `Сет не окончен: кто-то должен взять ${N} геймов`;
      if (w === N && l === N - 1) return `${a}:${b} — сет не окончен: играют до ${N + 1}:${N - 1} или до тай-брейка`;
      if (w === N && l === N) return `При ${N}:${N} — тай-брейк, итог ${N + 1}:${N}`;
      if (w === N + 1 && l < N - 1) return `${a}:${b} не бывает: сет кончился бы при ${N}:${l}`;
      return `${a}:${b} не бывает`;
    };
    const hasTb = (g) => Math.max(...g) === N + 1 && Math.min(...g) === N;
    const row = (key, label, value) => `<div class="row stepper" data-k="${key}">
        <span class="grow strong ellipsis">${esc(label)}</span>
        <button type="button" class="step-btn" data-d="-1" aria-label="Меньше: ${esc(label)}">${icon('minus')}</button>
        <output class="num val" aria-label="${esc(label)}">${value}</output>
        <button type="button" class="step-btn" data-d="1" aria-label="Больше: ${esc(label)}">${icon('plus')}</button>
      </div>`;
    function paintDraft() {
      const g = draft.games;
      const tbOn = hasTb(g);
      const tbW = tbOn ? Math.max(N + 1, draft.tb + 2) : 0;
      steppers.querySelector('[data-k="0"] output').textContent = g[0];
      steppers.querySelector('[data-k="1"] output').textContent = g[1];
      const tbRow = steppers.querySelector('[data-k="tb"]');
      tbRow.hidden = !tbOn;
      tbRow.querySelector('output').textContent = `${tbW}:${draft.tb}`;
      steppers.querySelectorAll('[data-k="0"] .step-btn, [data-k="1"] .step-btn').forEach((b) => {
        const s = +b.closest('[data-k]').dataset.k; const d = +b.dataset.d;
        b.disabled = (d < 0 && g[s] <= 0) || (d > 0 && g[s] >= N + 1);
      });
      tbRow.querySelector('[data-d="-1"]').disabled = draft.tb <= 0;
      const p = problem(g);
      const same = g[0] === r.games[0] && g[1] === r.games[1] && (!tbOn || draft.tb === r.tb);
      okBtn.disabled = !!p || same;
      msg.classList.toggle('jd-bad', !!p);
      msg.textContent = p || (same ? 'Счёт не изменился' : `Было ${scoreText()}, станет ${g[0]}:${g[1]}${tbOn ? ` (${draft.tb})` : ''}`);
    }
    fixBtn.addEventListener('click', (e) => {
      draft = { games: r.games.slice(), tb: r.tb !== null ? r.tb : N - 2 };
      steppers.innerHTML = row('0', pairOf(m, 0).name, draft.games[0]) + row('1', pairOf(m, 1).name, draft.games[1]) + row('tb', 'Тай-брейк', '');
      steppers.querySelectorAll('.step-btn').forEach((b) => b.addEventListener('click', () => {
        const k = b.closest('[data-k]').dataset.k; const d = +b.dataset.d;
        if (k === 'tb') draft.tb = Math.max(0, draft.tb + d);
        else draft.games[+k] = Math.max(0, Math.min(N + 1, draft.games[+k] + d));
        buzz(8); paintDraft();
      }));
      paintDraft();
      sh.open(e.currentTarget);
    });
    document.getElementById('fixNo').addEventListener('click', () => sh.close());
    okBtn.addEventListener('click', () => {
      if (okBtn.disabled) return;
      const g = draft.games.slice();
      const tb = hasTb(g) ? draft.tb : null;
      if (tb !== null && !isLegalTiebreak(FORMAT_LEAGUE, [Math.max(N + 1, tb + 2), tb])) return;
      if (!r.fixed) r.was = r.games.slice();
      r.games = g; r.tb = tb; r.fixed = true;
      // счёт изменился — обе пары подтверждают заново
      ok = [false, false];
      store.set(id, { phase: 'done', outcome: 'played', games: g, tb, by: null, fixed: true, was: r.was, ok });
      sh.close(); buzz(20);
      paintFinal(); paintOks();
    });
  }

  paintFinal();
  paintOks();
  hydrate(document.querySelector('.app'));
}
