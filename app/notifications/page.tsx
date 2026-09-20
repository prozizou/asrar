'use client';
// Centre de notifications — historique complet, lu/non-lu, « tout marquer
// comme lu », ouverture directe du contenu concerné. Sondage régulier tant
// que la page est ouverte (même principe que components/NotificationBell.js
// et app/zikr/page.tsx) : pas d'abonnement RTDB direct (réseaux qui le
// bloquent), donc pas de vrai push serveur→client hors notification
// navigateur — mais la liste reste à jour SANS recharger la page.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Scroll, BookOpen, MessageCircle, Check } from 'lucide-react';
import SpinnerUntyped from '@/components/Spinner';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notificationsClient';
import { pushSupported, getPushSubscriptionState, subscribeToPushReminders } from '@/lib/push';
import { NOTIF_TYPES } from '@/lib/notifyTemplates';

const Spinner = SpinnerUntyped as any;
const POLL_MS = 12000;

const ICON_BY_TYPE = {
  [NOTIF_TYPES.SECRET]: Scroll,
  [NOTIF_TYPES.DOCUMENT]: BookOpen,
  [NOTIF_TYPES.ZIKR_MESSAGE]: MessageCircle,
};

// Horodatage compact : heure si aujourd'hui, jour+mois sinon (+ année si une
// autre année) — jamais la date ET l'heure complètes, qui alourdiraient
// chaque ligne pour une info secondaire.
function formatWhen(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('fr-FR', opts);
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[] | null>(null); // null = chargement
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [pushState, setPushState] = useState('checking');
  const [marking, setMarking] = useState(false);

  const load = useCallback(() => {
    listNotifications()
      .then((d) => { setItems(d.items || []); setUnread(d.unread || 0); setError(''); })
      .catch((e) => setError(e.message || 'Erreur de chargement.'));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!pushSupported()) { setPushState('unsupported'); return; }
    getPushSubscriptionState().then(setPushState);
  }, []);

  const enablePush = async () => {
    try {
      await subscribeToPushReminders();
      setPushState('subscribed');
    } catch {
      setPushState('denied');
    }
  };

  const openItem = async (n: any) => {
    if (!n.read) {
      setItems((cur) => (cur || []).map((it) => (it.id === n.id ? { ...it, read: true } : it)));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    router.push(n.targetUrl);
  };

  const markAll = async () => {
    if (marking || unread === 0) return;
    setMarking(true);
    setItems((cur) => (cur || []).map((it) => ({ ...it, read: true })));
    setUnread(0);
    try { await markAllNotificationsRead(); } catch {} finally { setMarking(false); }
  };

  return (
    <div className="container">
      <Link href="/menu" className="back-btn">← Retour</Link>

      <div className="notif-header">
        <h1>Notifications</h1>
        {unread > 0 && (
          <button type="button" className="notif-markall" onClick={markAll} disabled={marking}>
            <Check size={14} strokeWidth={2.5} aria-hidden="true" /> Tout marquer comme lu
          </button>
        )}
      </div>

      {pushState === 'unsubscribed' && (
        <button type="button" className="notif-push-banner" onClick={enablePush}>
          <Bell size={16} strokeWidth={2.5} aria-hidden="true" />
          Activer les notifications push pour être averti même hors de l'application
        </button>
      )}
      {pushState === 'denied' && (
        <p className="notif-push-hint">Notifications push bloquées par le navigateur — autorisez-les dans ses réglages pour ce site.</p>
      )}

      {items === null ? (
        <div className="zk-loading"><Spinner /> Chargement…</div>
      ) : error ? (
        <p className="zk-error">{error} <button className="zk-link" onClick={load}>Réessayer</button></p>
      ) : items.length === 0 ? (
        <p className="notif-empty">Aucune notification pour l'instant.</p>
      ) : (
        <ul className="notif-list">
          {items.map((n) => {
            const Icon = ICON_BY_TYPE[n.type] || Bell;
            return (
              <li key={n.id}>
                <button type="button" className={'notif-item' + (n.read ? '' : ' unread')} onClick={() => openItem(n)}>
                  <span className="notif-item-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.75} /></span>
                  <span className="notif-item-body">
                    <span className="notif-item-title">{n.title}</span>
                    {n.body && <span className="notif-item-preview">{n.body}</span>}
                    <span className="notif-item-meta">
                      {n.senderName && <span className="notif-item-sender">{n.senderName}</span>}
                      <span className="notif-item-when">{formatWhen(n.createdAt)}</span>
                    </span>
                  </span>
                  {!n.read && <span className="notif-item-dot" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
