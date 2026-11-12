'use client';
// Zone PERSONNELLE du tableau de bord : « Continuer » (modules récemment
// ouverts, alimentés tout seuls) puis « Favoris » (épinglés explicitement).
// Revue design : « faire d'Accès rapide une zone Favoris / Récents,
// personnalisable » — et surtout ne plus y répéter des modules que les
// familles listent déjà. D'où deux garde-fous ici :
//   • aucune sélection par défaut : sans historique ni favori, rien ne
//     s'affiche (le tableau de bord reste court pour un nouvel arrivant) ;
//   • « Continuer » ne montre QUE le dernier module ouvert (une seule
//     carte, demande 2026-11) — même s'il est aussi en favori : c'est
//     « reprendre là où j'en étais », pas une deuxième liste de raccourcis.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Lock } from 'lucide-react';
import { getRecentModules, trackRecentModule } from '@/lib/recentModules';
import { getFavoriteModules, toggleFavoriteModule } from '@/lib/favoriteModules';
import MenuItemTile from './MenuItemTile';

const CONTINUE_MAX = 1;

export default function PersonalRows({ allItems }) {
  // null tant que le stockage n'a pas été lu : le rendu SERVEUR ne peut pas
  // connaître l'historique de CET appareil, donc rien n'est affiché avant
  // l'hydratation — évite un contenu qui changerait sous les yeux.
  const [recents, setRecents] = useState(null);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    setRecents(getRecentModules());
    setFavorites(getFavoriteModules());
  }, []);

  const byHref = (href) => allItems.find((it) => it.href === href);
  const onToggleFavorite = (href) => setFavorites(toggleFavoriteModule(href));

  if (recents === null) return null;

  const favoriteItems = favorites.map(byHref).filter(Boolean);
  const continueItems = recents
    .map(byHref)
    .filter(Boolean)
    .slice(0, CONTINUE_MAX);

  return (
    <>
      {continueItems.length > 0 && (
        <section className="menu-group">
          <h2 className="group-title">Continuer</h2>
          {/* Lignes pleine largeur avec chevron (maquette 2026-11) : « reprendre
              là où j'en étais » se lit comme une action, pas comme une tuile. */}
          <div className="family-list">
            {continueItems.map((it) => (
              <Link key={it.href} href={it.href} className="family-row continue-row" onClick={() => trackRecentModule(it.href)}>
                <span className="family-icon" aria-hidden="true">
                  {it.icon}
                  {it.premium && (
                    <span className="menu-item-lock">
                      <Lock size={9} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="menu-sep" aria-hidden="true" />
                <span className="family-id">
                  <span className="family-title"><span className="family-title-text">{it.label}</span></span>
                  <span className="family-items">{it.desc}</span>
                </span>
                <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="menu-group menu-group-favorites">
        <h2 className="group-title">Favoris</h2>
        {favoriteItems.length === 0 ? (
          /* État vide utile : dit où trouver l'étoile plutôt que de laisser
             une rangée vide sans explication. */
          <p className="menu-empty-hint">
            <Star aria-hidden="true" /> Épinglez un module depuis sa famille pour le retrouver ici.
          </p>
        ) : (
          <div className="sub-grid">
            {favoriteItems.map((it) => (
              <MenuItemTile
                key={it.href}
                href={it.href}
                icon={it.icon}
                label={it.label}
                desc={it.desc}
                premium={it.premium}
                favorite
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// Étoile de l'état vide — même icône que celle des tuiles, pour que l'invite
// désigne sans ambiguïté le bouton à chercher.
function Star(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
