'use client';

import { useRef, useState } from 'react';
import { magicStar, magicStarText, type MagicStar } from '@/lib/magicStar';
import { magicStarImage } from '@/lib/magicStarExport';
import { formatNumeral, type NumeralSystem } from '@/lib/kanzouNumerals';
import MagicStarDiagram from './MagicStarDiagram';
import FivePointStarDiagram from './FivePointStarDiagram';
import { fivePointStar, type FivePointStar } from '@/lib/fivePointStar';
import { fivePointStar15, type FivePointStar15 } from '@/lib/fivePointStar15';

export default function MagicStarGenerator({ fiveBranches = false }: { fiveBranches?: boolean }) {
  const [input, setInput] = useState('');
  const [numerals, setNumerals] = useState<NumeralSystem>('latin');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState('15');
  const svg = useRef<SVGSVGElement>(null);
  const complete = fiveBranches && model === '15';
  const title = fiveBranches ? complete ? 'Étoile à 5 branches (15 cases)' : 'Étoile à 5 branches' : 'Étoile magique à 18 cases';
  const filename = fiveBranches ? complete ? 'etoile-5-branches-15-cases' : 'etoile-5-branches' : 'etoile-magique';
  const starText = (value: MagicStar | FivePointStar | FivePointStar15) => magicStarText(value, title, complete ? ['', '', '', '', '', 'Tour du milieu'] : []);
  let star: MagicStar | FivePointStar | FivePointStar15 | null = null;
  let error = '';
  if (input.trim()) {
    try {
      if (!/^\d+$/.test(input.trim())) throw new Error('Saisissez un entier positif, sans décimales.');
      star = fiveBranches ? complete ? fivePointStar15(Number(input)) : fivePointStar(Number(input)) : magicStar(Number(input));
    } catch (cause) { error = (cause as Error).message; }
  }

  async function copy() {
    if (!star) return;
    try { await navigator.clipboard.writeText(starText(star)); setFeedback('copied'); }
    catch { setFeedback('manual'); }
  }

  async function download(format: 'svg' | 'png') {
    if (!svg.current || !star || busy) return;
    setBusy(true); setFeedback('');
    try {
      const blob = await magicStarImage(svg.current, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${filename}-${star.constant}.${format}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback('downloaded');
    } catch { setFeedback('export-error'); }
    finally { setBusy(false); }
  }

  return (
    <section className="kz-star-generator" aria-label="Générateur d’étoile magique">
      {fiveBranches && <label className="kz-field">
        <span>Modèle de l’étoile</span>
        <select className="kz-star-input" value={model} onChange={(e) => { setModel(e.target.value); setFeedback(''); }}>
          <option value="15">15 cases — nombres pairs et impairs</option>
          <option value="10">10 cases — modèle original</option>
        </select>
      </label>}
      <div className="kz-star-entry">
        <label className="kz-field" htmlFor="magic-star-constant"><span>Constante magique</span></label>
        <div className="kz-star-entry-row">
          <input className="kz-star-input" id="magic-star-constant" type="text" inputMode="numeric" maxLength={32}
            placeholder={fiveBranches ? complete ? "Exemple : 903" : "Exemple : 24" : "Entrer le nombre"} value={input} aria-invalid={!!error} aria-describedby={error ? 'magic-star-error' : undefined}
            onChange={(e) => { setInput(e.target.value); setFeedback(''); }} />
          <select className="kz-star-input" aria-label="Chiffres" value={numerals} onChange={(e) => setNumerals(e.target.value as NumeralSystem)}>
            <option value="latin">123</option><option value="eastern">۱۲۳</option>
          </select>
        </div>
        {error && <p id="magic-star-error" role="alert" className="kz-error">{error}</p>}
      </div>
      {fiveBranches && <p className="kz-note">{complete
        ? 'Constante entière à partir de 38, paire ou impaire. Les cinq lignes et le tour du milieu ont la même somme. Tous les nombres sont différents.'
        : 'Constante paire à partir de 24. Chaque ligne contient quatre nombres.'}</p>}
      <div className="kz-star-scroll" tabIndex={0} role="region" aria-label="Diagramme de l’étoile magique">
        {fiveBranches
          ? <FivePointStarDiagram ref={svg} star={star} numerals={numerals} complete={complete} />
          : <MagicStarDiagram ref={svg} star={star as MagicStar | null} numerals={numerals} />}
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
        <textarea aria-label="Étoile à copier manuellement" readOnly rows={8} value={starText(star)} onFocus={(e) => e.target.select()} />
      </div>}
      {star && <details className="kz-star-checks">
        <summary>{star.lines.length} sommes vérifiées</summary>
        <ol>{star.lines.map((line, i) => <li key={i}>
          <span>{complete && i === 5 && 'Tour du milieu : '}{line.map((index) => formatNumeral(star.values[index - 1], numerals)).join(' + ')} = <strong>{formatNumeral(star.sums[i], numerals)}</strong></span>
        </li>)}</ol>
      </details>}
    </section>
  );
}
