// Tableau de bord de l'app — ex-« menu contenant toutes les fonctionnalités ».
//
// Refonte (revue design, 2026-09-20) : la page déroulait les 12 modules, soit
// en grille plate, soit en accordéons — plus une rangée « Accès rapide » qui
// REPRENAIT quatre modules déjà listés plus bas. Désormais c'est un tableau
// de bord : en-tête compact + recherche, le contenu du moment (hadith, heure
// planétaire), la zone personnelle (Continuer / Favoris), puis seulement les
// quatre FAMILLES — chacune ouvrant sa propre page (app/menu/[categorie]).
// Un module n'apparaît donc plus qu'à un seul endroit, sauf s'il a été
// épinglé/ouvert par l'utilisateur lui-même.
//
// Composant SERVEUR (pas de 'use client') : le catalogue est statique
// (lib/modulesCatalog.tsx) ; seules les parties interactives (en-tête de
// profil, recherche, zone personnelle) sont des composants clients isolés.
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import UserBar from './UserBar';
import MenuSearch from './MenuSearch';
import PersonalRows from './PersonalRows';
import PlanetHourWidget from '@/components/PlanetHourWidget';
import DailyContentCard from '@/components/DailyContentCard';
import { CATEGORIES, ALL_MODULES, categoryOf } from '@/lib/modulesCatalog';

// La recherche affiche la famille de chaque résultat : elle est résolue ici,
// côté serveur (categoryOf est une fonction, qui ne franchirait pas la
// frontière serveur → client).
const SEARCH_ITEMS = ALL_MODULES.map((m) => ({ ...m, category: categoryOf(m.href)?.title || '' }));

export default function MenuPage() {
  return (
    <div className="container">
      {/* Réservé au desktop (masqué ≤900px, cf. app/globals.css) — sur
          mobile, le retour se fait par le geste natif du navigateur. */}
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <UserBar />
      <MenuSearch items={SEARCH_ITEMS} />

      <DailyContentCard />
      <PlanetHourWidget />

      <PersonalRows allItems={ALL_MODULES} />

      {/* Les familles : un lien par catégorie plutôt que 12 tuiles déroulées
          (revue design : « au clic sur une catégorie, elle ouvre une page
          dédiée »). Les modules sont NOMMÉS en sous-titre — on sait ce que
          contient une famille sans avoir à l'ouvrir, mais ils ne forment pas
          une deuxième série de cartes cliquables. */}
      <section className="menu-group">
        <h2 className="group-title">Explorer</h2>
        <div className="family-list">
          {CATEGORIES.map((cat) => (
            <Link key={cat.slug} href={`/menu/${cat.slug}`} className="family-row">
              <span className="family-icon" aria-hidden="true">{cat.icon}</span>
              <span className="family-id">
                <span className="family-title">
                  <span className="family-title-text">{cat.title}</span>
                  {cat.badge && <span className="family-badge">{cat.badge}</span>}
                </span>
                <span className="family-items">{cat.items.map((it) => it.label).join(' · ')}</span>
              </span>
              <span className="family-count">{cat.items.length} module{cat.items.length > 1 ? 's' : ''}</span>
              <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
