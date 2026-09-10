// api/book-social.js — Likes & commentaires des livres Almaqtab (utilisateurs connectés).
//
// MIGRATION FIRESTORE (Phase 4, voir docs/FIRESTORE_SCHEMA.md) :
//   book_likes/{bookKey}      = { bookKey, uids: {uid: true}, count }
//   book_comments/{id}        = { bookKey, uid, name, text, at }
//   book_social_meta/{uid}    = { lastComment }
// remplacent book_likes/{bookKey}/{uid}, book_comments/{bookKey}/{push} et
// book_social_meta/{uid}/lastComment (RTDB).
//
// Body (JSON) : { idToken, action, bookKey?, keys?, text? }
//   action="counts"  { keys:[...] } → { stats: { key:{likes,liked,comments} } }
//   action="list"    { bookKey }    → { likes, liked, comments:[{name,text,at}] }
//   action="like"    { bookKey }    → bascule → { likes, liked }
//   action="comment" { bookKey,text}→ { ok, comment:{name,text,at} }

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { reportError } = require("../../server/log");

const BAD_KEY = /[.#$\[\]\/]/;
// Écarte aussi les caractères de contrôle non imprimables (retour chariot,
// tabulation…), vérifiés un par un plutôt que via une plage dans le regex
// ci-dessus.
function hasControlChars(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x1F || c === 0x7F) return true;
  }
  return false;
}
const validKey = (k) => {
  const s = String(k ?? "");
  return s.length > 0 && s.length <= 768 && !BAD_KEY.test(s) && !hasControlChars(s);
};
const nameFromEmail = (e) => {
  const local = String(e || "").split("@")[0] || "Utilisateur";
  return local.slice(0, 40);
};

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, action, bookKey, keys, text } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  const firestore = app().firestore();
  try {
    // Compteurs pour une liste de livres : lecture directe par clé (les
    // documents book_likes/book_comments sont indexés par bookKey, jamais un
    // scan intégral) — voir docs/FIRESTORE_SCHEMA.md.
    if (action === "counts") {
      const list = Array.isArray(keys) ? keys.filter(validKey).slice(0, 400) : [];
      const stats = {};
      await Promise.all(list.map(async (k) => {
        const [likeSnap, countSnap] = await Promise.all([
          firestore.collection("book_likes").doc(k).get(),
          firestore.collection("book_comments").where("bookKey", "==", k).count().get()
        ]);
        const uids = likeSnap.exists ? (likeSnap.data().uids || {}) : {};
        stats[k] = {
          likes: likeSnap.exists ? Number(likeSnap.data().count) || 0 : 0,
          liked: !!uids[user.uid],
          comments: countSnap.data().count
        };
      }));
      return res.status(200).json({ stats });
    }

    if (!validKey(bookKey)) return res.status(400).json({ error: "Livre invalide." });
    const likeRef = firestore.collection("book_likes").doc(bookKey);

    if (action === "like") {
      let liked, likeCount;
      await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(likeRef);
        const uids = { ...((snap.exists && snap.data().uids) || {}) };
        const already = !!uids[user.uid];
        if (already) delete uids[user.uid]; else uids[user.uid] = true;
        const count = Object.keys(uids).length;
        tx.set(likeRef, { bookKey, uids, count });
        liked = !already;
        likeCount = count;
      });
      return res.status(200).json({ likes: likeCount, liked });
    }

    if (action === "list") {
      const [likeSnap, commentsSnap] = await Promise.all([
        likeRef.get(),
        firestore.collection("book_comments").where("bookKey", "==", bookKey).orderBy("at").get()
      ]);
      const uids = likeSnap.exists ? (likeSnap.data().uids || {}) : {};
      const comments = [];
      commentsSnap.forEach((doc) => {
        const v = doc.data() || {};
        comments.push({ name: v.name || "Utilisateur", text: v.text || "", at: v.at || 0 });
      });
      comments.reverse(); // plus récents en premier
      return res.status(200).json({ likes: Object.keys(uids).length, liked: !!uids[user.uid], comments });
    }

    if (action === "comment") {
      const t = String(text || "").trim().slice(0, 500);
      if (!t) return res.status(400).json({ error: "Commentaire vide." });
      // Anti-spam : cooldown de 15 s par utilisateur entre deux commentaires.
      const metaRef = firestore.collection("book_social_meta").doc(user.uid);
      const metaSnap = await metaRef.get();
      const last = metaSnap.exists ? (metaSnap.data().lastComment || 0) : 0;
      const now = Date.now();
      if (now - last < 15000) {
        return res.status(429).json({ error: "Patientez quelques secondes avant de commenter à nouveau." });
      }
      const rec = { bookKey, uid: user.uid, name: nameFromEmail(user.email), text: t, at: now };
      await firestore.collection("book_comments").add(rec);
      await metaRef.set({ lastComment: now }, { merge: true });
      return res.status(200).json({ ok: true, comment: { name: rec.name, text: rec.text, at: rec.at } });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    if (!e.statusCode) await reportError("book-social", e, { action, uid: user.uid });
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
