'use client';
// components/useVoiceRecorder.js — Enregistrement d'un message vocal
// (MediaRecorder) pour la discussion d'un zikr collectif (app/zikr/page.tsx)
// — demandé explicitement (« envoyer des audios »). Nécessite
// Permissions-Policy: microphone=(self) (next.config.mjs).
//
// N'UPLOADE RIEN ici : `onDone(blob, dureeSecondes)` renvoie juste
// l'enregistrement terminé, à l'appelant d'envoyer vers Cloudinary
// (lib/cloudinary.js uploadZikrChatMedia) puis d'enregistrer le message
// (lib/zikrCollectif.js sendMessage) — cette séparation garde ce hook
// indépendant du reste (pas de dépendance réseau ici).
import { useCallback, useRef, useState } from 'react';
import { CHAT_AUDIO_MAX_S } from '@/lib/zikrLogic';

export function useVoiceRecorder(onDone) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);

  const stopTracks = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    clearInterval(timerRef.current);
  };

  // Arrête PROPREMENT (déclenche onstop → upload+envoi via onDone).
  const stop = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  // Arrête SANS envoyer (l'utilisateur annule son vocal).
  const cancel = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec) {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
    }
    stopTracks();
    setRecording(false);
    setSeconds(0);
  }, []);

  const start = useCallback(async () => {
    if (recording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // rejette si refusé/indisponible
    streamRef.current = stream;
    chunksRef.current = [];
    const rec = new MediaRecorder(stream);
    mediaRecorderRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
      stopTracks();
      setRecording(false);
      setSeconds(0);
      if (duration > 0 && chunksRef.current.length > 0) {
        onDone(new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' }), duration);
      }
    };
    startedAtRef.current = Date.now();
    rec.start();
    setRecording(true);
    // Arrêt automatique à CHAT_AUDIO_MAX_S — un vocal reste un message court,
    // pas un enregistrement illimité (coût de stockage/lecture).
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= CHAT_AUDIO_MAX_S) stop();
        return next;
      });
    }, 1000);
  }, [recording, onDone, stop]);

  return { recording, seconds, start, stop, cancel };
}
