// viewmode.js — Bascule GLOBALE « Vue PC / Vue Mobile », persistée.
// Injecte un bouton flottant 💻/📱 (au-dessus du bouton de thème) qui force la
// largeur du viewport : en « Vue PC », la page est rendue à 1024px CSS puis
// mise à l'échelle par l'appareil (utile pour consulter la mise en page bureau
// depuis un téléphone) ; en « Vue Mobile », on rend la main au responsive natif.
(function () {
  var KEY = 'asrar_viewmode';
  var DESKTOP_WIDTH = 1024;
  var root = document.documentElement;

  // Récupère (ou crée) la balise <meta name="viewport">.
  function viewportMeta() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'viewport');
      (document.head || root).appendChild(m);
    }
    return m;
  }

  function mode() {
    try { return localStorage.getItem(KEY) === 'desktop' ? 'desktop' : 'mobile'; }
    catch (e) { return 'mobile'; }
  }

  function label() { return mode() === 'desktop' ? '📱' : '💻'; }
  function title()  { return mode() === 'desktop' ? 'Passer en vue mobile' : 'Passer en vue PC'; }

  function apply() {
    var m = viewportMeta();
    if (mode() === 'desktop') {
      m.setAttribute('content', 'width=' + DESKTOP_WIDTH);
      root.classList.add('view-desktop');
      root.classList.remove('view-mobile');
    } else {
      m.setAttribute('content', 'width=device-width, initial-scale=1');
      root.classList.add('view-mobile');
      root.classList.remove('view-desktop');
    }
    var b = document.getElementById('asrarViewBtn');
    if (b) { b.textContent = label(); b.title = title(); b.setAttribute('aria-label', title()); }
  }

  // Applique le plus tôt possible (avant le rendu final quand c'est faisable).
  apply();

  window.asrarToggleViewMode = function () {
    var next = mode() === 'desktop' ? 'mobile' : 'desktop';
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply();
  };

  function injectBtn() {
    if (document.getElementById('asrarViewBtn')) return;
    var b = document.createElement('button');
    b.id = 'asrarViewBtn';
    b.type = 'button';
    b.title = title();
    b.setAttribute('aria-label', title());
    b.textContent = label();
    // Positionné juste au-dessus du bouton de thème (🌙/☀️) pour ne pas le masquer.
    b.style.cssText = 'position:fixed;right:16px;bottom:70px;z-index:99999;width:46px;height:46px;' +
      'border-radius:50%;border:1px solid rgba(150,150,150,.4);background:rgba(40,40,45,.85);' +
      'color:#f5e6c4;font-size:1.15rem;cursor:pointer;backdrop-filter:blur(6px);' +
      'box-shadow:0 4px 14px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;';
    b.onclick = window.asrarToggleViewMode;
    document.body.appendChild(b);
  }

  if (document.body) injectBtn();
  else document.addEventListener('DOMContentLoaded', injectBtn);
})();
