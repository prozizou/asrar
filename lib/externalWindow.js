'use client';

// Ouvrir un lien hors du site (WhatsApp d'une boutique ou de l'assistance).
//
// Site : réserver un onglet pendant le geste utilisateur, puis y charger le
// lien après l'appel API. Le retour de window.open(..., 'noopener') ne permet
// pas de détecter un blocage ; on détache l'opener de l'onglet vide immédiatement.
//
// Application Android (Capacitor, qui charge ce même site) : la WebView ne crée
// pas de nouvelle fenêtre — window.open n'aboutissait pas, d'où les demandes
// WhatsApp qui ne partaient pas. Une navigation principale vers un AUTRE
// domaine, elle, est confiée à Android par Capacitor (WhatsApp, navigateur),
// et l'application reste sur sa page. Les liens /api/wa (numéro gardé côté
// serveur) sont d'abord résolus en adresse wa.me (format=json, pages/api/wa.js).

export function isNativeApp() {
  try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; }
}

async function resolveExternalUrl(value) {
  const url = new URL(value, window.location.origin);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Lien externe invalide.');
  if (url.origin !== window.location.origin || url.pathname !== '/api/wa') return url.href;
  url.searchParams.set('format', 'json');
  const res = await fetch(url.href, { credentials: 'same-origin', cache: 'no-store' });
  const data = await res.json().catch(() => null);
  const target = data && typeof data.url === 'string' ? data.url : '';
  if (!res.ok || !/^https:\/\/wa\.me\//.test(target)) throw new Error('Le contact WhatsApp est indisponible. Réessayez plus tard.');
  return target;
}

/** Ouvre le lien dans l'application externe (Android) ; à utiliser dans l'application seulement. */
export async function openExternalInApp(value) {
  window.location.href = await resolveExternalUrl(value);
}

export function reserveExternalWindow() {
  if (isNativeApp()) {
    // Rien à réserver : la navigation part après l'appel API, sans fenêtre.
    return { navigate: (value) => openExternalInApp(value), close() {} };
  }
  const popup = window.open('about:blank', '_blank');
  if (!popup) return null;
  popup.opener = null;
  return {
    navigate(value) {
      const url = new URL(value, window.location.origin);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Lien externe invalide.');
      if (popup.closed) throw new Error('La fenêtre a été fermée. Réessayez.');
      popup.location.replace(url.href);
    },
    close() { popup.close(); },
  };
}
