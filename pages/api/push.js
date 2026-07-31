// api/push.js (Vercel) — Abonnement aux notifications push (FCM), topic
// "new-content" (nouveau secret, document ou produit).
//
// Body (JSON) : { idToken, action, token }
//   action="subscribe"   → abonne le jeton FCM au topic + le mémorise pour l'utilisateur
//   action="unsubscribe" → désabonne + oublie le jeton

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { TOPIC } = require("../../server/push");
const { setCors, parseBody } = require("../../server/http");

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, action, token } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  const cleanToken = typeof token === "string" ? token.trim().slice(0, 400) : "";
  if (!cleanToken) return res.status(400).json({ error: "Jeton manquant." });

  const admin = app();
  const key = safeKey(cleanToken);

  try {
    if (action === "subscribe") {
      await admin.messaging().subscribeToTopic([cleanToken], TOPIC);
      await admin.database().ref("push_tokens/" + user.uid + "/" + key).set({ token: cleanToken, at: Date.now() });
      return res.status(200).json({ ok: true });
    }
    if (action === "unsubscribe") {
      await admin.messaging().unsubscribeFromTopic([cleanToken], TOPIC).catch(() => {});
      await admin.database().ref("push_tokens/" + user.uid + "/" + key).remove();
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// Clé Firebase valide (le jeton FCM contient des caractères interdits : . # $ / [ ]).
function safeKey(v) { return String(v).replace(/[.#$/[\]]/g, "_").slice(0, 200); }
