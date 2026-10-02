'use client';
// lib/googleNative.js — Connexion Google NATIVE dans l'app Android
// (coquille Capacitor, capacitor.config.ts). Même schéma que lib/fcmNative.js :
// imports dynamiques, rien ne s'exécute sur le site web normal
// (Capacitor.isNativePlatform() y est faux).
//
// Pourquoi : dans la WebView, signInWithPopup échoue et signInWithRedirect
// part vers asrar-bc059.firebaseapp.com — hôte hors de server.url, donc
// ouvert dans Chrome — puis revient sans le sessionStorage d'origine
// (« Unable to process request due to missing initial state »). Google
// refuse de toute façon l'OAuth dans une WebView intégrée
// (disallowed_useragent). On passe donc par le Credential Manager Android
// (@capgo/capacitor-social-login), qui renvoie un idToken Google, puis on
// connecte Firebase avec signInWithCredential — même compte Firebase que sur
// le web.
//
// Côté Google Cloud / Firebase : un client OAuth « Android » doit exister
// pour le package com.Asrar avec l'empreinte SHA-1 de CHAQUE clé qui signe
// l'app installée (clé d'importation ET clé de signature Play App Signing),
// sinon Credential Manager répond « [28444] Developer console is not set up
// correctly ». Voir ANDROID.md.

import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

// Client OAuth « Web » du projet Firebase asrar-bc059 (celui qu'utilise déjà
// signInWithPopup) — l'idToken natif doit être émis pour ce client pour que
// Firebase l'accepte. Identifiant public, pas un secret.
const WEB_CLIENT_ID = '199810893447-273t2o0prru5qf16tt19l2npotgfq0fo.apps.googleusercontent.com';

let initPromise = null;

/**
 * Vrai uniquement dans l'app Android/iOS Capacitor. SYNCHRONE exprès : le
 * bridge Capacitor injecte window.Capacitor dans la WebView avant le
 * chargement de la page, et un `await` avant signInWithPopup ferait perdre
 * le geste utilisateur sur le web (popup bloquée).
 */
export function isNativeApp() {
  try {
    return typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

async function getSocialLogin() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  if (!initPromise) {
    initPromise = SocialLogin.initialize({ google: { webClientId: WEB_CLIENT_ID, mode: 'online' } }).catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  await initPromise;
  return SocialLogin;
}

/**
 * Sélecteur de compte Google natif puis connexion Firebase.
 * Lève une erreur (avec .code façon Firebase quand c'est possible).
 */
export async function signInWithGoogleNative(auth) {
  const SocialLogin = await getSocialLogin();
  let res;
  try {
    res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
  } catch (e) {
    const msg = String((e && e.message) || e || '');
    const err = new Error(msg);
    err.code = /cancel/i.test(msg) ? 'auth/popup-closed-by-user' : 'auth/native-google-failed';
    throw err;
  }
  const idToken = res && res.result && res.result.idToken;
  if (!idToken) {
    const err = new Error('idToken Google absent');
    err.code = 'auth/native-google-failed';
    throw err;
  }
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

/** Déconnexion du compte Google natif (best-effort, ne lève jamais). */
export async function signOutGoogleNative() {
  try {
    if (!isNativeApp()) return;
    const SocialLogin = await getSocialLogin();
    await SocialLogin.logout({ provider: 'google' });
  } catch {}
}
