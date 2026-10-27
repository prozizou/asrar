import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('./api', () => ({ apiPost: vi.fn() }));
import { apiPost } from './api';
import { checkZikrAudio, uploadZikrChatMedia } from './cloudinary';
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
it('arrête un vocal indisponible avant tout transfert Cloudinary', async () => {
  apiPost.mockResolvedValue({ available: false, message: 'Vocaux non activés.' });
  await expect(checkZikrAudio('g')).rejects.toThrow('Vocaux non activés.');
  expect(fetch).not.toHaveBeenCalled();
});
it('transmet le MIME audio et la signature vers le canal vidéo de Cloudinary', async () => {
  apiPost.mockResolvedValue({ cloudName: 'test', apiKey: 'key', timestamp: 1, signature: 'signature', folder: 'zikr_chat/g/u', uploadPreset: 'audio' });
  fetch.mockResolvedValue({ ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/test/video/upload/vocal.webm' }) });
  const blob = new Blob(['audio'], { type: 'audio/webm' });
  await expect(uploadZikrChatMedia(blob, 'g', 'video')).resolves.toContain('vocal.webm');
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe('https://api.cloudinary.com/v1_1/test/video/upload');
  expect(options.body.get('file').type).toBe('audio/webm');
  expect(options.body.get('upload_preset')).toBe('audio');
});
it('refuse de publier un message si Cloudinary omet l’adresse du fichier', async () => {
  apiPost.mockResolvedValue({ cloudName: 'test', uploadPreset: 'audio' });
  fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  await expect(uploadZikrChatMedia(new Blob(['audio']), 'g', 'video')).rejects.toThrow('confirmé');
});
it('explique une coupure réseau pendant le transfert', async () => {
  apiPost.mockResolvedValue({ cloudName: 'test', uploadPreset: 'audio' });
  fetch.mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(uploadZikrChatMedia(new Blob(['audio']), 'g', 'video')).rejects.toThrow('Vérifiez votre connexion');
});
