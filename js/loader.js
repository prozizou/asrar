// loader.js — Loader plein écran + numéro de version + toast de mise à jour.
//
//  1) Loader plein écran affiché à chaque chargement de page ASRAR PRO.
//     Se cache automatiquement une fois la page prête (délai minimum pour
//     éviter le clignotement). Toute page peut appeler window.asrarHideLoader().
//  2) Affiche le numéro de version sur l'écran de démarrage (splash).
//  3) Toast « Application mise à jour » : si la version a changé depuis la
//     dernière visite (comparaison localStorage), on informe l'utilisateur.
//
//  ⚠️  ASRAR_VERSION doit rester synchronisé avec SW_VERSION dans /sw.js.
(function () {
  var ASRAR_VERSION = 'v31';                   // ← synchroniser avec sw.js
  window.ASRAR_VERSION = ASRAR_VERSION;

  var MIN_MS = 350;
  var start = Date.now();
  var hidden = false;

  // ── Styles injectés (autonomes : version splash + toast) ──────
  function injectStyle() {
    if (document.getElementById('asrar-loader-style')) return;
    var s = document.createElement('style');
    s.id = 'asrar-loader-style';
    s.textContent =
      '.asrar-loader-ver{margin-top:10px;font-size:11px;letter-spacing:.08em;' +
      'font-family:sans-serif;color:var(--text-faint,#888);opacity:.85;}' +
      '#asrar-update-toast{position:fixed;top:-80px;left:50%;transform:translateX(-50%);' +
      'z-index:100001;display:flex;align-items:center;gap:10px;max-width:calc(100% - 32px);' +
      'padding:11px 14px;border-radius:14px;font-family:var(--font-ui,system-ui,sans-serif);' +
      'font-size:.88rem;color:var(--text-main,#fff);background:var(--glass-bg,rgba(30,35,45,.92));' +
      'border:1px solid var(--glass-border,rgba(255,255,255,.2));' +
      'box-shadow:0 10px 30px rgba(0,0,0,.35);backdrop-filter:blur(10px);' +
      '-webkit-backdrop-filter:blur(10px);transition:top .45s cubic-bezier(.2,.8,.2,1),opacity .35s ease;}' +
      '#asrar-update-toast.show{top:16px;}' +
      '#asrar-update-toast .aut-ico{font-size:1.05rem;line-height:1;}' +
      '#asrar-update-toast .aut-txt{flex:1;line-height:1.35;}' +
      '#asrar-update-toast .aut-txt b{color:var(--accent,#4facfe);}' +
      '#asrar-update-toast .aut-x{background:none;border:none;color:var(--text-muted,#bbb);' +
      'cursor:pointer;font-size:1rem;padding:2px 4px;margin:0;width:auto;line-height:1;}';
    (document.head || document.documentElement).appendChild(s);
  }

  // ── 1) Masquage du loader ─────────────────────────────────────
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

  // ── 2) Numéro de version sur le splash ────────────────────────
  function stampVersion() {
    var el = document.getElementById('asrar-loader');
    if (!el || el.querySelector('.asrar-loader-ver')) return;
    var v = document.createElement('div');
    v.className = 'asrar-loader-ver';
    v.textContent = 'ASRAR PRO · ' + ASRAR_VERSION;
    el.appendChild(v);
  }

  // ── 3) Toast de mise à jour ───────────────────────────────────
  function showUpdateToast(fromVer) {
    if (document.getElementById('asrar-update-toast')) return;
    var t = document.createElement('div');
    t.id = 'asrar-update-toast';
    t.setAttribute('role', 'status');
    t.innerHTML =
      '<span class="aut-ico">✨</span>' +
      '<span class="aut-txt">Application mise à jour — <b>' + ASRAR_VERSION + '</b></span>' +
      '<button class="aut-x" aria-label="Fermer">✕</button>';
    document.body.appendChild(t);
    // forcer un reflow puis animer l'entrée
    void t.offsetWidth;
    t.classList.add('show');

    var timer = setTimeout(dismiss, 6000);
    function dismiss() {
      clearTimeout(timer);
      t.classList.remove('show');
      t.style.opacity = '0';
      setTimeout(function () { if (t.parentNode) t.remove(); }, 460);
    }
    t.querySelector('.aut-x').addEventListener('click', dismiss);
  }

  function checkVersionChange() {
    var last = null;
    try { last = localStorage.getItem('asrar_last_version'); } catch (e) {}
    if (last && last !== ASRAR_VERSION) showUpdateToast(last);
    try { localStorage.setItem('asrar_last_version', ASRAR_VERSION); } catch (e) {}
  }

  // ── Boot ──────────────────────────────────────────────────────
  function boot() {
    injectStyle();
    stampVersion();
  }
  if (document.getElementById('asrar-loader') || document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);

  // Repli : masquer le loader une fois tout chargé, puis vérifier la version.
  window.addEventListener('load', function () {
    setTimeout(hide, 500);
    // Après la disparition du splash, on montre l'éventuel toast de mise à jour.
    setTimeout(checkVersionChange, 1000);
  });
})();
