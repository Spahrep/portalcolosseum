import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAttack } from '../js/combat/damage.js';
import createEngine from '../js/combat/engine.js';

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeParticipants(consumeA = null) {
  return {
    loadout: {
      hand_l: 1,
      hand_r: 2,
      consume_a: consumeA,
      consume_b: null
    },
    monsters: [{ id: 1, max_hp: 100, damage: 10, speed: 5, accuracy: 70, label: 'A' }]
  };
}

describe('PC-72: resolveAttack crit rolls (damage.js)', () => {
  it('hit lands + crit roll succeeds → damage = round(base × multiplier), result.crit true', () => {
    const target = { label: 'A', current_hp: 100, type: 'monster' };
    const rng = () => 0.001; // hit check passes, crit roll passes (0.1 < 100)
    const results = resolveAttack(
      { damage: 10, damage_range: 0, accuracy: 100, critChance: 100, critMultiplier: 2.0 },
      [target], { is_multi_target: false }, rng
    );
    assert.equal(results[0].hit, true);
    assert.equal(results[0].crit, true);
    assert.equal(results[0].damage, 20);
    assert.equal(target.current_hp, 80);
  });

  it('miss → no crit ever (crit roll unreachable)', () => {
    const target = { label: 'A', current_hp: 100, type: 'monster' };
    const rng = () => 0.9; // accuracy 1 → 90 >= 1 → miss
    const results = resolveAttack(
      { damage: 10, damage_range: 0, accuracy: 1, critChance: 100, critMultiplier: 2.0 },
      [target], { is_multi_target: false }, rng
    );
    assert.equal(results[0].hit, false);
    assert.equal(results[0].crit, undefined);
    assert.equal(results[0].damage, 0);
    assert.equal(target.current_hp, 100);
  });

  it('multi-target: each target rolls its own crit (can differ within one attack)', () => {
    const targets = [
      { label: 'A', current_hp: 100, type: 'monster' },
      { label: 'B', current_hp: 100, type: 'monster' }
    ];
    // rng draws: [hit check, A crit roll, B crit roll] — A crits (0.1 < 50), B does not (99 < 50 false)
    const draws = [0.001, 0.001, 0.99];
    const rng = () => draws.shift();
    const results = resolveAttack(
      { damage: 10, damage_range: 0, accuracy: 100, critChance: 50, critMultiplier: 2.0 },
      targets, { is_multi_target: false }, rng
    );
    assert.equal(results[0].crit, true);
    assert.equal(results[0].damage, 20);
    assert.equal(results[1].crit, undefined);
    assert.equal(results[1].damage, 10);
    assert.equal(targets[0].current_hp, 80);
    assert.equal(targets[1].current_hp, 90);
  });

  it('crit chance 0 × any factor → never crits (0% floor is a data value, not a clamp)', () => {
    const target = { label: 'A', current_hp: 100, type: 'monster' };
    const rng = () => 0.001; // would crit if chance > 0
    const results = resolveAttack(
      { damage: 10, damage_range: 0, accuracy: 100, critChance: 0, critMultiplier: 2.0 },
      [target], { is_multi_target: false }, rng
    );
    assert.equal(results[0].hit, true);
    assert.equal(results[0].crit, undefined);
    assert.equal(results[0].damage, 10);
    assert.equal(target.current_hp, 90);
  });

  it('critChance 0 consumes no RNG (stream stability for legacy states)', () => {
    let draws = 0;
    const rng = () => { draws += 1; return 0.5; };
    resolveAttack(
      { damage: 10, damage_range: 3, accuracy: 100, critChance: 0, critMultiplier: 2.0 },
      [{ label: 'A', current_hp: 100, type: 'monster' }], { is_multi_target: false }, rng
    );
    // exactly two draws (damage roll + hit check); no crit draw
    assert.equal(draws, 2);
  });

  it('critChance > 0 consumes RNG per target (one draw per target)', () => {
    let draws = 0;
    const rng = () => { draws += 1; return 0.5; };
    resolveAttack(
      { damage: 10, damage_range: 0, accuracy: 100, critChance: 50, critMultiplier: 2.0 },
      [
        { label: 'A', current_hp: 100, type: 'monster' },
        { label: 'B', current_hp: 100, type: 'monster' }
      ], { is_multi_target: false }, rng
    );
    // hit check + one crit draw per target
    assert.equal(draws, 3);
  });
});

describe('PC-72: player attack crit through the engine (feed marker)', () => {
  it('player crit: damage doubled and feed line carries exactly " CRITICAL!"', () => {
    const eng = createEngine(() => 0.001); // hit + crit both pass
    eng.startBattle(makeParticipants());
    const hpBefore = eng.state.monsters[0].current_hp;
    eng.commitAttack('LH', 1, [1], {
      castTicks: 1, cooldownTicks: 1, playerDamage: 10,
      playerAccuracy: 100, playerCritChance: 100, playerCritMultiplier: 2.0
    });
    for (let i = 0; i < 5; i++) eng.advanceToNextDecision();
    assert.equal(hpBefore - eng.state.monsters[0].current_hp, 20, 'crit damage = 2×10');
    const critLine = eng.state.feed.find(l => l.includes(' CRITICAL!'));
    assert.ok(critLine, 'feed carries a CRITICAL! line');
    assert.match(critLine, /hits A for 20 CRITICAL!$/);
    assert.ok(!/CRITICAL!{2,}/.test(eng.state.feed.join(' ')), 'no doubled marker');
  });

  it('player crit 0 → no CRITICAL! marker even with crit-favorable RNG', () => {
    const eng = createEngine(() => 0.001);
    eng.startBattle(makeParticipants());
    eng.commitAttack('LH', 1, [1], {
      castTicks: 1, cooldownTicks: 1, playerDamage: 10,
      playerAccuracy: 100, playerCritChance: 0, playerCritMultiplier: 2.0
    });
    for (let i = 0; i < 5; i++) eng.advanceToNextDecision();
    assert.equal(eng.state.monsters[0].current_hp, 90, 'normal 10 damage, no crit');
    assert.ok(!eng.state.feed.some(l => l.includes(' CRITICAL!')), 'no crit marker');
  });
});

describe('PC-72: monster attack crit (feed marker + multiplier)', () => {
  it('monster crit: damage × attack crit_multiplier and " CRITICAL!" on the monster line', () => {
    const eng = createEngine(() => 0.5); // hit passes (50 < 100), crit passes (50 < 200)
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2 },
      monsters: [{
        id: 1, max_hp: 100, damage: 10, speed: 5, accuracy: 100, label: 'A',
        crit_chance: 100,
        attacks: [{ id: 9, name: 'slam', crit_factor: 2, crit_multiplier: 2.5 }]
      }]
    });
    let critLine = null;
    for (let i = 0; i < 40 && !critLine; i++) {
      eng.advanceToNextDecision();
      critLine = eng.state.feed.find(l => l.includes(' CRITICAL!'));
    }
    assert.ok(critLine, 'monster crit line present');
    // damage 10 (rng 0.5 → ±3 roll lands 0) × 2.5 = 25
    assert.match(critLine, /A slam hits player for 25 CRITICAL!$/);
  });

  it('monster crit_chance 0 → never crits, no CRITICAL! from monster', () => {
    const eng = createEngine(() => 0.001);
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2 },
      monsters: [{
        id: 1, max_hp: 100, damage: 10, speed: 5, accuracy: 100, label: 'A',
        crit_chance: 0,
        attacks: [{ id: 9, name: 'slam', crit_factor: 2, crit_multiplier: 2.5 }]
      }]
    });
    for (let i = 0; i < 30; i++) eng.advanceToNextDecision();
    assert.ok(!eng.state.feed.some(l => l.includes(' CRITICAL!')), 'no crit marker');
  });
});

describe('PC-72: potion crit (effect ×1.5, duration ×1.5)', () => {
  it('heal potion crit: amount × critEffectMultiplier (1.5), no duration field', () => {
    const eng = createEngine(() => 0.001); // crit roll passes
    eng.startBattle(makeParticipants({
      effect_type: 'heal', rolled_floor: 100, rolled_speed: 2, template_name: 'Heal',
      crit_chance: 100, critEffectMultiplier: 1.5, critDurationMultiplier: 1.5
    }));
    eng.state.player.hp = 800;
    eng.commitPotion('A', { phase: 'between-fights' });
    // round(100 × 1.5) = 150
    assert.equal(eng.state.player.hp, 950);
    assert.ok(eng.state.feed.some(l => l.includes('healed 150 CRITICAL!')), 'heal crit line');
  });

  it('buff potion crit: value ×1.5 AND duration_ticks ×1.5 (rounded)', () => {
    const eng = createEngine(() => 0.001);
    eng.startBattle(makeParticipants({
      effect_type: 'damage', rolled_floor: 10, rolled_speed: 2, duration_ticks: 4, template_name: 'Powder',
      crit_chance: 100, critEffectMultiplier: 1.5, critDurationMultiplier: 1.5
    }));
    eng.commitPotion('A', { phase: 'between-fights' });
    // value = round(10 × 1.5) = 15; duration = round(4 × 1.5) = 6 → endTic = tic + 6
    const tic = eng.state.tic;
    const buff = eng.state.buffs[0];
    assert.equal(buff.value, 15);
    assert.equal(buff.endTic, tic + 6);
    assert.ok(eng.state.feed.some(l => l.includes(`damage +15 until tic ${tic + 6} CRITICAL!`)), 'buff crit line');
  });

  it('legacy potion (no crit_chance) → exact base effect, no CRITICAL!, no extra RNG', () => {
    let draws = 0;
    const eng = createEngine(() => { draws += 1; return 0.001; });
    eng.startBattle(makeParticipants({
      effect_type: 'heal', rolled_floor: 100, rolled_speed: 2, template_name: 'Heal'
      // no crit_chance, no multipliers — legacy shape
    }));
    eng.state.player.hp = 800;
    eng.commitPotion('A', { phase: 'between-fights' });
    assert.equal(eng.state.player.hp, 900, 'exact base heal');
    assert.ok(!eng.state.feed.some(l => l.includes('CRITICAL!')), 'no crit marker');
    assert.equal(draws, 0, 'no RNG consumed at all when crit_chance is absent');
  });

  it('potion crit rolled only when crit_chance > 0 (0% is a data value, not a clamp)', () => {
    let draws = 0;
    const eng = createEngine(() => { draws += 1; return 0.001; });
    eng.startBattle(makeParticipants({
      effect_type: 'heal', rolled_floor: 100, rolled_speed: 2, template_name: 'Heal',
      crit_chance: 0, critEffectMultiplier: 1.5, critDurationMultiplier: 1.5
    }));
    eng.state.player.hp = 800;
    eng.commitPotion('A', { phase: 'between-fights' });
    assert.equal(eng.state.player.hp, 900, 'crit 0 → exact base heal');
    assert.equal(draws, 0, 'no crit roll consumed at 0%');
  });

  it('in-battle drinking path also crits (drinking branch uses applyPotionWithCrit)', () => {
    const eng = createEngine(() => 0.001);
    eng.startBattle({
      loadout: { hand_l: 1, hand_r: 2, consume_a: {
        effect_type: 'heal', rolled_floor: 100, rolled_speed: 2, template_name: 'Heal',
        crit_chance: 100, critEffectMultiplier: 1.5, critDurationMultiplier: 1.5
      } },
      // accuracy 0 → monster always misses; player HP only changes via potion
      monsters: [{ id: 1, max_hp: 100, damage: 10, speed: 5, accuracy: 0, label: 'A' }]
    });
    eng.state.player.hp = 800;
    eng.commitPotion('A', { weaponSpeed: 0 });
    for (let i = 0; i < 8; i++) eng.advanceToNextDecision();
    assert.equal(eng.state.player.hp, 950, 'in-battle heal crit applies ×1.5');
    assert.ok(eng.state.feed.some(l => l.includes('healed 150 CRITICAL!')), 'drinking crit line');
  });
});
