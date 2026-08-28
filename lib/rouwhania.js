'use client';
// Module « Rouwhanes » — logique pure + loaders portés de rouwhania/script.js.
// Poids Abjad, expansions (noms de lettres / noms de nombres), génération des
// « noms des rouwhanes » (anges) à partir des totaux, et recherche de TOUS
// les noms d'Allah correspondant à chaque lettre du nom-racine.
//
// Chargement des 99 Noms et des versets de référence : en PRIORITÉ via
// /api/list-content (Admin SDK, HTTPS — même chemin fiable que lib/
// benefits.js loadNames()), avec repli sur une lecture RTDB directe. Avant
// cette correction, loadRouwhaniaAsma()/loadVerses() ne faisaient QUE la
// lecture RTDB directe (SDK modulaire) — sur un réseau où ce canal reste
// bloqué en silence (cf. l'historique /api/check-access, /api/social),
// asma/verses restaient vides SANS AUCUNE erreur visible : les cartes « Les
// noms d'Allah qui vont avec » affichaient alors systématiquement « aucun
// nom adapté » pour TOUTES les lettres (asma vide → aucun candidat possible),
// et aucune suggestion de verset ne s'affichait jamais.
import { ref, get } from 'firebase/database';
import { db } from './firebase';
import { apiPost } from './api';
import { loadNames } from './benefits';

// ── Tables de référence ─────────────────────────────────────────────────────
export const ABJAD_TABLE = Object.freeze([
  { char: 'ا', name: 'ألف', value: 1 }, { char: 'ب', name: 'باء', value: 2 },
  { char: 'ج', name: 'جيم', value: 3 }, { char: 'د', name: 'دال', value: 4 },
  { char: 'ه', name: 'هاء', value: 5 }, { char: 'و', name: 'واو', value: 6 },
  { char: 'ز', name: 'زاي', value: 7 }, { char: 'ح', name: 'حاء', value: 8 },
  { char: 'ط', name: 'طاء', value: 9 }, { char: 'ي', name: 'ياء', value: 10 },
  { char: 'ك', name: 'كاف', value: 20 }, { char: 'ل', name: 'لام', value: 30 },
  { char: 'م', name: 'ميم', value: 40 }, { char: 'ن', name: 'نون', value: 50 },
  { char: 'ص', name: 'صاد', value: 60 }, { char: 'ع', name: 'عين', value: 70 },
  { char: 'ف', name: 'فاء', value: 80 }, { char: 'ض', name: 'ضاد', value: 90 },
  { char: 'ق', name: 'قاف', value: 100 }, { char: 'ر', name: 'راء', value: 200 },
  { char: 'س', name: 'سين', value: 300 }, { char: 'ت', name: 'تاء', value: 400 },
  { char: 'ث', name: 'ثاء', value: 500 }, { char: 'خ', name: 'خاء', value: 600 },
  { char: 'ذ', name: 'ذال', value: 700 }, { char: 'ظ', name: 'ظاء', value: 800 },
  { char: 'غ', name: 'غين', value: 900 }, { char: 'ش', name: 'شين', value: 1000 },
  { char: 'ٱ', name: 'ألف', value: 1 }, { char: 'إ', name: 'ألف', value: 1 },
  { char: 'أ', name: 'ألف', value: 1 }, { char: 'آ', name: 'ألف', value: 1 },
  { char: 'ء', name: 'ألف', value: 1 }, { char: 'ى', name: 'ياء', value: 10 },
  { char: 'ة', name: 'هاء', value: 5 }, { char: 'ئ', name: 'ياء', value: 1 },
]);

const NUMBER_NAMES = {
  1: 'واحد', 2: 'اثنان', 3: 'ثلاثة', 4: 'أربعة', 5: 'خمسة',
  6: 'ستة', 7: 'سبعة', 8: 'ثمانية', 9: 'تسعة', 10: 'عشرة',
  20: 'عشرون', 30: 'ثلاثون', 40: 'أربعون', 50: 'خمسون',
  60: 'ستون', 70: 'سبعون', 80: 'ثمانون', 90: 'تسعون',
  100: 'مئة', 200: 'مئتان', 300: 'ثلاثمئة', 400: 'أربعمئة',
  500: 'خمسمئة', 600: 'ستمئة', 700: 'سبعمئة', 800: 'ثمانيمئة',
  900: 'تسعمئة', 1000: 'ألف',
};

// Map phonétique avec voyelle "A".
const VOWEL_MAP = {
  ا: 'a', ب: 'Ba', ج: 'Dia', د: 'Da', ه: 'Ha', و: 'Wa',
  ز: 'Ja', ح: 'Ha', ط: 'Ta', ي: 'Ya', ك: 'Ka', ل: 'La',
  م: 'Ma', ن: 'Na', ص: 'Sa', ع: 'a', ف: 'Fa', ض: 'Da',
  ق: 'Qa', ر: 'Ra', س: 'Sa', ت: 'Ta', ث: 'Sa', خ: 'Ha',
  ذ: 'Ja', ظ: 'Za', غ: 'A', ش: 'Cha',
};

// Map phonétique contracté (soukoun, sans voyelle).
const CONS_MAP = {
  ا: 'a', ب: 'b', ج: 'dj', د: 'd', ه: 'h', و: 'w',
  ز: 'j', ح: 'h', ط: 'th', ي: 'y', ك: 'k', ل: 'l',
  م: 'm', ن: 'n', ص: 's', ع: 'a', ف: 'f', ض: 'd',
  ق: 'q', ر: 'r', س: 's', ت: 't', ث: 's', خ: 'h',
  ذ: 'j', ظ: 'z', غ: 'h', ش: 'ch',
};

// ── Utilitaires ─────────────────────────────────────────────────────────────
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function countChar(text, char) {
  let count = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === char) count++;
  return count;
}

function calculateWeight(text) {
  let w = 0;
  for (const ch of text) {
    const entry = ABJAD_TABLE.find((e) => e.char === ch);
    if (entry) w += entry.value;
  }
  return w;
}

// Découpe un texte mixte FR/arabe en segments dirigés (port de formatMixedText).
export function mixedSegments(text) {
  if (!text) return [];
  const lines = String(text).split(/\n|<br>/i);
  const segs = [];
  lines.forEach((line) => {
    const trimLine = line.trim();
    if (!trimLine) return;
    const sentences = trimLine.split('.');
    sentences.forEach((sentence, index) => {
      let s = sentence.trim();
      if (!s) return;
      if (index < sentences.length - 1 || trimLine.endsWith('.')) s += '.';
      segs.push({ dir: /[؀-ۿ]/.test(s) ? 'rtl' : 'ltr', text: s });
    });
  });
  return segs;
}

// ── Calcul complet (V1/V2/V3) ───────────────────────────────────────────────
// Version synchrone : l'ancienne animation lettre par lettre (delay 50 ms) était
// purement cosmétique et réservée à l'admin ; on calcule d'un coup.
export function computeAll(text) {
  const clean = text.replace(/\s/g, '');
  const textLen = clean.length;

  // V1 : poids brut × longueur.
  let stock = 0;
  for (const entry of ABJAD_TABLE) stock += countChar(text, entry.char) * entry.value;
  const v1m1 = stock * textLen;
  const v1m2 = v1m1 * textLen;

  // V2 : expansion en NOMS DE LETTRES (ألف, باء…).
  let exp2 = '';
  for (const entry of ABJAD_TABLE) {
    const count = countChar(text, entry.char);
    for (let i = 0; i < count; i++) exp2 += entry.name + ' ';
  }
  exp2 = exp2.trim();
  const secondLength = calculateWeight(exp2);
  const len2 = exp2.replace(/\s/g, '').length;
  const v2m1 = secondLength * len2;
  const v2m2 = v2m1 * len2;

  // V3 : expansion en NOMS DE NOMBRES (واحد, اثنان…).
  let exp3 = '';
  for (const entry of ABJAD_TABLE) {
    const count = countChar(text, entry.char);
    const numName = NUMBER_NAMES[entry.value] || entry.name;
    for (let i = 0; i < count; i++) exp3 += numName + ' ';
  }
  exp3 = exp3.trim();
  const trois = calculateWeight(exp3);
  const len3 = exp3.replace(/\s/g, '').length;
  const v3m1 = trois * len3;
  const v3m2 = v3m1 * len3;

  const total = stock + secondLength + trois;
  return {
    stock, secondLength, trois, textLen, len2, len3, exp2, exp3,
    results: { v1m1, v1m2, v2m1, v2m2, v3m1, v3m2, total },
  };
}

// ── Génération des noms des rouwhanes (anges) ───────────────────────────────
function reduceNumber(n) {
  while (n >= 1000000) n = (n % 10000) + Math.floor(n / 10000);
  return n;
}

function convertToLetters(value) {
  if (value === 0) return '';
  let letters = '';
  const hundreds = Math.floor(value / 100) * 100;
  const tens = Math.floor((value % 100) / 10) * 10;
  const units = value % 10;
  const map = {
    1: 'ا', 2: 'ب', 3: 'ج', 4: 'د', 5: 'ه', 6: 'و', 7: 'ز', 8: 'ح', 9: 'ط',
    10: 'ي', 20: 'ك', 30: 'ل', 40: 'م', 50: 'ن', 60: 'ص', 70: 'ع', 80: 'ف', 90: 'ض',
    100: 'ق', 200: 'ر', 300: 'س', 400: 'ت', 500: 'ث', 600: 'خ', 700: 'ذ', 800: 'ظ', 900: 'غ',
  };
  if (hundreds > 0) letters += map[hundreds];
  if (tens > 0) letters += map[tens];
  if (units > 0) letters += map[units];
  return letters;
}

export function numberToAngelName(n) {
  const reduced = reduceNumber(n);
  const t = Math.floor(reduced / 1000);
  const r = reduced % 1000;
  let letters = '';
  if (t > 0) {
    if (t === 1) letters += 'ش';
    else letters += convertToLetters(t) + 'ش';
  }
  letters += convertToLetters(r);
  const arabicName = letters + 'ائيل';
  const transcriptParts = [];
  if (letters.length === 1) {
    transcriptParts.push(VOWEL_MAP[letters[0]] || letters[0]);
  } else if (letters.length >= 2) {
    const first = VOWEL_MAP[letters[0]] || letters[0];
    const second = CONS_MAP[letters[1]] || letters[1];
    transcriptParts.push(first + second);
    for (let i = 2; i < letters.length; i++) transcriptParts.push(VOWEL_MAP[letters[i]] || letters[i]);
  }
  let transcript = transcriptParts.join('-') + '-ilou';
  transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1);
  return { arabic: arabicName, transcript };
}

// Liste des noms des rouwhanes pour les 7 totaux + nom-racine (7e) pour les
// noms d'Allah.
export function buildAngelNames(results) {
  const numbers = [results.v1m1, results.v1m2, results.v2m1, results.v2m2, results.v3m1, results.v3m2, results.total];
  const list = [];
  let seventh = '';
  numbers.forEach((num, index) => {
    if (num === 0) return;
    const { arabic, transcript } = numberToAngelName(num);
    list.push({ num, arabic, transcript });
    if (index === 6) seventh = arabic;
  });
  return { list, seventh };
}

// ── Recherche des noms d'Allah par lettre ───────────────────────────────────
// Retire les diacritiques arabes (tashkil : fatha/damma/kasra/tanwin/chadda/
// soukoun + alef suscrit) — de nombreuses entrées Firebase de asmaUlHusna
// gardent le nom vocalisé (ex. « اَلشَّكُورُ ») : la diacritique entre le ا et le
// ل de « ال » (chacune un caractère Unicode à part entière) empêchait
// normName.startsWith('ال') de matcher, donc AUCUNE lettre autre que « ا »
// ne pouvait plus jamais correspondre à un nom (bug systémique, pas juste
// « parfois » — visible sur les entrées non vocalisées qui, elles, marchaient).
const stripTashkil = (s) => String(s || '').replace(/[\u064B-\u0652\u0670]/g, '');

// Renvoie TOUS les noms d'Allah commençant par `char` (l'article « ال »
// initial ignoré pour la comparaison) — plus de sélection automatique d'un
// « meilleur » nom unique selon un vœu : c'est à l'utilisateur de choisir
// personnellement parmi les détails de chacun (app/rouwhania/page.tsx les
// affiche en scroll horizontal sous chaque lettre).
export function findAllahNamesByLetter(char, asmaData) {
  if (!asmaData || asmaData.length === 0) return [];
  const normChar = stripTashkil(char).replace(/[أإآ]/g, 'ا');

  return asmaData.filter((item) => {
    if (!item || !item.name) return false;
    const normName = stripTashkil(item.name).replace(/[أإآ]/g, 'ا');
    if (normName === 'الله') return normChar === 'ا';
    const nameWithoutAl = normName.startsWith('ال') ? normName.substring(2) : normName;
    return nameWithoutAl.startsWith(normChar) || normName.startsWith(normChar);
  });
}

// Groupes de noms d'Allah correspondant au nom-racine (7e nom des rouwhanes) :
// un groupe par lettre, chacun listant TOUS les noms qui lui correspondent.
export function buildAllahCards(fullAngelName, asmaData) {
  const rootName = fullAngelName.endsWith('ائيل') ? fullAngelName.slice(0, -4) : fullAngelName;
  const cards = [];
  for (const char of rootName) {
    cards.push({ char, matches: findAllahNamesByLetter(char, asmaData) });
  }
  return cards;
}

// ── Loaders ──────────────────────────────────────────────────────────────
// 99 Noms : lib/benefits.js loadNames() fait déjà tout le travail (cache
// local → /api/list-content kind="asma" → RTDB directe → repli codé en dur)
// et renvoie la forme {id, name, translit, meaning, benefit, number} —
// exactement ce que findAllahNamesByLetter()/AllahCard (app/rouwhania/
// page.tsx) attendent. Pas de raison de dupliquer cette chaîne de repli ici.
export const loadRouwhaniaAsma = loadNames;

const VERSES_CACHE_KEY = 'rouwhania_verses_cache';
const VERSES_CACHE_EXPIRY = 3_600_000; // 1 heure — même durée que le cache des 99 Noms

export async function loadVerses() {
  // 1) Cache local
  try {
    const cached = localStorage.getItem(VERSES_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < VERSES_CACHE_EXPIRY && Array.isArray(data) && data.length) return data;
    }
  } catch {
    /* stockage indisponible — silencieux */
  }

  // 2) API serveur (Admin SDK) — chemin fiable, voir l'en-tête du fichier.
  try {
    const { items } = await apiPost('list-content', { kind: 'verset' });
    const out = (items || [])
      .filter((item) => item && item.verset)
      .map((item) => ({ id: item._key, key: item.key || '', verset: String(item.verset).trim() }));
    if (out.length) {
      try {
        localStorage.setItem(VERSES_CACHE_KEY, JSON.stringify({ data: out, timestamp: Date.now() }));
      } catch {
        /* stockage indisponible — silencieux */
      }
      return out;
    }
  } catch {
    /* on retombe sur la lecture RTDB directe ci-dessous */
  }

  // 3) Lecture RTDB directe (repli)
  try {
    const snap = await get(ref(db, 'versetRef'));
    const data = snap.val() || {};
    const out = [];
    for (const [id, item] of Object.entries(data)) {
      if (item && item.verset) out.push({ id, key: item.key || '', verset: item.verset.trim() });
    }
    return out;
  } catch {
    return [];
  }
}
