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
    eng.commitPotion('A', { weaponSpeed: 3 });
    eng.advanceToNextDecision();
    // potion used on the free hand (RH)
    assert.equal(eng.state.potions.A.used, true);
  });

  it('both Ready picks LH deterministically', () => {
    const eng = createEngine(seededRNG(3));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    eng.commitPotion('A', { weaponSpeed: 3 });
    eng.advanceToNextDecision();
    assert.ok(eng.state.queue.some(r => r.label === 'LH' && r.event === 'recovery') || eng.state.feed.some(l => l.includes('drinking')));
  });

  it('params.hand honored', () => {
    const eng = createEngine(seededRNG(4));
    eng.startBattle(makeParticipants({ effect_type: 'heal', rolled_floor: 20, rolled_speed: 2, template_name: 'Heal' }));
    eng.commitPotion('A', { hand: 'RH', weaponSpeed: 3 });
    eng.advanceToNextDecision();
    assert.ok(eng.state.queue.some(r => r.label === 'RH' && r.event === 'recovery') || eng.state.feed.some(l => l.includes('drinking')));
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
    eng.commitAttack('RH', 99, [1], { castTicks: 1, cooldownTicks: 1, playerDamage: 10 });
    eng.advanceToNextDecision();
    assert.ok(!eng.state.feed.some(f => f.includes('Hand not ready')));
  });

  it('between-fights phase: instant apply, no queue rows, used set', () => {
    const eng = createEngine(seededRNG(14));
    const parts = makeParticipants({ effect_type: 'heal', rolled_floor: 50, rolled_speed: 2, template_name: 'Heal' });
    eng.startBattle(parts);
    eng.state.player.hp = 900;
    eng.state.monsters[0].current_hp = 0;
    const beforeHp = eng.state.player.hp;
    eng.commitPotion('A', { phase: 'between-fights' });
    assert.equal(eng.state.potions.A.used, true);
    assert.ok(eng.state.participants.player.hp > beforeHp);
    assert.ok(!eng.state.queue.some(r => r.event === 'drinking')); // no hand locked for potion in between-fights
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

describe('Buff potion effects and duration (PC-39)', () => {
  it('damage buff: in-battle damage potion adds to committed attack damage', () => {
    const eng = createEngine(seededRNG(100));
    const p = makeParticipants({ effect_type: 'damage', rolled_floor: 8, rolled_speed: 2, duration_ticks: 5, template_name: 'Dmg' });
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 0 });
    let s;
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('damage +8'))) break;
    }
    eng.commitAttack('RH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 10 });
    const attackRow = eng.state.queue.find(r => r.label === 'RH' && r.event === 'winding');
    assert.equal(attackRow.damage, 10 + 8);
  });

  it('speed buff: reduces cast and cooldown to min 1', () => {
    const eng = createEngine(seededRNG(101));
    const p = makeParticipants({ effect_type: 'speed', rolled_floor: 2, rolled_speed: 2, duration_ticks: 5, template_name: 'Spd' });
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 0 });
    let s;
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('speed +2'))) break;
    }
    for (let i = 0; i < 20; i++) {
      if (eng.state.player.hands.RH.state === 'Ready') break;
      eng.advanceToNextDecision();
    }
    eng.commitAttack('RH', 1, [1], { castTicks: 5, cooldownTicks: 3, playerDamage: 10 });
    eng.advanceToNextDecision();
    const attackRow = eng.state.queue.find(r => r.label === 'RH' && typeof r.tics === 'number');
    assert.equal(attackRow.tics, 1);
    assert.equal(attackRow.cooldownTicks, 1);
  });

  it('speed buff min-1: never goes to 0 or negative', () => {
    const eng = createEngine(seededRNG(102));
    const p = makeParticipants({ effect_type: 'speed', rolled_floor: 10, rolled_speed: 2, duration_ticks: 5, template_name: 'Spd' });
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 0 });
    let s;
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('speed +10'))) break;
    }
    eng.commitAttack('RH', 1, [1], { castTicks: 5, cooldownTicks: 3, playerDamage: 10 });
    // cast 5-10 -> clamped to 1, so the attack fires inside commitAttack's own advance and the
    // impact row (tics 0) resolves on the NEXT advance — the hit is not yet in feed.
    // Advance bounded until RH reaches cooldown: cooldown 3-10 -> clamped to 1 (tics===1 proves
    // the min-1 clamp; a 0/negative clamp could not produce a cooldown row with tics 1).
    for (let i = 0; i < 10; i++) {
      if (eng.state.queue.some(r => r.label === 'RH' && r.event === 'cooldown' && r.tics === 1)) break;
      eng.advanceToNextDecision();
    }
    const cdRow = eng.state.queue.find(r => r.label === 'RH' && r.event === 'cooldown');
    assert.ok(cdRow && cdRow.tics === 1);
    assert.ok(eng.state.feed.some(l => /RH (?:attack )?hits .+ for 10/.test(l)), 'hit for base damage 10');
  });

  it('accuracy buff: row.accuracy set to 100 + value', () => {
    const eng = createEngine(seededRNG(103));
    const p = makeParticipants({ effect_type: 'accuracy', rolled_floor: 15, rolled_speed: 2, duration_ticks: 5, template_name: 'Acc' });
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 0 });
    let s;
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('accuracy +15'))) break;
    }
    eng.commitAttack('RH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 10 });
    const attackRow = eng.state.queue.find(r => r.label === 'RH' && r.event === 'winding');
    assert.equal(attackRow.accuracy, 100 + 15);
  });

  it('duration tracking / remaining decrement', () => {
    const eng = createEngine(seededRNG(104));
    const p = makeParticipants({ effect_type: 'damage', rolled_floor: 5, rolled_speed: 2, duration_ticks: 4, template_name: 'Dmg' });
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 0 });
    let s;
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('damage +5'))) break;
    }
    const initialRemaining = s.buffs[0].endTic - s.tic;
    assert.ok(initialRemaining > 0);
    s = eng.advanceToNextDecision();
    const nextRemaining = s.buffs[0].endTic - s.tic;
    assert.equal(nextRemaining, initialRemaining - 2);
  });

  it('expiry at the correct tick and removes modifier', () => {
    const eng = createEngine(seededRNG(105));
    const p = makeParticipants({ effect_type: 'damage', rolled_floor: 8, rolled_speed: 2, duration_ticks: 3, template_name: 'Dmg' });
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 0 });
    let s;
    for (let i = 0; i < 20; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('Dmg buff expired'))) break;
    }
    const expireLine = s.feed.find(l => l.includes('Dmg buff expired'));
    assert.ok(expireLine);
    assert.ok(expireLine.includes(`tic ${s.tic}`));
    assert.equal(s.buffs.length, 0);
    eng.commitAttack('RH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 10 });
    const attackRow = eng.state.queue.find(r => r.label === 'RH' && r.event === 'impact');
    assert.equal(attackRow.damage, 10);
  });

  it('stacking identical: two damage buffs add values, separate endTics', () => {
    const eng = createEngine(seededRNG(106));
    const dmgA = { effect_type: 'damage', rolled_floor: 5, rolled_speed: 2, duration_ticks: 5, template_name: 'DmgA' };
    const dmgB = { effect_type: 'damage', rolled_floor: 7, rolled_speed: 2, duration_ticks: 6, template_name: 'DmgB' };
    const p = makeParticipants(dmgA, dmgB);
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 0 });
    let s;
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('damage +5'))) break;
    }
    eng.commitPotion('B', { weaponSpeed: 0 });
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('damage +7'))) break;
    }
    assert.equal(s.buffs.length, 2);
    eng.commitAttack('RH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 10 });
    const attackRow = eng.state.queue.find(r => r.label === 'RH' && r.event === 'winding');
    assert.equal(attackRow.damage, 10 + 5 + 7);
    const ends = s.buffs.map(b => b.endTic).sort();
    assert.ok(ends[0] !== ends[1]);
  });

  it('stacking different: speed + damage both apply to same attack', () => {
    const eng = createEngine(seededRNG(107));
    const spd = { effect_type: 'speed', rolled_floor: 2, rolled_speed: 2, duration_ticks: 5, template_name: 'Spd' };
    const dmg = { effect_type: 'damage', rolled_floor: 6, rolled_speed: 2, duration_ticks: 5, template_name: 'Dmg' };
    const p = makeParticipants(spd, dmg);
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 0 });
    let s;
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('speed +2'))) break;
    }
    eng.commitPotion('B', { weaponSpeed: 0 });
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('damage +6'))) break;
    }
    // advance until hand ready per critical buff test order
    for (let i = 0; i < 20; i++) {
      if (eng.state.player.hands.RH.state === 'Ready') break;
      eng.advanceToNextDecision();
    }
    eng.commitAttack('RH', 1, [1], { castTicks: 4, cooldownTicks: 3, playerDamage: 10 });
    eng.advanceToNextDecision();
    const attackRow = eng.state.queue.find(r => r.label === 'RH' && r.event === 'winding');
    assert.equal(attackRow.damage, 10 + 6);
    assert.equal(attackRow.tics, 2);
    assert.equal(attackRow.cooldownTicks, 1);
  });

  it('expiry of one stacked buff does not kill the other', () => {
    const eng = createEngine(seededRNG(108));
    const short = { effect_type: 'damage', rolled_floor: 4, rolled_speed: 2, duration_ticks: 2, template_name: 'Short' };
    const long = { effect_type: 'damage', rolled_floor: 9, rolled_speed: 2, duration_ticks: 6, template_name: 'Long' };
    const p = makeParticipants(short, long);
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 0 });
    let s;
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('damage +4'))) break;
    }
    eng.commitPotion('B', { weaponSpeed: 0 });
    for (let i = 0; i < 10; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('damage +9'))) break;
    }
    for (let i = 0; i < 20; i++) {
      s = eng.advanceToNextDecision();
      if (s.feed.some(l => l.includes('Short buff expired'))) break;
    }
    assert.equal(s.buffs.length, 1);
    assert.equal(s.buffs[0].name, 'Long');
    assert.ok(s.buffs[0].endTic > s.tic);
  });

  it('attack before buff lands gets no buff (pre>0 case)', () => {
    const eng = createEngine(seededRNG(109));
    const p = makeParticipants({ effect_type: 'damage', rolled_floor: 8, rolled_speed: 6, duration_ticks: 5, template_name: 'Dmg' });
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 4 });
    eng.commitAttack('RH', 1, [1], { castTicks: 3, cooldownTicks: 2, playerDamage: 10 });
    eng.advanceToNextDecision();
    // pre>0 means buff lands after commit; damage frozen at base 10 (observable in feed, not winding row)
    const hitLine = eng.state.feed.find(l => /RH (?:attack )?hits .+ for 10/.test(l));
    assert.ok(hitLine, 'expected base damage hit (no buff)');
    assert.equal(eng.state.monsters[0].current_hp, 90, 'monster took exactly base 10 (no buff)');
  });
});
