// tests/fixtures/potion-fixtures.js
// Potion fixture objects and exact CLI parity snapshot strings for PC-39 e2e tests.
// Updated 2026-09-22 to match current engine timing (1-tic shift in Ready and landing after engine changes).

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
  "tic 0 — mob A prepares an attack...",
  "tic 1 — LH Ready",
  "tic 1 — RH Ready",
  "Your left hand drinks Heal Potion...",
  "Your left hand's potion restores 100 HP.",
  "Potion A used — in battle.  HP: 900/1000  buffs: none",
  "#1 Heal Potion Heal grade C (used)",
  "#2 Dmg Potion Dmg grade B"
];

export const betweenFightsHealSnapshot = [
  "tic 0 — mob A prepares an attack...",
  "tic 1 — LH Ready",
  "tic 1 — RH Ready",
  "You drink potion a — healed 100.",
  "Potion A used — between fights.  HP: 900/1000  buffs: none",
  "#1 Heal Potion Heal grade C (used)"
];

export const overhealSnapshot = [
  "tic 0 — mob A prepares an attack...",
  "tic 1 — LH Ready",
  "tic 1 — RH Ready",
  "Your left hand drinks Heal Potion...",
  "Your left hand's potion restores 10 HP.",
  "Potion A used — in battle.  HP: 1000/1000  buffs: none"
];

export const buffLandSnapshot = [
  "tic 0 — mob A prepares an attack...",
  "tic 1 — LH Ready",
  "tic 1 — RH Ready",
  "Your left hand drinks Dmg Potion...",
  "tic 5 — A hits player for 7",
  "tic 5 — mob A prepares an attack...",
  "Your left hand's potion grants damage +3 until tic 11.",
  "Potion A used — in battle.  HP: 993/1000  buffs: damage +3 until tic 11",
  "#2 Dmg Potion Dmg grade B (used)"
];

export const buffExpirySnapshot = [
  "tic 0 — mob A prepares an attack...",
  "tic 1 — LH Ready",
  "tic 1 — RH Ready",
  "Your left hand drinks Dmg Potion...",
  "Your left hand's potion grants damage +3 until tic 4.",
  "tic 3 — LH Ready",
  "The Dmg Potion buff fades.",
  "Potion A used — in battle.  HP: 1000/1000  buffs: none"
];
