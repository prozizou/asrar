# Asrar-chat — messagerie sociale et commerciale

Module `/asrar-chat` (menu Spiritualité) : discussions privées, groupes et
chaînes, publications gratuites ou payantes, achat par **paiement direct au
vendeur**, bibliothèque, ventes et administration.

## Architecture

| Couche | Fichiers |
| --- | --- |
| Règles pures (partagées client/serveur) | `lib/asrarChat/logic.js` |
| API unique (POST `{ idToken, action, … }`) | `pages/api/asrar-chat.js` |
| Serveur | `server/asrarChat/core.js` (chemins, profils, audit, signaux), `media.js` (Cloudinary privé), `profiles.js`, `chat.js`, `posts.js`, `orders.js`, `moderation.js` |
| Client | `lib/asrarChat/client.js` (API), `upload.js` (envoi signé), `blur.js` (aperçu flouté), `live.js` (signaux temps réel) |
| Interface | `app/asrar-chat/*` : `page.tsx` (navigation Discussions · Explorer · Publier · Achats · Profil), `ChatRoom`, `Explore`, `Publish`, `Purchases`, `Profile`, `PostSheet`, `OrderSheet`, `Storefront`, `Admin` |
| Règles RTDB | `rules/database.rules.json` (nœuds `ac_*`) |

Toutes les écritures passent par l'API (Firebase Admin SDK). Le navigateur ne
lit en direct que des **signaux sans contenu** (`ac_signals/{cid}`,
`ac_inbox_signals/{uid}`) et l'indicateur « en train d'écrire »
(`ac_typing/{cid}/{uid}`, seule écriture directe autorisée, horodatage
serveur, membres uniquement). Le contenu est toujours relu par l'API, avec
sondage de secours si le temps réel est indisponible.

## Données (RTDB)

- `ac_profiles/{uid}` — pseudonyme, nom, bio, photo, `seller` (lien Wave,
  numéro Wave, alias PI-SPI, WhatsApp), statistiques. `ac_handles/{handle}`
  garantit l'unicité des pseudonymes (transaction).
- `ac_convs/{cid}`, `ac_members/{cid}/{uid}` (rôle owner/admin/member,
  `lastReadAt`), `ac_user_convs/{uid}`, `ac_messages/{cid}/{mid}`.
  Discussion privée : `cid = dm_<uidA>_<uidB>` (triés).
- `ac_posts/{pid}` (partie publique) et `ac_post_content/{pid}` (contenu
  intégral, jamais lu sans droit).
- `ac_orders/{oid}` + index `ac_buyer_orders`, `ac_seller_orders`,
  `ac_order_refs` (référence unique AC-XXXX-XXXX), `ac_payment_refs`
  (détection d'une référence de transaction réutilisée).
- `ac_entitlements/{uid}/{pid}` — droit d'accès (durée optionnelle, révocable).
- `ac_favorites`, `ac_ratings`, `ac_blocks`, `ac_bans`, `ac_reports`,
  `ac_suspended`, `ac_settings/commissionRate`, `ac_audit` (journal).

## Paiement direct au vendeur

L'argent ne transite pas par la plateforme : aucune confirmation automatique
n'est possible (pas de webhook). Règle absolue : **l'accès n'est jamais
accordé sur la seule déclaration de l'acheteur** (référence, capture).

1. L'acheteur choisit Wave, PI-SPI ou WhatsApp parmi les moyens du vendeur ;
   une commande unique est créée (pas de doublon par publication).
2. Instructions : lien marchand Wave avec montant prérempli, ou numéro Wave,
   alias PI-SPI, lien WhatsApp avec la référence.
3. L'acheteur déclare la référence de transaction → `declared`. Rien n'est
   débloqué ; le vendeur est notifié.
4. Le vendeur vérifie **sur son propre compte** la réception et confirme en
   cochant « J'ai vérifié… » → `paid` (transaction RTDB : une seule
   confirmation compte) → droit d'accès créé, ventes et revenus actualisés,
   acheteur notifié.
5. Sinon « Paiement non reçu » → l'acheteur corrige ou ouvre un litige,
   tranché par l'administration (accès, remboursement ou annulation).
   Un remboursement retire l'accès.

Transitions autorisées par rôle : `canTransition()` dans `lib/asrarChat/logic.js`.
La commission (taux réglé par l'administration, 0–50 %) est calculée et
suivie par vente confirmée ; elle est due par le vendeur, puisque la
plateforme n'encaisse pas. Il n'y a donc pas de retrait à gérer.

Pour une confirmation automatique par webhook, il faudrait que la plateforme
encaisse elle-même (API Wave Checkout avec compte marchand ASRAR PRO).

## Stockage privé des fichiers

- Envoi direct vers Cloudinary avec une signature serveur qui impose le
  dossier `ac/{uid}/private` (type `private`) ou `ac/{uid}/public`, et la liste
  des formats autorisés. Le serveur n'accepte ensuite que des fichiers du
  dossier du compte qui publie.
- Lecture : liens de téléchargement **signés et temporaires (15 min)**
  (`api.cloudinary.com/…/download?…&expires_at=…`), délivrés seulement à qui a
  le droit (membre de la discussion, acheteur confirmé, vendeur, admin).
- Aperçu d'un contenu payant : image réduite à 24 px puis floutée **dans le
  navigateur** avant envoi : les pixels nets ne sont jamais publics.
- Lecture vidéo/audio sans bouton de téléchargement, menu contextuel désactivé.
  Une capture d'écran reste techniquement possible : c'est une limite
  inhérente à tout affichage.

## Sécurité et modération

- Authentification Firebase vérifiée à chaque appel (e-mail vérifié).
- Limites de requêtes par famille : lecture, écriture, envoi, fichiers,
  paiements, signalements.
- Blocage : un compte bloqué ne peut plus écrire ni commander.
- Signalements (compte, publication, message, discussion) : l'administration
  ne voit qu'une copie de l'élément signalé, jamais le reste d'une discussion
  privée. Décisions : classer, retirer le contenu, suspendre. Tout est
  journalisé (`ac_audit`).
- Pseudonymes réservés (admin, support, asrar…) non attribuables.

## Tests

- `tests/asrar-chat.test.js` : règles pures, scénario « vidéo à 1 500 FCFA »
  (verrouillée, commande, déclaration, confirmation vendeur, lien signé,
  revenus, remboursement), référence réutilisée, litige, messagerie, chaîne,
  groupe privé, médias privés, signature d'envoi, signalement et suspension.
- `e2e/authenticated/asrar-chat.spec.ts` : parcours réel à deux comptes dans
  le navigateur (chaîne, publication payante, paiement Wave, confirmation,
  bibliothèque) et discussion privée.

## Configuration

Variables déjà utilisées par l'application : `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (aucune nouvelle variable).
Déployer les règles RTDB (`rules/database.rules.json`) pour activer les
index et les signaux temps réel `ac_*`.
