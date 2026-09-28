// Module « Al-Qalam » — MOTEUR DE FORMES : texte arabe → contours vectoriels.
//
// HarfBuzz (le moteur de mise en forme des navigateurs et des systèmes,
// compilé en WebAssembly) applique toutes les règles OpenType de la police —
// formes contextuelles, ligatures, placement des points et des voyelles —
// puis chaque glyphe est lu comme un CONTOUR (courbes de Bézier) dans la
// police elle-même. Le texte de l'ornement n'est donc plus jamais « peint »
// par un canvas puis photographié : il devient des tracés SVG, identiques
// dans l'aperçu et dans le PDF, nets à tout agrandissement.
//
// Pur calcul, sans DOM : le même code tourne dans le navigateur (loadShaper)
// et dans les tests Node (createShaper avec la police lue sur disque).

export const FONT_URL = '/fonts/ScheherazadeNew-Bold.ttf';

const TATWEEL = 'ـ';

/**
 * Construit le moteur de formes à partir du module harfbuzzjs déjà chargé
 * et des octets de la police.
 * @param {any} hb module `harfbuzzjs`
 * @param {ArrayBuffer} fontBytes contenu du fichier .ttf
 */
export function createShaper(hb, fontBytes) {
  const face = new hb.Face(new hb.Blob(fontBytes));
  const font = new hb.Font(face);
  const upem = face.upem;

  const shapeCache = new Map();
  const pathCache = new Map();
  const extentsCache = new Map();

  /**
   * Met en forme `text` (droite à gauche, arabe). Renvoie les glyphes dans
   * l'ordre VISUEL (de gauche à droite), en unités de police, avec pour
   * chacun sa position d'origine (x, y) et l'indice UTF-16 du caractère
   * source (cluster) — et la chasse totale.
   * @returns {{advance:number, glyphs:{gid:number, x:number, y:number, cluster:number}[]}}
   */
  function shape(text) {
    const key = String(text);
    const hit = shapeCache.get(key);
    if (hit) return hit;
    const buffer = new hb.Buffer();
    buffer.addText(key);
    buffer.guessSegmentProperties();
    hb.shape(font, buffer);
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    let pen = 0;
    const glyphs = infos.map((info, i) => {
      const p = positions[i];
      const g = { gid: info.codepoint, x: pen + p.xOffset, y: p.yOffset, cluster: info.cluster };
      pen += p.xAdvance;
      return g;
    });
    const result = { advance: pen, glyphs };
    if (shapeCache.size > 5000) shapeCache.clear();
    shapeCache.set(key, result);
    return result;
  }

  /** Contour SVG d'un glyphe, en unités de police (axe y vers le HAUT). */
  function glyphPath(gid) {
    let d = pathCache.get(gid);
    if (d === undefined) {
      d = font.glyphToPath(gid);
      pathCache.set(gid, d);
    }
    return d;
  }

  /** Boîte d'encre d'un glyphe (unités de police, y vers le haut). */
  function glyphBox(gid) {
    let box = extentsCache.get(gid);
    if (box === undefined) {
      const e = font.glyphExtents(gid);
      box = e ? { xMin: e.xBearing, xMax: e.xBearing + e.width, yMax: e.yBearing, yMin: e.yBearing + e.height } : null;
      extentsCache.set(gid, box);
    }
    return box;
  }

  /** Chasse rendue, dans l'unité de `fontSize` — même contrat que l'ancien mesureur canvas. */
  const measure = (text, fontSize) => (shape(text).advance * fontSize) / upem;

  // Plume : bande verticale du tatweel de la police, en em (voir
  // DEFAULT_PEN dans lib/alqalamOrne.js — même mesure, lue ici).
  const kashida = shape(TATWEEL).glyphs[0];
  const kBox = kashida ? glyphBox(kashida.gid) : null;
  measure.pen = kBox
    ? { bottom: kBox.yMin / upem, top: kBox.yMax / upem }
    : { bottom: 0, top: 267 / 2048 };

  return { upem, shape, glyphPath, glyphBox, measure };
}

let shaperPromise = null;

/**
 * Charge (une seule fois) HarfBuzz et la police calligraphique, côté
 * navigateur. Le module WebAssembly et le .ttf ne sont téléchargés qu'à la
 * première ouverture de l'Ornement.
 */
export function loadShaper(fontUrl = FONT_URL) {
  if (!shaperPromise) {
    shaperPromise = (async () => {
      const [hb, bytes] = await Promise.all([
        import('harfbuzzjs'),
        fetch(fontUrl).then((r) => {
          if (!r.ok) throw new Error('Police calligraphique introuvable.');
          return r.arrayBuffer();
        }),
      ]);
      return createShaper(hb, bytes);
    })().catch((e) => {
      shaperPromise = null; // réessayer à la prochaine ouverture (hors-ligne, etc.)
      throw e;
    });
  }
  return shaperPromise;
}
