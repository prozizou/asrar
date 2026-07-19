# Analyse — ASRAR PRO : forces, faiblesses & améliorations

> Revue technique de l'application (PWA) et travail de mise en responsive.
> Voir aussi `REVUE.md` (corrections fonctionnelles asrar/marche).

## ✅ Forces

- **PWA complète** : `manifest.json`, `sw.js` (cache offline) et `pwa.js`
  (invite d'installation personnalisée). L'app est installable et fonctionne
  hors-ligne pour les pages déjà visitées.
- **Système de thème centralisé** : `css/style.css` définit une **source unique
  de tokens** (`:root` = sombre, `html[data-theme="light"]` = clair). Le toggle
  clair/sombre est cohérent car les pages consomment des variables CSS plutôt
  que des couleurs codées en dur.
- **Sécurité du contenu payant côté serveur** : le paywall est vérifié dans les
  fonctions serverless (`/api/*`), pas seulement dans le navigateur — le contenu
  sensible (`sirr`, contacts vendeurs) transite par `/api/get-content`
  (cf. `REVUE.md`). C'est la bonne architecture.
- **Auth robuste** : connexion Google via Firebase avec **repli automatique
  popup → redirection** (`index.html`) pour les webviews/in-app browsers, plus
  persistance locale de session et reconnexion silencieuse.
- **Architecture modulaire claire** : chaque domaine (asrar, marché, boutique,
  alqalam, géomancie, Benefits…) est isolé dans son dossier.
- **Bases d'accessibilité** : `aria-label` sur les boutons d'action, `h1`
  masqué visuellement mais lisible par lecteurs d'écran, `alt` sur les images.
- **Bilingue FR/arabe** : polices arabes dédiées (`Noto Naskh Arabic`) et
  échelle typographique paramétrable (`--asrar-scale`).

## ⚠️ Faiblesses

- **Responsive incomplet** *(corrigé ici)* : la feuille partagée `css/style.css`
  et `boutique/boutique.css` n'avaient **aucune media query**, alors que la
  première pilote les pages d'entrée (connexion + tableau de bord). Paddings et
  tailles de titres fixes rognaient l'écran sur petit mobile.
- **Duplication des tokens de thème** : chaque module redéfinit son propre jeu
  de variables (`--bq-*`, `--asrar-*`, `--mk-*`) au lieu de réutiliser les
  tokens partagés → risque d'incohérence et maintenance plus lourde.
- **Dépendances CDN sans intégrité** : Firebase est chargé depuis
  `gstatic.com` sans attribut `integrity` (SRI). Panne réseau = app KO, et pas
  de garantie d'intégrité du script.
- **Polices bloquantes** : `@import` Google Fonts en tête de `style.css`
  (rendu bloquant + requête tierce/vie privée).
- **Dépendances externes au runtime** : `planete.html` appelle 3 API tierces
  (déjà signalé dans `REVUE.md` — un calcul NOAA hors-ligne existe déjà dans
  `js/main.js`).
- **Pas de tests automatisés ni d'étape de build** (bundling/minification).

## 🔧 Améliorations réalisées (ce commit)

- `css/style.css` : socle **responsive** complet (points de rupture 900 / 600 /
  420 / 340 px), garde-fous anti-débordement horizontal (`overflow-x`,
  `img{max-width:100%}`), et respect de `prefers-reduced-motion`.
- `boutique/boutique.css` : media queries mobiles — formulaires en pleine
  largeur, grille de plans adaptative, cartes produit qui ne débordent plus,
  modale ajustée.

## 🚀 Améliorations proposées (suite)

1. **Unifier les tokens de thème** : dériver `--bq-*`, `--asrar-*`, `--mk-*` des
   variables partagées (ou les fusionner) pour une seule source de vérité.
2. **Fiabiliser les dépendances** : self-héberger Firebase/les polices, ou
   ajouter SRI + `preconnect`/`font-display: swap`.
3. **Images** : ajouter `loading="lazy"` et `width`/`height` aux visuels
   produits (marché, boutique) pour la perf et éviter le layout shift.
4. **Basculer `planete.html` sur le calcul NOAA hors-ligne** déjà présent.
5. **Ajouter un audit Lighthouse** et quelques tests de non-régression.
