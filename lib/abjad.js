// abjad.js

export const maghrebiAbjad = {
    'ا': 1, 'أ': 1, 'إ': 1, 'آ': 1, 'ء': 1,
    'ب': 2, 'ج': 3, 'د': 4, 'ه': 5, 'ة': 5,
    'و': 6, 'ؤ': 6, 'ز': 7, 'ح': 8, 'ط': 9,
    'ي': 10, 'ى': 10, 'ئ': 10,
    'ك': 20, 'ل': 30, 'م': 40, 'ن': 50,
    'ص': 60, 'ع': 70, 'ف': 80, 'ض': 90, 'ق': 100,
    'ر': 200, 'س': 300, 'ت': 400, 'ث': 500,
    'خ': 600, 'ذ': 700, 'ظ': 800, 'غ': 900, 'ش': 1000
};

export function calculatePoidsMystique(arabicName) {
    if (!arabicName) return 0;
    const cleanName = arabicName.replace(/[\u064B-\u065F\u0670]/g, '');
    let weight = 0;
    for (let i = 0; i < cleanName.length; i++) {
        if (maghrebiAbjad[cleanName[i]]) {
            weight += maghrebiAbjad[cleanName[i]];
        }
    }
    return weight;
}

export function toEasternArabic(num) {
    if (num === "Vœux") return "حاجة";
    return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

export function getElementalOrderFromText(meaning, benefit) {
    const text = `${meaning || ''} ${benefit || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const lexicons = {
        fire: ['brise', 'pulverise', 'soumettre', 'soumet', 'tyran', 'force', 'blocage', 'magi', 'noeud', 'combat', 'feu', 'victoire', 'chaleur', 'detruit', 'contrainte', 'puissant', 'energie', 'defense', 'ennemi', 'karmique', 'obstacle', 'justice', 'colere', 'brule', 'domine'],
        air: ['rapide', 'esprit', 'elevation', 'deblocage', 'invisible', 'mouvement', 'intelligence', 'parole', 'vent', 'ciel', 'revelation', 'voyage', 'souffle', 'savoir', 'connaissance', 'clairvoyance', 'intuition', 'lumiere', 'eveil', 'ouvre', 'porte'],
        water: ['amour', 'paix', 'douceur', 'guerison', 'purifie', 'lave', 'secret', 'emotion', 'misericorde', 'grace', 'pardon', 'apaise', 'ame', 'tranquillite', 'bienveillance', 'clemence', 'eau', 'source', 'guerit', 'protege'],
        earth: ['richesse', 'materiel', 'fondation', 'patience', 'stabilite', 'corps', 'prosperite', 'croissance', 'ancrage', 'subsistance', 'tresor', 'don', 'creation', 'terre', 'solide', 'pourvoyeur', 'nourriture', 'succes', 'argent']
    };

    let scores = { fire: 0, air: 0, water: 0, earth: 0 };

    for (const [element, words] of Object.entries(lexicons)) {
        words.forEach(word => { if (text.includes(word)) scores[element]++; });
    }

    let primary = 'fire'; 
    let maxScore = -1;
    for (const [el, score] of Object.entries(scores)) {
        if (score > maxScore) { maxScore = score; primary = el; }
    }

    switch(primary) {
        case 'fire': return ['fire', 'air', 'earth', 'water'];
        case 'air': return ['air', 'fire', 'water', 'earth'];
        case 'water': return ['water', 'earth', 'air', 'fire'];
        case 'earth': return ['earth', 'water', 'fire', 'air'];
        default: return ['fire', 'air', 'earth', 'water'];
    }
}

export function generateAllWafq3x3(target) {
    if (target < 15) return null;

    const b = Math.floor((target - 12) / 3);
    const r = (target - 12) % 3;
    
    const c1 = {v: b, s: 1}, c2 = {v: b+1, s: 2}, c3 = {v: b+2, s: 3};
    const c4 = {v: b+3, s: 4}, c5 = {v: b+4, s: 5}, c6 = {v: b+5, s: 6};
    const c7 = {v: b+6+r, s: 7}, c8 = {v: b+7+r, s: 8}, c9 = {v: b+8+r, s: 9};

    return {
        fire: { key: 'fire', name: 'Feu', arabic: 'ناري', icon: '🔥', grid: [[c8, c6, c1], [c4, c2, c9], [c3, c7, c5]] },
        water: { key: 'water', name: 'Eau', arabic: 'مائي', icon: '💧', grid: [[c5, c7, c3], [c9, c2, c4], [c1, c6, c8]] },
        air: { key: 'air', name: 'Air', arabic: 'هوائي', icon: '💨', grid: [[c3, c7, c5], [c4, c2, c9], [c8, c6, c1]] },
        earth: { key: 'earth', name: 'Terre', arabic: 'ترابي', icon: '🌍', grid: [[c1, c6, c8], [c9, c2, c4], [c5, c7, c3]] }
    };
}

// --- NOUVEAU : Carré 3x3 Milieu Vide (Khali al-Wasat) ---
export function generateAllWafq3x3Vide(target) {
    if (target < 15) return null; 

    // Base proportionnelle pour assurer l'équilibre mathématique
    const x = Math.max(1, Math.floor(target / 12));
    
    // Application de la formule algébrique exacte dérivée de votre code Android
    const c1 = {v: x, s: 1};
    const c2 = {v: 2*x, s: 2};
    const c3 = {v: 4*x, s: 3};
    const c4 = {v: 5*x, s: 4};
    const c5 = {v: 6*x, s: 5};
    const c6 = {v: target - 6*x, s: 6};
    const c7 = {v: target - 5*x, s: 7};
    const c8 = {v: target - 7*x, s: 8};
    const cv = {v: "Vœux", s: "V"}; // Cellule centrale (Vide/Vœu)

    // Rotations élémentaires conservant les sommes exactes (Constante T)
    return {
        fire: { key: 'fire', name: 'Feu', arabic: 'ناري', icon: '🔥', 
            grid: [[c2, c4, c8], [c6, cv, c5], [c3, c7, c1]] },
        earth: { key: 'earth', name: 'Terre', arabic: 'ترابي', icon: '🌍', 
            grid: [[c1, c5, c8], [c7, cv, c4], [c3, c6, c2]] },
        air: { key: 'air', name: 'Air', arabic: 'هوائي', icon: '💨', 
            grid: [[c8, c5, c1], [c4, cv, c7], [c2, c6, c3]] },
        water: { key: 'water', name: 'Eau', arabic: 'مائي', icon: '💧', 
            grid: [[c3, c6, c2], [c7, cv, c4], [c1, c5, c8]] }
    };
}

// ─────────────────────────────────────────────────────────────────────────
// Calculateur Abjad ésotérique — port de la logique de abajad/abajad.html.
// (Tables Mashreqi/Maghrébi, normalisation, réduction, facteurs, zodiaque.)
// ─────────────────────────────────────────────────────────────────────────

export const ABAJAD_TABLES = {
  mashriqi: [
    ['ا', 1], ['ب', 2], ['ج', 3], ['د', 4], ['ه', 5], ['و', 6], ['ز', 7], ['ح', 8], ['ط', 9], ['ي', 10],
    ['ك', 20], ['ل', 30], ['م', 40], ['ن', 50], ['س', 60], ['ع', 70], ['ف', 80], ['ص', 90],
    ['ق', 100], ['ر', 200], ['ش', 300], ['ت', 400], ['ث', 500], ['خ', 600], ['ذ', 700], ['ض', 800], ['ظ', 900], ['غ', 1000],
  ],
  maghrebi: [
    ['ا', 1], ['ب', 2], ['ج', 3], ['د', 4], ['ه', 5], ['و', 6], ['ز', 7], ['ح', 8], ['ط', 9], ['ي', 10],
    ['ك', 20], ['ل', 30], ['م', 40], ['ن', 50], ['ص', 60], ['ع', 70], ['ف', 80], ['ض', 90],
    ['ق', 100], ['ر', 200], ['س', 300], ['ت', 400], ['ث', 500], ['خ', 600], ['ذ', 700], ['ظ', 800], ['غ', 900], ['ش', 1000],
  ],
};

// Normalisation des caractères arabes (suppression diacritiques, variantes).
export function normalizeArabic(str) {
  return (str || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ؤئ]/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[ىئ]/g, 'ي')
    .replace(/[ً-ْ]/g, '')
    .replace(/[^ء-ي\s]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export function getLetterValue(char, system) {
  const table = ABAJAD_TABLES[system];
  const entry = table.find(([c]) => c === char);
  return entry ? entry[1] : 0;
}

// Réduction théosophique (addition itérative jusqu'à 1 chiffre).
export function reduceNumber(n) {
  if (n <= 0) return 0;
  while (n > 9) {
    n = n.toString().split('').reduce((a, b) => a + parseInt(b, 10), 0);
  }
  return n;
}

// Toutes les paires de facteurs d'un nombre (a × b).
export function getFactorPairs(num) {
  if (num <= 1) return [];
  const pairs = [];
  for (let a = num - 1; a >= 2; a--) {
    if (num % a === 0) pairs.push([a, num / a]);
  }
  return pairs;
}

// Calcule les deux totaux (Mashreqi/Maghrébi) d'une saisie (lettres OU nombre).
export function computeAbajadSums(input) {
  const ascii = (input || '')
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06f0);
  const numeric = ascii.trim().replace(/[\s.,]/g, '');
  if (/^\d+$/.test(numeric)) {
    const v = parseInt(numeric, 10);
    return { mash: v, magh: v };
  }
  const normalized = normalizeArabic(input);
  if (!normalized) return { mash: 0, magh: 0 };
  let mash = 0, magh = 0;
  normalized.split('').forEach((ch) => {
    mash += getLetterValue(ch, 'mashriqi');
    magh += getLetterValue(ch, 'maghrebi');
  });
  return { mash, magh };
}

// Zodiaque indexé de 1 à 12 (ordre = valeur mod 12 ; 0 → 12 = Poissons).
export const ZODIAC = [
  null,
  { nom: 'Bélier', nature: 'Feu', intervalle: '21 mars au 19 avril' },
  { nom: 'Taureau', nature: 'Terre', intervalle: '20 avril au 20 mai' },
  { nom: 'Gémeaux', nature: 'Air', intervalle: '21 mai au 20 juin' },
  { nom: 'Cancer', nature: 'Eau', intervalle: '21 juin au 22 juillet' },
  { nom: 'Lion', nature: 'Feu', intervalle: '23 juillet au 22 août' },
  { nom: 'Vierge', nature: 'Terre', intervalle: '23 août au 22 septembre' },
  { nom: 'Balance', nature: 'Air', intervalle: '23 septembre au 22 octobre' },
  { nom: 'Scorpion', nature: 'Eau', intervalle: '23 octobre au 21 novembre' },
  { nom: 'Sagittaire', nature: 'Feu', intervalle: '22 novembre au 21 décembre' },
  { nom: 'Capricorne', nature: 'Terre', intervalle: '22 décembre au 19 janvier' },
  { nom: 'Verseau', nature: 'Air', intervalle: '20 janvier au 18 février' },
  { nom: 'Poissons', nature: 'Eau', intervalle: '19 février au 20 mars' },
];

// Résultats ésotériques d'une base (faces, adad, zodiaque).
export function computeEso(v) {
  const fmt = (n) => Number(n).toLocaleString('fr-FR');
  if (!v || v <= 0) {
    return { face: '—', cachee: '—', rouhani: '—', lumineux: '—', ordre: '—', signe: '—', nature: '—', intervalle: '—' };
  }
  const cachee = parseInt(String(v).split('').reverse().join(''), 10) || 0;
  const ordre = v % 12;
  const z = ZODIAC[ordre === 0 ? 12 : ordre];
  return {
    face: fmt(v),
    cachee: fmt(cachee),
    rouhani: fmt(v * v),
    lumineux: fmt((v * (v + 1)) / 2),
    ordre: String(ordre),
    signe: z.nom,
    nature: z.nature,
    intervalle: z.intervalle,
  };
}

export function generateAllWafq4x4(target) {
    if (target < 34) return null; 

    const b = Math.floor((target - 30) / 4);
    const r = (target - 30) % 4;
    
    const c1 = {v: b, s: 1}, c2 = {v: b+1, s: 2}, c3 = {v: b+2, s: 3}, c4 = {v: b+3, s: 4};
    const c5 = {v: b+4, s: 5}, c6 = {v: b+5, s: 6}, c7 = {v: b+6, s: 7}, c8 = {v: b+7, s: 8};
    const c9 = {v: b+8, s: 9}, c10 = {v: b+9, s: 10}, c11 = {v: b+10, s: 11}, c12 = {v: b+11, s: 12};
    const c13 = {v: b+12+r, s: 13}, c14 = {v: b+13+r, s: 14}, c15 = {v: b+14+r, s: 15}, c16 = {v: b+15+r, s: 16};

    return {
        fire: { key: 'fire', name: 'Feu', arabic: 'ناري', icon: '🔥', 
            grid: [[c8, c11, c14, c1], [c13, c2, c7, c12], [c3, c16, c9, c6], [c10, c5, c4, c15]] 
        },
        water: { key: 'water', name: 'Eau', arabic: 'مائي', icon: '💧', 
            grid: [[c10, c5, c4, c15], [c3, c16, c9, c6], [c13, c2, c7, c12], [c8, c11, c14, c1]] 
        },
        air: { key: 'air', name: 'Air', arabic: 'هوائي', icon: '💨', 
            grid: [[c15, c4, c5, c10], [c6, c9, c16, c3], [c12, c7, c2, c13], [c1, c14, c11, c8]] 
        },
        earth: { key: 'earth', name: 'Terre', arabic: 'ترابي', icon: '🌍', 
            grid: [[c1, c14, c11, c8], [c12, c7, c2, c13], [c6, c9, c16, c3], [c15, c4, c5, c10]] 
        }
    };
}


