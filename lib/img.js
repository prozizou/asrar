// lib/img.js — Optimisation d'images à la volée via Cloudinary.
//
// Injecte f_auto (choix automatique du format : WebP/AVIF selon le navigateur)
// et q_auto (compression intelligente sans perte visible) dans les URLs
// Cloudinary. On peut aussi passer une largeur cible pour ne jamais télécharger
// une image plus grande que son emplacement d'affichage (c_limit + dpr_auto
// gèrent les écrans Retina proprement).
//
// Les URLs non-Cloudinary (photo Google, assets locaux, blob de prévisualisation)
// sont renvoyées telles quelles : le helper est donc sûr à appliquer partout.

export function optimImg(url, width) {
  if (!url || typeof url !== 'string') return url;
  if (!/res\.cloudinary\.com/.test(url)) return url;

  const marker = '/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;

  const start = i + marker.length;
  const after = url.slice(start);
  // Déjà optimisée (transfo f_/q_ présente juste après /upload/) → on ne double pas.
  if (/^(f_auto|q_auto|f_|q_)/.test(after)) return url;

  const t = ['f_auto', 'q_auto'];
  if (width) t.push('w_' + width, 'c_limit', 'dpr_auto');

  return url.slice(0, start) + t.join(',') + '/' + after;
}
