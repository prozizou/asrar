// Utilitaires du Marché Mystique — port des helpers de marche.js.

// Identifiant STABLE d'un vendeur : l'email (l'uid peut changer d'un produit à
// l'autre et dupliquerait la même boutique).
export function vendorKey(p) {
  return (p.email && String(p.email).toLowerCase()) || p.uid || p.vendeurId || 'inconnu';
}

// Firebase interdit . # $ / [ ] dans les clés : on assainit l'email.
export function safeKey(k) {
  return String(k).replace(/[.#$/[\]]/g, '_');
}

// 1 → "1", 1000 → "1k", 12500 → "12,5k", 1000000 → "1M"
export function formatCount(n) {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 1000000) {
    const v = n / 1000;
    return (v < 10 ? v.toFixed(1).replace(/\.0$/, '').replace('.', ',') : Math.floor(v)) + 'k';
  }
  const v = n / 1000000;
  return (v < 10 ? v.toFixed(1).replace(/\.0$/, '').replace('.', ',') : Math.floor(v)) + 'M';
}

// toLocaleString('fr-FR') sépare les milliers par une espace fine
// INSÉCABLE (U+202F, pas U+0020) — correct au sens Unicode, mais beaucoup de
// polices/moteurs de rendu mobiles l'affichent quasiment sans chasse : "650
// 000" se lit alors comme "650000" collé (revue design Marché, retour
// utilisateur : « 880000 FCFA moins facile à lire »). On la remplace par une
// espace normale, dont le rendu est fiable partout.
const thousands = (num) => num.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');

export function formatPrice(prix, devise) {
  if (!prix) return '';
  const num = parseInt(prix, 10);
  if (isNaN(num)) return prix + ' ' + (devise || '');
  return thousands(num) + ' ' + (devise || 'FCFA');
}

// Montant et devise séparés — pour afficher la devise en plus petit à côté
// d'un montant, sans que celui-ci n'écrase le nom du produit sur une carte
// dense (revue design Marché, point 9 : « 650 000 FCFA domine beaucoup trop »).
// Même formatage numérique que formatPrice(), juste rendu en deux morceaux
// au lieu d'une seule chaîne — formatPrice() reste inchangée pour ses autres
// appelants (ProductModal, VendorShop du panneau vendeur, commandes…).
export function splitPrice(prix, devise) {
  if (!prix) return null;
  const num = parseInt(prix, 10);
  if (isNaN(num)) return { amount: String(prix), currency: devise || '' };
  return { amount: thousands(num), currency: devise || 'FCFA' };
}

// Recherche produit (revue design Marché, point 5) : insensible à la casse
// et aux accents ("secrete" retrouve "Secrète") — sans lib externe, juste la
// normalisation Unicode déjà utilisée ailleurs dans le projet (lib/abjad.js,
// lib/tafsirLogic.js).
const normalizeText = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function matchesSearch(productName, query) {
  const q = normalizeText(query).trim();
  if (!q) return true;
  return normalizeText(productName).includes(q);
}

// Normalise la casse d'un nom de produit À L'AFFICHAGE seulement (jamais la
// donnée stockée, ni ce qui part dans le message WhatsApp de commande — voir
// ProductModal.js) : les fiches sont saisies librement par chaque vendeur
// (« BAGUE DE RICHESSE », « Mohibat youssouf »…) et se retrouvent còte à côte
// dans la même grille (revue design Marché : « titres incohérents, mélangent
// casse et styles »). Une seule règle simple et prévisible plutôt que de
// deviner au cas par cas ce qui est un nom propre : chaque mot commence par
// une majuscule, le reste en minuscules (accents gérés par toUpperCase()
// nativement). Compromis assumé : un sigle interne comme "ASRAR" devient
// "Asrar" — cohérence entre toutes les cartes prime ici sur l'exactitude
// typographique de chaque titre pris isolément.
export function displayProductName(name) {
  const s = String(name || '').trim();
  if (!s) return '';
  return s.toLowerCase().replace(/(^|[\s'-])\S/g, (c) => c.toUpperCase());
}

// Catégories de produit (champ `chain`, saisi à la création — voir
// app/boutique/ProductForm.js) : liste UNIQUE partagée avec le filtre par
// catégorie du Marché (app/page.tsx, revue design point 5) — une seule
// source de vérité plutôt que deux listes qui pourraient diverger.
export const CHAINS = ['Secret', 'chaîne', 'encens', 'bague', 'livre', 'autres'];

// Reconstruit la liste des vendeurs à partir des métadonnées produits.
export function extractVendors(products) {
  const map = new Map();
  products.forEach((p) => {
    const id = vendorKey(p);
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: p.vendeur || 'Vendeur inconnu',
        avatar: p.vendeurAvatar || '',
        location: p.vendeurLocation || '',
        verified: p.vendeurVerifie === true || p.vendeurVerifie === 'true',
        rating: p.vendeurNote || '0.0',
        specialty: p.vendeurSpecialty || 'Produits mystiques',
        bio: p.vendeurBio || '',
      });
    }
  });
  return Array.from(map.values());
}

// Score de popularité : achats (×5) > likes (×3) > commentaires.
export function scorePopularite(pop, key) {
  const s = pop[key];
  if (!s) return 0;
  return s.orders * 5 + s.likes * 3 + s.comments;
}
