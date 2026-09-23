// === Canonical enums ===
const SPEEDS = {
  slow:   { charMs: 45, lineDelayMs: 1800, label: 'Slow', windupEnabled: true },
  normal: { charMs: 25, lineDelayMs: 1500, label: 'Normal', windupEnabled: true },
  fast:   { charMs: 5,  lineDelayMs: 300,  label: 'Fast', windupEnabled: true },
  instant: { charMs: 0, lineDelayMs: 0,    label: 'Instant', windupEnabled: false },
};
const FONT_SIZES = {
  S: { scale: '0.85', label: 'Small' },
  M: { scale: '1.0',  label: 'Medium' },
  L: { scale: '1.3',  label: 'Large' },
};

const SPEED_KEYS = ['slow', 'normal', 'fast', 'instant'];
const FONT_KEYS = ['S', 'M', 'L'];

// === Module state (single source of truth) ===
let speedKey = 'normal';
let fontSizeKey = 'M';

// === Subscribers ===
let speedSubs = [];
let fontSizeSubs = [];

// === Init (runs on first import) ===
function init() {
  const savedSpeed = localStorage.getItem('pc_battle_text_speed');
  const savedFont = localStorage.getItem('pc_queue_font_size');

  // Speed: accept lowercase or legacy uppercase
  const speedMap = { STANDARD: 'normal', SLOW: 'slow', INSTANT: 'instant', standard: 'normal', slow: 'slow', instant: 'instant', normal: 'normal', fast: 'fast' };
  speedKey = speedMap[savedSpeed] || 'normal';

  fontSizeKey = FONT_KEYS.includes(savedFont) ? savedFont : 'M';
}

// === Public API ===
export function getSpeedPreset() { return SPEEDS[speedKey] || SPEEDS.normal; }
export function getSpeedKey() { return speedKey; }
export function getFontSizePreset() { return FONT_SIZES[fontSizeKey] || FONT_SIZES.M; }
export function getFontSizeKey() { return fontSizeKey; }

export function setSpeed(key) {
  const mapped = { STANDARD: 'normal', SLOW: 'slow', INSTANT: 'instant' }[key] || key;
  if (!SPEEDS[mapped]) return;
  if (mapped === speedKey) return;
  speedKey = mapped;
  localStorage.setItem('pc_battle_text_speed', speedKey);
  speedSubs.forEach(fn => fn(speedKey));
}

export function setFontSize(key) {
  if (!FONT_KEYS.includes(key)) return;
  if (key === fontSizeKey) return;
  fontSizeKey = key;
  localStorage.setItem('pc_queue_font_size', fontSizeKey);
  fontSizeSubs.forEach(fn => fn(fontSizeKey));
}

// Subscriptions return an unsubscribe function
export function onSpeedChange(fn) {
  speedSubs.push(fn);
  return () => { speedSubs = speedSubs.filter(f => f !== fn); };
}
export function onFontSizeChange(fn) {
  fontSizeSubs.push(fn);
  return () => { fontSizeSubs = fontSizeSubs.filter(f => f !== fn); };
}

// Run init
init();
