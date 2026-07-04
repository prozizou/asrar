// api/list-content.js — Renvoie les MÉTADONNÉES d'une liste (titre, image, points…)
// SANS jamais inclure le contenu payant (sirr / pdf). Auth requise (pas d'abonnement).
//
// Body (JSON) : { idToken, kind: "secret"|"book", cat? }
//   - kind="secret" exige "cat" parmi les configurations.
//   - kind="book"   ignore "cat".

const { verifyUser } = require("./_lib/access");
const { app } = require("./_lib/grant");
const { SOURCES } = require("./_lib/sources");
const { setCors, parseBody } = require("./_lib/http");

module.exports = async (req, res) => {
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

    const snap = await app().database().ref(src.ref(cat)).once("value");
    const items = [];
    snap.forEach(child => {
      const v = child.val() || {};
      const meta = { _key: child.key };
      for (const k of Object.keys(v)) {
        if (!src.secretFields.includes(k)) meta[k] = v[k]; // on retire le contenu sensible
      }
      items.push(meta);
    });

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
