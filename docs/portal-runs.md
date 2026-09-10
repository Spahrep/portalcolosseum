# Portal Runs

**Updated:** 2026-09-10 — X fights per run via config (portal_template.fights, default 5)

## MVP Structure

- Each portal run consists of **X combats** — the count lives on `portal_template.fights` (config, default 5). Portal 1 = 5 via config, not hardcoded (Spahrep 2026-09-10).
- After each combat the player chooses: **Continue** or **Stop**
- Loot received after each fight is added to a **prize pool**
- **Finishing the run** awards the full prize pool
- **Stopping early** awards a reduced portion of the pool (exact % TBD)
- **Dying** = kicked out of the portal, **prize pool forfeited**. Items you BROUGHT IN are never lost — you only lose what you hadn't banked yet.
- **No inventory access between fights.** The 5-item loadout (Hand L, Hand R, Belt Loop, Potion A, Potion B) is locked at entry — see `inventory-slots.md` and `consumables.md`.

## Portal Tiers = Item Power Tiers

- Each portal is a **big step up in difficulty** with its **own loot pool and enemies**.
- The portal you clear defines the ceiling of what you can hold from it:
  - Portal 1: short swords that top out at ~30 damage even at S-tier
  - Portal 3: Elvish Longswords that top out at ~40 damage (examples; numbers TBD)
- Grade (D–S) is a *within-tier* quality scale; portal tier is a *between-tier* power scale. An S-tier short sword is still a short sword.
- The leaderboard's "Portal 5, fight 3" is a statement of what gear you can have — gear becomes proof of progress.
- This structurally prevents Portal 1 farming from ever producing Portal 3 gear — the anti-grind gate that AP math alone can't provide.

## Entry Costs

- A portal run costs **X AP + Y gold** to enter.
- Deeper portals cost more: Portal 2 = X AP + 4×Y gold (example only; exact scaling TBD).
- Entry cost is an economic gate that taxes deep-portal farming, mirroring the loot gate.

## Anti-Soft-Lock (design rule)

**A player must always have at least one portal they can profitably clear.**

- Unlocking a portal is **permission, not replacement** — old portals stay farmable forever.
- Scenario this prevents: a god-run on Portal 1 unlocks Portal 2, but the player's gear can't survive Portal 2's first fight. If Portal 1 vanished, they'd be stuck with no income source — a dead game.
- The entry cost gates, but never *prevents* entry — the portal is a dare, not a wall.
- The worst case for a failed deep portal is "back to farming the previous portal," which is a fine worst case.
- PMVP crafting/enchanting will also make lower portals a deliberate harvest ground for specific drops.

## Difficulty Distribution (Zombie-Dice System)

**Decided:** Difficulty is distributed via a zombie-dice style system. See `encounter-system.md` for full details.

Summary:
- Each portal has a **dice pool** (e.g., 10 dice) with colored dice (green/yellow/red) representing risk profiles.
- Dice are drawn **without replacement** — each die is removed from the pool after creating a battle.
- Player sees the full color distribution before starting and tracks remaining dice throughout the run.
- Die selection is random (player does not choose) with a tension-building animation (e.g., roulette wheel).
- Each die roll produces a **point budget** for that battle, which is spent on a monster group (1–5 monsters) via weighted selection from a per-portal monster mapping table.

## Loot Scaling

Loot value may be influenced by:
- Fight number within the run
- Overall portal difficulty
- Combination of both

Exact formula is TBD and will be calibrated during implementation.

## Future Expansion (Post-MVP)

Later seasons may evolve runs into short procedurally generated maps with branching paths (Fight / Harvesting Node / Event nodes). Death on map would keep a random % of earned loot. MVP remains linear 5-fight structure for launch simplicity.
