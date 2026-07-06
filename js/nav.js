// nav.js — Comportement du bouton "retour" : depuis une page de SECTION, le retour
// ramène directement à l'accueil (au lieu de rejouer toute la chaîne des pages
// consultées). Sur l'accueil (ou la racine), le retour garde le comportement normal.
(function () {
  var p = location.pathname;
  var isHome = p === '/' || p === '/index.html' || /\/accueil\/accueil\.html$/.test(p);
  if (isHome) return;

  // On piège un cran d'historique : le 1er "retour" déclenche popstate → accueil.
  try { history.pushState({ asrarNav: true }, '', location.href); } catch (e) {}
  window.addEventListener('popstate', function () {
    location.href = '/accueil/accueil.html';
  });
})();
