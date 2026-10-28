"use client";
import './carre.css';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';

const SIZES = Array.from({ length: 9 }, (_, index) => index + 3);

export default function CarreIndexPage() {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="container hatim-page">
      <header className="hatim-header">
        <div className="hatim-topbar">
          <Link href="/menu" className="hatim-icon-btn" aria-label="Retour au menu"><ArrowLeft size={20} aria-hidden="true" /></Link>
          <button type="button" className="hatim-help-btn" aria-expanded={helpOpen} aria-controls="hatim-help" onClick={() => setHelpOpen((value) => !value)}>
            <BookOpen size={18} aria-hidden="true" /> Aide
          </button>
        </div>
        <p className="hatim-eyebrow">Hatims</p>
        <h1 className="hatim-title">Carrés numériques</h1>
        <p className="hatim-instructions">Choisissez la taille de votre carré.</p>
      </header>
      {helpOpen && <div id="hatim-help" className="kz-note hatim-help-panel">
        Ouvrez une taille, choisissez une méthode lorsqu’elle est proposée, puis renseignez vos valeurs de départ. Le calcul nécessite un accès Premium.
      </div>}
      <nav className="hatim-doors" aria-label="Choisir une taille de carré">
        {SIZES.map((size) => (
          <Link key={size} href={`/wafq/carre/${size}`} className="hatim-door" aria-label={`Carré ${size} × ${size}, ${size * size} cases`}>
            <span className="hatim-thumb" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }} aria-hidden="true">
              {Array.from({ length: size * size }, (_, index) => <span key={index} className="hatim-thumb-cell" />)}
            </span>
            <span className="hatim-door-copy"><span className="hatim-door-size">{size} × {size}</span><span className="hatim-door-caption">{size * size} cases</span></span>
            <ChevronRight className="hatim-door-chevron" size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <p className="hatim-footer">9 tailles disponibles <span aria-hidden="true">·</span> Accès Premium pour calculer</p>
    </div>
  );
}
