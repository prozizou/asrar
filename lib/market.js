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
