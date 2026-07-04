// access.js — Contrôle d'abonnement pour « Rouwhanes » (rouwhania).
// Chargé AVANT script.js. Intercepte le bouton « Calculer » : sans abonnement,
// le clic ouvre le portail de paiement au lieu de lancer le calcul.
//
// Même projet/origine que le hub ASRAR PRO → la session Google est reconnue ici
// automatiquement (pas de reconnexion). SDK compat (comme le hub).
(function () {
  "use strict";

  var firebaseConfig = {
    apiKey:            "AIzaSyBLzPKzbiNYitUz7sv9Ftqm0oF20rA32Zk",
    authDomain:        "asrar-bc059.firebaseapp.com",
    databaseURL:       "https://asrar-bc059.firebaseio.com",
    projectId:         "asrar-bc059",
    storageBucket:     "asrar-bc059.appspot.com",
    messagingSenderId: "199810893447",
    appId:             "1:199810893447:web:044629472e10f9eb68da22"
  };

  if (typeof firebase === "undefined") { console.warn("Firebase SDK absent (Rouwhania)"); return; }
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db   = firebase.database();
  try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}

  var SUPER_ADMIN = "prozizou298@gmail.com";
  var emailToKey  = function (e) { return e ? e.replace(/\./g, ",") : null; };

  var SUB_PLANS = [
    { id: "sub_3m",   dur: "3 Mois",        price: "15 000" },
    { id: "sub_6m",   dur: "6 Mois",        price: "25 000" },
    { id: "sub_1y",   dur: "1 An",          price: "45 000",  best: true, badge: "Populaire" }
  ];

  var state = "unknown"; // 'unknown' | 'ok' | 'locked'

  function authReady() {
    return new Promise(function (resolve) {
      var off = auth.onAuthStateChanged(function (u) { off(); resolve(u); });
    });
  }
  function safeOnce(path) {
    return db.ref(path).once("value").then(function (s) { return s.exists() ? s.val() : null; })
                                     .catch(function () { return undefined; });
  }

  function resolveAccess() {
    return (auth.currentUser ? Promise.resolve(auth.currentUser) : authReady()).then(function (user) {
      if (!user || !user.email) return false;
      if (user.email === SUPER_ADMIN) return true;
      var key = emailToKey(user.email);
      return Promise.all([
        safeOnce("purchased_user/" + key),
        safeOnce("allowedUsers/"  + key),
        safeOnce("admins/"        + key),
        safeOnce("vip_users/"     + user.uid)
      ]).then(function (r) {
        var pur = r[0], allowed = r[1], admin = r[2], vip = r[3];
        var isAdmin = admin === true;
        var isVip   = vip !== null && vip !== undefined;
        var notExpired = !pur || pur.expiresAt === "lifetime" || pur.expiresAt == null ||
                         (typeof pur.expiresAt === "number" && pur.expiresAt > Date.now());
        var hasToken = !!(pur && pur.token) && notExpired;
        var legacy = allowed === true || (typeof allowed === "number" && allowed > Date.now());
        return isAdmin || isVip || hasToken || legacy;
      });
    }).catch(function () { return false; });
  }

  function startSubscription(productId, noteEl) {
    var user = auth.currentUser;
    if (!user) { window.location.href = "../index.html"; return; } // pas connecté → login hub
    if (!window.ASRAR_WA) {
      if (noteEl) noteEl.textContent = "Contactez l'administration pour activer votre accès.";
      return;
    }
    if (noteEl) noteEl.textContent = "Ouverture de WhatsApp…";
    window.ASRAR_WA.openAccess({ planId: productId, email: user.email, section: "Rouwhanes" });
  }

  function showGate() {
    if (document.getElementById("rw-overlay")) return;
    var cards = SUB_PLANS.map(function (p) {
      return '<div class="rw-card ' + (p.best ? "best" : "") + '" data-plan="' + p.id + '">' +
        (p.badge ? '<span class="rw-badge">' + p.badge + "</span>" : "") +
        '<div class="rw-dur">' + p.dur + "</div>" +
        '<div class="rw-price">' + p.price + " <small>FCFA</small></div></div>";
    }).join("");

    var ov = document.createElement("div");
    ov.id = "rw-overlay";
    ov.dir = "ltr";
    ov.innerHTML =
      '<style>' +
      '#rw-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(5px);}' +
      '.rw-box{background:#0f2027;border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:26px 22px;text-align:center;max-width:560px;width:100%;position:relative;color:#fff;font-family:system-ui,Arial,sans-serif;}' +
      '.rw-close{position:absolute;top:12px;right:16px;cursor:pointer;font-size:1.5rem;color:#cfd8dc;line-height:1;}.rw-close:hover{color:#fff;}' +
      '.rw-box h2{margin:8px 0 2px;font-weight:600;}.rw-sub{color:#cfd8dc;margin-bottom:18px;font-size:.92rem;}' +
      '.rw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;}' +
      '.rw-card{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.2);border-radius:16px;padding:18px 12px;cursor:pointer;position:relative;transition:transform .2s,border-color .2s,box-shadow .2s;}' +
      '.rw-card:hover{transform:translateY(-4px);border-color:#4facfe;box-shadow:0 8px 22px rgba(79,172,254,.35);}' +
      '.rw-card.best{border-color:#00f2fe;}.rw-dur{font-size:1.05rem;font-weight:600;}' +
      '.rw-price{margin-top:6px;font-size:1.25rem;font-weight:700;background:linear-gradient(45deg,#4facfe,#00f2fe);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}' +
      '.rw-price small{font-size:.68rem;color:#cfd8dc;-webkit-text-fill-color:#cfd8dc;}' +
      '.rw-badge{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(45deg,#4facfe,#00f2fe);color:#fff;font-size:.6rem;font-weight:600;padding:3px 10px;border-radius:20px;white-space:nowrap;}' +
      '#rw-note{margin-top:16px;font-size:.8rem;color:#cfd8dc;min-height:16px;}' +
      '</style>' +
      '<div class="rw-box"><span class="rw-close" aria-label="Fermer">✕</span>' +
      '<div style="font-size:2rem;">🔒</div><h2>Abonnement requis</h2>' +
      '<p class="rw-sub">Abonnez-vous pour lancer le calcul des Rouwhanes et débloquer tout le contenu ASRAR PRO.</p>' +
      '<div class="rw-grid">' + cards + "</div>" +
      '<p id="rw-note">💬 Cliquez sur une formule pour envoyer votre demande via WhatsApp.</p></div>';

    var note = ov.querySelector("#rw-note");
    ov.querySelector(".rw-close").addEventListener("click", function () { ov.remove(); });
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    Array.prototype.forEach.call(ov.querySelectorAll(".rw-card"), function (c) {
      c.addEventListener("click", function () { startSubscription(c.getAttribute("data-plan"), note); });
    });
    document.body.appendChild(ov);
  }

  // Compat : nettoie d'anciens paramètres ?token=... d'URL (plus de paiement en ligne).
  function confirmReturn() {
    var url = new URL(location.href);
    if (!url.searchParams.has("token") && !url.searchParams.has("canceled")) return Promise.resolve(false);
    url.searchParams.delete("token"); url.searchParams.delete("canceled");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
    return Promise.resolve(true);
  }

  // ── Interception du bouton « Calculer » (phase de capture, avant script.js) ──
  function installGate() {
    var btn = document.getElementById("btnExtract");
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      if (state === "ok") return; // abonné → on laisse script.js calculer
      e.stopImmediatePropagation();
      e.preventDefault();
      if (state === "locked") { showGate(); return; }
      // état inconnu : on vérifie puis on ré-émet le clic si l'accès est accordé
      resolveAccess().then(function (ok) {
        state = ok ? "ok" : "locked";
        if (ok) btn.click(); else showGate();
      });
    }, true);
  }

  function boot() {
    installGate();
    confirmReturn().then(function () {
      resolveAccess().then(function (ok) { state = ok ? "ok" : "locked"; });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
