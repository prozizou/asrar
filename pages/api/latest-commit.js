// api/latest-commit.js — Dernier commit du dépôt, pour l'entrée « Releases »
// du menu drawer : affiche un dialogue en app (retour utilisateur : pas une
// redirection vers une page GitHub externe). Appel côté serveur uniquement —
// le dépôt est privé, il faut un jeton GitHub pour le lire ; on ne met JAMAIS
// ce jeton dans le bundle client.
//
// Variable d'environnement optionnelle : GITHUB_TOKEN (scope lecture repo).
// Sans elle, la requête GitHub échoue si le dépôt est privé (message clair
// renvoyé au client plutôt qu'un blocage silencieux).

const { verifyUser } = require("../../server/access");
const { setCors, parseBody } = require("../../server/http");
const { reportError } = require("../../server/log");

const OWNER = "prozizou";
const REPO = "asrar";
const BRANCH = "main";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken } = parseBody(req);

  try {
    await verifyUser(idToken); // identité requise (comme le reste de l'app), pas de palier particulier

    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`, { headers });
    if (!r.ok) {
      const reason = r.status === 404 ? "Dépôt inaccessible (privé sans jeton configuré ?)." : `Erreur GitHub (${r.status}).`;
      return res.status(502).json({ error: reason });
    }
    const d = await r.json();
    const fullMessage = (d.commit && d.commit.message) || "";
    const [title, ...rest] = fullMessage.split("\n");

    return res.status(200).json({
      sha: d.sha || "",
      shortSha: (d.sha || "").slice(0, 7),
      title: title || "(sans message)",
      body: rest.join("\n").trim(),
      author: (d.commit && d.commit.author && d.commit.author.name) || (d.author && d.author.login) || "",
      date: (d.commit && d.commit.author && d.commit.author.date) || null,
      url: d.html_url || `https://github.com/${OWNER}/${REPO}/commit/${d.sha || ""}`,
    });
  } catch (e) {
    if (!e.statusCode) await reportError("latest-commit", e);
    return res.status(e.statusCode || 500).json({ error: e.message || "Erreur serveur." });
  }
}
