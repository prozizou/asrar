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
//
// Revue design (module Zikr collectif, point 2) : la case à cocher affichait
// « 🔔 Me rappeler mon wird quotidien à 03h46 » avec l'heure DÉJÀ dans le
// libellé, puis deux champs 3 / 46 juste en-dessous répétaient cette même
// heure — confus (« l'heure est affichée deux fois »). Reconstruit en une
// seule ligne compacte (icône + « Rappel quotidien » + heure en badge) qui
// déplie l'éditeur d'heure au clic, séparée d'un vrai interrupteur
// activer/désactiver (plus de case à cocher qui mélange les deux rôles).
import { useEffect, useState } from 'react';
import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { pushSupported, getPushSubscriptionState, subscribeToPushReminders } from '@/lib/push';
import { getReminderSettings, setReminderSettings } from '@/lib/remindersClient';

const pad2 = (n) => String(n).padStart(2, '0');

export default function WirdReminderToggle() {
  const [pushState, setPushState] = useState('checking'); // checking | unsupported | denied | subscribed | unsubscribed
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(0);
  const [timeOpen, setTimeOpen] = useState(false);
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
      <div className="zk-wird-row">
        <button
          type="button"
          className="zk-wird-toggle"
          onClick={() => setTimeOpen((v) => !v)}
          aria-expanded={timeOpen}
        >
          <Bell size={16} strokeWidth={2.5} aria-hidden="true" />
          <span className="zk-wird-label">Rappel quotidien</span>
          <span className="zk-wird-time-badge">{pad2(hour)}:{pad2(minute)}</span>
          {timeOpen
            ? <ChevronUp size={15} strokeWidth={2.5} aria-hidden="true" />
            : <ChevronDown size={15} strokeWidth={2.5} aria-hidden="true" />}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Activer le rappel quotidien"
          className={'zk-switch' + (enabled ? ' on' : '')}
          disabled={busy}
          onClick={() => onToggle(!enabled)}
        >
          <span className="zk-switch-knob" />
        </button>
      </div>

      {timeOpen && (
        <div className="zk-wird-time-row">
          <input
            type="number" min={0} max={23} value={hour} disabled={busy}
            aria-label="Heure"
            onChange={(e) => onTime(Math.min(23, Math.max(0, Number(e.target.value) || 0)), minute)}
          />
          <span>:</span>
          <input
            type="number" min={0} max={59} value={minute} disabled={busy}
            aria-label="Minute"
            onChange={(e) => onTime(hour, Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
          />
        </div>
      )}
      {pushState === 'denied' && <p className="zk-wird-error">Notifications bloquées par le navigateur — autorisez-les dans ses réglages pour ce site.</p>}
      {error && <p className="zk-wird-error">{error}</p>}
    </div>
  );
}
