'use client';
// lib/notifSound.js — Bip sonore court pour un événement en direct (nouveau
// message de discussion, app/zikr/page.tsx) — demandé explicitement (« les
// discussions... doivent créer un bip sonore au niveau des membres »).
//
// Un simple bip WebAudio généré à la volée plutôt qu'un fichier audio : pas
// de requête réseau ni d'asset à embarquer, fonctionne même hors-ligne,
// aucun souci de licence. Couvre le cas où l'ONGLET EST OUVERT (la
// discussion est sondée activement, voir loadMessages) — l'app en arrière-
// plan ou fermée est couverte séparément par la notification push serveur
// (pages/api/zikr.js notifyNewMessage), qui a son propre son (système).
//
// Une seule instance d'AudioContext, réutilisée : en créer une par bip finit
// par heurter la limite du navigateur sur le nombre de contextes simultanés.
let ctx = null;

export function playNotificationBeep() {
  try {
    // @ts-ignore -- webkitAudioContext : repli Safari/iOS, absent des types DOM standards
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    // Un AudioContext démarre parfois "suspended" tant qu'aucune interaction
    // utilisateur n'a eu lieu sur la page — resume() est un no-op sinon.
    ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    // Enveloppe courte (attaque quasi immédiate, extinction douce) — un vrai
    // "ding" plutôt qu'un clic sec ou un bourdonnement qui traîne.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Best-effort — un bip raté ne doit jamais faire échouer l'affichage du message.
  }
}
