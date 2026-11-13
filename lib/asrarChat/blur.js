'use client';
// Aperçu FLOUTÉ d'un contenu payant, calculé dans le navigateur : seule cette
// image dégradée (petite, floutée) est envoyée dans l'espace public. Les
// pixels nets du contenu restent dans l'espace privé.
async function drawSource(file) {
  const url = URL.createObjectURL(file);
  try {
    if (String(file.type).startsWith('video/')) {
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = url;
      await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error('Vidéo illisible pour l’aperçu.')); });
      video.currentTime = Math.min(1, (video.duration || 2) / 3);
      await new Promise((resolve) => { video.onseeked = resolve; setTimeout(resolve, 1500); });
      return { source: video, w: video.videoWidth, h: video.videoHeight };
    }
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/**
 * Image JPEG (≈ 480 px de large) à partir d'une image ou d'une vidéo :
 * floutée pour un contenu payant, simplement réduite pour un contenu gratuit.
 */
export async function blurredPreview(file, { blur = true } = {}) {
  const { source, w, h } = await drawSource(file);
  if (!w || !h) throw new Error('Aperçu impossible pour ce fichier.');
  if (!blur) {
    const out = document.createElement('canvas');
    out.width = Math.min(480, w); out.height = Math.max(1, Math.round((out.width * h) / w));
    out.getContext('2d').drawImage(source, 0, 0, out.width, out.height);
    const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob) throw new Error('Aperçu impossible pour ce fichier.');
    return new File([blob], 'apercu.jpg', { type: 'image/jpeg' });
  }
  // 1) réduction extrême (24 px) : les détails sont perdus définitivement ;
  const tiny = document.createElement('canvas');
  tiny.width = 24; tiny.height = Math.max(1, Math.round((24 * h) / w));
  tiny.getContext('2d').drawImage(source, 0, 0, tiny.width, tiny.height);
  // 2) agrandissement lissé + flou supplémentaire.
  const out = document.createElement('canvas');
  out.width = 480; out.height = Math.max(1, Math.round((480 * h) / w));
  const ctx = out.getContext('2d');
  ctx.filter = 'blur(14px)';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tiny, -20, -20, out.width + 40, out.height + 40);
  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.7));
  if (!blob) throw new Error('Aperçu impossible pour ce fichier.');
  return new File([blob], 'apercu.jpg', { type: 'image/jpeg' });
}
