# Core Philosophy

**Updated:** 2026-09-08 — added the design principles crystallized during the item/economy conversation. This is the north star: the rules we'd defend in a design meeting. Specific mechanics live in their own docs (linked below).

## Guiding Principles

- **Action Points (AP) meter the game, gold is secondary.** AP gates meaningful player actions; gold greases the economy. See `ap-economy.md`.
- **Push-your-luck is core.** The gameplay loop rewards risk assessment and bold decisions: deeper portal fights, the prize pool, the escalating shop reroll. See `portal-runs.md`, `loot-prize-pool.md`, `shops-and-economy.md`.
- **Procedural generation wherever possible.** Weapons, potions, encounters, and outcomes favor generation over selection. One bell curve (standard deviation) drives quality for *everything*: roll position → grade (D–S) → price label.
- **Randomness at all stages.** No deterministic outcomes: damage is never fixed (100 ± X), loot values and monster HP carry variance, and roll quality is *output*, not input.
- **A player must always have at least one portal they can profitably clear.** Anti-soft-lock is a hard rule: unlocking is permission, not replacement. Old portals stay farmable forever; a god-run is a gift, never a trap. See `portal-runs.md`.
- **Three gates against grinding.** Portal tier gates loot pools (can't farm your way to better gear), shop tier gates purchases (can't buy your way past content), per-portal entry costs tax deep-portal farming. See `shops-and-economy.md`.
- **Gear is proof of progress.** Portal tiers are item power tiers — the leaderboard's "Portal 5, fight 3" is a statement of what gear you can hold. S-tier is a status economy, not a power economy: the top end is a flex, not a requirement.
- **Drops and shops are one economy, two faucets.** Drop tables and shop prices must be designed together; the shop price of a weapon *is* the value of a weapon drop. See `shops-and-economy.md`.

## Player Respect Principles

- **No FOMO.** The 3× AP cap means logging in every 3 days keeps you equal to a daily player. We do not punish absence. See `ap-economy.md`.
- **No soft-locks, ever.** See the anti-soft-lock rule above.
- **You don't lose what you brought.** Death forfeits the run's prize pool but never items you carried in. Risk lives in the prize pool, not your loadout. See `portal-runs.md`.

## No Dark Patterns — Friendly Design Only

- **No Skinner boxes.** No exploitative variable-reward loops built to trap compulsion; no fake scarcity, no manufactured urgency, no "log in or lose it" pressure.
- **Excitement comes from *chosen* risk, not imposed gambling.** Push-your-luck is only fun when the player has the information and agency to make the call: visible odds, visible costs, visible consequences. The reroll button showing the next cost ("ReRoll(100gc)") is the pattern — **transparency is the feature**, not the obstacle.
- **Respect the player's time and wallet.** Catch-up mechanics (3× AP cap) ensure absence is never punished; nothing pressures daily logins or real-money spending. No pay-to-win, ever.
- **Rewards follow skill and decisions, not compulsion.** The leaderboard rewards depth (your best run), not volume — you can't grind your way to the top, and you don't have to.
- **Risk lives where the player chooses it** — the prize pool, deeper portal fights, reroll escalation — never in punishing players for things outside their control.
- **Review test:** if a mechanic's fun depends on the player *not* understanding the odds or the cost, it fails design review. See "How to Use This Document" below.

## Inventory Philosophy

- **Limited carrying capacity forces meaningful choices.** MVP: 20-slot backpack + 5-item run loadout.
- **Confirmed MVP loadout:** Hand L, Hand R, Belt Loop, Potion A, Potion B.
- **The loadout locks at portal entry.** No inventory access between fights — your 2 potions are the entire consumable budget for 5 fights. See `inventory-slots.md`.
- **Space management is pressure.** 20 slots, no potion stacking; selling loot to shops is the release valve. Pouches are PMVP.

## Scoping Note

MVP focuses on a tight, replayable loop. Advanced systems (gathering, crafting, enchanting, auction house, 2-handed weapons, disruption, throw mechanics) are tracked in the Idea Bank for post-MVP seasons. See `consumables.md` and `shops-and-economy.md` for the PMVP lists.

## How to Use This Document

- **Design reviews:** a mechanic that violates a principle above needs a strong reason and an explicit exception.
- **New features:** ask "which principle does this serve?" before "how do we build it?"
- **Balance passes:** principles are fixed, numbers are not. The exact formulas (pre/post, reroll base/multiplier, price curves) are all TBD and tunable — the philosophy stays.
