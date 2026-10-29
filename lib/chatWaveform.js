export function normalizeChatWaveform(value) {
  return Array.isArray(value) && value.length >= 16 && value.length <= 64 && value.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)
    ? value.map(Math.round) : null;
}
export function waveformLevels(samples, count = 40) {
  if (!samples?.length) return [];
  const levels = Array.from({ length: count }, (_, index) => {
    const from = Math.floor(index * samples.length / count);
    const to = Math.max(from + 1, Math.floor((index + 1) * samples.length / count));
    let peak = 0;
    for (let i = from; i < to; i += Math.max(1, Math.floor((to - from) / 200))) peak = Math.max(peak, Math.abs(samples[i] || 0));
    return peak;
  });
  const max = Math.max(...levels, .001);
  return levels.map((value) => Math.round(value / max * 100));
}
export async function chatWaveform(blob) {
  let context;
  try {
    const AudioContext = window.AudioContext || window['webkitAudioContext'];
    if (!AudioContext || blob.size > 25 * 1024 * 1024) return null;
    context = new AudioContext();
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    return waveformLevels(audio.getChannelData(0));
  } catch { return null; }
  finally { if (context) await context.close().catch(() => {}); }
}
