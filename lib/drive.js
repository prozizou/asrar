'use client';
// lib/drive.js — Ouverture directe d'un document hébergé sur Google Drive.
// Un lien de partage Drive classique (…/file/d/<ID>/view ou …/open?id=<ID>)
// mène d'abord à la page de prévisualisation web de Google (bouton à
// retaper pour ouvrir/télécharger) au lieu d'ouvrir directement le fichier —
// retour utilisateur : « pas besoin d'ouvrir un lien ». On extrait l'ID du
// fichier et on construit le lien de contenu direct (uc?export=view), qui
// sert le fichier lui-même : le navigateur/l'app Drive l'ouvre aussitôt.
export function driveDirectLink(url) {
  const u = String(url || '').trim();
  if (!u || !/drive\.google\.com/.test(u)) return u; // pas un lien Drive → inchangé
  const m = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return u; // format Drive non reconnu → inchangé, on ne casse rien
  return `https://drive.google.com/uc?export=view&id=${m[1]}`;
}
