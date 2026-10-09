import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateLoot, normalInt } from '../js/combat/loot.js';

function seq(values) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`rng exhausted at ${i}`);
    return values[i++];
  };
}

describe('normalInt', () => {
  it('range 0 returns the mean and does not draw', () => {
    assert.equal(normalInt(10, 0, () => { throw new Error('rng'); }), 10);
    assert.equal(normalInt(7, null, () => { throw new Error('rng'); }), 7);
  });

  it('u1=0 (Math.log(0)) clamps to the range edge instead of throwing', () => {
    // loot.js:15 — Math.log(0) is -Infinity. The transform is ±Infinity and the clamp holds.
    assert.equal(normalInt(50, 10, seq([0, 0])), 60);
    assert.equal(normalInt(50, 10, seq([0, 0.25])), 60);
    assert.equal(normalInt(50, 10, seq([0, 0.5])), 40);
    assert.equal(normalInt(50, 10, seq([0, 0.75])), 40);
  });

  it('a finite draw stays inside [mean-range, mean+range]', () => {
    const value = normalInt(20, 6, seq([0.5, 0.5]));
    assert.ok(value >= 14 && value <= 26, `got ${value}`);
  });
});

describe('generateLoot', () => {
  const table = [
    { weapon_template_id: 1, lp_cost: 3, weight: 1 },
    { weapon_template_id: 2, lp_cost: 5, weight: 1 },
  ];

  it('spends LP in pick order and rolls gold from the leftover rng', () => {
    // Two zero rolls pick template 1 twice (3+3). u1=0 then u2=0.5 clamps gold to the low edge.
    const drop = generateLoot(8, table, 10, 20, seq([0, 0, 0, 0.5]));
    assert.deepEqual(drop.weaponTemplateIds, [1, 1]);
    assert.equal(drop.gold, 10);
  });

  it('stops when nothing left is affordable', () => {
    const drop = generateLoot(2, table, 0, 0, seq([0]));
    assert.deepEqual(drop.weaponTemplateIds, []);
    assert.equal(drop.gold, 0);
  });

  it('caps weapon drops at 10 even when LP remains', () => {
    const cheap = [{ weapon_template_id: 7, lp_cost: 1, weight: 1 }];
    const draws = Array(10).fill(0);
    const drop = generateLoot(100, cheap, 1, 1, seq(draws));
    assert.equal(drop.weaponTemplateIds.length, 10);
    assert.deepEqual(drop.weaponTemplateIds, Array(10).fill(7));
    assert.equal(drop.gold, 1);
  });

  it('passes the u1=0 edge through the gold roll', () => {
    const drop = generateLoot(0, [], 3, 9, seq([0, 0.5]));
    assert.deepEqual(drop.weaponTemplateIds, []);
    assert.equal(drop.gold, 3);
  });
});
