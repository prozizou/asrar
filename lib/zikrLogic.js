// lib/zikrLogic.js — Logique PURE du Zikr collectif : un objectif commun
// PARTAGÉ (pas de part individuelle fixée à l'avance) — l'objectif restant
// (objectif total moins ce que le groupe entier a déjà récité) est LE MÊME
// nombre pour tout le monde, mis à jour en direct à chaque grain égrené par
// n'importe quel participant. Chacun égrène SANS PLAFOND ni série qui lui
// soit propre (cf. components/useTasbih.js, paramètre `uncapped`).
//
// Aucune dépendance React ni Firebase : importable tel quel côté client
// (import ESM, pré-validation + barres de progression) ET côté serveur
// (require CommonJS dans pages/api/zikr.js, la validation qui FAIT autorité).
// Même interop et même intention que lib/plans.js / lib/rateLimit.js.

import { LIBRE_PRESET_ID, findPreset } from './dhikrPresets';

// Bornes de saisie (partagées client/serveur).
export const NAME_MAX = 80;      // titre du zikr collectif
export const ARABIC_MAX = 120;   // formule arabe saisie pour un "Zikr libre"
export const TARGET_MIN = 1;
export const TARGET_MAX = 100_000_000; // objectif commun (garde-fou anti-valeur absurde)
export const WISH_MAX = 400; // vœu (dua) laissé par un participant une fois l'objectif atteint
export const CHAT_MESSAGE_MAX = 500; // discussion de groupe façon WhatsApp (zikr_chat/{gid}/{msgId})

// Pièce jointe d'un message de discussion (zikr_chat/{gid}/{msgId}.mediaType/
// mediaUrl) — demandé explicitement (« envoyer des audios, images, emoji »).
// L'emoji ne compte PAS comme un média : un emoji n'est qu'un caractère
// inséré dans le texte du message (aucun fichier, aucun stockage à part).
export const CHAT_MEDIA_TYPES = ['image', 'audio'];
// Durée max d'un vocal, appliquée CÔTÉ CLIENT (arrêt automatique de
// l'enregistrement, components MediaRecorder) — jamais vérifiée ici
// (mediaDuration n'est qu'indicatif, transmis par le client).
export const CHAT_AUDIO_MAX_S = 120;

// Rythme (grains/minute) au-delà duquel il devient humainement peu plausible
// qu'il s'agisse d'une récitation avec intention plutôt que d'un tapotement
// mécanique — purement indicatif, jamais bloquant (cf. CollectifCounter).
export const RYTHME_SUSPECT = 180;
export const RYTHME_MAX = 999; // garde-fou de stockage, pas un seuil de blocage

// Fenêtre de présence « en ligne » : un membre est considéré en ligne tant
// que son dernier sondage (get/progress) remonte à moins de ça — 2× l'écart
// de sondage du client (POLL_MS, app/zikr/page.tsx), pour absorber un sondage
// en retard sans faire clignoter le statut à tort.
export const ONLINE_WINDOW_MS = 8000;

// Notification push « reprise d'activité » (pages/api/zikr.js
// handleProgress/notifyReciting) : au plus une fois par heure et par
// DESTINATAIRE, quel que soit le nombre de membres qui reprennent leur
// récitation entre-temps — sans ce plafond, un groupe actif inonderait tout
// le monde de push (chaque reprise d'activité de chaque membre).
export const RECITING_PUSH_WINDOW_MS = 60 * 60 * 1000;

// Message fixe envoyé par le créateur en cliquant « Avertir » — reste simple
// à un clic plutôt que d'ouvrir un champ de saisie par participant (et évite
// une nouvelle surface de texte libre affichée à un tiers).
export const MESSAGE_AVERTISSEMENT = 'Le créateur du Zikr vous invite à réciter avec plus de présence 🙏';

// Message envoyé (avertissement privé + notification push, si abonné) par
// « Notifier les inactifs » (bouton créateur, app/zikr/page.tsx) : cible EN
// UNE FOIS tous les comptes n'ayant récité AUCUN grain (fait===0), plutôt que
// d'avertir un par un via MESSAGE_AVERTISSEMENT — utile quand un groupe
// accepte des demandes qui restent ensuite sans aucune activité.
export const MESSAGE_INACTIVITE =
  "Vous n'avez pas encore récité le moindre grain dans ce zikr collectif. Participez bientôt, sinon vous risquez d'être retiré(e) du groupe.";

// Nettoie un champ texte affiché ensuite à tous les membres : retire les
// caractères d'évasion HTML (chevrons, quotes, backtick, esperluette) pour
// qu'aucune valeur stockée ne puisse porter une XSS, et normalise les espaces.
// Le texte arabe (et sa ponctuation) est préservé — ces caractères n'en font
// pas partie.
export function cleanText(v, max) {
  return String(v == null ? '' : v)
    .replace(/[<>"'`&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Horaire optionnel de la PROCHAINE SESSION (epoch ms) — sert de base au
// rappel push (lib/reminders.js shouldSendSessionReminder, pages/api/cron/
// reminders.js) envoyé aux membres approuvés avant l'heure dite. Une entrée
// invalide/absente redevient silencieusement "pas de session programmée"
// (champ optionnel, jamais une erreur de validation bloquante).
export function normalizeSessionAt(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * Normalise ET valide la saisie de création d'un zikr collectif. Résout la
 * formule (arabe + translittération) depuis DHIKR_PRESETS, sauf pour
 * presetId="libre" où le créateur la saisit lui-même. Pure.
 * @param {{name?:string, presetId?:string, arabic?:string, target?:number|string, private?:boolean, sessionAt?:number|string|null}} input
 * @returns {{name:string, presetId:string, arabic:string, transliteration:string, target:number, private:boolean, sessionAt:number|null}
 *   | {error:'name'|'preset'|'arabic'|'target'}}
 */
export function normalizeGroupInput(input) {
  const name = cleanText(input && input.name, NAME_MAX);
  if (!name) return { error: 'name' };

  const presetId = String((input && input.presetId) || '');
  const preset = findPreset(presetId);
  if (!preset) return { error: 'preset' };

  let arabic = preset.arabic;
  if (presetId === LIBRE_PRESET_ID) {
    arabic = cleanText(input && input.arabic, ARABIC_MAX);
    if (!arabic) return { error: 'arabic' };
  }

  const target = Math.floor(Number(input && input.target));
  if (!Number.isFinite(target) || target < TARGET_MIN || target > TARGET_MAX) {
    return { error: 'target' };
  }

  // Zikr PRIVÉ : absent de la liste publique (action "list") pour quiconque
  // n'est ni créateur, ni déjà membre/en attente — invisible sauf via le lien
  // de partage (deep link direct sur son groupId, cf. pages/api/zikr.js
  // handleList/handleGet). Toujours visible/rejoignable par lien : "privé"
  // ne restreint QUE la découverte dans la liste, pas l'accès direct.
  const isPrivate = !!(input && input.private);
  const sessionAt = normalizeSessionAt(input && input.sessionAt);

  return { name, presetId, arabic, transliteration: preset.transliteration, target, private: isPrivate, sessionAt };
}

/** Total récité par l'ensemble des participants actifs, plus ce qu'avaient
 * déjà fait ceux qui ont depuis quitté (`faitPartis`) — sans ce second terme,
 * quitter le groupe effacerait sa contribution au décompte commun. Pure. */
export function totalFait(participants, faitPartis) {
  const actifs = participants
    ? Object.values(participants).reduce((sum, p) => sum + (Number(p && p.fait) || 0), 0)
    : 0;
  return actifs + (Number(faitPartis) || 0);
}

/** Progression cumulée en % (bornée 0–100), pour la barre collective. Pure. */
export function progressPct(total, target) {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return 0;
  const cur = Number(total) || 0;
  return Math.max(0, Math.min(100, (cur / t) * 100));
}

/** Normalise l'avancement ABSOLU d'un participant : entier ≥ 0, SANS
 * plafond (pas de part individuelle à ne pas dépasser — objectif partagé et
 * non modifiable, cf. useTasbih(..., uncapped=true)). Pure. */
export function normalizeFait(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Normalise le rythme instantané (grains/minute) envoyé par le client —
 * entier ≥ 0, plafonné à RYTHME_MAX pour ne jamais stocker une valeur
 * aberrante (le seuil "suspect" reste purement indicatif, jamais bloquant).
 * Pure. */
export function normalizeRythme(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, RYTHME_MAX);
}

/** Clé de journée UTC ("AAAA-MM-JJ"), commune à TOUT le groupe quel que soit
 * le fuseau de chacun — utilisée pour le total DU JOUR par participant
 * (zikr_members/{gid}/{uid}/daily, pages/api/zikr.js handleProgress/
 * handleGet) : un seul minuit partagé plutôt qu'un minuit par membre (comme
 * lib/reminders.js localDateKey pour le wird quotidien, qui LUI reste
 * individuel) — cohérent avec un objectif COMMUN, et bascule paresseuse à la
 * lecture (comparer `date` au jour courant), sans job de remise à zéro.
 * toISOString() est TOUJOURS en UTC, quel que soit le fuseau du serveur.
 * Pure (horloge injectable pour les tests). */
export function utcDateKey(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Un message de discussion doit porter du texte OU un média valide — jamais
 * un message totalement vide (ni les deux à la fois interdits : un média
 * PEUT avoir une légende). `mediaType` doit être l'un de CHAT_MEDIA_TYPES et
 * `mediaUrl` non vide pour compter comme média. Pure. */
export function isValidChatMessage(text, mediaType, mediaUrl) {
  const hasText = !!String(text == null ? '' : text).trim();
  const hasMedia = CHAT_MEDIA_TYPES.includes(mediaType) && !!String(mediaUrl == null ? '' : mediaUrl).trim();
  return hasText || hasMedia;
}

/** Nombre de réactions « Amine » sur un vœu partagé, à partir du nœud brut
 * zikr_wish_amines/{gid}/{wishUid} (map uid → true). Pure. */
export function amineCount(amines) {
  return amines ? Object.keys(amines).length : 0;
}

