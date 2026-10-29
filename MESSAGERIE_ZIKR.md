# Messagerie Zikr collectif

La discussion réutilise les groupes, adhésions, messages et notifications
existants. La récitation, les objectifs, demandes d’adhésion, avertissements,
vœux et fonctions de modération sont conservés. Aucun secret Cloudinary ni
Firebase Admin n’est utilisé dans le navigateur.

## Interface

- Barre supérieure de 56 px avec nom et présence, invocation repliable depuis
  le nom du groupe, sans ligne réservée lorsqu’elle est fermée, et conversation
  extensible ; prise en compte des zones système et du clavier.
- Fond et commandes violet/noir ; bulles envoyées vert clair, reçues neutres,
  avec variantes clair/sombre. Largeur maximale 80 %, identité regroupée,
  dates, heures, indicateurs d’envoi et informations de lecture.
- Réponse par glissement vers la droite ou menu accessible ; appui long,
  réactions, copie, édition de son texte/image, suppression de son message
  pour le groupe et transfert vers un groupe auquel on appartient.
- Image prévisualisée avant envoi : rotation, recadrage, position, luminosité,
  texte incrusté et légende. Export du résultat en JPEG pour l’envoi. Une image
  existante ne peut être modifiée que par son auteur. Zoom et défilement de
  l’image agrandie, réglage accessible et double clic/tap de zoom.
- Vocal : lecture, position, vitesses 1×/1,5×/2× ; forme d’onde extraite
  localement des nouveaux vocaux si le navigateur décode le format, repère
  neutre pour les anciens. Un seul lecteur actif à la fois.
- Appui court sur le microphone : enregistrement mains libres. Appui maintenu :
  relâcher pour envoyer, glisser vers le haut pour verrouiller ou vers la
  gauche pour annuler. Commandes clavier alternatives explicites. À la sortie
  de la discussion ou au passage en arrière-plan, un enregistrement interrompu
  reste un brouillon en mémoire, téléchargeable et renvoyable ; les pistes du
  microphone sont arrêtées. Fermer/recharger la page perd ce brouillon.

## Données et permissions

Les nouveaux champs sont optionnels : `version`, `replyTo`, `forwarded`,
`editedAt`, `deleted`, `reactions`, `mediaWaveform`. Les messages historiques
restent lisibles sans migration. Une suppression conserve un marqueur sans
texte ni média ; les réponses ne stockent que l’identifiant parent. Le flux
`zikr_chat_changes/{gid}` ne conserve que des identifiants, jamais d’anciennes
copies des contenus supprimés. Les copies déjà transférées restent dans leurs
propres discussions ; ce n’est pas une suppression physique du fichier
Cloudinary ou des copies téléchargées par les participants.

Toutes les opérations vérifient l’adhésion côté serveur. L’édition et la
suppression exigent l’auteur, le transfert vérifie les deux groupes et copie
le contenu existant côté serveur. Les transactions empêchent de ressusciter
un message supprimé par une édition concurrente. Les réactions sont bornées
à une par utilisateur et à six symboles autorisés.

Les reçus sont enregistrés explicitement dans
`zikr_chat_reads/{gid}/{messageId}/{uid}`, après visibilité suffisante et brève
présence à l’écran, dans la discussion active, sans fenêtre modale devant.
Une lecture périodique de l’API ou l’ouverture d’un autre onglet n’est pas un
accusé de lecture. Le premier horodatage est conservé ; terminer un vocal est
un état distinct. L’auteur seul peut demander la liste des lecteurs, sans
leurs emails ni numéros. « Envoyé » indique l’acceptation serveur ; les compteurs
« Vu par » se mettent à jour chez l’auteur via des marqueurs privés, idempotents
et limités aux cinquante messages récents de cet auteur. La liste nominative
se consulte et s’actualise dans les informations du message.

## Temps réel, coûts et cycle de vie

Un petit signal RTDB autorisé par groupe invalide les données API ; les
contenus restent servis par l’API. Voir les règles dans
[rules/README.md](rules/README.md). En cas d’indisponibilité, le repli API
fonctionne toutes les 12 secondes tant que la page est visible. Les écoutes,
observateurs et minuteries sont libérés ; le retour au premier plan provoque
une réconciliation. Un cache en mémoire, isolé par compte et groupe, expire
après deux minutes et garde au plus cinq groupes de cinquante messages. Aucun
historique de discussion n’est persisté en clair dans localStorage.

Le chargement initial et les pages historiques sont bornés à cinquante
messages. Les sondages demandent les nouveaux messages et les mutations par
curseur ; une réconciliation récente intervient chaque minute. Le chargement
d’un historique préserve l’ancrage et les nouveaux messages ne forcent pas le
retour en bas pendant la lecture d’anciens messages.

## Validation et livraison

Tests unitaires des permissions, transactions, suppression, transfert, reçus,
pagination, formes d’onde et séparation du cache. Parcours Playwright
connectés aux émulateurs Auth/RTDB, y compris règles, défilement, lectures,
réponses, réactions, édition, transfert, images et vocaux. Les transferts
Cloudinary sont simulés ; aucun média ni message n’est envoyé à un service
réel pendant les tests.

Livraison prévue avec Android 7.9.5 et le service worker v46.31. Les règles
Firebase doivent être publiées séparément pour activer les signaux temps réel
et les compteurs privés ; le repli API reste opérationnel avant leur publication.
Une validation sur appareil Android réel, avec son clavier et ses autorisations
micro/caméra, reste nécessaire en complément des tests navigateur.


Validation locale effectuée : 806 tests unitaires, compilation Next, lint et
contrôle des types réussis. La suite authentifiée complète a validé 69 parcours
sur 70 ; le point restant concernait l’espace de clavier sur appareil avec
zone système basse. Après correction, les 14 parcours ciblés de mise en page,
audio et messagerie passent, y compris ce cas, les compteurs de lecture privés
et l’affichage de 320 px au bureau. Les survols conservent la position des
commandes flottantes.
