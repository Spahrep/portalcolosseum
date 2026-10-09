import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createEngine, { resumeEngine } from '../js/combat/engine.js';
import { applyBuffs } from '../js/combat/buffs.js';
import { persisted, writeState, readyHand, tickPast, tickUntil, tickUntilHand, tickUntilInput } from './live-clock.js';

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stepUntil(eng, pred, max = 40) {
  return tickPast(eng, pred, max);
}

function keepOtherHandBack(parts, speed = 8) {
  parts.loadout.hand_r_speed = speed;
  parts.loadout.hand_l_speed = parts.loadout.hand_l_speed || 1;
  for (const m of parts.monsters) m.speed = Math.max(speed, 20);
  return parts;
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
    // occupy both hands by setting state (commitAttack would resolve via the clock)
    writeState(eng, snap => {
      snap.player.hands.LH.state = 'winding';
      snap.player.hands.RH.state = 'winding';
    });
    assert.throws(() => eng.commitPotion('A'), /No free hand/);
  });

  it('exactly one hand Ready uses that hand', () => {
    const eng = createEngine(seededRNG(2));
    const p = makeParticipants({ effect_type: 'heal', rolled_floor: 30, rolled_speed: 2, template_name: 'Heal' });
    eng.startBattle(p);
    readyHand(eng, 'LH');
    eng.commitAttack('LH', 1, [1], { castTicks: 10, cooldownTicks: 2, playerDamage: 10 });
    readyHand(eng, 'RH');
    eng.commitPotion('A', { weaponSpeed: 3 });
    tickPast(eng, s => s.potions?.A?.used);
    // potion used on the free hand (RH)
    assert.equal(persisted(eng).potions.A.used, true);
  });

  it('both Ready picks LH deterministically', () => {
    const eng = createEngine(seededRNG(3));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 3 });
    stepUntil(eng, s => s.queue.some(r => r.label === 'LH' && r.event === 'recovery') || s.feed.some(l => l.includes('healed')));
    assert.ok(persisted(eng).queue.some(r => r.label === 'LH' && r.event === 'recovery') || persisted(eng).feed.some(l => l.includes('LH drinks') || l.includes('LH healed')));
  });

  it('params.hand honored', () => {
    const eng = createEngine(seededRNG(4));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    readyHand(eng, 'RH');
    eng.commitPotion('A', { hand: 'RH', weaponSpeed: 3 });
    stepUntil(eng, s => s.queue.some(r => r.label === 'RH' && r.event === 'recovery') || s.feed.some(l => l.includes('healed')));
    assert.ok(persisted(eng).queue.some(r => r.label === 'RH' && r.event === 'recovery') || persisted(eng).feed.some(l => l.includes('RH drinks') || l.includes('RH healed')));
  });

  it('params.hand on busy hand throws Hand not ready', () => {
    const eng = createEngine(seededRNG(5));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    readyHand(eng, 'RH');
    eng.commitAttack('RH', 1, [1], { castTicks: 10, cooldownTicks: 2, playerDamage: 10 });
    assert.throws(() => eng.commitPotion('A', { hand: 'RH', weaponSpeed: 3 }), /Hand not ready/);
  });

  it('validate: empty slot throws No potion in slot', () => {
    const eng = createEngine(seededRNG(6));
    eng.startBattle(makeParticipants(null, null));
    tickUntilInput(eng);
    assert.throws(() => eng.commitPotion('A'), /No potion in slot A/);
  });

  it('validate: used slot throws Potion already used', () => {
    const eng = createEngine(seededRNG(7));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal', used: false }));
    tickUntilInput(eng);
    eng.commitPotion('A', { phase: 'between-fights' });
    assert.throws(() => eng.commitPotion('A'), /Potion already used/);
  });

  it('validate: non-potion effect_type throws Not a potion', () => {
    const eng = createEngine(seededRNG(8));
    const bad = makeParticipants({ effect_type: 'fireball', rolled_floor: 99, rolled_speed: 1, template_name: 'Bad' });
    eng.startBattle(bad);
    tickUntilInput(eng);
    assert.throws(() => eng.commitPotion('A'), /Not a potion: fireball/);
  });

  it('consume on success: used flag set after in-battle resolve, second use rejected', () => {
    const eng = createEngine(seededRNG(9));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    // Drinking row is behind already-queued rows; walk insertion order until it fires.
    let s = stepUntil(eng, st => st.potions?.A?.used);
    assert.equal(s.potions.A.used, true);
    assert.throws(() => eng.commitPotion('A'), /Potion already used/);
  });

  it('effect pipeline called ONCE: exactly one heal line, hp delta correct', () => {
    const eng = createEngine(seededRNG(10));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 40, rolled_speed: 2, template_name: 'Heal' }));
    writeState(eng, snap => { snap.player.hp = 900; });
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    const afterPre = stepUntil(eng, s => s.feed.some(l => l.includes('healed')));
    const healLines = afterPre.feed.filter(l => l.includes('healed'));
    assert.equal(healLines.length, 1);
    assert.equal(persisted(eng).player.hp, 940);
  });

  it('buff potion: endTic computed at effect-land time (pre>0 case)', () => {
    const eng = createEngine(seededRNG(11));
    eng.startBattle(makeParticipants({ effect_type: 'speed', rolled_floor: 5, rolled_speed: 6, duration_ticks: 8, template_name: 'Speed' }));
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 4 });
    const s = stepUntil(eng, st => st.feed.some(l => /until tic/.test(l)));
    assert.ok(s.feed.some(l => /until tic/.test(l)), 'effect feed line with until tic not found');
    const effectLine = s.feed.find(l => /until tic/.test(l));
    const m = effectLine.match(/^tic (\d+) — .* until tic (\d+)$/);
    assert.ok(m, 'feed line did not match expected format');
    assert.equal(Number(m[2]), Number(m[1]) + 8);
  });

  it('action cost: pre/post with weaponSpeed 4 rolled_speed 6 -> 5 tics each, hand returns Ready after total', () => {
    const eng = createEngine(seededRNG(12));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 10, rolled_speed: 6, template_name: 'Heal' }));
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 4 });
    let s = eng.getState();
    assert.notEqual(s.participants.player.hands.LH.state, 'Ready');
    const hasDrinkingRow = s.queue.some(r => r.label === 'LH' && r.event === 'drinking');
    assert.ok(hasDrinkingRow || s.queue.some(r => r.label === 'LH' && r.event === 'recovery'));
    s = tickUntilHand(eng, 'LH', () => persisted(eng).player.hands.LH.state === 'Ready');
    assert.equal(persisted(eng).player.hands.LH.state, 'Ready');
    assert.ok(!s.queue.some(r => r.label === 'LH' && (r.event === 'drinking' || r.event === 'recovery')));
    const drinkLine = s.feed.find(l => l.includes('drinks'));
    const effectLine = s.feed.find(l => l.includes('healed'));
    const readyLine = s.feed.find(l => l.includes('LH Ready'));
    assert.ok(drinkLine && effectLine && readyLine);
  });

  it('other hand keeps attacking while drinking', () => {
    const eng = createEngine(seededRNG(13));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 10, rolled_speed: 2, template_name: 'Heal' }));
    readyHand(eng, 'LH');
    eng.commitPotion('A', { hand: 'LH', weaponSpeed: 0 });
    readyHand(eng, 'RH');
    eng.commitAttack('RH', 99, [1], { castTicks: 1, cooldownTicks: 1, playerDamage: 10 });
    tickUntilInput(eng);
    assert.ok(!persisted(eng).feed.some(f => f.includes('Hand not ready')));
  });

  it('between-fights phase: instant apply, no queue rows, used set', () => {
    const eng = createEngine(seededRNG(14));
    const parts = makeParticipants({ effect_type: 'heal', rolled_floor: 50, rolled_speed: 2, template_name: 'Heal' });
    eng.startBattle(parts);
    writeState(eng, snap => {
      snap.player.hp = 900;
      snap.monsters[0].current_hp = 0;
    });
    const beforeHp = persisted(eng).player.hp;
    eng.tick();
    eng.commitPotion('A', { phase: 'between-fights' });
    assert.equal(persisted(eng).potions.A.used, true);
    assert.ok(persisted(eng).player.hp > beforeHp);
    assert.ok(!persisted(eng).queue.some(r => r.event === 'drinking'));
  });

  it('heal cap smoke: 990 + 50 -> 1000', () => {
    const eng = createEngine(seededRNG(15));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 50, rolled_speed: 2, template_name: 'Heal' }));
    writeState(eng, snap => { snap.player.hp = 990; });
    tickUntilInput(eng);
    eng.commitPotion('A', { phase: 'between-fights' });
    assert.equal(persisted(eng).player.hp, 1000);
  });

  it('buff smoke: duration_ticks 8 sets endTic = tic + 8', () => {
    const eng = createEngine(seededRNG(16));
    eng.startBattle(makeParticipants({ effect_type: 'damage', rolled_floor: 8, rolled_speed: 2, duration_ticks: 8, template_name: 'Dmg' }));
    const ticBefore = persisted(eng).tic;
    tickUntilInput(eng);
    eng.commitPotion('A', { phase: 'between-fights' });
    assert.equal(persisted(eng).buffs.length, 1);
    assert.equal(persisted(eng).buffs[0].endTic, persisted(eng).tic + 8);
    assert.ok(persisted(eng).tic >= ticBefore);
  });

  it('loadState round-trip preserves potions + used flags', () => {
    const eng = createEngine(seededRNG(17));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    tickUntilInput(eng);
    eng.commitPotion('A', { phase: 'between-fights' });
    const saved = eng.getPersistedState();
    const eng2 = resumeEngine(saved, seededRNG(17));
    assert.equal(persisted(eng2).potions.A.used, true);
    assert.throws(() => eng2.commitPotion('A'), /Potion already used/);
  });
});

describe('Buff potion effects and duration (PC-39)', () => {
  it('damage buff: in-battle damage potion adds to committed attack damage', () => {
    const eng = createEngine(seededRNG(100));
    const p = makeParticipants({ effect_type: 'damage', rolled_floor: 8, rolled_speed: 2, duration_ticks: 5, template_name: 'Dmg' });
    eng.startBattle(keepOtherHandBack(p, 3));
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    tickUntil(eng, s => s.feed.some(l => l.includes('damage +8')));
    readyHand(eng, 'RH');
    eng.commitAttack('RH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 10 });
    const attackRow = persisted(eng).queue.find(r => r.label === 'RH' && r.event === 'winding');
    assert.equal(attackRow.damage, 10 + 8);
  });

  it('speed buff: reduces cast and cooldown to min 1', () => {
    const eng = createEngine(seededRNG(101));
    const p = makeParticipants({ effect_type: 'speed', rolled_floor: 2, rolled_speed: 2, duration_ticks: 5, template_name: 'Spd' });
    eng.startBattle(keepOtherHandBack(p, 3));
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    tickUntil(eng, s => s.feed.some(l => l.includes('speed +2')));
    readyHand(eng, 'RH');
    eng.commitAttack('RH', 1, [1], { castTicks: 5, cooldownTicks: 3, playerDamage: 10 });
    const attackRow = persisted(eng).queue.find(r => r.label === 'RH' && r.event === 'winding');
    assert.equal(attackRow.tics, 3);
  });

  it('speed buff min-1: never goes to 0 or negative', () => {
    const eng = createEngine(seededRNG(102));
    const p = makeParticipants({ effect_type: 'speed', rolled_floor: 10, rolled_speed: 2, duration_ticks: 5, template_name: 'Spd' });
    eng.startBattle(keepOtherHandBack(p, 3));
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    tickUntil(eng, s => s.feed.some(l => l.includes('speed +10')));
    readyHand(eng, 'RH');
    eng.commitAttack('RH', 1, [1], { castTicks: 5, cooldownTicks: 3, playerDamage: 10 });
    // cast 5-10 clamps to 1. commit does not run the clock; tick() resolves the impact.
    tickPast(eng, () => persisted(eng).queue.some(r => r.label === 'RH' && r.event === 'cooldown' && r.tics === 1));
    const cdRow = persisted(eng).queue.find(r => r.label === 'RH' && r.event === 'cooldown');
    assert.ok(cdRow && cdRow.tics === 1);
    assert.ok(persisted(eng).feed.some(l => /RH (?:attack )?hits .+ for 10/.test(l)), 'hit for base damage 10');
  });

  it('accuracy buff: row.accuracy set to 100 + value', () => {
    const eng = createEngine(seededRNG(103));
    const p = makeParticipants({ effect_type: 'accuracy', rolled_floor: 15, rolled_speed: 2, duration_ticks: 5, template_name: 'Acc' });
    eng.startBattle(keepOtherHandBack(p, 3));
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    tickUntil(eng, s => s.feed.some(l => l.includes('accuracy +15')));
    readyHand(eng, 'RH');
    eng.commitAttack('RH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 10 });
    const attackRow = persisted(eng).queue.find(r => r.label === 'RH' && r.event === 'winding');
    assert.equal(attackRow.accuracy, 100 + 15);
  });

  it('duration tracking / remaining decrement', () => {
    const eng = createEngine(seededRNG(104));
    const p = makeParticipants({ effect_type: 'damage', rolled_floor: 5, rolled_speed: 2, duration_ticks: 20, template_name: 'Dmg' });
    eng.startBattle(p);
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    const s = stepUntil(eng, st => st.feed.some(l => l.includes('damage +5')));
    const initialRemaining = s.buffs[0].endTic - s.tic;
    assert.ok(initialRemaining > 0);
    // A ready head pauses tick(). Park it, then one tick removes the real head.
    while (persisted(eng).queue[0] && persisted(eng).queue[0].event === 'ready') {
      readyHand(eng, persisted(eng).queue[0].label === 'LH' ? 'RH' : 'LH');
    }
    const ticBefore = persisted(eng).tic;
    const idsBefore = persisted(eng).queue.map(r => r.id);
    const headId = persisted(eng).queue[0].id;
    eng.tick();
    const after = eng.getState();
    const idsAfter = persisted(eng).queue.map(r => r.id);
    const survivorIds = idsBefore.filter(id => id !== headId);
    assert.deepEqual(idsAfter.filter(id => survivorIds.includes(id)), survivorIds, 'existing rows keep relative order');
    const tics = persisted(eng).queue.map(r => r.tics ?? 0);
    for (let i = 1; i < tics.length; i++) {
      assert.ok(tics[i] >= tics[i - 1], 'array stays ordered by the ordering key');
    }
    assert.ok(after.buffs[0], 'buff survives one step');
    assert.equal(after.buffs[0].endTic - after.tic, initialRemaining - (after.tic - ticBefore));
  });

  it('expiry at the correct tick and removes modifier', () => {
    const eng = createEngine(seededRNG(105));
    const p = makeParticipants({ effect_type: 'damage', rolled_floor: 8, rolled_speed: 2, duration_ticks: 3, template_name: 'Dmg' });
    eng.startBattle(keepOtherHandBack(p, 40));
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    const s = tickPast(eng, st => st.feed.some(l => l.includes('Dmg buff expired')));
    const expireLine = s.feed.find(l => l.includes('Dmg buff expired'));
    assert.ok(expireLine);
    assert.ok(expireLine.includes(`tic ${s.tic}`));
    assert.equal(s.buffs.length, 0);
    readyHand(eng, 'RH');
    eng.commitAttack('RH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 10 });
    const windingRow = persisted(eng).queue.find(r => r.label === 'RH' && r.event === 'winding');
    assert.equal(windingRow.damage, 10);
  });

  it('stacking identical: two damage buffs add values, separate endTics', () => {
    const eng = createEngine(seededRNG(106));
    const dmgA = { effect_type: 'damage', rolled_floor: 5, rolled_speed: 2, duration_ticks: 40, template_name: 'DmgA' };
    const dmgB = { effect_type: 'damage', rolled_floor: 7, rolled_speed: 2, duration_ticks: 50, template_name: 'DmgB' };
    const p = makeParticipants(dmgA, dmgB);
    eng.startBattle(p);
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    readyHand(eng, 'RH');
    eng.commitPotion('B', { weaponSpeed: 0 });
    const s = stepUntil(eng, st => st.buffs.length >= 2);
    assert.equal(s.buffs.length, 2);
    const ends = [...s.buffs.map(b => b.endTic)].sort((a, b) => a - b);
    assert.ok(ends[0] !== ends[1]);
    assert.equal(applyBuffs(s.buffs, s.tic, 'damage'), 12);
    writeState(eng, snap => { snap.player.hands.RH.state = 'Ready'; });
    eng.commitAttack('RH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 10 });
    const attackRow = persisted(eng).queue.find(r => r.label === 'RH' && r.event === 'winding');
    assert.equal(attackRow.damage, 10 + 5 + 7);
  });

  it('stacking different: speed + damage both apply to same attack', () => {
    const eng = createEngine(seededRNG(107));
    const spd = { effect_type: 'speed', rolled_floor: 2, rolled_speed: 2, duration_ticks: 40, template_name: 'Spd' };
    const dmg = { effect_type: 'damage', rolled_floor: 6, rolled_speed: 2, duration_ticks: 40, template_name: 'Dmg' };
    const p = makeParticipants(spd, dmg);
    eng.startBattle(p);
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    readyHand(eng, 'RH');
    eng.commitPotion('B', { weaponSpeed: 0 });
    const s = stepUntil(eng, st => st.buffs.some(b => b.type === 'speed') && st.buffs.some(b => b.type === 'damage'));
    assert.equal(applyBuffs(s.buffs, s.tic, 'speed'), 2);
    assert.equal(applyBuffs(s.buffs, s.tic, 'damage'), 6);
    writeState(eng, snap => { snap.player.hands.RH.state = 'Ready'; });
    eng.commitAttack('RH', 1, [1], { castTicks: 4, cooldownTicks: 3, playerDamage: 10 });
    const attackRow = persisted(eng).queue.find(r => r.label === 'RH' && r.event === 'winding');
    assert.equal(attackRow.damage, 10 + 6);
    assert.equal(attackRow.tics, 2);
    assert.equal(attackRow.cooldownTicks, 1);
  });

  it('expiry of one stacked buff does not kill the other', () => {
    const eng = createEngine(seededRNG(108));
    const short = { effect_type: 'damage', rolled_floor: 4, rolled_speed: 2, duration_ticks: 8, template_name: 'Short' };
    const long = { effect_type: 'damage', rolled_floor: 9, rolled_speed: 2, duration_ticks: 40, template_name: 'Long' };
    const p = makeParticipants(short, long);
    eng.startBattle(p);
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 0 });
    // RH approach is now the head. One tick surfaces it; commit B before either drink resolves.
    tickUntilInput(eng);
    eng.commitPotion('B', { weaponSpeed: 0 });
    let s = stepUntil(eng, st => st.feed.some(l => l.includes('damage +9')));
    s = stepUntil(eng, st => st.feed.some(l => l.includes('Short buff expired')), 40);
    assert.equal(s.buffs.length, 1);
    assert.equal(s.buffs[0].name, 'Long');
    assert.ok(s.buffs[0].endTic > s.tic);
  });

  it('attack before buff lands gets no buff (pre>0 case)', () => {
    const eng = createEngine(seededRNG(109));
    const p = makeParticipants({ effect_type: 'damage', rolled_floor: 8, rolled_speed: 6, duration_ticks: 5, template_name: 'Dmg' });
    eng.startBattle(p);
    readyHand(eng, 'LH');
    eng.commitPotion('A', { weaponSpeed: 4 });
    readyHand(eng, 'RH');
    eng.commitAttack('RH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 10 });
    stepUntil(eng, s => s.feed.some(l => /RH (?:attack )?hits .+ for 10/.test(l)));
    const hitLine = persisted(eng).feed.find(l => /RH (?:attack )?hits .+ for 10/.test(l));
    assert.ok(hitLine, 'expected base damage hit (no buff)');
    assert.equal(persisted(eng).monsters[0].current_hp, 90, 'monster took exactly base 10 (no buff)');
  });
});
