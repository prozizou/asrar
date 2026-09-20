'use client';
// lib/favoriteModules.js — Favoris de modules ÉPINGLÉS par l'utilisateur
// (localStorage, propre à cet appareil — jamais synchronisé, jamais de
// backend, comme lib/recentModules.js). Revue design : « faire d'Accès
// rapide une zone Favoris / Récents, personnalisable » — les favoris sont
// donc choisis explicitement (étoile sur une tuile de catégorie), là où les
// récents s'alimentent tout seuls à l'usage.
const KEY = 'asrar_favorite_modules';
const MAX = 6;

export function getFavoriteModules() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Épingle/désépingle et renvoie la NOUVELLE liste (pour que l'appelant
 * mette son état à jour sans relire le stockage). Au-delà de MAX, le plus
 * ancien favori sort : une rangée de raccourcis qui déborde sur plusieurs
 * lignes n'est plus un raccourci. */
export function toggleFavoriteModule(href) {
  const list = getFavoriteModules();
  const next = list.includes(href) ? list.filter((h) => h !== href) : [...list, href].slice(-MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible (navigation privée, quota) — silencieux, best effort.
  }
  return next;
}
