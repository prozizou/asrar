// api/check-access.js (Vercel) — Vérification d'accès (paywall) CÔTÉ SERVEUR,
// via HTTPS (fetch classique), PAS via le SDK client Firebase Realtime
// Database (get() sur `db` — lib/firebase.js).
//
// Pourquoi ce détour : le SDK client RTDB ouvre un WebSocket direct vers
// Firebase (s-*.firebaseio.com) depuis le NAVIGATEUR de l'utilisateur. Sur
// certains réseaux (proxy/pare-feu d'entreprise, certains opérateurs mobiles,
// extensions de blocage), ce WebSocket — et son repli en long-polling — reste
// EN ATTENTE sans jamais aboutir ni échouer, même avec une connexion par
// ailleurs rapide (le symptôme n'est pas la vitesse mais un blocage silencieux
// du canal Firebase spécifiquement) : ensureAccess() (AccessProvider) finissait
// alors systématiquement sur « Connexion trop lente » après les 15 s de délai
// de lib/access.js, quelle que soit la qualité réelle de la connexion.
//
// /api/orders, /api/track, etc. utilisent déjà un simple POST HTTPS vers ce
// même domaine (apiPost, lib/api.js) et fonctionnaient, eux, sans ce
// symptôme — d'où le choix de faire transiter aussi la vérification d'accès
// par ce canal, déjà robuste (délai + AbortController côté client), plutôt
// que par le SDK RTDB client. La lecture réelle reste côté Admin SDK
// (server/access.js), donc aucune règle de sécurité RTDB n'est affaiblie.
//
// Body (JSON) : { idToken } → { allowed, admin, vip, level, purchase, expiresAt }
// (même forme que checkAccess() côté client, lib/access.js).

const { verifyUser, getAccessStatus } = require("../../server/access");
const { setCors, parseBody } = require("../../server/http");
const { reportError } = require("../../server/log");

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  try {
    const status = await getAccessStatus(user);
    // Infinity n'est pas sérialisable en JSON (devient null) : converti en
    // grand entier fini, comme le fait déjà lib/access.js côté client (999999).
    const level = status.level === Infinity ? 999999 : status.level;
    return res.status(200).json({ ...status, level });
  } catch (e) {
    await reportError("check-access", e, { uid: user.uid });
    return res.status(500).json({ error: e.message });
  }
};
