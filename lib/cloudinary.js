'use client';
// Upload d'une image vers Cloudinary via signature serveur — port d'uploadImage()
// de boutique.js. La signature est demandée à /api/cloudinary-sign (proxifié),
// puis le fichier est envoyé directement à Cloudinary (CORS autorisé).
import { apiPost } from './api';

export async function checkZikrAudio(groupId) {
  const result = await apiPost('cloudinary-sign', { action: 'check', folder: 'zikr_chat', groupId, mediaType: 'video' });
  if (!result.available) throw new Error(result.message || 'L’envoi de vocaux n’est pas activé. Contactez l’administration.');
}

export async function uploadImage(file, folder) {
  return uploadToCloudinary(file, { folder, groupId: undefined, resourceType: 'image' });
}

// Pièce jointe de la discussion d'un zikr collectif (image ou vocal) — voir
// app/zikr/page.tsx et pages/api/cloudinary-sign.js (folder="zikr_chat",
// autorisation par appartenance au groupe, PAS par statut vendeur). `groupId`
// est exigé par le serveur pour cette voie (vérifie qu'on est bien membre).
// Cloudinary héberge l'audio sous resource_type="video" (pas "audio", qui
// n'existe pas côté API Upload) — voir sa doc officielle.
export async function uploadZikrChatMedia(file, groupId, resourceType) {
  return uploadToCloudinary(file, { folder: 'zikr_chat', groupId, resourceType });
}

async function uploadToCloudinary(file, { folder, groupId, resourceType }) {
  let sign;
  try { sign = await apiPost('cloudinary-sign', { folder, groupId, mediaType: resourceType }); }
  catch (error) {
    if (error.code === 'UPLOAD_NOT_CONFIGURED') throw new Error(resourceType === 'video'
      ? 'L’envoi de vocaux n’est pas activé. Contactez l’administration ; les messages écrits restent disponibles.'
      : 'L’envoi d’images n’est pas activé. Contactez l’administration.');
    throw error;
  }
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', sign.apiKey);
  fd.append('timestamp', sign.timestamp);
  fd.append('signature', sign.signature);
  fd.append('folder', sign.folder);
  fd.append('upload_preset', sign.uploadPreset);
  let r;
  try {
    r = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/${resourceType}/upload`, {
      method: 'POST', body: fd, signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' || error.name === 'AbortError'
      ? 'L’envoi a pris trop de temps. Vérifiez votre connexion.'
      : 'Le transfert a été interrompu. Vérifiez votre connexion.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 413 ? 'Ce fichier est trop volumineux.'
    : 'Le service d’envoi a refusé ce fichier. Contactez l’administration si cela persiste.');
  if (typeof data.secure_url !== 'string' || !data.secure_url.startsWith('https://')) throw new Error('Le fichier envoyé n’a pas pu être confirmé. Réessayez.');
  return data.secure_url;
}
