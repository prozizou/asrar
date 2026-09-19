import { describe, it, expect } from 'vitest';
import {
  cleanHour, cleanMinute, cleanTimeZone, localHHmm, localDateKey,
  shouldSendWird, shouldSendDailyContent, DAILY_CONTENT_HOUR, DAILY_CONTENT_MINUTE,
  shouldSendSessionReminder, SESSION_LEAD_MS, SESSION_GRACE_MS,
  shouldSendRenewalReminder, shouldSendExpiredNotice, RENEWAL_REMINDER_DAYS, RENEWAL_GRACE_DAYS,
  daysUntil, renewalWhatsAppMessage, renewalWhatsAppUrl,
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

describe('shouldSendDailyContent', () => {
  const before = new Date(Date.UTC(2026, 0, 15, DAILY_CONTENT_HOUR, DAILY_CONTENT_MINUTE - 5));
  const atHour = new Date(Date.UTC(2026, 0, 15, DAILY_CONTENT_HOUR, DAILY_CONTENT_MINUTE));

  it('false si désactivé ou absent', () => {
    expect(shouldSendDailyContent(null, atHour)).toBe(false);
    expect(shouldSendDailyContent({ dailyContentEnabled: false, tz: 'UTC' }, atHour)).toBe(false);
  });

  it('false avant l’heure fixe programmée', () => {
    expect(shouldSendDailyContent({ dailyContentEnabled: true, tz: 'UTC' }, before)).toBe(false);
  });

  it('true dès que l’heure fixe est atteinte, pas encore envoyé aujourd’hui', () => {
    expect(shouldSendDailyContent({ dailyContentEnabled: true, tz: 'UTC' }, atHour)).toBe(true);
  });

  it('false si déjà envoyé aujourd’hui (même après l’heure)', () => {
    const settings = { dailyContentEnabled: true, tz: 'UTC', lastContentSentDate: '2026-01-15' };
    expect(shouldSendDailyContent(settings, atHour)).toBe(false);
  });

  it('true à nouveau le lendemain (nouvelle clé de date)', () => {
    const tomorrow = new Date(Date.UTC(2026, 0, 16, DAILY_CONTENT_HOUR, DAILY_CONTENT_MINUTE));
    const settings = { dailyContentEnabled: true, tz: 'UTC', lastContentSentDate: '2026-01-15' };
    expect(shouldSendDailyContent(settings, tomorrow)).toBe(true);
  });

  it('indépendant du wird — les deux peuvent être vrais sur le même document', () => {
    const settings = {
      wirdEnabled: true, wirdHour: DAILY_CONTENT_HOUR, wirdMinute: DAILY_CONTENT_MINUTE, tz: 'UTC',
      dailyContentEnabled: true,
    };
    expect(shouldSendWird(settings, atHour)).toBe(true);
    expect(shouldSendDailyContent(settings, atHour)).toBe(true);
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

describe('shouldSendRenewalReminder', () => {
  const now = new Date('2026-01-15T12:00:00Z');
  const nowMs = now.getTime();

  it('false sans achat, à vie, ou expiresAt non numérique', () => {
    expect(shouldSendRenewalReminder(null, now)).toBe(false);
    expect(shouldSendRenewalReminder({ expiresAt: 'lifetime' }, now)).toBe(false);
    expect(shouldSendRenewalReminder({}, now)).toBe(false);
  });

  it('false si l’échéance est plus loin que RENEWAL_REMINDER_DAYS', () => {
    const far = nowMs + (RENEWAL_REMINDER_DAYS + 1) * 864e5;
    expect(shouldSendRenewalReminder({ expiresAt: far }, now)).toBe(false);
  });

  it('true dans la fenêtre avant expiration, pas encore envoyé pour cette échéance', () => {
    const soon = nowMs + 2 * 864e5;
    expect(shouldSendRenewalReminder({ expiresAt: soon }, now)).toBe(true);
  });

  it('false si déjà expiré (relève de shouldSendExpiredNotice, pas de ce rappel)', () => {
    expect(shouldSendRenewalReminder({ expiresAt: nowMs - 1000 }, now)).toBe(false);
  });

  it('false si déjà envoyé POUR CETTE échéance précise', () => {
    const soon = nowMs + 2 * 864e5;
    expect(shouldSendRenewalReminder({ expiresAt: soon, renewalReminderForExpiry: soon }, now)).toBe(false);
  });

  it('redevient vrai après une prolongation (nouvelle valeur d’expiresAt)', () => {
    const oldExpiry = nowMs + 2 * 864e5;
    const newExpiry = nowMs + 90 * 864e5; // prolongé loin — pas encore dans la fenêtre
    expect(shouldSendRenewalReminder({ expiresAt: newExpiry, renewalReminderForExpiry: oldExpiry }, now)).toBe(false);
    const newExpirySoon = nowMs + 1 * 864e5; // prolongé, mais retombe déjà dans la fenêtre
    expect(shouldSendRenewalReminder({ expiresAt: newExpirySoon, renewalReminderForExpiry: oldExpiry }, now)).toBe(true);
  });
});

describe('shouldSendExpiredNotice', () => {
  const now = new Date('2026-01-15T12:00:00Z');
  const nowMs = now.getTime();

  it('false sans achat, à vie, ou pas encore expiré', () => {
    expect(shouldSendExpiredNotice(null, now)).toBe(false);
    expect(shouldSendExpiredNotice({ expiresAt: 'lifetime' }, now)).toBe(false);
    expect(shouldSendExpiredNotice({ expiresAt: nowMs + 1000 }, now)).toBe(false);
  });

  it('true juste après expiration', () => {
    expect(shouldSendExpiredNotice({ expiresAt: nowMs - 1000 }, now)).toBe(true);
    expect(shouldSendExpiredNotice({ expiresAt: nowMs }, now)).toBe(true);
  });

  it('false au-delà de RENEWAL_GRACE_DAYS après expiration', () => {
    const longAgo = nowMs - (RENEWAL_GRACE_DAYS + 1) * 864e5;
    expect(shouldSendExpiredNotice({ expiresAt: longAgo }, now)).toBe(false);
  });

  it('false si déjà envoyé pour cette échéance, redevient vrai après une nouvelle expiration', () => {
    const exp = nowMs - 1000;
    expect(shouldSendExpiredNotice({ expiresAt: exp, expiredNoticeForExpiry: exp }, now)).toBe(false);
    const laterExp = nowMs - 500;
    expect(shouldSendExpiredNotice({ expiresAt: laterExp, expiredNoticeForExpiry: exp }, now)).toBe(true);
  });
});

describe('daysUntil', () => {
  it('arrondit au jour supérieur', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    expect(daysUntil(now.getTime() + 2.1 * 864e5, now)).toBe(3);
    expect(daysUntil(now.getTime() + 2 * 864e5, now)).toBe(2);
  });

  it('ne descend jamais sous 0', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    expect(daysUntil(now.getTime() - 5 * 864e5, now)).toBe(0);
  });
});

describe('renewalWhatsAppMessage / renewalWhatsAppUrl', () => {
  const expiresAt = new Date('2026-02-01T00:00:00Z').getTime();

  it('mentionne l’e-mail et la date, distingue expire/expiré', () => {
    const soon = renewalWhatsAppMessage({ email: 'a@b.com', expiresAt, expired: false });
    expect(soon).toContain('a@b.com');
    expect(soon).toContain('expire le');
    const expired = renewalWhatsAppMessage({ email: 'a@b.com', expiresAt, expired: true });
    expect(expired).toContain('expiré le');
  });

  it('construit une URL /api/wa avec le message encodé', () => {
    const url = renewalWhatsAppUrl({ email: 'a@b.com', expiresAt, expired: false });
    expect(url.startsWith('/api/wa?text=')).toBe(true);
    expect(decodeURIComponent(url.slice('/api/wa?text='.length))).toContain('a@b.com');
  });
});
