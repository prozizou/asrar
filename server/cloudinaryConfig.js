// Server only. Never expose the returned credentials to the browser or logs.
function cloudinaryUploadConfig(env, mediaType = 'image') {
  const read = (name) => String(env[name] || '').trim();
  const cloudName = read('CLOUDINARY_CLOUD_NAME');
  const apiKey = read('CLOUDINARY_API_KEY');
  const apiSecret = read('CLOUDINARY_API_SECRET');
  const uploadPreset = mediaType === 'video'
    ? read('CLOUDINARY_AUDIO_UPLOAD_PRESET')
    : read('CLOUDINARY_IMAGE_UPLOAD_PRESET') || read('CLOUDINARY_UPLOAD_PRESET');
  const missing = [];
  if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!apiKey) missing.push('CLOUDINARY_API_KEY');
  if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');
  if (!uploadPreset) missing.push(mediaType === 'video'
    ? 'CLOUDINARY_AUDIO_UPLOAD_PRESET'
    : 'CLOUDINARY_IMAGE_UPLOAD_PRESET (ou CLOUDINARY_UPLOAD_PRESET)');
  return { cloudName, apiKey, apiSecret, uploadPreset, configured: missing.length === 0, missing };
}
module.exports = { cloudinaryUploadConfig };
