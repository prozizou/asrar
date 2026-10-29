package com.asrarpro.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AlertDialog;
import androidx.core.splashscreen.SplashScreen;
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

    // Mise à jour Google Play (In-App Updates) OBLIGATOIRE : vérifiée à
    // l'ouverture et à chaque retour au premier plan. Dès qu'une nouvelle
    // version est disponible sur le Play Store, l'écran de mise à jour Play
    // s'ouvre ; s'il est annulé, une boîte de dialogue non annulable bloque
    // l'app (« Mettre à jour » ou « Quitter ») jusqu'à l'installation. Ne
    // concerne que l'app native (le site chargé dans la WebView se met à jour
    // seul, via Vercel). Sans effet hors Play Store (APK de test…).
    private static final String PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.Asrar";
    private AppUpdateManager appUpdateManager;
    private AlertDialog forceUpdateDialog;
    private boolean updateFlowRunning = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local (voir AsrarNativePlugin) — à enregistrer AVANT
        // super.onCreate(), qui crée le bridge.
        registerPlugin(AsrarNativePlugin.class);
        registerPlugin(PlanetAlarmPlugin.class);
        registerPlugin(UnityAdsPlugin.class);
        // Affichage bord à bord sur TOUTES les versions d'Android (imposé
        // d'office à partir d'Android 15 par targetSdk 36, recommandé par
        // Android vitals pour les versions antérieures) — avant
        // super.onCreate(), qui pose la vue. Les zones système restent
        // dégagées par le site (safe areas CSS, app/globals.css) à partir des
        // insets transmis par le plugin SystemBars de Capacitor.
        // Apply the post-splash NoActionBar theme before AppCompat creates
        // its window decor; changing themes afterwards can leave a title bar.
        SplashScreen.installSplashScreen(this);
        EdgeToEdge.enable(this);
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
    public void onResume() {
        super.onResume();
        checkForPlayUpdate(false);
    }

    // userRequested : bouton « Mettre à jour » de la boîte de dialogue. Sinon
    // (retour au premier plan), la boîte déjà affichée reste en place sans
    // relancer l'écran Play — pas de boucle annuler → relancer.
    private void checkForPlayUpdate(boolean userRequested) {
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
                if (!pending) {
                    hideForceUpdateDialog();
                    return;
                }
                if (updateFlowRunning || (isForceUpdateDialogShowing() && !userRequested)) return;
                if (!info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    if (userRequested) openPlayStore();
                    showForceUpdateDialog();
                    return;
                }
                updateFlowRunning = true;
                appUpdateManager
                    .startUpdateFlow(info, this, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build())
                    .addOnSuccessListener((Integer result) -> {
                        updateFlowRunning = false;
                        if (result != Activity.RESULT_OK) showForceUpdateDialog();
                    })
                    .addOnFailureListener(e -> {
                        updateFlowRunning = false;
                        showForceUpdateDialog();
                    });
            })
            // Pas installée depuis le Play Store (APK de test…) ou Play
            // indisponible : on ne bloque pas, sauf demande explicite.
            .addOnFailureListener(e -> {
                if (userRequested) openPlayStore();
            });
    }

    private boolean isForceUpdateDialogShowing() {
        return forceUpdateDialog != null && forceUpdateDialog.isShowing();
    }

    private void showForceUpdateDialog() {
        if (isFinishing() || isForceUpdateDialogShowing()) return;
        forceUpdateDialog = new AlertDialog.Builder(this)
            .setTitle("Mise à jour requise")
            .setMessage("Une nouvelle version d'ASRAR PRO est disponible. Mettez l'application à jour pour continuer à l'utiliser.")
            .setCancelable(false)
            .setPositiveButton("Mettre à jour", (d, w) -> checkForPlayUpdate(true))
            .setNegativeButton("Quitter", (d, w) -> finishAffinity())
            .create();
        forceUpdateDialog.setCanceledOnTouchOutside(false);
        forceUpdateDialog.show();
    }

    private void hideForceUpdateDialog() {
        if (isForceUpdateDialogShowing()) forceUpdateDialog.dismiss();
        forceUpdateDialog = null;
    }

    private void openPlayStore() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_STORE_URL)));
        } catch (Exception e) {
            Toast.makeText(this, "Ouvrez le Play Store pour mettre à jour ASRAR PRO.", Toast.LENGTH_LONG).show();
        }
    }
}
