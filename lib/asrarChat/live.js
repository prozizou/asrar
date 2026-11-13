'use client';
// Temps réel Asrar-chat : le navigateur n'écoute que des SIGNAUX sans contenu
// (ac_signals/{cid}, ac_inbox_signals/{uid}, ac_typing/{cid}) autorisés par
// rules/database.rules.json ; le contenu est toujours relu par l'API. Si la
// connexion temps réel échoue, le sondage périodique prend le relais.
function listen(path, onValue) {
  let stopped = false, unsubscribe = null;
  (async () => {
    try {
      const [{ db }, rtdb] = await Promise.all([import('../firebase'), import('firebase/database')]);
      if (stopped) return;
      unsubscribe = rtdb.onValue(rtdb.ref(db, path), (snap) => onValue(snap.val()), () => {});
    } catch { /* sondage de secours */ }
  })();
  return () => { stopped = true; unsubscribe?.(); };
}

export function subscribeConv(cid, onChange) {
  let first = true;
  return listen('ac_signals/' + cid, () => { if (first) { first = false; return; } onChange(); });
}

export function subscribeInbox(uid, onChange) {
  let first = true;
  return listen('ac_inbox_signals/' + uid, () => { if (first) { first = false; return; } onChange(); });
}

/** Membres en train d'écrire (horodatage de moins de 6 s), hors soi. */
export function subscribeTyping(cid, selfUid, onChange) {
  return listen('ac_typing/' + cid, (value) => {
    const now = Date.now();
    onChange(Object.entries(value || {}).filter(([uid, at]) => uid !== selfUid && now - Number(at) < 6000).map(([uid]) => uid));
  });
}

let lastTyping = 0;
export async function sendTyping(cid, uid) {
  if (Date.now() - lastTyping < 3000) return;
  lastTyping = Date.now();
  try {
    const [{ db }, rtdb] = await Promise.all([import('../firebase'), import('firebase/database')]);
    await rtdb.set(rtdb.ref(db, `ac_typing/${cid}/${uid}`), rtdb.serverTimestamp());
  } catch { /* indicateur facultatif */ }
}
