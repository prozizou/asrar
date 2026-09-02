'use client';
// Module « Tafsir al-Ahlam — Interprétation des rêves » — recherche par
// symbole/mot-clé dans un corpus de référence (lib/tafsirCorpus.js, esprit
// Ibn Sirîn) et interprétation structurée d'un rêve raconté en texte libre
// (lib/tafsirLogic.js analyzeDream — repérage de mots-clés, même technique
// que getElementalOrderFromText dans lib/abjad.js, AUCUNE IA externe).
//
// Paywall : même motif que app/abajad/page.tsx — ensureAccess() sans palier
// (n'importe quel abonnement actif, pas le palier premium de Al-Qalam/
// Géomancie/Wafq), déclenché à la première interaction et mémorisé ensuite.
import './tafsir.css';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { TAFSIR_CATEGORIES } from '@/lib/tafsirCorpus';
import { searchSymbols, analyzeDream, DREAM_TEXT_MAX } from '@/lib/tafsirLogic';

type Mode = 'search' | 'dream';

export default function TafsirPage() {
  // useAccess() vient d'AccessProvider.js (.js) : son contexte est créé via
  // createContext(null), donc TS l'infère `null` sans cast — même traitement
  // que app/abajad/page.tsx, app/geomancie/page.tsx.
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: () => Promise<boolean> };

  const [mode, setMode] = useState<Mode>('search');
  const [granted, setGranted] = useState(false);

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const [dreamText, setDreamText] = useState('');

  // Paywall : à la première frappe (recherche OU récit de rêve) on vérifie
  // l'accès ; tant qu'il n'est pas accordé, le portail s'ouvre et rien n'est
  // calculé — même motif que app/abajad/page.tsx onChange.
  const gate = async () => {
    if (granted) return true;
    const ok = await ensureAccess();
    if (ok) setGranted(true);
    return ok;
  };

  const onQueryChange = async (v: string) => {
    setQuery(v);
    await gate();
  };
  const onDreamChange = async (v: string) => {
    setDreamText(v.slice(0, DREAM_TEXT_MAX));
    await gate();
  };

  const searchResults = useMemo(
    () => (granted ? searchSymbols(query, categoryId) : []),
    [granted, query, categoryId]
  );
  const dreamResults = useMemo(
    () => (granted ? analyzeDream(dreamText) : []),
    [granted, dreamText]
  );

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Link href="/menu" className="back-btn">← Retour</Link>
      <div className="glass-panel">
        <div className="header">
          <h1>🌙 Tafsir al-Ahlam</h1>
          <p style={{ color: 'var(--text-muted)' }}>Interprétation des rêves — recherche par symbole ou récit libre.</p>
        </div>

        <div className="tf-tabs">
          <button type="button" className={'tf-tab' + (mode === 'search' ? ' active' : '')} onClick={() => setMode('search')}>
            🔍 Rechercher un symbole
          </button>
          <button type="button" className={'tf-tab' + (mode === 'dream' ? ' active' : '')} onClick={() => setMode('dream')}>
            💭 Raconter mon rêve
          </button>
        </div>

        {mode === 'search' ? (
          <>
            <label className="tf-field">
              <span>Symbole ou mot-clé</span>
              <input
                type="text" value={query} placeholder="Ex. serpent, dents, eau…"
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </label>
            <div className="tf-categories">
              <button type="button" className={'tf-cat-btn' + (categoryId === null ? ' active' : '')} onClick={() => setCategoryId(null)}>
                Toutes
              </button>
              {TAFSIR_CATEGORIES.map((c) => (
                <button
                  key={c.id} type="button"
                  className={'tf-cat-btn' + (categoryId === c.id ? ' active' : '')}
                  onClick={() => setCategoryId(c.id)}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            {!granted ? (
              <p className="tf-empty">Commencez à taper pour rechercher un symbole.</p>
            ) : searchResults.length === 0 ? (
              <p className="tf-empty">Aucun symbole ne correspond à cette recherche.</p>
            ) : (
              <div className="tf-list">
                {searchResults.map((entry) => (
                  <div key={entry.id} className="tf-card">
                    <div className="tf-card-head">
                      <span>{entry.icon}</span>
                      <span className="tf-card-title">{entry.label}</span>
                    </div>
                    <p className="tf-card-text">{entry.interpretation}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <label className="tf-field">
              <span>Racontez votre rêve (les symboles reconnus seront analysés)</span>
              <textarea
                rows={5} maxLength={DREAM_TEXT_MAX} value={dreamText}
                placeholder="Ex. J'ai rêvé que je nageais dans une mer agitée, puis un serpent est apparu…"
                onChange={(e) => onDreamChange(e.target.value)}
              />
            </label>

            {!granted ? (
              <p className="tf-empty">Décrivez votre rêve pour recevoir une interprétation structurée.</p>
            ) : dreamText.trim() === '' ? (
              <p className="tf-empty">Décrivez votre rêve pour recevoir une interprétation structurée.</p>
            ) : dreamResults.length === 0 ? (
              <p className="tf-empty">Aucun symbole connu du corpus n’a été reconnu dans ce récit — essayez de détailler davantage (couleurs, lieux, animaux…).</p>
            ) : (
              <div className="tf-list">
                {dreamResults.map(({ entry, hits }) => (
                  <div key={entry.id} className="tf-card">
                    <div className="tf-card-head">
                      <span>{entry.icon}</span>
                      <span className="tf-card-title">{entry.label}</span>
                      {hits > 1 && <span className="tf-card-hits">×{hits}</span>}
                    </div>
                    <p className="tf-card-text">{entry.interpretation}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="tf-disclaimer">
          ⚠️ Ces lectures reflètent la tradition interprétative (Ibn Sirîn et consorts) et restent
          indicatives — le sens d’un rêve dépend fortement de son contexte complet et de l’état du
          rêveur. Seul Allah connaît le sens véritable des songes.
        </p>
      </div>
    </div>
  );
}
