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
  it('connexion : e-mail, pays, heure et appareil enregistrés pour chaque utilisateur', async () => {
    const db = database();
    const before = Date.now();
    expect((await track(db, { type: 'visit', page: 'accueil' }, { 'x-vercel-ip-country': 'sn' })).code).toBe(200);
    expect(db.read('analytics/daily/' + day)).toEqual({ visits: 1, unique: 1, platforms: { android_app: 1 }, countries: { SN: 1 } });
    expect(db.read('analytics/geo/' + month)).toEqual({ SN: 1 });
    const session = db.read('user_sessions/visitor');
    expect(session).toMatchObject({ email: 'visitor@example.test', country: 'Sénégal', countryCode: 'SN', platform: 'android_app', lastPage: 'accueil' });
    expect(session.lastLoginAt).toBeGreaterThanOrEqual(before);
    expect(Object.values(db.read('activity_feed'))[0]).toMatchObject({ email: 'visitor@example.test', type: 'visit', countryCode: 'SN' });
  });

  it('lot d’actions : chaque page et chaque bouton, avec e-mail, pays et heure', async () => {
    const db = database();
    const now = Date.now();
    const events = [
      { type: 'page', page: 'marche', at: now - 5000 },
      { type: 'click', page: 'marche', label: 'Ajouter <au> panier', at: now - 2000 },
      { type: 'click', page: 'marche', label: 'futur', at: now + 3_600_000 },
      { type: 'inconnu', page: 'x' },
    ];
    const res = await track(db, { type: 'actions', events }, { 'x-vercel-ip-country': 'CI' });
    expect(res.body).toEqual({ ok: true, count: 3 });
    const feed = Object.values(db.read('activity_feed'));
    expect(feed.map((e) => [e.type, e.page, e.label || ''])).toEqual([['page', 'marche', ''], ['click', 'marche', 'Ajouter  au  panier'], ['click', 'marche', 'futur']]);
    expect(feed.every((e) => e.email === 'visitor@example.test' && e.countryCode === 'CI' && e.at <= Date.now())).toBe(true);
    expect(feed[0].at).toBe(now - 5000);
    expect(db.read('user_sessions/visitor/lastAction')).toBe('futur');
    // Un lot n’est pas une visite.
    expect(db.read('analytics/daily')).toBeNull();
  });

  it('lot d’actions borné à 30 événements', async () => {
    const db = database();
    const events = Array.from({ length: 50 }, (_, i) => ({ type: 'click', page: 'p', label: 'b' + i }));
    expect((await track(db, { type: 'actions', events })).body.count).toBe(30);
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
