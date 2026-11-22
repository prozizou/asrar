// Calcul pur, utilisable dans le Worker et dans les tests avec la vraie police.
import { composePhrasePages, PHRASE_PIECE } from './alqalamOrne';
import { vectorizePage, pageSvgMarkup } from './alqalamVector';

export function createOrnementSession(shaper, cacheLimit = 6) {
  let piece = null;
  const vectors = new Map();
  function vector(index) {
    if (!piece || !Number.isInteger(index) || !piece.pages[index]) throw new Error('Page calligraphique indisponible.');
    let result = vectors.get(index);
    if (result) vectors.delete(index);
    else result = vectorizePage(piece.pages[index], shaper, { idPrefix: `p${index}q` });
    vectors.set(index, result);
    while (vectors.size > cacheLimit) vectors.delete(vectors.keys().next().value);
    return result;
  }
  return {
    compose(input) {
      vectors.clear();
      piece = composePhrasePages({ ...input, measure: shaper.measure });
      // La mise en page complète reste dans le Worker. L'interface reçoit
      // seulement la pagination et les indications nécessaires à ses contrôles.
      return { ...piece, pages: piece.pages.map(() => null) };
    },
    vector,
    svg(index, label) {
      return pageSvgMarkup(vector(index), { pageNumber: index + 1, pageCount: piece.pages.length, label, margin: PHRASE_PIECE.MARGIN });
    },
  };
}
