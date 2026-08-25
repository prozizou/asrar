// lib/zikrLogic.js — Logique PURE du Zikr collectif (objectif commun cumulé).
//
// Aucune dépendance React ni Firebase : importable tel quel côté client
// (import ESM, pré-validation du formulaire de création + barre de
// progression) ET côté serveur (require CommonJS dans pages/api/zikr.js, la
// validation qui FAIT autorité). Même interop et même intention que
// lib/plans.js / lib/rateLimit.js : une seule source pour les bornes et la
// normalisation, jamais deux copies à resynchroniser entre client et serveur.

// Bornes de saisie (partagées client/serveur).
export const NAME_MAX = 80;      // titre du zikr collectif
export const PHRASE_MAX = 120;   // formule/du'a à réciter (texte libre, arabe ou latin)
export const TARGET_MIN = 1;
export const TARGET_MAX = 100_000_000; // objectif commun (garde-fou anti-valeur absurde)
export const AMOUNT_MAX = 100_000;     // contribution MAXIMALE par envoi (anti-injection de total)

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
 * Normalise ET valide la saisie de création d'un zikr collectif. Pure.
 * @param {{name?:string, phrase?:string, target?:number|string}} input
 * @returns {{name:string, phrase:string, target:number} | {error:'name'|'phrase'|'target'}}
 */
export function normalizeGroupInput(input) {
  const name = cleanText(input && input.name, NAME_MAX);
  if (!name) return { error: 'name' };

  const phrase = cleanText(input && input.phrase, PHRASE_MAX);
  if (!phrase) return { error: 'phrase' };

  const target = Math.floor(Number(input && input.target));
  if (!Number.isFinite(target) || target < TARGET_MIN || target > TARGET_MAX) {
    return { error: 'target' };
  }
  return { name, phrase, target };
}

/** Progression cumulée en % (bornée 0–100), pour la barre collective. Pure. */
export function progressPct(total, target) {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return 0;
  const cur = Number(total) || 0;
  return Math.max(0, Math.min(100, (cur / t) * 100));
}

/**
 * Borne une contribution avant de l'ajouter au total commun : entier > 0,
 * plafonné à AMOUNT_MAX (empêche un membre d'injecter un total délirant en un
 * seul envoi). Pure. Renvoie 0 si la valeur est invalide (rien à créditer).
 */
export function clampAmount(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, AMOUNT_MAX);
}
