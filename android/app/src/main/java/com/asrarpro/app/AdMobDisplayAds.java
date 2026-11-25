package com.asrarpro.app;

import android.app.Activity;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.coordinatorlayout.widget.CoordinatorLayout;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleOwner;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.appopen.AppOpenAd;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdView;
import java.util.function.BooleanSupplier;

final class AdMobDisplayAds {
    private static final long FULLSCREEN_INTERVAL_MS = 180_000;
    private static final long BACKGROUND_INTERVAL_MS = 120_000;
    private static final long CACHE_MS = 60 * 60_000;
    private static final String PUBLISHER = "ca-app-pub-3895250961868134/";
    private static final String TEST = "ca-app-pub-3940256099942544/";

    private final Activity activity;
    private final android.webkit.WebView webView;
    private final BooleanSupplier rewardedBusy;
    private final AdMobAdPlatform platform;
    private FrameLayout footer;
    private AdView banner;
    private NativeAd nativeAd;
    private InterstitialAd interstitial;
    private AppOpenAd appOpen;
    private boolean fetchingInterstitial, fetchingAppOpen, initializing, initialized, fullscreen;
    private String surface = "";
    private boolean enabled;
    private int revision;
    private long lastFullscreen = -FULLSCREEN_INTERVAL_MS, backgroundAt, interstitialAt, appOpenAt;
    private int initialBottomMargin;

    AdMobDisplayAds(Activity activity, android.webkit.WebView webView, BooleanSupplier rewardedBusy) {
        this.activity = activity;
        this.webView = webView;
        this.rewardedBusy = rewardedBusy;
        platform = new AdMobAdPlatform(() -> activity, null);
    }

    void configure(boolean allowed, String nextSurface) {
        boolean transition = enabled && surface.isEmpty() && "menu".equals(nextSurface);
        if (allowed != enabled || !nextSurface.equals(surface)) {
            revision++;
            removeFooter();
        }
        enabled = allowed;
        surface = nextSurface;
        if (!enabled) {
            interstitial = null;
            appOpen = null;
            return;
        }
        if (!initialized) {
            if (initializing) return;
            initializing = true;
            platform.initialize(false, error -> activity.runOnUiThread(() -> {
                initializing = false;
                initialized = error == null;
                if (initialized && enabled) prepare(false);
            }));
            return;
        }
        prepare(transition);
    }

    private void prepare(boolean transition) {
        if ("home".equals(surface) && footer == null) loadBanner();
        if ("menu".equals(surface) && footer == null) loadNative();
        long now = SystemClock.elapsedRealtime();
        if (transition && interstitial != null && now - interstitialAt < CACHE_MS && canShowFullscreen()) {
            InterstitialAd ready = interstitial;
            interstitial = null;
            ready.setFullScreenContentCallback(fullscreenCallback());
            ready.show(activity);
        }
        loadFullscreen(now);
    }

    private void loadFullscreen(long now) {
        if (!fetchingInterstitial && (interstitial == null || now - interstitialAt >= CACHE_MS)) {
            fetchingInterstitial = true;
            InterstitialAd.load(activity, unit("7998946847", "1033173712"), request(), new InterstitialAdLoadCallback() {
                @Override public void onAdLoaded(InterstitialAd ad) {
                    fetchingInterstitial = false;
                    if (enabled) { interstitial = ad; interstitialAt = SystemClock.elapsedRealtime(); }
                }
                @Override public void onAdFailedToLoad(com.google.android.gms.ads.LoadAdError error) { fetchingInterstitial = false; }
            });
        }
        if (!fetchingAppOpen && (appOpen == null || now - appOpenAt >= CACHE_MS)) {
            fetchingAppOpen = true;
            AppOpenAd.load(activity, unit("8571013678", "9257395921"), request(), new AppOpenAd.AppOpenAdLoadCallback() {
                @Override public void onAdLoaded(AppOpenAd ad) {
                    fetchingAppOpen = false;
                    if (enabled) { appOpen = ad; appOpenAt = SystemClock.elapsedRealtime(); }
                }
                @Override public void onAdFailedToLoad(com.google.android.gms.ads.LoadAdError error) { fetchingAppOpen = false; }
            });
        }
    }

    void paused() {
        if (banner != null) banner.pause();
        if (!fullscreen && !rewardedBusy.getAsBoolean()) backgroundAt = SystemClock.elapsedRealtime();
    }

    void resumed() {
        if (banner != null) banner.resume();
        long now = SystemClock.elapsedRealtime();
        long away = backgroundAt == 0 ? 0 : now - backgroundAt;
        backgroundAt = 0;
        if (enabled && initialized && !surface.isEmpty() && away >= BACKGROUND_INTERVAL_MS
            && appOpen != null && now - appOpenAt < CACHE_MS && canShowFullscreen()) {
            AppOpenAd ready = appOpen;
            appOpen = null;
            ready.setFullScreenContentCallback(fullscreenCallback());
            ready.show(activity);
        }
        if (enabled && initialized) loadFullscreen(now);
    }

    boolean isFullscreen() { return fullscreen; }

    private boolean canShowFullscreen() {
        return enabled && !fullscreen && !rewardedBusy.getAsBoolean()
            && !activity.isFinishing() && !activity.isDestroyed() && activity.hasWindowFocus()
            && ((LifecycleOwner) activity).getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)
            && SystemClock.elapsedRealtime() - lastFullscreen >= FULLSCREEN_INTERVAL_MS;
    }

    private FullScreenContentCallback fullscreenCallback() {
        fullscreen = true;
        lastFullscreen = SystemClock.elapsedRealtime();
        return new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { fullscreen = false; }
            @Override public void onAdFailedToShowFullScreenContent(AdError error) { fullscreen = false; }
        };
    }

    private void loadBanner() {
        if (banner != null) return;
        final AdView view = new AdView(activity);
        banner = view;
        view.setAdUnitId(unit("4160161224", "6300978111"));
        view.setAdSize(AdSize.BANNER);
        view.setAdListener(new AdListener() {
            @Override public void onAdLoaded() {
                if (banner == view) attachFooter(view, dp(50));
            }
            @Override public void onAdFailedToLoad(com.google.android.gms.ads.LoadAdError error) {
                if (banner == view) { banner = null; view.destroy(); }
            }
        });
        view.loadAd(request());
    }

    private int loadingNative = -1;
    private void loadNative() {
        int generation = revision;
        if (loadingNative == generation) return;
        loadingNative = generation;
        new AdLoader.Builder(activity, unit("4272463984", "2247696110"))
            .forNativeAd(ad -> {
                if (!enabled || revision != generation) { ad.destroy(); return; }
                nativeAd = ad;
                displayNative(ad);
            })
            .withAdListener(new AdListener() {
                @Override public void onAdFailedToLoad(com.google.android.gms.ads.LoadAdError error) {
                    if (loadingNative == generation) loadingNative = -1;
                }
            }).build().loadAd(request());
    }

    private void displayNative(NativeAd ad) {
        NativeAdView view = new NativeAdView(activity);
        LinearLayout column = new LinearLayout(activity);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setPadding(dp(12), dp(4), dp(12), dp(4));
        TextView attribution = new TextView(activity);
        attribution.setText("Publicité");
        attribution.setTextColor(0xFF25211D);
        column.addView(attribution);
        TextView headline = new TextView(activity);
        headline.setText(ad.getHeadline());
        headline.setTextColor(0xFF25211D);
        headline.setSingleLine();
        column.addView(headline);
        view.setHeadlineView(headline);
        MediaView media = new MediaView(activity);
        column.addView(media, new LinearLayout.LayoutParams(-1, dp(120)));
        view.setMediaView(media);
        if (ad.getCallToAction() != null) {
            Button action = new Button(activity);
            action.setText(ad.getCallToAction());
            column.addView(action, new LinearLayout.LayoutParams(-2, dp(42)));
            view.setCallToActionView(action);
        }
        view.addView(column);
        view.setNativeAd(ad);
        attachFooter(view, dp(214));
    }

    private void attachFooter(android.view.View creative, int height) {
        if (!(webView.getParent() instanceof CoordinatorLayout)) return;
        CoordinatorLayout parent = (CoordinatorLayout) webView.getParent();
        FrameLayout frame = new FrameLayout(activity);
        footer = frame;
        frame.setBackgroundColor(0xFFF7F3EB);
        frame.addView(creative, new FrameLayout.LayoutParams(-1, height, Gravity.TOP | Gravity.CENTER_HORIZONTAL));
        CoordinatorLayout.LayoutParams params = new CoordinatorLayout.LayoutParams(-1, height);
        params.gravity = Gravity.BOTTOM;
        parent.addView(frame, params);
        initialBottomMargin = ((CoordinatorLayout.LayoutParams) webView.getLayoutParams()).bottomMargin;
        ViewCompat.setOnApplyWindowInsetsListener(frame, (view, insets) -> {
            resizeFooter(height, insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom);
            return insets;
        });
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(parent);
        resizeFooter(height, insets == null ? 0 : insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom);
        ViewCompat.requestApplyInsets(frame);
    }

    private void resizeFooter(int height, int inset) {
        if (footer == null) return;
        ViewGroup.LayoutParams footerParams = footer.getLayoutParams();
        footerParams.height = height + inset;
        footer.setLayoutParams(footerParams);
        CoordinatorLayout.LayoutParams params = (CoordinatorLayout.LayoutParams) webView.getLayoutParams();
        params.bottomMargin = initialBottomMargin + height + inset;
        webView.setLayoutParams(params);
    }

    private void removeFooter() {
        if (footer != null) {
            ((ViewGroup) footer.getParent()).removeView(footer);
            CoordinatorLayout.LayoutParams params = (CoordinatorLayout.LayoutParams) webView.getLayoutParams();
            params.bottomMargin = initialBottomMargin;
            webView.setLayoutParams(params);
            footer = null;
        }
        if (banner != null) { banner.destroy(); banner = null; }
        if (nativeAd != null) { nativeAd.destroy(); nativeAd = null; }
    }

    void destroy() { configure(false, ""); platform.destroy(); }
    private int dp(int value) { return Math.round(activity.getResources().getDisplayMetrics().density * value); }
    private static String unit(String production, String debug) { return BuildConfig.DEBUG ? TEST + debug : PUBLISHER + production; }
    private static AdRequest request() { return new AdRequest.Builder().build(); }
}
