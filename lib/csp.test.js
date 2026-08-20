import { describe, it, expect } from 'vitest';
import { buildCsp } from './csp';

describe('buildCsp', () => {
  it("utilise 'unsafe-inline' sur script-src (nonce essayé puis abandonné — cf. l'en-tête du fichier : cassait signInWithPopup)", () => {
    const csp = buildCsp();
    expect(csp).toMatch(/script-src 'self' 'unsafe-inline'/);
    expect(csp).not.toContain('nonce-');
  });

  it('couvre toutes les directives nécessaires (Firebase, Cloudinary, Google Sign-In…)', () => {
    const csp = buildCsp();
    for (const directive of [
      'default-src',
      'style-src',
      'font-src',
      'img-src',
      'connect-src',
      'frame-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
    ]) {
      expect(csp).toContain(directive);
    }
  });
});
