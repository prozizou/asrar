// tasbihLogic.js
import { playBeadSound, playGoalSound } from './audio.js';

export function handleTasbihAction(card, id) {
    const counterDisplay = card.querySelector(`#counter-${id}`);
    const badgeDisplay = card.querySelector(`#badge-${id}`);
    const beadsContainer = card.querySelector(`#beads-container-${id}`);
    const targetInput = card.querySelector(`#input-target-${id}`);
    
    let currentCount = parseInt(localStorage.getItem(`tasbih_asma_${id}`)) || 0;
    currentCount++;

    const grand       = parseInt(targetInput.value) || 0;                          // objectif = total (ex. 257)
    const seriesCount = parseInt(localStorage.getItem(`tasbih_loopmax_${id}`)) || 0; // nombre de séries (ex. 5)
    const base        = seriesCount > 0 ? Math.floor(grand / seriesCount) : 0;      // ex. 51
    const remainder   = seriesCount > 0 ? grand - base * seriesCount : 0;           // ex. 2
    let loopsCur      = parseInt(localStorage.getItem(`tasbih_loopcur_${id}`)) || 0; // séries terminées

    // Seuil de la série en cours : les 1ères font `base`, la dernière fait base + reste.
    const isLastSeries = loopsCur === seriesCount - 1;
    const threshold    = isLastSeries ? base + remainder : base;

    let goalDone = false;

    if (seriesCount > 0) {
        if (currentCount === threshold) {
            loopsCur++;
            localStorage.setItem(`tasbih_loopcur_${id}`, loopsCur);
            const lc = card.querySelector(`#loop-current-${id}`);
            if (lc) lc.textContent = loopsCur;
            if (loopsCur >= seriesCount) {
                goalDone = true;                 // objectif total atteint
            } else {
                currentCount = 0;                // série suivante
                playGoalSound();                 // fin de série
                if(window.navigator.vibrate) window.navigator.vibrate([60, 40, 120]);
            }
        }
    } else if (grand > 0 && currentCount === grand) {
        goalDone = true;                         // mode simple sans séries
    }

    if (goalDone) {
        playGoalSound();
        if(window.navigator.vibrate) window.navigator.vibrate([100, 50, 100, 50, 200]);
        card.classList.add('goal-reached');
        setTimeout(() => card.classList.remove('goal-reached'), 1000);
    } else if (currentCount !== 0) {
        if(window.navigator.vibrate) window.navigator.vibrate([18, 12, 24]);
        playBeadSound();
    }
    
    // Mise à jour visuelle et sauvegarde
    localStorage.setItem(`tasbih_asma_${id}`, currentCount);
    counterDisplay.textContent = currentCount.toString().padStart(2, '0');
    badgeDisplay.textContent = currentCount;

    updateProgress(card, id);
    scrollBead(beadsContainer);
}

// Progression cumulée temps réel : (séries terminées × objectif) + série en cours.
// Ex. objectif 298, 7 séries → total 2086. Le cap évite le double comptage
// de la dernière série (où le compteur reste à 298 sans repartir à zéro).
export function updateProgress(card, id) {
    if (!card) return;
    const grand       = parseInt(card.querySelector(`#input-target-${id}`)?.value) || 0; // objectif = total
    const seriesCount = parseInt(localStorage.getItem(`tasbih_loopmax_${id}`)) || 0;      // nombre de séries
    const loopsCur    = parseInt(localStorage.getItem(`tasbih_loopcur_${id}`)) || 0;
    const count       = parseInt(localStorage.getItem(`tasbih_asma_${id}`)) || 0;
    const base        = seriesCount > 0 ? Math.floor(grand / seriesCount) : 0;

    let total = base * loopsCur + count;
    if (grand > 0 && total > grand) total = grand;
    const pct = grand > 0 ? Math.min(100, (total / grand) * 100) : 0;

    const totalEl = card.querySelector(`#progress-total-${id}`);
    const grandEl = card.querySelector(`#progress-grand-${id}`);
    const fillEl  = card.querySelector(`#progress-fill-${id}`);
    if (totalEl) totalEl.textContent = total;
    if (grandEl) grandEl.textContent = grand;
    if (fillEl)  fillEl.style.width = pct + '%';
}

// Défilement fluide d'un grain : on décale d'exactement une largeur de grain
// (mesurée dynamiquement), puis on recycle le premier grain sans à-coup.
function scrollBead(beadsContainer) {
    const first = beadsContainer.firstElementChild;
    if (!first) return;

    // Largeur d'un grain + espacement réel de la grille/flex.
    const style = getComputedStyle(beadsContainer);
    const gap = parseFloat(style.columnGap || style.gap || '0') || 0;
    const shift = first.getBoundingClientRect().width + gap;

    beadsContainer.style.transition = 'transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)';
    beadsContainer.style.transform = `translateX(-${shift}px)`;

    const onEnd = () => {
        beadsContainer.removeEventListener('transitionend', onEnd);
        beadsContainer.style.transition = 'none';
        beadsContainer.style.transform = 'translateX(0)';
        beadsContainer.appendChild(first);          // recyclage du premier grain
        void beadsContainer.offsetWidth;            // force le reflow → pas de saut
    };
    beadsContainer.addEventListener('transitionend', onEnd);
}

export function resetTasbih(card, id) {
    localStorage.setItem(`tasbih_asma_${id}`, 0);
    localStorage.setItem(`tasbih_loopcur_${id}`, 0);
    card.querySelector(`#counter-${id}`).textContent = '00';
    card.querySelector(`#badge-${id}`).textContent = '0';
    const loopCurrent = card.querySelector(`#loop-current-${id}`);
    if(loopCurrent) loopCurrent.textContent = '0';
    updateProgress(card, id);
}

export function updateTasbihSettings(input, id, val) {
    const card = input.closest('.glass-card');
    if (input.id.startsWith('input-target-')) {
        localStorage.setItem(`tasbih_target_${id}`, val);
    } else if (input.id.startsWith('input-loop-')) {
        localStorage.setItem(`tasbih_loopmax_${id}`, val);
        if (!(val && parseInt(val) > 0)) {
            localStorage.setItem(`tasbih_loopcur_${id}`, 0);
            const lc = card.querySelector(`#loop-current-${id}`);
            if (lc) lc.textContent = '0';
        }
    }
    // Recalcule « Série X / Y » : Y = objectif ÷ valeur par série (ex. 9205 ÷ 1315 = 7).
    refreshSeriesDisplay(card, id);
    updateProgress(card, id);
}

function refreshSeriesDisplay(card, id) {
    const grand       = parseInt(card.querySelector(`#input-target-${id}`)?.value) || 0;
    const seriesCount = parseInt(localStorage.getItem(`tasbih_loopmax_${id}`)) || 0;
    const display     = card.querySelector(`#loop-display-${id}`);
    const maxSpan     = card.querySelector(`#loop-max-${id}`);
    if (!display) return;
    if (seriesCount > 0 && grand > 0) {
        display.style.display = 'flex';
        if (maxSpan) maxSpan.textContent = seriesCount;
    } else {
        display.style.display = 'none';
    }
}

