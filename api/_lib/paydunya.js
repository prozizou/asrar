// api/_lib/paydunya.js — appels API PayDunya (fetch natif Node 18+, sans dépendance)
//
// Variables d'environnement utilisées :
//   PAYDUNYA_MODE         "live" | "test"   (défaut: test)
//   PAYDUNYA_MASTER_KEY
//   PAYDUNYA_PRIVATE_KEY
//   PAYDUNYA_TOKEN
//   STORE_NAME            nom affiché sur la page de paiement
//   STORE_LOGO_URL        (optionnel)
//   STORE_WEBSITE_URL     (optionnel)

const MODE = (process.env.PAYDUNYA_MODE || "test").toLowerCase();
const BASE = MODE === "live"
  ? "https://app.paydunya.com/api/v1"
  : "https://app.paydunya.com/sandbox-api/v1";

const clean = (v) => (v || "").replace(/\s+/g, ""); // enlève espaces / retours / espaces insécables

function headers() {
  return {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": clean(process.env.PAYDUNYA_MASTER_KEY),
    "PAYDUNYA-PRIVATE-KEY": clean(process.env.PAYDUNYA_PRIVATE_KEY),
    "PAYDUNYA-TOKEN": clean(process.env.PAYDUNYA_TOKEN)
  };
}

/**
 * Crée une facture de paiement.
 * @returns {Promise<{token:string, url:string}>} url = page de paiement à ouvrir
 */
async function createInvoice({ amount, itemName, description, customData, returnURL, cancelURL, callbackURL }) {
  const store = { name: process.env.STORE_NAME || "Ma boutique" };
  if (process.env.STORE_LOGO_URL) store.logo_url = process.env.STORE_LOGO_URL;
  if (process.env.STORE_WEBSITE_URL) store.website_url = process.env.STORE_WEBSITE_URL;

  const body = {
    invoice: {
      total_amount: amount,
      description,
      items: { item_1: { name: itemName, quantity: 1, unit_price: amount, total_price: amount } }
    },
    store,
    actions: { return_url: returnURL, cancel_url: cancelURL, callback_url: callbackURL },
    custom_data: customData
  };

  const r = await fetch(`${BASE}/checkout-invoice/create`, {
    method: "POST", headers: headers(), body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (data.response_code !== "00") {
    const detail = data.response_text || (data.errors && JSON.stringify(data.errors)) || JSON.stringify(data) || `HTTP ${r.status}`;
    throw new Error(`PayDunya create: ${detail}`);
  }
  return { token: data.token, url: data.response_text };
}

/**
 * Confirme l'état d'une facture (source de vérité serveur).
 * @returns {Promise<object>} { status: "completed"|"pending"|"cancelled"|"failed", custom_data, customer, receipt_url, invoice }
 */
async function confirmInvoice(token) {
  const r = await fetch(`${BASE}/checkout-invoice/confirm/${token}`, { headers: headers() });
  const data = await r.json().catch(() => ({}));
  if (data.response_code !== "00") {
    throw new Error(data.response_text || `PayDunya confirm: HTTP ${r.status}`);
  }
  return data;
}

module.exports = { createInvoice, confirmInvoice, MODE };
