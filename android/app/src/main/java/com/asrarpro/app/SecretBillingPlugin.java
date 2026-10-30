package com.asrarpro.app;

import android.os.Handler;
import android.os.Looper;
import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

/** Google Play owns payment. Only the server grants access. Secrets are never consumed. */
@CapacitorPlugin(name = "SecretBilling")
public class SecretBillingPlugin extends Plugin {
    private BillingClient billing;
    private PluginCall payment;
    private String requestedProduct;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final java.util.Set<PluginCall> operations = new java.util.HashSet<>();
    private final java.util.Map<PluginCall, Runnable> deadlines = new java.util.HashMap<>();
    @Override public void load() {
        billing = BillingClient.newBuilder(getContext())
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .setListener((result, purchases) -> handler.post(() -> {
                PluginCall call = payment;
                if (call == null) return;
                payment = null;
                if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) { call.reject("Paiement annulé.", "CANCELLED"); return; }
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) { call.reject("Paiement indisponible. Restaurez vos achats si vous avez été débité."); return; }
                for (Purchase purchase : purchases) if (purchase.getProducts().contains(requestedProduct)) { call.resolve(receipt(purchase, requestedProduct)); return; }
                call.reject("Achat à vérifier. Utilisez Restaurer mes achats.");
            })).build();
    }
    private boolean validProduct(String id) { return id != null && id.matches("[a-z][a-z0-9_.]{0,148}"); }
    private void connected(PluginCall call, Runnable task) {
        handler.post(() -> {
            if (billing == null || operations.size() >= 5) { call.reject("Service d’achat occupé. Réessayez."); return; }
            operations.add(call);
            Runnable timeout = () -> { if (operations.remove(call)) call.reject("Google Play ne répond pas. Réessayez."); deadlines.remove(call); };
            deadlines.put(call, timeout); handler.postDelayed(timeout, 20000);
            if (billing.isReady()) { task.run(); return; }
            billing.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult result) {
                    handler.post(() -> {
                        if (!operations.contains(call)) return;
                        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) task.run();
                        else { finish(call); call.reject("Connexion Google Play impossible."); }
                    });
                }
                @Override public void onBillingServiceDisconnected() { }
            });
        });
    }
    private void finish(PluginCall call) {
        operations.remove(call); Runnable timeout = deadlines.remove(call);
        if (timeout != null) handler.removeCallbacks(timeout);
    }
    private JSObject receipt(Purchase purchase, String product) {
        JSObject result = new JSObject(); result.put("productId", product);
        result.put("pending", purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED);
        result.put("purchaseToken", purchase.getPurchaseToken()); return result;
    }
    private interface ProductReady { void accept(ProductDetails details); }
    private void details(PluginCall call, String product, ProductReady ready) {
        if (!validProduct(product)) { call.reject("Produit invalide."); return; }
        connected(call, () -> billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder()
            .setProductList(List.of(QueryProductDetailsParams.Product.newBuilder().setProductId(product).setProductType(BillingClient.ProductType.INAPP).build())).build(),
            (result, products) -> handler.post(() -> {
                if (!operations.contains(call)) return;
                finish(call);
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || products.getProductDetailsList().isEmpty()) { call.reject("Ce secret n’est pas encore disponible à l’achat sur Google Play."); return; }
                ProductDetails value = products.getProductDetailsList().get(0);
                if (!value.getProductId().equals(product) || value.getOneTimePurchaseOfferDetails() == null) { call.reject("Offre Google Play indisponible."); return; }
                ready.accept(value);
            })));
    }
    @PluginMethod public void product(PluginCall call) {
        details(call, call.getString("productId"), (value) -> {
            JSObject result = new JSObject(); result.put("productId", value.getProductId());
            result.put("price", value.getOneTimePurchaseOfferDetails().getFormattedPrice()); call.resolve(result);
        });
    }
    @PluginMethod public void buy(PluginCall call) {
        String account = call.getString("accountId"), product = call.getString("productId");
        if (account == null || !account.matches("[a-f0-9]{64}")) { call.reject("Compte ASRAR invalide."); return; }
        details(call, product, (value) -> {
            if (payment != null || getActivity() == null) { call.reject("Un paiement est déjà en cours."); return; }
            payment = call; requestedProduct = product;
            BillingFlowParams.ProductDetailsParams.Builder item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(value);
            String offer = value.getOneTimePurchaseOfferDetails().getOfferToken();
            if (offer != null) item.setOfferToken(offer);
            BillingResult result = billing.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(List.of(item.build())).setObfuscatedAccountId(account).build());
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { payment = null; call.reject("Paiement indisponible. Restaurez vos achats si ce secret est déjà acheté."); }
        });
    }
    @PluginMethod public void restore(PluginCall call) {
        connected(call, () -> billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> handler.post(() -> {
                if (!operations.contains(call)) return;
                finish(call);
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("Restauration Google Play impossible."); return; }
                JSArray items = new JSArray();
                for (Purchase purchase : purchases) for (String product : purchase.getProducts()) items.put(receipt(purchase, product));
                JSObject response = new JSObject(); response.put("purchases", items); call.resolve(response);
            })));
    }
    @Override protected void handleOnDestroy() {
        handler.removeCallbacksAndMessages(null);
        for (PluginCall call : operations) call.reject("Service d’achat fermé.");
        operations.clear(); deadlines.clear();
        if (payment != null) { payment.reject("Paiement interrompu. Restaurez vos achats au retour."); payment = null; }
        if (billing != null) { billing.endConnection(); billing = null; }
    }
}
