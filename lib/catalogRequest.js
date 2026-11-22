// Une lecture de catalogue peut être relancée sans créer de commande ni
// répéter une écriture. Aucun retry global d'apiPost (paiements, messages…).
import { apiPost } from './api';
const abortError = () => Object.assign(new Error('Chargement annulé.'), { name: 'AbortError' });
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
/** @param {AbortSignal | undefined} signal */
const check = signal => {
  if (signal?.aborted) throw abortError();
  if (offline()) throw Object.assign(new Error('Connexion indisponible. Le catalogue sera rechargé au retour du réseau.'), { status: 0 });
};
/** @param {number} ms @param {AbortSignal | undefined} signal @returns {Promise<void>} */
function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const finish = () => { signal?.removeEventListener('abort', cancel); resolve(undefined); };
    const timer = setTimeout(finish, ms);
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(abortError()); };
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
/** @param {string} kind @param {{signal?: AbortSignal}} options @returns {Promise<{items: any[], [key: string]: any}>} */
export async function readCatalog(kind, { signal = undefined } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    check(signal);
    try {
      const data = await apiPost('list-content', { kind });
      if (signal?.aborted) throw abortError();
      if (!data || !Array.isArray(data.items)) throw Object.assign(new Error('Le catalogue reçu est incomplet. Réessayez.'), { invalidResponse: true });
      return data;
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw abortError();
      // Pas de répétition des refus 4xx ni d'une requête déjà suspendue 15 s.
      const transient = (error.status === 0 && !error.timeout) || [502, 503, 504].includes(error.status);
      if (attempt === 1 || !transient || offline()) throw error;
      await pause(400, signal);
    }
  }
}
