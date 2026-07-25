'use client';
// Rend un texte mixte FR/arabe en segments dirigés (JSX, pas d'innerHTML).
import { splitMixed } from '@/lib/format';

export default function MixedText({ text, className }) {
  const segs = splitMixed(text);
  return (
    <div className={className}>
      {segs.map((seg, i) =>
        seg.script === 'ar' ? (
          <div key={i} className="seg-ar" dir="rtl">
            {seg.text}
          </div>
        ) : (
          <div key={i} className="seg-fr">
            {seg.text}
          </div>
        )
      )}
    </div>
  );
}
