'use client';
// Module « Rouwhanes » — port de rouwhania/index.html + script.js.
// Saisie d'un nom/verset → poids Abjad (3 méthodes), génération des « noms des
// rouwhanes » (anges) et des noms d'Allah correspondants selon le vœu.
// La logique (tables, calculs, génération) vit dans lib/rouwhania.js ; ici,
// l'UI React, les effets de chargement (RTDB) et les suggestions de versets.
// Le paywall passe par ensureAccess ; les blocs de calcul intermédiaires ne
// sont visibles que pour le super-admin (comme l'original).
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

export default function RouwhaniaPage() {
  const { user } = useAuth();
  const { ensureAccess } = useAccess();
  const isAdmin = !!(user && user.email && user.email.trim().toLowerCase() === SUPER_ADMIN);

  const editorRef = useRef(null);
  const [intent, setIntent] = useState('');
  const [computed, setComputed] = useState(null);
  const [angels, setAngels] = useState([]);
  const [allahCards, setAllahCards] = useState([]);

  const [asma, setAsma] = useState([]);
  const [verses, setVerses] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

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
    const onDocClick = (e) => {
      if (editorRef.current && !editorRef.current.parentNode.contains(e.target)) setSuggestions([]);
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

  const pickSuggestion = (verset) => {
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
    setAllahCards(seventh ? buildAllahCards(seventh, asma, intent) : []);
    setSuggestions([]);
  }, [ensureAccess, asma, intent]);

  const r = computed?.results;

  return (
    <div className="rw-page">
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '12px 10px 40px' }}>
        <Link href="/" className="back-btn" style={{ direction: 'ltr' }}>
          ← Retour
        </Link>

        <div className="main-container">
          {/* Colonne gauche : saisie */}
          <div className="rw-left">
            <div className="input-container">
              <div
                id="editor"
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
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

            <div className="input-container">
              <input
                type="text"
                className="intent-select"
                placeholder="Saisissez votre vœu (ex: amour, richesse, protection...)"
                autoComplete="off"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
              />
            </div>

            <div className="button-row">
              <button className="primary-btn" onClick={onCalculate}>
                Calculer
              </button>
            </div>
          </div>

          {/* Colonne droite : résultats + noms générés */}
          <div className="rw-right">
            {!computed && (
              <div className="rw-hint">
                <div className="rw-hint-icon">🌙</div>
                <div className="rw-hint-title">Les noms des rouwhanes apparaîtront ici</div>
                <div className="rw-hint-text">
                  Saisissez un nom, précisez votre vœu, puis lancez « Calculer » pour révéler la génération complète.
                </div>
              </div>
            )}

            {/* Blocs de calcul intermédiaires — réservés au super-admin */}
            {isAdmin && computed && (
              <>
                <div className="result-box">
                  <span className="total-indicator" dir="ltr">
                    {formatNumber(computed.secondLength)}
                  </span>
                  <div className="scroll-text">{computed.exp2}</div>
                </div>
                <div className="result-box">
                  <span className="total-indicator" dir="ltr">
                    {formatNumber(computed.trois)}
                  </span>
                  <div className="scroll-text">{computed.exp3}</div>
                </div>
                <div className="stats-footer">
                  <div className="stat-line">
                    <span>{`${computed.stock} × ${computed.textLen} = ${r.v1m1}`}</span>
                    <span>{`${r.v1m1} × ${computed.textLen} = ${r.v1m2}`}</span>
                  </div>
                  <div className="stat-line">
                    <span>{`${computed.secondLength} × ${computed.len2} = ${r.v2m1}`}</span>
                    <span>{`${r.v2m1} × ${computed.len2} = ${r.v2m2}`}</span>
                  </div>
                  <div className="stat-line">
                    <span>{`${computed.trois} × ${computed.len3} = ${r.v3m1}`}</span>
                    <span>{`${r.v3m1} × ${computed.len3} = ${r.v3m2}`}</span>
                  </div>
                  <div className="total-final">
                    المجموع: <bdi dir="ltr">{formatNumber(r.total)}</bdi>
                  </div>
                </div>
              </>
            )}

            {/* Noms des rouwhanes */}
            {angels.length > 0 && (
              <div className="angel-names-container">
                <h3>Les noms des rouwhanes</h3>
                <div className="angel-names-list">
                  {angels.map((a, i) => (
                    <div className="angel-row" key={i}>
                      <span className="angel-number" dir="ltr">
                        {formatNumber(a.num)}
                      </span>
                      <span className="angel-arabic">{a.arabic}</span>
                      <span className="angel-transcript">{a.transcript}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Noms d'Allah correspondants */}
            {allahCards.length > 0 && (
              <div className="angel-names-container" style={{ borderTop: '2px dashed #f39c12', marginTop: 15 }}>
                <h3 style={{ color: '#d35400' }}>Les noms d'Allah qui vont avec</h3>
                <div className="angel-names-list">
                  {allahCards.map((c, i) => (
                    <AllahCard key={i} card={c} />
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

function MixedBlock({ text }) {
  return mixedSegments(text).map((seg, i) => (
    <div key={i} className={seg.dir === 'rtl' ? 'mixed-rtl' : 'mixed-ltr'} dir={seg.dir}>
      {seg.text}
    </div>
  ));
}

function AllahCard({ card }) {
  const { char, data } = card;
  if (!data) {
    return (
      <div className="allah-card-empty">
        <span>لا يوجد اسم مناسب لهذا الحرف</span>
        <span className="allah-card-letter">{char}</span>
      </div>
    );
  }
  return (
    <div className="allah-card">
      <div className="allah-card-head">
        <span className="allah-card-name">{data.name}</span>
        <span className="allah-card-letter">{char}</span>
      </div>
      <div className="allah-card-body">
        <div className="allah-card-translit" dir="ltr">
          {data.translit || ''}
        </div>
        <div style={{ marginBottom: 15, width: '100%' }}>
          <div className="allah-card-section-title sens">المعنى / Sens</div>
          <MixedBlock text={data.meaning} />
        </div>
        <div style={{ width: '100%' }}>
          <div className="allah-card-section-title secret">السر / Secret</div>
          <MixedBlock text={data.benefit} />
        </div>
      </div>
    </div>
  );
}
