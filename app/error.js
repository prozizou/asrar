'use client';
// Filet de sécurité global : si un composant plante au rendu, Next affichait
// un écran blanc. Ce fichier spécial (convention app router) intercepte
// l'erreur pour TOUTES les pages et propose de réessayer plutôt que de
// laisser l'utilisateur bloqué.
import { ArrowLeft, Frown } from 'lucide-react';
import { useEffect } from 'react';
import { reportDiagnostic } from '../lib/diagnostics';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
    reportDiagnostic({ kind: 'render', name: error?.name, stack: error?.stack });
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
        </div>
      </div>
    </div>
  );
}
