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
// serveur) sont d'abord résolus en adresse wa.me (format=json, pages/api/wa.js),
// puis ouverts dans l'application WhatsApp (whatsapp://, voir whatsappAppUrl).

export function isNativeApp() {
  try { return !!(/** @type {any} */ (window)).Capacitor?.isNativePlatform?.(); } catch { return false; }
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

// Lien WhatsApp web (wa.me/<numéro>?text=…, api.whatsapp.com/send?phone=…)
// → lien de l'application WhatsApp (whatsapp://send?phone=…&text=…). Ouvert
// en https, Android confiait parfois wa.me au navigateur intégré, qui affichait
// la page « Ouvrir l'application / Télécharger » de WhatsApp (et abîmait les
// emojis du message) au lieu d'ouvrir directement la discussion préremplie.
export function whatsappAppUrl(href) {
  let url;
  try { url = new URL(href); } catch { return null; }
  if (url.protocol !== 'https:' || !['wa.me', 'api.whatsapp.com'].includes(url.hostname)) return null;
  const phone = (url.hostname === 'wa.me' ? url.pathname.slice(1) : url.searchParams.get('phone') || '').replace(/\D/g, '');
  const text = url.searchParams.get('text') || '';
  const params = [];
  if (phone) params.push('phone=' + phone);
  if (text) params.push('text=' + encodeURIComponent(text));
  return 'whatsapp://send' + (params.length ? '?' + params.join('&') : '');
}

// Délai avant le repli sur le lien web si WhatsApp ne s'est pas ouvert
// (application absente : Android ne trouve aucune application pour whatsapp://).
const WHATSAPP_FALLBACK_MS = 2500;

// Ouvre WhatsApp directement ; si l'application ne passe pas au premier plan
// (page toujours visible et active après le délai), ouvre le lien web à la place.
function openWhatsAppApp(appUrl, webUrl) {
  let done = false;
  const cleanup = () => {
    done = true;
    window.removeEventListener('blur', cleanup);
    window.removeEventListener('pagehide', cleanup);
    document.removeEventListener('visibilitychange', onVisibility);
  };
  const onVisibility = () => { if (document.visibilityState === 'hidden') cleanup(); };
  window.addEventListener('blur', cleanup);
  window.addEventListener('pagehide', cleanup);
  document.addEventListener('visibilitychange', onVisibility);
  setTimeout(() => {
    if (done) return;
    cleanup();
    window.location.href = webUrl;
  }, WHATSAPP_FALLBACK_MS);
  window.location.href = appUrl;
}

/** Ouvre le lien dans l'application externe (Android) ; à utiliser dans l'application seulement. */
export async function openExternalInApp(value) {
  const target = await resolveExternalUrl(value);
  const appUrl = whatsappAppUrl(target);
  if (appUrl) openWhatsAppApp(appUrl, target);
  else window.location.href = target;
}

/**
 * Gestionnaire de clic pour un lien <a href="https://wa.me/…" target="_blank"> :
 * sur le site, le lien s'ouvre normalement ; dans l'application, il ouvre
 * directement WhatsApp (openExternalInApp).
 */
export function handleExternalLinkClick(event, href) {
  if (!isNativeApp()) return;
  event.preventDefault();
  openExternalInApp(href).catch(() => { window.location.href = href; });
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
