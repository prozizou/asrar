import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { database, runtime, invoke } from './support/runtime';

beforeEach(() => {
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'fixture');
  vi.stubEnv('CLOUDINARY_API_KEY', 'fixture');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'fixture-secret');
  vi.stubEnv('CLOUDINARY_UPLOAD_PRESET', '');
  vi.stubEnv('CLOUDINARY_IMAGE_UPLOAD_PRESET', '');
  vi.stubEnv('CLOUDINARY_AUDIO_UPLOAD_PRESET', '');
});
afterEach(() => vi.unstubAllEnvs());

function sellerHandler() {
  return runtime(database({ sellers: { tester: { shopActive: true, expiresAt: Date.now() + 86400000 } } }))('pages/api/cloudinary-sign.js').default;
}

it('ne délivre pas une signature sans preset bornant les fichiers', async () => {
  const result = await invoke(sellerHandler(), { folder: 'products' });
  expect(result.code).toBe(503);
  expect(result.body.signature).toBeUndefined();
});

it('signe le preset image et le dossier propre au vendeur', async () => {
  vi.stubEnv('CLOUDINARY_IMAGE_UPLOAD_PRESET', 'bounded-images');
  const result = await invoke(sellerHandler(), { folder: 'products' });
  expect(result.code).toBe(200);
  expect(result.body.uploadPreset).toBe('bounded-images');
  expect(result.body.folder).toBe('products/tester');
});

it('ne permet pas à un vendeur d’utiliser le canal vidéo hors discussion', async () => {
  const result = await invoke(sellerHandler(), { folder: 'products', mediaType: 'video' });
  expect(result.code).toBe(400);
});

it('emploie un preset audio distinct pour les vocaux d’un membre', async () => {
  vi.stubEnv('CLOUDINARY_AUDIO_UPLOAD_PRESET', 'bounded-audio');
  const handler = runtime(database({ zikr_members: { g1: { tester: { fait: 0 } } } }))('pages/api/cloudinary-sign.js').default;
  const result = await invoke(handler, { folder: 'zikr_chat', groupId: 'g1', mediaType: 'video' });
  expect(result.code).toBe(200);
  expect(result.body.uploadPreset).toBe('bounded-audio');
  expect(result.body.folder).toBe('zikr_chat/g1/tester');
});

it('détecte le preset audio manquant avant de demander le micro, sans exposer de signature', async () => {
  vi.stubEnv('CLOUDINARY_UPLOAD_PRESET', 'images-only');
  const handler = runtime(database({ zikr_members: { g1: { tester: {} } } }))('pages/api/cloudinary-sign.js').default;
  const check = await invoke(handler, { action: 'check', folder: 'zikr_chat', groupId: 'g1', mediaType: 'video' });
  expect(check.code).toBe(200);
  expect(check.body).toMatchObject({ available: false, code: 'UPLOAD_NOT_CONFIGURED' });
  expect(check.body.signature).toBeUndefined();
  const sign = await invoke(handler, { folder: 'zikr_chat', groupId: 'g1', mediaType: 'video' });
  expect(sign.code).toBe(503); expect(sign.body.code).toBe('UPLOAD_NOT_CONFIGURED');
});

it('ne rend pas le diagnostic des médias accessible à un non-membre', async () => {
  const handler = runtime(database({}))('pages/api/cloudinary-sign.js').default;
  expect((await invoke(handler, { action: 'check', folder: 'zikr_chat', groupId: 'g1', mediaType: 'video' })).code).toBe(403);
});

it('annonce les vocaux disponibles quand leurs paramètres sont configurés', async () => {
  vi.stubEnv('CLOUDINARY_AUDIO_UPLOAD_PRESET', 'bounded-audio');
  const handler = runtime(database({ zikr_members: { g1: { tester: {} } } }))('pages/api/cloudinary-sign.js').default;
  const result = await invoke(handler, { action: 'check', folder: 'zikr_chat', groupId: 'g1', mediaType: 'video' });
  expect(result.body).toEqual({ available: true });
});
