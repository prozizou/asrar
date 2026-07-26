'use client';
// Vue détail d'un secret — port de showDetailView() + la barre d'interactions,
// le partage, le PDF et l'image plein écran. L'état (like, commentaires,
// favori, feuille de commentaires) est géré par React au lieu du DOM.
import { useEffect, useState } from 'react';
import MixedText from '@/components/MixedText';
import CommentSheet from './CommentSheet';
import { useSecretRealtime } from '@/components/useSecretRealtime';
import { useAccess } from '@/components/AccessProvider';
import { share as shareLink, toast } from '@/lib/share';
import { downloadSecretPdf, PDF_MIN_LEVEL } from '@/lib/pdf';

export default function SecretDetail({ secret, onBack }) {
  const { catId, key, data } = secret;
  const { liked, likeCount, comments, toggleLike, postComment } = useSecretRealtime(catId, key);
  const { getLevel, openGate } = useAccess();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const bmKey = `bookmark_${catId}_${key}`;

  useEffect(() => {
    try {
      setBookmarked(!!localStorage.getItem(bmKey));
    } catch {}
    window.scrollTo(0, 0);
  }, [bmKey]);

  const toggleBookmark = () => {
    try {
      if (localStorage.getItem(bmKey)) localStorage.removeItem(bmKey);
      else localStorage.setItem(bmKey, JSON.stringify(data));
      setBookmarked(!!localStorage.getItem(bmKey));
    } catch {}
  };

  const doShare = () => {
    const titre = data.faida || data.title || 'Secret Mystique';
    shareLink({
      kind: 'secret',
      cat: catId,
      key,
      title: titre,
      text: '📜 ' + titre + ' — Secrets Mystiques sur ASRAR PRO',
    });
  };

  const doPdf = async () => {
    if (getLevel() < PDF_MIN_LEVEL) {
      toast("📄 Le téléchargement PDF est réservé à l'abonnement 45 000 FCFA.");
      openGate();
      return;
    }
    try {
      await downloadSecretPdf(data);
    } catch {
      toast('Générateur PDF indisponible (connexion requise).');
    }
  };

  const img = data.img || data.image || null;

  return (
    <div>
      <div className="detail-head">
        <button className="detail-back" onClick={onBack}>
          ← Retour aux secrets
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="detail-expand" onClick={doShare} title="Partager ce secret">
            📤 Partager
          </button>
          <button className="detail-expand" onClick={doPdf} title="Télécharger en PDF">
            📄 PDF
          </button>
        </div>
      </div>

      <div className="detail-card">
        {img && (
          <div className="detail-img-wrap" onClick={() => setFullscreen(true)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={data.faida || ''} />
          </div>
        )}
        <MixedText className="detail-title" text={data.faida || ''} />
        <MixedText className="mix" text={data.sirr || ''} />
      </div>

      <div className="interaction-bar" style={{ display: 'flex' }}>
        <div className="meta">
          <span className={'like-btn' + (liked ? ' liked' : '')} onClick={toggleLike}>
            {liked ? '❤️' : '🤍'} <span>{likeCount}</span>
          </span>
          <span onClick={() => setSheetOpen(true)}>💬 {comments.length}</span>
          <span className={'bookmark-icon' + (bookmarked ? ' saved' : '')} onClick={toggleBookmark}>
            🔖
          </span>
        </div>
      </div>

      <CommentSheet
        open={sheetOpen}
        comments={comments}
        onClose={() => setSheetOpen(false)}
        onPost={postComment}
      />

      {fullscreen && img && (
        <div
          onClick={() => setFullscreen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.95)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
