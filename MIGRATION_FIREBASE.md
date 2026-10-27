# Migration des SDK Firebase

## Versions et exécution

- Client : `firebase` 13.1.0.
- Serveur : `firebase-admin` 14.5.0, imports modulaires `app`, `auth`, `database`, `messaging`.
- Environnement supporté du projet : Node **24.x** (24.12 minimum), identique à la CI et à `.nvmrc`.
  Vérifier aussi le réglage Node du projet Vercel avant la bascule.
- Le service worker passe à `v46.13` ; le cache des anciennes ressources est renouvelé.

`server/grant.js` conserve une petite façade pour les services utilisés par le
reste du serveur. Elle évite l’ancienne API de namespace supprimée par Admin 14,
réutilise l’application initialisée et conserve les garde-fous des émulateurs.
Aucune donnée de production n’est migrée ou effacée par ce changement.

## Audit des dépendances

Avec le verrou livré, `npm audit --omit=dev` ne signale **aucune vulnérabilité**.
`npm ls uuid --omit=dev` ne trouve plus de `uuid` dans les dépendances déployées.

L’audit complet signale encore **sept avis modérés dans les outils de développement** :
les chaînes `@capacitor/cli → xcode → uuid@7` et
`firebase-tools → gaxios → uuid@9`, ainsi que leurs avis propagés et
`@opentelemetry/core`. Ces outils ne sont pas importés dans l’application serveur.
Ils restent utilisés pour les builds natifs et les émulateurs : l’audit complet
n’est donc pas annoncé comme exempt d’alertes.

Ne pas forcer globalement une version majeure de `uuid` : ses API et ses formats
d’import diffèrent. Suivre les nouvelles versions de Capacitor CLI et Firebase CLI,
mettre à jour leurs parents lorsque corrigés, puis relancer audit, émulateurs et
build Android. Ne pas appliquer aveuglément `npm audit fix --force`.

## Contrôles et retour arrière

```bash
nvm use
npm ci
npm audit --omit=dev
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:auth
```

La suite authentifiée utilise les véritables SDK Auth/RTDB sur les émulateurs,
y compris commandes, compte et règles privées. Elle ne valide pas Google OAuth
réel ni la réception FCM sur téléphone : recette de préproduction indispensable.

En cas de retour arrière du SDK, restaurer ensemble `package.json`, le verrou et
`server/grant.js`, puis reconstruire. Conserver les lecteurs des nouveaux états de
commande et les index ; ne pas revenir au suivi des clics comme source de vente.
Le preload des seuls tests locaux adapte toujours le proxy du transport RTDB
embarqué et refuse une structure SDK inconnue au chargement.

## Incident du 27 octobre : Node 22 non supporté par le verrou complet

Le SDK Admin indique Node >=22, mais les modules `@firebase/app`, `@firebase/auth`
et plusieurs autres modules du SDK client installé exigent Node >=24.12.
Le projet avait été fixé à tort à Node 22 : Vercel ignorait alors son réglage
Node 24 et continuait malgré les avertissements `EBADENGINE`.

`package.json` impose maintenant 24.x, `.nvmrc` et tous les workflows utilisent
24, et `.npmrc` active `engine-strict`. L’installation échoue si la version
de Node ne respecte pas les exigences d’une dépendance, au lieu de livrer
un environnement non supporté. Sur Vercel, redéployer le nouveau commit avec
les variables de Production. Les erreurs runtime doivent être vérifiées dans
Logs : une compilation réussie ne prouve pas que les API fonctionnent.

Contrôle après déploiement : un POST JSON vide vers `/api/check-access`,
`/api/list-content` et `/api/account` doit répondre **401 en JSON**, jamais
500 en HTML. Cette vérification anonyme ne valide pas les secrets Firebase ;
compléter avec une connexion et une lecture authentifiées.

Le contrôle GET `/api/health` vérifie séparément l’import du SDK et son
initialisation. Il renvoie la version Node, l’étape et un code d’échec stable,
jamais les identifiants, un chemin absolu ou une stack. Une dépendance absente
peut être nommée. Il ne lit ni n’écrit dans Firebase et ne garantit pas la
connectivité à la base ; ce point nécessite une vraie requête authentifiée.
