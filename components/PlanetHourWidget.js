'use client';
// Widget compact « heure planétaire actuelle », pour ne pas avoir à ouvrir le
// module Planète en entier juste pour un coup d'œil. Réutilise la logique
// pure de lib/planete.js (déjà validée sur la page complète) — ici seulement
// l'UI + une position, moins exigeante que la page Planète (GPS one-shot,
// pas d'affinage haute précision : un décalage de quelques centaines de
// mètres ne change jamais la planète de l'heure).
//
// Affinage du lever/coucher via prefetchSunAPI (comme la page complète,
// cf. app/planete/page.tsx) — INDISPENSABLE, pas un simple bonus de
// précision : sans lui, ce widget restait sur l'approximation NOAA locale
// (sunTimesFor) tandis que la page complète utilise l'API Sunrise-Sunset,
// plus précise. Près d'une frontière entre deux heures planétaires, cet
// écart de quelques minutes pouvait faire basculer le calcul d'un côté ou
// de l'autre de la limite — symptôme observé : ce widget annonçait parfois
// une planète différente de celle affichée sur /planete, au même instant.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { computePday, currentHour, natureOf, prefetchSunAPI, CHALDEAN_EMOJIS } from '@/lib/planete';

// Position de repli si le GPS est refusé/indisponible — widget accessoire,
// jamais bloquant : mieux vaut une heure approximative (Dakar) que rien.
const FALLBACK = { lat: 14.6928, lng: -17.4467 };
const REFRESH_MS = 60000; // la planète de l'heure ne change jamais plus vite qu'une fois par heure

export default function PlanetHourWidget() {
  const [state, setState] = useState(null); // null tant que non calculé
  const sunCache = useRef({}); // rempli par prefetchSunAPI, persiste entre les rafraîchissements

  useEffect(() => {
    let cancelled = false;
    let intervalId;

    function compute(lat, lng) {
      if (cancelled) return;
      const pday = computePday(new Date(), lat, lng, sunCache.current);
      const cur = currentHour(new Date(), pday);
      setState({ planet: cur.planet, nature: natureOf(cur.planet, cur.fraction) });
    }

    // Même séquence en deux temps que la page Planète complète : calcul
    // local immédiat (retour instantané), puis affinage via l'API dès
    // qu'elle répond — cache déjà rempli aux rafraîchissements suivants
    // (prefetchSunAPI ne refait pas de requête pour un jour déjà en cache),
    // donc un coût réseau négligeable au-delà du premier calcul.
    async function tick(lat, lng) {
      compute(lat, lng);
      await prefetchSunAPI(lat, lng, sunCache.current);
      compute(lat, lng);
    }

    function start(lat, lng) {
      tick(lat, lng);
      intervalId = setInterval(() => tick(lat, lng), REFRESH_MS);
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => start(pos.coords.latitude, pos.coords.longitude),
        () => start(FALLBACK.lat, FALLBACK.lng),
        { timeout: 5000, maximumAge: 300000 }
      );
    } else {
      start(FALLBACK.lat, FALLBACK.lng);
    }

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  if (!state) return null; // accessoire : pas de spinner, apparaît quand prêt

  return (
    <Link href="/planete" className="menu-item planet-hour-widget">
      <div style={{ fontSize: '2rem' }}>{CHALDEAN_EMOJIS[state.planet]}</div>
      <h3>Heure de {state.planet}</h3>
      <p className={'menu-item-desc ' + state.nature.cls}>{state.nature.txt}</p>
    </Link>
  );
}
