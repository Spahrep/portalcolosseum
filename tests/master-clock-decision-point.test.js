import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createEngine from '../js/combat/engine.js';

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('Master clock decision point (PC-106)', () => {
  it('a monster row strictly ahead of a ready row fires before the menu pause', () => {
    const eng = createEngine(seededRNG(7));
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 1, hand_r_speed: 2 },
      monsters: [{ id: 1, max_hp: 80, damage: 1, speed: 8, accuracy: 1, label: 'B' }]
    });
    eng.state.player.hands.RH.state = 'Ready';
    eng.state.queue.length = 0;
    eng.state.queue.push({
      id: 'm1', label: 'B', event: 'impact', tics: 2,
      monsterAttackName: 'Bite', damage: 1, accuracy: 1, cooldownTicks: 4
    });
    eng.state.queue.push({ id: 'p1', label: 'RH', event: 'ready', tics: 8 });

    const result = eng.tick();
    assert.equal(result.playerReady, false, 'ready is still behind the monster successor');
    assert.equal(result.needsInput, false);
    assert.equal(result.row.id, 'm1');
    assert.equal(eng.state.queue.some(r => r.id === 'p1'), true, 'ready row was not skipped or removed');

    // Monster cooldown landed at 4; ready is at 6. One more tick reaches the ready head.
    const mid = eng.tick();
    assert.equal(mid.row.event, 'cooldown');
    const paused = eng.tick();
    assert.equal(paused.playerReady, true, 'menu opens when the ready row is the head');
    assert.equal(paused.needsInput, true);
    assert.equal(eng.state.queue[0].id, 'p1', 'pause does not remove the ready row');
  });
});
