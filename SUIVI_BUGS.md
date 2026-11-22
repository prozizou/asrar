# Suivi des bugs et lenteurs

L'application remonte à l'administration les problèmes que rencontrent les
utilisateurs. Ils se consultent dans l'onglet **Bugs** du panneau
d'administration (projet `admin-asrar-pro`).

## Ce qui est remonté

| Type | Source | Détecté par |
|---|---|---|
| Erreur | Exception JavaScript non rattrapée, promesse rejetée sans gestionnaire | `components/BugReporter.js` |
| Erreur | Écran planté (rendu React) | `app/error.js` |
| Erreur | Réponse 5xx d'une API | `lib/api.js` |
| Lenteur | Interface figée ≥ 2 s (`longtask`, Chrome / WebView Android) | `components/BugReporter.js` |
| Lenteur | Chargement initial de la page ≥ 10 s | `components/BugReporter.js` |
| Lenteur | Requête API ≥ 8 s, ou abandonnée après 15 s | `lib/api.js` |
| Signalement | Texte écrit par l'utilisateur (menu « Signaler un problème », écran d'erreur) | `components/ReportProblem.js` |

Ignoré (aucune valeur pour corriger l'application) : « Script error. »,
boucle ResizeObserver, extensions du navigateur, annulations volontaires,
scripts des régies publicitaires (`lib/bugReport.js`, `NOISE`).

## Circuit

1. `lib/bugReporter.js` met les rapports en file et les envoie par lots à
   `/api/client-error` (toutes les 5 s et au passage en arrière-plan). Au plus
   3 envois d'un même bug et 30 rapports automatiques par session. Un
   signalement utilisateur part immédiatement.
2. `pages/api/client-error.js` valide (`lib/bugReport.js`), limite le débit par
   IP (30/min, 5 signalements / 10 min), ajoute le type d'appareil et, si un
   jeton valide est joint, l'e-mail du compte. Les erreurs restent aussi
   journalisées par `server/log.js` (logs Vercel, `ERROR_WEBHOOK_URL`).
3. `server/bugReports.js` enregistre, dans la limite de 5 000 occurrences par jour :

```
bug_reports/groups/{empreinte}        bug regroupé : type, message, page, count,
                                      firstAt, lastAt, status (open|resolved),
                                      regressed, pile, plateformes, versions,
                                      maxMs / sumMs (lenteurs), reporter
bug_reports/events/{empreinte}/{id}   20 dernières occurrences : at, page,
                                      platform, version, durationMs, detail,
                                      stack, uid, email
bug_reports/daily/{AAAA-MM-JJ}        { _n, error, lag, user }
```

L'empreinte est calculée côté serveur : même type, même message (nombres et
identifiants neutralisés), même première ligne de pile (sans numéros de
ligne). Les lenteurs sont regroupées par nature et par page ; chaque
signalement forme son propre groupe.

Nœud serveur uniquement (règles `read/write: false`), index `lastAt` et
`status` déclarés dans `rules/database.rules.json` — à reporter dans la
console Firebase.

## Côté administration

L'onglet **Bugs** (`admin-bugs.js`, `api/bugs.js`) affiche le nombre de bugs
ouverts (pastille dans le menu), les erreurs, lenteurs et signalements des
7 derniers jours, la courbe sur 30 jours, puis la liste filtrable. Le détail
montre la pile d'appels et les dernières occurrences ; « Copier le rapport »
produit un texte prêt à transmettre. « Marquer comme résolu » : si le bug se
reproduit, il revient avec la mention « Revenu ». « Supprimer les résolus »
efface les bugs traités.
