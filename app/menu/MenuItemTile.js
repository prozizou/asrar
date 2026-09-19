'use client';
// Tuile de module cliquable — extraite en composant CLIENT (comme UserBar.js,
// PlanetHourWidget.js) uniquement pour pouvoir enregistrer le clic dans les
// « récents » (lib/recentModules.js) avant la navigation ; page.tsx reste un
// composant SERVEUR (rien ici ne dépend d'un état côté serveur, juste un
// effet de bord au clic). `icon` est un ÉLÉMENT déjà rendu (JSX, pas une
// référence de composant) : page.tsx le construit lui-même (ex. <Scroll />)
// et le passe en enfant sérialisable — une fonction/composant brut ne
// franchirait pas la frontière serveur → client.
import Link from 'next/link';
import { trackRecentModule } from '@/lib/recentModules';

export default function MenuItemTile({ href, icon, label, desc }) {
  return (
    <Link href={href} className="menu-item" onClick={() => trackRecentModule(href)}>
      <span className="menu-item-icon" aria-hidden="true">{icon}</span>
      <h3>{label}</h3>
      <p className="menu-item-desc">{desc}</p>
    </Link>
  );
}
