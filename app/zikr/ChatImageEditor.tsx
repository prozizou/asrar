'use client';
import { useEffect, useRef, useState } from 'react';
import ModalUntyped from '@/components/Modal';
import { CHAT_MESSAGE_MAX } from '@/lib/zikrLogic';
const Modal = ModalUntyped as any;

type Props = { file: File; caption?: string; onClose: () => void; onSave: (file: File, caption: string) => Promise<void> };
export default function ChatImageEditor({ file, caption = '', onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [ratio, setRatio] = useState('original');
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50); const [y, setY] = useState(50);
  const [brightness, setBrightness] = useState(100);
  const [annotation, setAnnotation] = useState('');
  const [text, setText] = useState(caption);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setError('Cette image ne peut pas être modifiée. Choisissez un fichier JPEG, PNG ou WebP.');
    img.src = url;
    return () => { img.onload = null; img.onerror = null; URL.revokeObjectURL(url); };
  }, [file]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const w = Math.max(1, Math.round(image.naturalWidth * scale));
    const h = Math.max(1, Math.round(image.naturalHeight * scale));
    const rotated = document.createElement('canvas');
    rotated.width = rotation % 180 ? h : w; rotated.height = rotation % 180 ? w : h;
    const source = rotated.getContext('2d'); if (!source) return;
    source.fillStyle = '#fff'; source.fillRect(0, 0, rotated.width, rotated.height);
    source.translate(rotated.width / 2, rotated.height / 2); source.rotate(rotation * Math.PI / 180);
    source.filter = `brightness(${brightness}%)`; source.drawImage(image, -w / 2, -h / 2, w, h);
    const aspect = ratio === 'square' ? 1 : ratio === 'landscape' ? 4 / 3 : rotated.width / rotated.height;
    let cw = rotated.width, ch = cw / aspect;
    if (ch > rotated.height) { ch = rotated.height; cw = ch * aspect; }
    cw /= zoom; ch /= zoom;
    canvas.width = Math.max(1, Math.round(cw)); canvas.height = Math.max(1, Math.round(ch));
    const context = canvas.getContext('2d'); if (!context) return;
    context.drawImage(rotated, (rotated.width - cw) * x / 100, (rotated.height - ch) * y / 100, cw, ch, 0, 0, canvas.width, canvas.height);
    if (annotation.trim()) {
      const size = Math.max(12, Math.min(48, canvas.width / 18));
      context.font = `600 ${size}px sans-serif`; context.textAlign = 'center';
      const lines: string[] = []; let line = '';
      for (const word of annotation.trim().split(/\s+/)) {
        if (line && context.measureText(line + ' ' + word).width > canvas.width * .88) { lines.push(line); line = word; }
        else line += (line ? ' ' : '') + word;
      }
      if (line) lines.push(line);
      const height = Math.min(canvas.height, lines.length * size * 1.3 + 20);
      context.fillStyle = 'rgba(0,0,0,.65)'; context.fillRect(0, canvas.height - height, canvas.width, height);
      context.fillStyle = '#fff';
      lines.forEach((value, index) => context.fillText(value, canvas.width / 2, canvas.height - height + size * (index + 1) * 1.3, canvas.width * .9));
    }
  }, [image, rotation, ratio, zoom, x, y, brightness, annotation]);
  const save = async () => {
    setBusy(true); setError('');
    try {
      const canvas = canvasRef.current; if (!canvas || !image) throw new Error('Image indisponible.');
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Impossible de préparer cette image.')), 'image/jpeg', .92));
      await onSave(new File([blob], 'zikr-image.jpg', { type: 'image/jpeg' }), text.trim());
    } catch (e: any) { setError(e.message || 'L’image n’a pas pu être envoyée. Vos modifications sont conservées.'); }
    finally { setBusy(false); }
  };
  return <Modal className="zk-messenger-overlay" label="Modifier l’image" onClose={() => { if (!busy) onClose(); }}>
    <div className="zk-media-dialog zk-image-editor">
      <h2>Préparer l’image</h2>
      <canvas ref={canvasRef} aria-label="Aperçu de l’image modifiée" />
      <div className="zk-editor-tools">
        <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} disabled={busy}>Pivoter ↻</button>
        <label>Recadrage<select value={ratio} onChange={(e) => setRatio(e.target.value)} disabled={busy}>
          <option value="original">Original</option><option value="square">Carré</option><option value="landscape">4:3</option>
        </select></label>
      </div>
      <details><summary>Ajuster l’image</summary>
        <label>Zoom<input aria-label="Zoom de recadrage" type="range" min="1" max="3" step=".1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
        <label>Position horizontale<input type="range" min="0" max="100" value={x} onChange={(e) => setX(Number(e.target.value))} /></label>
        <label>Position verticale<input type="range" min="0" max="100" value={y} onChange={(e) => setY(Number(e.target.value))} /></label>
        <label>Luminosité<input type="range" min="50" max="150" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} /></label>
        <label>Texte sur l’image<input maxLength={100} value={annotation} onChange={(e) => setAnnotation(e.target.value)} /></label>
      </details>
      <label>Légende<textarea maxLength={CHAT_MESSAGE_MAX} value={text} onChange={(e) => setText(e.target.value)} /></label>
      {error && <p role="alert" className="zk-error">{error}</p>}
      <div className="zk-editor-tools"><button type="button" onClick={onClose} disabled={busy}>Annuler</button>
        <button type="button" className="zk-btn main" onClick={save} disabled={!image || busy}>{busy ? 'Envoi…' : 'Envoyer l’image'}</button></div>
    </div>
  </Modal>;
}
