// js/combat/engine.js
// Pure ESM orchestrator. Commit-driven. Deterministic with injected RNG (seeded for tests).
// Resolves to next player decision point. Emits feed. Cancels in-flight on death (MVP).
// Parameterized commitAttack for API data-driven timing/damage/multi-target.
// F2: winding → impact morph implemented so attacks deal damage and hands return to Ready.
// F10: startBattle accepts optional initialPlayerHp for cross-battle HP carry.

import { createQueue, commitNewRow, tick, sortQueue, morphHandRow } from './tic-queue.js';
import { createPlayer, createMonster, isPlayerDead, isMonsterDead, applyDamage, swapHandWithBelt as swapHandWithBeltPure, PLAYER_MAX_HP } from './participants.js';
import { getHpWord } from './hp-words.js';
import { rollDamage, checkHit, resolveAttack, multiTargetReduction } from './damage.js';
import { POTION_SLOTS, ALL_EFFECT_TYPES, HAND_LABELS, POTION_PHASES, potionPrePostTicks } from './potion-contract.js';
import { buildPotionPayload, applyPotionEffect } from './potion-effects.js';
import { applyBuffs } from './buffs.js';

export function createEngine(rng = Math.random) {
  let state = {
    queue: createQueue(),
    player: null,
    monsters: [],
    feed: [],
    tic: 0,
    buffs: [],
    potions: null,
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
          const attacker = { damage: row.damage, accuracy: row.accuracy ?? 100, damage_range: 0 };
          const results = resolveAttack(attacker, targets, attackObj, state.rng);
          results.forEach(r => {
            if (r.hit) {
              log(`${row.label} ${row.attackName || 'attack'} hits ${r.target} for ${r.damage}`);
              const tgtMon = state.monsters.find(m => m.label === r.target);
              if (tgtMon && isMonsterDead(tgtMon)) {
                log(`${r.target} is defeated`);
              }
            } else {
              log(`${row.label} ${row.attackName || 'attack'} misses`);
            }
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
      } else if (row.event === 'approach') {
        const handState = state.player.hands[row.label];
        if (handState) handState.state = 'Ready';
        const idx = state.queue.findIndex(r => r.id === row.id);
        if (idx !== -1) state.queue.splice(idx, 1);
        log(`${row.label} Ready`);
      } else if (row.event === 'drinking') {
        const potion = state.potions?.[row.potionSlot];
        if (!potion || potion.used) {
          // defensive: reloaded state already used must not double-apply
          morphHandRow(state.queue, row.label, 'recovery', row.postTicks ?? 0);
          return;
        }
        potion.used = true;
        const result = applyPotionEffect(state, buildPotionPayload(potion, state.tic), state.tic);
        log(`${row.label} ${describeEffect(result)}`);
        morphHandRow(state.queue, row.label, 'recovery', row.postTicks ?? 0);
      } else if (row.event === 'recovery') {
        const handState = state.player.hands[row.label];
        if (handState) handState.state = 'Ready';
        const idx = state.queue.findIndex(r => r.id === row.id);
        if (idx !== -1) state.queue.splice(idx, 1);
        log(`${row.label} Ready`);
      }
    } else {
      const mon = state.monsters.find(m => m.label === row.label);
      if (mon && !isMonsterDead(mon)) {
        const atks = (mon.attacks||[]).filter(a => a && typeof a.name === 'string' && a.name);
        const atkName = atks.length ? atks[Math.floor(state.rng()*atks.length)].name : null;
        const dmg = rollDamage(mon.damage, 3, state.rng);
        if (checkHit(mon.accuracy, state.rng)) {
          applyDamage(state.player, dmg);
          log(`${row.label} ${atkName ? atkName + ' ' : ''}hits player for ${dmg}`);
        } else {
          log(`${row.label} ${atkName ? atkName + ' ' : ''}misses`);
        }
        if (!isMonsterDead(mon)) {
          commitNewRow(state.queue, row.label, 'attack', mon.speed);
        }
      }
      const idx = state.queue.findIndex(r => r.id === row.id);
      if (idx !== -1) state.queue.splice(idx, 1);
    }
  }

  function advanceToNextDecision(captureFires = null) {
    let steps = 0;
    while (steps < 50) {
      steps++;
      const fired = tick(state.queue, (row) => {
        handleFire(row);
        if (captureFires) {
          const mon = state.monsters.find(m => m.label === row.label);
          let after = null;
          if (row.event === 'attack' && mon && !isMonsterDead(mon)) {
            after = { event: 'attack', tics: mon.speed };
          } else {
            after = null;
          }
          captureFires.push({
            tic: state.tic,
            label: row.label,
            event: row.event,
            line: state.feed[state.feed.length - 1],
            hp: state.player.hp,
            after
          });
        }
      });
      state.tic++;
      // PC-39: expire buffs at the start of the new tic (after increment), log each
      const stillActive = [];
      for (const b of state.buffs) {
        if (b.endTic <= state.tic) {
          log(`${b.name} buff expired`);
        } else {
          stillActive.push(b);
        }
      }
      state.buffs = stillActive;
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
    return allMonstersDead || (state.player ? isPlayerDead(state.player) : true);
  }

  function commitAttack(hand, attackId, targetIds = [], params = {}) {
    if (!state.player.hands[hand] || state.player.hands[hand].state !== 'Ready') {
      throw new Error('Hand not ready');
    }
    const dmgBuff = applyBuffs(state.buffs, state.tic, 'damage');
    const spdBuff = applyBuffs(state.buffs, state.tic, 'speed');
    const accBuff = applyBuffs(state.buffs, state.tic, 'accuracy');
    let castTicks = Math.max(1, (params.castTicks || 3) - spdBuff);
    let cooldownTicks = Math.max(1, (params.cooldownTicks || 2) - spdBuff);
    const playerDamage = (params.playerDamage || 10) + dmgBuff;
    const isMultiTarget = !!params.isMultiTarget;
    const attackName = params.attackName || null;
    const row = commitNewRow(state.queue, hand, 'winding', castTicks);
    row.attackId = attackId;
    row.targetIds = targetIds;
    row.damage = playerDamage;
    row.isMultiTarget = isMultiTarget;
    row.cooldownTicks = cooldownTicks;
    row.attackName = attackName;
    row.accuracy = (params.playerAccuracy ?? 100) + accBuff;
    state.player.hands[hand].state = 'winding';
    state.player.hands[hand].attackId = attackId;
    log(`${hand} commits ${attackName ? attackName : `attack ${attackId}`} (cast ${castTicks})`);
    return advanceToNextDecision();
  }

  function startBattle(participants, seededRng, initialPlayerHp = null, maxPlayerHp = PLAYER_MAX_HP) {
    if (seededRng) state.rng = seededRng;
    state.player = createPlayer(participants.loadout || { hand_l: 1, hand_r: 2 }, maxPlayerHp);
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
    // PC-39: seed potions from loadout (backward compatible, consume_a/b optional)
    function normalizePotion(p) {
      if (!p) return null;
      return { ...p, used: !!p.used };
    }
    state.potions = {
      A: normalizePotion(participants.loadout?.consume_a),
      B: normalizePotion(participants.loadout?.consume_b)
    };
    state.monsters.forEach(mon => {
      if (!isMonsterDead(mon)) {
        commitNewRow(state.queue, mon.label, 'attack', mon.speed);
      }
    });
    // PC-64: initial approach rows for hands at weapon instance speed (default 1 if missing)
    const handLSpeed = Number(participants.loadout?.hand_l_speed) || 1;
    const handRSpeed = Number(participants.loadout?.hand_r_speed) || 1;
    state.player.hands.LH.state = 'Approach';
    state.player.hands.RH.state = 'Approach';
    commitNewRow(state.queue, 'LH', 'approach', handLSpeed);
    commitNewRow(state.queue, 'RH', 'approach', handRSpeed);
    const intro = { rows: state.queue.map(r => ({ label: r.label, event: r.event, tics: r.tics })), hpStart: state.player.hp, fires: [] };
    advanceToNextDecision(intro.fires);
    state.intro = intro;
    return getState();
  }

  function getState() {
    const hp = state.player ? state.player.hp : 0;
    const maxHp = state.player ? state.player.max_hp ?? 0 : 0;
    const hands = state.player ? state.player.hands : {};
    const participantsOut = {
      player: { hp, max_hp: maxHp, hands },
      monsters: state.monsters.map(m => ({
        label: m.label,
        hp_word: getHpWord(m.current_hp || 0, m.max_hp || 0),
        id: m.id
      }))
    };
    return {
      queue: [...state.queue],
      participants: participantsOut,
      feed: [...state.feed],
      tic: state.tic,
      battle_over: isBattleOver(),
      player_dead: state.player ? isPlayerDead(state.player) : true,
      monsters_dead: state.monsters.length > 0 && state.monsters.every(isMonsterDead),
      potions: state.potions ? { A: state.potions.A, B: state.potions.B } : null,
      buffs: state.buffs.map(b => ({ ...b })),
      intro: state.intro || null
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
    state.potions = persisted.potions || null;
    state.intro = undefined;
  }

  function describeEffect(result) {
    if (result.kind === 'heal') {
      return `healed ${result.healed}`;
    }
    const p = result.payload || result.buff || result;
    const type = p.type || 'buff';
    return `${type} +${p.value} until tic ${p.endTic}`;
  }

  function commitPotion(slot, params = {}) {
    if (!POTION_SLOTS.includes(slot)) {
      throw new Error('Invalid potion slot');
    }
    const potion = state.potions?.[slot];
    if (!potion) {
      throw new Error('No potion in slot ' + slot);
    }
    if (potion.used) {
      throw new Error('Potion already used');
    }
    if (!ALL_EFFECT_TYPES.includes(potion.effect_type)) {
      throw new Error('Not a potion: ' + potion.effect_type);
    }
    if (!state.player) {
      throw new Error('No active combatant — call startBattle or loadState first');
    }
    const battleActive = state.monsters.some(m => !isMonsterDead(m));
    let phase = params.phase || (battleActive ? 'in-battle' : 'between-fights');
    if (params.phase && !POTION_PHASES.includes(phase)) {
      throw new Error('Invalid phase');
    }
    // BETWEEN-FIGHTS path (instant apply, no hand/queue)
    if (phase === 'between-fights') {
      const payload = buildPotionPayload(potion, state.tic);
      const result = applyPotionEffect(state, payload, state.tic);
      potion.used = true;
      log(`Potion ${slot} used — ${describeEffect(result)}`);
      return getState();
    }
    // IN-BATTLE path
    let hand = params.hand;
    if (hand) {
      if (!HAND_LABELS.includes(hand) || state.player.hands[hand]?.state !== 'Ready') {
        throw new Error('Hand not ready');
      }
    } else {
      // deterministic: first Ready in LH then RH order
      hand = HAND_LABELS.find(h => state.player.hands[h]?.state === 'Ready');
      if (!hand) {
        throw new Error('No free hand');
      }
    }
    const weaponSpeed = Number(params.weaponSpeed) || 0;
    const pre = potionPrePostTicks(weaponSpeed, potion.rolled_speed);
    const post = pre;
    // lock hand
    state.player.hands[hand].state = 'drinking';
    state.player.hands[hand].attackId = null;
    const row = commitNewRow(state.queue, hand, 'drinking', pre);
    row.potionSlot = slot;
    row.postTicks = post;
    log(`${hand} drinks ${potion.template_name || potion.effect_type} (${pre} tics)`);
    // Action cost: hand locked for pre + post = weapon.speed + potion.rolled_speed total (contract §7)
    return advanceToNextDecision();
  }

  function swapHandWithBelt(hand, weapons) {
    if (!state.player || !state.player.hands || !state.player.hands[hand]) {
      return { error: 'hand not Ready' };
    }
    if (state.player.hands[hand].state !== 'Ready') {
      return { error: 'hand not Ready' };
    }
    const result = swapHandWithBeltPure(hand, state.player, weapons);
    if (!result.success) {
      return { error: result.error };
    }
    // PC-54: the swap costs max(speeds) tics as a cooldown. A Ready hand has NO
    // queue row (cooldown rows are removed on fire) — morphing would silently
    // no-op, making the swap free. Commit a fresh cooldown row; morph only if
    // some row for the hand somehow exists (defensive).
    const existing = state.queue.find(r => r.label === hand);
    if (existing) {
      morphHandRow(state.queue, hand, 'cooldown', result.delay);
    } else {
      commitNewRow(state.queue, hand, 'cooldown', result.delay);
    }
    return { success: true, delay: result.delay, newWeaponId: result.newWeaponId, oldWeaponId: result.oldWeaponId };
  }

  return { startBattle, commitAttack, commitPotion, swapHandWithBelt, advanceToNextDecision, getState, state, loadState };
}

export function resumeEngine(persistedState, rng = Math.random) {
  const api = createEngine(rng);
  if (persistedState) {
    api.loadState(persistedState);
  }
  return api;
}

export default createEngine;