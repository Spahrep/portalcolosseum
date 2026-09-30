// js/combat/potion-effects.js
// Pure ESM potion effect pipeline. No I/O. Exports buildPotionPayload and applyPotionEffect.

import { PLAYER_MAX_HP } from './participants.js';
import { createBuff } from './buffs.js';

// PC-106: effect = floor + uniform(0..window), inclusive. Floor is the
// guaranteed minimum. Window 0/missing returns the floor and consumes no RNG
// so legacy potions stay byte-identical. rng is the engine's state.rng when
// threaded; Math.random is the fallback for direct callers.
function rollWindowEffect(rolledFloor, rolledWindow, rng) {
  const floor = Number(rolledFloor) || 0;
  const window = Number(rolledWindow) || 0;
  if (window <= 0) return floor;
  const roll = typeof rng === 'function' ? rng : Math.random;
  return floor + Math.floor(roll() * (window + 1));
}

export function buildPotionPayload(potion, tic, rng) {
  if (!potion) {
    throw new Error('No potion');
  }
  const { effect_type, rolled_floor, rolled_window, duration_ticks, template_name } = potion;
  const effect = rollWindowEffect(rolled_floor, rolled_window, rng);
  if (effect_type === 'heal') {
    return { type: 'heal', amount: effect, name: template_name };
  }
  // buff types: speed | accuracy | damage
  if (duration_ticks == null || duration_ticks <= 0) {
    throw new Error('Buff potion missing duration_ticks');
  }
  return {
    type: effect_type,
    value: effect,
    durationTicks: duration_ticks,
    endTic: tic + duration_ticks,
    name: template_name
  };
}

export function applyPotionEffect(state, payload, tic) {
  if (payload.type === 'heal') {
    if (payload.amount == null || !Number.isFinite(payload.amount) || payload.amount <= 0) {
      throw new Error('Heal potion missing rolled_floor');
    }
    const before = state.player.hp;
    const cap = state.player.max_hp ?? PLAYER_MAX_HP; // config-driven max; fallback for legacy states
    state.player.hp = Math.min(cap, state.player.hp + payload.amount);
    return { kind: 'heal', healed: state.player.hp - before };
  } else {
    // buff branch
    const buff = createBuff(payload.name || `${payload.type} potion`, payload.value, payload.endTic, payload.type);
    state.buffs.push(buff);
    return { kind: 'buff', buff, payload };
  }
}
