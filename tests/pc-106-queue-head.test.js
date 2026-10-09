import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import createEngine from '../js/combat/engine.js';
import { addEvent, createQueue, peekHead, replaceReadyWithSuccessor, queuesMatch } from '../js/combat/tic-queue.js';
import { persisted, writeState } from './live-clock.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function fresh(seed = 7) {
  const eng = createEngine(seededRNG(seed));
  eng.startBattle({
    loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 4, hand_r_speed: 6 },
    monsters: [{ id: 1, max_hp: 40, damage: 4, speed: 8, accuracy: 70, label: 'A', name: 'Wolf' }]
  });
  writeState(eng, snap => {
    snap.player.hands.LH.state = 'Ready';
    snap.player.hands.RH.state = 'Ready';
    snap.queue = [];
  });
  return eng;
}

describe('PC-106 ready head is the turn', () => {
  it('a ready row at the head pauses tick and is not removed', () => {
    const eng = fresh();
    writeState(eng, snap => {
      addEvent(snap.queue, 'LH', 'ready', 0);
      addEvent(snap.queue, 'A', 'winding', 5);
    });
    const before = persisted(eng).queue.map(r => r.id);
    const result = eng.tick();
    assert.equal(result.playerReady, true);
    assert.equal(result.needsInput, true);
    assert.equal(result.done, false);
    assert.equal(persisted(eng).tic, 0, 'pause does not advance the clock');
    assert.deepEqual(persisted(eng).queue.map(r => r.id), before, 'ready head stays');
    assert.equal(peekHead(persisted(eng).queue).event, 'ready');
  });

  it('playerReady is the head event, not hand state', () => {
    const src = readFileSync(join(root, 'js/combat/engine.js'), 'utf8');
    const tick = src.slice(src.indexOf('function tick()'), src.indexOf('function isBattleOver'));
    assert.equal(tick.includes('playerHasHandState'), false);
    assert.equal(tick.includes('isMonsterThreat'), false);
    assert.equal(src.includes('isMonsterThreat'), false);
    assert.equal(src.includes('playerHasHandState'), false);
    const removeAt = tick.indexOf('const removed = remove()');
    const processAt = tick.indexOf('process(removed)');
    assert.ok(removeAt > 0 && processAt > removeAt, 'live tick removes the head before process');
  });

  it('a strictly-earlier monster impact fires before the ready head is reached', () => {
    const eng = fresh();
    writeState(eng, snap => {
      addEvent(snap.queue, 'LH', 'ready', 5);
      const impact = addEvent(snap.queue, 'A', 'impact', 2);
      impact.monsterAttackName = 'Bite';
      impact.damage = 1;
      impact.accuracy = 1;
      impact.cooldownTicks = 3;
    });
    const impact = persisted(eng).queue.find(r => r.event === 'impact');
    assert.equal(peekHead(persisted(eng).queue).event, 'impact');
    const result = eng.tick();
    assert.equal(result.row.event, 'impact', 'earlier monster fires on this tick');
    assert.equal(result.playerReady, true, 'menu opens only after that impact, when the ready head is reached');
    assert.ok(persisted(eng).queue.some(r => r.event === 'ready'), 'ready token was not consumed by the monster tick');
    assert.equal(persisted(eng).queue.some(r => r.id === impact.id), false);
  });

  it('a same-tic monster impact loses the tie; the ready head pauses', () => {
    const q = createQueue();
    addEvent(q, 'A', 'impact', 4);
    addEvent(q, 'LH', 'ready', 4);
    assert.equal(q[0].event, 'ready', 'player-first on a tic tie');
    assert.equal(q[1].event, 'impact');

    const eng = fresh();
    writeState(eng, snap => {
      addEvent(snap.queue, 'A', 'impact', 4);
      addEvent(snap.queue, 'LH', 'ready', 4);
    });
    const result = eng.tick();
    assert.equal(result.playerReady, true);
    assert.equal(result.needsInput, true);
    assert.ok(persisted(eng).queue.some(r => r.event === 'impact'), 'tied monster impact does not fire');
    assert.equal(persisted(eng).queue[0].event, 'ready');
  });

  it('two ready hands surface LH then RH', () => {
    const eng = fresh();
    writeState(eng, snap => {
      addEvent(snap.queue, 'RH', 'ready', 0);
      addEvent(snap.queue, 'LH', 'ready', 0);
    });
    assert.equal(persisted(eng).queue[0].label, 'LH');
    assert.equal(eng.tick().playerReady, true);
    const lh = eng.commitAttack('LH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 5, attackName: 'Attack' });
    assert.equal(lh.removed.label, 'LH');
    assert.equal(lh.inserted.event, 'winding');
    assert.equal(persisted(eng).queue[0].label, 'RH');
    assert.equal(persisted(eng).queue[0].event, 'ready');
    assert.equal(eng.tick().playerReady, true, 'RH is the next decision point');
  });

  it('commit attack removes the ready head and inserts winding in one mutation', () => {
    const eng = fresh();
    writeState(eng, snap => {
      addEvent(snap.queue, 'LH', 'ready', 0);
      addEvent(snap.queue, 'A', 'cooldown', 6);
    });
    const before = persisted(eng).queue.map(r => ({ ...r }));
    const committed = eng.commitAttack('LH', 9, [1], { castTicks: 4, cooldownTicks: 2, playerDamage: 12, attackName: 'Chop' });
    assert.equal(committed.committed, true);
    assert.equal(committed.removed.event, 'ready');
    assert.equal(committed.inserted.event, 'winding');
    assert.equal(committed.inserted.tics, 4);
    assert.equal(persisted(eng).queue.some(r => r.id === committed.removed.id), false);
    assert.ok(persisted(eng).queue.some(r => r.id === committed.inserted.id));
    const local = replaceReadyWithSuccessor(before, committed.removed, committed.inserted);
    assert.equal(queuesMatch(local, persisted(eng).queue), true, 'ceremony mutation matches the engine commit');
  });

  it('commit potion removes the ready head and inserts drinking', () => {
    const eng = fresh();
    writeState(eng, snap => {
      snap.potions = {
        A: { effect_type: 'heal', rolled_floor: 10, rolled_speed: 2, template_name: 'Heal', used: false },
        B: null
      };
      addEvent(snap.queue, 'LH', 'ready', 0);
    });
    const committed = eng.commitPotion('A', { hand: 'LH', weaponSpeed: 2 });
    assert.equal(committed.removed.event, 'ready');
    assert.equal(committed.inserted.event, 'drinking');
    assert.equal(persisted(eng).queue.some(r => r.label === 'LH' && r.event === 'ready'), false);
    assert.ok(persisted(eng).queue.some(r => r.label === 'LH' && r.event === 'drinking'));
  });

  it('softlock shape grants a turn and the battle can finish', () => {
    const eng = createEngine(() => 0);
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2, hand_l_speed: 1, hand_r_speed: 1 },
      monsters: [{ id: 1, max_hp: 20, damage: 1, speed: 8, accuracy: 1, label: 'A' }]
    });
    writeState(eng, snap => {
      snap.player.hands.LH.state = 'Ready';
      snap.player.hands.RH.state = 'Ready';
      snap.queue = [
        { id: 'lh', label: 'LH', event: 'ready', tics: 0 },
        { id: 'rh', label: 'RH', event: 'ready', tics: 0 },
        { id: 'mw', label: 'A', event: 'winding', tics: 5, monsterAttackName: 'Bite', damage: 1, accuracy: 1, cooldownTicks: 4 },
        { id: 'mc', label: 'A', event: 'cooldown', tics: 9 }
      ];
    });

    const paused = eng.tick();
    assert.equal(paused.playerReady, true, 'both hands Ready with monster rows queued is still a turn');
    assert.equal(persisted(eng).queue[0].id, 'lh');

    let turns = 0;
    for (let i = 0; i < 30 && !eng.getState().battle_over; i++) {
      const head = peekHead(persisted(eng).queue);
      if (head && head.event === 'ready') {
        turns++;
        eng.commitAttack(head.label, 1, [1], { castTicks: 1, cooldownTicks: 1, playerDamage: 100, attackName: 'Attack' });
      } else {
        eng.tick();
      }
    }
    assert.ok(turns >= 1, 'the player was granted a turn');
    assert.equal(eng.getState().monsters_dead, true, 'battle completes instead of softlocking');
  });
});
