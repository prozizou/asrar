// lib/zikrLogic.js — Logique PURE du Zikr collectif (objectif commun vers
// lequel chaque membre contribue le nombre de grains DE SON CHOIX, plutôt
// qu'une répartition automatique en parts égales — cf. l'historique : la
// version précédente imposait un nombre de « parts » fixé à la création et
// divisait l'objectif dessus (objectif / parts, la dernière absorbant le
// reste) ; un membre ne pouvait pas choisir combien il prenait en charge.
// Ici, chaque membre annonce lui-même son propre engagement (`amount`) en
// rejoignant — normalizeAmount() le borne à ce qu'il reste réellement à
// couvrir sur l'objectif commun, pour que la somme des engagements ne
// dépasse jamais l'objectif.
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
export const AMOUNT_MIN = 1;     // un membre prend en charge au moins 1 grain

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
 * Normalise ET valide la saisie de création d'un zikr collectif (le nombre
 * de grains pris en charge par le créateur lui-même se valide séparément,
 * via normalizeAmount — il dépend de l'objectif qui n'est connu qu'une fois
 * celui-ci validé). Pure.
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

/**
 * Valide le nombre de grains qu'un membre veut prendre en charge — à la
 * création (où `remaining` = l'objectif entier, personne n'a encore rien
 * pris) ou en rejoignant (où `remaining` = objectif - somme des engagements
 * déjà pris par les autres membres). Entier positif, plafonné à `remaining`
 * pour que la somme des engagements ne dépasse jamais l'objectif commun.
 * Pure.
 * @param {number|string} raw
 * @param {number} remaining
 * @returns {{amount:number} | {error:'amount'}}
 */
export function normalizeAmount(raw, remaining) {
  const n = Math.floor(Number(raw));
  const max = Math.max(0, Math.floor(Number(remaining)) || 0);
  if (!Number.isFinite(n) || n < AMOUNT_MIN || n > max) return { error: 'amount' };
  return { amount: n };
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
 * `part` inclus (on ne peut pas égrener au-delà de ce qu'il a lui-même pris
 * en charge, ni revenir sous zéro). Pure. La progression étant enregistrée
 * en valeur absolue (pas en incrément), ce bornage rend l'enregistrement
 * idempotent.
 */
export function clampFait(v, part) {
  const n = Math.floor(Number(v));
  const max = Math.max(0, Math.floor(Number(part)) || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, max);
}
