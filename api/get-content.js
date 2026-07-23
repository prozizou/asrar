// api/get-content.js — Renvoie UN élément COMPLET (avec le contenu payant) UNIQUEMENT
// si l'utilisateur a un accès actif. C'est la vraie barrière du paywall.
//
// Body (JSON) : { idToken, kind: "secret"|"book", cat?, key }

const { verifyUser, hasActiveAccess } = require("./_lib/access");
const { app } = require("./_lib/grant");
const { SOURCES } = require("./_lib/sources");
const { setCors, parseBody } = require("./_lib/http");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, kind, cat, key } = parseBody(req);
  const src = SOURCES[kind];
  if (!src) return res.status(400).json({ error: "Type de contenu inconnu." });
  if (src.cats && !src.cats.includes(cat))
    return res.status(400).json({ error: "Configuration inconnue." });
  if (!key) return res.status(400).json({ error: "Élément non précisé." });

  try {
    const user = await verifyUser(idToken);

    // Le Marché (authOnly) ne demande PAS d'abonnement : l'achat = le prix du produit.
    if (!src.authOnly) {
      const ok = await hasActiveAccess(user);
      if (!ok) return res.status(403).json({ error: "Abonnement requis." });
    }

    const snap = await app().database().ref(src.ref(cat) + "/" + key).once("value");
    const item = snap.val();
    if (!item) return res.status(404).json({ error: "Élément introuvable." });

    // Champs privés (coordonnées vendeur) : jamais exposés au navigateur.
    // Le contact se fait via /api/wa?product=<clé> (redirection côté serveur).
    if (Array.isArray(src.privateFields) && item && typeof item === "object") {
      for (const f of src.privateFields) delete item[f];
    }

    item._key = key;
    return res.status(200).json({ item });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
