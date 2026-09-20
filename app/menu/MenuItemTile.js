'use client';
// Tuile de module cliquable — composant CLIENT (comme UserBar.js,
// PlanetHourWidget.js) pour enregistrer le clic dans les « récents »
// (lib/recentModules.js) avant la navigation ; les pages qui l'utilisent
// restent des composants SERVEUR. `icon` est un ÉLÉMENT déjà rendu (JSX, pas
// une référence de composant) : voir lib/modulesCatalog.tsx.
//
// L'étoile « favori » est CONTRÔLÉE (props `favorite`/`onToggleFavorite`,
// fournies par CategoryGrid.js ou PersonalRows.js) plutôt que gérée tuile
// par tuile : la rangée Favoris doit se mettre à jour immédiatement quand on
// désépingle une de ses propres tuiles. Sans `onToggleFavorite`, aucune
// étoile n'est rendue. Le bouton est un FRÈRE du lien, jamais un enfant :
// un bouton dans un <a> n'est ni valide ni utilisable au clavier.
import Link from 'next/link';
import { Star } from 'lucide-react';
import { trackRecentModule } from '@/lib/recentModules';

export default function MenuItemTile({ href, icon, label, desc, favorite, onToggleFavorite }) {
  return (
    <div className="menu-item-wrap">
      <Link href={href} className="menu-item" onClick={() => trackRecentModule(href)}>
        <span className="menu-item-icon" aria-hidden="true">{icon}</span>
        <h3>{label}</h3>
        <p className="menu-item-desc">{desc}</p>
      </Link>
      {onToggleFavorite && (
        <button
          type="button"
          className={'menu-item-fav' + (favorite ? ' on' : '')}
          aria-pressed={!!favorite}
          aria-label={favorite ? `Retirer ${label} des favoris` : `Ajouter ${label} aux favoris`}
          title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={() => onToggleFavorite(href)}
        >
          <Star size={15} strokeWidth={2} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
