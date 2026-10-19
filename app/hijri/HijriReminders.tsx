'use client';
// Rappels de début de phase (jour hijri 1 et 16) — notifications LOCALES, donc
// disponibles seulement dans l'application Android (lib/hijriRemindersNative.js).
import { useEffect, useState } from 'react';
import {
  hijriRemindersSupported, readReminderState, enableHijriReminders, disableHijriReminders,
} from '@/lib/hijriRemindersNative';

const ERRORS: Record<string, string> = {
  permission: 'Autorisation de notification refusée.',
  unsupported: 'Rappels indisponibles sur cet appareil.',
};

export default function HijriReminders() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await hijriRemindersSupported();
      if (!alive) return;
      setSupported(ok);
      if (ok && readReminderState().enabled) {
        setEnabled(true);
        enableHijriReminders(); // prolonge l'horizon à chaque visite
      }
    })();
    return () => { alive = false; };
  }, []);

  async function toggle() {
    setBusy(true);
    setMsg('');
    if (enabled) {
      await disableHijriReminders();
      setEnabled(false);
    } else {
      const r = await enableHijriReminders();
      if (r.ok) {
        setEnabled(true);
        setMsg(`${r.count} rappel${r.count > 1 ? 's' : ''} programmé${r.count > 1 ? 's' : ''}.`);
      } else {
        setMsg(ERRORS[r.error] || 'Impossible de programmer les rappels.');
      }
    }
    setBusy(false);
  }

  if (supported === null) return null;

  return (
    <section className="hijri-reminders">
      <h2 className="hijri-reminders-title">Rappels de début de phase</h2>
      {supported ? (
        <>
          <p className="hijri-reminders-text">Une notification à 7 h le 1er (attraction) et le 16 (repoussement) du mois hijri.</p>
          <button type="button" className="hijri-retry" onClick={toggle} disabled={busy} aria-pressed={enabled}>
            {enabled ? 'Désactiver les rappels' : 'Activer les rappels'}
          </button>
          {msg && <p className="hijri-reminders-text" role="status">{msg}</p>}
        </>
      ) : (
        <p className="hijri-reminders-text">Les rappels sont disponibles dans l’application Android.</p>
      )}
    </section>
  );
}
