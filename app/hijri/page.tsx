'use client';
// Module « Date du jour » — date hijri du jour (API AlAdhan, lib/hijri.js),
// avec la date grégorienne correspondante et les fêtes éventuelles.
import './hijri.css';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchHijriToday } from '@/lib/hijri';

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
      <p className="hijri-credit">Source : AlAdhan Islamic Calendar API</p>
    </div>
  );
}
