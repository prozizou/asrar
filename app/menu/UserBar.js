'use client';
// App bar compacte de /menu (56-64px) — fusionne ce qui était trois zones
// empilées (bouton « Retour » desktop mis à part : l'ancien <div class=
// "user-bar"> avatar+menu+déconnexion, PUIS un <div class="header"> séparé
// avec le titre « Menu » et son sous-titre) en UNE seule ligne : logo à
// gauche, titre au centre, profil/menu/déconnexion à droite (revue design :
// « le header est assez volumineux et ses trois zones manquent d'une
// logique visuelle immédiatement évidente »). Seule partie de /menu qui a
// besoin d'état client (useAuth) — extraite du reste de la page (statique)
// pour que celle-ci reste un composant serveur, cf. app/menu/page.tsx.
import { useAuth } from '@/components/AuthProvider';
import AppDrawer from '@/components/AppDrawer';
import SmartImage from '@/components/SmartImage';

export default function UserBar() {
  const { user, signOut } = useAuth();
  const name = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Utilisateur');

  return (
    <div className="menu-appbar">
      <span className="menu-appbar-logo" aria-hidden="true">✦</span>
      <h1 className="menu-appbar-title">Menu</h1>
      <div className="menu-appbar-actions">
        <div className="avatar avatar-sm" title={user?.email || name} aria-label={name}>
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
        </div>
        <AppDrawer />
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
