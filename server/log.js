// server/log.js — Point d'accroche pour le suivi d'erreurs (Admin SDK only).
//
// Avant : erreurs serveur inégalement journalisées (certaines fonctions
// avaient un console.error, la plupart des 500 inattendus n'étaient PAS
// journalisés du tout — l'erreur partait au client sans laisser de trace
// exploitable côté serveur). reportError() centralise et structure la
// journalisation, ET ajoute un point d'accroche optionnel vers un service de
// suivi d'erreurs (Sentry, Slack, Discord, PagerDuty…) : n'importe quel
// service acceptant un POST JSON sur une URL de webhook (ERROR_WEBHOOK_URL),
// sans dépendre d'un SDK propriétaire. Rien n'est envoyé si la variable
// n'est pas définie — comportement par défaut inchangé (logs Vercel).

/**
 * @param {string} scope route/action d'origine (ex. "get-content", "referral:redeem")
 * @param {unknown} error erreur capturée (Error ou valeur quelconque)
 * @param {Record<string, unknown>} [extra] contexte additionnel (uid, action…)
 */
async function reportError(scope, error, extra = {}) {
  const payload = {
    level: "error",
    scope,
    message: (error && error.message) || String(error),
    stack: error && error.stack,
    at: new Date().toISOString(),
    ...extra,
  };

  // Toujours journalisé : les logs Vercel (et tout log drain branché dessus)
  // captent cette ligne JSON, filtrable/alertable même sans APM dédié.
  console.error(JSON.stringify(payload));

  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best-effort : un webhook indisponible ne doit jamais faire échouer la requête d'origine.
  }
}

module.exports = { reportError };
