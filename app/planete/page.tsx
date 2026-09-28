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
// générales → accès aux heures planétaires → régents de la semaine
// repliables. Logique GPS/horloge/accès INCHANGÉE — uniquement la
// présentation.
//
// Refonte des 12 heures (revue 2026-09-27, « sans scroll ») : la liste des
// heures n'est plus ajoutée SOUS le tableau de bord (ce qui empilait dash-
// card + phase-line + info-grid + 12 lignes, obligeant à défiler) — c'est
// désormais un ÉCRAN DÉDIÉ plein cadre (HoursScreen), affiché À LA PLACE du
// tableau de bord une fois les heures calculées. Header compact + carte
// « heure actuelle » + grille compacte 2×6 se partagent exactement la
// hauteur utile (flex, la grille absorbe le reste via des lignes en `fr`) :
// les 12 cartes tiennent donc dans l'écran sans défilement, jour comme nuit
// (bascule via une bottom nav fixe — remplace l'ancien sélecteur Jour/Nuit en
// pastille au milieu du contenu). REMPLACE à son tour la timeline verticale
// (dot + trait reliant les lignes) d'une itération précédente, jugée trop
// haute pour ce nouvel objectif de tenir sans scroll.
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
import {
  Globe, Sparkles, Sunrise, Sunset, MapPin, ChevronDown, ChevronUp, ChevronLeft,
  Sun, Moon, Bell, AlarmClock, AlarmClockCheck, SlidersHorizontal,
} from 'lucide-react';
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
  planetaryHourState,
  upcomingPlanetOccurrences,
} from '@/lib/planete';
import { isSchedulable, OFFSET_CHOICES, SOUND_CHOICES, DEFAULT_ALARM_PREFS } from '@/lib/planetAlarms';
import { planetAlarmsSupported, getPendingAlarmIds, scheduleHourAlarm, scheduleRepeatingAlarms, cancelAlarms } from '@/lib/planetAlarmsNative';
import { getAllPlanetAlarmRecords, savePlanetAlarmRecord, clearPlanetAlarmRecord } from '@/lib/planetAlarmPrefsStore';
import { pushSupported, getPushSubscriptionState, subscribeToPushReminders } from '@/lib/push';
import { WEB_OFFSET_CHOICES, planetSlug, planetFromSlug, ringingWebAlarms } from '@/lib/planetWebAlarms';
import { unlockAlarmAudio, startAlarmRing, stopAlarmRing } from '@/lib/alarmRinger';
import { getWebAlarms, setWebAlarm } from '@/lib/planetWebAlarmsClient';
import { hourEntries, hourIdOf, selectedHourIdFrom } from '@/lib/planetHourSelection';

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
type Period = 'day' | 'night';
// Natif : un enregistrement par planète (lib/planetAlarmPrefsStore.js).
type NativeRecord = { prefs: any; scheduledIds: number[]; startMs?: number | null };
// Web : planètes cochées (par compte, RTDB), indexées par slug.
type WebAlarmEntry = { offsetMin: number; onceStartMs?: number | null };

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

// Libellé compact pour la grille 2×6 : seul le libellé générique de Mercure
// (« 1re moitié favorable · 2de défavorable ») est trop long pour tenir sur
// une carte dense — raccourci en « Mixte » (vocabulaire déjà utilisé par la
// demande de refonte). Les trois autres libellés (Favorable / Très favorable
// / Défavorable) tiennent déjà. Purement un raccourci d'AFFICHAGE : la règle
// favorable/défavorable elle-même (lib/planete.js, PLANET_NATURE) n'est pas
// touchée, et le libellé complet reste visible via l'attribut `title`.
function shortNatureLabel(nat: { txt: string; cls: string }) {
  return nat.cls === 'nat-mix' ? 'Mixte' : nat.txt;
}

// Couleurs des « sphères » planétaires (revue design, maquette du
// 2026-09-28) — un dégradé CSS par planète (teinte + texture en attribut
// `data-planet`, voir planete.css) plutôt qu'une image : aucun asset photo
// des 7 astres à livrer/héberger, même rendu circulaire coloré sur tous les
// écrans/densités. Couleurs INDÉPENDANTES du thème clair/sombre (comme
// PLANET_NATURE, lib/planete.js) : elles représentent l'astre lui-même, pas
// l'accent de marque. Le glyphe astrologique (CHALDEAN_EMOJIS) reste affiché
// À CÔTÉ du nom, inchangé — la sphère s'ajoute, elle ne le remplace pas.
const PLANET_SPHERE_COLORS: Record<string, [string, string]> = {
  Soleil: ['#ffe29a', '#ff7b3d'],
  Lune: ['#f4f6fa', '#9aa4b0'],
  Mars: ['#ffb199', '#b83c22'],
  Mercure: ['#d8d4cd', '#7a746b'],
  Jupiter: ['#f3d9a4', '#b5793a'],
  Vénus: ['#fff3d1', '#d9b774'],
  Saturne: ['#f0dfb0', '#b99a5f'],
};

function PlanetSphere({ planet, kind }: { planet: string; kind: 'hero' | 'grid' }) {
  const [a, b] = PLANET_SPHERE_COLORS[planet] || ['#cfcfcf', '#7a7a7a'];
  return (
    <span
      className={'planet-sphere ' + kind}
      data-planet={planet}
      aria-hidden="true"
      style={{ ['--sphere-a' as any]: a, ['--sphere-b' as any]: b }}
    />
  );
}

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
  const [hoursTab, setHoursTab] = useState<Period>('day'); // période affichée dans HoursScreen
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
      recompute(lat, lng); // même source solaire hors-ligne que les notifications
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
  const nature = cur ? planetaryHourState(cur, now).nature : null;
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
      {hours ? (
        // Écran dédié, sans scroll (voir en-tête du fichier) : remplace
        // ENTIÈREMENT le tableau de bord tant que les heures sont affichées.
        <HoursScreen
          hours={hours}
          period={hoursTab}
          onPeriodChange={setHoursTab}
          onBack={() => setHours(null)}
          dateStr={dateStr}
          todayPlanetName={todayPlanetName}
          position={geo.city}
          cur={cur}
          nature={nature}
          remainingMin={remainingMin}
          progressPct={progressPct}
          lat={geo.lat}
          lng={geo.lng}
          sunCache={sunCache.current}
        />
      ) : (
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

          {/* Accès aux heures planétaires complètes — accès protégé. Le
              résultat (HoursScreen) remplace ce tableau de bord en entier,
              voir plus haut : cette carte ne sert donc plus qu'à LANCER le
              calcul, elle ne montre plus jamais les 12 heures elle-même. */}
          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <button className="access-btn" onClick={showHours}>
              <Sparkles size={17} strokeWidth={2} aria-hidden="true" /> Déterminer les heures planétaires
            </button>

            {/* Notifications (revue design, point 8) : un interrupteur, pas un
                second gros bouton turquoise identique au précédent — c'est une
                préférence, pas l'action principale de la page. Voir
                PlanetPushToggle.js. */}
            <PlanetPushToggle lat={geo.lat} lng={geo.lng} />

            {hoursError && <p className="error-text">{hoursError}</p>}
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
      )}
    </div>
  );
}

// Écran des 12 heures — SANS SCROLL (revue 2026-09-27). Layout en colonne
// flex à hauteur d'écran fixe (100dvh) : header + carte « heure actuelle »
// prennent leur hauteur naturelle (flex: 0 0 auto), la grille de 12 cartes
// absorbe TOUT le reste (flex: 1 1 auto, lignes en `fr`) — elle s'adapte donc
// exactement à l'espace restant plutôt que d'imposer une hauteur de carte
// fixe, ce qui garantit l'absence de scroll même quand le header prend une
// ligne de plus (petit écran, texte qui passe à la ligne). La bottom nav
// Jour/Nuit est fixe en bas d'écran, hors du flux scrollable qui n'existe
// plus.
function HoursScreen({
  hours,
  period,
  onPeriodChange,
  onBack,
  dateStr,
  todayPlanetName,
  position,
  cur,
  nature,
  remainingMin,
  progressPct,
  lat,
  lng,
  sunCache,
}: {
  hours: Hours;
  period: Period;
  onPeriodChange: (p: Period) => void;
  onBack: () => void;
  dateStr: string;
  todayPlanetName: string | null;
  position: string;
  cur: any;
  nature: { txt: string; cls: string } | null;
  remainingMin: number | null;
  progressPct: number;
  lat: number | null;
  lng: number | null;
  sunCache: SunCache;
}) {
  return (
    <div className="hours-screen">
      <header className="hours-header">
        <div className="hours-header-row">
          <button type="button" className="hours-back" onClick={onBack} aria-label="Retour au tableau de bord">
            <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <Globe size={22} strokeWidth={2} className="hours-header-icon" aria-hidden="true" />
          <div className="hours-header-titles">
            <h1 className="hours-title">Heures planétaires</h1>
            <p className="hours-date">{dateStr}</p>
          </div>
        </div>

        {/* Trois informations d'un coup d'œil (maquette du 2026-09-28) — le
            régent du jour et la position étaient auparavant fondus dans une
            seule ligne de méta-texte ; ici chacun a son icône, comme les
            notifications juste à côté. */}
        <div className="hours-info-row">
          <div className="hours-info-item">
            <span className="hours-info-icon" aria-hidden="true">
              {todayPlanetName ? CHALDEAN_EMOJIS[todayPlanetName] : '☿'}
            </span>
            <span className="hours-info-text">
              <span className="hours-info-label">Régent du jour</span>
              <span className="hours-info-value">{todayPlanetName || '—'}</span>
            </span>
          </div>
          <div className="hours-info-item">
            <MapPin size={17} strokeWidth={2} className="hours-info-icon" aria-hidden="true" />
            <span className="hours-info-text">
              <span className="hours-info-label">Localisation</span>
              <span className="hours-info-value">{position}</span>
            </span>
          </div>
          <div className="hours-info-item hours-info-notif">
            <Bell size={17} strokeWidth={2} className="hours-info-icon" aria-hidden="true" />
            <span className="hours-info-text">
              <span className="hours-info-label">Notifications</span>
            </span>
            <PlanetPushToggle lat={lat} lng={lng} compact />
          </div>
        </div>
      </header>

      {cur && nature && (
        <section className="hours-now-card" aria-label="Heure planétaire en cours">
          <p className="hours-now-eyebrow">Heure actuelle</p>
          <div className="hours-now-body">
            <div className="hours-now-left">
              <PlanetSphere planet={cur.planet} kind="hero" />
              <div className="hours-now-main">
                <span className="hours-now-planet">
                  <span aria-hidden="true">{CHALDEAN_EMOJIS[cur.planet]}</span> {cur.planet}
                </span>
                <span className="hours-now-tag">Maintenant</span>
                <span className={'hours-now-badge ' + nature.cls}>● {nature.txt}</span>
              </div>
            </div>
            <div className="hours-now-right">
              <span className="hours-now-interval">
                {fmtHM(cur.start)} — {fmtHM(cur.end)}
              </span>
              <div className="hours-now-progress">
                <div className="hours-now-progress-track">
                  <div className="hours-now-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="hours-now-progress-pct">{Math.round(progressPct)}%</span>
              </div>
              <span className="hours-now-progress-label">{remainingMin} min restantes</span>
            </div>
          </div>
        </section>
      )}

      <HourGrid hours={hours} period={period} lat={lat} lng={lng} sunCache={sunCache} />

      {/* Bottom nav fixe (remplace l'ancienne pastille Jour/Nuit en plein
          contenu) : bascule uniquement le contenu de la grille, la structure
          de l'écran ne bouge pas. Piste unique à deux onglets (maquette du
          2026-09-28), pas deux pastilles séparées : l'onglet actif porte le
          dégradé plein, l'autre reste en texte discret, séparés d'un simple
          trait — lecture « interrupteur à deux positions » plutôt que « deux
          boutons ». */}
      <nav className="hours-bottom-nav" aria-label="Période">
        <button
          type="button"
          className={'hours-bottom-tab' + (period === 'day' ? ' active' : '')}
          onClick={() => onPeriodChange('day')}
          aria-pressed={period === 'day'}
        >
          <Sun size={18} strokeWidth={2.2} aria-hidden="true" />
          Jour
        </button>
        <span className="hours-bottom-nav-sep" aria-hidden="true" />
        <button
          type="button"
          className={'hours-bottom-tab' + (period === 'night' ? ' active' : '')}
          onClick={() => onPeriodChange('night')}
          aria-pressed={period === 'night'}
        >
          <Moon size={18} strokeWidth={2.2} aria-hidden="true" />
          Nuit
        </button>
      </nav>
    </div>
  );
}

// Grille compacte des 12 heures (jour OU nuit — voir `period`, déjà un vrai
// filtre : un seul tableau de 12 cartes rendu à la fois). `rows` est DÉJÀ
// dans l'ordre chronologique (buildHourList) : la grille CSS (2 colonnes,
// flux ligne par ligne) les place donc naturellement dans l'ordre de
// lecture — pas de réagencement en boustrophédon.
function HourGrid({
  hours,
  period,
  lat,
  lng,
  sunCache,
}: {
  hours: Hours;
  period: Period;
  lat: number | null;
  lng: number | null;
  sunCache: SunCache;
}) {
  const rows = period === 'day' ? hours.day : hours.night;
  const nowIdx = rows.findIndex((r) => r.isNow);

  // Deux mécanismes d'alarme selon la plateforme, un seul actif à la fois :
  //   - 'native' : coquille Capacitor Android → notification LOCALE exacte
  //     programmée sur l'appareil (lib/planetAlarmsNative.js), réglages
  //     complets (son/vibration/répétition), stockés par appareil.
  //   - 'web'    : navigateur/PWA → le web ne peut pas programmer une alarme
  //     locale ; on enregistre le choix côté serveur et un cron envoie le push
  //     (lib/planetWebAlarmsClient.js). Réglage réduit au délai (le système
  //     garde le contrôle du son/de la vibration).
  //   - 'none'   : ni l'un ni l'autre (SSR, navigateur sans push) → aucune
  //     cloche, comme PlanetPushToggle.js qui rend `null` hors support.
  const [alarmMode, setAlarmMode] = useState<'none' | 'native' | 'web'>('none');
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  // Natif : un enregistrement par planète (préférences + ids programmés +
  // heure choisie), lu depuis lib/planetAlarmPrefsStore.js — recopié en état
  // pour que les cartes se remettent à jour sans relire localStorage.
  const [records, setRecords] = useState<Record<string, NativeRecord>>({});
  const [webAlarms, setWebAlarms] = useState<Record<string, WebAlarmEntry>>({});
  const [sheetRow, setSheetRow] = useState<any | null>(null);
  const [busyHourId, setBusyHourId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState('');
  // Alarme en train de sonner (écran plein + sonnerie en boucle, web).
  const [ringing, setRinging] = useState<{ planet: string; emoji: string; interval: string; offsetMin: number } | null>(null);

  const refreshPending = useCallback(() => {
    getPendingAlarmIds().then(setPendingIds);
  }, []);

  useEffect(() => {
    let cancelled = false;
    planetAlarmsSupported().then((native) => {
      if (cancelled) return;
      if (native) {
        setAlarmMode('native');
        setRecords(getAllPlanetAlarmRecords());
        refreshPending();
      } else if (pushSupported()) {
        setAlarmMode('web');
        getWebAlarms().then((a) => { if (!cancelled) setWebAlarms(a); }).catch(() => {});
      }
    });
    return () => { cancelled = true; };
  }, [refreshPending]);

  // Premier tap n'importe où sur la page → déverrouille l'audio (contrainte
  // navigateur, voir lib/alarmRinger.js) pour qu'une alarme déjà cochée lors
  // d'une visite précédente puisse sonner sans nouveau clic sur l'horloge.
  useEffect(() => {
    const unlock = () => unlockAlarmAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Sonnerie DANS LA PAGE (web) : à chaque tic, les occurrences cochées dont
  // le déclenchement tombe dans ]tic précédent, maintenant] font sonner
  // l'alarme (ringingWebAlarms). Les occurrences viennent de
  // upcomingPlanetOccurrences (d'hier — la nuit avant le lever appartient à
  // la journée planétaire de la veille — à demain), recalculées toutes les
  // 30 min — l'alarme sonne donc aussi après minuit sans recharger la page.
  // Le push serveur (sw.js) continue de couvrir le cas page fermée.
  const rungKeys = useRef<Set<string>>(new Set());
  const ring = useCallback((planet: string, triggerMs: number, row: any, offsetMin: number) => {
    const key = planet + ':' + triggerMs;
    if (rungKeys.current.has(key)) return;
    rungKeys.current.add(key);
    setRinging({ planet, emoji: row?.emoji || '🪐', interval: row?.interval || '', offsetMin });
    startAlarmRing(() => setRinging(null));
  }, []);

  useEffect(() => {
    if (alarmMode !== 'web' || lat == null || lng == null) return;
    const planets = Object.keys(webAlarms).map((slug) => planetFromSlug(slug)).filter(Boolean) as string[];
    if (!planets.length) return;
    let occ: any[] = [];
    let builtAt = 0;
    let prev = Date.now();
    const tick = () => {
      const nowMs = Date.now();
      if (nowMs - builtAt > 30 * 60000) {
        occ = planets.flatMap((p) => upcomingPlanetOccurrences(p, new Date(nowMs - 86400000), 3, lat, lng, sunCache, prev - 1));
        builtAt = nowMs;
      }
      for (const d of ringingWebAlarms({ rows: occ, enabled: webAlarms, prevMs: prev, nowMs })) {
        ring(d.planet, d.triggerMs, d.row, webAlarms[d.slug]?.offsetMin || 0);
      }
      prev = nowMs;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [alarmMode, webAlarms, lat, lng, sunCache, ring]);

  // Push reçu pendant que la page est ouverte (public/sw.js relaie les
  // alarmes) : filet de sécurité si le minuteur local a été gelé par le
  // navigateur. Même clé de déduplication → jamais deux sonneries.
  useEffect(() => {
    if (alarmMode !== 'web' || typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== 'asrar-planet-alarm' || !d.planet || !d.triggerMs) return;
      ring(d.planet, d.triggerMs, { emoji: d.emoji, interval: d.interval }, d.offsetMin || 0);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [alarmMode, ring]);

  useEffect(() => () => stopAlarmRing(), []);

  // SÉLECTION UNIQUE : l'heure cochée est identifiée par son id propre
  // (période + rang + début + fin, lib/planetHourSelection.js) — JAMAIS par le
  // nom de planète, qui cochait toutes les occurrences d'une même planète.
  // Dérivée des données d'alarme (pas d'un état local à part) : elle reste
  // juste après un re-render, un changement d'onglet Jour/Nuit ou un
  // rechargement.
  const entries = useMemo(() => hourEntries(hours), [hours]);
  const selectedHourId = useMemo(
    () => selectedHourIdFrom({ entries, mode: alarmMode, webAlarms, records, pendingIds, nowMs: Date.now() }),
    [entries, alarmMode, webAlarms, records, pendingIds]
  );

  // Clic sur l'horloge d'une carte : coche CETTE heure (et décoche toute
  // autre — une seule heure à la fois), ou la décoche si elle l'était déjà.
  // Réglages déjà enregistrés pour la planète, sinon « à l'heure exacte ».
  // Les réglages fins restent accessibles via la petite roue crantée.
  const toggleAlarm = async (r: any, hourId: string, isSelected: boolean) => {
    unlockAlarmAudio();
    setBusyHourId(hourId);
    setToggleError('');
    try {
      if (alarmMode === 'native') {
        if (isSelected) {
          const record = records[r.planet];
          if (record) await cancelAlarms(record.scheduledIds);
          clearPlanetAlarmRecord(r.planet);
          setRecords((prev) => ({ ...prev, [r.planet]: { prefs: record?.prefs || DEFAULT_ALARM_PREFS, scheduledIds: [], startMs: null } }));
        } else {
          // Libère toute autre heure cochée (préférences conservées).
          const cleared: Record<string, NativeRecord> = {};
          for (const [planet, rec] of Object.entries(records)) {
            if (!rec.scheduledIds.length) { cleared[planet] = rec; continue; }
            await cancelAlarms(rec.scheduledIds);
            savePlanetAlarmRecord(planet, { prefs: rec.prefs, scheduledIds: [] });
            cleared[planet] = { prefs: rec.prefs, scheduledIds: [], startMs: null };
          }
          const base = cleared[r.planet] || { prefs: DEFAULT_ALARM_PREFS, scheduledIds: [] };
          const res = await applyNativeAlarm(r, base, base.prefs, lat, lng, sunCache);
          setRecords(res.ok ? { ...cleared, [r.planet]: res.record } : cleared);
          if (!res.ok) throw new Error(nativeAlarmErrorMessage(res.error));
        }
        refreshPending();
      } else if (alarmMode === 'web') {
        const slug = planetSlug(r.planet) || '';
        if (isSelected) {
          await setWebAlarm(r.planet, false);
          setWebAlarms((prev) => { const next = { ...prev }; delete next[slug]; return next; });
        } else {
          // Libère les autres planètes cochées, puis lie l'alarme à CETTE heure.
          const others = Object.keys(webAlarms).filter((s) => s !== slug);
          await Promise.all(others.map((s) => setWebAlarm(planetFromSlug(s) || '', false)));
          const offsetMin = webAlarms[slug]?.offsetMin || 0;
          const onceStartMs = r.start.getTime();
          await setWebAlarm(r.planet, true, offsetMin, onceStartMs);
          setWebAlarms({ [slug]: { offsetMin, onceStartMs } });
          ensureDevicePush();
        }
      }
    } catch (e: any) {
      setToggleError(e?.message || "Impossible de modifier l'alarme.");
      if (alarmMode === 'web') getWebAlarms().then(setWebAlarms).catch(() => {}); // resynchronise après un échec partiel
    } finally {
      setBusyHourId(null);
    }
  };

  return (
    <>
      <div className="hour-grid-wrap">
        <ol className="hour-grid">
          {rows.map((r, i) => {
            const hourId = hourIdOf(period, i, r);
            const scheduled = hourId === selectedHourId;
            const showBell = alarmMode !== 'none' && (scheduled || isSchedulable(r.start.getTime(), Date.now()));
            return (
              <li
                key={hourId}
                className={
                  'hour-card' +
                  (r.isNow ? ' is-now' : nowIdx >= 0 && i < nowIdx ? ' is-past' : '') +
                  (scheduled ? ' is-selected' : '')
                }
              >
                <div className="hour-card-icon-wrap">
                  <PlanetSphere planet={r.planet} kind="grid" />
                  <span className="hour-card-num">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div className="hour-card-info">
                  <span className="hour-card-planet">
                    <span aria-hidden="true">{r.emoji}</span> {r.planet}
                  </span>
                  <span className="hour-card-time">{r.interval}</span>
                  <span className={'hour-card-status ' + r.nat.cls} title={r.nat.txt}>
                    ● {shortNatureLabel(r.nat)}
                  </span>
                </div>
                {showBell && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={scheduled}
                    aria-label={`Alarme au début de l'heure de ${r.planet}, ${r.interval}`}
                    title={scheduled ? 'Alarme activée — toucher pour désactiver' : 'Activer une alarme au début de cette heure'}
                    className={'hour-card-alarm' + (scheduled ? ' on' : '')}
                    disabled={busyHourId !== null}
                    onClick={() => toggleAlarm(r, hourId, scheduled)}
                  >
                    {scheduled ? (
                      <AlarmClockCheck size={14} strokeWidth={2.4} aria-hidden="true" />
                    ) : (
                      <AlarmClock size={14} strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                )}
                {showBell && scheduled && (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`Réglages de l'alarme de ${r.planet}`}
                    className="hour-card-settings"
                    onClick={() => setSheetRow(r)}
                  >
                    <SlidersHorizontal size={10} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {toggleError && <p className="error-text hour-grid-error">{toggleError}</p>}
      {ringing && (
        <div className="alarm-ringing-backdrop" role="alertdialog" aria-modal="true" aria-label={`Alarme — ${ringing.planet}`}>
          <div className="alarm-ringing glass-panel">
            <div className="alarm-ringing-icon" aria-hidden="true">
              <AlarmClock size={46} strokeWidth={2} />
            </div>
            <p className="alarm-ringing-planet">
              <span aria-hidden="true">{ringing.emoji}</span> {ringing.planet}
            </p>
            <p className="alarm-ringing-when">
              {ringing.offsetMin > 0 ? `commence dans ${ringing.offsetMin} min` : 'commence maintenant'}
              {ringing.interval ? ` · ${ringing.interval}` : ''}
            </p>
            <button
              type="button"
              className="access-btn"
              autoFocus
              onClick={() => { stopAlarmRing(); setRinging(null); }}
            >
              Arrêter l’alarme
            </button>
          </div>
        </div>
      )}
      {sheetRow && alarmMode === 'native' && (
        <AlarmSettingsSheet
          row={sheetRow}
          record={records[sheetRow.planet] || { prefs: DEFAULT_ALARM_PREFS, scheduledIds: [], startMs: null }}
          lat={lat}
          lng={lng}
          sunCache={sunCache}
          onClose={() => setSheetRow(null)}
          onApplied={(planet, record) => {
            setRecords((prev) => ({ ...prev, [planet]: record }));
            refreshPending();
          }}
        />
      )}
      {sheetRow && alarmMode === 'web' && (
        <WebAlarmSheet
          row={sheetRow}
          current={webAlarms[planetSlug(sheetRow.planet) || ''] || null}
          onClose={() => setSheetRow(null)}
          onApplied={(slug, entry) => {
            setWebAlarms((prev) => {
              const next = { ...prev };
              if (entry) next[slug] = entry;
              else delete next[slug];
              return next;
            });
          }}
        />
      )}
    </>
  );
}

// Programme (ou reprogramme) l'alarme native d'une planète avec `prefs` —
// partagé entre l'horloge cochée directement sur la carte et la feuille de
// réglages. Repart toujours propre (délai/son/répétition ont pu changer).
async function applyNativeAlarm(
  row: any,
  record: NativeRecord,
  prefs: any,
  lat: number | null,
  lng: number | null,
  sunCache: SunCache
): Promise<{ ok: true; record: NativeRecord } | { ok: false; error?: string }> {
  await cancelAlarms(record.scheduledIds);
  const res = prefs.repeat
    ? lat == null || lng == null
      ? { ok: false as const, error: 'position' }
      : await scheduleRepeatingAlarms({ planet: row.planet, prefs, lat, lng, cache: sunCache })
    : await scheduleHourAlarm(row, prefs);
  if (!res.ok) return { ok: false, error: res.error };
  const scheduledIds = 'ids' in res ? res.ids : [res.id];
  const startMs: number = row.start.getTime();
  savePlanetAlarmRecord(row.planet, { prefs, scheduledIds, startMs });
  return { ok: true, record: { prefs, scheduledIds, startMs } };
}

function nativeAlarmErrorMessage(code?: string) {
  if (code === 'permission') return 'Autorisation refusée — activez les notifications pour ASRAR PRO dans les réglages du téléphone.';
  if (code === 'position') return 'Position GPS requise pour programmer les occurrences à venir.';
  if (code === 'past') return 'Cette heure est déjà passée.';
  if (code === 'none') return 'Aucune occurrence à venir trouvée pour cette planète.';
  return "Impossible d'activer l'alarme.";
}

// Web : pour que l'alarme arrive aussi page FERMÉE, l'appareil doit être
// abonné au push. Abonnement « rappels » (sans géolocalisation, voir
// lib/push.js) — best-effort : un refus n'empêche pas la sonnerie page
// ouverte.
function ensureDevicePush() {
  getPushSubscriptionState()
    .then((state) => (state === 'unsubscribed' ? subscribeToPushReminders() : null))
    .catch(() => {});
}

// Feuille de réglages WEB (navigateur/PWA) — pendant réduit de
// AlarmSettingsSheet : seul le délai est réglable (le système garde le
// contrôle du son/de la vibration ; la répétition est implicite, le cron
// annonce chaque occurrence). Écrit côté serveur (par compte) via
// lib/planetWebAlarmsClient.js, contrairement au natif (localStorage).
function WebAlarmSheet({
  row,
  current,
  onClose,
  onApplied,
}: {
  row: any;
  current: WebAlarmEntry | null;
  onClose: () => void;
  onApplied: (slug: string, entry: WebAlarmEntry | null) => void;
}) {
  const slug = planetSlug(row.planet) || '';
  const [offsetMin, setOffsetMin] = useState(current ? current.offsetMin : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = !!current;

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const onceStartMs: number = row.start.getTime(); // reste liée à CETTE heure
      await setWebAlarm(row.planet, true, offsetMin, onceStartMs);
      onApplied(slug, { offsetMin, onceStartMs });
      ensureDevicePush();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Impossible d'activer l'alarme.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError('');
    try {
      await setWebAlarm(row.planet, false);
      onApplied(slug, null);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Impossible de désactiver l'alarme.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="alarm-sheet-backdrop" onClick={onClose}>
      <div className="alarm-sheet glass-panel" role="dialog" aria-modal="true" aria-label={`Alarme — ${row.planet}`} onClick={(e) => e.stopPropagation()}>
        <h4 className="alarm-sheet-title">
          <span aria-hidden="true">{row.emoji}</span> {row.planet} · {row.interval}
        </h4>

        <p className="alarm-sheet-label">Me prévenir</p>
        <div className="alarm-sheet-options">
          {WEB_OFFSET_CHOICES.map((min) => (
            <label key={min} className="alarm-sheet-radio">
              <input type="radio" name="weboffset" checked={offsetMin === min} onChange={() => setOffsetMin(min)} />
              {min === 0 ? 'À l’heure exacte' : `${min} min avant`}
            </label>
          ))}
        </div>

        <p className="alarm-sheet-note">
          Alarme pour cette heure uniquement ({row.interval}), sur tous vos appareils connectés à ce compte.
        </p>

        {error && <p className="error-text">{error}</p>}

        <div className="alarm-sheet-actions">
          {active && (
            <button type="button" className="alarm-sheet-btn-secondary" onClick={disable} disabled={busy}>
              Désactiver l’alarme
            </button>
          )}
          <button type="button" className="access-btn" onClick={apply} disabled={busy}>
            {active ? 'Mettre à jour' : "Activer l’alarme"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Feuille de réglages ouverte en tapant la roue crantée d'une carte cochée —
// « Me prévenir / Sonnerie / Vibration / Répéter », revue produit du
// 2026-09-22. Toujours pré-remplie avec les préférences déjà enregistrées
// pour CETTE planète (record.prefs) — pas celles d'une autre carte/planète.
function AlarmSettingsSheet({
  row,
  record,
  lat,
  lng,
  sunCache,
  onClose,
  onApplied,
}: {
  row: any;
  record: NativeRecord;
  lat: number | null;
  lng: number | null;
  sunCache: SunCache;
  onClose: () => void;
  onApplied: (planet: string, record: NativeRecord) => void;
}) {
  const [prefs, setPrefs] = useState(record.prefs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = record.scheduledIds.length > 0;

  const apply = async () => {
    setBusy(true);
    setError('');
    const res = await applyNativeAlarm(row, record, prefs, lat, lng, sunCache);
    if (res.ok) {
      onApplied(row.planet, res.record);
      onClose();
    } else {
      setError(nativeAlarmErrorMessage(res.error));
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    await cancelAlarms(record.scheduledIds);
    clearPlanetAlarmRecord(row.planet);
    onApplied(row.planet, { prefs: DEFAULT_ALARM_PREFS, scheduledIds: [], startMs: null });
    onClose();
    setBusy(false);
  };

  return (
    <div className="alarm-sheet-backdrop" onClick={onClose}>
      <div className="alarm-sheet glass-panel" role="dialog" aria-modal="true" aria-label={`Alarme — ${row.planet}`} onClick={(e) => e.stopPropagation()}>
        <h4 className="alarm-sheet-title">
          <span aria-hidden="true">{row.emoji}</span> {row.planet} · {row.interval}
        </h4>

        <p className="alarm-sheet-label">Me prévenir</p>
        <div className="alarm-sheet-options">
          {OFFSET_CHOICES.map((min) => (
            <label key={min} className="alarm-sheet-radio">
              <input type="radio" name="offset" checked={prefs.offsetMin === min} onChange={() => setPrefs({ ...prefs, offsetMin: min })} />
              {min === 0 ? 'À l’heure exacte' : `${min} min avant`}
            </label>
          ))}
        </div>

        <p className="alarm-sheet-label">Sonnerie</p>
        <div className="alarm-sheet-options">
          {SOUND_CHOICES.map((s) => (
            <label key={s.id} className="alarm-sheet-radio">
              <input type="radio" name="sound" checked={prefs.soundId === s.id} onChange={() => setPrefs({ ...prefs, soundId: s.id })} />
              {s.label}
            </label>
          ))}
        </div>

        <label className="alarm-sheet-check">
          <input type="checkbox" checked={prefs.vibration} onChange={(e) => setPrefs({ ...prefs, vibration: e.target.checked })} />
          Vibration
        </label>
        <label className="alarm-sheet-check">
          <input type="checkbox" checked={prefs.repeat} onChange={(e) => setPrefs({ ...prefs, repeat: e.target.checked })} />
          Répéter chaque fois que cette planète apparaît
        </label>

        {error && <p className="error-text">{error}</p>}

        <div className="alarm-sheet-actions">
          {active && (
            <button type="button" className="alarm-sheet-btn-secondary" onClick={disable} disabled={busy}>
              Désactiver l’alarme
            </button>
          )}
          <button type="button" className="access-btn" onClick={apply} disabled={busy}>
            {active ? 'Mettre à jour' : "Activer l’alarme"}
          </button>
        </div>
      </div>
    </div>
  );
}
