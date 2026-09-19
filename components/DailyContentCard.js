'use client';
// components/DailyContentCard.js — Carte « verset/hadith/dua du jour »
// (lib/dailyContent.js), affichée en tête de /menu. Donne une raison
// d'ouvrir l'app chaque jour même sans wird programmé (stratégie de
// rétention) ; un interrupteur, comme WirdReminderToggle.js, propose de
// recevoir le même contenu par notification une fois par jour (heure fixe,
// pages/api/cron/reminders.js).
//
// REPLIÉE par défaut (revue design : « bloc relativement imposant pour un
// élément secondaire ») : une ligne résumé (type + aperçu tronqué) ouvre le
// texte complet (arabe, source, interrupteur de notification) au tap — même
// technique CSS grid-template-rows que CategorySection.js (app/menu), pas de
// mesure de hauteur en JS.
//
// Réutilise l'infra push existante SANS position GPS (lib/push.js
// subscribeToPushReminders) et reminder_settings/{uid}.dailyContentEnabled
// (pages/api/reminders.js, mise à jour PARTIELLE — n'affecte jamais le
// réglage de wird fait ailleurs).
import { useEffect, useState } from 'react';
import { Bell, ChevronDown } from 'lucide-react';
import { todayContent, CONTENT_TYPE_LABEL } from '@/lib/dailyContent';
import { pushSupported, getPushSubscriptionState, subscribeToPushReminders } from '@/lib/push';
import { getReminderSettings, setReminderSettings } from '@/lib/remindersClient';

export default function DailyContentCard() {
  // Calculé une fois (lazy initializer), pas à chaque rendu — la date du
  // jour ne change pas pendant la vie du composant. todayContent() utilise
  // .toISOString() (toujours UTC, cf. lib/dailyContent.js), donc le rendu
  // serveur (SSR) et l'hydratation client tombent sur la même clé de date
  // dans l'immense majorité des cas — seule exception, sans conséquence :
  // un rendu exactement à cheval sur minuit UTC.
  const [item] = useState(() => todayContent());
  const [open, setOpen] = useState(false);
  const [pushState, setPushState] = useState('checking'); // checking | unsupported | denied | subscribed | unsubscribed
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pushSupported()) { setPushState('unsupported'); return; }
    getPushSubscriptionState().then(setPushState);
  }, []);

  useEffect(() => {
    getReminderSettings()
      .then((d) => setEnabled(!!d.dailyContentEnabled))
      .catch(() => {}) // pas connecté / erreur réseau : reste désactivé par défaut, jamais bloquant
      .finally(() => setLoaded(true));
  }, []);

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
    try {
      // wirdEnabled/wirdHour/wirdMinute omis : mise à jour PARTIELLE, le
      // réglage de wird (fait depuis /zikr) reste intact — voir pages/api/
      // reminders.js.
      await setReminderSettings({
        dailyContentEnabled: checked,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (e) {
      setError(e.message || 'Échec de l’enregistrement.');
    }
  };

  return (
    <div className="daily-content-card">
      <button type="button" className="daily-content-summary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="daily-content-kind">{CONTENT_TYPE_LABEL[item.type] || 'Contenu du jour'}</span>
        <span className="daily-content-preview">{item.text}</span>
        <ChevronDown size={16} strokeWidth={2.5} className={'daily-content-chevron' + (open ? ' open' : '')} aria-hidden="true" />
      </button>

      <div className={'daily-content-body' + (open ? ' open' : '')}>
        <div className="daily-content-body-inner">
          {item.arabic && <p className="daily-content-arabic" dir="rtl">{item.arabic}</p>}
          <p className="daily-content-text">{item.text}</p>
          <span className="daily-content-source">{item.source}</span>

          {loaded && pushState !== 'unsupported' && (
            <div className="daily-content-notify-row">
              <span>Recevoir chaque matin par notification</span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Recevoir le contenu du jour par notification"
                className={'zk-switch' + (enabled ? ' on' : '')}
                disabled={busy}
                onClick={() => onToggle(!enabled)}
              >
                <span className="zk-switch-knob" />
              </button>
            </div>
          )}

          {enabled && (
            <p className="daily-content-hint">
              <Bell size={12} strokeWidth={2.5} aria-hidden="true" /> Vous recevrez ce contenu par notification chaque matin.
            </p>
          )}
          {pushState === 'denied' && <p className="daily-content-error">Notifications bloquées par le navigateur — autorisez-les dans ses réglages pour ce site.</p>}
          {error && <p className="daily-content-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
