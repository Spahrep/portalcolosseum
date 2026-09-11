# Encounter System (Zombie-Dice Style)

**Status:** Decided — mechanic is locked, numbers are TBD
**Updated:** 2026-09-07

## Overview

Each portal run consists of **5 battles**. Each battle is a **group of monsters** (1–5 monsters). The group is chosen through a zombie-dice style system: dice are drawn from a portal-specific pool, rolled for a point budget, and that budget is spent on monsters.

## Dice Pool

Each portal has a **dice pool** (e.g., 10 dice). Dice are drawn **without replacement** — once a die is used to create a battle, it is removed from the pool for the rest of the run.

### Dice Colors

Color = risk profile, not monster type.

| Color | Risk | Face Distribution (example shape) |
|-------|------|-----------------------------------|
| Green | Safer | More low-value faces — e.g. 3×10, 2×20, 1×30 |
| Yellow | Mixed | Even spread — e.g. 2×10, 2×20, 2×30 |
| Red | Dangerous | More high-value faces — e.g. 1×10, 3×20, 3×30 |

Each face is a **point value** (threat budget for that battle). A red die is more likely to roll a high-point battle. A green die is more likely to roll a low-point battle.

> **The numbers above are examples of the *shape* of the dice, not real balance.** Final face values will not be a 3× spread. Do not treat 10 / 20 / 30 as locked.

### Pool Configuration

Dice pool composition (how many dice, color mix, face values) is **per-portal**, stored in database tables. The system is global; the pools are per-portal configuration via a mapping table.

### Dice State (Schema)

- **Decided 2026-09-11:** Dice state is normalized, not JSONB — `portal_run_dice`, one row per die in the run's pool (color, face, drawn_battle, rolled_value). The pool is materialized at run creation from the portal's dice counts; dice are drawn without replacement per battle (drawn_battle set, die leaves the pool).
- **Decided 2026-09-11:** The CLI/test harness state shows exact die faces and the point budget (playtesting transparency).

## Player Visibility

- **Before starting**: Player sees the full dice distribution (colors) for the portal.
- **During the run**: Player always knows which dice remain in the pool. Any stop/continue decision is made with full knowledge of remaining dice.
- **Face values**: Whether the player sees exact face values or just colors is **TBD** (see Open Questions).
- **Die selection**: Player does **not** choose which die to roll — it is a random draw from the remaining pool.
- **Selection UX**: Die selection is shown with a tension-building animation (e.g., roulette wheel style) to build anticipation before each battle.

## Battle Generation

1. Draw a die randomly from the remaining pool (player does not choose).
2. Roll the die → result is that battle's **point budget**.
3. Use the point budget to select a monster group (see Monster Selection below).
4. Die is removed from the pool (no replacement).
5. Repeat for each of the 5 battles.

## Monster Selection

Once a point budget is determined, the game selects a monster group:

1. Look up the monster mapping for this portal (database table).
2. Filter: all monsters valid for this portal with point cost ≤ remaining budget.
3. Weighted random selection from the filtered list → pick one monster.
4. Subtract that monster's cost from remaining budget.
5. Repeat steps 2–4 until:
   - No monsters cost ≤ remaining points, **OR**
   - Max 5 monsters reached.

### Rules

- **Max monsters per battle**: 5
- **Min monsters per battle**: 1
- **5th monster**: Takes the largest possible remaining value (absorbs remaining points).
- **Edge case**: If rolled points are less than the cheapest monster's cost, select the cheapest possible monster anyway. (This should not happen with proper portal configuration — it's a fallback safety check.)
- **Variable group size**: A combat can be any number of monsters from 1 to 5. A 50-point battle with 2×25-point monsters is just as valid as a 50-point battle with 5×10-point monsters.

### Monster Mapping (Database)

- Per-portal mapping of valid monsters.
- Each monster has: **point cost** and **weight** (selection probability).
- Selection uses weighted random from eligible monsters (those with cost ≤ remaining budget).
- This mirrors the existing `weapon_template_attack_mapping` pattern (weighted selection from a filtered pool).

## Open Questions

1. **Face value visibility**: Does the player see exact face values on the dice, or just colors? (Colors-only = more surprise; full values = deeper strategy. TBD via playtesting.)
2. **5th monster absorption**: When the 5th monster takes the largest possible remaining value — does it pick the closest-cost monster from the mapping, or does it "upgrade" a template to match the remaining budget exactly?
3. **Dice pool size and composition per portal**: How many dice, what color mix per portal tier — needs to be defined per portal in the database.
4. **Face value calibration**: Actual face values need to be determined (not the example 10/20/30).
5. **Point-to-loot relationship**: Does a higher point budget battle yield better loot, or does loot scale purely by fight number within the run? (See `loot-prize-pool.md`.)

## Integration with Existing Systems

- **Portal Runs** (`portal-runs.md`): This replaces the "Difficulty Distribution" options. The 5-battle / stop-or-continue / prize pool structure remains unchanged.
- **Combat System** (`combat-system.md`): Battles are now groups of monsters (1–5), not single encounters. The tic-based combat system needs to support multi-enemy fights. (The existing "multi-enemy attack" concept — Cleave, Whirlwind — becomes more relevant.)
- **Progression Gating** (`progression-gating.md`): Higher portals can have more red dice / fewer green dice in their pools, encoding difficulty progression through pool composition.
- **Loot & Prize Pool** (`loot-prize-pool.md`): Loot quality may scale with the point budget of individual battles, fight number, or both — TBD.
