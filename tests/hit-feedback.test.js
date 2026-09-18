import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHitLine } from '../js/combat/hit-feedback.js';

describe('parseHitLine — PC-70 hit feedback', () => {
  it('monster hit with attack name', () => {
    assert.deepEqual(parseHitLine('tic 4 — A Glow Moth Bite hits player for 7'), { type: 'monster', letter: 'A', damage: 7 });
  });
  it('monster hit without attack name', () => {
    assert.deepEqual(parseHitLine('tic 4 — B hits player for 12'), { type: 'monster', letter: 'B', damage: 12 });
  });
  it('monster hit with multi-digit damage', () => {
    assert.deepEqual(parseHitLine('tic 9 — C Venom Strike hits player for 104'), { type: 'monster', letter: 'C', damage: 104 });
  });
  it('player hit on a monster', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH Heavy Chop hits A for 25'), { type: 'player', letter: 'A', damage: 25 });
  });
  it('player hit with engine fallback attack name', () => {
    assert.deepEqual(parseHitLine('tic 7 — RH attack hits C for 3'), { type: 'player', letter: 'C', damage: 3 });
  });
  it('attack name containing "hits" resolves the right target', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH hits twice hits A for 25'), { type: 'player', letter: 'A', damage: 25 });
  });
  it('miss lines get no feedback', () => {
    assert.equal(parseHitLine('tic 4 — A Glow Moth Bite misses'), null);
    assert.equal(parseHitLine('tic 4 — A misses'), null);
    assert.equal(parseHitLine('tic 5 — LH Heavy Chop misses'), null);
  });
  it('non-hit lines get no feedback', () => {
    assert.equal(parseHitLine('tic 3 — LH Ready'), null);
    assert.equal(parseHitLine('tic 4 — A is defeated'), null);
    assert.equal(parseHitLine('tic 5 — LH attack cancelled — target already defeated'), null);
    assert.equal(parseHitLine('tic 2 — LH drinks Heal (3 tics)'), null);
    assert.equal(parseHitLine('tic 6 — LH healed 24'), null);
    assert.equal(parseHitLine('Battle begins...'), null);
    assert.equal(parseHitLine(''), null);
    assert.equal(parseHitLine(null), null);
    assert.equal(parseHitLine(undefined), null);
  });
});
