// Capture PARTAGÉE de l'événement PWA `beforeinstallprompt` — un seul
// listener global, posé une fois au chargement du module (indépendant du
// montage d'un composant particulier), pour que n'importe quel bouton de
// l'app (drawer, écran de gate…) puisse déclencher l'invite d'installation
// native sans dupliquer la logique de capture.
//
// `beforeinstallprompt` n'existe que sur Chromium/Android (pas iOS Safari,
// pas Firefox desktop) : sur ces navigateurs, `canInstall` restera toujours
// false — c'est normal, pas un bug (voir isIOS ci-dessous pour le repli).
const listeners = new Set();
let deferred = null;
let installed = false;

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // on gère nous-mêmes QUAND l'afficher (bouton du menu).
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true
  );
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

export function getInstallState() {
  return { canInstall: !!deferred, installed };
}

// S'abonne aux changements (prompt capté, app installée…). Renvoie la
// fonction de désabonnement — à appeler dans le cleanup d'un useEffect.
export function subscribeInstallState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Déclenche la boîte de dialogue native d'installation. Renvoie false si
// aucune invite n'a été captée (navigateur non supporté, ou déjà utilisée).
export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  try {
    await deferred.userChoice;
  } catch {
    /* dialogue fermé/ignoré par l'utilisateur */
  }
  deferred = null;
  notify();
  return true;
}
