// js/combat/damage.js
// Pure ESM. base ± delta, accuracy check (MVP roll vs accuracy), multi-target reduction.

export function rollDamage(base, delta, rng = Math.random) {
  if (!delta || delta <= 0) return base;
  const spread = Math.floor(rng() * (delta * 2 + 1)) - delta;
  return Math.max(1, base + spread);
}

export function checkHit(accuracy, rng = Math.random) {
  return rng() * 100 < accuracy;
}

export function multiTargetReduction(damage, numTargets) {
  if (!numTargets || numTargets <= 1) return damage;
  return Math.max(1, Math.floor(damage / numTargets));
}

export function resolveAttack(attacker, targets, attack, rng = Math.random) {
  const results = [];
  const isMulti = attack && attack.is_multi_target;
  let dmg = rollDamage(attacker.damage || 10, attacker.damage_range ?? 3, rng);
  if (!checkHit(attacker.accuracy || 80, rng)) {
    return [{ hit: false, damage: 0, targets: targets.map(t => t.label || t.id) }];
  }
  if (isMulti) {
    dmg = multiTargetReduction(dmg, targets.length);
  }
  // PC-72/PC-73: crit rolls PER TARGET inside the hit path only — a miss never
  // reaches here, so misses can't crit. Chance = attacker.critChance (instance
  // crit × attack factor, computed by the caller). 0% is a data value: no roll
  // is even consumed when critChance is 0, keeping RNG streams stable for
  // legacy states/tests that predate crit.
  const critChance = Number(attacker.critChance) || 0;
  const critMultiplier = Number(attacker.critMultiplier) || 2.0;
  for (const t of targets) {
    let d = dmg;
    let crit = false;
    if (critChance > 0 && rng() * 100 < critChance) {
      d = Math.round(d * critMultiplier);
      crit = true;
    }
    if (t.type === 'player') t.hp = Math.max(0, t.hp - d);
    else t.current_hp = Math.max(0, t.current_hp - d);
    results.push(crit ? { hit: true, damage: d, target: t.label || t.id, crit: true } : { hit: true, damage: d, target: t.label || t.id });
  }
  return results;
}
