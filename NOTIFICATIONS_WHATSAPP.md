# Notifications WhatsApp — compte officiel ASRAR PRO

Les utilisateurs qui le souhaitent reçoivent leurs notifications **sur WhatsApp**,
envoyées par **un seul compte : le WhatsApp Business d'ASRAR PRO**, comme un
service client. Ils l'activent dans **Mon compte → Mes préférences → Notifications
WhatsApp** en indiquant leur numéro (format international).

## Ce qui part sur WhatsApp

Uniquement les notifications **ciblées** (un ou quelques destinataires) :

- nouvelle demande de produit reçue par une boutique, réponse de la boutique ;
- messages des Zikr collectifs dont on est membre ;
- accès ASRAR PRO activé, etc.

Les **annonces envoyées à tous** (nouveau produit, nouvelle boutique, nouveau
Zikr collectif, nouveau Secret) restent dans l'application et en push : Meta
facture chaque message, une diffusion à tous les comptes coûterait cher.

Le canal s'ajoute aux autres (centre de notifications, push) sans les remplacer.
Tant que les variables ci-dessous ne sont pas définies, il est inactif et le
réglage n'apparaît pas dans la page Compte.

## Mise en place chez Meta (une seule fois)

1. **Compte Meta Business** : https://business.facebook.com, puis vérifier
   l'entreprise (Paramètres → Centre de sécurité).
2. **Application** : https://developers.facebook.com → Créer une application →
   type « Entreprise » → ajouter le produit **WhatsApp**.
3. **Numéro d'envoi** : WhatsApp → Configuration de l'API → ajouter un numéro.
   Prenez un numéro **dédié** : un numéro relié à l'API ne peut plus être utilisé
   dans l'application WhatsApp classique. Donnez-lui le nom d'affichage
   « ASRAR PRO » et la photo du logo.
4. **Modèle de message** (WhatsApp Manager → Modèles → Créer) :
   - Catégorie : **Utilitaire** ; Nom : `asrar_notification` ; Langue : **Français**
   - Corps :
     ```
     ASRAR PRO — {{1}}

     {{2}}

     Ouvrez l'application pour voir le détail.
     ```
     Exemples demandés par Meta : {{1}} = `Nouvelle demande de produit de Awa`,
     {{2}} = `Je cherche une bague en argent, taille 58`.
   - Bouton (facultatif) : **Visiter le site web**, URL **dynamique**
     `https://www.asrarpro.com/{{1}}` (exemple : `?shop=v_abc123`). Si vous
     l'ajoutez, mettez `WHATSAPP_TEMPLATE_URL_BUTTON=true`.
   - Attendre l'approbation (quelques minutes à quelques heures).
5. **Jeton permanent** : Paramètres de l'entreprise → Utilisateurs système →
   créer un utilisateur système (Admin), lui attribuer l'application et le
   compte WhatsApp, puis **Générer un jeton** avec les autorisations
   `whatsapp_business_messaging` et `whatsapp_business_management`.
6. **Moyen de paiement** dans WhatsApp Manager (facturation par message, selon
   le pays du destinataire — tarifs sur la page « Pricing » de WhatsApp Business).

## Variables d'environnement Vercel

| Variable | Valeur |
|---|---|
| `WHATSAPP_CLOUD_TOKEN` | jeton permanent de l'étape 5 (secret) |
| `WHATSAPP_PHONE_NUMBER_ID` | « Phone number ID » (Configuration de l'API), pas le numéro lui-même |
| `WHATSAPP_TEMPLATE_NAME` | `asrar_notification` (par défaut) |
| `WHATSAPP_TEMPLATE_LANG` | `fr` (par défaut) |
| `WHATSAPP_TEMPLATE_URL_BUTTON` | `true` si le modèle a le bouton URL dynamique |
| `WHATSAPP_API_VERSION` | facultatif, `v21.0` par défaut |

Puis **Redeploy**. Le réglage apparaît alors dans la page Compte.

## Fonctionnement

- Réglage stocké dans `account_settings/{uid}/whatsapp` = `{ enabled, phone, consentAt, updatedAt }`
  (route `/api/account`, action `whatsapp`).
- Envoi par la file de notifications existante (`server/notificationTransport.js`,
  canal `whatsapp`, code dans `server/whatsapp.js`) : une erreur temporaire
  (limite de débit, panne Meta) est réessayée ; une erreur définitive (numéro
  sans WhatsApp, modèle refusé) est abandonnée pour ce message.
- Le numéro n'est pas vérifié par un code : un utilisateur qui saisit le numéro
  d'un tiers enverrait ses notifications à ce tiers. L'utilisateur peut couper
  à tout moment depuis la page Compte.
