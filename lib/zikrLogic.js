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

// Message fixe envoyé par le créateur en cliquant « Avertir » — reste simple
// à un clic plutôt que d'ouvrir un champ de saisie par participant (et évite
// une nouvelle surface de texte libre affichée à un tiers).
export const MESSAGE_AVERTISSEMENT = 'Le créateur du Zikr vous invite à réciter avec plus de présence 🙏';

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

/**
 * Normalise ET valide la saisie de création d'un zikr collectif. Résout la
 * formule (arabe + translittération) depuis DHIKR_PRESETS, sauf pour
 * presetId="libre" où le créateur la saisit lui-même. Pure.
 * @param {{name?:string, presetId?:string, arabic?:string, target?:number|string}} input
 * @returns {{name:string, presetId:string, arabic:string, transliteration:string, target:number}
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
  return { name, presetId, arabic, transliteration: preset.transliteration, target };
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

