'use client';
// Menu — liste des modules de l'app (hors Marché Mystique, désormais la page
// d'accueil, cf. app/page.js). Accessible via le bouton « ☰ Accéder au menu »
// de l'accueil. Chaque tuile porte une courte description en clair : plusieurs
// noms de modules sont des termes du domaine (Abajad, Rouwhanes, Tourab…) que
// quelqu'un de nouveau ne devine pas avant d'avoir cliqué.
//
// Porte aussi les contrôles de compte (avatar, thème, déconnexion) : ils
// vivaient sur l'accueil avant que celui-ci ne devienne le Marché, épuré
// depuis de tout ce qui n'est pas la liste des vendeurs/produits.
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import AppDrawer from '@/components/AppDrawer';
import SmartImage from '@/components/SmartImage';

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
  const { user, signOut } = useAuth();
  const name = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Utilisateur');

  return (
    <div className="container">
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      {/* Barre utilisateur (ex-accueil) : compte, thème, déconnexion.
          Deux groupes bien dissociés (séparateur vertical) : à gauche le
          profil (avatar seul, plus de nom/e-mail affichés) + le menu ; à
          droite, seul, le bouton de déconnexion. */}
      <div className="user-bar">
        <div className="user-bar-left">
          <div className="avatar" title={user?.email || name} aria-label={name}>
            {user?.photoURL ? (
              <SmartImage
                src={user.photoURL}
                alt=""
                fill
                sizes="42px"
                referrerPolicy="no-referrer"
                style={{ objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
          <AppDrawer />
        </div>
        <div className="user-bar-right">
          <button className="signout-btn" onClick={signOut} title="Déconnexion" aria-label="Déconnexion">
            {/* Icône SVG (fiable sur tous les appareils) plutôt que le
                glyphe Unicode ⏻, absent de certaines polices système →
                s'affichait comme un carré vide ("tofu"). */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="header">
        <h1>Menu</h1>
        <p style={{ color: 'var(--text-muted)' }}>Tous les modules</p>
      </div>

      <section className="menu-group">
        <div className="sub-grid">
          {MODULES.map((it) => (
            <MenuItem item={it} key={it.label} />
          ))}
        </div>
      </section>
    </div>
  );
}
