# Portal Runs

## MVP Structure

- Each portal run consists of **5 combats**
- After each combat the player chooses: **Continue** or **Stop**
- Loot received after each fight is added to a **prize pool**
- **Finishing the run** awards the full prize pool
- **Stopping early** awards a reduced portion of the pool
- **Dying** awards almost nothing or nothing

## Difficulty Distribution

Each portal level has a total difficulty budget (example: 100 points). Distribution options under consideration:
- Even split (20/20/20/20/20)
- Increasing progression
- Random per-fight with min/max ranges (e.g., 20 ± 5)
- "Zombie dice" style: pool of colored dice (green/yellow/red) randomly selected for the run; player may or may not see composition before committing

## Loot Scaling

Loot value may be influenced by:
- Fight number within the run
- Overall portal difficulty
- Combination of both

Exact formula is TBD and will be calibrated during implementation.

## Future Expansion (Post-MVP)

Later seasons may evolve runs into short procedurally generated maps with branching paths (Fight / Harvesting Node / Event nodes). Death on map would keep a random % of earned loot. MVP remains linear 5-fight structure for launch simplicity.
