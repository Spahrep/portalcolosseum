// tests/fixtures/potion-fixtures.js
// Potion fixture objects and exact CLI parity snapshot strings for PC-39 e2e tests.
// Queue order is the ordering key (tics ascending, player rows first on ties).
// PC-DEC-060: battle start does not log a tic-0 prepares line. The live clock
// pauses on the first ready head, so a second approach behind that head does
// not fire until the player commits. Snapshots follow tick(), not the retired
// walker that skipped ready rows.

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
  "tic 1 — LH Ready",
  "Your left hand drinks Heal Potion...",
  "Your left hand's potion restores 100 HP.",
  "Potion A used — in battle.  HP: 900/1000  buffs: none",
  "#1 Heal Potion Heal grade C (used)",
  "#2 Dmg Potion Dmg grade B"
];

export const betweenFightsHealSnapshot = [
  "tic 1 — LH Ready",
  "You drink potion a — healed 100.",
  "Potion A used — between fights.  HP: 900/1000  buffs: none",
  "#1 Heal Potion Heal grade C (used)"
];

export const overhealSnapshot = [
  "tic 1 — LH Ready",
  "Your left hand drinks Heal Potion...",
  "Your left hand's potion restores 10 HP.",
  "Potion A used — in battle.  HP: 1000/1000  buffs: none"
];

export const buffLandSnapshot = [
  "tic 1 — LH Ready",
  "Your left hand drinks Dmg Potion...",
  "tic 1 — RH Ready",
  "tic 1 — RH prepares to Hold...",
  "Your left hand's potion grants damage +3 until tic 11.",
  "Potion A used — in battle.  HP: 1000/1000  buffs: damage +3 until tic 11",
  "#2 Dmg Potion Dmg grade B (used)"
];

export const buffExpirySnapshot = [
  "tic 1 — LH Ready",
  "Your left hand drinks Dmg Potion...",
  "tic 1 — RH Ready",
  "tic 1 — RH prepares to Hold...",
  "Your left hand's potion grants damage +3 until tic 4.",
  "tic 3 — LH Ready",
  "tic 3 — LH prepares to Hold...",
  "The Dmg Potion buff fades.",
  "Potion A used — in battle.  HP: 1000/1000  buffs: none"
];
