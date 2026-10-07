import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { SOURCES, listFields } = require('../server/sources');

describe('source « shop » (profile_clients)', () => {
  it('lit le nœud profile_clients, en liste seulement', () => {
    expect(SOURCES.shop.ref()).toBe('profile_clients');
    expect(SOURCES.shop.listOnly).toBe(true);
  });

  it("n'expose jamais email, téléphone, uid ni un champ inconnu", () => {
    const fiche = {
      profile_name: 'Maison Baraka', img: 'https://img/logo.png', description: 'Encens',
      email: 'proprio@x.com', number: '221770000000', uid: 'abc', secret: 'x', location: 'Dakar',
    };
    expect(listFields(SOURCES.shop, fiche)).toEqual({
      profile_name: 'Maison Baraka', img: 'https://img/logo.png', description: 'Encens',
    });
  });

  it('les autres sources gardent leur comportement (tout sauf secretFields)', () => {
    const out = listFields(SOURCES.product, { produit: 'Bague', description: 'x', number: '1', email: 'e', Prix: 5 });
    expect(out).toEqual({ produit: 'Bague', Prix: 5 });
    expect(listFields(SOURCES.verset, null)).toEqual({});
  });
});
