'use client';
// Module « Planète » — port de planete/planete.html.
// Horloge sacrée + heures planétaires chaldéennes. La position vient du GPS ;
// le lever/coucher est calculé localement (NOAA, lib/planete.js) puis affiné
// via l'API Sunrise-Sunset (avec repli hors-ligne). Toute la logique astro/
// planétaire est dans lib/planete.js ; ici, l'UI React et les effets (GPS,
// horloge 1 s, recalcul aux bascules de journée planétaire).
//
// Refonte de hiérarchie (revue design, 10 points) : la page listait une
// dizaine d'informations à plat, toutes de même poids visuel — l'heure
// planétaire ACTUELLE (ce que l'utilisateur vient chercher en priorité)
// était noyée au même niveau que « Jour sacré » ou le lever du soleil.
// Restructurée en : tableau de bord compact (heure/planète/nature/temps
// restant) → ligne secondaire (phase du jour) → grille compacte d'infos
// générales → heures planétaires en TIMELINE chronologique (remplace la
// grille 2×6 en boustrophédon + tracé SVG d'une itération précédente, jugée
// à son tour perturbante) → notifications en interrupteur (plus un gros
// bouton) → régents de la semaine repliables. Logique GPS/horloge/accès
// INCHANGÉE — uniquement la présentation.
//
// TypeScript (batch 6/7, cf. tsconfig.json) : Geo/TodaySun/Hours sont des
// types locaux pour l'état React de cette page — lib/planete.js reste en .js
// (hors scope de ce batch) : pday/hours restent typés `any` en local plutôt
// que reproduits en interfaces (forme interne complexe, propre à ce module),
// même principe que lib/rouwhania.js et lib/geomancie.js dans les batches
// précédents (#120, #122). useAccess()/Spinner.js suivent le même
// traitement (cast) que dans les batches précédents.
import './planete.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Globe, Sparkles, Sunrise, Sunset, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useAccess } from '@/components/AccessProvider';
import SpinnerUntyped from '@/components/Spinner';
import PlanetPushToggle from '@/components/PlanetPushToggle';
import {
  DAY_PLANETS,
  CHALDEAN_EMOJIS,
  computePday,
  currentHour,
  nextHour,
  phaseOf,
  natureOf,
  buildHourList,
  prefetchSunAPI,
} from '@/lib/planete';

const Spinner = SpinnerUntyped as any;

interface Geo {
  lat: number | null;
  lng: number | null;
  city: string;
  accuracy: number | null;
  named: boolean;
  ready: boolean;
  error: string | null;
}

interface TodaySun {
  sunrise: Date;
  sunset: Date;
}

interface Hours {
  dayName: string;
  day: any[];
  night: any[];
}

type SunCache = Record<string, { sunrise: Date; sunset: Date }>;

// Nom de ville (réseau, AFFICHAGE seulement — la position vient du GPS).
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
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

const fmtHM = (date: Date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Précision GPS visée (m) — best-effort : on affine tant que le matériel de
// l'appareil ne l'atteint pas, sans jamais bloquer indéfiniment (souvent
// inatteignable en intérieur). GPS_MAX_WAIT_MS borne l'attente ; passé ce
// délai, on garde la meilleure lecture obtenue plutôt que d'échouer.
const GPS_TARGET_ACCURACY_M = 5;
const GPS_MAX_WAIT_MS = 12000;

export default function PlanetePage() {
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { ensureAccess } = useAccess() as unknown as {
    ensureAccess: (minLevel?: number) => Promise<boolean>;
  };
  const sunCache = useRef<SunCache>({});

  const [now, setNow] = useState(() => new Date());
  const [geo, setGeo] = useState<Geo>({ lat: null, lng: null, city: '—', accuracy: null, named: false, ready: false, error: null });
  const [pday, setPday] = useState<any>(null);
  const [todaySun, setTodaySun] = useState<TodaySun | null>(null);
  const [hours, setHours] = useState<Hours | null>(null); // { dayName, day[], night[] }
  const [hoursError, setHoursError] = useState('');
  const [hoursTab, setHoursTab] = useState<'day' | 'night'>('day'); // onglet actif (moins linéaire que 2 tableaux empilés)
  const [weekExpanded, setWeekExpanded] = useState(false); // régents : replié par défaut (point 9)

  // Recalcule la journée planétaire + le soleil du jour à partir d'une position.
  const recompute = useCallback((lat: number | null, lng: number | null) => {
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

    let best: { lat: number; lng: number; acc: number | null } | null = null;
    let done = false;
    let watchId: number | null = null;

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
        if (!best || (acc != null && acc < (best.acc as number))) {
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
  const next = useMemo(() => (ready && cur ? nextHour(pday, cur) : null), [ready, cur, pday]);
  const phase = ready ? phaseOf(now, todaySun!.sunrise, todaySun!.sunset) : { icon: '🌟', name: 'Chargement...', badge: 'Phase en cours' };
  const nature = cur ? natureOf(cur.planet, cur.fraction) : null;
  // Pas de `fraction` pour l'heure SUIVANTE : elle n'a pas encore commencé —
  // pour Mercure (seule planète dont la nature dépend de l'avancement dans
  // l'heure), natureOf() retombe alors sur le libellé générique « 1re moitié
  // favorable · 2de défavorable ».
  const nextNature = next ? natureOf(next.planet, undefined) : null;

  // Temps restant de l'heure en cours (tableau de bord — point 1). Arrondi
  // au-dessus (Math.ceil) : « 0 min restantes » donnerait l'impression
  // trompeuse que l'heure est déjà finie alors qu'il en reste quelques
  // secondes.
  const remainingMin = cur ? Math.max(0, Math.ceil((cur.end.getTime() - now.getTime()) / 60000)) : null;
  const progressPct = cur
    ? Math.min(100, Math.max(0, ((now.getTime() - cur.start.getTime()) / (cur.end.getTime() - cur.start.getTime())) * 100))
    : 0;

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
  // toLocaleDateString('fr-FR', {weekday:'long'…}) rend le jour en minuscule
  // ("mercredi 2 septembre") — juste la PREMIÈRE lettre en majuscule
  // (convention française : seul le premier mot d'une date l'est, pas le
  // mois — text-transform: capitalize en CSS aurait aussi capitalisé
  // "septembre", à tort).
  const rawDateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const dateStr = rawDateStr.charAt(0).toUpperCase() + rawDateStr.slice(1);
  const activeDay = ready ? pday.dayOfWeek : -1;
  const todayPlanetName = ready ? DAY_PLANETS.planetNames[pday.dayOfWeek] : null;

  return (
    <div className="planete-page">
      <div className="container">
        <Link href="/" className="back-btn">
          ← Retour
        </Link>

        {/* Tableau de bord (revue design, point 1) : l'heure planétaire ACTIVE
            devient l'information dominante — avant, elle n'était qu'une ligne
            parmi d'autres, au même niveau que le lever du soleil. */}
        <div className="glass-panel dash-card">
          <h2 className="dash-title">
            <Globe size={20} strokeWidth={2} aria-hidden="true" /> Temporalité Mystique
          </h2>
          <div className="time-display">{timeStr}</div>
          <div className="date-display">{dateStr}</div>

          {cur && nature ? (
            <div className="dash-hero">
              <div className="dash-hero-planet">
                <span className="dash-planet-symbol" aria-hidden="true">
                  {CHALDEAN_EMOJIS[cur.planet]}
                </span>
                <span className="dash-planet-name">{cur.planet}</span>
              </div>
              <div className="dash-hero-interval">
                {fmtHM(cur.start)} — {fmtHM(cur.end)}
              </div>
              <span className={'dash-nature-badge ' + nature.cls}>● {nature.txt.toUpperCase()}</span>

              <div className="dash-progress">
                <div className="dash-progress-track">
                  <div className="dash-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="dash-progress-label">{remainingMin} min restantes</span>
              </div>

              {/* Amélioration proposée par l'utilisateur : donner un aperçu de
                  la SUITE, pas seulement de l'instant présent — l'app connaît
                  déjà l'intervalle planétaire suivant, sans calcul
                  supplémentaire (voir lib/planete.js, nextHour()). */}
              {next && nextNature && (
                <p className="dash-next">
                  Ensuite : {CHALDEAN_EMOJIS[next.planet]} {next.planet} — {nextNature.txt} à {fmtHM(next.start)}
                </p>
              )}
            </div>
          ) : geo.error ? (
            <p className="error-text">{geo.error}</p>
          ) : (
            <div className="dash-hero">
              <Spinner /> <span style={{ marginLeft: 6, color: 'var(--text-dim)' }}>Localisation…</span>
            </div>
          )}
        </div>

        {/* « Jour sacré » (revue design, point 2) : réduit à une ligne
            secondaire — utile en contexte, mais moins prioritaire que
            l'heure planétaire active ci-dessus. */}
        <div className="glass-panel phase-line">
          <span aria-hidden="true">{phase.icon}</span> {phase.name}
          <span className="phase-line-sep">•</span>
          {phase.badge}
        </div>

        {/* Infos générales en grille compacte (revue design, point 3) —
            remplace une longue colonne label/valeur empilée (≈50% de hauteur
            en moins pour la même information). */}
        <div className="glass-panel">
          <div className="info-grid">
            <div className="info-cell">
              <span className="info-cell-icon" aria-hidden="true">
                {todayPlanetName ? CHALDEAN_EMOJIS[todayPlanetName] : '☿'}
              </span>
              <span className="info-cell-label">Régent du jour</span>
              <span className="info-cell-value">
                {ready ? (
                  <>
                    {todayPlanetName}
                    {pday.dayOfWeek !== now.getDay() && (
                      <span className="info-cell-note"> (nuit, avant le lever)</span>
                    )}
                  </>
                ) : geo.error ? (
                  '—'
                ) : (
                  <Spinner />
                )}
              </span>
            </div>
            <div className="info-cell">
              <Sunrise size={18} strokeWidth={2} className="info-cell-icon" aria-hidden="true" />
              <span className="info-cell-label">Lever</span>
              <span className="info-cell-value">{ready ? fmtHM(todaySun!.sunrise) : geo.error ? '—' : <Spinner />}</span>
            </div>
            <div className="info-cell">
              <Sunset size={18} strokeWidth={2} className="info-cell-icon" aria-hidden="true" />
              <span className="info-cell-label">Coucher</span>
              <span className="info-cell-value">{ready ? fmtHM(todaySun!.sunset) : geo.error ? '—' : <Spinner />}</span>
            </div>
            <div className="info-cell">
              <MapPin size={18} strokeWidth={2} className="info-cell-icon" aria-hidden="true" />
              <span className="info-cell-label">Position</span>
              <span className="info-cell-value">
                {geo.error ? (
                  <>
                    <span style={{ color: '#d9534f' }}>GPS indisponible</span>
                    <button className="retry-btn" onClick={requestGPS}>
                      Réessayer
                    </button>
                  </>
                ) : geo.ready ? (
                  geo.named ? geo.city : `${geo.city}${geo.accuracy ? ` (±${geo.accuracy} m)` : ''}`
                ) : (
                  <Spinner />
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Heures planétaires complètes — accès protégé */}
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <button className="access-btn" onClick={showHours}>
            <Sparkles size={17} strokeWidth={2} aria-hidden="true" /> Déterminer les heures planétaires
          </button>

          {/* Notifications (revue design, point 8) : un interrupteur, pas un
              second gros bouton turquoise identique au précédent — c'est une
              préférence, pas l'action principale de la page. Voir
              PlanetPushToggle.js. */}
          <PlanetPushToggle />

          {hoursError && <p className="error-text">{hoursError}</p>}
          {hours && (
            <div>
              <p className="hours-day-label">
                Journée planétaire : <strong>{hours.dayName}</strong>
              </p>
              <div className="hours-tabs">
                <button
                  className={'hours-tab' + (hoursTab === 'day' ? ' active' : '')}
                  onClick={() => setHoursTab('day')}
                >
                  <span aria-hidden="true">☉</span> Jour
                </button>
                <button
                  className={'hours-tab' + (hoursTab === 'night' ? ' active' : '')}
                  onClick={() => setHoursTab('night')}
                >
                  <span aria-hidden="true">☽</span> Nuit
                </button>
              </div>
              <HourTimeline
                rows={hoursTab === 'day' ? hours.day : hours.night}
                remainingMin={remainingMin}
                progressPct={progressPct}
              />
            </div>
          )}
        </div>

        {/* Régents de la semaine (revue design, point 9) : repliés par
            défaut — un résumé « aujourd'hui » suffit à la plupart des
            visites, la liste complète reste à un tap. */}
        <div className="glass-panel planets-week">
          <h4>Régents de la semaine</h4>
          {ready && (
            <div className="week-today-card">
              <span className="week-today-label">Aujourd'hui</span>
              <span className="week-today-day">{DAY_PLANETS.names[activeDay]}</span>
              <span className="week-today-planet">
                {todayPlanetName} <span aria-hidden="true">{CHALDEAN_EMOJIS[todayPlanetName!]}</span>
              </span>
            </div>
          )}
          <button
            type="button"
            className="week-toggle"
            onClick={() => setWeekExpanded((v) => !v)}
            aria-expanded={weekExpanded}
          >
            {weekExpanded ? 'Masquer les 7 régents' : 'Voir les 7 régents'}
            {weekExpanded ? (
              <ChevronUp size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
            )}
          </button>
          {weekExpanded && (
            <div>
              {DAY_PLANETS.names.map((day: string, i: number) => (
                <div className={'day-row' + (i === activeDay ? ' today' : '')} key={i}>
                  <span className="day-name">
                    {i === activeDay ? '▶ ' : ''}
                    {day}
                  </span>
                  <span className="day-planet">
                    {DAY_PLANETS.planetNames[i]} <span aria-hidden="true">{CHALDEAN_EMOJIS[DAY_PLANETS.planetNames[i]]}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Timeline chronologique des 12 heures (jour OU nuit — voir hoursTab, déjà un
// vrai filtre : un seul tableau de 12 lignes rendu à la fois, point 7 de la
// revue). REMPLACE l'ancienne grille 2×6 en boustrophédon + tracé SVG reliant
// les cartes (ajoutée lors d'une revue précédente pour un souci similaire —
// « on se perd dans l'ordre en parcourant la grille » — mais qui donnait à
// son tour, de l'aveu de cette nouvelle revue, une impression de diagramme
// de dépendances plutôt qu'une simple succession chronologique). `rows` est
// DÉJÀ dans l'ordre chronologique (buildHourList) : aucun réagencement
// nécessaire, contrairement à l'ancien composant.
function HourTimeline({
  rows,
  remainingMin,
  progressPct,
}: {
  rows: any[];
  remainingMin: number | null;
  progressPct: number;
}) {
  const nowIdx = rows.findIndex((r) => r.isNow);
  return (
    <ol className="hour-timeline">
      {rows.map((r, i) => (
        <li
          key={i}
          className={
            'timeline-item' + (r.isNow ? ' is-now' : nowIdx >= 0 && i < nowIdx ? ' is-past' : '')
          }
        >
          <span className="timeline-marker" aria-hidden="true">
            <span className="timeline-dot" />
          </span>
          <div className="timeline-content">
            <div className="timeline-head">
              <span className="timeline-order">{i + 1}</span>
              <span className="timeline-planet">
                <span aria-hidden="true">{r.emoji}</span> {r.planet}
                {r.isNow ? ' — maintenant' : ''}
              </span>
              <span className="timeline-interval">{r.interval}</span>
            </div>
            <div className={'timeline-nature ' + r.nat.cls}>● {r.nat.txt}</div>
            {r.isNow && (
              <div className="dash-progress timeline-progress">
                <div className="dash-progress-track">
                  <div className="dash-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="dash-progress-label">{remainingMin} min restantes</span>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
