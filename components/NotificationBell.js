'use client';
// components/NotificationBell.js — Cloche + badge non-lu dans l'app bar
// (app/menu/UserBar.js). Ouvre /notifications (centre complet) au clic —
// pas de panneau déroulant : l'app est mobile-first, un historique avec
// « tout marquer comme lu » mérite un écran dédié plutôt qu'un menu exigu.
//
// Sondage régulier (PAS d'abonnement RTDB direct — cf. l'historique
// /api/social, /api/zikr : ce canal peut rester bloqué en silence sur
// certains réseaux) pour que le badge reste à jour SANS recharger la page
// tant que le tableau de bord est ouvert — même principe que app/zikr/
// page.tsx (LIST_POLL_MS).
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { listNotifications } from '@/lib/notificationsClient';

const POLL_MS = 12000;

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    listNotifications().then((d) => setUnread(d.unread || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);

    // Rafraîchissement IMMÉDIAT quand un push arrive alors que l'app est
    // ouverte : le service worker (public/sw.js) poste un message à chaque
    // notification reçue — on ne dépend pas du prochain tour de sondage.
    let onMessage;
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      onMessage = (e) => { if (e.data && e.data.type === 'asrar-notification') refresh(); };
      navigator.serviceWorker.addEventListener('message', onMessage);
    }

    return () => {
      clearInterval(id);
      if (onMessage) navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, [refresh]);

  const label = unread > 0 ? `Notifications — ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications';

  return (
    <Link href="/notifications" className="menu-appbar-bell" aria-label={label} title={label}>
      <Bell size={20} strokeWidth={2} aria-hidden="true" />
      {unread > 0 && <span className="menu-appbar-bell-badge">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  );
}
