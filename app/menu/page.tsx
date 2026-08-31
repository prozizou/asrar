// Menu — liste des modules de l'app (hors Marché Mystique, désormais la page
// d'accueil, cf. app/page.js). Accessible via le bouton « ☰ Accéder au menu »
// de l'accueil. Chaque tuile porte une courte description en clair : plusieurs
// noms de modules sont des termes du domaine (Abajad, Rouwhanes, Tourab…) que
// quelqu'un de nouveau ne devine pas avant d'avoir cliqué.
//
// Composant SERVEUR (pas de 'use client') : la liste des modules est
// statique, aucun état/hook ici. Seuls les contrôles de compte (avatar,
// thème, déconnexion — ex-accueil) ont besoin de useAuth() côté client :
// extraits dans UserBar.js pour ne pas faire basculer toute la page côté
// client (réduit le JS envoyé au navigateur pour cette route — cf. ANALYSE.md,
// faiblesse « surface use client »).
//
// Première page convertie en TypeScript (pilote de la conversion .js → .tsx,
// une poignée de pages à la fois — voir tsconfig.json) : simple et sans état,
// choisie pour valider toute la chaîne (build, lint, CI) à faible risque avant
// de convertir les pages plus grosses. UserBar.js et PlanetHourWidget.js
// restent en .js pour l'instant — leurs props sont donc typées `any` de facto
// ici, sans erreur (allowJs, cf. tsconfig.json) : ce sera resserré quand leur
// tour de conversion viendra.
import Link from 'next/link';
import UserBar from './UserBar';
import PlanetHourWidget from '@/components/PlanetHourWidget';

interface ModuleTile {
  icon: string;
  label: string;
  desc: string;
  href: string;
}

const MODULES: ModuleTile[] = [
  { icon: '📜', label: 'Secret Mystique', desc: 'Consulter des secrets et invocations', href: '/asrar' },
  { icon: '🔢', label: 'Abajad', desc: 'Calculer le poids numérique des lettres arabes', href: '/abajad' },
  { icon: '🌍', label: 'Planète', desc: "Voir l'heure planétaire du moment", href: '/planete' },
  { icon: '✨', label: 'Combinaisons', desc: 'Associer les 99 Noms par calcul', href: '/combinaisons' },
  { icon: '🕌', label: "Noms d'Allah", desc: "Découvrir les 99 Noms d'Allah", href: '/benefits' },
  { icon: '🤲', label: 'Zikr collectif', desc: 'Réciter un dhikr ensemble vers un objectif commun', href: '/zikr' },
  { icon: '🌀', label: 'Rouwhanes', desc: 'Générer des noms d\'anges et un vœu', href: '/rouwhania' },
  { icon: '📚', label: 'Bibliothèque', desc: 'Lire des livres et manuscrits', href: '/bibliotheque' },
  { icon: '🎓', label: 'Formation mystique', desc: 'Ateliers en direct par visioconférence', href: '/formation' },
  { icon: '🎁', label: 'Parrainage', desc: 'Inviter des proches, gagner un abonnement', href: '/parrainage' },
];

// Modules réservés au palier « 1 An » (PREMIUM_LEVEL) — regroupés à part pour
// les distinguer visuellement du reste des modules (cf. app/globals.css
// .group-title / .menu-group).
const MODULES_PREMIUM: ModuleTile[] = [
  { icon: '🖋️', label: 'Al Qalam', desc: 'Écrire un verset en calligraphie', href: '/alqalam' },
  { icon: '🪨', label: 'Géomancie', desc: 'Faire un tirage géomantique (Tourab)', href: '/geomancie' },
];

function MenuItem({ item }: { item: ModuleTile }) {
  return (
    <Link href={item.href} className="menu-item">
      <div style={{ fontSize: '2rem' }}>{item.icon}</div>
      <h3>{item.label}</h3>
      <p className="menu-item-desc">{item.desc}</p>
    </Link>
  );
}

export default function MenuPage() {
  return (
    <div className="container">
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <UserBar />

      <div className="header">
        <h1>Menu</h1>
        <p style={{ color: 'var(--text-muted)' }}>Tous les modules</p>
      </div>

      <section className="menu-group">
        <div className="sub-grid">
          {/* Widget live (position GPS/repli, calcul lib/planete.js) : composant
              client isolé — n'affecte pas le rendu serveur du reste de la page. */}
          <PlanetHourWidget />
          {MODULES.map((it) => (
            <MenuItem item={it} key={it.label} />
          ))}
        </div>
      </section>

      {/* Al Qalam & Géomancie : dissociés des autres modules dans une section
          dédiée (modules du palier « 1 An »). */}
      <section className="menu-group">
        <h2 className="group-title">Al Qalam &amp; Géomancie</h2>
        <div className="sub-grid">
          {MODULES_PREMIUM.map((it) => (
            <MenuItem item={it} key={it.label} />
          ))}
        </div>
      </section>
    </div>
  );
}
