// store.js
import { config } from './config.js';

export const state = {
    baseText: "",
    totalMultiplier: 0,
    intercalatedPhrase: "",
    isRasmMode: false,
    accumulatedBlocks: [] // NOUVEAU : Tampon pour cumuler les textes
};

// Données immuables depuis l'extérieur : on utilise des getters
let _souratesData = {};
let _versetsData = [];

export const souratesData = {
    set: (key, value) => { _souratesData[key] = value; },
    get: (key) => _souratesData[key],
    getAll: () => ({ ..._souratesData }),
    clear: () => { _souratesData = {}; }
};

export const versetsData = {
    set: (newArray) => { _versetsData = [...newArray]; },
    get: () => [..._versetsData],
    push: (...items) => { _versetsData.push(...items); },
    clear: () => { _versetsData = []; }
};

export const elements = {
    inputText: document.getElementById('input-text'),
    suggestionsBox: document.getElementById('suggestions-box'), 
    repCount: document.getElementById('rep-count'),
    btnWrite: document.getElementById('btn-write'),
    outputArea: document.getElementById('output-area'),
    fontSizeSlider: document.getElementById('font-size-slider'),
    
    chkDoc: document.getElementById('chk-doc'),
    chkRep: document.getElementById('chk-rep'),
    chkSearch: document.getElementById('chk-search'),
    chkIntercaler: document.getElementById('chk-intercaler'),
    chkFont: document.getElementById('chk-font'),
    chkRasm: document.getElementById('chk-rasm'),
    
    panelDoc: document.getElementById('panel-doc'),
    panelRep: document.getElementById('panel-rep'),
    panelSearch: document.getElementById('panel-search'),
    panelIntercaler: document.getElementById('panel-intercaler'),
    panelFont: document.getElementById('panel-font'),
    
    toolRepCount: document.getElementById('tool-rep-count'),
    btnToolRep: document.getElementById('btn-tool-rep'),
    btnDoc: document.getElementById('btn-doc'),
    btnEspace: document.getElementById('btn-espace'),
    
    searchInput: document.getElementById('search-input'),
    searchCount: document.getElementById('search-count'),
    
    popupMenu: document.getElementById('popup-menu'),
    docName: document.getElementById('doc-name'),

    interSourateSelect: document.getElementById('inter-sourate-select'),
    interPhrase: document.getElementById('inter-phrase'),
    btnIntercaler: document.getElementById('btn-intercaler'),

    btnCopyInput: document.getElementById('btn-copy-input'),
    btnCopyOutput: document.getElementById('btn-copy-output'),

    fontFile: document.getElementById('font-file'),
    fontUrl: document.getElementById('font-url'),
    btnApplyFont: document.getElementById('btn-apply-font'),

    dialogIntercaler: document.getElementById('dialog-intercaler'),
    btnDialogRepeat: document.getElementById('btn-dialog-repeat'),
    btnDialogOnce: document.getElementById('btn-dialog-once'),

    // NOUVEAUX ÉLÉMENTS
    btnAddTemp: document.getElementById('btn-add-temp'),
    btnClearTemp: document.getElementById('btn-clear-temp'),
    tempCount: document.getElementById('temp-count')
};

export function initStore() {
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
    elements.toolRepCount.max = Math.floor(config.MAX_TOTAL_REPEAT / 10);
}

export function savePreference(key, value) {
    localStorage.setItem(`cali_${key}`, value);
}
