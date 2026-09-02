// Vérifie que les anciennes URLs .html (next.config.mjs → LEGACY) redirigent
// TOUJOURS vers les bonnes nouvelles routes — un lien déjà partagé (réseaux
// sociaux, favoris, moteurs de recherche) qui cesse de rediriger est une
// régression silencieuse : rien dans le lint/typecheck/build ne la détecte,
// et personne ne revisite une vieille URL pour la remarquer à temps.
//
// Échantillon représentatif de LEGACY (pas l'exhaustivité — un ajout futur à
// ce tableau n'a pas besoin d'une entrée ici pour rester couvert par le
// principe du test, seulement s'il mérite sa propre vérification).
import { test, expect } from '@playwright/test';

const CASES: Array<[string, string]> = [
  ['/index.html', '/'],
  ['/marche/marche.html', '/'],
  ['/marche', '/'], // ancienne route (avant que le Marché devienne l'accueil)
  ['/asrar/asrar.html', '/asrar'],
  ['/abajad/abajad.html', '/abajad'],
  ['/alqalam/index.html', '/alqalam'],
  ['/Benefits/index.html', '/benefits'],
];

test.describe('Compatibilité des anciennes URLs (redirects)', () => {
  for (const [source, destination] of CASES) {
    test(`${source} → ${destination}`, async ({ page }) => {
      await page.goto(source);
      // Redirect non permanent (permanent: false → 307) : le navigateur suit
      // jusqu'à la destination finale — comparaison exacte du chemin (pas une
      // regex sur l'URL complète, pour ne pas confondre '/' avec un simple
      // suffixe de n'importe quelle autre route).
      const path = new URL(page.url()).pathname;
      expect(path).toBe(destination);
    });
  }
});
