'use client';
import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
function fmtTime(seconds) {
  const value = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}
export default function AudioMessage({ src, duration, onListened, waveform }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');
  useEffect(() => {
    setPlaying(false); setCurrent(0); setTotal(duration || 0); setError('');
  }, [src, duration]);
  useEffect(() => {
    const audio = audioRef.current;
    return () => { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } };
  }, [src]);
  const toggle = async () => {
    const el = audioRef.current; if (!el) return;
    if (!el.paused) { el.pause(); return; }
    setError('');
    try { el.playbackRate = speed; await el.play(); }
    catch { setPlaying(false); setError('Lecture impossible. Vérifiez votre connexion et réessayez.'); }
  };
  return <div className="zk-audio-wrapper">
    <div className="zk-audio-player">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Vocal sans transcription fournie. */}
      <audio ref={audioRef} src={src} preload="metadata"
        onPlay={(event) => {
          document.querySelectorAll('audio').forEach((audio) => { if (audio !== event.currentTarget) audio.pause(); });
          setPlaying(true);
        }} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { if (Number.isFinite(e.currentTarget.duration)) setTotal(e.currentTarget.duration); }}
        onEnded={() => { setPlaying(false); setCurrent(0); onListened?.(); }}
        onError={() => { setPlaying(false); setError('Ce vocal ne peut pas être lu pour le moment.'); }} />
      <button type="button" className="zk-audio-play" onClick={toggle} aria-label={playing ? 'Mettre en pause' : 'Écouter'}>
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </button>
      <div className="zk-audio-wave">
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">{(waveform?.length ? waveform : Array(32).fill(12)).map((level, index, levels) => {
          const height = Math.max(3, Math.min(30, level * .3));
          return <rect key={index} x={index * 100 / levels.length} y={(32 - height) / 2} width={Math.max(1, 70 / levels.length)} height={height} rx="1" fill={total > 0 && index / levels.length < current / total ? '#7450a3' : '#94909f'} />;
        })}</svg>
      <input className="zk-audio-seek" type="range" min="0" max={total || 1} step=".1" value={Math.min(current, total || 1)} aria-label="Position dans le vocal"
        onChange={(e) => { if (audioRef.current && total > 0) { audioRef.current.currentTime = Number(e.target.value); setCurrent(Number(e.target.value)); } }} />
      </div>
      <span className="zk-audio-time">{fmtTime(current > 0 ? current : total)}</span>
      <button type="button" className="zk-audio-speed" aria-label={`Vitesse du vocal : ${speed} fois`} onClick={() => {
        const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
        setSpeed(next); if (audioRef.current) audioRef.current.playbackRate = next;
      }}>{speed}×</button>
    </div>
    {error && <p role="alert" className="zk-audio-error">{error}</p>}
  </div>;
}
