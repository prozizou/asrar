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
import Modal from '@/components/Modal';
import { reserveExternalWindow } from '@/lib/externalWindow';
import { formatOrderPrice } from '@/lib/orderStatus';
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

  const requestRef = useRef({ productKey: product._key, id: null, orderId: null });
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [verifiedRequest, setVerifiedRequest] = useState(null);
  const order = async () => {
    if (ordering) return;
    const destination = reserveExternalWindow();
    if (!destination) { setOrderError('Autorisez l’ouverture d’une nouvelle fenêtre pour contacter la boutique.'); return; }
    setOrdering(true); setOrderError('');
    try {
      if (requestRef.current.productKey !== product._key) requestRef.current = { productKey: product._key, id: null, orderId: null };
      const request = requestRef.current;
      let result;
      if (request.orderId) result = await apiPost('orders', { action: 'contact', orderId: request.orderId });
      else {
        request.id ||= crypto.randomUUID();
        result = await apiPost('orders', { action: 'create', productKey: product._key, requestId: request.id });
        request.orderId = result.order._key;
        setVerifiedRequest(result.order);
      }
      destination.navigate(result.contactUrl);
    } catch (error) {
      destination.close(); setOrderError(error.message || 'La demande n’a pas pu être préparée. Réessayez.');
    } finally { setOrdering(false); }
  };

  const description = String(product.description || '').trim();
  // Description courte : 3 lignes ; « Lire la suite » seulement si elle en a plus.
  const descLong = description.length > 130;
  const category = product.chain ? product.chain.charAt(0).toUpperCase() + product.chain.slice(1) : '';
  const rating = Number(vendor && vendor.rating) > 0 ? Number(vendor.rating).toFixed(1) : '';
  const price = verifiedRequest ? formatOrderPrice(verifiedRequest.prix, verifiedRequest.devise) : formatPrice(product.Prix, product.devise);

  return (
    <Modal className="pm-overlay" onClose={onClose} label={product.produit || 'Produit'}>
      <div className="pm-sheet">
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
          {orderError && <p role="alert">{orderError}</p>}
          {verifiedRequest && <p role="status">Demande enregistrée au prix vérifié : {formatOrderPrice(verifiedRequest.prix, verifiedRequest.devise)}.</p>}
          <p>Une demande WhatsApp ne confirme ni l’achat ni le paiement.</p>
          <button type="button" className="pm-wa" onClick={order} disabled={ordering}>
            <MessageCircle size={20} strokeWidth={2.2} aria-hidden="true" />
            {ordering ? 'Préparation…' : 'Demander via WhatsApp'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
