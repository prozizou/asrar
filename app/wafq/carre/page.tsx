"use client";
import './carre.css';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';

const SIZES = Array.from({ length: 9 }, (_, index) => index + 3);

export default function CarreIndexPage() {
  return (
    <div className="container hatim-page">
      <header className="hatim-header">
        <div className="hatim-topbar">
          <Link href="/menu" className="hatim-icon-btn" aria-label="Retour au menu"><ArrowLeft size={20} aria-hidden="true" /></Link>
        </div>
        <p className="hatim-eyebrow">Hatims</p>
        <h1 className="hatim-title">Carrés numériques</h1>
      </header>
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
    </div>
  );
}
