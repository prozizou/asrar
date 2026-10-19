'use client';
// Jour planétaire + heure planétaire du moment (lib/hijriPlanet.js), à lire
// avec la phase du mois. Position GPS tentée en douceur : sans elle, lever et
// coucher par défaut (06:30 / 18:00) et mention « approximatif ».
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';
import { planetNow } from '@/lib/hijriPlanet';

type Coords = { lat: number; lng: number } | null;

function remaining(ms: number) {
  const min = Math.max(1, Math.ceil(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

export default function PlanetNow() {
  const [coords, setCoords] = useState<Coords>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15000);
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
    <section className="hijri-card hijri-planet">
      <div className="hijri-planet-head">
        <h2 className="hijri-planet-title">En ce moment</h2>
        <span className="hijri-pill hijri-pill-quiet">Jour · {r.dayName}</span>
      </div>
      <div className="hijri-planet-grid">
        <div className="hijri-planet-item">
          <span className="hijri-planet-glyph" aria-hidden="true">{r.dayEmoji}</span>
          <div>
            <strong>{r.dayPlanet}</strong>
            <span>Planète du jour</span>
          </div>
        </div>
        <div className="hijri-planet-item">
          <span className="hijri-planet-glyph" aria-hidden="true">{r.hourEmoji}</span>
          <div>
            <strong>{r.hourPlanet}</strong>
            <span>Heure planétaire actuelle</span>
          </div>
        </div>
      </div>
      <div className="hijri-planet-now">
        <div className={`hijri-planet-nature ${r.nature.cls}`}>
          <strong>{r.nature.txt}</strong>
          <span>jusqu’à {until}</span>
        </div>
        <div className="hijri-planet-left">
          <Clock size={26} strokeWidth={1.6} aria-hidden="true" />
          <div>
            <span>Reste</span>
            <strong>{remaining(r.until.getTime() - now.getTime())}</strong>
          </div>
        </div>
        <Link href="/planete" className="hijri-planet-link">
          Voir toutes les heures <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {r.approximate && <p className="hijri-planet-note">Horaire approximatif (position indisponible).</p>}
    </section>
  );
}
