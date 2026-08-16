'use client';
// Module « Planète » — port de planete/planete.html.
// Horloge sacrée + heures planétaires chaldéennes. La position vient du GPS ;
// le lever/coucher est calculé localement (NOAA, lib/planete.js) puis affiné
// via l'API Sunrise-Sunset (avec repli hors-ligne). Toute la logique astro/
// planétaire est dans lib/planete.js ; ici, l'UI React et les effets (GPS,
// horloge 1 s, recalcul aux bascules de journée planétaire).
import './planete.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import Spinner from '@/components/Spinner';
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

// Précision GPS visée (m) — best-effort : on affine tant que le matériel de
// l'appareil ne l'atteint pas, sans jamais bloquer indéfiniment (souvent
// inatteignable en intérieur). GPS_MAX_WAIT_MS borne l'attente ; passé ce
// délai, on garde la meilleure lecture obtenue plutôt que d'échouer.
const GPS_TARGET_ACCURACY_M = 5;
const GPS_MAX_WAIT_MS = 12000;

export default function PlanetePage() {
  const { ensureAccess } = useAccess();
  const sunCache = useRef({});

  const [now, setNow] = useState(() => new Date());
  const [geo, setGeo] = useState({ lat: null, lng: null, city: '—', accuracy: null, named: false, ready: false, error: null });
  const [pday, setPday] = useState(null);
  const [todaySun, setTodaySun] = useState(null);
  const [hours, setHours] = useState(null); // { dayName, day[], night[] }
  const [hoursError, setHoursError] = useState('');
  const [hoursTab, setHoursTab] = useState('day'); // 'day' | 'night' — onglet actif (moins linéaire que 2 tableaux empilés)

  // Recalcule la journée planétaire + le soleil du jour à partir d'une position.
  const recompute = useCallback((lat, lng) => {
    const p = computePday(new Date(), lat, lng, sunCache.current);
    setPday(p);
    setTodaySun({ sunrise: p.today.sunrise, sunset: p.today.sunset });
  }, []);

  // Une seule lecture GPS (getCurrentPosition) peut être imprécise au « cold
  // start » (peu de satellites encore accrochés). On observe plusieurs
  // lectures (watchPosition) et on garde la plus précise, jusqu'à atteindre
  // GPS_TARGET_ACCURACY_M ou GPS_MAX_WAIT_MS — sans jamais rester bloqué.
  const requestGPS = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo((g) => ({ ...g, ready: false, error: 'Géolocalisation non disponible sur cet appareil.' }));
      return;
    }
    setGeo({ lat: null, lng: null, city: '—', accuracy: null, named: false, ready: false, error: null });

    let best = null;
    let done = false;
    let watchId = null;

    const finalize = async () => {
      if (done || !best) return;
      done = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timeoutId);
      const { lat, lng, acc } = best;
      setGeo({ lat, lng, city: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, accuracy: acc, named: false, ready: true, error: null });
      recompute(lat, lng); // 1) calcul local immédiat
      await prefetchSunAPI(lat, lng, sunCache.current);
      recompute(lat, lng); // 2) affiné via l'API Sunrise-Sunset
      const city = await reverseGeocode(lat, lng);
      if (city) setGeo((g) => ({ ...g, city, named: true }));
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null;
        if (!best || (acc != null && acc < best.acc)) {
          best = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc };
          if (acc != null && acc <= GPS_TARGET_ACCURACY_M) finalize(); // précision cible atteinte
        }
      },
      (err) => {
        if (done) return;
        done = true;
        if (watchId != null) navigator.geolocation.clearWatch(watchId);
        clearTimeout(timeoutId);
        const msg =
          err && err.code === 1
            ? 'Accès GPS refusé. Autorisez la localisation puis réessayez.'
            : 'Position GPS indisponible. Réessayez en extérieur.';
        setGeo((g) => ({ ...g, ready: false, error: msg }));
      },
      { enableHighAccuracy: true, timeout: GPS_MAX_WAIT_MS, maximumAge: 0 }
    );

    // Repli : au-delà du délai max, on garde la meilleure lecture déjà
    // obtenue plutôt que d'attendre indéfiniment un 5 m rarement atteignable
    // en intérieur.
    const timeoutId = setTimeout(finalize, GPS_MAX_WAIT_MS);
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
    setHoursTab(c.isDay ? 'day' : 'night'); // ouvre directement sur la période en cours
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

          <div style={{ marginTop: 12, textAlign: 'left' }}>
            <InfoRow label="🪐 Planète de l'heure">
              {geo.error ? '— (GPS requis)' : cur ? `${cur.planet} ${CHALDEAN_EMOJIS[cur.planet]}` : <Spinner />}
            </InfoRow>
            <InfoRow label="⚖️ Nature de l'heure" valueClass={nature ? nature.cls : ''}>
              {nature ? nature.txt : geo.error ? '—' : <Spinner />}
            </InfoRow>
            <InfoRow label="🗓️ Jour planétaire">
              {ready ? (
                `${DAY_PLANETS.names[pday.dayOfWeek]} — régent ${DAY_PLANETS.planets[pday.dayOfWeek]}${
                  pday.dayOfWeek !== now.getDay() ? ' (nuit, avant le lever)' : ''
                }`
              ) : geo.error ? (
                '—'
              ) : (
                <Spinner />
              )}
            </InfoRow>
            {/* Lever/coucher du soleil : dépendent de la position GPS (jusqu'à
                12 s d'acquisition, voir GPS_MAX_WAIT_MS) puis de l'API
                Sunrise-Sunset — sans repère visuel, l'attente ressemblait à un
                blocage. */}
            <InfoRow label="🌅 Lever du soleil">
              {ready ? fmtHM(todaySun.sunrise) : geo.error ? '—' : <Spinner />}
            </InfoRow>
            <InfoRow label="🌇 Coucher du soleil">
              {ready ? fmtHM(todaySun.sunset) : geo.error ? '—' : <Spinner />}
            </InfoRow>
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
                <>
                  <Spinner /> <span style={{ marginLeft: 6 }}>Localisation…</span>
                </>
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
              <div className="hours-tabs">
                <button
                  className={'hours-tab' + (hoursTab === 'day' ? ' active' : '')}
                  onClick={() => setHoursTab('day')}
                >
                  ☀️ Jour
                </button>
                <button
                  className={'hours-tab' + (hoursTab === 'night' ? ' active' : '')}
                  onClick={() => setHoursTab('night')}
                >
                  🌙 Nuit
                </button>
              </div>
              <HourGrid rows={hoursTab === 'day' ? hours.day : hours.night} />
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

// Colonnes fixes de .hours-grid (voir planete.css) — un vrai boustrophédon
// (ligne suivante lue en sens inverse) suppose de connaître le nombre de
// colonnes à l'avance ; incompatible avec l'ancien
// `repeat(auto-fill, minmax(130px, 1fr))` responsive, remplacé par 2 fixes.
const HOURS_GRID_COLS = 2;

// Réordonne l'affichage en boustrophédon : les lignes d'indice impair sont
// inversées, si bien que deux heures consécutives sont TOUJOURS des cases
// physiquement adjacentes (jamais de saut en diagonale d'un bout de ligne à
// l'autre) — reproduit exactement le tracé « en zigzag à angles droits »
// dessiné à la main par l'utilisateur, plutôt qu'un simple ordre de lecture
// classique (gauche→droite puis retour chariot).
function boustrophedon(items, cols) {
  const out = [];
  for (let i = 0; i < items.length; i += cols) {
    const row = items.slice(i, i + cols);
    if ((i / cols) % 2 === 1) row.reverse();
    out.push(...row);
  }
  return out;
}

// Grille de cartes plutôt qu'un tableau de 12 lignes : plus rapide à
// parcourir d'un coup d'œil que la vue linéaire précédente (deux tableaux
// empilés de 12 lignes chacun).
//
// Retour utilisateur : on se perd dans l'ordre des heures en parcourant la
// grille (capture avec un cheminement tracé à la main entre les cartes, en
// zigzag à angles droits). Trois aides, redondantes et complémentaires :
//   1) l'affichage lui-même suit ce zigzag (boustrophedon ci-dessus) — les
//      cartes consécutives sont toujours voisines, jamais en diagonale.
//   2) un numéro d'ordre (①…⑫) sur chaque carte, TOUJOURS l'heure
//      chronologique réelle (pas la position d'affichage) — fiable à 100 %,
//      ne dépend d'aucune mesure du DOM.
//   3) une ligne de cheminement (SVG) reliant les cartes DANS L'ORDRE
//      CHRONOLOGIQUE (via cardRefs indexé par heure réelle, pas par position
//      d'affichage) — position réelle mesurée (getBoundingClientRect) et
//      redessinée à chaque changement de taille (ResizeObserver), puisque
//      impossible à prévoir en CSS pur.
function HourGrid({ rows }) {
  const wrapRef = useRef(null);
  const cardRefs = useRef([]); // indexé par heure CHRONOLOGIQUE (rows[i]), pas par position affichée
  const [pathD, setPathD] = useState('');
  const [viewBox, setViewBox] = useState('0 0 0 0');

  const displayRows = useMemo(
    () => boustrophedon(
      rows.map((r, i) => ({ ...r, trueIndex: i })),
      HOURS_GRID_COLS
    ),
    [rows]
  );

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    const recompute = () => {
      const wrapRect = wrap.getBoundingClientRect();
      const pts = cardRefs.current
        .slice(0, rows.length)
        .filter(Boolean)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return [r.left - wrapRect.left + r.width / 2, r.top - wrapRect.top + r.height / 2];
        });
      setPathD(pts.length < 2 ? '' : pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' '));
      setViewBox(`0 0 ${wrapRect.width} ${wrapRect.height}`);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [rows]);

  return (
    <div className="hours-grid-wrap" ref={wrapRef}>
      <svg className="hours-path" viewBox={viewBox} preserveAspectRatio="none">
        <defs>
          <marker id="hourPathArrow" markerWidth="9" markerHeight="9" refX="6" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 Z" fill="var(--accent)" />
          </marker>
        </defs>
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 9"
            opacity="0.55"
            markerEnd="url(#hourPathArrow)"
          />
        )}
      </svg>
      <div className="hours-grid">
        {displayRows.map((r) => (
          <div
            key={r.trueIndex}
            ref={(el) => {
              cardRefs.current[r.trueIndex] = el;
            }}
            className={'hour-card' + (r.isNow ? ' now-hour' : '')}
          >
            <span className="hour-card-order">{r.trueIndex + 1}</span>
            <div className="hour-card-planet">
              {r.emoji} {r.planet}
              {r.isNow ? ' ◀' : ''}
            </div>
            <div className="hour-card-interval">{r.interval}</div>
            <div className={'hour-card-nature ' + r.nat.cls}>{r.nat.txt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
