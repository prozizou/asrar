'use client';
// Only content-free invalidation signals and private read markers are read
// directly. Messages and mutations use the authenticated group API.
function subscribeValue(path, onChange, counts = false) {
  let stopped = false, stopAuth, stopValue, timer, latest, generation = 0;
  const visible = () => document.visibilityState !== 'hidden';
  const clear = () => { stopValue?.(); stopValue = null; clearTimeout(timer); };
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!stopped && visible()) onChange(latest); }, 100);
  };
  const attach = async () => {
    const currentGeneration = ++generation;
    clear(); stopAuth?.(); stopAuth = null;
    if (stopped || !visible()) return;
    try {
      const [{ db, auth }, { onValue, ref, query, orderByKey, limitToLast }, { onAuthStateChanged }] = await Promise.all([
        import('./firebase'), import('firebase/database'), import('firebase/auth'),
      ]);
      if (stopped || currentGeneration !== generation || !visible()) return;
      stopAuth = onAuthStateChanged(auth, (user) => {
        clear();
        if (user) stopValue = onValue(counts ? query(ref(db, path), orderByKey(), limitToLast(50)) : ref(db, path), (snapshot) => { latest = snapshot; refresh(); }, () => { clear(); });
      });
    } catch { /* API polling remains available when realtime cannot connect. */ }
  };
  const visibility = () => { void attach(); };
  document.addEventListener('visibilitychange', visibility); void attach();
  return () => { stopped = true; generation++; clear(); stopAuth?.(); document.removeEventListener('visibilitychange', visibility); };
}
export function subscribeZikrChat(groupId, onChange) {
  return subscribeValue(`zikr_chat_signals/${groupId}`, () => onChange());
}
export function subscribeZikrReads(groupId, uid, onChange) {
  return subscribeValue(`zikr_chat_read_counts/${groupId}/${uid}`, (snapshot) => {
    const counts = {};
    snapshot?.forEach((message) => { counts[message.key] = message.size; });
    onChange(counts);
  }, true);
}
const cache = new Map();
export function getChatCache(uid, groupId) {
  const value = cache.get(JSON.stringify([uid, groupId]));
  return value && Date.now() - value.at < 120000 ? value.messages : [];
}
export function putChatCache(uid, groupId, messages) {
  const key = JSON.stringify([uid, groupId]); cache.delete(key);
  cache.set(key, { at: Date.now(), messages: messages.slice(-50) });
  while (cache.size > 5) cache.delete(cache.keys().next().value);
}
export function clearChatCache(uid, groupId) { cache.delete(JSON.stringify([uid, groupId])); }
