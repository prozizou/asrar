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
import { composePhrasePages, PHRASE_PIECE } from '@/lib/alqalamOrne';
import { loadShaper } from '@/lib/alqalamShaper';
import { vectorizePage, pageSvgMarkup } from '@/lib/alqalamVector';

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

type Shaper = Awaited<ReturnType<typeof loadShaper>>;
type VectorPage = ReturnType<typeof vectorizePage>;

/** Une page de l'aperçu : vectorisée quand elle approche de l'écran. */
function OrnePage({ index, count, label, render }: { index: number; count: number; label: string; render: () => VectorPage }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(index < 2);

  useEffect(() => {
    if (visible || !holder.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '800px 0px' }
    );
    io.observe(holder.current);
    return () => io.disconnect();
  }, [visible]);

  const markup = useMemo(
    () => (visible ? pageSvgMarkup(render(), { pageNumber: index + 1, pageCount: count, label, margin: PHRASE_PIECE.MARGIN }) : ''),
    [visible, render, index, count, label]
  );

  return (
    <div className="orne-page">
      {count > 1 && (
        <p className="orne-page-label">
          Page {index + 1} / {count}
        </p>
      )}
      {markup ? (
        // Balisage produit par pageSvgMarkup : uniquement des tracés générés
        // par le moteur (le seul texte libre, l'aria-label, est échappé).
        <div className="orne-svg-holder" dangerouslySetInnerHTML={{ __html: markup }} />
      ) : (
        <div ref={holder} className="orne-svg orne-svg-pending" aria-hidden="true" />
      )}
    </div>
  );
}

const OrneePhrasePiece = forwardRef<OrneePhrasePieceHandle, OrneePhrasePieceProps>(function OrneePhrasePiece(
  { phrase, letters, innerText, segments, scale = 1 },
  ref
) {
  const [shaper, setShaper] = useState<Shaper | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    loadShaper()
      .then((s) => {
        if (alive) setShaper(s);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const piece = useMemo(
    () => (shaper ? composePhrasePages({ phrase, letters, innerText, measure: shaper.measure, segments, scale }) : null),
    [shaper, phrase, letters, innerText, segments, scale]
  );

  // Pages déjà vectorisées, réutilisées par l'export. Remise à zéro dès que
  // la composition change.
  const cache = useMemo(() => {
    void piece; // une nouvelle composition invalide toutes les pages
    return new Map<number, VectorPage>();
  }, [piece]);
  const renderers = useMemo(
    () =>
      (piece?.pages || []).map((page, i) => () => {
        let v = cache.get(i);
        if (!v && shaper) {
          v = vectorizePage(page, shaper, { idPrefix: `p${i}q` });
          cache.set(i, v);
        }
        return v as VectorPage;
      }),
    [piece, cache, shaper]
  );

  const label = phrase.trim() || 'sans phrase';

  useImperativeHandle(
    ref,
    () => ({
      exportPdf: async (docName, onProgress) => {
        if (!piece || !shaper) throw new Error('Le moteur calligraphique n’est pas encore prêt.');
        if (piece.overflowReason === 'vow') throw new Error('Le vœu est trop long pour les boucles. Raccourcissez-le avant l’export PDF.');
        if (piece.overflowReason === 'pages') throw new Error(`Le texte dépasse ${PHRASE_PIECE.MAX_PAGES} pages. Réduisez les répétitions avant l’export PDF.`);
        if (!piece.pages.length) throw new Error('Un mot est trop large pour une page A4. Raccourcissez-le avant l’export PDF.');
        const { exportOrnementPdf } = await import('@/lib/alqalamPdf');
        await exportOrnementPdf({ pages: piece.pages, shaper, docName, label, cache, onProgress });
      },
    }),
    [piece, shaper, cache, label]
  );

  if (loadError) {
    return <div className="orne-loading">⚠️ Impossible de charger la police calligraphique. Vérifiez la connexion puis rouvrez l&apos;Ornement.</div>;
  }
  if (!piece) {
    return <div className="orne-loading">⏳ Chargement du moteur calligraphique…</div>;
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
          ⚠️ Le vœu saisi ({innerText.trim().length} caractères) ne tient pas dans {piece.loops > 1 ? 'les boucles' : 'la boucle'}.
          Raccourcissez-le pour exporter la pièce sans perdre de texte.
        </p>
      )}
      {piece.overflowReason === 'pages' && (
        <p className="orne-hint orne-overflow" role="status">
          ⚠️ Ce texte est trop long : au-delà de {PHRASE_PIECE.MAX_PAGES} pages, la pièce ressemblerait moins à un
          ouvrage calligraphié qu&apos;à un tirage industriel. Raccourcissez-le, ou choisissez moins de lettres à
          gonfler.
        </p>
      )}
      {piece.overflowReason === 'layout' && (
        <p className="orne-hint orne-overflow" role="status">
          ⚠️ Ce texte contient un segment trop large pour la page, même en réduisant les boucles au minimum.
          Raccourcissez-le, ou choisissez d&apos;autres lettres à gonfler.
        </p>
      )}
    </div>
  );
});

export default OrneePhrasePiece;
