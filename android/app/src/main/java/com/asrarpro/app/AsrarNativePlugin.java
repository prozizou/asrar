package com.asrarpro.app;

import android.content.pm.PackageInfo;
import androidx.core.content.pm.PackageInfoCompat;
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
 *
 * versionCode : version native installée — le site s'en sert pour bloquer
 * les APK trop anciens (components/NativeUpdateGate.js). Absent des APK
 * antérieurs à ce champ.
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
        try {
            PackageInfo pkg = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            ret.put("versionCode", PackageInfoCompat.getLongVersionCode(pkg));
            ret.put("versionName", pkg.versionName);
        } catch (Exception ignored) {
            // Sans version, le site traite l'APK comme ancien.
        }
        call.resolve(ret);
    }
}
