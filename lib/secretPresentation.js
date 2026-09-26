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

// Introduction d'un secret pour la carte de liste : début du texte (sirr),
// retours à la ligne aplatis, arrêté à la fin de la première phrase si elle
// tient, sinon coupé au dernier mot avant `max` avec « … ». Calculé côté
// serveur (pages/api/list-content.js) : seul cet extrait quitte le serveur,
// jamais le texte complet.
export function secretIntro(text, max = 50) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const head = flat.slice(0, max);
  // Fin de la première phrase si elle occupe une bonne part de `head`
  // (sinon on coupe court sur une phrase suivante bien plus longue).
  const end = head.search(/[.!?…](?=\s)[^.!?…]*$/);
  if (end >= max * 0.3) return head.slice(0, end + 1);
  const cut = head.lastIndexOf(' ');
  return (cut > max / 2 ? head.slice(0, cut) : head).replace(/[\s,;:.\-–—(]+$/, '') + '…';
}
