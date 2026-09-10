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
  let dmg = rollDamage(attacker.damage || 10, attacker.damage_range || 3, rng);
  if (!checkHit(attacker.accuracy || 80, rng)) {
    return [{ hit: false, damage: 0, targets: targets.map(t => t.label || t.id) }];
  }
  if (isMulti) {
    dmg = multiTargetReduction(dmg, targets.length);
  }
  for (const t of targets) {
    if (t.type === 'player') t.hp = Math.max(0, t.hp - dmg);
    else t.current_hp = Math.max(0, t.current_hp - dmg);
    results.push({ hit: true, damage: dmg, target: t.label || t.id });
  }
  return results;
}
