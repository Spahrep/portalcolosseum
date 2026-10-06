import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TEXT_SPEEDS, normalizeSpeedKey } from '../js/battle/text-speed.js';
import {
  assignArenaLetters, letterForMonster, targetCardLabel, arenaLetterFromLabel,
} from '../js/battle/arena-letters.js';
import { nextTypingStateAfterClick } from '../js/battle/feed-skip.js';
import { potionCommitPayload } from '../js/battle/potion-target.js';
import { shouldPlayIntroCountdown, INTRO_COUNTDOWN_STEPS } from '../js/battle/intro-countdown.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

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

  it('presets are Standard 22.5/s (50% faster than the original 15/s), Slow 10/s, Instant — no fast/Normal', () => {
    assert.equal(TEXT_SPEEDS.normal.label, 'Standard');
    assert.equal(TEXT_SPEEDS.normal.charsPerSec, 22.5);
    assert.equal(TEXT_SPEEDS.normal.charMs, Math.round(1000 / 22.5));
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

  it('battle screen does not expose text-speed buttons', () => {
    assert.equal(html.includes('text-speed-opt'), false);
    assert.equal(html.includes('id="text-speed"'), false);
  });
});
