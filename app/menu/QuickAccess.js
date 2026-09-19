'use client';
// Ligne d'accès rapide en tête de page — modules RÉELLEMENT utilisés
// (lib/recentModules.js) une fois qu'il y en a, sinon une sélection par
// défaut (premier lancement/visiteur) : jamais de ligne vide en haut de
// l'écran. Simplifie « Favoris » + « Récents » + « Modules principaux »
// (revue design) en UNE SEULE ligne adaptative — plus simple à comprendre
// pour l'utilisateur (pas de distinction à apprendre entre trois listes)
// et à maintenir, tout en couvrant le même besoin : garder les modules les
// plus utiles à portée d'un tap sans dérouler tout le menu.
import { useEffect, useState } from 'react';
import { getRecentModules } from '@/lib/recentModules';
import MenuItemTile from './MenuItemTile';

// Sélection éditoriale tant qu'aucun historique n'existe sur cet appareil —
// un aperçu volontairement varié (spiritualité, calcul, social) plutôt que
// les quatre premiers modules de la liste.
const DEFAULT_HREFS = ['/asrar', '/benefits', '/zikr', '/bibliotheque'];

export default function QuickAccess({ allItems }) {
  // null tant que le localStorage n'a pas été lu : le rendu SERVEUR ne peut
  // jamais connaître les récents de CET appareil, donc rien n'est affiché
  // avant l'hydratation — évite un contenu qui changerait sous les yeux.
  const [hrefs, setHrefs] = useState(null);

  useEffect(() => {
    const recent = getRecentModules().filter((h) => allItems.some((it) => it.href === h));
    setHrefs(recent.length > 0 ? recent : DEFAULT_HREFS.filter((h) => allItems.some((it) => it.href === h)));
  }, [allItems]);

  if (!hrefs || hrefs.length === 0) return null;
  const items = hrefs.map((h) => allItems.find((it) => it.href === h)).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <section className="menu-group quick-access">
      <h2 className="group-title">Accès rapide</h2>
      <div className="sub-grid">
        {items.map((it) => (
          <MenuItemTile key={it.href} href={it.href} icon={it.icon} label={it.label} desc={it.desc} />
        ))}
      </div>
    </section>
  );
}
