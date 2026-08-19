import { describe, it, expect } from 'vitest';
import { splitMixed, escapeHtml, segmentsToHtml } from './format';

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
