'use client';
// Chargement des 99 Noms — port de Benefits/firebase.js en async/await.
// Ordre : cache local (1 h) → API serveur (/api/list-content kind=asma) →
// lecture RTDB directe → fallback local.
import { ref, get } from 'firebase/database';
import { db } from './firebase';
import { apiPost } from './api';

const CACHE_KEY = 'asma_cache';
const CACHE_EXPIRY = 3_600_000; // 1 heure

function validateName(item) {
  return item && typeof item.name === 'string' && item.name.trim() !== '';
}

function normalizeName(key, value) {
  return {
    id: key,
    name: value.name || key,
    translit: value.translit || '',
    meaning: value.meaning || '',
    benefit: value.benefits || value.benefit || '',
    number: value.number || parseInt(key) || 999,
  };
}

const FALLBACK_NAMES = [
  { id: '0', name: 'الرَّحْمَنُ', translit: 'Ar-Rahman', meaning: 'Le Tout Miséricordieux', benefit: 'Invoquer la miséricorde divine', number: 1 },
  { id: '1', name: 'الرَّحِيمُ', translit: 'Ar-Rahim', meaning: 'Le Très Miséricordieux', benefit: 'Protection et douceur', number: 2 },
  { id: '2', name: 'الْمَلِكُ', translit: 'Al-Malik', meaning: 'Le Souverain Absolu', benefit: 'Force et autorité spirituelle', number: 3 },
];

const bySort = (a, b) => (a.number || 999) - (b.number || 999);

export async function loadNames() {
  // 1) Cache local
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY && Array.isArray(data) && data.length) return data;
    }
  } catch {}

  // 2) API serveur (Admin SDK) : renvoie toujours les noms du RTDB.
  try {
    const { items } = await apiPost('list-content', { kind: 'asma' });
    const names = (items || [])
      .filter(validateName)
      .map((v) => normalizeName(v._key || v.id || String(v.number), v))
      .sort(bySort);
    if (names.length) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: names, timestamp: Date.now() }));
      } catch {}
      return names;
    }
  } catch {}

  // 3) Lecture RTDB directe
  try {
    const snap = await get(ref(db, 'data/appData/asmaUlHusna'));
    const val = snap.val();
    if (val) {
      const names = Object.entries(val)
        .filter(([, v]) => validateName(v))
        .map(([k, v]) => normalizeName(k, v))
        .sort(bySort);
      if (names.length) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: names, timestamp: Date.now() }));
        } catch {}
        return names;
      }
    }
  } catch {}

  // 4) Fallback local
  return [...FALLBACK_NAMES].sort(bySort);
}

// Préfixe d'imploration : « يا » devant le nom (l'article « ال » initial tombe).
export function implore(name) {
  return 'يا ' + String(name || '').replace(/^ال/, '');
}

// Subdivision d'un objectif N en paires a×b, ex. 450 → 225×2, 150×3…
export function objSubdivisions(n) {
  n = parseInt(n, 10);
  if (!n || n <= 1) return [];
  const out = [];
  for (let a = n - 1; a >= 2 && out.length < 40; a--) {
    if (n % a === 0) out.push(a + '×' + n / a);
  }
  return out;
}
