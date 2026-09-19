// lib/dailyContent.js — Contenu spirituel quotidien (verset / hadith / dua),
// affiché sur /menu (components/DailyContentCard.js) et poussé une fois par
// jour aux utilisateurs qui l'activent (pages/api/cron/reminders.js, voir
// shouldSendDailyContent dans lib/reminders.js). Objectif : donner une
// raison d'ouvrir l'app chaque jour même sans wird programmé, cf. la
// stratégie de rétention discutée.
//
// Liste STATIQUE et délibérément COURTE : mieux vaut peu d'éléments
// correctement sourcés qu'une longue liste — sur une app à vocation
// religieuse, un contenu mal attribué coûte cher en confiance. Choix :
// uniquement des versets/hadiths parmi les plus largement rapportés et
// consensuels (présents dans toute compilation classique — Riyad as-Salihin,
// Hisnul Muslim…), jamais de formulation inventée ; les traductions
// françaises ci-dessous sont des rendus courants, pas une traduction
// officielle certifiée. Amener cette liste sous contrôle éditorial
// (admin-asrar-pro) est une évolution possible, pas un prérequis.
//
// Module partagé client/serveur (même raison que lib/dhikrPresets.js) : une
// seule source de vérité, jamais dupliquée entre la carte affichée et le
// contenu du push.

export const DAILY_CONTENT = [
  {
    id: 'coeurs-apaises',
    type: 'verset',
    arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    text: 'C’est par le rappel d’Allah que les cœurs s’apaisent.',
    source: 'Sourate Ar-Ra’d, 13:28',
  },
  {
    id: 'rappel-souvent',
    type: 'verset',
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اذْكُرُوا اللَّهَ ذِكْرًا كَثِيرًا',
    text: 'Ô vous qui croyez, invoquez Allah d’une invocation abondante.',
    source: 'Sourate Al-Ahzab, 33:41',
  },
  {
    id: 'toute-posture',
    type: 'verset',
    arabic: 'الَّذِينَ يَذْكُرُونَ اللَّهَ قِيَامًا وَقُعُودًا وَعَلَىٰ جُنُوبِهِمْ',
    text: 'Ceux qui invoquent Allah debout, assis, ou couchés sur le côté.',
    source: 'Sourate Al ‘Imran, 3:191',
  },
  {
    id: 'rabbana-atina',
    type: 'verset',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    text: 'Seigneur, accorde-nous belle part ici-bas et belle part dans l’au-delà, et préserve-nous du châtiment du Feu.',
    source: 'Sourate Al-Baqara, 2:201',
  },
  {
    id: 'dhikr-plus-grand',
    type: 'verset',
    arabic: 'وَلَذِكْرُ اللَّهِ أَكْبَرُ',
    text: 'Et le rappel d’Allah est plus grand encore.',
    source: 'Sourate Al-‘Ankabout, 29:45',
  },
  {
    id: 'deux-paroles-legeres',
    type: 'hadith',
    arabic: 'كَلِمَتَانِ خَفِيفَتَانِ عَلَى اللِّسَانِ، ثَقِيلَتَانِ فِي الْمِيزَانِ، حَبِيبَتَانِ إِلَى الرَّحْمَٰنِ: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ',
    text: 'Deux paroles légères sur la langue, lourdes dans la balance et aimées du Tout Miséricordieux : « SoubhanAllahi wa bihamdihi, SoubhanAllahil ‘Adhim ».',
    source: 'Rapporté par Al-Bukhari et Muslim',
  },
  {
    id: 'cent-fois',
    type: 'hadith',
    text: 'Quiconque dit « SoubhanAllahi wa bihamdihi » cent fois en un jour, ses fautes lui sont effacées, fussent-elles aussi nombreuses que l’écume de la mer.',
    source: 'Rapporté par Al-Bukhari et Muslim',
  },
  {
    id: 'je-suis-tel-que-mon-serviteur',
    type: 'hadith',
    text: 'Allah dit : « Je suis tel que Mon serviteur pense de Moi, et Je suis avec lui lorsqu’il M’invoque. »',
    source: 'Hadith qudsi, rapporté par Al-Bukhari et Muslim',
  },
  {
    id: 'aide-moi-a-tinvoquer',
    type: 'dua',
    arabic: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
    text: 'Ô Allah, aide-moi à T’invoquer, à Te remercier et à T’adorer avec excellence.',
    source: 'Rapporté par Abou Dawoud (enseigné par le Prophète ﷺ à Mou’adh ibn Jabal)',
  },
  {
    id: 'invocation-adoration',
    type: 'hadith',
    text: 'L’invocation est l’adoration.',
    source: 'Rapporté par Abou Dawoud et At-Tirmidhi',
  },
  {
    id: 'anges-entourent',
    type: 'hadith',
    text: 'Aucun groupe ne se réunit pour invoquer Allah sans que les anges ne les entourent, que la miséricorde ne les enveloppe, que la quiétude ne descende sur eux, et qu’Allah ne les cite auprès de ceux qui sont auprès de Lui.',
    source: 'Rapporté par Mouslim',
  },
  {
    id: 'meilleure-parole',
    type: 'hadith',
    text: 'La meilleure invocation est « Lâ ilâha illa Allah ».',
    source: 'Rapporté par At-Tirmidhi',
  },
  {
    id: 'croyant-lisant',
    type: 'hadith',
    text: 'Le croyant qui récite le Coran est comme le cédrat : son parfum est agréable et sa saveur est douce.',
    source: 'Rapporté par Al-Bukhari et Muslim',
  },
  {
    id: 'matin-soir',
    type: 'dua',
    arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ',
    text: 'Ô Allah, c’est par Toi que nous entrons dans le matin et par Toi que nous entrons dans le soir ; c’est par Toi que nous vivons et par Toi que nous mourrons, et vers Toi est la résurrection.',
    source: 'Rapporté par At-Tirmidhi et Abou Dawoud',
  },
];

export const CONTENT_TYPE_LABEL = {
  verset: 'Verset du jour',
  hadith: 'Hadith du jour',
  dua: 'Dua du jour',
};

// Longueur du corps d'une notification push : au-delà, la plupart des OS
// tronquent de toute façon — on coupe proprement nous-mêmes, avec une
// ellipse, plutôt que de laisser un mot coupé en plein milieu.
const PUSH_BODY_MAX = 140;

function hashDateKey(dateKey) {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) {
    h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Index déterministe dans DAILY_CONTENT pour une clé de date "YYYY-MM-DD". */
export function dailyContentIndex(dateKey) {
  return hashDateKey(String(dateKey || '')) % DAILY_CONTENT.length;
}

/** L'élément du jour pour une clé de date donnée. */
export function contentForDate(dateKey) {
  return DAILY_CONTENT[dailyContentIndex(dateKey)];
}

// Le CONTENU du jour est le même pour tout le monde (clé de date en UTC) :
// simple (rien à stocker par utilisateur) et cohérent entre la carte
// affichée dans l'app et la notification reçue, quel que soit le fuseau du
// destinataire — seule l'HEURE D'ENVOI de la notification est localisée
// (voir shouldSendDailyContent, lib/reminders.js).
export function todayContent(now = new Date()) {
  return contentForDate(now.toISOString().slice(0, 10));
}

/** Corps de notification tronqué proprement — voir PUSH_BODY_MAX. */
export function pushBody(item) {
  const t = item.text;
  return t.length > PUSH_BODY_MAX ? t.slice(0, PUSH_BODY_MAX - 1).trimEnd() + '…' : t;
}
