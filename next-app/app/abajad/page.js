'use client';
// Module « Abajad » — port de abajad/abajad.html.
// Calcul en temps réel (Mashreqi/Maghrébi), réduction théosophique, analyse
// ésotérique (faces, adad, zodiaque) et décomposition en facteurs a×b.
// La saisie est protégée par le paywall (ensureAccess) comme dans l'original.
import './abajad.css';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { useAccess } from '@/components/AccessProvider';
import {
  computeAbajadSums,
  reduceNumber,
  getFactorPairs,
  computeEso,
} from '@/lib/abjad';

export default function AbajadPage() {
  const { ensureAccess } = useAccess();
  const [input, setInput] = useState('');
  const [granted, setGranted] = useState(false);
  const [versets, setVersets] = useState([]);

  // Suggestions de versets/mots depuis le RTDB (via /api/list-content).
  useEffect(() => {
    let alive = true;
    apiPost('list-content', { kind: 'verset' })
      .then(({ items }) => {
        if (!alive) return;
        setVersets((items || []).map((v) => v && v.verset).filter(Boolean));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Paywall : à la première frappe on vérifie l'accès ; tant qu'il n'est pas
  // accordé, le portail s'ouvre et aucun résultat n'est calculé.
  const onChange = async (e) => {
    const v = e.target.value;
    setInput(v);
    if (!granted) {
      const ok = await ensureAccess();
      if (ok) setGranted(true);
    }
  };

  const { mash, magh } = useMemo(
    () => (granted ? computeAbajadSums(input) : { mash: 0, magh: 0 }),
    [input, granted]
  );

  return (
    <div className="container">
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <div className="glass-panel">
        <h2>🔢 Calculateur Abjad Ésotérique</h2>
        <p style={{ marginBottom: 18, color: 'var(--text-muted)' }}>
          Saisie en temps réel · Faces &amp; Adad · Zodiaque · Facteurs mystiques
          <br />
          <span style={{ fontSize: '.85rem' }}>
            💡 Astuce : vous pouvez aussi saisir directement un nombre (ex. 711).
          </span>
        </p>

        <input
          type="text"
          className="abajad-input"
          dir="rtl"
          placeholder="بسم الله الرحمن الرحيم"
          list="versetList"
          autoComplete="off"
          value={input}
          onChange={onChange}
          autoFocus
        />
        <datalist id="versetList">
          {versets.map((v, i) => (
            <option key={i} value={v} />
          ))}
        </datalist>

        {/* Résultats principaux */}
        <div className="result-grid">
          <div className="result-card">
            <h3>☀️ Mashreqi (Oriental)</h3>
            <div className="result-big">{mash}</div>
            <div className="result-reduced">{mash > 0 ? `Réduit : ${reduceNumber(mash)}` : ''}</div>
          </div>
          <div className="result-card">
            <h3>🌙 Maghrébi (Occidental)</h3>
            <div className="result-big">{magh}</div>
            <div className="result-reduced">{magh > 0 ? `Réduit : ${reduceNumber(magh)}` : ''}</div>
          </div>
        </div>

        {/* Analyse ésotérique (faces, adad, zodiaque) */}
        <EsoInfo mash={mash} magh={magh} />

        {/* Décomposition (paires a×b) */}
        <div style={{ marginTop: 15 }}>
          <h4 style={{ margin: '0 0 8px', color: 'var(--accent)' }}>🔮 Décomposition (a × b)</h4>
          <Factors mash={mash} magh={magh} />
        </div>
      </div>
    </div>
  );
}

function FactorPairs({ v }) {
  const pairs = getFactorPairs(v);
  if (!(pairs.length > 0 && v > 0)) {
    return <span style={{ color: 'var(--text-muted)' }}>Nombre premier — pas de décomposition.</span>;
  }
  return pairs.map(([a, b], i) => (
    <div className="factor-row" key={i}>
      <strong>{a}</strong> × <strong>{b}</strong>
    </div>
  ));
}

function Factors({ mash, magh }) {
  if (mash === magh) {
    return (
      <div className="factor-list">
        <FactorPairs v={mash} />
      </div>
    );
  }
  return (
    <div className="factor-cols">
      <div className="factor-col">
        <div className="factor-col-head">☀️ Mashreqi</div>
        <FactorPairs v={mash} />
      </div>
      <div className="factor-col">
        <div className="factor-col-head">🌙 Maghrébi</div>
        <FactorPairs v={magh} />
      </div>
    </div>
  );
}

function EsoInfo({ mash, magh }) {
  if ((!mash || mash <= 0) && (!magh || magh <= 0)) return null;
  const A = computeEso(mash);
  const B = computeEso(magh);
  const rows = [
    ['Face apparente', A.face, B.face],
    ['Face cachée', A.cachee, B.cachee],
    ['Adad rouhâni', A.rouhani, B.rouhani],
    ['Adad lumineux', A.lumineux, B.lumineux],
    ['Ordre zodiaque', A.ordre, B.ordre],
    ['Signe zodiaque', A.signe, B.signe],
    ['Nature zodiaque', A.nature, B.nature],
    ['Intervalle zodiaque', A.intervalle, B.intervalle],
  ];
  return (
    <div className="eso-info">
      <div className="eso-row eso-head">
        <span className="eso-k" />
        <span className="eso-v">☀️ Mashreqi</span>
        <span className="eso-v">🌙 Maghrébi</span>
      </div>
      {rows.map(([k, a, b]) => (
        <div className="eso-row" key={k}>
          <span className="eso-k">{k}</span>
          <span className="eso-v">{a}</span>
          <span className="eso-v">{b}</span>
        </div>
      ))}
    </div>
  );
}
