import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createEngine from '../js/combat/engine.js';
import { peekHead } from '../js/combat/tic-queue.js';

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('Master clock decision point (PC-100)', () => {
  it('playerReady is false when monster winding/impact is next head, even if hand Ready', () => {
    const eng = createEngine(seededRNG(7));
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 1, hand_r_speed: 2 },
      monsters: [{ id: 1, max_hp: 80, damage: 10, speed: 8, accuracy: 70, label: 'B' }]
    });

    // Force a state: hand Ready, monster winding ahead in queue
    // Manually set one hand to Ready and insert a monster winding row at head
    eng.state.player.hands.RH.state = 'Ready';
    // Clear queue and insert: monster winding (tics=5), then player row
    eng.state.queue.length = 0;
    // mutate queue directly for repro (tests already access eng.state.queue)
    eng.state.queue.push({ id: 'm1', label: 'B', event: 'winding', tics: 5 });
    eng.state.queue.push({ id: 'p1', label: 'RH', event: 'winding', tics: 8 });

    const result = eng.tick();
    assert.equal(result.playerReady, false, 'monster winding ahead blocks prompt');
    assert.equal(result.needsInput, false);

    // Now simulate monster threat resolved (remove the winding row)
    eng.state.queue.shift(); // remove monster winding
    const result2 = eng.tick();
    assert.equal(result2.playerReady, true, 'now prompt when no monster threat ahead');
  });
});
