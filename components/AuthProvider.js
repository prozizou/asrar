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
import { auth } from '@/lib/firebase';
import { captureRef, claimRef } from '@/lib/share';

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

function LoginScreen({ onLogin, status, error }) {
  return (
    <div className="login-screen">
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <div className="header">
            <h1>ASRAR PRO</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Les noms d'Allah &amp; géométrie mystique</p>
          </div>
          <button
            className="google-btn"
            onClick={onLogin}
            style={{
              background: 'rgba(255,255,255,.12)',
              border: '1px solid rgba(255,255,255,.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.6 2.5 30.2 0 24 0 14.7 0 6.7 5.4 2.7 13.4l7.8 6C12.4 13 17.8 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.9 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.9c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.3-10.1 7.3-17.4z" />
              <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8-6z" />
              <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.6-5.9c-2.1 1.4-4.8 2.2-7.6 2.2-6.2 0-11.5-4.2-13.4-9.8l-8 6.2C6.7 42.6 14.7 48 24 48z" />
            </svg>
            Continuer avec Google
          </button>
          <p style={{ marginTop: 14, fontSize: '.9rem', color: 'var(--text-muted)', minHeight: 20 }}>{status}</p>
          <p style={{ marginTop: 6, fontSize: '.9rem', color: '#ff6b6b', minHeight: 20 }}>{error}</p>
        </div>
      </div>
    </div>
  );
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
