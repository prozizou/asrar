import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ native: true, available: true, saveFile: vi.fn(), printPage: vi.fn() }));
// Comme le vrai plugin Capacitor : un Proxy dont CHAQUE propriété, « then » comprise,
// est une fonction. Renvoyé tel quel d'une fonction async, il est pris pour une
// promesse et rejette avec « then() is not implemented » (régression constatée en production).
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => state.native, isPluginAvailable: () => state.available },
  registerPlugin: () => new Proxy({}, {
    get: (_, prop) => {
      if (prop === 'then') return (_resolve, reject) => reject(Object.assign(new Error('"AsrarNative.then()" is not implemented on android'), { code: 'UNIMPLEMENTED' }));
      return (...args) => state[prop](...args);
    },
  }),
}));

import { saveFileNative, printPageNative, DOCX_MIME } from './nativeFiles';

const blob = () => new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'application/pdf' });

beforeEach(() => {
  state.native = true; state.available = true;
  state.saveFile = vi.fn().mockResolvedValue({ saved: true });
  state.printPage = vi.fn().mockResolvedValue(undefined);
});

describe('saveFileNative', () => {
  it('envoie le fichier en base64 au plugin Android', async () => {
    const result = await saveFileNative(blob(), 'doc.pdf', 'application/pdf');
    expect(result).toEqual({ handled: true, saved: true });
    expect(state.saveFile).toHaveBeenCalledWith({ data: 'AQID+g==', fileName: 'doc.pdf', mimeType: 'application/pdf' });
  });

  it('reprend le type du fichier quand aucun n’est donné', async () => {
    await saveFileNative(blob(), 'doc.pdf');
    expect(state.saveFile.mock.calls[0][0].mimeType).toBe('application/pdf');
  });

  it('laisse le navigateur faire hors de l’application Android', async () => {
    state.native = false;
    expect(await saveFileNative(blob(), 'doc.pdf')).toEqual({ handled: false });
    state.native = true; state.available = false;
    expect(await saveFileNative(blob(), 'doc.pdf')).toEqual({ handled: false });
    expect(state.saveFile).not.toHaveBeenCalled();
  });

  it('retombe sur le navigateur avec un APK sans la méthode saveFile', async () => {
    state.saveFile.mockRejectedValue(Object.assign(new Error('"saveFile" is not implemented on android'), { code: 'UNIMPLEMENTED' }));
    expect(await saveFileNative(blob(), 'doc.pdf')).toEqual({ handled: false });
  });

  it('remonte une vraie erreur native au lieu de la masquer', async () => {
    state.saveFile.mockRejectedValue(Object.assign(new Error('Aucune application pour ouvrir le fichier'), { code: 'unavailable' }));
    await expect(saveFileNative(blob(), 'doc.pdf')).rejects.toThrow('Aucune application');
  });

  it('expose le type MIME Word', () => {
    expect(DOCX_MIME).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
});

describe('printPageNative', () => {
  it('ouvre l’impression Android', async () => {
    expect(await printPageNative('Mon document')).toBe(true);
    expect(state.printPage).toHaveBeenCalledWith({ title: 'Mon document' });
  });

  it('indique le repli navigateur si le plugin est absent ou refuse', async () => {
    state.printPage.mockRejectedValue(new Error('unavailable'));
    expect(await printPageNative('x')).toBe(false);
    state.native = false;
    expect(await printPageNative('x')).toBe(false);
  });
});
