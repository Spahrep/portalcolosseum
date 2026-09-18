# Combat System

## Player Stats

- **Starting HP**: 1,000 — the live value comes from `game_config.starting_hp`,
  not a hard-coded literal (PC-DEC-045, Decided by Spahrep, 2026-09-17); the
  engine constant (1000) is only the offline fallback default.

## Core Mechanics

Combat operates on a **tic-based** system rather than strict turn-based alternation with enemies.

- Attacks and spells have:
  - **Prepare time**: Duration before the action resolves
  - **Cooldown time**: Duration after resolution before the player can input the next action
- Different abilities have different prepare/cooldown profiles, creating tactical depth and timing decisions.
- **Accuracy**: every player attack rolls to-hit — the weapon's **accuracy** is the % chance
  to land; a miss deals 0 damage and is logged ("attacks misses"). Shipped (PC-54,
  Spahrep 2026-09-15); confirmed: "Players use accuracy." (Spahrep 2026-09-16)

## Randomness Integration

All combat outcomes incorporate variance:
- Damage ranges (base ± delta)
- Individual attack variance on top of base ranges
- **Attack damage multipliers are base ± range, even (uniform) spread** — e.g.
  Heavy Chop x1.5 rolls 1.3–1.7 (EV stays 1.5); stored as
  `base_damage_multiplier_range` on the attack table (0 = no variance); monster
  damage = mean ± σ via the `damage_variance` column (Box-Muller). (PC-DEC-047,
  Decided by DarkJester, 2026-09-17; shipped on branch wt/pc-65.)
- Monster stats and behavior include randomness

## Monster Stats

- Each monster has a **base MaxHP and a maxHP delta**, rolled per instance (see
  `battle-status-ui.md` — the rolled max is secret; the player knows the species base
  at best, never the instance value).
- **The maxHP delta is rolled with an EVEN (uniform) distribution**, not a bell curve
  (Spahrep 2026-09-08). Every value in the delta range is equally likely — a blue slime
  with 90 HP is just as likely as one with 110 HP. This keeps the HP secret genuinely
  unpredictable: the uncertainty doesn't erode with play the way a bell curve's
  mean-clustering would.
- Other monster stat rolls (damage, speed, accuracy) use the Box-Muller `normal_int()` bell curve (2026-09-15 — see current-design-status.md § Monster Stats).
- **PMVP (Spahrep 2026-09-13):** certain attacks unlock when a monster reaches a certain HP threshold.

## Encounters Are Groups (1–5 Monsters)

Battles in portal runs are **groups of monsters**, not single encounters. The number and composition of each group is determined by the zombie-dice encounter system (see `encounter-system.md`). A single combat may involve 1 to 5 monsters simultaneously.

The existing "multi-enemy attack" concept (Cleave, Whirlwind, etc.) becomes core to group combat — these attacks do reduced damage per target but can hit multiple monsters in a single group.

## Critical Strikes (MVP — decided by Spahrep, 2026-09-18, PC-DEC-050/051)

- **Formula**: final crit chance = instance crit_chance × attack crit_factor. Both sides (player and monster) use the same formula.
- **Weapon instance crit_chance**: rolled from weapon_template.crit_base ± crit_range (uniform roll). Backfilled to 5% for all existing instances.
- **Monster instance crit_chance**: rolled from monster_template.crit_base ± crit_range (uniform roll). Backfilled to 5% for all existing monsters.
- **Attack crit_factor**: per-attack multiplier against the instance crit chance (MVP baseline: 1.1 for all existing attacks). crit_multiplier: damage multiplier on crit (MVP baseline: ×2.0).
- **No floor, no ceiling**: a chance over 100% always crits; no upper clamp — "swings of outrageous fortune" is the design.
- **Misses can't crit**: accuracy is rolled first; a miss deals 0 regardless of crit roll.
- **Multi-target attacks**: crit chance is rolled independently per target.
- **Potions**: crit off their own rate (consumable_template.crit_base/range → rolled into consumable_instance.crit_chance), unaffected by weapon in hand. Crit effect amplification: game_config.potion_crit_effect_multiplier (1.5 = +50% effect) and potion_crit_duration_multiplier (1.5 = +50% duration). Heal potion crit = 1.5× heal amount; buff potion crit = 1.5× magnitude + 1.5× duration; potions with no duration get only the effect boost.
- **Fist**: fist_crit_chance in game_config (5 default, ×2.0 multiplier) — no attack path is crit-dead.
- **UI**: combat feed lines show "CRITICAL!" tag on crit. Weapon info screens/mouseovers display computed crit chance per attack (instance crit × factor) and the crit multiplier.
- **CLI**: display and set crit on weapons/potions (god mode).
- **Item grade**: crit stays out of the F→S grade formula this pass (everything flat at 5% — a no-op). PMVP: integrate crit into grading when it becomes a varied stat.
- **Schema**: migration 20260918120000_crit_strikes.sql adds crit columns to attack, weapon_template, weapon_instance, monster_template, consumable_template, consumable_instance, and game_config tables. Shipped on main.

## Future Considerations

- Procedural weapon attack slots (Simple/Advanced/Magic) with point budgets for balance
- Different weapon types (Sword, Axe, Staff, etc.) may have unique slot rules and stat ranges
- Strong alignment with "randomness at all stages" principle
