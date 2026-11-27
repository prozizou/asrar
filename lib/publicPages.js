// lib/publicPages.js — Pages publiques « Découvrir » (app/decouvrir).
//
// Tout le reste du site exige une connexion Google : sans ces pages, un
// visiteur non connecté — et les robots de Google (recherche, AdSense) — ne
// voyaient qu'un écran de connexion. Ces pages présentent l'application et
// chacun de ses modules, sans révéler le contenu réservé aux abonnés (textes
// des secrets, livres). Elles sont rendues sur le serveur, sans connexion,
// sans redirection vers Google Play et SANS publicité.
//
// Textes à relire par le propriétaire : ton descriptif et culturel, aucune
// promesse de résultat.

export const PUBLIC_PREFIX = '/decouvrir';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.Asrar';
export const CONTACT = { email: 'asrarlilahi66@gmail.com', phone: '+221 77 350 05 95' };

export function isPublicPath(path) {
  const value = String(path || '');
  return value === PUBLIC_PREFIX || value.startsWith(PUBLIC_PREFIX + '/');
}

export const MODULES = [
  {
    slug: 'secrets-mystiques',
    title: 'Secrets mystiques',
    category: 'Ressources',
    summary: 'Un recueil classé de secrets et d’invocations de la tradition, consultable par thème.',
    sections: [
      {
        heading: 'Un recueil organisé par thème',
        paragraphs: [
          'Le module Secrets mystiques rassemble des fiches issues de la tradition spirituelle ouest-africaine et du soufisme : invocations, usages de versets, formules de protection ou d’ouverture. Chaque fiche porte un titre, une courte description et, lorsqu’elle existe, une illustration.',
          'Les fiches sont rangées par catégories (protections, ouvertures, déblocages, entre autres), ce qui permet de retrouver rapidement un sujet sans parcourir toute la collection. Une recherche et un système de favoris complètent la navigation.',
        ],
      },
      {
        heading: 'Lecture et partage',
        paragraphs: [
          'Une fiche s’ouvre dans un lecteur confortable, adapté à la lecture sur téléphone. Les fiches peuvent être gardées en favoris pour être relues plus tard, et partagées avec un lien qui ouvre directement la bonne fiche dans l’application.',
          'Le contenu détaillé des fiches est réservé aux membres abonnés. Il s’agit d’un patrimoine transmis à titre culturel et spirituel : son usage relève de la responsabilité et de la conscience de chacun.',
        ],
      },
    ],
  },
  {
    slug: 'bibliotheque',
    title: 'Bibliothèque',
    category: 'Ressources',
    summary: 'Livres et manuscrits numérisés, à lire en ligne, à commenter et à partager.',
    sections: [
      {
        heading: 'Livres et manuscrits',
        paragraphs: [
          'La Bibliothèque réunit des ouvrages et des manuscrits numérisés autour des sciences religieuses, de la spiritualité et des sciences traditionnelles. Chaque ouvrage est présenté avec sa couverture et son titre ; il s’ouvre dans un lecteur adapté au téléphone.',
          'De nouvelles publications sont ajoutées régulièrement, et les membres reçoivent une notification lorsqu’un document est publié.',
        ],
      },
      {
        heading: 'Une bibliothèque vivante',
        paragraphs: [
          'Les lecteurs peuvent aimer un ouvrage, laisser un commentaire et partager un lien direct vers un livre. Ces échanges aident chacun à repérer les ouvrages les plus appréciés de la communauté.',
        ],
      },
    ],
  },
  {
    slug: 'zikr-collectif',
    title: 'Zikr collectif',
    category: 'Spiritualité',
    summary: 'Des groupes de dhikr pour réciter ensemble jusqu’à un objectif commun.',
    sections: [
      {
        heading: 'Réciter ensemble, où que l’on soit',
        paragraphs: [
          'Le Zikr collectif permet de créer ou de rejoindre un groupe de dhikr autour d’une formule et d’un objectif : par exemple un nombre de récitations ou un Hatim (lecture complète du Coran) partagé entre les participants. Chacun égrène son chapelet numérique et la progression du groupe se met à jour pour tous.',
          'Le créateur du groupe suit la participation, et une fois l’objectif atteint il peut recueillir les vœux (dua) des participants, qui restent privés.',
        ],
      },
      {
        heading: 'Une discussion pour chaque groupe',
        paragraphs: [
          'Chaque groupe dispose de sa discussion : messages, photos, vocaux et réponses, pour s’encourager, s’organiser ou partager un rappel. Les membres peuvent aussi rechercher un message et transférer un contenu vers un autre groupe.',
        ],
      },
    ],
  },
  {
    slug: 'marche',
    title: 'Marché',
    category: 'Accueil',
    summary: 'Une vitrine de produits proposés par des vendeurs de la communauté.',
    sections: [
      {
        heading: 'Des boutiques de la communauté',
        paragraphs: [
          'Le Marché est la page d’accueil de l’application. Des vendeurs y présentent leurs produits : ouvrages, formations, articles et services liés à la spiritualité et aux sciences traditionnelles. Chaque produit a sa fiche avec photo, prix et description, ainsi qu’une boutique qui regroupe toutes les offres d’un même vendeur.',
        ],
      },
      {
        heading: 'Avis et contact direct',
        paragraphs: [
          'Les acheteurs peuvent aimer un produit, laisser un avis noté et contacter le vendeur. Une recherche permet de filtrer les produits, et les plus populaires sont mis en avant.',
        ],
      },
    ],
  },
  {
    slug: 'al-qalam',
    title: 'Al Qalam',
    category: 'Sciences traditionnelles',
    summary: 'Composer un verset ou un texte en calligraphie arabe et l’exporter en PDF ou Word.',
    sections: [
      {
        heading: 'La calligraphie à portée de main',
        paragraphs: [
          'Al Qalam aide à mettre en page un verset ou un texte arabe dans une calligraphie soignée. On saisit ou choisit le texte, on règle sa mise en page, puis on obtient une page prête à imprimer.',
          'Le résultat peut être exporté en PDF ou en document Word, enregistré sur le téléphone et partagé.',
        ],
      },
    ],
  },
  {
    slug: 'geomancie',
    title: 'Géomancie',
    category: 'Sciences traditionnelles',
    summary: 'Le tirage géomantique (khatt ar-raml) et la lecture de ses figures.',
    sections: [
      {
        heading: 'Une science ancienne',
        paragraphs: [
          'La géomancie, appelée khatt ar-raml ou « science du sable », est une tradition très ancienne d’Afrique et du monde arabe. Elle repose sur seize figures composées de points simples ou doubles, obtenues par tirage puis disposées dans un thème.',
          'Le module réalise le tirage, construit le thème complet et présente la signification traditionnelle des figures et des maisons, à titre d’étude de ce patrimoine.',
        ],
      },
    ],
  },
  {
    slug: 'hatims',
    title: 'Hatims (carrés numériques)',
    category: 'Sciences traditionnelles',
    summary: 'Construire des carrés numériques (wafq) à partir d’un nombre.',
    sections: [
      {
        heading: 'Les carrés numériques',
        paragraphs: [
          'Un carré numérique, ou wafq, est une grille où la somme de chaque ligne, de chaque colonne et des diagonales donne le même total. Cette construction mathématique occupe une place importante dans la tradition des sciences des lettres et des nombres.',
          'Le module construit automatiquement des carrés de différentes tailles à partir d’un nombre donné, avec plusieurs méthodes de remplissage, puis permet de les exporter en Word.',
        ],
      },
    ],
  },
  {
    slug: 'combinaisons',
    title: 'Combinaisons et abjad',
    category: 'Outils',
    summary: 'Calcul de la valeur numérique (abjad) et rapprochement avec les 99 Noms.',
    sections: [
      {
        heading: 'Le calcul abjad',
        paragraphs: [
          'Dans le système abjad, chaque lettre arabe correspond à une valeur numérique. L’outil Combinaisons calcule la valeur d’un nom ou d’un mot et recherche les Noms divins (Asma ul Husna) dont la valeur s’en rapproche, selon les méthodes traditionnelles.',
          'Les recherches peuvent être enregistrées pour être retrouvées plus tard.',
        ],
      },
    ],
  },
  {
    slug: 'heures-planetaires',
    title: 'Heures planétaires',
    category: 'Outils',
    summary: 'L’heure planétaire du moment, calculée pour votre ville.',
    sections: [
      {
        heading: 'Les heures planétaires',
        paragraphs: [
          'La tradition divise le jour et la nuit en douze heures chacune, gouvernées tour à tour par les sept planètes classiques. Leur durée varie avec les saisons, car elle dépend des heures de lever et de coucher du soleil.',
          'Le module calcule ces heures pour votre ville, indique la planète du moment et peut programmer un rappel avant une heure choisie. La ville peut être choisie à la main, sans activer la localisation.',
        ],
      },
    ],
  },
  {
    slug: 'calendrier-hijri',
    title: 'Date hijri',
    category: 'Outils',
    summary: 'La date du jour dans les calendriers hégirien et grégorien.',
    sections: [
      {
        heading: 'Deux calendriers côte à côte',
        paragraphs: [
          'Le calendrier hégirien est lunaire : ses mois suivent les phases de la lune, et l’année compte environ onze jours de moins que l’année grégorienne. Le module affiche la date du jour dans les deux calendriers, avec le nom des mois islamiques.',
        ],
      },
    ],
  },
  {
    slug: 'rouwhanes',
    title: 'Rouwhanes',
    category: 'Spiritualité',
    summary: 'Les noms des anges associés aux lettres et aux jours dans la tradition.',
    sections: [
      {
        heading: 'Une tradition d’étude',
        paragraphs: [
          'Dans la tradition des sciences des lettres, chaque lettre et chaque jour sont associés à un nom angélique (rouhani). Le module présente ces correspondances et les calcule à partir d’un nom ou d’un vœu, à titre d’étude de ce savoir traditionnel.',
        ],
      },
    ],
  },
  {
    slug: 'asrar-chat',
    title: 'Asrar-chat et visioconférence',
    category: 'Spiritualité',
    summary: 'Messagerie, groupes, chaînes et réunions vidéo pour la communauté.',
    sections: [
      {
        heading: 'Échanger et apprendre ensemble',
        paragraphs: [
          'Asrar-chat est la messagerie de l’application : discussions privées, groupes et chaînes thématiques. Les enseignants et les vendeurs peuvent y partager des contenus avec leurs élèves ou leurs clients.',
          'Le module Visioconférence organise des réunions et des cours en ligne avec Google Meet.',
        ],
      },
    ],
  },
];

export function findModule(slug) {
  return MODULES.find((module) => module.slug === slug);
}
