// lib/moduleSearch.js — Recherche PURE dans le catalogue des modules
// (lib/modulesCatalog.tsx). Séparée du catalogue lui-même, qui embarque des
// icônes JSX : ici, aucune dépendance React, donc testable directement
// (lib/moduleSearch.test.js) et réutilisable côté serveur comme client.

// Insensible à la casse ET aux accents ("geomancie" trouve « Géomancie »),
// même normalisation que lib/market.js matchesSearch — les deux recherches
// de l'app se comportent ainsi pareil.
const normalize = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Un module correspond-il à la saisie ? Cherche dans le libellé, la
 * description ET les mots-clés (`keywords`) — ces derniers permettent de
 * retrouver un module par un terme du domaine qui n'apparaît pas dans son
 * nom (« carré magique » → Hatims, « tourab » → Géomancie). Pure. */
export function matchesModule(item, query) {
  const q = normalize(query);
  if (!q) return false;
  const haystack = [item && item.label, item && item.desc, ...((item && item.keywords) || [])]
    .map(normalize)
    .join(' ');
  // Tous les mots saisis doivent être présents (« carre magique » ne doit pas
  // remonter tout ce qui contient seulement « carré »).
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/** Modules correspondant à la saisie, dans l'ordre du catalogue, limités à
 * `limit` (une liste de résultats sous un champ de recherche n'a pas à
 * dérouler les 12 modules). Une saisie vide ne renvoie RIEN — pas tout le
 * catalogue : le tableau de bord montre déjà ce qu'il faut sans recherche.
 * Pure. */
export function searchModules(items, query, limit = 6) {
  if (!normalize(query)) return [];
  return (items || []).filter((it) => matchesModule(it, query)).slice(0, limit);
}
