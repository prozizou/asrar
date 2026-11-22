# Diagnostics v46.97 / administration v39

Les nouveaux événements transmettent un contexte technique borné et nettoyé deux fois (client et serveur). Le TXT exporte le contexte de la dernière occurrence reçue : tâches Word/PDF, résultat, étapes API auth/token/en-têtes/JSON et temps total ; source de mesure Long Tasks ou heartbeat, durée brute et dialogue natif exclu ; réseau déclaré, débit/RTT estimés, viewport, cœurs/mémoire lorsque disponibles ; douze actions techniques récentes au maximum, avec temps depuis le début de navigation.

Les piles sont limitées aux positions de fichiers, sans messages ou arguments. Pour une API lente, la pile désigne son appelant, pas la cause serveur. Les chronologies ne contiennent ni texte de boutons, ni saisie, corps HTTP, secrets ou paramètres URL. Aucun journal console libre n’est transmis. Chaque étape interrompue reçoit son temps écoulé.

Les tâches instrumentées émettent un événement au-delà de 1 000 ms strictement, même sans gel du thread. Word/PDF transmettent aussi les erreurs interceptées ; le dialogue natif est soustrait du temps de préparation. Les événements restent soumis aux quotas existants. Les autres tâches non instrumentées sont observées via API, erreurs globales et blocages du thread : ce n’est pas un profiler universel.

Les anciens rapports restent lisibles mais leurs détails ne sont pas reconstituables. Une mesure navigateur ne peut garantir la cause racine (par exemple une panne opérateur ou un traitement distant). Une attribution de tâche Long Tasks peut être absente. Les détails de la dernière occurrence et la durée maximale du groupe peuvent provenir d’occurrences différentes.
