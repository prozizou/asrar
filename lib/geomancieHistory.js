// Géomancie — historique local des écus calculés (localStorage, par appareil).
// Rien n'est envoyé au serveur. Fonctions pures vis-à-vis du stockage (injectable
// pour les tests) ; toute erreur de stockage (mode privé, quota) est ignorée.

export const HISTORY_KEY = 'geomancie_history_v1';
export const HISTORY_MAX = 12;

function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function mothersKey(mothers) {
  return mothers.map((m) => m.join('')).join('-');
}

function validMothers(m) {
  return (
    Array.isArray(m) &&
    m.length === 4 &&
    m.every((f) => Array.isArray(f) && f.length === 4 && f.every((n) => n === 1 || n === 2))
  );
}

function validEntry(e) {
  return !!e && typeof e.id === 'string' && Number.isFinite(e.at) && validMothers(e.mothers);
}

export function loadHistory(storage = defaultStorage()) {
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(validEntry).slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

function persist(list, storage) {
  try {
    storage && storage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* stockage indisponible : l'historique reste simplement vide au prochain lancement */
  }
  return list;
}

/** Ajoute un écu en tête ; un même jeu de Mères remplace l'entrée précédente. */
export function addHistoryEntry({ mothers, judge = '', even = true, at = Date.now() }, storage = defaultStorage()) {
  const key = mothersKey(mothers);
  const entry = {
    id: `${at}-${key}`,
    at,
    mothers: mothers.map((m) => [...m]),
    judge: String(judge || '').slice(0, 40),
    even: !!even,
  };
  const rest = loadHistory(storage).filter((e) => mothersKey(e.mothers) !== key);
  return persist([entry, ...rest].slice(0, HISTORY_MAX), storage);
}

export function removeHistoryEntry(id, storage = defaultStorage()) {
  return persist(loadHistory(storage).filter((e) => e.id !== id), storage);
}

export function clearHistory(storage = defaultStorage()) {
  return persist([], storage);
}
