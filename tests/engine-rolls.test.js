import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addEvent } from '../js/combat/tic-queue.js';
import createEngine, { rollMultiplier } from '../js/combat/engine.js';
import { persisted, writeState } from './live-clock.js';

// Monster impact is the exported engine path that still rolls a bounded integer.
// range <= 0 consumes no RNG (rollDamage short-circuit). A missing range is not
// that short-circuit: the engine substitutes 3.
describe('engine damage roll (injected rng)', () => {
  function seq(values) {
    let i = 0;
    return () => {
      if (i >= values.length) throw new Error('rng exhausted');
      return values[i++];
    };
  }

  function strike(rng, { damage, damageRange, accuracy = 100 }) {
    const eng = createEngine(rng);
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2 },
      monsters: [{ id: 1, max_hp: 500, damage, speed: 8, accuracy, label: 'A', name: 'Wolf' }],
    });
    writeState(eng, snap => {
      snap.player.hp = 400;
      snap.queue = [];
      const row = addEvent(snap.queue, 'A', 'impact', 0);
      row.monsterAttackName = 'Bite';
      row.damage = damage;
      row.accuracy = accuracy;
      if (damageRange !== undefined) row.damageRange = damageRange;
      row.cooldownTicks = 4;
      row.critChance = 0;
    });
    const before = persisted(eng).player.hp;
    eng.tick();
    const feed = persisted(eng).feed.join('\n');
    return { dealt: before - persisted(eng).player.hp, feed };
  }

  it('range <= 0 deals the stamped damage and does not consume rng', () => {
    assert.equal(strike(() => 0.99, { damage: 8, damageRange: 0 }).dealt, 8);
    assert.equal(strike(() => 0, { damage: 8, damageRange: -3 }).dealt, 8);
    assert.equal(strike(() => 0.5, { damage: 0, damageRange: 0 }).dealt, 0);
    // First draw would miss at accuracy 50. A range-0 roll must leave that draw for the hit check.
    const skipped = strike(seq([0.99, 0]), { damage: 8, damageRange: 0, accuracy: 50 });
    assert.match(skipped.feed, /misses/);
    assert.equal(skipped.dealt, 0);
  });

  it('a missing range is the engine default of 3, not a no-roll', () => {
    const low = strike(seq([0, 0]), { damage: 10 });
    const high = strike(seq([0.999, 0]), { damage: 10 });
    assert.equal(low.dealt, 7);
    assert.equal(high.dealt, 13);
  });

  it('range N stays in [base-N, base+N], clamps at 1, and is not a single value', () => {
    assert.equal(strike(seq([0, 0]), { damage: 10, damageRange: 3 }).dealt, 7);
    assert.equal(strike(seq([0.999, 0]), { damage: 10, damageRange: 3 }).dealt, 13);
    assert.equal(strike(seq([0, 0]), { damage: 2, damageRange: 5 }).dealt, 1);
    const seen = new Set();
    for (const u of [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.999]) {
      const dealt = strike(seq([u, 0]), { damage: 10, damageRange: 3 }).dealt;
      assert.ok(dealt >= 1 && dealt >= 7 && dealt <= 13, `u=${u} dealt ${dealt}`);
      seen.add(dealt);
    }
    assert.ok(seen.size > 1, 'injected draws must produce a spread');
  });
});
describe('rollMultiplier contract (range 0 = base, range N within [base-N, base+N] clamped >=0)', () => {
  it('range 0 or falsy returns base exactly, including sub-1 multipliers', () => {
    assert.equal(rollMultiplier(1.5, 0), 1.5);
    assert.equal(rollMultiplier(0.7, 0), 0.7);
    assert.equal(rollMultiplier(1.5, null), 1.5);
    assert.equal(rollMultiplier(1.5, undefined), 1.5);
    assert.equal(rollMultiplier(1.5, -3), 1.5);
  });

  it('range N stays inside [base-N, base+N] and clamps at 0, not 1', () => {
    assert.equal(rollMultiplier(1.5, 0.2, () => 0), 1.3);
    assert.equal(rollMultiplier(1.5, 0.2, () => 1), 1.7);
    assert.equal(rollMultiplier(1.5, 0.2, () => 0.5), 1.5);
    assert.equal(rollMultiplier(0.1, 1, () => 0), 0);
    const base = 1.5;
    const v = 0.4;
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const r = rollMultiplier(base, v);
      assert.ok(r >= 0 && r >= base - v - 1e-9 && r <= base + v + 1e-9, `rollMultiplier(${base},${v})=${r} out of range`);
      seen.add(r);
    }
    assert.ok(seen.size > 1, 'should produce a spread');
  });
});
