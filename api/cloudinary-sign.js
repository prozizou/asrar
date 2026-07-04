// api/cloudinary-sign.js — Signature d'upload Cloudinary pour un utilisateur CONNECTÉ.
// Permet à un vendeur / propriétaire de boutique d'envoyer une image (logo, produit)
// directement depuis son téléphone. Le secret Cloudinary ne quitte jamais le serveur.
//
// Body (JSON) : { idToken, folder? } → { cloudName, apiKey, timestamp, signature, folder }

const crypto = require("crypto");
const { verifyUser } = require("./_lib/access");
const { setCors, parseBody } = require("./_lib/http");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, folder } = parseBody(req);
  try { await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ error: "Cloudinary non configuré (variables d'environnement manquantes)." });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const safeFolder = String(folder || "asrar_uploads").replace(/[^a-zA-Z0-9_\/-]/g, "_").slice(0, 80);
  const toSign = `folder=${safeFolder}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");

  return res.status(200).json({ cloudName, apiKey, timestamp, signature, folder: safeFolder });
};
