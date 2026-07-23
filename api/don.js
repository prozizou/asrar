// api/don.js (Vercel) — DON DE SECRET : un utilisateur propose un secret.
//
// La proposition n'est PAS publiée directement : elle est écrite (Admin SDK)
// dans le nœud `don_db`, en statut "pending". Une application d'administration
// séparée la repère ensuite pour la VALIDER (publication dans db_sirr_<cat>) ou
// la RÉVOQUER. L'écriture passe par le serveur pour : identité vérifiée (jeton),
// validation des champs, catégorie en liste blanche et anti-spam.
//
// Body (JSON) : { idToken, cat, faida, sirr }
//   cat   : une des catégories de secrets (SECRET_CATS)
//   faida : titre du secret
//   sirr  : contenu du secret
//
// Écrit : don_db/{pushId} = { uid, email, cat, faida, sirr, status:"pending", at }

const { verifyUser } = require("./_lib/access");
const { app } = require("./_lib/grant");
const { SECRET_CATS } = require("./_lib/sources");
const { setCors, parseBody } = require("./_lib/http");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, cat, faida, sirr } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!SECRET_CATS.includes(cat)) {
    return res.status(400).json({ error: "Catégorie invalide." });
  }
  const titre   = str(faida, 200);
  const contenu = str(sirr, 8000);
  if (titre.length < 3)     return res.status(400).json({ error: "Le titre du secret est requis." });
  if (contenu.length < 10)  return res.status(400).json({ error: "Le contenu du secret est trop court." });

  const db = app().database();
  try {
    // Anti-spam : un envoi par utilisateur toutes les 60 secondes.
    const metaRef = db.ref("don_meta/" + user.uid + "/lastAt");
    const last = (await metaRef.once("value")).val() || 0;
    const now = Date.now();
    if (now - last < 60000) {
      return res.status(429).json({ error: "Patientez une minute avant de proposer un autre secret." });
    }

    await db.ref("don_db").push({
      uid:    user.uid,
      email:  user.email,
      cat,
      faida:  titre,
      sirr:   contenu,
      status: "pending",
      at:     now
    });
    await metaRef.set(now);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

function str(v, max) { return (v == null ? "" : String(v)).trim().slice(0, max || 200); }
