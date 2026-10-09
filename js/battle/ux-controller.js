/**
 * Central UX controller.
 *
 * One TIMING map holds every authored effect duration (the length that plays
 * at ux_speed === 1). dur(name) is the only place the per-user multiplier is
 * applied: base / ux_speed, read live so a mid-battle change hits the next beat.
 *
 * The landed-hit beat (tell → pause → shake/flash → payload) lives here.
 * The typewriter stays in feed-render.js and calls playLandedHit. The impact
 * shake is bound in from battle-app (handleDeferredHit) so this module does
 * not import monster-render.js. The shake's animationend resolves before the
 * narration promise does — awaitTickVisuals snapshots hit DOM at kickoff and
 * would miss a shake that starts mid-typing.
 *
 * Typewriter char speed is NOT in this map. It stays on the text-speed preset.
 * Instant stays instant at every ux_speed.
 */
import { getScreenshakeOn, getUxSpeed, onUxSpeedChange } from '../settings-controller.js';

/** Base milliseconds at ux_speed === 1. */
export const TIMING = Object.freeze({
  hitPause: 320,
  queueExit: 280,
  queueRemoveGap: 100,
  queueGap: 300,
  queueWipe: 250,
  queueFlash: 150,
  queueEnter: 250,
  queueFill: 700,
  // Paired with queueFill / monsterFade so battle initialization's total wait scales
  // with the fade it is waiting on.
  queueFillStagger: 600,
  monsterFade: 1400,
  monsterFadeStagger: 1000,
  monsterDeath: 1200,
  // Window shake and crit window shake (run.html keyframe lengths).
  shake: 280,
  critShake: 420,
  // Card recoil + sprite flash. Same multiplier, so they stay in proportion.
  cardShake: 220,
  flash: 180,
  critCardShake: 280,
  critFlash: 280,
});

/** CSS custom properties applyTimingScale writes. Fallback in run.html is the base. */
const CSS_VARS = Object.freeze({
  '--ux-shake': 'shake',
  '--ux-card-shake': 'cardShake',
  '--ux-flash': 'flash',
  '--ux-crit-shake': 'critShake',
  '--ux-crit-card': 'critCardShake',
  '--ux-crit-flash': 'critFlash',
  '--ux-death': 'monsterDeath',
  '--ux-queue-exit': 'queueExit',
  '--ux-queue-enter': 'queueEnter',
  '--ux-queue-gap': 'queueGap',
  '--ux-queue-wipe': 'queueWipe',
  '--ux-queue-flash': 'queueFlash',
});

/**
 * Scaled duration in milliseconds. Unknown names return 0.
 * ux_speed is read on every call (not cached).
 * @param {string} name key of TIMING
 * @returns {number}
 */
export function dur(name) {
  const base = TIMING[name];
  if (typeof base !== 'number') return 0;
  const speed = getUxSpeed();
  const scale = typeof speed === 'number' && speed > 0 ? speed : 1;
  return base / scale;
}

/** Live screenshake toggle. false suppresses window shake, card shake, and flash. */
export function screenshakeEnabled() {
  return getScreenshakeOn();
}

/** Push the current multiplier into CSS so keyframe lengths match dur(). */
export function applyTimingScale() {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const root = document.documentElement;
  for (const prop of Object.keys(CSS_VARS)) {
    root.style.setProperty(prop, `${dur(CSS_VARS[prop])}ms`);
  }
}

// --- landed-hit beat -------------------------------------------------------

let deferredHit = () => Promise.resolve();
const pendingShakes = new Set();

/**
 * @param {{ handleDeferredHit?: function }} deps
 */
export function bindUxController(deps) {
  if (deps && typeof deps.handleDeferredHit === 'function') {
    deferredHit = deps.handleDeferredHit;
  }
}

function trackShake(result) {
  const settled = Promise.resolve(result).then(() => {}, () => {});
  pendingShakes.add(settled);
  settled.then(() => pendingShakes.delete(settled));
  return settled;
}

/**
 * Resolves when every in-flight hit shake has reached animationend
 * (or resolved immediately because shake was suppressed). Empty → already done.
 */
export function whenHitsSettled() {
  return Promise.all([...pendingShakes]);
}

function fireImpact(split) {
  let result;
  try {
    result = deferredHit(split);
  } catch {
    result = Promise.resolve();
  }
  return trackShake(result);
}

/**
 * tell → pause dur('hitPause') → shake/flash → payload.
 * Payload typing overlaps the shake (the PC-117 beat). fireImpact tracks the
 * shake promise; feed-render's batch completion awaits whenHitsSettled() so
 * narration does not resolve before animationend. Click-to-skip cancels
 * `schedule` timers and still finishes the on-screen line immediately.
 *
 * @param {object} split splitHitLine result
 * @param {object} io typewriter primitives owned by feed-render
 * @param {() => boolean} io.isInstant
 * @param {() => HTMLElement} io.openLine
 * @param {(s: string) => string} io.display
 * @param {(el: HTMLElement, text: string, done: () => void) => void} io.typeText
 * @param {(fn: () => void, ms: number) => void} io.schedule
 * @param {() => void} io.finish
 */
export function playLandedHit(split, io) {
  const tellEl = io.openLine();
  const tellText = io.display(split.tell);
  const payloadText = io.display(split.payload);

  if (io.isInstant()) {
    tellEl.textContent = tellText;
    const payloadEl = io.openLine();
    payloadEl.textContent = payloadText;
    fireImpact(split);
    io.finish();
    return;
  }

  io.typeText(tellEl, tellText, () => {
    io.schedule(() => {
      fireImpact(split);
      const payloadEl = io.openLine();
      io.typeText(payloadEl, payloadText, () => io.finish());
    }, dur('hitPause'));
  });
}

onUxSpeedChange(() => applyTimingScale());
applyTimingScale();
