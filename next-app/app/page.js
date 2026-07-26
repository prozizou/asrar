'use client';
// Tableau de bord (accueil) — port de accueil/accueil.html.
// Une seule coquille : la barre utilisateur, le thème et l'accès sont déjà
// montés par les Providers. Les modules DÉJÀ migrés sont des liens SPA
// instantanés (next/link) ; ceux encore sur le site statique pointent vers le
// déploiement en service (NEXT_PUBLIC_STATIC_BASE) le temps de la transition.
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

// Base du site statique historique (modules pas encore migrés). Par défaut : la
// production. À la fin de la migration, ces entrées deviendront des liens SPA.
const STATIC_BASE = process.env.NEXT_PUBLIC_STATIC_BASE || 'https://asrar-hub.vercel.app';

const GROUPS = [
  {
    title: 'ASRAR PRO',
    items: [
      { icon: '📜', label: 'Secret Mystique', href: '/asrar' },
      { icon: '🤲', label: 'Don de secret', href: '/don' },
      { icon: '🔢', label: 'Abajad', href: '/abajad' },
      { icon: '🌍', label: 'Planète', href: '/planete' },
      { icon: '✨', label: 'Combinaisons', href: '/combinaisons' },
      { icon: '🕌', label: "Noms d'Allah", href: '/benefits' },
      { icon: '🌀', label: 'Rouwhanes', href: '/rouwhania' },
      { icon: '📚', label: 'Bibliothèque', href: '/bibliotheque' },
      { icon: '🛒', label: 'Marché Mystique', href: '/marche' },
      { icon: '🏪', label: 'Ma Boutique', href: '/boutique' },
      { icon: '🎁', label: 'Parrainage', href: '/parrainage' },
    ],
  },
  {
    title: 'Al Qalam',
    items: [{ icon: '🖋️', label: 'Al Qalam', href: `${STATIC_BASE}/alqalam/index.html?mode=simple`, external: true }],
  },
  {
    title: 'Géomancie',
    items: [{ icon: '🪨', label: 'Tourab', href: `${STATIC_BASE}/geomancie/tourab.html`, external: true }],
  },
];

function MenuItem({ item }) {
  const inner = (
    <>
      <div style={{ fontSize: '2rem' }}>{item.icon}</div>
      <h3>{item.label}</h3>
    </>
  );
  if (item.external) {
    return (
      <a href={item.href} className="menu-item">
        {inner}
      </a>
    );
  }
  return (
    <Link href={item.href} className="menu-item">
      {inner}
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
        <button className="signout-btn" onClick={signOut} title="Déconnexion" aria-label="Déconnexion">
          ⏻
        </button>
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
