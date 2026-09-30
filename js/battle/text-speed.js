/**
 * PC-DEC-044 text-speed presets, as read by PC-102.
 * Standard = 15 characters/second, Slow = 10 characters/second, Instant = no
 * typewriter. charMs is the per-character delay the typewriter actually waits.
 * There is no 'fast' / 'Normal' preset — those values drifted from the ruling.
 */
export const TEXT_SPEEDS = {
  normal: {
    charsPerSec: 15,
    charMs: Math.round(1000 / 15),
    lineDelayMs: 1000,
    label: 'Standard',
    windupEnabled: true,
  },
  slow: {
    charsPerSec: 10,
    charMs: Math.round(1000 / 10),
    lineDelayMs: 1600,
    label: 'Slow',
    windupEnabled: true,
  },
  instant: {
    charsPerSec: 0,
    charMs: 0,
    lineDelayMs: 0,
    label: 'Instant',
    windupEnabled: false,
  },
};

export const TEXT_SPEED_KEYS = ['normal', 'slow', 'instant'];

/** Map stored / button keys onto a preset key. Legacy 'fast' collapses to Standard. */
export function normalizeSpeedKey(key) {
  const map = {
    STANDARD: 'normal',
    SLOW: 'slow',
    INSTANT: 'instant',
    standard: 'normal',
    slow: 'slow',
    instant: 'instant',
    normal: 'normal',
    fast: 'normal',
  };
  return map[key] || null;
}
