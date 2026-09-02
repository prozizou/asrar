import { describe, it, expect } from 'vitest';
import { sentenceCaseIfShouting } from './text';

describe('sentenceCaseIfShouting', () => {
  it("adoucit un titre entièrement en majuscules", () => {
    expect(sentenceCaseIfShouting("AVOIR L'AMOUR DES GENS ÊTRE UNE STAR")).toBe(
      "Avoir l'amour des gens être une star"
    );
  });

  it('préserve les accents en majuscule/minuscule', () => {
    expect(sentenceCaseIfShouting('POUR L’AMOUR DES GENS')).toBe('Pour l’amour des gens');
  });

  it('laisse un titre déjà mixte inchangé', () => {
    expect(sentenceCaseIfShouting("Pour dompter n'importe qui")).toBe("Pour dompter n'importe qui");
  });

  it('laisse un texte purement arabe inchangé (pas de notion de casse)', () => {
    expect(sentenceCaseIfShouting('بسم الله الرحمن الرحيم')).toBe('بسم الله الرحمن الرحيم');
  });

  it('laisse un nombre ou une chaîne sans lettre inchangé', () => {
    expect(sentenceCaseIfShouting('12 - 34')).toBe('12 - 34');
  });

  it('gère les chaînes vides/nulles sans erreur', () => {
    expect(sentenceCaseIfShouting('')).toBe('');
    expect(sentenceCaseIfShouting(null)).toBe(null);
    expect(sentenceCaseIfShouting(undefined)).toBe(undefined);
  });

  it('préserve les espaces de tête', () => {
    expect(sentenceCaseIfShouting('  DÉBLOCAGE RAPIDE')).toBe('  Déblocage rapide');
  });

  it('ne change pas un sigle court déjà correct dans son propre contexte (tout majuscule quand même adouci)', () => {
    // Un sigle SEUL reste un cas ambigu assumé : la fonction ne peut pas
    // deviner qu'il doit rester en majuscules sans base de sigles connus —
    // cf. commentaire de lib/text.js, compromis documenté.
    expect(sentenceCaseIfShouting('ASRAR')).toBe('Asrar');
  });
});
