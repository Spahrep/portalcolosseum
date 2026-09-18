import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHitLine, arenaKey } from '../js/combat/hit-feedback.js';

describe('parseHitLine — PC-70 hit feedback', () => {
  it('monster hit with attack name (bare letter label)', () => {
    assert.deepEqual(parseHitLine('tic 4 — A Glow Moth Bite hits player for 7'), { type: 'monster', letter: 'A', damage: 7 });
  });
  it('monster hit with API "Monster A" label', () => {
    assert.deepEqual(parseHitLine('tic 4 — Monster A Glow Moth Bite hits player for 7'), { type: 'monster', letter: 'A', damage: 7 });
  });
  it('monster hit without attack name', () => {
    assert.deepEqual(parseHitLine('tic 4 — B hits player for 12'), { type: 'monster', letter: 'B', damage: 12 });
  });
  it('monster hit with fallback "Monster #id" label', () => {
    assert.deepEqual(parseHitLine('tic 4 — Monster #12 Venom Strike hits player for 9'), { type: 'monster', letter: '#12', damage: 9 });
  });
  it('multi-digit damage', () => {
    assert.deepEqual(parseHitLine('tic 9 — C Venom Strike hits player for 104'), { type: 'monster', letter: 'C', damage: 104 });
  });
  it('player hit on a monster (bare letter label)', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH Heavy Chop hits A for 25'), { type: 'player', letter: 'A', damage: 25 });
  });
  it('player hit with API "Monster A" label — the label-prefix bug', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH Heavy Chop hits Monster A for 25'), { type: 'player', letter: 'A', damage: 25 });
  });
  it('player hit with fallback "Monster #id" label', () => {
    assert.deepEqual(parseHitLine('tic 7 — RH Fist hits Monster #3 for 4'), { type: 'player', letter: '#3', damage: 4 });
  });
  it('player hit with fallback attack name', () => {
    assert.deepEqual(parseHitLine('tic 7 — RH attack hits C for 3'), { type: 'player', letter: 'C', damage: 3 });
  });
  it('attack name containing "hits" resolves the right target', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH hits twice hits A for 25'), { type: 'player', letter: 'A', damage: 25 });
  });
  it('attack name containing "Monster" does not confuse the label', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH Monster Slayer hits Monster B for 25'), { type: 'player', letter: 'B', damage: 25 });
  });
  it('miss lines get no feedback', () => {
    assert.equal(parseHitLine('tic 4 — A Glow Moth Bite misses'), null);
    assert.equal(parseHitLine('tic 4 — Monster A Glow Moth Bite misses'), null);
    assert.equal(parseHitLine('tic 4 — A misses'), null);
    assert.equal(parseHitLine('tic 5 — LH Heavy Chop misses'), null);
  });
  it('non-hit lines get no feedback', () => {
    assert.equal(parseHitLine('tic 3 — LH Ready'), null);
    assert.equal(parseHitLine('tic 4 — A is defeated'), null);
    assert.equal(parseHitLine('tic 4 — Monster A is defeated'), null);
    assert.equal(parseHitLine('tic 2 — LH drinks Heal (3 tics)'), null);
    assert.equal(parseHitLine('tic 6 — LH healed 24'), null);
    assert.equal(parseHitLine('Battle begins...'), null);
    assert.equal(parseHitLine(null), null);
  });
});

describe('arenaKey — PC-70 label normalization', () => {
  it('strips the Monster prefix, mirrors queueLabel', () => {
    assert.equal(arenaKey('Monster A'), 'A');
    assert.equal(arenaKey('A'), 'A');
    assert.equal(arenaKey('Monster #12'), '#12');
    assert.equal(arenaKey(undefined), '');
  });
});
