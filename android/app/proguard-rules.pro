# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── ASRAR PRO (R8 activé en release, voir build.gradle) ─────────────────────
# Pont WebView ↔ natif de Capacitor : méthodes appelées depuis le JavaScript.
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Le bridge Capacitor lit les annotations des plugins par réflexion
# (@CapacitorPlugin, @PluginMethod) — les règles fournies par capacitor-android
# gardent les classes ; on garde aussi les annotations elles-mêmes.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Rapports de plantage lisibles (numéros de ligne) dans la Play Console.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
