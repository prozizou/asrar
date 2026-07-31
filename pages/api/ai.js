// api/ai.js (Vercel) — Assistant IA (Gemini) pour Al-Qalam et Géomancie.
//
// L'IA ne fait que PILOTER les actions déjà existantes de la page (jamais de
// contenu religieux inventé) : elle retourne une action JSON strictement
// typée par un schéma dédié à chaque module, appliquée ensuite côté client
// sur les fonctions/états déjà en place (lib/alqalam.js, lib/geomancie.js).
//
// Body (JSON) : { idToken, module: "alqalam"|"geomancie", prompt, context? }
//   context.sourates (alqalam) : noms des sourates chargées, pour contraindre
//   le champ "sourate" à une valeur réellement disponible (enum).

const { verifyUser, hasActiveAccess } = require("../../server/access");
const { callGemini } = require("../../server/gemini");
const { setCors, parseBody } = require("../../server/http");

const SYSTEM_PROMPTS = {
  alqalam:
    "Tu es l'assistant du module Al-Qalam (calligraphie/dhikr) de l'application ASRAR PRO. " +
    "Tu ne fais QUE piloter les commandes déjà existantes de cette page, tu n'inventes jamais " +
    "de contenu religieux toi-même. Actions possibles : " +
    "write (afficher un texte répété N fois — le texte doit être EXACTEMENT celui cité par " +
    "l'utilisateur, jamais composé par toi) ; toggle_rasm (activer/désactiver le mode Rasm, " +
    "sans diacritiques) ; intercalate (intercaler la phrase citée entre les versets d'une " +
    "sourate parmi celles listées dans le contexte fourni) ; export_doc (générer un fichier " +
    "Word du texte déjà écrit) ; unclear si la demande ne correspond à aucune de ces actions, " +
    "ou si le texte à écrire n'est pas explicitement donné par l'utilisateur. 'message' est " +
    "une courte confirmation en français à afficher à l'utilisateur, jamais un raisonnement.",
  geomancie:
    "Tu es l'assistant du module Géomancie (Tourab) de l'application ASRAR PRO. Actions " +
    "possibles : random_draw (nouveau tirage aléatoire des 4 Mères puis calcul de l'écu) ; " +
    "reset (remettre les Mères à zéro) ; calculate (calculer l'écu avec les Mères actuelles) ; " +
    "open_house (ouvrir le détail d'une maison précise, house=1 à 16 ; 15=Juge, 16=Sentence) ; " +
    "unclear si la demande ne correspond à aucune de ces actions. 'message' est une courte " +
    "confirmation en français à afficher à l'utilisateur, jamais un raisonnement."
};

function schemaFor(mod, context) {
  if (mod === "alqalam") {
    const sourates = Array.isArray(context && context.sourates) ? context.sourates.slice(0, 250) : [];
    const sourateProp = { type: "STRING" };
    if (sourates.length) sourateProp.enum = sourates;
    return {
      type: "OBJECT",
      properties: {
        action: { type: "STRING", enum: ["write", "toggle_rasm", "intercalate", "export_doc", "unclear"] },
        text: { type: "STRING" },
        repCount: { type: "INTEGER" },
        rasmOn: { type: "BOOLEAN" },
        sourate: sourateProp,
        docName: { type: "STRING" },
        useOuverture: { type: "BOOLEAN" },
        useFermeture: { type: "BOOLEAN" },
        message: { type: "STRING" }
      },
      required: ["action", "message"]
    };
  }
  if (mod === "geomancie") {
    return {
      type: "OBJECT",
      properties: {
        action: { type: "STRING", enum: ["random_draw", "reset", "calculate", "open_house", "unclear"] },
        house: { type: "INTEGER" },
        message: { type: "STRING" }
      },
      required: ["action", "message"]
    };
  }
  return null;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, module: mod, prompt, context } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  if (!(await hasActiveAccess(user))) {
    return res.status(403).json({ error: "Abonnement requis pour l'assistant IA." });
  }

  const systemPrompt = SYSTEM_PROMPTS[mod];
  const schema = schemaFor(mod, context);
  if (!systemPrompt || !schema) return res.status(400).json({ error: "Module inconnu." });

  const userPrompt = String(prompt || "").trim().slice(0, 500);
  if (!userPrompt) return res.status(400).json({ error: "Demande vide." });

  try {
    const action = await callGemini({ systemPrompt, userPrompt, schema });
    return res.status(200).json({ ok: true, action });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};
