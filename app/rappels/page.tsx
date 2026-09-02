'use client';
// Module « Rappels programmés » — deux rappels distincts, tous deux livrés
// par l'infra push existante (lib/push.js, VAPID) sans exiger de position
// GPS (celle-ci ne sert qu'à l'heure planétaire, cf. pages/api/push-
// subscribe.js) :
//
//   1. Wird quotidien — réglé ICI (heure locale + activation), envoyé par
//      pages/api/cron/reminders.js (lib/reminders.js shouldSendWird).
//   2. Session Zikr collectif à venir — réglée par le CRÉATEUR de chaque
//      zikr collectif (app/zikr/page.tsx, champ « Prochaine session »),
//      automatique pour tout membre approuvé déjà abonné aux notifications
//      — rien à régler ici, juste rappelé pour que ce ne soit pas une
//      fonctionnalité invisible.
import './rappels.css';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/useToast';
import SpinnerUntyped from '@/components/Spinner';
import { pushSupported, getPushSubscriptionState, subscribeToPushReminders, unsubscribeFromPush } from '@/lib/push';
import { getReminderSettings, setReminderSettings } from '@/lib/remindersClient';

const Spinner = SpinnerUntyped as any;

export default function RappelsPage() {
  const { user } = useAuth() as any;
  const { notify, toast } = useToast();

  const [pushState, setPushState] = useState<'checking' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'>('checking');
  const [pushBusy, setPushBusy] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [wirdEnabled, setWirdEnabled] = useState(false);
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pushSupported()) { setPushState('unsupported'); return; }
    getPushSubscriptionState().then(setPushState);
  }, []);

  useEffect(() => {
    if (!user) return;
    getReminderSettings()
      .then((d: any) => {
        setWirdEnabled(!!d.wirdEnabled);
        setHour(Number(d.wirdHour) || 0);
        setMinute(Number(d.wirdMinute) || 0);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user]);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushState === 'subscribed') {
        await unsubscribeFromPush();
        setPushState('unsubscribed');
      } else {
        await subscribeToPushReminders();
        setPushState('subscribed');
      }
    } catch (e: any) {
      notify('❌ ' + (e.message || e));
      setPushState(await getPushSubscriptionState());
    } finally {
      setPushBusy(false);
    }
  };

  const save = async (next: { wirdEnabled: boolean; hour: number; minute: number }) => {
    setSaving(true);
    try {
      await setReminderSettings({
        wirdEnabled: next.wirdEnabled,
        wirdHour: next.hour,
        wirdMinute: next.minute,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (e: any) {
      notify('❌ ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const onToggleWird = (checked: boolean) => {
    setWirdEnabled(checked);
    save({ wirdEnabled: checked, hour, minute });
    if (checked && pushState !== 'subscribed') {
      notify('🔔 Activez aussi les notifications ci-dessus pour recevoir ce rappel.');
    }
  };

  const commitTime = (h: number, m: number) => {
    setHour(h);
    setMinute(m);
    if (wirdEnabled) save({ wirdEnabled: true, hour: h, minute: m });
  };

  if (!user) {
    return (
      <div className="container">
        <Link href="/menu" className="back-btn">← Retour</Link>
        <div className="glass-panel"><p>Connectez-vous pour régler vos rappels.</p></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <Link href="/menu" className="back-btn">← Retour</Link>
      <div className="glass-panel">
        <div className="header">
          <h1>🔔 Rappels programmés</h1>
          <p style={{ color: 'var(--text-muted)' }}>Wird quotidien et sessions Zikr collectif à venir.</p>
        </div>

        {pushState !== 'unsupported' && (
          <div className="rm-toggle-row">
            <button className="access-btn" onClick={togglePush} disabled={pushBusy || pushState === 'denied' || pushState === 'checking'}>
              {pushState === 'subscribed' ? '🔕 Désactiver les notifications' : '🔔 Activer les notifications'}
            </button>
          </div>
        )}
        {pushState === 'denied' && (
          <p className="error-text">Notifications bloquées par le navigateur — autorisez-les dans ses réglages pour ce site.</p>
        )}
        {pushState === 'unsupported' && (
          <p className="rm-note">Notifications non prises en charge sur cet appareil — les rappels restent visibles dans l’app, mais sans alerte push.</p>
        )}

        {!loaded ? (
          <div className="rm-loading"><Spinner /></div>
        ) : (
          <>
            <label className="rm-toggle-row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={wirdEnabled} disabled={saving} onChange={(e) => onToggleWird(e.target.checked)} />
              <span>Me rappeler mon wird quotidien</span>
            </label>

            {wirdEnabled && (
              <label className="rm-field">
                <span>Heure du rappel (heure locale)</span>
                <div className="rm-time-row">
                  <input type="number" min={0} max={23} value={hour} disabled={saving}
                    onChange={(e) => commitTime(Math.min(23, Math.max(0, Number(e.target.value) || 0)), minute)} />
                  <span className="rm-time-sep">:</span>
                  <input type="number" min={0} max={59} value={minute} disabled={saving}
                    onChange={(e) => commitTime(hour, Math.min(59, Math.max(0, Number(e.target.value) || 0)))} />
                </div>
              </label>
            )}
            <p className="rm-note">
              Un seul rappel par jour, à l’heure choisie (fuseau détecté automatiquement).
            </p>
          </>
        )}

        <div className="rm-session-card">
          <h3>🤲 Sessions Zikr collectif</h3>
          <p className="rm-note" style={{ margin: 0 }}>
            Le créateur d’un zikr collectif peut fixer l’horaire de sa prochaine
            session (page du zikr, « Modifier ») — tous les membres approuvés
            ayant activé les notifications ci-dessus en sont alors prévenus
            automatiquement, sans réglage supplémentaire ici.
          </p>
        </div>
      </div>
      {toast}
    </div>
  );
}
