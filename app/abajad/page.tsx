'use client';
// Module « Abajad » — port de abajad/abajad.html, puis étendu (revue design
// v2) en véritable moteur d'analyse numérique ésotérique plutôt qu'un simple
// calculateur de valeurs : les deux faces (Mashreqi/Maghrébi) ne sont plus
// seulement affichées côte à côte, elles sont reliées entre elles (union,
// polarité, produit, PGCD/PPCM…) dans une « signature mystique » — voir
// lib/abjad.js, computeMysticSignature(). Le détail (propriétés, zodiaque,
// décomposition) reste disponible mais replié en accordéons, pour ne pas
// alourdir l'écran par défaut.
//
// TypeScript (batch 2/7, cf. tsconfig.json) : lib/abjad.js et lib/api.js
// restent en .js (imports non typés, cf. app/menu/page.tsx pour le même choix) —
// EsoRow type le retour de computeEso() pour les composants locaux ci-dessous.
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
  computeMysticSignature,
  letterBreakdown,
} from '@/lib/abjad';

interface EsoRow {
  face: string;
  cachee: string;
  rouhani: string;
  lumineux: string;
  ordre: string;
  signe: string;
  nature: string;
  intervalle: string;
}

const fmt = (n: number) => Number(n).toLocaleString('fr-FR');

export default function AbajadPage() {
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { ensureAccess } = useAccess() as unknown as { ensureAccess: () => Promise<boolean> };
  const [input, setInput] = useState('');
  const [granted, setGranted] = useState(false);
  const [versets, setVersets] = useState<string[]>([]);

  // Suggestions de versets/mots depuis le RTDB (via /api/list-content).
  useEffect(() => {
    let alive = true;
    apiPost('list-content', { kind: 'verset' })
      .then(({ items }: { items?: { verset?: string }[] }) => {
        if (!alive) return;
        setVersets((items || []).map((v) => v && v.verset).filter(Boolean) as string[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Paywall : à la première frappe on vérifie l'accès ; tant qu'il n'est pas
  // accordé, le portail s'ouvre et aucun résultat n'est calculé.
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  const hasResult = mash > 0 || magh > 0;

  return (
    <div className="container">
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <div className="glass-panel">
        {/* Titre simplifié (revue design v2) : « Calculateur Abjad » porte le
            nom, « Calcul Abjad », « Poids mystique »… ailleurs dans l'app
            (parrainage, combinaisons, noms d'Allah) restent la SEULE
            terminologie utilisée pour cette même notion — cf. leurs propres
            revues design, point « terminologie ». */}
        <div className="ab-header">
          <h2>Calculateur Abjad</h2>
          <p className="ab-subtitle">Analyse ésotérique et numérique</p>
        </div>

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
        <p className="ab-hint">💡 Vous pouvez aussi saisir directement un nombre (ex. 711).</p>
        <datalist id="versetList">
          {versets.map((v, i) => (
            <option key={i} value={v} />
          ))}
        </datalist>

        {hasResult && (
          <>
            {/* Mashreqi/Maghrébi réunis dans une seule vue comparative
                (revue design v2) — deux colonnes légères plutôt que deux
                grandes cartes séparées. */}
            <CompareHeader mash={mash} magh={magh} />

            {/* Signature mystique : le cœur de l'enrichissement (revue
                design v2, « analyse mystique complète ») — relie les deux
                faces entre elles au lieu de les traiter isolément. */}
            <MysticSignature mash={mash} magh={magh} />

            <LetterDetail input={input} />
            <PropertiesAccordion mash={mash} magh={magh} />
            <ZodiacAccordion mash={mash} magh={magh} />
            <DecompositionAccordion mash={mash} magh={magh} />

            <ThalsamLink mash={mash} magh={magh} />
          </>
        )}
      </div>
    </div>
  );
}

// Vue comparative compacte (remplace les deux .result-card côte à côte,
// chacune avec son propre cadre/titre/padding — revue design v2 : « fusionner
// Mashreqi/Maghrébi dans une seule vue »).
function CompareHeader({ mash, magh }: { mash: number; magh: number }) {
  return (
    <div className="ab-compare">
      <div className="ab-compare-col">
        <div className="ab-compare-label">☀️ Mashreqi</div>
        <div className="ab-compare-value">{fmt(mash)}</div>
        <div className="ab-compare-reduced">→ {reduceNumber(mash)}</div>
      </div>
      <div className="ab-compare-col">
        <div className="ab-compare-label">🌙 Maghrébi</div>
        <div className="ab-compare-value">{fmt(magh)}</div>
        <div className="ab-compare-reduced">→ {reduceNumber(magh)}</div>
      </div>
    </div>
  );
}

// Signature mystique (revue design v2) : union/polarité/produit des deux
// faces, racine (PGCD) et cycle (PPCM) communs, union et écart des deux
// réductions, structure en facteurs premiers — voir
// lib/abjad.js#computeMysticSignature pour le détail des calculs (testés
// indépendamment dans lib/abjad.test.js sur l'exemple 200/170).
function MysticSignature({ mash, magh }: { mash: number; magh: number }) {
  const s = useMemo(() => computeMysticSignature(mash, magh), [mash, magh]);
  if (!s) return null;
  const sameFace = s.mash === s.magh;
  return (
    <div className="ab-signature">
      <div className="ab-signature-title">🔮 Signature mystique</div>
      <div className="ab-sig-row">
        <span>Union des faces</span>
        <strong>
          {fmt(s.union)} → {s.rUnion}
        </strong>
      </div>
      <div className="ab-sig-row">
        <span>Polarité</span>
        <strong>
          {fmt(s.polarite)} → {s.rPolarite}
        </strong>
      </div>
      <div className="ab-sig-row">
        <span>Produit des faces</span>
        <strong>{fmt(s.produit)}</strong>
      </div>
      <div className="ab-sig-row">
        <span>Racine commune (PGCD)</span>
        <strong>
          {fmt(s.racine)} → {s.rRacine}
        </strong>
      </div>
      <div className="ab-sig-row">
        <span>Cycle commun (PPCM)</span>
        <strong>
          {fmt(s.cycle)} → {s.rCycle}
        </strong>
      </div>
      <div className="ab-sig-row">
        <span>Union des réductions</span>
        <strong>
          {s.rMash} + {s.rMagh} → {s.rUnionReduite}
        </strong>
      </div>
      <div className="ab-sig-row">
        <span>Écart des réductions</span>
        <strong>{s.ecartReductions}</strong>
      </div>
      <div className="ab-sig-row ab-sig-structure">
        <span>Structure</span>
        <strong dir="ltr">
          {fmt(s.mash)} = {s.factoMash}
          {!sameFace && <> · {fmt(s.magh)} = {s.factoMagh}</>}
        </strong>
      </div>
    </div>
  );
}

// Détail lettre par lettre (revue design v2 : « correspondances Abjad
// lettres ↔ nombres ») — absent pour une entrée purement numérique (rien à
// détailler lettre par lettre). Une seule valeur par lettre quand les deux
// systèmes s'accordent (immense majorité des lettres), les deux sinon (ص/س/ش
// notamment) — évite de répéter deux fois la même valeur.
function LetterDetail({ input }: { input: string }) {
  const rows = useMemo(() => letterBreakdown(input), [input]);
  if (!rows.length) return null;
  return (
    <details className="ab-accordion">
      <summary>Détail lettre par lettre</summary>
      <div className="ab-letters">
        {rows.map((r: { letter: string; mash: number; magh: number }, i: number) => (
          <div className="ab-letter-chip" key={i}>
            <span className="ab-letter-ar" dir="rtl">
              {r.letter}
            </span>
            <span className="ab-letter-vals">{r.mash === r.magh ? r.mash : `${r.mash} / ${r.magh}`}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

// Propriétés mystiques (revue design v2) : face apparente/cachée, Adad
// rouhâni/lumineux — 4 des 7 colonnes demandées, le zodiaque/élément/période
// vivant dans leur propre accordéon ci-dessous (ZodiacAccordion).
function PropertiesAccordion({ mash, magh }: { mash: number; magh: number }) {
  const A: EsoRow = computeEso(mash);
  const B: EsoRow = computeEso(magh);
  const rows: [string, string, string][] = [
    ['Face apparente', A.face, B.face],
    ['Face cachée', A.cachee, B.cachee],
    ['Adad rouhâni', A.rouhani, B.rouhani],
    ['Adad lumineux', A.lumineux, B.lumineux],
  ];
  return (
    <details className="ab-accordion">
      <summary>Propriétés mystiques</summary>
      <EsoTable rows={rows} />
    </details>
  );
}

// Zodiaque (revue design v2) : signe, élément (nature du signe) et période —
// « ordre » (index 1-12 servant à dériver le signe) n'est plus affiché
// séparément, il n'apporte rien à qui n'a pas besoin du calcul lui-même.
function ZodiacAccordion({ mash, magh }: { mash: number; magh: number }) {
  const A: EsoRow = computeEso(mash);
  const B: EsoRow = computeEso(magh);
  const rows: [string, string, string][] = [
    ['Signe', A.signe, B.signe],
    ['Élément', A.nature, B.nature],
    ['Période', A.intervalle, B.intervalle],
  ];
  return (
    <details className="ab-accordion">
      <summary>Zodiaque</summary>
      <EsoTable rows={rows} />
    </details>
  );
}

function EsoTable({ rows }: { rows: [string, string, string][] }) {
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

// Décomposition numérique (revue design v2) : structure en facteurs premiers
// (déjà calculée dans la signature mystique, reprise ici) puis les paires
// a×b classiques — une seule colonne si les deux faces sont identiques
// (entrée numérique), sinon deux colonnes côte à côte.
function DecompositionAccordion({ mash, magh }: { mash: number; magh: number }) {
  const s = useMemo(() => computeMysticSignature(mash, magh), [mash, magh]);
  if (!s) return null;
  const sameFace = s.mash === s.magh;
  return (
    <details className="ab-accordion">
      <summary>Décomposition numérique</summary>
      <div className="ab-structure">
        {fmt(s.mash)} = {s.factoMash}
        {!sameFace && <> · {fmt(s.magh)} = {s.factoMagh}</>}
      </div>
      {sameFace ? (
        <div className="factor-list">
          <FactorPairs v={mash} />
        </div>
      ) : (
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
      )}
    </details>
  );
}

function FactorPairs({ v }: { v: number }) {
  const pairs = getFactorPairs(v);
  if (!(pairs.length > 0 && v > 0)) {
    return <span className="ab-no-factor">Nombre premier — pas de décomposition a×b.</span>;
  }
  return (
    <>
      {pairs.map(([a, b]: [number, number], i: number) => (
        <div className="factor-row" key={i}>
          <strong>{a}</strong> × <strong>{b}</strong>
        </div>
      ))}
    </>
  );
}

// Relie le résultat aux autres fonctions d'ASRAR PRO (revue design v2) :
// Texte arabe → Calcul Abjad → … → Génération Thalsam. Un lien par face
// distincte (une seule si l'entrée était numérique) ; ?target= est repris
// par app/thalsams/page.tsx pour préremplir le poids cible.
function ThalsamLink({ mash, magh }: { mash: number; magh: number }) {
  const targets = [...new Set([mash, magh].filter((v) => v > 0))];
  if (!targets.length) return null;
  return (
    <div className="ab-thalsam-link">
      <span>Générer un Thalsam avec ce poids :</span>
      <div className="ab-thalsam-btns">
        {targets.map((v) => (
          <Link key={v} href={`/thalsams?target=${v}`} className="ab-thalsam-btn">
            🧿 {fmt(v)}
          </Link>
        ))}
      </div>
    </div>
  );
}
