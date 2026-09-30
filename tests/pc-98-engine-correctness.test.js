import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import createEngine from '../js/combat/engine.js';
import { createQueue, addEvent, peekHead } from '../js/combat/tic-queue.js';
import { createPlayer, applyDamage, isPlayerDead, isMonsterDead } from '../js/combat/participants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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
    eng.state.player.hp = 1;
    let sawDeath = false;
    for (let i = 0; i < 8; i++) {
      const result = eng.tick();
      if (eng.state.player.hp === 0) {
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
    assert.equal(eng.state.tic, 0);
    const head = peekHead(eng.state.queue);
    assert.equal(head.label, 'LH');
    assert.equal(head.tics, 4);
    eng.tick();
    assert.equal(eng.state.tic, 4, 'live clock must advance by the processed head cost');
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
    addEvent(eng.state.queue, 'A', 'winding', 12);
    addEvent(eng.state.queue, 'A', 'cooldown', 9);
    addEvent(eng.state.queue, 'B', 'winding', 6);
    assert.ok(eng.state.queue.filter(r => r.label === 'A').length >= 2);

    const impact = {
      label: 'LH',
      event: 'impact',
      tics: 0,
      targetIds: [1],
      damage: 100,
      accuracy: 100,
      attackName: 'Slash',
      cooldownTicks: 2
    };
    eng.stepOnce(impact);

    assert.ok(eng.state.feed.some(l => l.includes('A is defeated')));
    assert.equal(eng.state.queue.filter(r => r.label === 'A').length, 0, 'killed monster rows leave immediately');
    assert.ok(eng.state.queue.some(r => r.label === 'B'), 'a living monster keeps its rows');
  });
});

describe('PC-98 same-tic tie order', () => {
  it('status/expiry first, ready last, LH before RH before monsters inside a category', () => {
    const q = createQueue();
    addEvent(q, 'M', 'attack', 4);
    addEvent(q, 'RH', 'ready', 4);
    addEvent(q, 'LH', 'winding', 4);
    addEvent(q, null, 'buff_expiry', 4);
    addEvent(q, 'RH', 'cooldown', 4);
    addEvent(q, 'LH', 'ready', 4);
    assert.deepEqual(q.map(r => ({ label: r.label, event: r.event })), [
      { label: null, event: 'buff_expiry' },
      { label: 'LH', event: 'winding' },
      { label: 'RH', event: 'cooldown' },
      { label: 'M', event: 'attack' },
      { label: 'LH', event: 'ready' },
      { label: 'RH', event: 'ready' }
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
    eng.state.tic = 5;
    eng.state.buffs = [{ name: 'Vigor', type: 'damage', value: 2, endTic: 5 }];

    eng.stepOnce({ label: 'LH', event: 'approach', tics: 0 });

    assert.equal(eng.state.buffs.length, 1, 'a non-expiry fire must not drop a due buff');
    assert.equal(eng.state.feed.some(l => l.includes('Vigor buff expired')), false);

    const exp = addEvent(eng.state.queue, null, 'buff_expiry', 0);
    exp.buffName = 'Vigor';
    eng.stepOnce(exp);
    assert.equal(eng.state.buffs.length, 0);
    assert.ok(eng.state.feed.some(l => l.includes('Vigor buff expired')));
  });
});

describe('PC-98 unarmed fist_speed', () => {
  it('unarmed windup and cooldown add fist_speed to the rolled prepare', () => {
    const src = readFileSync(join(root, 'api/combat/[...path].js'), 'utf8');
    const branchStart = src.indexOf('if (!weaponId)');
    assert.ok(branchStart > 0, 'unarmed branch exists');
    const branch = src.slice(branchStart, src.indexOf('} else {', branchStart));
    assert.match(
      branch,
      /castTicks\s*=\s*config\.fist_speed\s*\+\s*rollStat\(config\.fist_prepare_time,\s*config\.fist_prepare_time_range\)/
    );
    assert.match(
      branch,
      /cooldownTicks\s*=\s*config\.fist_speed\s*\+\s*rollStat\(config\.fist_cooldown_time,\s*config\.fist_cooldown_time_range\)/
    );
    assert.doesNotMatch(branch, /castTicks\s*=\s*rollStat\(/);
    assert.doesNotMatch(branch, /cooldownTicks\s*=\s*rollStat\(/);
  });
});
