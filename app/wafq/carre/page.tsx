'use client';
// « Hatims — Carrés numériques » — page d'accueil (neuf tailles, 3×3 à
// 11×11) — portée depuis prozizou/Kanzou app/page.tsx (voir lib/kanzouWafq.ts
// pour le contexte complet du portage). Accessible directement depuis /menu
// (tuile « Hatims »), et toujours aussi depuis le générateur par intention
// (app/wafq/page.tsx, section « Carrés numériques avancés ») — deux portes
// d'entrée vers le même moteur : ici, on choisit une TAILLE et on saisit des
// valeurs brutes selon la formule d'origine, plutôt qu'une intention
// traduite automatiquement en constante.
//
// Refonte visuelle (2026-09-22) : ambiance sombre/mystique dédiée (lanternes,
// silhouettes de mosquées, logo livre + croissant), grille 2 colonnes fixes,
// miniatures de grille générées dynamiquement (N×N spans) plutôt que des
// images statiques, halo violet néon au survol/focus d'une porte (cette page
// est une grille de liens de navigation, pas un formulaire à état : le
// survol/focus tient lieu d'aperçu de « sélection » façon maquette).
import './carre.css';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronLeft, BookOpen, ChevronRight, Check } from 'lucide-react';

const SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11];

// Bronze/doré vs bleu acier en alternance — purement décoratif (aucune
// portée fonctionnelle), pour varier les miniatures comme sur la maquette.
const DOOR_TONE: Record<number, 'bronze' | 'steel'> = {
  3: 'bronze', 4: 'steel', 5: 'bronze', 6: 'bronze', 7: 'steel',
  8: 'bronze', 9: 'bronze', 10: 'steel', 11: 'steel',
};

function DoorThumb({ size, tone }: { size: number; tone: 'bronze' | 'steel' }) {
  const cells = Array.from({ length: size * size });
  return (
    <div
      className={`hatim-thumb hatim-thumb-${tone}`}
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      aria-hidden="true"
    >
      {cells.map((_, i) => <span key={i} className="hatim-thumb-cell" />)}
    </div>
  );
}

function LanternIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="30" height="76" viewBox="0 0 30 76" fill="none" aria-hidden="true">
      <line x1="15" y1="0" x2="15" y2="14" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 14h18l-3.5 7h-11L6 14z" fill="currentColor" fillOpacity="0.35" />
      <path
        d="M9 21h12c1.7 0 3 1.8 3 4v16c0 6.5-4 11.5-9 11.5S6 47.5 6 41V25c0-2.2 1.3-4 3-4z"
        fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1"
      />
      <circle cx="15" cy="36" r="3.2" fill="currentColor" fillOpacity="0.6" />
      <path d="M10 52.5h10l-2.5 5h-5l-2.5-5z" fill="currentColor" fillOpacity="0.35" />
    </svg>
  );
}

function MosqueSkyline() {
  return (
    <svg className="hatim-decor-skyline" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
      {[40, 140, 260, 360].map((cx, i) => (
        <g key={cx} opacity={i % 2 === 0 ? 0.5 : 0.32}>
          <rect x={cx - 4} y={2} width="8" height="14" fill="currentColor" />
          <circle cx={cx} cy={2} r="4" fill="currentColor" />
          <path d={`M${cx - 26} 40 Q${cx - 26} 18 ${cx} 18 Q${cx + 26} 18 ${cx + 26} 40 Z`} fill="currentColor" />
          <rect x={cx - 34} y={40} width="68" height="20" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

export default function CarreIndexPage() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="container hatim-page" style={{ maxWidth: 720 }}>
      <div className="glass-panel kz-wrap hatim-panel">
        <LanternIcon className="hatim-decor-lantern hatim-decor-lantern-left" />
        <LanternIcon className="hatim-decor-lantern hatim-decor-lantern-right" />

        <div className="hatim-topbar">
          <Link href="/menu" className="hatim-icon-btn" aria-label="Retour">
            <ChevronLeft size={18} />
          </Link>
          <button
            type="button"
            className="hatim-icon-btn"
            aria-label="Règles et aide"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((v) => !v)}
          >
            <BookOpen size={18} />
          </button>
        </div>

        <div className="header hatim-hero">
          <svg className="hatim-logo" width="52" height="52" viewBox="0 0 56 56" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="hatimGoldGrad" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#f5d78e" />
                <stop offset="1" stopColor="#c9973f" />
              </linearGradient>
            </defs>
            <path d="M33 9a7.5 7.5 0 1 0 1.2 11.4A9 9 0 0 1 33 9z" fill="url(#hatimGoldGrad)" />
            <path d="M8 40c6-3 12-3 18 0V22c-6-3-12-3-18 0v18z" fill="none" stroke="url(#hatimGoldGrad)" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M44 40c-6-3-12-3-18 0V22c6-3 12-3 18 0v18z" fill="none" stroke="url(#hatimGoldGrad)" strokeWidth="1.6" strokeLinejoin="round" />
            <line x1="26" y1="23" x2="26" y2="39" stroke="url(#hatimGoldGrad)" strokeWidth="1.2" />
          </svg>
          <h1 className="hatim-title">Hatims – Carrés numériques</h1>
          <p className="hatim-subtitle">Neuf portes, neuf tailles de carré</p>
          <p className="hatim-instructions">Choisissez une taille pour renseigner vos valeurs de départ.</p>
        </div>

        {helpOpen && (
          <div className="kz-note hatim-help-panel">
            Chaque porte ouvre un carré numérique de la taille choisie — renseignez vos valeurs de départ selon la
            formule proposée, puis générez le carré. Les neuf tailles sont couvertes — chacune reprend fidèlement sa
            formule d’origine (app Android « Al Kanzou Pro »), sauf le 10×10 et le 11×11 (absents ou jamais
            implémentés dans l’app d’origine), qui utilisent un carré magique de référence décalé uniformément.
          </div>
        )}

        <div className="hatim-doors">
          {SIZES.map((size) => (
            <Link key={size} href={`/wafq/carre/${size}`} className="hatim-door">
              <span className="hatim-door-main">
                <span className="hatim-door-num">{String(size).padStart(2, '0')}</span>
                <DoorThumb size={size} tone={DOOR_TONE[size]} />
                <span className="hatim-door-size">{size} × {size}</span>
              </span>
              <span className="hatim-door-action" aria-hidden="true">
                <ChevronRight size={16} className="hatim-door-chevron" />
                <Check size={16} className="hatim-door-check" />
              </span>
            </Link>
          ))}
        </div>

        <MosqueSkyline />
      </div>
    </div>
  );
}
