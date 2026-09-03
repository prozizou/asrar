import { describe, it, expect } from 'vitest';
import { vendorKey, safeKey, formatCount, formatPrice, splitPrice, matchesSearch, extractVendors, scorePopularite, CHAINS } from './market';

describe('vendorKey', () => {
  it("préfère l'email (en minuscules) comme identifiant stable", () => {
    expect(vendorKey({ email: 'Vendeur@Exemple.com', uid: 'abc' })).toBe('vendeur@exemple.com');
  });

  it("retombe sur uid puis vendeurId puis 'inconnu'", () => {
    expect(vendorKey({ uid: 'abc' })).toBe('abc');
    expect(vendorKey({ vendeurId: 'v1' })).toBe('v1');
    expect(vendorKey({})).toBe('inconnu');
  });
});

describe('safeKey', () => {
  it('remplace les caractères interdits dans une clé Firebase', () => {
    expect(safeKey('a.b#c$d/e[f]g')).toBe('a_b_c_d_e_f_g');
  });
});

describe('formatCount', () => {
  it('affiche les petits nombres tels quels', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });

  it('abrège les milliers en "k" (1 décimale sous 10k, entier au-delà)', () => {
    expect(formatCount(1000)).toBe('1k');
    expect(formatCount(2500)).toBe('2,5k');
    expect(formatCount(12500)).toBe('12k');
    expect(formatCount(50000)).toBe('50k');
  });

  it('abrège les millions en "M"', () => {
    expect(formatCount(1000000)).toBe('1M');
    expect(formatCount(2500000)).toBe('2,5M');
  });

  it('traite une entrée non numérique comme 0', () => {
    expect(formatCount(undefined)).toBe('0');
  });
});

describe('formatPrice', () => {
  // toLocaleString('fr-FR') insère un espace (parfois insécable selon l'ICU) :
  // on normalise avant de comparer pour ne pas dépendre de la version de Node.
  const norm = (s) => s.replace(/\s/g, ' ');

  it('formate un prix avec séparateur de milliers et devise', () => {
    expect(norm(formatPrice(15000, 'FCFA'))).toBe('15 000 FCFA');
  });

  it('utilise FCFA par défaut si la devise est absente', () => {
    expect(norm(formatPrice(500, undefined))).toBe('500 FCFA');
  });

  it("renvoie une chaîne vide pour un prix falsy", () => {
    expect(formatPrice(0, 'FCFA')).toBe('');
    expect(formatPrice(null, 'FCFA')).toBe('');
  });
});

describe('splitPrice', () => {
  const norm = (s) => s.replace(/\s/g, ' ');

  it('sépare montant et devise', () => {
    const r = splitPrice(650000, 'FCFA');
    expect(norm(r.amount)).toBe('650 000');
    expect(r.currency).toBe('FCFA');
  });

  it('utilise FCFA par défaut si la devise est absente', () => {
    expect(splitPrice(500, undefined)).toEqual({ amount: '500', currency: 'FCFA' });
  });

  it('renvoie null pour un prix falsy (comme formatPrice renvoie "")', () => {
    expect(splitPrice(0, 'FCFA')).toBeNull();
    expect(splitPrice(null, 'FCFA')).toBeNull();
  });
});

describe('matchesSearch', () => {
  it('insensible à la casse et aux accents', () => {
    expect(matchesSearch('Secrète du Prophète', 'secrete')).toBe(true);
    expect(matchesSearch('Secrète du Prophète', 'SECRÈTE')).toBe(true);
  });

  it('sous-chaîne, pas correspondance exacte', () => {
    expect(matchesSearch('Encens de myrrhe', 'myrrhe')).toBe(true);
    expect(matchesSearch('Encens de myrrhe', 'encens')).toBe(true);
  });

  it('une requête vide accepte tout', () => {
    expect(matchesSearch('Quoi que ce soit', '')).toBe(true);
    expect(matchesSearch('Quoi que ce soit', '   ')).toBe(true);
  });

  it('ne trouve pas ce qui est absent', () => {
    expect(matchesSearch('Encens de myrrhe', 'bague')).toBe(false);
  });
});

describe('CHAINS', () => {
  it('liste non vide de catégories, sans doublon', () => {
    expect(CHAINS.length).toBeGreaterThan(0);
    expect(new Set(CHAINS).size).toBe(CHAINS.length);
  });
});

describe('extractVendors', () => {
  it('déduplique par vendorKey et prend les métadonnées de la première occurrence', () => {
    const products = [
      { email: 'a@x.com', vendeur: 'Boutique A', vendeurVerifie: true },
      { email: 'a@x.com', vendeur: 'Boutique A (autre produit)' },
      { email: 'b@x.com', vendeur: 'Boutique B' },
    ];
    const vendors = extractVendors(products);
    expect(vendors).toHaveLength(2);
    expect(vendors[0]).toMatchObject({ id: 'a@x.com', name: 'Boutique A', verified: true });
    expect(vendors[1]).toMatchObject({ id: 'b@x.com', name: 'Boutique B' });
  });
});

describe('scorePopularite', () => {
  it('pondère achats > likes > commentaires (5 / 3 / 1)', () => {
    expect(scorePopularite({ p1: { orders: 2, likes: 3, comments: 4 } }, 'p1')).toBe(2 * 5 + 3 * 3 + 4);
  });

  it('renvoie 0 pour une clé sans statistiques', () => {
    expect(scorePopularite({}, 'inconnu')).toBe(0);
  });
});
