# ASRAR PRO — Refonte UI/UX « Heures planétaires »

Base analysée : dépôt `prozizou/asrar`, branche `main`, commit `72b166914113986433bd6de0e14707280e9c3c00`.

## Contenu du ZIP

- `app/planete/planete.css` : remplacement complet du style actuel du module `/planete`.
- `public/planete/decor-mystique.png` : objet décoratif PNG transparent utilisé de façon très discrète dans l'interface.
- `APERÇU_PLANETE.png` : maquette visuelle de référence uniquement, elle n'est pas utilisée par l'application.

## Installation

1. Décompresser le ZIP à la racine du projet `asrar`.
2. Accepter le remplacement de `app/planete/planete.css`.
3. Vérifier que `public/planete/decor-mystique.png` a bien été ajouté.
4. Lancer le projet comme d'habitude (`npm run dev`) et ouvrir `/planete`.
5. Si le résultat convient, pousser les fichiers sur GitHub.

Aucune nouvelle dépendance npm n'est nécessaire.

## Ce qui a été amélioré

- densité verticale réduite pour limiter le scroll mobile ;
- heure planétaire actuelle plus dominante ;
- meilleure lisibilité de l'heure, de la date, de la nature et du temps restant ;
- cartes plus homogènes et rendu « glass » plus maîtrisé ;
- meilleur contraste des textes secondaires ;
- timeline plus compacte, heures passées atténuées et heure actuelle fortement mise en évidence ;
- alarmes plus compréhensibles : cloche sobre inactive, cloche mise en valeur + coche lorsqu'elle est activée ;
- cibles tactiles agrandies pour les alarmes, switchs et actions ;
- onglets Jour/Nuit sticky pendant le défilement ;
- bouton de calcul masqué une fois la timeline affichée pour réduire le bruit visuel ;
- bloc des régents simplifié et plus compact ;
- adaptation mobile, tablette et desktop ;
- disposition desktop exploitant mieux la largeur ;
- focus clavier visible et support de `prefers-reduced-motion` ;
- décor mystique conservé mais volontairement très discret pour ne pas nuire aux données.

## Ce qui n'a PAS été modifié

- `app/planete/page.tsx` ;
- moteur `lib/planete.js` ;
- calcul lever/coucher ;
- GPS ;
- ordre chaldéen ;
- logique des alarmes natives ;
- logique des notifications Web/PWA ;
- contrôle d'accès.

La refonte est donc volontairement isolée au niveau UI/UX afin de réduire les risques de régression fonctionnelle.
