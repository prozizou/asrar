// lib/modulesCatalog.tsx — SOURCE UNIQUE des modules de l'app et de leur
// rangement en familles. Utilisée par le tableau de bord (app/menu/page.tsx),
// les pages de catégorie (app/menu/[categorie]/page.tsx) et la recherche
// (app/menu/MenuSearch.js) : un module ajouté ici apparaît partout, et ne
// peut plus être dupliqué d'un écran à l'autre (revue design : « Zikr
// collectif, Al Qalam, Hatims, Secret Mystique apparaissent dans Accès
// rapide PUIS dans les catégories »).
//
// Les icônes sont des ÉLÉMENTS déjà rendus (JSX) et non des références de
// composant : c'est ce qui permet de passer un module tel quel d'un
// composant serveur à un composant client (app/menu/MenuItemTile.js).
// La logique de recherche, elle, vit dans lib/moduleSearch.js — sans JSX,
// donc testable directement.
import type { ReactNode } from 'react';
import {
  Scroll, Calculator, Globe, Sparkles, Users, Wand2, BookOpen, Gift,
  Feather, Grid3x3, Hash, Moon, Layers,
} from 'lucide-react';

export interface ModuleTile {
  icon: ReactNode;
  label: string;
  desc: string;
  href: string;
  /** Termes du domaine qui ne figurent pas dans le nom mais par lesquels on
   *  cherche le module (« carré magique » → Hatims, « tourab » → Géomancie). */
  keywords: string[];
}

export interface ModuleCategory {
  slug: string;
  title: string;
  icon: ReactNode;
  /** Palier d'abonnement requis, affiché en badge explicite (revue design :
   *  « 1 An » seul n'était pas compréhensible). */
  badge?: string;
  items: ModuleTile[];
}

const ICON = { size: 26, strokeWidth: 1.75 };
const CAT_ICON = { size: 22, strokeWidth: 1.75 };

export const CATEGORIES: ModuleCategory[] = [
  {
    slug: 'spiritualite',
    title: 'Spiritualité',
    icon: <Moon {...CAT_ICON} />,
    items: [
      { icon: <Users {...ICON} />, label: 'Zikr collectif', desc: 'Réciter un dhikr ensemble, objectif commun', href: '/zikr', keywords: ['dhikr', 'tasbih', 'chapelet', 'groupe', 'hatim'] },
      { icon: <Wand2 {...ICON} />, label: 'Rouwhanes', desc: "Générer des noms d'anges et un vœu", href: '/rouwhania', keywords: ['anges', 'rouhanya', 'rouwhania', 'voeu'] },
    ],
  },
  {
    slug: 'sciences-traditionnelles',
    title: 'Sciences traditionnelles',
    icon: <Layers {...CAT_ICON} />,
    badge: 'Accès premium',
    items: [
      { icon: <Feather {...ICON} />, label: 'Al Qalam', desc: 'Écrire un verset en calligraphie', href: '/alqalam', keywords: ['calligraphie', 'ecriture', 'qalam', 'verset'] },
      { icon: <Grid3x3 {...ICON} />, label: 'Géomancie', desc: 'Faire un tirage géomantique (Tourab)', href: '/geomancie', keywords: ['tourab', 'tirage', 'raml', 'khatt'] },
      { icon: <Hash {...ICON} />, label: 'Hatims', desc: 'Carrés numériques (Al Kanzou), export Word', href: '/wafq/carre', keywords: ['carre magique', 'kanzou', 'wafq', 'carres numeriques'] },
      // Wafq (générateur par intention) et Thalsams — masqués temporairement
      // à la demande de l'utilisateur (2026-09-02). Pages /wafq et /thalsams
      // toujours en place ; /wafq garde son lien interne vers Hatims.
    ],
  },
  {
    slug: 'ressources',
    title: 'Ressources',
    icon: <BookOpen {...CAT_ICON} />,
    items: [
      { icon: <BookOpen {...ICON} />, label: 'Bibliothèque', desc: 'Lire des livres et manuscrits', href: '/bibliotheque', keywords: ['livres', 'manuscrits', 'almaqtab', 'lecture'] },
      { icon: <Scroll {...ICON} />, label: 'Secret Mystique', desc: 'Consulter des secrets et invocations', href: '/asrar', keywords: ['asrar', 'sirr', 'secrets', 'invocations'] },
    ],
  },
  {
    slug: 'outils',
    title: 'Outils',
    icon: <Sparkles {...CAT_ICON} />,
    items: [
      { icon: <Calculator {...ICON} />, label: 'Abajad', desc: 'Calculer le poids numérique des lettres arabes', href: '/abajad', keywords: ['abjad', 'numerologie', 'lettres', 'poids'] },
      { icon: <Sparkles {...ICON} />, label: 'Combinaisons', desc: 'Associer les 99 Noms par calcul', href: '/combinaisons', keywords: ['associations', 'calcul', '99 noms'] },
      { icon: <Globe {...ICON} />, label: 'Planète', desc: "Voir l'heure planétaire du moment", href: '/planete', keywords: ['heure planetaire', 'mars', 'mercure', 'astrologie'] },
      { icon: <Gift {...ICON} />, label: 'Parrainage', desc: 'Inviter des proches, gagner un abonnement', href: '/parrainage', keywords: ['inviter', 'filleul', 'abonnement', 'referral'] },
      // Tafsir al-Ahlam et Formation mystique — masqués temporairement à la
      // demande de l'utilisateur (2026-09-02), pages toujours en place.
    ],
  },
];

/** Tous les modules, à plat — pour la recherche et pour résoudre un href
 *  (favoris/récents) en tuile complète. */
export const ALL_MODULES: ModuleTile[] = CATEGORIES.flatMap((c) => c.items);

export function findCategory(slug: string): ModuleCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** Catégorie d'un module, pour situer un résultat de recherche. */
export function categoryOf(href: string): ModuleCategory | undefined {
  return CATEGORIES.find((c) => c.items.some((it) => it.href === href));
}
