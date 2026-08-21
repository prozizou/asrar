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
import Link from 'next/link';
import UserBar from './UserBar';
import PlanetHourWidget from '@/components/PlanetHourWidget';

const MODULES = [
  { icon: '📜', label: 'Secret Mystique', desc: 'Consulter des secrets et invocations', href: '/asrar' },
  { icon: '🔢', label: 'Abajad', desc: 'Calculer le poids numérique des lettres arabes', href: '/abajad' },
  { icon: '🌍', label: 'Planète', desc: "Voir l'heure planétaire du moment", href: '/planete' },
  { icon: '✨', label: 'Combinaisons', desc: 'Associer les 99 Noms par calcul', href: '/combinaisons' },
  { icon: '🕌', label: "Noms d'Allah", desc: "Découvrir les 99 Noms d'Allah", href: '/benefits' },
  { icon: '🌀', label: 'Rouwhanes', desc: 'Générer des noms d\'anges et un vœu', href: '/rouwhania' },
  { icon: '📚', label: 'Bibliothèque', desc: 'Lire des livres et manuscrits', href: '/bibliotheque' },
  { icon: '🖋️', label: 'Al Qalam', desc: 'Écrire un verset en calligraphie', href: '/alqalam' },
  { icon: '🪨', label: 'Géomancie', desc: 'Faire un tirage géomantique (Tourab)', href: '/geomancie' },
  { icon: '🎁', label: 'Parrainage', desc: 'Inviter des proches, gagner un abonnement', href: '/parrainage' },
  { icon: '🧾', label: 'Mes commandes', desc: 'Retrouver vos commandes sur le Marché', href: '/commandes' },
];

function MenuItem({ item }) {
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
    </div>
  );
}
