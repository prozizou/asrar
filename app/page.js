'use client';
// Tableau de bord (accueil) — port de accueil/accueil.html.
// Une seule coquille : la barre utilisateur, le thème et l'accès sont déjà
// montés par les Providers. TOUS les modules sont désormais migrés : chaque
// entrée est un lien SPA instantané (next/link) — plus aucun rechargement de
// page complet ni renvoi vers le site statique.
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import AppDrawer from '@/components/AppDrawer';
import SmartImage from '@/components/SmartImage';

// Un seul groupe : Al Qalam et Géomancie formaient chacun un « groupe » d'un
// seul élément, ce qui suggérait une hiérarchie inexistante sans rien
// apporter. Chaque module porte une courte description en clair — la plupart
// des noms (Abajad, Rouwhanes, Tourab…) sont des termes du domaine que les
// nouveaux venus ne devinent pas au premier coup d'œil.
const MODULES = [
  { icon: '📜', label: 'Secret Mystique', desc: 'Consulter des secrets et invocations', href: '/asrar' },
  { icon: '🔢', label: 'Abajad', desc: 'Calculer le poids numérique des lettres arabes', href: '/abajad' },
  { icon: '🌍', label: 'Planète', desc: "Voir l'heure planétaire du moment", href: '/planete' },
  { icon: '✨', label: 'Combinaisons', desc: 'Associer les 99 Noms par calcul', href: '/combinaisons' },
  { icon: '🕌', label: "Noms d'Allah", desc: "Découvrir les 99 Noms d'Allah", href: '/benefits' },
  { icon: '🌀', label: 'Rouwhanes', desc: 'Générer des noms d\'anges et un vœu', href: '/rouwhania' },
  { icon: '📚', label: 'Bibliothèque', desc: 'Lire des livres et manuscrits', href: '/bibliotheque' },
  { icon: '🛒', label: 'Marché Mystique', desc: 'Acheter auprès de vendeurs vérifiés', href: '/marche' },
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
        <h1>ASRAR PRO</h1>
        <p style={{ color: 'var(--text-muted)' }}>Tableau de bord</p>
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
