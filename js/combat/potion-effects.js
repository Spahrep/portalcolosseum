// js/combat/potion-effects.js
// Pure ESM potion effect pipeline. No I/O. Exports buildPotionPayload and applyPotionEffect.

import { PLAYER_MAX_HP } from './participants.js';
import { createBuff } from './buffs.js';

export function buildPotionPayload(potion, tic) {
  if (!potion) {
    throw new Error('No potion');
  }
  const { effect_type, rolled_floor, duration_ticks, template_name } = potion;
  if (effect_type === 'heal') {
    return { type: 'heal', amount: rolled_floor, name: template_name };
  }
  // buff types: speed | accuracy | damage
  if (duration_ticks == null || duration_ticks <= 0) {
    throw new Error('Buff potion missing duration_ticks');
  }
  return {
    type: effect_type,
    value: rolled_floor,
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
