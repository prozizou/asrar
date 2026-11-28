package com.asrarpro.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import java.util.function.Supplier;

/**
 * Garde UNE publicité récompensée chargée « en attente » pour qu'elle s'affiche sans délai
 * quand l'utilisateur la demande (la latence de chargement mesurée dans AdMob dépasse 3 s : une
 * partie des utilisateurs abandonnait avant l'affichage).
 *
 * Cycle : activé par le site pour un compte éligible (sans abonnement) → une annonce se charge ;
 * prise par AdMobAdPlatform au moment d'afficher ; dès qu'elle est fermée, la suivante est
 * rechargée automatiquement. Le site coupe le préchargement (abonné, déconnexion) : l'annonce en
 * attente est jetée. Aucune récompense n'est liée à une annonce préchargée : l'identifiant de
 * vérification serveur est renseigné juste avant l'affichage (AdMobAdPlatform).
 */
final class RewardedPreloader {
    private static final RewardedPreloader INSTANCE = new RewardedPreloader();
    static RewardedPreloader get() { return INSTANCE; }

    private final PreloadedSlot<RewardedAd> slot = new PreloadedSlot<>(PreloadedSlot.DEFAULT_TTL_MS);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable retry = this::preloadNext;
    private Supplier<Activity> activity;
    private AdMobAdPlatform platform; // consentement et initialisation du SDK, sans interface
    private volatile boolean enabled;

    private RewardedPreloader() {}

    private static long now() { return SystemClock.elapsedRealtime(); }

    /** Active ou coupe le préchargement (appelé par le site selon l'éligibilité du compte). */
    void configure(Supplier<Activity> host, boolean allowed) {
        main.post(() -> {
            activity = host;
            enabled = allowed;
            main.removeCallbacks(retry);
            if (!allowed) { slot.clear(); return; }
            if (platform == null) platform = new AdMobAdPlatform(host, null);
            preloadNext();
        });
    }

    /** Prend l'annonce en attente (null s'il n'y en a pas de valable). */
    RewardedAd take() { return slot.take(now()); }

    /** Charge l'annonce suivante si rien n'est prêt ni en cours. Sans effet si le préchargement est coupé. */
    void preloadNext() {
        main.post(() -> {
            if (!enabled || platform == null || activity == null) return;
            Activity host = activity.get();
            if (host == null || host.isFinishing() || host.isDestroyed()) return;
            int token = slot.tryStartLoad(now());
            if (token == 0) { scheduleRetryIfWaiting(); return; }
            platform.initialize(false, error -> main.post(() -> {
                if (error != null || !enabled) { slot.failed(token, now()); scheduleRetry(); return; }
                Runnable failed = () -> { slot.failed(token, now()); scheduleRetry(); };
                try {
                    // « High ecpm » d'abord, bloc récompensé par défaut s'il ne remplit pas.
                    AdUnitChain.run(AdMobAdPlatform.rewardedUnits(), (unit, next) ->
                        RewardedAd.load(host.getApplicationContext(), unit, new AdRequest.Builder().build(),
                            new RewardedAdLoadCallback() {
                                @Override public void onAdLoaded(RewardedAd loaded) { slot.loaded(token, loaded, now()); }
                                @Override public void onAdFailedToLoad(LoadAdError loadError) { next.run(); }
                            }), failed);
                } catch (RuntimeException exception) { failed.run(); }
            }));
        });
    }

    private void scheduleRetry() {
        main.removeCallbacks(retry);
        if (enabled) main.postDelayed(retry, slot.retryDelayMs() + 1000);
    }

    private void scheduleRetryIfWaiting() {
        if (slot.retryDelayMs() > 0) scheduleRetry();
    }

    /** Fin de l'application : l'annonce en attente est abandonnée. */
    void release() {
        main.post(() -> {
            enabled = false;
            main.removeCallbacks(retry);
            slot.clear();
            platform = null;
            activity = null;
        });
    }
}
