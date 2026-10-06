// js/combat/engine.js
// Pure ESM orchestrator. Commit-driven. Deterministic with injected RNG (seeded for tests).
// Resolves to next player decision point. Emits feed. Cancels in-flight on death (MVP).
// Parameterized commitAttack for API data-driven timing/damage/multi-target.
// F2: winding → impact transition implemented so attacks deal damage and hands return to Ready.
// F10: startBattle accepts optional initialPlayerHp for cross-battle HP carry.
// PC-83: fire, commit, and tick-phase bodies are module helpers. createEngine binds state.

import { createQueue, commitNewRow, addEvent, peekHead, removeHead } from './tic-queue.js';
import { createPlayer, createMonster, isPlayerDead, isMonsterDead, applyDamage, swapHandWithBelt as swapHandWithBeltPure, PLAYER_MAX_HP } from './participants.js';
import { getHpWord } from './hp-words.js';
import { rollDamage, checkHit, resolveAttack } from './damage.js';
import { POTION_SLOTS, ALL_EFFECT_TYPES, HAND_LABELS, POTION_PHASES, potionPrePostTicks } from './potion-contract.js';
import { buildPotionPayload, applyPotionEffect } from './potion-effects.js';
import { applyBuffs } from './buffs.js';

function logLine(state, msg) {
  state.feed.push(`tic ${state.tic} — ${msg}`);
}

// PC-72: pick monster attack at commit time for windup text
function pickMonsterAttack(mon, rng) {
  const atks = (mon.attacks||[]).filter(a => a && typeof a.name === 'string' && a.name);
  return atks.length ? atks[Math.floor(rng()*atks.length)] : null;
}

// Option A: mon.speed plays the weaponSpeed role. Same contract as the API
// rollStat — range <= 0 consumes no RNG and returns base (clamped >= 1).
// Damage and accuracy still use rollStat. Timing does not.
function rollStat(base, range, rng) {
  const b = Number(base) || 1;
  const v = Number(range) || 0;
  if (v <= 0) return Math.max(1, b);
  const delta = Math.floor(rng() * (v * 2 + 1)) - v;
  return Math.max(1, b + delta);
}

// PC-107: attack prepare/cooldown are multipliers on speed, not flat ticks.
// Mirrors api/combat rollMultiplier: range <= 0 consumes no RNG and returns
// base exactly. Clamp >= 0 (not >= 1) so a 0.7 Quick Slash stays 0.7.
export function rollMultiplier(base, range, rng = Math.random) {
  const b = Number(base);
  const safe = Number.isFinite(b) ? b : 1;
  const v = Number(range) || 0;
  if (v <= 0) return safe;
  const rolled = safe + (rng() * 2 - 1) * v;
  return Math.max(0, rolled);
}

function monsterAttackByName(mon, name) {
  if (!name) return null;
  return (mon.attacks || []).find(a => a && a.name === name) || null;
}

function describeEffect(result) {
  if (result.kind === 'heal') {
    return `healed ${result.healed}`;
  }
  const p = result.payload || result.buff || result;
  const type = p.type || 'buff';
  return `${type} +${p.value} until tic ${p.endTic}`;
}

function normalizePotion(p) {
  if (!p) return null;
  return { ...p, used: !!p.used };
}

function playerHasHandState(player, handState) {
  return Object.values(player?.hands || {}).some(h => h.state === handState);
}

function battleIsOver(state) {
  const allMonstersDead = state.monsters.length > 0 && state.monsters.every(isMonsterDead);
  return allMonstersDead || (state.player ? isPlayerDead(state.player) : true);
}

function buildStateSnapshot(state) {
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
    battle_over: battleIsOver(state),
    player_dead: state.player ? isPlayerDead(state.player) : true,
    monsters_dead: state.monsters.length > 0 && state.monsters.every(isMonsterDead),
    potions: state.potions ? { A: state.potions.A, B: state.potions.B } : null,
    buffs: state.buffs.map(b => ({ ...b })),
    intro: state.intro || null
  };
}

// PC-72: potion crit. Rolled ONLY when crit_chance > 0 so legacy potions and
// pre-crit tests consume no extra RNG. On crit: heal amount and buff value
// × critEffectMultiplier, buff duration × critDurationMultiplier (rounded).
// Heals have no duration — effect only.
// PC-106: window roll happens first (inside buildPotionPayload) and consumes
// RNG only when rolled_window > 0. Crit multiplies that rolled effect.
function applyPotionWithCrit(state, potion, tic) {
  const payload = buildPotionPayload(potion, tic, state.rng);
  const critChance = Number(potion?.crit_chance) || 0;
  const crit = critChance > 0 && state.rng() * 100 < critChance;
  const effectMult = crit ? (Number(potion?.critEffectMultiplier) || 1.5) : 1;
  const durMult = crit ? (Number(potion?.critDurationMultiplier) || 1.5) : 1;
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

function removeReadyPlaceholder(queue, hand) {
  const readyRow = queue.find(r => r.label === hand && r.event === 'ready');
  if (readyRow) {
    const idx = queue.indexOf(readyRow);
    if (idx !== -1) queue.splice(idx, 1);
  }
}

// tick() only. Skips ready rows and no-ops at cost 0. stepQueue is a different clock.
function applyTickCost(queue, ticCost) {
  if (ticCost > 0) {
    for (const r of queue) {
      if (r.event !== 'ready') r.tics = Math.max(0, r.tics - ticCost);
    }
  }
}

// Strike inputs live on the winding row so impact resolves them once.
// Stamping does not roll — rollStat/pick already ran, and damage/hit/crit
// roll at impact only (a second roll here would desync seeded streams).
function stampMonsterStrike(row, mon, atk) {
  row.monsterAttackName = atk?.name || null;
  row.damage = mon.damage;
  row.accuracy = mon.accuracy;
  row.damageRange = 3;
  const atkForCrit = atk || monsterAttackByName(mon, row.monsterAttackName);
  row.critChance = (Number(mon.crit_chance ?? mon.critChance) || 0) * (Number(atkForCrit?.crit_factor) || 1);
  row.critMultiplier = Number(atkForCrit?.crit_multiplier) || 2.0;
}

function carryMonsterStrike(from, to) {
  to.monsterAttackName = from.monsterAttackName ?? null;
  to.cooldownTicks = from.cooldownTicks;
  to.damage = from.damage;
  to.accuracy = from.accuracy;
  to.damageRange = from.damageRange;
  to.critChance = from.critChance;
  to.critMultiplier = from.critMultiplier;
}

function monsterStrikeLabel(mon, row) {
  return mon.name
    ? `${mon.name} ${row.label.replace(/^Monster /i, '')}`
    : row.label;
}

// Shared by the monster cooldown → next winding morph.
// Not called at battle start (PC-DEC-060). labelForLog is the fired row's label.
function queueNextMonsterAttack(state, mon, labelForLog) {
  const atk = pickMonsterAttack(mon, state.rng);
  // PC-107: windup = mon.speed * prepare multiplier (not speed + flat ticks).
  // PC-110: round the multiplier result DOWN so frantic speeds never gain free ticks.
  // PC-110b: floor at 1 tick so future speed buffs can never zero an attack.
  const prepare = rollMultiplier(atk?.prepare_time_multiplier ?? 1, atk?.prepare_time_multiplier_range ?? 0, state.rng);
  const newRow = commitNewRow(state.queue, mon.label, 'winding', Math.max(1, Math.floor(mon.speed * prepare)));
  stampMonsterStrike(newRow, mon, atk);
  newRow.cooldownTicks = Math.max(1, Math.floor(mon.speed * rollMultiplier(atk?.cooldown_time_multiplier ?? 1, atk?.cooldown_time_multiplier_range ?? 0, state.rng)));
  logLine(state, `${mon.name || mon.template_name || 'Monster'} ${labelForLog.replace('Monster ', '')} prepares ${atk?.name || 'an attack'}...`);
  return newRow;
}

function markHandReady(state, label) {
  const handState = state.player.hands[label];
  if (handState) handState.state = 'Ready';
  addEvent(state.queue, label, 'ready', 0);
  logLine(state, `${label} Ready`);
}

function handleHandFire(state, row) {
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
          logLine(state, `${row.label} ${row.attackName || 'attack'} hits ${r.target} for ${r.damage}${r.crit ? ' CRITICAL!' : ''}`);
          const tgtMon = state.monsters.find(m => m.label === r.target);
          if (tgtMon && isMonsterDead(tgtMon)) {
            logLine(state, `${r.target} is defeated`);
            // PC-DEC-054: every queued row for the killed monster leaves now,
            // in the same process that logs the defeat — not as a later no-op.
            for (let i = state.queue.length - 1; i >= 0; i--) {
              if (state.queue[i].label === tgtMon.label) state.queue.splice(i, 1);
            }
          }
        } else {
          logLine(state, `${row.label} ${row.attackName || 'attack'} misses`);
        }
      });
    }
    // PC-68: kill cancels queued attacks on the dead target. If another
    // hand is winding an attack whose targets are ALL dead now, cancel it
    // straight into its own cooldown — no wasted cast time, no whiff.
    cancelQueuedAttacksOnDeadTargets(state);
    const cd = row.cooldownTicks || 2;
    // impact → cooldown: remove old (already popped), add fresh cooldown row
    addEvent(state.queue, row.label, 'cooldown', cd);
  } else if (row.event === 'cooldown') {
    // cooldown → ready: remove old (already popped), add fresh ready row
    markHandReady(state, row.label);
  } else if (row.event === 'approach') {
    // approach → ready: remove old (already popped), add fresh ready row
    markHandReady(state, row.label);
  } else if (row.event === 'drinking') {
    const potion = state.potions?.[row.potionSlot];
    if (!potion || potion.used) {
      // defensive: reloaded state already used must not double-apply
      // drinking → recovery: remove old (already popped), add fresh recovery row
      addEvent(state.queue, row.label, 'recovery', row.postTicks ?? 0);
      return;
    }
    potion.used = true;
    const { result, crit } = applyPotionWithCrit(state, potion, state.tic);
    logLine(state, `${row.label} ${describeEffect(result)}${crit ? ' CRITICAL!' : ''}`);
    // Insert buff expiry event for when this buff wears off
    if (result.kind === 'buff' && result.buff && result.buff.endTic > state.tic) {
      const remainingTics = result.buff.endTic - state.tic;
      if (remainingTics > 0) {
        const expRow = addEvent(state.queue, null, 'buff_expiry', remainingTics);
        expRow.buffName = result.buff.name;
      }
    }
    // drinking → recovery: remove old (already popped), add fresh recovery row
    addEvent(state.queue, row.label, 'recovery', row.postTicks ?? 0);
  } else if (row.event === 'recovery') {
    // recovery → ready: remove old (already popped), add fresh ready row
    markHandReady(state, row.label);
  }
}

function resolveMonsterImpact(state, row, mon) {
  // PC-72: use the strike carried from winding. Do not re-pick or re-roll
  // prepare/cooldown. Damage/hit/crit roll here, once.
  const atkName = row.monsterAttackName || null;
  const base = Number.isFinite(row.damage) ? row.damage : mon.damage;
  const accuracy = Number.isFinite(row.accuracy) ? row.accuracy : mon.accuracy;
  const range = Number.isFinite(row.damageRange) ? row.damageRange : 3;
  let dmg = rollDamage(base, range, state.rng);
  if (checkHit(accuracy, state.rng)) {
    // Crit rolls only after a hit and only when chance > 0, so a stored 0
    // (or a legacy row with no crit) consumes no extra RNG.
    let critChance = row.critChance;
    let critMultiplier = row.critMultiplier;
    if (critChance == null) {
      const atkForCrit = (mon.attacks || []).find(a => a && a.name === atkName);
      critChance = (Number(mon.crit_chance ?? mon.critChance) || 0) * (Number(atkForCrit?.crit_factor) || 1);
      critMultiplier = Number(atkForCrit?.crit_multiplier) || 2.0;
    }
    let crit = false;
    if (critChance > 0 && state.rng() * 100 < critChance) {
      dmg = Math.round(dmg * (Number(critMultiplier) || 2.0));
      crit = true;
    }
    applyDamage(state.player, dmg);
    const monLabel = monsterStrikeLabel(mon, row);
    logLine(state, `${monLabel} ${atkName ? atkName + ' ' : ''}hits player for ${dmg}${crit ? ' CRITICAL!' : ''}`);
  } else {
    const monLabel = monsterStrikeLabel(mon, row);
    logLine(state, `${monLabel} ${atkName ? atkName + ' ' : ''}misses`);
  }
  if (!isMonsterDead(mon)) {
    const atk = monsterAttackByName(mon, atkName);
    const cdTics = Number.isFinite(row.cooldownTicks)
      ? row.cooldownTicks
      : Math.max(1, Math.floor(mon.speed * rollMultiplier(atk?.cooldown_time_multiplier ?? 1, atk?.cooldown_time_multiplier_range ?? 0, state.rng)));
    addEvent(state.queue, mon.label, 'cooldown', cdTics);
  }
}

function handleMonsterFire(state, row) {
  // Monster lifecycle: winding → impact → cooldown → next winding.
  // Winding does not deal damage. Cooldown must not fall through into resolution.
  const mon = state.monsters.find(m => m.label === row.label);
  if (mon && !isMonsterDead(mon)) {
    if (row.event === 'cooldown') {
      queueNextMonsterAttack(state, mon, row.label);
    } else if (row.event === 'winding') {
      const impactRow = addEvent(state.queue, row.label, 'impact', 0);
      carryMonsterStrike(row, impactRow);
    } else if (row.event === 'impact' || row.event === 'attack') {
      // 'attack' is the pre-PC-97 combined row. Resolve it as impact so a
      // persisted in-flight strike still lands instead of vanishing.
      resolveMonsterImpact(state, row, mon);
    }
  }
}

function handleFire(state, row) {
  if (row.event === 'buff_expiry') {
    // Remove the expired buff from state.buffs
    const idx = state.buffs.findIndex(b => b.name === row.buffName);
    if (idx !== -1) {
      state.buffs.splice(idx, 1);
      state.buffs.expired = (state.buffs.expired || 0) + 1;
      logLine(state, `${row.buffName} buff expired`);
    }
    return;
  }
  if (row.label === 'LH' || row.label === 'RH') {
    handleHandFire(state, row);
  } else {
    handleMonsterFire(state, row);
  }
}

// Expiry is only the buff_expiry queue item (action-visual-lifecycle §5).
// A fire must not sweep other due buffs as a side effect.
function fireAndExpireBuffs(state, row) {
  const feedBefore = state.feed.length;
  handleFire(state, row);
  return feedBefore;
}

function peekPhase(state) {
  return peekHead(state.queue);
}

function processPhase(state, row) {
  if (!row) return null;
  const feedBefore = fireAndExpireBuffs(state, row);
  const newFeed = state.feed.slice(feedBefore);
  const narrate = newFeed.join('\n');
  return { row, narrate, feed: newFeed };
}

function cleanupPhase(state) {
  const pd = isPlayerDead(state.player);
  const allMonstersDead = state.monsters.length > 0 && state.monsters.every(isMonsterDead);
  const battleOver = allMonstersDead || pd;
  if (pd) {
    return { terminal: 'death', battleOver: true };
  }
  if (allMonstersDead) {
    return { terminal: 'victory', battleOver: true };
  }
  return { terminal: null, battleOver: false };
}

function removePhase(state) {
  return removeHead(state.queue);
}

function commitAttackAction(state, hand, attackId, targetIds = [], params = {}) {
  if (!state.player.hands[hand] || state.player.hands[hand].state !== 'Ready') {
    throw new Error('Hand not ready');
  }
  // If there's a 'ready' placeholder row, remove it before creating the winding row
  removeReadyPlaceholder(state.queue, hand);
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
  logLine(state, `${hand} prepares ${attackName || 'an attack'}...`);
  return { committed: true };
}

function commitPotionAction(state, slot, params = {}) {
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
    const { result, crit } = applyPotionWithCrit(state, potion, state.tic);
    potion.used = true;
    logLine(state, `Potion ${slot} used — ${describeEffect(result)}${crit ? ' CRITICAL!' : ''}`);
    return buildStateSnapshot(state);
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
  removeReadyPlaceholder(state.queue, hand);
  state.player.hands[hand].state = 'drinking';
  state.player.hands[hand].attackId = null;
  const row = commitNewRow(state.queue, hand, 'drinking', pre);
  row.potionSlot = slot;
  row.postTicks = post;
  logLine(state, `${hand} drinks ${potion.template_name || potion.effect_type}...`);
  // Action cost: hand locked for pre + post = weapon.speed + potion.rolled_speed total (contract §7)
  return { committed: true };
}

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

  function stepOnce(firedRow = null) {
    const row = firedRow || peekHead(state.queue);
    if (!row) return null;
    const feedBefore = fireAndExpireBuffs(state, row);
    const narrate = state.feed.length > feedBefore ? state.feed[feedBefore] : (state.feed[state.feed.length - 1] || '');
    return { row, narrate };
  }

  function removeProcessedHead() {
    return removeHead(state.queue);
  }

  function peek() {
    return peekPhase(state);
  }

  function process(row) {
    return processPhase(state, row);
  }

  function cleanup() {
    return cleanupPhase(state);
  }

  function remove() {
    return removePhase(state);
  }

  // Explicit Peek→Process→Cleanup→Remove phases (PC-94)
  // Master loop (tick) calls them serially, one item at a time.
  // remove() fires ONLY after process() — the head stays until narration
  // data is produced. Never detach the head before process.
  function tick() {
    const row = peek();
    if (!row) {
      // No non-ready rows. Player needs to act or battle is over.
      if (playerHasHandState(state.player, 'Ready')) return { needsInput: true, row: null };
      return { done: true };
    }
    const head = row;  // do not remove yet — remove LAST
    // Live clock: the head's tic cost advances the absolute battle tic
    // before process. stepQueue is a separate clock and already does this.
    const ticCost = head.tics;
    state.tic += ticCost;
    applyTickCost(state.queue, ticCost);
    const result = process(head);
    const cleanupResult = cleanup();
    remove();  // pop head LAST, after process/cleanup
    const narrate = result ? result.narrate : '';
    const newFeed = result ? result.feed : [];
    const battleOver = cleanupResult.battleOver;
    return { narrate, row: head, feed: newFeed, needsInput: false,
      playerReady: playerHasHandState(state.player, 'Ready'), battleOver };
  }

  function stepQueue(captureFires = null) {
    if (isBattleOver()) {
      return getState();
    }
    const rowHead = peekHead(state.queue);
    if (!rowHead) {
      return getState();
    }
    const ticOffset = rowHead.tics;
    state.tic += ticOffset;
    // Not applyTickCost: this clock also moves state.tic and ready rows.
    for (const r of state.queue) {
      r.tics = Math.max(0, r.tics - ticOffset);
    }
    // Remove the head row BEFORE firing so handleFire's addEvent/commitNewRow
    // don't leave the original row duplicating in the queue
    const removedRow = removeProcessedHead();
    if (!removedRow) {
      return getState();
    }
    const result = stepOnce(removedRow);
    if (!result) {
      return getState();
    }
    const { row } = result;
    if (captureFires) {
      const mon = state.monsters.find(m => m.label === row.label);
      let after = null;
      // Read the successor already inserted by handleFire — do not roll again.
      const nextEvent = (mon && !isMonsterDead(mon))
        ? (row.event === 'winding' ? 'impact'
          : row.event === 'impact' ? 'cooldown'
          : row.event === 'attack' ? 'cooldown'
          : row.event === 'cooldown' ? 'winding'
          : null)
        : (row.label === 'LH' || row.label === 'RH')
          ? (row.event === 'approach' || row.event === 'cooldown' || row.event === 'recovery' ? 'ready'
            : row.event === 'winding' ? 'impact'
            : row.event === 'impact' ? 'cooldown'
            : null)
          : null;
      if (nextEvent) {
        const successor = state.queue.find(r => r.label === row.label && r.event === nextEvent);
        if (successor) {
          after = { event: nextEvent, tics: successor.tics };
        }
      }
      captureFires.push({
        tic: state.tic,
        ticCost: ticOffset,
        label: row.label,
        event: row.event,
        line: result.narrate,
        hp: state.player.hp,
        after
      });
    }
    return getState();
  }

  // Compat wrapper for existing tests and old call sites — loops stepQueue until decision point.
  // Preserves exact same feed output and RNG consumption order for determinism.
  function hasApproachingHand() {
    return playerHasHandState(state.player, 'Approach');
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
    return getState();
  }

  function checkPlayerReady() {
    return playerHasHandState(state.player, 'Ready');
  }

  function isBattleOver() {
    return battleIsOver(state);
  }

  function commitAttack(hand, attackId, targetIds = [], params = {}) {
    return commitAttackAction(state, hand, attackId, targetIds, params);
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
    state.potions = {
      A: normalizePotion(participants.loadout?.consume_a),
      B: normalizePotion(participants.loadout?.consume_b)
    };
    // PC-DEC-060: one cooldown row per living monster at instance speed.
    // Same shape as a hand approach. Not a winding row. No feed line.
    // queueNextMonsterAttack runs only when a cooldown later fires.
    state.monsters.forEach(mon => {
      if (!isMonsterDead(mon)) {
        commitNewRow(state.queue, mon.label, 'cooldown', mon.speed);
      }
    });
    // PC-64: initial approach rows for hands at weapon instance speed (default 1 if missing)
    const handLSpeed = Number(participants.loadout?.hand_l_speed) || 1;
    const handRSpeed = Number(participants.loadout?.hand_r_speed) || 1;
    state.player.hands.LH.state = 'Approach';
    state.player.hands.RH.state = 'Approach';
    commitNewRow(state.queue, 'LH', 'approach', handLSpeed);
    commitNewRow(state.queue, 'RH', 'approach', handRSpeed);
    // PC-DEC-060: do not run the clock. Tic stays 0. Both hands stay Approach.
    // intro.fires stays empty so the client does not replay a pre-advanced battle.
    // The live queue IS the tic-0 seed.
    const hpStart = state.player.hp;
    const seededRows = state.queue.map(r => ({ ...r }));
    state.intro = { rows: seededRows, fires: [], hpStart, seedFeed: [] };
    return getState();
  }

  function getState() {
    return buildStateSnapshot(state);
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

  function commitPotion(slot, params = {}) {
    return commitPotionAction(state, slot, params);
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
    // Any row for this hand, not only event==='ready' — do not use removeReadyPlaceholder.
    const existing = state.queue.find(r => r.label === hand);
    if (existing) {
      const idx = state.queue.indexOf(existing);
      if (idx !== -1) state.queue.splice(idx, 1);
    }
    addEvent(state.queue, hand, 'cooldown', result.delay);
    return { success: true, delay: result.delay, newWeaponId: result.newWeaponId, oldWeaponId: result.oldWeaponId };
  }

  return { startBattle, commitAttack, commitPotion, swapHandWithBelt, advanceToNextDecision, stepQueue, getState, state, loadState, stepOnce, removeProcessedHead, tick };
}

// PC-68: when an attack kills the last target of another hand's queued
// attack, that queued attack is moot — cancel it straight into its own
// cooldown so the hand isn't stuck winding at a corpse (then whiffing).
// Only rows with explicit targetIds are cancelled; auto-target rows
// (empty targetIds) still resolve to the first living monster at impact.
// Declared after tick() so the PC-94 source slice (tick → this function) stays valid.
function cancelQueuedAttacksOnDeadTargets(state) {
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
      logLine(state, `${q.label} ${q.attackName || 'attack'} cancelled — target already defeated`);
    }
  }
}

export function resumeEngine(persistedState, rng = Math.random) {
  const api = createEngine(rng);
  if (persistedState) {
    api.loadState(persistedState);
  }
  return api;
}

export default createEngine;
