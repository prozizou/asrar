'use client';

import { useRef, useState } from 'react';
import { magicStar, magicStar57, magicStarText, type MagicStar } from '@/lib/magicStar';
import { formatNumeral, type NumeralSystem } from '@/lib/kanzouNumerals';
import MagicStarDiagram from './MagicStarDiagram';
import NumeralToggle from './NumeralToggle';

export default function MagicStarGenerator() {
  const [configuration, setConfiguration] = useState('seven');
  const [input, setInput] = useState('57');
  const [numerals, setNumerals] = useState<NumeralSystem>('latin');
  const [feedback, setFeedback] = useState('');
  const svg = useRef<SVGSVGElement>(null);
  let star: MagicStar | null = null;
  let error = '';
  try {
    if (!/^\d+$/.test(input.trim())) throw new Error('Saisissez un entier positif, sans décimales.');
    star = configuration === 'seven' ? magicStar57(Number(input)) : magicStar(Number(input));
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
        <label className="kz-field" htmlFor="magic-star-configuration"><span>Configuration de l’étoile</span></label>
        <select className="kz-star-input" id="magic-star-configuration" value={configuration}
          onChange={(e) => { setConfiguration(e.target.value); setInput(e.target.value === 'seven' ? '57' : '38'); setFeedback(''); }}>
          <option value="seven">7 alignements · S = 57</option>
          <option value="six">6 alignements · S au choix</option>
        </select>
        <label className="kz-field" htmlFor="magic-star-constant"><span>Constante magique S</span></label>
        <input className="kz-star-input" id="magic-star-constant" type="text" inputMode="numeric" maxLength={32}
          value={input} readOnly={configuration === 'seven'} aria-invalid={!!error} aria-describedby="magic-star-help magic-star-error"
          onChange={(e) => { setInput(e.target.value); setFeedback(''); }} />
        <p id="magic-star-help" className="kz-method-hint">{configuration === 'seven'
          ? 'Les nombres de 1 à 18 sont utilisés une seule fois. Cette configuration est définie pour S = 57.'
          : 'Entier de 38 à 9 007 199 254 740 991. L’étoile se met à jour à chaque saisie.'}</p>
        <p id="magic-star-error" role={error ? 'alert' : undefined} className="kz-error">{error}</p>
      </div>
      {star && <>
        <div className="kz-result-toolbar">
          <NumeralToggle value={numerals} onChange={setNumerals} />
          <button type="button" className="kz-export-btn" onClick={copy}>Copier les valeurs</button>
          <button type="button" className="kz-export-btn" onClick={download}>Exporter l’étoile (SVG)</button>
        </div>
        {feedback === 'copied' && <p role="status">Valeurs et {star.lines.length} alignements copiés.</p>}
        {feedback === 'downloaded' && <p role="status">Étoile exportée au format SVG.</p>}
        {feedback === 'export-error' && <p role="alert" className="kz-error">L’export a échoué. Vous pouvez copier les valeurs.</p>}
        {feedback === 'manual' && <div className="kz-note"><p role="alert">La copie automatique est indisponible. Sélectionnez le texte ci-dessous.</p>
          <textarea aria-label="Étoile à copier manuellement" readOnly rows={8} value={magicStarText(star)} onFocus={(e) => e.target.select()} />
        </div>}
        <div className="kz-star-scroll" tabIndex={0} role="region" aria-label="Diagramme de l’étoile magique">
          <MagicStarDiagram ref={svg} star={star} numerals={numerals} />
        </div>
        <section className="kz-star-checks" aria-labelledby="magic-star-checks-title">
          <h2 id="magic-star-checks-title">{star.lines.length} alignements vérifiés</h2>
          <p className="kz-method-hint" role="status">{star.usesOneToEighteen ? 'Nombres de 1 à 18 sans répétition' : '18 entiers positifs distincts'} · {star.sums.length} sommes égales à {star.constant}.</p>
          <ol>{star.lines.map((line, i) => <li key={i}>
            <span className="kz-method-hint">Cases {line.join(' · ')}</span>
            <span>{line.map((index) => formatNumeral(star.values[index - 1], numerals)).join(' + ')} = <strong>{formatNumeral(star.sums[i], numerals)}</strong> ✓</span>
          </li>)}</ol>
        </section>
      </>}
    </section>
  );
}
