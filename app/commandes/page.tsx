'use client';
// « Mes commandes » — historique des commandes CÔTÉ ACHETEUR (app/marche/
// ProductModal.js écrit un enregistrement via /api/track au clic « Commander
// via WhatsApp » ; ici on relit via /api/orders, scopé au uid connecté).
// Avant ce module, rien ne permettait de retrouver ce qu'on avait commandé —
// tout ne vivait que dans la conversation WhatsApp.
//
// TypeScript (batch 2/7, cf. tsconfig.json) : le type Order reflète le
// format renvoyé par pages/api/orders.js ({ items: [{ _key, produit, prix,
// devise, vendeur, image, at }] }) — lib/api.js, lib/market.js et lib/img.js
// restent en .js (imports non typés, cf. app/menu/page.tsx pour le même choix).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { formatPrice } from '@/lib/market';
import { optimImg } from '@/lib/img';
import SmartImageUntyped from '@/components/SmartImage';
import SpinnerUntyped from '@/components/Spinner';

// SmartImage.js / Spinner.js restent en .js pour l'instant (composants
// partagés, hors scope de ce batch — cf. tsconfig.json) : sans JSDoc, TS
// infère depuis leur destructuring un type de props trop strict (toute
// propriété sans valeur par défaut devient "requise"). Cast local en `any`
// plutôt que de se battre avec cette inférence — même esprit que l'« any
// implicite » documenté dans app/menu/page.tsx pour UserBar/PlanetHourWidget
// (comportement réel inchangé à l'exécution).
const SmartImage = SmartImageUntyped as any;
const Spinner = SpinnerUntyped as any;

interface Order {
  _key: string;
  produit?: string;
  prix?: number;
  devise?: string;
  vendeur?: string;
  image?: string;
  at?: number;
}

export default function CommandesPage() {
  const [items, setItems] = useState<Order[] | null>(null); // null = chargement
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiPost('orders', {})
      .then(({ items }: { items?: Order[] }) => {
        if (!cancelled) setItems(items || []);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message || 'Impossible de charger vos commandes.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container">
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <div className="header">
        <h1>Mes commandes</h1>
        <p style={{ color: 'var(--text-muted)' }}>Historique de vos commandes sur le Marché</p>
      </div>

      <div className="glass-panel">
        {items === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Spinner />
          </div>
        ) : error ? (
          <p style={{ color: '#ff6b6b', textAlign: 'center', padding: '1.5rem' }}>{error}</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
            Aucune commande pour l'instant. Vos commandes apparaîtront ici après un « Commander via WhatsApp »
            sur le Marché.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((o) => (
              <OrderRow key={o._key} order={o} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const date = order.at ? new Date(order.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
      }}
    >
      <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        {order.image ? (
          <SmartImage
            src={optimImg(order.image, 150)}
            alt=""
            fill
            sizes="56px"
            style={{ objectFit: 'cover' }}
            onError={(e: any) => (e.currentTarget.style.display = 'none')}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '1.3rem' }}>
            🛍️
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {order.produit || 'Produit'}
        </div>
        <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
          {order.vendeur ? order.vendeur + ' · ' : ''}
          {date}
        </div>
      </div>
      <div style={{ fontWeight: 700, color: '#6bffb8', flexShrink: 0 }}>{formatPrice(order.prix, order.devise)}</div>
    </div>
  );
}
