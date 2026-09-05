'use client';
// Rendu du sous-mode PHRASE de l'écriture ornée : plusieurs boucles dans une
// même phrase (ex. la basmala avec م et ه gonflés), chacune contenant le même
// vœu. Toute la mise en page vient de composePhrasePiece (lib/alqalamOrne.js) ;
// ce composant ne fait que la peindre — même principe que OrneePiece.tsx, son
// pendant pour le sous-mode « un mot, une boucle ».
//
// Pièce TOUJOURS à l'encre noire sur fond blanc, quel que soit le thème de
// l'app : l'aperçu doit montrer exactement ce qui sortira à l'impression.
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { composePhrasePiece, makeMeasurer, ensureFontReady } from '@/lib/alqalamOrne';

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

const OrneePhrasePiece = forwardRef<SVGSVGElement, OrneePhrasePieceProps>(function OrneePhrasePiece(
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
    () => (measure && fontReady ? composePhrasePiece({ phrase, letters, innerText, measure }) : null),
    [measure, fontReady, phrase, letters, innerText]
  );

  if (!piece) {
    return <div className="orne-loading">⏳ Chargement de la police calligraphique…</div>;
  }

  return (
    <>
      <svg
        ref={ref}
        className="orne-svg"
        viewBox={`0 0 ${piece.W} ${piece.H}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Pièce calligraphique : ${phrase.trim() || 'sans phrase'}`}
      >
        <rect x="0" y="0" width={piece.W} height={piece.H} fill="#ffffff" />

        {piece.connectors.map((c, i) => (
          <line key={i} x1={c.x1} y1={c.y} x2={c.x2} y2={c.y} stroke="#000" strokeWidth={2.5} strokeLinecap="round" />
        ))}

        {piece.items.map((item, i) => {
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
          // passage dans la fonction de rendu de chaque ligne (même piège
          // que OrneePiece.tsx pour son unique boucle).
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

      {piece.overflow && (
        <p className="orne-hint orne-overflow" role="status">
          ⚠️ Ce vœu est trop long pour tenir dans {piece.loops > 1 ? 'toutes les boucles' : 'la boucle'}, même en
          micro-écriture. Raccourcissez-le, ou choisissez moins de lettres à gonfler.
        </p>
      )}
    </>
  );
});

export default OrneePhrasePiece;
