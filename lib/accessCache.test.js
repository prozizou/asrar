import { it, expect, vi } from 'vitest';
vi.mock('./api', () => ({ apiPost: vi.fn() }));
import { apiPost } from './api';
import { checkAccess, isAccessCacheValid } from './access';
it('un abonnement expiré ne reste pas exempté de publicité pendant le cache', () => {
  expect(isAccessCacheValid({ adFree: true, expiresAt: 999 }, 900, 1000)).toBe(false);
  expect(isAccessCacheValid({ adFree: true, expiresAt: 2000 }, 900, 1000)).toBe(true);
  expect(isAccessCacheValid({ adFree: true, expiresAt: null }, 900, 1000)).toBe(true);
  expect(isAccessCacheValid({ adFree: false }, 0, 60000)).toBe(false);
});
it('un statut sans confirmation explicite adFree ne donne pas une exemption', async () => {
  apiPost.mockResolvedValue({ allowed: true, level: 999999 });
  expect(await checkAccess({ email: 'fixture@example.invalid' })).toMatchObject({ allowed: false, adFree: null, unavailable: true });
});
