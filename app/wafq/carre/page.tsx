'use client';
// « Carrés numériques » — page d'accueil (neuf tailles, 3×3 à 11×11) —
// portée depuis prozizou/Kanzou app/page.tsx (voir lib/kanzouWafq.ts pour le
// contexte complet du portage). Section avancée du module Wafq, à côté du
// générateur par intention (app/wafq/page.tsx) : ici, on choisit une TAILLE
// et on saisit des valeurs brutes selon la formule d'origine, plutôt qu'une
// intention traduite automatiquement en constante.
import './carre.css';
import Link from 'next/link';

const SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11];

export default function CarreIndexPage() {
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <Link href="/wafq" className="back-btn">← Retour au Wafq</Link>
      <div className="glass-panel kz-wrap">
        <div className="header">
          <h1>🔯 Carrés numériques</h1>
          <p style={{ color: 'var(--text-muted)' }}>Neuf portes, neuf tailles de carré — choisissez une taille pour renseigner vos valeurs de départ.</p>
        </div>

        <div className="kz-doors">
          {SIZES.map((size) => (
            <Link key={size} href={`/wafq/carre/${size}`} className="kz-door">
              <span className="kz-door-num">{String(size).padStart(2, '0')}</span>
              <span className="kz-door-size">{size} × {size}</span>
            </Link>
          ))}
        </div>

        <p className="kz-note">
          Les neuf tailles sont couvertes — chacune reprend fidèlement sa formule d’origine (app Android
          « Al Kanzou Pro »), sauf le 10×10 et le 11×11 (absents ou jamais implémentés dans l’app d’origine),
          qui utilisent un carré magique de référence décalé uniformément.
        </p>
      </div>
    </div>
  );
}
