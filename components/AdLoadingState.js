'use client';
// Attente d'une vidéo récompensée, dans le style de l'application (remplace la fenêtre
// Android « Continuer avec une publicité / Chargement… » depuis l'APK 8.3.3).
//   phase « loading »    : la vidéo s'ouvre (souvent instantané grâce au préchargement) — « Annuler ».
//   phase « validating » : la vidéo est terminée, le serveur confirme le point.
import { useEffect, useState } from 'react';

const SLOW_AFTER_MS = 8000;

export default function AdLoadingState({ phase = 'loading', onCancel = undefined }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (phase !== 'loading') return undefined;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const validating = phase === 'validating';
  return (
    <div className="ad-loading" role="status" aria-live="polite">
      <span className="ad-loading-ring" aria-hidden="true" />
      <p className="ad-loading-title">{validating ? 'Validation de votre point…' : 'Préparation de votre vidéo…'}</p>
      <p className="ad-loading-sub">
        {validating
          ? 'Confirmation sécurisée en cours.'
          : slow
            ? 'La connexion semble lente. Vous pouvez patienter ou annuler.'
            : 'Elle s’ouvre dans un instant.'}
      </p>
      {!validating && onCancel && (
        <button type="button" className="ad-loading-cancel" onClick={onCancel}>Annuler</button>
      )}
    </div>
  );
}
