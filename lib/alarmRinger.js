'use client';
// lib/alarmRinger.js — Sonnerie d'alarme DANS LA PAGE (navigateur/PWA).
//
// Une notification push ne fait que « tinter » une fois (le système garde la
// main sur le son). Pour qu'une alarme d'heure planétaire SONNE VRAIMENT au
// début de l'heure quand /planete est ouverte, on génère ici une sonnerie
// en boucle (Web Audio, aucun fichier audio à fournir) + vibration, jusqu'à
// ce que l'utilisateur l'arrête (ou RING_MAX_MS).
//
// Contrainte navigateur : un AudioContext ne peut produire de son qu'après un
// geste de l'utilisateur. unlockAlarmAudio() est donc appelée au clic sur
// l'horloge d'une ligne (et au premier tap sur la page) pour « déverrouiller »
// l'audio à l'avance. Sans ce déverrouillage (page rechargée sans aucun
// tap), la sonnerie peut rester muette : la page affiche alors quand même
// l'écran d'alarme, et la notification push prend le relais.

const RING_MAX_MS = 60_000;
// Motif « réveil » : 4 bips rapides puis une pause, répété chaque seconde.
const BEEPS = [0, 0.13, 0.26, 0.39];
const BEEP_S = 0.09;
const VIBRATE_PATTERN = [400, 200, 400, 200, 400, 800];

let ctx = null;
let loopTimer = null;
let stopTimer = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  return ctx;
}

/** À appeler dans un gestionnaire de geste utilisateur (clic/tap). */
export function unlockAlarmAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function playBurst(c) {
  const t = c.currentTime + 0.02;
  for (const off of BEEPS) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t + off);
    gain.gain.exponentialRampToValueAtTime(0.25, t + off + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + off + BEEP_S);
    osc.connect(gain).connect(c.destination);
    osc.start(t + off);
    osc.stop(t + off + BEEP_S + 0.02);
  }
}

export function isAlarmRinging() {
  return loopTimer != null;
}

/**
 * Lance la sonnerie en boucle (idempotent). S'arrête seule après RING_MAX_MS.
 * @param {() => void} [onAutoStop] appelé si l'arrêt vient du délai maximal.
 */
export function startAlarmRing(onAutoStop) {
  if (loopTimer != null) return;
  const c = getCtx();
  const tick = () => {
    if (c) {
      if (c.state === 'suspended') c.resume().catch(() => {});
      try { playBurst(c); } catch {}
    }
    try { navigator.vibrate && navigator.vibrate(VIBRATE_PATTERN); } catch {}
  };
  tick();
  loopTimer = setInterval(tick, 1000);
  stopTimer = setTimeout(() => {
    stopAlarmRing();
    if (onAutoStop) onAutoStop();
  }, RING_MAX_MS);
}

export function stopAlarmRing() {
  if (loopTimer != null) clearInterval(loopTimer);
  if (stopTimer != null) clearTimeout(stopTimer);
  loopTimer = null;
  stopTimer = null;
  try { navigator.vibrate && navigator.vibrate(0); } catch {}
}
