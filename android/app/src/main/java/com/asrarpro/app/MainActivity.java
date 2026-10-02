package com.asrarpro.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local (voir AsrarNativePlugin) — à enregistrer AVANT
        // super.onCreate(), qui crée le bridge.
        registerPlugin(AsrarNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
