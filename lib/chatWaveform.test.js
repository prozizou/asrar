import { expect, it } from 'vitest';
import { normalizeChatWaveform, waveformLevels } from './chatWaveform';
it('borne la taille des formes d’onde envoyées et rejette les données non numériques', () => {
  expect(normalizeChatWaveform(Array(40).fill(50))).toHaveLength(40);
  for (const input of [[], Array(1000).fill(1), Array(40).fill(NaN), Array(40).fill(-1), Array(40).fill(101), Array(40).fill('4')]) expect(normalizeChatWaveform(input)).toBeNull();
});
it('représente le silence et normalise les pics du signal audio', () => {
  expect(waveformLevels(new Float32Array(400))).toEqual(Array(40).fill(0));
  const samples = new Float32Array(400); samples[0] = .5; samples[390] = 1;
  const levels = waveformLevels(samples);
  expect(levels[0]).toBe(50); expect(levels.at(-1)).toBe(100); expect(levels.slice(1, -1)).toEqual(Array(38).fill(0));
});
