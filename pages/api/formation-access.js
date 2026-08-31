// api/formation-access.js — Minutes de visioconférence "Formation mystique" :
// accès INDÉPENDANT de l'abonnement (lib/plans.js SUB_PLANS/FREE_FOR_ALL ne
// couvrent pas ce module — décision explicite : abonné ou non, chacun paie ses
// minutes séparément). L'utilisateur réserve via WhatsApp (lib/whatsapp.js
// openFormationBooking) puis l'admin accorde manuellement le crédit dans
// admin-asrar-pro (formation_access/{formationKey}/{emailKey}, mêmes
// conventions que purchased_user — voir admin-asrar-pro/api/formation-access.js).
//
// Body (JSON) : { idToken, action: "check"|"join", key }
//   • "check" : lecture seule — minutes créditées pour CET utilisateur sur
//     CETTE formation (0 si aucune) — décide si on affiche "Rejoindre" ou le
//     réservateur de minutes (voir app/formation/page.tsx).
//   • "join"  : consomme le crédit (usage unique par réservation — l'admin
//     recrédite pour la session suivante) et renvoie le lien Google Meet +
//     les minutes accordées, pour le décompte visuel côté client. Google Meet
//     étant un service externe, AUCUNE minuterie ne peut réellement couper
//     l'appel : purement informatif (voir la décision utilisateur associée).

const { verifyUser, emailKey } = require("../../server/access");
const { app } = require("../../server/grant");
const { SOURCES } = require("../../server/sources");
const { setCors, parseBody } = require("../../server/http");
const { reportError } = require("../../server/log");

const MEET_FALLBACK = "https://meet.google.com/new";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, action, key } = parseBody(req);
  if (!key) return res.status(400).json({ error: "Formation non précisée." });
  if (action !== "check" && action !== "join")
    return res.status(400).json({ error: "Action inconnue." });

  try {
    const user = await verifyUser(idToken);
    const db = app().database();
    const gRef = db.ref("formation_access/" + key + "/" + emailKey(user.email));

    if (action === "check") {
      const snap = await gRef.once("value");
      const v = snap.val();
      const minutes = v && Number(v.minutes) > 0 ? Number(v.minutes) : 0;
      return res.status(200).json({ minutes });
    }

    // action === "join" : consomme le crédit de façon atomique (un double-clic
    // ne doit pas "rejoindre" deux fois avec le même grant).
    let minutesAtStart = 0;
    await gRef.transaction((cur) => {
      minutesAtStart = cur && Number(cur.minutes) > 0 ? Number(cur.minutes) : 0;
      if (minutesAtStart <= 0) return cur;
      return { ...cur, minutes: 0, consumedAt: Date.now() };
    });
    if (minutesAtStart <= 0) {
      return res.status(403).json({
        error: "Aucune minute de visioconférence disponible pour cette formation. Réservez d'abord via WhatsApp.",
      });
    }

    const linkSnap = await db.ref(SOURCES.formation.ref() + "/" + key + "/meetLink").once("value");
    const meetLink = linkSnap.val() || MEET_FALLBACK;
    return res.status(200).json({ meetLink, minutes: minutesAtStart });
  } catch (e) {
    if (!e.statusCode) await reportError("formation-access", e, { key, action });
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
