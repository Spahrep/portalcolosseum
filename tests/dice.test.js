import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { drawRandomDie, rollDieFace, selectMonsterGroup } from '../js/combat/dice.js';

describe('drawRandomDie', () => {
  it('happy path: returns a die from the list', () => {
    const pool = [{id:1,color:'green'}, {id:2,color:'red'}];
    const res = drawRandomDie(pool);
    assert.ok(res && (res.id === 1 || res.id === 2));
  });
  it('edge: empty returns null', () => {
    assert.equal(drawRandomDie([]), null);
    assert.equal(drawRandomDie(null), null);
  });
});

describe('rollDieFace', () => {
  it('happy path: returns value from the color faces', () => {
    const faces = { green: [10,20,30], red: [20,30,40] };
    const val = rollDieFace('green', faces);
    assert.ok([10,20,30].includes(val));
  });
  it('edge: unknown color or empty returns 0', () => {
    assert.equal(rollDieFace('blue', {green:[10]}), 0);
    assert.equal(rollDieFace('green', {}), 0);
  });
});

describe('selectMonsterGroup', () => {
  const mappings = [
    { monster_template_id: 1, point_cost: 10, weight: 1 },
    { monster_template_id: 2, point_cost: 20, weight: 2 },
    { monster_template_id: 3, point_cost: 30, weight: 1 }
  ];
  it('happy path: produces 1-5 monsters, total cost <= budget', () => {
    const group = selectMonsterGroup(50, mappings);
    assert.ok(group.length >= 1 && group.length <= 5);
    const sum = group.reduce((s, m) => s + m.point_cost, 0);
    assert.ok(sum <= 50);
  });
  it('edge: budget too low picks cheapest', () => {
    const group = selectMonsterGroup(5, mappings);
    assert.equal(group.length, 1);
    assert.equal(group[0].point_cost, 10);
  });
  it('edge: empty mappings returns []', () => {
    assert.deepEqual(selectMonsterGroup(100, []), []);
  });
  it('5th monster uses largest affordable', () => {
    // force many by low costs, but check property
    const lowCost = [{ monster_template_id: 1, point_cost: 5, weight: 10 }];
    const group = selectMonsterGroup(30, lowCost);
    assert.equal(group.length, 5); // since all 5 affordable
    // last should be 5 too
    assert.equal(group[4].point_cost, 5);
  });
});
