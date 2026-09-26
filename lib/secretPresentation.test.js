import { describe, it, expect } from 'vitest';
import { secretImages, secretParagraphs, secretInlineParts, secretIntro, secretIsArabic } from './secretPresentation';

describe('présentation des secrets', () => {
  it('préserve la formule, les parenthèses et les nombres sans éclater la phrase', () => {
    const source = 'Écrire ya LATIF (يا لطيف) 129 x\nY’a Latif 16 641 fois.';
    const parts = secretInlineParts(source);
    expect(parts.map((p) => p.text).join('')).toBe(source);
    expect(parts.filter((p) => p.arabic).map((p) => p.text)).toEqual(['يا لطيف']);
  });
  it('garde les retours simples dans un paragraphe et la numérotation source', () => {
    expect(secretParagraphs('1. Texte\r\nFormule 129\r\n\r\n2. Suite')).toEqual(['1. Texte\nFormule 129', '2. Suite']);
    expect(secretParagraphs('')).toEqual([]);
  });
  it('affiche uniquement les images disponibles, dédoublonnées dans leur ordre', () => {
    expect(secretImages({img: '/a.jpg', image:'/a.jpg', images:['/a.jpg', {url:'/b.jpg'}, null, '']})).toEqual(['/a.jpg','/b.jpg']);
    expect(secretImages({images:{first:'/a.jpg', second:{src:'/b.jpg'}}})).toEqual(['/a.jpg','/b.jpg']);
    expect(secretImages({})).toEqual([]);
  });
  it("tire l'introduction du début du texte, sans le révéler en entier", () => {
    expect(secretIntro('Court\n\ntexte.')).toBe('Court texte.');
    expect(secretIntro('')).toBe('');
    expect(secretIntro('Ouvre les portes. ' + 'Lire la sourate '.repeat(20))).toBe('Ouvre les portes.');
    const intro = secretIntro('mot '.repeat(30));
    expect(intro.endsWith('…')).toBe(true);
    expect(intro.length).toBeLessThanOrEqual(51);
  });
  it("détecte un paragraphe arabe même déjà scindé en <bdi dir=\"rtl\"> (piège de dir=\"auto\")", () => {
    expect(secretIsArabic('اللهم افتح لنا أبواب الرزق الحلال')).toBe(true);
    expect(secretIsArabic('Réciter (يا لطيف) 129 fois après la prière du Fajr.')).toBe(false);
    expect(secretIsArabic('')).toBe(false);
    expect(secretIsArabic('3 gouttes matin et soir.')).toBe(false);
  });
});
