'use client';
// components/WirdReminderToggle.js — Rappel de wird quotidien : anciennement
// une page dédiée (/rappels), maintenant intégré directement au module Zikr
// collectif (app/zikr/page.tsx, en tête de la liste) — les deux rappels
// programmés (wird quotidien ICI, session Zikr collectif à venir réglée par
// le créateur de chaque groupe) vivent désormais au même endroit.
//
// Réutilise l'infra push existante SANS position GPS (lib/push.js
// subscribeToPushReminders, pages/api/push-subscribe.js) et les préférences
// de rappel (lib/remindersClient.js, pages/api/reminders.js) — même moteur
// que l'ancienne page /rappels, juste redéplacé.
import { useEffect, useState } from 'react';
import { pushSupported, getPushSubscriptionState, subscribeToPushReminders } from '@/lib/push';
import { getReminderSettings, setReminderSettings } from '@/lib/remindersClient';

export default function WirdReminderToggle() {
  const [pushState, setPushState] = useState('checking'); // checking | unsupported | denied | subscribed | unsubscribed
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pushSupported()) { setPushState('unsupported'); return; }
    getPushSubscriptionState().then(setPushState);
  }, []);

  useEffect(() => {
    getReminderSettings()
      .then((d) => {
        setEnabled(!!d.wirdEnabled);
        setHour(Number(d.wirdHour) || 0);
        setMinute(Number(d.wirdMinute) || 0);
      })
      .catch(() => {}) // pas connecté / erreur réseau : reste sur les valeurs par défaut, jamais bloquant
      .finally(() => setLoaded(true));
  }, []);

  if (pushState === 'unsupported' || !loaded) return null; // rien à proposer sur cet appareil / pas encore chargé

  const save = async (next) => {
    try {
      await setReminderSettings({
        wirdEnabled: next.enabled,
        wirdHour: next.hour,
        wirdMinute: next.minute,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (e) {
      setError(e.message || 'Échec de l’enregistrement.');
    }
  };

  const onToggle = async (checked) => {
    setError('');
    setEnabled(checked);
    if (checked && pushState !== 'subscribed') {
      setBusy(true);
      try {
        await subscribeToPushReminders();
        setPushState('subscribed');
      } catch (e) {
        setError(e.message || "Impossible d'activer les notifications.");
        setEnabled(false);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    save({ enabled: checked, hour, minute });
  };

  const onTime = (h, m) => {
    setHour(h);
    setMinute(m);
    if (enabled) save({ enabled: true, hour: h, minute: m });
  };

  return (
    <div className="zk-wird-reminder">
      <label className="zk-checkbox-field">
        <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => onToggle(e.target.checked)} />
        <span>
          🔔 Me rappeler mon wird quotidien
          {enabled ? ` à ${String(hour).padStart(2, '0')}h${String(minute).padStart(2, '0')}` : ''}
        </span>
      </label>
      {enabled && (
        <div className="zk-wird-time-row">
          <input
            type="number" min={0} max={23} value={hour} disabled={busy}
            onChange={(e) => onTime(Math.min(23, Math.max(0, Number(e.target.value) || 0)), minute)}
          />
          <span>:</span>
          <input
            type="number" min={0} max={59} value={minute} disabled={busy}
            onChange={(e) => onTime(hour, Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
          />
        </div>
      )}
      {pushState === 'denied' && <p className="zk-wird-error">Notifications bloquées par le navigateur — autorisez-les dans ses réglages pour ce site.</p>}
      {error && <p className="zk-wird-error">{error}</p>}
    </div>
  );
}
