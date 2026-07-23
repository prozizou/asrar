// api/wa.js (Vercel) — Redirection WhatsApp avec NUMÉRO côté serveur.
//
// Deux usages, le numéro n'apparaît JAMAIS dans le code ni dans les données
// livrées au navigateur :
//
//   • Plateforme :  /api/wa?text=<message>
//       → lit la variable d'environnement WHATSAPP_NUMBER et redirige (302).
//
//   • Vendeur du Marché :  /api/wa?product=<cléProduit>&text=<message>
//       → lit det_produits/<clé>.number via l'Admin SDK (ce champ n'est jamais
//         renvoyé au client par /api/get-content) et redirige vers le WhatsApp
//         du vendeur. Les coordonnées des vendeurs ne sont donc plus exposées.

const { app } = require("./_lib/grant");

// Clé produit Firebase : alphanumérique + - _ uniquement.
function safeKey(v) { return String(v == null ? "" : v).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64); }

function htmlMessage(res, status, msg) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end("<meta charset='utf-8'><p style='font-family:system-ui;padding:24px'>" + msg + "</p>");
}

module.exports = async (req, res) => {
  const q = (req.query && typeof req.query.text === "string") ? req.query.text : "";
  const text = q.slice(0, 1500); // garde-fou longueur

  const productKey = safeKey(req.query && req.query.product);
  let number = "";

  if (productKey) {
    // — Contact d'un VENDEUR : numéro lu côté serveur, jamais exposé au client —
    try {
      const snap = await app().database().ref("det_produits/" + productKey + "/number").once("value");
      number = String(snap.val() || "").replace(/\D/g, "");
    } catch (e) {
      return htmlMessage(res, 500, "Service indisponible, réessayez plus tard.");
    }
    if (!number) {
      return htmlMessage(res, 404, "Le numéro WhatsApp de la boutique n'est pas disponible.");
    }
  } else {
    // — Contact de la PLATEFORME : numéro global (variable d'environnement) —
    number = String(process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "");
    if (!number) {
      return htmlMessage(res, 500,
        "⚙️ Configuration manquante : définissez la variable d'environnement " +
        "<b>WHATSAPP_NUMBER</b> dans Vercel (Settings → Environment Variables), puis redéployez.");
    }
  }

  const url = "https://wa.me/" + number + (text ? "?text=" + encodeURIComponent(text) : "");

  res.statusCode = 302;
  res.setHeader("Location", url);
  res.setHeader("Cache-Control", "no-store");
  res.end();
};
