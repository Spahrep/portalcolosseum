import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// settings-controller reads localStorage at import. Install a memory
// store before the dynamic import (static imports are hoisted).
const mem = new Map();
globalThis.localStorage = {
  getItem(k) { return mem.has(k) ? mem.get(k) : null; },
  setItem(k, v) { mem.set(k, String(v)); },
  removeItem(k) { mem.delete(k); },
};

const settings = await import('../js/settings-controller.js');
const ux = await import('../js/battle/ux-controller.js');

const BASES = {
  hitPause: 320,
  queueExit: 280,
  queueRemoveGap: 100,
  queueGap: 300,
  queueWipe: 250,
  queueFlash: 150,
  queueEnter: 250,
  queueFill: 700,
  queueFillStagger: 600,
  monsterFade: 1400,
  monsterFadeStagger: 1000,
  monsterDeath: 1200,
  shake: 280,
  critShake: 420,
  cardShake: 220,
  flash: 180,
  critCardShake: 280,
  critFlash: 280,
};

function hitSplit() {
  return {
    kind: 'monster',
    tell: 'Imp A attacks…',
    payload: 'You take 5 damage.',
    letter: 'A',
    isCrit: false,
  };
}

describe('ux-controller dur()', { concurrency: false }, () => {
  beforeEach(() => {
    settings.setUxSpeed(1);
    settings.setScreenshakeOn(true);
    settings.setSpeed('normal');
    ux.bindUxController({ handleDeferredHit: () => Promise.resolve() });
  });

  it('returns every authored base at ux_speed 1', () => {
    for (const [name, base] of Object.entries(BASES)) {
      assert.equal(ux.TIMING[name], base, name);
      assert.equal(ux.dur(name), base, name);
    }
  });

  it('divides by the live ux_speed and does not cache the first read', () => {
    assert.equal(ux.dur('hitPause'), 320);
    settings.setUxSpeed(0.5);
    assert.equal(ux.dur('hitPause'), 640);
    assert.equal(ux.dur('monsterDeath'), 2400);
    settings.setUxSpeed(1.5);
    assert.equal(ux.dur('shake'), 280 / 1.5);
    assert.equal(ux.dur('critShake'), 420 / 1.5);
    settings.setUxSpeed(1.25);
    assert.equal(ux.dur('hitPause'), 256);
    settings.setUxSpeed(0.75);
    assert.equal(ux.dur('queueGap'), 400);
  });

  it('unknown names are 0 and off-step speeds are rejected', () => {
    assert.equal(ux.dur('notABeat'), 0);
    settings.setUxSpeed(1.25);
    settings.setUxSpeed(2);
    settings.setUxSpeed('fast');
    assert.equal(settings.getUxSpeed(), 1.25);
    assert.equal(localStorage.getItem('pc_ux_speed'), '1.25');
  });

  it('screenshake_on is live and persisted', () => {
    assert.equal(ux.screenshakeEnabled(), true);
    settings.setScreenshakeOn(false);
    assert.equal(ux.screenshakeEnabled(), false);
    assert.equal(settings.getScreenshakeOn(), false);
    assert.equal(localStorage.getItem('pc_screenshake_on'), 'false');
    settings.setScreenshakeOn(true);
    assert.equal(ux.screenshakeEnabled(), true);
    assert.equal(localStorage.getItem('pc_screenshake_on'), 'true');
  });

  it('does not scale the typewriter preset (instant stays instant)', () => {
    const charMs = settings.getSpeedPreset().charMs;
    assert.ok(charMs > 0);
    settings.setUxSpeed(0.5);
    assert.equal(settings.getSpeedPreset().charMs, charMs);
    settings.setSpeed('instant');
    assert.equal(settings.getSpeedPreset().charMs, 0);
    settings.setUxSpeed(1.5);
    assert.equal(settings.getSpeedPreset().charMs, 0);
  });

  it('plays tell → pause → impact → payload, and holds until the shake settles', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const seen = [];
    ux.bindUxController({
      handleDeferredHit: (split) => {
        seen.push(split.tell);
        return pending;
      },
    });
    const events = [];
    ux.playLandedHit(hitSplit(), {
      isInstant: () => false,
      openLine: () => ({ textContent: '' }),
      display: (s) => s,
      typeText: (_el, text, done) => { events.push(text); done(); },
      schedule: (fn, ms) => { events.push(ms); fn(); },
      finish: () => events.push('finish'),
    });
    assert.deepEqual(events, [
      'Imp A attacks…',
      320,
      'You take 5 damage.',
      'finish',
    ]);
    assert.deepEqual(seen, ['Imp A attacks…']);
    let settled = false;
    const wait = ux.whenHitsSettled().then(() => { settled = true; });
    try {
      await Promise.resolve();
      assert.equal(settled, false);
      release();
      await wait;
      assert.equal(settled, true);
    } finally {
      release();
    }
  });

  it('instant preset dumps tell and payload with no pause and still fires the hit', () => {
    let impacts = 0;
    ux.bindUxController({
      handleDeferredHit: () => { impacts++; return Promise.resolve(); },
    });
    const lines = [];
    ux.playLandedHit(hitSplit(), {
      isInstant: () => true,
      openLine: () => {
        const el = { textContent: '' };
        lines.push(el);
        return el;
      },
      display: (s) => s,
      typeText: () => { throw new Error('instant must not type char-by-char'); },
      schedule: () => { throw new Error('instant must not pause'); },
      finish: () => lines.push('finish'),
    });
    assert.equal(lines[0].textContent, 'Imp A attacks…');
    assert.equal(lines[1].textContent, 'You take 5 damage.');
    assert.equal(lines[2], 'finish');
    assert.equal(impacts, 1);
  });

  it('uses the live pause after a mid-battle speed change', () => {
    settings.setUxSpeed(2); // rejected — stays 1 from beforeEach
    settings.setUxSpeed(0.5);
    const pauses = [];
    ux.playLandedHit(hitSplit(), {
      isInstant: () => false,
      openLine: () => ({ textContent: '' }),
      display: (s) => s,
      typeText: (_el, _text, done) => done(),
      schedule: (fn, ms) => { pauses.push(ms); fn(); },
      finish: () => {},
    });
    assert.deepEqual(pauses, [640]);
  });
});
