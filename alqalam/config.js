// config.js
export const formules = {
    ouverture: "كن بسم الله الرحمن الرحيم اللهم صل على سيدنا محمد و على ءاله و صحبه و سلم تسليما ",
    fermeture: " اللهم صل على سيدنا محمد و على ءاله و صحبه و سلم تسليما فيكون ءامين يا رب العالمين و الحمد لله رب العالمين"
};

// ─── POLICES PREMIUM (hébergées sur Cloudinary) ───────────────────────────
// Réservées à l'abonnement ≥ FONT_MIN_LEVEL (voir config plus bas), sauf level: 0.
// Remplacez les `url` par vos vrais fichiers .ttf/.otf/.woff2 hébergés sur
// Cloudinary (type "raw"), ex :
//   https://res.cloudinary.com/VOTRE_CLOUD/raw/upload/v1/polices/aljazeera.ttf
// `name` = nom d'affichage ; `family` = nom CSS interne (unique, sans espace).
export const POLICES = [
    { name: 'Alkalami (par défaut)', family: 'Alkalami',        url: '', level: 0 },   // déjà chargée (Google Fonts)
    { name: 'Scheherazade New',      family: 'Scheherazade New', url: '', level: 0 },   // déjà chargée (Google Fonts)
    { name: 'Amiri',                 family: 'AmiriCloud',       url: 'https://res.cloudinary.com/CHANGEZ_MOI/raw/upload/polices/amiri.ttf',       level: 45000 },
    { name: 'Aref Ruqaa',            family: 'ArefRuqaaCloud',   url: 'https://res.cloudinary.com/CHANGEZ_MOI/raw/upload/polices/aref-ruqaa.ttf',   level: 45000 },
    { name: 'Lateef',                family: 'LateefCloud',      url: 'https://res.cloudinary.com/CHANGEZ_MOI/raw/upload/polices/lateef.ttf',      level: 45000 },
    { name: 'Reem Kufi',             family: 'ReemKufiCloud',    url: 'https://res.cloudinary.com/CHANGEZ_MOI/raw/upload/polices/reem-kufi.ttf',    level: 45000 }
];

export const config = {
    MAX_PREVIEW: 500,          // Répétitions max affichées dans l'aperçu
    CHUNK_SIZE: 10000,         // Taille de chunk pour les opérations lourdes
    MAX_TOTAL_REPEAT: 30000,   // Limite absolue de répétitions (sécurité mobile)
    MAX_DOM_CHARS: 8000,       // Nombre max de caractères dans l'aperçu DOM
    PDF_CHUNK_SIZE: 100,       // Nombre de répétitions par chunk lors de la génération PDF
    DEBOUNCE_DELAY: 300,       // Délai par défaut pour le debounce (ms)
    FONT_MIN_LEVEL: 45000,     // Palier d'abonnement (FCFA) requis pour les polices premium
    POLICES: POLICES           // Accessible aussi via config.POLICES (import résilient)
};
