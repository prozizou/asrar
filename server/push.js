// api/_lib/push.js — Envoi de notifications push (FCM) au topic "new-content"
// (déclenché quand un secret, un document ou un produit est ajouté). Best-
// effort : ne doit jamais faire échouer l'écriture qui l'appelle (mêmes
// précautions que track.js).

const { app } = require("./grant");

const TOPIC = "new-content";

async function notifyNewContent({ title, body, url }) {
  try {
    await app().messaging().send({
      topic: TOPIC,
      notification: {
        title: String(title || "ASRAR PRO").slice(0, 120),
        body: String(body || "").slice(0, 200)
      },
      webpush: {
        notification: { icon: "/assets/icon-192.png" },
        fcmOptions: url ? { link: url } : undefined
      }
    });
  } catch (e) {
    console.error("push:", e.message);
  }
}

module.exports = { notifyNewContent, TOPIC };
