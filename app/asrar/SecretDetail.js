'use client';
// Vue détail d'un secret — port de showDetailView() + la barre d'interactions,
// le partage, le PDF et l'image plein écran. L'état (like, commentaires,
// favori, feuille de commentaires) est géré par React au lieu du DOM.
import { useEffect, useRef, useState } from 'react';
import { Share2, FileText, Heart, MessageCircle, Bookmark, ZoomIn, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { secretImages, secretParagraphs, secretInlineParts } from '@/lib/secretPresentation';
import CommentSheet from './CommentSheet';
import { useSecretRealtime } from '@/components/useSecretRealtime';
import { useAccess } from '@/components/AccessProvider';
import { share as shareLink, toast } from '@/lib/share';
import { optimImg } from '@/lib/img';
import { sentenceCaseIfShouting } from '@/lib/text';
import SmartImage from '@/components/SmartImage';
import { downloadSecretPdf, PDF_MIN_LEVEL } from '@/lib/pdf';

export default function SecretDetail({ secret, catLabel }) {
  const { catId, key, data } = secret;
  const { liked, likeCount, comments, toggleLike, postComment } = useSecretRealtime(catId, key);
  const { getLevel, openGate } = useAccess();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [pdfBusy, setPdfBusy] = useState(false);
  const dialogRef = useRef(null);
  const images = secretImages(data);
  const title = sentenceCaseIfShouting(data.faida || data.title || 'Secret mystique');
  const paragraphs = secretParagraphs(data.sirr || data.content || '');
  const img = images[imageIndex];
  const changeImage = (delta) => setImageIndex((i) => (i + delta + images.length) % images.length);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!fullscreen || !dialog) return;
    const oldOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = oldOverflow; };
  }, [fullscreen]);

  const bmKey = `bookmark_${catId}_${key}`;

  useEffect(() => {
    try {
      setBookmarked(!!localStorage.getItem(bmKey));
    } catch {}
    setImageIndex(0);
    setFullscreen(false);
    setSheetOpen(false);
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
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await downloadSecretPdf(data);
    } catch {
      toast('Générateur PDF indisponible (connexion requise).');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <article className="secret-detail" aria-labelledby="secret-detail-title">
      <div className="secret-detail-actions">
        <button type="button" className="detail-expand primary" onClick={doShare}>
          <Share2 size={18} aria-hidden="true" /> Partager
        </button>
        <button type="button" className="detail-expand" onClick={doPdf} disabled={pdfBusy} aria-busy={pdfBusy}>
          <FileText size={18} aria-hidden="true" /> {pdfBusy ? 'Préparation…' : 'PDF'}
        </button>
      </div>

      <section className="secret-detail-summary">
        {catLabel && <span className="secret-cat-chip">{catLabel}</span>}
        <h1 id="secret-detail-title" dir="auto">{title}</h1>
        {img && (
          <div className="secret-gallery">
            <button type="button" className="secret-gallery-open" onClick={() => setFullscreen(true)} aria-label={`Agrandir l’image ${imageIndex + 1}`}>
              <SmartImage src={optimImg(img, 1000)} alt={`${title} — image ${imageIndex + 1}`} fill
                sizes="(max-width: 640px) 90vw, 700px" style={{ objectFit: 'contain' }} />
              <span className="secret-zoom-label"><ZoomIn size={18} aria-hidden="true" /> Agrandir</span>
            </button>
            {images.length > 1 && (
              <div className="secret-gallery-nav">
                <button type="button" onClick={() => changeImage(-1)} aria-label="Image précédente"><ChevronLeft size={20} /></button>
                <span aria-live="polite">Image {imageIndex + 1} / {images.length}</span>
                <button type="button" onClick={() => changeImage(1)} aria-label="Image suivante"><ChevronRight size={20} /></button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="secret-instructions" aria-labelledby="secret-instructions-title">
        <h2 id="secret-instructions-title"><FileText size={22} aria-hidden="true" /> Instructions</h2>
        {paragraphs.length ? (
          <ol className="secret-reading-steps">
            {paragraphs.map((paragraph, index) => (
              <li key={index} className={/^\s*\d+[.)]\s/.test(paragraph) ? 'source-numbered' : ''}>
                <div className="secret-paragraph" dir="auto">
                  {secretInlineParts(paragraph).map((part, i) => part.arabic
                    ? <bdi className="secret-inline-arabic" dir="rtl" lang="ar" key={i}>{part.text}</bdi>
                    : <span key={i}>{part.text}</span>)}
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="secrets-empty">Le contenu de ce secret est indisponible.</p>}
      </section>

      <nav className="secret-interactions" aria-label="Actions du secret">
        <button type="button" className={liked ? 'is-liked' : ''} aria-pressed={liked} aria-label="J’aime" onClick={toggleLike}>
          <Heart size={22} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
        <button type="button" aria-label="Commentaires" onClick={() => setSheetOpen(true)}>
          <MessageCircle size={22} aria-hidden="true" />{comments.length > 0 && <span>{comments.length}</span>}
        </button>
        <button type="button" className={bookmarked ? 'is-saved' : ''} aria-pressed={bookmarked} aria-label="Enregistrer dans les favoris" onClick={toggleBookmark}>
          <Bookmark size={22} fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </nav>

      <CommentSheet open={sheetOpen} comments={comments} onClose={() => setSheetOpen(false)} onPost={postComment} />
      {fullscreen && img && (
        <dialog ref={dialogRef} className="secret-image-dialog" aria-label="Image du secret agrandie"
          onCancel={() => setFullscreen(false)} onClick={(e) => { if (e.target === e.currentTarget) setFullscreen(false); }}
          onKeyDown={(e) => {
            if (images.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
              e.preventDefault(); changeImage(e.key === 'ArrowLeft' ? -1 : 1);
            }
          }}>
          <button type="button" className="secret-image-close" onClick={() => setFullscreen(false)} aria-label="Fermer l’image"><X size={24} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={optimImg(img)} alt={`${title} — image ${imageIndex + 1}`} />
          {images.length > 1 && (
            <div className="secret-gallery-nav">
              <button type="button" onClick={() => changeImage(-1)} aria-label="Image précédente"><ChevronLeft size={22} /></button>
              <span aria-live="polite">Image {imageIndex + 1} / {images.length}</span>
              <button type="button" onClick={() => changeImage(1)} aria-label="Image suivante"><ChevronRight size={22} /></button>
            </div>
          )}
        </dialog>
      )}
    </article>
  );
}
