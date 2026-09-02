// lib/thalsam.js — Générateur de Thalsam : recherche combinatoire d'une
// chaîne de lettres arabes (« Thalsam ») dont le poids abjad total égale
// exactement une valeur cible, avec une finition imposée parmi une liste
// fermée, un nombre de lettres contraint et une classification
// lumineuse/non-lumineuse. Port fidèle de la spécification fonctionnelle
// fournie par l'utilisateur (36 sections) — voir app/thalsams/page.tsx pour
// l'UI. Aucune dépendance React ni Firebase : importable côté client (ESM)
// comme côté serveur si besoin, même principe que lib/zikrLogic.js.
//
// NOTE DE PORTÉE (reprise du §1 de la spécification) : ce moteur formalise
// un référentiel traditionnel/ésotérique fourni par l'utilisateur. Les
// « poids » sont traités comme des valeurs numériques symboliques ; ce
// module ne constitue pas une preuve d'efficacité surnaturelle.
//
// Table numérique : la table fournie dans la spécification (§3) est,
// lettre pour lettre, IDENTIQUE à `maghrebiAbjad` (lib/abjad.js, déjà
// utilisée par le Wafq par intention et Al Kanzou) — réutilisée ici plutôt
// que redupliquée, seule sa restriction aux 28 lettres canoniques (sans les
// formes hamza/ة variantes, hors périmètre de cette spécification) change.

import { maghrebiAbjad } from './abjad';

// Les 28 lettres canoniques du référentiel (§3) — dans l'ordre où la
// spécification les énumère. Les formes variantes de maghrebiAbjad
// (أ إ آ ء ة ؤ ى ئ) n'en font pas partie : hors périmètre de cette
// spécification (ni dans sa table, ni dans ses listes lumineuses/finitions).
export const THALSAM_ALPHABET = [
  'ا', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط',
  'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق',
  'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ',
];

// §4 — Lettres lumineuses.
export const LUMINOUS_LETTERS = [
  'ا', 'ح', 'ر', 'س', 'ص', 'ط', 'ع', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'ي',
];
const LUMINOUS_SET = new Set(LUMINOUS_LETTERS);

// §5 — Finitions valides (liste fermée). « بس » retirée (présente par
// erreur dans la version initiale) ; ديش/دديش/طش/ياش ajoutées.
export const ENDINGS = ['ش', 'عيش', 'طيش', 'يش', 'وش', 'ديش', 'دديش', 'طش', 'ياش'];

// §30 — Garde-fous anti-explosion combinatoire (configurables par appel,
// jamais désactivables : un moteur qui tournerait indéfiniment ou
// renverrait des milliers de résultats serait aussi peu fiable qu'un
// moteur qui invente un résultat approximatif).
export const DEFAULT_MAX_RESULTS = 30;
export const DEFAULT_MAX_NODES = 400_000; // nœuds de backtracking explorés, tous appels confondus
export const TARGET_WEIGHT_MAX = 1_000_000; // garde-fou de saisie, pas une limite du moteur

/** §6 — Poids d'une chaîne = somme des valeurs de ses lettres. Lève une
 * erreur sur une lettre inconnue de la table plutôt que de l'ignorer en
 * silence (§30 : « ne jamais inventer une valeur de lettre »). */
export function calculateWeight(text) {
  let total = 0;
  for (const letter of String(text || '')) {
    if (!(letter in maghrebiAbjad)) {
      throw new Error(`Lettre inconnue : ${letter}`);
    }
    total += maghrebiAbjad[letter];
  }
  return total;
}

/** §4 — Classification d'une lettre. */
export function classifyLetter(letter) {
  return LUMINOUS_SET.has(letter) ? 'LUMINEUSE' : 'NON_LUMINEUSE';
}

/** Longueur en lettres (itère par caractère Unicode — pas de digrammes
 * arabes ici, un simple .length suffirait, mais reste explicite). */
export function letterCount(text) {
  return [...String(text || '')].length;
}

/** §22 — Alphabet de recherche pour la racine, selon la classification
 * choisie. `custom` : l'appelant fournit directement `customLetters`
 * (filtré à l'alphabet canonique — jamais une lettre hors table). */
export function alphabetForClassification(classification) {
  const mode = (classification && classification.mode) || 'mixed';
  if (mode === 'luminousOnly') return THALSAM_ALPHABET.filter((l) => LUMINOUS_SET.has(l));
  if (mode === 'nonLuminousOnly') return THALSAM_ALPHABET.filter((l) => !LUMINOUS_SET.has(l));
  if (mode === 'custom') {
    const allowed = new Set((classification && classification.customLetters) || []);
    return THALSAM_ALPHABET.filter((l) => allowed.has(l));
  }
  return THALSAM_ALPHABET; // mixed
}

// Valeur maximale d'une lettre de la table (ش) — sert à dimensionner le mode
// "auto" : impossible d'atteindre un poids cible avec moins de
// ceil(poids / MAX_LETTER_VALUE) lettres, quelle que soit la lettre choisie.
export const MAX_LETTER_VALUE = 1000;

/** §29 — Longueurs totales à explorer selon le mode. En mode "auto", le
 * moteur ne peut pas tester une infinité de longueurs : il part du minimum
 * THÉORIQUEMENT nécessaire pour la cible donnée (ceil(poids/1000) — sans ce
 * calcul, un gros poids cible comme 16641 était tout simplement hors de
 * portée d'un mode "auto" borné à un plafond fixe de 12 lettres, quelle que
 * soit la cible) puis teste AUTO_LENGTH_SPAN longueurs supplémentaires
 * au-delà de ce minimum. `targetWeight` est optionnel (repli sur 1 s'il est
 * absent/invalide) — seul le mode "auto" s'en sert. */
export const AUTO_LENGTH_SPAN = 10;

export function getAllowedLengths(length, targetWeight) {
  const mode = (length && length.mode) || 'exact';
  if (mode === 'exact') {
    const n = Math.floor(Number(length.exact));
    return Number.isFinite(n) && n > 0 ? [n] : [];
  }
  if (mode === 'range') {
    const min = Math.floor(Number(length.min));
    const max = Math.floor(Number(length.max));
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < min) return [];
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }
  if (mode === 'auto') {
    const target = Math.floor(Number(targetWeight));
    const minLength = Number.isFinite(target) && target > 0 ? Math.max(1, Math.ceil(target / MAX_LETTER_VALUE)) : 1;
    return Array.from({ length: AUTO_LENGTH_SPAN }, (_, i) => minLength + i);
  }
  return [];
}

// ── Recherche combinatoire (backtracking + élagage, §12/§18) ───────────

/**
 * Recherche jusqu'à `limit` racines de longueur EXACTE `rootLength` dont le
 * poids vaut EXACTEMENT `remainingWeight`, en piochant dans `alphabet`.
 * Élagage (§18) : à chaque nœud, si la somme minimale ou maximale
 * atteignable avec les positions restantes ne peut plus égaler la cible,
 * la branche est abandonnée immédiatement — sans quoi l'espace de
 * recherche (jusqu'à 28^N séquences ordonnées) exploserait pour les
 * longueurs élevées. `budget` (objet mutable {nodes,max}) est PARTAGÉ entre
 * tous les appels d'une même recherche globale (§30 : jamais de boucle
 * combinatoire infinie, même à travers plusieurs finitions/longueurs).
 */
function searchRoots(rootLength, remainingWeight, alphabet, allowRepeats, limit, budget) {
  const results = [];
  if (limit <= 0 || alphabet.length === 0) return results;
  if (rootLength === 0) {
    if (remainingWeight === 0) results.push('');
    return results;
  }
  if (remainingWeight < 0) return results;

  const values = alphabet.map((l) => maghrebiAbjad[l]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  // Mémoïsation de la FAISABILITÉ d'un sous-problème (posLeft, remaining) —
  // classique problème de rendu de monnaie à nombre de pièces fixé. Sans
  // elle, un sous-problème réellement IMPOSSIBLE (les dénominations
  // disponibles ont des trous — ex. aucune lettre ne vaut 641, donc aucune
  // paire de lettres ne peut sommer à 1641) était réexploré identiquement
  // depuis CHAQUE chemin qui y mène : les bornes min/max seules (§18)
  // écartent les sommes hors de la plage atteignable, mais pas les sommes
  // dans la plage qui restent malgré tout impossibles avec ces
  // dénominations précises — sans mémoïsation, ce trou pouvait à lui seul
  // épuiser tout le budget de nœuds avant de conclure à l'échec. Seulement
  // pertinente si la répétition est autorisée (sinon l'état dépendrait
  // aussi des lettres déjà consommées, impraticable à mémoïser simplement ;
  // on retombe alors sur l'élagage par bornes seul).
  const feasibleCache = allowRepeats ? new Map() : null;
  function canReach(posLeft, remaining) {
    if (remaining < 0) return false;
    if (posLeft === 0) return remaining === 0;
    if (remaining < posLeft * minVal || remaining > posLeft * maxVal) return false;
    if (!feasibleCache) return true; // pas de mémoïsation possible : bornes seules
    const key = posLeft + '|' + remaining;
    const cached = feasibleCache.get(key);
    if (cached !== undefined) return cached;
    let ok = false;
    for (const v of values) {
      if (canReach(posLeft - 1, remaining - v)) { ok = true; break; }
    }
    feasibleCache.set(key, ok);
    return ok;
  }

  const used = new Set();
  const path = [];

  function backtrack(posLeft, remaining) {
    if (results.length >= limit || budget.nodes >= budget.max) return;
    budget.nodes++;
    if (posLeft === 0) {
      if (remaining === 0) results.push(path.join(''));
      return;
    }
    if (!canReach(posLeft, remaining)) return;

    // Ordre des candidats : le plus proche de la moyenne nécessaire
    // (remaining/posLeft) d'abord, PAS l'ordre fixe de l'alphabet — même
    // sans sous-problème infaisable, ça converge bien plus vite vers UNE
    // somme exacte que l'ordre alphabétique fixe (qui commence toujours par
    // ا=1, la valeur la plus éloignée de la moyenne pour une cible élevée).
    const avg = remaining / posLeft;
    const order = [];
    for (let i = 0; i < alphabet.length; i++) {
      if (allowRepeats || !used.has(alphabet[i])) order.push(i);
    }
    order.sort((a, b) => Math.abs(values[a] - avg) - Math.abs(values[b] - avg));

    for (const i of order) {
      if (results.length >= limit || budget.nodes >= budget.max) return;
      const letter = alphabet[i];
      const v = values[i];
      if (v > remaining) continue;
      if (allowRepeats && !canReach(posLeft - 1, remaining - v)) continue; // élagage mémoïsé
      path.push(letter);
      if (!allowRepeats) used.add(letter);
      backtrack(posLeft - 1, remaining - v);
      path.pop();
      if (!allowRepeats) used.delete(letter);
    }
  }

  backtrack(rootLength, remainingWeight);
  return results;
}

/** §16/§32 — Construit l'objet résultat détaillé pour un Thalsam trouvé. */
function buildResult(root, ending, targetWeight, endingWeight, rootWeight) {
  const thalsam = root + ending;
  const calculation = [...thalsam].map((letter) => ({ letter, value: maghrebiAbjad[letter] }));
  const luminous = [];
  const nonLuminous = [];
  for (const letter of thalsam) {
    (classifyLetter(letter) === 'LUMINEUSE' ? luminous : nonLuminous).push(letter);
  }
  return {
    thalsam,
    root,
    ending,
    totalWeight: rootWeight + endingWeight,
    rootWeight,
    endingWeight,
    totalLetters: letterCount(thalsam),
    rootLetters: letterCount(root),
    endingLetters: letterCount(ending),
    luminousLetters: luminous,
    nonLuminousLetters: nonLuminous,
    calculation,
    verified: false, // posé par validateResult ci-dessous, jamais présumé vrai
  };
}

/** §23 — Validation indépendante avant affichage : ne fait confiance à
 * aucun état interne du backtracking, recalcule tout depuis le résultat
 * lui-même. */
export function validateResult(result, targetWeight) {
  try {
    return (
      calculateWeight(result.thalsam) === targetWeight &&
      result.thalsam.endsWith(result.ending) &&
      result.totalLetters === letterCount(result.thalsam)
    );
  } catch {
    return false;
  }
}

/**
 * §26 — Point d'entrée principal du moteur.
 * @param {{
 *   targetWeight: number,
 *   length: {mode:'exact'|'range'|'auto', exact?:number, min?:number, max?:number},
 *   ending: {mode:'auto'|'specific', selected?:string},
 *   letterClassification?: {mode?:'mixed'|'luminousOnly'|'nonLuminousOnly'|'custom', customLetters?:string[]},
 *   generation?: {allowRepeatedLetters?:boolean, preserveLetterOrder?:boolean},
 *   maxResults?: number,
 *   maxNodes?: number,
 * }} config
 * @returns {{targetWeight:number, totalResults:number, results:object[], truncated:boolean, error?:string}}
 */
export function generateThalsams(config) {
  const targetWeight = Math.floor(Number(config && config.targetWeight));
  if (!Number.isFinite(targetWeight) || targetWeight <= 0 || targetWeight > TARGET_WEIGHT_MAX) {
    return { targetWeight: targetWeight || 0, totalResults: 0, results: [], truncated: false, error: 'Poids cible invalide.' };
  }

  const endingMode = (config.ending && config.ending.mode) || 'auto';
  let endingsToTest;
  if (endingMode === 'auto') {
    endingsToTest = ENDINGS;
  } else {
    const selected = config.ending && config.ending.selected;
    if (!ENDINGS.includes(selected)) {
      return { targetWeight, totalResults: 0, results: [], truncated: false, error: 'Finition inconnue.' };
    }
    endingsToTest = [selected];
  }

  const lengths = getAllowedLengths(config.length, targetWeight);
  if (lengths.length === 0) {
    return { targetWeight, totalResults: 0, results: [], truncated: false, error: 'Nombre de lettres invalide.' };
  }

  const alphabet = alphabetForClassification(config.letterClassification);
  if (alphabet.length === 0) {
    return { targetWeight, totalResults: 0, results: [], truncated: false, error: 'Aucune lettre disponible pour cette classification.' };
  }

  const allowRepeats = !config.generation || config.generation.allowRepeatedLetters !== false;
  const maxResults = Math.max(1, Math.floor(config.maxResults) || DEFAULT_MAX_RESULTS);
  // Budget GLOBAL (plafond total sur tout l'appel) — mais chaque combinaison
  // (finition, longueur) reçoit son PROPRE sous-budget, plafonné à
  // PER_ATTEMPT_MAX_NODES. Sans ce partage, une seule combinaison
  // difficile — voire mathématiquement IMPOSSIBLE (ex. 16641 en exactement
  // 17 lettres : borne min/max franchie mais aucune somme exacte n'existe
  // réellement avec ce nombre précis de lettres) — épuisait à elle seule tout
  // le budget avant même d'essayer les longueurs suivantes, alors que
  // celles-ci auraient trouvé une solution en quelques nœuds à peine.
  const globalBudget = { nodes: 0, max: Math.max(1, Math.floor(config.maxNodes) || DEFAULT_MAX_NODES) };
  const PER_ATTEMPT_MAX_NODES = 50_000;

  const results = [];
  outer:
  for (const ending of endingsToTest) {
    const endingWeight = calculateWeight(ending);
    const endingLength = letterCount(ending);

    for (const totalLength of lengths) {
      if (globalBudget.nodes >= globalBudget.max) break outer;
      const rootLength = totalLength - endingLength;
      if (rootLength < 0) continue;
      const remainingWeight = targetWeight - endingWeight;
      if (remainingWeight < 0) continue;

      const attemptBudget = { nodes: 0, max: Math.min(PER_ATTEMPT_MAX_NODES, globalBudget.max - globalBudget.nodes) };
      const roots = searchRoots(rootLength, remainingWeight, alphabet, allowRepeats, maxResults - results.length, attemptBudget);
      globalBudget.nodes += attemptBudget.nodes;

      for (const root of roots) {
        const result = buildResult(root, ending, targetWeight, endingWeight, remainingWeight);
        result.verified = validateResult(result, targetWeight);
        if (result.verified) results.push(result);
        if (results.length >= maxResults) break outer;
      }
    }
  }

  return {
    targetWeight,
    totalResults: results.length,
    results,
    truncated: results.length >= maxResults || globalBudget.nodes >= globalBudget.max,
  };
}
