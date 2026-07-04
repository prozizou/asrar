// api/track.js (Vercel) — Journalisation légère pour le tableau de bord admin.
//
// Body (JSON) : { idToken, type, page?, lat?, lng?, city? }
//   type="visit"     → comptage de visite (page) + fil d'activité
//   type="geomancie" → log géomancie AVEC localisation (lat/lng) + activité
//   (autre)          → événement générique dans le fil d'activité
//
// Écrit (Admin SDK, nœuds serveur-only) :
//   analytics/visits/{YYYY-MM-DD}/{uid} = { n, last, email }
//   activity_feed/{pushId}             = { uid, email, type, page, at }
//   geomancie_logs/{pushId}            = { uid, email, at, lat, lng, city }

const { verifyUser } = require("./_lib/access");
const { app } = require("./_lib/grant");
const { setCors, parseBody } = require("./_lib/http");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, type, page, lat, lng, city } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  const db = app().database();
  const now = Date.now();
  const date = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const safePage = str(page, 80);
  const kind = str(type, 24) || "visit";

  try {
    // 1) Compteur de visite (unique par utilisateur et par jour, + total via n).
    const vref = db.ref("analytics/visits/" + date + "/" + user.uid);
    await vref.child("n").transaction((c) => (c || 0) + 1);
    await vref.update({ last: now, email: user.email });

    // 2) Fil d'activité global (les N dernières actions visibles côté admin).
    await db.ref("activity_feed").push({ uid: user.uid, email: user.email, type: kind, page: safePage, at: now });

    // 3) Géomancie : log avec localisation si fournie.
    if (kind === "geomancie") {
      await db.ref("geomancie_logs").push({
        uid: user.uid, email: user.email, at: now,
        lat: num(lat), lng: num(lng), city: str(city, 80)
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    // Le tracking ne doit jamais casser l'expérience : on renvoie 200 malgré l'erreur.
    console.error("track:", e.message);
    return res.status(200).json({ ok: false });
  }
};

function str(v, max) { return (v == null ? "" : String(v)).trim().slice(0, max || 120); }
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
