import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createEngine from '../js/combat/engine.js';
import { persisted, writeState, tickPast } from './live-clock.js';
import { swapHandWithBelt } from '../js/combat/participants.js';

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('PC-54 belt swap (swapHandWithBelt + engine wiring)', () => {
  function player(handState = 'Ready') {
    return {
      hp: 100,
      hands: {
        LH: { state: handState, weaponId: 1, attackId: null },
        RH: { state: 'Ready', weaponId: 2, attackId: null }
      }
    };
  }
  function weapons(handL = { id: 1, speed: 4 }, handR = { id: 2, speed: 3 }, belt = { id: 99, speed: 7 }) {
    return { hand_l: handL, hand_r: handR, belt };
  }

  it('ready hand happy path: weapons exchanged, delay = max(speeds)', () => {
    const p = player();
    const w = weapons();
    const res = swapHandWithBelt('LH', p, w);
    assert.equal(res.success, true);
    assert.equal(res.delay, 7); // max(4, 7)
    assert.equal(res.newWeaponId, 99);
    assert.equal(res.oldWeaponId, 1);
    assert.equal(p.hands.LH.weaponId, 99);
    assert.equal(w.hand_l.id, 99);
    assert.equal(w.belt.id, 1);
  });

  it('hand not Ready -> error, no mutation', () => {
    const p = player('cooldown');
    const w = weapons();
    const res = swapHandWithBelt('LH', p, w);
    assert.equal(res.success, false);
    assert.match(res.error, /not Ready/i);
    assert.equal(p.hands.LH.weaponId, 1);
  });

  it('no belt weapon -> error', () => {
    const p = player();
    const w = weapons(null, null, null);
    const res = swapHandWithBelt('LH', p, w);
    assert.equal(res.success, false);
    assert.match(res.error, /belt/i);
  });

  it('invalid hand -> error', () => {
    const p = player();
    const res = swapHandWithBelt('XX', p, weapons());
    assert.equal(res.success, false);
    assert.match(res.error, /invalid hand/i);
  });

  it('engine wiring: swapHandWithBelt creates a cooldown row for the hand with delay tics', () => {
    const eng = createEngine(seededRNG(7));
    eng.startBattle({ loadout: { hand_l: 1, hand_r: 2 }, monsters: [] });
    tickPast(eng, () => false, 1);
    // A Ready hand now has a 'ready' placeholder row at tics=0 (top of queue).
    // The swap must transition it to cooldown instead of creating a new row.
    const pre = persisted(eng).queue.find(r => r.label === 'LH');
    assert.ok(pre, 'LH ready placeholder row exists before swap');
    assert.equal(pre.event, 'ready');
    const w = weapons({ id: 1, speed: 4 }, { id: 2, speed: 3 }, { id: 99, speed: 7 });
    const res = eng.swapHandWithBelt('LH', w);
    assert.equal(res.success, true);
    assert.equal(res.delay, 7);
    const after = persisted(eng).queue.find(r => r.label === 'LH');
    assert.ok(after, 'LH cooldown row created');
    assert.equal(after.event, 'cooldown');
    assert.equal(after.tics, 7);
    assert.equal(persisted(eng).player.hands.LH.weaponId, 99);
  });

  it('engine wiring: non-Ready hand returns error without queue transition', () => {
    const eng = createEngine(seededRNG(8));
    eng.startBattle({ loadout: { hand_l: 1, hand_r: 2 }, monsters: [] });
    writeState(eng, snap => { snap.player.hands.LH.state = 'winding'; });
    const res = eng.swapHandWithBelt('LH', weapons());
    assert.equal(res.success, undefined); // engine contract: {error} on failure
    assert.match(res.error, /not Ready/i);
  });
});
