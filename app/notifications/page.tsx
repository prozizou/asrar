'use client';
// Centre de notifications — historique complet, lu/non-lu, « tout marquer
// comme lu », ouverture directe du contenu concerné. Sondage régulier tant
// que la page est ouverte (même principe que components/NotificationBell.js
// et app/zikr/page.tsx) : pas d'abonnement RTDB direct (réseaux qui le
// bloquent), donc pas de vrai push serveur→client hors notification
// navigateur — mais la liste reste à jour SANS recharger la page.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Scroll, BookOpen, MessageCircle, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ViewState from '@/components/ViewState';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notificationsClient';
import { pushSupported, getPushSubscriptionState, subscribeToPushReminders } from '@/lib/push';
import { NOTIF_TYPES } from '@/lib/notifyTemplates';
import { startVisiblePolling } from '@/lib/visiblePolling';

const POLL_MS = 30000;
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
  if (!Number.isFinite(d.getTime())) return "Date indisponible";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('fr-FR', opts);
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[] | null>(null), [unread, setUnread] = useState(0);
  const [error, setError] = useState(''), [actionError, setActionError] = useState(''), [message, setMessage] = useState('');
  const [pushState, setPushState] = useState('checking'), [pushBusy, setPushBusy] = useState(false);
  const [marking, setMarking] = useState(false), [filter, setFilter] = useState<'all' | 'unread'>('all');
  const load = useCallback(async () => {
    try { const data = await listNotifications(); setItems(data.items || []); setUnread(data.unread || 0); setError(''); }
    catch (e: any) { setError(e.message || 'Impossible de charger vos notifications.'); }
  }, []);
  useEffect(() => startVisiblePolling(load, POLL_MS, { push: true }), [load]);
  useEffect(() => {
    if (!pushSupported()) { setPushState('unsupported'); return; }
    getPushSubscriptionState().then(setPushState);
  }, []);
  const enablePush = async () => {
    if (pushBusy) return;
    setPushBusy(true); setActionError('');
    try { await subscribeToPushReminders(); setPushState('subscribed'); }
    catch (e: any) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') setPushState('denied');
      else setActionError(e.message || 'Les notifications n’ont pas pu être activées. Réessayez.');
    } finally { setPushBusy(false); }
  };
  const openItem = (notification: any) => {
    if (!notification.read) {
      setItems((current) => (current || []).map((item) => item.id === notification.id ? { ...item, read: true } : item));
      setUnread((count) => Math.max(0, count - 1));
      markNotificationRead(notification.id).catch(() => {});
    }
    router.push(notification.targetUrl);
  };
  const markAll = async () => {
    if (marking || unread === 0) return;
    setMarking(true); setActionError(''); setMessage('');
    try {
      await markAllNotificationsRead();
      await load();
      setMessage('Vos notifications ont été marquées comme lues.');
    } catch (e: any) { setActionError(e.message || 'Le marquage n’a pas été enregistré. Réessayez.'); }
    finally { setMarking(false); }
  };
  const visibleItems = filter === 'unread' ? (items || []).filter((item) => !item.read) : items || [];
  return <main className="container page-shell notifications-page">
    <PageHeader eyebrow="Votre activité" title="Notifications" description="Retrouvez les nouvelles publications, les messages et le suivi de vos groupes."
      actions={unread > 0 && <button type="button" className="view-button view-button-secondary" onClick={markAll} disabled={marking}><Check size={18} aria-hidden="true" />{marking ? 'Marquage en cours…' : 'Tout marquer comme lu'}</button>} />
    {pushState === 'unsubscribed' && <button type="button" className="notif-push-banner" disabled={pushBusy} onClick={enablePush}><Bell size={18} aria-hidden="true" />{pushBusy ? 'Activation en cours…' : 'Activer les notifications sur cet appareil'}</button>}
    {pushState === 'denied' && <p className="notif-push-hint">Pour recevoir les notifications sur cet appareil, autorisez-les dans les réglages de votre navigateur.</p>}
    {actionError && <ViewState kind="error" compact title="Action non confirmée" description={actionError} />}
    {message && <p role="status" className="view-feedback view-feedback-success">{message}</p>}
    {error && <ViewState kind="error" title="Notifications indisponibles" description={error} compact={items !== null}
      action={<button type="button" className="view-button" onClick={() => void load()}>Réessayer</button>} />}
    {items === null && !error && <ViewState kind="loading" title="Chargement de vos notifications" description="Votre activité sera affichée dans un instant." />}
    {items !== null && <>
      <div className="notif-toolbar"><div className="notif-filters" role="group" aria-label="Filtrer les notifications">
        <button type="button" className="notif-filter" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Toutes <span className="notif-count">{items.length}</span></button>
        <button type="button" className="notif-filter" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>Non lues <span className="notif-count">{unread}</span></button>
      </div><p className="notif-summary" aria-live="polite">{unread === 0 ? 'Vous êtes à jour' : `${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}`}</p></div>
      {visibleItems.length === 0 ? <ViewState title={filter === 'unread' ? 'Vous êtes à jour' : 'Votre activité commence ici'} description={filter === 'unread' ? 'Vous avez consulté toutes vos notifications. Retrouvez votre historique dans « Toutes ».' : 'Vos prochaines notifications apparaîtront ici : publications, messages et rappels de vos groupes.'} />
        : <ul className="notif-list">{visibleItems.map((notification) => {
          const Icon = ICON_BY_TYPE[notification.type] || Bell;
          return <li key={notification.id}><button type="button" className={'notif-item' + (notification.read ? '' : ' unread')} onClick={() => openItem(notification)}>
            <span className="notif-item-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.75} /></span><span className="notif-item-body">
              <span className="notif-item-title">{notification.title}</span>{notification.body && <span className="notif-item-preview">{notification.body}</span>}
              <span className="notif-item-meta">{notification.senderName && <span className="notif-item-sender">{notification.senderName}</span>}<span className="notif-item-when">{formatWhen(notification.createdAt)}</span></span>
            </span>{!notification.read && <><span className="notif-item-dot" aria-hidden="true" /><span className="sr-only">Non lue</span></>}
          </button></li>;
        })}</ul>}
    </>}
  </main>;
}
