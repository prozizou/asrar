'use client';
// Envoi d'un fichier vers Cloudinary avec une signature Asrar-chat
// (pages/api/asrar-chat.js, action « upload.sign ») : dossier, type
// (private/public) et formats autorisés sont imposés par le serveur.
import { ac } from './client';

export const MAX_BYTES = { image: 15 * 1024 * 1024, video: 100 * 1024 * 1024, raw: 50 * 1024 * 1024 };

/** Type de ressource Cloudinary d'un fichier local. */
export function resourceTypeOf(file) {
  const type = String(file?.type || '');
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/') || type.startsWith('audio/')) return 'video';
  return 'raw';
}

function extension(name) {
  const m = /\.([a-z0-9]{2,5})$/i.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

/**
 * @param {File|Blob} file
 * @param {{ visibility?: 'private'|'public', rt?: 'image'|'video'|'raw', name?: string, duration?: number, onProgress?: (pct: number) => void }} [options]
 */
export async function uploadAsset(file, options = {}) {
  const rt = options.rt || resourceTypeOf(file);
  const visibility = options.visibility || 'private';
  if (file.size > MAX_BYTES[rt]) throw new Error(`Fichier trop volumineux (maximum ${Math.round(MAX_BYTES[rt] / 1048576)} Mo).`);
  const sign = await ac('upload.sign', { visibility, rt });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', sign.apiKey);
  fd.append('timestamp', String(sign.timestamp));
  fd.append('signature', sign.signature);
  fd.append('folder', sign.folder);
  fd.append('type', sign.type);
  fd.append('allowed_formats', sign.allowed_formats);
  const data = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sign.cloudName}/${rt}/upload`);
    xhr.timeout = 180_000;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && options.onProgress) options.onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(xhr.status === 413 ? 'Fichier trop volumineux.' : body?.error?.message?.includes('format') ? 'Format de fichier non accepté.' : 'L’envoi du fichier a échoué. Réessayez.'));
    };
    xhr.onerror = () => reject(new Error('Connexion interrompue pendant l’envoi. Réessayez.'));
    xhr.ontimeout = () => reject(new Error('L’envoi a pris trop de temps. Vérifiez votre connexion.'));
    xhr.send(fd);
  });
  if (!data || typeof data.public_id !== 'string') throw new Error('Le fichier envoyé n’a pas pu être confirmé.');
  const name = options.name || (file instanceof File ? file.name : '') || 'fichier';
  return {
    id: data.public_id, rt, fmt: String(data.format || extension(name) || '').toLowerCase(), bytes: data.bytes || file.size,
    name, ...(data.duration || options.duration ? { duration: Math.round(data.duration || options.duration) } : {}),
    ...(data.width && data.height ? { w: data.width, h: data.height } : {}),
  };
}
