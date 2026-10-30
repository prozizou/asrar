import { it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ native: true, available: true, post: vi.fn(), product: vi.fn(), buy: vi.fn(), restore: vi.fn() }));
vi.mock('./api', () => ({ apiPost: mocks.post }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native, getPlatform: () => mocks.native ? 'android' : 'web', isPluginAvailable: () => mocks.available },
  registerPlugin: () => new Proxy({}, { get: (_, key) => key === 'then' ? () => {} : mocks[key] }) }));
import { secretProduct, buySecret, restoreSecrets } from './secretBilling';
beforeEach(() => { mocks.native = true; mocks.available = true; vi.clearAllMocks(); });
it('n’attend pas le proxy Capacitor comme une promesse et utilise le prix Play', async () => {
  mocks.product.mockResolvedValue({ price: '2 500 FCFA' });
  expect(await secretProduct('secret_1')).toEqual({ price: '2 500 FCFA' });
});
it('un achat en attente ne déclenche aucune validation ni attribution', async () => {
  mocks.buy.mockResolvedValue({ pending: true });
  expect(await buySecret('secret_1', 'account')).toEqual({ pending: true }); expect(mocks.post).not.toHaveBeenCalled();
});
it('la validation transmet seulement le produit et le reçu, jamais un prix', async () => {
  mocks.buy.mockResolvedValue({ productId: 'secret_1', purchaseToken: 'receipt', price: 1 }); mocks.post.mockResolvedValue({ ok: true });
  await buySecret('secret_1', 'account');
  expect(mocks.post).toHaveBeenCalledWith('secret-purchases', { action: 'verify', productId: 'secret_1', purchaseToken: 'receipt' });
});
it('la restauration distingue les achats vérifiés, en attente et refusés', async () => {
  mocks.restore.mockResolvedValue({ purchases: [{ pending: true }, { productId: 'a', purchaseToken: 'valid' }, { productId: 'b', purchaseToken: 'invalid' }] });
  mocks.post.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('Compte différent'));
  expect(await restoreSecrets()).toEqual({ restored: 1, pending: 1, failed: 1 });
});
it('ne lance pas Google Play sur le web ni sur un ancien APK', async () => {
  mocks.native = false; await expect(secretProduct('a')).rejects.toThrow('Android');
  mocks.native = true; mocks.available = false; await expect(secretProduct('a')).rejects.toThrow('Mettez à jour');
});
