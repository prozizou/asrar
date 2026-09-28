// lib/phoneCountries.js — Indicatifs téléphoniques pour la saisie WhatsApp en
// deux champs (pays + numéro local), demande d'adhésion au Zikr collectif
// (app/zikr/page.tsx, JoinForm). Logique PURE, testée sans mock.
//
// Liste volontairement CURÉE (pas les ~240 territoires de l'UIT) : Afrique
// francophone et Maghreb d'abord (public principal de l'app), puis les pays
// de la diaspora les plus fréquents. Un pays absent reste saisissable : le
// champ numéro accepte aussi un numéro complet commençant par « + » ou
// « 00 », qui prime alors sur le pays choisi (voir composePhone).
//
// Le résultat final passe TOUJOURS par normalizePhone (lib/zikrLogic.js),
// seule source de validation partagée avec le serveur (pages/api/zikr.js
// handleJoin) — rien ici ne remplace cette validation.

/** @typedef {{ iso: string, name: string, dial: string, tz?: string[] }} Country */

/** @type {Country[]} */
export const COUNTRIES = [
  { iso: 'SN', name: 'Sénégal', dial: '221', tz: ['Africa/Dakar'] },
  { iso: 'ML', name: 'Mali', dial: '223', tz: ['Africa/Bamako'] },
  { iso: 'GN', name: 'Guinée', dial: '224', tz: ['Africa/Conakry'] },
  { iso: 'CI', name: 'Côte d’Ivoire', dial: '225', tz: ['Africa/Abidjan'] },
  { iso: 'BF', name: 'Burkina Faso', dial: '226', tz: ['Africa/Ouagadougou'] },
  { iso: 'NE', name: 'Niger', dial: '227', tz: ['Africa/Niamey'] },
  { iso: 'TG', name: 'Togo', dial: '228', tz: ['Africa/Lome'] },
  { iso: 'BJ', name: 'Bénin', dial: '229', tz: ['Africa/Porto-Novo'] },
  { iso: 'MR', name: 'Mauritanie', dial: '222', tz: ['Africa/Nouakchott'] },
  { iso: 'GM', name: 'Gambie', dial: '220', tz: ['Africa/Banjul'] },
  { iso: 'GW', name: 'Guinée-Bissau', dial: '245', tz: ['Africa/Bissau'] },
  { iso: 'CV', name: 'Cap-Vert', dial: '238', tz: ['Atlantic/Cape_Verde'] },
  { iso: 'CM', name: 'Cameroun', dial: '237', tz: ['Africa/Douala'] },
  { iso: 'TD', name: 'Tchad', dial: '235', tz: ['Africa/Ndjamena'] },
  { iso: 'GA', name: 'Gabon', dial: '241', tz: ['Africa/Libreville'] },
  { iso: 'CG', name: 'Congo', dial: '242', tz: ['Africa/Brazzaville'] },
  { iso: 'CD', name: 'RD Congo', dial: '243', tz: ['Africa/Kinshasa', 'Africa/Lubumbashi'] },
  { iso: 'CF', name: 'Centrafrique', dial: '236', tz: ['Africa/Bangui'] },
  { iso: 'NG', name: 'Nigeria', dial: '234', tz: ['Africa/Lagos'] },
  { iso: 'GH', name: 'Ghana', dial: '233', tz: ['Africa/Accra'] },
  { iso: 'MA', name: 'Maroc', dial: '212', tz: ['Africa/Casablanca'] },
  { iso: 'DZ', name: 'Algérie', dial: '213', tz: ['Africa/Algiers'] },
  { iso: 'TN', name: 'Tunisie', dial: '216', tz: ['Africa/Tunis'] },
  { iso: 'EG', name: 'Égypte', dial: '20', tz: ['Africa/Cairo'] },
  { iso: 'KM', name: 'Comores', dial: '269', tz: ['Indian/Comoro'] },
  { iso: 'DJ', name: 'Djibouti', dial: '253', tz: ['Africa/Djibouti'] },
  { iso: 'SA', name: 'Arabie saoudite', dial: '966', tz: ['Asia/Riyadh'] },
  { iso: 'AE', name: 'Émirats arabes unis', dial: '971', tz: ['Asia/Dubai'] },
  { iso: 'TR', name: 'Turquie', dial: '90', tz: ['Europe/Istanbul'] },
  { iso: 'FR', name: 'France', dial: '33', tz: ['Europe/Paris'] },
  { iso: 'BE', name: 'Belgique', dial: '32', tz: ['Europe/Brussels'] },
  { iso: 'CH', name: 'Suisse', dial: '41', tz: ['Europe/Zurich'] },
  { iso: 'LU', name: 'Luxembourg', dial: '352', tz: ['Europe/Luxembourg'] },
  { iso: 'ES', name: 'Espagne', dial: '34', tz: ['Europe/Madrid'] },
  { iso: 'IT', name: 'Italie', dial: '39', tz: ['Europe/Rome'] },
  { iso: 'PT', name: 'Portugal', dial: '351', tz: ['Europe/Lisbon'] },
  { iso: 'DE', name: 'Allemagne', dial: '49', tz: ['Europe/Berlin'] },
  { iso: 'GB', name: 'Royaume-Uni', dial: '44', tz: ['Europe/London'] },
  { iso: 'US', name: 'États-Unis', dial: '1', tz: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'] },
  { iso: 'CA', name: 'Canada', dial: '1', tz: ['America/Toronto', 'America/Montreal', 'America/Vancouver'] },
];

export const DEFAULT_COUNTRY_ISO = 'SN';

/** Drapeau emoji depuis le code ISO (indicateurs régionaux Unicode). */
export function flagOf(iso) {
  const s = String(iso || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(s)) return '';
  return String.fromCodePoint(...[...s].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** @param {string} iso @returns {Country|undefined} */
export function countryByIso(iso) {
  return COUNTRIES.find((c) => c.iso === String(iso || '').toUpperCase());
}

/**
 * Pays le plus probable de l'utilisateur, SANS permission ni réseau :
 *   1. fuseau horaire du navigateur (Africa/Dakar → SN) — le plus fiable pour
 *      ce public (un Sénégalais a souvent un navigateur réglé en « fr-FR ») ;
 *   2. région de la langue du navigateur (« fr-SN », « en-GB »…) ;
 *   3. repli : DEFAULT_COUNTRY_ISO.
 * @param {{ timeZone?: string, languages?: readonly string[] }} env
 * @returns {string} code ISO
 */
export function detectCountryIso({ timeZone, languages } = {}) {
  if (timeZone) {
    const byTz = COUNTRIES.find((c) => c.tz && c.tz.includes(timeZone));
    if (byTz) return byTz.iso;
  }
  for (const lang of languages || []) {
    const region = String(lang).split(/[-_]/)[1];
    if (region && countryByIso(region)) return region.toUpperCase();
  }
  return DEFAULT_COUNTRY_ISO;
}

// Pays dont le 0 initial du numéro NATIONAL fait partie du numéro (ne se
// retire pas au passage en format international) — l'Italie en est
// l'exemple classique (06… reste +39 06…).
const KEEP_LEADING_ZERO = new Set(['IT']);

/**
 * Compose le numéro international à partir du pays choisi et de la saisie
 * locale. Retourne une chaîne « +<indicatif><numéro> » à valider ensuite par
 * normalizePhone — ou '' si rien d'exploitable n'a été saisi.
 *   - saisie commençant par « + » ou « 00 » → numéro complet, le pays choisi
 *     est ignoré (cas d'un pays absent de la liste, ou d'un copier-coller) ;
 *   - sinon indicatif du pays + chiffres saisis, sans le 0 de préfixe
 *     national (06 12… en France → +33 6 12…), sauf KEEP_LEADING_ZERO ;
 *   - la saisie ne répète pas l'indicatif : « 221 77… » avec le Sénégal
 *     choisi est accepté tel quel (indicatif retiré s'il est en tête ET que
 *     le reste a encore une longueur plausible).
 * @param {string} iso
 * @param {string} local
 */
export function composePhone(iso, local) {
  const raw = String(local == null ? '' : local).trim();
  if (!raw) return '';
  if (raw.startsWith('+') || raw.startsWith('00')) return raw;
  const country = countryByIso(iso);
  if (!country) return '';
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith(country.dial) && digits.length - country.dial.length >= 8) {
    digits = digits.slice(country.dial.length);
  }
  if (!KEEP_LEADING_ZERO.has(country.iso)) digits = digits.replace(/^0+/, '');
  return '+' + country.dial + digits;
}
