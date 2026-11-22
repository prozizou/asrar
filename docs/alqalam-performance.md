# Al-Qalam : blocages pendant les exports (SW v46.95)

Un rapport de v46.93 signalait deux retards sur `/alqalam`, dont 19 255 ms,
pendant un export Word/PDF sur Android web. Ce rapport ne contient ni texte
privé ni pile d’appel ; il ne suffit pas à attribuer le retard à un calcul
précis. La version utilisait encore un heartbeat susceptible de compter le
temps d’une boîte native d’impression comme un blocage.

## Préparation Word et PDF classiques

`htmlToPlainText` évite DOMPurify et un aller-retour DOM lorsque l’unité est
déjà du texte brut sans balise ni entité. Les unités HTML passent toujours
par la sanitisation et l’extraction DOM. L’extraction des blocs rend la main
au navigateur entre deux blocs ; la calibration PDF fait de même entre deux
tailles candidates. Le corps final contient toujours toutes les répétitions.

Le budget de deux millions de caractères (cadres inclus) est calculé avant
`repeat` et la compression/mise en page. Au-delà, le document n’est pas tronqué :
un message invite à réduire les répétitions ou exporter les blocs séparément.
Word conserve son Worker d’assemblage/compression. Le PDF classique conserve
l’impression native et son texte vectoriel arabe.

`withBrowserDialog` mesure seulement l’appel synchrone à la boîte native
(`window.print`, clic de téléchargement Word). La durée de cette interaction
normale est soustraite des Long Tasks et du retard du heartbeat. Si une même
tâche contient aussi plus d’une seconde de vrai calcul hors de cette attente,
ce reste est signalé. La préparation avant la boîte reste surveillée. Cette
exception n’arrête pas globalement le suivi et ne change aucun quota RTDB.

## Ornement et PDF vectoriel

La composition synchrone et Clipper/HarfBuzz étaient exécutés dans les rendus
React de l’aperçu. Ils s’exécutent maintenant dans `alqalamOrnementWorker.js`.
Un changement de texte, vœu, lettres, échelle ou cadre annule le Worker précédent,
avec un délai de 200 ms pour ne pas démarrer un calcul à chaque frappe.

L’interface reçoit les métadonnées de pagination puis demande seulement le SVG
des pages proches de l’écran. Les SVG hors écran sont retirés ; le Worker garde
au plus six géométries vectorielles. L’export PDF attend le bon cadre, récupère
chaque géométrie dans le même Worker et conserve le rendu vectoriel A4 existant.
Les erreurs, délais de 60 s et sorties de l’outil libèrent les requêtes et Workers.

Le calage d’un même vœu dans une même forme est réutilisé dans une composition,
y compris lorsqu’il ne tient pas. Sur le cas de mesure local (100 basmalas,
vœu de 192 caractères, même police), la composition est passée d’environ 349 ms
à 98 ms. Ce chiffre ne constitue pas une mesure du téléphone du rapport.

La source répétée n’est développée qu’à l’ouverture d’Outils. La détection des
lettres travaille sur les unités, avant répétition. Une limite d’un million de
caractères est vérifiée avant `repeat` ; au-delà, l’outil explique la limite
sans modifier le document ni produire un ornement incomplet.

## Vérification

Les tests de géométrie existants sont conservés. Les nouveaux tests comparent
le SVG/les géométries du Worker avec le moteur direct et vérifient annulation,
délais, budgets et exclusion des attentes natives. Les parcours Auth/RTDB
vérifient l’interface sous ralentissement CPU ×4, les changements rapides, les
exports PDF avec cadre, le texte d’un vrai fichier DOCX et le PDF classique.
