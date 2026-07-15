// ============================================================
//  ASRAR PRO — Partage (deep links) & Parrainage — côté client
// ------------------------------------------------------------
//  1) LIENS PARTAGEABLES
//     Chaque élément (secret, livre, produit) possède une URL courte :
//       https://<site>/s?k=secret&c=deblocage&i=<clé>&r=<code parrain>
//     → /api/share renvoie un aperçu (Open Graph : titre + image) pour
//       WhatsApp / Facebook / TikTok, puis redirige vers la page du hub
//       avec ?item=<clé>&cat=<cat>, que ce fichier sait relire.
//
//  2) PARRAINAGE
//     Le paramètre ?r=<code> est mémorisé (30 j) dès l'arrivée, puis envoyé
//     à /api/referral (action "claim") à la première connexion du filleul.
//     C'est le SERVEUR qui décide s'il crédite les points (anti-triche).
//
//  REQUIERT : firebase-app-compat + firebase-auth-compat + firebase-config.js
// ============================================================
(function () {
  "use strict";

  var REF_KEY   = "asrar_ref";          // { code, at }
  var CLAIM_KEY = "asrar_ref_claimed";  // code déjà transmis au serveur
  var REF_TTL   = 30 * 24 * 60 * 60 * 1000; // 30 jours
  var ENDPOINT  = "/api/referral";

  // Types partageables → page cible (doit rester aligné avec api/share.js).
  var TARGETS = {
    secret:  "/asrar/asrar.html",
    book:    "/bibliotheque/bibliotheque.html",
    product: "/marche/marche.html"
  };

  var _me = null;      // cache de /api/referral { code, points, ... }
  var _mePromise = null;

  // ── Utilitaires ─────────────────────────────────────────────
  function qs(name) {
    try { return new URLSearchParams(window.location.search).get(name); }
    catch (e) { return null; }
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function cleanCode(c) {
    return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  }

  // ── Appel /api/referral avec le jeton Firebase ──────────────
  function post(action, extra) {
    var u = (typeof firebase !== "undefined" && firebase.auth) ? firebase.auth().currentUser : null;
    if (!u) return Promise.reject(new Error("Non connecté."));
    return u.getIdToken().then(function (t) {
      var body = { idToken: t, action: action };
      for (var k in (extra || {})) body[k] = extra[k];
      return fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw Object.assign(new Error(d.error || "Erreur serveur."), { status: r.status });
        return d;
      });
    });
  }

  // ── Mon tableau de bord parrainage (mis en cache) ───────────
  function me(force) {
    if (force) { _me = null; _mePromise = null; }
    if (_me) return Promise.resolve(_me);
    if (_mePromise) return _mePromise;
    _mePromise = post("me").then(function (d) { _me = d; _mePromise = null; return d; })
                           .catch(function (e) { _mePromise = null; throw e; });
    return _mePromise;
  }

  // ── Construction des liens ──────────────────────────────────
  // opts = { kind:'secret'|'book'|'product', cat?, key? } ; kind absent = lien de l'app.
  function buildUrl(opts, code) {
    opts = opts || {};
    var p = [];
    if (opts.kind && TARGETS[opts.kind]) {
      p.push("k=" + encodeURIComponent(opts.kind));
      if (opts.cat) p.push("c=" + encodeURIComponent(opts.cat));
      if (opts.key) p.push("i=" + encodeURIComponent(opts.key));
    }
    if (code) p.push("r=" + encodeURIComponent(code));
    return window.location.origin + "/s" + (p.length ? "?" + p.join("&") : "");
  }

  // Lien AVEC le code de parrainage du visiteur (si connecté) — asynchrone.
  function link(opts) {
    return me().then(function (m) { return buildUrl(opts, m && m.code); })
               .catch(function () { return buildUrl(opts, null); });
  }

  // ── Partage natif (Web Share) avec repli presse-papiers ─────
  function share(opts) {
    opts = opts || {};
    return link(opts).then(function (url) {
      var title = opts.title || "ASRAR PRO";
      var text  = (opts.text || title) + "\n";
      if (navigator.share) {
        return navigator.share({ title: title, text: text, url: url })
          .catch(function (e) { if (e && e.name !== "AbortError") copy(url); });
      }
      return copy(url);
    }).catch(function () { toast("Partage indisponible."); });
  }

  function copy(url) {
    var done = function () { toast("🔗 Lien copié : " + url); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url).then(done).catch(function () { prompt("Copiez le lien :", url); });
    }
    var ta = document.createElement("textarea");
    ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { prompt("Copiez le lien :", url); }
    ta.remove();
    return Promise.resolve();
  }

  // Petit toast discret (pas de dépendance).
  function toast(msg) {
    var el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99999;" +
      "max-width:88vw;background:rgba(15,32,39,.96);color:#fff;border:1px solid rgba(201,169,97,.5);" +
      "border-radius:12px;padding:12px 18px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4);" +
      "word-break:break-all;text-align:center;";
    document.body.appendChild(el);
    setTimeout(function () { el.style.transition = "opacity .4s"; el.style.opacity = "0"; }, 2600);
    setTimeout(function () { el.remove(); }, 3100);
  }

  // ── Lecture du deep link sur la page cible ──────────────────
  // Renvoie { key, cat } ou null. `clean()` retire les paramètres de l'URL.
  function deepLink() {
    var key = qs("item");
    if (!key) return null;
    return { key: key, cat: qs("cat") || null };
  }
  function clean() {
    try {
      var u = new URL(window.location.href);
      ["item", "cat", "r"].forEach(function (p) { u.searchParams.delete(p); });
      window.history.replaceState({}, document.title, u.pathname + (u.search || "") + u.hash);
    } catch (e) {}
  }

  // ── Capture du code de parrainage à l'arrivée ───────────────
  function captureRef() {
    var r = cleanCode(qs("r"));
    if (!r) return;
    if (lsGet(CLAIM_KEY)) return;      // ce navigateur a déjà parrainé un compte
    lsSet(REF_KEY, JSON.stringify({ code: r, at: Date.now() }));
  }
  function storedRef() {
    try {
      var v = JSON.parse(lsGet(REF_KEY) || "null");
      if (!v || !v.code) return null;
      if (Date.now() - (v.at || 0) > REF_TTL) { lsDel(REF_KEY); return null; }
      return v.code;
    } catch (e) { return null; }
  }

  // ── Transmission au serveur à la connexion (une seule fois) ─
  var _claiming = false;
  function claim() {
    if (_claiming || lsGet(CLAIM_KEY)) return;
    var code = storedRef();
    if (!code) return;
    _claiming = true;
    post("claim", { code: code }).then(function () {
      lsSet(CLAIM_KEY, code);   // le serveur a tranché : on ne renvoie plus
      lsDel(REF_KEY);
    }).catch(function () { /* réseau : on retentera à la prochaine visite */ })
      .then(function () { _claiming = false; });
  }

  captureRef();
  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(function (u) { if (u) claim(); });
  }

  window.ASRAR_SHARE = {
    targets: TARGETS,
    buildUrl: buildUrl,
    link: link,
    share: share,
    copy: copy,
    toast: toast,
    deepLink: deepLink,
    clean: clean,
    me: me,
    post: post
  };
})();
