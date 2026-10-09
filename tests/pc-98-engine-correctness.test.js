import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createEngine from '../js/combat/engine.js';
import { createQueue, addEvent, peekHead } from '../js/combat/tic-queue.js';
import { createPlayer, applyDamage, isPlayerDead, isMonsterDead } from '../js/combat/participants.js';
import { persisted, writeState } from './live-clock.js';

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('PC-98 player death at hp 0', () => {
  it('a killing blow clamped at 0 is dead, matching monsters', () => {
    const player = createPlayer({ hand_l: 1, hand_r: 2 }, 8);
    applyDamage(player, 8);
    assert.equal(player.hp, 0);
    assert.equal(isPlayerDead(player), true);

    const monster = { type: 'monster', current_hp: 8, max_hp: 8 };
    applyDamage(monster, 8);
    assert.equal(monster.current_hp, 0);
    assert.equal(isMonsterDead(monster), true);
  });

  it('tick cleanup and getState agree that hp 0 ends the battle', () => {
    const eng = createEngine(() => 0);
    eng.startBattle({
      loadout: { hand_l_speed: 3, hand_r_speed: 4 },
      monsters: [{ id: 1, max_hp: 50, damage: 20, speed: 1, accuracy: 100, label: 'A' }]
    });
    // Death assertion needs the seeded clock, not a later queue.
    const intro = persisted(eng).intro;
    writeState(eng, snap => {
      snap.tic = 0;
      snap.queue = intro.rows.map(r => ({ ...r }));
      snap.player.hands.LH.state = 'Approach';
      snap.player.hands.RH.state = 'Approach';
      snap.player.hp = 1;
      snap.feed = [...(intro.seedFeed || [])];
    });
    let sawDeath = false;
    for (let i = 0; i < 8; i++) {
      const result = eng.tick();
      if (persisted(eng).player.hp === 0) {
        assert.equal(result.battleOver, true, 'cleanupPhase must treat hp 0 as death');
        const snap = eng.getState();
        assert.equal(snap.player_dead, true);
        assert.equal(snap.battle_over, true);
        sawDeath = true;
        break;
      }
    }
    assert.equal(sawDeath, true, 'monster impact should clamp the player to 0');
  });
});

describe('PC-98 live tick clock', () => {
  it('tick() adds the head tic cost to state.tic before processing', () => {
    const eng = createEngine(seededRNG(3));
    eng.startBattle({
      loadout: { hand_l_speed: 4, hand_r_speed: 9 },
      monsters: [{ id: 1, max_hp: 80, damage: 1, speed: 20, accuracy: 1, label: 'A' }]
    });
    // Clock assertion needs the seeded head, not the post-decision queue.
    const intro = persisted(eng).intro;
    writeState(eng, snap => {
      snap.tic = 0;
      snap.queue = intro.rows.map(r => ({ ...r }));
      snap.player.hands.LH.state = 'Approach';
      snap.player.hands.RH.state = 'Approach';
    });
    assert.equal(persisted(eng).tic, 0);
    const head = peekHead(persisted(eng).queue);
    assert.equal(head.label, 'LH');
    assert.equal(head.tics, 4);
    eng.tick();
    assert.equal(persisted(eng).tic, 4, 'live clock must advance by the processed head cost');
  });
});

describe('PC-98 dead monster queue rows', () => {
  it('splices every queue row for a monster in the same process that logs the defeat', () => {
    const eng = createEngine(() => 0);
    eng.startBattle({
      loadout: { hand_l_speed: 8, hand_r_speed: 9 },
      monsters: [
        { id: 1, max_hp: 5, damage: 1, speed: 6, accuracy: 1, label: 'A', name: 'Rat' },
        { id: 2, max_hp: 80, damage: 1, speed: 7, accuracy: 1, label: 'B', name: 'Wolf' }
      ]
    });
    writeState(eng, snap => {
      addEvent(snap.queue, 'A', 'winding', 12);
      addEvent(snap.queue, 'A', 'cooldown', 9);
      addEvent(snap.queue, 'B', 'winding', 6);
      const impact = addEvent(snap.queue, 'LH', 'impact', 0);
      impact.targetIds = [1];
      impact.damage = 100;
      impact.accuracy = 100;
      impact.attackName = 'Slash';
      impact.cooldownTicks = 2;
    });
    assert.ok(persisted(eng).queue.filter(r => r.label === 'A').length >= 2);

    eng.tick();

    assert.ok(persisted(eng).feed.some(l => l.includes('A is defeated')));
    assert.equal(persisted(eng).queue.filter(r => r.label === 'A').length, 0, 'killed monster rows leave immediately');
    assert.ok(persisted(eng).queue.some(r => r.label === 'B'), 'a living monster keeps its rows');
  });
});

describe('PC-98 same-tic tie order', () => {
  it('status/expiry first, then player rows including ready, before monsters', () => {
    const q = createQueue();
    addEvent(q, 'M', 'attack', 4);
    addEvent(q, 'RH', 'ready', 4);
    addEvent(q, 'LH', 'winding', 4);
    addEvent(q, null, 'buff_expiry', 4);
    addEvent(q, 'RH', 'cooldown', 4);
    addEvent(q, 'LH', 'ready', 4);
    // PC-106: ready is not a trailer category. Same tic is player-first, so a
    // ready row sorts ahead of a monster impact. LH before RH stays.
    assert.deepEqual(q.map(r => ({ label: r.label, event: r.event })), [
      { label: null, event: 'buff_expiry' },
      { label: 'LH', event: 'winding' },
      { label: 'LH', event: 'ready' },
      { label: 'RH', event: 'ready' },
      { label: 'RH', event: 'cooldown' },
      { label: 'M', event: 'attack' }
    ]);
  });
});

describe('PC-98 buff expiry is its own queue item', () => {
  it('firing another row does not sweep a due buff', () => {
    const eng = createEngine(seededRNG(1));
    eng.startBattle({
      loadout: { hand_l_speed: 20, hand_r_speed: 20 },
      monsters: [{ id: 1, max_hp: 100, damage: 1, speed: 1, accuracy: 1, label: 'A' }]
    });
    writeState(eng, snap => {
      snap.tic = 5;
      snap.buffs = [{ name: 'Vigor', type: 'damage', value: 2, endTic: 5 }];
      snap.queue = [{ id: 'ap', label: 'LH', event: 'approach', tics: 0 }];
    });

    eng.tick();

    assert.equal(persisted(eng).buffs.length, 1, 'a non-expiry fire must not drop a due buff');
    assert.equal(persisted(eng).feed.some(l => l.includes('Vigor buff expired')), false);

    writeState(eng, snap => {
      const exp = addEvent(snap.queue, null, 'buff_expiry', 0);
      exp.buffName = 'Vigor';
    });
    eng.tick();
    assert.equal(persisted(eng).buffs.length, 0);
    assert.ok(persisted(eng).feed.some(l => l.includes('Vigor buff expired')));
  });
});
