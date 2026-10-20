package com.asrarpro.app;

import android.app.Activity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.IUnityAdsLoadListener;
import com.unity3d.ads.IUnityAdsShowListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsShowOptions;
import com.unity3d.ads.metadata.PlayerMetaData;
import java.util.ArrayList;
import java.util.List;

/**
 * Publicités récompensées Unity Ads — alternative à l'abonnement (lib/unityAds.js).
 * Unity n'a pas de SDK web : la WebView appelle ce plugin, qui affiche la
 * publicité en plein écran et indique si elle a été regardée jusqu'au bout.
 *
 * Le crédit n'est PAS accordé ici : le serverId (session créée par
 * /api/ad-reward) est transmis à Unity, dont les serveurs appellent ensuite
 * /api/unity-ads-callback avec une signature — seule source de récompense.
 */
@CapacitorPlugin(name = "UnityAds")
public class UnityAdsPlugin extends Plugin {

    private interface InitCallback {
        void done(String error);
    }

    // Appels arrivés pendant l'initialisation (une seule à la fois).
    private final List<InitCallback> initWaiters = new ArrayList<>();
    private boolean initializing = false;

    @PluginMethod
    public void showRewarded(PluginCall call) {
        String gameId = call.getString("gameId");
        String placementId = call.getString("placementId");
        String serverId = call.getString("serverId");
        boolean testMode = Boolean.TRUE.equals(call.getBoolean("testMode", false));
        if (gameId == null || gameId.isEmpty() || placementId == null || placementId.isEmpty() || serverId == null || serverId.isEmpty()) {
            call.reject("gameId, placementId et serverId sont requis", "invalid");
            return;
        }
        ensureInitialized(gameId, testMode, (error) -> {
            if (error != null) {
                call.reject(error, "init");
                return;
            }
            loadAndShow(call, placementId, serverId);
        });
    }

    private void ensureInitialized(String gameId, boolean testMode, InitCallback callback) {
        if (UnityAds.isInitialized()) {
            callback.done(null);
            return;
        }
        synchronized (initWaiters) {
            initWaiters.add(callback);
            if (initializing) return;
            initializing = true;
        }
        UnityAds.initialize(getContext().getApplicationContext(), gameId, testMode, new IUnityAdsInitializationListener() {
            @Override
            public void onInitializationComplete() {
                finishInit(null);
            }

            @Override
            public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                finishInit("Initialisation Unity Ads impossible : " + message);
            }
        });
    }

    private void finishInit(String error) {
        List<InitCallback> waiters;
        synchronized (initWaiters) {
            initializing = false;
            waiters = new ArrayList<>(initWaiters);
            initWaiters.clear();
        }
        for (InitCallback w : waiters) w.done(error);
    }

    private void loadAndShow(PluginCall call, String placementId, String serverId) {
        UnityAds.load(placementId, new IUnityAdsLoadListener() {
            @Override
            public void onUnityAdsAdLoaded(String loadedPlacementId) {
                Activity activity = getActivity();
                if (activity == null) {
                    call.reject("Application en arrière-plan", "error");
                    return;
                }
                activity.runOnUiThread(() -> {
                    // Relie cette publicité à la session serveur (rappel S2S).
                    PlayerMetaData meta = new PlayerMetaData(getContext());
                    meta.setServerId(serverId);
                    meta.commit();
                    UnityAds.show(activity, loadedPlacementId, new UnityAdsShowOptions(), showListener(call));
                });
            }

            @Override
            public void onUnityAdsFailedToLoad(String failedPlacementId, UnityAds.UnityAdsLoadError error, String message) {
                String code = error == UnityAds.UnityAdsLoadError.NO_FILL ? "no_fill" : "error";
                call.reject("Publicité indisponible : " + message, code);
            }
        });
    }

    private IUnityAdsShowListener showListener(PluginCall call) {
        return new IUnityAdsShowListener() {
            @Override
            public void onUnityAdsShowFailure(String placementId, UnityAds.UnityAdsShowError error, String message) {
                call.reject("Affichage impossible : " + message, "error");
            }

            @Override
            public void onUnityAdsShowStart(String placementId) {}

            @Override
            public void onUnityAdsShowClick(String placementId) {}

            @Override
            public void onUnityAdsShowComplete(String placementId, UnityAds.UnityAdsShowCompletionState state) {
                JSObject ret = new JSObject();
                ret.put("completed", state == UnityAds.UnityAdsShowCompletionState.COMPLETED);
                call.resolve(ret);
            }
        };
    }
}
