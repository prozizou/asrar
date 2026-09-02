// lib/wafqIntentions.js — Intentions proposées pour le générateur de talisman
// Wafq (app/wafq/page.tsx). Chaque intention porte un des 99 Noms d'Allah
// couramment associé à cette demande (même corpus que app/benefits — « Noms
// d'Allah »), utilisé comme texte arabe par défaut pour calculer le poids
// abjad (lib/abjad.js calculatePoidsMystique) et l'orientation élémentaire du
// carré (getElementalOrderFromText, via `meaning`/`benefit`). Module partagé
// (une seule source de vérité), même principe que lib/dhikrPresets.js.
//
// L'utilisateur peut à tout moment SUBSTITUER ce texte par le sien (son nom,
// un mot, une invocation) — l'intention ne sert alors plus qu'à orienter
// l'ordre des éléments (feu/air/eau/terre) affichés en premier.

export const WAFQ_INTENTIONS = [
  {
    id: 'rizq',
    icon: '💰',
    label: 'Rizq — subsistance',
    arabic: 'يَا رَزَّاقُ',
    translit: 'Yâ Razzâq',
    meaning: 'Ô Pourvoyeur',
    benefit: 'subsistance prosperite richesse tresor croissance',
  },
  {
    id: 'protection',
    icon: '🛡️',
    label: 'Protection',
    arabic: 'يَا حَافِظُ',
    translit: 'Yâ Hâfidh',
    meaning: 'Ô Protecteur',
    benefit: 'protege defense ennemi obstacle blocage',
  },
  {
    id: 'guerison',
    icon: '🌿',
    label: 'Guérison',
    arabic: 'يَا شَافِي',
    translit: 'Yâ Shâfî',
    meaning: 'Ô Guérisseur',
    benefit: 'guerison guerit purifie apaise ame',
  },
  {
    id: 'reussite',
    icon: '🗝️',
    label: 'Réussite — ouverture',
    arabic: 'يَا فَتَّاحُ',
    translit: 'Yâ Fattâh',
    meaning: 'Ô Celui qui ouvre',
    benefit: 'ouvre porte deblocage revelation succes',
  },
  {
    id: 'amour',
    icon: '💞',
    label: 'Amour — entente',
    arabic: 'يَا وَدُودُ',
    translit: 'Yâ Wadûd',
    meaning: 'Ô Affectueux',
    benefit: 'amour paix douceur misericorde grace bienveillance',
  },
  {
    id: 'force',
    icon: '🔥',
    label: 'Force — victoire',
    arabic: 'يَا قَوِيُّ',
    translit: 'Yâ Qawiyy',
    meaning: 'Ô Fort',
    benefit: 'force puissant victoire combat energie domine',
  },
  {
    id: 'savoir',
    icon: '📖',
    label: 'Savoir — clairvoyance',
    arabic: 'يَا عَلِيمُ',
    translit: 'Yâ ‘Alîm',
    meaning: 'Ô Omniscient',
    benefit: 'savoir connaissance intelligence clairvoyance intuition lumiere',
  },
  {
    id: 'patience',
    icon: '🪨',
    label: 'Patience — stabilité',
    arabic: 'يَا صَبُورُ',
    translit: 'Yâ Sabûr',
    meaning: 'Ô Patient',
    benefit: 'patience stabilite ancrage fondation solide corps',
  },
];

export const DEFAULT_WAFQ_INTENTION_ID = WAFQ_INTENTIONS[0].id;

export function findWafqIntention(id) {
  return WAFQ_INTENTIONS.find((i) => i.id === id) || WAFQ_INTENTIONS[0];
}
