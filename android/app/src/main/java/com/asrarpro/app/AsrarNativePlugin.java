package com.asrarpro.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

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

    /**
     * Exports Word/PDF (lib/nativeFiles.js) : la WebView ignore les
     * téléchargements blob:. Le fichier est copié dans Téléchargements/ASRAR PRO
     * (Android 10+) puis la feuille de partage Android s'ouvre (WPS Office,
     * Drive, WhatsApp…). Résout { saved } : true si la copie dans
     * Téléchargements a réussi.
     */
    @PluginMethod
    public void saveFile(PluginCall call) {
        String data = call.getString("data");
        String mime = call.getString("mimeType", "application/octet-stream");
        String name = ExportFiles.safeName(call.getString("fileName"), "document");
        Activity host = getActivity();
        if (data == null || data.isEmpty() || host == null || host.isFinishing()) {
            call.reject("Fichier indisponible", "invalid");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Fichier invalide", "invalid");
            return;
        }
        final Uri shareUri;
        try {
            File dir = new File(getContext().getCacheDir(), "exports");
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("cache");
            purgeOldExports(dir);
            File file = new File(dir, name);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
            }
            shareUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
        } catch (IOException | IllegalArgumentException e) {
            call.reject("Enregistrement impossible", "unavailable");
            return;
        }
        final boolean saved = saveToDownloads(name, mime, bytes);
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType(mime);
        send.putExtra(Intent.EXTRA_STREAM, shareUri);
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        final Intent chooser = Intent.createChooser(send, name);
        host.runOnUiThread(() -> {
            JSObject ret = new JSObject();
            ret.put("saved", saved);
            try {
                host.startActivity(chooser);
                call.resolve(ret);
            } catch (RuntimeException e) {
                if (saved) call.resolve(ret);
                else call.reject("Aucune application pour ouvrir le fichier", "unavailable");
            }
        });
    }

    /**
     * Impression Android de la page (« Enregistrer au format PDF ») : window.print()
     * ne fait rien dans une WebView. Le PDF « classique » d'Al Qalam prépare une
     * vue dédiée à l'impression (feuille @media print) que ce chemin imprime.
     */
    @PluginMethod
    public void printPage(PluginCall call) {
        String title = ExportFiles.safeName(call.getString("title"), "ASRAR PRO");
        Activity host = getActivity();
        if (host == null || host.isFinishing() || getBridge() == null || getBridge().getWebView() == null) {
            call.reject("Impression indisponible", "unavailable");
            return;
        }
        host.runOnUiThread(() -> {
            try {
                PrintManager manager = (PrintManager) host.getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = getBridge().getWebView().createPrintDocumentAdapter(title);
                manager.print(title, adapter, null);
                call.resolve();
            } catch (RuntimeException e) {
                call.reject("Impression indisponible", "unavailable");
            }
        });
    }

    // Android 10+ : écriture dans Téléchargements sans permission (MediaStore).
    private boolean saveToDownloads(String name, String mime, byte[] bytes) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false;
        try {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ASRAR PRO");
            Uri item = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (item == null) return false;
            try (OutputStream out = resolver.openOutputStream(item)) {
                if (out == null) return false;
                out.write(bytes);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    // Les copies de partage restent dans le cache ; on supprime celles de plus d'un jour.
    private static void purgeOldExports(File dir) {
        File[] files = dir.listFiles();
        if (files == null) return;
        long limit = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < limit) file.delete();
        }
    }
}
