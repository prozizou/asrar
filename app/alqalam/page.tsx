'use client';
// Module « Al-Qalam » — port de alqalam/index.html + app.js.
// Outil de calligraphie : saisie arabe, répétition, aperçu coloré live, mode
// Rasm, recherche, intercalation de sourates, cumul de blocs et export Word
// (.docx). La logique vit dans lib/alqalam.js ; ici l'UI React et les effets.
// Les fonctionnalités premium passent par ensureAccess(PREMIUM_LEVEL) : réservées
// au forfait 1 An (45 000 FCFA), comme la Géomancie.
//
// TypeScript (batch 7/7, dernière page de la conversion — cf. tsconfig.json) :
// AccBlock/EditDraft/Progress/Toast/Sourate sont des types locaux pour
// l'état React de cette page. lib/alqalam.js reste en .js (hors scope de ce
// batch) : ses valeurs de retour (preview, contenu Uthmani…) restent typées
// `any` en local plutôt que reproduites en interfaces (forme interne
// complexe, propre à ce module), même principe que les lib/*.js dans les
// batches précédents (#120, #122, #124). useAccess()/Spinner.js suivent le
// même traitement (cast) que dans les batches précédents.
import './alqalam.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAccess } from '@/components/AccessProvider';
import { PREMIUM_LEVEL } from '@/lib/access';
import SpinnerUntyped from '@/components/Spinner';
import {
  config,
  buildPreview,
  formaterTexteIntercale,
  buildIntercalatedText,
  generateDocx,
  generatePdf,
  loadSourates,
  loadVersets,
  htmlToPlainText,
  loadQuranUthmani,
  matchUthmaniSourate,
} from '@/lib/alqalam';

const Spinner = SpinnerUntyped as any;

const savePref = (k: string, v: string) => {
  try {
    localStorage.setItem('cali_' + k, v);
  } catch {}
};
const getPref = (k: string): string | null => {
  try {
    return localStorage.getItem('cali_' + k);
  } catch {
    return null;
  }
};

type WritingMode = 'simple' | 'intercalee' | 'rasmique' | null;

const MODE_LABELS: Record<Exclude<WritingMode, null>, string> = {
  simple: 'Écriture simple',
  intercalee: 'Écriture intercalée',
  rasmique: 'Écriture rasmique',
};

interface AccBlock {
  texte: string;
  totalMultiplier: number;
  isRasmMode: boolean;
}

interface EditDraft {
  texte: string;
  totalMultiplier: number | string;
  isRasmMode: boolean;
}

interface ProgressState {
  pct: number;
  text: string;
}

interface ToastState {
  msg: string;
  type: 'info' | 'error';
  id: number;
}

interface Sourate {
  key: string;
  name: string;
}

// Blocs cumulés ("➕ Cumuler") : sauvegardés à chaque changement pour ne rien
// perdre si l'utilisateur ferme l'onglet/l'app avant de générer le Word.
const ACC_KEY = 'cali_accumulated_blocks';
const loadAccumulated = (): AccBlock[] => {
  try {
    const raw = localStorage.getItem(ACC_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const saveAccumulated = (blocks: AccBlock[]) => {
  try {
    if (blocks.length > 0) localStorage.setItem(ACC_KEY, JSON.stringify(blocks));
    else localStorage.removeItem(ACC_KEY);
  } catch {}
};

export default function AlQalamPage() {
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { ensureAccess } = useAccess() as unknown as {
    ensureAccess: (minLevel?: number) => Promise<boolean>;
  };

  // Menu de sélection préalable : quel type d'écriture ? null = pas encore choisi
  // (écran de choix affiché). 'simple' = répétition ; 'intercalee' = intercaler
  // avec les versets d'une sourate ; 'rasmique' = écriture sans points ni voyelles.
  const [writingMode, setWritingMode] = useState<WritingMode>(null);

  const [inputText, setInputText] = useState('');
  const [repCount, setRepCount] = useState('100');
  const [fontSize, setFontSize] = useState(28);

  const [baseText, setBaseText] = useState('');
  const [totalMultiplier, setTotalMultiplier] = useState(0);
  const [intercalatedPhrase, setIntercalatedPhrase] = useState('');
  const [isRasmMode, setIsRasmMode] = useState(false);

  const [accumulatedBlocks, setAccumulatedBlocks] = useState<AccBlock[]>([]);
  const [showAccList, setShowAccList] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ texte: '', totalMultiplier: 1, isRasmMode: false });
  const [docName, setDocName] = useState('');

  const [showDoc, setShowDoc] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [sourates, setSourates] = useState<Sourate[]>([]);
  const [souratesContent, setSouratesContent] = useState<Record<string, string>>({});
  const [versets, setVersets] = useState<string[]>([]);
  const [interKey, setInterKey] = useState('');

  // Version du texte pour l'intercalation : 'simple' (base existante, sans
  // voyelles) ou 'voyelles' (texte Uthmani complet, chargé depuis l'API à la
  // demande — voir chooseTextVersion). quranUthmani = null tant que rien n'a
  // encore été chargé.
  const [textVersion, setTextVersion] = useState<'simple' | 'voyelles'>('simple');
  const [quranUthmani, setQuranUthmani] = useState<any>(null);
  const [uthmaniLoading, setUthmaniLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupFormat, setPopupFormat] = useState<'docx' | 'pdf'>('docx'); // quel export le popup ouverture/fermeture déclenche
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sugTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string, type: 'info' | 'error' = 'info', duration = 3000) => {
    setToast({ msg, type, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), duration);
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

    const savedBlocks = loadAccumulated();
    if (savedBlocks.length > 0) {
      setAccumulatedBlocks(savedBlocks);
      showToast(`${savedBlocks.length} bloc(s) cumulé(s) restauré(s).`, 'info');
    }

    loadSourates().then((s: any) => {
      setSourates(s.list);
      setSouratesContent(s.content);
      if (s.offline) showToast('Mode hors-ligne : sourates chargées depuis le cache', 'info');
    });
    loadVersets().then(setVersets);
  }, [showToast]);

  // Sauvegarde automatique des blocs cumulés à chaque changement (ajout/vidage).
  useEffect(() => {
    saveAccumulated(accumulatedBlocks);
  }, [accumulatedBlocks]);

  const preview = useMemo(
    () => buildPreview({ baseText, totalMultiplier, intercalatedPhrase, isRasmMode, searchTerm }),
    [baseText, totalMultiplier, intercalatedPhrase, isRasmMode, searchTerm]
  );

  // ─── Suggestions de versets (debounce) ───
  const onInput = (v: string) => {
    setInputText(v);
    clearTimeout(sugTimer.current);
    sugTimer.current = setTimeout(() => {
      const q = v.trim();
      if (q.length < 2) return setSuggestions([]);
      setSuggestions(versets.filter((x) => x.includes(q)).slice(0, 10));
    }, config.DEBOUNCE_DELAY);
  };

  // Ferme la liste de suggestions au clic/toucher en dehors — le seul repli
  // sur onBlur (délai de 150 ms) pouvait la laisser affichée si le blur du
  // textarea ne se déclenchait pas comme attendu (notamment tactile).
  useEffect(() => {
    if (suggestions.length === 0) return undefined;
    const onOutside = (e: Event) => {
      const wrap = inputRef.current && inputRef.current.parentElement;
      if (wrap && !wrap.contains(e.target as Node)) setSuggestions([]);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [suggestions.length]);

  // ─── Panneau d'outils (Documents / Recherche — sélecteur unique, protégé).
  // Intercaler et Mode Rasm sont désormais choisis en amont via le menu de
  // sélection (writingMode), pas ici. ───
  const activeTool = showDoc ? 'doc' : showSearch ? 'search' : '';
  const onToolSelect = async (value: string) => {
    if (!value) {
      setShowDoc(false);
      setShowSearch(false);
      return;
    }
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    setShowDoc(value === 'doc');
    setShowSearch(value === 'search');
  };

  // ─── Menu de sélection du type d'écriture (précède l'outil) ───
  const selectWritingMode = async (mode: Exclude<WritingMode, null>) => {
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    setWritingMode(mode);
    const rasm = mode === 'rasmique';
    setIsRasmMode(rasm);
    savePref('isRasmMode', String(rasm));
  };

  const changeWritingMode = () => {
    setWritingMode(null);
    setIsRasmMode(false);
    savePref('isRasmMode', 'false');
    setShowDoc(false);
    setShowSearch(false);
  };

  // ─── Écrire (protégé) ───
  const onWrite = async () => {
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    const text = inputText.trim();
    const count = parseInt(repCount, 10);
    if (!text || isNaN(count) || count <= 0) return;
    setBaseText(text);
    setTotalMultiplier(Math.min(count, config.MAX_TOTAL_REPEAT));
    setIntercalatedPhrase('');
  };

  // ─── Intercalation (protégé) ───
  // Bascule vers la version « avec voyelles » : charge le texte Uthmani
  // complet (API, une seule fois — voir loadQuranUthmani) au premier besoin.
  // En cas d'échec (hors-ligne, API injoignable), on revient à « simple ».
  const chooseTextVersion = async (version: 'simple' | 'voyelles') => {
    setTextVersion(version);
    if (version !== 'voyelles' || quranUthmani || uthmaniLoading) return;
    setUthmaniLoading(true);
    const data = await loadQuranUthmani();
    setUthmaniLoading(false);
    if (!data) {
      showToast('Texte avec voyelles indisponible (hors-ligne ou API injoignable). Version simple conservée.', 'error');
      setTextVersion('simple');
      return;
    }
    setQuranUthmani(data);
  };

  // Résout le contenu de la sourate sélectionnée selon la version choisie
  // (sans/avec voyelles) — commun à « Combiner le texte » et « Sourate seule ».
  const resolveSourateContent = (): { content?: string; error?: string } => {
    let content = souratesContent[interKey];
    if (textVersion === 'voyelles') {
      if (!quranUthmani) {
        return { error: 'Chargement du texte avec voyelles en cours, réessayez dans un instant.' };
      }
      const sourateName = sourates.find((s) => s.key === interKey)?.name;
      const matched = matchUthmaniSourate(quranUthmani, sourateName);
      if (!matched) {
        showToast("Version avec voyelles introuvable pour cette sourate, texte simple utilisé.", 'error');
      } else {
        content = matched;
      }
    }
    return { content };
  };

  const onIntercaler = async () => {
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    const phrase = inputText.trim();
    if (!interKey || !phrase) {
      return showToast("Choisissez une sourate et saisissez l'expression dans la zone de texte.", 'error');
    }
    const { content, error } = resolveSourateContent();
    if (error) return showToast(error, 'error');
    const rep = Math.max(1, Math.min(parseInt(repCount, 10) || 1, config.MAX_TOTAL_REPEAT));
    const result = buildIntercalatedText(content, phrase, rep);
    setBaseText(result);
    setIntercalatedPhrase(phrase);
    setTotalMultiplier(1);
    showToast('Texte combiné généré.', 'info');
  };

  // ─── Sourate seule, sans intercalation (protégé) ───
  // Réutilise buildIntercalatedText avec une phrase vide : les marqueurs de
  // verset sont retirés (même nettoyage que l'intercalation) sans rien
  // insérer entre les versets. Le nombre de « répétitions » s'applique alors
  // à la sourate entière (comme en Écriture simple), pas à une phrase.
  const onSourateSeule = async () => {
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    if (!interKey) {
      return showToast('Choisissez une sourate.', 'error');
    }
    const { content, error } = resolveSourateContent();
    if (error) return showToast(error, 'error');
    const rep = Math.max(1, Math.min(parseInt(repCount, 10) || 1, config.MAX_TOTAL_REPEAT));
    const result = buildIntercalatedText(content, '', 0);
    setBaseText(result);
    setIntercalatedPhrase('');
    setTotalMultiplier(rep);
    showToast('Sourate insérée.', 'info');
  };

  // ─── Cumuler (protégé) ───
  const onAddTemp = async () => {
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    if (!baseText || totalMultiplier === 0) {
      return showToast("Générez d'abord un texte avant de l'ajouter.", 'error');
    }
    const block: AccBlock = {
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
    setEditingIndex(null);
    setAccumulatedBlocks([]);
    showToast('Le document temporaire a été vidé.', 'info');
  };

  // ─── Liste des blocs cumulés : réordonner, modifier, supprimer ───
  const moveBlock = (index: number, dir: number) => {
    setEditingIndex(null);
    setAccumulatedBlocks((prev) => {
      const to = index + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const removeBlock = (index: number) => {
    setEditingIndex(null);
    setAccumulatedBlocks((prev) => prev.filter((_, i) => i !== index));
    showToast('Bloc supprimé.', 'info');
  };

  const startEdit = (index: number) => {
    const block = accumulatedBlocks[index];
    setEditDraft({
      texte: htmlToPlainText(block.texte).trim(),
      totalMultiplier: block.totalMultiplier,
      isRasmMode: !!block.isRasmMode,
    });
    setEditingIndex(index);
  };

  const cancelEdit = () => setEditingIndex(null);

  const saveEdit = () => {
    const texte = editDraft.texte.trim();
    if (!texte) return showToast('Le texte du bloc ne peut pas être vide.', 'error');
    const rep = Math.max(1, Math.min(parseInt(String(editDraft.totalMultiplier), 10) || 1, config.MAX_TOTAL_REPEAT));
    setAccumulatedBlocks((prev) =>
      prev.map((b, i) =>
        i === editingIndex ? { texte: ' ' + texte + ' ', totalMultiplier: rep, isRasmMode: editDraft.isRasmMode } : b
      )
    );
    setEditingIndex(null);
    showToast('Bloc mis à jour.', 'info');
  };

  // ─── Génération Word / PDF (protégé) ───
  const openExportPopup = async (format: 'docx' | 'pdf') => {
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    if (!docName.trim() || (totalMultiplier === 0 && accumulatedBlocks.length === 0)) {
      return showToast('Générez un texte ou cumulez des blocs, et nommez le document.', 'error');
    }
    setPopupFormat(format);
    setPopupOpen(true);
  };
  const onDoc = () => openExportPopup('docx');
  const onPdf = () => openExportPopup('pdf');

  const currentBlocks = (): AccBlock[] =>
    accumulatedBlocks.length > 0
      ? accumulatedBlocks
      : [{ texte: formaterTexteIntercale(baseText, intercalatedPhrase), totalMultiplier, isRasmMode }];

  const triggerDocx = async (useOuv: boolean, useFerm: boolean) => {
    setPopupOpen(false);
    setProgress({ pct: 0, text: 'Préparation...' });
    try {
      await generateDocx({
        useOuv,
        useFerm,
        blocks: currentBlocks(),
        docName: docName.trim(),
        fontPx: fontSize,
        onProgress: (pct: number, text: string) => setProgress({ pct, text }),
      });
      showToast('Document Word généré (compatible WPS Office).', 'info');
    } catch (e) {
      showToast('Échec de la génération Word.', 'error');
    } finally {
      setProgress(null);
    }
  };

  const triggerPdf = async (useOuv: boolean, useFerm: boolean) => {
    setPopupOpen(false);
    setProgress({ pct: 0, text: 'Préparation...' });
    try {
      await generatePdf({
        useOuv,
        useFerm,
        blocks: currentBlocks(),
        docName: docName.trim(),
        onProgress: (pct: number, text: string) => setProgress({ pct, text }),
      });
      showToast(
        'Boîte de dialogue d’impression ouverte — choisissez « Enregistrer en PDF », puis activez « En-têtes et pieds de page » dans « Plus de paramètres » pour la numérotation.',
        'info',
        7000
      );
    } catch (e) {
      showToast('Échec de la préparation du PDF.', 'error');
    } finally {
      setProgress(null);
    }
  };

  const triggerExport = (useOuv: boolean, useFerm: boolean) =>
    popupFormat === 'pdf' ? triggerPdf(useOuv, useFerm) : triggerDocx(useOuv, useFerm);

  return (
    <div className="alq-page">
      <div className="bg-shape shape1" />
      <div className="bg-shape shape2" />

      <div className="app-container">
        <Link href="/" className="back-btn">
          ← Retour
        </Link>

        {/* Panneau de contrôle */}
        <div className="controls-section">
          {writingMode === null ? (
            // Menu de sélection : quel type d'écriture ? Précède l'outil —
            // évite d'atterrir directement sur un formulaire générique avec un
            // sélecteur « Outils » qui mélangeait des choses très différentes.
            <div className="mode-picker">
              <div className="mode-card" onClick={() => selectWritingMode('simple')}>
                <span className="mode-card-icon">🔁</span>
                <div className="mode-card-title">Écriture simple</div>
                <div className="mode-card-desc">Répéter un texte un certain nombre de fois.</div>
              </div>
              <div className="mode-card" onClick={() => selectWritingMode('intercalee')}>
                <span className="mode-card-icon">🔗</span>
                <div className="mode-card-title">Écriture intercalée</div>
                <div className="mode-card-desc">Insérer un texte entre les versets d'une sourate.</div>
              </div>
              <div className="mode-card" onClick={() => selectWritingMode('rasmique')}>
                <span className="mode-card-icon">✒️</span>
                <div className="mode-card-title">Écriture rasmique</div>
                <div className="mode-card-desc">Écriture sans points ni voyelles (rasm).</div>
              </div>
            </div>
          ) : (
            <>
              <div className="mode-current">
                <span>
                  Mode : <strong>{MODE_LABELS[writingMode]}</strong>
                </span>
                <button type="button" className="mode-change-btn" onClick={changeWritingMode}>
                  ↺ Changer
                </button>
              </div>

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

              {writingMode === 'intercalee' && (
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

                  <div className="version-toggle" role="radiogroup" aria-label="Version du texte de la sourate">
                    <button
                      type="button"
                      className={'version-btn' + (textVersion === 'simple' ? ' active' : '')}
                      onClick={() => chooseTextVersion('simple')}
                    >
                      Sans voyelles
                    </button>
                    <button
                      type="button"
                      className={'version-btn' + (textVersion === 'voyelles' ? ' active' : '')}
                      onClick={() => chooseTextVersion('voyelles')}
                    >
                      {uthmaniLoading ? (
                        <>
                          <Spinner /> Chargement…
                        </>
                      ) : (
                        'Avec voyelles'
                      )}
                    </button>
                  </div>

                  <p style={{ fontSize: 12, color: 'var(--text-gray)', margin: 0 }}>
                    ✍️ Entre chaque verset, on insère l'expression de la zone de texte, <b>répétée</b> selon le nombre de
                    « répétitions ».
                    {textVersion === 'voyelles' && ' Texte Uthmani complet (source : alquran.cloud).'}
                  </p>
                  <button className="btn-glass" style={{ width: '100%' }} onClick={onIntercaler}>
                    Combiner le texte
                  </button>
                  <button
                    type="button"
                    className="btn-glass-outline"
                    style={{ width: '100%' }}
                    onClick={onSourateSeule}
                    title="Insère la sourate seule, sans y intercaler d'expression"
                  >
                    📖 Sourate seule (sans intercaler)
                  </button>
                </div>
              )}

              <select
                className="glass-input"
                aria-label="Outils d'édition"
                value={activeTool}
                onChange={(e) => onToolSelect(e.target.value)}
              >
                <option value="">🛠️ Outils</option>
                <option value="doc">📄 Documents</option>
                <option value="search">🔍 Recherche</option>
              </select>

              {showDoc && (
                <div className="hidden-panel show-panel">
                  <div className="doc-name-row">
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
                    <button className="btn-glass" onClick={onDoc}>
                      DOCS
                    </button>
                    <button className="btn-glass" onClick={onPdf}>
                      PDF
                    </button>
                  </div>
                  <div className="grid-row-1-1">
                    <button className="btn-glass" style={{ background: 'linear-gradient(135deg, #2b5876, #4e4376)' }} onClick={onAddTemp}>
                      ➕ Cumuler
                    </button>
                    <button className="btn-glass" style={{ background: 'linear-gradient(135deg, #870000, #190a05)' }} onClick={onClearTemp}>
                      🗑️ Vider ({accumulatedBlocks.length})
                    </button>
                  </div>

                  {accumulatedBlocks.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="btn-glass"
                        style={{ width: '100%', marginTop: 10, background: 'rgba(255,255,255,.08)' }}
                        onClick={() => setShowAccList((v) => !v)}
                      >
                        {showAccList ? '▲' : '▼'} Blocs cumulés ({accumulatedBlocks.length})
                      </button>

                      {showAccList && (
                        <div className="acc-list">
                          {accumulatedBlocks.map((block, i) => (
                            <div className="acc-item" key={i}>
                              {editingIndex === i ? (
                                <>
                                  <textarea
                                    className="glass-input acc-edit-textarea"
                                    value={editDraft.texte}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, texte: e.target.value }))}
                                    aria-label={`Texte du bloc ${i + 1}`}
                                  />
                                  <div className="acc-edit-row">
                                    <input
                                      type="number"
                                      className="glass-input"
                                      style={{ maxWidth: 110 }}
                                      value={editDraft.totalMultiplier}
                                      min={1}
                                      max={config.MAX_TOTAL_REPEAT}
                                      onChange={(e) => setEditDraft((d) => ({ ...d, totalMultiplier: e.target.value }))}
                                      aria-label={`Répétitions du bloc ${i + 1}`}
                                    />
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-gray)' }}>
                                      <input
                                        type="checkbox"
                                        checked={editDraft.isRasmMode}
                                        onChange={(e) => setEditDraft((d) => ({ ...d, isRasmMode: e.target.checked }))}
                                      />
                                      Mode Rasm
                                    </label>
                                  </div>
                                  <div className="acc-item-actions">
                                    <button type="button" className="acc-btn" onClick={saveEdit}>
                                      💾 Enregistrer
                                    </button>
                                    <button type="button" className="acc-btn" onClick={cancelEdit}>
                                      ✖️ Annuler
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="acc-item-head">
                                    <span className="acc-item-index">{i + 1}.</span>
                                    <span className="acc-item-text">{htmlToPlainText(block.texte)}</span>
                                  </div>
                                  <span className="acc-item-meta">
                                    ×{Number(block.totalMultiplier || 0).toLocaleString('fr-FR')}
                                    {block.isRasmMode ? ' · ✒️ Rasm' : ''}
                                  </span>
                                  <div className="acc-item-actions">
                                    <button
                                      type="button"
                                      className="acc-btn"
                                      onClick={() => moveBlock(i, -1)}
                                      disabled={i === 0}
                                      aria-label={`Monter le bloc ${i + 1}`}
                                    >
                                      ⬆️
                                    </button>
                                    <button
                                      type="button"
                                      className="acc-btn"
                                      onClick={() => moveBlock(i, 1)}
                                      disabled={i === accumulatedBlocks.length - 1}
                                      aria-label={`Descendre le bloc ${i + 1}`}
                                    >
                                      ⬇️
                                    </button>
                                    <button type="button" className="acc-btn" onClick={() => startEdit(i)}>
                                      ✏️ Modifier
                                    </button>
                                    <button type="button" className="acc-btn acc-btn-danger" onClick={() => removeBlock(i)}>
                                      🗑️ Supprimer
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
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
            </>
          )}
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

      {/* Popup options Word / PDF — même choix ouverture/fermeture pour les deux formats. */}
      {popupOpen && (
        <div className="popup-overlay" onClick={(e) => e.target === e.currentTarget && setPopupOpen(false)}>
          <div className="popup-content glass-panel">
            <div style={{ textAlign: 'center', fontWeight: 600, marginBottom: 12, color: 'var(--accent-blue)' }}>
              {popupFormat === 'pdf' ? '📄 Générer le document PDF' : '📝 Générer le document Word (.docx)'}
            </div>
            <button className="popup-item" onClick={() => triggerExport(true, true)}>
              Avec ouverture et fermeture
            </button>
            <button className="popup-item" onClick={() => triggerExport(true, false)}>
              Avec ouverture seulement
            </button>
            <button className="popup-item" onClick={() => triggerExport(false, true)}>
              Avec fermeture seulement
            </button>
            <button className="popup-item" onClick={() => triggerExport(false, false)}>
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
