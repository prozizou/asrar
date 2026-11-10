// server/whatsapp.js — Compte WhatsApp officiel ASRAR PRO (service client)
// via l'API WhatsApp Business Cloud de Meta. Utilisé par
// server/notificationTransport.js comme canal de notification supplémentaire.
//
// WhatsApp n'autorise, pour un message à l'initiative de l'entreprise, que
// des MODÈLES approuvés par Meta. Un seul modèle générique suffit :
//   nom    : WHATSAPP_TEMPLATE_NAME (déf. "asrar_notification")
//   langue : WHATSAPP_TEMPLATE_LANG (déf. "fr")
//   corps  : « ASRAR PRO — {{1}}\n\n{{2}}\n\nOuvrez l'application pour voir le détail. »
//            {{1}} = titre de la notification, {{2}} = aperçu
//   bouton (facultatif, WHATSAPP_TEMPLATE_URL_BUTTON=true) : bouton URL
//            dynamique « https://<site>/{{1}} » → chemin de la notification.
// Voir NOTIFICATIONS_WHATSAPP.md pour la mise en place chez Meta.

const DEFAULT_API_VERSION = "v21.0";

function whatsappConfig(env = process.env) {
  const token = String(env.WHATSAPP_CLOUD_TOKEN || "").trim();
  const phoneNumberId = String(env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!token || !/^\d{5,30}$/.test(phoneNumberId)) return null;
  const version = String(env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION).trim();
  return {
    token, phoneNumberId,
    version: /^v\d+\.\d+$/.test(version) ? version : DEFAULT_API_VERSION,
    template: String(env.WHATSAPP_TEMPLATE_NAME || "asrar_notification").trim(),
    lang: String(env.WHATSAPP_TEMPLATE_LANG || "fr").trim(),
    urlButton: env.WHATSAPP_TEMPLATE_URL_BUTTON === "true",
  };
}

const whatsappReady = (env = process.env) => !!whatsappConfig(env);

// Meta refuse les paramètres de modèle contenant retours à la ligne,
// tabulations ou plus de 4 espaces consécutifs, ainsi que les paramètres vides.
function templateParam(value, max) {
  const s = String(value == null ? "" : value).replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  return (s || "—").slice(0, max);
}

// Numéro au format attendu par l'API : chiffres seuls, indicatif compris.
function waRecipient(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
}

function buildTemplateMessage(cfg, to, notif) {
  const components = [{
    type: "body",
    parameters: [
      { type: "text", text: templateParam(notif.title, 200) },
      { type: "text", text: templateParam(notif.body, 700) },
    ],
  }];
  if (cfg.urlButton) {
    const suffix = String(notif.targetUrl || "/").replace(/^\/+/, "").slice(0, 300);
    components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: suffix || "?" }] });
  }
  return {
    messaging_product: "whatsapp", to, type: "template",
    template: { name: cfg.template, language: { code: cfg.lang }, components },
  };
}

// Erreur définitive (numéro sans WhatsApp, paramètre refusé…) : inutile de
// réessayer. Les limites de débit et pannes Meta, elles, sont réessayées.
function isPermanentWhatsAppError(error) {
  const status = Number(error?.statusCode) || 0;
  const code = Number(error?.metaCode) || 0;
  if ([4, 80007, 130429, 131048, 131056, 133016].includes(code)) return false; // débit
  if (status === 429 || status >= 500 || status === 0) return false;
  return status >= 400;
}

async function sendWhatsAppNotification(phone, notif, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const cfg = whatsappConfig(env);
  if (!cfg) throw Object.assign(new Error("WhatsApp non configuré."), { code: "WHATSAPP_NOT_CONFIGURED" });
  const to = waRecipient(phone);
  if (!to) throw Object.assign(new Error("Numéro WhatsApp invalide."), { code: "WHATSAPP_BAD_NUMBER", statusCode: 400 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetchImpl(`https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`, {
      method: "POST", signal: controller.signal,
      headers: { Authorization: "Bearer " + cfg.token, "Content-Type": "application/json" },
      body: JSON.stringify(buildTemplateMessage(cfg, to, notif)),
    });
  } catch (error) {
    throw Object.assign(new Error("WhatsApp injoignable."), { code: "WHATSAPP_NETWORK", statusCode: 0, cause: error });
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const metaCode = data?.error?.code;
    throw Object.assign(new Error(String(data?.error?.message || "Envoi WhatsApp refusé.").slice(0, 200)), {
      code: "WHATSAPP_" + (metaCode || response.status), statusCode: response.status, metaCode,
    });
  }
  return { id: data?.messages?.[0]?.id || null };
}

module.exports = {
  whatsappConfig, whatsappReady, sendWhatsAppNotification, buildTemplateMessage,
  isPermanentWhatsAppError, waRecipient, templateParam,
};
