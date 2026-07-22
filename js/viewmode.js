// viewmode.js — Bascule GLOBALE « Vue PC / Vue Mobile », persistée.
//
// Deux mécanismes COMBINÉS pour que le basculement soit TOUJOURS visible,
// aussi bien sur téléphone que sur ordinateur (les navigateurs de bureau
// ignorent la balise <meta viewport>, d'où l'ajout d'un rendu CSS) :
//
//   • Vue PC  : viewport forcé à 1024px → sur mobile, la page se rend en
//               disposition bureau (dézoomée). Sur PC : disposition normale.
//   • Vue Mobile : viewport = largeur de l'appareil + sur GRAND écran (PC),
//               le contenu est contraint dans une colonne « téléphone »
//               centrée, encadrée, pour prévisualiser le rendu mobile.
//
// Par défaut (aucun choix mémorisé) on suit la nature de l'appareil : un
// grand écran démarre en « PC », un petit écran en « Mobile ». Le premier
// clic bascule donc toujours vers l'autre mode → effet immédiat garanti.
(function () {
  var KEY = 'asrar_viewmode';
  var DESKTOP_WIDTH = 1024;
  var root = document.documentElement;

  function naturalMode() {
    try {
      return window.matchMedia('(max-width: 820px)').matches ? 'mobile' : 'desktop';
    } catch (e) { return 'desktop'; }
  }

  function storedMode() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function mode() {
    var s = storedMode();
    return (s === 'desktop' || s === 'mobile') ? s : naturalMode();
  }

  function viewportMeta() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'viewport');
      (document.head || root).appendChild(m);
    }
    return m;
  }

  // Feuille de style injectée UNE fois : rend visible la « Vue Mobile » sur PC.
  function injectStyle() {
    if (document.getElementById('asrar-viewmode-style')) return;
    var s = document.createElement('style');
    s.id = 'asrar-viewmode-style';
    s.textContent =
      /* Cadre « téléphone » : uniquement sur grand écran, là où c'est utile. */
      '@media (min-width: 620px){' +
      '  html.view-mobile{background:var(--bg-gradient) !important;background-attachment:fixed !important;}' +
      '  html.view-mobile body{max-width:460px !important;margin-left:auto !important;' +
      '    margin-right:auto !important;min-height:100vh !important;' +
      '    box-shadow:0 0 0 1px var(--border,rgba(0,0,0,.2)),0 18px 55px rgba(0,0,0,.5) !important;}' +
      '}' +
      /* Les deux boutons flottants restent collés au bord de l'écran réel. */
      '#asrarViewBtn,#asrarThemeBtn{position:fixed !important;}';
    (document.head || root).appendChild(s);
  }

  function label() { return mode() === 'desktop' ? '💻' : '📱'; }
  function title()  { return mode() === 'desktop' ? 'Vue PC active — passer en vue mobile'
                                                  : 'Vue mobile active — passer en vue PC'; }

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

  apply(); // le plus tôt possible

  window.asrarToggleViewMode = function () {
    var next = mode() === 'desktop' ? 'mobile' : 'desktop';
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply();
  };

  function injectBtn() {
    injectStyle();
    if (document.getElementById('asrarViewBtn')) return;
    var b = document.createElement('button');
    b.id = 'asrarViewBtn';
    b.type = 'button';
    b.title = title();
    b.setAttribute('aria-label', title());
    b.textContent = label();
    // Juste au-dessus du bouton de thème (🌙/☀️) pour ne pas le masquer.
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
