// tasbihLogic.js
import { playBeadSound, playGoalSound } from './audio.js';

export function handleTasbihAction(card, id) {
    const counterDisplay = card.querySelector(`#counter-${id}`);
    const badgeDisplay = card.querySelector(`#badge-${id}`);
    const beadsContainer = card.querySelector(`#beads-container-${id}`);
    const targetInput = card.querySelector(`#input-target-${id}`);
    
    let currentCount = parseInt(localStorage.getItem(`tasbih_asma_${id}`)) || 0;
    currentCount++;
    
    const target = parseInt(targetInput.value) || 0;
    const loopsMax = parseInt(localStorage.getItem(`tasbih_loopmax_${id}`)) || 0;
    let loopsCur = parseInt(localStorage.getItem(`tasbih_loopcur_${id}`)) || 0;

    // Vérification de l'objectif
    if (target > 0 && currentCount === target) {
        playGoalSound(); 
        if(window.navigator.vibrate) window.navigator.vibrate([100, 50, 100, 50, 200]); 
        card.classList.add('goal-reached'); 
        setTimeout(() => card.classList.remove('goal-reached'), 1000);

        if (loopsMax > 0) {
            loopsCur++;
            localStorage.setItem(`tasbih_loopcur_${id}`, loopsCur);
            card.querySelector(`#loop-current-${id}`).textContent = loopsCur;
            if (loopsCur < loopsMax) currentCount = 0; 
        }
    } else {
        // Double pulsation courte = ressenti « clic de grain » plus tactile.
        if(window.navigator.vibrate) window.navigator.vibrate([18, 12, 24]);
        playBeadSound(); 
    }
    
    // Mise à jour visuelle et sauvegarde
    localStorage.setItem(`tasbih_asma_${id}`, currentCount);
    counterDisplay.textContent = currentCount.toString().padStart(2, '0');
    badgeDisplay.textContent = currentCount;
    
    scrollBead(beadsContainer);
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
}

export function updateTasbihSettings(input, id, val) {
    if (input.id.startsWith('input-target-')) {
        localStorage.setItem(`tasbih_target_${id}`, val);
    } else if (input.id.startsWith('input-loop-')) {
        localStorage.setItem(`tasbih_loopmax_${id}`, val);
        const card = input.closest('.glass-card');
        const display = card.querySelector(`#loop-display-${id}`);
        const maxSpan = card.querySelector(`#loop-max-${id}`);
        
        if (val && parseInt(val) > 0) {
            display.style.display = 'block';
            maxSpan.textContent = val;
        } else {
            display.style.display = 'none';
            localStorage.setItem(`tasbih_loopcur_${id}`, 0);
            card.querySelector(`#loop-current-${id}`).textContent = '0';
        }
    }
}


