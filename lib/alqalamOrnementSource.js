// Les répétitions destinées à l'ornement ne sont développées qu'à l'ouverture
// de l'outil. La garde précède repeat() et ne tronque jamais un texte en silence.
export const ORNEMENT_SOURCE_LIMIT = 1000000;
export function buildOrnementSource(blocks, { plainText, rasm, maxChars = ORNEMENT_SOURCE_LIMIT }) {
  const parts = [], units = [];
  let length = 0;
  for (const block of blocks) {
    const raw = String(block.texte || '');
    const repetitions = Math.max(1, Math.floor(Number(block.totalMultiplier) || 1));
    if (!Number.isSafeInteger(repetitions)) return null;
    if (raw.length > maxChars || (raw.length + 1) * repetitions + length > maxChars) return null;
    const text = (block.plain ? raw : plainText(raw)).trim();
    if (!text) continue;
    const unit = block.isRasmMode ? rasm(text) : text;
    length += (unit.length + 1) * repetitions + 1;
    if (length > maxChars) return null;
    parts.push((unit + ' ').repeat(repetitions));
    units.push(unit);
  }
  return { text: parts.join(' ').trim(), detectionText: units.join(' ') };
}
