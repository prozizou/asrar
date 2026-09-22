// lib/planetAlarms.js — Logique PURE de planification des alarmes d'heure
// planétaire (aucun accès Capacitor/RTDB/réseau, testée sans mock). Consommée
// par lib/planetAlarmsNative.js, qui appelle @capacitor/local-notifications
// avec les valeurs calculées ici.
//
// Portée de cette tranche : cocher une heure programme UNE alarme ponctuelle
// pour SON occurrence du jour, à l'heure exacte de début — pas de délai avant
// (« 5/10/15 min avant »), pas de répétition, pas de choix de sonnerie : ces
// réglages restent une tranche ultérieure (revue produit du 2026-09-22, feuille
// « Me prévenir / Sonnerie / Répéter »). Le canal Android « heure_planetaire »
// (lib/pushChannels.js, déjà avec son propre son) couvre déjà la sonnerie/
// vibration par défaut.

// Identifiant STABLE et déterministe pour une occurrence (planète + instant de
// début) — @capacitor/local-notifications exige un entier 32 bits (Android),
// donc un simple hash plutôt que l'horodatage brut (déborderait). Même
// planète + même instant → même id, ce qui rend l'activation idempotente
// (cocher deux fois ne programme pas deux alarmes) et permet de retrouver
// l'état "programmée ?" d'une ligne via LocalNotifications.getPending().
export function alarmIdFor(planet, startMs) {
  const key = planet + ':' + startMs;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0; // |0 : reste un int32 signé
  }
  // Ramené en positif et sous 2^31-1 (borne haute Android) : (hash % N + N) % N
  // gère aussi bien un hash négatif qu'un hash déjà positif.
  const MAX = 2147483647;
  return ((hash % MAX) + MAX) % MAX;
}

// Une occurrence déjà entamée ou passée ne peut plus être programmée —
// LocalNotifications.schedule() sur un instant déjà passé se déclenche
// immédiatement (comportement surprenant pour un clic sur une ligne passée).
export function isSchedulable(startMs, nowMs) {
  return startMs > nowMs;
}

// Titre/corps de la notification système, format demandé par la revue
// produit (emoji + planète, nature, intervalle) :
//   ♃ Jupiter commence maintenant
//   Très favorable · 22:47 – 23:46
export function buildAlarmContent({ planet, emoji, natTxt, interval }) {
  return {
    title: `${emoji} ${planet} commence maintenant`,
    body: `${natTxt} · ${interval}`,
  };
}
