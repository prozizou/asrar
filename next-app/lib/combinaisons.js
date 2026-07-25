// Module « Combinaisons » — logique pure portée de combinaisons/combinaisons.html.
// Valeurs Abjad, table des 99 Noms, et algorithme de recherche par backtracking
// avec élagage (pruning) sur tableau trié + sommes de préfixes. Aucune
// dépendance UI : l'algorithme communique par callbacks (progress/stop).

// ── 1. Valeurs Abjad des lettres ───────────────────────────────────────────
export const ABJAD_VALUES = {
  ا: 1, أ: 1, إ: 1, آ: 1, ٱ: 1, ء: 1, ئ: 1, ؤ: 1,
  ب: 2, ج: 3, د: 4, ه: 5, ة: 5, و: 6, ز: 7, ح: 8,
  ط: 9, ي: 10, ى: 10, ك: 20, ک: 20, ل: 30, م: 40, ن: 50,
  ص: 60, ع: 70, ف: 80, ض: 90, ق: 100, ر: 200, س: 300,
  ت: 400, ث: 500, خ: 600, ذ: 700, ظ: 800, غ: 900, ش: 1000,
};

// Nettoyage des diacritiques (tashkeel) avant calcul.
const TASHKEEL_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;

export function stripDiacritics(text) {
  return (text || '').replace(TASHKEEL_REGEX, '');
}

export function abjadWeight(text) {
  const clean = stripDiacritics(text);
  let total = 0;
  for (const ch of clean) {
    if (ABJAD_VALUES[ch] !== undefined) total += ABJAD_VALUES[ch];
  }
  return total;
}

// ── 2. Les 99 Noms d'Allah ─────────────────────────────────────────────────
//    [nom_arabe_affiché, forme_propre_pour_calcul, traduction, poids_pré-calculé]
const NAMES_DATA = [
  ['اللَّه', 'الله', 'Allah — Le Nom suprême', 66],
  ['رحمن', 'الرحمن', 'Ar-Rahmân — Le Tout Miséricordieux', 298],
  ['رحيم', 'الرحيم', 'Ar-Rahîm — Le Très Miséricordieux', 258],
  ['ملك', 'الملك', 'Al-Malik — Le Roi souverain', 90],
  ['قدوس', 'القدوس', 'Al-Quddûs — Le Très Saint', 410],
  ['سلام', 'السلام', 'As-Salâm — La Paix, la Source de paix', 371],
  ['مؤمن', 'المؤمن', "Al-Mu'min — Le Garant de la foi", 136],
  ['مهيمن', 'المهيمن', 'Al-Muhaymin — Le Gardien suprême', 145],
  ['عزيز', 'العزيز', "Al-'Azîz — Le Tout Puissant", 94],
  ['جبار', 'الجبار', 'Al-Jabbâr — Le Tout Contraignant', 206],
  ['متكبر', 'المتكبر', 'Al-Mutakabbir — Le Souverainement Grand', 662],
  ['خالق', 'الخالق', 'Al-Khâliq — Le Créateur', 731],
  ['بارئ', 'البارئ', "Al-Bâri' — L'Auteur de toute existence", 214],
  ['مصور', 'المصور', 'Al-Mussawwir — Le Façonneur des formes', 306],
  ['غفار', 'الغفار', 'Al-Ghaffâr — Le Grand Pardonneur', 1181],
  ['قهار', 'القهار', 'Al-Qahhâr — Le Dominateur suprême', 306],
  ['وهاب', 'الوهاب', 'Al-Wahhâb — Le Grand Donateur', 14],
  ['رزاق', 'الرزاق', 'Ar-Razzâq — Le Pourvoyeur de subsistance', 308],
  ['فتاح', 'الفتاح', 'Al-Fattâh — Le Grand Ouvreur', 489],
  ['عليم', 'العليم', "Al-'Alîm — L'Omniscient", 150],
  ['قابض', 'القابض', 'Al-Qâbid — Le Resserreur', 193],
  ['باسط', 'الباسط', 'Al-Bâsit — Le Dispensateur', 312],
  ['خافض', 'الخافض', "Al-Khâfid — L'Abaisseur", 771],
  ['رافع', 'الرافع', "Ar-Râfi' — L'Éleveur", 351],
  ['معز', 'المعز', "Al-Mu'izz — Celui qui glorifie", 117],
  ['مذل', 'المذل', 'Al-Mudhill — Celui qui humilie', 770],
  ['سميع', 'السميع', "As-Samî' — L'Omniscient des voix", 420],
  ['بصير', 'البصير', 'Al-Bassîr — Le Clairvoyant', 272],
  ['حكم', 'الحكم', "Al-Hakam — L'Arbitre suprême", 68],
  ['عدل', 'العدل', "Al-'Adl — Le Juste", 104],
  ['لطيف', 'اللطيف', 'Al-Latîf — Le Doux et Subtil', 129],
  ['خبير', 'الخبير', 'Al-Khabîr — Le Très Avisé', 812],
  ['حليم', 'الحليم', 'Al-Halîm — Le Très Doux', 88],
  ['عظيم', 'العظيم', "Al-'Azîm — L'Immense", 920],
  ['غفور', 'الغفور', 'Al-Ghafûr — Le Très Pardonneur', 1186],
  ['شكور', 'الشكور', 'Ash-Shakûr — Le Très Reconnaissant', 1226],
  ['علي', 'العلي', "Al-'Alî — Le Très Haut", 110],
  ['كبير', 'الكبير', 'Al-Kabîr — Le Grand', 232],
  ['حفيظ', 'الحفيظ', 'Al-Hafîz — Le Préservateur', 898],
  ['مقيت', 'المقيت', 'Al-Muqît — Le Sustentateur', 550],
  ['حسيب', 'الحسيب', 'Al-Hassîb — Le Suffisant', 320],
  ['جليل', 'الجليل', 'Al-Jalîl — Le Majestueux', 73],
  ['كريم', 'الكريم', 'Al-Karîm — Le Très Généreux', 270],
  ['رقيب', 'الرقيب', 'Ar-Raqîb — Le Gardien attentif', 312],
  ['مجيب', 'المجيب', 'Al-Mujîb — Celui qui répond aux prières', 55],
  ['واسع', 'الواسع', "Al-Wâsi' — L'Immensément Vaste", 377],
  ['حكيم', 'الحكيم', 'Al-Hakîm — Le Sage', 78],
  ['ودود', 'الودود', 'Al-Wadûd — Le Très Affectueux', 20],
  ['مجيد', 'المجيد', 'Al-Majîd — Le Très Noble', 57],
  ['باعث', 'الباعث', "Al-Bâ'ith — Celui qui ressuscite", 573],
  ['شهيد', 'الشهيد', 'Ash-Shahîd — Le Témoin universel', 1019],
  ['حق', 'الحق', 'Al-Haqq — La Vérité absolue', 108],
  ['وكيل', 'الوكيل', 'Al-Wakîl — Le Garant suprême', 66],
  ['قوي', 'القوي', 'Al-Qawiyy — Le Très Fort', 116],
  ['متين', 'المتين', 'Al-Matîn — Le Solide', 500],
  ['ولي', 'الولي', "Al-Waliyy — L'Ami protecteur", 46],
  ['حميد', 'الحميد', 'Al-Hamîd — Le Digne de louanges', 62],
  ['محصي', 'المحصي', 'Al-Muhsî — Celui qui dénombre tout', 118],
  ['مبدئ', 'المبدئ', "Al-Mubdi' — L'Initiateur", 56],
  ['معيد', 'المعيد', "Al-Mu'îd — Le Restaurateur", 124],
  ['محيي', 'المحيي', 'Al-Muhyî — Celui qui donne la vie', 68],
  ['مميت', 'المميت', 'Al-Mumît — Celui qui donne la mort', 490],
  ['حي', 'الحي', 'Al-Hayy — Le Vivant éternel', 18],
  ['قيوم', 'القيوم', 'Al-Qayyûm — Le Subsistant par Lui-même', 156],
  ['واجد', 'الواجد', 'Al-Wâjid — Le Trouvant tout', 14],
  ['ماجد', 'الماجد', 'Al-Mâjid — Le Glorieux', 48],
  ['واحد', 'الواحد', "Al-Wâhid — L'Unique", 19],
  ['احد', 'الاحد', "Al-Ahad — L'Un absolument", 13],
  ['صمد', 'الصمد', 'As-Samad — Le Seigneur des seigneurs', 104],
  ['قادر', 'القادر', 'Al-Qâdir — Le Tout Puissant', 305],
  ['مقتدر', 'المقتدر', 'Al-Muqtadir — Le Détenteur de toute puissance', 744],
  ['مقدم', 'المقدم', 'Al-Muqaddim — Celui qui avance les choses', 184],
  ['مؤخر', 'المؤخر', "Al-Mu'akhkhir — Celui qui reporte", 846],
  ['اول', 'الاول', 'Al-Awwal — Le Premier sans commencement', 37],
  ['اخر', 'الاخر', 'Al-Âkhir — Le Dernier sans fin', 801],
  ['ظاهر', 'الظاهر', "Az-Zâhir — L'Apparent", 1006],
  ['باطن', 'الباطن', 'Al-Bâtin — Le Caché', 62],
  ['والي', 'الوالي', 'Al-Wâlî — Le Gouverneur', 47],
  ['متعالي', 'المتعالي', "Al-Muta'âlî — L'Infiniment Élevé", 551],
  ['بر', 'البر', 'Al-Barr — Le Bienveillant', 203],
  ['تواب', 'التواب', 'At-Tawwâb — Celui qui accueille le repentir', 409],
  ['منتقم', 'المنتقم', 'Al-Muntaqim — Le Vengeur de la justice', 630],
  ['عفو', 'العفو', "Al-'Afuww — Le Grand Pardonneur", 156],
  ['رؤوف', 'الرؤوف', "Ar-Ra'ûf — Le Très Compatissant", 287],
  ['مَالِكُ الْمُلْك', 'مالك الملك', 'Mâlik ul-Mulk — Maître absolu du Royaume', 212],
  ['ذُو الْجَلَالِ', 'ذو الجلال والإكرام', 'Dhûl-Jalâl — Seigneur de Majesté et Bienfaisance', 1100],
  ['مقسط', 'المقسط', "Al-Muqsit — L'Équitable", 449],
  ['جامع', 'الجامع', "Al-Jâmi' — Celui qui rassemble tout", 114],
  ['غني', 'الغني', "Al-Ghaniyy — L'Infiniment Riche", 960],
  ['مغني', 'المغني', 'Al-Mughnî — Celui qui enrichit', 1000],
  ['مانع', 'المانع', "Al-Mâni' — Celui qui retient", 161],
  ['ضار', 'الضار', 'Ad-Dârr — Celui qui éprouve', 291],
  ['نافع', 'النافع', "An-Nâfi' — Celui qui bienfait", 201],
  ['نور', 'النور', 'An-Nûr — La Lumière', 256],
  ['هادي', 'الهادي', 'Al-Hâdî — Le Guide vers la droiture', 20],
  ['بديع', 'البديع', "Al-Badî' — L'Incomparable Innovateur", 87],
  ['باقي', 'الباقي', "Al-Bâqî — L'Éternellement Subsistant", 113],
  ['وارث', 'الوارث', "Al-Wârith — L'Héritier ultime", 707],
  ['رشيد', 'الرشيد', 'Ar-Rashîd — Le Guide vers le bon chemin', 1214],
  ['صبور', 'الصبور', 'As-Sabûr — Le Très Patient', 268],
];

// Poids pré-calculé si fourni (>0), sinon calcul Abjad de la forme propre.
export const NAMES = NAMES_DATA.map(([display, clean, fr, precomputed]) => {
  const computed = abjadWeight(clean);
  const weight = precomputed && precomputed > 0 ? precomputed : computed;
  return { display, clean, fr, weight };
});

// Tableau trié par poids croissant (pour l'élagage) + sommes de préfixes.
export const NAMES_SORTED = [...NAMES].sort((a, b) => a.weight - b.weight);
const numNames = NAMES_SORTED.length;
const prefixMin = new Array(numNames + 1).fill(0);
for (let i = 0; i < numNames; i++) {
  prefixMin[i + 1] = prefixMin[i] + NAMES_SORTED[i].weight;
}
export const NUM_NAMES = numNames;

// Nombre théorique de combinaisons C(n, k) (BigInt puis Number).
export function countCombinations(n, k) {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  let num = 1n, den = 1n;
  for (let i = 0; i < k; i++) {
    num *= BigInt(n - i);
    den *= BigInt(i + 1);
  }
  return Number(num / den);
}

export function hasAllah(indices) {
  return indices.some((i) => NAMES_SORTED[i].clean === 'الله');
}

// Détail d'une combinaison (indices → noms/poids/formule) pour l'affichage.
export function describeCombo(indices) {
  const names = indices.map((i) => NAMES_SORTED[i]);
  const total = names.reduce((s, nn) => s + nn.weight, 0);
  const formula = names.map((nn) => `${nn.weight}`).join(' + ') + ` = ${total}`;
  const isAllah = names.some((nn) => nn.clean === 'الله');
  return { names, total, formula, isAllah };
}

export function resultSearchText(indices) {
  return indices
    .map((i) => {
      const nn = NAMES_SORTED[i];
      return `${nn.display} ${nn.clean} ${nn.fr} ${nn.weight}`;
    })
    .join(' ')
    .toLowerCase();
}

// ── Algorithme principal : backtracking + double élagage ────────────────────
// Renvoie { results, pruned, stopped }. Callbacks :
//   shouldStop() → bool (permet l'interruption)
//   onProgress(pct, foundCount, pruned) → mise à jour d'UI (throttlée)
export async function searchCombinations({ target, k, shouldStop, onProgress }) {
  const results = [];
  let checked = 0;
  let pruned = 0;
  const stop = shouldStop || (() => false);
  const progress = onProgress || (() => {});

  async function recurse(startIdx, current, currentSum, depth) {
    if (stop()) return;
    const remaining = k - depth;

    if (remaining === 0) {
      if (currentSum === target) results.push([...current]);
      checked++;
      if (checked % 50000 === 0) {
        const pct = Math.min(99, Math.round((startIdx / numNames) * 100));
        progress(pct, results.length, pruned);
        await new Promise((r) => setTimeout(r, 0));
      }
      return;
    }

    const available = numNames - startIdx;
    if (available < remaining) return;

    for (let i = startIdx; i <= numNames - remaining; i++) {
      if (stop()) return;
      const newSum = currentSum + NAMES_SORTED[i].weight;

      // Élagage 1 : borne basse (les plus petits restants).
      const minReachable = newSum + (prefixMin[i + remaining] - prefixMin[i + 1]);
      if (minReachable > target) {
        pruned++;
        break; // tableau trié → tout le reste est plus lourd
      }

      // Élagage 2 : borne haute (les plus grands restants).
      const maxReachable = newSum + (prefixMin[numNames] - prefixMin[numNames - (remaining - 1)]);
      if (maxReachable < target) {
        pruned++;
        continue;
      }

      current.push(i);
      await recurse(i + 1, current, newSum, depth + 1);
      current.pop();

      if (depth === 0 && i % 10 === 0) {
        const pct = Math.round((i / (numNames - remaining)) * 100);
        progress(pct, results.length, pruned);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  await recurse(0, [], 0, 0);
  return { results, pruned, stopped: stop() };
}
