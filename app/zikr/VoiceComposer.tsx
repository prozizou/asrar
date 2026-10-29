'use client';
import { useEffect, useRef, useState } from 'react';
import { Lock, Mic, Send, Trash2, Unlock } from 'lucide-react';
type Props = { show: boolean; voice: any; disabled: boolean; active: boolean; onStart: () => Promise<void>; maxSeconds: number };
export default function VoiceComposer({ show, voice, disabled, active, onStart, maxSeconds }: Props) {
  const [locked, setLocked] = useState(false);
  const current = useRef({ voice, onStart }); current.current = { voice, onStart };
  const gesture = useRef<{ x: number; y: number; pointer: number; hold: boolean; locked: boolean; finish: boolean; cancel: boolean } | null>(null);
  const cleanup = useRef<() => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { clearTimeout(timer.current); cleanup.current(); }, []);
  useEffect(() => {
    if (!active && voice.recording) voice.interrupt();
  }, [active, voice]);
  useEffect(() => {
    const pending = gesture.current;
    if (!voice.recording) return;
    if (pending?.cancel) voice.cancel();
    else if (pending?.finish && !pending.locked) voice.stop();
  }, [voice]);
  const start = () => {
    if (disabled) return;
    gesture.current = null; setLocked(true); void current.current.onStart();
  };
  const down = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return;
    cleanup.current(); clearTimeout(timer.current);
    const state = { x: event.clientX, y: event.clientY, pointer: event.pointerId, hold: false, locked: false, finish: false, cancel: false };
    gesture.current = state; setLocked(false);
    timer.current = setTimeout(() => { state.hold = true; void current.current.onStart(); }, 250);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== state.pointer) return;
      if (state.y - e.clientY > 48) { state.locked = true; setLocked(true); }
      if (state.x - e.clientX > 95) { state.cancel = true; current.current.voice.cancel(); }
    };
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== state.pointer) return;
      clearTimeout(timer.current); cleanup.current();
      if (e.type === 'pointercancel') { state.cancel = true; current.current.voice.cancel(); return; }
      if (state.cancel) return;
      if (!state.hold) { state.locked = true; setLocked(true); void current.current.onStart(); }
      else if (!state.locked) { state.finish = true; if (current.current.voice.recording) current.current.voice.stop(); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish);
    cleanup.current = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish); };
  };
  if (!show) return null;
  if (!voice.recording) return <button type="button" className="zk-chat-tool zk-record-trigger" disabled={disabled} aria-label="Enregistrer un vocal" onPointerDown={down}
    onClick={(event) => { if (event.detail === 0) start(); }}><Mic size={19} /></button>;
  const duration = (value: number) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  return <div className="zk-chat-input-row zk-voice-recording">
    <span className="zk-voice-dot" aria-hidden="true" /><span className="zk-voice-time">{duration(voice.seconds)} / {duration(maxSeconds)}</span>
    <span className="zk-voice-lock-label">{locked ? 'Verrouillé' : '↑ Verrouiller · ← Annuler'}</span>
    <button type="button" className="zk-chat-tool" aria-label={locked ? 'Enregistrement verrouillé' : 'Verrouiller l’enregistrement'} onClick={() => { if (gesture.current) gesture.current.locked = true; setLocked(true); }}>{locked ? <Lock size={18} /> : <Unlock size={18} />}</button>
    <button type="button" className="zk-chat-tool" aria-label="Annuler le vocal" onClick={voice.cancel}><Trash2 size={18} /></button>
    <button type="button" className="zk-chat-send" aria-label="Envoyer le vocal" onClick={voice.stop}><Send size={18} /></button>
  </div>;
}
