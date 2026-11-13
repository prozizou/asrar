// lib/asrarChat/logic.js — Asrar-chat : règles PURES (aucun accès réseau ni
// RTDB), partagées par l'interface (app/asrar-chat) et le serveur qui fait
// autorité (server/asrarChat/*). Voir ASRAR_CHAT.md pour l'architecture.

// ── Profils ────────────────────────────────────────────────────────────────
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;
export const NAME_MAX = 60;
export const BIO_MAX = 300;
const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
// Pseudonymes réservés : jamais attribuables (usurpation de l'équipe).
const RESERVED_HANDLES = new Set(['admin', 'administrateur', 'asrar', 'asrarpro', 'asrar_pro', 'support', 'moderation', 'moderateur', 'officiel', 'staff', 'system', 'root']);

/** Pseudonyme normalisé (minuscules, arobase initiale retirée), ou '' s'il est invalide. */
export function normalizeHandle(value) {
  const s = String(value || '').trim().replace(/^@+/, '').toLowerCase();
  if (!HANDLE_RE.test(s) || RESERVED_HANDLES.has(s)) return '';
  return s;
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g;

/** Ligne de texte nettoyée (caractères de contrôle et d'inversion retirés). */
export function cleanLine(value, max) {
  return String(value ?? '').replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Paragraphe nettoyé : sauts de ligne conservés (au plus deux consécutifs). */
export function cleanParagraph(value, max) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export function normalizeProfileInput(input) {
  const handle = normalizeHandle(input?.handle);
  if (!handle) return { error: 'handle' };
  const displayName = cleanLine(input?.displayName, NAME_MAX);
  if (!displayName) return { error: 'displayName' };
  return { value: { handle, displayName, bio: cleanParagraph(input?.bio, BIO_MAX) } };
}

// ── Coordonnées de paiement du vendeur (paiement DIRECT au vendeur) ───────
const PHONE_RE = /^\d{8,15}$/;
const PISPI_RE = /^[A-Za-z0-9@._+-]{3,80}$/;

/** Lien marchand Wave (https://pay.wave.com/m/…), normalisé, ou ''. */
export function normalizeWaveLink(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  let url;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return ''; }
  if (url.protocol !== 'https:' || url.hostname !== 'pay.wave.com' || url.username || url.password || url.port) return '';
  if (!/^\/m\/[A-Za-z0-9_-]{4,64}(\/c\/[a-z]{2})?\/?$/.test(url.pathname)) return '';
  return 'https://pay.wave.com' + url.pathname.replace(/\/?$/, '/');
}

export function normalizePhoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return PHONE_RE.test(digits) ? digits : '';
}

export function normalizeSellerInput(input) {
  const raw = {
    waveLink: String(input?.waveLink || '').trim(),
    wavePhone: String(input?.wavePhone || '').trim(),
    pispiAlias: String(input?.pispiAlias || '').trim(),
    whatsapp: String(input?.whatsapp || '').trim(),
  };
  const waveLink = normalizeWaveLink(raw.waveLink);
  if (raw.waveLink && !waveLink) return { error: 'waveLink' };
  const wavePhone = normalizePhoneDigits(raw.wavePhone);
  if (raw.wavePhone && !wavePhone) return { error: 'wavePhone' };
  const pispiAlias = PISPI_RE.test(raw.pispiAlias) ? raw.pispiAlias : '';
  if (raw.pispiAlias && !pispiAlias) return { error: 'pispiAlias' };
  const whatsapp = normalizePhoneDigits(raw.whatsapp);
  if (raw.whatsapp && !whatsapp) return { error: 'whatsapp' };
  if (!waveLink && !wavePhone && !pispiAlias) return { error: 'noMethod' };
  if (input?.acceptTerms !== true) return { error: 'terms' };
  return { value: { waveLink, wavePhone, pispiAlias, whatsapp } };
}

export const SELLER_ERRORS = {
  waveLink: 'Lien Wave invalide : collez votre lien marchand (https://pay.wave.com/m/…).',
  wavePhone: 'Numéro Wave invalide (indicatif pays compris, chiffres uniquement).',
  pispiAlias: 'Alias PI-SPI invalide.',
  whatsapp: 'Numéro WhatsApp invalide (indicatif pays compris).',
  noMethod: 'Indiquez au moins un moyen de paiement : Wave ou PI-SPI.',
  terms: 'Acceptez les conditions de vente pour continuer.',
};

/** Moyens de paiement proposés à l'acheteur pour un vendeur donné. */
export function paymentMethodsOf(seller) {
  const methods = [];
  if (seller?.waveLink || seller?.wavePhone) methods.push('wave');
  if (seller?.pispiAlias) methods.push('pispi');
  if (seller?.whatsapp) methods.push('whatsapp');
  return methods;
}

/** Lien Wave avec montant prérempli (lien marchand), ou '' (numéro seul). */
export function waveCheckoutUrl(waveLink, amount) {
  const link = normalizeWaveLink(waveLink);
  if (!link) return '';
  const url = new URL(link);
  url.searchParams.set('amount', String(Math.round(Number(amount) || 0)));
  return url.href;
}

// ── Publications (gratuites ou payantes) ───────────────────────────────────
export const POST_KINDS = ['text', 'image', 'album', 'video', 'audio', 'document', 'service'];
export const POST_KIND_LABELS = {
  text: 'Article', image: 'Photo', album: 'Album', video: 'Vidéo', audio: 'Audio', document: 'Document', service: 'Prestation',
};
export const CATEGORIES = [
  { id: 'spiritualite', label: 'Spiritualité' },
  { id: 'formations', label: 'Formations' },
  { id: 'livres', label: 'Livres et documents' },
  { id: 'services', label: 'Services' },
  { id: 'coaching', label: 'Coaching' },
  { id: 'artisanat', label: 'Artisanat' },
  { id: 'autre', label: 'Autre' },
];
export const PRICE_MIN = 100;
export const PRICE_MAX = 1_000_000;
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 1000;
export const CONDITIONS_MAX = 500;
export const PREVIEW_TEXT_MAX = 400;
export const CONTENT_TEXT_MAX = 20000;
export const ASSETS_MAX = 10;
export const ACCESS_DAYS_MAX = 3650;

// Formats acceptés par type de ressource Cloudinary (signés à l'envoi).
export const UPLOAD_FORMATS = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'],
  video: ['mp4', 'mov', 'webm', 'm4a', 'mp3', 'ogg', 'wav', 'aac', 'opus'],
  raw: ['pdf', 'epub', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'],
};
const PUBLIC_ID_RE = /^ac\/[A-Za-z0-9_-]{1,128}\/(private|public)\/[A-Za-z0-9_\-/.]{1,200}$/;

/**
 * Pièce jointe déposée par `uid` dans SON dossier Asrar-chat. `visibility`
 * impose le dossier (private pour un contenu payant ou un média de
 * discussion, public pour une photo de profil ou un aperçu flouté).
 */
export function normalizeAsset(input, uid, visibility) {
  if (!input || typeof input !== 'object') return null;
  const id = String(input.id || '');
  const rt = String(input.rt || '');
  const fmt = String(input.fmt || '').toLowerCase();
  if (!PUBLIC_ID_RE.test(id) || id.includes('..')) return null;
  if (!id.startsWith(`ac/${uid}/${visibility}/`)) return null;
  if (!UPLOAD_FORMATS[rt]) return null;
  if (fmt && !UPLOAD_FORMATS[rt].includes(fmt)) return null;
  const bytes = Math.max(0, Math.floor(Number(input.bytes) || 0));
  const duration = Math.max(0, Math.min(36000, Math.round(Number(input.duration) || 0)));
  const asset = { id, rt, fmt, bytes, name: cleanLine(input.name, 120) };
  if (duration) asset.duration = duration;
  // Vocal enregistré en WebM/Ogg : marqué audio (sinon lu comme une vidéo).
  if (rt === 'video' && input.audio === true) asset.audio = true;
  const width = Math.floor(Number(input.w) || 0), height = Math.floor(Number(input.h) || 0);
  if (width > 0 && height > 0 && width < 20000 && height < 20000) { asset.w = width; asset.h = height; }
  return asset;
}

/** Type de média affiché pour une pièce jointe. */
export function assetKind(asset) {
  if (!asset) return null;
  if (asset.rt === 'image') return 'image';
  if (asset.rt === 'raw') return 'document';
  if (asset.audio) return 'audio';
  return ['m4a', 'mp3', 'ogg', 'wav', 'aac', 'opus'].includes(asset.fmt) ? 'audio' : 'video';
}

export function normalizePostInput(input, uid) {
  const kind = POST_KINDS.includes(input?.kind) ? input.kind : '';
  if (!kind) return { error: 'kind' };
  const title = cleanLine(input?.title, TITLE_MAX);
  if (title.length < 3) return { error: 'title' };
  const description = cleanParagraph(input?.description, DESCRIPTION_MAX);
  const category = CATEGORIES.some((c) => c.id === input?.category) ? input.category : 'autre';
  const price = Math.round(Number(input?.price) || 0);
  if (price !== 0 && (price < PRICE_MIN || price > PRICE_MAX)) return { error: 'price' };
  const accessDays = Math.floor(Number(input?.accessDays) || 0);
  if (accessDays < 0 || accessDays > ACCESS_DAYS_MAX) return { error: 'accessDays' };
  const conditions = cleanParagraph(input?.conditions, CONDITIONS_MAX);
  const previewText = cleanParagraph(input?.previewText, PREVIEW_TEXT_MAX);
  const contentText = cleanParagraph(input?.contentText, CONTENT_TEXT_MAX);
  const rawAssets = Array.isArray(input?.assets) ? input.assets.slice(0, ASSETS_MAX + 1) : [];
  if (rawAssets.length > ASSETS_MAX) return { error: 'assets' };
  const assets = rawAssets.map((a) => normalizeAsset(a, uid, 'private'));
  if (assets.some((a) => !a)) return { error: 'assets' };
  const previewImage = input?.previewImage ? normalizeAsset(input.previewImage, uid, 'public') : null;
  if (input?.previewImage && (!previewImage || previewImage.rt !== 'image')) return { error: 'previewImage' };
  const needsMedia = { image: 'image', album: 'image', video: 'video', audio: 'video', document: 'raw' }[kind];
  if (needsMedia && !assets.some((a) => a.rt === needsMedia)) return { error: 'media' };
  if (kind === 'album' && assets.length < 2) return { error: 'album' };
  if ((kind === 'text' || kind === 'service') && !contentText && !assets.length) return { error: 'content' };
  if (price > 0 && !previewText && !description) return { error: 'preview' };
  return {
    value: { kind, title, description, category, price, accessDays, conditions, previewText, contentText, assets, previewImage },
  };
}

export const POST_ERRORS = {
  kind: 'Choisissez le type de publication.',
  title: 'Le titre doit comporter au moins 3 caractères.',
  price: `Prix invalide : gratuit, ou entre ${PRICE_MIN} et ${PRICE_MAX.toLocaleString('fr-FR')} FCFA.`,
  accessDays: 'Durée d’accès invalide.',
  assets: 'Un fichier joint n’est pas valide. Renvoyez-le.',
  previewImage: 'L’aperçu doit être une image.',
  media: 'Ajoutez le fichier correspondant au type choisi.',
  album: 'Un album contient au moins 2 photos.',
  content: 'Ajoutez le contenu (texte ou fichier).',
  preview: 'Ajoutez une description ou un aperçu visible avant paiement.',
};

// ── Discussions ────────────────────────────────────────────────────────────
export const CONV_TYPES = ['dm', 'group', 'channel'];
export const CONV_TITLE_MAX = 80;
export const CONV_ABOUT_MAX = 300;
export const MESSAGE_MAX = 4000;
export const GROUP_MEMBERS_MAX = 1000;
export const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '🤲'];

export function normalizeConvInput(input) {
  const type = input?.type === 'channel' ? 'channel' : input?.type === 'group' ? 'group' : '';
  if (!type) return { error: 'type' };
  const title = cleanLine(input?.title, CONV_TITLE_MAX);
  if (title.length < 2) return { error: 'title' };
  const visibility = input?.visibility === 'public' ? 'public' : 'private';
  return { value: { type, title, about: cleanParagraph(input?.about, CONV_ABOUT_MAX), visibility } };
}

export const CONV_ERRORS = {
  type: 'Choisissez groupe ou chaîne.',
  title: 'Donnez un nom d’au moins 2 caractères.',
};

/** Identifiant déterministe d'une discussion privée entre deux comptes. */
export function dmId(uidA, uidB) {
  return 'dm_' + [String(uidA), String(uidB)].sort().join('_');
}

/** Peut publier dans la discussion : tous dans un groupe, admins dans une chaîne. */
export function canPost(conv, member) {
  if (!conv || !member) return false;
  if (conv.type === 'channel') return member.role === 'owner' || member.role === 'admin';
  return true;
}

export function canModerate(member) {
  return member?.role === 'owner' || member?.role === 'admin';
}

// ── Commandes (paiement direct au vendeur) ─────────────────────────────────
// pending   : commande créée, l'acheteur doit payer le vendeur ;
// declared  : l'acheteur indique avoir payé (référence de transaction) —
//             RIEN n'est débloqué tant que le vendeur n'a pas vérifié ;
// paid      : le vendeur (ou l'administration) a constaté la réception →
//             accès accordé ;
// rejected  : le vendeur n'a pas reçu le paiement ;
// cancelled : annulée par l'acheteur avant paiement ;
// disputed  : litige ouvert, tranché par l'administration ;
// refunded  : remboursée (accès retiré).
export const ORDER_STATUSES = ['pending', 'declared', 'paid', 'rejected', 'cancelled', 'disputed', 'refunded'];
export const ORDER_LABELS = {
  pending: 'En attente de paiement', declared: 'Paiement à vérifier', paid: 'Payée', rejected: 'Paiement non reçu',
  cancelled: 'Annulée', disputed: 'Litige en cours', refunded: 'Remboursée',
};
// Transitions autorisées, par rôle.
const TRANSITIONS = {
  buyer: { pending: ['declared', 'cancelled'], rejected: ['declared', 'disputed', 'cancelled'], declared: ['disputed'], paid: ['disputed'] },
  seller: { pending: ['paid', 'rejected'], declared: ['paid', 'rejected'], disputed: ['refunded'], paid: ['refunded'] },
  admin: { pending: ['paid', 'cancelled'], declared: ['paid', 'rejected'], rejected: ['paid'], disputed: ['paid', 'refunded', 'cancelled'], paid: ['refunded'] },
};

export function canTransition(role, from, to) {
  return !!TRANSITIONS[role]?.[from]?.includes(to);
}

export const PAYMENT_METHODS = ['wave', 'pispi', 'whatsapp'];
export const METHOD_LABELS = { wave: 'Wave', pispi: 'PI-SPI', whatsapp: 'WhatsApp' };
export const PAYMENT_REF_MAX = 80;
export const COMMISSION_MAX = 50;

/** Commission due à la plateforme (FCFA entiers), taux en %. */
export function commissionOf(price, rate) {
  const r = Math.min(COMMISSION_MAX, Math.max(0, Number(rate) || 0));
  return Math.round((Math.max(0, Number(price) || 0) * r) / 100);
}

/** Référence lisible et unique de commande (AC-XXXX-XXXX). */
export function orderRef(randomBytes) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = Array.from(randomBytes.slice(0, 8), (b) => alphabet[b % alphabet.length]).join('');
  return `AC-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

/** Accès encore valide à l'instant `now` (expiresAt 0/absent = illimité). */
export function entitlementActive(entitlement, now) {
  if (!entitlement || entitlement.revoked) return false;
  const exp = Number(entitlement.expiresAt) || 0;
  return !exp || now < exp;
}

export const fcfa = (n) => (Math.round(Number(n) || 0)).toLocaleString('fr-FR') + ' FCFA';

// ── Signalements ───────────────────────────────────────────────────────────
export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam ou arnaque' },
  { id: 'fraud', label: 'Fraude au paiement' },
  { id: 'illegal', label: 'Contenu illicite' },
  { id: 'abuse', label: 'Harcèlement ou insultes' },
  { id: 'adult', label: 'Contenu choquant ou pour adultes' },
  { id: 'copyright', label: 'Droits d’auteur' },
  { id: 'other', label: 'Autre' },
];
export const REPORT_TARGETS = ['user', 'post', 'message', 'conv'];
