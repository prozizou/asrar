// ============================================================
//  ASRAR PRO — Contact WhatsApp (remplace PayDunya)
// ------------------------------------------------------------
//  Le NUMÉRO WhatsApp n'est PAS ici : il est stocké côté serveur dans
//  la variable d'environnement Vercel « WHATSAPP_NUMBER » et injecté par
//  la fonction /api/wa. Ce fichier construit seulement le MESSAGE et
//  ouvre /api/wa (qui redirige vers WhatsApp). Le numéro n'apparaît donc
//  jamais dans le code source ni dans les fichiers livrés au navigateur.
//
//  Voir la marche à suivre dans DEPLOIEMENT_WHATSAPP.md.
// ============================================================
(function () {
  "use strict";

  var CONTACT  = "ASRAR PRO";
  var ENDPOINT = "/api/wa";   // fonction serveur : lit WHATSAPP_NUMBER et redirige

  // Catalogue (libellé + prix affiché) — sert à enrichir le message WhatsApp.
  var PLANS = {
    sub_3m:      { label: "Abonnement 3 Mois",   price: "15 000" },
    sub_6m:      { label: "Abonnement 6 Mois",   price: "25 000" },
    sub_1y:      { label: "Abonnement 1 An",     price: "45 000" },
    boutique_1m: { label: "Boutique 1 Mois",     price: "10 000" },
    boutique_3m: { label: "Boutique 3 Mois",     price: "25 000" }
  };

  // Récupère l'e-mail du compte connecté (SDK compat) si dispo — sinon "".
  function currentEmail() {
    try {
      if (typeof firebase !== "undefined" && firebase.auth) {
        var u = firebase.auth().currentUser;
        if (u && u.email) return u.email;
      }
    } catch (e) {}
    return "";
  }

  // Lien vers NOTRE endpoint serveur (qui ajoute le numéro et redirige vers WhatsApp).
  function link(message) {
    return ENDPOINT + "?text=" + encodeURIComponent(message || "");
  }

  // ── Message : demande d'accès premium (contenu / abonnement) ──
  function accessMessage(opts) {
    opts = opts || {};
    var p = opts.planId ? PLANS[opts.planId] : null;
    var L = [
      "Assalamou aleykoum 🌙",
      "Je souhaite activer mon accès premium sur " + CONTACT + ".",
      ""
    ];
    if (opts.email)   L.push("• Compte (e-mail) : " + opts.email);
    if (p)            L.push("• Formule souhaitée : " + p.label + " — " + p.price + " FCFA");
    if (opts.section) L.push("• Rubrique : " + opts.section);
    L.push("");
    L.push("Merci de m'indiquer les modalités de paiement et d'activer mon accès. Barakallahou fikoum.");
    return L.join("\n");
  }

  // ── Message : commande Marché Mystique ──
  function orderMessage(opts) {
    opts = opts || {};
    var items = opts.items || [];
    var devise = opts.devise || "FCFA";
    var L = [
      "Assalamou aleykoum 🌙",
      "Je souhaite passer une commande sur le Marché Mystique de " + CONTACT + ".",
      ""
    ];
    if (opts.email) L.push("• Compte (e-mail) : " + opts.email);
    L.push("• Articles :");
    items.forEach(function (it) {
      var qty = it.quantity || 1;
      var line = "   - " + (it.name || "Article") + " × " + qty;
      if (it.price != null) line += " — " + (it.price * qty).toLocaleString("fr-FR") + " " + devise;
      L.push(line);
    });
    if (opts.total != null) {
      L.push("");
      L.push("• Total : " + Number(opts.total).toLocaleString("fr-FR") + " " + devise);
    }
    L.push("");
    L.push("Merci de me confirmer la disponibilité et les modalités.");
    return L.join("\n");
  }

  function openAccess(opts) {
    opts = opts || {};
    if (!opts.email) opts.email = currentEmail();
    window.open(link(accessMessage(opts)), "_blank", "noopener");
  }

  function openOrder(opts) {
    opts = opts || {};
    if (!opts.email) opts.email = currentEmail();
    window.open(link(orderMessage(opts)), "_blank", "noopener");
  }

  window.ASRAR_WA = {
    contact: CONTACT,
    plans: PLANS,
    link: link,
    accessMessage: accessMessage,
    orderMessage: orderMessage,
    openAccess: openAccess,
    openOrder: openOrder
  };
})();
