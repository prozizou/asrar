// lib/dhikrPresets.js — Formules de dhikr proposées à la création d'un Zikr
// collectif (lib/zikrLogic.js normalizeGroupInput() les valide ; pages/api/
// zikr.js en dérive la formule arabe/translittérée stockée pour le groupe).
// Module partagé client/serveur (même raison que lib/plans.js, lib/rateLimit.js) :
// une SEULE source de vérité pour la liste, jamais dupliquée.
//
// "libre" est un cas particulier : pas de formule arabe fixe, le créateur la
// saisit lui-même (cf. normalizeGroupInput, qui exige alors un champ `arabic`
// non vide plutôt que de piocher dans ce tableau).

// `meaning` — traduction française courte affichée sous la phrase arabe dans
// l'en-tête de récitation (app/zikr/page.tsx, ZikrHero) : absente pour
// "libre" (pas de formule fixe, donc pas de traduction à donner).
export const DHIKR_PRESETS = [
  { id: 'soubhanallah', arabic: 'سُبْحَانَ اللّٰه', transliteration: 'SoubhânAllah', meaning: 'Gloire à Allah' },
  { id: 'alhamdoulillah', arabic: 'الْحَمْدُ لِلّٰه', transliteration: 'Alhamdoulillah', meaning: 'Louange à Allah' },
  { id: 'allahou-akbar', arabic: 'اللّٰهُ أَكْبَر', transliteration: 'Allahou Akbar', meaning: 'Allah est le plus Grand' },
  { id: 'la-ilaha-illallah', arabic: 'لَا إِلَٰهَ إِلَّا اللّٰه', transliteration: 'Lâ ilâha illa Allah', meaning: 'Nul dieu si ce n’est Allah' },
  { id: 'astaghfiroullah', arabic: 'أَسْتَغْفِرُ اللّٰه', transliteration: 'Astaghfiroullah', meaning: 'pour le pardon d’Allah' },
  { id: 'salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّد', transliteration: 'Salât ‘alâ Nabiy', meaning: 'Bénédictions sur le Prophète' },
  { id: 'libre', arabic: '', transliteration: 'Zikr libre' },
];

export const DEFAULT_PRESET_ID = DHIKR_PRESETS[0].id;
export const LIBRE_PRESET_ID = 'libre';

export function findPreset(id) {
  return DHIKR_PRESETS.find((p) => p.id === id) || null;
}
