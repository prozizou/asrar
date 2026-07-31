// api/_lib/gemini.js — Appel à l'API Gemini (Google AI, gratuite) en sortie
// JSON structurée (responseSchema).
//
// Modèle : gemini-flash-lite-latest. Testé face à gemini-flash-latest (3.6
// Flash, "thinking" activé par défaut) dont le raisonnement interne polluait
// les champs structurés malgré responseSchema (thinkingBudget:0 y est refusé
// par l'API) — flash-lite reste fiable pour cette tâche d'extraction pure.
//
// Variable d'environnement : GEMINI_API_KEY (clé gratuite, aistudio.google.com/apikey).

const MODEL = "gemini-flash-lite-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

async function callGemini({ systemPrompt, userPrompt, schema }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const e = new Error("Assistant IA non configuré (GEMINI_API_KEY manquante).");
    e.statusCode = 503;
    throw e;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("gemini:", res.status, txt.slice(0, 300));
    const e = new Error(res.status === 429 ? "Assistant IA : quota atteint, réessayez dans quelques instants." : "Assistant IA indisponible.");
    e.statusCode = res.status === 429 ? 429 : 502;
    throw e;
  }

  const data = await res.json();
  const text = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
  if (!text) {
    const e = new Error("Réponse IA vide.");
    e.statusCode = 502;
    throw e;
  }
  try {
    return JSON.parse(text);
  } catch {
    const e = new Error("Réponse IA invalide.");
    e.statusCode = 502;
    throw e;
  }
}

module.exports = { callGemini };
