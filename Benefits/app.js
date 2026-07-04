// app.js — v2.1
import { loadNames } from './firebase.js';
import {
    elements, applyTheme, showSkeletons, renderCards,
    setCurrentData, getCurrentData, toggleView,
    showSuggestions, initModal, initScrollButtons, showToast,
    setAccessGranted, setGateHandler
} from './domManager.js';
import { resolveAccess, getCachedAccess, confirmReturn, showBenefitsGate } from './access.js';

// ── SERVICE WORKER ────────────────────────────────────────────
// Géré GLOBALEMENT par /pwa.js (SW racine /sw.js, scope "/").
// L'ancien SW local /Benefits/sw.js est désenregistré par pwa.js.

// ── INITIALISATION ────────────────────────────────────────────
async function init() {


    // Thème
    applyTheme(localStorage.getItem('theme') || 'dark');

    elements.themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    // Vue
    elements.viewToggle.addEventListener('click', toggleView);

    // Favoris
    elements.favoritesBtn.addEventListener('click', () => {
        const isActive = elements.favoritesBtn.classList.toggle('active');
        renderCards(getCurrentData(), elements.searchInput.value, isActive);
    });

    // Recherche — debounce léger pour de meilleures performances
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        const term = e.target.value;
        elements.clearBtn.hidden = !term;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            showSuggestions(term, getCurrentData());
            renderCards(getCurrentData(), term, elements.favoritesBtn.classList.contains('active'));
        }, 80);
    });

    elements.clearBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.clearBtn.hidden   = true;
        elements.suggestionsBox.style.display = 'none';
        elements.searchInput.focus();
        renderCards(getCurrentData(), '', elements.favoritesBtn.classList.contains('active'));
    });

    // Fermer suggestions en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            elements.suggestionsBox.style.display = 'none';
        }
    });

    initModal();
    initScrollButtons();
    setGateHandler(showBenefitsGate);
    showSkeletons(12);

    // Accès : on part de la valeur en cache (abonné hors-ligne) pour éviter un flash,
    // puis on vérifie côté Firebase et on rafraîchit si nécessaire.
    const cached = getCachedAccess();
    setAccessGranted(cached === true);

    // Retour de paiement (?token=...) : confirme AVANT de résoudre l'accès.
    const returned = await confirmReturn().catch(() => false);

    loadNames(
        (data) => {
            setCurrentData(data);
            renderCards(data, '', false);
        },
        (errorMsg) => {
            console.error('Chargement échoué :', errorMsg);
            showToast('⚠️ Données locales utilisées');
        }
    );

    // Vérification autoritaire de l'abonnement (asynchrone, non bloquante).
    resolveAccess().then(({ ok }) => {
        setAccessGranted(ok);
        renderCards(getCurrentData(), elements.searchInput.value,
            elements.favoritesBtn.classList.contains('active'));
        if (returned && ok) showToast('✅ Abonnement activé — contenu débloqué');
        else if (returned && !ok) showToast('⏳ Paiement en cours de validation…');
    }).catch(() => {});
}

init();

