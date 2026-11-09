import { describe, expect, it } from 'vitest';
import { database, runtime } from './support/runtime';

const user = { uid: 'visitor', email: 'visitor@example.test' };
const day = new Date().toISOString().slice(0, 10);
const month = day.slice(0, 7);
const ANDROID_APP = 'Mozilla/5.0 (Linux; Android 13; SM-A145F; wv) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36';

async function track(db, body, headers = {}) {
  const handler = runtime(db, { user })('pages/api/track.js').default;
  const res = {
    code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; },
    json(v) { this.body = v; return this; }, end() { return this; },
  };
  await handler({ method: 'POST', headers: { 'user-agent': ANDROID_APP, ...headers }, body: { idToken: 'x', ...body } }, res);
  return res;
}

describe('Mesure d’audience anonyme (/api/track)', () => {
  it('compte la visite, l’appareil et le pays sans accord détaillé, sans aucune donnée personnelle', async () => {
    const db = database();
    expect((await track(db, { type: 'visit', page: 'accueil' }, { 'x-vercel-ip-country': 'sn' })).code).toBe(200);
    expect(db.read('analytics/daily/' + day)).toEqual({ visits: 1, unique: 1, platforms: { android_app: 1 }, countries: { SN: 1 } });
    expect(db.read('analytics/geo/' + month)).toEqual({ SN: 1 });
    expect(JSON.stringify(db.read('analytics'))).not.toMatch(/visitor/);
    // Le journal détaillé reste réservé aux comptes qui l’acceptent.
    expect(db.read('analytics/visits')).toBeNull();
    expect(db.read('activity_feed')).toBeNull();
    expect(db.read('user_sessions/visitor/countryCode')).toBeNull();
  });

  it('un même compte ne compte qu’une fois par jour comme visiteur unique', async () => {
    const db = database();
    await track(db, { type: 'visit' }, { 'x-vercel-ip-country': 'ML' });
    await track(db, { type: 'visit' }, { 'x-vercel-ip-country': 'ML' });
    expect(db.read('analytics/daily/' + day)).toEqual({ visits: 2, unique: 1, platforms: { android_app: 1 }, countries: { ML: 1 } });
    expect(db.read('analytics/geo/' + month)).toEqual({ ML: 1 });
  });

  it('pays inconnu sous « XX », et les autres événements ne comptent pas de visite', async () => {
    const db = database();
    await track(db, { type: 'visit' });
    await track(db, { type: 'product_view', productKey: 'p' });
    expect(db.read('analytics/daily/' + day + '/visits')).toBe(1);
    expect(db.read('analytics/daily/' + day + '/countries')).toEqual({ XX: 1 });
  });
});
