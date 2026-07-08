# Al-Qalam — sous-app de calligraphie

PWA de composition de dhikr / calligraphie arabe (modules ES), intégrée au hub
ASRAR PRO. Fonctions premium réservées aux **abonnés** ASRAR PRO.

## Fichiers
- `index.html` — charge le SDK Firebase **compat** + `../js/firebase-config.js` +
  `../js/api-content.js` (scripts classiques), puis `main.js` (module).
- `main.js` — UI + intégration paiement/abonnement (gate via `checkAccess` global,
  portail via `showSubscriptionGate`).
- `firebase_db.js` — lecture des sourates/versets sur l'**app compat globale**
  (`firebase.database()`), avec cache hors-ligne `localStorage`.
- `config.js`, `store.js`, `ui_tools.js`, `pdf.js`, `formatter.js`, `style.css` —
  logique applicative (inchangée).

## Modèle d'accès
Accès Al-Qalam = **abonnement ASRAR PRO actif** (pas de produit séparé). Les
actions premium (écriture, intercalation, mode Rasm, génération PDF, cumul,
polices) passent par `requireAlQalamAccess(actionFn, libellé)` :
- abonné → l'action s'exécute ;
- non abonné → ouverture du **portail PayDunya** (offres réelles `sub_*`).

## Données
Lecture des nœuds `sourate` et `versetRef` (Coran), avec repli sur le cache local
si le réseau est indisponible. Ces nœuds ne sont pas du contenu payant.

## Important
Charger les scripts globaux **dans `<head>` avant `main.js`** (déjà configuré
dans `index.html`). Le gate côté client est un confort d'UX ; l'outil lui-même
reste exécuté dans le navigateur.
