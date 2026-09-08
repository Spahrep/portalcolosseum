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
 * Weighted random picker (extracted for test coverage of weapon/slot/loot logic).
 * Handles empty, zero/neg weights, bounds.
 */
export function weightedPick(pool, weightFn) {
  if (!pool || pool.length === 0) return null;
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
  let roll = Math.random() * total;
  for (const v of valid) {
    roll -= v.w;
    if (roll <= 0) return v.item;
  }
  return valid[valid.length - 1].item;
}
