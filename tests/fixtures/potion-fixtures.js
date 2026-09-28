// tests/fixtures/potion-fixtures.js
// Potion fixture objects and exact CLI parity snapshot strings for PC-39 e2e tests.
// Insertion-order queue: monster rows are inserted before approach rows, so the
// first monster action lands at tic 6 before either hand is Ready. Newly committed
// potion rows sit behind whatever was already queued.

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
  "tic 6 — A hits player for 7",
  "tic 6 — LH Ready",
  "tic 6 — RH Ready",
  "Your left hand drinks Heal Potion...",
  "tic 12 — mob A prepares an attack...",
  "Your left hand's potion restores 100 HP.",
  "Potion A used — in battle.  HP: 893/1000  buffs: none",
  "#1 Heal Potion Heal grade C (used)",
  "#2 Dmg Potion Dmg grade B"
];

export const betweenFightsHealSnapshot = [
  "tic 0 — mob A prepares an attack...",
  "tic 6 — A hits player for 7",
  "tic 6 — LH Ready",
  "tic 6 — RH Ready",
  "You drink potion a — healed 100.",
  "Potion A used — between fights.  HP: 893/1000  buffs: none",
  "#1 Heal Potion Heal grade C (used)"
];

export const overhealSnapshot = [
  "tic 0 — mob A prepares an attack...",
  "tic 6 — A hits player for 7",
  "tic 6 — LH Ready",
  "tic 6 — RH Ready",
  "Your left hand drinks Heal Potion...",
  "tic 12 — mob A prepares an attack...",
  "Your left hand's potion restores 17 HP.",
  "Potion A used — in battle.  HP: 1000/1000  buffs: none"
];

export const buffLandSnapshot = [
  "tic 0 — mob A prepares an attack...",
  "tic 6 — A hits player for 7",
  "tic 6 — LH Ready",
  "tic 6 — RH Ready",
  "Your left hand drinks Dmg Potion...",
  "tic 12 — mob A prepares an attack...",
  "Your left hand's potion grants damage +3 until tic 17.",
  "Potion A used — in battle.  HP: 993/1000  buffs: damage +3 until tic 17",
  "#2 Dmg Potion Dmg grade B (used)"
];

export const buffExpirySnapshot = [
  "tic 0 — mob A prepares an attack...",
  "tic 6 — A misses",
  "tic 6 — LH Ready",
  "tic 6 — RH Ready",
  "Your left hand drinks Dmg Potion...",
  "tic 12 — mob A prepares an attack...",
  "Your left hand's potion grants damage +3 until tic 14.",
  "tic 18 — A hits player for 7",
  "The Dmg Potion buff fades.",
  "Potion A used — in battle.  HP: 993/1000  buffs: none"
];
