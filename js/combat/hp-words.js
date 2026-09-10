// js/combat/hp-words.js
// Pure ESM. HP word bands (secret max_hp). Never expose numbers.

export function getHpWord(currentHp, maxHp) {
  if (!maxHp || maxHp <= 0) return 'Critical';
  const pct = Math.floor((currentHp / maxHp) * 100);
  if (pct >= 76) return 'Healthy';
  if (pct >= 51) return 'Injured';
  if (pct >= 26) return 'Battered';
  return 'Critical';
}

export const HP_BANDS = {
  Healthy: [76, 100],
  Injured: [51, 75],
  Battered: [26, 50],
  Critical: [0, 25]
};
