import { describe, it, expect } from 'vitest';
import { resolveCountry } from './countries';

describe('resolveCountry', () => {
  it('résout un code alpha-2 connu vers son nom français', () => {
    expect(resolveCountry('SN')).toEqual({ country: 'Sénégal', countryCode: 'SN' });
    expect(resolveCountry('fr')).toEqual({ country: 'France', countryCode: 'FR' });
  });

  it('retombe sur le code lui-même si le nom est absent de la table', () => {
    expect(resolveCountry('ZZ')).toEqual({ country: 'ZZ', countryCode: 'ZZ' });
  });

  it('renvoie des chaînes vides pour un code manquant ou invalide (jamais null/undefined)', () => {
    expect(resolveCountry('')).toEqual({ country: '', countryCode: '' });
    expect(resolveCountry(undefined)).toEqual({ country: '', countryCode: '' });
    expect(resolveCountry('FRANCE')).toEqual({ country: '', countryCode: '' });
  });
});
