// api/list-content.js — Renvoie les MÉTADONNÉES d'une liste (titre, image, points…)
// SANS jamais inclure le contenu payant (sirr / pdf). Auth requise (pas d'abonnement).
//
// Body (JSON) : { idToken, kind: "secret"|"book", cat? }
//   - kind="secret" exige "cat" parmi les configurations.
//   - kind="book"   ignore "cat".
//
// Lit Firestore (voir docs/FIRESTORE_SCHEMA.md) : "product" depuis la Phase 2
// de la migration, "secret"/"book"/"formation"/"verset"/"asma" depuis la
// Phase 3 — plus aucune lecture RTDB dans ce fichier.

const { verifyUser } = require("../../server/access");
const { app } = require("../../server/grant");
const { SOURCES } = require("../../server/sources");
const { setCors, parseBody } = require("../../server/http");
const { reportError } = require("../../server/log");
const { vendorKey } = require("../../lib/market");

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, kind, cat } = parseBody(req);
  const src = SOURCES[kind];
  if (!src) return res.status(400).json({ error: "Type de contenu inconnu." });
  if (src.cats && !src.cats.includes(cat))
    return res.status(400).json({ error: "Configuration inconnue." });

  try {
    await verifyUser(idToken); // identité requise (page réservée aux connectés)

    const snap = await app().firestore().collection(src.collection(cat)).get();
    const items = [];
    snap.forEach((doc) => {
      const v = doc.data() || {};
      const meta = { _key: doc.id };
      for (const k of Object.keys(v)) {
        if (!src.secretFields.includes(k)) meta[k] = v[k]; // on retire le contenu sensible
      }
      // Marché : identifiant de boutique STABLE calculé ici, où l'email brut
      // du document est encore disponible (il est retiré ci-dessus par
      // secretFields) — voir emailVendorKey()/vendorKey() dans lib/market.js.
      // Sans ça, le client retombe sur `uid`, qui peut changer d'un produit à
      // l'autre pour le même vendeur (compte recréé) et fait apparaître deux
      // cartes boutique pour la même boutique.
      if (kind === "product") meta.vendorKey = vendorKey(v);
      items.push(meta);
    });

    return res.status(200).json({ items });
  } catch (e) {
    if (!e.statusCode) await reportError("list-content", e, { kind, cat });
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
