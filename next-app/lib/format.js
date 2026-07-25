// Découpage d'un texte mixte FR/arabe en segments — port de formatMixed()
// (asrar.js). Version React : renvoie un tableau de segments { script, text }
// que l'on rend en JSX (plus de innerHTML → pas de risque d'injection).
const AR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function splitMixed(text) {
  if (!text) return [];
  let segs = [];
  let cur = null;
  for (const ch of text) {
    const isAr = AR.test(ch);
    const isFr = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(ch);
    const s = isAr ? 'ar' : isFr ? 'fr' : null;
    if (s === null) {
      if (cur) cur.text += ch;
      else cur = { script: 'fr', text: ch };
    } else if (!cur || cur.script === null) {
      if (cur) {
        cur.script = s;
        cur.text += ch;
      } else cur = { script: s, text: ch };
    } else if (cur.script === s) {
      cur.text += ch;
    } else {
      segs.push(cur);
      cur = { script: s, text: ch };
    }
  }
  if (cur) segs.push(cur);
  return segs.map((seg) => ({ script: seg.script, text: seg.text.trim() })).filter((seg) => seg.text);
}

// Utilisé uniquement pour la génération PDF (contexte hors React).
export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function segmentsToHtml(text) {
  return splitMixed(text)
    .map((seg) =>
      seg.script === 'ar'
        ? `<div class="seg-ar">${escapeHtml(seg.text)}</div>`
        : `<div class="seg-fr">${escapeHtml(seg.text)}</div>`
    )
    .join('');
}
