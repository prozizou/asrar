// ui_tools.js
import { state, elements } from './store.js';
import { config } from './config.js';
import { appliquerCouleursManuscrit, formaterTexteIntercale } from './formatter.js';

export function debounce(func, wait = config.DEBOUNCE_DELAY) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

export function showToast(message, type = 'error') {
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

export function highlightText(text, query) {
    if (!query) return { html: text, count: 0 };
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeQuery})`, 'g');
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;
    const html = text.replace(regex, '<span class="highlight">$1</span>');
    return { html, count };
}

export function updateUI() {
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

export const debouncedUpdateUI = debounce(updateUI);

export function handleCopy(button, textToCopy) {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = button.innerText;
        button.innerText = "✅ Copié !";
        setTimeout(() => { button.innerText = originalText; }, 2000);
    }).catch(() => showToast("Impossible de copier", "error"));
}

export function injecterPolice(url, nomPolice) {
    const styleId = "custom-font-style";
    let oldStyle = document.getElementById(styleId);
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        @font-face { font-family: '${nomPolice}'; src: url('${url}'); }
        .top-textarea, .output-area, #print-area, #inter-sourate-select {
            font-family: '${nomPolice}', 'Alkalami', serif !important;
        }
    `;
    document.head.appendChild(style);
}