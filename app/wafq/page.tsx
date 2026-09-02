'use client';
// Module « Wafq — Générateur de talisman » — carrés magiques (3×3, 3×3 vide,
// 4×4) par INTENTION (rizq, protection, guérison…), exportables en image/PDF
// pour impression. Suite du travail déjà fait sur Al-Qalam (export
// calligraphique) : WafqSquares.js (app/benefits) existait déjà en
// sous-composant embarqué dans une carte de Nom d'Allah, verrouillé derrière
// l'abonnement premium et sans export — ce module-ci en fait un outil
// autonome, avec choix d'intention (lib/wafqIntentions.js), texte
// personnalisable, et export (lib/wafqExport.js, canvas — même absence de
// dépendance externe que lib/alqalam.js).
//
// Même convention que app/benefits/NameCard.js : la CONSTANTE du carré
// (numericTarget) = poids abjad du texte arabe × 7 (calculatePoidsMystique,
// lib/abjad.js) — pas une valeur arbitraire, un choix déjà établi ailleurs
// dans l'app pour ce type de carré.
import './wafq.css';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { PREMIUM_LEVEL } from '@/lib/access';
import {
  calculatePoidsMystique, getElementalOrderFromText, toEasternArabic,
  generateAllWafq3x3, generateAllWafq3x3Vide, generateAllWafq4x4,
} from '@/lib/abjad';
import { WAFQ_INTENTIONS, DEFAULT_WAFQ_INTENTION_ID, findWafqIntention } from '@/lib/wafqIntentions';
import { renderWafqCanvas, downloadCanvasPng, printCanvas } from '@/lib/wafqExport';

const CUSTOM_TEXT_MAX = 60;

interface Cell { v: number | string; s: number | string; }
interface SquareFace { key: string; name: string; arabic: string; icon: string; grid: Cell[][]; }
type SquareSet = Record<string, SquareFace> | null;

function WafqCard({
  square, typeName, arabicPhrase, translit, target, eastern, isPrimary,
}: {
  square: SquareFace; typeName: string; arabicPhrase: string; translit: string; target: number; eastern: boolean; isPrimary: boolean;
}) {
  const [busy, setBusy] = useState<'' | 'image' | 'pdf'>('');
  const cols = square.grid.length;

  const buildCanvas = () =>
    renderWafqCanvas(square, { typeName, arabicPhrase, translit, target, eastern });

  const doDownload = async () => {
    setBusy('image');
    try {
      const canvas = await buildCanvas();
      downloadCanvasPng(canvas, `wafq-${typeName}-${square.key}`.replace(/\s+/g, '-'));
    } finally {
      setBusy('');
    }
  };
  const doPrint = async () => {
    setBusy('pdf');
    try {
      const canvas = await buildCanvas();
      printCanvas(canvas, `Wafq ${typeName} — ${square.name}`);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className={'wq-card' + (isPrimary ? ' primary' : '')}>
      <div className="wq-card-badge">{square.icon} {square.arabic}</div>
      <div className="wq-card-title">{typeName}{isPrimary ? ' ✦' : ''}</div>
      <div className="wq-card-sub">Constante : {eastern ? toEasternArabic(target) : target} · {square.name}</div>
      <div className={`wq-grid ${cols === 4 ? 'g4' : 'g3'}`}>
        {square.grid.map((row, r) =>
          row.map((cell, c) => {
            const isVide = cell.s === 'V';
            const shown = isVide ? '﹒' : eastern ? toEasternArabic(cell.v) : cell.v;
            return (
              <div key={`${r}-${c}`} className={'wq-cell' + (isVide ? ' vide' : '')}>
                {shown}
              </div>
            );
          })
        )}
      </div>
      <div className="wq-card-actions">
        <button type="button" className="wq-mini-btn" onClick={doDownload} disabled={busy !== ''}>
          {busy === 'image' ? '…' : '🖼️ Image'}
        </button>
        <button type="button" className="wq-mini-btn" onClick={doPrint} disabled={busy !== ''}>
          {busy === 'pdf' ? '…' : '🖨️ PDF'}
        </button>
      </div>
    </div>
  );
}

function WafqTypeSection({
  squares, orderedKeys, typeName, arabicPhrase, translit, target, eastern,
}: {
  squares: SquareSet; orderedKeys: string[]; typeName: string; arabicPhrase: string; translit: string; target: number; eastern: boolean;
}) {
  if (!squares) return null;
  return (
    <>
      <h3 className="wq-type-title">{typeName}</h3>
      <div className="wq-cards">
        {orderedKeys.map((key, i) => (
          <WafqCard
            key={key}
            square={squares[key]}
            typeName={typeName}
            arabicPhrase={arabicPhrase}
            translit={translit}
            target={target}
            eastern={eastern}
            isPrimary={i === 0}
          />
        ))}
      </div>
    </>
  );
}

export default function WafqPage() {
  // useAccess() vient d'AccessProvider.js (.js) : son contexte est créé via
  // createContext(null), donc TS l'infère `null` sans cast — même traitement
  // que app/geomancie/page.tsx, app/alqalam/page.tsx (autres modules premium).
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: (minLevel?: number) => Promise<boolean> };

  const [intentionId, setIntentionId] = useState(DEFAULT_WAFQ_INTENTION_ID);
  const [customText, setCustomText] = useState('');
  const [eastern, setEastern] = useState(false);
  // Réservé au forfait 1 An (même palier que Al-Qalam, Géomancie — cf. menu) :
  // le carré n'est révélé qu'après ensureAccess(), jamais calculé « en
  // silence » pour un compte non abonné. Retombe à false dès que l'intention
  // ou le texte personnalisé change : redemande sur chaque nouveau talisman
  // (ensureAccess() reste instantané pour un compte déjà abonné).
  const [calculated, setCalculated] = useState(false);

  const intention = findWafqIntention(intentionId);
  const custom = customText.trim();
  const arabicPhrase = custom || intention.arabic;
  const translit = custom ? '' : intention.translit;

  const target = useMemo(() => {
    const poids = calculatePoidsMystique(arabicPhrase);
    return poids > 0 ? poids * 7 : 0;
  }, [arabicPhrase]);

  const orderedKeys = useMemo(
    () => getElementalOrderFromText(intention.meaning, intention.benefit),
    [intention.meaning, intention.benefit]
  );

  const s3 = target >= 15 ? generateAllWafq3x3(target) : null;
  const s3v = target >= 15 ? generateAllWafq3x3Vide(target) : null;
  const s4 = target >= 34 ? generateAllWafq4x4(target) : null;

  const selectIntention = (id: string) => {
    setIntentionId(id);
    setCalculated(false);
  };
  const onCustomText = (v: string) => {
    setCustomText(v);
    setCalculated(false);
  };
  const onGenerate = async () => {
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (ok) setCalculated(true);
  };

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <Link href="/menu" className="back-btn">← Retour</Link>
      <div className="glass-panel">
        <div className="header">
          <h1>🔯 Wafq — Générateur de talisman</h1>
          <p style={{ color: 'var(--text-muted)' }}>Carrés magiques par intention, exportables en image ou PDF pour impression.</p>
        </div>

        {/* Section avancée — moteur porté de prozizou/Kanzou (lib/kanzouWafq.ts) :
            neuf tailles (3×3 à 11×11), plusieurs modes par taille, valeurs
            saisies directement selon la formule d'origine plutôt qu'une
            intention traduite automatiquement en constante. */}
        <Link href="/wafq/carre" className="wq-kanzou-link">
          <span>🔢 Carrés numériques avancés</span>
          <span className="wq-kanzou-sub">9 tailles (3×3 à 11×11), plusieurs modes, export Word — moteur « Al Kanzou »</span>
        </Link>

        <div className="wq-intentions">
          {WAFQ_INTENTIONS.map((it) => (
            <button
              key={it.id}
              type="button"
              className={'wq-intent-btn' + (it.id === intentionId ? ' active' : '')}
              onClick={() => selectIntention(it.id)}
            >
              <span>{it.icon}</span><span>{it.label}</span>
            </button>
          ))}
        </div>

        <label className="wq-field">
          <span>Personnaliser (nom, mot, invocation) — optionnel, remplace « {intention.translit} »</span>
          <input
            type="text" dir="rtl" maxLength={CUSTOM_TEXT_MAX} value={customText}
            placeholder={intention.arabic}
            onChange={(e) => onCustomText(e.target.value)}
          />
        </label>

        <div className="wq-summary">
          <span>Texte : <strong dir="rtl">{arabicPhrase}</strong></span>
          <span>Poids abjad × 7 = Constante : <strong>{target || '—'}</strong></span>
          <label className="wq-toggle-row">
            <input type="checkbox" checked={eastern} onChange={(e) => setEastern(e.target.checked)} />
            <span>Chiffres arabes orientaux (١٢٣)</span>
          </label>
        </div>

        {!s3 && !s3v && !s4 ? (
          <p className="wq-empty">Constante trop faible pour générer un carré magique — choisissez une autre intention ou un texte plus long.</p>
        ) : !calculated ? (
          <button type="button" className="wq-generate-btn" onClick={onGenerate}>
            🔓 Générer le talisman
          </button>
        ) : (
          <>
            <WafqTypeSection squares={s3} orderedKeys={orderedKeys} typeName="3×3 Classique" arabicPhrase={arabicPhrase} translit={translit} target={target} eastern={eastern} />
            <WafqTypeSection squares={s3v} orderedKeys={orderedKeys} typeName="3×3 Vide" arabicPhrase={arabicPhrase} translit={translit} target={target} eastern={eastern} />
            <WafqTypeSection squares={s4} orderedKeys={orderedKeys} typeName="4×4 Murabba" arabicPhrase={arabicPhrase} translit={translit} target={target} eastern={eastern} />
          </>
        )}
      </div>
    </div>
  );
}
