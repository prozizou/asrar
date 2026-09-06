'use client';
// Upload d'une image vers Cloudinary via signature serveur — port d'uploadImage()
// de boutique.js. La signature est demandée à /api/cloudinary-sign (proxifié),
// puis le fichier est envoyé directement à Cloudinary (CORS autorisé).
import { apiPost } from './api';

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
  const sign = await apiPost('cloudinary-sign', groupId ? { folder, groupId } : { folder });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', sign.apiKey);
  fd.append('timestamp', sign.timestamp);
  fd.append('signature', sign.signature);
  fd.append('folder', sign.folder);
  // Uniquement si CLOUDINARY_UPLOAD_PRESET est configuré côté serveur (sinon
  // absent de la réponse) — doit être envoyé pour matcher la valeur signée.
  if (sign.uploadPreset) fd.append('upload_preset', sign.uploadPreset);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: fd,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.error && data.error.message) || "Échec de l'envoi du fichier.");
  return data.secure_url;
}
