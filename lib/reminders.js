// lib/reminders.js — Rappels programmés : logique PURE, consommée en require
// CommonJS par pages/api/cron/reminders.js (décision d'envoi). Export en ESM
// comme les autres lib/*.js malgré tout, même interop que lib/zikrLogic.js /
// lib/reviews.js, au cas où un futur écran voudrait prévisualiser côté
// client sans aller-retour serveur.
//
// TROIS rappels distincts, tous livrés par la même infra push que l'heure
// planétaire (lib/push.js, VAPID) mais SANS exiger de position GPS (celle-ci
// n'est nécessaire qu'au calcul de l'heure planétaire — voir
// pages/api/push-subscribe.js, lat/lng désormais optionnels) :
//
//   1. Session Zikr collectif à venir — le créateur d'un zikr collectif fixe
//      un horaire optionnel (zikr_groups/{gid}.sessionAt, epoch ms — voir
//      lib/zikrLogic.js normalizeGroupInput) ; tous les membres approuvés
//      reçoivent un rappel avant l'heure dite.
//   2-3. Relance de réabonnement (bientôt expiré / déjà expiré) — SANS
//      réglage utilisateur (pas d'opt-in : ce n'est pas un rappel de
//      pratique, c'est une notification liée au compte, comme un reçu).
//      Lit directement purchased_user/{emailKey} (RTDB, PARTAGÉE avec
//      admin-asrar-pro — voir server/access.js) : nœud écrit par l'admin
//      (grant/prolongation), jamais par ce cron. Voir
//      shouldSendRenewalReminder/shouldSendExpiredNotice plus bas.
//
// (Anciens rappels « wird quotidien » et « contenu quotidien » retirés — les
// seules interfaces qui pouvaient les activer, components/WirdReminderToggle.js
// et components/DailyContentCard.js, ont été supprimées ; ce fichier gérait
// leur décision d'envoi via reminder_settings/{uid}, node désormais inutilisé.)
//
// Le cron (pages/api/cron/reminders.js) peut être invoqué à une cadence
// irrégulière/inconnue (planificateur externe, cf. l'en-tête de
// pages/api/cron/planet-push.js) : les fonctions ci-dessous sont donc
// délibérément à BASE D'ÉTAT (dernier envoi mémorisé) plutôt qu'à fenêtre de
// temps stricte, pour rester correctes quelle que soit la fréquence réelle
// des appels.

// Fenêtre de rappel pour une session Zikr collectif : à partir de LEAD_MS
// avant l'heure fixée, jusqu'à GRACE_MS après (au cas où le cron ne repasse
// pas exactement à l'heure) — au-delà, on considère le rappel manqué plutôt
// que de prévenir en retard d'une session déjà bien entamée.
export const SESSION_LEAD_MS = 30 * 60 * 1000;  // 30 min avant
export const SESSION_GRACE_MS = 10 * 60 * 1000; // 10 min de rattrapage après

/**
 * Faut-il envoyer le rappel de session Zikr collectif à venir ? Fenêtre
 * [sessionAt - SESSION_LEAD_MS, sessionAt + SESSION_GRACE_MS], une seule
 * fois (déjàEnvoyé). Pure.
 * @param {number|null|undefined} sessionAt epoch ms
 * @param {boolean} alreadySent
 * @param {Date} now
 */
export function shouldSendSessionReminder(sessionAt, alreadySent, now) {
  if (!sessionAt || alreadySent) return false;
  const t = Number(sessionAt);
  if (!Number.isFinite(t) || t <= 0) return false;
  const delta = t - now.getTime();
  return delta <= SESSION_LEAD_MS && delta >= -SESSION_GRACE_MS;
}

// ── Relance de réabonnement ──────────────────────────────────────────────
// Fenêtre AVANT expiration : envoyée une seule fois par échéance (voir
// `renewalReminderForExpiry` ci-dessous), dès que RENEWAL_REMINDER_DAYS ou
// moins restent avant `expiresAt`.
export const RENEWAL_REMINDER_DAYS = 3;
// Fenêtre APRÈS expiration : l'avis « accès expiré » reste pertinent
// RENEWAL_GRACE_DAYS jours (au-delà, on considère que relancer ne sert plus
// à grand-chose — l'utilisateur a eu l'occasion de le voir).
export const RENEWAL_GRACE_DAYS = 3;

/**
 * Faut-il envoyer un rappel « votre abonnement expire bientôt » ? Pure.
 * `purchase.renewalReminderForExpiry` mémorise la valeur de `expiresAt` pour
 * laquelle le rappel a DÉJÀ été envoyé — pas juste un booléen : si l'admin
 * prolonge l'accès (nouvelle valeur d'`expiresAt`), l'ancien marqueur ne
 * correspond plus à la nouvelle échéance, donc un futur rappel redevient
 * possible SANS qu'aucun code d'octroi (admin-asrar-pro, autre dépôt) n'ait
 * besoin de réinitialiser quoi que ce soit explicitement.
 * @param {{expiresAt?: number|"lifetime", renewalReminderForExpiry?: number}} purchase
 * @param {Date} now
 */
export function shouldSendRenewalReminder(purchase, now) {
  if (!purchase) return false;
  const exp = purchase.expiresAt;
  if (exp === 'lifetime' || typeof exp !== 'number' || !Number.isFinite(exp)) return false;
  if (purchase.renewalReminderForExpiry === exp) return false; // déjà envoyé pour CETTE échéance
  const msLeft = exp - now.getTime();
  return msLeft > 0 && msLeft <= RENEWAL_REMINDER_DAYS * 864e5;
}

/**
 * Faut-il envoyer un avis « votre abonnement a expiré » ? Même principe de
 * marqueur par échéance que shouldSendRenewalReminder — voir son commentaire.
 * @param {{expiresAt?: number|"lifetime", expiredNoticeForExpiry?: number}} purchase
 * @param {Date} now
 */
export function shouldSendExpiredNotice(purchase, now) {
  if (!purchase) return false;
  const exp = purchase.expiresAt;
  if (exp === 'lifetime' || typeof exp !== 'number' || !Number.isFinite(exp)) return false;
  if (purchase.expiredNoticeForExpiry === exp) return false;
  const msSince = now.getTime() - exp;
  return msSince >= 0 && msSince <= RENEWAL_GRACE_DAYS * 864e5;
}

// Nombre de jours entiers restants avant `expiresAt` (arrondi au jour
// supérieur : 2,1 jours restants s'affiche "3 jours", jamais "2 jours" qui
// laisserait croire à tort qu'il en reste deux PLEINS).
export function daysUntil(expiresAt, now) {
  return Math.max(0, Math.ceil((expiresAt - now.getTime()) / 864e5));
}

/**
 * Message WhatsApp pré-rempli pour une relance de réabonnement — même ton et
 * structure que lib/whatsapp.js accessMessage() (côté client, non réutilisable
 * ici : window.open/auth.currentUser), pour une expérience cohérente que la
 * demande parte d'un tap sur ce message ou d'un clic dans l'app.
 * @param {{email: string, expiresAt: number, expired: boolean}} opts
 */
export function renewalWhatsAppMessage({ email, expiresAt, expired }) {
  const dateStr = new Date(expiresAt).toLocaleDateString('fr-FR');
  const L = ['Assalamou aleykoum 🌙', 'Je souhaite renouveler mon abonnement premium sur ASRAR PRO.', ''];
  if (email) L.push('• Compte (e-mail) : ' + email);
  L.push(expired ? '• Abonnement expiré le : ' + dateStr : '• Abonnement expire le : ' + dateStr);
  L.push('');
  L.push("Merci de m'indiquer les modalités de paiement et de renouveler mon accès. Barakallahou fikoum.");
  return L.join('\n');
}

/** URL de relance (/api/wa, cf. pages/api/wa.js) — pré-remplie, jamais le numéro WhatsApp en clair. */
export function renewalWhatsAppUrl({ email, expiresAt, expired }) {
  return '/api/wa?text=' + encodeURIComponent(renewalWhatsAppMessage({ email, expiresAt, expired }));
}
