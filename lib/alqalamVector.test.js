// Moteur vectoriel de l'Ornement, éprouvé avec la VRAIE police et le vrai
// HarfBuzz (WebAssembly, sous Node) : ce que ces tests vérifient est
// exactement ce que l'aperçu affiche et ce que le PDF contient.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as hb from 'harfbuzzjs';
import { createShaper } from './alqalamShaper';
import { vectorizePage, pageSvgMarkup } from './alqalamVector';
import { composePhrasePages, DEFAULT_PEN, PHRASE_PIECE } from './alqalamOrne';

let shaper;
beforeAll(() => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'public', 'fonts', 'ScheherazadeNew-Bold.ttf'));
  shaper = createShaper(hb, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
});

const compose = (phrase, letters, innerText = 'اللهم ارزقني رزقا واسعا') =>
  composePhrasePages({ phrase, letters, innerText, measure: shaper.measure });

// Contours d'un chemin « M x,y L x,y … Z » (celui de la forme fusionnée).
const polygons = (d) =>
  d.split('M').filter(Boolean).map((sub) =>
    sub.replace('Z', '').split('L').map((pt) => pt.split(',').map(Number))
  );
const area = (poly) => poly.reduce((s, [x, y], i) => {
  const [x2, y2] = poly[(i + 1) % poly.length];
  return s + x * y2 - x2 * y;
}, 0) / 2;
// Règle non nulle, comme le rendu SVG/PDF.
const winding = (polys, px, py) => {
  let w = 0;
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i += 1) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      if (y1 <= py && y2 > py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) > 0) w += 1;
      else if (y1 > py && y2 <= py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) < 0) w -= 1;
    }
  }
  return w;
};

describe('moteur de formes (HarfBuzz + Scheherazade New)', () => {
  it('lit la plume (tatweel) dans la police : les mêmes valeurs que DEFAULT_PEN', () => {
    expect(shaper.measure.pen.bottom).toBeCloseTo(DEFAULT_PEN.bottom, 6);
    expect(shaper.measure.pen.top).toBeCloseTo(DEFAULT_PEN.top, 6);
  });

  it('met en forme l’arabe : un ZWJ donne au kâf ourdou (ک) sa forme LIÉE', () => {
    const isolated = shaper.shape('ک').glyphs[0].gid;
    const joined = shaper.shape('ک‍').glyphs.find((g) => shaper.glyphPath(g.gid)).gid;
    expect(joined).not.toBe(isolated);
  });

  it('mesure en proportion du corps', () => {
    expect(shaper.measure('بسم', 40)).toBeCloseTo(2 * shaper.measure('بسم', 20), 9);
  });
});

describe('vectorizePage', () => {
  it('ne laisse AUCUN texte arabe au moteur de rendu : uniquement des tracés', () => {
    const p = compose('بسم الله الرحمن الرحيم', ['م', 'ه']);
    const v = vectorizePage(p.pages[0], shaper);
    const svg = pageSvgMarkup(v, { pageNumber: 1, pageCount: 1, label: '', margin: PHRASE_PIECE.MARGIN });
    const textNodes = svg.match(/<text[^>]*>([^<]*)<\/text>/g) || [];
    // Seul texte restant : la numérotation « 1 / 1 », en chiffres latins.
    expect(textNodes).toHaveLength(1);
    expect(textNodes[0]).toMatch(/>1 \/ 1</);
    expect(svg).not.toMatch(/<image|data:image/);
    expect(v.ink.length).toBeGreaterThan(0);
    expect(v.text.length).toBeGreaterThan(0);
  });

  it('FUSIONNE lettre, liaison et boucle en une seule forme — sans rectangle séparé ni couture', () => {
    // « بمر » : ب → boucle (م) → ر, deux liaisons.
    const p = compose('بمر', ['م']);
    const page = p.pages[0];
    const v = vectorizePage(page, shaper);
    const polys = polygons(v.ink);
    const loop = page.items.find((it) => it.type === 'loop');
    // Contour extérieur qui contient le trait droit de la boucle…
    const outers = polys.filter((poly) => area(poly) > 0);
    const holes = polys.filter((poly) => area(poly) < 0);
    const container = outers.find((poly) => winding([poly], loop.cx + loop.a, loop.cy) !== 0);
    expect(container).toBeDefined();
    // … contient aussi les deux liaisons, sur toute leur longueur.
    for (const c of page.connectors) {
      for (const t of [0.1, 0.5, 0.9]) {
        expect(winding([container], c.x2 + (c.x1 - c.x2) * t, c.y)).not.toBe(0);
      }
    }
    // Et l'intérieur de la boucle reste un trou (le vœu s'y inscrit).
    expect(winding(polys, loop.cx, loop.cy - loop.b / 2)).toBe(0);
    expect(holes.length).toBeGreaterThan(0);
  });

  it('garde l’épaisseur de la plume : juste au-dessus et au-dessous d’une liaison, c’est le blanc du papier', () => {
    const p = compose('بمر', ['م']);
    const page = p.pages[0];
    const polys = polygons(vectorizePage(page, shaper).ink);
    const c = page.connectors[0];
    const mid = (c.x1 + c.x2) / 2;
    expect(winding(polys, mid, c.y)).not.toBe(0);
    expect(winding(polys, mid, c.y - c.width)).toBe(0);
    expect(winding(polys, mid, c.y + c.width)).toBe(0);
  });

  it('écrit le vœu une seule fois par ligne distincte (<defs>), réutilisé dans chaque boucle', () => {
    const p = compose('بسم الله الرحمن الرحيم', ['م', 'ه']);
    const v = vectorizePage(p.pages[0], shaper, { idPrefix: 'z' });
    expect(v.uses.length).toBeGreaterThan(v.defs.length);
    const ids = new Set(v.defs.map((d) => '#' + d.id));
    for (const u of v.uses) expect(ids.has(u.href)).toBe(true);
    expect(v.defs.every((d) => d.id.startsWith('z'))).toBe(true);
  });

  it('reste dans la zone de composition (marges de 5 mm), boucles et lettres comprises', () => {
    const p = compose(Array(6).fill('بسم الله الرحمن الرحيم').join(' '), ['م', 'ه']);
    for (const page of p.pages) {
      const v = vectorizePage(page, shaper);
      const nums = (v.ink + v.text).match(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/g).map((pt) => pt.split(',').map(Number));
      for (const [x, y] of nums) {
        expect(x).toBeGreaterThanOrEqual(PHRASE_PIECE.MARGIN - 0.5);
        expect(x).toBeLessThanOrEqual(page.W - PHRASE_PIECE.MARGIN + 0.5);
        expect(y).toBeGreaterThanOrEqual(PHRASE_PIECE.MARGIN - 0.5);
        expect(y).toBeLessThanOrEqual(page.H - PHRASE_PIECE.MARGIN - PHRASE_PIECE.FOOTER_HEIGHT + 0.5);
      }
    }
  });

  it('relie le kâf ourdou (ک) au م gonflé par une liaison fusionnée', () => {
    const p = compose('کم', ['م']);
    const page = p.pages[0];
    expect(page.connectors).toHaveLength(1);
    const polys = polygons(vectorizePage(page, shaper).ink);
    const c = page.connectors[0];
    expect(winding(polys, (c.x1 + c.x2) / 2, c.y)).not.toBe(0);
  });
});
