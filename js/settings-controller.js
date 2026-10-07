// === Canonical enums (PC-DEC-044 / PC-102: Standard 15/s, Slow 10/s, Instant) ===
import { TEXT_SPEEDS, normalizeSpeedKey } from './battle/text-speed.js';

const SPEEDS = TEXT_SPEEDS;
const FONT_KEYS = ['S', 'M', 'L'];

// One global effect-speed multiplier. 1 = the authored durations.
// Discrete so the menu can stay a button row; dur() is the only consumer.
export const UX_SPEEDS = Object.freeze([0.5, 0.75, 1, 1.25, 1.5]);
const UX_SPEED_DEFAULT = 1;

// === Module state (single source of truth) ===
let speedKey = 'normal';
let fontSizeKey = 'M';
let uxSpeed = UX_SPEED_DEFAULT;
let screenshakeOn = true;

// === Subscribers ===
let speedSubs = [];
let fontSizeSubs = [];
let uxSpeedSubs = [];
let screenshakeSubs = [];

function storageGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: memory still holds the value.
  }
}

function parseUxSpeed(raw) {
  const n = Number(raw);
  return UX_SPEEDS.includes(n) ? n : null;
}

// === Init (runs on first import) ===
function init() {
  const savedSpeed = storageGet('pc_battle_text_speed');
  const savedFont = storageGet('pc_queue_font_size');
  const savedUx = storageGet('pc_ux_speed');
  const savedShake = storageGet('pc_screenshake_on');

  // Speed: accept lowercase, legacy uppercase, and the retired 'fast' key.
  speedKey = normalizeSpeedKey(savedSpeed) || 'normal';

  fontSizeKey = FONT_KEYS.includes(savedFont) ? savedFont : 'M';

  uxSpeed = parseUxSpeed(savedUx) ?? UX_SPEED_DEFAULT;
  if (savedShake === 'false') screenshakeOn = false;
  else if (savedShake === 'true') screenshakeOn = true;
  else screenshakeOn = true;
}

// === Public API ===
export function getSpeedPreset() { return SPEEDS[speedKey] || SPEEDS.normal; }
export function getSpeedKey() { return speedKey; }
export function getFontSizeKey() { return fontSizeKey; }
export function getUxSpeed() { return uxSpeed; }
export function getScreenshakeOn() { return screenshakeOn; }

export function setSpeed(key) {
  const mapped = normalizeSpeedKey(key) || key;
  if (!SPEEDS[mapped]) return;
  if (mapped === speedKey) return;
  speedKey = mapped;
  storageSet('pc_battle_text_speed', speedKey);
  speedSubs.forEach(fn => fn(speedKey));
}

export function setFontSize(key) {
  if (!FONT_KEYS.includes(key)) return;
  if (key === fontSizeKey) return;
  fontSizeKey = key;
  storageSet('pc_queue_font_size', fontSizeKey);
  fontSizeSubs.forEach(fn => fn(fontSizeKey));
}

export function setUxSpeed(value) {
  const n = parseUxSpeed(value);
  if (n == null) return;
  if (n === uxSpeed) return;
  uxSpeed = n;
  storageSet('pc_ux_speed', String(uxSpeed));
  uxSpeedSubs.forEach(fn => fn(uxSpeed));
}

export function setScreenshakeOn(on) {
  const next = !!on;
  if (next === screenshakeOn) return;
  screenshakeOn = next;
  storageSet('pc_screenshake_on', screenshakeOn ? 'true' : 'false');
  screenshakeSubs.forEach(fn => fn(screenshakeOn));
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
export function onUxSpeedChange(fn) {
  uxSpeedSubs.push(fn);
  return () => { uxSpeedSubs = uxSpeedSubs.filter(f => f !== fn); };
}
export function onScreenshakeChange(fn) {
  screenshakeSubs.push(fn);
  return () => { screenshakeSubs = screenshakeSubs.filter(f => f !== fn); };
}

// Run init
init();
