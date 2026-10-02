'use client';
// Fiche produit (modale) — port de openModal()/loadProductSocial()/commanderProduit().
// Galerie + miniatures, titre/prix rapprochés, badge catégorie, carte boutique
// horizontale, description courte (dépliable), réactions compactes (like,
// commentaires, partage) et commande WhatsApp directe au vendeur dans un
// bouton fixé en bas. Plein écran sur mobile, carte centrée au-delà.
// Classes `pm-*` (marche.css) : `.modal-*` existe aussi dans le CSS de la
// bibliothèque, un nom commun se marcherait dessus.
import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Heart, MapPin, MessageCircle, Share2, Star, Store, X, Send } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { apiPost } from '@/lib/api';
import { formatPrice, displayProductName } from '@/lib/market';
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
  const [descOpen, setDescOpen] = useState(false);
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
    // Le comptage AGRÉGÉ de commande se fait côté serveur (api/wa.js) ; ceci
    // est un enregistrement SÉPARÉ, propre à cet acheteur (« Mes commandes »,
    // app/commandes) — best-effort, ne doit jamais retarder/bloquer l'ouverture
    // de WhatsApp (fire-and-forget, aucun await avant window.open).
    apiPost('track', {
      type: 'order',
      order: {
        productKey: product._key,
        produit: article,
        prix: product.Prix,
        devise: product.devise,
        vendeur: boutique,
        image: mainImg || product.Image || '',
      },
    }).catch(() => {});
    window.open('/api/wa?product=' + encodeURIComponent(product._key) + '&text=' + encodeURIComponent(msg), '_blank', 'noopener');
  };

  const description = String(product.description || '').trim();
  // Description courte : 3 lignes ; « Lire la suite » seulement si elle en a plus.
  const descLong = description.length > 130;
  const category = product.chain ? product.chain.charAt(0).toUpperCase() + product.chain.slice(1) : '';
  const rating = Number(vendor && vendor.rating) > 0 ? Number(vendor.rating).toFixed(1) : '';
  const price = formatPrice(product.Prix, product.devise);

  return (
    <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pm-sheet" role="dialog" aria-modal="true" aria-label={product.produit || 'Produit'}>
        <button type="button" className="pm-close" onClick={onClose} aria-label="Fermer">
          <X size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>

        {/* Galerie : image principale au format 4:3 (object-fit: cover), puis
            miniatures de 48 px — l'active est cerclée de violet. */}
        {mainImg && (
          <div className="pm-gallery">
            <SmartImage
              src={optimImg(mainImg, 800)}
              alt={product.produit || ''}
              fill
              sizes="(max-width: 640px) 100vw, 520px"
              style={{ objectFit: 'cover' }}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
        {galerie.length > 1 && (
          <div className="pm-thumbs" role="tablist" aria-label="Photos du produit">
            {galerie.map((url, i) => (
              <button
                type="button"
                key={i}
                role="tab"
                aria-selected={url === mainImg}
                aria-label={'Photo ' + (i + 1)}
                className={'pm-thumb' + (url === mainImg ? ' active' : '')}
                onClick={() => setMainImg(url)}
              >
                <SmartImage
                  src={optimImg(url, 150)}
                  alt=""
                  fill
                  sizes="48px"
                  style={{ objectFit: 'cover' }}
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </button>
            ))}
          </div>
        )}

        <div className="pm-body">
          {/* Catégorie, titre et prix serrés en un seul bloc. Casse normalisée
              à l'affichage seulement (displayProductName) — la donnée brute
              (product.produit) reste celle utilisée dans order()/doShare(). */}
          <div className="pm-head">
            {category && <span className="pm-cat">{category}</span>}
            <h2 className="pm-title">{displayProductName(product.produit) || 'Produit'}</h2>
            {price && <div className="pm-price">{price}</div>}
          </div>

          {vendor && (
            <div className="pm-vendor">
              <div className="pm-vendor-avatar">
                {vendor.avatar ? (
                  <SmartImage
                    src={optimImg(vendor.avatar, 120)}
                    alt=""
                    fill
                    sizes="44px"
                    style={{ objectFit: 'cover' }}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <Store size={20} aria-hidden="true" />
                )}
              </div>
              <div className="pm-vendor-info">
                <div className="pm-vendor-name">
                  <span>{vendor.name}</span>
                  {vendor.verified && <BadgeCheck size={15} strokeWidth={2.2} className="pm-verified" aria-label="Boutique vérifiée" />}
                </div>
                <div className="pm-vendor-meta">
                  {rating && (
                    <span className="pm-rating">
                      <Star size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" /> {rating}
                    </span>
                  )}
                  {vendor.location && (
                    <span className="pm-loc">
                      <MapPin size={12} strokeWidth={2} aria-hidden="true" /> {vendor.location}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="pm-vendor-btn"
                // Le parent ferme la fiche PUIS ouvre la boutique (ordre géré
                // avec l'historique, cf. app/page.tsx visitShopFromModal).
                onClick={() => onVisitShop(vendor.id)}
              >
                Visiter
              </button>
            </div>
          )}

          {description && (
            <div className="pm-desc-wrap">
              <p className={'pm-desc' + (descLong && !descOpen ? ' clamped' : '')}>{description}</p>
              {descLong && (
                <button type="button" className="pm-more" onClick={() => setDescOpen((v) => !v)} aria-expanded={descOpen}>
                  {descOpen ? 'Réduire' : 'Lire la suite'}
                </button>
              )}
            </div>
          )}

          {/* Réactions compactes : like, commentaires, partage. */}
          <div className="pm-reactions">
            <button type="button" className={'pm-react' + (liked ? ' liked' : '')} onClick={toggleLike} aria-pressed={liked} aria-label={liked ? 'Retirer mon j’aime' : 'J’aime'}>
              <Heart size={16} strokeWidth={2.2} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
              <span>{likeCount}</span>
            </button>
            <button type="button" className={'pm-react' + (showComments ? ' on' : '')} onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} aria-label="Commentaires">
              <MessageCircle size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>{comments.length}</span>
            </button>
            <button type="button" className="pm-react" title="Partager ce produit" aria-label="Partager ce produit" onClick={doShare}>
              <Share2 size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          <div className={'pm-comments' + (showComments ? ' open' : '')}>
            <div className="pm-comment-list" ref={listRef}>
              {comments.map((c) => (
                <div key={c.id} className="pm-comment">
                  <div className="pm-comment-avatar">
                    {c.photo ? (
                      <SmartImage src={c.photo} alt="" fill sizes="26px" style={{ objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    ) : (
                      (c.email || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="pm-comment-body">
                    <div className="pm-comment-pseudo">{c.email}</div>
                    <div className="pm-comment-text">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="pm-comment-input">
              <textarea
                ref={taRef}
                maxLength={500}
                rows={1}
                placeholder="Écrire un commentaire…"
                aria-label="Écrire un commentaire"
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
              <button type="button" className="pm-comment-send" onClick={submitComment} aria-label="Envoyer">
                <Send size={17} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Bouton WhatsApp FIXÉ en bas de la fiche (sticky) : reste à portée de
            pouce pendant qu'on lit la description ou les commentaires. */}
        <div className="pm-cta">
          <button type="button" className="pm-wa" onClick={order}>
            <MessageCircle size={20} strokeWidth={2.2} aria-hidden="true" />
            Commander via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
