import { describe, it, expect } from 'vitest';
import {
  OFFSET_CHOICES,
  SOUND_CHOICES,
  DEFAULT_ALARM_PREFS,
  validateAlarmPrefs,
  alarmChannelId,
  planetAlarmChannels,
  alarmIdFor,
  alarmTimeFor,
  isSchedulable,
  buildAlarmContent,
} from './planetAlarms';

describe('validateAlarmPrefs', () => {
  it('accepte des préférences valides telles quelles', () => {
    const prefs = { offsetMin: 10, soundId: 'douce', vibration: false, repeat: true };
    expect(validateAlarmPrefs(prefs)).toEqual(prefs);
  });

  it('retombe sur les valeurs par défaut pour une entrée absente ou vide', () => {
    expect(validateAlarmPrefs(undefined)).toEqual(DEFAULT_ALARM_PREFS);
    expect(validateAlarmPrefs(null)).toEqual(DEFAULT_ALARM_PREFS);
    expect(validateAlarmPrefs({})).toEqual(DEFAULT_ALARM_PREFS);
  });

  it('rejette un offset hors des choix connus (ex. localStorage corrompu)', () => {
    expect(validateAlarmPrefs({ offsetMin: 7 }).offsetMin).toBe(DEFAULT_ALARM_PREFS.offsetMin);
    expect(validateAlarmPrefs({ offsetMin: '10' }).offsetMin).toBe(DEFAULT_ALARM_PREFS.offsetMin);
  });

  it('rejette un id de sonnerie inconnu', () => {
    expect(validateAlarmPrefs({ soundId: 'inexistant' }).soundId).toBe(DEFAULT_ALARM_PREFS.soundId);
  });

  it('rejette des booléens non-booléens', () => {
    expect(validateAlarmPrefs({ vibration: 'oui' }).vibration).toBe(DEFAULT_ALARM_PREFS.vibration);
    expect(validateAlarmPrefs({ repeat: 1 }).repeat).toBe(DEFAULT_ALARM_PREFS.repeat);
  });
});

describe('alarmChannelId / planetAlarmChannels', () => {
  it('un id déterministe par combinaison (son, vibration)', () => {
    expect(alarmChannelId('asrar', true)).toBe(alarmChannelId('asrar', true));
    expect(alarmChannelId('asrar', true)).not.toBe(alarmChannelId('asrar', false));
    expect(alarmChannelId('asrar', true)).not.toBe(alarmChannelId('douce', true));
  });

  it('génère exactement un canal par combinaison (3 sons × 2 vibration)', () => {
    const channels = planetAlarmChannels();
    expect(channels).toHaveLength(SOUND_CHOICES.length * 2);
    const ids = channels.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // tous uniques
  });

  it('chaque canal reprend le fichier son (ou son absence) du choix correspondant', () => {
    const channels = planetAlarmChannels();
    const asrarVib = channels.find((c) => c.id === alarmChannelId('asrar', true));
    expect(asrarVib.sound).toBe('asrar_notification.mp3');
    expect(asrarVib.vibration).toBe(true);
    const systemeSil = channels.find((c) => c.id === alarmChannelId('systeme', false));
    expect(systemeSil.sound).toBeUndefined();
    expect(systemeSil.vibration).toBe(false);
  });
});

describe('alarmIdFor', () => {
  it('déterministe : même planète + même instant → même id', () => {
    expect(alarmIdFor('Jupiter', 1758000000000)).toBe(alarmIdFor('Jupiter', 1758000000000));
  });

  it('des instants différents pour une même planète donnent des ids différents', () => {
    expect(alarmIdFor('Jupiter', 1758000000000)).not.toBe(alarmIdFor('Jupiter', 1758003600000));
  });

  it('des planètes différentes au même instant donnent des ids différents', () => {
    expect(alarmIdFor('Jupiter', 1758000000000)).not.toBe(alarmIdFor('Saturne', 1758000000000));
  });

  it('toujours un entier 32 bits positif (contrainte Android)', () => {
    for (const [planet, ms] of [
      ['Lune', 0],
      ['Saturne', 1758000000000],
      ['Mars', Date.now()],
      ['Mercure', -1758000000000],
    ]) {
      const id = alarmIdFor(planet, ms);
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThanOrEqual(2147483647);
    }
  });
});

describe('alarmTimeFor', () => {
  it('sans délai, déclenche à l’heure de début exacte', () => {
    expect(alarmTimeFor(1000000, 0)).toBe(1000000);
  });

  it('avec un délai, déclenche N minutes avant', () => {
    expect(alarmTimeFor(1000000, 5)).toBe(1000000 - 5 * 60000);
    for (const min of OFFSET_CHOICES) {
      expect(alarmTimeFor(1000000, min)).toBe(1000000 - min * 60000);
    }
  });
});

describe('isSchedulable', () => {
  it('vrai si le déclenchement est dans le futur', () => {
    expect(isSchedulable(2000, 1000)).toBe(true);
  });

  it('faux si le déclenchement est passé ou simultané', () => {
    expect(isSchedulable(1000, 2000)).toBe(false);
    expect(isSchedulable(1000, 1000)).toBe(false);
  });
});

describe('buildAlarmContent', () => {
  it('« commence maintenant » sans délai (offsetMin par défaut = 0)', () => {
    const content = buildAlarmContent({ planet: 'Jupiter', emoji: '♃', natTxt: 'Très favorable', interval: '22:47 – 23:46' });
    expect(content).toEqual({
      title: '♃ Jupiter commence maintenant',
      body: 'Très favorable · 22:47 – 23:46',
    });
  });

  it('annonce le délai restant quand offsetMin > 0 — jamais « commence maintenant » en avance', () => {
    const content = buildAlarmContent({ planet: 'Jupiter', emoji: '♃', natTxt: 'Très favorable', interval: '22:47 – 23:46', offsetMin: 10 });
    expect(content.title).toBe('♃ Jupiter commence dans 10 min');
  });
});
