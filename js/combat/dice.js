/**
 * Dice / Encounter engine (PC-16)
 * Pure ESM, no hardcodes for faces or pool sizes (all inputs from DB via caller).
 * drawRandomDie: uniform random draw from remaining dice list (no replacement handled by caller/DB)
 * rollDieFace: uniform from the color's faces array
 * selectMonsterGroup: weighted selection loop (weightedPick), max 5, 5th=largest affordable, fallback cheapest if budget too low
 */

import { weightedPick } from '../pure-utils.js';

export function drawRandomDie(remainingDice) {
  if (!remainingDice || remainingDice.length === 0) return null;
  const idx = Math.floor(Math.random() * remainingDice.length);
  return remainingDice[idx];
}

export function rollDieFace(color, facesByColor) {
  if (!facesByColor || !facesByColor[color] || facesByColor[color].length === 0) return 0;
  const faces = facesByColor[color];
  const idx = Math.floor(Math.random() * faces.length);
  return faces[idx];
}

export function selectMonsterGroup(budget, mappings) {
  if (!mappings || mappings.length === 0 || budget <= 0) return [];
  const group = [];
  let remaining = budget;

  for (let i = 0; i < 5; i++) {
    const affordable = mappings.filter(m => (m.point_cost || 0) <= remaining);
    if (affordable.length === 0) break;

    let picked;
    if (i === 4) {
      // last monster: largest possible remaining value
      const maxCost = Math.max(...affordable.map(m => m.point_cost || 0));
      const maxAffordable = affordable.filter(m => (m.point_cost || 0) === maxCost);
      picked = maxAffordable[Math.floor(Math.random() * maxAffordable.length)];
    } else {
      picked = weightedPick(affordable, (item) => item.weight);
    }
    if (!picked) break;
    group.push({ monster_template_id: picked.monster_template_id, point_cost: picked.point_cost });
    remaining -= picked.point_cost;
  }

  // Edge: if no monsters selected (budget < cheapest), pick cheapest anyway
  if (group.length === 0) {
    let cheapest = mappings[0];
    for (const m of mappings) {
      if ((m.point_cost || Infinity) < (cheapest.point_cost || Infinity)) cheapest = m;
    }
    if (cheapest) {
      group.push({ monster_template_id: cheapest.monster_template_id, point_cost: cheapest.point_cost });
    }
  }

  return group;
}
