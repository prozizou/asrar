// api/book-social.js — Likes & commentaires des livres Almaqtab (utilisateurs connectés).
//
// Stockage :
//   book_likes/{bookKey}/{uid}      = true
//   book_comments/{bookKey}/{push}  = { uid, name, text, at }
//
// Body (JSON) : { idToken, action, bookKey?, keys?, text? }
//   action="counts"  { keys:[...] } → { stats: { key:{likes,liked,comments} } }
//   action="list"    { bookKey }    → { likes, liked, comments:[{name,text,at}] }
//   action="like"    { bookKey }    → bascule → { likes, liked }
//   action="comment" { bookKey,text}→ { ok, comment:{name,text,at} }

const { verifyUser } = require("./_lib/access");
const { app } = require("./_lib/grant");
const { setCors, parseBody } = require("./_lib/http");

const BAD_KEY = /[.#$\[\]\/\u0000-\u001F\u007F]/;
const validKey = (k) => { const s = String(k ?? ""); return s.length > 0 && s.length <= 768 && !BAD_KEY.test(s); };
const nameFromEmail = (e) => {
  const local = String(e || "").split("@")[0] || "Utilisateur";
  return local.slice(0, 40);
};

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, action, bookKey, keys, text } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  const db = app().database();
  try {
    // Compteurs pour une liste de livres (2 lectures max).
    if (action === "counts") {
      const list = Array.isArray(keys) ? keys.filter(validKey).slice(0, 400) : [];
      const [likesSnap, commSnap] = await Promise.all([
        db.ref("book_likes").once("value"),
        db.ref("book_comments").once("value")
      ]);
      const likes = likesSnap.val() || {}, comm = commSnap.val() || {};
      const stats = {};
      for (const k of list) {
        const lk = likes[k] || {};
        stats[k] = {
          likes: Object.keys(lk).length,
          liked: !!lk[user.uid],
          comments: comm[k] ? Object.keys(comm[k]).length : 0
        };
      }
      return res.status(200).json({ stats });
    }

    if (!validKey(bookKey)) return res.status(400).json({ error: "Livre invalide." });

    if (action === "like") {
      const ref = db.ref("book_likes/" + bookKey + "/" + user.uid);
      const cur = (await ref.once("value")).val();
      if (cur) await ref.remove(); else await ref.set(true);
      const all = (await db.ref("book_likes/" + bookKey).once("value")).val() || {};
      return res.status(200).json({ likes: Object.keys(all).length, liked: !cur });
    }

    if (action === "list") {
      const [likesSnap, commSnap] = await Promise.all([
        db.ref("book_likes/" + bookKey).once("value"),
        db.ref("book_comments/" + bookKey).orderByChild("at").once("value")
      ]);
      const lk = likesSnap.val() || {};
      const comments = [];
      commSnap.forEach((c) => {
        const v = c.val() || {};
        comments.push({ name: v.name || "Utilisateur", text: v.text || "", at: v.at || 0 });
      });
      comments.reverse(); // plus récents en premier
      return res.status(200).json({ likes: Object.keys(lk).length, liked: !!lk[user.uid], comments });
    }

    if (action === "comment") {
      const t = String(text || "").trim().slice(0, 500);
      if (!t) return res.status(400).json({ error: "Commentaire vide." });
      const rec = { uid: user.uid, name: nameFromEmail(user.email), text: t, at: Date.now() };
      await db.ref("book_comments/" + bookKey).push(rec);
      return res.status(200).json({ ok: true, comment: { name: rec.name, text: rec.text, at: rec.at } });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
