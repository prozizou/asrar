'use client';
// Prix d'un produit, montant et devise séparés (revue design Marché, point
// 9 : « 650 000 FCFA domine beaucoup trop ») — la devise en plus petit à
// côté du montant, pour qu'un prix long n'écrase pas le nom du produit sur
// une carte dense. Partagé entre la grille du Marché (app/page.tsx) et la
// vitrine d'un vendeur (VendorShop.js) : les deux réutilisent la même classe
// .prod-price (marche.css), donc le même rendu ici garde les deux écrans
// visuellement identiques.
import { splitPrice } from '@/lib/market';

export default function ProductPrice({ prix, devise }) {
  const sp = splitPrice(prix, devise);
  if (!sp) return null;
  return (
    <div className="prod-price">
      <span className="prod-price-amount">{sp.amount}</span> <span className="prod-price-currency">{sp.currency}</span>
    </div>
  );
}
