import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHitLine, splitHitLine, arenaKey } from '../js/combat/hit-feedback.js';

describe('parseHitLine — PC-70 hit feedback', () => {
  it('monster hit with attack name (bare letter label)', () => {
    assert.deepEqual(parseHitLine('tic 4 — A Glow Moth Bite hits you for 7 damage'), { type: 'monster', letter: 'A', attack: 'Glow Moth Bite', damage: 7 });
  });
  it('monster hit with API "Monster A" label', () => {
    assert.deepEqual(parseHitLine('tic 4 — Monster A Glow Moth Bite hits you for 7 damage'), { type: 'monster', letter: 'A', attack: 'Glow Moth Bite', damage: 7 });
  });
  it('monster hit without attack name', () => {
    assert.deepEqual(parseHitLine('tic 4 — B hits you for 12 damage'), { type: 'monster', letter: 'B', attack: null, damage: 12 });
  });
  it('monster hit with fallback "Monster #id" label', () => {
    assert.deepEqual(parseHitLine('tic 4 — Monster #12 Venom Strike hits you for 9 damage'), { type: 'monster', letter: '#12', attack: 'Venom Strike', damage: 9 });
  });
  it('monster hit with name+letter label (e.g. Wolf A)', () => {
    assert.deepEqual(parseHitLine('tic 4 — Wolf A Glow Moth Bite hits you for 7 damage'), { type: 'monster', letter: 'A', attack: 'Glow Moth Bite', damage: 7 });
  });
  it('monster hit with multi-word name+letter label (e.g. Giant Rat B)', () => {
    assert.deepEqual(parseHitLine('tic 4 — Giant Rat B Bite hits you for 12 damage'), { type: 'monster', letter: 'B', attack: 'Bite', damage: 12 });
  });
  it('monster hit with name+letter and no attack name', () => {
    assert.deepEqual(parseHitLine('tic 4 — Wolf A hits you for 12 damage'), { type: 'monster', letter: 'A', attack: null, damage: 12 });
  });
  it('multi-digit damage', () => {
    assert.deepEqual(parseHitLine('tic 9 — C Venom Strike hits you for 104 damage'), { type: 'monster', letter: 'C', attack: 'Venom Strike', damage: 104 });
  });
  it('crit monster hit reports damage without the marker', () => {
    assert.deepEqual(parseHitLine('tic 4 — A Claw hits you for 15 damage CRITICAL!'), { type: 'monster', letter: 'A', attack: 'Claw', damage: 15 });
  });
  it('player hit on a monster (bare letter label)', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH Heavy Chop hits A for 25'), { type: 'player', letter: 'A', attack: 'Heavy Chop', damage: 25 });
  });
  it('player hit with API "Monster A" label — the label-prefix bug', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH Heavy Chop hits Monster A for 25'), { type: 'player', letter: 'A', attack: 'Heavy Chop', damage: 25 });
  });
  it('player hit with fallback "Monster #id" label', () => {
    assert.deepEqual(parseHitLine('tic 7 — RH Fist hits Monster #3 for 4'), { type: 'player', letter: '#3', attack: 'Fist', damage: 4 });
  });
  it('player hit with fallback attack name', () => {
    assert.deepEqual(parseHitLine('tic 7 — RH attack hits C for 3'), { type: 'player', letter: 'C', attack: 'attack', damage: 3 });
  });
  it('attack name containing "hits" resolves the right target', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH hits twice hits A for 25'), { type: 'player', letter: 'A', attack: 'hits twice', damage: 25 });
  });
  it('attack name containing "Monster" does not confuse the label', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH Monster Slayer hits Monster B for 25'), { type: 'player', letter: 'B', attack: 'Monster Slayer', damage: 25 });
  });
  it('crit player hit reports damage without the marker', () => {
    assert.deepEqual(parseHitLine('tic 5 — LH Heavy Chop hits A for 25 CRITICAL!'), { type: 'player', letter: 'A', attack: 'Heavy Chop', damage: 25 });
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

describe('splitHitLine — PC-117 landed-hit beat split', () => {
  it('monster hit: tell names attacker, payload delivers the number', () => {
    assert.deepEqual(splitHitLine('tic 4 — Imp A Claw hits you for 5 damage'), {
      kind: 'monster', tell: 'Imp A attacks…', payload: 'You take 5 damage.', letter: 'A', isCrit: false,
    });
  });
  it('monster hit with multi-word label', () => {
    assert.deepEqual(splitHitLine('tic 6 — Giant Rat B Bite hits you for 12 damage'), {
      kind: 'monster', tell: 'Giant Rat B attacks…', payload: 'You take 12 damage.', letter: 'B', isCrit: false,
    });
  });
  it('monster hit without attack name', () => {
    assert.deepEqual(splitHitLine('tic 4 — Wolf A hits you for 12 damage'), {
      kind: 'monster', tell: 'Wolf A attacks…', payload: 'You take 12 damage.', letter: 'A', isCrit: false,
    });
  });
  it('monster crit: payload carries no CRITICAL marker (shake carries it)', () => {
    assert.deepEqual(splitHitLine('tic 4 — Imp A Claw hits you for 15 damage CRITICAL!'), {
      kind: 'monster', tell: 'Imp A attacks…', payload: 'You take 15 damage.', letter: 'A', isCrit: true,
    });
  });
  it('player hit: tell keeps hand+attack+target, payload the damage', () => {
    assert.deepEqual(splitHitLine('tic 5 — RH Fire Bow hits Wolf A for 8'), {
      kind: 'player', tell: 'RH Fire Bow hits A…', payload: '…for 8 damage.', letter: 'A', isCrit: false,
    });
  });
  it('player crit: payload keeps the marker', () => {
    assert.deepEqual(splitHitLine('tic 5 — LH Heavy Chop hits A for 25 CRITICAL!'), {
      kind: 'player', tell: 'LH Heavy Chop hits A…', payload: '…for 25 damage CRITICAL!.', letter: 'A', isCrit: true,
    });
  });
  it('attack name containing "Monster" splits on the right target', () => {
    assert.deepEqual(splitHitLine('tic 5 — LH Monster Slayer hits Monster B for 25'), {
      kind: 'player', tell: 'LH Monster Slayer hits B…', payload: '…for 25 damage.', letter: 'B', isCrit: false,
    });
  });
  it('non-hit lines return null (no split)', () => {
    assert.equal(splitHitLine('tic 4 — Imp A Claw misses'), null);
    assert.equal(splitHitLine('tic 4 — A is defeated'), null);
    assert.equal(splitHitLine('tic 3 — LH Ready'), null);
    assert.equal(splitHitLine('Battle begins...'), null);
    assert.equal(splitHitLine(null), null);
  });
});

describe('arenaKey — PC-70 label normalization', () => {
  it('strips the Monster prefix, mirrors queueLabel', () => {
    assert.equal(arenaKey('Monster A'), 'A');
    assert.equal(arenaKey('A'), 'A');
    assert.equal(arenaKey('Monster #12'), '#12');
    assert.equal(arenaKey(undefined), '');
  });
  it('extracts letter from name+letter label', () => {
    assert.equal(arenaKey('Wolf A'), 'A');
    assert.equal(arenaKey('Glimmerling B'), 'B');
    assert.equal(arenaKey('Giant Rat C'), 'C');
    assert.equal(arenaKey('Blue Slime D'), 'D');
  });
});