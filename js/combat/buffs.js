// js/combat/buffs.js
// Pure ESM. Flat/additive buffs with end tics. MVP primitives only.

export function createBuff(name, value, endTic, type) {
  return { name, value, endTic, type };
}

export function applyBuffs(buffs, currentTic, type) {
  let mod = 0;
  for (const b of buffs) {
    if (b.endTic > currentTic && b.type === type) mod += b.value;
  }
  return mod;
}

export function expireBuffs(buffs, currentTic) {
  return buffs.filter(b => b.endTic > currentTic);
}
