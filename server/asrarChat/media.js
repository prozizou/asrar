// server/asrarChat/media.js — Stockage des fichiers Asrar-chat sur Cloudinary.
//
// Deux espaces par compte, imposés par la signature d'envoi (le navigateur
// ne peut changer ni le dossier ni le type) :
//   • ac/{uid}/private/… — type « private » : contenus payants et médias des
//     discussions. Jamais d'URL publique : le serveur délivre, à chaque
//     lecture autorisée, un lien de téléchargement SIGNÉ qui expire
//     (api.cloudinary.com/…/download?…&expires_at=…).
//   • ac/{uid}/public/…  — photos de profil, de groupe et aperçus FLOUTÉS
//     des contenus payants (le flou est appliqué dans le navigateur AVANT
//     l'envoi : les pixels nets d'un contenu payant ne sont jamais publics).
const crypto = require("crypto");
const { URLSearchParams } = require("url");
const { UPLOAD_FORMATS, assetKind } = require("../../lib/asrarChat/logic");

// Durée de validité d'un lien de lecture d'un média privé.
const PRIVATE_URL_TTL_S = 15 * 60;

function config() {
  const read = (name) => String(process.env[name] || "").trim();
  return {
    cloudName: read("CLOUDINARY_CLOUD_NAME"),
    apiKey: read("CLOUDINARY_API_KEY"),
    apiSecret: read("CLOUDINARY_API_SECRET"),
  };
}

function sign(params, secret) {
  const payload = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${Array.isArray(params[k]) ? params[k].join(",") : params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(payload + secret).digest("hex");
}

/**
 * Paramètres d'envoi signés. `visibility` : "private" | "public" ; `rt` :
 * "image" | "video" | "raw" (l'audio est un « video » chez Cloudinary).
 */
function signUpload(uid, visibility, rt) {
  const { cloudName, apiKey, apiSecret } = config();
  if (!cloudName || !apiKey || !apiSecret) {
    throw Object.assign(new Error("L'envoi de fichiers n'est pas activé pour le moment. Contactez l'administration."), { statusCode: 503, code: "UPLOAD_NOT_CONFIGURED" });
  }
  const params = {
    allowed_formats: UPLOAD_FORMATS[rt].join(","),
    folder: `ac/${uid}/${visibility}`,
    timestamp: Math.floor(Date.now() / 1000),
    type: visibility === "private" ? "private" : "upload",
  };
  return { cloudName, apiKey, resourceType: rt, ...params, signature: sign(params, apiSecret) };
}

/** URL publique (dossier public uniquement), avec transformation optionnelle. */
function publicUrl(asset, transform = "") {
  if (!asset || !asset.id) return "";
  const { cloudName } = config();
  const cloud = cloudName || "asrar";
  const ext = asset.rt !== "raw" && asset.fmt ? "." + asset.fmt : "";
  return `https://res.cloudinary.com/${cloud}/${asset.rt}/upload/${transform ? transform + "/" : ""}${asset.id}${ext}`;
}

/** Lien signé et temporaire vers un média privé (lecture autorisée seulement). */
function privateUrl(asset, { attachment = false, ttl = PRIVATE_URL_TTL_S } = {}) {
  if (!asset || !asset.id) return "";
  const { cloudName, apiKey, apiSecret } = config();
  const cloud = cloudName || "asrar";
  const params = {
    attachment: attachment ? "true" : undefined,
    expires_at: Math.floor(Date.now() / 1000) + ttl,
    format: asset.rt === "raw" ? undefined : asset.fmt || undefined,
    public_id: asset.id,
    timestamp: Math.floor(Date.now() / 1000),
    type: "private",
  };
  const signature = sign(params, apiSecret);
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) query.set(k, String(v));
  query.set("api_key", apiKey);
  query.set("signature", signature);
  return `https://api.cloudinary.com/v1_1/${cloud}/${asset.rt}/download?${query.toString()}`;
}

/** Pièce jointe privée telle que renvoyée au client autorisé. */
function deliver(asset) {
  if (!asset) return null;
  const out = { kind: assetKind(asset), url: privateUrl(asset), name: asset.name || "", fmt: asset.fmt || "", bytes: asset.bytes || 0 };
  if (asset.duration) out.duration = asset.duration;
  if (asset.w && asset.h) { out.w = asset.w; out.h = asset.h; }
  if (asset.rt === "raw") out.download = privateUrl(asset, { attachment: true });
  return out;
}

module.exports = { signUpload, publicUrl, privateUrl, deliver, PRIVATE_URL_TTL_S };
