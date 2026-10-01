import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TEXT_SPEEDS, normalizeSpeedKey } from '../js/battle/text-speed.js';
import {
  rowShowsTimingBar, timingBarColor, initialTicsFor, timingFillRatio, timingFillPercent,
} from '../js/battle/timing-bar.js';
import {
  assignArenaLetters, letterForMonster, targetCardLabel, arenaLetterFromLabel,
} from '../js/battle/arena-letters.js';
import { nextTypingStateAfterClick } from '../js/battle/feed-skip.js';
import { potionCommitPayload } from '../js/battle/potion-target.js';
import { shouldPlayIntroCountdown, INTRO_COUNTDOWN_STEPS } from '../js/battle/intro-countdown.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('PC-102 timing-bar fill', () => {
  it('fills as 1 - remaining/initial, blue while charging and cyan at reduction', () => {
    const winding = { event: 'winding', tics: 2, initialTics: 8 };
    assert.equal(rowShowsTimingBar(winding), true);
    assert.equal(timingBarColor(winding), 'blue');
    assert.equal(timingFillRatio(winding), 0.75);
    assert.equal(timingFillPercent(winding), 75);

    const cd = { event: 'cooldown', tics: 1, initialTics: 4 };
    assert.equal(timingBarColor(cd), 'cyan');
    assert.equal(timingFillRatio(cd), 0.75);

    const monsterWind = { label: 'A', event: 'winding', tics: 5, initialTics: 5 };
    assert.equal(rowShowsTimingBar(monsterWind), true);
    assert.equal(timingBarColor(monsterWind), 'blue');
    assert.equal(timingFillRatio(monsterWind), 0);
  });

  it('derives initial tics from action data when the row does not carry them', () => {
    assert.equal(initialTicsFor({ event: 'winding', tics: 3, castTicks: 9 }), 9);
    assert.equal(initialTicsFor({ event: 'cooldown', tics: 2, cooldownTicks: 6 }), 6);
    assert.equal(initialTicsFor({ event: 'drinking', tics: 1, postTicks: 4 }), 4);
    assert.equal(initialTicsFor({ event: 'winding', tics: 3 }, 8), 8);
  });

  it('does not bar ready, approach, impact, or legacy monster attack rows', () => {
    assert.equal(rowShowsTimingBar({ event: 'ready', tics: 0 }), false);
    assert.equal(rowShowsTimingBar({ event: 'approach', tics: 4 }), false);
    assert.equal(rowShowsTimingBar({ event: 'impact', tics: 0 }), false);
    assert.equal(rowShowsTimingBar({ event: 'attack', label: 'A', tics: 3 }), false);
    assert.equal(rowShowsTimingBar({ event: 'cooldown', label: 'A', tics: 3 }), true);
  });
});

describe('PC-102 stable target letters', () => {
  it('keeps B as B after A dies — letters are not living-array indexes', () => {
    const start = [
      { id: 1, name: 'Wolf', label: 'A' },
      { id: 2, name: 'Rat', label: 'B' },
      { id: 3, name: 'Slime', label: 'C' },
    ];
    const assigned = assignArenaLetters(start);
    assert.equal(letterForMonster(start[0], assigned), 'A');
    assert.equal(letterForMonster(start[1], assigned), 'B');
    const afterDeath = assignArenaLetters([
      { id: 1, name: 'Wolf', label: 'A', dead: true },
      { id: 2, name: 'Rat', label: 'B' },
      { id: 3, name: 'Slime', label: 'C' },
    ], assigned);
    const living = [{ id: 2, name: 'Rat', label: 'B' }, { id: 3, name: 'Slime', label: 'C' }];
    assert.equal(letterForMonster(living[0], afterDeath), 'B');
    assert.equal(letterForMonster(living[1], afterDeath), 'C');
    assert.equal(targetCardLabel(living[0], afterDeath), 'B: Rat');
    assert.notEqual(letterForMonster(living[0], afterDeath), 'A');
  });

  it('assigns A, B, C at first sight when labels are not letters, and a new roster restarts', () => {
    const first = assignArenaLetters([{ id: 10, name: 'Imp' }, { id: 11, name: 'Bat' }]);
    assert.equal(letterForMonster({ id: 10 }, first), 'A');
    assert.equal(letterForMonster({ id: 11 }, first), 'B');
    const nextBattle = assignArenaLetters([{ id: 90, name: 'Ogre' }], first);
    assert.equal(letterForMonster({ id: 90 }, nextBattle), 'A');
    assert.equal(arenaLetterFromLabel('Wolf A'), 'A');
  });
});

describe('PC-102 click-to-complete', () => {
  it('finishes only the current line and leaves queued lines unshown', () => {
    const mid = nextTypingStateAfterClick({
      lines: ['alpha', 'bravo', 'charlie'],
      lineIndex: 0,
      phase: 'chars',
    });
    assert.equal(mid.finishCurrent, true);
    assert.equal(mid.finishedText, 'alpha');
    assert.equal(mid.skipRemaining, false);
    assert.equal(mid.shownCount, 1);
    assert.notEqual(mid.shownCount, 3);
    assert.equal(mid.done, false);

    const between = nextTypingStateAfterClick({
      lines: ['alpha', 'bravo', 'charlie'],
      lineIndex: 1,
      phase: 'delay',
    });
    assert.equal(between.finishCurrent, false);
    assert.equal(between.lineIndex, 1);
    assert.equal(between.skipRemaining, false);
    assert.equal(between.shownCount, 1);
  });
});

describe('PC-102 potion hand target', () => {
  it('queues the drink for the open menu hand, not a stale other hand', () => {
    assert.deepEqual(potionCommitPayload('RH', 'a', 'LH'), { slot: 'A', hand: 'RH' });
    assert.deepEqual(potionCommitPayload('LH', 'B'), { slot: 'B', hand: 'LH' });
    assert.throws(() => potionCommitPayload('', 'A', 'LH'), /open menu hand/);
  });
});

describe('PC-102 intro countdown and text speed', () => {
  it('never plays the 3-2-1 countdown (battles open to the first decision)', () => {
    assert.deepEqual(INTRO_COUNTDOWN_STEPS, ['3', '2', '1']);
    assert.equal(shouldPlayIntroCountdown(0, false), false);
    assert.equal(shouldPlayIntroCountdown(0, true), false);
    assert.equal(shouldPlayIntroCountdown(4, false), false);
  });

  it('presets are Standard 15/s, Slow 10/s, Instant — no fast/Normal', () => {
    assert.equal(TEXT_SPEEDS.normal.label, 'Standard');
    assert.equal(TEXT_SPEEDS.normal.charsPerSec, 15);
    assert.equal(TEXT_SPEEDS.normal.charMs, Math.round(1000 / 15));
    assert.equal(TEXT_SPEEDS.slow.label, 'Slow');
    assert.equal(TEXT_SPEEDS.slow.charsPerSec, 10);
    assert.equal(TEXT_SPEEDS.slow.charMs, 100);
    assert.equal(TEXT_SPEEDS.instant.charMs, 0);
    assert.equal(TEXT_SPEEDS.instant.label, 'Instant');
    assert.equal(TEXT_SPEEDS.fast, undefined);
    assert.equal(normalizeSpeedKey('fast'), 'normal');
    assert.equal(normalizeSpeedKey('SLOW'), 'slow');
  });
});

describe('PC-102 wiring (source contract)', () => {
  const app = read('js/battle-app.js');
  const html = read('run.html');

  it('playIntroCountdown is called from the battle-start path', () => {
    assert.match(app, /function playIntroCountdown/);
    assert.match(app, /playIntroCountdown\(lastBs/);
    assert.match(app, /beginAfterIntro/);
  });

  it('click-to-complete does not clearTyping the rest of the batch', () => {
    const at = app.indexOf('msgBox.onclick');
    assert.ok(at >= 0);
    const slice = app.slice(at, at + 280);
    assert.match(slice, /completeCurrentTypingLine/);
    assert.equal(slice.includes('clearTyping'), false);
  });

  it('battle screen exposes Standard/Slow/Instant', () => {
    assert.match(html, /data-speed="normal">Standard/);
    assert.match(html, /data-speed="slow">Slow/);
    assert.match(html, /data-speed="instant">Instant/);
    assert.match(html, /timing-fill-blue/);
    assert.match(html, /timing-fill-cyan/);
  });
});
