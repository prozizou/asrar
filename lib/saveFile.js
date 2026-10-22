'use client';
// lib/saveFile.js — Remettre un fichier produit dans la page (PDF de
// l'Ornement…) à l'utilisateur.
//
// Dans un navigateur : téléchargement classique par lien (blob:). Dans l'app
// Android (coquille Capacitor), la WebView IGNORE ce lien en silence — le
// fichier était produit puis perdu (signalé : « progression jusqu'au bout,
// puis rien »). Le contenu passe alors par le plugin natif AsrarNative.saveFile
// (android/.../AsrarNativePlugin.java), qui l'enregistre dans Téléchargements
// et l'ouvre. @capacitor/core n'est importé qu'à l'exécution, comme dans
// lib/fcmNative.js.

/** Message montré quand l'APK installé n'a pas encore saveFile. */
export const NATIVE_UPDATE_MESSAGE =
  'Cette version de l’application ne sait pas encore enregistrer de fichier. Mettez-la à jour depuis le Play Store, puis réessayez.';

/** Contenu d'un Blob en base64 (sans préfixe data:). */
export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Par tranches : String.fromCharCode(...tableau) déborde la pile au-delà
  // de quelques centaines de milliers d'octets.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Vrai si l'erreur dit que la méthode native n'existe pas (APK antérieur). */
export function isMissingNativeMethod(err) {
  const code = err && err.code;
  const msg = String((err && err.message) || err || '');
  return code === 'UNIMPLEMENTED' || /not implemented|no method|unable to find method|is not a function/i.test(msg);
}

/** Téléchargement classique d'un navigateur. */
function downloadInBrowser(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Laisse au navigateur le temps de lire le blob avant de le libérer.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function loadCapacitor() {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  return { Capacitor, registerPlugin };
}

/**
 * Remet `blob` à l'utilisateur sous le nom `filename`.
 * @returns {Promise<{ native: boolean, location?: 'downloads' | 'share', opened?: boolean }>}
 *   native : vrai dans l'app Android ; location : Téléchargements, ou feuille
 *   de partage (Android < 10) ; opened : une app a ouvert le fichier.
 * @throws dans l'app, si l'enregistrement échoue (message lisible).
 */
export async function saveBlob(blob, filename, mimeType, deps = {}) {
  const { capacitor = await loadCapacitor().catch(() => null), download = downloadInBrowser } = deps;
  const native = !!(capacitor && capacitor.Capacitor.isNativePlatform() && capacitor.Capacitor.isPluginAvailable('AsrarNative'));
  if (!native) {
    download(blob, filename);
    return { native: false };
  }
  const plugin = capacitor.registerPlugin('AsrarNative');
  try {
    const res = await plugin.saveFile({ data: await blobToBase64(blob), filename, mimeType });
    return { native: true, location: res && res.location, opened: !!(res && res.opened) };
  } catch (err) {
    if (isMissingNativeMethod(err)) throw new Error(NATIVE_UPDATE_MESSAGE);
    throw new Error((err && err.message) || 'Enregistrement du fichier impossible.');
  }
}

/** Message de confirmation après saveBlob (null : rien à dire, cas du navigateur). */
export function savedMessage(result, filename) {
  if (!result || !result.native) return null;
  if (result.location === 'share') return `${filename} est prêt : choisissez où l’enregistrer ou l’envoyer.`;
  return result.opened
    ? `${filename} est enregistré dans Téléchargements.`
    : `${filename} est enregistré dans Téléchargements (aucune application installée ne sait l’ouvrir).`;
}
