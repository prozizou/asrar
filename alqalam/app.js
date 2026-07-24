// ============================================================
// app.js — Al-Qalam (ASRAR PRO)
// Fichier unique fusionné à partir des modules ES d'origine :
// config.js, formatter.js, store.js, firebase_db.js, ui_tools.js, pdf.js, docx.js, main.js
// Ordre conservé volontairement (dépendances : config → formatter →
// store → firebase_db → ui_tools → pdf → docx → main).
// ============================================================

// ──────────────────────────────────────────────────────────
// CONFIGURATION (formules, POLICES, constantes)   (ex-config.js)
// ──────────────────────────────────────────────────────────
// config.js

// Encapsulé dans une IIFE : isole les variables (db, config, state…) du
// scope global pour éviter tout conflit avec les scripts partagés du hub
// (ex. firebase-config.js qui déclare aussi `const db`).
(function () {
'use strict';

const formules = {
    ouverture: "كن بسم الله الرحمن الرحيم اللهم صل على سيدنا محمد و على ءاله و صحبه و سلم تسليما ",
    fermeture: " اللهم صل على سيدنا محمد و على ءاله و صحبه و سلم تسليما فيكون ءامين يا رب العالمين و الحمد لله رب العالمين"
};

// Police unique : Scheherazade New (par défaut), définie en CSS. Il n'y a plus
// de sélection de police ni de polices premium.

const config = {
    MAX_PREVIEW: 500,          // Répétitions max affichées dans l'aperçu
    CHUNK_SIZE: 10000,         // Taille de chunk pour les opérations lourdes
    MAX_TOTAL_REPEAT: 30000,   // Limite absolue de répétitions (sécurité mobile)
    MAX_DOM_CHARS: 8000,       // Nombre max de caractères dans l'aperçu DOM
    DEBOUNCE_DELAY: 300        // Délai par défaut pour le debounce (ms)
};

// ──────────────────────────────────────────────────────────
// FORMATAGE (Rasm, couleurs manuscrites, intercalation)   (ex-formatter.js)
// ──────────────────────────────────────────────────────────
// formatter.js

const mapRasm = {
    'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ؤ': 'و', 'ئ': 'ى', 'ء': '',
    'ب': 'ٮ', 'ت': 'ٮ', 'ث': 'ٮ', 'ن': 'ں', 'ي': 'ى',
    'ف': 'ڡ', 'ق': 'ٯ', 'ش': 'س', 'ض': 'ص', 'ظ': 'ط',
    'غ': 'ع', 'خ': 'ح', 'ج': 'ح', 'ز': 'ر', 'ذ': 'د',
    'ة': 'ه', 'ك': 'ک', 'پ': 'ٮ', 'چ': 'ح', 'ژ': 'ر', 'گ': 'ک'
};

const rasmRegex = new RegExp(`[${Object.keys(mapRasm).join('')}]`, 'g');

function convertirEnRasm(texte) {
    if (!texte) return "";

    let rasm = texte.replace(/الله/g, 'الل\u200Dه').replace(/لله/g, 'لل\u200Dه').replace(/ﷲ/g, 'الل\u200Dه');
    rasm = rasm.replace(/[\u064B-\u065F\u0670]/g, '');

    return rasm.replace(rasmRegex, char => mapRasm[char] || char);
}

const dictionnaireStandard = [
    { mot: "لعبدك وخليلك وحبيبك وخديم رسولك", classe: "mot-bleu" },
    { mot: "ورضيته", classe: "mot-rouge" },
    { mot: "الرحمن", classe: "mot-rouge" },
    { mot: "الرحيم", classe: "mot-rouge" },
    { mot: "اللهم", classe: "mot-rouge" },
    { mot: "الله", classe: "mot-rouge" },
    { mot: "محمدا", classe: "mot-vert" },
    { mot: "محمد", classe: "mot-vert" },
    { mot: "رب", classe: "mot-rouge" }
];

let dictionnaireRasmCache = null;

function appliquerCouleursManuscrit(texte, isRasmMode = false) {
    if (!texte) return "";

    let texteTraite = isRasmMode ? convertirEnRasm(texte) : texte;
    let dictionnaireActif = dictionnaireStandard;

    if (isRasmMode) {
        if (!dictionnaireRasmCache) {
            dictionnaireRasmCache = dictionnaireStandard.map(item => ({
                mot: convertirEnRasm(item.mot),
                classe: item.classe
            }));
        }
        dictionnaireActif = dictionnaireRasmCache;
    }

    let textProtege = texteTraite;

    dictionnaireActif.forEach((item, index) => {
        const regex = new RegExp(item.mot, 'g');
        textProtege = textProtege.replace(regex, `__MOT${index}__`);
    });

    dictionnaireActif.forEach((item, index) => {
        const regex = new RegExp(`__MOT${index}__`, 'g');
        textProtege = textProtege.replace(regex, `<span class="${item.classe}">${item.mot}</span>`);
    });

    return textProtege;
}

// Fonction centralisée pour intercaler (DRY)
function formaterTexteIntercale(texte, phraseIntercalee) {
    if (!phraseIntercalee || !texte.includes(phraseIntercalee)) return texte;
    const parts = texte.split(phraseIntercalee);
    return parts.map(p => `<span class="verset-brun">${p}</span>`).join(phraseIntercalee);
}

// ──────────────────────────────────────────────────────────
// ÉTAT & ÉLÉMENTS DOM (state, elements, préférences)   (ex-store.js)
// ──────────────────────────────────────────────────────────
// store.js

const state = {
    baseText: "",
    totalMultiplier: 0,
    intercalatedPhrase: "",
    isRasmMode: false,
    accumulatedBlocks: [] // NOUVEAU : Tampon pour cumuler les textes
};

// Données immuables depuis l'extérieur : on utilise des getters
let _souratesData = {};
let _versetsData = [];

const souratesData = {
    set: (key, value) => { _souratesData[key] = value; },
    get: (key) => _souratesData[key],
    getAll: () => ({ ..._souratesData }),
    clear: () => { _souratesData = {}; }
};

const versetsData = {
    set: (newArray) => { _versetsData = [...newArray]; },
    get: () => [..._versetsData],
    push: (...items) => { _versetsData.push(...items); },
    clear: () => { _versetsData = []; }
};

const elements = {
    inputText: document.getElementById('input-text'),
    suggestionsBox: document.getElementById('suggestions-box'), 
    repCount: document.getElementById('rep-count'),
    btnWrite: document.getElementById('btn-write'),
    outputArea: document.getElementById('output-area'),
    fontSizeSlider: document.getElementById('font-size-slider'),
    
    chkDoc: document.getElementById('chk-doc'),
    chkSearch: document.getElementById('chk-search'),
    chkIntercaler: document.getElementById('chk-intercaler'),
    chkRasm: document.getElementById('chk-rasm'),

    panelDoc: document.getElementById('panel-doc'),
    panelSearch: document.getElementById('panel-search'),
    panelIntercaler: document.getElementById('panel-intercaler'),

    btnDoc: document.getElementById('btn-doc'),
    btnEspace: document.getElementById('btn-espace'),
    
    searchInput: document.getElementById('search-input'),
    searchCount: document.getElementById('search-count'),
    
    popupMenu: document.getElementById('popup-menu'),
    docName: document.getElementById('doc-name'),

    interSourateSelect: document.getElementById('inter-sourate-select'),
    btnIntercaler: document.getElementById('btn-intercaler'),

    // NOUVEAUX ÉLÉMENTS
    btnAddTemp: document.getElementById('btn-add-temp'),
    btnClearTemp: document.getElementById('btn-clear-temp'),
    tempCount: document.getElementById('temp-count')
};

function initStore() {
    // Vérification des éléments critiques
    const missing = [];
    for (const [key, el] of Object.entries(elements)) {
        if (!el) missing.push(key);
    }
    if (missing.length) console.error("Éléments DOM manquants :", missing);

    // Restauration des préférences
    const prefs = ['repCount', 'fontSize', 'docName', 'isRasmMode'];
    prefs.forEach(pref => {
        const val = localStorage.getItem(`cali_${pref}`);
        if (val !== null) {
            if (pref === 'repCount') elements.repCount.value = val;
            else if (pref === 'fontSize') {
                elements.fontSizeSlider.value = val;
                elements.outputArea.style.fontSize = val + 'px';
            } else if (pref === 'docName') elements.docName.value = val;
            else if (pref === 'isRasmMode') {
                if (elements.chkRasm) elements.chkRasm.checked = (val === 'true');
                state.isRasmMode = (val === 'true');
            }
        }
    });

    // Application des limites du config
    elements.repCount.max = config.MAX_TOTAL_REPEAT;
}

function savePreference(key, value) {
    localStorage.setItem(`cali_${key}`, value);
}

// ──────────────────────────────────────────────────────────
// CHARGEMENT DES DONNÉES (sourates, versets)   (ex-firebase_db.js)
// ──────────────────────────────────────────────────────────
// firebase_db.js
// Utilise l'app Firebase GLOBALE de ASRAR PRO (SDK compat chargé par index.html,
// AVANT main.js). Plus d'app modulaire « alqalam-app » séparée → fin des conflits
// d'initialisation nommée, une seule session d'auth, une seule connexion RTDB.


// firebase-config.js (script classique) a déjà appelé firebase.initializeApp(...).
const db = firebase.database();

async function chargerSourates() {
    try {
        const snapshot = await db.ref('sourate').once('value');
        if (snapshot.exists()) {
            const cacheData = {};
            elements.interSourateSelect.innerHTML = '<option value="">Sélectionnez une sourate</option>';

            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                souratesData.set(childSnapshot.key, data.contenu);
                cacheData[childSnapshot.key] = data;

                const option = document.createElement('option');
                option.value = childSnapshot.key;
                option.textContent = data.sourate;
                elements.interSourateSelect.appendChild(option);
            });

            try {
                localStorage.setItem('cali_sourates_cache', JSON.stringify(cacheData));
            } catch (storageError) {
                console.warn("Espace de stockage insuffisant pour le cache des sourates");
            }
        }
    } catch (error) {
        console.warn("Réseau indisponible, tentative de chargement local des sourates...");
        const cachedSourates = localStorage.getItem('cali_sourates_cache');

        if (cachedSourates) {
            const parsedCache = JSON.parse(cachedSourates);
            elements.interSourateSelect.innerHTML = '<option value="">Sélectionnez une sourate (Hors-ligne)</option>';

            for (const key in parsedCache) {
                souratesData.set(key, parsedCache[key].contenu);
                const option = document.createElement('option');
                option.value = key;
                option.textContent = parsedCache[key].sourate;
                elements.interSourateSelect.appendChild(option);
            }
            showToast("Mode hors-ligne : Sourates chargées depuis le cache", "info");
        } else {
            showToast("Échec de connexion : Aucune donnée hors-ligne disponible", "error");
        }
    }
}

async function chargerVersets() {
    try {
        const snapshot = await db.ref('versetRef').once('value');
        if (snapshot.exists()) {
            const versetsArray = [];
            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data && data.verset) {
                    versetsArray.push(data.verset);
                }
            });
            versetsData.set(versetsArray);
            try {
                localStorage.setItem('cali_versets_cache', JSON.stringify(versetsArray));
            } catch (e) {
                console.warn("Impossible de sauvegarder le cache des versets");
            }
        }
    } catch (error) {
        console.warn("Réseau indisponible, tentative de chargement local des suggestions...");
        const cachedVersets = localStorage.getItem('cali_versets_cache');

        if (cachedVersets) {
            const parsedVersets = JSON.parse(cachedVersets);
            versetsData.set(parsedVersets);
        }
    }
}

// ──────────────────────────────────────────────────────────
// OUTILS UI (aperçu, toast, copier, police locale)   (ex-ui_tools.js)
// ──────────────────────────────────────────────────────────
// ui_tools.js

function debounce(func, wait = config.DEBOUNCE_DELAY) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.className = `toast-notification ${type === 'error' ? 'toast-error' : 'toast-info'}`;
    toast.setAttribute('role', 'alert');
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function highlightText(text, query) {
    if (!query) return { html: text, count: 0 };
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeQuery})`, 'g');
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;
    const html = text.replace(regex, '<span class="highlight">$1</span>');
    return { html, count };
}

function updateUI() {
    if (state.totalMultiplier === 0) return;
    const term = elements.searchInput.value.trim();
    
    let rawTextForPreview = state.baseText;
    let isTruncated = false;
    
    let previewReps = Math.min(state.totalMultiplier, config.MAX_PREVIEW);

    if (rawTextForPreview.length * previewReps > config.MAX_DOM_CHARS) {
        if (rawTextForPreview.length > config.MAX_DOM_CHARS) {
            rawTextForPreview = rawTextForPreview.substring(0, config.MAX_DOM_CHARS) + " ... ﴾Suite masquée dans l'aperçu﴿";
            previewReps = 1;
            isTruncated = true;
        } else {
            previewReps = Math.max(1, Math.floor(config.MAX_DOM_CHARS / rawTextForPreview.length));
            isTruncated = true;
        }
    }

    rawTextForPreview = formaterTexteIntercale(rawTextForPreview, state.intercalatedPhrase);
    rawTextForPreview = appliquerCouleursManuscrit(rawTextForPreview, state.isRasmMode) + " ";
    let previewText = rawTextForPreview.repeat(previewReps).trim();

    let totalSearchCount = 0;
    if (term) {
        const result = highlightText(previewText, term);
        previewText = result.html;
        const baseResult = highlightText(state.baseText, term);
        totalSearchCount = baseResult.count * state.totalMultiplier;
    }

    let warningHTML = "";
    if (isTruncated) {
        warningHTML = `<div class="preview-warning">
            ⚠️ Aperçu limité pour protéger la mémoire de votre téléphone.<br>
            Le document final contiendra bien <b>l'intégralité du texte</b>.
        </div>`;
    }
    
    const finalHTML = previewText + warningHTML;
    // Utilisation sécurisée de DOMPurify
    const sanitized = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(finalHTML) : finalHTML;
    elements.outputArea.innerHTML = sanitized;
    
    elements.searchCount.innerText = term ? (totalSearchCount > 0 ? `${totalSearchCount.toLocaleString('fr-FR')} trouvés` : "0 trouvé") : "";
}

const debouncedUpdateUI = debounce(updateUI);

// Copie le texte dans le presse-papiers et confirme via un toast
// (plus de bouton dédié : déclenché par appui long sur les zones de texte).
function copierTexte(textToCopy) {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy)
        .then(() => showToast("✅ Texte copié !", "info"))
        .catch(() => showToast("Impossible de copier", "error"));
}

// Attache le copier par « appui long » (≈550 ms) sur un élément — souris et tactile.
function attacherAppuiLong(element, getTexte) {
    if (!element) return;
    let timer = null;
    const LONG_MS = 550;
    const start = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            copierTexte(getTexte());
            if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} }
        }, LONG_MS);
    };
    const cancel = () => clearTimeout(timer);
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchend', cancel);
    element.addEventListener('touchmove', cancel, { passive: true });
    element.addEventListener('mousedown', start);
    element.addEventListener('mouseup', cancel);
    element.addEventListener('mouseleave', cancel);
    element.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ──────────────────────────────────────────────────────────
// GÉNÉRATION WORD / WPS (.docx)   (ex-docx.js)
// ──────────────────────────────────────────────────────────
// docx.js — Export Word (.docx) EN PARALLÈLE du PDF, à partir des mêmes blocs.
// Compatible Microsoft Word ET WPS Office (format .docx standard).
// Utilise la bibliothèque UMD `docx` (window.docx) chargée dans index.html.

// Mêmes couleurs que l'aperçu à l'écran et le PDF (voir style.css : .mot-rouge, etc.)
const COLOR_MAP = {
  'mot-rouge': 'D11015',
  'mot-vert': '008A3B',
  'mot-bleu': '1B378C',
  'verset-brun': '8B0000'
};

// Convertit le HTML coloré (généré par appliquerCouleursManuscrit, identique à
// l'aperçu écran et au PDF) en une liste de TextRun Word, en conservant les
// couleurs — pour que le .docx corresponde exactement à ce que l'utilisateur
// a vu et écrit.
function htmlToRuns(html, size) {
  const { TextRun } = window.docx;
  const container = document.createElement('div');
  container.innerHTML = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(html) : html;

  const runs = [];
  const walk = (node, color) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        runs.push(new TextRun({ text: node.textContent, size, rightToLeft: true, color: color || undefined }));
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const cls = node.className || '';
      let nextColor = color;
      for (const klass in COLOR_MAP) {
        if (cls.indexOf(klass) !== -1) { nextColor = COLOR_MAP[klass]; break; }
      }
      node.childNodes.forEach((child) => walk(child, nextColor));
    }
  };
  container.childNodes.forEach((n) => walk(n, null));

  return runs.length ? runs : [new TextRun({ text: container.textContent || '', size, rightToLeft: true })];
}

async function generateDocx(useOuv, useFerm, blocks, docName) {
  const popupMenu = document.getElementById('popup-menu');
  const progressOverlay = document.getElementById('progress-overlay');
  const progressBar = document.getElementById('progress-bar-fill');
  const progressText = document.getElementById('progress-text');
  const fontSizeSlider = document.getElementById('font-size-slider');
  if (popupMenu) popupMenu.style.display = 'none';

  if (typeof window.docx === 'undefined') {
    showToast('Module Word indisponible (connexion internet requise).', 'error');
    return;
  }
  const { Document, Packer, Paragraph, AlignmentType, Footer, PageNumber, TextRun } = window.docx;

  if (progressOverlay) progressOverlay.style.display = 'flex';
  if (progressBar) progressBar.style.width = '10%';
  if (progressText) progressText.innerText = 'Préparation du Word…';
  await new Promise((r) => setTimeout(r, 0));

  const px = parseInt(fontSizeSlider ? fontSizeSlider.value : 28, 10) || 28;
  const halfPoints = Math.max(16, Math.round(px * 1.5)); // taille en demi-points (~px*0.75pt*2)

  const paras = [];
  const pushColored = (html) => {
    if (!html) return;
    paras.push(new Paragraph({
      bidirectional: true,                    // RTL
      alignment: AlignmentType.JUSTIFIED,     // texte bien justifié
      spacing: { line: 360 },
      children: htmlToRuns(html, halfPoints)
    }));
  };

  try {
    const firstRasm = blocks[0] ? blocks[0].isRasmMode : false;
    const lastRasm = blocks[blocks.length - 1] ? blocks[blocks.length - 1].isRasmMode : false;

    if (useOuv) pushColored(appliquerCouleursManuscrit(formules.ouverture, firstRasm));

    if (progressBar) progressBar.style.width = '45%';
    await new Promise((r) => setTimeout(r, 0));

    for (const block of blocks) {
      const coloredBase = appliquerCouleursManuscrit(block.texte, block.isRasmMode) + ' ';
      const n = block.totalMultiplier || 1;
      pushColored(coloredBase.repeat(n).trim());
    }

    if (useFerm) pushColored(appliquerCouleursManuscrit(formules.fermeture, lastRasm));

    if (progressBar) progressBar.style.width = '80%';
    if (progressText) progressText.innerText = 'Assemblage du fichier…';
    await new Promise((r) => setTimeout(r, 0));

    // Numérotation des pages « [ n ] » centrée en pied de page.
    const footer = new Footer({
      children: [ new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [ new TextRun({ children: ['[ ', PageNumber.CURRENT, ' ]'], size: 20 }) ]
      }) ]
    });

    const doc = new Document({
      creator: 'ASRAR PRO — Al-Qalam',
      title: docName || 'Document Al-Qalam',
      sections: [{
        properties: {
          // Marges de 0,3 pouce partout (0,3 × 1440 = 432 twips).
          page: { margin: { top: 432, right: 432, bottom: 432, left: 432 } }
        },
        footers: { default: footer },
        children: paras.length ? paras : [new Paragraph('')]
      }]
    });

    const blob = await Packer.toBlob(doc);
    if (progressBar) progressBar.style.width = '100%';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (docName || 'document') + '.docx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    if (progressOverlay) progressOverlay.style.display = 'none';
    showToast('Document Word généré (compatible WPS Office).', 'success');
  } catch (e) {
    console.error('Erreur DOCX:', e);
    showToast('Échec de la génération Word.', 'error');
    if (progressOverlay) progressOverlay.style.display = 'none';
  }
}

// ──────────────────────────────────────────────────────────
// APPLICATION PRINCIPALE (état, auth, événements)   (ex-main.js)
// ──────────────────────────────────────────────────────────
// main.js
// Al-Qalam — Intégration ASRAR PRO : réutilise l'auth et le paywall globaux
// Variables attendues de l'écosystème : window.currentUser, window.requireSubscription


initStore();
chargerSourates();
chargerVersets();

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

// Masque le loader plein écran dès que l'utilisateur (Firebase) est résolu :
// à ce stade l'interface est interactive (le paywall gère le reste au clic).
whenUser().finally(() => { if (window.asrarHideLoader) window.asrarHideLoader(); });

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
togglePanelGuarded(elements.chkSearch, elements.panelSearch, "la recherche");
togglePanelGuarded(elements.chkIntercaler, elements.panelIntercaler, "l'intercalation");

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

// ─── GRATUIT ───
elements.btnEspace.addEventListener('click', () => {
    if (state.baseText) { state.baseText = " " + state.baseText; updateUI(); }
});

// Copier par appui long sur les zones de texte (plus de boutons Copier).
attacherAppuiLong(elements.inputText, () => elements.inputText.value);
attacherAppuiLong(elements.outputArea, () => (state.baseText + " ").repeat(state.totalMultiplier).trim());

// ─── INTERCALER — PROTÉGÉ ───
elements.btnIntercaler.addEventListener('click', () => {
    requireAlQalamAccess(() => {
        const key = elements.interSourateSelect.value;
        // L'expression à intercaler vient de la zone de texte principale.
        const phrase = elements.inputText.value.trim();
        if (!key || !phrase) {
            showToast("Choisissez une sourate et saisissez l'expression dans la zone de texte.", "error");
            return;
        }
        // Entre chaque verset, on insère l'expression RÉPÉTÉE N fois
        // (N = nombre de répétitions) : « le texte écrit autant de fois ».
        const rep = Math.max(1, Math.min(parseInt(elements.repCount.value, 10) || 1, config.MAX_TOTAL_REPEAT));
        const bloc = Array(rep).fill(phrase).join(' ');

        let result = souratesData.get(key);
        if (result.includes("﴾")) result = result.split("﴾").join(' ' + bloc + ' ');
        if (result.includes("(")) result = result.split("(").join(' ' + bloc + ' ');
        result = result.replace(/[0-9]/g, "").split("ك").join("ک").replace(/\s+/g, ' ').trim();

        // Application directe : le texte combiné devient la base et s'affiche
        // immédiatement dans l'aperçu (aucune question posée).
        state.baseText = result;
        state.intercalatedPhrase = phrase; // coloration verset par verset
        state.totalMultiplier = 1;
        elements.inputText.value = result;
        elements.chkIntercaler.checked = false;
        elements.panelIntercaler.classList.remove('show-panel');
        updateUI();
        showToast("Texte combiné généré.", "info");
    }, "l'intercalation");
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

// Le seul format d'export est le Word (.docx) : RTL, justifié, numéroté.
function triggerPDF(useOuv, useFerm) {
    const docNameVal = elements.docName.value.trim();
    let blocksToGenerate = state.accumulatedBlocks.length > 0
        ? state.accumulatedBlocks
        : [{
            texte: formaterTexteIntercale(state.baseText, state.intercalatedPhrase),
            totalMultiplier: state.totalMultiplier,
            isRasmMode: state.isRasmMode
        }];
    generateDocx(useOuv, useFerm, blocksToGenerate, docNameVal);
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

})();
