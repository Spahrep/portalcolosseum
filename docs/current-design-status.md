# Current Design Status (as of 2026-08-30)

This file captures the current state of design decisions for Portal Colosseum. It is intended as a living reference until decisions are moved into more permanent documents.

## Weapon Generation (documented in weapon-generation.md)

- Base + Delta system for stats
- Normal distribution quality grading (S–F)
  - S-tier ≈ 0.15% (roughly 1 in 740, often communicated as ~1 in 1000)
  - A-tier ≈ 2.1%
- Attacks roll **independently** of weapon grade (current idea, subject to change)
- Weighted attack selection with weapon-type availability filters
- Multi-enemy attacks (Cleave, Whirlwind, etc.) do reduced damage per target

## Attack Slot System (documented in weapon-generation.md)

- **Slot 1 — Default "Attack"**: Every weapon has this; uses base stats unmodified (no modifiers)
- **Slot 2 — Additional Attack**: Always present; rolls from attack pools (filtered by weapon type)
- **Slot 3 — Optional Attack**: ~10% chance; pulls from any pool including spells.
**Status**: Current idea, subject to change.

## Item Behavior (GUI Demo)

- **Herb** item now has Consume vs Throw options (implemented in GUI demo)
  - Consume: Player restores health (demo text only)
  - Throw: Target a monster → Monster restores health (demo text only)
  - Thrown herbs become permanently unusable (`[-] <s>Herb</s>`)

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

5. **Item Types Beyond Weapons**
   - How herbs, bombs, and other consumables will work in the final system (currently only demo'd in GUI)

6. **Run Preparation Phase**
   - What "Prep for portal" actually allows players to do (equipment loadout, inventory management, etc.)

---

**Next Priority**: Decide whether to expand `weapon-generation.md`, create dedicated files (e.g. `item-system.md`, `run-economy.md`), or keep using this status file as a scratchpad.
