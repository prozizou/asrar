'use client';
// audio.js — v2.0

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// ── Préchauffage ─────────────────────────────────────────────────────────
// Retour utilisateur : latence perceptible sur le premier tap du Tasbih
// (et à chaque reprise après une pause) ainsi que sur le bouton d'écoute.
// Deux causes distinctes, toutes deux réglées en amont plutôt qu'au moment
// du tap :
//  1) AudioContext : créé paresseusement au premier tap, il démarre
//     `suspended` (politique autoplay des navigateurs) — `ctx.resume()` est
//     asynchrone et peut prendre plusieurs dizaines/centaines de ms. On le
//     crée et on le réactive dès la toute première interaction de la page
//     (pas forcément un tap de grain), et on le réactive aussi au retour au
//     premier plan (`visibilitychange`) — un onglet mis en arrière-plan
//     resuspend souvent son contexte, d'où une latence qui revient « parfois ».
//  2) SpeechSynthesis (bouton d'écoute) : le moteur TTS met du temps à
//     s'initialiser au tout premier `speak()` de la page (surtout sur
//     WebView Android) et la liste des voix se charge de façon asynchrone
//     (`voiceschanged`) — on force ce chargement tôt.
if (typeof window !== 'undefined') {
    const resumeIfSuspended = () => {
        try {
            const ctx = getAudioCtx();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        } catch (e) {
            /* AudioContext indisponible — silencieux */
        }
    };

    const onFirstInteraction = () => {
        resumeIfSuspended();
        ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((ev) =>
            document.removeEventListener(ev, onFirstInteraction)
        );
    };
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((ev) =>
        document.addEventListener(ev, onFirstInteraction, { passive: true })
    );

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resumeIfSuspended();
    });

    // Force le chargement (async sur Chrome) de la liste des voix.
    try {
        window.speechSynthesis?.getVoices();
        window.speechSynthesis?.addEventListener('voiceschanged', () => window.speechSynthesis.getVoices(), {
            once: true,
        });
    } catch (e) {
        /* Web Speech API indisponible — silencieux */
    }
}

// Son BOIS d'un grain : impact bruité filtré (le « toc ») + corps résonant bas,
// sans harmoniques métalliques aiguës → timbre vibrant et boisé.
function synthBead(ctx) {
    const now = ctx.currentTime;

    // Filtre passe-bas global : coupe toute brillance/métal, ne garde que le bois.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.7;
    lp.connect(ctx.destination);

    // 1) Impact — « toc » sec du contact bois : bruit court filtré bas.
    const dur = 0.05;
    const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4); // attaque nette, décroissance rapide
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 650;    // médium-bas = bois (au lieu de 1200)
    bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0.8;
    noise.connect(bp); bp.connect(ng); ng.connect(lp);
    noise.start(now); noise.stop(now + dur);

    // 2) Corps résonant — thump grave et boisé, décroissance rapide.
    const body = ctx.createOscillator();
    const bg = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(190, now);
    body.frequency.exponentialRampToValueAtTime(95, now + 0.06);
    bg.gain.setValueAtTime(0.6, now);
    bg.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    body.connect(bg); bg.connect(lp);
    body.start(now); body.stop(now + 0.13);

    // 3) Second harmonique très doux (corps du bois), pas de triangle brillant.
    const h = ctx.createOscillator();
    const hg = ctx.createGain();
    h.type = 'sine';
    h.frequency.setValueAtTime(285, now);
    hg.gain.setValueAtTime(0.12, now);
    hg.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
    h.connect(hg); hg.connect(lp);
    h.start(now); h.stop(now + 0.08);
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
        const synth = window.speechSynthesis;
        const utterance  = new SpeechSynthesisUtterance(item.name);
        utterance.lang   = 'ar-SA';
        utterance.rate   = 0.85;
        utterance.pitch  = 1.0;
        // cancel() n'est utile que si une lecture est déjà en cours ; l'appeler
        // à chaque clic, puis enchaîner speak() dans le même tick, est un bug
        // Chrome connu qui peut faire échouer silencieusement le speak() suivant
        // — un setTimeout(0) laisse cancel() se terminer avant de relancer.
        if (synth.speaking || synth.pending) {
            synth.cancel();
            setTimeout(() => synth.speak(utterance), 0);
        } else {
            synth.speak(utterance);
        }
    } catch(e) {
        console.warn('SpeechSynthesis non disponible');
    }
}

export { getAudioCtx as initAudio };

