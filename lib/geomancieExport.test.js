import { describe, it, expect } from 'vitest';
import { buildEcuPdf, ecuShareText, pdfText, ecuFilename } from './geomancieExport';
import { generateAllHouses, checkJudgeParity, synthesis, randomMothers } from './geomancie';

function sample() {
  const houses = generateAllHouses(randomMothers());
  const s = synthesis(houses);
  return {
    houses,
    names: houses.map((_, i) => 'Fig' + (i + 1)),
    parity: checkJudgeParity(houses),
    voeu: { fig: s.voeuFig, name: 'Voeu' },
    rep: { fig: s.repFig, name: 'Rep' },
    date: new Date(2026, 9, 6, 22, 5),
  };
}

describe('export PDF de l\'écu', () => {
  it('produit un PDF A4 d\'une page', async () => {
    const { blob, filename, doc } = await buildEcuPdf(sample());
    expect(filename).toBe('ecu-geomantique-20261006-2205.pdf');
    expect(doc.getNumberOfPages()).toBe(1);
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(2000);
  });
  it('nettoie les caractères hors Latin-1', () => {
    expect(pdfText('Via \u200E\u0645\u0631 é')).toBe('Via é');
    expect(pdfText(null)).toBe('');
    expect(pdfText('Café')).toBe('Café');
  });
  it('résumé texte', () => {
    const d = sample();
    const t = ecuShareText(d);
    expect(t).toContain('Écu géomantique — Asrar Pro');
    expect(t).toContain('Juge : Fig15');
    expect(t).toContain('Vœu : Voeu');
  });
  it('nom de fichier', () => {
    expect(ecuFilename(new Date(2026, 0, 2, 3, 4))).toBe('ecu-geomantique-20260102-0304.pdf');
  });
});
