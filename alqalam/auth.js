// alqalam/auth.js
// Guard d'accès Al-Qalam — Intégration ASRAR PRO + PayDunya
// CORRECTION : auth/db initialisés en lazy pour éviter l'erreur "No Firebase App [DEFAULT]"

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";

const API_BASE = window.location.hostname.includes('localhost') 
    ? 'http://localhost:3000/api' 
    : '/api';

const PRODUCT_ID = 'alqalam_premium';

// Config identique pour le cas (improbable) où aucune app n'existerait encore
const firebaseConfig = {
    apiKey: "AIzaSyBLzPKzbiNYitUz7sv9Ftqm0oF20rA32Zk",
    authDomain: "asrar-bc059.firebaseapp.com",
    databaseURL: "https://asrar-bc059.firebaseio.com",
    projectId: "asrar-bc059",
    storageBucket: "asrar-bc059.appspot.com",
    messagingSenderId: "199810893447",
    appId: "1:199810893447:android:044629472e10f9eb68da22"
};

let currentUser = null;
let cachedAccess = null;

const emailKey = (email) => (email || "").replace(/\./g, ",");

// ─── Lazy getters : ne touchent Firebase qu'à l'appel ───
function getFirebaseApp() {
    const apps = getApps();
    if (apps.length > 0) return apps[0]; // réutilise l'app globale (DEFAULT ou nommée)
    return initializeApp(firebaseConfig, "alqalam-auth-app");
}

function getAuthInstance() {
    return getAuth(getFirebaseApp());
}

function getDbInstance() {
    return getDatabase(getFirebaseApp());
}

/**
 * Initialise la surveillance de l'état de connexion Google.
 */
export function initAuthGuard() {
    return new Promise((resolve) => {
        const auth = getAuthInstance();
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            resolve(user);
        });
    });
}

/**
 * Vérifie si l'utilisateur a un abonnement Al-Qalam actif.
 */
export async function verifierAccesAlQalam() {
    if (cachedAccess?.actif && cachedAccess?.expireAt > Date.now()) {
        return true;
    }

    if (!currentUser) return false;

    const email = currentUser.email;
    const uid = currentUser.uid;
    const now = Date.now();
    const db = getDbInstance();

    try {
        // 1. Gate principal : purchased_user/{emailKey}
        const key = emailKey(email);
        const purSnap = await get(child(ref(db), `purchased_user/${key}`));
        if (purSnap.exists()) {
            const data = purSnap.val();
            if (data.token) {
                const exp = data.expiresAt;
                const active = exp === "lifetime" || exp == null ||
                               (typeof exp === "number" && exp > now);
                if (active) {
                    cachedAccess = { 
                        actif: true, 
                        expireAt: exp === "lifetime" ? Infinity : exp,
                        source: 'purchased_user'
                    };
                    return true;
                }
            }
        }

        // 2. Fallback : purchases/{uid}/{productId}
        const buySnap = await get(child(ref(db), `purchases/${uid}/${PRODUCT_ID}`));
        if (buySnap.exists()) {
            const data = buySnap.val();
            if (data.paid && data.expireAt) {
                const exp = data.expireAt;
                const active = exp === "lifetime" || exp == null ||
                               (typeof exp === "number" && exp > now);
                if (active) {
                    cachedAccess = { 
                        actif: true, 
                        expireAt: exp === "lifetime" ? Infinity : exp,
                        source: 'purchases'
                    };
                    return true;
                }
            }
        }

        // 3. Admins / VIP
        const [adminSnap, vipSnap] = await Promise.all([
            get(child(ref(db), `admins/${key}`)),
            get(child(ref(db), `vip_users/${uid}`))
        ]);
        
        if (adminSnap.val() === true) {
            cachedAccess = { actif: true, expireAt: Infinity, source: 'admin' };
            return true;
        }
        if (vipSnap.exists()) {
            cachedAccess = { actif: true, expireAt: Infinity, source: 'vip' };
            return true;
        }

    } catch (e) {
        console.warn("Erreur lecture RTDB:", e);
    }

    return false;
}

/**
 * Vérification rapide depuis le cache (synchrone).
 */
export function estAbonne() {
    if (cachedAccess?.actif && cachedAccess?.expireAt > Date.now()) return true;
    return false;
}

/**
 * Wrapper : exécute l'action si abonné, sinon affiche le paywall.
 */
export async function requireAlQalamAccess(actionFn, featureName = "cette fonctionnalité") {
    const hasAccess = await verifierAccesAlQalam();
    if (hasAccess) {
        if (actionFn) actionFn();
        return true;
    }
    afficherPaywall(featureName);
    return false;
}

/**
 * Affiche le modal de blocage / redirection PayDunya.
 */
function afficherPaywall(featureName) {
    const overlay = document.getElementById('paywall-overlay');
    const featureLabel = document.getElementById('paywall-feature-name');
    const btnSubscribe = document.getElementById('btn-paywall-subscribe');
    const btnCancel = document.getElementById('btn-paywall-cancel');
    const btnLogin = document.getElementById('btn-paywall-login');

    if (!overlay) {
        console.error("Modal paywall introuvable dans le DOM");
        return;
    }

    featureLabel.textContent = featureName;
    overlay.style.display = 'flex';

    if (!currentUser && btnLogin) {
        btnLogin.style.display = 'block';
        btnLogin.onclick = () => {
            window.location.href = '/index.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        };
    } else if (btnLogin) {
        btnLogin.style.display = 'none';
    }

    btnSubscribe.onclick = async () => {
        if (!currentUser) {
            showToastAuth("Veuillez d'abord vous connecter avec Google", "error");
            return;
        }

        try {
            const idToken = await currentUser.getIdToken(true);
            const res = await fetch(`${API_BASE}/create-invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: idToken,
                    productId: PRODUCT_ID
                })
            });
            
            const data = await res.json();
            if (data.url) {
                localStorage.setItem('asrar_pending_feature', featureName);
                window.location.href = data.url;
            } else {
                showToastAuth(data.error || "Erreur lors de la création du paiement", "error");
            }
        } catch (err) {
            console.error(err);
            showToastAuth("Service de paiement indisponible", "error");
        }
    };

    btnCancel.onclick = () => {
        overlay.style.display = 'none';
    };
}

/**
 * À appeler au chargement : vérifie si on revient d'un paiement PayDunya (?token=...).
 */
export async function verifierRetourPaiement() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return false;

    try {
        const res = await fetch(`${API_BASE}/confirm-invoice?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        
        if (data.status === "completed" || data.persisted) {
            cachedAccess = null;
            await verifierAccesAlQalam();
            window.history.replaceState({}, document.title, window.location.pathname);
            showToastAuth("✅ Abonnement activé !", "info");
            localStorage.removeItem('asrar_pending_feature');
            return true;
        }
    } catch (err) {
        console.error("Erreur confirmation paiement:", err);
    }
    return false;
}

/**
 * Toast interne (fallback autonome).
 */
function showToastAuth(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:8px;z-index:99999;font-weight:bold;box-shadow:0 4px 15px rgba(0,0,0,0.4);transition:opacity 0.3s;';
    toast.style.background = type === 'error' ? 'rgba(255,107,107,0.95)' : 'rgba(77,150,255,0.95)';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}