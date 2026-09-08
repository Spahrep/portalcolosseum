# AP Economy

**Updated:** 2026-09-08 — 3× cap, sink split, entry costs, leaderboard rationale, wizard tent (TBD)

## The Resource

- Action Points regenerate **X per 24-hour period** (exact X TBD).
- **Max holdable = 3X.** The cap exists so players don't have to log in daily worrying about falling behind. Log in every 3 days, drain to zero, and you're on equal footing with a daily player. No FOMO pressure.

## Why AP Meters the Game

- The leaderboard tracks each player's **deepest run** (e.g., "Portal 5, fight 3") — not total AP spent or volume of runs.
- Banking AP and dumping it in bulk gives **no leaderboard advantage** → no incentive to hoard.
- The AP cap limits grind attempts; the flat leaderboard makes hoarding pointless. Together they kill both grinding and FOMO.
- **The cap also makes AP "use it or lose it" at the margin** — a player sitting near the cap is happy to spend AP on shop rerolls (or anything else), because that AP would otherwise evaporate on the next tick. This makes non-run AP spending feel like found money and keeps players willing to engage with the shop economy instead of hoarding for runs only.

## AP Sinks (MVP)

1. **Portal runs** (primary) — a run costs **X AP + Y gold**. Deeper portals cost more (e.g., Portal 2 = X AP + 4×Y gold — example only, TBD).
2. **Shop reroll resets** — 1 AP resets the exponential reroll cost back to base (see `shops-and-economy.md`).

## Gold Uses

- Purchasing items from shops (priced by roll quality — see `shops-and-economy.md`)
- Portal run entry fees
- Shop rerolls (gold, exponential cost)
- Gold is the **secondary meter** — AP is the primary limiter.

## Wizard Tent (healing — model TBD)

Ideas being considered (drawing inspiration from utopia-game.com):
- Spend AP and/or gold at the wizard tent to get healed
- Partial HP recovery every X hours
- 1× per day full heal
- Regardless of the tent model: **potion healing outside the portal is confirmed** (see `consumables.md`).

## Ponderings (no decision yet)

- **AP refund on completion:** a run costs Y AP; complete → refund a small portion (Z); die or stop early → none.
  - Open question: does this make "stop early" a double punishment (reduced loot AND net AP loss) that kills the push-your-luck stop decision?
  - Possible refinement: refund proportional to where you stopped (e.g., stop after fight 3 → 60% back) to keep "stop early" a rational choice rather than a noob trap.

## Design Constraints

- Must prevent both:
  - Farming of easy portals for unlimited resources
  - Soft-locks where a player has no viable portal to farm
- See `portal-runs.md` (anti-soft-lock) and `shops-and-economy.md` (three gates against grinding).

## Future Systems

Additional AP sinks (crafting, enchanting, harvesting) are planned for post-MVP seasons and tracked in the Idea Bank.
