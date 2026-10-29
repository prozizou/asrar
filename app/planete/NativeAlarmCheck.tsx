'use client';

import { useEffect, useState } from 'react';
import { alarmDiagnosticIssues, PLANET_ALARM_TEST_ID } from '@/lib/planetAlarmDiagnostics';
import { cancelAlarms, getPlanetAlarmStatus, testPlanetAlarm } from '@/lib/planetAlarmsNative';

export default function NativeAlarmCheck({ errorMessage }: { errorMessage: (code?: string) => string }) {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fallback, setFallback] = useState('');

  const refresh = async () => {
    try { setStatus(await getPlanetAlarmStatus()); setError(''); }
    catch (e: any) { setError(errorMessage(e?.message)); }
  };
  useEffect(() => {
    const onFocus = () => { getPlanetAlarmStatus().then(setStatus).catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const test = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await testPlanetAlarm();
      setNotice('Test programmé dans 10 secondes. Verrouillez l’écran ; arrêt automatique après 20 secondes de sonnerie.');
      await refresh();
    } catch (e: any) { setError(errorMessage(e?.message)); }
    finally { setBusy(false); }
  };
  const stop = async () => {
    setBusy(true);
    try { await cancelAlarms([PLANET_ALARM_TEST_ID]); setNotice('Test arrêté.'); await refresh(); }
    catch { setError('Impossible d’arrêter le test. Utilisez le bouton Arrêter de sa notification.'); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try {
      const current = await getPlanetAlarmStatus();
      setStatus(current);
      const report = JSON.stringify(current, null, 2);
      try { await navigator.clipboard.writeText(report); setNotice('Diagnostic copié.'); }
      catch { setFallback(report); }
    } catch (e: any) { setError(errorMessage(e?.message)); }
  };
  const issues = alarmDiagnosticIssues(status);
  return <details className="native-alarm-check" onToggle={(event) => { if (event.currentTarget.open) void refresh(); }}>
    <summary>Vérifier le réveil Android</summary>
    <div className="native-alarm-check-content">
      {status && <p>Volume des alarmes : {Math.round(status.volume / Math.max(1, status.maxVolume) * 100)} %</p>}
      {issues.map((issue) => <p key={issue} className="error-text">{issue}</p>)}
      {error && <p role="alert" className="error-text">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="alarm-sheet-actions">
        <button type="button" className="access-btn" disabled={busy || !status} onClick={test}>Tester dans 10 s</button>
        <button type="button" className="alarm-sheet-btn-secondary" disabled={busy || !status} onClick={stop}>Arrêter le test</button>
        <button type="button" className="alarm-sheet-btn-secondary" disabled={!status} onClick={copy}>Copier le diagnostic</button>
      </div>
      {fallback && <textarea aria-label="Diagnostic à copier" value={fallback} readOnly onFocus={(e) => e.currentTarget.select()} />}
    </div>
  </details>;
}
