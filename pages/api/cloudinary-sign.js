// api/cloudinary-sign.js — Signature d'upload Cloudinary.
// Deux voies d'autorisation, SÉPARÉES :
//   1. Vendeur ACTIF / propriétaire d'une boutique "profil" → dossiers
//      produits/boutique (comportement historique, inchangé).
//   2. Membre d'un zikr collectif → dossier "zikr_chat", pour joindre une
//      image ou un vocal à la discussion de groupe (app/zikr/page.tsx,
//      demandé explicitement) — gardé DISTINCT de la voie vendeur : un
//      membre de zikr n'a aucune raison d'être vendeur, et inversement.
// Dans les deux cas, le secret Cloudinary ne quitte jamais le serveur.
//
// Body (JSON) : { idToken, folder?, groupId? } → { cloudName, apiKey,
//   timestamp, signature, folder, uploadPreset? }
// `groupId` n'est lu (et exigé) que pour folder="zikr_chat".

const crypto = require("crypto");
const { verifyUser } = require("../../server/access");
const { isActiveSeller, getBoutiqueByEmail } = require("../../server/sellers");
const { app } = require("../../server/grant");
const { setCors, parseBody } = require("../../server/http");
const { rateLimit } = require("../../lib/rateLimit");

// Une signature = un upload potentiel : limite le nombre de signatures qu'un
// compte peut obtenir par minute (l'upload réel se fait ensuite directement
// vers Cloudinary, hors de notre contrôle — cf. limite documentée plus bas).
const RATE_LIMIT = { max: 20, windowMs: 60_000 };

// Même sanitisation de clé que pages/api/zikr.js (safeKey) — un groupId sert
// ici à composer un chemin RTDB (vérification de membre) puis un dossier
// Cloudinary, jamais affiché ni interprété autrement.
function safeKey(v) { return (v == null ? "" : String(v)).replace(/[.#$/[\]]/g, "").slice(0, 64); }

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, folder, groupId, mediaType = "image" } = parseBody(req);
  if (mediaType !== "image" && mediaType !== "video") {
    return res.status(400).json({ error: "Type de fichier non autorisé." });
  }

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  const base = String(folder || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  const isZikrChat = base === "zikr_chat";
  if (!isZikrChat && mediaType !== "image") {
    return res.status(400).json({ error: "Seules les images sont autorisées pour la boutique." });
  }
  let safeFolder;

  if (isZikrChat) {
    // Voie « membre de zikr collectif » — namespacé par GROUPE puis par
    // compte (zikr_chat/{gid}/{uid}), pas seulement par compte : un fichier
    // reste tracé jusqu'à sa discussion de groupe d'origine.
    const gid = safeKey(groupId);
    if (!gid) return res.status(400).json({ error: "Groupe manquant." });
    const memSnap = await app().database().ref("zikr_members/" + gid + "/" + user.uid).once("value");
    if (!memSnap.exists()) {
      return res.status(403).json({ error: "Rejoignez d'abord ce zikr collectif." });
    }
    safeFolder = `zikr_chat/${gid}/${user.uid}`;
  } else {
    // Voie historique : réservée à un vendeur ACTIF ou au propriétaire d'une
    // boutique "profil" — avant cette vérification, N'IMPORTE QUEL compte
    // connecté (même sans boutique) pouvait obtenir une signature et
    // uploader vers le compte Cloudinary de l'app (revue de sécurité). Même
    // double voie d'autorisation que pages/api/shop.js (canManage).
    const [activeSeller, boutique] = await Promise.all([
      isActiveSeller(user.uid),
      getBoutiqueByEmail(user.email),
    ]);
    if (!activeSeller && !boutique) {
      return res.status(403).json({ error: "Boutique inactive : impossible d'envoyer une image." });
    }
    // On restreint le dossier à une petite liste blanche, puis on le
    // NAMESPACE avec l'uid : chaque utilisateur ne peut écrire que sous son
    // propre préfixe. Les uploads restent ainsi tracés et cloisonnés (limite
    // l'abus de stockage).
    const allowed = new Set(["asrar_uploads", "shop_logos", "products", "logos", "produits", "boutique"]);
    const rootFolder = allowed.has(base) ? base : "asrar_uploads";
    safeFolder = `${rootFolder}/${user.uid}`;
  }

  if (!rateLimit("cloudinary-sign:" + user.uid, RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return res.status(429).json({ error: "Trop de demandes d'upload, réessayez dans une minute." });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ error: "Cloudinary non configuré (variables d'environnement manquantes)." });
  }

  // Les limites doivent être définies dans un preset signé. Images et
  // vocaux utilisent des politiques distinctes ; sans preset, aucun upload.
  const uploadPreset = mediaType === "video"
    ? process.env.CLOUDINARY_AUDIO_UPLOAD_PRESET
    : process.env.CLOUDINARY_IMAGE_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!uploadPreset) {
    return res.status(503).json({ error: "L'envoi de ce type de fichier est temporairement indisponible." });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  // Paramètres signés triés par ordre alphabétique de clé (exigence Cloudinary).
  const toSign = `folder=${safeFolder}&timestamp=${timestamp}&upload_preset=${uploadPreset}`;
  const signature = crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");

  return res.status(200).json({
    cloudName, apiKey, timestamp, signature, folder: safeFolder,
    uploadPreset,
  });
};
