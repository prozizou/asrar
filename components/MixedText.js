'use client';
// Rend un texte mixte FR/arabe en segments dirigés (JSX, pas d'innerHTML).
import { splitMixed, splitListBlocks } from '@/lib/format';

export default function MixedText({ text, className, detectLists = false }) {
  const segs = splitMixed(text);
  return (
    <div className={className}>
      {segs.map((seg, i) => {
        if (seg.script === 'ar') {
          return (
            <div key={i} className="seg-ar" dir="rtl">
              {seg.text}
            </div>
          );
        }
        if (!detectLists) {
          return (
            <div key={i} className="seg-fr">
              {seg.text}
            </div>
          );
        }
        return (
          <div key={i} className="seg-fr">
            {splitListBlocks(seg.text).map((b, j) =>
              b.type === 'ol' ? (
                <ol key={j} className="sirr-steps">
                  {b.items.map((item, k) => (
                    <li key={k}>{item}</li>
                  ))}
                </ol>
              ) : (
                b.text.trim() && <p key={j}>{b.text}</p>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
