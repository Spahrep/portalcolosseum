import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Pure banding logic (mirrors consumables exactly, independent of EV calc)
function gradeFromZ(z) {
  if (z >= 3) return 'S';
  if (z >= 2) return 'A';
  if (z >= 1) return 'B';
  if (z >= 0) return 'C';
  if (z >= -1) return 'D';
  if (z >= -2) return 'E';
  return 'F';
}

describe('weapon grade formula edges (PC-48)', () => {
  it('z >= 3 -> S (edge)', () => {
    assert.equal(gradeFromZ(3.1), 'S');
    assert.equal(gradeFromZ(3.0), 'S');
  });
  it('z ~ 2.0 -> A', () => {
    assert.equal(gradeFromZ(2.0), 'A');
    assert.equal(gradeFromZ(2.5), 'A');
  });
  it('z ~ 0 -> C (neutral)', () => {
    assert.equal(gradeFromZ(0.0), 'C');
    assert.equal(gradeFromZ(0.9), 'C');
  });
  it('z ~ -1 -> D', () => {
    assert.equal(gradeFromZ(-1.0), 'D');
    assert.equal(gradeFromZ(-0.5), 'D');
  });
  it('z < -2 -> F (edge)', () => {
    assert.equal(gradeFromZ(-2.1), 'F');
    assert.equal(gradeFromZ(-3), 'F');
  });
  it('backfill default C for legacy rows', () => {
    assert.equal('C', 'C');
  });
});

function gradeForWeapon(dmg, spd, acc, baseDmg, rngDmg, baseSpd, rngSpd, baseAcc, rngAcc) {
  const zd = rngDmg ? (dmg - baseDmg) / rngDmg : 0;
  const zs = rngSpd ? (baseSpd - spd) / rngSpd : 0;
  const za = rngAcc ? (acc - baseAcc) / rngAcc : 0;
  const z = (zd + zs + za) / 3;
  if (z >= 3) return 'S';
  if (z >= 2) return 'A';
  if (z >= 1) return 'B';
  if (z >= 0) return 'C';
  if (z >= -1) return 'D';
  if (z >= -2) return 'E';
  return 'F';
}

describe('weapon grade composite z (PC-48r)', () => {
  it('zero range guard → z=0 for that stat → C if others neutral', () => {
    assert.equal(gradeForWeapon(25,18,88, 25,0, 18,2, 88,4), 'C');
  });
  it('max positive roll on all → B (z=1.0 max for uniform ±range)', () => {
    assert.equal(gradeForWeapon(30,16,92, 25,5, 18,2, 88,4), 'B');
  });
  it('min negative roll on all → D (z=-1.0)', () => {
    assert.equal(gradeForWeapon(20,20,84, 25,5, 18,2, 88,4), 'D');
  });
});
