// Couvre le point explicitement noté comme un trou dans ANALYSE.md
// (§7 « Tests de composants et e2e ») : les routes /api/* n'avaient aucun
// test sur leur comportement HTTP réel (statut, rejet), seule leur logique
// interne pouvait l'être via lib/*.test.js. Ici on frappe les endpoints
// démarrés par `next start`, sans navigateur, pour vérifier qu'ils refusent
// bien tout appel sans identité valide — le même principe que
// server/access.js : verifyUser() rejette avant de toucher aux données.
//
// Volontairement PAS de test avec un idToken valide : ça demanderait un vrai
// compte Firebase Auth (émulateur ou compte de test) — hors périmètre de
// cette première passe, voir e2e/README.md.
import { test, expect } from '@playwright/test';

test.describe('Routes /api — rejet sans identité valide', () => {
  test('POST /api/check-access sans idToken → 401', async ({ request }) => {
    const res = await request.post('/api/check-access', { data: {} });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('POST /api/check-access avec idToken invalide → 401 (pas 500)', async ({ request }) => {
    // server/access.js: verifyIdToken() rejeté → httpError(401), quel que
    // soit le service account configuré (voir playwright.config.ts) — un 500
    // ici signalerait que ce garde-fou a changé de comportement.
    const res = await request.post('/api/check-access', { data: { idToken: 'not-a-real-token' } });
    expect(res.status()).toBe(401);
  });

  test('POST /api/list-content sans idToken → 401, ne fuit aucune métadonnée', async ({ request }) => {
    const res = await request.post('/api/list-content', { data: { kind: 'asma' } });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.items).toBeUndefined();
  });

  test('POST /api/social sans idToken → 401', async ({ request }) => {
    const res = await request.post('/api/social', { data: { cat: 'product', key: 'x', action: 'get' } });
    expect(res.status()).toBe(401);
  });

  test('GET sur une route POST-only → 405 (pas un crash générique)', async ({ request }) => {
    const res = await request.get('/api/check-access');
    expect(res.status()).toBe(405);
  });
});
