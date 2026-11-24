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

    @PluginMethod public void getCapabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("mediation", "admob");
        result.put("adMobRewards", true);
        result.put("legacyRewards", false);
        result.put("actionAdPreload", false); // Each ad must bind its own server session.
        result.put("privacyRequired", UserMessagingPlatform.getConsentInformation(getContext()).getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
        call.resolve(result);
    }
    @PluginMethod public void prepareActionAd(PluginCall call) { call.resolve(); }
    @PluginMethod public void showInterstitial(PluginCall call) {
        call.reject("Utilisez une publicité récompensée avec validation serveur", "unavailable");
    }
    @PluginMethod public void showRewarded(PluginCall call) {
        String sid = call.getString("serverId");
        Activity host = getActivity();
        if (sid == null || !sid.matches("[A-Za-z0-9_-]{1,128}\\.[a-f0-9]{32}")) { call.reject("Session requise", "invalid"); return; }
        if (host == null || host.isFinishing() || host.isDestroyed()) { call.reject("Application en arrière-plan", "background"); return; }
        host.runOnUiThread(() -> {
            if (pending != null) { call.reject("Publicité déjà en cours", "busy"); return; }
            pending = new LevelPlayActionAds(this::getActivity, new AdMobAdPlatform(this::getActivity, sid));
            pending.show((shown, completed, reason) -> {
                LevelPlayActionAds finished = pending; pending = null;
                if (finished != null) finished.destroy();
                JSObject result = new JSObject();
                result.put("shown", shown); result.put("completed", completed);
                if (reason != null) result.put("reason", reason);
                call.resolve(result);
            });
        });
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
        if (pending != null) { pending.destroy(); pending = null; }
        super.handleOnDestroy();
    }
}
