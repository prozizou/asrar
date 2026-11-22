'use client';
// components/BugReporter.js — Détection automatique des bugs et lenteurs
// rencontrés par les utilisateurs, envoyés à l'administration (lib/bugReporter.js).
//
//  • erreurs JavaScript non rattrapées (window « error ») et promesses rejetées
//    sans gestionnaire (« unhandledrejection ») — dont les échecs de chargement
//    d'un morceau de l'app après un déploiement ;
//  • interface figée : une tâche qui bloque l'écran plus de FREEZE_MS
//    (PerformanceObserver « longtask », Chrome / WebView Android) ;
//  • page longue à charger : chargement initial au-delà de SLOW_LOAD_MS.
// Les plantages d'écran React passent par app/error.js, les requêtes lentes
// ou en erreur serveur par lib/api.js.
import { useEffect } from 'react';
import { flushBugReports, reportBug, reportLag } from '@/lib/bugReporter';

const FREEZE_MS = 2000;
const SLOW_LOAD_MS = 10000;

export default function BugReporter() {
  useEffect(() => {
    const onError = (event) => {
      // Erreur de chargement d'une ressource (image, script) : pas un bug de code.
      if (!event.error && !event.message) return;
      reportBug({ kind: 'error', message: event.message || String(event.error), stack: event.error?.stack });
    };
    const onRejection = (event) => {
      const reason = event.reason;
      const message = (reason && reason.message) || (typeof reason === 'string' ? reason : '');
      if (!message) return;
      reportBug({ kind: 'error', message: 'Promesse rejetée : ' + message, stack: reason?.stack });
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flushBugReports(); };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    document.addEventListener('visibilitychange', onHide);

    const observers = [];
    const observe = (type, callback) => {
      try {
        if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
        const observer = new PerformanceObserver((list) => list.getEntries().forEach(callback));
        observer.observe({ type, buffered: true });
        observers.push(observer);
      } catch { /* API absente : rien à mesurer */ }
    };
    if (typeof PerformanceObserver !== 'undefined') {
      observe('longtask', (entry) => {
        if (entry.duration >= FREEZE_MS) reportLag('Interface figée', entry.duration, 'Interface figée ' + (entry.duration / 1000).toFixed(1) + ' s');
      });
      observe('navigation', (entry) => {
        const total = entry.loadEventEnd || entry.domContentLoadedEventEnd || 0;
        if (total >= SLOW_LOAD_MS) reportLag('Chargement lent', total, 'Page chargée en ' + (total / 1000).toFixed(1) + ' s');
      });
    }

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      document.removeEventListener('visibilitychange', onHide);
      observers.forEach((o) => o.disconnect());
    };
  }, []);
  return null;
}
