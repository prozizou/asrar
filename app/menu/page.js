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

      {/* Barre utilisateur (ex-accueil) : compte, thème, déconnexion */}
      <div className="user-bar">
        <div className="user-info">
          <div className="avatar">
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
          <div>
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AppDrawer />
          <button className="signout-btn" onClick={signOut} title="Déconnexion" aria-label="Déconnexion">
            ⏻
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
