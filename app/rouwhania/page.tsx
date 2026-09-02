'use client';
// Module « Rouwhanes » — port de rouwhania/index.html + script.js.
// Saisie d'un nom/verset → poids Abjad (3 méthodes), génération des « noms des
// rouwhanes » (anges) et, pour chaque lettre du nom-racine, TOUS les noms
// d'Allah qui lui correspondent (plus de champ « vœu » : c'est à
// l'utilisateur de choisir personnellement parmi les détails de chacun).
// La logique (tables, calculs, génération) vit dans lib/rouwhania.js ; ici,
// l'UI React, les effets de chargement et les suggestions de versets.
// Le paywall passe par ensureAccess ; les blocs de calcul intermédiaires ne
// sont visibles que pour le super-admin (comme l'original).
//
// Revue design : écran initial quasi vide sur mobile (le champ + bouton
// tiennent dans le quart supérieur, rien n'explique l'outil en dessous),
// champ de saisie non identifiable comme modifiable, changement de largeur
// du formulaire avant/après calcul, hiérarchie des résultats peu claire
// (deux nombres sans titre avant le total), carte de calcul sans contexte,
// liste des rouwhanes en pseudo-tableau à 3 colonnes (translittérations
// longues coupées), cartes « noms d'Allah » énormes (une seule carte peut
// occuper l'écran), trop de cadres imbriqués, orange isolé au milieu d'une
// palette violette, absence de règles bilingues constantes (dir RTL/LTR),
// pas de navigation dans une page qui devient longue après calcul.
//
// Corrections : un .rw-form-card unique (titre + instructions + champ
// labellisé + bouton) qui ne change JAMAIS de taille selon l'état — le calcul
// s'affiche entièrement EN DESSOUS, jamais en redimensionnant le formulaire ;
// un résultat principal (le total) mis en avant avec une explication, le
// détail du calcul replié par défaut (<details>, comme WafqSquares.js) ;
// chaque ligne de rouwhane en 2 lignes (arabe, puis translit · nombre) au
// lieu de 3 colonnes ; chaque carte de nom d'Allah en accordéon (<details>),
// repliée par défaut ; l'orange du titre remplacé par le violet déjà en
// place partout ailleurs ; dir="rtl"/"ltr" posés explicitement sur chaque
// bloc de texte plutôt que déduits implicitement ; une petite nav d'ancres
// une fois les résultats affichés.
//
// TypeScript (batch 4/7, cf. tsconfig.json) : lib/rouwhania.js reste en .js
// (hors scope de ce batch) — ses valeurs de retour (calculs, listes d'anges/
// cartes) restent typées `any`/`unknown` en local plutôt que reproduites en
// interfaces ici (forme interne complexe, propre à ce module), suivant le
// même principe que useAccess()/SmartImage dans les batches précédents
// (#114, #116, #118) pour ce qui reste .js.
import './rouwhania.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useAccess } from '@/components/AccessProvider';
import {
  computeAll,
  buildAngelNames,
  buildAllahCards,
  formatNumber,
  mixedSegments,
  loadRouwhaniaAsma,
  loadVerses,
} from '@/lib/rouwhania';

const SUPER_ADMIN = 'prozizou298@gmail.com';

interface Verse {
  verset: string;
  [k: string]: any;
}

export default function RouwhaniaPage() {
  const { user } = useAuth() as any;
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { ensureAccess } = useAccess() as unknown as {
    ensureAccess: (minLevel?: number) => Promise<boolean>;
  };
  const isAdmin = !!(user && user.email && user.email.trim().toLowerCase() === SUPER_ADMIN);

  const editorRef = useRef<HTMLDivElement>(null);
  const [computed, setComputed] = useState<any>(null);
  const [angels, setAngels] = useState<any[]>([]);
  const [allahCards, setAllahCards] = useState<any[]>([]);

  const [asma, setAsma] = useState<any[]>([]);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [suggestions, setSuggestions] = useState<Verse[]>([]);

  // Contenu initial de l'éditeur + chargement des données (une fois).
  useEffect(() => {
    if (editorRef.current && !editorRef.current.textContent) {
      editorRef.current.textContent = 'محمد';
    }
    loadRouwhaniaAsma().then(setAsma);
    loadVerses().then(setVerses);
  }, []);

  // Fermer les suggestions au clic en dehors de l'éditeur.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.parentNode?.contains(e.target as Node)) setSuggestions([]);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const onEditorInput = () => {
    const query = (editorRef.current?.textContent || '').trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    setSuggestions(verses.filter((v) => v.verset.includes(query)).slice(0, 30));
  };

  const pickSuggestion = (verset: string) => {
    if (editorRef.current) editorRef.current.textContent = verset;
    setSuggestions([]);
  };

  const onCalculate = useCallback(async () => {
    const text = (editorRef.current?.textContent || '').trim();
    if (!text) {
      alert('يرجى إدخال نص للتحليل');
      return;
    }
    const ok = await ensureAccess();
    if (!ok) return;

    const c = computeAll(text);
    setComputed(c);
    const { list, seventh } = buildAngelNames(c.results);
    setAngels(list);
    setAllahCards(seventh ? buildAllahCards(seventh, asma) : []);
    setSuggestions([]);
  }, [ensureAccess, asma]);

  const r = computed?.results;
  const showCalc = isAdmin && !!computed;
  const showAngels = angels.length > 0;
  const showAllah = allahCards.length > 0;
  const hasResults = showCalc || showAngels || showAllah;

  return (
    <div className="rw-page">
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '12px 10px 40px' }}>
        <Link href="/" className="back-btn" style={{ direction: 'ltr' }}>
          ← Retour
        </Link>

        <div className="main-container">
          {/* Colonne gauche : un seul bloc de formulaire, de taille CONSTANTE
              qu'un calcul existe ou non (revue design, point 3) — titre,
              instructions et champ labellisé au lieu du champ isolé sans
              contexte (points 1, 2). */}
          {/* dir="ltr" explicite (revue design, point 11) : le contenu de ce
              bloc est presque entièrement en français (titre, instructions,
              libellé, bouton) — hérite sinon le RTL de .main-container
              (mise en page globale, volontairement inchangée), qui inverserait
              aussi l'ORDRE visuel des lignes en flex-row plus bas. L'éditeur
              arabe et les suggestions de versets gardent leur propre
              dir="rtl"/direction:rtl explicite, qui l'emporte toujours sur
              celui d'un ancêtre. */}
          <div className="rw-left" dir="ltr">
            <div className="rw-form-card">
              <h1 className="rw-title">Rouwhanes</h1>
              <p className="rw-intro">
                Entrez un nom ou un verset en arabe pour révéler ses rouwhanes
                (les anges associés) et les noms d'Allah qui leur correspondent.
              </p>

              <label className="rw-field-label" htmlFor="editor">Nom ou verset en arabe</label>
              <div className="input-container">
                <div
                  id="editor"
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  dir="rtl"
                  data-placeholder="مثال : محمد"
                  onInput={onEditorInput}
                />
                {suggestions.length > 0 && (
                  <ul className="verses-suggestions">
                    {suggestions.map((s, i) => (
                      <li key={i} onMouseDown={(e) => e.preventDefault()} onClick={() => pickSuggestion(s.verset)}>
                        {s.verset}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="rw-field-hint">Exemple déjà rempli : محمد — modifiez-le ou collez un verset entier.</p>

              <div className="button-row">
                <button className="primary-btn" onClick={onCalculate}>
                  Calculer
                </button>
              </div>
            </div>
          </div>

          {/* Colonne droite : résultats + noms générés. dir="ltr" explicite,
              même raison que .rw-left ci-dessus — les titres/étiquettes sont
              en français ; chaque span réellement arabe (nom, expansion,
              lettre…) porte déjà son propre dir="rtl" qui l'emporte. Sans ce
              correctif, les lignes en flex-row (en-tête de result-box, nav
              d'ancres, méta d'une rouwhane, en-tête de carte de nom d'Allah)
              s'affichaient dans l'ordre visuel INVERSE de l'ordre du DOM. */}
          <div className="rw-right" dir="ltr">
            {!computed && (
              <div className="rw-hint">
                <div className="rw-hint-icon">🌙</div>
                <div className="rw-hint-title">Les noms des rouwhanes apparaîtront ici</div>
                <div className="rw-hint-text">
                  Saisissez un nom ou un verset, puis lancez « Calculer » pour révéler la génération complète.
                </div>
              </div>
            )}

            {/* Navigation d'ancres (revue design, point 12) — la page devient
                longue une fois les résultats affichés. */}
            {hasResults && (
              <nav className="rw-anchor-nav" aria-label="Sections du résultat">
                {showCalc && <a href="#rw-calc">Calcul</a>}
                {showAngels && <a href="#rw-angels">Rouwhanes</a>}
                {showAllah && <a href="#rw-allah">Noms d'Allah</a>}
              </nav>
            )}

            {/* Blocs de calcul intermédiaires — réservés au super-admin.
                Résultat principal (le total) mis en avant avec une phrase
                d'explication, détail du calcul replié par défaut (revue
                design, points 4, 5, 6). */}
            {showCalc && (
              <div id="rw-calc" className="rw-calc-section">
                <div className="rw-result-hero">
                  <span className="rw-result-hero-label">Résultat principal</span>
                  <bdi dir="ltr" className="rw-result-hero-value">{formatNumber(r.total)}</bdi>
                  <p className="rw-result-hero-note">
                    Somme des trois poids calculés à partir du nom (V1 + V2 + V3) —
                    c'est cette valeur qui sert de base à la génération des
                    rouwhanes ci-dessous.
                  </p>
                </div>

                <details className="rw-calc-details">
                  <summary>
                    <span>Étapes du calcul</span>
                    <span className="rw-calc-toggle-hint">Voir le détail</span>
                  </summary>
                  <div className="rw-calc-details-body">
                    <div className="result-box">
                      <div className="rw-result-box-head">
                        <span className="rw-result-box-title">Expansion en noms de lettres</span>
                        <span className="total-indicator" dir="ltr">{formatNumber(computed.secondLength)}</span>
                      </div>
                      <div className="scroll-text" dir="rtl">{computed.exp2}</div>
                    </div>
                    <div className="result-box">
                      <div className="rw-result-box-head">
                        <span className="rw-result-box-title">Expansion en noms de nombres</span>
                        <span className="total-indicator" dir="ltr">{formatNumber(computed.trois)}</span>
                      </div>
                      <div className="scroll-text" dir="rtl">{computed.exp3}</div>
                    </div>
                    <div className="stats-footer">
                      <div className="stat-line">
                        <span className="stat-line-title">V1 — poids brut × longueur</span>
                        <span>{`${computed.stock} × ${computed.textLen} = ${r.v1m1}`}</span>
                        <span>{`${r.v1m1} × ${computed.textLen} = ${r.v1m2}`}</span>
                      </div>
                      <div className="stat-line">
                        <span className="stat-line-title">V2 — noms de lettres × longueur développée</span>
                        <span>{`${computed.secondLength} × ${computed.len2} = ${r.v2m1}`}</span>
                        <span>{`${r.v2m1} × ${computed.len2} = ${r.v2m2}`}</span>
                      </div>
                      <div className="stat-line">
                        <span className="stat-line-title">V3 — noms de nombres × longueur développée</span>
                        <span>{`${computed.trois} × ${computed.len3} = ${r.v3m1}`}</span>
                        <span>{`${r.v3m1} × ${computed.len3} = ${r.v3m2}`}</span>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Noms des rouwhanes */}
            {showAngels && (
              <div id="rw-angels" className="angel-names-container">
                <h3>Les noms des rouwhanes</h3>
                <div className="angel-names-list">
                  {angels.map((a, i) => (
                    <div className="angel-row" key={i}>
                      <span className="angel-arabic" dir="rtl">{a.arabic}</span>
                      <span className="angel-meta">
                        <span className="angel-transcript" dir="ltr">{a.transcript}</span>
                        <span className="angel-sep" aria-hidden="true">·</span>
                        <span className="angel-number" dir="ltr">{formatNumber(a.num)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Noms d'Allah correspondants : un groupe par lettre du nom-racine,
                chacun listant TOUS les noms qui lui correspondent (plus de
                sélection automatique d'un seul « meilleur » nom selon un vœu —
                voir lib/rouwhania.js buildAllahCards), en accordéon replié par
                défaut (revue design, point 8 — deux cartes dépliées d'origine
                pouvaient déjà occuper plusieurs écrans). */}
            {showAllah && (
              <div id="rw-allah" className="angel-names-container rw-allah-container">
                <h3>Les noms d'Allah qui vont avec</h3>
                <div className="allah-letters-list">
                  {allahCards.map((c, i) => (
                    <AllahLetterGroup key={i} group={c} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MixedBlock({ text }: { text: string }) {
  return (
    <>
      {mixedSegments(text).map((seg: any, i: number) => (
        <div key={i} className={seg.dir === 'rtl' ? 'mixed-rtl' : 'mixed-ltr'} dir={seg.dir}>
          {seg.text}
        </div>
      ))}
    </>
  );
}

// Un groupe = une lettre du nom-racine + TOUS les noms d'Allah qui lui
// correspondent, chacun en accordéon replié (au lieu d'un seul « meilleur »
// nom choisi automatiquement) pour que l'utilisateur en déduise lui-même
// lequel prendre, à partir de tous les détails de chacun.
function AllahLetterGroup({ group }: { group: any }) {
  const { char, matches } = group;
  return (
    <div className="allah-letter-group">
      <span className="allah-card-letter" dir="rtl">{char}</span>
      {matches.length === 0 ? (
        <div className="allah-card-empty">
          <span dir="rtl">لا يوجد اسم مناسب لهذا الحرف</span>
        </div>
      ) : (
        <div className="allah-names-list">
          {matches.map((data: any, i: number) => (
            <AllahCard key={i} data={data} />
          ))}
        </div>
      )}
    </div>
  );
}

function AllahCard({ data }: { data: any }) {
  return (
    <details className="allah-card">
      <summary className="allah-card-summary">
        <span className="allah-card-summary-text">
          <span className="allah-card-name" dir="rtl">{data.name}</span>
          {data.translit && <span className="allah-card-translit" dir="ltr">{data.translit}</span>}
        </span>
        <span className="allah-card-toggle-hint">Voir le secret</span>
      </summary>
      <div className="allah-card-body">
        <div className="allah-card-section-title sens">المعنى / Sens</div>
        <MixedBlock text={data.meaning} />
        <div className="allah-card-section-title secret">السر / Secret</div>
        <MixedBlock text={data.benefit} />
      </div>
    </details>
  );
}
