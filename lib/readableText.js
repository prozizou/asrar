// lib/readableText.js — Découpe un long texte en paragraphes lisibles (logique
// PURE, testée). Sert aux interprétations de la Géomancie, stockées dans
// Firebase sous forme d'un seul bloc : on respecte d'abord les sauts de ligne
// existants, puis on regroupe les phrases par paquets courts.

const SENTENCE_END = /(?<=[.!?…»])\s+(?=(?:[«"“(]\s?)?[A-ZÀ-ÖØ-ÞŒ0-9])/u;

/**
 * @param {string} text
 * @param {{ maxSentences?: number, maxChars?: number }} [options]
 * @returns {string[]} paragraphes non vides
 */
export function splitParagraphs(text, { maxSentences = 3, maxChars = 420 } = {}) {
  const source = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
  if (!source) return [];
  const blocks = source.split(/\n\s*\n|\n/).map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = [];
  for (const block of blocks) {
    const sentences = block.split(SENTENCE_END).map((s) => s.trim()).filter(Boolean);
    let current = [];
    let length = 0;
    for (const sentence of sentences) {
      if (current.length && (current.length >= maxSentences || length + sentence.length > maxChars)) {
        out.push(current.join(' '));
        current = []; length = 0;
      }
      current.push(sentence);
      length += sentence.length + 1;
    }
    if (current.length) out.push(current.join(' '));
  }
  return out;
}

/**
 * Une phrase par élément : coupe après chaque point (ainsi que « ! », « ? »,
 * « … ») suivi d'une espace, et à chaque saut de ligne. Un point sans espace
 * après (3.5, www.site) ne coupe pas.
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n?/g, '\n')
    .split(/\n+|(?<=[.!?…])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s && !/^[.!?…]+$/.test(s));
}
