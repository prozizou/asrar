'use client';
// Fenêtre affichée après chaque action d'un visiteur avec publicités, pendant
// AD_WAIT_MS à compter de l'ouverture de la pub au clic (lib/actionAd.ts) :
//  - une bannière Adsterra 300x250 DANS notre page — elle ne peut pas être
//    fermée avant la fin, contrairement à l'onglet de pub ;
//  - « Votre résultat arrive dans N s », puis le bouton « Continuer ».
// Le temps passé sur l'onglet de pub compte : celui qui y reste 5 s retrouve
// directement « Continuer ». Pas de fermeture possible avant la fin (ni ✕, ni
// Échap — Modal n'appelle onClose que s'il est fourni).
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { BANNERS, Banner } from './AdsterraBanner';
import { AD_WAIT_MS, sampleAdTab } from '@/lib/actionAd';

export { AD_WAIT_MS };

export default function AdCountdown({ start, onDone, onRemoveAds }) {
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((start + AD_WAIT_MS - now) / 1000));

  useEffect(() => {
    if (left === 0) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [left]);

  // Mesure (lib/actionAd.ts) : relève la fermeture de l'onglet de pub tant que
  // la fenêtre est affichée, y compris après la fin du décompte.
  useEffect(() => {
    const id = setInterval(sampleAdTab, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <Modal className="sg-overlay" label="Publicité" onClose={left === 0 ? onDone : undefined}>
      <div className="sg-box">
        <p className="sg-sub" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Publicité</p>
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: BANNERS.b300x250.height }}>
          <Banner banner={BANNERS.b300x250} />
        </div>
        {left > 0 ? (
          <p className="sg-sub" role="status" aria-live="polite" style={{ marginTop: 12 }}>
            ⏳ Votre résultat arrive dans {left} s
          </p>
        ) : (
          <button type="button" className="sg-card best" style={{ width: '100%', marginTop: 12 }} onClick={onDone} autoFocus>
            Continuer
          </button>
        )}
        <button
          type="button"
          onClick={onRemoveAds}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, marginTop: 8, cursor: 'pointer', textDecoration: 'underline' }}
        >
          🚫 Retirer les publicités
        </button>
      </div>
    </Modal>
  );
}
