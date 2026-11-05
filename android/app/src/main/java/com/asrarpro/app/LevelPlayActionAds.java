package com.asrarpro.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.os.Handler;
import android.os.Looper;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleOwner;
import java.util.function.Supplier;

/** Keeps one ad ready, but never displays or rewards it without an explicit choice. */
final class LevelPlayActionAds {
    interface Result { void done(boolean shown, boolean completed, String reason); }
    interface Prepared { void done(String error); }
    interface Ad {
        void load();
        boolean ready();
        void show(Activity activity);
        void clear();
    }
    interface Events {
        void loaded();
        void loadFailed(String reason);
        void displayed();
        void rewarded();
        void closed();
        void displayFailed();
    }
    interface Platform {
        void initialize(boolean interactive, Prepared callback);
        void allowConsentPrompt(boolean allowed);
        Ad create(Events events);
        void destroy();
    }
    private static final String LOADING_MESSAGE = "Chargement de la publicité… Le bouton Regarder sera disponible dès qu’elle sera prête.";
    private static final String READY_MESSAGE = "Regardez une publicité jusqu’au bout pour débloquer cette action.";
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Supplier<Activity> activity;
    private final Platform platform;
    private Slot cached;
    private Request pending;
    private boolean destroyed;

    private static final class Slot {
        Ad ad;
        boolean loading = true;
        Runnable deadline;
    }
    private static final class Request {
        final Result callback;
        final RewardedActionState state = new RewardedActionState();
        Slot slot;
        AlertDialog dialog;
        Runnable deadline;
        Request(Result callback) { this.callback = callback; }
    }

    LevelPlayActionAds(Supplier<Activity> activity) { this(activity, new LevelPlayAdPlatform(activity)); }
    LevelPlayActionAds(Supplier<Activity> activity, Platform platform) { this.activity = activity; this.platform = platform; }

    void preload() { main.post(() -> prepare(false)); }

    void show(Result callback) {
        main.post(() -> {
            if (destroyed || !foreground()) { callback.done(false, false, "background"); return; }
            if (pending != null) { callback.done(false, false, "busy"); return; }
            Request request = new Request(callback);
            pending = request;
            deadline(request, 120_000, "timeout");
            request.dialog = new AlertDialog.Builder(activity.get())
                .setTitle("Continuer avec une publicité")
                .setMessage(LOADING_MESSAGE)
                .setPositiveButton("Regarder", null)
                .setNegativeButton("Annuler", (dialog, which) -> finish(request, "skipped"))
                .setOnCancelListener(dialog -> finish(request, "skipped"))
                .create();
            request.dialog.setOnShowListener(dialog -> {
                request.dialog.getButton(DialogInterface.BUTTON_POSITIVE).setOnClickListener(view -> showPrepared(request));
                updateDialog();
            });
            request.dialog.show();
            platform.allowConsentPrompt(true);
            prepare(true);
        });
    }

    private boolean foreground() {
        Activity host = activity.get();
        return host != null && !host.isFinishing() && !host.isDestroyed()
            && (!(host instanceof LifecycleOwner) || ((LifecycleOwner) host).getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED));
    }
    private boolean active(Request request) { return !destroyed && pending == request; }
    private boolean owns(Slot slot) { return !destroyed && (cached == slot || (pending != null && pending.slot == slot)); }
    private boolean ready() { return cached != null && cached.ad != null && cached.ad.ready(); }

    private void prepare(boolean interactive) {
        if (destroyed) return;
        boolean adVisible = pending != null && pending.state.wasDisplayed() && !pending.state.isClosed();
        if (!foreground() && !adVisible) return;
        if (interactive) platform.allowConsentPrompt(true);
        if (cached != null && (cached.loading || ready())) { updateDialog(); return; }
        discardCache();
        Slot slot = new Slot();
        cached = slot;
        loadDeadline(slot, 120_000);
        platform.initialize(interactive, error -> main.post(() -> {
            if (!owns(slot) || cached != slot) return;
            if (error != null) { loadFailed(slot, error); return; }
            try {
                slot.ad = platform.create(new Events() {
                    public void loaded() { main.post(() -> { if (cached == slot && owns(slot)) { slot.loading = false; main.removeCallbacks(slot.deadline); updateDialog(); } }); }
                    public void loadFailed(String reason) { main.post(() -> LevelPlayActionAds.this.loadFailed(slot, reason)); }
                    public void displayed() { main.post(() -> {
                        if (pending != null && pending.slot == slot && owns(slot)) {
                            pending.state.displayed();
                            // Download the following ad while the current video is being watched.
                            prepare(false);
                        }
                    }); }
                    public void rewarded() { main.post(() -> {
                        if (pending != null && pending.slot == slot && owns(slot)) {
                            Request request = pending;
                            request.state.rewarded();
                            if (request.state.isClosed()) finish(request, null);
                        }
                    }); }
                    public void closed() { main.post(() -> {
                        if (pending != null && pending.slot == slot && owns(slot)) {
                            Request request = pending;
                            request.state.closed();
                            if (request.state.isComplete()) finish(request, null);
                            else deadline(request, 5_000, "skipped");
                        }
                    }); }
                    public void displayFailed() { main.post(() -> {
                        if (pending != null && pending.slot == slot && owns(slot)) finish(pending, "show");
                    }); }
                });
                loadDeadline(slot, 60_000);
                slot.ad.load();
            } catch (RuntimeException exception) { loadFailed(slot, "load"); }
        }));
        updateDialog();
    }

    private void updateDialog() {
        if (pending == null || pending.slot != null || pending.dialog == null) return;
        boolean available = ready();
        pending.dialog.setMessage(available ? READY_MESSAGE : LOADING_MESSAGE);
        android.widget.Button button = pending.dialog.getButton(DialogInterface.BUTTON_POSITIVE);
        if (button != null) { button.setText(available ? "Regarder" : "Chargement…"); button.setEnabled(available); }
    }

    private void showPrepared(Request request) {
        if (!active(request) || request.slot != null) return;
        if (!foreground()) { finish(request, "background"); return; }
        if (!ready()) { prepare(true); updateDialog(); return; }
        request.slot = cached;
        cached = null;
        request.dialog.dismiss();
        request.dialog = null;
        deadline(request, 600_000, "timeout");
        try { request.slot.ad.show(activity.get()); }
        catch (RuntimeException exception) { finish(request, "show"); }
    }

    private void loadFailed(Slot slot, String reason) {
        if (cached != slot || !owns(slot)) return;
        discardCache();
        if (pending != null && pending.slot == null) finish(pending, reason);
    }
    private void loadDeadline(Slot slot, long delay) {
        if (slot.deadline != null) main.removeCallbacks(slot.deadline);
        slot.deadline = () -> loadFailed(slot, "timeout");
        main.postDelayed(slot.deadline, delay);
    }
    private void discardCache() {
        if (cached != null && cached.deadline != null) main.removeCallbacks(cached.deadline);
        if (cached != null && cached.ad != null) cached.ad.clear();
        cached = null;
    }
    private void deadline(Request request, long delay, String reason) {
        if (request.deadline != null) main.removeCallbacks(request.deadline);
        request.deadline = () -> finish(request, reason);
        main.postDelayed(request.deadline, delay);
    }
    private void finish(Request request, String reason) {
        if (!active(request)) return;
        pending = null;
        platform.allowConsentPrompt(false);
        if (request.deadline != null) main.removeCallbacks(request.deadline);
        if (request.slot != null && request.slot.ad != null) request.slot.ad.clear();
        if (request.dialog != null) request.dialog.dismiss();
        request.callback.done(request.state.wasDisplayed(), reason == null && request.state.isComplete(), reason);
    }
    void destroy() {
        if (pending != null) finish(pending, "background");
        destroyed = true;
        discardCache();
        platform.destroy();
        main.removeCallbacksAndMessages(null);
    }
}
