'use client';
// Module « Planète » — temporalité mystique et heures planétaires chaldéennes.
// Lever/coucher calculés localement (NOAA, lib/planete.js) pour la date et la
// position : GPS, ou ville choisie à la main (lib/places.js, horaires à
// l'heure locale de la ville). Jour = 12 heures du lever au coucher, nuit =
// 12 heures du coucher au lever du lendemain.
//
// Refonte du 2026-10-19 (style Material 3 clair, voir planete.css) :
//   - tableau de bord compact : horloge, heure planétaire actuelle (régent,
//     horaires, nature, progression écoulé/restant, heure suivante), période
//     astronomique active, régent du jour / lever / coucher / position ;
//   - états distincts : recherche de position, position indisponible,
//     données astronomiques indisponibles (zone polaire) — jamais de valeurs
//     inventées ni anciennes présentées comme actuelles ;
//   - écran des 12 heures (jour OU nuit) DÉRIVÉ de l'horloge, plus figé à
//     l'ouverture ;
//   - notifications en une ligne : push web, ou alertes locales programmées
//     48 h à l'avance dans l'app Android (lib/planetHourChangeNative.js).
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
  Sparkles, Sunrise, Sunset, MapPin, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Sun, Moon, Bell, AlarmClock, AlarmClockCheck, SlidersHorizontal, Search, LocateFixed, X,
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
  sunEventsAvailable,
} from '@/lib/planete';
import { searchPlaces, readSavedPlace, savePlace, clearSavedPlace } from '@/lib/places';
import { hourChangeSupported, readHourChangeState, enableHourChangeAlerts, disableHourChangeAlerts } from '@/lib/planetHourChangeNative';
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

// Format « 19:31 » dans le fuseau de la position (ville choisie à la main) ou,
// sans fuseau, à l'heure de l'appareil.
const hmIn = (date: Date, timeZone?: string | null) =>
  date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : {}) });

// « 55 min » / « 1 h 05 » — arrondi au-dessus : « 0 min » laisserait croire
// que l'heure est finie alors qu'il en reste quelques secondes.
function remainingLabel(ms: number) {
  const min = Math.max(1, Math.ceil(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

// Précision GPS visée (m) — best-effort : on affine tant que le matériel de
// l'appareil ne l'atteint pas, sans jamais bloquer indéfiniment (souvent
// inatteignable en intérieur). GPS_MAX_WAIT_MS borne l'attente ; passé ce
// délai, on garde la meilleure lecture obtenue plutôt que d'échouer.
const GPS_TARGET_ACCURACY_M = 5;
const GPS_MAX_WAIT_MS = 12000;

// Position : GPS (fuseau de l'appareil) ou ville choisie à la main
// (lib/places.js — fuseau IANA de la ville, horaires affichés à son heure).
interface Place {
  name: string;
  detail?: string;
  lat: number;
  lng: number;
  timeZone: string | null;
  source: 'gps' | 'manual';
  accuracy?: number | null;
}
// UN seul état de localisation (revue : plusieurs indicateurs séparés) :
// en cours, prête, ou en erreur — jamais une ancienne position affichée
// comme actuelle pendant une nouvelle recherche.
type LocState = { status: 'locating' } | { status: 'ready'; place: Place } | { status: 'error'; message: string };

export default function PlanetePage() {
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { ensureAccess } = useAccess() as unknown as {
    ensureAccess: (minLevel?: number) => Promise<boolean>;
  };
  const sunCache = useRef<SunCache>({});

  const [now, setNow] = useState(() => new Date());
  const [loc, setLoc] = useState<LocState>({ status: 'locating' });
  // Journée planétaire calculée pour la position courante + disponibilité
  // réelle d'un lever/coucher (zone polaire : AUCUNE valeur inventée).
  const [pday, setPday] = useState<any>(null);
  const [astroOk, setAstroOk] = useState(true);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [hoursTab, setHoursTab] = useState<Period>('day');
  const [weekExpanded, setWeekExpanded] = useState(false);
  const [placeSheet, setPlaceSheet] = useState(false);
  const gpsRun = useRef(0); // invalide une recherche GPS dépassée

  const place = loc.status === 'ready' ? loc.place : null;
  const tz = place?.timeZone || undefined;

  const recompute = useCallback((p: Place) => {
    const at = new Date();
    const zone = p.timeZone || undefined;
    const ok = sunEventsAvailable(at, p.lat, p.lng, zone);
    setAstroOk(ok);
    setPday(ok ? computePday(at, p.lat, p.lng, sunCache.current, zone) : null);
  }, []);

  const applyPlace = useCallback((p: Place) => {
    sunCache.current = {};
    setLoc({ status: 'ready', place: p });
    recompute(p);
  }, [recompute]);

  // Une seule lecture GPS (getCurrentPosition) peut être imprécise au « cold
  // start » : on observe plusieurs lectures (watchPosition) et on garde la
  // plus précise, jusqu'à GPS_TARGET_ACCURACY_M ou GPS_MAX_WAIT_MS.
  const requestGPS = useCallback(() => {
    const run = ++gpsRun.current;
    setPday(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLoc({ status: 'error', message: 'Géolocalisation indisponible sur cet appareil. Choisissez une ville.' });
      return;
    }
    setLoc({ status: 'locating' });

    let best: { lat: number; lng: number; acc: number | null } | null = null;
    let done = false;
    let watchId: number | null = null;

    const finalize = async () => {
      if (done || !best || run !== gpsRun.current) return;
      done = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timeoutId);
      const { lat, lng, acc } = best;
      applyPlace({ name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, lat, lng, timeZone: null, source: 'gps', accuracy: acc });
      const city = await reverseGeocode(lat, lng);
      if (city && run === gpsRun.current) {
        setLoc((l) => (l.status === 'ready' && l.place.source === 'gps' && l.place.lat === lat ? { status: 'ready', place: { ...l.place, name: city } } : l));
      }
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null;
        if (!best || (acc != null && acc < (best.acc as number))) {
          best = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc };
          if (acc != null && acc <= GPS_TARGET_ACCURACY_M) finalize();
        }
      },
      (err) => {
        if (done || run !== gpsRun.current) return;
        done = true;
        if (watchId != null) navigator.geolocation.clearWatch(watchId);
        clearTimeout(timeoutId);
        setLoc({
          status: 'error',
          message: err && err.code === 1
            ? 'Accès à la localisation refusé. Autorisez-le, ou choisissez une ville.'
            : 'Position introuvable pour le moment. Réessayez, ou choisissez une ville.',
        });
      },
      { enableHighAccuracy: true, timeout: GPS_MAX_WAIT_MS, maximumAge: 0 }
    );
    const timeoutId = setTimeout(finalize, GPS_MAX_WAIT_MS);
  }, [applyPlace]);

  // Au montage : ville mémorisée (choix manuel) sinon GPS.
  useEffect(() => {
    const saved = readSavedPlace();
    if (saved) applyPlace({ ...saved, source: 'manual' });
    else requestGPS();
  }, [applyPlace, requestGPS]);

  // Horloge : tick chaque seconde (heure, progression, temps restant, régent
  // suivant se mettent à jour sans rechargement).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Bascule de journée planétaire au passage d'un lever (ou d'un jour civil
  // en zone sans lever, pour réévaluer la disponibilité).
  useEffect(() => {
    if (!place) return;
    if (!pday) {
      if (!astroOk && now.getSeconds() === 0 && now.getMinutes() === 0) recompute(place);
      return;
    }
    const ms = now.getTime();
    if (ms < pday.sunrise.getTime() || ms >= pday.nextSunrise.getTime()) recompute(place);
  }, [now, place, pday, astroOk, recompute]);

  const ready = !!(place && pday);
  const cur = useMemo(() => (ready ? currentHour(now, pday) : null), [ready, now, pday]);
  const next = useMemo(() => (ready && cur ? nextHour(pday, cur) : null), [ready, cur, pday]);
  const nature = cur ? planetaryHourState(cur, now).nature : null;
  const nextNature = next ? natureOf(next.planet, undefined) : null;
  const elapsedPct = cur
    ? Math.min(100, Math.max(0, ((now.getTime() - cur.start.getTime()) / (cur.end.getTime() - cur.start.getTime())) * 100))
    : 0;
  const phase = ready ? phaseOf(now, pday.today.sunrise, pday.today.sunset) : null;

  // Les 12 + 12 heures sont DÉRIVÉES de l'état courant (plus figées à
  // l'ouverture) : l'heure « en cours » et les heures passées suivent l'horloge.
  const curKey = cur ? `${cur.isDay}:${cur.idx}` : '';
  const hours = useMemo<Hours | null>(() => {
    if (!hoursOpen || !ready || !cur) return null;
    return {
      dayName: DAY_PLANETS.names[pday.dayOfWeek],
      day: buildHourList(pday, cur, true, tz),
      night: buildHourList(pday, cur, false, tz),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcul à chaque changement d'heure (curKey), pas chaque seconde
  }, [hoursOpen, ready, pday, curKey, tz]);

  const showHours = async () => {
    if (!ready || !cur) return;
    const ok = await ensureAccess();
    if (!ok) return;
    setHoursTab(cur.isDay ? 'day' : 'night'); // ouvre sur la période en cours
    setHoursOpen(true);
  };

  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', ...(tz ? { timeZone: tz } : {}) });
  // Seule la première lettre en majuscule (convention française).
  const rawDateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', ...(tz ? { timeZone: tz } : {}) });
  const dateStr = rawDateStr.charAt(0).toUpperCase() + rawDateStr.slice(1);
  const activeDay = ready ? pday.dayOfWeek : -1;
  const todayPlanetName = ready ? DAY_PLANETS.planetNames[pday.dayOfWeek] : null;
  const fmt = (d: Date) => hmIn(d, tz);

  const placeLabel = place ? place.name : loc.status === 'locating' ? 'Localisation…' : 'Position inconnue';

  if (hours && cur && nature) {
    return (
      <div className="planete-page pm">
        <HoursScreen
          hours={hours}
          period={hoursTab}
          onPeriodChange={setHoursTab}
          onBack={() => setHoursOpen(false)}
          dateStr={dateStr}
          todayPlanetName={todayPlanetName}
          position={placeLabel}
          cur={cur}
          nature={nature}
          remaining={remainingLabel(cur.end.getTime() - now.getTime())}
          elapsedPct={elapsedPct}
          fmt={fmt}
          lat={place?.lat ?? null}
          lng={place?.lng ?? null}
          sunCache={sunCache.current}
        />
      </div>
    );
  }

  return (
    <div className="planete-page pm">
      <div className="pm-container">
        <Link href="/" className="back-btn">← Retour</Link>

        <header className="pm-head">
          <p className="pm-eyebrow">Temporalité mystique</p>
          <p className="pm-clock" aria-live="off">{timeStr}</p>
          <p className="pm-date">{dateStr}</p>
          <button type="button" className="pm-place-chip" onClick={() => setPlaceSheet(true)} aria-label={`Position : ${placeLabel}. Changer de ville`}>
            <MapPin size={15} strokeWidth={2.2} aria-hidden="true" /> {placeLabel}
          </button>
        </header>

        {/* États distincts : recherche de position, erreur de position,
            données astronomiques indisponibles — puis seulement le calcul. */}
        {loc.status === 'locating' && (
          <section className="pm-card pm-state" aria-live="polite">
            <Spinner />
            <div>
              <p className="pm-state-title">Recherche de votre position…</p>
              <p className="pm-state-text">Les heures planétaires dépendent du lever et du coucher du soleil à l’endroit où vous êtes.</p>
            </div>
            <button type="button" className="pm-btn-text" onClick={() => setPlaceSheet(true)}>Choisir une ville</button>
          </section>
        )}
        {loc.status === 'error' && (
          <section className="pm-card pm-state is-error" role="alert">
            <p className="pm-state-title">Position indisponible</p>
            <p className="pm-state-text">{loc.message}</p>
            <div className="pm-state-actions">
              <button type="button" className="pm-btn-tonal" onClick={requestGPS}>Réessayer</button>
              <button type="button" className="pm-btn-filled" onClick={() => setPlaceSheet(true)}>Choisir une ville</button>
            </div>
          </section>
        )}
        {place && !astroOk && (
          <section className="pm-card pm-state is-error" role="alert">
            <p className="pm-state-title">Données astronomiques indisponibles</p>
            <p className="pm-state-text">
              Le soleil ne se lève pas ou ne se couche pas à {place.name} en ce moment (jour ou nuit polaire) : les heures planétaires ne peuvent pas y être calculées.
            </p>
            <div className="pm-state-actions">
              <button type="button" className="pm-btn-filled" onClick={() => setPlaceSheet(true)}>Choisir une autre ville</button>
            </div>
          </section>
        )}

        {ready && cur && nature && (
          <>
            {/* Heure planétaire actuelle : régent, horaires, nature,
                progression réelle (écoulé / restant), heure suivante. */}
            <section className="pm-card pm-now" aria-label="Heure planétaire actuelle">
              <p className="pm-label">Heure planétaire actuelle</p>
              <div className="pm-now-row">
                <span className="pm-glyph lg" aria-hidden="true">{CHALDEAN_EMOJIS[cur.planet]}</span>
                <div className="pm-now-id">
                  <p className="pm-now-planet">{cur.planet}</p>
                  <p className="pm-now-time">{fmt(cur.start)} – {fmt(cur.end)}</p>
                </div>
                <span className={'pm-chip ' + nature.cls}>{nature.txt}</span>
              </div>
              <div
                className="pm-progress"
                role="progressbar"
                aria-label="Avancement de l'heure planétaire"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.floor(elapsedPct)}
              >
                <span style={{ width: `${elapsedPct}%` }} />
              </div>
              <div className="pm-progress-legend">
                <span><strong>{remainingLabel(cur.end.getTime() - now.getTime())}</strong> restantes</span>
                <span>{Math.floor(elapsedPct)} % écoulés</span>
              </div>
              {next && nextNature && (
                <p className="pm-next">
                  Ensuite : <span aria-hidden="true">{CHALDEAN_EMOJIS[next.planet]}</span> <strong>{next.planet}</strong> à {fmt(next.start)}
                  <span className={'pm-next-nat ' + nextNature.cls}> · {shortNatureLabel(nextNature)}</span>
                </p>
              )}
            </section>

            {/* Période astronomique active, bornes comprises. */}
            <section className="pm-card pm-period">
              <span className="pm-period-icon" aria-hidden="true">
                {cur.isDay ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
              </span>
              <div className="pm-period-text">
                <p className="pm-period-title">
                  {cur.isDay ? 'Période diurne' : 'Période nocturne'}
                  <span className="pm-period-span">
                    {cur.isDay ? `${fmt(pday.sunrise)} → ${fmt(pday.sunset)}` : `${fmt(pday.sunset)} → ${fmt(pday.nextSunrise)}`}
                  </span>
                </p>
                {phase && <p className="pm-period-sub">{phase.name} · {phase.badge}</p>}
              </div>
            </section>

            <section className="pm-card pm-grid">
              <div className="pm-cell">
                <span className="pm-cell-label">Régent du jour</span>
                <span className="pm-cell-value">
                  <span aria-hidden="true">{CHALDEAN_EMOJIS[todayPlanetName!]}</span> {todayPlanetName}
                </span>
              </div>
              <div className="pm-cell">
                <span className="pm-cell-label"><Sunrise size={14} strokeWidth={2} aria-hidden="true" /> Lever</span>
                <span className="pm-cell-value">{fmt(pday.today.sunrise)}</span>
              </div>
              <div className="pm-cell">
                <span className="pm-cell-label"><Sunset size={14} strokeWidth={2} aria-hidden="true" /> Coucher</span>
                <span className="pm-cell-value">{fmt(pday.today.sunset)}</span>
              </div>
              <div className="pm-cell">
                <span className="pm-cell-label"><MapPin size={14} strokeWidth={2} aria-hidden="true" /> Position</span>
                <span className="pm-cell-value pm-cell-place">{place!.name}</span>
                <button type="button" className="pm-link" onClick={() => setPlaceSheet(true)}>Changer</button>
              </div>
              {tz && <p className="pm-tz-note">Horaires à l’heure locale de {place!.name}.</p>}
            </section>

            <button type="button" className="pm-btn-filled pm-cta" onClick={showHours}>
              <Sparkles size={18} strokeWidth={2} aria-hidden="true" /> Déterminer les heures planétaires
            </button>
          </>
        )}

        <NotificationsRow place={place} sunCache={sunCache.current} onOpenAlarms={ready ? showHours : undefined} />

        {/* Régents de la semaine : une ligne repliée (aujourd'hui), les 7 à un tap. */}
        <section className="pm-card pm-week">
          <button
            type="button"
            className="pm-week-toggle"
            onClick={() => setWeekExpanded((v) => !v)}
            aria-expanded={weekExpanded}
          >
            <span className="pm-week-text">
              <span className="pm-week-title">Régents de la semaine</span>
              {ready && (
                <span className="pm-week-today">
                  Aujourd’hui · {DAY_PLANETS.names[activeDay]} · {todayPlanetName} {CHALDEAN_EMOJIS[todayPlanetName!]}
                </span>
              )}
            </span>
            {weekExpanded ? <ChevronUp size={20} strokeWidth={2} aria-hidden="true" /> : <ChevronDown size={20} strokeWidth={2} aria-hidden="true" />}
          </button>
          {weekExpanded && (
            <ul className="pm-week-list">
              {DAY_PLANETS.names.map((day: string, i: number) => (
                <li key={day} className={i === activeDay ? 'today' : undefined}>
                  <span>{day}</span>
                  <span>
                    {DAY_PLANETS.planetNames[i]} <span aria-hidden="true">{CHALDEAN_EMOJIS[DAY_PLANETS.planetNames[i]]}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {placeSheet && (
        <PlaceSheet
          onClose={() => setPlaceSheet(false)}
          onPick={(p) => { savePlace(p); applyPlace({ ...p, source: 'manual' }); setPlaceSheet(false); }}
          onUseGps={() => { clearSavedPlace(); setPlaceSheet(false); requestGPS(); }}
        />
      )}
    </div>
  );
}

// Choix de la ville : recherche (lib/places.js) ou retour au GPS.
function PlaceSheet({ onClose, onPick, onUseGps }: {
  onClose: () => void;
  onPick: (p: { name: string; detail: string; lat: number; lng: number; timeZone: string | null }) => void;
  onUseGps: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ name: string; detail: string; lat: number; lng: number; timeZone: string | null }[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setStatus('idle'); return undefined; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus('loading');
      try {
        setResults(await searchPlaces(q, ctrl.signal));
        setStatus('idle');
      } catch (e: any) {
        if (e?.name !== 'AbortError') setStatus('error');
      }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  return (
    <div className="pm-sheet-backdrop" onClick={onClose}>
      <div className="pm-sheet" role="dialog" aria-modal="true" aria-label="Choisir la ville" onClick={(e) => e.stopPropagation()}>
        <div className="pm-sheet-head">
          <h2 className="pm-sheet-title">Choisir la ville</h2>
          <button type="button" className="pm-icon-btn" onClick={onClose} aria-label="Fermer"><X size={20} strokeWidth={2} /></button>
        </div>
        <button type="button" className="pm-sheet-gps" onClick={onUseGps}>
          <LocateFixed size={18} strokeWidth={2} aria-hidden="true" /> Utiliser ma position actuelle (GPS)
        </button>
        <label className="pm-search">
          <Search size={18} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            autoFocus
            placeholder="Rechercher une ville (ex. Matam)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher une ville"
          />
        </label>
        <div className="pm-sheet-results" aria-live="polite">
          {status === 'loading' && <p className="pm-sheet-hint">Recherche…</p>}
          {status === 'error' && <p className="pm-sheet-hint is-error">Recherche impossible. Vérifiez votre connexion.</p>}
          {status === 'idle' && q.trim().length >= 2 && results.length === 0 && <p className="pm-sheet-hint">Aucune ville trouvée.</p>}
          <ul>
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" className="pm-sheet-item" onClick={() => onPick(r)}>
                  <span className="pm-sheet-item-name">{r.name}</span>
                  <span className="pm-sheet-item-detail">{r.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Notifications : UNE ligne compacte. App Android → alertes LOCALES à chaque
// changement d'heure (programmées 48 h à l'avance, reçues app fermée,
// lib/planetHourChangeNative.js). Navigateur → push web (PlanetPushToggle).
// « Alarmes par heure » ouvre l'écran des heures, où chaque heure se règle.
function NotificationsRow({ place, sunCache, onOpenAlarms }: {
  place: Place | null;
  sunCache: SunCache;
  onOpenAlarms?: () => void;
}) {
  const [mode, setMode] = useState<'checking' | 'native' | 'web' | 'none'>('checking');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    hourChangeSupported().then((native) => {
      if (!alive) return;
      if (native) { setMode('native'); setEnabled(readHourChangeState().enabled); }
      else setMode(pushSupported() ? 'web' : 'none');
    });
    return () => { alive = false; };
  }, []);

  // Activé : renouvelle la fenêtre de 48 h à chaque visite / changement de position.
  const lat = place?.lat ?? null;
  const lng = place?.lng ?? null;
  const zone = place?.timeZone || null;
  useEffect(() => {
    if (mode !== 'native' || !enabled || lat == null || lng == null) return;
    enableHourChangeAlerts({ lat, lng, cache: sunCache, timeZone: zone }).then((r) => {
      if (!r.ok && r.error === 'permission') { setEnabled(false); setMsg('Notifications refusées dans les réglages du téléphone.'); }
    });
  }, [mode, enabled, lat, lng, zone, sunCache]);

  const toggleNative = async () => {
    setBusy(true);
    setMsg('');
    if (enabled) {
      await disableHourChangeAlerts();
      setEnabled(false);
    } else {
      const r = await enableHourChangeAlerts({ lat, lng, cache: sunCache, timeZone: zone });
      if (r.ok) setEnabled(true);
      else setMsg(r.error === 'permission'
        ? 'Autorisez les notifications d’ASRAR PRO dans les réglages du téléphone.'
        : r.error === 'position' ? 'Position requise pour programmer les alertes.' : 'Impossible de programmer les alertes.');
    }
    setBusy(false);
  };

  if (mode === 'checking') return null;

  return (
    <section className="pm-card pm-notif">
      <div className="pm-notif-row">
        <span className="pm-notif-icon" aria-hidden="true"><Bell size={20} strokeWidth={2} /></span>
        <div className="pm-notif-text">
          <p className="pm-notif-title">Notifications</p>
          <p className="pm-notif-sub">
            {mode === 'none' ? 'Indisponibles sur ce navigateur' : 'Alertes aux changements d’heure'}
          </p>
        </div>
        {mode === 'native' && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Alertes aux changements d’heure planétaire"
            className={'switch' + (enabled ? ' on' : '')}
            onClick={toggleNative}
            disabled={busy}
          >
            <span className="switch-knob" />
          </button>
        )}
        {mode === 'web' && <PlanetPushToggle lat={lat} lng={lng} compact />}
      </div>
      {msg && <p className="error-text">{msg}</p>}
      {onOpenAlarms && mode !== 'none' && (
        <button type="button" className="pm-notif-more" onClick={onOpenAlarms}>
          Alarmes par heure <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

// Écran des 12 heures (jour OU nuit, jamais mélangés) : en-tête, heure en
// cours compacte, sélecteur Jour/Nuit, grille.
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
  remaining,
  elapsedPct,
  fmt,
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
  nature: { txt: string; cls: string };
  remaining: string;
  elapsedPct: number;
  fmt: (d: Date) => string;
  lat: number | null;
  lng: number | null;
  sunCache: SunCache;
}) {
  return (
    <div className="pm-container pm-hours">
      <header className="pm-hours-head">
        <button type="button" className="pm-icon-btn" onClick={onBack} aria-label="Retour au tableau de bord">
          <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div>
          <h1 className="pm-hours-title">Heures planétaires</h1>
          <p className="pm-hours-meta">
            {dateStr} · {position}
            {todayPlanetName && <> · Régent : {CHALDEAN_EMOJIS[todayPlanetName]} {todayPlanetName}</>}
          </p>
        </div>
      </header>

      <section className="pm-card pm-now compact" aria-label="Heure planétaire en cours">
        <div className="pm-now-row">
          <span className="pm-glyph" aria-hidden="true">{CHALDEAN_EMOJIS[cur.planet]}</span>
          <div className="pm-now-id">
            <p className="pm-now-planet">{cur.planet}</p>
            <p className="pm-now-time">{fmt(cur.start)} – {fmt(cur.end)} · {remaining} restantes</p>
          </div>
          <span className={'pm-chip ' + nature.cls}>{shortNatureLabel(nature)}</span>
        </div>
        <div className="pm-progress" aria-hidden="true"><span style={{ width: `${elapsedPct}%` }} /></div>
      </section>

      <div className="pm-segmented" role="tablist" aria-label="Période">
        <button
          type="button"
          role="tab"
          aria-selected={period === 'day'}
          className={period === 'day' ? 'active' : undefined}
          onClick={() => onPeriodChange('day')}
        >
          <Sun size={18} strokeWidth={2} aria-hidden="true" /> Jour · 12 heures
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={period === 'night'}
          className={period === 'night' ? 'active' : undefined}
          onClick={() => onPeriodChange('night')}
        >
          <Moon size={18} strokeWidth={2} aria-hidden="true" /> Nuit · 12 heures
        </button>
      </div>

      <HourGrid hours={hours} period={period} lat={lat} lng={lng} sunCache={sunCache} />
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
                  <span className="pm-glyph" aria-hidden="true">{r.emoji}</span>
                  <span className="hour-card-num">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div className="hour-card-info">
                  <span className="hour-card-planet">{r.planet}</span>
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
