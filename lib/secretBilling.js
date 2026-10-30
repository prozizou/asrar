'use client';
import { apiPost } from './api';
export async function secretPurchasePlatform() {
  const { Capacitor } = await import('@capacitor/core');
  return Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web';
}
async function bridge() {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') throw new Error('Les achats sont disponibles dans l’application Android installée depuis Google Play.');
  if (!Capacitor.isPluginAvailable('SecretBilling')) throw new Error('Mettez à jour l’application Android pour acheter ce secret.');
  return { plugin: registerPlugin('SecretBilling') };
}
export async function secretProduct(productId) { return (await bridge()).plugin.product({ productId }); }
export async function buySecret(productId, accountId) {
  const result = await (await bridge()).plugin.buy({ productId, accountId });
  if (result.pending) return { pending: true };
  return apiPost('secret-purchases', { action: 'verify', productId: result.productId, purchaseToken: result.purchaseToken });
}
export async function restoreSecrets() {
  const { purchases } = await (await bridge()).plugin.restore();
  let restored = 0, pending = 0, failed = 0;
  for (const purchase of purchases || []) {
    if (purchase.pending) { pending++; continue; }
    try { await apiPost('secret-purchases', { action: 'verify', productId: purchase.productId, purchaseToken: purchase.purchaseToken }); restored++; }
    catch { failed++; }
  }
  return { restored, pending, failed };
}
