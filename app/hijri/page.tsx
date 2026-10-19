'use client';
// Module « Date du jour » — date hijri du jour (API AlAdhan, lib/hijri.js),
// date grégorienne correspondante, phase du mois (attraction / repoussement),
// planète du moment et rappels de début de phase.
import './hijri.css';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { fetchHijriToday } from '@/lib/hijri';
import { phaseOfDay, PHASE_ATTRACTION } from '@/lib/hijriPhases';
import Moon from './Moon';
import PlanetNow from './PlanetNow';
import HijriReminders from './HijriReminders';

type HijriToday = Awaited<ReturnType<typeof fetchHijriToday>>;

export default function HijriPage() {
  const [data, setData] = useState<HijriToday | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    try {
      setData(await fetchHijriToday(new Date(), signal));
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const phase = data ? phaseOfDay(data.hijri.day, data.hijri.monthDays) : null;

  return (
    <div className="container hijri-page">
      <Link href="/" className="back-btn">← Retour</Link>
      <h1 className="hijri-title">Date du jour</h1>

      {loading && <p className="hijri-state">Chargement…</p>}

      {error && !loading && (
        <div className="hijri-state">
          <p>Impossible de récupérer la date hijri. Vérifiez votre connexion.</p>
          <button type="button" className="hijri-retry" onClick={() => load()}>Réessayer</button>
        </div>
      )}

      {data && !loading && (
        <section className="hijri-card hijri-date" aria-live="polite">
          <span className="hijri-badge"><i aria-hidden="true" />Calendrier islamique</span>
          <div className="hijri-date-hijri">
            <p className="hijri-weekday">{data.hijri.weekdayEn} · <span lang="ar">{data.hijri.weekdayAr}</span></p>
            <p className="hijri-day">{data.hijri.day}</p>
            <p className="hijri-month" dir="rtl" lang="ar">{data.hijri.monthAr}</p>
            <p className="hijri-month-en">{data.hijri.monthEn} · {data.hijri.year} H</p>
          </div>
          <div className="hijri-date-greg">
            <CalendarDays size={40} strokeWidth={1.6} aria-hidden="true" />
            <div>
              <p className="hijri-greg-day">{data.gregorian.weekdayFr}</p>
              <p className="hijri-greg-date">{data.gregorian.dateFr}</p>
              <p className="hijri-greg-sub">Correspondance grégorienne</p>
            </div>
          </div>
          {data.hijri.holidays.length > 0 && (
            <ul className="hijri-holidays">
              {data.hijri.holidays.map((h: string) => <li key={h}>{h}</li>)}
            </ul>
          )}
        </section>
      )}

      {data && phase && !loading && (
        <section className={`hijri-card hijri-phase hijri-phase-${phase.id}`}>
          <div className="hijri-phase-head">
            <Moon waxing={phase.id === PHASE_ATTRACTION} />
            <div className="hijri-phase-text">
              <h2 className="hijri-phase-title">{phase.title}</h2>
              <p>{phase.range}</p>
              <p>{phase.tagline}</p>
            </div>
            <span className="hijri-pill">
              Jour {phase.dayInPhase}{phase.totalDays ? ` sur ${phase.totalDays}` : ''}
            </span>
          </div>
          {phase.elapsedPct !== null && (
            <div className="hijri-gauge-row">
              <div
                className="hijri-gauge"
                role="progressbar"
                aria-label="Avancement de la période"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={phase.elapsedPct}
              >
                <span style={{ width: `${phase.elapsedPct}%` }} />
              </div>
              <span className="hijri-gauge-pct">{phase.elapsedPct} %</span>
            </div>
          )}
          <p className="hijri-phase-progress">
            {phase.daysLeft === null
              ? 'Jusqu’à la fin du mois'
              : phase.daysLeft === 0
                ? 'Dernier jour de la période'
                : `Encore ${phase.daysLeft} jour${phase.daysLeft > 1 ? 's' : ''} avant le changement de phase`}
          </p>
          <ul className="hijri-suggestions">
            {phase.suggestions.map((s) => (
              <li key={s.cta}>
                <Link href={s.href} className="hijri-suggestion">
                  <span>{s.label}</span>
                  <ChevronRight size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && !loading && <PlanetNow />}
      <HijriReminders />
      <p className="hijri-credit">Source : AlAdhan Islamic Calendar API</p>
    </div>
  );
}
