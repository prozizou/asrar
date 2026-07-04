// api/wa.js (Vercel) — Redirection WhatsApp avec NUMÉRO côté serveur.
//
// Le numéro n'est JAMAIS dans le code client : il vient de la variable
// d'environnement Vercel « WHATSAPP_NUMBER » (format international, sans « + »
// ni espaces, ex : 221771234567). Cette fonction lit ce numéro, y ajoute le
// message reçu et redirige (302) le navigateur vers WhatsApp.
//
// Usage (navigation, pas un fetch) :  /api/wa?text=<message>
//   → 302 vers https://wa.me/<numéro>?text=<message>

module.exports = (req, res) => {
  const number = String(process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "");

  if (!number) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(
      "<meta charset='utf-8'><p style='font-family:system-ui;padding:24px'>" +
      "⚙️ Configuration manquante : définissez la variable d'environnement " +
      "<b>WHATSAPP_NUMBER</b> dans Vercel (Settings → Environment Variables), " +
      "puis redéployez.</p>"
    );
  }

  const q = (req.query && typeof req.query.text === "string") ? req.query.text : "";
  const text = q.slice(0, 1500); // garde-fou longueur

  const url = "https://wa.me/" + number + (text ? "?text=" + encodeURIComponent(text) : "");

  res.statusCode = 302;
  res.setHeader("Location", url);
  res.setHeader("Cache-Control", "no-store");
  res.end();
};
