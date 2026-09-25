// Données de présentation uniquement : aucun changement du contenu enregistré.
export function secretImages(data) {
  const sources = [data.img, data.image, ...['images', 'imgs'].flatMap((field) => {
    const value = data[field];
    return Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
  })];
  return [...new Set(sources.map((value) => typeof value === 'string' ? value : value?.url || value?.src)
    .filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
}

export function secretParagraphs(text) {
  return String(text || '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/).filter((part) => part.trim());
}

// Seules les lettres arabes sont isolées en RTL. Parenthèses, chiffres et
// ponctuation restent dans la phrase : « (يا لطيف) 129 x » n'est plus éclaté.
export function secretInlineParts(text) {
  return String(text).split(/([\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+(?:[ \t]+[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+)*)/g)
    .filter(Boolean).map((text) => ({ text, arabic: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(text) }));
}
