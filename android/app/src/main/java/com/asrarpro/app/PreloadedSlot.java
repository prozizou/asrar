package com.asrarpro.app;

/**
 * Un emplacement pour UNE annonce chargée à l'avance : durée de vie, un seul chargement à la
 * fois, délai croissant entre deux échecs (pas de rafale de demandes quand aucune annonce n'est
 * disponible). Aucune dépendance Android : le temps est fourni par l'appelant (testable).
 */
final class PreloadedSlot<T> {
    // Une annonce chargée expire côté AdMob au bout d'une heure : on la jette avant.
    static final long DEFAULT_TTL_MS = 50 * 60_000L;
    static final long FIRST_RETRY_MS = 60_000L;
    static final long MAX_RETRY_MS = 15 * 60_000L;

    private final long ttlMs;
    private T ad;
    private long loadedAt;
    private boolean loading;
    private int generation = 1; // jeton > 0 : 0 signifie « ne rien charger »
    private int failures;
    private long failedAt;

    PreloadedSlot(long ttlMs) { this.ttlMs = ttlMs; }

    synchronized boolean ready(long now) { return ad != null && now - loadedAt < ttlMs; }

    /** Délai à respecter avant la prochaine demande : 1 min, 2, 4… 15 min maximum. */
    synchronized long retryDelayMs() {
        if (failures == 0) return 0;
        long delay = FIRST_RETRY_MS << Math.min(failures - 1, 10);
        return Math.min(delay, MAX_RETRY_MS);
    }

    /**
     * Autorise un chargement : renvoie un jeton (> 0) ou 0 s'il ne faut rien demander
     * (annonce déjà prête, chargement en cours, ou délai après échec non écoulé).
     */
    synchronized int tryStartLoad(long now) {
        if (loading || ready(now)) return 0;
        if (failures > 0 && now - failedAt < retryDelayMs()) return 0;
        loading = true;
        return generation;
    }

    /** Résultat d'un chargement. Faux (annonce ignorée) si l'emplacement a été vidé entre-temps. */
    synchronized boolean loaded(int token, T value, long now) {
        if (token != generation) return false;
        ad = value;
        loadedAt = now;
        loading = false;
        failures = 0;
        return true;
    }

    synchronized void failed(int token, long now) {
        if (token != generation) return;
        loading = false;
        failures++;
        failedAt = now;
    }

    /** Prend l'annonce si elle est encore valable ; l'emplacement est alors vide. */
    synchronized T take(long now) {
        T value = ready(now) ? ad : null;
        ad = null;
        return value;
    }

    /** Vide l'emplacement (préchargement coupé) ; un chargement en cours est ignoré à son retour. */
    synchronized void clear() {
        ad = null;
        loading = false;
        failures = 0;
        generation++;
    }
}
