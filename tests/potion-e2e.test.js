import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createEngine, { resumeEngine } from '../js/combat/engine.js';
import { buildPotionPayload } from '../js/combat/potion-effects.js';
import { persisted, writeState, tickUntilInput, tickPast } from './live-clock.js';
import {
  mapPotionFeedLine,
  formatPotionSummary,
  formatBuffs,
  formatConsumableSummary,
  classifyPotionError
} from '../js/combat/potion-format.mjs';
import {
  healPotion,
  buffPotion,
  inBattleHealSnapshot,
  betweenFightsHealSnapshot,
  overhealSnapshot,
  buffLandSnapshot,
  buffExpirySnapshot
} from './fixtures/potion-fixtures.js';

function seededRNG(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeParticipants(consumeA = null, consumeB = null) {
  return {
    loadout: { hand_l: 1, hand_r: 2, consume_a: consumeA, consume_b: consumeB },
    monsters: [{ id: 1, max_hp: 100, damage: 10, speed: 5, accuracy: 70, label: 'A' }]
  };
}

function advanceUntilUsed(eng, maxSteps = 20) {
  return tickPast(eng, s => s.potions && (s.potions.A?.used || s.potions.B?.used), maxSteps);
}

function buildTranscript(state, meta, consumables) {
  const lines = [];
  for (const raw of state.feed) {
    const m = mapPotionFeedLine(raw);
    if (m.matched) {
      lines.push(m.text);
    } else {
      lines.push(raw);
    }
  }
  if (meta) {
    lines.push(formatPotionSummary(state, meta));
  }
  for (const c of consumables) {
    const sum = formatConsumableSummary(c);
    if (sum) lines.push(sum);
  }
  return lines;
}

function assertParity(state, healedExpected, buffEndTicExpected, usedA, buffsText) {
  if (healedExpected != null) {
    const hp = state.participants.player.hp;
    assert.equal(hp, healedExpected);
  }
  if (buffEndTicExpected != null && state.buffs.length > 0) {
    assert.equal(state.buffs[0].endTic, buffEndTicExpected);
  }
  if (usedA != null) {
    assert.equal(state.potions.A.used, usedA);
  }
  if (buffsText != null) {
    assert.equal(formatBuffs(state.buffs), buffsText);
  }
}

describe('Potion E2E parity (PC-39)', () => {
  it('free-hand error parity: both busy -> classify amber exact', () => {
    const eng = createEngine(seededRNG(1));
    eng.startBattle(makeParticipants(healPotion));
    writeState(eng, snap => {
      snap.player.hands.LH.state = 'winding';
      snap.player.hands.RH.state = 'winding';
    });
    assert.throws(() => eng.commitPotion('A'), /No free hand/);
    const err = classifyPotionError('No free hand');
    assert.equal(err.level, 'amber');
    assert.equal(err.text, 'No free hand — both hands are busy. Type "wait" to advance until one is ready.');
  });

  it('heal in-battle parity: delta matches narration, snapshot exact', () => {
    const eng = createEngine(seededRNG(100));
    const p = makeParticipants({ ...healPotion });
    eng.startBattle(p);
    writeState(eng, snap => { snap.player.hp = 800; });
    tickUntilInput(eng);
    eng.commitPotion('A', { weaponSpeed: 0 });
    const state = advanceUntilUsed(eng);
    assertParity(state, 900, null, true, 'none');
    const meta = { slot: 'A', phase: 'in-battle', hand: 'LH', potion_used: true, player_hp: state.participants.player.hp, state };
    const consumables = [{ ...healPotion, used: true }, { ...buffPotion }];
    const transcript = buildTranscript(state, meta, consumables);
    assert.deepEqual(transcript, inBattleHealSnapshot);
  });

  it('heal between-fights parity: instant, no queue rows, snapshot exact', () => {
    const eng = createEngine(seededRNG(101));
    const p = makeParticipants({ ...healPotion });
    eng.startBattle(p);
    writeState(eng, snap => { snap.player.hp = 800; });
    tickUntilInput(eng);
    const state = eng.commitPotion('A', { phase: 'between-fights' });
    assertParity(state, 900, null, true, 'none');
    const meta = { slot: 'A', phase: 'between-fights', potion_used: true, player_hp: state.participants.player.hp, state };
    const consumables = [{ ...healPotion, used: true }];
    const transcript = buildTranscript(state, meta, consumables);
    assert.deepEqual(transcript, betweenFightsHealSnapshot);
  });

  it('overheal cap parity: delta 10 not 50, HP 1000/1000, snapshot', () => {
    const eng = createEngine(seededRNG(102));
    const p = makeParticipants({ ...healPotion, rolled_floor: 50 });
    eng.startBattle(p);
    writeState(eng, snap => { snap.player.hp = 990; });
    tickUntilInput(eng);
    eng.commitPotion('A', { weaponSpeed: 0 });
    const state = advanceUntilUsed(eng);
    assert.equal(state.participants.player.hp, 1000);
    const meta = { slot: 'A', phase: 'in-battle', potion_used: true, player_hp: 1000, state };
    const transcript = buildTranscript(state, meta, []);
    assert.deepEqual(transcript, overhealSnapshot);
  });

  it('buff duration/endTic parity: lands after pre, endTic correct, formatBuffs matches', () => {
    const eng = createEngine(seededRNG(103));
    const p = makeParticipants({ ...buffPotion });
    // Default multiplier is 1, so a speed-5 monster winds at tic 5 and would
    // hit during this potion's windup. Keep it behind the drink so the
    // snapshot stays about buff timing, not monster cadence.
    p.monsters[0].speed = 12;
    eng.startBattle(p);
    tickUntilInput(eng);
    eng.commitPotion('A', { weaponSpeed: 4 });
    const state = advanceUntilUsed(eng);
    assert.equal(state.buffs.length, 1);
    assert.equal(state.buffs[0].endTic, 11);
    assert.equal(formatBuffs(state.buffs), 'damage +3 until tic 11');
    const meta = { slot: 'A', phase: 'in-battle', potion_used: true, player_hp: state.participants.player.hp, state };
    const consumables = [{ ...buffPotion, used: true }];
    const transcript = buildTranscript(state, meta, consumables);
    assert.deepEqual(transcript, buffLandSnapshot);
  });

  it('reload persistence parity: resumeEngine keeps used, second use errors, classify exact', () => {
    const eng = createEngine(seededRNG(104));
    const p = makeParticipants({ ...healPotion });
    eng.startBattle(p);
    tickUntilInput(eng);
    eng.commitPotion('A', { phase: 'between-fights' });
    const persisted = eng.getState();
    const eng2 = resumeEngine(persisted, seededRNG(104));
    assert.throws(() => eng2.commitPotion('A'), /Potion already used/);
    const err = classifyPotionError('Potion already used');
    assert.equal(err.level, 'error');
    assert.equal(err.text, 'That potion is already used.');
  });

  it('empty slot classify error with period', () => {
    const eng = createEngine(seededRNG(105));
    eng.startBattle(makeParticipants(null, null));
    tickUntilInput(eng);
    assert.throws(() => eng.commitPotion('A'), /No potion in slot A/);
    const err = classifyPotionError('No potion in slot A');
    assert.equal(err.level, 'error');
    assert.equal(err.text, 'No potion in slot A.');
  });

  it('formatConsumableSummary parity: (used) only when flag set', () => {
    const unused = formatConsumableSummary(healPotion);
    assert.equal(unused.includes('(used)'), false);
    const used = formatConsumableSummary({ ...healPotion, used: true });
    assert.ok(used.endsWith('(used)'));
  });

  it('CLI error classify for hand not ready is amber', () => {
    const err = classifyPotionError('Hand not ready');
    assert.equal(err.level, 'amber');
    assert.equal(err.text, 'That hand is busy. Type "wait" to advance until it is ready.');
  });

  it('buff expiry parity: endTic then fades, buffs none, snapshot exact', () => {
    const eng = createEngine(seededRNG(106));
    const p = makeParticipants({ ...buffPotion, rolled_speed: 2, duration_ticks: 2 });
    eng.startBattle(p);
    // Drinking row is placed by its ordering key, ahead of the still-queued monster.
    // endTic is land tic + duration.
    tickUntilInput(eng);
    eng.commitPotion('A', { weaponSpeed: 0 });
    const landed = advanceUntilUsed(eng);
    assert.equal(landed.buffs.length, 1);
    assert.equal(landed.buffs[0].endTic, 4);
    assert.equal(formatBuffs(landed.buffs), 'damage +3 until tic 4');
    // advance until the expiry feed line appears
    let s = landed;
    let expired = false;
    for (let i = 0; i < 20 && !expired; i++) {
      s = tickPast(eng, st => st.feed.some(l => l.includes('buff expired')), 1);
      expired = s.feed.some(l => l.includes('buff expired'));
    }
    assert.ok(expired, 'expiry feed line not found');
    assertParity(s, null, null, true, 'none');
    const meta = { slot: 'A', phase: 'in-battle', hand: 'LH', potion_used: true, player_hp: s.participants.player.hp, state: s };
    const transcript = buildTranscript(s, meta, []);
    assert.deepEqual(transcript, buffExpirySnapshot);
  });
});

describe('PC-106: potion effect rolls within the window', () => {
  const FLOOR = 100;
  const WINDOW = 20;

  function constantRng(value) {
    return () => value;
  }

  it('payload: every offset in [0, window] is reachable; floor is the minimum', () => {
    const seen = new Set();
    for (let offset = 0; offset <= WINDOW; offset++) {
      const rng = constantRng((offset + 0.5) / (WINDOW + 1));
      const heal = buildPotionPayload({
        effect_type: 'heal', rolled_floor: FLOOR, rolled_window: WINDOW, template_name: 'Heal'
      }, 0, rng);
      const buff = buildPotionPayload({
        effect_type: 'speed', rolled_floor: FLOOR, rolled_window: WINDOW,
        duration_ticks: 4, template_name: 'Swift'
      }, 7, rng);
      assert.equal(heal.amount, FLOOR + offset);
      assert.equal(buff.value, FLOOR + offset);
      assert.ok(heal.amount >= FLOOR && heal.amount <= FLOOR + WINDOW);
      seen.add(heal.amount);
    }
    assert.equal(seen.size, WINDOW + 1);
  });

  it('payload: missing or zero window is the floor and consumes no RNG', () => {
    const boom = () => { throw new Error('rng consumed'); };
    const missing = buildPotionPayload({
      effect_type: 'heal', rolled_floor: FLOOR, template_name: 'Heal'
    }, 0, boom);
    const zero = buildPotionPayload({
      effect_type: 'heal', rolled_floor: FLOOR, rolled_window: 0, template_name: 'Heal'
    }, 0, boom);
    assert.equal(missing.amount, FLOOR);
    assert.equal(zero.amount, FLOOR);
  });

  it('engine: rolled_window flows through and heal stays in [floor, floor+window]', () => {
    const draws = [];
    const eng = createEngine(() => {
      draws.push(1);
      return 0.5;
    });
    eng.startBattle(makeParticipants({
      effect_type: 'heal', rolled_floor: FLOOR, rolled_window: WINDOW,
      rolled_speed: 2, template_name: 'Heal'
    }));
    assert.equal(persisted(eng).potions.A.rolled_window, WINDOW);
    writeState(eng, snap => { snap.player.hp = 100; });
    const before = draws.length;
    eng.commitPotion('A', { phase: 'between-fights' });
    const healed = persisted(eng).player.hp - 100;
    assert.ok(healed >= FLOOR && healed <= FLOOR + WINDOW, `healed ${healed} outside window`);
    // 0.5 * 21 = 10.5 → floor + 10
    assert.equal(healed, FLOOR + 10);
    assert.equal(draws.length - before, 1, 'window roll consumes exactly one draw when crit is absent');
  });

  it('engine: crit multiplies the rolled effect, not the floor', () => {
    let n = 0;
    const eng = createEngine(() => {
      n += 1;
      // first draw: window offset 20 (ceiling); second: crit passes
      return n === 1 ? 0.999 : 0.001;
    });
    eng.startBattle(makeParticipants({
      effect_type: 'heal', rolled_floor: FLOOR, rolled_window: WINDOW, rolled_speed: 2,
      template_name: 'Heal', crit_chance: 100, critEffectMultiplier: 1.5
    }));
    writeState(eng, snap => { snap.player.hp = 100; });
    eng.commitPotion('A', { phase: 'between-fights' });
    // round(120 * 1.5) = 180, not round(100 * 1.5) = 150
    assert.equal(persisted(eng).player.hp, 280);
    assert.ok(persisted(eng).feed.some(l => l.includes('healed 180 CRITICAL!')));
  });
});
