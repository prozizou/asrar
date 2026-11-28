package com.asrarpro.app;

/**
 * Blocs d'annonces AdMob essayés dans l'ordre : d'abord le bloc « high » (eCPM minimal élevé),
 * puis, s'il ne renvoie aucune annonce, le bloc par défaut. En debug, une seule unité de
 * démonstration Google (jamais de vraies annonces).
 *
 * Aucune dépendance Android : le chargement réel est fourni par l'appelant (testable).
 */
final class AdUnitChain {
    static final String PUBLISHER = "ca-app-pub-3895250961868134/";
    static final String TEST = "ca-app-pub-3940256099942544/";

    //                                         high          défaut        démonstration
    static final String[] APP_OPEN =             {"1739268591", "8571013678", "9257395921"};
    static final String[] INTERSTITIAL =         {"6831813175", "7998946847", "1033173712"};
    static final String[] BANNER =               {"6582345828", "4160161224", "6300978111"};
    static final String[] REWARDED =             {"2847200667", "9551701662", "5224354917"};
    static final String[] REWARDED_INTERSTITIAL = {"6939945186", "3047224257", "5354046379"};

    /** Chargement d'une unité : appeler {@code next} si elle ne renvoie pas d'annonce. */
    interface Attempt { void load(String unit, Runnable next); }

    private AdUnitChain() {}

    /** Identifiants complets à essayer, dans l'ordre. */
    static String[] units(String[] format, boolean debug) {
        if (debug) return new String[] { TEST + format[2] };
        return new String[] { PUBLISHER + format[0], PUBLISHER + format[1] };
    }

    /** Essaie chaque unité tant que la précédente échoue ; {@code exhausted} si aucune ne remplit. */
    static void run(String[] units, Attempt attempt, Runnable exhausted) { step(units, 0, attempt, exhausted); }

    private static void step(String[] units, int index, Attempt attempt, Runnable exhausted) {
        if (index >= units.length) { exhausted.run(); return; }
        boolean[] done = { false };
        attempt.load(units[index], () -> {
            if (done[0]) return; // un échec signalé deux fois ne saute pas une unité
            done[0] = true;
            step(units, index + 1, attempt, exhausted);
        });
    }
}
