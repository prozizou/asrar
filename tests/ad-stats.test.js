import { describe, expect, it } from 'vitest';
import { database, runtime, invoke } from './support/runtime';

const user = { uid: 'visitor', email: 'visitor@example.test' };
const day = new Date().toISOString().slice(0, 10);
const track = (db, body) => invoke(runtime(db, { user })('pages/api/track.js').default, body);
const optedIn = (extra = {}) => database({ account_settings: { visitor: { analytics: true } }, ...extra });

describe('Compteurs de la pub au clic (/api/track, type ad_stats)', () => {
  it('ajoute les compteurs du jour sans visite ni fil d’activité', async () => {
    const db = optedIn();
    const body = { type: 'ad_stats', adStats: { opened: 5, quick: 2, closed: 1, open: 2 } };
    expect((await track(db, body)).code).toBe(200);
    await track(db, { type: 'ad_stats', adStats: { opened: 3, quick: 0, closed: 0, open: 3 } });
    expect(db.read('analytics/ads/' + day)).toEqual({ opened: 8, quick: 2, closed: 1, open: 5 });
    expect(db.read('analytics/visits')).toBeNull();
    expect(db.read('activity_feed')).toBeNull();
  });

  it('respecte le réglage statistiques du compte : rien n’est enregistré sans accord', async () => {
    const db = database();
    expect((await track(db, { type: 'ad_stats', adStats: { opened: 1, quick: 1, closed: 0, open: 0 } })).code).toBe(200);
    expect(db.read('analytics/ads')).toBeNull();
  });

  it('refuse les valeurs incohérentes et borne les envois gonflés', async () => {
    const db = optedIn();
    await track(db, { type: 'ad_stats', adStats: { opened: 1, quick: 5, closed: 0, open: 0 } });
    await track(db, { type: 'ad_stats', adStats: 'nimporte quoi' });
    await track(db, { type: 'ad_stats', adStats: { opened: -4, quick: -1, closed: 0, open: 0 } });
    expect(db.read('analytics/ads')).toBeNull();
    await track(db, { type: 'ad_stats', adStats: { opened: 1e9, quick: 0, closed: 0, open: 1e9 } });
    expect(db.read('analytics/ads/' + day)).toEqual({ opened: 100, open: 100 });
  });
});
