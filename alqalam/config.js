// config.js
export const formules = {
    ouverture: "كن بسم الله الرحمن الرحيم اللهم صل على سيدنا محمد و على ءاله و صحبه و سلم تسليما ",
    fermeture: " اللهم صل على سيدنا محمد و على ءاله و صحبه و سلم تسليما فيكون ءامين يا رب العالمين و الحمد لله رب العالمين"
};

export const config = {
    MAX_PREVIEW: 500,          // Répétitions max affichées dans l'aperçu
    CHUNK_SIZE: 10000,         // Taille de chunk pour les opérations lourdes
    MAX_TOTAL_REPEAT: 30000,   // Limite absolue de répétitions (sécurité mobile)
    MAX_DOM_CHARS: 8000,       // Nombre max de caractères dans l'aperçu DOM
    PDF_CHUNK_SIZE: 100,       // Nombre de répétitions par chunk lors de la génération PDF
    DEBOUNCE_DELAY: 300        // Délai par défaut pour le debounce (ms)
};
