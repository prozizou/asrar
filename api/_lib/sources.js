// api/_lib/sources.js — Déclare les nœuds de contenu et les champs SENSIBLES.
//
// Le serveur n'autorise que ces nœuds (liste blanche) : le client ne peut donc
// jamais demander un chemin Firebase arbitraire. Les champs "secretFields" ne sont
// JAMAIS renvoyés par /api/list-content (liste/aperçu).
//
// authOnly : si true, /api/get-content ne vérifie PAS l'abonnement (auth seule).
//   → Le Marché : on peut voir la fiche produit et l'acheter SANS abonnement
//     (le paiement, c'est le PRIX DU PRODUIT, pas un abonnement).

const SECRET_CATS = ["deblocage", "domptage", "ilham", "protection", "ouverture"];

const SOURCES = {
  // Secrets Mystiques : un nœud par configuration. Champ payant = "sirr".
  secret: {
    cats: SECRET_CATS,
    ref: (cat) => "db_sirr_" + cat,
    secretFields: ["sirr", "content"]
  },
  // Bibliothèque Almaqtab : un seul nœud. Champ payant = le lien du livre.
  // On accepte l'ancien nom "pdf" ET le nouveau "pdfUrl" (écrit par le panneau admin) :
  // les deux restent masqués de l'aperçu et ne sont révélés qu'aux abonnés (get-content).
  book: {
    ref: () => "almaqtab",
    secretFields: ["pdf", "pdfUrl"]
  },
  // Marché : un seul nœud. Description + coordonnées vendeur cachées de l'APERÇU,
  // mais visibles dans la fiche (get-content) à tout utilisateur CONNECTÉ (authOnly).
  product: {
    ref: () => "det_produits",
    secretFields: ["description", "number", "email"],
    authOnly: true
  },
  // Versets de référence (suggestions numérologie) — lecture seule, aucun champ secret.
  verset: {
    ref: () => "versetRef",
    secretFields: []
  },
  // 99 Noms d'Allah — lus par le module Benefits. Toujours servis (Admin SDK) pour que
  // TOUS les utilisateurs voient les noms depuis le RTDB ; le verrouillage carte est côté client.
  asma: {
    ref: () => "data/appData/asmaUlHusna",
    secretFields: []
  }
};

module.exports = { SOURCES, SECRET_CATS };
