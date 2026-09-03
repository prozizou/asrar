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

export function formatPrice(prix, devise) {
  if (!prix) return '';
  const num = parseInt(prix, 10);
  if (isNaN(num)) return prix + ' ' + (devise || '');
  return num.toLocaleString('fr-FR') + ' ' + (devise || 'FCFA');
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
  return { amount: num.toLocaleString('fr-FR'), currency: devise || 'FCFA' };
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
