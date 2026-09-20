'use client';
// Grille d'une page de catégorie — composant CLIENT uniquement pour porter
// l'état des favoris (lib/favoriteModules.js) : la page de catégorie
// elle-même (app/menu/[categorie]/page.tsx) reste un composant SERVEUR.
// L'état vit ici, et non dans chaque tuile, pour que l'étoile reflète
// immédiatement l'épinglage sans relire le stockage tuile par tuile.
import { useEffect, useState } from 'react';
import { getFavoriteModules, toggleFavoriteModule } from '@/lib/favoriteModules';
import MenuItemTile from './MenuItemTile';

export default function CategoryGrid({ items }) {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    setFavorites(getFavoriteModules());
  }, []);

  const onToggleFavorite = (href) => setFavorites(toggleFavoriteModule(href));

  return (
    <div className="sub-grid">
      {items.map((it) => (
        <MenuItemTile
          key={it.href}
          href={it.href}
          icon={it.icon}
          label={it.label}
          desc={it.desc}
          favorite={favorites.includes(it.href)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
