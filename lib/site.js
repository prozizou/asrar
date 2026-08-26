// lib/site.js — URL de base du site (SITE_URL), normalisée en UN SEUL
// endroit — partagée par app/layout.js (metadataBase), server/http.js (CORS)
// et pages/api/share.js (liens de partage/Open Graph), qui lisaient jusqu'ici
// chacun process.env.SITE_URL brut, sans validation de schéma.
//
// Pourquoi : une valeur mal renseignée dans les Environment Variables Vercel
// (ex. "www.asrarpro.com" au lieu de "https://www.asrarpro.com" — schéma
// absent) faisait planter le BUILD EN PRODUCTION (`new URL()` lève
// `TypeError: Invalid URL` dans app/layout.js) — et aurait aussi silencieusement
// cassé le CORS (`Access-Control-Allow-Origin: www.asrarpro.com`, sans schéma,
// rejeté par les navigateurs) et produit des liens de partage/og:image
// invalides, sans qu'aucun de ces deux derniers cas ne fasse échouer le build
// (seulement visible en utilisant l'app). Cette fonction ajoute `https://`
// par défaut quand le schéma manque, pour que la configuration reste
// tolérante à ce genre d'erreur de saisie.

/**
 * @param {string|undefined} raw process.env.SITE_URL (peut être vide, absent,
 *   ou sans schéma)
 * @param {string} [fallback] valeur de repli si `raw` est vide — DOIT déjà
 *   porter un schéma (ex. 'https://www.asrarpro.com'), pas re-normalisée.
 * @returns {string} URL sans slash final, garantie de porter http(s):// dès
 *   qu'il y a une valeur (raw ou fallback) — chaîne vide si aucune des deux.
 */
export function normalizeSiteUrl(raw, fallback) {
  const v = String(raw || '').trim();
  if (!v) return fallback || '';
  const withScheme = /^https?:\/\//i.test(v) ? v : 'https://' + v;
  return withScheme.replace(/\/+$/, '');
}
