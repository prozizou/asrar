// lib/nativeVersion.js — Version minimale de l'APK Android (mise à jour
// obligatoire, voir components/NativeUpdateGate.js). Logique pure, testable.

// Vrai si l'APK doit être mis à jour : version inconnue (APK antérieur au
// champ versionCode d'AsrarNative.getInfo) ou inférieure au minimum. Sans
// minimum configuré (0), rien n'est bloqué.
export function isAndroidVersionOutdated(versionCode, minVersionCode) {
  if (!minVersionCode) return false;
  const v = Number(versionCode);
  return !Number.isFinite(v) || v <= 0 || v < minVersionCode;
}
