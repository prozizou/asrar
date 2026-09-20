import { describe, it, expect } from 'vitest';
import {
  shouldSendSessionReminder, SESSION_LEAD_MS, SESSION_GRACE_MS,
  shouldSendRenewalReminder, shouldSendExpiredNotice, RENEWAL_REMINDER_DAYS, RENEWAL_GRACE_DAYS,
  daysUntil, renewalWhatsAppMessage, renewalWhatsAppUrl,
} from './reminders';

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
