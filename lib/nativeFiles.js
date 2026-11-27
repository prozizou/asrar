// lib/nativeFiles.js — Exports de fichiers dans l'application Android.
//
// La WebView Android ignore les deux mécanismes du navigateur utilisés par les
// exports : le lien <a download> sur une URL blob: (Word, jsPDF.save) et
// window.print() (PDF « classique » d'Al Qalam). Dans l'APK, ces actions ne
// faisaient donc rien. Le plugin AsrarNative (AsrarNativePlugin.java) fournit :
//   • saveFile  : enregistre le fichier dans Téléchargements/ASRAR PRO
//                 (Android 10+) et ouvre la feuille de partage Android ;
//   • printPage : ouvre l'impression Android (« Enregistrer au format PDF »).
// Un APK antérieur n'a pas ces méthodes : on retombe sur le comportement du
// navigateur (le site s'ouvre aussi dans Chrome, où il fonctionne).

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Le plugin Capacitor est un Proxy qui répond à TOUTE propriété, « then » comprise :
// le renvoyer tel quel depuis une fonction async le fait prendre pour une promesse,
// et Capacitor rejette alors avec « AsrarNative.then() is not implemented ». On
// l'enveloppe donc dans un objet (même précaution que lib/unityAds.js).
async function nativePlugin() {
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AsrarNative')) return null;
    return { plugin: registerPlugin('AsrarNative') };
  } catch {
    return null;
  }
}

// Aucun appel natif ne doit pouvoir bloquer l'interface : sans réponse du plugin,
// l'écran « Génération en cours » resterait affiché indéfiniment.
const SAVE_TIMEOUT_MS = 20000;
const PRINT_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(label + ' : délai dépassé'), { code: 'TIMEOUT' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Méthode absente d'un ancien APK : Capacitor rejette avec UNIMPLEMENTED.
function isUnimplemented(error) {
  return error?.code === 'UNIMPLEMENTED' || /not implemented/i.test(String(error?.message || ''));
}

async function toBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}

/**
 * Remet un fichier à l'application Android.
 * @returns {Promise<{handled: boolean, saved?: boolean}>} handled=false : pas
 *   d'application native (ou APK trop ancien) → l'appelant garde son repli
 *   navigateur. Une vraie erreur native est relancée.
 */
export async function saveFileNative(blob, fileName, mimeType = blob?.type || 'application/octet-stream') {
  const native = await nativePlugin();
  if (!native) return { handled: false };
  try {
    const result = await withTimeout(native.plugin.saveFile({ data: await toBase64(blob), fileName, mimeType }), SAVE_TIMEOUT_MS, 'Enregistrement');
    return { handled: true, saved: result?.saved === true };
  } catch (error) {
    if (isUnimplemented(error)) return { handled: false };
    throw error;
  }
}

/** Ouvre l'impression Android. false → repli window.print() du navigateur. */
export async function printPageNative(title) {
  const native = await nativePlugin();
  if (!native) return false;
  try {
    await withTimeout(native.plugin.printPage({ title }), PRINT_TIMEOUT_MS, 'Impression');
    return true;
  } catch {
    return false;
  }
}
