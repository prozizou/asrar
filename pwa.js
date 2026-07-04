// pwa.js — Contrôleur PWA d'ASRAR PRO (chargé sur toutes les pages).
//   1) Enregistre le SW racine /sw.js (scope "/").
//   2) MISE À JOUR SUR PLACE : dès qu'un nouveau SW est prêt, on l'active et on
//      recharge la page automatiquement (une seule fois, sans boucle).
//   3) Invite d'installation insistante (Android/Chrome via beforeinstallprompt,
//      iOS via instructions « Sur l'écran d'accueil »).
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  var ROOT = location.origin + "/";
  var refreshing = false;

  // ── 1) Enregistrement + nettoyage des anciens SW de sous-dossier ──
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(function (reg) {

    // Purge des anciens SW à scope restreint (ex. /Benefits/sw.js) → un seul SW racine.
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { if (r.scope !== ROOT) r.unregister(); });
    });

    // Un SW est déjà en attente (nouvelle version) → on l'active tout de suite.
    if (reg.waiting && navigator.serviceWorker.controller) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    // Nouvelle version détectée pendant la session.
    reg.addEventListener("updatefound", function () {
      var nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", function () {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          nw.postMessage({ type: "SKIP_WAITING" }); // → déclenche controllerchange
        }
      });
    });

    // Vérifier les mises à jour au retour sur l'app (réouverture d'onglet, focus).
    var checkUpdate = function () { reg.update().catch(function () {}); };
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") checkUpdate();
    });
    window.addEventListener("focus", checkUpdate);
    setInterval(checkUpdate, 60 * 60 * 1000); // filet de sécurité horaire
  }).catch(function () { /* enregistrement impossible : app reste utilisable en ligne */ });

  // Le contrôleur a changé (nouveau SW actif) → recharge unique = « mise à jour sur place ».
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  // ── 2) Invite d'installation ────────────────────────────────
  var deferredPrompt = null;
  var isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                     window.navigator.standalone === true;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  function alreadyInstalled() {
    return isStandalone || localStorage.getItem("asrar_installed") === "1";
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();           // on gère nous-mêmes le moment
    deferredPrompt = e;
    if (!alreadyInstalled()) showInstallUI(false);
  });

  window.addEventListener("appinstalled", function () {
    localStorage.setItem("asrar_installed", "1");
    deferredPrompt = null;
    removeInstallUI();
  });

  // iOS ne déclenche pas beforeinstallprompt : on montre des instructions.
  document.addEventListener("DOMContentLoaded", function () {
    if (alreadyInstalled()) return;
    if (isIOS) showInstallUI(true);
  });

  function dismissedThisSession() { return sessionStorage.getItem("asrar_install_dismissed") === "1"; }

  function showInstallUI(ios) {
    if (alreadyInstalled() || dismissedThisSession()) return;
    if (document.getElementById("asrar-install")) return;

    var wrap = document.createElement("div");
    wrap.id = "asrar-install";
    wrap.innerHTML =
      '<style>' +
      '#asrar-install{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);font-family:system-ui,-apple-system,"Inter",sans-serif;}' +
      '@media(min-width:600px){#asrar-install{align-items:center;}}' +
      '.ai-box{background:#0f2027;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:22px 22px 0 0;max-width:460px;width:100%;padding:22px 20px 26px;text-align:center;box-shadow:0 -8px 30px rgba(0,0,0,.5);}' +
      '@media(min-width:600px){.ai-box{border-radius:22px;}}' +
      '.ai-box img{width:88px;height:88px;border-radius:20px;display:block;margin:0 auto 12px;}' +
      '.ai-box h3{margin:0 0 4px;font-size:1.2rem;}' +
      '.ai-box p{margin:0 0 16px;color:#cfd8dc;font-size:.9rem;line-height:1.5;}' +
      '.ai-btn{display:block;width:100%;border:none;border-radius:14px;padding:14px;font-size:1rem;font-weight:700;cursor:pointer;background:linear-gradient(45deg,#4facfe,#00f2fe);color:#04212b;margin-bottom:10px;}' +
      '.ai-later{background:none;border:none;color:#9fb3c8;font-size:.85rem;cursor:pointer;padding:6px;}' +
      '.ai-steps{text-align:left;background:rgba(255,255,255,.06);border-radius:14px;padding:12px 14px;margin-bottom:14px;font-size:.9rem;line-height:1.7;}' +
      '.ai-steps b{color:#00f2fe;}' +
      '</style>' +
      '<div class="ai-box">' +
      '<img src="/assets/icon-192.png" alt="ASRAR PRO">' +
      '<h3>Installer ASRAR PRO</h3>' +
      '<p>Installez l\'application pour un accès rapide, en plein écran et hors-ligne.</p>' +
      (ios
        ? '<div class="ai-steps">1. Appuyez sur <b>Partager</b> (l\'icône ⬆️ en bas de Safari).<br>' +
          '2. Choisissez <b>« Sur l\'écran d\'accueil »</b>.<br>' +
          '3. Appuyez sur <b>Ajouter</b>.</div>' +
          '<button class="ai-later" data-act="close">J\'ai compris</button>'
        : '<button class="ai-btn" data-act="install">📲 Installer maintenant</button>' +
          '<button class="ai-later" data-act="later">Plus tard</button>') +
      '</div>';

    wrap.addEventListener("click", function (e) {
      var act = e.target.getAttribute && e.target.getAttribute("data-act");
      if (!act) { if (e.target === wrap) { /* clic hors boîte : on garde l'invite */ } return; }
      if (act === "install") return doInstall();
      // « Plus tard » / « J'ai compris » : masqué pour cette session seulement
      sessionStorage.setItem("asrar_install_dismissed", "1");
      removeInstallUI();
    });

    document.body.appendChild(wrap);
  }

  function doInstall() {
    if (!deferredPrompt) { removeInstallUI(); return; }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (choice) {
      if (choice && choice.outcome === "accepted") {
        localStorage.setItem("asrar_installed", "1");
      } else {
        sessionStorage.setItem("asrar_install_dismissed", "1");
      }
      deferredPrompt = null;
      removeInstallUI();
    });
  }

  function removeInstallUI() {
    var el = document.getElementById("asrar-install");
    if (el) el.remove();
  }
})();
