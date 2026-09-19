'use client';
// Section de catégorie REPLIABLE — condition du gain de hauteur d'écran
// recherché (revue design : « les fonctions les plus utilisées restent
// directement accessibles [ligne Accès rapide], les autres sont accessibles
// par catégorie »). Repliée par défaut : seuls le titre, le compte et une
// icône de catégorie restent visibles tant qu'on ne l'ouvre pas — le corps
// s'anime via la technique CSS grid-template-rows 0fr→1fr (voir .category-body,
// app/globals.css), pas de mesure de hauteur en JS.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import MenuItemTile from './MenuItemTile';

export default function CategorySection({ title, icon, badge, items }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="category-section">
      <button
        type="button"
        className="category-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="category-header-icon" aria-hidden="true">{icon}</span>
        <span className="category-header-label">
          {title}
          {badge && <span className="category-badge">{badge}</span>}
        </span>
        <span className="category-header-count">{items.length}</span>
        <ChevronDown size={18} strokeWidth={2.5} className={'category-chevron' + (open ? ' open' : '')} aria-hidden="true" />
      </button>

      <div className={'category-body' + (open ? ' open' : '')}>
        <div className="category-body-inner">
          {/* last-child impair en pleine largeur (.category-grid, CSS) :
              évite la dernière ligne à une seule tuile (revue design, « grille
              visuellement inachevée ») sans avoir à forcer un nombre pair
              d'éléments par catégorie. */}
          <div className="sub-grid category-grid">
            {items.map((it) => (
              <MenuItemTile key={it.href} href={it.href} icon={it.icon} label={it.label} desc={it.desc} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
