// domManager.js — v2.1 (Corrections & améliorations)
import { calculatePoidsMystique, generateAllWafq3x3, generateAllWafq3x3Vide, generateAllWafq4x4, getElementalOrderFromText, toEasternArabic } from './abjad.js';
import { playAudio } from './audio.js';
import { handleTasbihAction, resetTasbih, updateTasbihSettings } from './tasbihLogic.js';

// ── RÉFÉRENCES DOM ───────────────────────────────────────────
export const elements = {
    container:      document.getElementById('cardsContainer'),
    searchInput:    document.getElementById('searchInput'),
    countSpan:      document.getElementById('countDisplay'),
    clearBtn:       document.getElementById('clearSearch'),
    suggestionsBox: document.getElementById('suggestionsBox'),
    themeToggle:    document.getElementById('themeToggle'),
    viewToggle:     document.getElementById('viewToggle'),
    favoritesBtn:   document.getElementById('showFavoritesBtn'),
    modal:          document.getElementById('nameModal'),
    modalArabic:    document.getElementById('modalArabic'),
    modalTranslit:  document.getElementById('modalTranslit'),
    modalNumber:    document.getElementById('modalNumber'),
    modalMeaning:   document.getElementById('modalMeaning'),
    modalBenefit:   document.getElementById('modalBenefit'),
    modalBenefitSection: document.getElementById('modalBenefitSection'),
    modalPlay:      document.getElementById('modalPlayAudio'),
    modalFavBtn:    document.getElementById('modalToggleFavorite'),
    modalClose:     document.querySelector('.modal-close'),
    toast:          document.getElementById('toast'),
};

// ── ÉTAT ─────────────────────────────────────────────────────
let currentData       = [];
let currentSearchTerm = '';
let viewMode          = 'grid'; // vue grille uniquement
let currentModalItem  = null;
let toastTimer        = null;

// ── ACCÈS / ABONNEMENT ───────────────────────────────────────
// accessGranted = false → cartes « nom seul » + modale verrouillée.
let accessGranted = false;
let gateHandler   = null; // fonction (item) → ouvre le portail d'abonnement
export function setAccessGranted(v) { accessGranted = !!v; }
export function getAccessGranted()  { return accessGranted; }
export function setGateHandler(fn)  { gateHandler = fn; }

// Favoris
let savedFavs = [];
try { savedFavs = JSON.parse(localStorage.getItem('favorites')) || []; }
catch(e) { localStorage.removeItem('favorites'); }
let favorites = new Set(savedFavs);

// Synchronisation inter-onglets
window.addEventListener('storage', (e) => {
    if (e.key === 'favorites') {
        const newFavs = JSON.parse(e.newValue) || [];
        favorites = new Set(newFavs);
        // Re-render si nécessaire
        renderCards(currentData, elements.searchInput.value, elements.favoritesBtn.classList.contains('active'));
    }
});
// ── OBSERVER (lazy loading) ───────────────────────────────────
const cardObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            hydrateCard(entry.target);
            observer.unobserve(entry.target);
        }
    });
}, { root: null, rootMargin: '120px', threshold: 0.05 });

// ── TOAST ─────────────────────────────────────────────────────
export function showToast(message, duration = 2200) {
    if (!elements.toast) return;
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), duration);
}

// ── THÈME ─────────────────────────────────────────────────────
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = elements.themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', theme);
}

// ── SQUELETTES ────────────────────────────────────────────────
export function showSkeletons(count = 9) {
    elements.container.innerHTML = Array(count).fill(
        '<div class="skeleton-card" aria-hidden="true"></div>'
    ).join('');
}

// ── DÉLÉGATION D'ÉVÉNEMENTS (cartes) ─────────────────────────
function initEventDelegation() {
    elements.container.addEventListener('click', (e) => {
        const card = e.target.closest('.glass-card');
        if (!card || card.classList.contains('skeleton-card')) return;

        const id   = card.dataset.id;
        const item = currentData.find(d => d.id === id);
        if (!item) return;

        if (e.target.closest('.favorite-btn')) {
            e.stopPropagation();
            const isFav = toggleFavorite(id);
            const btn   = e.target.closest('.favorite-btn');
            btn.classList.toggle('active', isFav);
            btn.querySelector('i').className = isFav ? 'fas fa-star' : 'far fa-star';
            showToast(isFav ? '⭐ Ajouté aux favoris' : '✕ Retiré des favoris');
        }
        else if (e.target.closest('.audio-btn')) {
            e.stopPropagation();
            playAudio(item);
        }
        else if (e.target.closest('.tasbih-btn')) {
            e.stopPropagation();
            const tasbihEl = card.querySelector('.inline-tasbih');
            tasbihEl.classList.toggle('active');
        }
        else if (e.target.closest('.reset-zikr-btn')) {
            e.stopPropagation();
            resetTasbih(card, id);
        }
        else if (e.target.closest('.inline-tasbih')) {
            if (e.target.closest('.tasbih-settings')) return;
            handleTasbihAction(card, id);
        }
        else if (e.target.closest('.toggle-numeral-btn')) {
            const cb = e.target.closest('.toggle-numeral-btn');
            const wc = cb.closest('.wafq-container-global');
            wc.classList.toggle('show-eastern', cb.checked);
        }
        else if (e.target.closest('.wafq-expander')) {
            return; // Laisser le <details> gérer nativement
        }
        else {
            showModal(item);
        }
    });

    elements.container.addEventListener('input', (e) => {
        if (e.target.classList.contains('zikr-input')) {
            updateTasbihSettings(e.target, e.target.dataset.id, e.target.value);
            if (e.target.id && e.target.id.startsWith('input-target-')) {
                renderObjSubdiv(e.target.dataset.id, e.target.value);
            }
        }
    });
}

initEventDelegation();
// ── BOUTONS DE SCROLL ─────────────────────────────────────────
export function initScrollButtons() {
    document.getElementById('scrollTopBtn')?.addEventListener('click', () =>
        window.scrollTo({ top: 0, behavior: 'smooth' })
    );
    document.getElementById('scrollBottomBtn')?.addEventListener('click', () =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    );
}

// ── AFFICHAGE DES CARTES ──────────────────────────────────────

// Préfixe d'imploration : « يا » devant le nom (l'article « ال » initial tombe au vocatif).
function implore(name) {
    return 'يا ' + String(name || '').replace(/^ال/, '');
}
// Subdivision d'un objectif N en paires a×b (a répété b fois), ex. 450 → 225×2, 150×3…
function objSubdivisions(n) {
    n = parseInt(n, 10);
    if (!n || n <= 1) return [];
    const out = [];
    for (let a = n - 1; a >= 2 && out.length < 40; a--) {
        if (n % a === 0) out.push(a + '×' + (n / a));
    }
    return out;
}
function renderObjSubdiv(id, target) {
    const el = document.getElementById('obj-subdiv-' + id);
    if (!el) return;
    const subs = objSubdivisions(target);
    el.innerHTML = subs.length
        ? subs.map(x => '<span class="obj-chip">' + x + '</span>').join('')
        : '';
}

export function renderCards(data, filterTerm = '', showFavoritesOnly = false) {
    currentSearchTerm = filterTerm.trim();

    let filtered = data;

    if (showFavoritesOnly) {
        filtered = data.filter(item => {
            const count = parseInt(localStorage.getItem(`tasbih_asma_${item.id}`)) || 0;
            return favorites.has(item.id) || count > 0;
        });
    }

    if (currentSearchTerm) {
        const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const term = norm(currentSearchTerm);
        filtered = filtered.filter(item =>
            [item.name, item.translit, item.meaning, item.benefit, String(item.number)]
                .some(f => norm(f).includes(term))
        );
    }

    elements.countSpan.textContent = filtered.length;
    elements.container.className   = 'cards-grid';
    elements.container.innerHTML   = '';

    if (filtered.length === 0) {
        elements.container.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-moon"></i>
                <p>Aucun nom trouvé pour « ${currentSearchTerm} »</p>
            </div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((item, index) => {
        const shell         = document.createElement('div');
        shell.className     = 'glass-card skeleton-card';
        shell.dataset.id    = item.id;
        shell._data         = item;
        shell.style.animationDelay = `${Math.min(index * 30, 300)}ms`;
        fragment.appendChild(shell);
        cardObserver.observe(shell);
    });
    elements.container.appendChild(fragment);
}

// ── MISE EN ÉVIDENCE RECHERCHE ────────────────────────────────
// SÉCURITÉ : le texte (venant de Firebase) est ÉCHAPPÉ avant toute insertion
// en innerHTML — seul notre <mark> est du HTML. Corrige un vecteur XSS stocké.
function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function highlightText(text) {
    const escaped = escapeHtml(text);
    if (!currentSearchTerm || !escaped) return escaped;
    const safe  = escapeHtml(currentSearchTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safe})`, 'gi');
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// ── CONSTRUCTION HTML WAFQ ────────────────────────────────────
function buildWafqSliderHtml(squaresData, orderedKeys, numericTarget, typeName) {
    if (!squaresData) return '';
    // Taille réelle du carré (3 ou 4) lue depuis la grille → robuste au format du nom
    // (« 3×3 » avec le signe × ne contient PAS « 3x3 » : l'ancienne détection cassait l'affichage).
    const firstSq = squaresData[orderedKeys[0]];
    const cols = (firstSq && Array.isArray(firstSq.grid) && firstSq.grid.length) ? firstSq.grid.length
               : (typeName.indexOf('4') !== -1 ? 4 : 3);
    const is4 = cols === 4;

    const slidesHtml = orderedKeys.map((key, index) => {
        const sq        = squaresData[key];
        const isPrimary = index === 0;
        const extraDot  = is4 ? `<div class="wafq-center-dot"></div>` : '';

        const cellsHtml = sq.grid.map((row, rIndex) =>
            row.map((cell, cIndex) => {
                if (cell.s === 'V') {
                    return `<div class="wafq-cell center-vide">
                        <span class="num-w">${cell.v}</span>
                        <span class="num-e" style="display:none">${toEasternArabic(cell.v)}</span>
                    </div>`;
                }
                let stepClass = 'step-right';
                if (is4 && cIndex === 1 && (rIndex === 1 || rIndex === 2)) {
                    stepClass = 'step-left';
                }
                return `<div class="wafq-cell">
                    <span class="cell-step ${stepClass}" title="Ordre de remplissage">${cell.s}</span>
                    <span class="cell-val">
                        <span class="num-w">${cell.v}</span>
                        <span class="num-e" style="display:none">${toEasternArabic(cell.v)}</span>
                    </span>
                </div>`;
            }).join('')
        ).join('');

        return `<div class="wafq-slide ${isPrimary ? 'primary-element' : ''}">
            <div class="wafq-nature-badge">${sq.icon} ${sq.arabic}</div>
            <div class="wafq-title">${typeName}${isPrimary ? ' ✦' : ''}</div>
            <div class="wafq-subtitle">Constante: ${numericTarget} · ${sq.name}</div>
            <div class="wafq-grid grid-${cols}x${cols}">
                ${cellsHtml}
                ${extraDot}
            </div>
        </div>`;
    }).join('');

    return `<div class="wafq-slider-wrapper">
        <div class="swipe-hint">
            <i class="fas fa-arrows-left-right"></i> Glissez pour voir les autres éléments
        </div>
        <div class="wafq-slider">${slidesHtml}</div>
    </div>`;
}

// ── HYDRATATION D'UNE CARTE ───────────────────────────────────
function hydrateCard(cardElement) {
    const item = cardElement._data;

    // — Sans abonnement : on n'affiche QUE le nom (verrou visuel) —
    if (!accessGranted) {
        const hName     = highlightText(implore(item.name));
        const hTranslit = highlightText(item.translit);
        const numLabel  = item.number && item.number < 999
            ? `<span class="stat-pill" style="font-size:0.72rem"><i class="fas fa-hashtag"></i><span>${item.number}</span></span>` : '';
        cardElement.innerHTML = `
            ${numLabel ? `<div style="margin-bottom:0.4rem">${numLabel}</div>` : ''}
            <div class="arabic-name">${hName}</div>
            <div class="translit-name">${hTranslit}</div>
            <div class="locked-hint" style="margin-top:0.9rem;display:flex;align-items:center;
                 justify-content:center;gap:6px;font-size:0.82rem;opacity:0.75">
                <i class="fas fa-lock"></i> Abonnement requis
            </div>`;
        cardElement.classList.remove('skeleton-card');
        cardElement.classList.add('is-locked');
        return;
    }

    const isFav      = favorites.has(item.id);
    const savedCount = parseInt(localStorage.getItem(`tasbih_asma_${item.id}`)) || 0;

    const poidsMystique = calculatePoidsMystique(item.name);
    const autoTarget    = poidsMystique > 0 ? poidsMystique * 7 : '';

    let finalTarget  = localStorage.getItem(`tasbih_target_${item.id}`);
    if (finalTarget === null || finalTarget === '') finalTarget = autoTarget;
    let numericTarget = parseInt(finalTarget);
    setTimeout(() => renderObjSubdiv(item.id, numericTarget), 0);
    if (isNaN(numericTarget) || numericTarget === 0) numericTarget = parseInt(autoTarget);

    const savedLoopMax     = localStorage.getItem(`tasbih_loopmax_${item.id}`) || '';
    const savedLoopCurrent = parseInt(localStorage.getItem(`tasbih_loopcur_${item.id}`)) || 0;

    // Wafq (carrés magiques)
    let gridsHtml = '';
    const orderedKeys = getElementalOrderFromText(item.meaning, item.benefit);
    if (numericTarget >= 15) gridsHtml += buildWafqSliderHtml(generateAllWafq3x3(numericTarget),     orderedKeys, numericTarget, '3×3 Classique');
    if (numericTarget >= 15) gridsHtml += buildWafqSliderHtml(generateAllWafq3x3Vide(numericTarget), orderedKeys, numericTarget, '3×3 Vide');
    if (numericTarget >= 34) gridsHtml += buildWafqSliderHtml(generateAllWafq4x4(numericTarget),     orderedKeys, numericTarget, '4×4 Murabba');

    const wafqHtml = gridsHtml ? `
        <details class="wafq-expander wafq-container-global" aria-label="Carrés Magiques">
            <summary class="wafq-summary" aria-expanded="false">
                <span><i class="fas fa-table-cells" style="margin-right:6px"></i>Awfaq — Carrés Magiques</span>
                <i class="fas fa-chevron-down toggle-icon"></i>
            </summary>
            <div class="wafq-controls">
                <span style="font-size:0.8rem">123</span>
                <label class="switch-numeral" title="Chiffres arabes orientaux">
                    <input type="checkbox" class="toggle-numeral-btn" aria-label="Basculer chiffres arabes">
                    <span class="slider-numeral round"></span>
                </label>
                <span style="font-size:1rem">١٢٣</span>
            </div>
            ${gridsHtml}
        </details>` : '';

    const hName    = highlightText(implore(item.name));
    const hTranslit = highlightText(item.translit);
    const hMeaning  = highlightText(item.meaning);
    const hBenefit  = highlightText(item.benefit || '');
    const numLabel  = item.number && item.number < 999 ? `<span class="stat-pill" style="font-size:0.72rem"><i class="fas fa-hashtag"></i><span>${item.number}</span></span>` : '';

    cardElement.innerHTML = `
        ${numLabel ? `<div style="margin-bottom:0.4rem">${numLabel}</div>` : ''}
        <div class="arabic-name">${hName}</div>
        <div class="translit-name">${hTranslit}</div>

        ${poidsMystique > 0 ? `
        <div class="poids-badge" title="Poids abjad × 7 = objectif recommandé">
            <i class="fas fa-scale-balanced"></i>
            Poids <strong>${poidsMystique}</strong>
            <span style="opacity:0.5;margin:0 2px">·</span>
            Obj. <strong>${numericTarget || '—'}</strong>
        </div>` : ''}

        ${wafqHtml}

        <div class="meaning">
            <i class="fas fa-gem"></i>
            <span>${hMeaning}</span>
        </div>
        ${hBenefit ? `<div class="benefit">
            <i class="fas fa-leaf"></i>
            <span>${hBenefit}</span>
        </div>` : ''}

        <div class="card-footer">
            <button class="card-action-btn favorite-btn ${isFav ? 'active' : ''}" aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                <i class="${isFav ? 'fas' : 'far'} fa-star"></i>
            </button>
            <button class="card-action-btn audio-btn" aria-label="Écouter la prononciation">
                <i class="fas fa-volume-low"></i>
            </button>
            <button class="card-action-btn tasbih-btn" aria-label="Ouvrir le compteur de dhikr">
                <i class="fas fa-fingerprint"></i>
                <span class="tasbih-counter" id="badge-${item.id}">${savedCount}</span>
            </button>
        </div>

        <div class="inline-tasbih" id="inline-tasbih-${item.id}" role="region" aria-label="Compteur de dhikr">
            <div class="tasbih-settings">
                <div class="setting-group" title="Objectif de récitation (Poids × 7 par défaut)">
                    <i class="fas fa-bullseye"></i>
                    <input type="number" id="input-target-${item.id}" data-id="${item.id}"
                           class="zikr-input" placeholder="Obj." value="${finalTarget}" min="0" aria-label="Objectif">
                </div>
                <div class="obj-subdiv" id="obj-subdiv-${item.id}"></div>
                <div class="setting-group" title="Nombre de séries">
                    <i class="fas fa-rotate"></i>
                    <input type="number" id="input-loop-${item.id}" data-id="${item.id}"
                           class="zikr-input" placeholder="Séries" value="${savedLoopMax}" min="0" aria-label="Nombre de séries">
                </div>
                <div class="loop-display" id="loop-display-${item.id}"
                     style="display:${savedLoopMax ? 'flex' : 'none'};align-items:center;gap:4px">
                    Série <span id="loop-current-${item.id}">${savedLoopCurrent}</span>/<span id="loop-max-${item.id}">${savedLoopMax || 0}</span>
                </div>
                <button class="reset-zikr-btn" aria-label="Réinitialiser le compteur">
                    <i class="fas fa-rotate-left"></i>
                </button>
            </div>

            <div class="inline-counter" id="counter-${item.id}" aria-live="polite" aria-atomic="true">
                ${savedCount.toString().padStart(2, '0')}
            </div>

            ${(() => {
                const loopsForGrand = parseInt(savedLoopMax) > 0 ? parseInt(savedLoopMax) : 1;
                const grand = (numericTarget || 0) * loopsForGrand;
                let total = (savedLoopCurrent * (numericTarget || 0)) + savedCount;
                if (grand > 0 && total > grand) total = grand;
                const pct = grand > 0 ? Math.min(100, (total / grand) * 100) : 0;
                return `
            <div class="tasbih-progress" id="progress-wrap-${item.id}"
                 style="margin:6px 0 4px;display:flex;flex-direction:column;gap:4px">
                <div style="display:flex;justify-content:space-between;font-size:.78rem;opacity:.85">
                    <span>Progression</span>
                    <span><strong id="progress-total-${item.id}">${total}</strong> / <span id="progress-grand-${item.id}">${grand}</span></span>
                </div>
                <div style="height:6px;border-radius:6px;background:var(--glass-border);overflow:hidden">
                    <div id="progress-fill-${item.id}"
                         style="height:100%;width:${pct}%;border-radius:6px;
                                background:linear-gradient(90deg,var(--accent),var(--accent-hover));
                                transition:width .3s ease"></div>
                </div>
            </div>`;
            })()}

            <div class="inline-bead-string" aria-hidden="true">
                <div class="inline-bead-line"></div>
                <div class="inline-beads-container" id="beads-container-${item.id}">
                    ${'<div class="inline-bead"></div>'.repeat(9)}
                </div>
            </div>

            <p class="tasbih-hint">Appuyez pour égrainer</p>
        </div>
    `;

    cardElement.classList.remove('skeleton-card');
}
// ── FAVORIS ───────────────────────────────────────────────────
export function toggleFavorite(id) {
    if (favorites.has(id)) {
        favorites.delete(id);
    } else {
        favorites.add(id);
    }
    localStorage.setItem('favorites', JSON.stringify([...favorites]));
    return favorites.has(id);
}

// ── MODAL ─────────────────────────────────────────────────────
function trapFocus(element) {
    const focusableEls = element.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableEls[0];
    const lastFocusable = focusableEls[focusableEls.length - 1];

    element.addEventListener('keydown', function(e) {
        const isTabPressed = e.key === 'Tab' || e.keyCode === 9;
        if (!isTabPressed) return;
        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                lastFocusable.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                firstFocusable.focus();
                e.preventDefault();
            }
        }
    });
}

export function initModal() {
    elements.modalClose.addEventListener('click', hideModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) hideModal();
    });
    elements.modalPlay.addEventListener('click', () => {
        if (currentModalItem) {
            playAudio(currentModalItem);
            showToast('🔊 Lecture en cours…');
        }
    });
    elements.modalFavBtn.addEventListener('click', () => {
        if (!currentModalItem) return;
        const isFav = toggleFavorite(currentModalItem.id);
        updateModalFavoriteButton(currentModalItem.id);
        showToast(isFav ? '⭐ Ajouté aux favoris' : '✕ Retiré des favoris');
        renderCards(currentData, elements.searchInput.value,
            elements.favoritesBtn.classList.contains('active'));
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.modal.hidden) hideModal();
    });

    // Piège le focus dans la modale dès l'ouverture
    trapFocus(elements.modal);
}

export function showModal(item) {
    if (!item) return;
    currentModalItem = item;
    elements.modalArabic.textContent   = implore(item.name);
    elements.modalTranslit.textContent = item.translit;

    // Badge numéro (toujours visible)
    if (item.number && item.number < 999) {
        elements.modalNumber.innerHTML = `<span class="stat-pill"><i class="fas fa-hashtag"></i><span>${item.number}</span> sur 99</span>`;
    } else {
        elements.modalNumber.innerHTML = '';
    }

    const meaningSection = elements.modalMeaning ? elements.modalMeaning.closest('.modal-section') : null;
    const footer = elements.modal.querySelector('.modal-footer');

    // — Sans abonnement : modale verrouillée (nom seul + invitation à s'abonner) —
    if (!accessGranted) {
        if (meaningSection) meaningSection.style.display = 'none';
        if (elements.modalBenefitSection) elements.modalBenefitSection.style.display = 'none';
        if (footer) footer.style.display = 'none';

        let lock = document.getElementById('modalLock');
        if (!lock) {
            lock = document.createElement('div');
            lock.id = 'modalLock';
            lock.className = 'modal-section';
            lock.style.cssText = 'text-align:center';
            elements.modal.querySelector('.modal-body').appendChild(lock);
        }
        lock.innerHTML = `
            <div style="font-size:2rem;margin:.4rem 0"><i class="fas fa-lock"></i></div>
            <div class="modal-text" style="margin-bottom:1rem">
                Le sens, le secret et les carrés magiques de ce nom sont réservés aux abonnés.
            </div>
            <button id="modalSubscribeBtn" class="btn btn-primary">
                <i class="fas fa-unlock"></i> S'abonner pour débloquer
            </button>`;
        lock.style.display = '';
        lock.querySelector('#modalSubscribeBtn').addEventListener('click', () => {
            if (gateHandler) gateHandler(item);
        });

        elements.modal.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => elements.modalClose.focus());
        return;
    }

    // — Abonné : affichage complet —
    const lock = document.getElementById('modalLock');
    if (lock) lock.style.display = 'none';
    if (meaningSection) meaningSection.style.display = '';
    if (footer) footer.style.display = '';

    elements.modalMeaning.textContent = item.meaning;
    elements.modalBenefit.textContent = item.benefit || '';

    // Section bénéfice conditionnelle
    if (elements.modalBenefitSection) {
        elements.modalBenefitSection.style.display = item.benefit ? '' : 'none';
    }

    updateModalFavoriteButton(item.id);
    elements.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
        elements.modalClose.focus();
    });
}

function updateModalFavoriteButton(id) {
    const isFav = favorites.has(id);
    elements.modalFavBtn.innerHTML = isFav
        ? '<i class="fas fa-star"></i> Retirer des favoris'
        : '<i class="far fa-star"></i> Ajouter aux favoris';
    elements.modalFavBtn.classList.toggle('is-fav', isFav);
}

export function hideModal() {
    elements.modal.hidden = true;
    document.body.style.overflow = '';
    currentModalItem = null;
}
// ── SUGGESTIONS ───────────────────────────────────────────────
export function showSuggestions(term, data) {
    if (!term) { 
        elements.suggestionsBox.style.display = 'none'; 
        return; 
    }

    const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const suggestions = data
        .filter(item =>
            norm(item.translit).startsWith(norm(term)) ||
            norm(item.meaning).includes(norm(term))
        )
        .slice(0, 6);

    if (suggestions.length === 0) { 
        elements.suggestionsBox.style.display = 'none'; 
        return; 
    }

    elements.suggestionsBox.innerHTML = suggestions
        .map(item => `<div class="suggestion-item" data-id="${item.id}">${item.translit} – <small>${item.meaning}</small></div>`)
        .join('');
    elements.suggestionsBox.style.display = 'block';

    // Gestion du clic sur une suggestion
    elements.suggestionsBox.onclick = (e) => {
        const div = e.target.closest('.suggestion-item');
        if (div) {
            const selected = data.find(d => d.id === div.dataset.id);
            if (selected) {
                elements.searchInput.value = selected.translit;
                elements.suggestionsBox.style.display = 'none';
                showModal(selected);
                renderCards(currentData, selected.translit, elements.favoritesBtn.classList.contains('active'));
            }
        }
    };
}

// ── STATE ACCESSORS ───────────────────────────────────────────
export function setCurrentData(data) { currentData = data; }
export function getCurrentData() { return currentData; }

export function toggleView() { /* vue grille uniquement — désactivé */ }