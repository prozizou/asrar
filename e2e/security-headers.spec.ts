// Vérifie que les en-têtes de sécurité définis dans next.config.mjs
// (SECURITY_HEADERS, source unique lib/csp.js pour la CSP) atteignent
// RÉELLEMENT le navigateur — jusqu'ici seule la définition était testée
// (aucun test ne frappait le serveur réel). Une régression ici (en-tête
// supprimé par erreur, CSP qui casse un domaine nécessaire) serait sinon
// invisible jusqu'au déploiement.
import { test, expect } from '@playwright/test';

test.describe('En-têtes de sécurité (next.config.mjs)', () => {
  test('la page d’accueil porte tous les en-têtes attendus', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBeLessThan(400);

    const headers = res.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['strict-transport-security']).toContain('max-age=63072000');

    const csp = headers['content-security-policy'];
    expect(csp).toBeTruthy();
    // Points documentés dans lib/csp.js (voir son en-tête pour l'historique) —
    // un test qui échoue ici signale une régression sur un domaine dont
    // dépend une fonctionnalité réelle (Google Sign-In, Firebase, Cloudinary),
    // pas juste un détail cosmétique.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('accounts.google.com'); // Google Sign-In
    expect(csp).toContain('*.firebaseio.com'); // Firebase Auth/RTDB
    expect(csp).toContain('res.cloudinary.com'); // images boutique/marché
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
  });

  test('les assets statiques portent aussi les en-têtes (appliqués à /:path*)', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.status()).toBe(200);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });
});
