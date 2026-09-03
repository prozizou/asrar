'use client';
// Vue boutique d'un vendeur — port d'openVendorShop().
import { useCallback, useState } from 'react';
import { safeKey } from '@/lib/market';
import { optimImg } from '@/lib/img';
import SmartImage from '@/components/SmartImage';
import ReviewsSection from '@/components/ReviewsSection';
import ProductPrice from './ProductPrice';

export default function VendorShop({ vendor, products, isOwn, onBack, onOpenProduct }) {
  const [imgErrors, setImgErrors] = useState({}); // { [productKey]: true } — image indisponible → repli 🔮
  const markImgError = useCallback((key) => setImgErrors((prev) => (prev[key] ? prev : { ...prev, [key]: true })), []);
  return (
    <div className="glass-panel">
      <button className="back-btn" onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
        ← Retour au marché
      </button>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div
          style={{
            position: 'relative', // nécessaire à next/image (fill) — voir SmartImage
            width: 80,
            height: 80,
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
            '🔮'
          )}
        </div>
        <div>
          <h2 style={{ margin: 0 }}>
            {vendor.name} {vendor.verified && <span style={{ color: '#4CAF50', fontSize: '1rem' }}>✔ Vérifié</span>}
          </h2>
          <p style={{ color: '#888', margin: '4px 0' }}>📍 {vendor.location}</p>
          <p style={{ color: 'var(--mk-gold)' }}>{vendor.bio || 'Spécialiste ésotérique'}</p>
        </div>
      </div>

      {/* La note moyenne était un champ statique saisi à la main
          (vendeurNote, jamais fiable) — remplacée par de vrais avis (étoiles
          + texte), calculés à partir des commentaires. Masqué pour le
          propriétaire de la boutique : il ne se note pas lui-même. */}
      <ReviewsSection cat="vendor" itemKey={safeKey(vendor.id)} canReview={!isOwn} title="Avis sur cette boutique" />

      <div className="prod-grid">
        {products.map((p) => (
          <div key={p._key} className="prod-card" onClick={() => onOpenProduct(p._key)}>
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
              <div className="prod-img-placeholder">🔮</div>
            )}
            <div className="prod-body">
              <div className="prod-name">{p.produit || 'Produit'}</div>
              <ProductPrice prix={p.Prix} devise={p.devise} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
