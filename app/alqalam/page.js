'use client';
// Module « Al-Qalam » — port de alqalam/index.html + app.js.
// Outil de calligraphie : saisie arabe, répétition, aperçu coloré live, mode
// Rasm, recherche, intercalation de sourates, cumul de blocs et export Word
// (.docx). La logique vit dans lib/alqalam.js ; ici l'UI React et les effets.
// Les fonctionnalités premium passent par ensureAccess.
import './alqalam.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccess } from '@/components/AccessProvider';
import {
  config,
  buildPreview,
  formaterTexteIntercale,
  buildIntercalatedText,
  generateDocx,
  loadSourates,
  loadVersets,
} from '@/lib/alqalam';

const savePref = (k, v) => {
  try {
    localStorage.setItem('cali_' + k, v);
  } catch {}
};
const getPref = (k) => {
  try {
    return localStorage.getItem('cali_' + k);
  } catch {
    return null;
  }
};

export default function AlQalamPage() {
  const { ensureAccess } = useAccess();

  const [inputText, setInputText] = useState('');
  const [repCount, setRepCount] = useState('100');
  const [fontSize, setFontSize] = useState(28);

  const [baseText, setBaseText] = useState('');
  const [totalMultiplier, setTotalMultiplier] = useState(0);
  const [intercalatedPhrase, setIntercalatedPhrase] = useState('');
  const [isRasmMode, setIsRasmMode] = useState(false);

  const [accumulatedBlocks, setAccumulatedBlocks] = useState([]);
  const [docName, setDocName] = useState('');

  const [showDoc, setShowDoc] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showIntercaler, setShowIntercaler] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [sourates, setSourates] = useState([]);
  const [souratesContent, setSouratesContent] = useState({});
  const [versets, setVersets] = useState([]);
  const [interKey, setInterKey] = useState('');

  const [suggestions, setSuggestions] = useState([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [progress, setProgress] = useState(null);
  const [toast, setToast] = useState(null);

  const inputRef = useRef(null);
  const sugTimer = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Préférences + données au montage.
  useEffect(() => {
    const rc = getPref('repCount');
    if (rc !== null) setRepCount(rc);
    const fs = getPref('fontSize');
    if (fs !== null) setFontSize(parseInt(fs, 10) || 28);
    const dn = getPref('docName');
    if (dn !== null) setDocName(dn);
    // Le mode Rasm n'est réactivé qu'après vérification d'accès (au clic).

    loadSourates().then((s) => {
      setSourates(s.list);
      setSouratesContent(s.content);
      if (s.offline) showToast('Mode hors-ligne : sourates chargées depuis le cache', 'info');
    });
    loadVersets().then(setVersets);
  }, [showToast]);

  const preview = useMemo(
    () => buildPreview({ baseText, totalMultiplier, intercalatedPhrase, isRasmMode, searchTerm }),
    [baseText, totalMultiplier, intercalatedPhrase, isRasmMode, searchTerm]
  );

  // ─── Suggestions de versets (debounce) ───
  const onInput = (v) => {
    setInputText(v);
    clearTimeout(sugTimer.current);
    sugTimer.current = setTimeout(() => {
      const q = v.trim();
      if (q.length < 2) return setSuggestions([]);
      setSuggestions(versets.filter((x) => x.includes(q)).slice(0, 10));
    }, config.DEBOUNCE_DELAY);
  };

  // ─── Panneau d'outils (sélecteur unique, protégé) ───
  const activeTool = showDoc ? 'doc' : showSearch ? 'search' : showIntercaler ? 'intercaler' : isRasmMode ? 'rasm' : '';
  const onToolSelect = async (value) => {
    if (!value) {
      setShowDoc(false);
      setShowSearch(false);
      setShowIntercaler(false);
      if (isRasmMode) {
        setIsRasmMode(false);
        savePref('isRasmMode', 'false');
      }
      return;
    }
    const ok = await ensureAccess();
    if (!ok) return;
    setShowDoc(value === 'doc');
    setShowSearch(value === 'search');
    setShowIntercaler(value === 'intercaler');
    if (value === 'rasm') {
      setIsRasmMode(true);
      savePref('isRasmMode', 'true');
    } else if (isRasmMode) {
      setIsRasmMode(false);
      savePref('isRasmMode', 'false');
    }
  };

  // ─── Écrire (protégé) ───
  const onWrite = async () => {
    const ok = await ensureAccess();
    if (!ok) return;
    const text = inputText.trim();
    const count = parseInt(repCount, 10);
    if (!text || isNaN(count) || count <= 0) return;
    setBaseText(text);
    setTotalMultiplier(Math.min(count, config.MAX_TOTAL_REPEAT));
    setIntercalatedPhrase('');
  };

  // ─── Intercalation (protégé) ───
  const onIntercaler = async () => {
    const ok = await ensureAccess();
    if (!ok) return;
    const phrase = inputText.trim();
    if (!interKey || !phrase) {
      return showToast("Choisissez une sourate et saisissez l'expression dans la zone de texte.", 'error');
    }
    const rep = Math.max(1, Math.min(parseInt(repCount, 10) || 1, config.MAX_TOTAL_REPEAT));
    const result = buildIntercalatedText(souratesContent[interKey], phrase, rep);
    setBaseText(result);
    setIntercalatedPhrase(phrase);
    setTotalMultiplier(1);
    setShowIntercaler(false);
    showToast('Texte combiné généré.', 'info');
  };

  // ─── Cumuler (protégé) ───
  const onAddTemp = async () => {
    const ok = await ensureAccess();
    if (!ok) return;
    if (!baseText || totalMultiplier === 0) {
      return showToast("Générez d'abord un texte avant de l'ajouter.", 'error');
    }
    const block = {
      texte: ' ' + formaterTexteIntercale(baseText, intercalatedPhrase) + ' ',
      totalMultiplier,
      isRasmMode,
    };
    setAccumulatedBlocks((prev) => {
      const next = [...prev, block];
      showToast(`Ajouté ! (${next.length} bloc(s) en attente)`, 'info');
      return next;
    });
  };
  const onClearTemp = () => {
    if (accumulatedBlocks.length === 0) return;
    setAccumulatedBlocks([]);
    showToast('Le document temporaire a été vidé.', 'info');
  };

  // ─── Génération Word (protégé) ───
  const onDoc = async () => {
    const ok = await ensureAccess();
    if (!ok) return;
    if (!docName.trim() || (totalMultiplier === 0 && accumulatedBlocks.length === 0)) {
      return showToast('Générez un texte ou cumulez des blocs, et nommez le document.', 'error');
    }
    setPopupOpen(true);
  };

  const triggerDocx = async (useOuv, useFerm) => {
    setPopupOpen(false);
    const blocks =
      accumulatedBlocks.length > 0
        ? accumulatedBlocks
        : [{ texte: formaterTexteIntercale(baseText, intercalatedPhrase), totalMultiplier, isRasmMode }];
    setProgress({ pct: 0, text: 'Préparation...' });
    try {
      await generateDocx({
        useOuv,
        useFerm,
        blocks,
        docName: docName.trim(),
        fontPx: fontSize,
        onProgress: (pct, text) => setProgress({ pct, text }),
      });
      showToast('Document Word généré (compatible WPS Office).', 'info');
    } catch (e) {
      showToast('Échec de la génération Word.', 'error');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="alq-page">
      <div className="bg-shape shape1" />
      <div className="bg-shape shape2" />

      <div className="app-container">
        {/* Panneau de contrôle */}
        <div className="controls-section">
          <div style={{ position: 'relative', width: '100%' }}>
            <textarea
              ref={inputRef}
              className="glass-input top-textarea"
              placeholder="يحبونهم كحب الله..."
              aria-label="Zone de saisie du texte arabe"
              value={inputText}
              onChange={(e) => onInput(e.target.value)}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
            />
            {suggestions.length > 0 && (
              <div className="suggestions-container show-panel" role="listbox">
                {suggestions.map((match, i) => (
                  <div
                    className="suggestion-item"
                    key={i}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setInputText(match);
                      setBaseText(match);
                      setSuggestions([]);
                    }}
                  >
                    {match}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid-row-2-1">
            <input
              type="number"
              className="glass-input"
              placeholder="100"
              value={repCount}
              onChange={(e) => {
                setRepCount(e.target.value);
                savePref('repCount', e.target.value);
              }}
              aria-label="Nombre de répétitions de base"
              max={config.MAX_TOTAL_REPEAT}
            />
            <button className="btn-glass" onClick={onWrite}>
              Écrire
            </button>
          </div>

          <select
            className="glass-input"
            aria-label="Outils d'édition"
            value={activeTool}
            onChange={(e) => onToolSelect(e.target.value)}
          >
            <option value="">🛠️ Outils</option>
            <option value="doc">📄 Documents</option>
            <option value="search">🔍 Recherche</option>
            <option value="intercaler">🔗 Intercaler</option>
            <option value="rasm">✒️ Mode Rasm</option>
          </select>

          {showDoc && (
            <div className="hidden-panel show-panel">
              <input
                type="text"
                className="glass-input flex-grow"
                placeholder="Nom du document"
                value={docName}
                onChange={(e) => {
                  setDocName(e.target.value);
                  savePref('docName', e.target.value);
                }}
              />
              <button className="btn-glass" style={{ width: '100%' }} onClick={onDoc}>
                DOCS
              </button>
              <div className="grid-row-1-1" style={{ marginTop: 10 }}>
                <button className="btn-glass" style={{ background: 'linear-gradient(135deg, #2b5876, #4e4376)' }} onClick={onAddTemp}>
                  ➕ Cumuler
                </button>
                <button className="btn-glass" style={{ background: 'linear-gradient(135deg, #870000, #190a05)' }} onClick={onClearTemp}>
                  🗑️ Vider ({accumulatedBlocks.length})
                </button>
              </div>
            </div>
          )}

          {showSearch && (
            <div className="hidden-panel search-container glass-input show-panel">
              <input
                type="text"
                className="search-input-inner"
                placeholder="Mot à rechercher"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Rechercher un mot dans le texte"
              />
              <span className="search-count-text" aria-live="polite">
                {preview.searchCount != null
                  ? preview.searchCount > 0
                    ? `${preview.searchCount.toLocaleString('fr-FR')} trouvés`
                    : '0 trouvé'
                  : ''}
              </span>
            </div>
          )}

          {showIntercaler && (
            <div className="hidden-panel show-panel">
              <select
                className="glass-input"
                style={{ direction: 'rtl', fontFamily: "'Scheherazade New', serif" }}
                value={interKey}
                onChange={(e) => setInterKey(e.target.value)}
              >
                <option value="">{sourates.length ? 'Sélectionnez une sourate' : '⏳ Chargement des sourates...'}</option>
                {sourates.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: 'var(--text-gray)', margin: 0 }}>
                ✍️ Entre chaque verset, on insère l'expression de la zone de texte, <b>répétée</b> selon le nombre de « répétitions ».
              </p>
              <button className="btn-glass" style={{ width: '100%' }} onClick={onIntercaler}>
                Combiner le texte
              </button>
            </div>
          )}

          <div className="slider-container">
            <span className="slider-label">Taille du texte</span>
            <input
              type="range"
              className="slider"
              min="12"
              max="60"
              value={fontSize}
              onChange={(e) => {
                setFontSize(parseInt(e.target.value, 10));
                savePref('fontSize', e.target.value);
              }}
            />
          </div>
        </div>

        {/* Aperçu */}
        <div className="output-section">
          <div
            className="output-area glass-panel"
            style={{ fontSize: fontSize + 'px' }}
            aria-live="polite"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        </div>
      </div>

      {/* Popup options Word */}
      {popupOpen && (
        <div className="popup-overlay" onClick={(e) => e.target === e.currentTarget && setPopupOpen(false)}>
          <div className="popup-content glass-panel">
            <div style={{ textAlign: 'center', fontWeight: 600, marginBottom: 12, color: 'var(--accent-blue)' }}>
              📝 Générer le document Word (.docx)
            </div>
            <button className="popup-item" onClick={() => triggerDocx(true, true)}>
              Avec ouverture et fermeture
            </button>
            <button className="popup-item" onClick={() => triggerDocx(true, false)}>
              Avec ouverture seulement
            </button>
            <button className="popup-item" onClick={() => triggerDocx(false, true)}>
              Avec fermeture seulement
            </button>
            <button className="popup-item" onClick={() => triggerDocx(false, false)}>
              Sans ouverture ni fermeture
            </button>
          </div>
        </div>
      )}

      {/* Progression */}
      {progress && (
        <div className="popup-overlay">
          <div className="popup-content glass-panel" style={{ textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, color: 'var(--accent-blue)' }}>Génération en cours</h3>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: progress.pct + '%' }} />
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-gray)' }} aria-live="polite">
              {progress.text}
            </p>
          </div>
        </div>
      )}

      {toast && <div className={'toast-notification ' + (toast.type === 'error' ? 'toast-error' : 'toast-info')}>{toast.msg}</div>}
    </div>
  );
}
