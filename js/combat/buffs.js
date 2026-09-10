// js/combat/buffs.js
// Pure ESM. Flat/additive buffs with end tics. MVP primitives only.

export function createBuff(name, value, endTic) {
  return { name, value, endTic };
}

export function applyBuffs(participant, buffs, currentTic) {
  // MVP: flat additive to damage/accuracy etc. Expiry handled by engine.
  let mod = 0;
  for (const b of buffs) {
    if (b.endTic > currentTic) mod += b.value;
  }
  return mod;
}

export function expireBuffs(buffs, currentTic) {
  return buffs.filter(b => b.endTic > currentTic);
}
