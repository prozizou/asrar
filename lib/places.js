// lib/places.js — choix MANUEL de la ville du module Planète (au lieu du GPS).
// Recherche : API de géocodage Open-Meteo (gratuite, sans clé, renvoie aussi
// le fuseau horaire IANA de la ville). Le choix est mémorisé PAR APPAREIL.

const API = 'https://geocoding-api.open-meteo.com/v1/search';
const KEY = 'asrar_planete_place';

/**
 * Normalise la réponse brute ; ignore les entrées incomplètes.
 * @returns {{ name: string, detail: string, lat: number, lng: number, timeZone: string | null }[]}
 */
export function parsePlaces(json) {
  const list = json && Array.isArray(json.results) ? json.results : [];
  const out = [];
  for (const r of list) {
    const lat = Number(r && r.latitude);
    const lng = Number(r && r.longitude);
    if (!r || !r.name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const detail = [r.admin1 && r.admin1 !== r.name ? r.admin1 : null, r.country].filter(Boolean).join(', ');
    out.push({ name: String(r.name), detail, lat, lng, timeZone: r.timezone || null });
  }
  return out;
}

export async function searchPlaces(query, signal) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const url = `${API}?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Géocodage ${res.status}`);
  return parsePlaces(await res.json());
}

/** Ville choisie à la main, ou null (→ GPS). Valide la forme lue. */
export function readSavedPlace() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      return { name: String(p.name), detail: p.detail || '', lat: p.lat, lng: p.lng, timeZone: p.timeZone || null };
    }
  } catch {}
  return null;
}

export function savePlace(place) {
  try { localStorage.setItem(KEY, JSON.stringify(place)); } catch {}
}

export function clearSavedPlace() {
  try { localStorage.removeItem(KEY); } catch {}
}
