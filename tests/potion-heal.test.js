import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createEngine from '../js/combat/engine.js';
import { applyPotionEffect } from '../js/combat/potion-effects.js';

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

function healPotion(amount) {
  return { effect_type: 'heal', rolled_floor: amount, rolled_speed: 2, template_name: 'Heal' };
}

describe('Heal effects (PC-39)', () => {
  it('direct: partial restore — 800 + 100 = 900, healed delta 100', () => {
    const state = { player: { hp: 800 }, buffs: [] };
    const result = applyPotionEffect(state, { type: 'heal', amount: 100, name: 'Heal' }, 0);
    assert.equal(state.player.hp, 900);
    assert.deepEqual(result, { kind: 'heal', healed: 100 });
  });

  it('direct: full restore — 900 + 100 = exactly PLAYER_MAX_HP (1000)', () => {
    const state = { player: { hp: 900 }, buffs: [] };
    const result = applyPotionEffect(state, { type: 'heal', amount: 100, name: 'Heal' }, 0);
    assert.equal(state.player.hp, 1000);
    assert.equal(result.healed, 100);
  });

  it('direct: overheal cap — 990 + 50 = 1000 (never above), healed delta is 10 not 50', () => {
    const state = { player: { hp: 990 }, buffs: [] };
    const result = applyPotionEffect(state, { type: 'heal', amount: 50, name: 'Heal' }, 0);
    assert.equal(state.player.hp, 1000);
    assert.equal(result.healed, 10);
  });

  it('direct: zero-HP edge — 0 + 100 = 100 (no NaN, no negative)', () => {
    const state = { player: { hp: 0 }, buffs: [] };
    const result = applyPotionEffect(state, { type: 'heal', amount: 100, name: 'Heal' }, 0);
    assert.equal(state.player.hp, 100);
    assert.equal(result.healed, 100);
  });

  it('direct: heal at full HP — stays 1000, healed delta 0', () => {
    const state = { player: { hp: 1000 }, buffs: [] };
    const result = applyPotionEffect(state, { type: 'heal', amount: 50, name: 'Heal' }, 0);
    assert.equal(state.player.hp, 1000);
    assert.equal(result.healed, 0);
  });

  it('direct: cap follows config-driven max_hp (e.g. game_config.starting_hp)', () => {
    const state = { player: { hp: 1400, max_hp: 1500 }, buffs: [] };
    const result = applyPotionEffect(state, { type: 'heal', amount: 200, name: 'Heal' }, 0);
    assert.equal(state.player.hp, 1500);
    assert.equal(result.healed, 100);
  });

  it('direct: missing rolled_floor throws Heal potion missing rolled_floor', () => {
    const state = { player: { hp: 500 }, buffs: [] };
    assert.throws(() => applyPotionEffect(state, { type: 'heal', amount: undefined, name: 'Heal' }, 0), /Heal potion missing rolled_floor/);
  });

  it('direct: zero/negative rolled_floor throws Heal potion missing rolled_floor', () => {
    const state = { player: { hp: 500 }, buffs: [] };
    assert.throws(() => applyPotionEffect(state, { type: 'heal', amount: 0, name: 'Heal' }, 0), /Heal potion missing rolled_floor/);
    assert.throws(() => applyPotionEffect(state, { type: 'heal', amount: -5, name: 'Heal' }, 0), /Heal potion missing rolled_floor/);
  });

  it('engine between-fights: full restore applies instantly, slot used, feed reports healed 100', () => {
    const eng = createEngine(seededRNG(201));
    eng.startBattle(makeParticipants(healPotion(100)));
    eng.state.player.hp = 900;
    const res = eng.commitPotion('A', { phase: 'between-fights' });
    assert.equal(eng.state.player.hp, 1000);
    assert.equal(res.potions.A.used, true);
    assert.ok(res.feed.some(l => l.includes('healed 100')));
  });

  it('engine in-battle: overheal reports actual healed (10) in feed, hp capped at 1000', () => {
    const eng = createEngine(seededRNG(202));
    eng.startBattle(makeParticipants(healPotion(50)));
    eng.state.player.hp = 990;
    eng.commitPotion('A', { weaponSpeed: 0 }); // pre = ceil((0+2)/2) = 1
    const s = eng.advanceToNextDecision(); // effect lands here
    assert.equal(eng.state.player.hp, 1000);
    const healLine = s.feed.find(l => l.includes('healed'));
    assert.ok(healLine, 'heal feed line not found');
    assert.ok(healLine.includes('healed 10'), `feed reported wrong delta: ${healLine}`);
    assert.ok(!healLine.includes('healed 50'));
  });

  it('engine in-battle: zero-HP edge — heals from 0 without NaN', () => {
    const eng = createEngine(seededRNG(203));
    eng.startBattle(makeParticipants(healPotion(100)));
    eng.state.player.hp = 0;
    eng.commitPotion('A', { weaponSpeed: 0 });
    const s = eng.advanceToNextDecision();
    assert.equal(eng.state.player.hp, 100);
    assert.ok(Number.isFinite(eng.state.player.hp));
    assert.ok(s.feed.some(l => l.includes('healed 100')));
  });
});
