// La taille est vérifiée AVANT repeat()/compression/mise en page, afin de ne
// pas fabriquer en mémoire un document impossible à ouvrir sur téléphone.
export const MAX_EXPORT_CHARS = 2000000;
export function checkExportBudget(blocks, prefix = '', suffix = '', previousChars = 0) {
  const tooLarge = () => Object.assign(new Error('Ce document est trop volumineux pour un export sur téléphone. Réduisez les répétitions ou exportez les blocs séparément.'), { code: 'EXPORT_TOO_LARGE' });
  let length = previousChars + prefix.length + suffix.length;
  if (length > MAX_EXPORT_CHARS) throw tooLarge();
  for (const block of blocks) {
    const count = Number(block.totalMultiplier || 1);
    if (!Number.isSafeInteger(count) || count <= 0) throw Object.assign(new Error('Le nombre de répétitions est invalide.'), { code: 'EXPORT_TOO_LARGE' });
    length += String(block.unitText || '').length * count;
    if (length > MAX_EXPORT_CHARS) throw tooLarge();
  }
  return length;
}
