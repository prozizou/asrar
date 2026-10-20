import { describe, it, expect } from 'vitest';
import { isAndroidVersionOutdated } from './nativeVersion';

describe('isAndroidVersionOutdated', () => {
  it('ne bloque rien sans minimum configuré', () => {
    expect(isAndroidVersionOutdated(undefined, 0)).toBe(false);
    expect(isAndroidVersionOutdated(50, 0)).toBe(false);
  });

  it('bloque un APK sans versionCode (antérieur au champ)', () => {
    expect(isAndroidVersionOutdated(undefined, 113)).toBe(true);
    expect(isAndroidVersionOutdated(null, 113)).toBe(true);
  });

  it('compare au minimum', () => {
    expect(isAndroidVersionOutdated(112, 113)).toBe(true);
    expect(isAndroidVersionOutdated(113, 113)).toBe(false);
    expect(isAndroidVersionOutdated(120, 113)).toBe(false);
    expect(isAndroidVersionOutdated('113', 113)).toBe(false);
  });
});
