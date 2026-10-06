package com.asrarpro.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

public class MainActivity extends BridgeActivity {

    // Délai pendant lequel un 2e appui sur retour quitte l'application.
    private static final long EXIT_WINDOW_MS = 2000;
    private long lastBackAt = 0;

    // Mise à jour Google Play (In-App Updates) : vérifiée à l'ouverture et au
    // retour au premier plan. Ne concerne que l'app native (le site chargé dans
    // la WebView se met à jour seul, via Vercel). Sans effet hors Play Store.
    private AppUpdateManager appUpdateManager;
    // Mise à jour refusée par l'utilisateur : on ne la reproposera pas avant le
    // prochain lancement de l'app.
    private boolean updateDeclined = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local (voir AsrarNativePlugin) — à enregistrer AVANT
        // super.onCreate(), qui crée le bridge.
        registerPlugin(AsrarNativePlugin.class);
        super.onCreate(savedInstanceState);

        // Bouton/geste retour Android. Sans @capacitor/app, Capacitor ne
        // l'intercepte pas : l'activité se fermait au premier appui, quelle que
        // soit la page. Ici, retour = historique de la WebView (pages Next.js,
        // mais aussi panneaux qui poussent une entrée d'historique — fiche
        // produit, boutique vendeur, cf. components/useHistoryClose.js).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    finish();
                    return;
                }
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                // Plus d'historique mais pas sur l'accueil (ouverture via une
                // notification ou un lien) : revenir à l'accueil plutôt que quitter.
                String url = webView.getUrl();
                if (url != null) {
                    Uri uri = Uri.parse(url);
                    String path = uri.getPath();
                    if (path != null && !path.isEmpty() && !"/".equals(path)) {
                        webView.loadUrl(uri.getScheme() + "://" + uri.getAuthority() + "/");
                        return;
                    }
                }
                // Accueil : double appui pour quitter (évite les sorties accidentelles).
                long now = System.currentTimeMillis();
                if (now - lastBackAt < EXIT_WINDOW_MS) {
                    finish();
                } else {
                    lastBackAt = now;
                    Toast.makeText(MainActivity.this, "Appuyez encore pour quitter", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        checkForPlayUpdate();
    }

    private void checkForPlayUpdate() {
        if (updateDeclined) return;
        if (appUpdateManager == null) {
            appUpdateManager = AppUpdateManagerFactory.create(this);
        }
        appUpdateManager
            .getAppUpdateInfo()
            .addOnSuccessListener((AppUpdateInfo info) -> {
                int availability = info.updateAvailability();
                boolean pending =
                    availability == UpdateAvailability.UPDATE_AVAILABLE
                        || availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
                if (!pending || !info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) return;
                appUpdateManager
                    .startUpdateFlow(info, this, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build())
                    .addOnSuccessListener((Integer result) -> {
                        if (result != Activity.RESULT_OK) updateDeclined = true;
                    });
            })
            // Pas installée depuis le Play Store (APK de test…) ou Play indisponible : on ignore.
            .addOnFailureListener(e -> { });
    }
}
