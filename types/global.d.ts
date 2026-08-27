// Déclarations ambiantes globales pour la conversion .js → .tsx des pages
// (cf. tsconfig.json). Couvre uniquement ce que le compilateur TypeScript a
// besoin de résoudre — Next.js gère déjà ces imports nativement au build
// (webpack/postcss), ce fichier ne fait qu'empêcher tsc de les rejeter.

// Imports CSS "side-effect" (ex. `import './abajad.css';` dans une page
// .tsx) : le contenu du fichier .css n'a pas de type à vérifier, seule son
// existence en tant que module compte ici.
declare module '*.css';
