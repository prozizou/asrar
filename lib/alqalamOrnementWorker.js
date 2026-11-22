import { loadShaper } from './alqalamShaper';
import { createOrnementSession } from './alqalamOrnementSession';

let session;
self.onmessage = async ({ data }) => {
  const { id, type, input, index, label } = data || {};
  try {
    if (type === 'compose') {
      session = createOrnementSession(await loadShaper());
      self.postMessage({ id, result: session.compose(input) });
    } else if (type === 'svg' && session) self.postMessage({ id, result: session.svg(index, label) });
    else if (type === 'vector' && session) self.postMessage({ id, result: session.vector(index) });
    else throw new Error('Commande calligraphique indisponible.');
  } catch {
    // Le texte et le vœu ne figurent jamais dans une erreur technique.
    self.postMessage({ id, error: 'Calcul calligraphique indisponible. Rouvrez l’outil pour réessayer.' });
  }
};
