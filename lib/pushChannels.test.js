import { describe, it, expect } from 'vitest';
import { PUSH_CHANNELS, channelIdForNotifType, channelById } from './pushChannels';

describe('PUSH_CHANNELS', () => {
  it('sept canaux, chacun avec un id unique', () => {
    expect(PUSH_CHANNELS).toHaveLength(7);
    const ids = PUSH_CHANNELS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque canal a un nom, une description et une importance valide', () => {
    for (const c of PUSH_CHANNELS) {
      expect(typeof c.name).toBe('string');
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.description).toBe('string');
      expect([3, 4]).toContain(c.importance);
    }
  });
});

describe('channelIdForNotifType', () => {
  it('mappe les types connus vers un canal qui existe dans PUSH_CHANNELS', () => {
    const knownIds = new Set(PUSH_CHANNELS.map((c) => c.id));
    expect(knownIds.has(channelIdForNotifType('secret'))).toBe(true);
    expect(knownIds.has(channelIdForNotifType('document'))).toBe(true);
    expect(knownIds.has(channelIdForNotifType('zikr_message'))).toBe(true);
  });

  it('secret et document partagent le même canal (« Secrets & Documents »)', () => {
    expect(channelIdForNotifType('secret')).toBe(channelIdForNotifType('document'));
  });

  it('retombe sur un canal valide pour un type inconnu ou absent', () => {
    const knownIds = new Set(PUSH_CHANNELS.map((c) => c.id));
    expect(knownIds.has(channelIdForNotifType('type_qui_nexiste_pas'))).toBe(true);
    expect(knownIds.has(channelIdForNotifType(undefined))).toBe(true);
  });
});

describe('channelById', () => {
  it('retrouve un canal existant par id', () => {
    expect(channelById('zikr_message').id).toBe('zikr_message');
    expect(channelById('zikr_message').importance).toBe(4);
  });

  it('retombe sur une importance « Normale » pour un id inconnu', () => {
    const fallback = channelById('canal_inexistant');
    expect(fallback.importance).toBe(3);
  });
});
