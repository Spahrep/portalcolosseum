// Loot generation for Portal Colosseum
// Pure functions for computing drops from monster fights

/**
 * normalInt(mean, range) — Box-Muller transform returning integer ±range from mean
 * Clamped to [mean-range, mean+range]
 */
export function normalInt(mean, range, rng = Math.random) {
  if (!range) return mean;
  // Box-Muller
  let u1 = rng();
  let u2 = rng();
  let z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  let val = Math.round(mean + z * (range / 3)); // 3-sigma = range
  return Math.max(mean - range, Math.min(mean + range, val));
}

/**
 * Weighted random pick from an array of {weight} items.
 * Returns the item or null if empty.
 */
export function weightedPick(items, rng = Math.random) {
  if (!items || items.length === 0) return null;
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (totalWeight <= 0) return items[Math.floor(rng() * items.length)];
  let roll = rng() * totalWeight;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Run the loot drop algorithm for a fight.
 * Returns { weaponTemplateIds: number[], gold: number }
 *
 * @param {number} lpBudget - Total LP for this fight
 * @param {Array<{weapon_template_id, lp_cost, weight}>} lootTable - Combined loot entries
 * @param {number} combinedMinGold - Sum of monster min_gold
 * @param {number} combinedMaxGold - Sum of monster max_gold
 * @param {function} rng
 */
export function generateLoot(lpBudget, lootTable, combinedMinGold, combinedMaxGold, rng = Math.random) {
  const weaponTemplateIds = [];
  let remainingLP = lpBudget;
  const maxDrops = 10;

  // Filter affordable items
  let affordable = lootTable.filter(item => item.lp_cost <= remainingLP);

  while (affordable.length > 0 && weaponTemplateIds.length < maxDrops) {
    const pick = weightedPick(affordable, rng);
    if (!pick) break;
    weaponTemplateIds.push(pick.weapon_template_id);
    remainingLP -= pick.lp_cost;
    affordable = lootTable.filter(item => item.lp_cost <= remainingLP);
  }

  // Gold: Box-Muller centered on midpoint
  let gold = 0;
  if (combinedMaxGold > 0) {
    const mean = (combinedMinGold + combinedMaxGold) / 2;
    const range = combinedMaxGold - combinedMinGold;
    gold = Math.round(mean); // Use mean for MVP simplicity if range is 0
    if (range > 0) {
      gold = normalInt(mean, range / 2, rng); // half-range = big spread
    }
    gold = Math.max(combinedMinGold, Math.min(combinedMaxGold, gold));
  }

  return { weaponTemplateIds, gold };
}
