// === Canonical enums (PC-DEC-044 / PC-102: Standard 15/s, Slow 10/s, Instant) ===
import { TEXT_SPEEDS, normalizeSpeedKey } from './battle/text-speed.js';

const SPEEDS = TEXT_SPEEDS;
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

  // Speed: accept lowercase, legacy uppercase, and the retired 'fast' key.
  speedKey = normalizeSpeedKey(savedSpeed) || 'normal';

  fontSizeKey = FONT_KEYS.includes(savedFont) ? savedFont : 'M';
}

// === Public API ===
export function getSpeedPreset() { return SPEEDS[speedKey] || SPEEDS.normal; }
export function getSpeedKey() { return speedKey; }
export function getFontSizeKey() { return fontSizeKey; }

export function setSpeed(key) {
  const mapped = normalizeSpeedKey(key) || key;
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
