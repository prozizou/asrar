// api/get-theme.js — Renvoie le tableau "theme_fondamental" (géomancie) à un
// utilisateur ABONNÉ. Le nœud est en lecture serveur uniquement : la géomancie
// passe obligatoirement par cette fonction (plus de lecture publique).
//
// Body (JSON) : { idToken }
//
// La géomancie (comme Al Qalam) est réservée au palier « 1 An / 45 000 FCFA »
// (PREMIUM_LEVEL) : identité vérifiée + palier suffisant, sinon 403.

const { verifyUser, getAccessLevel, PREMIUM_LEVEL } = require("../../server/access");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { reportError } = require("../../server/log");

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken } = parseBody(req);

  try {
    const user = await verifyUser(idToken);

    const level = await getAccessLevel(user);
    if (level < PREMIUM_LEVEL) {
      return res.status(403).json({ error: "Réservé au forfait 1 An (45 000 FCFA)." });
    }

    const snap = await app().database().ref("theme_fondamental").once("value");
    return res.status(200).json({ data: snap.val() });
  } catch (e) {
    if (!e.statusCode) await reportError("get-theme", e);
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
