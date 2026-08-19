import { describe, it, expect } from 'vitest';
import { buildCsp } from './csp';

describe('buildCsp', () => {
  it('utilise unsafe-inline sur script-src sans nonce (repli next.config.mjs)', () => {
    const csp = buildCsp();
    expect(csp).toMatch(/script-src 'self' 'unsafe-inline'/);
    expect(csp).not.toContain('nonce-');
  });

  it('remplace unsafe-inline par le nonce fourni sur script-src', () => {
    const csp = buildCsp('abc123');
    expect(csp).toContain("'nonce-abc123'");
    expect(csp.split(';')[1]).not.toContain('unsafe-inline');
  });

  it('conserve toujours les directives non liées au script (perte constatée si on ne renvoie que script-src)', () => {
    for (const nonce of [undefined, 'xyz']) {
      const csp = buildCsp(nonce);
      for (const directive of ['default-src', 'style-src', 'font-src', 'img-src', 'connect-src', 'frame-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors']) {
        expect(csp).toContain(directive);
      }
    }
  });
});
