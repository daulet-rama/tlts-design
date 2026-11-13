// Кто смотрит прототип: роль и «я». Одно место для всех экранов.
// Роль и id игрока лежат в localStorage: 'tlts-role' и 'tlts-me'.
// «Вы здесь» видит только роль «Игрок»: me() для других ролей возвращает null.
// Подписка onIdentityChange срабатывает при смене в этой вкладке, в другой
// вкладке (событие storage) и при возврате страницы из истории (pageshow).
// Адрес ?as=admin (guest, player, judge, superadmin) задаёт роль только для этой вкладки.

import { playerOf } from './data.js';

export const ROLE_KEY = 'tlts-role';
export const ME_KEY = 'tlts-me';
export const ROLES = Object.freeze(['guest', 'player', 'judge', 'admin', 'superadmin']);
export const ROLE_LABELS = Object.freeze({ guest: 'Гость', player: 'Игрок', judge: 'Судья', admin: 'Админ', superadmin: 'Суперадмин' });
export const DEFAULT_ROLE = 'player';
export const DEFAULT_ME = 'd01';

function readUrlRole() {
  try { return new URLSearchParams(globalThis.location ? globalThis.location.search : '').get('as'); } catch { return null; }
}

function browserStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/**
 * Отдельный экземпляр — для тестов. Экраны пользуются готовыми функциями ниже.
 * @param {object} [opts]
 * @param {Storage} [opts.storage] — подмена localStorage
 * @param {EventTarget} [opts.target] — откуда слушать storage и pageshow (по умолчанию window)
 * @param {(id: string) => boolean} [opts.isPlayer] — есть ли такой игрок (по умолчанию playerOf из data.js)
 */
export function createIdentity(opts = {}) {
  const storage = opts.storage || browserStorage();
  const target = opts.target !== undefined ? opts.target : (typeof window !== 'undefined' ? window : null);
  const isPlayer = opts.isPlayer || ((id) => !!playerOf(id));
  const listeners = new Set();

  // Роль только для этой вкладки: адрес ?as=admin. В localStorage не пишется и на другие вкладки не влияет.
  // Нужна для прямых ссылок на вид директора или админа. Выбор роли на экране (setRole) её снимает.
  const urlRole = opts.urlRole !== undefined ? opts.urlRole : readUrlRole();
  let tabRole = ROLES.includes(urlRole) ? urlRole : null;

  const get = (k) => { try { return storage ? storage.getItem(k) : null; } catch { return null; } };
  const set = (k, v) => { try { if (storage) { if (v == null) storage.removeItem(k); else storage.setItem(k, v); } } catch { /* хранилище недоступно */ } };

  function role() {
    if (tabRole) return tabRole;
    const r = get(ROLE_KEY);
    return ROLES.includes(r) ? r : DEFAULT_ROLE;
  }
  // id игрока, за которого вошли (независимо от роли) — например, чей профиль открыть
  function playerId() {
    const id = get(ME_KEY);
    return id && isPlayer(id) ? id : DEFAULT_ME;
  }
  // «я» для подсветки «вы здесь»: только у роли «Игрок»
  function me() {
    return role() === 'player' ? playerId() : null;
  }
  const isMe = (id) => !!id && me() === id;
  const snapshot = () => ({ role: role(), me: me(), playerId: playerId() });

  let last = JSON.stringify(snapshot());
  function notify(source) {
    const snap = snapshot();
    const key = JSON.stringify(snap);
    if (key === last) return;
    last = key;
    for (const fn of [...listeners]) {
      try { fn({ ...snap, source }); } catch (e) { console.error('[tlts identity] подписчик', e); }
    }
  }

  function setRole(r) {
    if (!ROLES.includes(r)) return false;
    tabRole = null;
    set(ROLE_KEY, r);
    notify('local');
    return true;
  }
  function setMe(id) {
    if (id != null && !isPlayer(id)) return false;
    set(ME_KEY, id);
    notify('local');
    return true;
  }

  const onStorage = (e) => { if (!e || e.key == null || e.key === ROLE_KEY || e.key === ME_KEY) notify('storage'); };
  const onShow = () => notify('pageshow');
  let attached = false;
  function attach() {
    if (attached || !target || typeof target.addEventListener !== 'function') return;
    attached = true;
    target.addEventListener('storage', onStorage);
    target.addEventListener('pageshow', onShow);
  }
  function detach() {
    if (!attached) return;
    attached = false;
    target.removeEventListener('storage', onStorage);
    target.removeEventListener('pageshow', onShow);
  }

  // fn({ role, me, playerId, source: 'local' | 'storage' | 'pageshow' }); → отписка
  function onIdentityChange(fn) {
    listeners.add(fn);
    last = JSON.stringify(snapshot());
    attach();
    return () => { listeners.delete(fn); if (!listeners.size) detach(); };
  }

  // роль пришла из адреса (?as=…), а не из выбора на экране
  const isTabRole = () => tabRole != null;

  return { role, me, playerId, isMe, setRole, setMe, onIdentityChange, snapshot, isTabRole };
}

const shared = createIdentity();
export const role = shared.role;
export const me = shared.me;
export const playerId = shared.playerId;
export const isMe = shared.isMe;
export const setRole = shared.setRole;
export const setMe = shared.setMe;
export const onIdentityChange = shared.onIdentityChange;
export const isTabRole = shared.isTabRole;
