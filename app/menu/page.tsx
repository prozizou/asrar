// Menu — liste des modules de l'app (hors Marché Mystique, désormais la page
// d'accueil, cf. app/page.js). Accessible via le bouton « ☰ Accéder au menu »
// de l'accueil. Chaque tuile porte une courte description en clair : plusieurs
// noms de modules sont des termes du domaine (Abajad, Rouwhanes, Tourab…) que
// quelqu'un de nouveau ne devine pas avant d'avoir cliqué.
//
// Refonte (revue design, 2026-09-19) : l'ancienne page empilait 12 tuiles +
// Hadith + Heure de Mars + une seconde section, presque toutes de même poids
// visuel — un scroll très long sur mobile, un « catalogue de cartes » plutôt
// qu'une app premium. Désormais : app bar compacte (UserBar.js) → Hadith du
// jour REPLIÉ par défaut (DailyContentCard.js) → Heure de Mars en widget une
// ligne (PlanetHourWidget.js) → Accès rapide (QuickAccess.js, récents ou
// sélection par défaut) → 4 catégories REPLIABLES (CategorySection.js) au
// lieu d'une grille plate + une section « premium » à part. Icônes emoji
// (styles hétérogènes : globe, cadeau, parchemin…) remplacées par une seule
// famille SVG (lucide-react, déjà utilisée ailleurs dans l'app — Zikr,
// DailyContentCard) — même épaisseur de trait partout.
//
// Composant SERVEUR (pas de 'use client') : la liste des modules est
// statique, aucun état/hook ici — seules les parties interactives (app bar,
// accès rapide, catégories repliables, tuile cliquable) sont des composants
// clients isolés (cf. ANALYSE.md, faiblesse « surface use client »).
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Scroll, Calculator, Globe, Sparkles, Star, Users, Wand2, BookOpen, Gift,
  Feather, Grid3x3, Hash, Moon, Layers,
} from 'lucide-react';
import UserBar from './UserBar';
import QuickAccess from './QuickAccess';
import CategorySection from './CategorySection';
import PlanetHourWidget from '@/components/PlanetHourWidget';
import DailyContentCard from '@/components/DailyContentCard';

interface ModuleTile {
  icon: ReactNode;
  label: string;
  desc: string;
  href: string;
}

const ICON_SIZE = 26;
const ICON_PROPS = { size: ICON_SIZE, strokeWidth: 1.75 };

// ── Spiritualité ─────────────────────────────────────────────────────────
const SPIRITUALITE: ModuleTile[] = [
  { icon: <Star {...ICON_PROPS} />, label: "Noms d'Allah", desc: "Découvrir les 99 Noms d'Allah", href: '/benefits' },
  { icon: <Users {...ICON_PROPS} />, label: 'Zikr collectif', desc: 'Réciter un dhikr ensemble, objectif commun', href: '/zikr' },
  { icon: <Wand2 {...ICON_PROPS} />, label: 'Rouwhanes', desc: 'Générer des noms d\'anges et un vœu', href: '/rouwhania' },
];

// ── Ressources ───────────────────────────────────────────────────────────
const RESSOURCES: ModuleTile[] = [
  { icon: <BookOpen {...ICON_PROPS} />, label: 'Bibliothèque', desc: 'Lire des livres et manuscrits', href: '/bibliotheque' },
  { icon: <Scroll {...ICON_PROPS} />, label: 'Secret Mystique', desc: 'Consulter des secrets et invocations', href: '/asrar' },
];

// ── Sciences traditionnelles (palier « 1 An ») ──────────────────────────
const SCIENCES_TRADITIONNELLES: ModuleTile[] = [
  { icon: <Feather {...ICON_PROPS} />, label: 'Al Qalam', desc: 'Écrire un verset en calligraphie', href: '/alqalam' },
  { icon: <Grid3x3 {...ICON_PROPS} />, label: 'Géomancie', desc: 'Faire un tirage géomantique (Tourab)', href: '/geomancie' },
  // Hatims (app/wafq/carre) — moteur « Al Kanzou » porté depuis
  // prozizou/Kanzou (voir lib/kanzouWafq.ts) : neuf tailles de carrés
  // numériques (3×3 à 11×11), export Word. Description raccourcie pour
  // tenir sur deux lignes dans la tuile compacte (le détail reste sur la
  // page du module) — existait déjà comme section interne du module Wafq
  // (masqué), exposé ici en tuile de menu à part entière.
  { icon: <Hash {...ICON_PROPS} />, label: 'Hatims', desc: 'Carrés numériques (Al Kanzou), export Word', href: '/wafq/carre' },
  // Wafq (générateur par intention) et 🧿 Thalsams — masqués temporairement
  // à la demande de l'utilisateur (2026-09-02). Pages /wafq et /thalsams
  // toujours en place ; /wafq garde son propre lien interne vers Hatims
  // (app/wafq/page.tsx, section « Carrés numériques avancés »).
];

// ── Outils ───────────────────────────────────────────────────────────────
const OUTILS: ModuleTile[] = [
  { icon: <Calculator {...ICON_PROPS} />, label: 'Abajad', desc: 'Calculer le poids numérique des lettres arabes', href: '/abajad' },
  { icon: <Sparkles {...ICON_PROPS} />, label: 'Combinaisons', desc: 'Associer les 99 Noms par calcul', href: '/combinaisons' },
  // 🌙 Tafsir al-Ahlam — masqué temporairement à la demande de l'utilisateur
  // (2026-09-02). Page /tafsir toujours en place, juste retirée du menu :
  // décommenter la ligne pour la réafficher.
  // { icon: <Moon {...ICON_PROPS} />, label: 'Tafsir al-Ahlam', desc: 'Interpréter un rêve par symbole ou récit libre', href: '/tafsir' },
  { icon: <Globe {...ICON_PROPS} />, label: 'Planète', desc: "Voir l'heure planétaire du moment", href: '/planete' },
  { icon: <Gift {...ICON_PROPS} />, label: 'Parrainage', desc: 'Inviter des proches, gagner un abonnement', href: '/parrainage' },
  // 🎓 Formation mystique — masqué temporairement à la demande de
  // l'utilisateur (2026-09-02). Page /formation toujours en place.
  // { icon: <?>, label: 'Formation mystique', desc: 'Ateliers en direct par visioconférence', href: '/formation' },
];

const CATEGORIES: { key: string; title: string; icon: ReactNode; badge?: string; items: ModuleTile[] }[] = [
  { key: 'spiritualite', title: 'Spiritualité', icon: <Moon {...ICON_PROPS} />, items: SPIRITUALITE },
  { key: 'ressources', title: 'Ressources', icon: <BookOpen {...ICON_PROPS} />, items: RESSOURCES },
  { key: 'sciences', title: 'Sciences traditionnelles', icon: <Layers {...ICON_PROPS} />, badge: '1 An', items: SCIENCES_TRADITIONNELLES },
  { key: 'outils', title: 'Outils', icon: <Sparkles {...ICON_PROPS} />, items: OUTILS },
];

// Liste à plat (toutes catégories confondues) — sert de source à QuickAccess
// pour résoudre les hrefs récents/par défaut en tuiles complètes.
const ALL_ITEMS: ModuleTile[] = [...SPIRITUALITE, ...RESSOURCES, ...SCIENCES_TRADITIONNELLES, ...OUTILS];

export default function MenuPage() {
  return (
    <div className="container">
      {/* Réservé au desktop (masqué ≤900px, cf. app/globals.css) — sur
          mobile, le retour se fait par le geste natif du navigateur, comme
          partout ailleurs dans l'app. */}
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <UserBar />

      {/* Contenu spirituel quotidien (verset/hadith/dua) — voir
          components/DailyContentCard.js, repliée par défaut. */}
      <DailyContentCard />

      {/* Widget live (position GPS/repli, calcul lib/planete.js) — une ligne
          compacte, plus une tuile de grille. */}
      <PlanetHourWidget />

      <QuickAccess allItems={ALL_ITEMS} />

      {CATEGORIES.map((cat) => (
        <CategorySection key={cat.key} title={cat.title} icon={cat.icon} badge={cat.badge} items={cat.items} />
      ))}
    </div>
  );
}
