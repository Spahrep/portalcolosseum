// js/combat/potion-contract.js
// Pure ESM shared contract: potion slots, categories, effect payloads, timing formulas, and JSDoc typedefs.

export const POTION_SLOTS = ['A', 'B'];
export const POTION_CATEGORIES = ['heal', 'buff'];
export const BUFF_EFFECT_TYPES = ['speed', 'accuracy', 'damage'];
export const ALL_EFFECT_TYPES = ['heal', 'speed', 'accuracy', 'damage'];
export const HAND_LABELS = ['LH', 'RH'];
export const HAND_FREE_STATE = 'Ready';
export const POTION_ROW_EVENTS = { DRINKING: 'drinking', EFFECT: 'effect', RECOVERY: 'recovery' };
export const POTION_PHASES = ['in-battle', 'between-fights'];

/**
 * @param {number} weaponSpeed
 * @param {number} potionSpeed
 * @returns {number}
 */
export function potionPrePostTicks(weaponSpeed, potionSpeed) {
  const w = Math.max(0, Math.floor(Number(weaponSpeed) || 0));
  const p = Math.max(0, Math.floor(Number(potionSpeed) || 0));
  return Math.ceil((w + p) / 2);
}

/**
 * @param {number} weaponSpeed
 * @param {number} potionSpeed
 * @returns {number}
 */
export function potionTotalTicks(weaponSpeed, potionSpeed) {
  const w = Math.max(0, Math.floor(Number(weaponSpeed) || 0));
  const p = Math.max(0, Math.floor(Number(potionSpeed) || 0));
  return w + p;
}

/**
 * @typedef {'A' | 'B'} PotionSlot
 */

/**
 * @typedef {'heal' | 'speed' | 'accuracy' | 'damage'} PotionEffectType
 */

/**
 * @typedef {'heal' | 'buff'} PotionCategory
 */

/**
 * @typedef {Object} HealEffect
 * @property {'heal'} type
 * @property {number} amount
 */

/**
 * @typedef {Object} BuffEffect
 * @property {'speed' | 'accuracy' | 'damage'} type
 * @property {number} value
 * @property {number|null} durationTicks
 * @property {number} endTic
 */

/**
 * @typedef {HealEffect | BuffEffect} PotionEffectPayload
 */

/**
 * @typedef {Object} PotionUseRequest
 * @property {PotionSlot} slot
 * @property {'in-battle' | 'between-fights'} phase
 */

/**
 * @typedef {Object} PotionTiming
 * @property {number} preTicks
 * @property {number} postTicks
 * @property {number} totalTicks
 */

/**
 * @typedef {Object} CombatBuff
 * @property {string} name
 * @property {number} value
 * @property {number} endTic
 */

/**
 * @typedef {Object} PotionInstanceSummary
 * @property {string|number} instance_id
 * @property {string} template_name
 * @property {PotionEffectType} effect_type
 * @property {string} effect_label
 * @property {string} grade
 * @property {boolean} used
 */
