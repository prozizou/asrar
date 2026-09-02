// server/cronAuth.js — Autorisation partagée des endpoints /api/cron/* :
// déclenchés par un planificateur externe (Vercel Cron ou tout service de
// cron capable d'appeler une URL avec un en-tête), jamais par un utilisateur
// — pas de jeton Firebase, protection par secret partagé uniquement. Extrait
// de pages/api/cron/planet-push.js (seul appelant jusqu'ici) pour que
// pages/api/cron/reminders.js applique EXACTEMENT la même vérification, sans
// dupliquer une logique sensible à la sécurité.
const crypto = require("crypto");

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // pas configuré → jamais déclenché (sécurité par défaut, pas par omission)
  const header = (req.headers && req.headers.authorization) || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = (req.query && req.query.secret) || "";
  // Comparaison à temps constant : évite qu'une différence de timing sur une
  // comparaison naïve (===) ne fuite des informations sur le secret attendu.
  return safeEqual(bearer, secret) || safeEqual(String(query), secret);
}

module.exports = { authorized };
