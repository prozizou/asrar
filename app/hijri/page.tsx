'use client';
// Module « Date du jour » — date hijri du jour (API AlAdhan, lib/hijri.js),
// avec la date grégorienne correspondante et les fêtes éventuelles.
import './hijri.css';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchHijriToday } from '@/lib/hijri';
import { phaseOfDay } from '@/lib/hijriPhases';
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
        <section className="hijri-card" aria-live="polite">
          <p className="hijri-weekday">{data.hijri.weekdayAr} · {data.hijri.weekdayEn}</p>
          <p className="hijri-day">{data.hijri.day}</p>
          <p className="hijri-month" dir="rtl" lang="ar">{data.hijri.monthAr}</p>
          <p className="hijri-month-en">{data.hijri.monthEn} · {data.hijri.year} H</p>
          <p className="hijri-greg">
            {data.gregorian.weekdayEn} {data.gregorian.day} {data.gregorian.monthEn} {data.gregorian.year}
          </p>
          {data.hijri.holidays.length > 0 && (
            <ul className="hijri-holidays">
              {data.hijri.holidays.map((h: string) => <li key={h}>{h}</li>)}
            </ul>
          )}
        </section>
      )}

      {data && phase && !loading && (
        <section className={`hijri-phase hijri-phase-${phase.id}`}>
          <div className="hijri-phase-head">
            <span className="hijri-phase-icon" aria-hidden="true">{phase.icon}</span>
            <div>
              <h2 className="hijri-phase-title">{phase.title} <span lang="ar">{phase.arabic}</span></h2>
              <p className="hijri-phase-summary">{phase.summary}</p>
            </div>
          </div>
          {phase.totalDays && (
            <div
              className="hijri-gauge"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={phase.totalDays}
              aria-valuenow={phase.dayInPhase}
            >
              <span style={{ width: `${(phase.dayInPhase / phase.totalDays) * 100}%` }} />
            </div>
          )}
          <p className="hijri-phase-progress">
            Jour {phase.dayInPhase}{phase.totalDays ? ` sur ${phase.totalDays}` : ''}
            {phase.daysLeft === null
              ? ' · jusqu’à la fin du mois'
              : phase.daysLeft === 0
                ? ' · dernier jour de la période'
                : ` · encore ${phase.daysLeft} jour${phase.daysLeft > 1 ? 's' : ''} avant le changement`}
          </p>
          <ul className="hijri-suggestions">
            {phase.suggestions.map((s) => (
              <li key={s.cta}>
                <Link href={s.href} className="hijri-suggestion">
                  <span>{s.label}</span>
                  <strong>{s.cta} →</strong>
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
