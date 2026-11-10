import { describe, it, expect } from 'vitest';
import { cleanRequestText, isShopOwner, publicRequest, sortRequests } from './productRequests';
import { emailVendorKey } from './market';

describe('cleanRequestText', () => {
  it('retire les espaces et caractères de contrôle, garde les retours à la ligne', () => {
    expect(cleanRequestText('  Bague\u0007 en argent\n\n\n\ntaille 58  ')).toBe('Bague en argent\n\ntaille 58');
  });
  it('borne la longueur et gère null', () => {
    expect(cleanRequestText('a'.repeat(600))).toHaveLength(500);
    expect(cleanRequestText(null)).toBe('');
  });
});

describe('isShopOwner', () => {
  const user = { uid: 'u1', email: 'Vendeur@Example.test' };
  it('reconnaît la boutique par la clé dérivée de l’e-mail', () => {
    expect(isShopOwner(user, emailVendorKey('vendeur@example.test'))).toBe(true);
  });
  it('reconnaît une ancienne boutique identifiée par uid', () => {
    expect(isShopOwner(user, 'u1')).toBe(true);
  });
  it('refuse toute autre boutique', () => {
    expect(isShopOwner(user, emailVendorKey('autre@example.test'))).toBe(false);
    expect(isShopOwner(null, 'u1')).toBe(false);
  });
});

describe('publicRequest', () => {
  const raw = { uid: 'u2', email: 'client@example.test', name: 'Client', text: 'Encens', at: 5, reply: { text: 'Dispo', at: 9 } };
  it('n’expose l’auteur qu’au propriétaire', () => {
    expect(publicRequest('r1', raw, true)).toMatchObject({ id: 'r1', name: 'Client', email: 'client@example.test' });
    const mine = publicRequest('r1', raw, false);
    expect(mine).toEqual({ id: 'r1', text: 'Encens', at: 5, reply: { text: 'Dispo', at: 9 } });
    expect(JSON.stringify(mine)).not.toContain('u2');
  });
  it('trie les plus récentes d’abord', () => {
    expect(sortRequests([{ at: 1 }, { at: 3 }, { at: 2 }]).map((r) => r.at)).toEqual([3, 2, 1]);
  });
});
