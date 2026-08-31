# Combat System

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

## Future Considerations

- Procedural weapon attack slots (Simple/Advanced/Magic) with point budgets for balance
- Different weapon types (Sword, Axe, Staff, etc.) may have unique slot rules and stat ranges
- Strong alignment with "randomness at all stages" principle
