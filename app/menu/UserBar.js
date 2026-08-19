'use client';
// Barre utilisateur (ex-accueil) : compte, thème (AppDrawer), déconnexion.
// Seule partie de /menu qui a besoin d'état client (useAuth) — extraite du
// reste de la page (statique : liste des modules) pour que celle-ci reste un
// composant serveur, cf. le commentaire d'en-tête de app/menu/page.js.
import { useAuth } from '@/components/AuthProvider';
import AppDrawer from '@/components/AppDrawer';
import SmartImage from '@/components/SmartImage';

export default function UserBar() {
  const { user, signOut } = useAuth();
  const name = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Utilisateur');

  return (
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
  );
}
