# Current Design Status (as of 2026-08-30)

This file captures the current state of design decisions for Portal Colosseum. It is intended as a living reference until decisions are moved into more permanent documents.

## Weapon Generation (documented in weapon-generation.md)

- Base + Delta system for stats
- All stats rolled **independently** before classification
- Normal distribution quality grading (S–F), applied **after** all stats are rolled — it's a UI label, not an input
  - S-tier ≈ 0.15% (roughly 1 in 740, often communicated as ~1 in 1000)
  - A-tier ≈ 2.1%
- Attacks roll **independently** of weapon grade (current idea, subject to change)
- Weighted attack selection via `weapon_template_attack_mapping.weight` column
- Multi-enemy attacks (Cleave, Whirlwind, etc.) do reduced damage per target

## Attack Slot System (documented in weapon-generation.md)

- **Slot 0 — Default "Attack"**: Every weapon has this; uses base stats unmodified. Stored as `slot_0_attack_id` (NOT NULL FK → attack.id) on `weapon_template` and `weapon_instance`.
- **Slots 1–4 — Additional Attacks**: Pool membership comes from the `weapon_template_attack_mapping` junction table (weapon_template → attack × slot) via FK integer IDs. Each slot has a `slot_N_chance` column (0.0–1.0) in `weapon_template` controlling activation probability. The mapping table also has a `weight` column (real, default 1.0) for weighted random selection within each slot. Max total attacks = 5 (Slot 0 + up to 4 configurable slots).

## Item Behavior (GUI Demo)

- **Herb** item now has Consume vs Throw options (implemented in GUI demo)
  - Consume: Player restores health (demo text only)
  - Throw: Target a monster → Monster restores health (demo text only)
  - Thrown herbs become permanently unusable (`[-] <s>Herb</s>`)

## Encounter System (documented in encounter-system.md)

- Zombie-dice style system for generating portal run battles
- Each portal has a dice pool (e.g., 10 dice) with colored dice (green/yellow/red)
- Color = risk profile, not monster type
- Dice drawn **without replacement** — pool shrinks over the 5 battles
- Player sees full color distribution before starting; tracks remaining dice throughout
- Die selection is random (player doesn't choose), with tension-building animation
- Die roll produces a **point budget** → spent on a monster group (1–5 monsters) via weighted selection from per-portal monster mapping table
- Max 5 monsters per battle; 5th monster absorbs remaining points
- Battles are **groups of monsters**, not single encounters — multi-enemy attacks (Cleave, Whirlwind) become core

## Portal Runs (documented in portal-runs.md)

- 5 encounters per run
- Option to stop after each fight and keep a reduced % of loot (random selection)
- Full clear = keep all loot
- Death = keep small number of items (1–2 randomly chosen)

## Open / Undocumented Points

The following topics have been discussed but are not yet formally documented:

1. **Inventory Limits**
   - Max inventory size when outside of a portal run (mentioned but no numbers or rules defined)

2. **Starting Equipment**
   - All players start with the same equipment (to be defined later)

3. **Loot Rules on Stop / Death**
   - Exact percentages for stopping early
   - Exact number of items kept on death
   - How random selection works (uniform? weighted by rarity?)

4. **Multi-Enemy Attack Balance**
   - How much less damage cleave/whirlwind style attacks do per target compared to single-target attacks
   - Whether this reduction is fixed or scales with weapon quality
   - Now higher priority since encounters are confirmed to be multi-monster groups

5. **Item Types Beyond Weapons**
   - How herbs, bombs, and other consumables will work in the final system (currently only demo'd in GUI)

6. **Run Preparation Phase**
   - What "Prep for portal" actually allows players to do (equipment loadout, inventory management, etc.)

7. **Encounter System Open Questions** (see encounter-system.md)
   - Does the player see exact dice face values, or just colors?
   - 5th monster absorption: pick closest-cost monster, or upgrade template to match remaining budget?
   - Dice pool size and composition per portal tier (database configuration)
   - Face value calibration (actual numbers, not the example 10/20/30)
   - Point-to-loot relationship: does higher point budget yield better loot?

---

**Next Priority**: Decide whether to expand `weapon-generation.md`, create dedicated files (e.g. `item-system.md`, `run-economy.md`), or keep using this status file as a scratchpad.