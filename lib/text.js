// lib/text.js — Normalisation d'affichage pour du texte saisi librement par
// les auteurs de contenu (secrets, boutique, formation…), PAS pour changer
// les données stockées : ne touche jamais Firebase, seulement ce qui est
// affiché à l'écran.
//
// Motivation (revue design du module Secrets, cf. app/asrar) : les titres
// (`faida`) mélangent des casses très différentes selon l'auteur —
// « Pour dompter n'importe qui » à côté de « AVOIR L'AMOUR DES GENS ÊTRE UNE
// STAR » — ce qui donne une impression d'incohérence typographique. Corriger
// la CASSE RÉELLE en base n'est pas fait ici (données de contenu, hors
// périmètre d'une passe d'affichage, et risqué à réécrire en masse sans
// validation éditoriale) : uniquement la version affichée est adoucie.

/**
 * Si `str` est ENTIÈREMENT en majuscules (aucune minuscule présente, mais au
 * moins UNE lettre — donc jamais déclenché sur un texte déjà mixte, un
 * nombre seul, ou un texte purement arabe, qui n'a pas de casse), la renvoie
 * en casse de phrase (première lettre en majuscule, reste en minuscule).
 * Sinon la renvoie INCHANGÉE — jamais de correction sur un titre déjà casé
 * intentionnellement (ex. un sigle au milieu d'une phrase mixte).
 *
 * `toUpperCase`/`toLowerCase` sont sensibles aux accents (É, À…) et
 * no-op sur les caractères arabes (pas de notion de casse) : sûr sur le
 * contenu mixte FR/arabe de ce projet (voir lib/format.js splitMixed, qui
 * segmente par script AVANT tout rendu — cette fonction s'applique sur la
 * chaîne brute, en amont, sans connaissance du script).
 * @param {string} str
 * @returns {string}
 */
export function sentenceCaseIfShouting(str) {
  if (!str) return str;
  const s = String(str);
  const hasLowercase = s !== s.toUpperCase(); // au moins une lettre à casse variable
  if (hasLowercase) return s; // déjà mixte (ou pas de lettre du tout) : ne pas toucher
  if (s === s.toLowerCase()) return s; // aucune lettre à casse (arabe pur, chiffres…) : rien à corriger
  const trimmed = s.trimStart();
  const lead = s.slice(0, s.length - trimmed.length); // espaces éventuels en tête, préservés
  if (!trimmed) return s;
  return lead + trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}
