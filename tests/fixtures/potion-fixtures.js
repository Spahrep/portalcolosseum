// tests/fixtures/potion-fixtures.js
// Potion fixture objects and exact CLI parity snapshot strings for PC-39 e2e tests.
// Generated from seeded engine runs (seeds 100-103) to guarantee deterministic parity.

export const healPotion = {
  id: 1,
  template_name: 'Heal Potion',
  effect_label: 'Heal',
  effect_type: 'heal',
  grade: 'C',
  rolled_floor: 100,
  rolled_speed: 0,
  duration_ticks: 0,
  used: false
};

export const buffPotion = {
  id: 2,
  template_name: 'Dmg Potion',
  effect_label: 'Dmg',
  effect_type: 'damage',
  grade: 'B',
  rolled_floor: 3,
  rolled_speed: 6,
  duration_ticks: 5,
  used: false
};

export const inBattleHealSnapshot = [
  "Your left hand drinks Heal Potion (0 tics)…",
  "Your left hand's potion restores 100 HP.",
  "Potion A used — in battle.  HP: 900/1000  buffs: none",
  "#1 Heal Potion Heal grade C (used)",
  "#2 Dmg Potion Dmg grade B"
];

export const betweenFightsHealSnapshot = [
  "You drink potion a — healed 100.",
  "Potion A used — between fights.  HP: 900/1000  buffs: none",
  "#1 Heal Potion Heal grade C (used)"
];

export const overhealSnapshot = [
  "Your left hand drinks Heal Potion (0 tics)…",
  "Your left hand's potion restores 10 HP.",
  "Potion A used — in battle.  HP: 1000/1000  buffs: none"
];

export const buffLandSnapshot = [
  "Your left hand drinks Dmg Potion (5 tics)…",
  "Your left hand's potion grants damage +3 until tic 9.",
  "tic 4 — A hits player for 7",
  "Potion A used — in battle.  HP: 993/1000  buffs: damage +3 until tic 9",
  "#2 Dmg Potion Dmg grade B (used)"
];

// Short-duration buff (2 tics) drank at weaponSpeed 0, seed 106: lands at tic 0
// (endTic 2), hand recovers at tic 1, buff expires at tic 2 — full transcript
// including the expiry narration and the 'buffs: none' summary.
export const buffExpirySnapshot = [
  "Your left hand drinks Dmg Potion (1 tics)…",
  "Your left hand's potion grants damage +3 until tic 2.",
  "tic 1 — LH Ready",
  "The Dmg Potion buff fades.",
  "Potion A used — in battle.  HP: 1000/1000  buffs: none"
];
