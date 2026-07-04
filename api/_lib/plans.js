// api/_lib/plans.js — Catalogue des offres ASRAR PRO.
// SOURCE UNIQUE DE VÉRITÉ : prix (FCFA) et durée. Utilisé par create-invoice
// (pour fixer le montant côté serveur) ET par grant/sellers (pour l'expiration).
// Le navigateur n'envoie JAMAIS le montant : il ne choisit qu'un productId.
//
// type :
//   "content" → abonnement au contenu premium (grantAccess → purchased_user)
//   "shop"    → abonnement BOUTIQUE vendeur (grantSeller → sellers/{uid})

const PLANS = {
  // — Abonnements au contenu —
  sub_3m:   { label: "Abonnement 3 Mois",   amount: 15000,  days: 90,  type: "content" },
  sub_6m:   { label: "Abonnement 6 Mois",   amount: 25000,  days: 180, type: "content" },
  sub_1y:   { label: "Abonnement 1 An",     amount: 45000,  days: 365, type: "content" },
  sub_life: { label: "Premium à Vie",       amount: 100000, lifetime: true, type: "content" },

  // — Abonnements BOUTIQUE (droit de vendre sur le Marché) —
  boutique_1m: { label: "Boutique 1 Mois",  amount: 10000, days: 30, type: "shop" },
  boutique_3m: { label: "Boutique 3 Mois",  amount: 25000, days: 90, type: "shop" }
};

module.exports = { PLANS };
