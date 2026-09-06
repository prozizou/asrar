'use client';
// components/AudioMessage.js — Lecteur audio personnalisé pour un vocal de
// la discussion d'un zikr collectif (app/zikr/page.tsx) — demandé
// explicitement (« le lecteur gris casse complètement le design violet »).
// Un <audio> natif reste le moteur de lecture (caché), mais toute l'UI
// (bouton lecture/pause, barre de progression, temps) est la nôtre —
// intégrée à la bulle plutôt que le widget système.
import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

function fmtTime(s) {
  const n = Number.isFinite(s) && s > 0 ? s : 0;
  const m = Math.floor(n / 60);
  const sec = Math.floor(n % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function AudioMessage({ src, duration }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  // `duration` (mediaDuration, envoyé par l'enregistreur — voir
  // components/useVoiceRecorder.js) sert de repli tant que les métadonnées
  // réelles du fichier ne sont pas encore chargées (évite d'afficher "0:00").
  const [total, setTotal] = useState(duration || 0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onTime = () => setCurrent(el.currentTime);
    const onLoaded = () => { if (Number.isFinite(el.duration) && el.duration > 0) setTotal(el.duration); };
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().catch(() => {});
      setPlaying(true);
    }
  };

  // Tap n'importe où sur la barre pour aller à ce point — pas besoin d'un
  // vrai <input type="range"> (moins de contrôle sur l'apparence).
  const seek = (e) => {
    const el = audioRef.current;
    if (!el || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * total;
    setCurrent(el.currentTime);
  };

  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div className="zk-audio-player">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- vocal parlé, pas de piste de sous-titres à fournir */}
      <audio ref={audioRef} src={src} preload="metadata" />
      <button type="button" className="zk-audio-play" onClick={toggle} aria-label={playing ? 'Mettre en pause' : 'Écouter'}>
        {playing ? <Pause size={14} strokeWidth={2.5} aria-hidden="true" /> : <Play size={14} strokeWidth={2.5} aria-hidden="true" />}
      </button>
      <div className="zk-audio-bar" onClick={seek} role="presentation">
        <div className="zk-audio-bar-fill" style={{ width: pct + '%' }} />
      </div>
      <span className="zk-audio-time">{fmtTime(playing || current > 0 ? current : total)}</span>
    </div>
  );
}
