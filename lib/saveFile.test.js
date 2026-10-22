import { describe, it, expect, vi } from 'vitest';
import { saveBlob, blobToBase64, isMissingNativeMethod, savedMessage, NATIVE_UPDATE_MESSAGE } from './saveFile';

// Capacitor simulé : plateforme native ou non, plugin AsrarNative présent ou non.
const fakeCapacitor = ({ native = true, plugin = true, saveFile } = {}) => ({
  Capacitor: {
    isNativePlatform: () => native,
    isPluginAvailable: (name) => plugin && name === 'AsrarNative',
  },
  registerPlugin: () => ({ saveFile }),
});

const pdfBlob = () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0xff, 0x00])], { type: 'application/pdf' });

describe('blobToBase64', () => {
  it('encode le contenu exact, octets binaires compris', async () => {
    expect(await blobToBase64(pdfBlob())).toBe(Buffer.from([0x25, 0x50, 0x44, 0x46, 0xff, 0x00]).toString('base64'));
  });

  it('tient un gros fichier (encodage par tranches)', async () => {
    const big = new Uint8Array(300_000).map((_, i) => i % 256);
    expect(await blobToBase64(new Blob([big]))).toBe(Buffer.from(big).toString('base64'));
  });
});

describe('saveBlob', () => {
  it('dans un navigateur : téléchargement classique, rien de natif', async () => {
    const download = vi.fn();
    const res = await saveBlob(pdfBlob(), 'a.pdf', 'application/pdf', { capacitor: fakeCapacitor({ native: false }), download });
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'a.pdf');
    expect(res).toEqual({ native: false });
  });

  it('sans @capacitor/core chargeable : téléchargement classique', async () => {
    const download = vi.fn();
    await saveBlob(pdfBlob(), 'a.pdf', 'application/pdf', { capacitor: null, download });
    expect(download).toHaveBeenCalled();
  });

  it('dans l\'app Android : passe le contenu au plugin natif, jamais au lien de téléchargement', async () => {
    const download = vi.fn();
    const saveFile = vi.fn().mockResolvedValue({ location: 'downloads', opened: true });
    const res = await saveBlob(pdfBlob(), 'a.pdf', 'application/pdf', { capacitor: fakeCapacitor({ saveFile }), download });
    expect(download).not.toHaveBeenCalled();
    expect(saveFile).toHaveBeenCalledWith({ data: await blobToBase64(pdfBlob()), filename: 'a.pdf', mimeType: 'application/pdf' });
    expect(res).toEqual({ native: true, location: 'downloads', opened: true });
  });

  it('APK trop ancien (méthode absente) : demande la mise à jour', async () => {
    const saveFile = vi.fn().mockRejectedValue(Object.assign(new Error('not implemented'), { code: 'UNIMPLEMENTED' }));
    await expect(saveBlob(pdfBlob(), 'a.pdf', 'application/pdf', { capacitor: fakeCapacitor({ saveFile }) })).rejects.toThrow(NATIVE_UPDATE_MESSAGE);
  });

  it('échec natif : remonte un message lisible', async () => {
    const saveFile = vi.fn().mockRejectedValue(new Error('Enregistrement impossible : disque plein'));
    await expect(saveBlob(pdfBlob(), 'a.pdf', 'application/pdf', { capacitor: fakeCapacitor({ saveFile }) })).rejects.toThrow('disque plein');
  });
});

describe('isMissingNativeMethod', () => {
  it('reconnaît une méthode native absente', () => {
    expect(isMissingNativeMethod({ code: 'UNIMPLEMENTED' })).toBe(true);
    expect(isMissingNativeMethod(new Error('Method saveFile not implemented'))).toBe(true);
    expect(isMissingNativeMethod(new Error('Enregistrement impossible'))).toBe(false);
  });
});

describe('savedMessage', () => {
  it('rien à dire dans un navigateur', () => {
    expect(savedMessage({ native: false }, 'a.pdf')).toBeNull();
  });

  it('dit où le fichier est allé dans l\'app', () => {
    expect(savedMessage({ native: true, location: 'downloads', opened: true }, 'a.pdf')).toMatch(/Téléchargements/);
    expect(savedMessage({ native: true, location: 'downloads', opened: false }, 'a.pdf')).toMatch(/aucune application/);
    expect(savedMessage({ native: true, location: 'share' }, 'a.pdf')).toMatch(/enregistrer ou l’envoyer/);
  });
});
