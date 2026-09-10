// api/_lib/sources.js — Déclare les nœuds de contenu et les champs SENSIBLES.
//
// Le serveur n'autorise que ces nœuds (liste blanche) : le client ne peut donc
// jamais demander un chemin Firebase arbitraire. Les champs "secretFields" ne sont
// JAMAIS renvoyés par /api/list-content (liste/aperçu).
//
// authOnly : si true, /api/get-content ne vérifie PAS l'abonnement (auth seule).
//   → Le Marché : on peut voir la fiche produit et l'acheter SANS abonnement
//     (le paiement, c'est le PRIX DU PRODUIT, pas un abonnement).
//
// MIGRATION FIRESTORE (Phase 3, voir docs/FIRESTORE_SCHEMA.md) : `collection`
// remplace l'ancien `ref` (RTDB) — get-content.js/list-content.js/share.js/
// formation-access.js lisent tous désormais Firestore. `product` était déjà
// passé en Phase 2 ; secret/book/formation/verset/asma suivent ici.

const SECRET_CATS = ["deblocage", "domptage", "ilham", "protection", "ouverture"];

const SOURCES = {
  // Secrets Mystiques : une collection par configuration. Champ payant = "sirr".
  secret: {
    cats: SECRET_CATS,
    collection: (cat) => "secrets_" + cat,
    secretFields: ["sirr", "content"]
  },
  // Bibliothèque Almaqtab : une seule collection. Champ payant = le lien du livre.
  // On accepte l'ancien nom "pdf" ET le nouveau "pdfUrl" (écrit par le panneau admin) :
  // les deux restent masqués de l'aperçu et ne sont révélés qu'aux abonnés (get-content).
  book: {
    collection: () => "books",
    secretFields: ["pdf", "pdfUrl"]
  },
  // Marché : Description + coordonnées vendeur cachées de l'APERÇU, mais
  // visibles dans la fiche (get-content) à tout utilisateur CONNECTÉ (authOnly).
  product: {
    collection: () => "products",
    secretFields: ["description", "number", "email"],
    // privateFields : JAMAIS renvoyés au client, même par get-content (fiche détail).
    // Les coordonnées du vendeur (téléphone, e-mail) restent côté serveur ; le
    // contact passe par /api/wa?product=<clé> qui redirige sans exposer le numéro.
    privateFields: ["number", "email"],
    authOnly: true
  },
  // Versets de référence (suggestions numérologie) — lecture seule, aucun champ secret.
  verset: {
    collection: () => "verset_refs",
    secretFields: []
  },
  // 99 Noms d'Allah — lus par le module Benefits. Toujours servis (Admin SDK) pour que
  // TOUS les utilisateurs voient les noms depuis Firestore ; le verrouillage carte est côté client.
  asma: {
    collection: () => "asma_ul_husna",
    secretFields: []
  },
  // Formation mystique : ateliers/formations en direct par visioconférence.
  // Titre/description/durée/prix/attentes/pricePerMinute toujours visibles
  // (aperçu libre, comme la Bibliothèque). Le lien Google Meet reste un champ
  // secret ici (jamais renvoyé par list-content) MAIS n'est plus révélé via
  // get-content (l'ancien modèle, gated par l'abonnement) : l'accès est
  // désormais payant À LA MINUTE et indépendant de l'abonnement — voir
  // pages/api/formation-access.js (action "join", formation_access/{clé} —
  // ce nœud de crédit reste sur la RTDB, géré par une app d'administration
  // externe, hors du périmètre de cette migration), qui lit le lien
  // directement une fois le crédit de minutes vérifié.
  formation: {
    collection: () => "formations",
    secretFields: ["meetLink"]
  }
};

module.exports = { SOURCES, SECRET_CATS };
