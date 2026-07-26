'use client';
// Module « Planète » — port de planete/planete.html.
// Horloge sacrée + heures planétaires chaldéennes. La position vient du GPS ;
// le lever/coucher est calculé localement (NOAA, lib/planete.js) puis affiné
// via l'API Sunrise-Sunset (avec repli hors-ligne). Toute la logique astro/
// planétaire est dans lib/planete.js ; ici, l'UI React et les effets (GPS,
// horloge 1 s, recalcul aux bascules de journée planétaire).
import './planete.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import {
  DAY_PLANETS,
  CHALDEAN_EMOJIS,
  computePday,
  currentHour,
  phaseOf,
  natureOf,
  buildHourList,
  dateKey,
} from '@/lib/planete';

// API publique Sunrise-Sunset (plus précise) — remplit le cache pour J-1/J/J+1.
async function prefetchSunAPI(lat, lng, cache) {
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

// Nom de ville (réseau, AFFICHAGE seulement — la position vient du GPS).
async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=fr`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.city || d.locality || null;
  } catch {
    return null;
  }
}

const fmtHM = (date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export default function PlanetePage() {
  const { ensureAccess } = useAccess();
  const sunCache = useRef({});

  const [now, setNow] = useState(() => new Date());
  const [geo, setGeo] = useState({ lat: null, lng: null, city: '—', accuracy: null, named: false, ready: false, error: null });
  const [pday, setPday] = useState(null);
  const [todaySun, setTodaySun] = useState(null);
  const [hours, setHours] = useState(null); // { dayName, day[], night[] }
  const [hoursError, setHoursError] = useState('');

  // Recalcule la journée planétaire + le soleil du jour à partir d'une position.
  const recompute = useCallback((lat, lng) => {
    const p = computePday(new Date(), lat, lng, sunCache.current);
    setPday(p);
    setTodaySun({ sunrise: p.today.sunrise, sunset: p.today.sunset });
  }, []);

  const requestGPS = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo((g) => ({ ...g, ready: false, error: 'Géolocalisation non disponible sur cet appareil.' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;
        setGeo({ lat, lng, city: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, accuracy: acc, named: false, ready: true, error: null });
        recompute(lat, lng); // 1) calcul local immédiat
        await prefetchSunAPI(lat, lng, sunCache.current);
        recompute(lat, lng); // 2) affiné via l'API
        const city = await reverseGeocode(lat, lng);
        if (city) setGeo((g) => ({ ...g, city, named: true }));
      },
      (err) => {
        const msg =
          err && err.code === 1
            ? 'Accès GPS refusé. Autorisez la localisation puis réessayez.'
            : 'Position GPS indisponible. Réessayez en extérieur.';
        setGeo((g) => ({ ...g, ready: false, error: msg }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [recompute]);

  // GPS au montage.
  useEffect(() => {
    requestGPS();
  }, [requestGPS]);

  // Horloge : tick chaque seconde.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Bascule de journée planétaire au passage d'un lever.
  useEffect(() => {
    if (!geo.ready || !pday || !pday.sunrise) return;
    const ms = now.getTime();
    if (ms < pday.sunrise.getTime() || ms >= pday.nextSunrise.getTime()) {
      recompute(geo.lat, geo.lng);
    }
  }, [now, geo.ready, geo.lat, geo.lng, pday, recompute]);

  const ready = geo.ready && pday && pday.sunrise;
  const cur = useMemo(() => (ready ? currentHour(now, pday) : null), [ready, now, pday]);
  const phase = ready ? phaseOf(now, todaySun.sunrise, todaySun.sunset) : { icon: '🌟', name: 'Chargement...', badge: 'Phase en cours' };
  const nature = cur ? natureOf(cur.planet, cur.fraction) : null;

  const showHours = async () => {
    const ok = await ensureAccess();
    if (!ok) return;
    if (!ready) {
      setHours(null);
      setHoursError('Position GPS requise. Autorisez la localisation puis réessayez.');
      return;
    }
    const c = currentHour(new Date(), pday);
    setHoursError('');
    setHours({
      dayName: DAY_PLANETS.names[pday.dayOfWeek],
      day: buildHourList(pday, c, true),
      night: buildHourList(pday, c, false),
    });
  };

  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const activeDay = ready ? pday.dayOfWeek : -1;

  return (
    <div className="planete-page">
      <div className="container">
        <Link href="/" className="back-btn">
          ← Retour
        </Link>

        {/* Panneau principal */}
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 0 }}>🌍 Temporalité Mystique</h2>

          <div className="time-display">{timeStr}</div>
          <div className="date-display">{dateStr}</div>

          <div className="planet-card">
            <span className="planet-icon">{phase.icon}</span>
            <div className="planet-name">{phase.name}</div>
            <span className="phase-badge">{phase.badge}</span>
          </div>

          <div style={{ marginTop: 20, textAlign: 'left' }}>
            <InfoRow label="🪐 Planète de l'heure">
              {geo.error ? '— (GPS requis)' : cur ? `${cur.planet} ${CHALDEAN_EMOJIS[cur.planet]}` : '—'}
            </InfoRow>
            <InfoRow label="⚖️ Nature de l'heure" valueClass={nature ? nature.cls : ''}>
              {nature ? nature.txt : '—'}
            </InfoRow>
            <InfoRow label="🗓️ Jour planétaire">
              {ready
                ? `${DAY_PLANETS.names[pday.dayOfWeek]} — régent ${DAY_PLANETS.planets[pday.dayOfWeek]}${
                    pday.dayOfWeek !== now.getDay() ? ' (nuit, avant le lever)' : ''
                  }`
                : '—'}
            </InfoRow>
            <InfoRow label="🌅 Lever du soleil">{ready ? fmtHM(todaySun.sunrise) : '—'}</InfoRow>
            <InfoRow label="🌇 Coucher du soleil">{ready ? fmtHM(todaySun.sunset) : '—'}</InfoRow>
            <InfoRow label="📍 Position">
              {geo.error ? (
                <>
                  <span style={{ color: '#d9534f' }}>{geo.error}</span>
                  <button className="retry-btn" onClick={requestGPS}>
                    Réessayer
                  </button>
                </>
              ) : geo.ready ? (
                geo.named ? (
                  `📡 ${geo.city} (GPS)`
                ) : (
                  `📡 GPS : ${geo.city}${geo.accuracy ? ` (±${geo.accuracy} m)` : ''}`
                )
              ) : (
                '—'
              )}
            </InfoRow>
          </div>

          {/* Bouton protégé : heures planétaires complètes */}
          <button className="access-btn" onClick={showHours}>
            🔮 Déterminer les heures planétaires
          </button>

          {hoursError && <p className="error-text">{hoursError}</p>}
          {hours && (
            <div>
              <p style={{ textAlign: 'center', color: 'var(--accent)', margin: '6px 0' }}>
                Journée planétaire : <strong>{hours.dayName}</strong>
              </p>
              <HoursTable title="☀️ Heures du Jour" rows={hours.day} />
              <HoursTable title="🌙 Heures de la Nuit" rows={hours.night} />
            </div>
          )}
        </div>

        {/* Planètes de la semaine */}
        <div className="glass-panel planets-week">
          <h4>🪐 Régents de la semaine</h4>
          <div>
            {DAY_PLANETS.names.map((day, i) => (
              <div className={'day-row' + (i === activeDay ? ' today' : '')} key={i}>
                <span className="day-name">
                  {i === activeDay ? '▶ ' : ''}
                  {day}
                </span>
                <span className="day-planet">{DAY_PLANETS.planets[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, valueClass, children }) {
  return (
    <div className="info-row">
      <span className="label">{label}</span>
      <span className={'value ' + (valueClass || '')}>{children}</span>
    </div>
  );
}

function HoursTable({ title, rows }) {
  return (
    <div className="planetary-hours-table">
      <h4 style={{ textAlign: 'center', color: 'var(--accent)', margin: '14px 0 8px' }}>{title}</h4>
      <table>
        <thead>
          <tr>
            <th>Intervalle</th>
            <th>Planète</th>
            <th>Nature</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.isNow ? 'now-hour' : ''}>
              <td>{r.interval}</td>
              <td className="planet-name">
                {r.emoji} {r.planet}
                {r.isNow ? ' ◀' : ''}
              </td>
              <td>
                <span className={r.nat.cls}>{r.nat.txt}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
