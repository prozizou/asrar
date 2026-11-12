'use client';
// Vue boutique d'un vendeur — port d'openVendorShop().
import { useCallback, useState } from 'react';
import { safeKey, displayProductName } from '@/lib/market';
import { optimImg } from '@/lib/img';
import SmartImage from '@/components/SmartImage';
import ReviewsSection from '@/components/ReviewsSection';
import ProductPrice from './ProductPrice';
import ProductRequests from './ProductRequests';
import { Share2, ArrowLeft, Store, BadgeCheck, MapPin, ImageOff } from 'lucide-react';
import { shareShop } from '@/lib/share';

export default function VendorShop({ vendor, products, isOwn, onBack, onOpenProduct }) {
  const [imgErrors, setImgErrors] = useState({}); // { [productKey]: true } — image indisponible → repli 🔮
  const markImgError = useCallback((key) => setImgErrors((prev) => (prev[key] ? prev : { ...prev, [key]: true })), []);
  return (
    <div className="glass-panel">
      <button className="back-btn" onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
        <ArrowLeft size={18} aria-hidden="true" /> Retour au marché
      </button>

      <div className="vendor-shop-heading" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div
          style={{
            position: 'relative', // nécessaire à next/image (fill) — voir SmartImage
            width: 80,
            height: 80,
            flexShrink: 0,
            borderRadius: '50%',
            background: 'var(--mk-surface-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            overflow: 'hidden',
          }}
        >
          {vendor.avatar ? (
            <SmartImage
              src={optimImg(vendor.avatar, 200)}
              alt=""
              fill
              sizes="80px"
              style={{ objectFit: 'cover' }}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : (
            <Store size={34} strokeWidth={1.7} aria-hidden="true" />
          )}
        </div>
        <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <h2 style={{ margin: 0 }}>
            {vendor.name} {vendor.verified && <span className="vendor-verified"><BadgeCheck size={16} strokeWidth={2.4} aria-hidden="true" /> Vérifié</span>}
          </h2>
          {vendor.location && <p className="vendor-location"><MapPin size={14} aria-hidden="true" /> {vendor.location}</p>}
          <p style={{ color: 'var(--mk-gold)' }}>{vendor.bio || 'Spécialiste ésotérique'}</p>
        </div>
      </div>

      <button type="button" className="vendor-share-btn" onClick={() => shareShop(vendor, isOwn)}>
        <Share2 size={17} aria-hidden="true" /> {isOwn ? 'Partager ma boutique' : 'Partager cette boutique'}
      </button>

      {/* Demandes de produit : visibles du seul propriétaire (qui répond ou
          supprime) ; un visiteur ne voit que ses propres demandes. */}
      <ProductRequests vendorId={vendor.id} isOwn={isOwn} />

      {/* La note moyenne était un champ statique saisi à la main
          (vendeurNote, jamais fiable) — remplacée par de vrais avis (étoiles
          + texte), calculés à partir des commentaires. Masqué pour le
          propriétaire de la boutique : il ne se note pas lui-même. */}
      <ReviewsSection cat="vendor" itemKey={safeKey(vendor.id)} canReview={!isOwn} title="Avis sur cette boutique" />

      {products.length === 0 && (
        <p style={{ color: '#888', textAlign: 'center', margin: '28px 16px' }}>Aucun produit pour le moment.</p>
      )}

      <div className="prod-grid">
        {products.map((p) => (
          <button type="button" key={p._key} className="prod-card" onClick={() => onOpenProduct(p._key)}>
            {p.Image && !imgErrors[p._key] ? (
              <div className="prod-img">
                <SmartImage
                  src={optimImg(p.Image, 400)}
                  alt={p.produit || ''}
                  fill
                  sizes="220px"
                  style={{ objectFit: 'cover' }}
                  onError={() => markImgError(p._key)}
                />
              </div>
            ) : (
              <div className="prod-img-placeholder">
                <span className="prod-img-placeholder-icon" aria-hidden="true"><ImageOff size={28} strokeWidth={1.6} /></span>
                <span className="prod-img-placeholder-label">Image indisponible</span>
              </div>
            )}
            <div className="prod-body">
              <div className="prod-name">{displayProductName(p.produit) || 'Produit'}</div>
              <ProductPrice prix={p.Prix} devise={p.devise} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
