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

// Une ligne qui commence par « 1. », « 2) »… (revue design du module
// Secrets — MixedText.js/SecretDetail.js : « la procédure est difficile à
// scanner rapidement »). Volontairement limité à la numérotation latine :
// le corpus de ce projet ne l'utilise pas côté segments arabes.
const LIST_LINE = /^\s*\d+[.)]\s+/;

// Regroupe les lignes d'un segment FR (déjà isolé par splitMixed) en blocs
// « liste » (≥ 2 lignes numérotées consécutives) ou « prose » (tout le
// reste, y compris une ligne numérotée ISOLÉE — ex. « 3 gouttes » n'est pas
// une étape). Ne fait que RECONNAÎTRE une structure déjà présente dans le
// texte source, n'en invente jamais : un texte sans numérotation ressort en
// un unique bloc de prose, identique au comportement précédent.
export function splitListBlocks(text) {
  const lines = String(text || '').split('\n');
  const tags = lines.map((l) => (LIST_LINE.test(l) ? 'li' : 'p'));
  // Un run de longueur 1 en "li" est reclassé en "p" (pas assez pour une liste).
  for (let i = 0; i < tags.length; i++) {
    if (tags[i] === 'li' && tags[i - 1] !== 'li' && tags[i + 1] !== 'li') tags[i] = 'p';
  }
  const blocks = [];
  let i = 0;
  while (i < tags.length) {
    let j = i;
    while (j < tags.length && tags[j] === tags[i]) j++;
    if (tags[i] === 'li') {
      blocks.push({ type: 'ol', items: lines.slice(i, j).map((l) => l.replace(LIST_LINE, '').trim()) });
    } else {
      blocks.push({ type: 'p', text: lines.slice(i, j).join('\n') });
    }
    i = j;
  }
  return blocks;
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
