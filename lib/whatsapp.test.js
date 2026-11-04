import { it, expect, vi, afterEach } from 'vitest';
vi.mock('./firebase', () => ({ auth: { currentUser: { email: 'acheteur@example.invalid' } } }));
vi.mock('./externalWindow', () => ({ isNativeApp: () => false, openExternalInApp: vi.fn() }));
import { openAccess } from './whatsapp';
afterEach(() => vi.unstubAllGlobals());
it('la confirmation Wave précise la formule et le compte sans affirmer une validation de paiement', () => {
  const open = vi.fn(); vi.stubGlobal('window', { open });
  openAccess({ planId: 'sub_6m', noAds: true, paidVia: 'wave' });
  const message = new URL(open.mock.calls[0][0], 'https://www.asrarpro.com').searchParams.get('text');
  expect(message).toContain('sans publicité'); expect(message).toContain('25 000 FCFA');
  expect(message).toContain('acheteur@example.invalid'); expect(message).toContain('Paiement à vérifier : Wave');
  expect(message).toContain('Merci de vérifier le paiement reçu');
});
