// Module « Planète » — logique pure portée de planete/planete.html.
// Calcul du lever/coucher du soleil (formule NOAA, hors-ligne), journée
// planétaire (lever→lever), heures planétaires chaldéennes et leur nature.
// Aucune dépendance UI ; les fonctions reçoivent position + cache en argument.

export const DAY_PLANETS = {
  names: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  // Noms seuls (bruts) — le symbole s'obtient via CHALDEAN_EMOJIS[nom] au
  // rendu (une seule source pour les glyphes planétaires, voir plus bas :
  // avant, ces noms embarquaient chacun leur propre emoji, dupliqué et
  // incohérent avec CHALDEAN_EMOJIS — Lune y était 🌙, ici ☾, par exemple).
  planetNames: ['Soleil', 'Lune', 'Mars', 'Mercure', 'Jupiter', 'Vénus', 'Saturne'],
};

// Ordre chaldéen des planètes.
export const CHALDEAN_ORDER = ['Saturne', 'Jupiter', 'Mars', 'Soleil', 'Vénus', 'Mercure', 'Lune'];
// Symboles astrologiques traditionnels (PAS des emojis) — revue design :
// remplace ☀️/🌙 (rendu emoji coloré, incohérent avec le reste d'une
// identité vectorielle) par ☉/☽, alignés avec ☿♀♂♃♄ déjà utilisés. Un seul
// jeu de glyphes, réutilisé partout où une planète doit s'afficher (cette
// page, components/PlanetHourWidget.js).
export const CHALDEAN_EMOJIS = { Saturne: '♄', Jupiter: '♃', Mars: '♂', Soleil: '☉', Vénus: '♀', Mercure: '☿', Lune: '☽' };
const DAY_RULER_MAP = [3, 6, 2, 5, 1, 4, 0]; // index chaldéen pour dim(0)..sam(6)

// Nature des heures planétaires.
export const PLANET_NATURE = {
  Soleil: { txt: 'Favorable', cls: 'nat-fav' },
  Lune: { txt: 'Favorable', cls: 'nat-fav' },
  Vénus: { txt: 'Très favorable', cls: 'nat-tfav' },
  Jupiter: { txt: 'Très favorable', cls: 'nat-tfav' },
  Mars: { txt: 'Défavorable', cls: 'nat-def' },
  Saturne: { txt: 'Défavorable', cls: 'nat-def' },
  Mercure: { txt: '1re moitié favorable · 2de défavorable', cls: 'nat-mix' },
};

// Nature effective d'une heure. fraction = avancement (0→1), utile pour Mercure.
export function natureOf(planet, fraction) {
  if (planet === 'Mercure') {
    if (fraction == null) return PLANET_NATURE.Mercure;
    return fraction < 0.5
      ? { txt: 'Favorable (1re moitié)', cls: 'nat-fav' }
      : { txt: 'Défavorable (2de moitié)', cls: 'nat-def' };
  }
  return PLANET_NATURE[planet] || { txt: '—', cls: '' };
}

// Lever/coucher LOCAL (NOAA), sans réseau. Renvoie {sunrise:Date, sunset:Date}
// ou {polar:'jour'|'nuit'} aux latitudes extrêmes.
export function sunTimesFor(dateLocal, lat, lng) {
  const rad = Math.PI / 180, deg = 180 / Math.PI, J2000 = 2451545.0;
  const utcMid = Date.UTC(dateLocal.getFullYear(), dateLocal.getMonth(), dateLocal.getDate());
  const Jdate = utcMid / 86400000 + 2440587.5;
  const n = Math.round(Jdate - J2000 + 0.0008);
  const lw = -lng;
  const Jstar = n - lw / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const Mr = M * rad;
  const C = 1.9148 * Math.sin(Mr) + 0.02 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const lr = lambda * rad;
  const Jtransit = J2000 + Jstar + 0.0053 * Math.sin(Mr) - 0.0069 * Math.sin(2 * lr);
  const decl = Math.asin(Math.sin(lr) * Math.sin(23.4397 * rad));
  const phi = lat * rad;
  const cosw = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  if (cosw >= 1) return { polar: 'nuit' };
  if (cosw <= -1) return { polar: 'jour' };
  const w = Math.acos(cosw) * deg;
  const Jrise = Jtransit - w / 360;
  const Jset = Jtransit + w / 360;
  return {
    sunrise: new Date((Jrise - 2440587.5) * 86400000),
    sunset: new Date((Jset - 2440587.5) * 86400000),
  };
}

export function defaultSun(date, h, m) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
}

export function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Priorité : cache API → calcul NOAA local → défaut 06:30/18:00.
export function sunOrDefault(date, lat, lng, cache) {
  const cached = cache && cache[dateKey(date)];
  if (cached && cached.sunrise && cached.sunset) return cached;
  if (lat != null && lng != null) {
    const s = sunTimesFor(date, lat, lng);
    if (s.sunrise && s.sunset) return s;
  }
  return { sunrise: defaultSun(date, 6, 30), sunset: defaultSun(date, 18, 0) };
}

// Affine le cache via l'API publique Sunrise-Sunset (plus précise que le
// calcul NOAA local de sunTimesFor) pour J-1/J/J+1 — no-op réseau pour les
// jours déjà en cache. SOURCE UNIQUE : utilisée à la fois par la page
// Planète complète et par PlanetHourWidget (widget compact affiché sur
// /menu, /parrainage, /commandes) — avant l'extraction ici, seule la page
// complète appelait l'API, le widget restait sur l'approximation NOAA
// seule ; les deux pouvaient alors annoncer une planète différente près
// d'une frontière d'heure, la précision du lever/coucher retenu faisant
// basculer le calcul d'un côté ou de l'autre de la limite.
export async function prefetchSunAPI(lat, lng, cache) {
  if (lat == null) return;
  const base = new Date();
  const days = [-1, 0, 1].map((off) => {
    const d = new Date(base);
    d.setDate(d.getDate() + off);
    return d;
  });
  await Promise.all(
    days.map(async (d) => {
      const key = dateKey(d);
      if (cache[key]) return;
      try {
        const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${key}&formatted=0`;
        const r = await fetch(url);
        const j = await r.json();
        if (j && j.status === 'OK' && j.results && j.results.sunrise && j.results.sunset) {
          cache[key] = { sunrise: new Date(j.results.sunrise), sunset: new Date(j.results.sunset) };
        }
      } catch {
        /* repli local via sunOrDefault */
      }
    })
  );
}

// Détermine la JOURNÉE PLANÉTAIRE courante (lever→lever). Avant le lever du
// jour, on reste dans la journée de la veille.
export function computePday(now, lat, lng, cache) {
  const today = sunOrDefault(now, lat, lng, cache);
  if (now.getTime() < today.sunrise.getTime()) {
    const veille = new Date(now);
    veille.setDate(veille.getDate() - 1);
    const y = sunOrDefault(veille, lat, lng, cache);
    return { sunrise: y.sunrise, sunset: y.sunset, nextSunrise: today.sunrise, dayOfWeek: y.sunrise.getDay(), today };
  }
  const demain = new Date(now);
  demain.setDate(demain.getDate() + 1);
  const t = sunOrDefault(demain, lat, lng, cache);
  return { sunrise: today.sunrise, sunset: today.sunset, nextSunrise: t.sunrise, dayOfWeek: today.sunrise.getDay(), today };
}

// Heure planétaire courante dans la journée planétaire. `start`/`end`
// (Date) donnent les bornes de l'heure en cours — utilisés par le tableau de
// bord (app/planete/page.tsx) pour le temps restant/la barre de progression,
// en plus de `fraction` (0→1, déjà utilisé par natureOf pour Mercure).
export function currentHour(now, pday) {
  const ms = now.getTime();
  const srMs = pday.sunrise.getTime(), ssMs = pday.sunset.getTime(), nsMs = pday.nextSunrise.getTime();
  let isDay, idx, hourStart, hourLen;
  if (ms < ssMs) {
    isDay = true;
    hourLen = (ssMs - srMs) / 12;
    idx = Math.min(11, Math.max(0, Math.floor((ms - srMs) / hourLen)));
    hourStart = srMs + idx * hourLen;
  } else {
    isDay = false;
    hourLen = (nsMs - ssMs) / 12;
    idx = Math.min(11, Math.max(0, Math.floor((ms - ssMs) / hourLen)));
    hourStart = ssMs + idx * hourLen;
  }
  const start = DAY_RULER_MAP[pday.dayOfWeek];
  const planet = CHALDEAN_ORDER[(start + (isDay ? 0 : 12) + idx) % 7];
  const fraction = (ms - hourStart) / hourLen;
  return { planet, isDay, idx, fraction, start: new Date(hourStart), end: new Date(hourStart + hourLen) };
}

// Heure planétaire SUIVANTE dans la MÊME journée planétaire — `null` si
// `cur` est la toute dernière heure nocturne : la suivante appartient à la
// journée planétaire de DEMAIN, dont le lever réel demanderait un nouveau
// calcul (position déjà connue, mais hors périmètre ici) — voir
// app/planete/page.tsx, qui masque alors simplement la ligne « Ensuite ».
// Sert le tableau de bord (« Ensuite : Saturne — Défavorable à 15:59 »).
export function nextHour(pday, cur) {
  const isLastOfPeriod = cur.idx === 11;
  if (!cur.isDay && isLastOfPeriod) return null;
  const isDay = cur.isDay && isLastOfPeriod ? false : cur.isDay;
  const idx = isLastOfPeriod ? 0 : cur.idx + 1;
  const start = cur.end;
  // Durée d'une heure : reprend celle de `cur` sauf en cas de bascule
  // jour→nuit (les deux périodes n'ont pas forcément la même durée).
  const len =
    isDay === cur.isDay
      ? cur.end.getTime() - cur.start.getTime()
      : (pday.nextSunrise.getTime() - pday.sunset.getTime()) / 12;
  const end = new Date(start.getTime() + len);
  const rulerStart = DAY_RULER_MAP[pday.dayOfWeek];
  const planet = CHALDEAN_ORDER[(rulerStart + (isDay ? 0 : 12) + idx) % 7];
  return { planet, isDay, idx, start, end };
}

// Phase mystique du moment (aube / jour / crépuscule / nuit).
export function phaseOf(now, sunrise, sunset) {
  const ms = now.getTime();
  const sr = sunrise.getTime(), ss = sunset.getTime();
  if (ms >= sr - 18e5 && ms < sr + 18e5) return { icon: '🌅', name: 'Aube mystique', badge: 'Transition' };
  if (ms >= sr + 18e5 && ms < ss - 18e5) return { icon: '☀️', name: 'Jour sacré', badge: 'Lumière manifestée' };
  if (ms >= ss - 18e5 && ms < ss + 18e5) return { icon: '🌆', name: 'Crépuscule ésotérique', badge: 'Entre deux mondes' };
  return { icon: '🌙', name: 'Nuit des secrets', badge: 'Royaume des ombres' };
}

const fmtHM = (ms) => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Construit les 12 heures (jour ou nuit) sous forme de données (pas de HTML).
export function buildHourList(pday, cur, isDay) {
  const start = DAY_RULER_MAP[pday.dayOfWeek];
  const dayLen = (pday.sunset.getTime() - pday.sunrise.getTime()) / 12;
  const nightLen = (pday.nextSunrise.getTime() - pday.sunset.getTime()) / 12;
  const baseStart = isDay ? pday.sunrise.getTime() : pday.sunset.getTime();
  const len = isDay ? dayLen : nightLen;
  const rows = [];
  for (let k = 0; k < 12; k++) {
    const i = isDay ? k : k + 12;
    const s = baseStart + k * len;
    const e = s + len;
    const planet = CHALDEAN_ORDER[(start + i) % 7];
    const nat = PLANET_NATURE[planet];
    const isNow = cur.isDay === isDay && cur.idx === k;
    rows.push({ interval: `${fmtHM(s)} – ${fmtHM(e)}`, planet, emoji: CHALDEAN_EMOJIS[planet], nat, isNow });
  }
  return rows;
}
