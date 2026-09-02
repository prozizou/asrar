// lib/reviews.js — Avis (étoiles + texte) des boutiques et formations : logique
// PURE, partagée client (import ESM) et serveur (require CommonJS, pages/api/
// social.js — la validation qui FAIT autorité), même interop que lib/zikrLogic.js.
//
// Un avis est un COMMENTAIRE (comments/{cat}/{key}/{id}, pages/api/social.js)
// qui porte en plus un champ `stars` (1-5) — pas un système parallèle : la
// liste, la modération et le stockage restent ceux des commentaires existants
// (Marché, Secrets). `stars` absent/invalide = un commentaire ordinaire, pas
// un avis (n'entre pas dans la moyenne) — cf. avgStars ci-dessous.
//
// ATTENTION à ne pas confondre avec le nœud RTDB `ratings/{cat}/{key}/{uid}`
// (pages/api/social.js) : malgré son nom, il porte les LIKES (♥ j'aime), pas
// une note en étoiles — d'où le nom `stars` ici, jamais `rating`.

export const STARS_MIN = 1;
export const STARS_MAX = 5;

// Entier 1-5 valide, sinon null (pas d'étoile = commentaire ordinaire).
export function cleanStars(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= STARS_MIN && n <= STARS_MAX ? n : null;
}

// Moyenne + nombre d'avis (commentaires portant `stars`) à partir d'une liste
// OU d'un objet Firebase brut ({id: {stars, ...}}) — accepte les deux formes
// pour servir aussi bien un `comments` déjà normalisé côté client qu'un nœud
// RTDB brut lu en bulk côté serveur (pages/api/social.js "vendor-likes"/
// "formation-popularity").
export function avgStars(commentsObjOrArray) {
  const list = Array.isArray(commentsObjOrArray)
    ? commentsObjOrArray
    : Object.values(commentsObjOrArray || {});
  let sum = 0;
  let count = 0;
  for (const c of list) {
    const s = cleanStars(c && c.stars);
    if (s != null) { sum += s; count++; }
  }
  return { avg: count > 0 ? sum / count : 0, count };
}
