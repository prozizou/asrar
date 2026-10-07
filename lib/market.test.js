import { describe, it, expect } from 'vitest';
import {
  vendorKey,
  emailVendorKey,
  safeKey,
  formatCount,
  formatPrice,
  splitPrice,
  matchesSearch,
  displayProductName,
  extractVendors,
  shopProfiles,
  formatProductCount,
  scorePopularite,
  CHAINS,
} from './market';

describe('vendorKey', () => {
  it('utilise le vendorKey déjà calculé côté serveur (list-content.js) quand présent', () => {
    expect(vendorKey({ vendorKey: 'v_abc123', email: 'x@y.com', uid: 'abc' })).toBe('v_abc123');
  });

  it("sinon dérive un identifiant stable et non réversible de l'email (insensible à la casse)", () => {
    const k1 = vendorKey({ email: 'Vendeur@Exemple.com', uid: 'abc' });
    const k2 = vendorKey({ email: 'vendeur@exemple.com', uid: 'xyz-different-uid' });
    expect(k1).toBe(k2); // même email, uid différent → même boutique
    expect(k1).toBe(emailVendorKey('vendeur@exemple.com'));
    expect(k1).not.toContain('exemple.com'); // ne doit jamais exposer l'email en clair
  });

  it("retombe sur uid puis vendeurId puis 'inconnu'", () => {
    expect(vendorKey({ uid: 'abc' })).toBe('abc');
    expect(vendorKey({ vendeurId: 'v1' })).toBe('v1');
    expect(vendorKey({})).toBe('inconnu');
  });
});

describe('emailVendorKey', () => {
  it('est stable et insensible à la casse/aux espaces', () => {
    expect(emailVendorKey('A@B.com')).toBe(emailVendorKey('a@b.com'));
    expect(emailVendorKey(' a@b.com ')).toBe(emailVendorKey('a@b.com'));
  });

  it('produit des clés différentes pour des emails différents', () => {
    expect(emailVendorKey('a@b.com')).not.toBe(emailVendorKey('c@d.com'));
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
  it('formate un prix avec séparateur de milliers et devise', () => {
    expect(formatPrice(15000, 'FCFA')).toBe('15 000 FCFA');
  });

  it('utilise FCFA par défaut si la devise est absente', () => {
    expect(formatPrice(500, undefined)).toBe('500 FCFA');
  });

  it("renvoie une chaîne vide pour un prix falsy", () => {
    expect(formatPrice(0, 'FCFA')).toBe('');
    expect(formatPrice(null, 'FCFA')).toBe('');
  });

  // Revue design Marché (retour utilisateur) : toLocaleString('fr-FR') sépare
  // les milliers par une espace fine INSÉCABLE (U+202F), pas une espace
  // normale (U+0020) — beaucoup de polices mobiles l'affichent quasiment sans
  // chasse, "650 000" se lisant alors comme "650000" collé. On vérifie ici le
  // caractère EXACT produit (pas de normalisation \s dans le test, justement
  // pour attraper une régression sur ce point précis).
  it('sépare les milliers par une VRAIE espace, pas une espace fine insécable', () => {
    const price = formatPrice(880000, 'FCFA');
    expect(price).toBe('880 000 FCFA');
    expect(price).not.toContain(' ');
    expect(price).not.toContain(' ');
  });
});

describe('splitPrice', () => {
  it('sépare montant et devise', () => {
    const r = splitPrice(650000, 'FCFA');
    expect(r.amount).toBe('650 000');
    expect(r.currency).toBe('FCFA');
  });

  it('utilise FCFA par défaut si la devise est absente', () => {
    expect(splitPrice(500, undefined)).toEqual({ amount: '500', currency: 'FCFA' });
  });

  it('renvoie null pour un prix falsy (comme formatPrice renvoie "")', () => {
    expect(splitPrice(0, 'FCFA')).toBeNull();
    expect(splitPrice(null, 'FCFA')).toBeNull();
  });

  it("sépare les milliers par une VRAIE espace, pas une espace fine insécable", () => {
    const r = splitPrice(880000, 'FCFA');
    expect(r.amount).toBe('880 000');
    expect(r.amount).not.toContain(' ');
  });
});

describe('displayProductName', () => {
  it('met en majuscule la première lettre de chaque mot', () => {
    expect(displayProductName('BAGUE DE RICHESSE')).toBe('Bague De Richesse');
    expect(displayProductName('Mohibat youssouf')).toBe('Mohibat Youssouf');
  });

  it('gère les traits d\'union et apostrophes comme des séparateurs de mot', () => {
    expect(displayProductName("secret d'amour bien-être")).toBe("Secret D'Amour Bien-Être");
  });

  it('renvoie une chaîne vide pour une entrée absente', () => {
    expect(displayProductName(undefined)).toBe('');
    expect(displayProductName('')).toBe('');
  });

  it('ignore les espaces superflues en tête/fin', () => {
    expect(displayProductName('  encens de myrrhe  ')).toBe('Encens De Myrrhe');
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
    expect(vendors[0]).toMatchObject({ id: emailVendorKey('a@x.com'), name: 'Boutique A', verified: true });
    expect(vendors[1]).toMatchObject({ id: emailVendorKey('b@x.com'), name: 'Boutique B' });
  });

  it("ne duplique PAS la boutique quand l'uid diffère entre deux produits du même vendeur (compte recréé)", () => {
    const products = [
      { vendorKey: emailVendorKey('a@x.com'), uid: 'ancien-uid', vendeur: 'Boutique A' },
      { vendorKey: emailVendorKey('a@x.com'), uid: 'nouvel-uid', vendeur: 'Boutique A' },
    ];
    expect(extractVendors(products)).toHaveLength(1);
  });
});

describe('fiches boutique (profile_clients)', () => {
  const key = emailVendorKey('a@x.com');
  const shops = [
    { _key: 'p1', vendorKey: key, profile_name: 'Maison Baraka', img: 'https://img/logo.png', description: 'Encens et chaînes' },
    { _key: 'p2', profile_name: 'Sans clé' },
  ];

  it('shopProfiles indexe par vendorKey et ignore les fiches sans clé', () => {
    expect(shopProfiles(shops)).toEqual({
      [key]: { name: 'Maison Baraka', avatar: 'https://img/logo.png', bio: 'Encens et chaînes' },
    });
    expect(shopProfiles(null)).toEqual({});
  });

  it('extractVendors : nom, logo et description viennent de profile_clients', () => {
    const products = [{ email: 'a@x.com', vendeur: 'Ancien nom', vendeurAvatar: 'ancien.png', vendeurBio: 'ancienne bio' }];
    expect(extractVendors(products, shops)[0]).toMatchObject({
      id: key, name: 'Maison Baraka', avatar: 'https://img/logo.png', bio: 'Encens et chaînes',
    });
  });

  it('extractVendors : repli sur les champs du produit sans fiche, ou fiche partielle', () => {
    const products = [{ email: 'b@x.com', vendeur: 'Boutique B', vendeurAvatar: 'b.png', vendeurBio: 'bio B' }];
    expect(extractVendors(products, shops)[0]).toMatchObject({ name: 'Boutique B', avatar: 'b.png', bio: 'bio B' });
    const partielle = [{ vendorKey: key, profile_name: 'Seul le nom' }];
    expect(extractVendors([{ email: 'a@x.com', vendeurAvatar: 'garde.png' }], partielle)[0])
      .toMatchObject({ name: 'Seul le nom', avatar: 'garde.png' });
  });

  it('extractVendors : une fiche sans produit est listée, après les boutiques qui en ont', () => {
    const vide = [{ _key: 'p3', vendorKey: emailVendorKey('vide@x.com'), profile_name: 'Mon chapelet', img: 'c.png', description: 'desc' }];
    const vendors = extractVendors([{ email: 'a@x.com', vendeur: 'A' }], [...vide, ...shops]);
    expect(vendors.map((v) => v.name)).toEqual(['Maison Baraka', 'Mon chapelet']);
    expect(vendors[1]).toMatchObject({ id: emailVendorKey('vide@x.com'), avatar: 'c.png', bio: 'desc', verified: false, location: '' });
  });

  it('extractVendors : une fiche sans nom devient « Boutique » ; sans identifiant elle est ignorée', () => {
    const sansNom = [{ vendorKey: emailVendorKey('z@x.com') }, { vendorKey: 'inconnu', profile_name: 'Orpheline' }];
    expect(extractVendors([], sansNom).map((v) => v.name)).toEqual(['Boutique']);
  });

  it('extractVendors : deux fiches de même vendorKey → une seule (la première)', () => {
    const doublon = [
      { vendorKey: key, profile_name: 'Première' },
      { vendorKey: key, profile_name: 'Seconde' },
    ];
    expect(extractVendors([], doublon)).toHaveLength(1);
    expect(extractVendors([], doublon)[0].name).toBe('Première');
  });

  it('extractVendors sans fiches : comportement inchangé', () => {
    expect(extractVendors([{ email: 'a@x.com', vendeur: 'A' }])[0].name).toBe('A');
  });
});

describe('cartes boutique : nombre de produits', () => {
  it('formatProductCount', () => {
    expect(formatProductCount(0)).toBe('Aucun produit');
    expect(formatProductCount(1)).toBe('1 produit');
    expect(formatProductCount(6)).toBe('6 produits');
    expect(formatProductCount(undefined)).toBe('Aucun produit');
  });

  it('extractVendors compte les produits de chaque boutique (0 pour une fiche sans produit)', () => {
    const products = [
      { email: 'a@x.com', vendeur: 'A' }, { email: 'a@x.com', vendeur: 'A' }, { email: 'b@x.com', vendeur: 'B' },
    ];
    const fiches = [{ vendorKey: emailVendorKey('c@x.com'), profile_name: 'C' }];
    expect(extractVendors(products, fiches).map((v) => [v.name, v.productCount])).toEqual([['A', 2], ['B', 1], ['C', 0]]);
  });

  it("pas de spécialité par défaut (le texte « Produits mystiques » n'est plus inventé)", () => {
    expect(extractVendors([{ email: 'a@x.com', vendeur: 'A' }])[0].specialty).toBe('');
    expect(extractVendors([{ email: 'a@x.com', vendeurSpecialty: 'Encens' }])[0].specialty).toBe('Encens');
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
