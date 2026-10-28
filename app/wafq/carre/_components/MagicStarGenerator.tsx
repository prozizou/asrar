'use client';

import { useRef, useState } from 'react';
import { magicStar, magicStarText, type MagicStar } from '@/lib/magicStar';
import { magicStarImage } from '@/lib/magicStarExport';
import { formatNumeral, type NumeralSystem } from '@/lib/kanzouNumerals';
import MagicStarDiagram from './MagicStarDiagram';

export default function MagicStarGenerator() {
  const [input, setInput] = useState('');
  const [numerals, setNumerals] = useState<NumeralSystem>('latin');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  let star: MagicStar | null = null;
  let error = '';
  if (input.trim()) {
    try {
      if (!/^\d+$/.test(input.trim())) throw new Error('Saisissez un entier positif, sans décimales.');
      star = magicStar(Number(input));
    } catch (cause) { error = (cause as Error).message; }
  }

  async function copy() {
    if (!star) return;
    try { await navigator.clipboard.writeText(magicStarText(star)); setFeedback('copied'); }
    catch { setFeedback('manual'); }
  }

  async function download(format: 'svg' | 'png') {
    if (!svg.current || !star || busy) return;
    setBusy(true); setFeedback('');
    try {
      const blob = await magicStarImage(svg.current, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `etoile-magique-${star.constant}.${format}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback('downloaded');
    } catch { setFeedback('export-error'); }
    finally { setBusy(false); }
  }

  return (
    <section className="kz-star-generator" aria-label="Générateur d’étoile magique">
      <div className="kz-star-entry">
        <label className="kz-field" htmlFor="magic-star-constant"><span>Constante magique</span></label>
        <div className="kz-star-entry-row">
          <input className="kz-star-input" id="magic-star-constant" type="text" inputMode="numeric" maxLength={32}
            placeholder="Entrer le nombre" value={input} aria-invalid={!!error} aria-describedby={error ? 'magic-star-error' : undefined}
            onChange={(e) => { setInput(e.target.value); setFeedback(''); }} />
          <select className="kz-star-input" aria-label="Chiffres" value={numerals} onChange={(e) => setNumerals(e.target.value as NumeralSystem)}>
            <option value="latin">123</option><option value="eastern">۱۲۳</option>
          </select>
        </div>
        {error && <p id="magic-star-error" role="alert" className="kz-error">{error}</p>}
      </div>
      <div className="kz-star-scroll" tabIndex={0} role="region" aria-label="Diagramme de l’étoile magique">
        <MagicStarDiagram ref={svg} star={star} numerals={numerals} />
      </div>
      <div className="kz-star-actions" aria-busy={busy}>
        <button type="button" className="kz-export-btn" disabled={!star || busy} onClick={copy}>Copier</button>
        <button type="button" className="kz-export-btn kz-star-png" aria-label="Exporter en PNG" disabled={!star || busy} onClick={() => download('png')}>PNG</button>
        <button type="button" className="kz-export-btn" aria-label="Exporter en SVG" disabled={!star || busy} onClick={() => download('svg')}>SVG</button>
      </div>
      {feedback === 'copied' && <p role="status">Valeurs copiées.</p>}
      {feedback === 'downloaded' && <p role="status">Étoile exportée.</p>}
      {feedback === 'export-error' && <p role="alert" className="kz-error">L’export a échoué. Réessayez.</p>}
      {star && feedback === 'manual' && <div className="kz-note"><p role="alert">La copie automatique est indisponible. Sélectionnez le texte ci-dessous.</p>
        <textarea aria-label="Étoile à copier manuellement" readOnly rows={8} value={magicStarText(star)} onFocus={(e) => e.target.select()} />
      </div>}
      {star && <details className="kz-star-checks">
        <summary>7 sommes vérifiées</summary>
        <ol>{star.lines.map((line, i) => <li key={i}>
          <span>{line.map((index) => formatNumeral(star.values[index - 1], numerals)).join(' + ')} = <strong>{formatNumeral(star.sums[i], numerals)}</strong></span>
        </li>)}</ol>
      </details>}
    </section>
  );
}
