# Ressource indisponible — v46.98

La version précédente collectait seulement le type resource pour les erreurs SCRIPT/LINK. Le nouveau contexte contient le chemin nettoyé src/href, le type script/stylesheet/link et le résultat error. Le chemin intervient dans le regroupement client et serveur pour ne plus confondre deux fichiers différents. Aucun GET supplémentaire ni répétition de chargement n’est ajouté.

L’événement error d’un élément ne fournit ni statut HTTP, ni durée, ni cause racine. Un statut absent et une durée 0 représentent des informations indisponibles, pas une réponse HTTP 0 ni un chargement instantané. L’absence de pile est normale pour cet événement. Les paramètres URL et fragments sont supprimés ; le domaine n’est pas conservé.

online reflète l’état déclaré lors de l’observation, tandis que les estimations 4g/downlink/RTT peuvent rester anciennes hors ligne. observedAt désigne l’observation et firstAt la réception serveur, éventuellement ultérieure. Les api-end de la chronologie indiquent une fin, sans prouver à eux seuls une réussite ou un timeout. Leurs rapports API dédiés fournissent résultat/phase/durée.

Le fichier perdu ne peut être retrouvé rétroactivement à partir d’un ancien rapport. Les prochains incidents reçoivent ce contexte dans Firebase puis dans le TXT existant de l’administration.
