'use client';
// Jour planétaire + heure planétaire du moment (lib/hijriPlanet.js), à lire
// avec la phase du mois. Position GPS tentée en douceur : sans elle, lever et
// coucher par défaut (06:30 / 18:00) et mention « approximatif ».
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { planetNow } from '@/lib/hijriPlanet';

type Coords = { lat: number; lng: number } | null;

export default function PlanetNow() {
  const [coords, setCoords] = useState<Coords>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { timeout: 8000, maximumAge: 3600000 },
      );
    }
    return () => clearInterval(t);
  }, []);

  if (!now) return null;
  const r = planetNow(now, coords?.lat ?? null, coords?.lng ?? null);
  const until = r.until.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <section className="hijri-planet">
      <h2 className="hijri-planet-title">En ce moment</h2>
      <div className="hijri-planet-grid">
        <div>
          <span className="hijri-planet-label">Jour · {r.dayName}</span>
          <strong>{r.dayEmoji} {r.dayPlanet}</strong>
        </div>
        <div>
          <span className="hijri-planet-label">Heure planétaire</span>
          <strong>{r.hourEmoji} {r.hourPlanet}</strong>
        </div>
      </div>
      <p className="hijri-planet-note">
        {r.nature.txt} — jusqu’à {until}
        {r.approximate && ' · horaire approximatif (position indisponible)'}
      </p>
      <Link href="/planete" className="hijri-planet-link">Voir toutes les heures →</Link>
    </section>
  );
}
