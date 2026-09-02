import { describe, it, expect } from 'vitest';
import {
  cleanHour, cleanMinute, cleanTimeZone, localHHmm, localDateKey,
  shouldSendWird, shouldSendSessionReminder, SESSION_LEAD_MS, SESSION_GRACE_MS,
} from './reminders';

describe('cleanHour / cleanMinute', () => {
  it('accepte 0-23 / 0-59', () => {
    expect(cleanHour(0)).toBe(0);
    expect(cleanHour(23)).toBe(23);
    expect(cleanHour('20')).toBe(20);
    expect(cleanMinute(0)).toBe(0);
    expect(cleanMinute(59)).toBe(59);
  });

  it('rejette hors bornes ou non numérique', () => {
    expect(cleanHour(24)).toBeNull();
    expect(cleanHour(-1)).toBeNull();
    expect(cleanHour('abc')).toBeNull();
    expect(cleanMinute(60)).toBeNull();
    expect(cleanMinute(-1)).toBeNull();
  });

  it('tronque un décimal', () => {
    expect(cleanHour(20.9)).toBe(20);
  });
});

describe('cleanTimeZone', () => {
  it('accepte un fuseau IANA plausible', () => {
    expect(cleanTimeZone('Europe/Paris')).toBe('Europe/Paris');
    expect(cleanTimeZone('Africa/Abidjan')).toBe('Africa/Abidjan');
  });

  it('replie sur UTC si absent ou de forme invalide', () => {
    expect(cleanTimeZone('')).toBe('UTC');
    expect(cleanTimeZone(undefined)).toBe('UTC');
    expect(cleanTimeZone('<script>')).toBe('UTC');
  });
});

describe('localHHmm / localDateKey', () => {
  it('formate l’heure et la date locales dans le fuseau donné', () => {
    const now = new Date('2026-01-15T23:30:00Z');
    expect(localHHmm(now, 'UTC')).toBe('23:30');
    expect(localDateKey(now, 'UTC')).toBe('2026-01-15');
    // Europe/Paris (UTC+1 en janvier) : 23:30 UTC → 00:30 le lendemain.
    expect(localHHmm(now, 'Europe/Paris')).toBe('00:30');
    expect(localDateKey(now, 'Europe/Paris')).toBe('2026-01-16');
  });

  it('replie sur UTC si le fuseau stocké est invalide', () => {
    const now = new Date('2026-01-15T10:00:00Z');
    expect(localHHmm(now, 'Not/AZone')).toBe('10:00');
  });
});

describe('shouldSendWird', () => {
  const now = new Date('2026-01-15T20:05:00Z'); // 20:05 UTC

  it('false si désactivé ou absent', () => {
    expect(shouldSendWird(null, now)).toBe(false);
    expect(shouldSendWird({ wirdEnabled: false, wirdHour: 20, wirdMinute: 0, tz: 'UTC' }, now)).toBe(false);
  });

  it('true dès que l’heure locale programmée est atteinte, pas encore envoyée aujourd’hui', () => {
    const settings = { wirdEnabled: true, wirdHour: 20, wirdMinute: 0, tz: 'UTC' };
    expect(shouldSendWird(settings, now)).toBe(true);
  });

  it('false avant l’heure programmée', () => {
    const settings = { wirdEnabled: true, wirdHour: 21, wirdMinute: 0, tz: 'UTC' };
    expect(shouldSendWird(settings, now)).toBe(false);
  });

  it('false si déjà envoyé aujourd’hui (même après l’heure)', () => {
    const settings = { wirdEnabled: true, wirdHour: 20, wirdMinute: 0, tz: 'UTC', lastSentDate: '2026-01-15' };
    expect(shouldSendWird(settings, now)).toBe(false);
  });

  it('true à nouveau le lendemain (nouvelle clé de date)', () => {
    const tomorrow = new Date('2026-01-16T20:05:00Z');
    const settings = { wirdEnabled: true, wirdHour: 20, wirdMinute: 0, tz: 'UTC', lastSentDate: '2026-01-15' };
    expect(shouldSendWird(settings, tomorrow)).toBe(true);
  });
});

describe('shouldSendSessionReminder', () => {
  const now = new Date('2026-01-15T20:00:00Z').getTime();

  it('false sans sessionAt ou déjà envoyé', () => {
    expect(shouldSendSessionReminder(null, false, new Date(now))).toBe(false);
    expect(shouldSendSessionReminder(now + 60_000, true, new Date(now))).toBe(false);
  });

  it('true dans la fenêtre [avant le lead, après la grâce]', () => {
    expect(shouldSendSessionReminder(now + SESSION_LEAD_MS, false, new Date(now))).toBe(true);
    expect(shouldSendSessionReminder(now - SESSION_GRACE_MS, false, new Date(now))).toBe(true);
    expect(shouldSendSessionReminder(now, false, new Date(now))).toBe(true);
  });

  it('false trop tôt ou trop tard', () => {
    expect(shouldSendSessionReminder(now + SESSION_LEAD_MS + 60_000, false, new Date(now))).toBe(false);
    expect(shouldSendSessionReminder(now - SESSION_GRACE_MS - 60_000, false, new Date(now))).toBe(false);
  });
});
