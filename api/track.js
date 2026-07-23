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
  const safePage = clean(page, 80);
  const kind = clean(type, 24) || "visit";

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
        lat: coord(lat, -90, 90), lng: coord(lng, -180, 180), city: clean(city, 80)
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
// Champ libre journalisé PUIS affiché dans le tableau de bord admin : on retire
// les caractères d'évasion HTML (chevrons, quotes, backtick, esperluette) pour
// qu'aucune valeur stockée ne puisse porter une XSS vers l'admin.
function clean(v, max) { return str(v, max).replace(/[<>"'`&]/g, " ").trim(); }
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
// Coordonnée bornée : rejette les valeurs hors [min,max] (protège le dashboard).
function coord(v, min, max) { const n = parseFloat(v); return (Number.isFinite(n) && n >= min && n <= max) ? n : null; }
