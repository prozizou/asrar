'use client';
// Rendu de la pièce ornée : le mot, sa lettre à boucle gonflée, et le vœu ou
// le verset écrit à l'intérieur de la boucle. Toute la mise en page est
// calculée par composePiece (lib/alqalamOrne.js) ; ce composant ne fait que
// la peindre.
//
// La pièce est TOUJOURS à l'encre noire sur fond blanc, quel que soit le thème
// de l'app : c'est une œuvre destinée au papier, et l'aperçu doit montrer
// exactement ce qui sortira à l'impression.
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { composePiece, makeMeasurer, ensureFontReady } from '@/lib/alqalamOrne';

const FONT = "'Scheherazade New', 'Alkalami', serif";
const FONT_SPEC = '700 40px "Scheherazade New"';

interface OrneePieceProps {
  /** Mot porteur, en arabe. */
  word: string;
  /** Lettre dont la boucle est gonflée (م ق ه ص ض ط). */
  letter: string;
  /** Vœu ou verset écrit à l'intérieur de la boucle. */
  innerText: string;
}

const OrneePiece = forwardRef<SVGSVGElement, OrneePieceProps>(function OrneePiece(
  { word, letter, innerText },
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
  // Recalculé seulement une fois la police prête : mesurer avec la police de
  // repli donnerait des largeurs fausses, donc des lignes mal calées.
  const piece = useMemo(
    () => (measure && fontReady ? composePiece({ word, letter, innerText, measure }) : null),
    [measure, fontReady, word, letter, innerText]
  );

  if (!piece) {
    return <div className="orne-loading">⏳ Chargement de la police calligraphique…</div>;
  }

  // Sorti de `piece` : le rétrécissement de type ne survit pas au passage dans
  // la fonction de rendu de chaque ligne.
  const inner = piece.inner;

  return (
    <>
      <svg
        ref={ref}
        className="orne-svg"
        viewBox={`0 0 ${piece.W} ${piece.H}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        // Le MOT COMPLET (prop, pas piece.word) : celui-ci a la lettre gonflée
        // retirée pour l'affichage (voir composePiece), mais un lecteur
        // d'écran doit annoncer le vrai mot, pas le fragment amputé.
        aria-label={`Pièce calligraphique : ${word.trim() || 'sans mot'}`}
      >
        <rect x="0" y="0" width={piece.W} height={piece.H} fill="#ffffff" />

        <g transform={`translate(${piece.cx} ${piece.cy})`}>
          <path d={piece.bowl} fill="none" stroke="#000" strokeWidth={piece.stroke} strokeLinejoin="round" />
          {piece.tail && (
            <path d={piece.tail} fill="none" stroke="#000" strokeWidth={piece.stroke} strokeLinecap="round" />
          )}

          {inner && (
            <g style={{ direction: 'rtl' }} fontFamily={FONT} fontWeight="700" fill="#000">
              {inner.lines.map((line, i) => (
                <text key={i} x="0" y={line.y} fontSize={inner.fontSize} textAnchor="middle">
                  {line.text}
                </text>
              ))}
            </g>
          )}
        </g>

        {piece.connector && (
          <line
            x1={piece.connector.x1}
            y1={piece.connector.y}
            x2={piece.connector.x2}
            y2={piece.connector.y}
            stroke="#000"
            strokeWidth={piece.stroke}
            strokeLinecap="round"
          />
        )}

        {piece.word && (
          <text
            x={piece.wordX}
            y={piece.wordBaseline}
            textAnchor="middle"
            style={{ direction: 'rtl' }}
            fontFamily={FONT}
            fontWeight="700"
            fontSize={piece.wordFont}
            fill="#000"
          >
            {piece.word}
          </text>
        )}
      </svg>

      {piece.overflow && (
        <p className="orne-hint orne-overflow" role="status">
          ⚠️ Ce texte est trop long pour tenir dans la boucle, même en micro-écriture. Raccourcissez-le, ou
          choisissez une lettre à boucle plus large (ص، ض، ط).
        </p>
      )}
    </>
  );
});

export default OrneePiece;
