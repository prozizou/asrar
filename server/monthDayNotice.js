// server/monthDayNotice.js — « Date du jour » diffusée à TOUS les utilisateurs
// le 1er et le 16 de chaque mois, grégorien OU hégirien (demande produit).
// Appelé par pages/api/cron/reminders.js (toutes les 10 min) : une seule
// notification par jour (marqueur month_day_notices/{AAAA-MM-JJ} + eventId
// stable), envoyée à partir de SEND_FROM_HOUR_UTC (heure de Dakar = UTC).
// Partagée sur WhatsApp aussi (whatsappBroadcast) pour qui l'a activé.

const { fetchHijriToday } = require("../lib/hijri");
const { enqueueNotification } = require("./notificationQueue");
const { monthDayNotification } = require("../lib/notifyTemplates");

const SEND_FROM_HOUR_UTC = 7;
const FR_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const FR_DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const dayKey = (now) => now.toISOString().slice(0, 10);

function gregorianLabel(now) {
  return `${FR_DAYS[now.getUTCDay()]} ${now.getUTCDate()} ${FR_MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
}

// Date hégirienne : AlAdhan (même source que la page « Date du jour »),
// repli sur le calendrier Umm al-Qura du moteur JavaScript si l'API échoue.
async function hijriOf(now, fetchHijri = fetchHijriToday) {
  try {
    const { hijri } = await fetchHijri(new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = Number(hijri.day);
    if (day >= 1 && day <= 30) {
      return { day, label: `${day} ${hijri.monthEn}${hijri.monthAr ? " (" + hijri.monthAr + ")" : ""} ${hijri.year} H` };
    }
  } catch (_) { /* repli ci-dessous */ }
  const parts = new Intl.DateTimeFormat("fr-FR-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .formatToParts(now);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || "";
  const day = Number(get("day"));
  return { day, label: `${day} ${get("month")} ${get("year").replace(/\D/g, "")} H` };
}

async function queueMonthDayNotice(db, now = new Date(), { fetchHijri } = {}) {
  if (now.getUTCHours() < SEND_FROM_HOUR_UTC) return { status: "early" };
  const key = dayKey(now);
  const marker = db.ref("month_day_notices/" + key);
  if ((await marker.once("value")).exists()) return { status: "done" };
  const gDay = now.getUTCDate();
  const hijri = await hijriOf(now, fetchHijri);
  const due = gDay === 1 || gDay === 16 || hijri.day === 1 || hijri.day === 16;
  if (due) {
    await enqueueNotification(db, { type: "all" }, {
      ...monthDayNotification({ gregorian: gregorianLabel(now), hijri: hijri.label, gDay, hDay: hijri.day }),
      senderName: "ASRAR PRO", targetUrl: "/hijri", whatsappBroadcast: true,
      expiresAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      meta: { tagSuffix: key },
    }, "month-day:" + key);
  }
  await marker.set({ at: Date.now(), sent: due, gDay, hDay: hijri.day });
  return { status: due ? "queued" : "not-due", gDay, hDay: hijri.day };
}

module.exports = { queueMonthDayNotice, hijriOf, gregorianLabel, SEND_FROM_HOUR_UTC };
