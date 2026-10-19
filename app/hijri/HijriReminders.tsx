'use client';
// Rappels de début de phase (jour hijri 1 et 16) — notifications LOCALES, donc
// disponibles seulement dans l'application Android (lib/hijriRemindersNative.js).
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
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

  const body = (
    <>
      <span className="hijri-reminders-main">
        <strong>Rappels de début de phase</strong>
        <span>
          {!supported
            ? 'Les rappels sont disponibles dans l’application Android.'
            : msg || (enabled
              ? 'Activés : notification à 7 h le 1er et le 16 du mois hijri.'
              : 'Notification à 7 h le 1er (attraction) et le 16 (repoussement).')}
        </span>
      </span>
      {supported && <ChevronRight size={22} aria-hidden="true" />}
    </>
  );

  return supported ? (
    <button type="button" className="hijri-card hijri-reminders" onClick={toggle} disabled={busy} aria-pressed={enabled}>
      {body}
    </button>
  ) : (
    <section className="hijri-card hijri-reminders">{body}</section>
  );
}
