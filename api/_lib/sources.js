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
    secretFields: ["sirr"]
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
  }
};

module.exports = { SOURCES, SECRET_CATS };
