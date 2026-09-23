// js/combat/engine.js
// Pure ESM orchestrator. Commit-driven. Deterministic with injected RNG (seeded for tests).
// Resolves to next player decision point. Emits feed. Cancels in-flight on death (MVP).
// Parameterized commitAttack for API data-driven timing/damage/multi-target.
// F2: winding → impact morph implemented so attacks deal damage and hands return to Ready.
// F10: startBattle accepts optional initialPlayerHp for cross-battle HP carry.

import { createQueue, commitNewRow, popNext, sortQueue, addEvent, peekHead, removeHead } from './tic-queue.js';
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
  }

  // PC-72: pick monster attack at commit time for windup text
  function pickMonsterAttack(mon, rng) {
    const atks = (mon.attacks||[]).filter(a => a && typeof a.name === 'string' && a.name);
    return atks.length ? atks[Math.floor(rng()*atks.length)] : null;
  }

  // PC-72: potion crit. Rolled ONLY when crit_chance > 0 so legacy potions and
  // pre-crit tests consume no extra RNG. On crit: heal amount and buff value
  // × critEffectMultiplier, buff duration × critDurationMultiplier (rounded).
  // Heals have no duration — effect only.
  function applyPotionWithCrit(potion, tic) {
    const critChance = Number(potion?.crit_chance) || 0;
    const crit = critChance > 0 && state.rng() * 100 < critChance;
    const effectMult = crit ? (Number(potion?.critEffectMultiplier) || 1.5) : 1;
    const durMult = crit ? (Number(potion?.critDurationMultiplier) || 1.5) : 1;
    const payload = buildPotionPayload(potion, tic);
    if (crit) {
      if (payload.type === 'heal') {
        payload.amount = Math.round(payload.amount * effectMult);
      } else {
        payload.value = Math.round(payload.value * effectMult);
        payload.durationTicks = Math.round(payload.durationTicks * durMult);
        payload.endTic = tic + payload.durationTicks;
      }
    }
    const result = applyPotionEffect(state, payload, tic);
    return { result, crit };
  }

  function handleFire(row) {
    if (row.event === 'buff_expiry') {
      // Remove the expired buff from state.buffs
      const idx = state.buffs.findIndex(b => b.name === row.buffName);
      if (idx !== -1) {
        state.buffs.splice(idx, 1);
        state.buffs.expired = (state.buffs.expired || 0) + 1;
        log(`${row.buffName} buff expired`);
      }
      return;
    }
    if (row.label === 'LH' || row.label === 'RH') {
      if (row.event === 'winding') {
        // winding → impact: carry over attack data (damage, targets, etc.)
        const impactRow = addEvent(state.queue, row.label, 'impact', 0);
        impactRow.targetIds = row.targetIds;
        impactRow.damage = row.damage;
        impactRow.isMultiTarget = row.isMultiTarget;
        impactRow.cooldownTicks = row.cooldownTicks;
        impactRow.accuracy = row.accuracy;
        impactRow.critChance = row.critChance;
        impactRow.critMultiplier = row.critMultiplier;
        impactRow.attackName = row.attackName;
        sortQueue(state.queue);
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
          const attacker = {
            damage: row.damage,
            accuracy: row.accuracy ?? 100,
            damage_range: 0,
            critChance: row.critChance || 0,
            critMultiplier: row.critMultiplier || 2.0
          };
          const results = resolveAttack(attacker, targets, attackObj, state.rng);
          results.forEach(r => {
            if (r.hit) {
              log(`${row.label} ${row.attackName || 'attack'} hits ${r.target} for ${r.damage}${r.crit ? ' CRITICAL!' : ''}`);
              const tgtMon = state.monsters.find(m => m.label === r.target);
              if (tgtMon && isMonsterDead(tgtMon)) {
                log(`${r.target} is defeated`);
              }
            } else {
              log(`${row.label} ${row.attackName || 'attack'} misses`);
            }
          });
        }
        // PC-68: kill cancels queued attacks on the dead target. If another
        // hand is winding an attack whose targets are ALL dead now, cancel it
        // straight into its own cooldown — no wasted cast time, no whiff.
        cancelQueuedAttacksOnDeadTargets();
        const cd = row.cooldownTicks || 2;
        // impact → cooldown: remove old (already popped), add fresh cooldown row
        addEvent(state.queue, row.label, 'cooldown', cd);
        sortQueue(state.queue);
      } else if (row.event === 'cooldown') {
        const handState = state.player.hands[row.label];
        if (handState) handState.state = 'Ready';
        // cooldown → ready: remove old (already popped), add fresh ready row
        addEvent(state.queue, row.label, 'ready', 0);
        sortQueue(state.queue);
        log(`${row.label} Ready`);
      } else if (row.event === 'approach') {
        const handState = state.player.hands[row.label];
        if (handState) handState.state = 'Ready';
        // approach → ready: remove old (already popped), add fresh ready row
        addEvent(state.queue, row.label, 'ready', 0);
        sortQueue(state.queue);
        log(`${row.label} Ready`);
      } else if (row.event === 'drinking') {
        const potion = state.potions?.[row.potionSlot];
        if (!potion || potion.used) {
          // defensive: reloaded state already used must not double-apply
          // drinking → recovery: remove old (already popped), add fresh recovery row
          addEvent(state.queue, row.label, 'recovery', row.postTicks ?? 0);
          sortQueue(state.queue);
          return;
        }
        potion.used = true;
        const { result, crit } = applyPotionWithCrit(potion, state.tic);
        log(`${row.label} ${describeEffect(result)}${crit ? ' CRITICAL!' : ''}`);
        // Insert buff expiry event for when this buff wears off
        if (result.kind === 'buff' && result.buff && result.buff.endTic > state.tic) {
          const remainingTics = result.buff.endTic - state.tic;
          if (remainingTics > 0) {
            const expRow = addEvent(state.queue, null, 'buff_expiry', remainingTics);
            expRow.buffName = result.buff.name;
            sortQueue(state.queue);
          }
        }
        // drinking → recovery: remove old (already popped), add fresh recovery row
        addEvent(state.queue, row.label, 'recovery', row.postTicks ?? 0);
        sortQueue(state.queue);
      } else if (row.event === 'recovery') {
        const handState = state.player.hands[row.label];
        if (handState) handState.state = 'Ready';
        // recovery → ready: remove old (already popped), add fresh ready row
        addEvent(state.queue, row.label, 'ready', 0);
        sortQueue(state.queue);
        log(`${row.label} Ready`);
      }
    } else {
      const mon = state.monsters.find(m => m.label === row.label);
      if (mon && !isMonsterDead(mon)) {
        // PC-72: use pre-selected attack from commit time (row.monsterAttackName)
        const atkName = row.monsterAttackName || null;
        let dmg = rollDamage(mon.damage, 3, state.rng);
        if (checkHit(mon.accuracy, state.rng)) {
          // PC-72: monster crit — mon.critChance (from generate_monster payload)
          // × pickedAttack.crit_factor, same formula as the player side. Roll
          // only after a hit lands (misses can't crit) and only when the final
          // chance is > 0, so legacy states/tests consume no extra RNG.
          const atkForCrit = (mon.attacks||[]).find(a => a && a.name === atkName);
          const finalCritChance = (Number(mon.crit_chance ?? mon.critChance) || 0) * (Number(atkForCrit?.crit_factor) || 1);
          let crit = false;
          if (finalCritChance > 0 && state.rng() * 100 < finalCritChance) {
            dmg = Math.round(dmg * (Number(atkForCrit?.crit_multiplier) || 2.0));
            crit = true;
          }
          applyDamage(state.player, dmg);
          const monLabel = mon.name
            ? `${mon.name} ${row.label.replace(/^Monster /i, '')}`
            : row.label;
          log(`${monLabel} ${atkName ? atkName + ' ' : ''}hits player for ${dmg}${crit ? ' CRITICAL!' : ''}`);
        } else {
          const monLabel = mon.name
            ? `${mon.name} ${row.label.replace(/^Monster /i, '')}`
            : row.label;
          log(`${monLabel} ${atkName ? atkName + ' ' : ''}misses`);
        }
        if (!isMonsterDead(mon)) {
          const nextAtk = pickMonsterAttack(mon, state.rng);
          const newRow = commitNewRow(state.queue, row.label, 'attack', mon.speed);
          newRow.monsterAttackName = nextAtk?.name || null;
          log(`${mon.name || mon.template_name || 'Monster'} ${row.label.replace('Monster ', '')} prepares ${nextAtk?.name ? `a ${nextAtk.name}` : 'an attack'}...`);
        }
      }
    }
  }

  function stepOnce(firedRow = null) {
    const row = firedRow || peekHead(state.queue);
    if (!row) return null;
    const feedBefore = state.feed.length;
    handleFire(row);
    // expire buffs (same logic as stepQueue)
    const stillActive = [];
    for (const b of state.buffs) {
      if (b.endTic <= state.tic) {
        log(`${b.name} buff expired`);
      } else {
        stillActive.push(b);
      }
    }
    state.buffs = stillActive;
    sortQueue(state.queue);
    const narrate = state.feed.length > feedBefore ? state.feed[feedBefore] : (state.feed[state.feed.length - 1] || '');
    return { row, narrate };
  }

  function removeProcessedHead() {
    return removeHead(state.queue);
  }

  function tick() {
    const head = peekHead(state.queue);
    if (!head) return { done: true };
    if ((head.label === 'LH' || head.label === 'RH') && head.event === 'ready') {
      return { needsInput: true, row: head };
    }
    const feedBefore = state.feed.length;
    handleFire(head);
    sortQueue(state.queue);
    const newFeed = state.feed.slice(feedBefore);
    const narrate = newFeed.join('\n');
    removeHead(state.queue);
    const pd = isPlayerDead(state.player);
    const allMonstersDead = state.monsters.length > 0 && state.monsters.every(isMonsterDead);
    const battleOver = allMonstersDead || pd;
    return { narrate, row: head, feed: newFeed, needsInput: false,
      playerReady: Object.values(state.player?.hands || {}).some(h => h.state === 'Ready'), battleOver };
  }

  // PC-68: when an attack kills the last target of another hand's queued
  // attack, that queued attack is moot — cancel it straight into its own
  // cooldown so the hand isn't stuck winding at a corpse (then whiffing).
  // Only rows with explicit targetIds are cancelled; auto-target rows
  // (empty targetIds) still resolve to the first living monster at impact.
  function cancelQueuedAttacksOnDeadTargets() {
    const deadIds = new Set(state.monsters.filter(isMonsterDead).map(m => m.id));
    if (deadIds.size === 0) return;
    for (const q of [...state.queue]) {
      if (q.label !== 'LH' && q.label !== 'RH') continue;
      if (q.event !== 'winding') continue;
      if (!q.targetIds || q.targetIds.length === 0) continue;
      const allDead = q.targetIds.every(id => deadIds.has(id));
      if (allDead) {
        const cd = q.cooldownTicks || 2;
        const idx = state.queue.indexOf(q);
        if (idx !== -1) state.queue.splice(idx, 1);
        addEvent(state.queue, q.label, 'cooldown', cd);
        sortQueue(state.queue);
        log(`${q.label} ${q.attackName || 'attack'} cancelled — target already defeated`);
      }
    }
  }

  function stepQueue(captureFires = null) {
    if (isBattleOver()) {
      sortQueue(state.queue);
      return getState();
    }
    const rowHead = peekHead(state.queue);
    if (!rowHead) {
      sortQueue(state.queue);
      return getState();
    }
    const ticOffset = rowHead.tics;
    state.tic += ticOffset;
    for (const r of state.queue) {
      r.tics = Math.max(0, r.tics - ticOffset);
    }
    // Remove the head row BEFORE firing so handleFire's addEvent/commitNewRow
    // don't leave the original row duplicating in the queue
    const removedRow = removeProcessedHead();
    if (!removedRow) {
      sortQueue(state.queue);
      return getState();
    }
    const result = stepOnce(removedRow);
    if (!result) {
      sortQueue(state.queue);
      return getState();
    }
    const { row } = result;
    if (captureFires) {
      const mon = state.monsters.find(m => m.label === row.label);
      let after = null;
      if (row.event === 'attack' && mon && !isMonsterDead(mon)) {
        after = { event: 'attack', tics: mon.speed };
      }
      captureFires.push({
        tic: state.tic,
        label: row.label,
        event: row.event,
        line: result.narrate,
        hp: state.player.hp,
        after
      });
    }
    sortQueue(state.queue);
    return getState();
  }

  // Compat wrapper for existing tests and old call sites — loops stepQueue until decision point.
  // Preserves exact same feed output and RNG consumption order for determinism.
  function hasApproachingHand() {
    return Object.values(state.player?.hands || {}).some(h => h.state === 'Approach');
  }

  function advanceToNextDecision(captureFires = null) {
    const fires = captureFires || [];
    let iterations = 0;
    while (true) {
      if (isBattleOver()) break;
      stepQueue(fires);
      // Keep stepping past approach rows so ALL hands complete their initial approach
      // (checkPlayerReady using .some() returns on the first Ready hand, but during
      // startBattle both approach rows must fire before the player can choose a hand)
      if (!hasApproachingHand() && checkPlayerReady()) break;
      iterations++;
      if (iterations > 500) break;
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
    // If there's a 'ready' placeholder row, remove it before creating the winding row
    const readyRow = state.queue.find(r => r.label === hand && r.event === 'ready');
    if (readyRow) {
      const idx = state.queue.indexOf(readyRow);
      if (idx !== -1) state.queue.splice(idx, 1);
    }
    const dmgBuff = applyBuffs(state.buffs, state.tic, 'damage');
    const spdBuff = applyBuffs(state.buffs, state.tic, 'speed');
    const accBuff = applyBuffs(state.buffs, state.tic, 'accuracy');
    let castTicks = Math.max(1, (params.castTicks || 3) - spdBuff);
    let cooldownTicks = Math.max(1, (params.cooldownTicks || 2) - spdBuff);
    const playerDamage = (params.playerDamage || 10) + dmgBuff;
    const isMultiTarget = !!params.isMultiTarget;
    const attackName = params.attackName || null;
    const playerCritChance = params.playerCritChance || 0;
    const playerCritMultiplier = params.playerCritMultiplier || 2.0;
    const row = commitNewRow(state.queue, hand, 'winding', castTicks);
    row.attackId = attackId;
    row.targetIds = targetIds;
    row.damage = playerDamage;
    row.isMultiTarget = isMultiTarget;
    row.cooldownTicks = cooldownTicks;
    row.attackName = attackName;
    row.accuracy = (params.playerAccuracy ?? 100) + accBuff;
    row.critChance = playerCritChance;
    row.critMultiplier = playerCritMultiplier;
    state.player.hands[hand].state = 'winding';
    state.player.hands[hand].attackId = attackId;
    log(`${hand} prepares ${attackName ? `a ${attackName}` : 'an attack'}...`);
    return { committed: true };
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
        const atk = pickMonsterAttack(mon, state.rng);
        const row = commitNewRow(state.queue, mon.label, 'attack', mon.speed);
        row.monsterAttackName = atk?.name || null;
        log(`${mon.name || mon.template_name || 'Monster'} ${mon.label.replace('Monster ', '')} prepares ${atk?.name ? `a ${atk.name}` : 'an attack'}...`);
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
      const { result, crit } = applyPotionWithCrit(potion, state.tic);
      potion.used = true;
      log(`Potion ${slot} used — ${describeEffect(result)}${crit ? ' CRITICAL!' : ''}`);
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
    // lock hand — remove any ready placeholder row first to prevent duplicates
    const readyRow = state.queue.find(r => r.label === hand && r.event === 'ready');
    if (readyRow) {
      const idx = state.queue.indexOf(readyRow);
      if (idx !== -1) state.queue.splice(idx, 1);
    }
    state.player.hands[hand].state = 'drinking';
    state.player.hands[hand].attackId = null;
    const row = commitNewRow(state.queue, hand, 'drinking', pre);
    row.potionSlot = slot;
    row.postTicks = post;
    log(`${hand} drinks ${potion.template_name || potion.effect_type}...`);
    // Action cost: hand locked for pre + post = weapon.speed + potion.rolled_speed total (contract §7)
    return { committed: true };
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
    // PC-54: the swap costs max(speeds) tics as a cooldown. Remove any existing
    // ready/placeholder row for the hand, add a fresh cooldown.
    const existing = state.queue.find(r => r.label === hand);
    if (existing) {
      const idx = state.queue.indexOf(existing);
      if (idx !== -1) state.queue.splice(idx, 1);
    }
    addEvent(state.queue, hand, 'cooldown', result.delay);
    sortQueue(state.queue);
    return { success: true, delay: result.delay, newWeaponId: result.newWeaponId, oldWeaponId: result.oldWeaponId };
  }

  return { startBattle, commitAttack, commitPotion, swapHandWithBelt, advanceToNextDecision, stepQueue, getState, state, loadState, stepOnce, removeProcessedHead, tick };
}

export function resumeEngine(persistedState, rng = Math.random) {
  const api = createEngine(rng);
  if (persistedState) {
    api.loadState(persistedState);
  }
  return api;
}

export default createEngine;