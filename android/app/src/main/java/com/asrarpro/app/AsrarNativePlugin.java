package com.asrarpro.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;

/**
 * Infos natives lues par le site (lib/fcmNative.js) avant d'appeler des API
 * qui PLANTENT l'app au lieu de rejeter : PushNotifications.register()
 * appelle FirebaseMessaging.getInstance() sans garde, et Capacitor relance
 * l'exception (Bridge.callPluginMethod) — fermeture immédiate de l'app quand
 * google-services.json n'a pas été intégré au build.
 */
@CapacitorPlugin(name = "AsrarNative")
public class AsrarNativePlugin extends Plugin {

    @PluginMethod
    public void getInfo(PluginCall call) {
        boolean firebaseReady;
        try {
            firebaseReady = !FirebaseApp.getApps(getContext()).isEmpty();
        } catch (Exception e) {
            firebaseReady = false;
        }
        JSObject ret = new JSObject();
        ret.put("firebaseReady", firebaseReady);
        call.resolve(ret);
    }
}
