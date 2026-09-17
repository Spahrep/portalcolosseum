import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createEngine, { resumeEngine } from '../js/combat/engine.js';
import {
  mapPotionFeedLine,
  formatPotionSummary,
  formatBuffs,
  formatConsumableSummary,
  classifyPotionError
} from '../scripts/cli/potion-format.mjs';
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
  let s = eng.getState();
  let steps = 0;
  while (steps < maxSteps && s.potions && !(s.potions.A?.used || s.potions.B?.used)) {
    s = eng.advanceToNextDecision();
    steps++;
  }
  return s;
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
    eng.state.player.hands.LH.state = 'winding';
    eng.state.player.hands.RH.state = 'winding';
    assert.throws(() => eng.commitPotion('A'), /No free hand/);
    const err = classifyPotionError('No free hand');
    assert.equal(err.level, 'amber');
    assert.equal(err.text, 'No free hand — both hands are busy. Type "wait" to advance until one is ready.');
  });

  it('heal in-battle parity: delta matches narration, snapshot exact', () => {
    const eng = createEngine(seededRNG(100));
    const p = makeParticipants({ ...healPotion });
    eng.startBattle(p);
    eng.state.player.hp = 800;
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
    eng.state.player.hp = 800;
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
    eng.state.player.hp = 990;
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
    eng.startBattle(p);
    eng.commitPotion('A', { weaponSpeed: 4 });
    const state = advanceUntilUsed(eng);
    assert.equal(state.buffs.length, 1);
    assert.equal(state.buffs[0].endTic, 10);
    assert.equal(formatBuffs(state.buffs), 'damage +3 until tic 10');
    const meta = { slot: 'A', phase: 'in-battle', potion_used: true, player_hp: state.participants.player.hp, state };
    const consumables = [{ ...buffPotion, used: true }];
    const transcript = buildTranscript(state, meta, consumables);
    assert.deepEqual(transcript, buffLandSnapshot);
  });

  it('reload persistence parity: resumeEngine keeps used, second use errors, classify exact', () => {
    const eng = createEngine(seededRNG(104));
    const p = makeParticipants({ ...healPotion });
    eng.startBattle(p);
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
    // pre = ceil((0+2)/2) = 1 -> lands at tic 1 with endTic 1 + 2 = 3
    const landed = eng.commitPotion('A', { weaponSpeed: 0 });
    assert.equal(landed.buffs.length, 1);
    assert.equal(landed.buffs[0].endTic, 3);
    assert.equal(formatBuffs(landed.buffs), 'damage +3 until tic 3');
    // advance until the expiry feed line appears
    let s = landed;
    let expired = false;
    for (let i = 0; i < 20 && !expired; i++) {
      s = eng.advanceToNextDecision();
      expired = s.feed.some(l => l.includes('buff expired'));
    }
    assert.ok(expired, 'expiry feed line not found');
    assertParity(s, null, null, true, 'none');
    const meta = { slot: 'A', phase: 'in-battle', hand: 'LH', potion_used: true, player_hp: s.participants.player.hp, state: s };
    const transcript = buildTranscript(s, meta, []);
    assert.deepEqual(transcript, buffExpirySnapshot);
  });
});
