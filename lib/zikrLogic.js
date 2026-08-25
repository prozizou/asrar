// lib/zikrLogic.js — Logique PURE du Zikr collectif (objectif commun réparti
// en PARTS — même règle de répartition que le ZIP « mon-chapelet » : chaque
// participant reçoit une part = objectif / parts, la dernière absorbant le
// reste, si bien que la somme des parts fait toujours exactement l'objectif).
//
// Aucune dépendance React ni Firebase : importable tel quel côté client
// (import ESM, pré-validation + barres de progression) ET côté serveur
// (require CommonJS dans pages/api/zikr.js, la validation qui FAIT autorité).
// Même interop et même intention que lib/plans.js / lib/rateLimit.js.

// Bornes de saisie (partagées client/serveur).
export const NAME_MAX = 80;      // titre du zikr collectif
export const PHRASE_MAX = 120;   // formule/du'a à réciter (texte libre, arabe ou latin)
export const TARGET_MIN = 1;
export const TARGET_MAX = 100_000_000; // objectif commun (garde-fou anti-valeur absurde)
export const PARTS_MIN = 1;
export const PARTS_MAX = 1000;   // nombre de participants/parts prévus

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
 * Taille de la part n° `rang` (0-indexé) d'un objectif découpé en `parts`.
 * La dernière part absorbe le reste de la division — la somme des parts fait
 * donc toujours exactement l'objectif (règle identique au ZIP de référence).
 * Pure.
 */
export function partSize(objectif, parts, rang) {
  const o = Number(objectif) || 0;
  const p = Number(parts) || 0;
  const r = Number(rang);
  if (p <= 0 || !Number.isFinite(r) || r < 0 || r >= p) return 0;
  const base = Math.floor(o / p);
  const reste = o - base * p;
  return r === p - 1 ? base + reste : base;
}

/**
 * Normalise ET valide la saisie de création d'un zikr collectif. Pure.
 * @param {{name?:string, phrase?:string, target?:number|string, parts?:number|string}} input
 * @returns {{name:string, phrase:string, target:number, parts:number}
 *   | {error:'name'|'phrase'|'target'|'parts'}}
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

  const parts = Math.floor(Number(input && input.parts));
  // Pas plus de parts que de grains à réciter (sinon une part vaudrait 0).
  if (!Number.isFinite(parts) || parts < PARTS_MIN || parts > PARTS_MAX || parts > target) {
    return { error: 'parts' };
  }
  return { name, phrase, target, parts };
}

/** Progression cumulée en % (bornée 0–100), pour la barre collective. Pure. */
export function progressPct(total, target) {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return 0;
  const cur = Number(total) || 0;
  return Math.max(0, Math.min(100, (cur / t) * 100));
}

/**
 * Borne l'avancement ABSOLU d'un participant sur sa part : entier de 0 à
 * `part` inclus (on ne peut pas égrener au-delà de sa propre part, ni
 * revenir sous zéro). Pure. La progression étant enregistrée en valeur
 * absolue (pas en incrément), ce bornage rend l'enregistrement idempotent.
 */
export function clampFait(v, part) {
  const n = Math.floor(Number(v));
  const max = Math.max(0, Math.floor(Number(part)) || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, max);
}
