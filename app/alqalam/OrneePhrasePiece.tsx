'use client';
// Rendu de l'outil Ornement (disponible dans les trois modes d'écriture) :
// plusieurs boucles dans une même phrase (ex. la basmala avec م et ه
// gonflés), chacune contenant le même vœu. La mise en page vient de
// composePhrasePages (lib/alqalamOrne.js), la géométrie de vectorizePage
// (lib/alqalamVector.js) : ce composant ne fait que les afficher — SUR UNE
// OU PLUSIEURS PAGES, empilées pour l'aperçu (voir alqalam.css .orne-pages).
//
// TOUT est vectoriel : les lettres sont converties en contours par le moteur
// de formes (lib/alqalamShaper.js, HarfBuzz + la police), boucles et
// liaisons fusionnées en une seule forme. L'aperçu affiche exactement le
// balisage SVG que l'export PDF vectoriel (lib/alqalamPdf.js) transcrit.
//
// Chaque page n'est vectorisée qu'à l'approche de l'écran : un ouvrage de
// plusieurs dizaines de pages reste fluide ; l'export complète les pages
// manquantes lui-même.
//
// Pièce TOUJOURS à l'encre noire sur fond blanc, quel que soit le thème de
// l'app : l'aperçu doit montrer exactement ce qui sortira à l'impression.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { TriangleAlert, LoaderCircle } from 'lucide-react';
import { PHRASE_PIECE } from '@/lib/alqalamOrne';
import { createOrnementClient } from '@/lib/alqalamOrnementClient';

interface OrnementSegment {
  /** Texte de ce segment (ouverture, X ou fermeture). */
  text: string;
  /** Lettres gonflées dans CE segment seulement — vide pour un segment qui
   *  doit rester du texte naturel (ouverture/fermeture). */
  letters: string[];
}

interface OrneePhrasePieceProps {
  /** Phrase porteuse, en arabe (plusieurs mots) — sert de repli et d'aria-label. */
  phrase: string;
  /** Lettres dont CHAQUE occurrence est gonflée en boucle (م ه ص ض ط). */
  letters: string[];
  /** Vœu ou verset, répété dans chaque boucle. */
  innerText: string;
  /** Ouverture/X/fermeture, chacun avec son propre jeu de lettres à gonfler
   *  (typiquement vide pour ouverture/fermeture) — voir composePhrasePages.
   *  Prend le pas sur `phrase`/`letters` quand fourni. */
  segments?: OrnementSegment[];
  /** Échelle commune du vœu et des lettres gonflées (1 = automatique). */
  scale?: number;
}

export interface OrneePhrasePieceHandle {
  /** Exporte toutes les pages en PDF vectoriel A4 portrait. */
  exportPdf: (docName: string, onProgress?: (pct: number, text: string) => void) => Promise<void>;
}

type Engine = ReturnType<typeof createOrnementClient>;
type Prepared = { input: object; engine: Engine; piece: any };

/** Une page proche de l'écran, calculée hors de l'interface. */
function OrnePage({ index, count, label, render }: { index: number; count: number; label: string; render: () => Promise<string> }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(index < 2);
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!holder.current) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(entries => {
      setVisible(entries.some(entry => entry.isIntersecting));
    }, { rootMargin: '800px 0px' });
    io.observe(holder.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    let alive = true;
    setSvg(''); setFailed(false);
    if (visible) render().then(markup => { if (alive) setSvg(markup); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [visible, render]);
  return <div className="orne-page">
    {count > 1 && <p className="orne-page-label">Page {index + 1} / {count}</p>}
    <div ref={holder} className="orne-svg-holder">
      {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="orne-svg orne-svg-pending" aria-label={label} role="img" />}
      {failed && <p className="orne-hint" role="status">Cette page n’a pas pu être préparée. Rouvrez l’outil pour réessayer.</p>}
    </div>
  </div>;
}

const OrneePhrasePiece = forwardRef<OrneePhrasePieceHandle, OrneePhrasePieceProps>(function OrneePhrasePiece(
  { phrase, letters, innerText, segments, scale = 1 }, ref
) {
  const input = useMemo(() => ({ phrase, letters, innerText, segments, scale }), [phrase, letters, innerText, segments, scale]);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [failure, setFailure] = useState<object | null>(null);
  const jobRef = useRef<{ input: object; ready: Promise<Prepared> } | null>(null);
  useEffect(() => {
    let alive = true, engine: Engine | null = null;
    let resolveReady!: (value: Prepared) => void, rejectReady!: (error: Error) => void;
    const ready = new Promise<Prepared>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    // Cette promesse est aussi attendue par l'export. Sans export en cours,
    // son annulation doit rester silencieuse.
    ready.catch(() => {});
    jobRef.current = { input, ready };
    setFailure(null); setPrepared(null);
    const timer = setTimeout(async () => {
      try {
        engine = createOrnementClient();
        const piece = await engine.compose(input);
        const value = { input, engine, piece };
        if (alive) { setPrepared(value); resolveReady(value); }
      } catch (error) {
        engine?.dispose();
        if (alive) { setFailure(input); rejectReady(error instanceof Error ? error : new Error('Calcul indisponible.')); }
      }
    }, 200);
    return () => {
      alive = false; clearTimeout(timer); engine?.dispose();
      rejectReady(Object.assign(new Error('Composition annulée.'), { name: 'AbortError' }));
    };
  }, [input]);
  const current = prepared?.input === input ? prepared : null;
  const piece = current?.piece;
  const loadError = failure === input;
  // Le libellé accessible ne recopie pas l'ouvrage entier dans chaque SVG.
  const label = phrase.trim().slice(0, 160) || 'sans phrase';
  const renderers = useMemo(() => (current?.piece.pages || []).map((_: unknown, index: number) =>
    () => current!.engine.svg(index, `Pièce calligraphique : ${label} — page ${index + 1} sur ${current!.piece.pages.length}`)
  ), [current, label]);
  useImperativeHandle(ref, () => ({
    exportPdf: async (docName, onProgress) => {
      const job = jobRef.current;
      if (!job || job.input !== input) throw new Error('Le moteur calligraphique n’est pas encore prêt.');
      onProgress?.(0, 'Préparation de la composition…');
      const { piece: composed, engine: active } = await job.ready;
      if (composed.overflowReason === 'vow') throw new Error('Le vœu est trop long pour les boucles. Raccourcissez-le avant l’export PDF.');
      if (composed.overflowReason === 'pages') throw new Error(`Le texte dépasse ${PHRASE_PIECE.MAX_PAGES} pages. Réduisez les répétitions avant l’export PDF.`);
      if (!composed.pages.length) throw new Error('Un mot est trop large pour une page A4. Raccourcissez-le avant l’export PDF.');
      const { exportOrnementPdf } = await import('@/lib/alqalamPdf');
      await exportOrnementPdf({ pageCount: composed.pages.length, getPage: active.vector, docName, label, onProgress });
    },
  }), [input, label]);

  if (loadError) {
    return <div className="orne-loading"><TriangleAlert size={16} aria-hidden="true" /> Impossible de préparer la pièce calligraphique. Vérifiez la connexion puis rouvrez l&apos;Ornement.</div>;
  }
  if (!piece) {
    return <div className="orne-loading"><LoaderCircle size={16} className="orne-spin" aria-hidden="true" /> Préparation de la pièce calligraphique…</div>;
  }

  return (
    <div className="orne-pages">
      <p className="orne-format" dir="ltr">A4 portrait · 210 × 297 mm · Marges 0,5 cm · PDF vectoriel</p>
      {piece.vowFont > 0 && (
        <p className="orne-format" dir="ltr">
          Vœu : corps ≈ {((piece.vowFont * 210) / PHRASE_PIECE.W).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} mm
          {Math.abs(piece.scale - scale) > 0.05 &&
            (scale > piece.scale
              ? ` · taille maximale pour la page atteinte (${Math.round(piece.scale * 100)} %)`
              : ` · taille minimale pour contenir le vœu (${Math.round(piece.scale * 100)} %)`)}
        </p>
      )}
      {piece.pages.length === 0 ? (
        // N'arrive que sur un débordement 'layout' (un jeton, à lui seul, ne
        // tient dans la largeur de page même au rayon plancher) : on montre
        // quand même une feuille vide plutôt qu'un trou dans l'aperçu.
        <div className="orne-page">
          <div className="orne-svg orne-svg-pending" aria-label="Pièce calligraphique : rien à afficher" role="img" />
        </div>
      ) : (
        piece.pages.map((_, pi) => (
          <OrnePage
            key={pi}
            index={pi}
            count={piece.pageCount}
            label={`Pièce calligraphique : ${label} — page ${pi + 1} sur ${piece.pageCount}`}
            render={renderers[pi]}
          />
        ))
      )}

      {piece.overflowReason === 'vow' && (
        <p className="orne-hint orne-overflow" role="status">
          <TriangleAlert size={15} aria-hidden="true" /> Le vœu saisi ({innerText.trim().length} caractères) ne tient pas dans {piece.loops > 1 ? 'les boucles' : 'la boucle'}.
          Raccourcissez-le pour exporter la pièce sans perdre de texte.
        </p>
      )}
      {piece.overflowReason === 'pages' && (
        <p className="orne-hint orne-overflow" role="status">
          <TriangleAlert size={15} aria-hidden="true" /> Ce texte est trop long : au-delà de {PHRASE_PIECE.MAX_PAGES} pages, la pièce ressemblerait moins à un
          ouvrage calligraphié qu&apos;à un tirage industriel. Raccourcissez-le, ou choisissez moins de lettres à
          gonfler.
        </p>
      )}
      {piece.overflowReason === 'layout' && (
        <p className="orne-hint orne-overflow" role="status">
          <TriangleAlert size={15} aria-hidden="true" /> Ce texte contient un segment trop large pour la page, même en réduisant les boucles au minimum.
          Raccourcissez-le, ou choisissez d&apos;autres lettres à gonfler.
        </p>
      )}
    </div>
  );
});

export default OrneePhrasePiece;
