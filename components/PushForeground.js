'use client';
// Écoute globale des notifications push reçues pendant que l'app est au
// premier plan (onglet actif) : onMessage() n'affiche rien nativement dans ce
// cas (contrairement à l'onglet en arrière-plan, géré par le service worker),
// donc on l'affiche nous-mêmes via l'API Notification. Monté une seule fois
// pour toute l'app (voir Providers.js), pas de rendu visuel.
import { useEffect } from 'react';
import { listenForegroundMessages } from '@/lib/push';

export default function PushForeground() {
  useEffect(() => {
    const unsub = listenForegroundMessages((payload) => {
      const n = payload?.notification || {};
      const data = payload?.data || {};
      const title = n.title || data.title || 'ASRAR PRO';
      const body = n.body || data.body || '';
      const url = data.url || '/';
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      try {
        const notif = new Notification(title, { body, icon: '/assets/icon-192.png' });
        notif.onclick = () => {
          window.focus();
          window.location.href = url;
        };
      } catch {}
    });
    return unsub;
  }, []);

  return null;
}
