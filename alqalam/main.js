// main.js
// Al-Qalam — Intégration ASRAR PRO : réutilise l'auth et le paywall globaux
// Variables attendues de l'écosystème : window.currentUser, window.requireSubscription

import { elements, state, souratesData, versetsData, initStore, savePreference } from './store.js';
import { chargerSourates, chargerVersets } from './firebase_db.js';
import { updateUI, debouncedUpdateUI, debounce, handleCopy, injecterPolice, showToast } from './ui_tools.js';
import { generateVectorPDF } from './pdf.js';
import { generateDocx } from './docx.js';
import { formaterTexteIntercale } from './formatter.js';
import { config } from './config.js';

initStore();
chargerSourates();
chargerVersets();

// Masque le loader plein écran dès que l'utilisateur (Firebase) est résolu :
// à ce stade l'interface est interactive (le paywall gère le reste au clic).
whenUser().finally(() => { if (window.asrarHideLoader) window.asrarHideLoader(); });

// ─── INTÉGRATION PAIEMENT / ABONNEMENT — ASRAR PRO ─────────────
// firebase-config.js (script CLASSIQUE chargé AVANT ce module, via <head>)
// fournit en global, dans la MÊME app Firebase que tout le hub :
//   • firebase                 — SDK compat (auth + database)
//   • checkAccess(user)        — Promise<{allowed, admin, vip, purchase}>
//   • showSubscriptionGate()   — portail global (offres + demande WhatsApp)
//   • startSubscription(planId)— ouvre WhatsApp pour demander l'accès
//   • invalidateAccessCache(), getRoot()
// On NE crée donc PLUS d'app Firebase séparée et on NE vend PLUS un produit
// inexistant : l'accès Al-Qalam = abonnement ASRAR PRO actif.

// Offre par défaut si un paiement doit être lancé sans passer par le portail global.
const PLAN_PAR_DEFAUT = 'sub_1y';

function fbAuth() {
    return (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
}

// Résout l'utilisateur connecté (attend l'init Firebase une seule fois).
let _userResolved = false;
function whenUser() {
    return new Promise((resolve) => {
        const a = fbAuth();
        if (!a) return resolve(null);
        if (_userResolved) return resolve(a.currentUser);
        const off = a.onAuthStateChanged((u) => { _userResolved = true; off(); resolve(u); });
    });
}

// Cache court : évite de relire la base à chaque clic.
const ACCESS_CACHE_MS = 60000;
let _accessOk = false, _accessAt = 0;
function resetAccessCache() {
    _accessOk = false; _accessAt = 0;
    if (typeof invalidateAccessCache === 'function') { try { invalidateAccessCache(); } catch (e) {} }
}

/**
 * Abonnement ASRAR PRO actif (= accès Al-Qalam) ?
 * Voie principale : checkAccess() global (même logique que le hub).
 * Repli : lecture directe de purchased_user (nœud lisible par son propriétaire).
 */
async function verifierAbonnementAlQalam() {
    const user = await whenUser();
    if (!user) return false;

    if (typeof checkAccess === 'function') {
        try { const s = await checkAccess(user); return !!(s && s.allowed); } catch (e) {}
    }

    try {
        const key = (user.email || '').replace(/\./g, ',');
        const snap = await firebase.database().ref('purchased_user/' + key).once('value');
        const pur = snap.val();
        if (pur && pur.token) {
            const exp = pur.expiresAt, now = Date.now();
            return exp === 'lifetime' || exp == null || (typeof exp === 'number' && exp > now);
        }
    } catch (e) {
        console.warn('Vérification abonnement (repli) impossible :', e && e.message);
    }
    return false;
}

/**
 * Exécute actionFn si l'utilisateur est abonné ; sinon ouvre le portail de paiement.
 * Signature inchangée → tous les appels existants restent valides.
 */
async function requireAlQalamAccess(actionFn, featureName = 'cette fonctionnalité') {
    const now = Date.now();
    if (_accessOk && (now - _accessAt) < ACCESS_CACHE_MS) {
        if (actionFn) actionFn();
        return true;
    }

    const user = await whenUser();
    if (!user) {
        const root = (typeof getRoot === 'function') ? getRoot() : '../';
        window.location.href = root + 'index.html?redirect=' +
            encodeURIComponent(location.pathname + location.search);
        return false;
    }

    if (await verifierAbonnementAlQalam()) {
        _accessOk = true; _accessAt = now;
        if (actionFn) actionFn();
        return true;
    }

    // Non abonné → portail GLOBAL (offres réelles + WhatsApp). Repli local sinon.
    if (typeof showSubscriptionGate === 'function') { showSubscriptionGate(); return false; }
    afficherPaywallLocal(featureName);
    return false;
}

/**
 * Paywall local — repli UNIQUEMENT si firebase-config.js n'expose pas le portail global.
 */
function afficherPaywallLocal(featureName) {
    const overlay = document.getElementById('paywall-overlay');
    if (!overlay) { showToast("Abonnement requis pour " + featureName, "error"); return; }

    const featureLabel = document.getElementById('paywall-feature-name');
    const btnSubscribe = document.getElementById('btn-paywall-subscribe');
    const btnCancel    = document.getElementById('btn-paywall-cancel');
    const btnLogin     = document.getElementById('btn-paywall-login');

    if (featureLabel) featureLabel.textContent = featureName;
    overlay.style.display = 'flex';

    whenUser().then((user) => {
        if (!btnLogin) return;
        btnLogin.style.display = user ? 'none' : 'block';
        btnLogin.onclick = () => {
            const root = (typeof getRoot === 'function') ? getRoot() : '../';
            window.location.href = root + 'index.html?redirect=' +
                encodeURIComponent(location.pathname + location.search);
        };
    });

    if (btnCancel) btnCancel.onclick = () => { overlay.style.display = 'none'; };

    if (btnSubscribe) btnSubscribe.onclick = async () => {
        if (typeof startSubscription === 'function') { startSubscription(PLAN_PAR_DEFAUT); return; }
        const user = await whenUser();
        if (!user) { showToast("Connectez-vous d'abord avec Google.", "error"); return; }
        if (window.ASRAR_WA) {
            window.ASRAR_WA.openAccess({ planId: PLAN_PAR_DEFAUT, email: user.email, section: 'Al-Qalam' });
        } else {
            showToast("Contactez l'administration pour activer votre accès.", "error");
        }
    };
}

// ─── SUGGESTIONS ───
const handleSuggestions = debounce((e) => {
    const query = e.target.value.trim();
    elements.suggestionsBox.innerHTML = '';

    if (query.length < 2) {
        elements.suggestionsBox.classList.remove('show-panel');
        return;
    }

    const versets = versetsData.get();
    const matches = versets.filter(v => v.includes(query));

    if (matches.length > 0) {
        matches.slice(0, 10).forEach(match => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${safeQuery})`, 'g');
            const rawHTML = match.replace(regex, '<span style="color: var(--accent-blue);">$1</span>');
            div.innerHTML = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawHTML) : rawHTML;
            div.addEventListener('click', () => {
                elements.inputText.value = match;
                state.baseText = match;
                elements.suggestionsBox.classList.remove('show-panel');
            });
            elements.suggestionsBox.appendChild(div);
        });
        elements.suggestionsBox.classList.add('show-panel');
    } else {
        elements.suggestionsBox.classList.remove('show-panel');
    }
}, config.DEBOUNCE_DELAY);

elements.inputText.addEventListener('input', handleSuggestions);

document.addEventListener('click', (e) => {
    if (!elements.inputText.contains(e.target) && !elements.suggestionsBox.contains(e.target)) {
        elements.suggestionsBox.classList.remove('show-panel');
    }
});

// ─── PREFERENCES ───
elements.fontSizeSlider.addEventListener('input', (e) => {
    elements.outputArea.style.fontSize = e.target.value + "px";
    savePreference('fontSize', e.target.value);
});

elements.repCount.addEventListener('input', (e) => {
    savePreference('repCount', e.target.value);
});

elements.docName.addEventListener('input', (e) => {
    savePreference('docName', e.target.value);
});

// ─── PANNEAUX PROTÉGÉS ───
function togglePanelGuarded(checkbox, panel, featureName) {
    checkbox.addEventListener('change', async (e) => {
        if (e.target.checked) {
            const granted = await requireAlQalamAccess(() => {
                panel.classList.add('show-panel');
            }, featureName);
            if (!granted) e.target.checked = false;
        } else {
            panel.classList.remove('show-panel');
        }
    });
}

togglePanelGuarded(elements.chkDoc, elements.panelDoc, "les documents");
togglePanelGuarded(elements.chkRep, elements.panelRep, "la répétition avancée");
togglePanelGuarded(elements.chkSearch, elements.panelSearch, "la recherche");
togglePanelGuarded(elements.chkIntercaler, elements.panelIntercaler, "l'intercalation");
togglePanelGuarded(elements.chkFont, elements.panelFont, "les polices personnalisées");

// Mode Rasm — protégé
if (elements.chkRasm) {
    elements.chkRasm.addEventListener('change', async (e) => {
        if (e.target.checked) {
            const granted = await requireAlQalamAccess(() => {
                state.isRasmMode = true;
                savePreference('isRasmMode', true);
                updateUI();
            }, "le mode Rasm");
            if (!granted) e.target.checked = false;
        } else {
            state.isRasmMode = false;
            savePreference('isRasmMode', false);
            updateUI();
        }
    });
}

elements.searchInput.addEventListener('input', debouncedUpdateUI);

// ─── BOUTONS PROTÉGÉS ───

elements.btnWrite.addEventListener('click', () => {
    requireAlQalamAccess(() => {
        const text = elements.inputText.value.trim();
        const count = parseInt(elements.repCount.value);
        if (!text || isNaN(count) || count <= 0) return;
        state.baseText = text;
        state.totalMultiplier = Math.min(count, config.MAX_TOTAL_REPEAT);
        state.intercalatedPhrase = "";
        updateUI();
    }, "l'écriture du texte");
});

elements.btnToolRep.addEventListener('click', () => {
    requireAlQalamAccess(() => {
        const multiplier = parseInt(elements.toolRepCount.value);
        if (isNaN(multiplier) || multiplier <= 0 || state.totalMultiplier === 0) return;
        state.totalMultiplier *= multiplier;
        if (state.totalMultiplier > config.MAX_TOTAL_REPEAT) {
            showToast(`Répétitions bloquées à ${config.MAX_TOTAL_REPEAT}`, "error");
            state.totalMultiplier = config.MAX_TOTAL_REPEAT;
        } else {
            showToast(`Multiplié ! Total actuel : ${state.totalMultiplier.toLocaleString()}`, "info");
        }
        updateUI();
    }, "la répétition avancée");
});

// ─── GRATUIT ───
elements.btnEspace.addEventListener('click', () => {
    if (state.baseText) { state.baseText = " " + state.baseText; updateUI(); }
});

elements.btnCopyInput.addEventListener('click', () => handleCopy(elements.btnCopyInput, elements.inputText.value));
elements.btnCopyOutput.addEventListener('click', () => {
    const rawOutput = (state.baseText + " ").repeat(state.totalMultiplier).trim();
    handleCopy(elements.btnCopyOutput, rawOutput);
});

// ─── POLICE (panel déjà protégé, bouton accessible si ouvert) ───
elements.btnApplyFont.addEventListener('click', () => {
    const file = elements.fontFile.files[0];
    const url = elements.fontUrl.value.trim();
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            injecterPolice(e.target.result, 'PoliceLocaleCustom');
            showToast("Police locale appliquée !", "info");
        };
        reader.readAsDataURL(file);
    } else if (url) {
        injecterPolice(url, 'PoliceUrlCustom');
        showToast("Police URL appliquée !", "info");
    } else {
        showToast("Veuillez choisir un fichier ou entrer un lien.", "error");
    }
});

// ─── INTERCALER — PROTÉGÉ ───
elements.btnIntercaler.addEventListener('click', () => {
    requireAlQalamAccess(() => {
        const key = elements.interSourateSelect.value;
        const phrase = elements.interPhrase.value.trim();
        if (!key || !phrase) {
            showToast("Sélectionnez une sourate et une phrase.", "error");
            return;
        }
        let result = souratesData.get(key);
        if (result.includes("﴾")) result = result.split("﴾").join(phrase + " ");
        if (result.includes("(")) result = result.split("(").join(phrase + " ");
        result = result.replace(/[0-9]/g, "").split("ك").join("ک").replace(/\s+/g, ' ').trim();
        state.baseText = result;
        state.intercalatedPhrase = phrase;
        elements.chkIntercaler.checked = false;
        elements.panelIntercaler.classList.remove('show-panel');
        elements.dialogIntercaler.style.display = 'flex';
    }, "l'intercalation");
});

elements.btnDialogRepeat.addEventListener('click', () => {
    const inputValue = parseInt(elements.repCount.value) || 1;
    state.totalMultiplier = Math.min(inputValue, config.MAX_TOTAL_REPEAT);
    elements.dialogIntercaler.style.display = 'none';
    elements.inputText.value = state.baseText;
    updateUI();
});

elements.btnDialogOnce.addEventListener('click', () => {
    state.totalMultiplier = 1;
    elements.repCount.value = 1;
    elements.dialogIntercaler.style.display = 'none';
    elements.inputText.value = "";
    updateUI();
});

// ─── CUMULER — PROTÉGÉ ───
elements.btnAddTemp.addEventListener('click', () => {
    requireAlQalamAccess(() => {
        if (!state.baseText || state.totalMultiplier === 0) {
            showToast("Générez d'abord un texte avant de l'ajouter.", "error");
            return;
        }
        state.accumulatedBlocks.push({
            texte: formaterTexteIntercale(state.baseText, state.intercalatedPhrase),
            totalMultiplier: state.totalMultiplier,
            isRasmMode: state.isRasmMode
        });
        elements.tempCount.innerText = state.accumulatedBlocks.length;
        showToast(`Ajouté ! (${state.accumulatedBlocks.length} bloc(s) en attente)`, "info");
    }, "le cumul de documents");
});

// ─── GRATUIT ───
elements.btnClearTemp.addEventListener('click', () => {
    if (state.accumulatedBlocks.length === 0) return;
    state.accumulatedBlocks = [];
    elements.tempCount.innerText = "0";
    showToast("Le document temporaire a été vidé.", "info");
});

// ─── PDF — PROTÉGÉ ───
elements.btnDoc.addEventListener('click', () => {
    requireAlQalamAccess(() => {
        if (!elements.docName.value.trim() || (state.totalMultiplier === 0 && state.accumulatedBlocks.length === 0)) {
            showToast("Générez un texte ou cumulez des blocs, et nommez le document.", "error");
            return;
        }
        elements.popupMenu.style.display = 'flex';
    }, "la génération de documents");
});

elements.popupMenu.addEventListener('click', (e) => {
    if (e.target === elements.popupMenu) elements.popupMenu.style.display = 'none';
});

// Format d'export choisi dans le menu (PDF par défaut).
let exportFormat = 'pdf';
(function initFormatButtons() {
    const bPdf = document.getElementById('fmt-pdf');
    const bDocx = document.getElementById('fmt-docx');
    const setFmt = (fmt) => {
        exportFormat = fmt;
        if (bPdf) {
            bPdf.style.background = fmt === 'pdf' ? 'linear-gradient(135deg,#00b894,#00a884)' : 'rgba(255,255,255,0.1)';
            bPdf.style.border = fmt === 'pdf' ? 'none' : '1px solid var(--glass-border)';
        }
        if (bDocx) {
            bDocx.style.background = fmt === 'docx' ? 'linear-gradient(135deg,#00b894,#00a884)' : 'rgba(255,255,255,0.1)';
            bDocx.style.border = fmt === 'docx' ? 'none' : '1px solid var(--glass-border)';
        }
    };
    if (bPdf) bPdf.addEventListener('click', () => setFmt('pdf'));
    if (bDocx) bDocx.addEventListener('click', () => setFmt('docx'));
})();

function triggerPDF(useOuv, useFerm) {
    const docNameVal = elements.docName.value.trim();
    let blocksToGenerate = state.accumulatedBlocks.length > 0
        ? state.accumulatedBlocks
        : [{
            texte: formaterTexteIntercale(state.baseText, state.intercalatedPhrase),
            totalMultiplier: state.totalMultiplier,
            isRasmMode: state.isRasmMode
        }];
    if (exportFormat === 'docx') {
        generateDocx(useOuv, useFerm, blocksToGenerate, docNameVal);
    } else {
        generateVectorPDF(useOuv, useFerm, blocksToGenerate, docNameVal);
    }
}

document.getElementById('opt-both').addEventListener('click', () => triggerPDF(true, true));
document.getElementById('opt-start').addEventListener('click', () => triggerPDF(true, false));
document.getElementById('opt-end').addEventListener('click', () => triggerPDF(false, true));
document.getElementById('opt-none').addEventListener('click', () => triggerPDF(false, false));

// ─── COMPAT : nettoyage d'anciens paramètres ?token=... (plus de paiement en ligne) ───
(function nettoyerAncienRetour() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('token') || params.has('canceled')) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
})();

