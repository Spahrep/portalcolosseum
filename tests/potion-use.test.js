import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createEngine, { resumeEngine } from '../js/combat/engine.js';

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeParticipants(consumeA = null, consumeB = null) {
  return {
    loadout: {
      hand_l: 1,
      hand_r: 2,
      consume_a: consumeA,
      consume_b: consumeB
    },
    monsters: [{ id: 1, max_hp: 100, damage: 10, speed: 5, accuracy: 70, label: 'A' }]
  };
}

describe('Potion use (PC-39)', () => {
  it('free-hand rule: both hands busy throws No free hand', () => {
    const eng = createEngine(seededRNG(1));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 50, rolled_speed: 2, template_name: 'Heal' }));
    // occupy both hands by setting state (commitAttack would resolve via advance)
    eng.state.player.hands.LH.state = 'winding';
    eng.state.player.hands.RH.state = 'winding';
    assert.throws(() => eng.commitPotion('A'), /No free hand/);
  });

  it('exactly one hand Ready uses that hand', () => {
    const eng = createEngine(seededRNG(2));
    const p = makeParticipants({ effect_type: 'heal', rolled_floor: 30, rolled_speed: 2, template_name: 'Heal' });
    eng.startBattle(p);
    eng.commitAttack('LH', 1, [1], { castTicks: 10, cooldownTicks: 2, playerDamage: 10 });
    const res = eng.commitPotion('A', { weaponSpeed: 3 });
    // potion used on the free hand (RH)
    assert.equal(res.potions.A.used, true);
  });

  it('both Ready picks LH deterministically', () => {
    const eng = createEngine(seededRNG(3));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    const res = eng.commitPotion('A', { weaponSpeed: 3 });
    assert.ok(res.queue.some(r => r.label === 'LH' && r.event === 'drinking'));
  });

  it('params.hand honored', () => {
    const eng = createEngine(seededRNG(4));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    const res = eng.commitPotion('A', { hand: 'RH', weaponSpeed: 3 });
    assert.ok(res.queue.some(r => r.label === 'RH' && r.event === 'drinking'));
  });

  it('params.hand on busy hand throws Hand not ready', () => {
    const eng = createEngine(seededRNG(5));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    eng.commitAttack('RH', 1, [1], { castTicks: 10, cooldownTicks: 2, playerDamage: 10 });
    assert.throws(() => eng.commitPotion('A', { hand: 'RH', weaponSpeed: 3 }), /Hand not ready/);
  });

  it('validate: empty slot throws No potion in slot', () => {
    const eng = createEngine(seededRNG(6));
    eng.startBattle(makeParticipants(null, null));
    assert.throws(() => eng.commitPotion('A'), /No potion in slot A/);
  });

  it('validate: used slot throws Potion already used', () => {
    const eng = createEngine(seededRNG(7));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal', used: false }));
    eng.commitPotion('A', { phase: 'between-fights' });
    assert.throws(() => eng.commitPotion('A'), /Potion already used/);
  });

  it('validate: non-potion effect_type throws Not a potion', () => {
    const eng = createEngine(seededRNG(8));
    const bad = makeParticipants({ effect_type: 'fireball', rolled_floor: 99, rolled_speed: 1, template_name: 'Bad' });
    eng.startBattle(bad);
    assert.throws(() => eng.commitPotion('A'), /Not a potion: fireball/);
  });

  it('consume on success: used flag set after in-battle resolve, second use rejected', () => {
    const eng = createEngine(seededRNG(9));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    eng.commitPotion('A', { weaponSpeed: 0 });
    // advance to effect
    let s = eng.advanceToNextDecision();
    assert.equal(s.potions.A.used, true);
    assert.throws(() => eng.commitPotion('A'), /Potion already used/);
  });

  it('effect pipeline called ONCE: exactly one heal line, hp delta correct', () => {
    const eng = createEngine(seededRNG(10));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 40, rolled_speed: 2, template_name: 'Heal' }));
    eng.state.player.hp = 900;
    eng.commitPotion('A', { weaponSpeed: 0 });
    const afterPre = eng.advanceToNextDecision();
    // effect should have fired
    const healLines = afterPre.feed.filter(l => l.includes('healed'));
    assert.equal(healLines.length, 1);
    assert.equal(eng.state.player.hp, 940);
  });

  it('buff potion: endTic computed at effect-land time (pre>0 case)', () => {
    const eng = createEngine(seededRNG(11));
    eng.startBattle(makeParticipants({ effect_type: 'speed', rolled_floor: 5, rolled_speed: 6, duration_ticks: 8, template_name: 'Speed' }));
    eng.commitPotion('A', { weaponSpeed: 4 });
    // pre = ceil((4+6)/2) = 5, so land tic != commit tic
    let s;
    let found = false;
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => /until tic/.test(l))) {
        found = true;
        break;
      }
    }
    assert.ok(found, 'effect feed line with until tic not found');
    const effectLine = s.feed.find(l => /until tic/.test(l));
    const m = effectLine.match(/^tic (\d+) — .* until tic (\d+)$/);
    assert.ok(m, 'feed line did not match expected format');
    assert.equal(Number(m[2]), Number(m[1]) + 8);
  });

  it('action cost: pre/post with weaponSpeed 4 rolled_speed 6 -> 5 tics each, hand returns Ready after total', () => {
    const eng = createEngine(seededRNG(12));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 10, rolled_speed: 6, template_name: 'Heal' }));
    eng.commitPotion('A', { weaponSpeed: 4 });
    let s = eng.getState();
    assert.notEqual(s.participants.player.hands.LH.state, 'Ready');
    // tics may have advanced during commit's advanceToNextDecision
    const hasDrinkingRow = s.queue.some(r => r.label === 'LH' && r.event === 'drinking');
    assert.ok(hasDrinkingRow || s.queue.some(r => r.label === 'LH' && r.event === 'recovery'));
    // advance enough
    for (let i = 0; i < 15; i++) s = eng.advanceToNextDecision();
    assert.equal(s.participants.player.hands.LH.state, 'Ready');
    assert.ok(!s.queue.some(r => r.label === 'LH' && (r.event === 'drinking' || r.event === 'recovery')));
    const drinkLine = s.feed.find(l => l.includes('drinks'));
    const effectLine = s.feed.find(l => l.includes('healed'));
    const readyLine = s.feed.find(l => l.includes('LH Ready'));
    assert.ok(drinkLine && effectLine && readyLine);
  });

  it('other hand keeps attacking while drinking', () => {
    const eng = createEngine(seededRNG(13));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 10, rolled_speed: 2, template_name: 'Heal' }));
    eng.commitPotion('A', { hand: 'LH', weaponSpeed: 0 });
    // RH should still be able to attack immediately
    const res = eng.commitAttack('RH', 99, [1], { castTicks: 1, cooldownTicks: 1, playerDamage: 10 });
    assert.ok(res);
    assert.ok(!res.feed.some(f => f.includes('Hand not ready')));
  });

  it('between-fights phase: instant apply, no queue rows, used set', () => {
    const eng = createEngine(seededRNG(14));
    const parts = makeParticipants({ effect_type: 'heal', rolled_floor: 50, rolled_speed: 2, template_name: 'Heal' });
    eng.startBattle(parts);
    eng.state.player.hp = 900;
    eng.state.monsters[0].current_hp = 0;
    const beforeHp = eng.state.player.hp;
    const res = eng.commitPotion('A', { phase: 'between-fights' });
    assert.equal(res.potions.A.used, true);
    assert.ok(res.participants.player.hp > beforeHp);
    assert.ok(!res.queue.some(r => r.label === 'LH' || r.label === 'RH')); // no player hand rows for potion
  });

  it('heal cap smoke: 990 + 50 -> 1000', () => {
    const eng = createEngine(seededRNG(15));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 50, rolled_speed: 2, template_name: 'Heal' }));
    eng.state.player.hp = 990;
    eng.commitPotion('A', { phase: 'between-fights' });
    assert.equal(eng.state.player.hp, 1000);
  });

  it('buff smoke: duration_ticks 8 sets endTic = tic + 8', () => {
    const eng = createEngine(seededRNG(16));
    eng.startBattle(makeParticipants({ effect_type: 'damage', rolled_floor: 8, rolled_speed: 2, duration_ticks: 8, template_name: 'Dmg' }));
    const ticBefore = eng.state.tic;
    eng.commitPotion('A', { phase: 'between-fights' });
    assert.equal(eng.state.buffs.length, 1);
    assert.equal(eng.state.buffs[0].endTic, ticBefore + 8);
  });

  it('loadState round-trip preserves potions + used flags', () => {
    const eng = createEngine(seededRNG(17));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    eng.commitPotion('A', { phase: 'between-fights' });
    const persisted = JSON.parse(JSON.stringify(eng.state));
    const eng2 = resumeEngine(persisted, seededRNG(17));
    assert.equal(eng2.state.potions.A.used, true);
    assert.throws(() => eng2.commitPotion('A'), /Potion already used/);
  });
});
