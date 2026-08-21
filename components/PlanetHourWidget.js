'use client';
// Widget compact « heure planétaire actuelle », pour ne pas avoir à ouvrir le
// module Planète en entier juste pour un coup d'œil. Réutilise la logique
// pure de lib/planete.js (déjà validée sur la page complète) — ici seulement
// l'UI + une position, moins exigeante que la page Planète (GPS one-shot,
// pas d'affinage haute précision : un décalage de quelques centaines de
// mètres ne change jamais la planète de l'heure).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { computePday, currentHour, natureOf, CHALDEAN_EMOJIS } from '@/lib/planete';

// Position de repli si le GPS est refusé/indisponible — widget accessoire,
// jamais bloquant : mieux vaut une heure approximative (Dakar) que rien.
const FALLBACK = { lat: 14.6928, lng: -17.4467 };
const REFRESH_MS = 60000; // la planète de l'heure ne change jamais plus vite qu'une fois par heure

export default function PlanetHourWidget() {
  const [state, setState] = useState(null); // null tant que non calculé

  useEffect(() => {
    let cancelled = false;
    let intervalId;

    function compute(lat, lng) {
      if (cancelled) return;
      const pday = computePday(new Date(), lat, lng, {});
      const cur = currentHour(new Date(), pday);
      setState({ planet: cur.planet, nature: natureOf(cur.planet, cur.fraction) });
    }

    function start(lat, lng) {
      compute(lat, lng);
      intervalId = setInterval(() => compute(lat, lng), REFRESH_MS);
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
