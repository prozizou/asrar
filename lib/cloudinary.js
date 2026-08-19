'use client';
// Upload d'une image vers Cloudinary via signature serveur — port d'uploadImage()
// de boutique.js. La signature est demandée à /api/cloudinary-sign (proxifié),
// puis le fichier est envoyé directement à Cloudinary (CORS autorisé).
import { apiPost } from './api';

export async function uploadImage(file, folder) {
  const sign = await apiPost('cloudinary-sign', { folder });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', sign.apiKey);
  fd.append('timestamp', sign.timestamp);
  fd.append('signature', sign.signature);
  fd.append('folder', sign.folder);
  // Uniquement si CLOUDINARY_UPLOAD_PRESET est configuré côté serveur (sinon
  // absent de la réponse) — doit être envoyé pour matcher la valeur signée.
  if (sign.uploadPreset) fd.append('upload_preset', sign.uploadPreset);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.error && data.error.message) || "Échec de l'envoi de l'image.");
  return data.secure_url;
}
