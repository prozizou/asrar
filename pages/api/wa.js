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

const { app } = require("../../server/grant");
const crypto = require("node:crypto");

// Clé produit Firebase : alphanumérique + - _ uniquement.
function safeKey(v) { return String(v == null ? "" : v).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64); }

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
      const message = `Assalamou aleykoum. Je souhaite vérifier la disponibilité de ${order.produit} auprès de ${order.vendeur}.\nPrix affiché : ${order.prix} ${order.devise}.\nRéférence : ${id}.\nMerci de confirmer la disponibilité, le paiement et la livraison. Cette demande ne confirme aucun achat.`;
      res.statusCode = 302;
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Location", "https://wa.me/" + order._private.phone + "?text=" + encodeURIComponent(message));
      return res.end();
    } catch { return htmlMessage(res, 503, "Le contact est temporairement indisponible. Réessayez depuis vos demandes."); }
  }
  const q = (req.query && typeof req.query.text === "string") ? req.query.text : "";
  const text = q.slice(0, 1500); // garde-fou longueur

  const productKey = safeKey(req.query && req.query.product);
  let number = "";

  if (productKey) {
    // — Contact d'un VENDEUR : numéro lu côté serveur, jamais exposé au client —
    try {
      const db = app().database();
      const snap = await db.ref("det_produits/" + productKey + "/number").once("value");
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
        "Le contact de l'assistance est temporairement indisponible. Réessayez plus tard.");
    }
  }

  const url = "https://wa.me/" + number + (text ? "?text=" + encodeURIComponent(text) : "");

  res.statusCode = 302;
  res.setHeader("Location", url);
  res.setHeader("Cache-Control", "no-store");
  res.end();
};
