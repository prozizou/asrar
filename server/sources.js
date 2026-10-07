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
    // privateFields : JAMAIS renvoyés au client, même par get-content (fiche détail).
    // Les coordonnées du vendeur (téléphone, e-mail) restent côté serveur ; le
    // contact passe par /api/wa?product=<clé> qui redirige sans exposer le numéro.
    privateFields: ["number", "email"],
    authOnly: true
  },
  // Boutiques (fiches vendeur du Marché) : nœud profile_clients, créé par l'admin.
  // Source UNIQUE du nom, du logo et de la description affichés pour une boutique
  // (au lieu des copies vendeur* recopiées dans chaque produit). Liste seulement
  // (listOnly : refusé par get-content) et uniquement les champs publics listés
  // ci-dessous — email, téléphone et uid ne sortent jamais du serveur ; le
  // contact passe par /api/wa. `vendorKey` (calculé par list-content à partir de
  // l'email) relie la fiche aux produits.
  shop: {
    ref: () => "profile_clients",
    secretFields: [],
    publicFields: ["profile_name", "img", "description"],
    listOnly: true
  },
  // Versets de référence (suggestions numérologie) — lecture seule, aucun champ secret.
  verset: {
    ref: () => "versetRef",
    secretFields: []
  },
  // 99 Noms d'Allah — lus par lib/benefits.js (module Rouwhanes). Toujours servis
  // (Admin SDK) pour que TOUS les utilisateurs voient les noms depuis le RTDB.
  asma: {
    ref: () => "data/appData/asmaUlHusna",
    secretFields: []
  },
  // Formation mystique : ateliers/formations en direct par visioconférence.
  // Titre/description/durée/prix/attentes/pricePerMinute toujours visibles
  // (aperçu libre, comme la Bibliothèque). Le lien Google Meet reste un champ
  // secret ici (jamais renvoyé par list-content) MAIS n'est plus révélé via
  // get-content (l'ancien modèle, gated par l'abonnement) : l'accès est
  // désormais payant À LA MINUTE et indépendant de l'abonnement — voir
  // pages/api/formation-access.js (action "join", formation_access/{clé}),
  // qui lit le lien directement une fois le crédit de minutes vérifié.
  formation: {
    ref: () => "formations",
    secretFields: ["meetLink"]
  }
};

/**
 * Champs d'un élément exposés par /api/list-content : liste blanche
 * (`publicFields`) quand la source en déclare une, sinon tout sauf `secretFields`.
 */
function listFields(src, value) {
  const v = value || {};
  const out = {};
  for (const k of Object.keys(v)) {
    const ok = src.publicFields ? src.publicFields.includes(k) : !src.secretFields.includes(k);
    if (ok) out[k] = v[k];
  }
  return out;
}

module.exports = { SOURCES, SECRET_CATS, listFields };
