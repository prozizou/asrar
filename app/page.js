'use client';
// Tableau de bord (accueil) — port de accueil/accueil.html.
// Une seule coquille : la barre utilisateur, le thème et l'accès sont déjà
// montés par les Providers. TOUS les modules sont désormais migrés : chaque
// entrée est un lien SPA instantané (next/link) — plus aucun rechargement de
// page complet ni renvoi vers le site statique.
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import PushToggle from '@/components/PushToggle';
import AppDrawer from '@/components/AppDrawer';

const GROUPS = [
  {
    title: 'ASRAR PRO',
    items: [
      { icon: '📜', label: 'Secret Mystique', href: '/asrar' },
      { icon: '🔢', label: 'Abajad', href: '/abajad' },
      { icon: '🌍', label: 'Planète', href: '/planete' },
      { icon: '✨', label: 'Combinaisons', href: '/combinaisons' },
      { icon: '🕌', label: "Noms d'Allah", href: '/benefits' },
      { icon: '🌀', label: 'Rouwhanes', href: '/rouwhania' },
      { icon: '📚', label: 'Bibliothèque', href: '/bibliotheque' },
      { icon: '🛒', label: 'Marché Mystique', href: '/marche' },
      { icon: '🎁', label: 'Parrainage', href: '/parrainage' },
    ],
  },
  {
    title: 'Al Qalam',
    items: [{ icon: '🖋️', label: 'Al Qalam', href: '/alqalam' }],
  },
  {
    title: 'Géomancie',
    items: [{ icon: '🪨', label: 'Tourab', href: '/geomancie' }],
  },
];

function MenuItem({ item }) {
  return (
    <Link href={item.href} className="menu-item">
      <div style={{ fontSize: '2rem' }}>{item.icon}</div>
      <h3>{item.label}</h3>
    </Link>
  );
}

export default function Home() {
  const { user, signOut } = useAuth();
  const name = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Utilisateur');

  return (
    <div className="container">
      {/* Barre utilisateur */}
      <div className="user-bar">
        <div className="user-info">
          <div className="avatar">
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
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
          <PushToggle />
          <AppDrawer />
          <button className="signout-btn" onClick={signOut} title="Déconnexion" aria-label="Déconnexion">
            ⏻
          </button>
        </div>
      </div>

      <div className="header">
        <h1>ASRAR PRO</h1>
        <p style={{ color: 'var(--text-muted)' }}>Tableau de bord</p>
      </div>

      {GROUPS.map((g) => (
        <section className="menu-group" key={g.title}>
          <h2 className="group-title">{g.title}</h2>
          <div className="sub-grid">
            {g.items.map((it) => (
              <MenuItem item={it} key={it.label} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
