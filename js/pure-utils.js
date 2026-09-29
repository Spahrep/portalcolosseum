/**
 * Pure testable utilities (no DOM, no browser, no network).
 * Extracted from utils.js for testability without behavior change.
 */

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Weighted random picker. rng-injectable; default mode matches the historical
 * pure-utils / dice behavior (skip non-positive weights, null if none remain).
 *
 * mode 'inclusive' is the loot.js contract: sum raw weights, and if the total
 * is <= 0 pick uniformly from the original pool instead of returning null.
 * Callers that pass only (pool, weightFn) are unchanged.
 */
export function weightedPick(pool, weightFn, rng = Math.random, opts = {}) {
  if (!pool || pool.length === 0) return null;
  if (opts.mode === 'inclusive') {
    const totalWeight = pool.reduce((s, item) => s + weightFn(item), 0);
    if (totalWeight <= 0) return pool[Math.floor(rng() * pool.length)];
    let roll = rng() * totalWeight;
    for (const item of pool) {
      roll -= weightFn(item);
      if (roll <= 0) return item;
    }
    return pool[pool.length - 1];
  }
  let total = 0;
  const valid = [];
  for (const item of pool) {
    const w = weightFn(item) || 0;
    if (w > 0) {
      valid.push({ item, w });
      total += w;
    }
  }
  if (valid.length === 0 || total <= 0) return null;
  let roll = rng() * total;
  for (const v of valid) {
    roll -= v.w;
    if (roll <= 0) return v.item;
  }
  return valid[valid.length - 1].item;
}
