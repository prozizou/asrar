// audio.js — v2.0

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// Son BOIS d'un grain : impact bruité filtré (le « toc ») + corps résonant bas,
// sans harmoniques métalliques aiguës → timbre vibrant et boisé.
function synthBead(ctx) {
    const now = ctx.currentTime;

    // 1) Impact — court burst de bruit filtré (le « toc » du contact bois)
    const dur = 0.09;
    const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); // enveloppe décroissante
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;   // caractère « knock » médium (bois)
    bp.Q.value = 1.1;
    const ng = ctx.createGain();
    ng.gain.value = 0.9;
    noise.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
    noise.start(now); noise.stop(now + dur);

    // 2) Corps résonant — basse fréquence, décroissance rapide (résonance du bois)
    const body = ctx.createOscillator();
    const bg = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(220, now);
    body.frequency.exponentialRampToValueAtTime(120, now + 0.05);
    bg.gain.setValueAtTime(0.5, now);
    bg.gain.exponentialRampToValueAtTime(0.01, now + 0.10);
    body.connect(bg); bg.connect(ctx.destination);
    body.start(now); body.stop(now + 0.11);

    // 3) Grain léger (très court) pour la vivacité, sans brillance métallique
    const h = ctx.createOscillator();
    const hg = ctx.createGain();
    h.type = 'triangle';
    h.frequency.setValueAtTime(440, now);
    hg.gain.setValueAtTime(0.07, now);
    hg.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    h.connect(hg); hg.connect(ctx.destination);
    h.start(now); h.stop(now + 0.06);
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

