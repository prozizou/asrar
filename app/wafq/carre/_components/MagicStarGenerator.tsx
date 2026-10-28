'use client';

import { useRef, useState } from 'react';
import { magicStar, magicStarText, MAGIC_STAR_LINES, type MagicStar } from '@/lib/magicStar';
import { formatNumeral, type NumeralSystem } from '@/lib/kanzouNumerals';
import MagicStarDiagram from './MagicStarDiagram';
import NumeralToggle from './NumeralToggle';

export default function MagicStarGenerator() {
  const [input, setInput] = useState('38');
  const [numerals, setNumerals] = useState<NumeralSystem>('latin');
  const [feedback, setFeedback] = useState('');
  const svg = useRef<SVGSVGElement>(null);
  let star: MagicStar | null = null;
  let error = '';
  try {
    if (!/^\d+$/.test(input.trim())) throw new Error('Saisissez un entier positif, sans décimales.');
    star = magicStar(Number(input));
  } catch (cause) { error = (cause as Error).message; }

  async function copy() {
    if (!star) return;
    try { await navigator.clipboard.writeText(magicStarText(star)); setFeedback('copied'); }
    catch { setFeedback('manual'); }
  }

  function download() {
    if (!svg.current || !star) return;
    try {
      const clone = svg.current.cloneNode(true) as SVGSVGElement;
      clone.removeAttribute('style');
      clone.setAttribute('style', '--star-surface:#fff;--star-ink:#151515;--star-value:#c1121f');
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `etoile-magique-${star.constant}.svg`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback('downloaded');
    } catch { setFeedback('export-error'); }
  }

  return (
    <section aria-label="Générateur d’étoile magique">
      <div className="kz-fields">
        <label className="kz-field" htmlFor="magic-star-constant"><span>Constante magique S</span></label>
        <input className="kz-star-input" id="magic-star-constant" type="text" inputMode="numeric" maxLength={32}
          value={input} aria-invalid={!!error} aria-describedby="magic-star-help magic-star-error"
          onChange={(e) => { setInput(e.target.value); setFeedback(''); }} />
        <p id="magic-star-help" className="kz-method-hint">Entier de 38 à 9 007 199 254 740 991. L’étoile se met à jour à chaque saisie.</p>
        <p id="magic-star-error" role={error ? 'alert' : undefined} className="kz-error">{error}</p>
      </div>
      {star && <>
        <div className="kz-result-toolbar">
          <NumeralToggle value={numerals} onChange={setNumerals} />
          <button type="button" className="kz-export-btn" onClick={copy}>Copier les valeurs</button>
          <button type="button" className="kz-export-btn" onClick={download}>Exporter l’étoile (SVG)</button>
        </div>
        {feedback === 'copied' && <p role="status">Valeurs et six alignements copiés.</p>}
        {feedback === 'downloaded' && <p role="status">Étoile exportée au format SVG.</p>}
        {feedback === 'export-error' && <p role="alert" className="kz-error">L’export a échoué. Vous pouvez copier les valeurs.</p>}
        {feedback === 'manual' && <div className="kz-note"><p role="alert">La copie automatique est indisponible. Sélectionnez le texte ci-dessous.</p>
          <textarea aria-label="Étoile à copier manuellement" readOnly rows={8} value={magicStarText(star)} onFocus={(e) => e.target.select()} />
        </div>}
        <div className="kz-star-scroll" tabIndex={0} role="region" aria-label="Diagramme de l’étoile magique">
          <MagicStarDiagram ref={svg} star={star} numerals={numerals} />
        </div>
        <section className="kz-star-checks" aria-labelledby="magic-star-checks-title">
          <h2 id="magic-star-checks-title">Six alignements vérifiés</h2>
          <p className="kz-method-hint" role="status">18 entiers positifs distincts · 6 sommes égales à {star.constant}.</p>
          <ol>{MAGIC_STAR_LINES.map((line, i) => <li key={i}>
            <span className="kz-method-hint">Cases {line.join(' · ')}</span>
            <span>{line.map((index) => formatNumeral(star.values[index - 1], numerals)).join(' + ')} = <strong>{formatNumeral(star.sums[i], numerals)}</strong> ✓</span>
          </li>)}</ol>
        </section>
      </>}
    </section>
  );
}
