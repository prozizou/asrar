import { describe, it, expect } from 'vitest';
import { PLATFORMS, deviceIdFromToken, validateDeviceInput } from './pushDevices';

describe('deviceIdFromToken', () => {
  it('déterministe : un même jeton donne toujours le même identifiant', () => {
    expect(deviceIdFromToken('abc')).toBe(deviceIdFromToken('abc'));
  });

  it('des jetons différents donnent des identifiants différents', () => {
    expect(deviceIdFromToken('abc')).not.toBe(deviceIdFromToken('xyz'));
  });

  it('ne lève jamais sur une entrée absente ou non-chaîne', () => {
    expect(() => deviceIdFromToken(undefined)).not.toThrow();
    expect(() => deviceIdFromToken(null)).not.toThrow();
    expect(deviceIdFromToken(undefined)).toBe(deviceIdFromToken(null));
  });
});

describe('validateDeviceInput', () => {
  it('valide pour une plateforme connue et un jeton plausible', () => {
    for (const platform of PLATFORMS) {
      expect(validateDeviceInput({ platform, token: 'a'.repeat(20) })).toEqual({ valid: true });
    }
  });

  it('invalide si le jeton est absent, vide ou trop court', () => {
    expect(validateDeviceInput({ platform: 'android' })).toEqual({ valid: false, error: 'Jeton FCM invalide.' });
    expect(validateDeviceInput({ platform: 'android', token: '' })).toEqual({ valid: false, error: 'Jeton FCM invalide.' });
    expect(validateDeviceInput({ platform: 'android', token: 'court' })).toEqual({ valid: false, error: 'Jeton FCM invalide.' });
  });

  it('invalide si la plateforme est absente ou inconnue', () => {
    expect(validateDeviceInput({ token: 'a'.repeat(20) })).toEqual({ valid: false, error: 'Plateforme inconnue.' });
    expect(validateDeviceInput({ platform: 'windows-phone', token: 'a'.repeat(20) })).toEqual({ valid: false, error: 'Plateforme inconnue.' });
  });

  it('ne lève jamais sur une entrée totalement absente', () => {
    expect(() => validateDeviceInput()).not.toThrow();
    expect(validateDeviceInput().valid).toBe(false);
  });
});
