// loader.js — Loader plein écran affiché à chaque chargement de page ASRAR PRO.
// Se cache automatiquement une fois la page prête (délai minimum pour éviter
// le clignotement sur connexion rapide). Toute page peut aussi appeler
// window.asrarHideLoader() explicitement dès que son propre contenu est prêt
// (ex: après la résolution de l'utilisateur Firebase).
(function () {
  var MIN_MS = 350;
  var start = Date.now();
  var hidden = false;

  function hide() {
    if (hidden) return;
    hidden = true;
    var el = document.getElementById('asrar-loader');
    if (!el) return;
    var wait = Math.max(0, MIN_MS - (Date.now() - start));
    setTimeout(function () {
      el.classList.add('asrar-loader-hide');
      setTimeout(function () { el.remove(); }, 400);
    }, wait);
  }

  window.asrarHideLoader = hide;

  // Repli : si aucune page n'appelle asrarHideLoader() explicitement,
  // on masque quand même une fois que tout (images, scripts…) est chargé.
  window.addEventListener('load', function () {
    setTimeout(hide, 500);
  });
})();
