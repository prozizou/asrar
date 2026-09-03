import { describe, it, expect } from 'vitest';
import { splitMixed, escapeHtml, segmentsToHtml, splitListBlocks } from './format';

describe('splitMixed', () => {
  it('renvoie un tableau vide pour une entrée vide', () => {
    expect(splitMixed('')).toEqual([]);
    expect(splitMixed(null)).toEqual([]);
  });

  it('garde un texte purement français en un seul segment', () => {
    expect(splitMixed('Bonjour le monde')).toEqual([{ script: 'fr', text: 'Bonjour le monde' }]);
  });

  it('garde un texte purement arabe en un seul segment', () => {
    expect(splitMixed('بسم الله')).toEqual([{ script: 'ar', text: 'بسم الله' }]);
  });

  it('découpe un texte mixte FR/arabe en segments successifs', () => {
    const segs = splitMixed('Secret بسم الله fin');
    expect(segs.map((s) => s.script)).toEqual(['fr', 'ar', 'fr']);
    expect(segs[0].text).toBe('Secret');
    expect(segs[1].text).toBe('بسم الله');
    expect(segs[2].text).toBe('fin');
  });
});

describe('escapeHtml', () => {
  it('échappe les caractères spéciaux HTML', () => {
    expect(escapeHtml(`<a href="x">it's & "quoted"</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; &quot;quoted&quot;&lt;/a&gt;'
    );
  });
});

describe('segmentsToHtml', () => {
  it('enrobe chaque segment dans un <div> avec échappement HTML', () => {
    expect(segmentsToHtml('<b>bad</b>')).toBe('<div class="seg-fr">&lt;b&gt;bad&lt;/b&gt;</div>');
  });
});

describe('splitListBlocks', () => {
  it('garde un texte sans numérotation en un seul bloc de prose', () => {
    expect(splitListBlocks('Un simple paragraphe.\nSur deux lignes.')).toEqual([
      { type: 'p', text: 'Un simple paragraphe.\nSur deux lignes.' },
    ]);
  });

  it('reconnaît ≥ 2 lignes numérotées consécutives comme une liste', () => {
    const blocks = splitListBlocks('1. Écrire le verset 71 fois.\n2. Transformer en Nassi.\n3. Diviser en deux.');
    expect(blocks).toEqual([
      { type: 'ol', items: ['Écrire le verset 71 fois.', 'Transformer en Nassi.', 'Diviser en deux.'] },
    ]);
  });

  it('accepte aussi "N)" comme marqueur de liste', () => {
    expect(splitListBlocks('1) Premier\n2) Second')).toEqual([{ type: 'ol', items: ['Premier', 'Second'] }]);
  });

  it("ne traite pas une ligne numérotée ISOLÉE comme une liste (ex. « 3 gouttes »)", () => {
    expect(splitListBlocks('Ajouter 3. gouttes de miel.')).toEqual([{ type: 'p', text: 'Ajouter 3. gouttes de miel.' }]);
  });

  it('entrelace prose et liste dans le même texte, dans l’ordre', () => {
    const text = 'Préparation :\n1. Étape un.\n2. Étape deux.\nÀ observer pendant 41 jours.';
    expect(splitListBlocks(text)).toEqual([
      { type: 'p', text: 'Préparation :' },
      { type: 'ol', items: ['Étape un.', 'Étape deux.'] },
      { type: 'p', text: 'À observer pendant 41 jours.' },
    ]);
  });

  it('gère une entrée vide', () => {
    expect(splitListBlocks('')).toEqual([{ type: 'p', text: '' }]);
    expect(splitListBlocks(undefined)).toEqual([{ type: 'p', text: '' }]);
  });
});
