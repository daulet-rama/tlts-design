// ============================================================
// «Игроки»: все игроки (поиск и список) и карточка игрока с правкой и видом в приложении.
// players.html — список (players.html?q=хван — с поиском); players.html?p=p12 — карточка.
// Новый игрок — newPlayers.<id>, опубликованные правки карточки — players.<id> (общее состояние).
// ============================================================
import {
  D, esc, icon, toast, hydrate, fitText, previewPanel, whereHtml, autosave, openSheet, closeLayer, dateField, plural, state, dayWords,
} from '../admin.js';
import {
  $, $$, matches, person, allPeople, edits, av, photoSrc, ini, kprText, rankName, sectionTabs, shrinkPhoto, nWord, withWhom, markIn, live,
} from './people.js';

const params = new URLSearchParams(location.search);
const head = $('#head');
const work = $('#work');
const asked = params.get('p');

if (asked && person(asked)) cardView(asked);
else listView();

// ============================================================
// СПИСОК: поле поиска во всю ширину и крупные строки по алфавиту
// ============================================================
function listView() {
  document.title = 'Игроки · Раздел организатора';
  head.innerHTML = `<div class="head-row"><h1 class="h1">Игроки</h1><div id="tabs">${sectionTabs('players')}</div><button class="btn quiet push" type="button" id="add">${icon('plus')}Добавить игрока</button></div>`;
  work.innerHTML = `<div class="pp-list-wrap">
      <div class="field search pp-find"><label class="label" for="q">Найти игрока по фамилии</label>${icon('search')}<input class="input" id="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search"></div>
      <p class="pp-count" id="cnt" aria-live="polite"></p>
      <div id="res"></div>
    </div>`;
  hydrate(head);
  const q = $('#q');
  q.value = params.get('q') || '';
  // поиск — в адресе: «Назад» из карточки возвращает к тем же найденным
  const remember = (query) => {
    const u = new URL(location.href);
    if (query) u.searchParams.set('q', query); else u.searchParams.delete('q');
    history.replaceState(history.state, '', u);
  };
  const rows = () => {
    const query = q.value.trim();
    const list = allPeople().filter((p) => matches(p, query)).sort((a, b) => a.last.localeCompare(b.last, 'ru') || a.first.localeCompare(b.first, 'ru'));
    const total = allPeople().length;
    // сколько нашли — только при поиске; без поиска число и так на вкладке «Все игроки»
    $('#cnt').textContent = query && list.length ? `Нашли: ${nWord(list.length, 'игрок', 'игрока', 'игроков')} из ${total}` : '';
    if (!list.length) {
      $('#res').innerHTML = `<div class="empty"><span class="ic">${icon('search')}</span><p>Никого не нашли по «${esc(query)}». Проверьте букву или добавьте игрока</p><button class="btn quiet" type="button" data-add>${icon('plus')}Добавить игрока</button></div>`;
      return;
    }
    // строка целиком — ссылка на карточку: справа КПР крупно и «›», как в приложении.
    // На телефоне вторая строка короче: «Призёр · с 2021».
    const html = list.map((p) => {
      const sub = p.place
        ? `${esc(rankName(p.rank))} · <span class="pp-hide-phone">в лиге </span>с&nbsp;${p.since}<span class="pp-hide-phone"> · №${p.place} в рейтинге</span>`
        : `Новый игрок · <span class="pp-hide-phone">в лиге </span>с&nbsp;${p.since}`;
      return `<li><a class="row pp-pl" href="players.html?p=${esc(p.id)}" data-id="${esc(p.id)}">${av(p.id, 'pp56')}<span class="grow"><span class="t fit">${esc(p.name)}</span><span class="s">${sub}</span></span><span class="pp-kpr" aria-label="КПР ${kprText(p.kpr)}"><span class="v num">${kprText(p.kpr)}</span></span>${icon('chev', 'go')}</a></li>`;
    });
    // подпись «КПР» — один раз над столбцом цифр, а не в каждой строке
    $('#res').innerHTML = `<ul class="list pp-list" aria-label="Игроки"><li class="pp-lhead" aria-hidden="true"><span>Игрок</span><span>Уровень КПР</span></li>${html.join('')}</ul>`;
    hydrate($('#res'));
  };
  // новый игрок, правка карточки или заявка в лигу — здесь, после «Отменить» или в другой вкладке
  const draw = live(['newPlayers', 'players', 'join'], () => { $('#tabs').innerHTML = sectionTabs('players'); hydrate($('#tabs')); rows(); });
  q.addEventListener('input', () => { remember(q.value.trim()); rows(); });
  // Enter при одном найденном — сразу открыть карточку
  q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const one = $$('#res a.row');
    if (one.length === 1) location.href = one[0].href;
  });
  // новый игрок: поиск снимаем, строка — на виду и мигает
  const added = (id) => {
    if (q.value) { q.value = ''; remember(''); }
    draw();
    const row = $(`a.row[data-id="${id}"]`);
    if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('just'); row.focus({ preventScroll: true }); }
  };
  document.addEventListener('click', (e) => { if (e.target.closest('#add, [data-add]')) addPlayer(added); });
  draw();
  if (q.value) q.select();
}

// ---------- «Добавить игрока»: имя и фамилия, КПР кнопками, рука ----------
function addPlayer(onAdded) {
  const levels = [3.0, 3.5, 4.0, 4.5, 5.0];
  const s = openSheet({
    title: 'Добавить игрока',
    body: `<div class="field full" id="np-f"><label class="label" for="np-name">Имя и фамилия</label><span class="err">${icon('alert')}<span></span></span><input class="input" id="np-name" autocomplete="off" autofocus></div>
      <div class="field full"><span class="label" id="np-kl">КПР</span><div class="chips" role="radiogroup" aria-labelledby="np-kl">${levels.map((k) => `<button type="button" class="chip" role="radio" aria-checked="false" data-value="${k}">${icon('check')}<span class="num">${kprText(k)}</span></button>`).join('')}</div><p class="pick-msg" id="np-kmsg" role="alert" hidden></p></div>
      <div class="field full"><span class="label" id="np-hl">Рука</span><div class="chips" role="radiogroup" aria-labelledby="np-hl" id="np-hand"><button type="button" class="chip" role="radio" aria-checked="true" data-value="правша">${icon('check')}Правша</button><button type="button" class="chip" role="radio" aria-checked="false" data-value="левша">${icon('check')}Левша</button></div></div>`,
    foot: `<p class="who-sees pp-sees">${icon('eye')}<span>Игрок появится в списке сразу, карту в приложении увидит, когда войдёт</span></p><button class="btn main" type="button" data-ok>${icon('plus')}Добавить игрока</button><button class="btn quiet" type="button" data-no>Отмена</button>`,
  });
  const nameF = $('#np-f', s); const name = $('#np-name', s);
  name.addEventListener('input', () => nameF.classList.remove('error'));
  s.addEventListener('change', () => { $('#np-kmsg', s).hidden = true; });
  s.querySelector('[data-no]').addEventListener('click', () => closeLayer());
  s.querySelector('[data-ok]').addEventListener('click', () => {
    const words = name.value.trim().split(/\s+/).filter(Boolean);
    const k = $('[role="radio"][aria-checked="true"][data-value]', $('.chips[aria-labelledby="np-kl"]', s));
    let bad = false;
    if (words.length < 2) { nameF.classList.add('error'); $('.err span', nameF).textContent = 'Впишите имя и фамилию через пробел: сначала имя'; bad = true; }
    if (!k) { const m = $('#np-kmsg', s); m.textContent = 'Выберите КПР'; m.hidden = false; bad = true; }
    if (bad) { (words.length < 2 ? name : $('.chip', s)).focus(); return; }
    const hand = $('#np-hand [aria-checked="true"]', s).dataset.value;
    const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
    const p = { id: `n${Date.now().toString(36)}`, first: cap(words[0]), last: words.slice(1).map(cap).join(' '), kpr: +k.dataset.value, hand, since: D.YEAR, rank: null, place: null, points: null, portrait: null };
    const undo = state.set(`newPlayers.${p.id}`, p, { say: `добавили игрока: ${p.first} ${p.last}, КПР ${kprText(p.kpr)}`, href: `players.html?p=${p.id}` });
    closeLayer(true);
    onAdded(p.id);
    toast(`Добавлен: ${p.first} ${p.last}, КПР ${kprText(p.kpr)}`, { undo });
  });
}

// ============================================================
// КАРТОЧКА ИГРОКА: фото и имя, уровень КПР, звание, рука и год — и сразу вид в приложении
// ============================================================
function cardView(pid) {
  const P0 = person(pid);          // то, что сейчас видят игроки
  const W = D.player(pid);         // как в мире (звание по лестнице, портрет)
  const isNew = !W;
  document.title = `${P0.name} · Игроки · Раздел организатора`;
  const pubLabel = edits()[pid]?.at ? `с ${edits()[pid].at}` : `с ${P0.since}`;

  head.innerHTML = `<a class="back" href="players.html">${icon('back')}Все игроки</a>
    <div class="head-row"><h1 class="h1" id="h1">${esc(P0.name)}</h1><span class="tag lg ok" id="tag">Видно игрокам ${esc(pubLabel)}</span>
      <div class="head-act"><p class="who-sees">${icon('eye')}<span>Увидят все: приложение и сайт</span></p><button class="btn main" type="button" id="pub">${icon('eye')}Опубликовать правки</button></div>
    </div>
    <p class="pp-saved-line"><span class="saved" id="saved"></span><button class="btn text" type="button" id="revert" hidden>${icon('undo')}Вернуть опубликованное</button></p>`;

  const levels = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
  const chip = (v, t, on) => `<button type="button" class="chip" role="radio" aria-checked="${on}" data-value="${esc(v)}">${icon('check')}<span>${t}</span></button>`;
  work.innerHTML = `<div class="with-preview">
    <form class="pp-form" id="f" onsubmit="return false" novalidate aria-label="Карточка игрока">
      <div class="errsum" id="errsum" role="alert" tabindex="-1" hidden></div>
      <div class="line pp-pv-line"><button class="btn quiet preview-open" type="button">${icon('eye')}Посмотреть, как увидят</button></div>
      <section class="pp-card" aria-labelledby="h-id">
        <h2 class="h2" id="h-id">Фото и имя</h2>
        <div class="pp-id">
          <div class="pp-portrait" id="portrait" aria-label="Фото на карте игрока"></div>
          <div class="fields">
            <div class="pp-pair">
              <div class="field" id="ff-first"><label class="label" for="f-first">Имя</label><span class="err">${icon('alert')}<span></span></span><input class="input" id="f-first" value="${esc(P0.first)}" autocomplete="off"></div>
              <div class="field" id="ff-last"><label class="label" for="f-last">Фамилия</label><span class="err">${icon('alert')}<span></span></span><input class="input" id="f-last" value="${esc(P0.last)}" autocomplete="off"></div>
            </div>
          </div>
          <div class="pp-photo-box">
            <div class="pp-photo-acts"><input type="file" id="f-file" accept="image/*"><label class="btn quiet" for="f-file">${icon('camera')}<span id="f-file-t">Заменить фото</span></label><button class="btn quiet" type="button" id="f-nophoto">${icon('trash')}Убрать фото</button></div>
            <input type="hidden" id="f-photo" value="${esc(P0.photo || '')}">
          </div>
        </div>
      </section>
      <section class="pp-card" id="c-kpr" aria-labelledby="h-kpr">
        <h2 class="h2" id="h-kpr">Уровень КПР</h2>
        <div class="chips" role="radiogroup" aria-labelledby="h-kpr" id="kpr">${levels.map((k) => chip(k, `<span class="num">${kprText(k)}</span>`, k === P0.kpr)).join('')}</div>
        <div id="kpr-note"></div>
        <div class="pp-reason" id="kpr-reason" hidden>
          <div class="field full"><span class="label" id="l-why">Основание</span><div class="chips" role="radiogroup" aria-labelledby="l-why" id="why">${chip('council', 'Решение Совета', false)}${chip('fix', 'Исправляю ошибку ввода', false)}</div><p class="pick-msg" id="why-msg" role="alert" hidden></p></div>
          <div id="why-date"></div>
        </div>
      </section>
      <section class="pp-card" id="c-rank" aria-labelledby="h-rank">
        <h2 class="h2" id="h-rank">Звание</h2>
        <div class="chips" role="radiogroup" aria-labelledby="h-rank" id="rank">${D.RANKS.map((r) => chip(r.level, esc(r.label), r.level === P0.rank)).join('')}</div>
        <p class="pp-rank-rule" id="rank-rule"></p>
      </section>
      <section class="pp-card" aria-labelledby="h-more">
        <h2 class="h2" id="h-more">Рука и год вступления</h2>
        <div class="pp-pair">
          <div class="field"><span class="label" id="l-hand">Рука</span><div class="chips" role="radiogroup" aria-labelledby="l-hand" id="hand">${chip('правша', 'Правша', P0.hand !== 'левша')}${chip('левша', 'Левша', P0.hand === 'левша')}</div></div>
          <div class="field pp-year" id="ff-since"><label class="label" for="f-since">В лиге с</label><span class="err">${icon('alert')}<span></span></span><input class="input num" id="f-since" value="${esc(P0.since)}" inputmode="numeric" maxlength="4" autocomplete="off"></div>
        </div>
      </section>
      <div id="where"></div>
    </form>
    <aside class="preview-col" id="pv" aria-label="Так увидят игроки"></aside>
  </div>`;
  hydrate(head); hydrate(work);

  const f = $('#f');
  const val = (sel) => $(`${sel} [aria-checked="true"]`)?.dataset.value ?? null;
  const draft = () => ({
    first: $('#f-first').value.trim(), last: $('#f-last').value.trim(),
    kpr: +val('#kpr'), rank: val('#rank') ? +val('#rank') : null, hand: val('#hand'), since: $('#f-since').value.trim(),
    photo: $('#f-photo').value, why: val('#why'),
  });

  // ---------- дата решения Совета: поле одной даты, прошлые дни можно ----------
  let whyDate = null;
  dateField($('#why-date'), {
    label: 'Дата решения Совета', id: 'f-why-date', today: `${D.YEAR}-01-01`, month: D.NOW.iso.slice(0, 7), hint: 'например: 17 июня или 17.06',
    onChange: (iso) => {
      whyDate = iso;
      const box = $('#why-date');
      if (iso && iso > D.NOW.iso) { whyDate = null; box.classList.add('error'); $('.err span', box).textContent = 'Решение Совета не может быть позже сегодняшнего дня, 19 июня'; $('.understood', box).hidden = true; }
      f.dispatchEvent(new Event('change', { bubbles: true }));
    },
  });

  // ---------- черновик правок отдельно от того, что видят игроки ----------
  const pubBtn = $('#pub'); const revert = $('#revert');
  let shown = pubLabel;
  const as = autosave(f, $('#saved'), { time: state.now(), tag: $('#tag'), published: shown, revert, onDirty: () => requestAnimationFrame(refresh) });

  // ---------- фото: заменить, убрать, перетащить ----------
  const portrait = $('#portrait');
  const setPhoto = (v) => { $('#f-photo').value = v; f.dispatchEvent(new Event('change', { bubbles: true })); };
  const takeFile = async (file) => {
    try { setPhoto(await shrinkPhoto(file)); toast('Фото на месте. Игроки увидят его после «Опубликовать правки»'); } catch { toast('Это не фото. Подойдут файлы JPG, PNG или HEIC', { kind: 'bad' }); }
  };
  $('#f-file').addEventListener('change', (e) => { const file = e.target.files[0]; e.target.value = ''; if (file) takeFile(file); });
  $('#f-nophoto').addEventListener('click', () => {
    const before = $('#f-photo').value;
    setPhoto('none');
    toast('Фото убрано — на карте будут инициалы', { undo: () => setPhoto(before) });
  });
  ['dragenter', 'dragover'].forEach((t) => portrait.addEventListener(t, (e) => { e.preventDefault(); portrait.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => portrait.addEventListener(t, (e) => { e.preventDefault(); portrait.classList.remove('over'); }));
  portrait.addEventListener('drop', (e) => { const file = e.dataTransfer?.files?.[0]; if (file) takeFile(file); });

  // ---------- что показать: фото, следствия КПР, правило звания, вид в приложении ----------
  const curPhoto = (d) => (d.photo === 'none' ? null : d.photo || photoSrc({ ...P0, photo: undefined, portrait: W ? W.portrait : null }, 'lg'));
  const partner = !isNew && D.pairOf(pid) ? D.pair(D.pairOf(pid).id).players.find((x) => x !== pid) : null;
  const [lo, hi] = D.RULES.corridor;

  function refresh() {
    const d = draft();
    // фото
    const src = curPhoto(d);
    portrait.innerHTML = src ? `<img src="${esc(src)}" alt="Фото: ${esc(P0.name)}">` : `<span class="ini" aria-hidden="true">${esc(ini(d))}</span>`;
    $('#f-file-t').textContent = src ? 'Заменить фото' : 'Загрузить фото';
    $('#f-nophoto').hidden = !src;
    // КПР: было → станет, сумма пары и правило сезона, основание
    const kChanged = d.kpr !== P0.kpr;
    let note = '';
    if (kChanged) {
      if (partner) {
        // сумма уровней пары и правило сезона (D.RULES.corridor) — словами, без «коридора»
        const mate = person(partner);
        const sum = d.kpr + mate.kpr;
        const out = sum > hi || sum < lo;
        const where = sum > hi ? `больше ${kprText(hi)}, пара не подходит` : sum < lo ? `меньше ${kprText(lo)}, пара не подходит` : `подходит, можно от ${kprText(lo)} до ${kprText(hi)}`;
        note = `<p class="note ${out ? 'warn' : 'ok'}">${icon(out ? 'warn' : 'check')}<span>Было ${kprText(P0.kpr)} → станет ${kprText(d.kpr)}. Пара с ${esc(withWhom(mate.last))}: сумма станет ${kprText(sum)} — ${where}</span></p>`;
      } else note = `<p class="note ok">${icon('check')}<span>Было ${kprText(P0.kpr)} → станет ${kprText(d.kpr)}</span></p>`;
    }
    $('#kpr-note').innerHTML = note;
    $('#kpr-reason').hidden = !kChanged;
    $('#why-date').hidden = d.why !== 'council';
    // звание: правило лестницы и «как по лестнице»
    const r = D.RANKS.find((x) => x.level === d.rank);
    const auto = W ? W.rank : null;
    $('#rank-rule').innerHTML = r
      ? `${icon('info')}<span><b>«${esc(r.label)}»</b> — ${esc(r.rule.charAt(0).toLowerCase() + r.rule.slice(1))}.${auto && auto !== d.rank ? ` По лестнице — «${esc(rankName(auto))}». <button class="btn text" type="button" id="rank-auto">Вернуть как по лестнице</button>` : ''}</span>`
      : `${icon('info')}<span>Звания пока нет: оно появится после первого турнира</span>`;
    applyAll();
  }
  // поставить в форму значения (после «Отменить» у опубликованного)
  function fill(v) {
    $('#f-first').value = v.first; $('#f-last').value = v.last; $('#f-since').value = v.since;
    $('#f-photo').value = v.photo || '';
    const setR = (g, value) => $$(`${g} [role="radio"]`).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === String(value))));
    setR('#kpr', v.kpr); setR('#rank', v.rank); setR('#hand', v.hand === 'левша' ? 'левша' : 'правша'); setR('#why', null);
  }
  const same = (d) => d.first === P0.first && d.last === P0.last && d.kpr === P0.kpr && d.rank === (P0.rank || null)
    && d.hand === (P0.hand === 'левша' ? 'левша' : 'правша') && +d.since === +P0.since && (d.photo || '') === (P0.photo || '');

  // ---------- вид в приложении: настоящая карта игрока в рамке телефона ----------
  const appPage = isNew ? 'player-other.html?p=p12' : (D.isMe(pid) ? 'player.html' : `player-other.html?p=${pid}`);
  function applyPv(doc) {
    const card = doc.querySelector('section.member');
    if (!card) return;
    const d = draft();
    const name = card.querySelector('.name'); if (name) name.innerHTML = `${esc(d.first || ' ')}<br>${esc(d.last || ' ')}`;
    const since = card.querySelector('.since'); if (since) since.textContent = `В лиге с ${/^\d{4}$/.test(d.since) ? d.since : P0.since}`;
    const k = card.querySelector('.lvl .hero-num'); if (k) k.textContent = kprText(d.kpr);
    const rk = card.querySelector('.rank'); if (rk) { rk.textContent = rankName(d.rank); rk.hidden = !d.rank; }
    let img = card.querySelector('img.photo'); let iEl = card.querySelector('.initials');
    if (card.dataset.orig === undefined) card.dataset.orig = img ? img.getAttribute('src') : '';
    const src = d.photo === 'none' ? null : d.photo || (isNew ? null : card.dataset.orig) || null;
    if (src) {
      if (!img) { img = doc.createElement('img'); img.className = 'photo'; img.alt = ''; card.prepend(img); }
      if (img.getAttribute('src') !== src) img.src = src;
      if (iEl) iEl.remove();
    } else {
      if (img) img.remove();
      if (!iEl) { iEl = doc.createElement('span'); iEl.className = 'initials'; iEl.setAttribute('aria-hidden', 'true'); card.prepend(iEl); }
      iEl.textContent = ini(d);
    }
    // новый игрок: ни мест, ни сезона ещё нет — показываем только карту
    if (isNew) doc.querySelectorAll('main > section:not(.member)').forEach((x) => { x.hidden = true; });
    markIn(card, 'Правка', as.dirty);
  }
  function applyAll() {
    $$('.pv-app iframe').forEach((fr) => { try { const doc = fr.contentDocument; if (doc && doc.readyState === 'complete') applyPv(doc); } catch { /* рамка ещё грузится */ } });
    $$('.pv-banner span').forEach((b) => { b.textContent = as.dirty ? 'Предпросмотр — игроки увидят после «Опубликовать правки»' : 'Так игроки видят карточку сейчас'; });
  }
  previewPanel($('#pv'), {
    app: { page: appPage, title: 'Приложение: карта игрока', patch: (doc) => { applyPv(doc); requestAnimationFrame(applyAll); } },
    banner: 'Так игроки видят карточку сейчас',
  });
  $('#where').innerHTML = whereHtml([
    { icon: 'phone', b: 'Приложение', s: 'карта игрока, кружок в списках и на афише матча' },
    { icon: 'site', b: 'Сайт', s: 'страница игрока и рейтинг' },
  ]);

  f.addEventListener('input', () => requestAnimationFrame(refresh));
  f.addEventListener('change', () => requestAnimationFrame(refresh));
  f.addEventListener('click', (e) => {
    if (e.target.closest('#rank-auto')) {
      const b = $(`#rank [data-value="${W.rank}"]`); if (b) b.click();
      return;
    }
    if (e.target.closest('[role="radio"]')) requestAnimationFrame(refresh);
  });
  ['#f-first', '#f-last', '#f-since'].forEach((s) => $(s).addEventListener('input', () => $(s).closest('.field').classList.remove('error')));
  $('#why').addEventListener('change', () => { $('#why-msg').hidden = true; });

  // что изменилось — словами для журнала: «КПР 4.0 → 4.5 (решение Совета 17 июня), новое фото»
  const changesWords = (d, kprWhy) => {
    const out = [];
    if (d.first !== P0.first || d.last !== P0.last) out.push(`имя и фамилия «${d.first} ${d.last}»`);
    if (d.kpr !== P0.kpr) out.push(`КПР ${kprText(P0.kpr)} → ${kprText(d.kpr)} (${kprWhy.why === 'council' ? `решение Совета ${dayWords(kprWhy.date, { noWeekday: true })}` : 'исправили ошибку ввода'})`);
    if (d.rank !== (P0.rank || null)) out.push(d.rank ? `звание «${rankName(d.rank)}»` : 'звание убрано');
    if (d.hand !== (P0.hand === 'левша' ? 'левша' : 'правша')) out.push(d.hand);
    if (+d.since !== +P0.since) out.push(`в лиге с ${d.since}`);
    if ((d.photo || '') !== (P0.photo || '')) out.push(d.photo === 'none' ? 'фото убрано' : 'новое фото');
    return out.join(', ');
  };

  // ---------- «Опубликовать правки»: не выключена — говорит словами, чего не хватает ----------
  const errsum = $('#errsum');
  pubBtn.addEventListener('click', () => {
    const d = draft();
    if (!as.dirty || same(d)) { errsum.hidden = true; if (as.dirty) as.published(shown); toast('Правок нет — игроки видят карточку такой, как здесь'); return; }
    const errs = [];
    const fieldErr = (id, text) => { const box = $(id); box.classList.add('error'); $('.err span', box).textContent = text; errs.push({ id, text }); };
    if (!d.first) fieldErr('#ff-first', 'Впишите имя');
    if (!d.last) fieldErr('#ff-last', 'Впишите фамилию');
    if (!/^\d{4}$/.test(d.since) || +d.since < 1990 || +d.since > D.YEAR) fieldErr('#ff-since', `Год — четыре цифры, не позже ${D.YEAR}`);
    if (d.kpr !== P0.kpr && !d.why) { const m = $('#why-msg'); m.textContent = 'Выберите основание для нового КПР'; m.hidden = false; errs.push({ id: '#kpr-reason', text: 'Основание для нового КПР' }); }
    if (d.kpr !== P0.kpr && d.why === 'council' && !whyDate) { const box = $('#why-date'); box.classList.add('error'); if (!$('.err span', box).textContent) $('.err span', box).textContent = 'Впишите дату решения Совета'; errs.push({ id: '#why-date', text: 'Дата решения Совета' }); }
    if (errs.length) {
      errsum.innerHTML = `<span class="h3">${icon('alert')}${errs.length === 1 ? 'Есть 1 вопрос' : `Есть ${errs.length} ${plural(errs.length, 'вопрос', 'вопроса', 'вопросов')}`}</span><ul>${errs.map((x) => `<li><a href="${x.id}">${esc(x.text)}</a></li>`).join('')}</ul>`;
      errsum.hidden = false; errsum.focus({ preventScroll: false }); errsum.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    errsum.hidden = true;
    const beforeShown = shown;
    const prevRec = edits()[pid] || {};
    // в общем состоянии — только отличия от мира, время публикации и основание нового КПР
    const base = isNew ? state.get(`newPlayers.${pid}`) : W;
    const kprWhy = d.kpr !== P0.kpr ? { why: d.why, date: d.why === 'council' ? whyDate : null } : prevRec.kprWhy;
    const words = changesWords(d, kprWhy || {});
    const at = state.now();
    const e = {};
    ['first', 'last', 'kpr', 'rank', 'hand'].forEach((k) => { if (d[k] !== base[k]) e[k] = d[k]; });
    if (+d.since !== base.since) e.since = +d.since;
    if (d.photo) e.photo = d.photo;
    if (e.kpr !== undefined && kprWhy) e.kprWhy = kprWhy;
    e.at = at;
    const undo = state.set(`players.${pid}`, e, { say: `опубликовали правки карточки: ${d.first} ${d.last} — ${words}`, href: `players.html?p=${pid}` });
    Object.assign(P0, { ...base, ...e, name: `${d.first} ${d.last}` });
    shown = `с ${at}`;
    as.published(shown);
    $('#h1').textContent = `${d.first} ${d.last}`;
    refresh();
    toast(`Опубликовано: ${d.first} ${d.last}. Видят все`, {
      undo: () => {
        undo();
        const prev = person(pid);
        Object.assign(P0, prev);
        fill(prev);
        shown = beforeShown;
        as.published(shown);
        $('#h1').textContent = prev.name;
        refresh();
      },
    });
  });

  refresh();
  requestAnimationFrame(() => fitText(work));
}
