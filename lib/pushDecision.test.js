import { describe, it, expect } from 'vitest';
import { nextPushAction } from './pushDecision';

describe('nextPushAction', () => {
  it('skip si push non supporté (quelles que soient les autres valeurs)', () => {
    expect(nextPushAction({ supported: false, permission: 'granted', promptedBefore: false })).toBe('skip');
    expect(nextPushAction({ supported: false, permission: 'default', promptedBefore: false })).toBe('skip');
  });

  it('register si autorisation déjà accordée — même invite déjà présentée', () => {
    expect(nextPushAction({ supported: true, permission: 'granted', promptedBefore: false })).toBe('register');
    expect(nextPushAction({ supported: true, permission: 'granted', promptedBefore: true })).toBe('register');
  });

  it('skip si autorisation refusée', () => {
    expect(nextPushAction({ supported: true, permission: 'denied', promptedBefore: false })).toBe('skip');
    expect(nextPushAction({ supported: true, permission: 'denied', promptedBefore: true })).toBe('skip');
  });

  it('prompt la première fois quand jamais demandée', () => {
    expect(nextPushAction({ supported: true, permission: 'default', promptedBefore: false })).toBe('prompt');
  });

  it('skip si déjà invité une fois et toujours en attente de réponse', () => {
    expect(nextPushAction({ supported: true, permission: 'default', promptedBefore: true })).toBe('skip');
  });
});
