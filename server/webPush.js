const webpush = require("web-push");

// Fournisseurs Web Push des navigateurs pris en charge. Cette validation est
// répétée à l'envoi : les anciens abonnements stockés ne sont pas fiables.
function isValidPushEndpoint(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length > 4096 || /[\s\\]/.test(endpoint)) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname;
    return host === "fcm.googleapis.com" || host === "web.push.apple.com" ||
      host === "updates.push.services.mozilla.com" ||
      /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
  } catch { return false; }
}

function validBase64Key(value, bytes) {
  return typeof value === "string" && /^[A-Za-z0-9_-]+={0,2}$/.test(value) &&
    value.length <= 100 && Buffer.from(value, "base64url").length === bytes;
}

function isValidSubscription(subscription) {
  return !!subscription && isValidPushEndpoint(subscription.endpoint) &&
    validBase64Key(subscription.keys?.p256dh, 65) &&
    Buffer.from(subscription.keys.p256dh, "base64url")[0] === 4 &&
    validBase64Key(subscription.keys?.auth, 16);
}

function sendWebPush(subscription, payload, options = {}) {
  if (!isValidSubscription(subscription)) {
    // Même traitement qu'un abonnement expiré : suppression par l'appelant.
    return Promise.reject(Object.assign(new Error("Abonnement push invalide."), { statusCode: 410 }));
  }
  return webpush.sendNotification(subscription, payload, { ...options, timeout: 10000 });
}

module.exports = { isValidPushEndpoint, isValidSubscription, sendWebPush };
