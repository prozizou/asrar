// lib/phoneCountries.js — Indicatifs téléphoniques pour la saisie WhatsApp en
// deux champs (pays + numéro local), demande d'adhésion au Zikr collectif
// (app/zikr/page.tsx, JoinForm). Logique PURE, testée sans mock.
//
// Liste COMPLÈTE (pays et territoires, indicatifs UIT) : de nombreux
// participants ne trouvaient pas leur pays dans l'ancienne liste réduite.
// Les pays fréquents (Afrique francophone, Maghreb, diaspora) restent en
// tête ; tous les autres suivent de A à Z. Le champ numéro accepte toujours
// un numéro complet commençant par « + » ou « 00 », qui prime alors sur le
// pays choisi (voir composePhone). Les indicatifs du plan nord-américain
// incluent l'indicatif régional (Jamaïque 1876…) : saisir le numéro local.
//
// Le résultat final passe TOUJOURS par normalizePhone (lib/zikrLogic.js),
// seule source de validation partagée avec le serveur (pages/api/zikr.js
// handleJoin) — rien ici ne remplace cette validation.

/** @typedef {{ iso: string, name: string, dial: string, tz?: string[] }} Country */

/** Pays fréquents du public d'ASRAR PRO, proposés en tête de liste.
 * @type {Country[]} */
export const FREQUENT_COUNTRIES = [
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

/** Tous les autres pays et territoires (indicatifs UIT), de A à Z (ordre
 * alphabétique français, accents compris).
 * @type {Country[]} */
export const OTHER_COUNTRIES = /** @type {Country[]} */ ([
  { iso: 'AF', name: 'Afghanistan', dial: '93' },
  { iso: 'ZA', name: 'Afrique du Sud', dial: '27' },
  { iso: 'AL', name: 'Albanie', dial: '355' },
  { iso: 'AD', name: 'Andorre', dial: '376' },
  { iso: 'AO', name: 'Angola', dial: '244' },
  { iso: 'AI', name: 'Anguilla', dial: '1264' },
  { iso: 'AG', name: 'Antigua-et-Barbuda', dial: '1268' },
  { iso: 'AR', name: 'Argentine', dial: '54' },
  { iso: 'AM', name: 'Arménie', dial: '374' },
  { iso: 'AW', name: 'Aruba', dial: '297' },
  { iso: 'AU', name: 'Australie', dial: '61' },
  { iso: 'AT', name: 'Autriche', dial: '43' },
  { iso: 'AZ', name: 'Azerbaïdjan', dial: '994' },
  { iso: 'BS', name: 'Bahamas', dial: '1242' },
  { iso: 'BH', name: 'Bahreïn', dial: '973' },
  { iso: 'BD', name: 'Bangladesh', dial: '880' },
  { iso: 'BB', name: 'Barbade', dial: '1246' },
  { iso: 'BZ', name: 'Belize', dial: '501' },
  { iso: 'BM', name: 'Bermudes', dial: '1441' },
  { iso: 'BT', name: 'Bhoutan', dial: '975' },
  { iso: 'BY', name: 'Biélorussie', dial: '375' },
  { iso: 'BO', name: 'Bolivie', dial: '591' },
  { iso: 'BA', name: 'Bosnie-Herzégovine', dial: '387' },
  { iso: 'BW', name: 'Botswana', dial: '267' },
  { iso: 'BR', name: 'Brésil', dial: '55' },
  { iso: 'BN', name: 'Brunei', dial: '673' },
  { iso: 'BG', name: 'Bulgarie', dial: '359' },
  { iso: 'BI', name: 'Burundi', dial: '257' },
  { iso: 'KH', name: 'Cambodge', dial: '855' },
  { iso: 'CL', name: 'Chili', dial: '56' },
  { iso: 'CN', name: 'Chine', dial: '86' },
  { iso: 'CY', name: 'Chypre', dial: '357' },
  { iso: 'CO', name: 'Colombie', dial: '57' },
  { iso: 'KP', name: 'Corée du Nord', dial: '850' },
  { iso: 'KR', name: 'Corée du Sud', dial: '82' },
  { iso: 'CR', name: 'Costa Rica', dial: '506' },
  { iso: 'HR', name: 'Croatie', dial: '385' },
  { iso: 'CU', name: 'Cuba', dial: '53' },
  { iso: 'CW', name: 'Curaçao', dial: '599' },
  { iso: 'DK', name: 'Danemark', dial: '45' },
  { iso: 'DM', name: 'Dominique', dial: '1767' },
  { iso: 'EC', name: 'Équateur', dial: '593' },
  { iso: 'ER', name: 'Érythrée', dial: '291' },
  { iso: 'EE', name: 'Estonie', dial: '372' },
  { iso: 'SZ', name: 'Eswatini', dial: '268' },
  { iso: 'ET', name: 'Éthiopie', dial: '251' },
  { iso: 'FJ', name: 'Fidji', dial: '679' },
  { iso: 'FI', name: 'Finlande', dial: '358' },
  { iso: 'GE', name: 'Géorgie', dial: '995' },
  { iso: 'GI', name: 'Gibraltar', dial: '350' },
  { iso: 'GD', name: 'Grenade', dial: '1473' },
  { iso: 'GL', name: 'Groenland', dial: '299' },
  { iso: 'GR', name: 'Grèce', dial: '30' },
  { iso: 'GP', name: 'Guadeloupe', dial: '590' },
  { iso: 'GU', name: 'Guam', dial: '1671' },
  { iso: 'GT', name: 'Guatemala', dial: '502' },
  { iso: 'GQ', name: 'Guinée équatoriale', dial: '240' },
  { iso: 'GY', name: 'Guyana', dial: '592' },
  { iso: 'GF', name: 'Guyane française', dial: '594' },
  { iso: 'HT', name: 'Haïti', dial: '509' },
  { iso: 'HN', name: 'Honduras', dial: '504' },
  { iso: 'HK', name: 'Hong Kong', dial: '852' },
  { iso: 'HU', name: 'Hongrie', dial: '36' },
  { iso: 'KY', name: 'Îles Caïmans', dial: '1345' },
  { iso: 'CK', name: 'Îles Cook', dial: '682' },
  { iso: 'FO', name: 'Îles Féroé', dial: '298' },
  { iso: 'MH', name: 'Îles Marshall', dial: '692' },
  { iso: 'SB', name: 'Îles Salomon', dial: '677' },
  { iso: 'TC', name: 'Îles Turques-et-Caïques', dial: '1649' },
  { iso: 'VG', name: 'Îles Vierges britanniques', dial: '1284' },
  { iso: 'VI', name: 'Îles Vierges des États-Unis', dial: '1340' },
  { iso: 'IN', name: 'Inde', dial: '91' },
  { iso: 'ID', name: 'Indonésie', dial: '62' },
  { iso: 'IQ', name: 'Irak', dial: '964' },
  { iso: 'IR', name: 'Iran', dial: '98' },
  { iso: 'IE', name: 'Irlande', dial: '353' },
  { iso: 'IS', name: 'Islande', dial: '354' },
  { iso: 'IL', name: 'Israël', dial: '972' },
  { iso: 'JM', name: 'Jamaïque', dial: '1876' },
  { iso: 'JP', name: 'Japon', dial: '81' },
  { iso: 'JO', name: 'Jordanie', dial: '962' },
  { iso: 'KZ', name: 'Kazakhstan', dial: '7' },
  { iso: 'KE', name: 'Kenya', dial: '254' },
  { iso: 'KG', name: 'Kirghizistan', dial: '996' },
  { iso: 'KI', name: 'Kiribati', dial: '686' },
  { iso: 'XK', name: 'Kosovo', dial: '383' },
  { iso: 'KW', name: 'Koweït', dial: '965' },
  { iso: 'RE', name: 'La Réunion', dial: '262' },
  { iso: 'LA', name: 'Laos', dial: '856' },
  { iso: 'LS', name: 'Lesotho', dial: '266' },
  { iso: 'LV', name: 'Lettonie', dial: '371' },
  { iso: 'LB', name: 'Liban', dial: '961' },
  { iso: 'LR', name: 'Liberia', dial: '231' },
  { iso: 'LY', name: 'Libye', dial: '218' },
  { iso: 'LI', name: 'Liechtenstein', dial: '423' },
  { iso: 'LT', name: 'Lituanie', dial: '370' },
  { iso: 'MO', name: 'Macao', dial: '853' },
  { iso: 'MK', name: 'Macédoine du Nord', dial: '389' },
  { iso: 'MG', name: 'Madagascar', dial: '261' },
  { iso: 'MY', name: 'Malaisie', dial: '60' },
  { iso: 'MW', name: 'Malawi', dial: '265' },
  { iso: 'MV', name: 'Maldives', dial: '960' },
  { iso: 'MT', name: 'Malte', dial: '356' },
  { iso: 'MQ', name: 'Martinique', dial: '596' },
  { iso: 'MU', name: 'Maurice', dial: '230' },
  { iso: 'YT', name: 'Mayotte', dial: '262' },
  { iso: 'MX', name: 'Mexique', dial: '52' },
  { iso: 'FM', name: 'Micronésie', dial: '691' },
  { iso: 'MD', name: 'Moldavie', dial: '373' },
  { iso: 'MC', name: 'Monaco', dial: '377' },
  { iso: 'MN', name: 'Mongolie', dial: '976' },
  { iso: 'ME', name: 'Monténégro', dial: '382' },
  { iso: 'MS', name: 'Montserrat', dial: '1664' },
  { iso: 'MZ', name: 'Mozambique', dial: '258' },
  { iso: 'MM', name: 'Myanmar', dial: '95' },
  { iso: 'NA', name: 'Namibie', dial: '264' },
  { iso: 'NR', name: 'Nauru', dial: '674' },
  { iso: 'NP', name: 'Népal', dial: '977' },
  { iso: 'NI', name: 'Nicaragua', dial: '505' },
  { iso: 'NO', name: 'Norvège', dial: '47' },
  { iso: 'NC', name: 'Nouvelle-Calédonie', dial: '687' },
  { iso: 'NZ', name: 'Nouvelle-Zélande', dial: '64' },
  { iso: 'OM', name: 'Oman', dial: '968' },
  { iso: 'UG', name: 'Ouganda', dial: '256' },
  { iso: 'UZ', name: 'Ouzbékistan', dial: '998' },
  { iso: 'PK', name: 'Pakistan', dial: '92' },
  { iso: 'PW', name: 'Palaos', dial: '680' },
  { iso: 'PS', name: 'Palestine', dial: '970' },
  { iso: 'PA', name: 'Panama', dial: '507' },
  { iso: 'PG', name: 'Papouasie-Nouvelle-Guinée', dial: '675' },
  { iso: 'PY', name: 'Paraguay', dial: '595' },
  { iso: 'NL', name: 'Pays-Bas', dial: '31' },
  { iso: 'PE', name: 'Pérou', dial: '51' },
  { iso: 'PH', name: 'Philippines', dial: '63' },
  { iso: 'PL', name: 'Pologne', dial: '48' },
  { iso: 'PF', name: 'Polynésie française', dial: '689' },
  { iso: 'PR', name: 'Porto Rico', dial: '1787' },
  { iso: 'QA', name: 'Qatar', dial: '974' },
  { iso: 'DO', name: 'République dominicaine', dial: '1809' },
  { iso: 'RO', name: 'Roumanie', dial: '40' },
  { iso: 'RU', name: 'Russie', dial: '7' },
  { iso: 'RW', name: 'Rwanda', dial: '250' },
  { iso: 'EH', name: 'Sahara occidental', dial: '212' },
  { iso: 'KN', name: 'Saint-Christophe-et-Niévès', dial: '1869' },
  { iso: 'SM', name: 'Saint-Marin', dial: '378' },
  { iso: 'PM', name: 'Saint-Pierre-et-Miquelon', dial: '508' },
  { iso: 'VC', name: 'Saint-Vincent-et-les-Grenadines', dial: '1784' },
  { iso: 'LC', name: 'Sainte-Lucie', dial: '1758' },
  { iso: 'SV', name: 'Salvador', dial: '503' },
  { iso: 'WS', name: 'Samoa', dial: '685' },
  { iso: 'ST', name: 'Sao Tomé-et-Principe', dial: '239' },
  { iso: 'RS', name: 'Serbie', dial: '381' },
  { iso: 'SC', name: 'Seychelles', dial: '248' },
  { iso: 'SL', name: 'Sierra Leone', dial: '232' },
  { iso: 'SG', name: 'Singapour', dial: '65' },
  { iso: 'SK', name: 'Slovaquie', dial: '421' },
  { iso: 'SI', name: 'Slovénie', dial: '386' },
  { iso: 'SO', name: 'Somalie', dial: '252' },
  { iso: 'SD', name: 'Soudan', dial: '249' },
  { iso: 'SS', name: 'Soudan du Sud', dial: '211' },
  { iso: 'LK', name: 'Sri Lanka', dial: '94' },
  { iso: 'SR', name: 'Suriname', dial: '597' },
  { iso: 'SE', name: 'Suède', dial: '46' },
  { iso: 'SY', name: 'Syrie', dial: '963' },
  { iso: 'TJ', name: 'Tadjikistan', dial: '992' },
  { iso: 'TZ', name: 'Tanzanie', dial: '255' },
  { iso: 'TW', name: 'Taïwan', dial: '886' },
  { iso: 'CZ', name: 'Tchéquie', dial: '420' },
  { iso: 'TH', name: 'Thaïlande', dial: '66' },
  { iso: 'TL', name: 'Timor oriental', dial: '670' },
  { iso: 'TO', name: 'Tonga', dial: '676' },
  { iso: 'TT', name: 'Trinité-et-Tobago', dial: '1868' },
  { iso: 'TM', name: 'Turkménistan', dial: '993' },
  { iso: 'TV', name: 'Tuvalu', dial: '688' },
  { iso: 'UA', name: 'Ukraine', dial: '380' },
  { iso: 'UY', name: 'Uruguay', dial: '598' },
  { iso: 'VU', name: 'Vanuatu', dial: '678' },
  { iso: 'VA', name: 'Vatican', dial: '379' },
  { iso: 'VE', name: 'Venezuela', dial: '58' },
  { iso: 'VN', name: 'Viêt Nam', dial: '84' },
  { iso: 'WF', name: 'Wallis-et-Futuna', dial: '681' },
  { iso: 'YE', name: 'Yémen', dial: '967' },
  { iso: 'ZM', name: 'Zambie', dial: '260' },
  { iso: 'ZW', name: 'Zimbabwe', dial: '263' },
]).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

/** Liste complète : pays fréquents, puis tous les autres de A à Z.
 * @type {Country[]} */
export const COUNTRIES = [...FREQUENT_COUNTRIES, ...OTHER_COUNTRIES];

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
