// lib/planetAlarms.js — Logique PURE de planification des alarmes d'heure
// planétaire (aucun accès Capacitor/RTDB/réseau, testée sans mock). Consommée
// par lib/planetAlarmsNative.js, qui appelle @capacitor/local-notifications
// avec les valeurs calculées ici.
//
// Réglages couverts (feuille « Me prévenir / Sonnerie / Répéter », revue
// produit du 2026-09-22) : délai avant l'heure, choix de sonnerie, vibration,
// répétition à chaque occurrence de la planète. Une occurrence PONCTUELLE
// (sans répétition) reste le comportement par défaut — voir DEFAULT_ALARM_PREFS.
//
// Contrainte Android RÉELLE qui façonne ce fichier : à partir d'Android 8,
// le son ET la vibration sont des propriétés du CANAL de notification, pas de
// la notification individuelle — impossible de les faire varier alarme par
// alarme sur un même canal (et un canal déjà créé est ensuite IMMUABLE côté
// app ; seul l'utilisateur peut le modifier depuis les réglages système). Une
// combinaison (son, vibration) = un canal DISTINCT, créé une fois pour
// toutes (voir planetAlarmChannels()) — pas un réglage appliqué à l'envoi.
// « Sonnerie système » n'est PAS « le son de notification par défaut
// d'Android » (ce champ ne sait pointer que vers un fichier de res/raw) :
// c'est un canal SANS son personnalisé, donc silencieux tant qu'aucun
// fichier n'y est associé — même limite que les fichiers audio manquants
// documentés dans android/README.md.

// Délai avant le début de l'heure, en minutes — 0 = à l'heure exacte.
export const OFFSET_CHOICES = [0, 5, 10, 15];

// Chaque son = un fichier dans android/app/src/main/res/raw/ (à fournir,
// voir android/README.md) — 'systeme' n'en fournit volontairement aucun
// (voir constat ci-dessus).
export const SOUND_CHOICES = [
  { id: 'asrar', label: 'Son ASRAR', file: 'asrar_notification.mp3' },
  { id: 'douce', label: 'Sonnerie douce', file: 'asrar_notification_douce.mp3' },
  { id: 'systeme', label: 'Sonnerie système', file: undefined },
];

export const DEFAULT_ALARM_PREFS = { offsetMin: 0, soundId: 'asrar', vibration: true, repeat: false };

// Horizon de programmation d'une alarme « répéter » — sans service natif en
// arrière-plan, on ne peut pas programmer « pour toujours » : on programme
// les occurrences à venir sur cette fenêtre, prolongée à chaque nouvelle
// visite de /planete avec l'alarme encore active (lib/planetAlarmsNative.js).
export const REPEAT_HORIZON_DAYS = 14;

// Rejette toute valeur hors des choix connus plutôt que de la propager telle
// quelle (ex. venant d'un localStorage corrompu/d'une version antérieure) —
// ne lève jamais, retombe systématiquement sur DEFAULT_ALARM_PREFS.
export function validateAlarmPrefs(input) {
  const src = input || {};
  return {
    offsetMin: OFFSET_CHOICES.includes(src.offsetMin) ? src.offsetMin : DEFAULT_ALARM_PREFS.offsetMin,
    soundId: SOUND_CHOICES.some((s) => s.id === src.soundId) ? src.soundId : DEFAULT_ALARM_PREFS.soundId,
    vibration: typeof src.vibration === 'boolean' ? src.vibration : DEFAULT_ALARM_PREFS.vibration,
    repeat: typeof src.repeat === 'boolean' ? src.repeat : DEFAULT_ALARM_PREFS.repeat,
  };
}

// Identifiant du canal Android pour une combinaison (son, vibration) — voir
// la note de contrainte en en-tête. Déterministe : mêmes préférences → même
// canal, réutilisé sans le recréer (createChannel() est un no-op si l'id
// existe déjà).
export function alarmChannelId(soundId, vibration) {
  return `heure_planetaire__${soundId}__${vibration ? 'vib' : 'sil'}`;
}

// Les 6 canaux nécessaires (3 sons × vibration on/off) — créés une fois au
// premier usage de la fonctionnalité (lib/planetAlarmsNative.js), jamais
// recréés individuellement à l'envoi.
export function planetAlarmChannels() {
  return SOUND_CHOICES.flatMap((s) =>
    [true, false].map((vibration) => ({
      id: alarmChannelId(s.id, vibration),
      name: `Heure planétaire — ${s.label}${vibration ? '' : ' (sans vibration)'}`,
      description: 'Alarme programmée pour une heure planétaire.',
      importance: 4,
      sound: s.file,
      vibration,
    }))
  );
}

// Identifiant STABLE et déterministe pour une occurrence (planète + instant de
// début EFFECTIF, déjà décalé par l'offset — voir alarmTimeFor) —
// @capacitor/local-notifications exige un entier 32 bits (Android), donc un
// simple hash plutôt que l'horodatage brut (déborderait). Même planète +
// même instant déclenché → même id, ce qui rend l'activation idempotente
// (cocher deux fois ne programme pas deux alarmes) et permet de retrouver
// l'état « programmée ? » d'une ligne via LocalNotifications.getPending().
export function alarmIdFor(planet, triggerMs) {
  const key = planet + ':' + triggerMs;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0; // |0 : reste un int32 signé
  }
  // Ramené en positif et sous 2^31-1 (borne haute Android) : (hash % N + N) % N
  // gère aussi bien un hash négatif qu'un hash déjà positif.
  const MAX = 2147483647;
  return ((hash % MAX) + MAX) % MAX;
}

// Instant RÉEL de déclenchement d'une occurrence, une fois le délai
// (OFFSET_CHOICES) appliqué.
export function alarmTimeFor(startMs, offsetMin) {
  return startMs - offsetMin * 60000;
}

// Une occurrence déjà entamée ou passée (une fois l'offset appliqué) ne peut
// plus être programmée — LocalNotifications.schedule() sur un instant déjà
// passé se déclenche immédiatement (comportement surprenant pour un clic sur
// une ligne passée).
export function isSchedulable(triggerMs, nowMs) {
  return triggerMs > nowMs;
}

// Titre/corps de la notification système. `offsetMin` change le texte : une
// alarme déclenchée EN AVANCE de l'heure ne doit pas prétendre qu'elle
// « commence maintenant » — format demandé par la revue produit (emoji +
// planète, nature, intervalle) pour offsetMin = 0 :
//   ♃ Jupiter commence maintenant
//   Très favorable · 22:47 – 23:46
export function buildAlarmContent({ planet, emoji, natTxt, interval, offsetMin = 0 }) {
  const when = offsetMin > 0 ? `commence dans ${offsetMin} min` : 'commence maintenant';
  return {
    title: `${emoji} ${planet} ${when}`,
    body: `${natTxt} · ${interval}`,
  };
}
