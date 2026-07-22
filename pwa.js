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

  // ══════════════════════════════════════════════════════════════
  //  2) INVITE D'INSTALLATION PREMIUM
  //     Objectif : pousser l'installation avec un design soigné et
  //     attractif, sans être intrusif. Deux briques :
  //       • une CARTE modale (bénéfices + CTA fort) montrée à un moment
  //         opportun, ré-affichable après une période de « snooze » ;
  //       • une PASTILLE flottante persistante « Installer l'app » qui
  //         continue d'inciter tant que l'app n'est pas installée.
  //     Android : bouton natif via beforeinstallprompt. iOS : instructions
  //     « Sur l'écran d'accueil » (pas d'API d'installation).
  // ══════════════════════════════════════════════════════════════
  var deferredPrompt = null;
  var isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                     window.navigator.standalone === true;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var SNOOZE_MS = 48 * 3600 * 1000;     // « Plus tard » = repos de 48 h
  var AUTO_DELAY = 2600;                // délai avant l'ouverture auto (ms)

  function alreadyInstalled() {
    return isStandalone || localStorage.getItem("asrar_installed") === "1";
  }
  function snoozedUntil() { return +localStorage.getItem("asrar_install_snooze") || 0; }
  function snooze() {
    try { localStorage.setItem("asrar_install_snooze", String(Date.now() + SNOOZE_MS)); } catch (e) {}
  }
  function canAutoOpen() { return Date.now() > snoozedUntil(); }
  function dismissedThisSession() { return sessionStorage.getItem("asrar_install_dismissed") === "1"; }
  function bumpCount() {
    var n = (+localStorage.getItem("asrar_install_views") || 0) + 1;
    try { localStorage.setItem("asrar_install_views", String(n)); } catch (e) {}
    return n;
  }

  // ── Styles (injectés une seule fois, thémés clair/sombre) ─────
  function injectStyle() {
    if (document.getElementById("asrar-install-style")) return;
    var s = document.createElement("style");
    s.id = "asrar-install-style";
    s.textContent = [
      /* Pastille flottante */
      "#asrar-install-pill{position:fixed;left:16px;bottom:16px;z-index:99998;display:inline-flex;",
      "align-items:center;gap:8px;padding:11px 16px 11px 13px;border-radius:30px;cursor:pointer;",
      "font-family:var(--font-ui,system-ui,sans-serif);font-size:.9rem;font-weight:700;color:#04212b;",
      "border:none;background:linear-gradient(45deg,#4facfe,#00f2fe);box-shadow:0 8px 22px rgba(0,180,255,.35);",
      "animation:aiPillIn .5s cubic-bezier(.2,.9,.25,1) both;transition:transform .15s ease,box-shadow .2s ease;}",
      "#asrar-install-pill:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,180,255,.5);}",
      "#asrar-install-pill .aip-ico{font-size:1.05rem;display:inline-flex;animation:aiBob 2.2s ease-in-out infinite;}",
      "#asrar-install-pill .aip-x{margin-left:2px;width:20px;height:20px;border-radius:50%;display:inline-flex;",
      "align-items:center;justify-content:center;background:rgba(4,33,43,.18);font-size:.75rem;}",
      "@keyframes aiPillIn{from{opacity:0;transform:translateY(16px) scale(.9);}to{opacity:1;transform:none;}}",
      "@keyframes aiBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}",
      /* Overlay + carte */
      "#asrar-install{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-end;justify-content:center;",
      "background:rgba(6,10,18,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);",
      "font-family:var(--font-ui,system-ui,-apple-system,sans-serif);opacity:0;transition:opacity .3s ease;}",
      "#asrar-install.show{opacity:1;}",
      "@media(min-width:600px){#asrar-install{align-items:center;}}",
      ".ai-card{position:relative;overflow:hidden;width:100%;max-width:430px;padding:30px 24px 24px;text-align:center;",
      "background:radial-gradient(120% 90% at 50% -10%,#1c3350 0%,#101d33 45%,#0b1526 100%);color:#fff;",
      "border:1px solid rgba(120,170,255,.22);border-radius:26px 26px 0 0;",
      "box-shadow:0 -12px 50px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06);",
      "transform:translateY(24px);transition:transform .38s cubic-bezier(.2,.9,.25,1);}",
      "#asrar-install.show .ai-card{transform:none;}",
      "@media(min-width:600px){.ai-card{border-radius:26px;}}",
      /* halo décoratif */
      ".ai-card::before{content:'';position:absolute;top:-90px;left:50%;width:260px;height:260px;transform:translateX(-50%);",
      "background:radial-gradient(circle,rgba(79,172,254,.35),transparent 62%);pointer-events:none;}",
      ".ai-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:none;border-radius:50%;",
      "background:rgba(255,255,255,.08);color:#cbd7e6;font-size:.95rem;cursor:pointer;z-index:2;padding:0;line-height:1;}",
      ".ai-close:hover{background:rgba(255,255,255,.16);}",
      ".ai-icon{position:relative;width:96px;height:96px;margin:0 auto 14px;z-index:1;}",
      ".ai-icon img{width:96px;height:96px;border-radius:22px;display:block;",
      "box-shadow:0 10px 30px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.08);}",
      ".ai-badge{display:inline-block;font-size:.62rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;",
      "color:#ffe6a8;background:rgba(201,169,97,.14);border:1px solid rgba(201,169,97,.4);",
      "padding:4px 11px;border-radius:30px;margin-bottom:12px;position:relative;z-index:1;}",
      ".ai-card h3{margin:0 0 6px;font-size:1.5rem;font-weight:700;font-family:var(--font-display,'Cormorant Garamond',serif);",
      "letter-spacing:.4px;position:relative;z-index:1;}",
      ".ai-card h3 span{background:linear-gradient(90deg,#4facfe,#00f2fe);-webkit-background-clip:text;",
      "background-clip:text;-webkit-text-fill-color:transparent;}",
      ".ai-sub{margin:0 0 18px;color:#b8c6d9;font-size:.92rem;line-height:1.55;position:relative;z-index:1;}",
      ".ai-feats{list-style:none;margin:0 0 20px;padding:0;text-align:left;display:grid;gap:10px;position:relative;z-index:1;}",
      ".ai-feats li{display:flex;align-items:center;gap:12px;font-size:.9rem;color:#e4ecf6;}",
      ".ai-feats .aif-ico{flex:none;width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;",
      "justify-content:center;font-size:1.05rem;background:rgba(79,172,254,.14);border:1px solid rgba(79,172,254,.28);}",
      ".ai-cta{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;border:none;border-radius:15px;",
      "padding:16px;font-size:1.02rem;font-weight:800;cursor:pointer;color:#04212b;font-family:inherit;",
      "background:linear-gradient(45deg,#4facfe,#00f2fe);box-shadow:0 10px 26px rgba(0,180,255,.4);",
      "animation:aiPulse 2.4s ease-in-out infinite;transition:transform .12s ease;}",
      ".ai-cta:active{transform:scale(.98);}",
      "@keyframes aiPulse{0%,100%{box-shadow:0 10px 26px rgba(0,180,255,.4);}50%{box-shadow:0 10px 34px rgba(0,180,255,.7);}}",
      ".ai-later{background:none;border:none;color:#8fa2ba;font-size:.86rem;cursor:pointer;padding:12px 6px 2px;",
      "margin:0 auto;display:block;font-family:inherit;}",
      ".ai-later:hover{color:#c3d1e2;}",
      ".ai-steps{text-align:left;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);",
      "border-radius:14px;padding:14px 16px;margin:0 0 6px;font-size:.9rem;line-height:1.9;color:#e4ecf6;position:relative;z-index:1;}",
      ".ai-steps .aist{display:flex;align-items:center;gap:10px;}",
      ".ai-steps .ain{flex:none;width:22px;height:22px;border-radius:50%;background:linear-gradient(45deg,#4facfe,#00f2fe);",
      "color:#04212b;font-weight:800;font-size:.78rem;display:inline-flex;align-items:center;justify-content:center;}",
      ".ai-steps b{color:#7fc4ff;}",
      /* Variante THÈME CLAIR */
      "html[data-theme='light'] .ai-card{background:radial-gradient(120% 90% at 50% -10%,#ffffff 0%,#f3f7fb 55%,#e8eef6 100%);",
      "color:#16202e;border-color:rgba(30,60,110,.14);box-shadow:0 -12px 50px rgba(40,70,110,.22);}",
      "html[data-theme='light'] .ai-sub{color:#5a6b7e;}",
      "html[data-theme='light'] .ai-feats li{color:#26374a;}",
      "html[data-theme='light'] .ai-steps{background:rgba(30,60,110,.05);border-color:rgba(30,60,110,.12);color:#26374a;}",
      "html[data-theme='light'] .ai-close{background:rgba(20,40,70,.08);color:#41546a;}",
      "html[data-theme='light'] .ai-badge{color:#9a6f16;background:rgba(176,133,47,.12);border-color:rgba(176,133,47,.4);}",
      "html[data-theme='light'] .ai-later{color:#6b7c90;}",
      /* Réduction des animations */
      "@media(prefers-reduced-motion:reduce){#asrar-install-pill,#asrar-install-pill .aip-ico,.ai-cta{animation:none !important;}",
      ".ai-card,#asrar-install{transition:none !important;}}"
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  }

  // ── Carte modale ──────────────────────────────────────────────
  function openModal() {
    if (alreadyInstalled() || document.getElementById("asrar-install")) return;
    injectStyle();
    bumpCount();

    var feats = [
      ["⚡", "Accès instantané depuis l'écran d'accueil"],
      ["📴", "Fonctionne même sans connexion internet"],
      ["🕌", "Expérience plein écran, sans barre de navigateur"],
      ["🔔", "Toujours à portée de main, comme une vraie app"]
    ];
    var featHtml = feats.map(function (f) {
      return '<li><span class="aif-ico">' + f[0] + '</span><span>' + f[1] + '</span></li>';
    }).join("");

    var actionHtml = isIOS
      ? '<div class="ai-steps">' +
          '<div class="aist"><span class="ain">1</span><span>Appuyez sur <b>Partager</b> (icône ⬆️ en bas de Safari)</span></div>' +
          '<div class="aist"><span class="ain">2</span><span>Choisissez <b>« Sur l\'écran d\'accueil »</b></span></div>' +
          '<div class="aist"><span class="ain">3</span><span>Appuyez sur <b>Ajouter</b></span></div>' +
        '</div>' +
        '<button class="ai-later" data-act="later">J\'ai compris</button>'
      : '<button class="ai-cta" data-act="install">📲 Installer l\'application</button>' +
        '<button class="ai-later" data-act="later">Plus tard</button>';

    var wrap = document.createElement("div");
    wrap.id = "asrar-install";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "Installer ASRAR PRO");
    wrap.innerHTML =
      '<div class="ai-card">' +
        '<button class="ai-close" data-act="later" aria-label="Fermer">✕</button>' +
        '<div class="ai-icon"><img src="/assets/icon-192.png" alt="ASRAR PRO"></div>' +
        '<div class="ai-badge">Application officielle</div>' +
        '<h3>Installez <span>ASRAR PRO</span></h3>' +
        '<p class="ai-sub">La sagesse mystique dans votre poche — rapide, hors-ligne et en plein écran.</p>' +
        '<ul class="ai-feats">' + featHtml + '</ul>' +
        actionHtml +
      '</div>';

    wrap.addEventListener("click", function (e) {
      var t = e.target;
      var act = t.getAttribute && t.getAttribute("data-act");
      if (!act && t.closest) { var p = t.closest("[data-act]"); if (p) act = p.getAttribute("data-act"); }
      if (!act) {
        if (e.target === wrap) closeModal(true); // clic sur le fond = « plus tard »
        return;
      }
      if (act === "install") return doInstall();
      closeModal(true); // « Plus tard » / « J'ai compris » / ✕
    });

    document.body.appendChild(wrap);
    void wrap.offsetWidth;         // reflow → transition d'entrée
    wrap.classList.add("show");
    showPill();                    // la pastille reste disponible en fond
  }

  function closeModal(userDismissed) {
    var el = document.getElementById("asrar-install");
    if (el) {
      el.classList.remove("show");
      setTimeout(function () { if (el.parentNode) el.remove(); }, 320);
    }
    if (userDismissed) {
      sessionStorage.setItem("asrar_install_dismissed", "1");
      snooze();
      showPill();                  // on continue d'inciter, discrètement
    }
  }

  function doInstall() {
    if (!deferredPrompt) {         // iOS ou prompt indisponible → on garde la carte
      if (!isIOS) closeModal(false);
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (choice) {
      if (choice && choice.outcome === "accepted") {
        localStorage.setItem("asrar_installed", "1");
        removePill();
      } else {
        snooze();
        showPill();
      }
      deferredPrompt = null;
      closeModal(false);
    });
  }

  // ── Pastille flottante persistante ────────────────────────────
  function showPill() {
    if (alreadyInstalled()) return;
    injectStyle();
    if (document.getElementById("asrar-install-pill")) return;
    if (!document.body) { document.addEventListener("DOMContentLoaded", showPill); return; }
    var b = document.createElement("button");
    b.id = "asrar-install-pill";
    b.type = "button";
    b.setAttribute("aria-label", "Installer l'application ASRAR PRO");
    b.innerHTML = '<span class="aip-ico">📲</span><span>Installer l\'app</span>' +
                  '<span class="aip-x" data-act="hide" aria-label="Masquer">✕</span>';
    b.addEventListener("click", function (e) {
      var x = e.target.getAttribute && e.target.getAttribute("data-act");
      if (x === "hide") { e.stopPropagation(); snooze(); removePill(); return; }
      openModal();
    });
    document.body.appendChild(b);
  }
  function removePill() {
    var el = document.getElementById("asrar-install-pill");
    if (el) el.remove();
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();            // on choisit le moment
    deferredPrompt = e;
    if (alreadyInstalled()) return;
    maybeAutoPrompt(false);
  });

  window.addEventListener("appinstalled", function () {
    localStorage.setItem("asrar_installed", "1");
    deferredPrompt = null;
    removePill();
    closeModal(false);
  });

  // Décide d'ouvrir la carte auto, sinon montre au moins la pastille.
  function maybeAutoPrompt(ios) {
    if (alreadyInstalled()) return;
    if (canAutoOpen() && !dismissedThisSession()) {
      setTimeout(function () {
        if (!alreadyInstalled() && !document.getElementById("asrar-install")) openModal();
      }, AUTO_DELAY);
    } else {
      showPill();
    }
  }

  // iOS : pas de beforeinstallprompt → on pilote depuis le chargement.
  document.addEventListener("DOMContentLoaded", function () {
    if (alreadyInstalled()) return;
    injectStyle();
    if (isIOS) maybeAutoPrompt(true);
    else if (!deferredPrompt) showPill(); // navigateur sans prompt (ou pas encore) : pastille
  });

  // Expose une ouverture manuelle éventuelle (ex. bouton « Installer » dans une page).
  window.asrarPromptInstall = function () { if (!alreadyInstalled()) openModal(); };
})();
