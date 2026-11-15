import { describe, it, expect } from 'vitest';
import { COUNTRIES, FREQUENT_COUNTRIES, OTHER_COUNTRIES, DEFAULT_COUNTRY_ISO, flagOf, countryByIso, detectCountryIso, composePhone } from './phoneCountries';
import { normalizePhone } from './zikrLogic';

describe('COUNTRIES', () => {
  it('codes ISO uniques et indicatifs numériques', () => {
    const isos = COUNTRIES.map((c) => c.iso);
    expect(new Set(isos).size).toBe(isos.length);
    // 1 à 3 chiffres ; 4 pour le plan nord-américain (indicatif régional inclus).
    for (const c of COUNTRIES) expect(c.dial).toMatch(/^\d{1,4}$/);
  });
  it('liste complète : tous les pays, dont ceux absents de l’ancienne liste', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(220);
    for (const iso of ['PK', 'IN', 'MG', 'SO', 'SD', 'LY', 'MU', 'RW', 'BI', 'ID', 'MY', 'BR', 'RU', 'NL', 'JM', 'HT', 'KE', 'ET', 'TZ', 'UG']) {
      expect(countryByIso(iso), iso).toBeTruthy();
    }
  });
  it('pays fréquents en tête, puis les autres de A à Z', () => {
    expect(COUNTRIES[0].iso).toBe('SN');
    const others = OTHER_COUNTRIES.map((c) => c.name);
    expect(others).toEqual([...others].sort((a, b) => a.localeCompare(b, 'fr')));
    expect(FREQUENT_COUNTRIES.length + OTHER_COUNTRIES.length).toBe(COUNTRIES.length);
  });
  it('le pays par défaut existe', () => {
    expect(countryByIso(DEFAULT_COUNTRY_ISO)).toBeTruthy();
  });
});

describe('flagOf', () => {
  it('produit le drapeau emoji', () => {
    expect(flagOf('SN')).toBe('🇸🇳');
    expect(flagOf('fr')).toBe('🇫🇷');
  });
  it('renvoie une chaîne vide si le code est invalide', () => {
    expect(flagOf('')).toBe('');
    expect(flagOf('SEN')).toBe('');
  });
});

describe('detectCountryIso', () => {
  it('Sénégalais avec un navigateur en français de France → Sénégal (fuseau prioritaire)', () => {
    expect(detectCountryIso({ timeZone: 'Africa/Dakar', languages: ['fr-FR'] })).toBe('SN');
  });
  it('repli sur la région de la langue si le fuseau est inconnu', () => {
    expect(detectCountryIso({ timeZone: 'Etc/UTC', languages: ['fr', 'fr-CI'] })).toBe('CI');
  });
  it('repli final sur le pays par défaut', () => {
    expect(detectCountryIso({})).toBe(DEFAULT_COUNTRY_ISO);
    expect(detectCountryIso({ timeZone: 'Asia/Tokyo', languages: ['ja'] })).toBe(DEFAULT_COUNTRY_ISO);
    // Désormais présent dans la liste complète : reconnu par la langue.
    expect(detectCountryIso({ timeZone: 'Asia/Tokyo', languages: ['ja-JP'] })).toBe('JP');
  });
});

describe('composePhone', () => {
  it('Sénégal : 77 123 45 67 → +221771234567', () => {
    expect(composePhone('SN', '77 123 45 67')).toBe('+221771234567');
    expect(normalizePhone(composePhone('SN', '77 123 45 67'))).toBe('+221771234567');
  });
  it('France : retire le 0 du préfixe national', () => {
    expect(composePhone('FR', '06 12 34 56 78')).toBe('+33612345678');
  });
  it('nouveaux pays : Pakistan, Madagascar, Jamaïque (plan nord-américain)', () => {
    expect(normalizePhone(composePhone('PK', '0300 1234567'))).toBe('+923001234567');
    expect(normalizePhone(composePhone('MG', '034 12 345 67'))).toBe('+261341234567');
    expect(normalizePhone(composePhone('JM', '555 1234'))).toBe('+18765551234');
  });
  it('détection par la langue pour un pays hors liste fréquente', () => {
    expect(detectCountryIso({ timeZone: 'Etc/UTC', languages: ['ur-PK'] })).toBe('PK');
  });
  it('Italie : garde le 0 initial', () => {
    expect(composePhone('IT', '06 1234 5678')).toBe('+390612345678');
  });
  it("tolère l'indicatif déjà tapé dans le champ numéro", () => {
    expect(composePhone('SN', '221 77 123 45 67')).toBe('+221771234567');
  });
  it('un numéro complet (+ ou 00) prime sur le pays choisi', () => {
    expect(composePhone('SN', '+33 6 12 34 56 78')).toBe('+33 6 12 34 56 78');
    expect(normalizePhone(composePhone('SN', '0033612345678'))).toBe('+33612345678');
  });
  it('rien de saisi → chaîne vide (donc invalide pour normalizePhone)', () => {
    expect(composePhone('SN', '')).toBe('');
    expect(composePhone('SN', ' - ')).toBe('');
    expect(normalizePhone(composePhone('SN', ''))).toBeNull();
  });
  it('numéro trop court → rejeté par normalizePhone', () => {
    expect(normalizePhone(composePhone('SN', '77'))).toBeNull();
  });
});
