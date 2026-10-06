package com.asrarpro.app;

import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Délai pendant lequel un 2e appui sur retour quitte l'application.
    private static final long EXIT_WINDOW_MS = 2000;
    private long lastBackAt = 0;

    /**
     * Safe-area NATIVE : la WebView est placée exactement entre la barre de
     * statut (heure, Wi-Fi, batterie, encoche) et la barre de navigation
     * (≡ ○ ↩ ou barre gestuelle), avec les insets RÉELS de l'appareil — pas
     * un padding fixe. Vaut pour toutes les pages, quelle que soit la
     * version de la WebView ou la balise viewport du site
     * (capacitor.config.ts : SystemBars.insetsHandling = 'disable').
     * Le clavier ouvert remplace l'inset bas (le contenu reste au-dessus).
     */
    private void applySystemBarInsets() {
        // Même comportement « bord à bord » sur toutes les versions
        // d'Android (imposé à partir d'Android 15) : c'est nous qui décalons.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View content = findViewById(android.R.id.content);
        final int systemTypes = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(systemTypes);
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            // Insets remis à 0 pour la WebView : env(safe-area-inset-*) = 0,
            // donc aucune page ne rajoute une 2e marge. (Pas CONSUMED : casse
            // le recalcul des insets, cf. issues.chromium.org/461332423.)
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(systemTypes, Insets.NONE)
                .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                .build();
        });
        ViewCompat.requestApplyInsets(content);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local (voir AsrarNativePlugin) — à enregistrer AVANT
        // super.onCreate(), qui crée le bridge.
        registerPlugin(AsrarNativePlugin.class);
        super.onCreate(savedInstanceState);

        applySystemBarInsets();

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
