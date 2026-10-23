'use strict';
/* Short-lived store of ranked post ids per feed session, so "page 2, 3, 4…" continue the exact same
   ranking the viewer started with (no duplicates, no re-ranking jumps). Ids only - never personal data.
   If the process restarted or the entry expired, callers simply re-rank with the same nonce. */
const TTL = 15 * 60_000, MAX = 1500;
const store = new Map();

function cleanNonce(raw) {
  const v = String(raw ?? '').trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : '';
}
const key = (uid, mode, nonce) => `${uid || 'guest'}|${mode}|${nonce}`;

function put(uid, mode, nonce, ids) {
  const k = key(uid, mode, nonce);
  store.delete(k);
  store.set(k, { at: Date.now(), ids: ids.map(String) });
  while (store.size > MAX) store.delete(store.keys().next().value);
}
function get(uid, mode, nonce) {
  const k = key(uid, mode, nonce), hit = store.get(k);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL) { store.delete(k); return null; }
  return hit.ids;
}
function size() { return store.size; }
function clear() { store.clear(); }

module.exports = { cleanNonce, put, get, size, clear, TTL };
