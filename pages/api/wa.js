// api/wa.js (Vercel) — Redirection WhatsApp avec NUMÉRO côté serveur.
//
// Deux usages, le numéro n'apparaît JAMAIS dans le code ni dans les données
// livrées au navigateur :
//
//   • Plateforme :  /api/wa?text=<message>
//       → lit la variable d'environnement WHATSAPP_NUMBER et redirige (302).
//
//   • Vendeur du Marché :  /api/wa?order=<id>&token=<jeton>
//       → uniquement pour une commande existante, avec son jeton à durée
//         limitée (le numéro du vendeur n'est jamais lisible sans commande).

const { app } = require("../../server/grant");
const crypto = require("node:crypto");
const { orderWhatsAppMessage } = require('../../lib/whatsappMessages');


function htmlMessage(res, status, msg) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end("<meta charset='utf-8'><p style='font-family:system-ui;padding:24px'>" + msg + "</p>");
}

export default async function handler(req, res) {
  if (req.method !== "GET") return htmlMessage(res, 405, "Méthode non autorisée.");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.query?.order) {
    const id = req.query.order, token = req.query.token;
    if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id) || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      return htmlMessage(res, 400, "Lien de contact invalide. Revenez à vos demandes.");
    }
    try {
      const ref = app().database().ref("orders_v2/" + id);
      const order = (await ref.once("value")).val();
      if (!order?._private?.contactToken || order.status === "cancelled" || order._private.contactUntil < Date.now() ||
          !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(order._private.contactToken))) {
        return htmlMessage(res, 403, "Ce lien a expiré. Ouvrez Mes commandes pour recontacter la boutique.");
      }
      const at = Date.now();
      await ref.transaction((current) => {
        if (!current) return null;
        if (current._private?.contactToken !== token || current.status === "cancelled" || current._private.contactUntil < at) return;
        return { ...current, contactOpenedAt: current.contactOpenedAt || at };
      }).then((result) => { if (!result.committed || !result.snapshot.exists()) throw new Error("Contact changé"); });
      const message = orderWhatsAppMessage(order, id);
      return sendWhatsApp(req, res, whatsappUrl(order._private.phone, message));
    } catch { return htmlMessage(res, 503, "Le contact est temporairement indisponible. Réessayez depuis vos demandes."); }
  }
  const q = (req.query && typeof req.query.text === "string") ? req.query.text : "";
  const text = q.slice(0, 1500); // garde-fou longueur

  // Contact de la PLATEFORME uniquement (numéro global). L'ancien
  // ?product=<clé> renvoyait le numéro d'un vendeur à n'importe qui, sans
  // connexion : les clés produit étant publiques, tous les numéros pouvaient
  // être aspirés. Le contact d'un vendeur passe désormais par une commande
  // (?order=…&token=…, jeton à durée limitée, ci-dessus).
  if (req.query && req.query.product) {
    return htmlMessage(res, 410, "Ce lien n'est plus valable. Ouvrez le produit dans l'application pour contacter la boutique.");
  }
  const number = String(process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "");
  if (!number) {
    return htmlMessage(res, 500,
      "Le contact de l'assistance est temporairement indisponible. Réessayez plus tard.");
  }

  return sendWhatsApp(req, res, whatsappUrl(number, text));
};

// Adresse WhatsApp directe (api.whatsapp.com/send), PAS wa.me : la redirection
// de wa.me remplace les emojis du message (🌙, 📦…) par « � » (U+FFFD).
function whatsappUrl(phone, text) {
  return "https://api.whatsapp.com/send?phone=" + String(phone).replace(/\D/g, "") + (text ? "&text=" + encodeURIComponent(text) : "");
}

// Redirection vers WhatsApp, ou, avec format=json, l'adresse elle-même :
// l'application Android (WebView) ne peut pas ouvrir de nouvelle fenêtre ;
// elle demande l'adresse puis la confie à Android (lib/externalWindow.js).
// Le numéro n'est pas plus exposé que par la redirection elle-même.
function sendWhatsApp(req, res, url) {
  res.setHeader("Cache-Control", "no-store");
  if (req.query?.format === "json") return res.status(200).json({ url });
  res.statusCode = 302;
  res.setHeader("Location", url);
  return res.end();
}
