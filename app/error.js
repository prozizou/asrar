'use client';
// Filet de sécurité global : si un composant plante au rendu, Next affichait
// un écran blanc. Ce fichier spécial (convention app router) intercepte
// l'erreur pour TOUTES les pages et propose de réessayer plutôt que de
// laisser l'utilisateur bloqué.
import { ArrowLeft, Bug, Frown } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReportProblem from '@/components/ReportProblem';
import { flushBugReports, reportBug } from '@/lib/bugReporter';

export default function GlobalError({ error, reset }) {
  const [reporting, setReporting] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
    // Remontée vers l'administration (onglet « Bugs ») et le suivi d'erreurs
    // serveur (server/log.js) — pas d'idToken requis (lib/bugReporter.js).
    reportBug({ kind: 'error', message: 'Écran planté : ' + (error?.message || String(error)), stack: error?.stack, label: 'react' });
    flushBugReports();
  }, [error]);

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <div className="header">
          <h1><Frown size={28} className="title-icon" aria-hidden="true" /> Oups</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Une erreur inattendue est survenue. Vous pouvez réessayer, ou revenir à l'accueil.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => reset()}>
            Réessayer
          </button>
          {/* Rechargement complet nécessaire pour sortir d'un arbre React en erreur. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="back-btn">
            <ArrowLeft size={18} aria-hidden="true" /> Accueil
          </a>
          <button type="button" className="back-btn" onClick={() => setReporting(true)}>
            <Bug size={18} aria-hidden="true" /> Signaler ce problème
          </button>
        </div>
      </div>
      {reporting && <ReportProblem onClose={() => setReporting(false)} />}
    </div>
  );
}
