package com.asrarpro.app;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.annotation.RequiresApi;
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
 *
 * saveFile : enregistre un fichier produit par le site (PDF de l'Ornement…).
 * La WebView ignore en silence les téléchargements par lien (blob:) — le
 * site passe donc le contenu ici (lib/saveFile.js).
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
     * Enregistre { data (base64), filename, mimeType } puis l'ouvre.
     * Android 10+ : dans Téléchargements (MediaStore, sans permission), puis
     * ouverture dans la visionneuse. Avant Android 10 (écrire dans
     * Téléchargements y demanderait une permission) : copie dans le cache de
     * l'app, puis feuille de partage pour l'enregistrer ou l'envoyer.
     * Résout { location: "downloads" | "share", opened }.
     */
    @PluginMethod
    public void saveFile(PluginCall call) {
        String data = call.getString("data");
        String filename = call.getString("filename", "document");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        if (data == null || data.isEmpty()) {
            call.reject("Aucun contenu à enregistrer.");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Uri uri;
            String location;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                uri = saveToDownloads(bytes, filename, mimeType);
                location = "downloads";
            } else {
                File dir = new File(getContext().getCacheDir(), "exports");
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("Dossier d'export indisponible");
                File file = new File(dir, filename);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                location = "share";
            }
            JSObject ret = new JSObject();
            ret.put("location", location);
            ret.put("opened", open(uri, mimeType, "share".equals(location)));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Enregistrement impossible : " + e.getMessage(), e);
        }
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private Uri saveToDownloads(byte[] bytes, String filename, String mimeType) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IOException("Téléchargements indisponibles");
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) throw new IOException("Écriture impossible");
            out.write(bytes);
        } catch (IOException e) {
            resolver.delete(uri, null, null);
            throw e;
        }
        values.clear();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, values, null, null);
        return uri;
    }

    /** Ouvre le fichier (ou la feuille de partage) ; faux si aucune app ne le prend. */
    private boolean open(Uri uri, String mimeType, boolean share) {
        Intent intent;
        if (share) {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mimeType);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent = Intent.createChooser(send, null);
        } else {
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            return false; // enregistré quand même (Téléchargements)
        }
    }
}
