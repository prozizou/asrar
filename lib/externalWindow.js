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
// serveur) sont d'abord résolus en adresse api.whatsapp.com/send (format=json,
// pages/api/wa.js), puis ouverts dans l'application WhatsApp (whatsapp://, voir
// whatsappAppUrl) ; le lien web n'est proposé qu'en secours, sur action.
//
// Site ouvert dans un navigateur Android (Chrome, application web installée) :
// un nouvel onglet vers la page web de WhatsApp n'ouvrait pas WhatsApp (onglet
// intégré de l'application web, page « Ouvrir l'application »). WhatsApp est
// lancé directement par un lien intent:// dans la page courante, avec la page
// web en adresse de secours si WhatsApp n'est pas installé (whatsappIntentUrl).

// Adresse web WhatsApp acceptée (api.whatsapp.com/send ou wa.me).
function isWhatsAppWebUrl(href) {
  return /^https:\/\/(api\.whatsapp\.com\/send\b|wa\.me\/)/.test(href);
}

// Lien vers WhatsApp à résoudre (/api/wa du site) ou déjà résolu.
function isWhatsAppLink(value) {
  try {
    const url = new URL(value, window.location.origin);
    return (url.origin === window.location.origin && url.pathname === '/api/wa') || isWhatsAppWebUrl(url.href);
  } catch { return false; }
}

/** Site ouvert dans un navigateur Android (pas l'application). */
export function isAndroidWeb() {
  try { return !isNativeApp() && /Android/i.test(navigator.userAgent || ''); } catch { return false; }
}

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
  if (!res.ok || !isWhatsAppWebUrl(target)) throw new Error('Le contact WhatsApp est indisponible. Réessayez plus tard.');
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

// Lien intent:// (Chrome, Samsung Internet, Firefox sur Android) : ouvre
// WhatsApp (ou WhatsApp Business) avec la discussion préremplie, sinon la page
// web de secours (browser_fallback_url).
export function whatsappIntentUrl(webUrl) {
  const appUrl = whatsappAppUrl(webUrl);
  if (!appUrl) return null;
  return 'intent://send' + appUrl.slice('whatsapp://send'.length)
    + '#Intent;scheme=whatsapp;S.browser_fallback_url=' + encodeURIComponent(webUrl) + ';end';
}

// Délai avant de proposer le lien web si WhatsApp ne semble pas s'être ouvert.
const WHATSAPP_FALLBACK_MS = 2500;
const FALLBACK_ID = 'asrar-whatsapp-fallback';
// Une seule tentative suivie à la fois : un nouveau clic remplace la précédente.
let pendingAttempt = null;

function removeWhatsAppFallback() {
  document.getElementById(FALLBACK_ID)?.remove();
}

// Bandeau « WhatsApp ne s'est pas ouvert ? » : le lien web n'est JAMAIS ouvert
// automatiquement. L'application ne met pas la page en pause quand WhatsApp
// passe au premier plan : un repli automatique se déclenchait donc pendant que
// WhatsApp était ouvert, et l'on retrouvait la page web de WhatsApp au retour.
function showWhatsAppFallback(webUrl, label = 'Ouvrir dans le navigateur') {
  removeWhatsAppFallback();
  const box = document.createElement('div');
  box.id = FALLBACK_ID;
  box.setAttribute('role', 'alert');
  box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(16px + var(--sab, 0px));z-index:99999;'
    + 'display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;'
    + 'background:var(--glass-bg, #1c1c1e);color:var(--text-main, #f4f4f5);border:1px solid var(--border, rgba(255,255,255,.12));'
    + 'box-shadow:0 8px 24px rgba(0,0,0,.35);font:14px/1.4 var(--font-ui, system-ui, sans-serif);';
  const text = document.createElement('span');
  text.textContent = 'WhatsApp ne s’est pas ouvert ?';
  text.style.cssText = 'flex:1 1 160px;';
  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = label;
  open.style.cssText = 'width:auto;margin:0;min-height:40px;padding:8px 12px;border:0;border-radius:10px;'
    + 'background:var(--accent, #fb923c);color:var(--button-ink, #1a1209);font:inherit;font-weight:700;cursor:pointer;';
  open.addEventListener('click', () => { removeWhatsAppFallback(); window.location.href = webUrl; });
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Fermer');
  close.textContent = '×';
  close.style.cssText = 'width:40px;height:40px;margin:0;padding:0;border:0;border-radius:10px;background:transparent;'
    + 'color:inherit;font-size:22px;line-height:1;cursor:pointer;';
  close.addEventListener('click', removeWhatsAppFallback);
  box.append(text, open, close);
  // Une fenêtre modale ouverte (fiche produit…) rend le reste de la page
  // inerte : le bandeau doit alors vivre dans cette fenêtre pour être cliquable.
  const modals = Array.from(document.querySelectorAll('dialog[open]')).filter((d) => {
    try { return d.matches(':modal'); } catch { return true; }
  });
  (modals[modals.length - 1] || document.body).appendChild(box);
  setTimeout(removeWhatsAppFallback, 15000);
}

// Ouvre WhatsApp directement. Si la page reste visible et active après le
// délai (WhatsApp absent), propose le lien web sans l'ouvrir d'office.
function openWhatsAppApp(appUrl, webUrl, fallbackLabel) {
  pendingAttempt?.();
  let done = false;
  let timer = /** @type {ReturnType<typeof setTimeout> | undefined} */ (undefined);
  const cleanup = () => {
    done = true;
    clearTimeout(timer);
    if (pendingAttempt === cleanup) pendingAttempt = null;
    window.removeEventListener('blur', cleanup);
    window.removeEventListener('pagehide', cleanup);
    document.removeEventListener('visibilitychange', onVisibility);
  };
  const onVisibility = () => { if (document.visibilityState === 'hidden') { cleanup(); removeWhatsAppFallback(); } };
  window.addEventListener('blur', cleanup);
  window.addEventListener('pagehide', cleanup);
  document.addEventListener('visibilitychange', onVisibility);
  pendingAttempt = cleanup;
  timer = setTimeout(() => {
    if (done) return;
    cleanup();
    if (document.visibilityState === 'visible' && document.hasFocus()) showWhatsAppFallback(webUrl, fallbackLabel);
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
 * Site sur Android : ouvre WhatsApp par intent:// dans la page courante (le
 * geste de l'utilisateur reste valable quelques secondes après le clic, le
 * temps de résoudre /api/wa). Si la page reste affichée (lancement refusé),
 * le bandeau propose de réessayer avec un nouveau geste.
 */
export async function openWhatsAppOnAndroidWeb(value) {
  const target = await resolveExternalUrl(value);
  const intentUrl = whatsappIntentUrl(target);
  if (!intentUrl) { window.location.href = target; return; }
  openWhatsAppApp(intentUrl, intentUrl, 'Ouvrir WhatsApp');
}

/**
 * Gestionnaire de clic pour un lien WhatsApp <a href="…" target="_blank"> :
 * ordinateur et iPhone l'ouvrent normalement (nouvel onglet) ; l'application
 * et le site sur Android ouvrent directement WhatsApp.
 */
export function handleExternalLinkClick(event, href) {
  if (isNativeApp()) {
    event.preventDefault();
    openExternalInApp(href).catch(() => { window.location.href = href; });
  } else if (isAndroidWeb() && isWhatsAppLink(href)) {
    event.preventDefault();
    openWhatsAppOnAndroidWeb(href).catch(() => { window.location.href = href; });
  }
}

/**
 * Fenêtre réservée pour un contact WhatsApp préparé par un appel API (demande
 * au Marché, recontact d'une commande) : sur le site Android, pas d'onglet —
 * WhatsApp s'ouvre directement (openWhatsAppOnAndroidWeb).
 */
export function reserveWhatsAppWindow() {
  if (isAndroidWeb()) return { navigate: (value) => openWhatsAppOnAndroidWeb(value), close() {} };
  return reserveExternalWindow();
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
