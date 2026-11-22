// Un Worker par composition : un changement de texte termine immédiatement
// les anciens calculs, sans attendre leur résultat ni afficher un SVG périmé.
export function createOrnementClient() {
  const worker = new Worker(new URL('./alqalamOrnementWorker.js', import.meta.url));
  const pending = new Map();
  let nextId = 0, disposed = false;
  function close(error) {
    if (disposed) return;
    disposed = true;
    worker.removeEventListener('message', onMessage);
    worker.removeEventListener('error', onError);
    worker.terminate();
    for (const job of pending.values()) { clearTimeout(job.timer); job.reject(error); }
    pending.clear();
  }
  function onMessage({ data }) {
    const job = pending.get(data?.id);
    if (!job) return;
    pending.delete(data.id); clearTimeout(job.timer);
    if (data.error) job.reject(new Error(data.error));
    else job.resolve(data.result);
  }
  function onError() { close(new Error('Le moteur calligraphique n’a pas pu démarrer. Rouvrez l’outil pour réessayer.')); }
  worker.addEventListener('message', onMessage);
  worker.addEventListener('error', onError);
  /** @returns {Promise<any>} */
  function request(type, payload = {}) {
    if (disposed) return Promise.reject(Object.assign(new Error('Composition annulée.'), { name: 'AbortError' }));
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => close(new Error('Le calcul prend trop de temps. Réduisez le texte ou le vœu et réessayez.')), 60000);
      pending.set(id, { resolve, reject, timer });
      try { worker.postMessage({ id, type, ...payload }); }
      catch { close(new Error('Le calcul calligraphique n’a pas pu être envoyé. Réessayez.')); }
    });
  }
  return {
    compose: input => request('compose', { input }),
    svg: (index, label) => request('svg', { index, label }),
    vector: index => request('vector', { index }),
    dispose: () => close(Object.assign(new Error('Composition annulée.'), { name: 'AbortError' })),
  };
}
