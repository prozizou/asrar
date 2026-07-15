# Partage (liens profonds) & Parrainage — ASRAR PRO

Deux fonctionnalités ajoutées, qui partagent le même lien court `/s`.

---

## 1. Liens partageables (deep links)

### Format

```
https://<site>/s?k=<type>&c=<catégorie>&i=<clé>&r=<code parrain>
https://<site>/s?r=<code parrain>            ← lien simple de l'application
```

| `k` | Élément | Page ouverte | `c` requis |
|---|---|---|---|
| `secret`  | Secret Mystique | `/asrar/asrar.html` | oui (`deblocage`, `domptage`, `ilham`, `protection`, `ouverture`) |
| `book`    | Ouvrage Almaqtab | `/bibliotheque/bibliotheque.html` | non |
| `product` | Produit du Marché | `/marche/marche.html` | non |

### Ce qui se passe au clic

1. `/s` est réécrit vers **`/api/share`** (voir `vercel.json`).
2. `api/share.js` renvoie une page d'**aperçu Open Graph** (titre + image) : c'est
   elle que lisent les robots de WhatsApp, Messenger, Facebook, TikTok, Telegram
   pour afficher la vignette du lien.
3. Le visiteur humain est aussitôt redirigé vers
   `…/asrar.html?item=<clé>&cat=<cat>&r=<code>`.
4. `js/share.js` lit `?item`/`?cat`, le module ouvre l'élément, et l'URL est nettoyée.
5. **Non connecté ?** `loginUrl()` renvoie vers `index.html?next=<destination>` ;
   après le Google Sign-In, l'utilisateur atterrit **sur l'élément partagé**.

### Le paywall n'est pas affaibli

`api/share.js` ne lit **que** le titre et l'image (métadonnées déjà présentes dans
les listes) — jamais `sirr`, `pdf`, `description` vendeur. L'ouverture réelle passe
toujours par `ensureAccess()` + `/api/get-content` (vérification serveur).

> Cette page d'aperçu est **publique** (les robots ne peuvent pas se connecter) :
> le **titre** d'un secret partagé devient donc visible dans la vignette. Pour un
> aperçu générique (logo + « ASRAR PRO » seulement), passez
> `SHARE_SHOW_TITLES = false` en tête de `api/share.js`.

### Boutons de partage ajoutés

- **Secrets** : `📤 Partager` dans la barre du détail et du lecteur plein écran.
- **Bibliothèque** : bouton 📤 sur chaque carte livre.
- **Marché** : bouton 📤 dans la modale produit.

Ils utilisent l'API **Web Share** native (WhatsApp, Messenger, TikTok… apparaissent
dans la feuille de partage Android/iOS) avec repli **copie du lien**.

---

## 2. Parrainage — gagner un abonnement en partageant

### Règle appliquée

| Paramètre (`api/referral.js`) | Valeur | Rôle |
|---|---|---|
| `POINTS_PER_INVITE` | **10** | points par filleul |
| `POINTS_FOR_REWARD` | **1000** | seuil de la récompense (= 100 filleuls) |
| `REWARD_DAYS` | **90** | abonnement offert : 3 mois |
| `MAX_ACCOUNT_AGE_MS` | 7 j | un filleul doit être un compte **récent** |

### ⚠️ Pourquoi pas « 10 points par clic »

Un clic est **gratuit et infiniment répétable** : n'importe qui rechargerait son
propre lien 100 fois (ou lancerait une boucle `curl`) et obtiendrait 3 mois en
2 minutes. Le crédit est donc déclenché par le **premier accès d'un NOUVEAU
compte Google** venu du lien :

- 1 seul crédit par compte filleul → nœud `referred/{uid}` posé par **transaction** ;
- auto-parrainage refusé (parrain ≠ filleul) ;
- compte créé il y a plus de 7 jours → **pas de points** (un ancien membre ne peut
  pas « se faire parrainer » par un ami) ;
- identité toujours issue du **jeton Firebase vérifié serveur**, jamais du body.

Les **clics bruts sont quand même comptés** (`referrals/{uid}/clicks`, par
`/api/share`) et affichés dans le tableau de bord : c'est une statistique de
diffusion, sans valeur en points.

Si vous voulez malgré tout créditer au clic, il suffit d'appeler la même logique
depuis `countClick()` dans `api/share.js` — mais prévoyez au minimum une
limitation par IP + un plafond quotidien.

### Parcours

1. `/parrainage/parrainage.html` → `/api/referral` `{action:'me'}` crée (une fois)
   un code court unique (ex. `K7M2QP`) et renvoie le lien
   `https://<site>/s?r=K7M2QP`.
2. L'utilisateur partage (bouton natif ou copie). **Tous** les liens d'éléments
   partagés depuis l'app contiennent déjà son code.
3. Le visiteur clique → `js/share.js` mémorise le code (30 j, `localStorage`) →
   à sa **première connexion**, `{action:'claim'}` est envoyé → le serveur tranche.
4. À 1000 points : bouton **« 🔓 Activer 3 mois »** → `{action:'redeem'}` :
   débit atomique des points, puis écriture de
   `purchased_user/{cléEmail}` = `{ token, plan:'sub_3m', level:15000, source:'referral', expiresAt }`.
   L'abonnement en cours est **prolongé** (jamais écrasé) ; en cas d'erreur, les
   points sont **restitués**.
5. La passerelle « Abonnement requis » propose désormais le parrainage à ceux qui
   n'ont pas les moyens de payer.

### Données (RTDB — écriture serveur uniquement)

```
referrals/{uid}       = { code, email, points, clicks, invited, rewards, createdAt, lastAt, lastClickAt }
referral_codes/{code} = uid
referred/{uidFilleul} = { by, at, credited, points?, reason? }
```

---

## 3. Déploiement

1. Fusionner les nouvelles règles de `rules/purchases.rules.json` (bloc
   `_comment_parrainage` : `referrals`, `referral_codes`, `referred`) dans les
   règles RTDB.
2. Vérifier la variable **`SITE_URL`** sur Vercel (ex. `https://asrar-hub.vercel.app`) :
   elle sert à construire les liens `/s` et les URL Open Graph absolues.
   À défaut, l'hôte de la requête est utilisé.
3. Déployer. `vercel.json` route déjà `/s` → `/api/share`.
4. `sw.js` est passé en **v26.0** (le `/s` n'est jamais mis en cache) : les
   utilisateurs reçoivent la mise à jour automatiquement.
5. Test rapide :
   `https://<site>/s?k=secret&c=deblocage&i=<cléRéelle>` doit afficher l'aperçu
   puis ouvrir le secret ; collez le lien dans WhatsApp pour voir la vignette.

## 4. Fichiers

**Nouveaux** : `api/share.js`, `api/referral.js`, `js/share.js`,
`parrainage/parrainage.html`, ce document.

**Modifiés** : `vercel.json` (rewrite `/s`), `sw.js` (v26.0 + bypass),
`js/firebase-config.js` (`loginUrl()` + CTA parrainage dans la passerelle),
`index.html` (`?next=`), `accueil/accueil.html` (entrée 🎁 Parrainage),
`asrar/asrar.html` + `asrar/asrar.js`, `bibliotheque/bibliotheque.html`,
`marche/marche.html` + `marche/marche.js`, `rules/purchases.rules.json`.
