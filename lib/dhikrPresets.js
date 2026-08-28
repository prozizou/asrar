// lib/dhikrPresets.js — Formules de dhikr proposées à la création d'un Zikr
// collectif (lib/zikrLogic.js normalizeGroupInput() les valide ; pages/api/
// zikr.js en dérive la formule arabe/translittérée stockée pour le groupe).
// Module partagé client/serveur (même raison que lib/plans.js, lib/rateLimit.js) :
// une SEULE source de vérité pour la liste, jamais dupliquée.
//
// "libre" est un cas particulier : pas de formule arabe fixe, le créateur la
// saisit lui-même (cf. normalizeGroupInput, qui exige alors un champ `arabic`
// non vide plutôt que de piocher dans ce tableau).

export const DHIKR_PRESETS = [
  { id: 'soubhanallah', arabic: 'سُبْحَانَ اللّٰه', transliteration: 'SoubhânAllah' },
  { id: 'alhamdoulillah', arabic: 'الْحَمْدُ لِلّٰه', transliteration: 'Alhamdoulillah' },
  { id: 'allahou-akbar', arabic: 'اللّٰهُ أَكْبَر', transliteration: 'Allahou Akbar' },
  { id: 'la-ilaha-illallah', arabic: 'لَا إِلَٰهَ إِلَّا اللّٰه', transliteration: 'Lâ ilâha illa Allah' },
  { id: 'astaghfiroullah', arabic: 'أَسْتَغْفِرُ اللّٰه', transliteration: 'Astaghfiroullah' },
  { id: 'salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّد', transliteration: 'Salât ‘alâ Nabiy' },
  { id: 'libre', arabic: '', transliteration: 'Zikr libre' },
];

export const DEFAULT_PRESET_ID = DHIKR_PRESETS[0].id;
export const LIBRE_PRESET_ID = 'libre';

export function findPreset(id) {
  return DHIKR_PRESETS.find((p) => p.id === id) || null;
}
