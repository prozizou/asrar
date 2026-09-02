// lib/tafsirLogic.js — Logique PURE du Tafsir al-Ahlam (interprétation des
// rêves) : recherche par symbole/mot-clé et analyse d'un texte libre
// (« racontez votre rêve ») contre lib/tafsirCorpus.js. Aucune IA externe —
// simple repérage de mots-clés connus dans le texte, même technique que
// lib/abjad.js getElementalOrderFromText (lexique + comptage d'occurrences).
// Aucune dépendance React ni Firebase : entièrement côté client (le corpus
// est statique, rien à valider côté serveur — pas de pages/api/tafsir.js).

import { TAFSIR_CORPUS } from './tafsirCorpus';

export const DREAM_TEXT_MAX = 1000;

// Normalisation : minuscules + suppression des diacritiques, même principe
// que le surlignage de recherche (app/benefits/NameCard.js highlight()).
export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recherche libre par symbole/mot-clé (barre de recherche, catégories) :
 * une entrée correspond si `query` normalisée apparaît dans son label ou
 * l'un de ses mots-clés. Requête vide → tout le corpus. Pure.
 * @param {string} query
 * @param {string|null} categoryId filtre optionnel
 */
export function searchSymbols(query, categoryId) {
  const q = normalizeText(query);
  return TAFSIR_CORPUS.filter((entry) => {
    if (categoryId && entry.category !== categoryId) return false;
    if (!q) return true;
    if (normalizeText(entry.label).includes(q)) return true;
    return entry.keywords.some((k) => normalizeText(k).includes(q) || q.includes(normalizeText(k)));
  });
}

// Compte les occurrences de `needle` dans `haystack` en frontière de MOT
// (\b...\b) — pas un simple .includes() : un mot-clé court comme "or"
// (argent/or) ne doit matcher que le mot « or » isolé, jamais la sous-chaîne
// à l'intérieur de « corpus » ou « correspondent ». `haystack`/`needle` déjà
// normalisés (normalizeText) avant appel.
function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = haystack.match(new RegExp(`\\b${escaped}\\b`, 'g'));
  return matches ? matches.length : 0;
}

/**
 * Analyse un texte libre (le rêve raconté par l'utilisateur) : détecte les
 * symboles CONNUS du corpus qui y apparaissent, triés par nombre
 * d'occurrences décroissant (un symbole mentionné plusieurs fois pèse plus
 * dans la lecture). Pure — aucune IA, un simple comptage déterministe (en
 * frontière de mot, cf. countOccurrences).
 * @param {string} text
 * @returns {Array<{entry: object, hits: number}>}
 */
export function analyzeDream(text) {
  const norm = normalizeText(text).slice(0, DREAM_TEXT_MAX * 2); // marge avant normalisation
  if (!norm) return [];

  const matches = [];
  for (const entry of TAFSIR_CORPUS) {
    let hits = 0;
    for (const kw of entry.keywords) {
      hits += countOccurrences(norm, normalizeText(kw));
    }
    if (hits > 0) matches.push({ entry, hits });
  }
  matches.sort((a, b) => b.hits - a.hits);
  return matches;
}
