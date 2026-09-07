# Combat System

## Player Stats

- **Starting HP**: 1,000

## Core Mechanics

Combat operates on a **tic-based** system rather than strict turn-based alternation with enemies.

- Attacks and spells have:
  - **Prepare time**: Duration before the action resolves
  - **Cooldown time**: Duration after resolution before the player can input the next action
- Different abilities have different prepare/cooldown profiles, creating tactical depth and timing decisions.

## Randomness Integration

All combat outcomes incorporate variance:
- Damage ranges (base ± delta)
- Individual attack variance on top of base ranges
- Monster stats and behavior include randomness

## Encounters Are Groups (1–5 Monsters)

Battles in portal runs are **groups of monsters**, not single encounters. The number and composition of each group is determined by the zombie-dice encounter system (see `encounter-system.md`). A single combat may involve 1 to 5 monsters simultaneously.

The existing "multi-enemy attack" concept (Cleave, Whirlwind, etc.) becomes core to group combat — these attacks do reduced damage per target but can hit multiple monsters in a single group.

## Future Considerations

- Procedural weapon attack slots (Simple/Advanced/Magic) with point budgets for balance
- Different weapon types (Sword, Axe, Staff, etc.) may have unique slot rules and stat ranges
- Strong alignment with "randomness at all stages" principle
