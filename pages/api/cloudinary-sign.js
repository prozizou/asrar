// api/cloudinary-sign.js — Signature d'upload Cloudinary pour un utilisateur CONNECTÉ.
// Permet à un vendeur / propriétaire de boutique d'envoyer une image (logo, produit)
// directement depuis son téléphone. Le secret Cloudinary ne quitte jamais le serveur.
//
// Body (JSON) : { idToken, folder? } → { cloudName, apiKey, timestamp, signature, folder }

const crypto = require("crypto");
const { verifyUser } = require("../../server/access");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");

// Une signature = un upload potentiel : limite le nombre de signatures qu'un
// compte peut obtenir par minute (l'upload réel se fait ensuite directement
// vers Cloudinary, hors de notre contrôle — cf. limite documentée plus bas).
const RATE_LIMIT = { max: 20, windowMs: 60_000 };

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, folder } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!rateLimit("cloudinary-sign:" + user.uid, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(429).json({ error: "Trop de demandes d'upload, réessayez dans une minute." });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ error: "Cloudinary non configuré (variables d'environnement manquantes)." });
  }

  // On restreint le dossier à une petite liste blanche, puis on le NAMESPACE
  // avec l'uid : chaque utilisateur ne peut écrire que sous son propre préfixe.
  // Les uploads restent ainsi tracés et cloisonnés (limite l'abus de stockage).
  const base = String(folder || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  const allowed = new Set(["asrar_uploads", "shop_logos", "products", "logos", "produits", "boutique"]);
  const rootFolder = allowed.has(base) ? base : "asrar_uploads";
  const safeFolder = `${rootFolder}/${user.uid}`;

  // NOTE SÉCURITÉ : la signature ne peut pas contraindre `resource_type`
  // (dans l'URL). Pour un verrouillage complet du format/taille, configurez
  // côté Cloudinary un « upload preset » SIGNÉ (formats image uniquement,
  // taille max) et renseignez son nom dans CLOUDINARY_UPLOAD_PRESET — signé
  // ici et transmis à lib/cloudinary.js. Rien ne change si la variable est
  // absente (comportement historique conservé).
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || "";

  const timestamp = Math.floor(Date.now() / 1000);
  // Paramètres signés triés par ordre alphabétique de clé (exigence Cloudinary).
  const toSign = uploadPreset
    ? `folder=${safeFolder}&timestamp=${timestamp}&upload_preset=${uploadPreset}`
    : `folder=${safeFolder}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");

  return res.status(200).json({
    cloudName, apiKey, timestamp, signature, folder: safeFolder,
    uploadPreset: uploadPreset || undefined,
  });
};
