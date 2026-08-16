'use client';
// Dialogue « dernier commit » — remplace l'ancien lien qui redirigeait vers
// la page des commits GitHub (retour utilisateur : pas une redirection, un
// dialogue en app). Données via /api/latest-commit (serveur, dépôt privé).
import { useEffect, useState } from 'react';
import { apiPost } from '@/lib/api';
import Spinner from './Spinner';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LatestCommitModal({ onClose }) {
  const [commit, setCommit] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiPost('latest-commit')
      .then((d) => alive && setCommit(d))
      .catch((e) => alive && setError(e.message || 'Erreur de chargement.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="commit-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="commit-modal-box" role="dialog" aria-modal="true" aria-label="Dernier commit">
        <button type="button" className="commit-modal-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
        <h3>📝 Dernier commit</h3>

        {loading ? (
          <div className="commit-modal-loading">
            <Spinner size={18} /> Chargement…
          </div>
        ) : error ? (
          <p className="commit-modal-error">{error}</p>
        ) : (
          <div className="commit-modal-body">
            <p className="commit-modal-title">{commit.title}</p>
            {commit.body && <p className="commit-modal-desc">{commit.body}</p>}
            <div className="commit-modal-meta">
              {commit.author && <span>{commit.author}</span>}
              {commit.author && commit.date && <span>·</span>}
              {commit.date && <span>{fmtDate(commit.date)}</span>}
            </div>
            {commit.shortSha && <code className="commit-modal-sha">{commit.shortSha}</code>}
          </div>
        )}
      </div>
    </div>
  );
}
