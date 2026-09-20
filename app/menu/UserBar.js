'use client';
// En-tête compact du tableau de bord : logo — « Asrar Pro » — profil.
// Revue design : « header chargé : logo + Menu + avatar + hamburger +
// déconnexion → garder logo + titre + profil, déplacer déconnexion et
// options secondaires dans le menu profil ». L'avatar EST donc le bouton
// qui ouvre le panneau (AppDrawer), lequel porte désormais thème,
// installation, version ET déconnexion : une seule cible à droite au lieu
// de trois.
import { useAuth } from '@/components/AuthProvider';
import AppDrawer from '@/components/AppDrawer';
import SmartImage from '@/components/SmartImage';

export default function UserBar() {
  const { user } = useAuth();
  const name = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Utilisateur');

  return (
    <div className="menu-appbar">
      <span className="menu-appbar-logo" aria-hidden="true">✦</span>
      <h1 className="menu-appbar-title">Asrar Pro</h1>
      <AppDrawer
        triggerClassName="menu-appbar-profile"
        triggerLabel={`Profil et réglages — ${name}`}
        trigger={
          <span className="avatar avatar-sm" aria-hidden="true">
            {user?.photoURL ? (
              <SmartImage
                src={user.photoURL}
                alt=""
                fill
                sizes="32px"
                referrerPolicy="no-referrer"
                style={{ objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </span>
        }
      />
    </div>
  );
}
