'use client';
// Contexte d'authentification — remplace requireAuth()/onAuthStateChanged
// répétés dans chaque page. Un seul point d'entrée : useAuth().
// Tant que l'utilisateur n'est pas connecté, on affiche l'écran de connexion
// Google (port de la logique de index.html), au lieu de rediriger en dur.
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
} from 'firebase/auth';
import { ChevronRight, Lock } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { captureRef, claimRef } from '@/lib/share';
import { ensurePushRegistration } from '@/lib/push';
import { ensureNativePushRegistration } from '@/lib/fcmNative';

const AuthCtx = createContext({ user: null, loading: true, signOut: () => {} });
export const useAuth = () => useContext(AuthCtx);

const ERR = {
  'auth/popup-closed-by-user': 'Connexion Google annulée.',
  'auth/popup-blocked': 'La fenêtre Google a été bloquée par le navigateur.',
  'auth/cancelled-popup-request': 'Connexion annulée.',
  'auth/network-request-failed': 'Problème de connexion réseau.',
  'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
};
const translateError = (code) => ERR[code] || 'Une erreur est survenue. (' + code + ')';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Capture du code de parrainage présent dans l'URL dès l'arrivée.
    captureRef();
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    getRedirectResult(auth).catch((e) => {
      if (e && e.code && e.code !== 'auth/no-auth-event') setError(translateError(e.code));
    });

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        try {
          localStorage.setItem('asrar_seen', '1');
        } catch {}
        claimRef(); // transmet le parrainage au serveur (une seule fois)
        trackVisit(u);
        ensurePush(); // abonne l'appareil aux push (une fois par chargement)
      }
    });
    return unsub;
  }, []);

  function loginGoogle() {
    setError('');
    setStatus('Connexion en cours…');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    signInWithPopup(auth, provider).catch((e) => {
      if (
        ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(
          e.code
        )
      ) {
        setStatus('Ouverture de Google…');
        signInWithRedirect(auth, provider).catch((err) => {
          setStatus('');
          setError(translateError(err.code));
        });
        return;
      }
      setStatus('');
      setError(translateError(e.code));
    });
  }

  const signOut = () => fbSignOut(auth);

  if (loading) {
    return (
      <div id="asrar-loader">
        <div className="asrar-spinner" />
        <span className="asrar-loader-text">Chargement…</span>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={loginGoogle} status={status} error={error} />;
  }

  return <AuthCtx.Provider value={{ user, loading, signOut }}>{children}</AuthCtx.Provider>;
}

// Marque Google officielle (4 couleurs) — réutilisée à deux tailles (badge
// d'en-tête, avatar de la carte compte) : centralisée ici pour ne pas
// dupliquer deux fois les mêmes tracés SVG.
function GoogleG({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.6 2.5 30.2 0 24 0 14.7 0 6.7 5.4 2.7 13.4l7.8 6C12.4 13 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.9 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.9c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.3-10.1 7.3-17.4z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8-6z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.6-5.9c-2.1 1.4-4.8 2.2-7.6 2.2-6.2 0-11.5-4.2-13.4-9.8l-8 6.2C6.7 42.6 14.7 48 24 48z" />
    </svg>
  );
}

// Bottom sheet de connexion (revue design : « moderniser en Bottom Sheet
// premium, mobile-first »). PUR HABILLAGE VISUEL — même prop `onLogin`
// (loginGoogle, inchangée), même logique `busy`/`status`/`error` qu'avant ;
// rien ici n'appelle Firebase/Google directement.
//
// « Choisir un compte » (le libellé du VRAI sélecteur Google) n'est pas
// repris tel quel : cet écran ne montre qu'UN SEUL bouton d'action (pas de
// liste de comptes mémorisés — Firebase ne l'expose pas, et il ne s'agit
// pas de le construire ici, changement de logique hors périmètre). Titre
// adapté en « Se connecter », la carte compte ci-dessous reprenant le
// même geste (taper pour continuer avec Google). Pas de bouton de
// fermeture : cet écran remplace ENTIÈREMENT l'app tant qu'il n'y a pas de
// session (AuthProvider ci-dessus) — aucune fonctionnalité un-authentifiée
// vers laquelle « fermer » ramènerait, un X purement décoratif aurait été
// trompeur.
function LoginScreen({ onLogin, status, error }) {
  // `status` ('Connexion en cours…' / 'Ouverture de Google…', voir
  // loginGoogle() ci-dessus) affiché DANS la carte (spinner + libellé qui
  // remplace « Continuer avec Google ») plutôt qu'en texte séparé en dessous :
  // l'ancien texte séparé laissait le bouton cliquable à l'identique pendant
  // la connexion, sans dire si un clic supplémentaire était nécessaire, sûr,
  // ou risquait d'ouvrir un second popup Google. `busy` la désactive aussi
  // (empêche le double-clic pendant que Firebase répond).
  const busy = !!status;
  return (
    <div className="login-screen">
      <div className="login-backdrop" aria-hidden="true" />
      <div className="login-sheet" role="dialog" aria-modal="true" aria-labelledby="login-sheet-title">
        <span className="login-sheet-handle" aria-hidden="true" />

        <div className="login-sheet-header">
          <span className="login-sheet-glogo" aria-hidden="true">
            <GoogleG size={20} />
          </span>
          <div className="login-sheet-heading">
            <h1 id="login-sheet-title">Se connecter</h1>
            <p>pour continuer sur Asrar Pro</p>
          </div>
        </div>

        <button type="button" className="login-account-card" onClick={onLogin} disabled={busy} aria-busy={busy}>
          <span className="login-account-avatar" aria-hidden="true">
            {busy ? <span className="google-btn-spinner" /> : <GoogleG size={22} />}
          </span>
          <span className="login-account-label">{busy ? status : 'Continuer avec Google'}</span>
          <ChevronRight className="login-account-chevron" size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        {!busy && !error && (
          <p className="login-secure-hint">
            <Lock size={12} strokeWidth={2.5} aria-hidden="true" /> Connexion sécurisée
          </p>
        )}
      </div>
    </div>
  );
}

// Abonnement push automatique après connexion (une seule fois par
// chargement de l'app — l'abonnement lui-même persiste ; inutile de le
// refaire à chaque rafraîchissement de jeton, qui redéclenche pourtant
// onAuthStateChanged). Voir lib/push.js ensurePushRegistration pour la
// logique fine (réabonnement silencieux si déjà autorisé, invite une seule
// fois sinon). Best-effort, jamais bloquant.
//
// ensureNativePushRegistration() (lib/fcmNative.js) s'ajoute EN PLUS, jamais
// à la place : c'est un no-op immédiat tant que l'app ne tourne pas dans la
// coquille Capacitor (Capacitor.isNativePlatform() false sur le site web) —
// un utilisateur peut donc avoir les deux canaux enregistrés à la fois
// (navigateur ET app Android installée).
let _pushEnsured = false;
function ensurePush() {
  if (_pushEnsured) return;
  _pushEnsured = true;
  ensurePushRegistration().catch(() => {});
  ensureNativePushRegistration().catch(() => {});
}

// Journalisation légère des visites (alimente le tableau de bord admin).
let _visitTracked = false;
function trackVisit(user) {
  if (_visitTracked || !user) return;
  _visitTracked = true;
  const page = window.location.pathname.split('/').filter(Boolean).pop() || 'accueil';
  user
    .getIdToken()
    .then((idToken) =>
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, type: 'visit', page }),
      })
    )
    .catch(() => {});
}
