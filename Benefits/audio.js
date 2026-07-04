// audio.js — v2.0

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// Fonction utilitaire pour générer le son du grain
function synthBead(ctx) {
    const now = ctx.currentTime;

    // Clic boisé
    const osc1 = ctx.createOscillator();
    const g1   = ctx.createGain();
    osc1.connect(g1);
    g1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(480, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.06);
    g1.gain.setValueAtTime(0.6, now);
    g1.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc1.start(now);
    osc1.stop(now + 0.07);

    // Résonance légère
    const osc2 = ctx.createOscillator();
    const g2   = ctx.createGain();
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(960, now);
    g2.gain.setValueAtTime(0.12, now);
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc2.start(now);
    osc2.stop(now + 0.15);
}

/**
 * Son doux d'un grain de chapelet (click + résonance)
 */
export function playBeadSound() {
    try {
        const ctx = getAudioCtx();
        // Gérer correctement la promesse de reprise
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => synthBead(ctx));
        } else {
            synthBead(ctx);
        }
    } catch(e) {
        // Silencieux si AudioContext non disponible
    }
}

/**
 * Mélodie de succès (objectif atteint) — accord ascendant
 */
export function playGoalSound() {
    try {
        const ctx  = getAudioCtx();
        
        const playMelody = () => {
            const notes = [523.25, 659.25, 783.99, 1046.5]; // Do, Mi, Sol, Do+
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const g   = ctx.createGain();
                osc.connect(g);
                g.connect(ctx.destination);
                osc.type = 'triangle';
                const t = ctx.currentTime + i * 0.10;
                osc.frequency.setValueAtTime(freq, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.35, t + 0.04);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
                osc.start(t);
                osc.stop(t + 0.48);
            });
        };

        if (ctx.state === 'suspended') {
            ctx.resume().then(() => playMelody());
        } else {
            playMelody();
        }
    } catch(e) {}
}

/**
 * Lecture de la prononciation arabe via Web Speech API
 */
export function playAudio(item) {
    if (!item?.name) return;
    try {
        const utterance  = new SpeechSynthesisUtterance(item.name);
        utterance.lang   = 'ar-SA';
        utterance.rate   = 0.85;
        utterance.pitch  = 1.0;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    } catch(e) {
        console.warn('SpeechSynthesis non disponible');
    }
}

export { getAudioCtx as initAudio };

