'use client';
// Rendu de l'outil Ornement (disponible dans les trois modes d'écriture) :
// plusieurs boucles dans une même phrase (ex. la basmala avec م et ه
// gonflés), chacune contenant le même vœu. Toute la mise en page vient de
// composePhrasePages (lib/alqalamOrne.js) ; ce composant ne fait que la
// peindre — SUR UNE OU PLUSIEURS PAGES, empilées ici pour l'aperçu (voir
// alqalam.css .orne-pages) et imprimées une par une par printPieces.
//
// La ref pointe désormais sur le CONTENEUR (et non plus un unique <svg>) :
// il peut y avoir plusieurs pages, chacune son propre svg.orne-svg — c'est
// printPieces qui les retrouve toutes dans l'ordre du DOM au moment
// d'imprimer.
//
// Pièce TOUJOURS à l'encre noire sur fond blanc, quel que soit le thème de
// l'app : l'aperçu doit montrer exactement ce qui sortira à l'impression.
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { composePhrasePages, makeMeasurer, ensureFontReady, PHRASE_PIECE } from '@/lib/alqalamOrne';

const FONT = "'Scheherazade New', 'Alkalami', serif";
const FONT_SPEC = '700 40px "Scheherazade New"';

interface OrneePhrasePieceProps {
  /** Phrase porteuse, en arabe (plusieurs mots). */
  phrase: string;
  /** Lettres dont CHAQUE occurrence est gonflée en boucle (م ق ه ص ض ط). */
  letters: string[];
  /** Vœu ou verset, répété dans chaque boucle. */
  innerText: string;
}

const OrneePhrasePiece = forwardRef<HTMLDivElement, OrneePhrasePieceProps>(function OrneePhrasePiece(
  { phrase, letters, innerText },
  ref
) {
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let alive = true;
    ensureFontReady(FONT_SPEC).then(() => {
      if (alive) setFontReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const measure = useMemo(() => (typeof document === 'undefined' ? null : makeMeasurer(FONT)), []);
  const piece = useMemo(
    () => (measure && fontReady ? composePhrasePages({ phrase, letters, innerText, measure }) : null),
    [measure, fontReady, phrase, letters, innerText]
  );

  if (!piece) {
    return <div className="orne-loading">⏳ Chargement de la police calligraphique…</div>;
  }

  return (
    <div ref={ref} className="orne-pages">
      {piece.pages.length === 0 ? (
        // N'arrive que sur un débordement 'layout' (un jeton, à lui seul, ne
        // tient dans la largeur de page même au rayon plancher) : aucune
        // page calculable — on montre quand même une feuille vide plutôt que
        // de laisser un trou dans l'aperçu.
        <div className="orne-page">
          <svg
            className="orne-svg"
            viewBox={`0 0 ${PHRASE_PIECE.W} ${PHRASE_PIECE.H_MAX}`}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Pièce calligraphique : rien à afficher"
          >
            <rect x="0" y="0" width={PHRASE_PIECE.W} height={PHRASE_PIECE.H_MAX} fill="#ffffff" />
          </svg>
        </div>
      ) : (
        piece.pages.map((page, pi) => (
          <div key={pi} className="orne-page">
            {piece.pageCount > 1 && (
              <p className="orne-page-label">
                Page {pi + 1} / {piece.pageCount}
              </p>
            )}
            <svg
              className="orne-svg"
              viewBox={`0 0 ${page.W} ${page.H}`}
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label={`Pièce calligraphique : ${phrase.trim() || 'sans phrase'} — page ${pi + 1} sur ${piece.pageCount}`}
            >
              <rect x="0" y="0" width={page.W} height={page.H} fill="#ffffff" />

              {page.connectors.map((c, i) => (
                <line
                  key={i}
                  x1={c.x1}
                  y1={c.y}
                  x2={c.x2}
                  y2={c.y}
                  stroke="#000"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              ))}

              {page.items.map((item, i) => {
                if (item.type === 'text') {
                  return (
                    <text
                      key={i}
                      x={item.x}
                      y={item.y}
                      textAnchor="middle"
                      style={{ direction: 'rtl' }}
                      fontFamily={FONT}
                      fontWeight="700"
                      fontSize={item.fontSize}
                      fill="#000"
                    >
                      {item.value}
                    </text>
                  );
                }
                // Sorti de `item` : le rétrécissement de type ne survit pas au
                // passage dans la fonction de rendu de chaque ligne.
                const inner = item.inner;
                return (
                  <g key={i} transform={`translate(${item.cx} ${item.cy})`}>
                    <path d={item.bowl} fill="none" stroke="#000" strokeWidth={item.stroke} strokeLinejoin="round" />
                    {item.tail && (
                      <path d={item.tail} fill="none" stroke="#000" strokeWidth={item.stroke} strokeLinecap="round" />
                    )}
                    {inner && (
                      <g style={{ direction: 'rtl' }} fontFamily={FONT} fontWeight="700" fill="#000">
                        {inner.lines.map((line, li) => (
                          <text key={li} x="0" y={line.y} fontSize={inner.fontSize} textAnchor="middle">
                            {line.text}
                          </text>
                        ))}
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        ))
      )}

      {piece.overflowReason === 'vow' && (
        <p className="orne-hint orne-overflow" role="status">
          ⚠️ Ce vœu est trop long pour tenir dans {piece.loops > 1 ? 'toutes les boucles' : 'la boucle'}, même en
          micro-écriture. Raccourcissez-le, ou choisissez moins de lettres à gonfler.
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
