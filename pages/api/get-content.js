// api/get-content.js — Renvoie UN élément COMPLET (avec le contenu payant) UNIQUEMENT
// si l'utilisateur a un accès actif. C'est la vraie barrière du paywall.
//
// Body (JSON) : { idToken, kind: "secret"|"book", cat?, key }

const { verifyUser, hasActiveAccess, getAccessStatus } = require("../../server/access");
const { consumeAdPass } = require("../../server/adReward");
const { app } = require("../../server/grant");
const { getSource } = require("../../server/sources");
const { setCors, parseBody, isValidKey } = require("../../server/http");
const { reportError } = require("../../server/log");

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, kind, cat, key } = parseBody(req);
  const src = getSource(kind);
  if (!src || src.listOnly) return res.status(400).json({ error: "Type de contenu inconnu." });
  if (src.cats && !src.cats.includes(cat))
    return res.status(400).json({ error: "Configuration inconnue." });
  if (!isValidKey(key)) return res.status(400).json({ error: "Identifiant de contenu invalide." });

  try {
    const user = await verifyUser(idToken);

    // Le Marché (authOnly) ne demande PAS d'abonnement : l'achat = le prix du produit.
    let secretAccess = null;
    if (kind === 'secret') {
      const { access, settings } = require('../../server/secretPurchases');
      const mode = await settings(app().database(), user);
      secretAccess = mode.enabled ? await access(app().database(), user, cat, key, await getAccessStatus(user), mode) : { allowed: await hasActiveAccess(user), mode: 'subscription' };
    }
    const hasAccess = secretAccess ? secretAccess.allowed : src.authOnly || await hasActiveAccess(user);
    const snap = await app().database().ref(src.ref(cat) + "/" + key).once("value");
    const item = snap.val();
    if (!item || typeof item !== "object" || Array.isArray(item))
      return res.status(404).json({ error: "Élément introuvable." });

    if (!hasAccess && secretAccess?.mode === 'individual') {
      return res.status(403).json({ error: 'Achetez ce secret pour le débloquer.', code: 'SECRET_PURCHASE_REQUIRED' });
    }
    if (!hasAccess) {
      // Sans abonnement : passe à usage unique ouvert par une publicité
      // récompensée (server/adReward.js), consommé ici.
      const ok = await consumeAdPass(user.uid);
      if (!ok) return res.status(403).json({ error: "Abonnement requis." });
    }

    // Les produits ont un contrat public explicite : un nouveau champ privé
    // ou une structure imbriquée ne doit pas sortir automatiquement.
    const result = src.detailFields
      ? Object.fromEntries(src.detailFields.filter((field) => Object.prototype.hasOwnProperty.call(item, field)).map((field) => [field, item[field]]))
      : { ...item };
    if (Array.isArray(src.privateFields) && item && typeof item === "object") {
      for (const f of src.privateFields) delete result[f];
    }

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({ item: { ...result, _key: key } });
  } catch (e) {
    if (!e.statusCode) await reportError("get-content", e, { kind, cat, key });
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
