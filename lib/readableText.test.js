import { describe, it, expect } from 'vitest';
import { splitParagraphs, splitSentences } from './readableText';

describe('splitParagraphs', () => {
  it('regroupe les phrases par paquets de 3 au plus', () => {
    const text = 'Un. Deux. Trois. Quatre. Cinq.';
    expect(splitParagraphs(text)).toEqual(['Un. Deux. Trois.', 'Quatre. Cinq.']);
  });
  it('respecte les sauts de ligne existants', () => {
    expect(splitParagraphs('Premier bloc.\nSecond bloc.')).toEqual(['Premier bloc.', 'Second bloc.']);
  });
  it('limite la longueur d’un paragraphe', () => {
    const long = 'A'.repeat(300) + '. ' + 'B'.repeat(300) + '.';
    expect(splitParagraphs(long)).toHaveLength(2);
  });
  it('ne coupe pas les abréviations suivies d’une minuscule ni les nombres', () => {
    expect(splitParagraphs('Voir p. ex. la maison 3.5 du thème. Ensuite.', { maxSentences: 1 })).toEqual(['Voir p. ex. la maison 3.5 du thème.', 'Ensuite.']);
  });
  it('phrases accentuées et guillemets', () => {
    expect(splitParagraphs('Fin. « Élan » ici. Également.', { maxSentences: 1 })).toEqual(['Fin.', '« Élan » ici.', 'Également.']);
  });
  it('texte vide', () => {
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs(null)).toEqual([]);
  });
});

describe('splitSentences', () => {
  it('une ligne par phrase, à chaque point', () => {
    expect(splitSentences('La chambre. Le lit est un symbole. Il représente le repos!')).toEqual(['La chambre.', 'Le lit est un symbole.', 'Il représente le repos!']);
  });
  it('coupe aussi avant une minuscule et aux sauts de ligne', () => {
    expect(splitSentences('Un. deux\nTrois')).toEqual(['Un.', 'deux', 'Trois']);
  });
  it('ne coupe pas un nombre décimal', () => {
    expect(splitSentences('Valeur 3.5 ici. Fin.')).toEqual(['Valeur 3.5 ici.', 'Fin.']);
  });
  it('texte vide', () => {
    expect(splitSentences('')).toEqual([]);
  });
});
