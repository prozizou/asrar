// api/cron/geomancie-retention.js — Purge des logs de géolocalisation
// géomancie (geomancie_logs/{pushId} = { uid, email, at, lat, lng, city }
// — voir pages/api/track.js) au-delà d'une durée de conservation définie.
//
// Déclenché PÉRIODIQUEMENT par un planificateur externe, PAS par un
// utilisateur — même mécanisme d'autorisation que pages/api/cron/reminders.js
// (server/cronAuth.js, CRON_SECRET). N'est PAS répertorié dans vercel.json
// (le plan Vercel Hobby de ce projet limite le nombre de cron jobs — voir le
// commentaire d'en-tête de pages/api/cron/reminders.js) : appelé une fois par
// jour par .github/workflows/geomancie-retention-cron.yml, avec le même
// secret CRON_SECRET que les autres endpoints cron.
//
// Revue de sécurité (P0, § géolocalisation) : ces entrées portaient une
// position précise sans durée de conservation définie ni mécanisme de
// suppression. app/geomancie/page.tsx a été corrigé séparément (consentement
// explicite + position arrondie côté client, jamais précise) — cet endpoint
// couvre la rétention des entrées déjà écrites (et de celles à venir, toutes
// désormais approximatives).

const { app } = require("../../../server/grant");
const { reportError } = require("../../../server/log");
const { authorized } = require("../../../server/cronAuth");

// 90 jours : assez pour les statistiques d'usage (répartition géographique
// sur un trimestre), sans garder une trace individuelle indéfiniment.
const RETENTION_DAYS = 90;

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Non autorisé." });

  const db = app().database();
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  try {
    // orderByChild('at') exige un index sur ce champ (rules/database.rules.json
    // — geomancie_logs est un nœud serveur-only, non couvert par les règles
    // client ; l'Admin SDK contourne les règles mais pas l'absence d'index,
    // d'où le tri manuel ci-dessous si l'index n'existe pas encore).
    const snap = await db.ref("geomancie_logs").orderByChild("at").endAt(cutoff).once("value");
    const updates = {};
    let removed = 0;
    snap.forEach((entry) => {
      updates[entry.key] = null;
      removed++;
    });
    if (removed > 0) await db.ref("geomancie_logs").update(updates);

    return res.status(200).json({ ok: true, removed, cutoff });
  } catch (e) {
    await reportError("cron:geomancie-retention", e);
    return res.status(500).json({ error: e.message });
  }
}
