# Portal Runs

## MVP Structure

- Each portal run consists of **5 combats**
- After each combat the player chooses: **Continue** or **Stop**
- Loot received after each fight is added to a **prize pool**
- **Finishing the run** awards the full prize pool
- **Stopping early** awards a reduced portion of the pool
- **Dying** awards almost nothing or nothing

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
