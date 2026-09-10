// js/combat/engine.js
// Pure ESM orchestrator. Commit-driven. Deterministic with injected RNG (seeded for tests).
// Resolves to next player decision point. Emits feed. Cancels in-flight on death (MVP).
// Parameterized commitAttack for API data-driven timing/damage/multi-target.
// F2: winding → impact morph implemented so attacks deal damage and hands return to Ready.
// F10: startBattle accepts optional initialPlayerHp for cross-battle HP carry.

import { createQueue, commitNewRow, tick, sortQueue, morphHandRow } from './tic-queue.js';
import { createPlayer, createMonster, isPlayerDead, isMonsterDead, applyDamage } from './participants.js';
import { getHpWord } from './hp-words.js';
import { rollDamage, checkHit, resolveAttack, multiTargetReduction } from './damage.js';

export function createEngine(rng = Math.random) {
  let state = {
    queue: createQueue(),
    player: null,
    monsters: [],
    feed: [],
    tic: 0,
    buffs: [],
    rng
  };

  function log(msg) {
    state.feed.push(`tic ${state.tic} — ${msg}`);
    if (state.feed.length > 10) state.feed.shift();
  }

  function handleFire(row) {
    if (row.label === 'LH' || row.label === 'RH') {
      if (row.event === 'winding') {
        // F2: morph winding (cast done) to impact (tics=0) so NEXT tick fires the impact branch for damage
        morphHandRow(state.queue, row.label, 'impact', 0);
      } else if (row.event === 'impact') {
        let targets = [];
        if (row.targetIds && row.targetIds.length > 0) {
          targets = state.monsters.filter(m => row.targetIds.includes(m.id) && !isMonsterDead(m));
        } else {
          const first = state.monsters.find(m => !isMonsterDead(m));
          if (first) targets = [first];
        }
        if (targets.length && typeof row.damage === 'number') {
          const attackObj = { is_multi_target: !!row.isMultiTarget };
          // F15: MVP accuracy always 100 (player accuracy not factored yet)
          const attacker = { damage: row.damage, accuracy: 100, damage_range: 0 };
          const results = resolveAttack(attacker, targets, attackObj, state.rng);
          results.forEach(r => {
            if (r.hit) log(`${row.label} attack hits ${r.target} for ${r.damage}`);  // F6: intentional damage numbers in feed (GUI shows exact; band scheme cosmetic-in-practice)
          });
        }
        const cd = row.cooldownTicks || 2;
        morphHandRow(state.queue, row.label, 'cooldown', cd);
      } else if (row.event === 'cooldown') {
        const handState = state.player.hands[row.label];
        if (handState) handState.state = 'Ready';
        const idx = state.queue.findIndex(r => r.id === row.id);
        if (idx !== -1) state.queue.splice(idx, 1);
        log(`${row.label} Ready`);
      }
    } else {
      const mon = state.monsters.find(m => m.label === row.label);
      if (mon && !isMonsterDead(mon)) {
        const dmg = rollDamage(mon.damage, 3, state.rng);
        if (checkHit(mon.accuracy, state.rng)) {
          applyDamage(state.player, dmg);
          log(`${row.label} hits player for ${dmg}`);
        }
        if (!isMonsterDead(mon)) {
          commitNewRow(state.queue, row.label, 'attack', mon.speed);
        }
      }
      const idx = state.queue.findIndex(r => r.id === row.id);
      if (idx !== -1) state.queue.splice(idx, 1);
    }
  }

  function advanceToNextDecision() {
    let steps = 0;
    while (steps < 50) {
      steps++;
      const fired = tick(state.queue, (row) => handleFire(row));
      state.tic++;
      if (fired.length > 0) break;
      if (checkPlayerReady() || isBattleOver()) break;
    }
    sortQueue(state.queue);
    return getState();
  }

  function checkPlayerReady() {
    return Object.values(state.player?.hands || {}).some(h => h.state === 'Ready');
  }

  function isBattleOver() {
    const allMonstersDead = state.monsters.length > 0 && state.monsters.every(isMonsterDead);
    return allMonstersDead || isPlayerDead(state.player);
  }

  function commitAttack(hand, attackId, targetIds = [], params = {}) {
    if (!state.player.hands[hand] || state.player.hands[hand].state !== 'Ready') {
      throw new Error('Hand not ready');
    }
    const castTicks = params.castTicks || 3;
    const cooldownTicks = params.cooldownTicks || 2;
    const playerDamage = params.playerDamage || 10;
    const isMultiTarget = !!params.isMultiTarget;
    const row = commitNewRow(state.queue, hand, 'winding', castTicks);
    row.attackId = attackId;
    row.targetIds = targetIds;
    row.damage = playerDamage;
    row.isMultiTarget = isMultiTarget;
    row.cooldownTicks = cooldownTicks;
    state.player.hands[hand].state = 'winding';
    state.player.hands[hand].attackId = attackId;
    log(`${hand} commits attack ${attackId} (cast ${castTicks})`);
    return advanceToNextDecision();
  }

  function startBattle(participants, seededRng, initialPlayerHp = null) {
    if (seededRng) state.rng = seededRng;
    state.player = createPlayer(participants.loadout || { hand_l: 1, hand_r: 2 });
    // F10: support HP carry from previous battle (battle_state.player.hp source of truth)
    if (initialPlayerHp != null && typeof initialPlayerHp === 'number' && initialPlayerHp > 0) {
      state.player.hp = initialPlayerHp;
    }
    state.monsters = participants.monsters.map((m, i) => {
      m.label = m.label || String.fromCharCode(65 + i);
      return createMonster(m);
    });
    state.queue = createQueue();
    state.feed = [];
    state.tic = 0;
    state.buffs = [];
    state.monsters.forEach(mon => {
      if (!isMonsterDead(mon)) {
        commitNewRow(state.queue, mon.label, 'attack', mon.speed);
      }
    });
    return getState();
  }

  function getState() {
    const participantsOut = {
      player: { hp: state.player.hp, hands: state.player.hands },
      monsters: state.monsters.map(m => ({
        label: m.label,
        hp_word: getHpWord(m.current_hp, m.max_hp),
        id: m.id
      }))
    };
    return {
      queue: [...state.queue],
      participants: participantsOut,
      feed: [...state.feed],
      tic: state.tic,
      battle_over: isBattleOver(),
      player_dead: isPlayerDead(state.player),
      monsters_dead: state.monsters.length > 0 && state.monsters.every(isMonsterDead)
    };
  }

  function loadState(persisted) {
    if (!persisted) return;
    state.queue = persisted.queue ? JSON.parse(JSON.stringify(persisted.queue)) : createQueue();
    state.player = persisted.player ? JSON.parse(JSON.stringify(persisted.player)) : null;
    state.monsters = persisted.monsters ? JSON.parse(JSON.stringify(persisted.monsters)) : [];
    state.feed = persisted.feed ? [...persisted.feed] : [];
    state.tic = persisted.tic || 0;
    state.buffs = persisted.buffs || [];
  }

  return { startBattle, commitAttack, advanceToNextDecision, getState, state, loadState };
}

export function resumeEngine(persistedState, rng = Math.random) {
  const api = createEngine(rng);
  if (persistedState) {
    api.loadState(persistedState);
  }
  return api;
}

export default createEngine;
