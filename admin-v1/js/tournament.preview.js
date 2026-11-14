// «Так увидят игроки» с правкой на месте.
// Страница приложения грузится в рамку один раз; при каждом изменении на экране
// та же вставка (patch) повторяется в уже открытой рамке — предпросмотр меняется сразу,
// без перезагрузки. Та же вставка работает и в шторке «Посмотреть, как увидят» (1024, телефон).
// Разметка приложения меняется — поэтому каждая вставка проверяет, что место нашлось,
// и при ошибке страница приложения остаётся как есть.
import { previewPanel, esc } from '../admin.js';

export function livePreview(col) {
  let cur = null;
  const docs = new Set();
  const alive = (x) => { try { return !!(x.doc.defaultView && x.doc.defaultView.frameElement && x.doc.defaultView.frameElement.isConnected); } catch { return false; } };
  const run = (x) => { try { cur.patch(x.doc, x.mark); } catch { /* место в приложении не нашлось — показываем как есть */ } };
  const api = {
    // cfg: { page, title, patch(doc, mark), site() → разметка окна сайта, banner, start }
    show(cfg) {
      const same = cur && cur.page === cfg.page && !!cur.site === !!cfg.site && col.querySelector('iframe');
      cur = cfg;
      if (same) { api.update(); return; }
      docs.clear();
      previewPanel(col, {
        app: { page: cfg.page, title: cfg.title || 'Приложение', patch: (doc, mark) => { const x = { doc, mark }; docs.add(x); run(x); } },
        site: cfg.site ? cfg.site() : undefined,
        banner: cfg.banner === undefined ? 'Предпросмотр — игроки увидят после публикации' : cfg.banner,
        start: cfg.start,
      });
    },
    update() {
      [...docs].forEach((x) => { if (alive(x)) run(x); else docs.delete(x); });
      if (cur && cur.site) document.querySelectorAll('.pv-site .page').forEach((p) => { p.innerHTML = cur.site(); });
      if (cur && cur.banner !== undefined) document.querySelectorAll('.pv-banner span').forEach((s) => { s.textContent = cur.banner; });
    },
  };
  // шторка строит свою рамку из той же настройки: окно сайта обновляем, когда она открылась
  document.addEventListener('click', (e) => { if (e.target.closest('.preview-open')) setTimeout(api.update, 80); });
  return api;
}

// Разметка, которую понимает приложение (app-v2): кружки игроков и пары.
// Пути к портретам — от страницы приложения (img/…), она в той же папке.
export function appAv(D, pid) {
  const p = D.player(pid);
  return p.portrait ? `<span class="av xs"><img class="face" src="img/${p.portrait}-sm.webp" alt=""></span>` : `<span class="av xs" aria-hidden="true">${esc(D.initials(p))}</span>`;
}
export const appDuo = (D, pairId) => `<span class="duo xs" aria-hidden="true">${D.pair(pairId).players.map((x) => appAv(D, x)).join('')}</span>`;

// Шапка турнира в приложении — для турнира, которого в приложении ещё нет в шапке
// (приложение показывает идущий этап). surface — покрытие корта финалов.
export function appHead(doc, { surface, cap, title, meta, line }) {
  const head = doc.getElementById('head');
  if (!head) return;
  head.dataset.surface = surface;
  const hc = doc.getElementById('head-cap'); if (hc) hc.textContent = cap;
  const body = doc.getElementById('head-body'); if (!body) return;
  const t = body.querySelector('.title'); if (t) t.textContent = title;
  const m = body.querySelector('.tp-meta'); if (m) m.textContent = meta;
  body.querySelectorAll('.tp-final .cap, .tp-line .cap').forEach((x) => { x.textContent = line; });
  body.querySelectorAll('.tp-final .hero-num, .tp-final .tp-vs, .tp-line .num').forEach((x) => { x.hidden = true; x.style.display = 'none'; });
}
// Открыть вкладку турнира в приложении: «setka», «gruppy», «raspisanie»
export function appTab(doc, tab) {
  const a = doc.querySelector(`#tabs [data-tab="${tab}"]`);
  if (a && a.getAttribute('aria-current') !== 'true') a.click();
}
