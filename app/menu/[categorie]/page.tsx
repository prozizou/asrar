// Page d'une famille de modules (Spiritualité, Sciences traditionnelles,
// Ressources, Outils) — ouverte depuis le tableau de bord (app/menu/page.tsx).
// Revue design : « au clic sur une catégorie, elle ouvre une page dédiée
// contenant ses fonctions », plutôt que de répéter toutes les tuiles sur
// l'accueil.
//
// Composant SERVEUR : le catalogue est statique (lib/modulesCatalog.tsx) et
// les quatre routes sont pré-rendues (generateStaticParams). Seule la grille
// est cliente, pour l'état des favoris (CategoryGrid.js).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import CategoryGrid from '../CategoryGrid';
import { CATEGORIES, findCategory } from '@/lib/modulesCatalog';

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ categorie: c.slug }));
}

export function generateMetadata({ params }: { params: { categorie: string } }) {
  const cat = findCategory(params.categorie);
  return { title: cat ? `${cat.title} — ASRAR PRO` : 'ASRAR PRO' };
}

export default function CategoryPage({ params }: { params: { categorie: string } }) {
  const cat = findCategory(params.categorie);
  if (!cat) notFound();

  return (
    <div className="container">
      {/* Retour visible ICI même sur mobile (contrairement à .back-btn,
          masqué ≤900px) : cette page est un niveau de profondeur ajouté par
          la refonte, on ne compte pas seulement sur le geste natif. */}
      <div className="category-page-head">
        <Link href="/menu" className="zk-icon-btn" aria-label="Retour au menu">
          <ArrowLeft size={18} strokeWidth={2.5} aria-hidden="true" />
        </Link>
        <h1 className="category-page-title">
          {cat.title}
          {cat.badge && <span className="family-badge">{cat.badge}</span>}
        </h1>
      </div>

      <CategoryGrid items={cat.items} />
    </div>
  );
}
