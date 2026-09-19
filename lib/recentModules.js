'use client';
// Suivi des modules RÉCEMMENT ouverts (localStorage, propre à cet appareil —
// jamais synchronisé, jamais de backend) : sert la ligne « Accès rapide » de
// /menu (app/menu/QuickAccess.js), qui montre les modules réellement utilisés
// une fois qu'il y en a, plutôt qu'un ordre figé pour tout le monde. Revue
// design : « les fonctions les plus utilisées peuvent rester directement
// accessibles ».
const KEY = 'asrar_recent_modules';
const MAX = 4;

export function trackRecentModule(href) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    const next = [href, ...list.filter((h) => h !== href)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible (navigation privée, quota) — silencieux, best effort.
  }
}

export function getRecentModules() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
