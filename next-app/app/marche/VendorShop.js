'use client';
// Vue boutique d'un vendeur — port d'openVendorShop().
import { formatPrice } from '@/lib/market';

export default function VendorShop({ vendor, products, onBack, onOpenProduct }) {
  return (
    <div className="glass-panel">
      <button className="back-btn" onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
        ← Retour au marché
      </button>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div
          style={{
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vendor.avatar}
              alt=""
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
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
          <p style={{ color: 'var(--mk-gold)' }}>
            ⭐ {vendor.rating} • {vendor.bio || 'Spécialiste ésotérique'}
          </p>
        </div>
      </div>

      <div className="prod-grid">
        {products.map((p) => (
          <div key={p._key} className="prod-card" onClick={() => onOpenProduct(p._key)}>
            {p.Image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="prod-img"
                src={p.Image}
                alt={p.produit || ''}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.outerHTML = '<div class="prod-img-placeholder">🔮</div>';
                }}
              />
            ) : (
              <div className="prod-img-placeholder">🔮</div>
            )}
            <div className="prod-body">
              <div className="prod-name">{p.produit || 'Produit'}</div>
              <div className="prod-price">{formatPrice(p.Prix, p.devise)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
