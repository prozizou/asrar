## SW v46.82 — Asrar-chat : paiement direct par Wave Business ou WhatsApp

- Lien Wave Business renseigné par le vendeur : « Payer X FCFA avec Wave » ouvre Wave directement, montant prérempli.
- Numéro Wave seulement : « Payer par Wave via WhatsApp » ouvre la discussion WhatsApp du vendeur avec la commande déjà écrite (plus de numéro à recopier).
- PI-SPI : alias à copier et bouton « Contacter le vendeur sur WhatsApp ».
- Le contact WhatsApp utilise le numéro WhatsApp du vendeur, sinon son numéro Wave.
- Le contenu reste verrouillé jusqu’à la confirmation de réception par le vendeur.

## SW v46.81 — Asrar-chat : corrections après les premiers essais

- Contenu payant : l’administration ne le voit plus déverrouillé en navigation normale (seulement en « vue modération » depuis un signalement) ; l’auteur voit un bandeau rappelant que les autres comptes n’ont que l’aperçu flouté et le prix ; prix affiché en pastille avec cadenas.
- Profil créé automatiquement depuis le compte Google (nom, photo, pseudonyme tiré de l’e-mail), modifiable dans Profil : plus d’écran d’accueil.
- Fenêtres : vraies feuilles (bas d’écran sur téléphone, centrées sur ordinateur) au lieu de pages entières ; menu d’un message, nouvelle discussion, transfert et déclaration de paiement en petit dialogue centré.
- Champ pseudonyme : double contour supprimé ; plus d’effet de soulèvement des boutons au survol.

## SW v46.80 — Asrar-chat : messagerie sociale et vente de contenus

- Nouveau module « Asrar-chat » (menu Spiritualité), navigation Discussions · Explorer · Publier · Achats · Profil, thèmes clair/sombre.
- Messagerie : discussions privées, groupes et chaînes (publics ou sur invitation), texte, vocaux, photos, vidéos, documents ; réponses, réactions, transferts, modification, suppression ; accusés de lecture, présence, « en train d’écrire », notifications push, recherche globale, partage de profil, administration des groupes, blocage et signalement.
- Publications gratuites ou payantes (article, photo, album, vidéo, audio, document, prestation) avec titre, description, aperçu, prix en FCFA, durée d’accès et conditions ; publiables directement dans une discussion ou une chaîne. Avant paiement : aperçu flouté et cadenas, bouton « Déverrouiller pour X FCFA ».
- Paiement direct au vendeur (Wave avec montant prérempli, PI-SPI, WhatsApp) : commande à référence unique, déclaration de la référence par l’acheteur, déverrouillage uniquement après confirmation du vendeur (ou de l’administration), jamais sur simple déclaration ; référence réutilisée signalée ; litiges, remboursements (accès retiré).
- Bibliothèque des achats, favoris, notes ; vitrine vendeur ; tableau des ventes et revenus (commission configurable suivie par vente).
- Fichiers dans un espace privé, servis par liens signés temporaires (15 min) ; aperçus floutés calculés dans le navigateur.
- Administration : statistiques, commission, signalements (copie du seul élément signalé), litiges, suspensions, journal d’audit.

## SW v46.79 — Visioconférence Google Meet

- Nouveau module « Visioconférence » (menu Spiritualité) : chaque utilisateur peut proposer une réunion Google Meet (titre, lien Meet, date, durée, description).
- Comme le Zikr collectif, l’administration valide chaque proposition : en attente, elle n’est visible que de son créateur ; une fois approuvée, tous les utilisateurs sont notifiés et la voient dans la liste.
- Refus par l’administration : la proposition est supprimée et son créateur averti. Une modification par le créateur repasse en validation.
- Seuls les liens meet.google.com sont acceptés ; au plus 3 visioconférences programmées par compte ; les réunions terminées disparaissent de la liste.
- Badges « Bientôt » et « En cours », bouton « Rejoindre sur Google Meet » (application Meet ou navigateur).

## SW v46.78 — Durcissement de sécurité (audit complet)

- Tâches planifiées : le secret n’est plus accepté dans l’URL (`?secret=`), seulement dans l’en-tête `Authorization: Bearer`, pour qu’il ne finisse jamais dans les journaux.
- Contact WhatsApp : l’ancien lien `/api/wa?product=` ne redirige plus vers le numéro du vendeur (fin de l’aspiration des numéros) ; le contact boutique passe par une commande.
- Likes et commentaires : seules les catégories de l’application sont acceptées (plus d’écriture dans des nœuds arbitraires).
- Discussion Zikr : les pièces jointes doivent venir du compte Cloudinary d’ASRAR PRO.
- Boutique : limite de requêtes par vendeur et au plus une annonce « nouveau produit » à tous toutes les 30 minutes (anti-spam de notifications).
- Limites de requêtes sur la lecture des contenus, catalogues, thèmes, accès et avis de la Bibliothèque.
- Administration : un jeton révoqué (compte désactivé, déconnexion forcée) est refusé immédiatement.
- Android 8.0.6 : sauvegarde automatique désactivée et session WebView exclue des sauvegardes et transferts (empêche la copie de la session sur un autre appareil).
- Dépendance fast-xml-parser mise à jour (alerte de sécurité).

## SW v46.77 — Fenêtre « Soutenir ASRAR PRO » (contribution volontaire)

- Après une action réussie (texte généré, Sourate seule, export Word ou PDF dans Écriture spirituelle ; écu de Géomancie ; résultats de Combinaisons ; calcul des Rouwhanes ; export Word des Hatims ; objectif du chapelet atteint), une fenêtre propose de soutenir l’application : Wave (montant libre), PI-SPI (alias à copier), WhatsApp.
- Au plus une fois par jour, pour tous les comptes ; « Plus tard » : pas avant 3 jours ; « J’ai déjà contribué » : pas avant 30 jours. Jamais pendant une action, ni par-dessus une autre fenêtre.
- Entrée « Soutenir l’application » toujours disponible dans le menu profil et dans Mon compte.
- Test zikr-warning adapté à la règle « retrait seulement à 0 grain ».

## SW v46.76 — Android : bouton retour direct vers le menu (APK 8.0.5)

- Le bouton retour d’Android ne repasse plus par toutes les pages déjà visitées : il ferme d’abord la fenêtre ou la fiche ouverte, puis ramène directement au menu depuis n’importe quel module (même une sous-page, ex. carré 7 × 7), puis du menu au Marché ; sur le Marché, double appui pour quitter.
- Nécessite l’application Android 8.0.5 (MainActivity demande la décision à la page). Les versions précédentes gardent l’ancien retour.

## SW v46.75 — Icônes SVG à la place des emojis dans toute l’application

- Toutes les icônes emoji de l’interface sont remplacées par des icônes SVG (même famille, couleur du thème) : boutons Retour et Fermer, étoiles d’avis, statistiques et actions de la boutique, Bibliothèque, Combinaisons, chapelet (réglages, objectif, séries, série de jours, badge), Zikr (privé, rappel, vœux), Marché (boutique vérifiée, lieu, image indisponible), installation et abonnement, mise à jour requise, publicités, page d’erreur, Rouwhanes, Géomancie, export Word des Hatims.
- Symboles des sept planètes (Planète, Date du jour) dessinés en SVG (`components/PlanetGlyph.js`) au lieu des caractères ♄ ♃ ♂ ☉ ♀ ☿ ☽, souvent affichés en emoji couleur sur Android.
- Messages éphémères (toasts) : icône SVG selon le type (succès, erreur, info) au lieu de « ✅ » / « ❌ » dans le texte.
- Indicatif téléphonique du Zikr : code pays (« SN +221 ») au lieu du drapeau emoji.
- Marqueurs CSS (chevrons, main) et page d’aperçu des liens partagés : SVG.
- Titres des notifications sans emoji (le centre de notifications affiche déjà une icône par type).
- Conservés volontairement : messages WhatsApp pré-remplis et textes de partage (texte envoyé à d’autres applications), réactions et emojis saisis dans la discussion des Zikr (contenu des messages), notifications locales des alarmes planétaires (texte système).

## SW v46.74 — Écriture spirituelle : nouvelle interface

- En-tête compact (retour, titre, menu ⋮ : changer de mode, outils, réinitialiser) et une seule surface de réglages, nettement moins haute.
- Mode d’écriture en pastille avec un bouton « Changer » discret.
- Sourate : sélecteur compact affichant le nom et le nombre de versets ; « Sans voyelles / Avec voyelles » en contrôle segmenté.
- Champ arabe RTL qui s’agrandit avec le texte (jusqu’à 220 px, puis défile).
- Répétitions : compteur − / + avec saisie numérique, validation (1 à 30 000) et accord singulier/pluriel ; l’aide indique l’effet (« insérée 3 fois entre chaque verset (7 versets) »).
- Un seul bouton principal « Générer le texte » (répétition ou intercalation selon le mode) ; « Sourate seule » reste en action secondaire.
- Outils (Documents, Recherche, Ornement, taille du texte) repliés dans la même surface, en puces.
- Résultat juste sous les réglages, avec Copier, Modifier, Partager, PDF et DOCX ; les exports utilisent un nom par défaut si aucun n’est saisi.
- Plus aucun emoji : blocs cumulés (monter, descendre, modifier, supprimer, enregistrer, annuler, Rasm), fenêtres d’export, messages de l’ornement et avertissement d’aperçu utilisent de vraies icônes SVG.

## SW v46.73 — Hatims : triangle et liste des carrés

- Liste des carrés : quand le nombre de cartes est impair, la dernière (11 × 11) occupe toute la largeur au lieu de laisser un vide à côté, avec sa miniature et son texte centrés.
- Les traits du Hatim triangulaire (carré 3 × 3, méthode « Triangulaire ») s’arrêtent au bord de chaque cercle au lieu de le traverser jusqu’au nombre ; le fond des cercles est désormais opaque.

## SW v46.72 — Hatims : carrés ajustés à la largeur, pourtour orange

- Les carrés (3 × 3 à 11 × 11) tiennent toujours dans la largeur de l’écran, sans défilement : chaque case vaut 1/N de la largeur (7 × 7 → 14,29 % par case). La taille des chiffres s’adapte à la case ; le curseur A⁻/A⁺ l’agrandit jusqu’à la place disponible.
- Les cases du pourtour sont orange (couleur du thème), avec un texte foncé en thème sombre et blanc en thème clair.

## SW v46.71 — Menu : « Continuer » limité au dernier module ouvert

- La section Continuer n’affiche plus qu’une carte : le dernier module ouvert, même s’il est aussi en favori.

## SW v46.70 — Menu : nouvelle présentation

- En-tête : bouton retour intégré à la barre (plus de bouton « ← Retour » sur sa propre ligne), logo sur fond blanc, séparateurs fins autour du titre et de la cloche, avatar cerclé d’orange.
- Titres de section (Continuer, Favoris, Explorer) précédés d’une barre orange.
- Continuer : ligne pleine largeur avec flèche, fond légèrement orangé.
- Favoris et pages de famille : pastille d’icône plus grande, séparateur vertical entre l’icône et le texte, étoile et cadenas plus visibles.
- Explorer : modules séparés par « • », badge « Accès premium » avec couronne, compteur de modules retiré.

## SW v46.69 — Notifications WhatsApp : boutiques, Zikr, alarmes planétaires, date du jour, Bibliothèque

- Boutiques : le propriétaire est prévenu quand un produit ou la boutique est aimé (une fois par personne), commenté ou noté — centre de notifications, push et WhatsApp.
- Zikr collectif : les messages de la discussion partent aussi sur WhatsApp pour les membres qui l’ont activé.
- Heure planétaire : l’alarme cochée (cloche) est aussi envoyée sur WhatsApp à son heure, sur le web comme sur Android (alarme Android déclarée au serveur avec la position, la sonnerie reste locale).
- Date du jour : le 1er et le 16 de chaque mois, grégorien ou hégirien, notification à tous les utilisateurs (WhatsApp compris), dès 7 h.
- Bibliothèque : l’administration est prévenue quand un livre ou un manuscrit est aimé ou commenté.
- Options par notification (`inApp`, `push`, `whatsappBroadcast`) dans la file de notifications.

## SW v46.68 — Notifications WhatsApp par le compte officiel ASRAR PRO

- Nouveau canal de notification : le compte WhatsApp Business d’ASRAR PRO (API WhatsApp Cloud de Meta) envoie les notifications à qui l’a demandé, comme un service client. Activation dans Mon compte → Mes préférences → Notifications WhatsApp, avec le numéro au format international.
- Seules les notifications ciblées partent sur WhatsApp : demandes de produit et réponses, messages des Zikr, accès activé… Les annonces envoyées à tous restent dans l’application et en push, pour maîtriser le coût facturé par Meta.
- Un seul modèle de message approuvé (`asrar_notification`), bouton lien facultatif. Une panne temporaire de Meta est réessayée, un numéro refusé est abandonné pour ce message.
- Le réglage n’apparaît qu’une fois `WHATSAPP_CLOUD_TOKEN` et `WHATSAPP_PHONE_NUMBER_ID` définis. Mise en place : `NOTIFICATIONS_WHATSAPP.md`.
- Correctif : enregistrer les préférences de notification n’efface plus les autres réglages du compte.
- Politique de confidentialité : mention de Meta / WhatsApp Business.

## SW v46.67 — Marché : demander un produit dans une boutique

- Chaque boutique du Marché propose « Demander un produit » : le client décrit le produit qu’il cherche (500 caractères au plus, 5 demandes en attente par boutique).
- Seul le propriétaire de la boutique voit les demandes reçues, avec le nom et l’e-mail du client. Il peut répondre (ou modifier sa réponse) et supprimer chaque demande. Le client ne voit que ses propres demandes et la réponse de la boutique ; il peut retirer sa demande.
- Notifications ciblées : le propriétaire est prévenu d’une nouvelle demande, le client de la réponse (ouverture directe de la boutique).
- Nouvelle route `/api/product-requests` (actions `list`, `create`, `reply`, `delete`). Données dans `product_requests/{boutique}/{id}`, lues et écrites uniquement par le serveur ; index `uid` et `at` ajoutés aux règles RTDB.

## SW v46.66 — Zikr collectif : retour à la ligne, vocaux de 15 min, menus compacts, retrait seulement à 0 grain

- Discussion : sur téléphone, la touche Entrée fait un retour à la ligne et l’envoi passe par le bouton ➤. Sur ordinateur, Entrée envoie et Maj+Entrée revient à la ligne.
- Vocaux jusqu’à 15 minutes (au lieu de 2), enregistrés à 32 kbit/s : environ 3,6 Mo pour 15 min. À 15 min, le vocal s’arrête et s’envoie normalement.
- Menus et fenêtres de la discussion ajustés à leur contenu : feuille compacte en bas d’écran sur mobile, fenêtre centrée sur ordinateur (ils occupaient tout l’écran). Réactions sur une ligne.
- Avertissements : à l’échéance des 7 jours, seul un membre qui n’a récité aucun grain est retiré. Un membre qui a déjà participé reste dans le groupe et son avertissement est levé.

## SW v46.65 — Zikr collectif : barre de saisie de la discussion affinée

- Un seul contour de focus, arrondi, sur la pilule de saisie : le rectangle orange qui s’ajoutait à l’intérieur (contour global des champs) a disparu.
- Barre détachée de la conversation par un filet, boutons image, emoji, micro et envoi alignés en bas quand le message s’étend sur plusieurs lignes.
- Compteur discret des caractères restants à l’approche de la limite de 500 (en rouge une fois atteinte).

## SW v46.64 — Journal d’activité complet envoyé à l’administration

- Chaque utilisateur connecté envoie automatiquement, à l’ouverture de l’application, son e-mail, son pays (adresse IP), l’heure et son appareil (`user_sessions/{uid}`, `activity_feed`) — plus de case « Autoriser la mesure des visites ».
- Nouvelle composante `components/ActivityTracker.js` : chaque page ouverte et chaque bouton, lien ou onglet touché est envoyé par lots à `/api/track` (type `actions`, 30 au plus, toutes les 10 s et à la mise en arrière-plan). Le contenu des champs saisis n’est jamais envoyé.
- Page Compte et politique de confidentialité mises à jour.

## SW v46.63 — Statistiques d’administration : mesure d’audience anonyme pour tous

- Le panneau d’administration affichait 0 visite et aucun pays : la mesure détaillée (« Autoriser la mesure des visites ») est décochée par défaut, et presque personne ne l’active. `/api/track` tient désormais, pour **tous** les comptes, des compteurs anonymes et agrégés : `analytics/daily/{jour}` (visites, visiteurs uniques du jour, type d’appareil, pays) et `analytics/geo/{AAAA-MM}/{pays}` (utilisateurs distincts du mois). Ni identifiant, ni e-mail, ni page. Le journal détaillé par compte reste réservé aux comptes qui l’acceptent.
- Politique de confidentialité et page Compte : mention de ces compteurs anonymes.

## SW v46.62 — WhatsApp : ouverture directe (application et site Android), emojis intacts

- Messages WhatsApp : le lien passe désormais par `api.whatsapp.com/send` au lieu de `wa.me`, dont la redirection remplaçait les emojis (🌙, 📦, 🏪, 💰, 🔖) par « � ». Partout : site, ordinateur, iPhone, application.
- Site ouvert dans Chrome sur Android (y compris l’application web installée) : WhatsApp s’ouvre directement (lien `intent://`), sans nouvel onglet ni page « Ouvrir l’application » ; si WhatsApp n’est pas installé, la page web de WhatsApp s’ouvre à la place. Ordinateur et iPhone : nouvel onglet, comme avant.

- Application Android : le repli automatique vers la page web de WhatsApp (wa.me) est supprimé. L’application ne met pas la page en pause quand WhatsApp s’ouvre : le repli se déclenchait donc pendant que WhatsApp était ouvert, et l’on retrouvait la page « Ouvrir l’application / Télécharger » au retour.
- Si WhatsApp ne semble pas s’être ouvert après 2,5 s, un bandeau « WhatsApp ne s’est pas ouvert ? » propose « Ouvrir dans le navigateur » (aussi au-dessus d’une fiche produit ouverte) ; rien ne s’ouvre sans action.

## SW v46.61 — WhatsApp direct dans l’application, pages retirées, Zikr simplifié, Géomancie

### WhatsApp s’ouvre directement dans l’application

- Application Android : les contacts WhatsApp (demande au Marché, assistance abonnement, paiements, boutique, Zikr) ouvrent directement la discussion préremplie dans WhatsApp (`whatsapp://send`), sans passer par la page web « Ouvrir l’application / Télécharger » de WhatsApp. Les emojis du message ne sont plus abîmés.
- Si WhatsApp n’est pas installé, repli automatique sur le lien wa.me après 2,5 s. Site web : inchangé.

### Pages retirées

- Tafsir al-Ahlam et le générateur de talisman Wafq sont supprimés (ils n’étaient plus dans le menu). Anciens liens : `/tafsir` → Outils, `/wafq` → Hatims (`/wafq/carre`, inchangé).

### Zikr

- Panneau « Gestion du groupe » supprimé : « Modifier le zikr » (fenêtre) et « Supprimer le zikr » (créateur seul dans le groupe) sont dans le menu ⋮ du créateur.
- Le menu ⋮ d’un participant s’ouvre vers le haut quand il passerait sous la barre de navigation (dernières lignes de la liste) : « Exclure du groupe » reste visible.

### Géomancie

- Figure de Repérage = M1 + M3 + M5 + M16 (L’Âme, L’Entourage, Les Projets, La Sentence Finale), au lieu de M2 + M4 + M7 + M8.
- « Le vœu » retiré pour l’instant (écran, PDF et texte de partage).

## SW v46.60 — Style épuré clair/sombre, boutique à 5 000 FCFA et partage, site Android

### Nouveau style épuré, thèmes clair et sombre

- Palette commune refaite pour les deux thèmes : fond neutre uni (gris très foncé / gris très clair), cartes pleines et nettes, ombres discrètes, un seul accent orange (contrastes AA, texte foncé sur l’orange en sombre, blanc en clair).
- Fond animé (nébuleuse, étoiles) et halos retirés.
- Marché, Al-Qalam, Combinaisons, Géomancie, Rouwhanes, menu, fenêtres d’abonnement et de paiement : couleurs violettes/bleues codées en dur remplacées par la palette commune ; le panneau de paiement suit désormais le thème (sombre en sombre, blanc en clair).
- La bascule clair/sombre reste dans le menu latéral.

### Pages adaptées à toutes les largeurs d’écran

- Planète débordait sur les petits écrans (320–360 px) : l’étiquette de nature passe désormais sous la planète quand la place manque.
- La page des combinaisons (99 Noms) se réduisait à la largeur de son contenu et laissait de grandes marges vides : elle occupe désormais toute la largeur de l’écran. Un test vérifie que chaque vue prend toute la largeur d’un téléphone.

### Planète : heure en cours réservée aux abonnés

- Sans abonnement, la carte « Heure planétaire actuelle » est floutée : seul un gabarit fictif est affiché (planète, horaires, nature, temps restant et heure suivante ne sont jamais envoyés à l’écran), avec « Débloquer avec l’abonnement ».
- L’activation des alertes de changement d’heure dans l’application Android demande aussi l’abonnement. Horloge, période jour/nuit, régent du jour, lever et coucher restent visibles.

### Partage des boutiques sur les réseaux sociaux

- « Partager ma boutique » dans Ma Boutique et « Partager cette boutique » sur la page d'une boutique du Marché : feuille de partage du téléphone (WhatsApp, Facebook, TikTok…) ou copie du lien.
- Lien `/s?k=shop&i=<vendorKey>` : aperçu avec le nom et le logo de la boutique, puis ouverture du Marché directement sur la boutique (`/?shop=`). Le code de parrainage de celui qui partage est ajouté au lien.

### Boutique à 5 000 FCFA par mois

- « Ma Boutique » : une seule formule, 5 000 FCFA par mois (fin des formules 1 mois à 10 000 et 3 mois à 25 000 FCFA).
- Mêmes moyens de paiement que l’abonnement : Wave (lien marchand à 5 000 FCFA), PI-SPI (copie de l’alias) ou WhatsApp, puis justificatif sur WhatsApp. Activation manuelle de la boutique après vérification, comme avant.

### Site accessible sur Android

- Le verrou qui redirigeait les visiteurs Android du site vers Google Play (fenêtre « Ouvrir l’application / Installer ») est supprimé : le site s’utilise normalement dans le navigateur Android, comme sur iPhone et ordinateur. L’application reste disponible. La variable `NEXT_PUBLIC_ANDROID_APP_REDIRECT` n’est plus utilisée.

## SW v46.59 — Paiement PI-SPI avec activation manuelle

- PI-SPI proposé à côté de Wave et WhatsApp dans le dialogue d’abonnement et Mon compte.
- Alias de réception fourni par l’éditeur, copie avec repli Android, montant de la formule et instructions de paiement depuis une application compatible.
- Justificatif transmis par WhatsApp avec la formule et le compte ASRAR ; activation après vérification manuelle du paiement reçu.

## SW v46.58 — Panneau de paiement mobile

- Dialogue présenté en panneau blanc au bas de l’écran mobile, avec cartes Wave/WhatsApp sélectionnables et bouton Continuer.
- Choisir un moyen ne lance aucun paiement : seule la confirmation ouvre Wave ou WhatsApp. Durées, tarifs et vérification du paiement conservés.
- Pause des publicités et accès des abonnés inchangés.

## SW v46.57 — Pause des publicités, accès par abonnement

- Publicités, préchargements, bannières et liens sponsorisés en pause sur le site et dans l’application. Intégration conservée pour réactivation après confirmation des régies.
- Actions protégées proposées via le dialogue simple Wave/WhatsApp ; accès activé après vérification du paiement.
- Vérification serveur maintenue : pas de contenu réservé ni de passe publicitaire pendant la pause ; les abonnés actifs gardent tous leurs modules.

## Publication app-ads.txt — Chartboost

- Ajout des 621 déclarations Chartboost manquantes à partir des 766 lignes fournies par l’éditeur ; 145 étaient déjà présentes.
- Publisher ID `6aee950ef78154dc70ef45e7` déclaré en DIRECT ; conservation de toutes les lignes Google et BIGO, soit 1 294 déclarations uniques au total.
- Mise à jour du fichier public sans nouvel envoi Android ; un nouveau scan Chartboost reste à effectuer après déploiement.

## Android 8.0.4 — Préparation Chartboost

- Adaptateur Chartboost 5.12.0 / SDK 9.14.1 dans l’application et le diagnostic LevelPlay ; dépôt Maven officiel limité aux dépendances Chartboost.
- AGP 8.13.2 pour la compatibilité R8 avec Kotlin 2.3 ; signal non destiné aux enfants transmis à Chartboost avant initialisation, selon la politique du service.
- Nouvelle version native à publier pour activer cette intégration sur les appareils ; validation et première requête Chartboost sur téléphone à effectuer.
- Déclarations `app-ads.txt` Chartboost encore attendues du compte éditeur ; aucune ligne ni aucun identifiant inventé.

## SW v46.56 — Somme du milieu de l’étoile à quinze cases

- Les cinq cases du milieu donnent désormais la même constante que chacune des cinq lignes, avec quinze entiers positifs différents.
- Nouvelles combinaisons couvrant toutes les constantes entières à partir de 38, paires comme impaires ; six sommes vérifiées.
- Tour du milieu identifié dans la copie, les vérifications et les exports PNG/SVG. Pour 158 : 29 + 32 + 33 + 34 + 30 = 158.

## SW v46.55 — Étoile à 15 cases, constantes paires et impaires

- Modèle à 15 cases proposé par défaut dans l’étoile à cinq branches : cinq entiers par ligne, tous positifs et différents, pour toute constante entière à partir de 38.
- Une case supplémentaire sur chaque ligne, distinguée en violet dans les exports ; exemple 903 conforme à l’aperçu validé.
- Modèle original à dix cases conservé dans le choix du modèle, avec ses constantes paires. Chiffres orientaux, copie, exports PNG/SVG et contrôle d’accès conservés.
- Les actualisations de la discussion Zikr n’effacent plus les avertissements d’envoi de vocaux ; correction d’une course révélée par les contrôles automatiques.

## SW v46.54 — Hatim étoile à cinq branches

- Nouveau choix « Étoile 5 branches » dans les hatims 5×5, avec dix nombres et cinq alignements de même somme.
- Disposition du modèle reproduite pour la constante 24 ; constantes paires à partir de 24, chiffres latins ou orientaux, copie et exports PNG/SVG.
- Contrôle d’accès existant conservé et méthodes Base / Askandria toujours disponibles.

## SW v46.53 — Politique de confidentialité publique

- Page publique `/confidentialite.html`, accessible sans connexion ni redirection Android.
- Coordonnées actualisées : asrarlilahi66@gmail.com, +221 77 350 05 95 et www.asrarpro.com.
- Description des données du compte, contenus, localisation, publicités, prestataires et demandes de suppression ; liens depuis la connexion et Mon compte.

## Android 8.0.3 / SW v46.52 — Préchargement des publicités

- Préparation d’une annonce pour les comptes gratuits avant le clic et de la suivante pendant la vidéo en cours.
- Bouton « Regarder » disponible lorsqu’une annonce est prête ; chargement indiqué dans le dialogue.
- Respect du consentement publicitaire, retrait des annonces préparées après changement de confidentialité ou déconnexion.
- Validation conservée : affichage, récompense et fermeture de la même publicité sont requis pour débloquer une action.
- Compatibilité du site avec les anciens APK et maintien du dialogue simple Wave / WhatsApp.

## Android 8.0.2 / SW v46.48 — Médiation LevelPlay, publicités et abonnements

- Préparation locale de LevelPlay : adaptateurs Unity Ads, Google et BIGO ; consentement UMP ; visionnage récompensé confirmé avant déblocage. Identifiants réels renseignés et médiation activée dans la configuration locale ; diffusion sur appareil à valider.

- Les liens directs vers une recette attendent la vérification initiale de l’abonnement, sans bloquer un abonné au démarrage.

- Publicité nécessaire avant chaque action contrôlée : aucune continuation sur absence, erreur ou vidéo interrompue. Contrôle de visibilité du bloc web, attente ou abonnement ; messages WhatsApp aérés et références courtes.

- Retrait du SDK et du plugin Google Play Billing, ainsi que des achats individuels dans l’interface. Les anciennes demandes publiques de paiement répondent 410. Historique et remboursements conservés côté serveur.
- Application toujours gratuite avec publicités. Abonnements sans publicités de 3 mois (15 000 FCFA), 6 mois (25 000 FCFA) et 1 an (45 000 FCFA), par WhatsApp ou liens marchands Wave.
- Choix et renouvellement des formules dans Mon compte ; ouverture externe de Wave sur Android et confirmation WhatsApp personnalisée. Activation manuelle après vérification du paiement, sans déblocage au simple clic.

## Android 8.0.1 / SW v46.47 — WhatsApp dans l'application Android

- Application : version 8.0.1 (publication Google Play avec les pubs Unity plein écran de la 8.0.0, jamais publiée seule).

- L'application Android (WebView) ne pouvait pas ouvrir de nouvelle fenêtre : les demandes WhatsApp (Marché, commandes, abonnement, assistance) ne partaient pas. Dans l'application, le lien est maintenant confié à Android (navigation principale vers wa.me, que Capacitor ouvre dans WhatsApp) ; les liens `/api/wa` sont d'abord résolus avec `format=json`. Sur le site, rien ne change (nouvel onglet).

## SW v46.46 — Pubs Adsterra dans l'application Android

- L'application Android (qui charge le site) affiche désormais les bannières Adsterra et le Native Banner aux comptes sans abonnement, sans nouvelle version de l'application. Formats exclus dans l'application, pour respecter les règles Google Play : Social Bar (imite une notification), Popunder et onglet Smartlink (ouvrent le navigateur), offre « Retirer les publicités » par WhatsApp. Coupable sans code : `NEXT_PUBLIC_ADSTERRA_IN_APP=0`.

## SW v46.45 — Relevé des appareils

- À chaque visite (comptes ayant activé les statistiques), la catégorie d'appareil — application Android, site sur Android, iPhone / iPad, ordinateur — est ajoutée à `analytics/visits/{jour}/{uid}/platform` (`lib/platform.js`, `pages/api/track.js`). Jamais le user-agent lui-même. Lue par l'administration (Statistiques → Appareils).

## Android 8.0.0 / SW v46.44 — Retour de l'application Android

- Site ouvert sur Android : redirection vers la page Google Play de l'application (une fois par visite ; « Ouvrir » si elle est installée, sinon « Installer »), puis fenêtre « Ouvrir l'application / Installer depuis Google Play » au retour, avec une sortie de 7 jours pour qui ne peut pas installer. iPhone, ordinateur, robots et l'application elle-même : aucun changement. Désactivable : `NEXT_PUBLIC_ANDROID_APP_REDIRECT=0`.
- Le message « ASRAR PRO continue sur le web » de l'application est supprimé.
- Application : lien d'ouverture `asrarpro://open` depuis le site ; publicité plein écran Unity (`Interstitial_Android`) aux actions des comptes sans abonnement, au plus une fois toutes les 3 minutes et jamais dans la première minute ; version 8.0.0.

## SW v46.43 — Bannières réactivées

- Bannières Adsterra (bas des pages, colonnes latérales, fenêtre de 5 s) et Native Banner réactivés à la demande du propriétaire ; seules les pubs adultes restent bloquées chez Adsterra. Coupables sans code : `NEXT_PUBLIC_ADSTERRA_BANNERS=0`, `NEXT_PUBLIC_ADSTERRA_NATIVE_SRC=` (vide).

## SW v46.42 — Relevé des blocages de la politique de sécurité

- La politique de sécurité (CSP, `lib/csp.js`) signale désormais chaque blocage (`report-uri /api/csp-report`) sans rien débloquer. `pages/api/csp-report.js` agrège par jour, type et domaine dans `analytics/csp/{jour}` (aucune URL complète, aucune donnée personnelle), avec limite de débit et plafond quotidien.
- But : savoir quels domaines des régies publicitaires (Social Bar, mesures d'affichage des bannières…) sont bloqués chez les vrais visiteurs, avant d'assouplir la politique en connaissance de cause.

## SW v46.41 — Bannières coupées

- Bannières Adsterra (bas des pages, colonnes latérales, fenêtre de 5 s) et Native Banner coupés : ils affichaient des annonces de casino et de paris et n'étaient presque pas comptés par Adsterra. Restent le Smartlink (pub au clic et lien « Sponsorisé ») et le Social Bar.
- La fenêtre de 5 s affiche un message de remerciement à la place de la bannière.
- Réactivables : `NEXT_PUBLIC_ADSTERRA_BANNERS=1` et `NEXT_PUBLIC_ADSTERRA_NATIVE_SRC=<url>`.

## SW v46.40 — Mesure des pubs sautées

- La fenêtre de compte à rebours relève si l'onglet de pub est fermé aussitôt (< 2 s), avant la fin des 5 s, ou laissé ouvert. Compteurs agrégés envoyés au plus toutes les 10 min (`/api/track`, type `ad_stats`), seulement si le compte a activé les statistiques, stockés dans `analytics/ads/{jour}` et renvoyés par les stats admin (`ads.today/week/month`).

## SW v46.39 — Compte à rebours de 5 s après chaque pub

- Après la pub au clic, une fenêtre affiche une bannière Adsterra 300x250 et « Votre résultat arrive dans N s » ; le bouton « Continuer » n'apparaît qu'au bout de 5 s (temps passé sur l'onglet de pub compris). Fermer l'onglet de pub tout de suite ne fait donc gagner aucun temps.
- Bannières Adsterra regroupées dans `components/AdsterraBanner.js`.

## SW v46.38 — Pub obligatoire à chaque action

- Chaque action (ouvrir un secret, Calculer, Générer…) ouvre une pub dans un nouvel onglet pour les visiteurs sans abonnement valide ; si le navigateur bloque l'onglet, l'action ne s'exécute pas et une fenêtre explique comment autoriser les pop-ups (ou retirer les pubs).
- Bibliothèque : la pub s'ouvre au clic, puis « Ouvrir le document » (un navigateur n'autorise qu'un onglet par clic).
- Plus d'intervalle d'une minute entre deux pubs (`NEXT_PUBLIC_ACTION_AD_INTERVAL_SECONDS` supprimée).

## SW v46.37 — Pub au clic sur les boutons d'action

- Ouvrir un secret, un document, Calculer, Générer… ouvre une pub Adsterra (Smartlink) dans un nouvel onglet pour les visiteurs sans abonnement valide, sur le web uniquement, au plus une fois par minute (`NEXT_PUBLIC_ACTION_AD_INTERVAL_SECONDS`).
- Le Popunder Adsterra « global » (n'importe quel clic) est désactivé par défaut pour éviter deux onglets au même clic (réactivable via `NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC`).

## SW v46.36 — Fin de l'application Android

- Dans l'APK uniquement : fenêtre « ASRAR PRO continue sur le web » invitant à installer la version web (PWA). Aucun nouvel APK requis (l'APK charge le site en direct). « Plus tard » la reporte au lendemain.

## SW v46.35 — Application gratuite avec publicités

- Tous les modules (y compris premium) sont gratuits pour tous (`FREE_FOR_ALL`).
- Les publicités s'affichent à tout visiteur sans abonnement valide, y compris non connecté ; un abonnement valide les retire.
- Bouton « Retirer les publicités » sous les bannières : ouvre les formules, demande validée sur WhatsApp.
- « Mon compte » affiche le vrai statut d'abonnement ; badge « Accès premium » et cadenas masqués dans le menu.

## SW v46.34 — Smartlink Adsterra

- Lien « Sponsorisé » (Smartlink Adsterra) sur la page 404 et sous les résultats de Combinaisons, Wafq, Géomancie, Planète et Hijri. Mêmes règles que les autres pubs : site web uniquement, jamais pour un abonné.

## SW v46.33 — Publicités Adsterra

- Publicités Adsterra sur le site web uniquement (jamais dans l'APK ni pour les abonnés) : Social Bar, Popunder, Native Banner, bandeaux 320x50 / 468x60 / 728x90 selon la largeur d'écran, pavé 300x250 et colonnes 160x300 / 160x600 sur grand écran. Pubs adultes désactivées.
- CSP élargie aux domaines Adsterra (bicea.org, afders.org).

## 7.9.4 Android / SW v46.30

- Réveil natif pour les heures planétaires sélectionnées : programmation locale exacte, sonnerie en boucle sur le volume des alarmes et arrêt depuis la notification.
- Restauration après redémarrage, annulation durable, protection contre les déclenchements en double ou périmés ; arrêt de sécurité à dix minutes.
- Sons ASRAR et doux embarqués ; autorisations Android et mise à jour des anciens APK expliquées dans l’interface.
- Version Android 7.9.4 et code de livraison augmenté.

# CHANGELOG

## 2026-10-28 — Suivi des participants au Zikr collectif

- Messages WhatsApp personnalisables avec méthode et progression, avertissement
  enregistré dans l’application et badge privé pour les modérateurs.
- Retrait du groupe après sept jours sans récitation suivant l’avertissement,
  via le cron des rappels ; compte ASRAR et total récité conservés.
- Reprise d’activité annulant l’avertissement et retrait idempotent avec reprise
  après panne ; file indexée sans scan global des membres. SW `v46.29`.

## 2026-10-28 — Inscriptions arabes de l’étoile

- Remplacement des quatre petites étoiles par جبريل, ميكائيل, اسرافيل et
  عزرائيل aux positions demandées ; محمد au milieu de chaque côté.
- Ajustement des textes aux espaces disponibles, dans la vue et les exports
  PNG/SVG sur fond blanc. SW `v46.28`.

## 2026-10-28 — Hatims compacts et export PNG

- Étoile vide au démarrage et champ « Entrer le nombre », sans constante préremplie.
- Retrait des explications des vues Hatims, outils compacts et vérifications repliées.
- Export PNG blanc haute résolution en plus du SVG ; chiffres mesurés et ajustés
  dans les régions du diagramme, sans agrandir la page. SW `v46.27`.

## 2026-10-28 — Constante libre pour les sept alignements

- Retrait du modèle à six alignements et du choix de configuration.
- Saisie instantanée de toute constante entière S ≥ 57, avec 18 entiers
  positifs distincts et sept sommes exactes ; six bases vérifiées, sans
  solveur ni dépendance supplémentaire. SW `v46.26`.

## 2026-10-28 — Étoile à sept alignements

- Configuration S = 57 : valeurs 1 à 18 sans répétition et sept alignements
  de six cases vérifiés automatiquement, positions du schéma conservées.
- Sélection entre les deux modèles, contrôle partagé indépendant du rendu,
  copie et export adaptés au nombre d’alignements. SW `v46.25`.

## 2026-10-28 — Étoile magique à 18 cases

- Choix Étoile dans le Hatim 6 × 6 : génération instantanée selon la constante
  S, à partir de 38, avec vérification des six alignements et des 18 valeurs.
- Diagramme SVG responsive, copie numérotée et export SVG autonome ; saisies
  hors plage refusées, accès premium conservé. SW `v46.24`.

## 2026-10-28 — Choix des méthodes Hatims

- Sélecteurs compacts en deux colonnes pour les tailles 3, 5 et 8 :
  libellés courts, méthode active visible et aide contextuelle.
- Choix accessibles au clavier avec boutons radio natifs ; explications
  détaillées dépliables et espacement des champs resserré. SW `v46.23`.

## 2026-10-28 — Copie des recettes

- Retrait du téléchargement PDF dans Secrets mystiques.
- Copie numérotée réservée au compte vérifié prozizou298@gmail.com, avec
  reprise manuelle si le presse-papiers est indisponible. SW `v46.22`.

## 2026-10-28 — Présentation de la bibliothèque

- Titres des cartes masqués visuellement selon le choix de présentation ;
  libellés accessibles et actions conservés. SW `v46.21`.

## 2026-10-28 — Simplification de Combinaisons

- Retrait du Calculateur Abjad et du tableau des 99 noms de la page.
- Recherche, résultats et détails de combinaison conservés. SW `v46.20`.

## 2026-10-28 — Thème de Planète

- Planète suit le thème de l’application : fond, cartes, fenêtres, boutons
  et états favorables/défavorables adaptés au clair et au sombre. SW `v46.19`.

## 2026-10-28 — Retrait de modules

- Retrait des écrans Thalsams, Abajad et Formation/visioconférence.
- Anciens liens redirigés vers les catégories du menu ; retrait du catalogue
  et des mentions de visioconférence dans le compte.
- Accès aux sessions désactivé, sans débit des crédits historiques. SW `v46.18`.

## 2026-10-28 — Catalogue Hatims compact

- Grille responsive de deux colonnes, cartes régulières, taille et nombre
  de cases lisibles ; en-tête allégé, aide visible et interactions discrètes.
- Les miniatures sont calculées selon chaque taille. SW `v46.17`.

## 2026-10-28 — Revue des 35 vues et solidité des parcours

- Isolation des styles du marché, de la bibliothèque et de la boutique ;
  retours mobiles visibles, titres et commandes tactiles harmonisés.
- Bibliothèque : titres et auteurs visibles, ouverture au clavier, commentaires
  conservés après échec. Formations, boutique et secrets : reprise après panne.
- Boutique : confirmation accessible de suppression, protection pendant les
  envois et erreurs persistantes. Secrets : réponses obsolètes ignorées.
- Grands carrés Wafq : chiffres lisibles et défilement du tableau au clavier ;
  filtres compacts et polices Al-Qalam locales. SW `v46.16`.
- Matrice de contrôle de chaque vue : [QUALITE_VUES.md](QUALITE_VUES.md).

## 2026-10-27 — Cohérence des vues personnelles et confort mobile

- Rappel d’échéance compact, menu personnel structuré et version de repli
  cohérente avec le build ; en-têtes et états partagés des vues personnelles.
- Notifications : reprise après erreur, marquage confirmé et filtre local
  des non-lues. Contrastes adaptés aux deux thèmes et retour mobile visible.
- Zikr : safe areas Capacitor, espace de clavier, saisie multilignes et
  retours audio lisibles. Zoom utilisateur rétabli. SW `v46.15`.
- Audit et périmètre : [QUALITE_VUES.md](QUALITE_VUES.md).

## 2026-10-27 — Chargement ESM dans les fonctions Vercel

- Activation explicite de `--experimental-require-module` sur Node 24 pour
  le SDK Admin 14 et `jwks-rsa`/`jose`. Le runtime hébergé désactivait ce
  chargement, provoquant `ERR_REQUIRE_ESM` avant les handlers Firebase.
- Test du vrai bundle API avec la contrainte du runtime puis les options
  Vercel ; mêmes options pour les tests HTTP. SDK Admin verrouillé à 14.5.0.
- Diagnostic de la disponibilité effective de `require(ESM)`. SW `v46.14`.

## 2026-10-27 — Alignement du runtime Firebase

- Node 24.x pour Vercel, les postes de développement et les deux suites CI.
  Les dépendances client Firebase du verrou exigent Node 24.12 minimum ;
  la seule exigence Node 22 du SDK Admin ne couvrait pas tout le projet.
- Installation stricte des exigences Node pour bloquer une compilation avec
  des dépendances non prises en charge. SW `v46.13`.

## 2026-10-27 — Diagnostic et protection des vocaux Zikr

- Vérification du canal audio avant la demande de micro, erreur persistante
  et récupération du vocal non envoyé par téléchargement. SW `v46.12`.
- Activation Cloudinary/Vercel décrite dans [AUDIO_ZIKR.md](AUDIO_ZIKR.md) ;
  le preset signé audio reste obligatoire.

## 2026-10-27 — Commandes, compte et migration Firebase

- Demandes WhatsApp à prix et vendeur vérifiés côté serveur, références de reprise,
  étapes confirmation/paiement manuel/livraison et historique réservé aux participants.
- Compte avec échéance, préférences, export borné et demandes de données suivies
  par l’administration ; la suppression reste un traitement manuel explicite.
- Dialogues natifs : navigation clavier, Échap et restitution du focus.
- Firebase 13.1 / Admin 14.5 et Node 22 ; audit de production sans vulnérabilité,
  sept avis modérés restants dans les outils de développement. SW `v46.11`.
- Guides : [COMMANDES_ET_COMPTE.md](COMMANDES_ET_COMPTE.md) et
  [MIGRATION_FIREBASE.md](MIGRATION_FIREBASE.md).

## 2026-10-27 — Réduction des lectures et transferts Firebase

- Arrêt des sondages en arrière-plan/hors ligne, badge non lu indexé,
  discussion Zikr incrémentale et fenêtre indexée des rappels de session.
- Cache local de 30 secondes sur les seules métadonnées du catalogue,
  borné et invalidé par les publications et éditions de l'instance.
- Mesures sur fixtures et limites documentées dans
  [COUTS_FIREBASE.md](COUTS_FIREBASE.md). SW `v46.10`.

## 2026-10-27 — Tests authentifiés et notifications persistantes

- Fiabilisation complémentaire : reprises indépendantes par appareil,
  absence de blocage Android par Web Push/VAPID, déduplication des rappels
  concurrents, annulation des rappels obsolètes et activations atomiques.
  Les relances conservent les accusés et l'état lu. SW `v46.9`.
- Suite Playwright isolée sur les émulateurs Auth/RTDB : rôles, contenus
  protégés, règles Firebase, session navigateur et livraison de notifications.
- File persistante pour les publications et messages : diffusion par pages,
  baux concurrents, reprises par appareil et relance des échecs réservée aux
  administrateurs. Publication et création de tâche atomiques.
- Correction des itérations Firebase qui tronquaient notifications,
  commandes, listes administrateur et destinataires des rappels après le
  premier élément. Le simulateur de tests reproduit désormais ce comportement.
- Workflow de reprise de la file, contrôles CI authentifiés et guide
  d'exploitation [NOTIFICATIONS.md](NOTIFICATIONS.md). SW `v46.8`.

## Session 7 — Liens partageables (deep links) & Parrainage

Deux ajouts, documentés en détail dans **`PARTAGE_ET_PARRAINAGE.md`**.

### 1) Chaque élément a une URL partageable
- Nouveau lien court **`/s?k=<type>&c=<cat>&i=<clé>&r=<code>`** (réécriture `vercel.json`
  → `api/share.js`). Types : `secret`, `book`, `product`.
- `api/share.js` sert une page d'**aperçu Open Graph** (titre + image) pour
  WhatsApp / Messenger / Facebook / TikTok / Telegram, puis **redirige** vers la page
  du hub avec `?item=&cat=`.
- `js/share.js` (nouveau) : construction des liens, **Web Share API** + repli copie,
  lecture du lien profond, capture du code de parrainage.
- Boutons **📤 Partager** : détail + lecteur des Secrets, cartes de la Bibliothèque,
  modale produit du Marché.
- **Connexion différée** : `loginUrl()` ajoute `?next=<destination>` ; `index.html`
  renvoie l'utilisateur sur l'élément partagé après le Google Sign-In.
- **Paywall inchangé** : l'aperçu ne lit que titre/image (jamais `sirr`, `pdf`,
  description vendeur) ; l'ouverture passe toujours par `get-content`.

### 2) Parrainage — gagner un abonnement en partageant
- Nouvelle page **`/parrainage/parrainage.html`** (lien personnel, code, points,
  progression, statistiques, activation) + entrée 🎁 dans l'accueil et CTA dans la
  passerelle « Abonnement requis ».
- Nouvelle fonction **`api/referral.js`** : `me` / `claim` / `redeem`.
  **10 points par filleul inscrit**, **1000 points → 3 mois d'abonnement**
  (prolonge l'échéance en cours, restitution des points si l'activation échoue).
- **Anti-triche** : les points ne sont PAS crédités au clic (répétable à l'infini)
  mais à l'**inscription d'un nouveau compte** venu du lien — 1 crédit par filleul
  (transaction `referred/{uid}`), auto-parrainage refusé, compte de plus de 7 jours
  non crédité. Les clics restent comptés à titre statistique.
- Règles RTDB : `referrals`, `referral_codes`, `referred` (lecture propriétaire,
  écriture serveur uniquement) — à fusionner depuis `rules/purchases.rules.json`.
- `SW_VERSION` → **`v26.0`** (le lien `/s` n'est jamais mis en cache).

## Session 6 — Suppression de PayDunya → activation manuelle via WhatsApp

Motivation : impossible de récupérer les fonds envoyés depuis l'étranger (ex. Burkina Faso)
depuis le Sénégal sans représentant. Le paiement en ligne est donc retiré ; l'utilisateur
qui veut un accès (ou passer une commande / ouvrir une boutique) est redirigé vers **WhatsApp**
avec un **message pré-rempli** (e-mail du compte + formule/panier + rubrique). L'administration
active ensuite l'accès **manuellement, par e-mail**.

### Mises à jour (6.1)
- **Offre « Premium à vie » (100 000 FCFA) retirée** des portails (hub, Benefits, Rouwhania)
  et du catalogue de messages. Restent : 3 Mois, 6 Mois, 1 An.
- **Numéro WhatsApp déplacé côté serveur** : nouvelle fonction `api/wa.js` qui lit la
  variable d'environnement Vercel **`WHATSAPP_NUMBER`** et redirige vers WhatsApp.
  `js/whatsapp.js` ne contient plus aucun numéro. Marche à suivre : `DEPLOIEMENT_WHATSAPP.md`.
  `SW_VERSION` → `v3`.


### Nouveau
- `js/whatsapp.js` — **source unique** du numéro WhatsApp + générateurs de messages
  (`openAccess`, `openOrder`). ⚠️ Un seul endroit à éditer : la constante `number`.
- `api/admin.js` — actions **`grant-access {email, days?}`**, **`revoke-access {email}`**,
  **`list-access`** : l'admin accorde/retire l'accès par e-mail (écrit `allowedUsers/{clé}`).
  `days` absent = accès **à vie** ; sinon N jours.

### Portails convertis (PayDunya → WhatsApp)
- Hub (`js/firebase-config.js` : `showSubscriptionGate` / `startSubscription`),
  Benefits (`Benefits/access.js`), Rouwhania (`rouwhania/access.js`),
  Al-Qalam (`alqalam/*`), Boutique (`boutique/*`), Marché (`marche/marche.js` :
  « Commander via WhatsApp »). Le contrôle d'accès (`purchased_user` / `allowedUsers` /
  `admins` / `vip_users`) est **inchangé** : les abonnés existants gardent leur accès.

### Supprimé
- Endpoints : `api/create-invoice.js`, `api/confirm-invoice.js`, `api/create-order.js`,
  `api/paydunya-ipn.js`. Libs : `api/_lib/paydunya.js`, `api/_lib/orders.js`,
  `api/_lib/plans.js`. Clients : `js/paydunya-client.js`, `alqalam/paydunya-client.js`.
- `api/_lib/grant.js` réduit à `app()` ; `api/_lib/sellers.js` réduit à
  `getSeller` / `isActiveSeller`. Variables d'env PayDunya (`PAYDUNYA_*`) inutiles.
- `sw.js` : `SW_VERSION` → `v2` (purge du cache), ajout de `/js/whatsapp.js`.

---

## Session 5 — Noms d'Allah + Rouwhanes : menus, paywall, session persistante

### 1. Menus ajoutés au grand menu ASRAR PRO (`accueil/accueil.html`)
- **Noms d'Allah** → `../Benefits/index.html`
- **Rouwhanes** → `../rouwhania/index.html`

### 2. Intégration du paiement (abonnement au contenu)
- **Benefits (Noms d'Allah)** : nouvelle app partagée `firebase-init.js` (Auth + RTDB,
  SDK modulaire, une seule init) et `access.js` qui rejoue la logique d'accès du hub
  (`purchased_user` / `allowedUsers` / `admins` / `vip_users`). **Sans abonnement :**
  chaque carte n'affiche que le **nom** (verrou visuel) et la **modale est verrouillée**
  (nom seul + bouton « S'abonner »). Le paiement passe par `/api/create-invoice`
  (montant fixé serveur) et **revient sur la page** (`?token=` → `confirmReturn()`).
  Accès mis en cache 6 h pour les abonnés hors-ligne.
- **Rouwhania (Rouwhanes)** : SDK compat + `access.js` qui **intercepte le bouton
  « Calculer »** en phase de capture. Sans abonnement → portail de paiement au lieu
  du calcul. Retour de paiement géré (`confirmReturn`).
- **`api/create-invoice.js`** : accepte un `returnPath` optionnel (liste blanche interne :
  accueil, Benefits, rouwhania) pour ramener l'abonné sur sa page d'origine. Le montant
  reste 100 % serveur.

### 3. Session hub persistante (`index.html`) — plus de reconnexion à chaque visite
- Persistance **LOCAL** explicite + `select_account`.
- **Repli redirection** (`signInWithRedirect` + `getRedirectResult`) quand la popup est
  bloquée (webviews / apps intégrées).
- Indicateur « Reconnexion automatique… » et drapeau local `asrar_seen` : l'utilisateur
  déjà passé une fois entre directement si la session est restaurée.
- Benefits/Rouwhania partagent la même origine et le même projet → **la session Google
  du hub est reconnue automatiquement** (pas de nouvelle connexion).

### Faiblesses corrigées
- **`Benefits/sw.js`** : bug majeur — les chemins **absolus** (`/index.html`, `/style.css`…)
  visaient la racine alors que l'app est sous `/Benefits/` → `cache.addAll()` échouait en
  bloc, **rien n'était mis en cache**. Passage en chemins **relatifs**, précache **tolérant**
  (`allSettled`), ajout des nouveaux modules, cache `asma-v8 → v9`. `manifest.json` :
  `start_url`/`scope` en `./`.
- **`Benefits/index.html`** : suppression de l'`alert()` bloquant à **chaque** erreur JS
  (remplacé par un log console). Versions d'assets `?v=7 → v8`.
- **`rouwhania/script.js`** : normalisation des Noms d'Allah en **tableau** (RTDB peut
  renvoyer un objet → `.filter` plantait).

---


## Session 4 — Administration dissociée (projet autonome + Google Sign-In)

Le back-office est désormais un **projet séparé** (livré dans un zip à part) :
- Retiré de l'application : `admin/` et `api/admin.js`. L'app conserve `api/track.js`
  (journalisation des visites/activité/géomancie, lue par l'admin).
- Le projet admin a sa **propre connexion Google Sign-In** (`firebase-config.js`
  dédié, popup + repli redirect), son **propre `/api/admin`** et ses copies des libs
  serveur nécessaires (`access`, `grant`, `plans`, `sources`, `http`).
- Même base Firebase (mêmes `FIREBASE_SERVICE_ACCOUNT` / `FIREBASE_DB_URL`) → l'admin
  lit les stats produites par l'app et écrit le contenu via l'Admin SDK.
- Appels `/api/admin` en **même origine** (le projet admin héberge son API) : pas de CORS.
- À faire : ajouter le **domaine du projet admin** dans Firebase → Authentication →
  Authorized domains, et y définir les variables d'environnement.

---


## Session 3 — Panneau d'administration

Nouveau back-office `admin/admin.html` (réservé aux admins, rôle vérifié serveur).

### Nouveaux endpoints
- `api/admin.js` (admin only) : `stats`, CRUD secrets (`db_sirr_*`), documents
  (`almaqtab`), produits (`det_produits`), gestion vendeurs (`sellers` : +30 j /
  suspendre / activer), `list-orders`, `list-activity`, `list-geomancie`.
- `api/track.js` (auth) : journalise visites (`analytics/visits/{date}/{uid}`),
  fil d'activité (`activity_feed`) et usage géomancie + localisation (`geomancie_logs`).
- `api/_lib/access.js` : ajout de `isAdmin(user)` (super-admin OU `admins/{clé}`).

### Collecte (légère)
- `js/firebase-config.js` : envoie une « visite » à `/api/track` une fois par page.
- `geomancie/tourab.html` : après un calcul, log best-effort de la position GPS.

### Interface admin (`admin/admin.html` + `admin.js` + `admin.css`)
Onglets : Tableau de bord (visites jour/semaine/mois + graphe 14 j + totaux),
Secrets, Documents, Marché, Boutiques, Commandes, Activité, Géomancie (avec
localisation et lien Google Maps).

### Règles RTDB
Ajout de `analytics`, `activity_feed` (+`.indexOn:["at"]`), `geomancie_logs`
(+`.indexOn:["at"]`) en **serveur uniquement**, et `admins/{cléEmail}` lisible par
son propriétaire (pour que le gate client reconnaisse aussi les admins non super-admin).

### Confidentialité
La géomancie capture la position **au mieux** (consentement GPS). Informez vos
utilisateurs et prévoyez une purge périodique des logs.

---


## Session 2 — Boutique vendeur, gating affiné, lecteur asrar

### Géomancie — paywall au CLIC sur « Calculer l'Écu »
`geomancie/tourab.html` ne demande plus l'abonnement à l'ouverture : aucune
donnée premium n'est chargée au démarrage. Le portail PayDunya n'apparaît qu'au
**clic sur « Calculer l'Écu »** (via `ensureAccess`), et les données (`get-theme`)
ne sont récupérées qu'à ce moment-là.

### Marché — achat SANS abonnement (prix du produit)
La fiche produit et l'achat ne dépendent plus de l'abonnement au contenu :
- `api/_lib/sources.js` : le type `product` est `authOnly` (auth seule).
- `api/get-content.js` : ne vérifie `hasActiveAccess` que si la source n'est pas `authOnly`.
- `marche/marche.js` : le clic produit ouvre directement la fiche (plus de `ensureAccess`).
- L'achat reste géré par `/api/create-order` (prix vendeur + commission admin 5 %).

### Boutique vendeur (NOUVEAU sous-système)
Demande de boutique payante puis gestion de la boutique et des produits.
- **Abonnements boutique** (`api/_lib/plans.js`) : `boutique_1m` (10 000 / 30 j),
  `boutique_3m` (25 000 / 90 j), type `shop`. Un compte Google = un vendeur unique (clé = uid).
- `api/create-invoice.js` : pour un plan `shop`, tague `custom_data.kind='shop'` et
  renvoie sur `boutique/boutique.html`.
- **Nouveau** `api/_lib/sellers.js` : `grantSeller` (active/prolonge `sellers/{uid}`),
  `isActiveSeller`, `getSeller`.
- **Nouveau** `api/shop.js` (endpoint multiplexé) : `me`, `save-shop`, `save-product`,
  `delete-product`. Écritures réservées au serveur ; un vendeur ne gère QUE ses produits
  (uid imposé côté serveur). Les produits vont dans `det_produits` (nœud du Marché).
- `api/confirm-invoice.js` & `api/paydunya-ipn.js` : 3e branche `kind==='shop'` → `grantSeller`.
- **Nouveau** `boutique/boutique.html` + `boutique.js` + `boutique.css` : paiement,
  édition de la fiche boutique, CRUD produits (nom, prix, devise, image, description,
  WhatsApp, catégorie). Lien « 🏪 Ma boutique » ajouté dans `marche/marche.html`.
- `rules/purchases.rules.json` : nœud `sellers/{uid}` (lecture propriétaire) +
  `.indexOn:["uid"]` sur `det_produits` (requête des produits du vendeur).

### Secrets (asrar) — lecteur plein écran, redimensionnable, zoom
Le secret et les images n'étaient plus à l'étroit dans la carte :
- `asrar/asrar.html` : lecteur plein écran (`#secretReader`) + bouton « ⛶ Plein écran ».
- `asrar/asrar.css` : le lecteur prend **tout l'espace du device** ; sur grand écran,
  fenêtre **redimensionnable** (poignée `resize`) ; le rail des catégories se masque en
  mode détail (carte pleine largeur).
- `asrar/asrar.js` : ouverture auto du lecteur à l'ouverture d'un secret, boutons
  **A− / A+** (taille du texte mémorisée), image cliquable pour zoom plein écran.

### Planète — clarté du jour planétaire
`planete/planete.html` implémentait déjà la **géolocalisation GPS** (pas réseau), la
règle « on ne change pas de jour tant que l'heure locale n'a pas dépassé le lever du
soleil », et la **nature des heures** (Soleil/Lune favorable, Vénus/Jupiter très
favorable, Mars/Saturne défavorable, Mercure 30 min favorable / 30 min défavorable).
Ajout : le jour planétaire affiche « (nuit, avant le lever) » tant qu'on est avant le
lever, pour lever toute ambiguïté avec le jour du calendrier.

---

## Session 1 — Intégration paiement & corrections initiales

Récapitulatif des modifications apportées au hub. Tous les fichiers JS livrés
passent `node --check` ; `rules/purchases.rules.json` est un JSON valide.

---

## 1. Al-Qalam (`alqalam/`) — intégration cassée → réparée

**Symptômes :** la sous-app ne démarrait pas et le paywall ne fonctionnait pas.

- `main.js`
  - **2 erreurs de syntaxe corrigées** : `if (actionFn) actionFn actionFn();` et
    un bloc « Mode Rasm » dupliqué/tronqué (`if (e.target Rasm — protégé`) qui
    empêchait tout le module de se charger.
  - **Pont vers le système global réécrit.** L'ancien code attendait
    `window.currentUser` / `window.checkSubscription` / `window.showPaywall` /
    `window.createCheckout` (jamais exposés) et interrogeait Firebase en SDK
    **modulaire** alors que le hub tourne en **compat** → l'utilisateur connecté
    était invisible et le gate se fermait pour tout le monde. Désormais : accès =
    abonnement ASRAR PRO actif via `checkAccess()` global (repli sur lecture de
    `purchased_user`), et le paywall ouvre le **portail global** (`showSubscriptionGate`,
    offres réelles).
  - **`productId` fantôme supprimé** : on vendait `alqalam_premium`, absent de
    `plans.js` (→ HTTP 400). Remplacé par les vrais plans (défaut `sub_1y`).
- `firebase_db.js` : utilise l'**app Firebase compat globale** (`firebase.database()`)
  au lieu de créer une app modulaire « alqalam-app » séparée → fin des conflits
  d'initialisation nommée, une seule session d'auth.
- `index.html` : charge le **SDK compat + `firebase-config.js` + `api-content.js`**
  (scripts classiques) comme les pages du hub ; ordre des scripts corrigé ; style
  inline malformé (`color: var-size: …`) corrigé.

*(Inchangés : `config.js`, `store.js`, `ui_tools.js`, `pdf.js`, `formatter.js`, `style.css`.)*

## 2. `js/paydunya-client.js` — contrat serveur respecté

`createInvoice` / `createCheckout` envoyaient `{ buyerId, productId, email }`
**sans `idToken`** → 401. Désormais ils récupèrent l'`idToken` Firebase et
envoient `{ idToken, productId }`, conformément à `/api/create-invoice`.
`confirmFromReturn()` inchangé.

## 3. Géomancie (`geomancie/`) — réservée aux abonnés

- `api/get-theme.js` : la vérification `hasActiveAccess` est désormais **active**
  (était commentée) → `403 Abonnement requis` pour les non-abonnés.
- `geomancie/tourab.html` : sur un `403`, la page ouvre le **portail PayDunya**
  (`showSubscriptionGate`) au lieu d'un simple toast d'erreur ; sur `401`, retour
  à la connexion.

## 4. Marché (`marche/`) — paiement réel + commission 5 %

**Avant :** `payWithPayDunya()` n'était qu'un `alert()` (paiement non branché).

- **Nouveau** `api/create-order.js` : reçoit `{ idToken, items:[{key,quantity}] }`,
  relit les prix dans `det_produits` (le client ne fixe jamais le montant), crée la
  facture PayDunya, enregistre la commande.
- **Nouveau** `api/_lib/orders.js` : calcule total + **commission admin 5 %** +
  **reversement vendeur 95 %** (ventilés par vendeur) ; `markOrderPaid()` idempotent
  + journal `vendor_sales`.
- `marche/marche.js` : `payWithPayDunya()` appelle `create-order` et redirige ;
  confirmation au retour (`?token=`) qui vide le panier ; livraison **fictive
  (1000 FCFA) mise à 0** pour que l'affichage = le montant débité.
- `api/confirm-invoice.js` **et** `api/paydunya-ipn.js` : **aiguillage** selon
  `custom_data.kind` — `"order"` → `markOrderPaid`, sinon → `grantAccess`
  (abonnement, comportement inchangé).
- `rules/purchases.rules.json` : ajout de `orders/{uid}` (lecture propriétaire) et
  `vendor_sales` (serveur uniquement).

---

## Décisions / limites assumées

- **Pas de split automatique PayDunya** : 100 % arrive sur le compte plateforme ;
  les 95 % vendeurs sont **journalisés** pour règlement (voir README §7).
- **Navigation Marché inchangée** : voir le **détail** d'un produit (description +
  contact vendeur, via `get-content`) reste réservé aux abonnés. Seul l'**achat**
  n'exige pas d'abonnement. À ajuster si vous voulez la fiche produit en accès libre.
- **Retour d'abonnement** : `return_url` de `create-invoice` pointe (côté serveur)
  vers `accueil/accueil.html`. Après un paiement d'abonnement lancé depuis une
  sous-page, l'utilisateur revient à l'accueil (l'IPN débloque quand même l'accès).
  Le retour du **Marché**, lui, pointe bien vers `marche/marche.html`.
