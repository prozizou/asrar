package com.asrarpro.mediationtest;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ScrollView;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import com.unity3d.mediation.LevelPlay;
import com.unity3d.mediation.LevelPlayConfiguration;
import com.unity3d.mediation.LevelPlayInitError;
import com.unity3d.mediation.LevelPlayInitListener;
import com.unity3d.mediation.LevelPlayInitRequest;

/** Opens only the official SDK test suite; no normal load/show or credit API. */
public class DiagnosticActivity extends Activity {
    private final Handler main = new Handler(Looper.getMainLooper());
    private TextView status;
    private Button open;
    private boolean busy;
    private boolean initialized;
    private int attempt;
    private Runnable timeout;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int space = Math.round(24 * getResources().getDisplayMetrics().density);
        layout.setPadding(space, space, space, space);
        TextView heading = new TextView(this);
        heading.setText("ASRAR — Test des publicités"); heading.setTextSize(24);
        layout.addView(heading);
        TextView explanation = new TextView(this);
        explanation.setText("Diagnostic LevelPlay : Unity Ads, Google et BIGO.\n\nCette application de test est séparée d’ASRAR PRO. Elle sert à vérifier les régies et ne modifie ni vos abonnements ni vos messages.\n\nDans l’outil LevelPlay, testez les formats Rewarded et Interstitial de chaque réseau.\n");
        explanation.setTextSize(17); layout.addView(explanation);
        open = new Button(this); open.setText("Ouvrir le diagnostic LevelPlay");
        open.setOnClickListener(v -> startDiagnostic()); layout.addView(open);
        status = new TextView(this); status.setTextSize(16); layout.addView(status);
        ScrollView scroll = new ScrollView(this); scroll.addView(layout);
        setContentView(scroll);
    }

    private boolean active(int id) { return id == attempt && !isFinishing() && !isDestroyed(); }
    private void startDiagnostic() {
        if (busy) return;
        if (initialized) { launch(); return; }
        busy = true; open.setEnabled(false);
        int id = ++attempt;
        status.setText("Préparation et vérification du consentement…");
        timeout = () -> fail(id, "Délai dépassé. Vérifiez votre connexion puis réessayez.");
        main.postDelayed(timeout, 120_000);
        ConsentInformation consent = UserMessagingPlatform.getConsentInformation(this);
        consent.requestConsentInfoUpdate(this, new ConsentRequestParameters.Builder().build(), () -> {
            if (!active(id)) return;
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, error -> {
                if (!active(id)) return;
                if (!consent.canRequestAds()) { fail(id, "Consentement non disponible. Vérifiez les messages de confidentialité dans AdMob."); return; }
                initialize(id);
            });
        }, error -> {
            if (!active(id)) return;
            if (consent.canRequestAds()) initialize(id);
            else fail(id, "Consentement : " + error.getErrorCode() + " — " + error.getMessage());
        });
    }

    private void initialize(int id) {
        status.setText("Initialisation de LevelPlay…");
        LevelPlay.setMetaData("is_test_suite", "enable");
        LevelPlay.init(getApplicationContext(), new LevelPlayInitRequest.Builder(BuildConfig.LEVELPLAY_APP_KEY).build(), new LevelPlayInitListener() {
            @Override public void onInitSuccess(LevelPlayConfiguration config) {
                if (!active(id)) return;
                initialized = true; settle();
                status.setText("LevelPlay prêt. L’outil officiel va afficher l’état des réseaux.");
                launch();
            }
            @Override public void onInitFailed(LevelPlayInitError error) { fail(id, "LevelPlay : " + error); }
        });
    }
    private void launch() {
        try { LevelPlay.launchTestSuite(getApplicationContext()); }
        catch (RuntimeException error) { status.setText("Ouverture du diagnostic impossible : " + error.getMessage()); }
    }
    private void settle() { busy = false; open.setEnabled(true); if (timeout != null) main.removeCallbacks(timeout); }
    private void fail(int id, String message) {
        if (!active(id)) return;
        ++attempt; settle(); status.setText(message);
    }
    @Override public void onDestroy() { ++attempt; main.removeCallbacksAndMessages(null); super.onDestroy(); }
}
