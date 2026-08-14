'use client';
// Modale produit — port de openModal()/loadProductSocial()/commanderProduit().
// Galerie, bloc vendeur, barre sociale (like/commentaires temps réel), partage
// et commande WhatsApp directe au vendeur.
import { useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';
import { apiPost } from '@/lib/api';
import { formatPrice } from '@/lib/market';
import { optimImg } from '@/lib/img';
import SmartImage from '@/components/SmartImage';
import { share as shareLink } from '@/lib/share';
import { useProductSocial } from '@/components/useProductSocial';

export default function ProductModal({ product, vendor, onClose, onVisitShop }) {
  const galerie =
    Array.isArray(product.images) && product.images.length
      ? product.images.filter(Boolean)
      : product.Image
      ? [product.Image]
      : [];

  const [mainImg, setMainImg] = useState(galerie[0] || '');
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const taRef = useRef(null);
  const listRef = useRef(null);

  const { liked, likeCount, comments, toggleLike, postComment } = useProductSocial(product._key);

  // Bloque le scroll de l'arrière-plan tant que la modale est ouverte.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments, showComments]);

  // Vue produit : journalisée côté serveur (Admin SDK, contourne les règles
  // RTDB) — un enregistrement par visiteur, pour les statistiques boutique.
  useEffect(() => {
    if (!product._key || !auth.currentUser) return;
    apiPost('track', { type: 'product_view', productKey: product._key }).catch(() => {});
  }, [product._key]);

  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const submitComment = () => {
    const t = comment.trim();
    if (!t) return;
    postComment(t);
    setComment('');
    if (taRef.current) autoGrow(taRef.current);
  };

  const doShare = () => {
    const nom = product.produit || 'Produit';
    shareLink({ kind: 'product', key: product._key, title: nom, text: '🛒 ' + nom + ' — Marché Mystique sur ASRAR PRO' });
  };

  // Commande : message pré-rempli envoyé au vendeur. Son numéro reste côté
  // serveur (/api/wa le lit d'après la clé produit puis redirige).
  const order = () => {
    let email = '';
    try {
      email = (auth.currentUser && auth.currentUser.email) || '';
    } catch {}
    const boutique = product.vendeur || 'la boutique';
    const article = product.produit || 'Article';
    const total = formatPrice(product.Prix, product.devise) || (product.Prix || '') + ' FCFA';
    const msg =
      `Assalamou aleykoum 🌙\nJe souhaite passer une commande sur le Marché (${boutique}).\n\n` +
      `• Compte (e-mail) : ${email}\n• Articles :\n   - ${article}\n• Total : ${total}\n\n` +
      `Merci de me confirmer la disponibilité et les modalités de paiement.`;
    // Le comptage de commande se fait côté serveur (api/wa.js), pas ici :
    // évite toute dépendance aux règles RTDB pour l'écriture du compteur.
    window.open('/api/wa?product=' + encodeURIComponent(product._key) + '&text=' + encodeURIComponent(msg), '_blank', 'noopener');
  };

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <span className="modal-close" onClick={onClose}>
          ✕
        </span>

        {mainImg && (
          <div className="modal-img">
            <SmartImage
              src={optimImg(mainImg, 800)}
              alt={product.produit || ''}
              fill
              sizes="(max-width: 640px) 100vw, 500px"
              style={{ objectFit: 'contain' }}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}

        {galerie.length > 1 && (
          <div className="m-thumbs" style={{ display: 'flex' }}>
            {galerie.map((url, i) => (
              <div
                key={i}
                className={'m-thumb' + (url === mainImg ? ' active' : '')}
                onClick={() => setMainImg(url)}
              >
                <SmartImage
                  src={optimImg(url, 150)}
                  alt={'Vue ' + (i + 1)}
                  fill
                  sizes="60px"
                  style={{ objectFit: 'cover' }}
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            ))}
          </div>
        )}

        <h3>{product.produit || 'Produit'}</h3>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#6bffb8', margin: '8px 0' }}>
          {formatPrice(product.Prix, product.devise)}
        </div>

        {vendor && (
          <div className="vendor-block" style={{ display: 'flex' }}>
            {vendor.avatar && (
              <div className="vendor-block-avatar">
                <SmartImage
                  src={optimImg(vendor.avatar, 120)}
                  alt=""
                  fill
                  sizes="50px"
                  style={{ objectFit: 'cover', borderRadius: '50%' }}
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}
            <div className="vendor-block-info">
              <div className="vendor-block-name">
                {vendor.name} {vendor.verified && <span className="verified-badge">✔ Vérifié</span>}
              </div>
              <div className="vendor-block-loc">📍 {vendor.location}</div>
              <div className="vendor-block-meta">⭐ {vendor.rating}</div>
            </div>
            <button
              className="visit-shop-btn"
              onClick={() => {
                onVisitShop(vendor.id);
                onClose();
              }}
            >
              🏪 Visiter la boutique
            </button>
          </div>
        )}

        <div style={{ lineHeight: 1.7, borderTop: '1px solid var(--mk-border)', paddingTop: 14 }}>
          {product.description || ''}
        </div>

        <div className="social-bar">
          <button className={'like-btn' + (liked ? ' liked' : '')} onClick={toggleLike}>
            <span>{liked ? '❤️' : '🤍'}</span> <span>{likeCount}</span>
          </button>
          <button className="comment-toggle-btn" onClick={() => setShowComments((v) => !v)}>
            💬 <span>{comments.length}</span>
          </button>
          <button className="comment-toggle-btn" title="Partager ce produit" onClick={doShare}>
            📤
          </button>
        </div>

        <div className={'comments-panel' + (showComments ? ' open' : '')}>
          <div className="comment-list" ref={listRef}>
            {comments.map((c) => (
              <div key={c.id} className="m-comment-item">
                <div className="m-comment-pseudo">{c.pseudo}</div>
                <div className="m-comment-text">{c.text}</div>
              </div>
            ))}
          </div>
          <div className="comment-input-row">
            <textarea
              ref={taRef}
              maxLength={500}
              rows={1}
              placeholder="Écrire un commentaire…"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                autoGrow(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitComment();
                }
              }}
            />
            <button className="comment-send" onClick={submitComment} aria-label="Envoyer">
              ➤
            </button>
          </div>
        </div>

        <button className="add-to-cart-btn" onClick={order}>
          🛍️ Commander via WhatsApp
        </button>
      </div>
    </div>
  );
}
