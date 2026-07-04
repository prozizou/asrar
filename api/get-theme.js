// api/get-theme.js — Renvoie le tableau "theme_fondamental" (géomancie) à un
// utilisateur ABONNÉ. Le nœud est en lecture serveur uniquement : la géomancie
// passe obligatoirement par cette fonction (plus de lecture publique).
//
// Body (JSON) : { idToken }
//
// La géomancie est désormais réservée aux abonnés (même barrière que get-content) :
// identité vérifiée + abonnement actif, sinon 403.

const { verifyUser, hasActiveAccess } = require("./_lib/access");
const { app } = require("./_lib/grant");
const { setCors, parseBody } = require("./_lib/http");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken } = parseBody(req);

  try {
    const user = await verifyUser(idToken);

    const ok = await hasActiveAccess(user);
    if (!ok) return res.status(403).json({ error: "Abonnement requis." });

    const snap = await app().database().ref("theme_fondamental").once("value");
    return res.status(200).json({ data: snap.val() });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
