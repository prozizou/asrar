'use client';
// Vue détail d'un secret — port de showDetailView() + la barre d'interactions,
// le partage, le PDF et l'image plein écran. L'état (like, commentaires,
// favori, feuille de commentaires) est géré par React au lieu du DOM.
import { useEffect, useState } from 'react';
import { ArrowLeft, Share2, FileText, Heart, MessageCircle, Bookmark } from 'lucide-react';
import MixedText from '@/components/MixedText';
import CommentSheet from './CommentSheet';
import { useSecretRealtime } from '@/components/useSecretRealtime';
import { useAccess } from '@/components/AccessProvider';
import { share as shareLink, toast } from '@/lib/share';
import { optimImg } from '@/lib/img';
import { sentenceCaseIfShouting } from '@/lib/text';
import SmartImage from '@/components/SmartImage';
import { downloadSecretPdf, PDF_MIN_LEVEL } from '@/lib/pdf';

export default function SecretDetail({ secret, catLabel, onBack }) {
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
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> Retour aux secrets
        </button>
        {/* Hiérarchie entre les deux actions (revue design) : Partager reste
            l'action principale (bouton plein) ; PDF devient secondaire
            (contour discret) — les deux boutons pleins de même poids
            attiraient autant l'attention l'un que l'autre. */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="detail-expand primary" onClick={doShare} title="Partager ce secret">
            <Share2 size={14} strokeWidth={2} aria-hidden="true" /> Partager
          </button>
          <button className="detail-expand" onClick={doPdf} title="Télécharger en PDF">
            <FileText size={14} strokeWidth={2} aria-hidden="true" /> PDF
          </button>
        </div>
      </div>

      <div className="detail-card">
        {img && (
          <div className="detail-img-wrap" onClick={() => setFullscreen(true)}>
            <SmartImage
              src={optimImg(img, 800)}
              alt={data.faida || ''}
              fill
              sizes="(max-width: 640px) 100vw, 700px"
              style={{ objectFit: 'contain' }}
            />
          </div>
        )}
        {/* Repère de catégorie au-dessus du titre (revue design) — la même
            puce que sur les cartes de la liste (.secret-cat-chip), pour
            situer la fiche avant même de lire son titre. */}
        {catLabel && <span className="secret-cat-chip">{catLabel}</span>}
        <MixedText className="detail-title" text={sentenceCaseIfShouting(data.faida || '')} />

        <div className="detail-divider" />

        {/* detectLists : reconnaît une numérotation déjà présente dans le
            texte source (« 1. …», « 2. … ») et la rend en étapes numérotées
            plutôt qu'en un unique bloc de prose — voir MixedText.js. */}
        <MixedText className="mix" text={data.sirr || ''} detectLists />
      </div>

      <div className="interaction-bar" style={{ display: 'flex' }}>
        <div className="meta">
          {/* Icône toujours visible (affordance de l'action) ; le compteur
              n'est affiché que s'il est non nul — deux "0" ne veulent rien
              dire tant que personne n'a interagi (revue design). */}
          <span className={'like-btn' + (liked ? ' liked' : '')} onClick={toggleLike}>
            <Heart size={18} strokeWidth={2} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
            {likeCount > 0 && <span>{likeCount}</span>}
          </span>
          <span onClick={() => setSheetOpen(true)}>
            <MessageCircle size={18} strokeWidth={2} aria-hidden="true" />
            {comments.length > 0 && <span>{comments.length}</span>}
          </span>
          <span className={'bookmark-icon' + (bookmarked ? ' saved' : '')} onClick={toggleBookmark}>
            <Bookmark size={18} strokeWidth={2} fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
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
          {/* Visionneuse plein écran : taille naturelle bornée par le viewport (pas de
              conteneur dimensionné) — cas non couvert par next/image (fill), et ouverte
              à la demande (pas de liste à optimiser). Volontairement laissée en <img>. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={optimImg(img)} alt="" decoding="async" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
