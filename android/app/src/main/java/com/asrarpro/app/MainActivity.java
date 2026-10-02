package com.asrarpro.app;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Délai pendant lequel un 2e appui sur retour quitte l'application.
    private static final long EXIT_WINDOW_MS = 2000;
    private long lastBackAt = 0;

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
}
