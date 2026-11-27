package com.asrarpro.app;

import android.app.Activity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.ump.UserMessagingPlatform;
import com.google.android.ump.ConsentInformation;

/** Bridge name retained for deployed web code; AdMob is the sole mediation SDK. */
@CapacitorPlugin(name = "UnityAds")
public class UnityAdsPlugin extends Plugin {
    private LevelPlayActionAds pending;
    private AdMobDisplayAds displayAds;

    @PluginMethod public void configureDisplayAds(PluginCall call) {
        Activity host = getActivity();
        if (host == null) { call.resolve(); return; }
        host.runOnUiThread(() -> {
            if (host.isDestroyed() || host.isFinishing()) { call.resolve(); return; }
            if (displayAds == null) displayAds = new AdMobDisplayAds(host, getBridge().getWebView(), () -> pending != null);
            String surface = call.getString("surface", "");
            displayAds.configure(Boolean.TRUE.equals(call.getBoolean("enabled")),
                AdMobDisplayAds.isSurface(surface) ? surface : "");
            call.resolve();
        });
    }
    @Override protected void handleOnPause() { if (displayAds != null) displayAds.paused(); }
    @Override protected void handleOnResume() {
        RewardedPreloader.get().preloadNext(); // au retour dans l'application : l'annonce en attente a pu expirer
        Activity host = getActivity();
        if (host != null && displayAds != null) {
            getBridge().getWebView().postDelayed(() -> {
                if (displayAds != null && !host.isFinishing() && !host.isDestroyed()) displayAds.resumed();
            }, 250);
        }
    }

    @PluginMethod public void getCapabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("mediation", "admob");
        result.put("adMobRewards", true);
        result.put("adMobDisplayAds", true);
        result.put("adMobRewardedInterstitial", true);
        result.put("legacyRewards", false);
        result.put("actionAdPreload", false); // Each ad must bind its own server session.
        result.put("rewardedPreload", true);  // Annonce récompensée gardée en attente (RewardedPreloader).
        result.put("rewardedSilentLoading", true); // Attente affichée par la page, sans fenêtre Android (showRewarded silent).
        result.put("privacyRequired", UserMessagingPlatform.getConsentInformation(getContext()).getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
        call.resolve(result);
    }
    @PluginMethod public void prepareActionAd(PluginCall call) { call.resolve(); }
    /** Le site active le préchargement pour un compte éligible (sans abonnement) et le coupe sinon. */
    @PluginMethod public void preloadRewarded(PluginCall call) {
        RewardedPreloader.get().configure(this::getActivity, Boolean.TRUE.equals(call.getBoolean("enabled")));
        call.resolve();
    }
    @PluginMethod public void showInterstitial(PluginCall call) {
        call.reject("Utilisez une publicité récompensée avec validation serveur", "unavailable");
    }
    @PluginMethod public void showRewarded(PluginCall call) {
        String sid = call.getString("serverId");
        Activity host = getActivity();
        if (sid == null || !sid.matches("[A-Za-z0-9_-]{1,128}\\.[a-f0-9]{32}")) { call.reject("Session requise", "invalid"); return; }
        if (host == null || host.isFinishing() || host.isDestroyed()) { call.reject("Application en arrière-plan", "background"); return; }
        host.runOnUiThread(() -> {
            if (pending != null || (displayAds != null && displayAds.isFullscreen())) { call.reject("Publicité déjà en cours", "busy"); return; }
            boolean interstitial = Boolean.TRUE.equals(call.getBoolean("interstitial"));
            boolean silent = Boolean.TRUE.equals(call.getBoolean("silent"));
            pending = new LevelPlayActionAds(this::getActivity, new AdMobAdPlatform(this::getActivity, sid, interstitial));
            LevelPlayActionAds.Result done = (shown, completed, reason) -> {
                LevelPlayActionAds finished = pending; pending = null;
                if (finished != null) finished.destroy();
                RewardedPreloader.get().preloadNext(); // annonce affichée, refusée ou en échec : une autre se prépare
                JSObject result = new JSObject();
                result.put("shown", shown); result.put("completed", completed);
                if (reason != null) result.put("reason", reason);
                call.resolve(result);
            };
            if (silent) pending.showSilent(done); else pending.showDirect(done);
        });
    }
    /** « Annuler » de la page pendant l'attente (mode silent) : sans effet si l'annonce est déjà affichée. */
    @PluginMethod public void cancelRewarded(PluginCall call) {
        Activity host = getActivity();
        if (host == null) { call.resolve(); return; }
        host.runOnUiThread(() -> { if (pending != null) pending.cancel(); call.resolve(); });
    }
    @PluginMethod public void showPrivacyOptions(PluginCall call) {
        Activity host = getActivity();
        if (host == null || host.isFinishing() || host.isDestroyed()) { call.reject("Application en arrière-plan", "background"); return; }
        host.runOnUiThread(() -> {
            if (pending != null) { call.reject("Une publicité est en cours", "busy"); return; }
            UserMessagingPlatform.showPrivacyOptionsForm(host, error -> {
                if (error == null) call.resolve(); else call.reject("Options indisponibles", "unavailable");
            });
        });
    }
    @Override protected void handleOnDestroy() {
        RewardedPreloader.get().release();
        if (pending != null) { pending.destroy(); pending = null; }
        if (displayAds != null) { displayAds.destroy(); displayAds = null; }
        super.handleOnDestroy();
    }
}
