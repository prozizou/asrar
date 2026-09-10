// api/cron/geomancie-retention.js — Purge des logs de géolocalisation
// géomancie (collection Firestore geomancie_logs = { uid, email, at, lat,
// lng, city } — voir pages/api/track.js) au-delà d'une durée de conservation
// définie.
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
//
// MIGRATION FIRESTORE (Phase 6, voir docs/FIRESTORE_SCHEMA.md) : geomancie_logs
// est une collection Firestore depuis pages/api/track.js — purge par requête
// + suppression par lots plutôt qu'un `update()` multi-chemins RTDB.

const { app } = require("../../../server/grant");
const { reportError } = require("../../../server/log");
const { authorized } = require("../../../server/cronAuth");

// 90 jours : assez pour les statistiques d'usage (répartition géographique
// sur un trimestre), sans garder une trace individuelle indéfiniment.
const RETENTION_DAYS = 90;
// Limite d'écriture d'un batch Firestore (500) — même marge de sécurité que
// scripts/migrate-to-firestore.js (MAX_BATCH).
const BATCH_SIZE = 400;

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Non autorisé." });

  const firestore = app().firestore();
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  try {
    let removed = 0;
    // Purge par lots : une requête filtrée par `at` (index simple, aucun
    // index composite requis) puis suppression en lots de BATCH_SIZE,
    // répétée jusqu'à ce qu'il n'y ait plus rien à retirer sous le seuil —
    // au cas où le nombre d'entrées expirées dépasse la taille d'un lot.
    for (;;) {
      const snap = await firestore.collection("geomancie_logs").where("at", "<=", cutoff).limit(BATCH_SIZE).get();
      if (snap.empty) break;
      const batch = firestore.batch();
      snap.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      removed += snap.size;
      if (snap.size < BATCH_SIZE) break;
    }

    return res.status(200).json({ ok: true, removed, cutoff });
  } catch (e) {
    await reportError("cron:geomancie-retention", e);
    return res.status(500).json({ error: e.message });
  }
}
