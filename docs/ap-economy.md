# AP Economy

**Updated:** 2026-10-15 — AP daily reset decided (PC-DEC-073): **accrue 100 AP per elapsed day to a 500 cap**, starting AP=250; supersedes the rolling "X per 24h / 3× cap" model and the AP=10 start. See `ap-daily-reset.md` for the mechanism + values. (Prior updates 2026-09-16: bottom-dock AP/gold HUD confirmed PC-DEC-009; entry costs, leaderboard rationale, wizard tent TBD.)

## The Resource

- **Starting AP = 250** (Spahrep 2026-10-15: "start at 250 for now"; PC-DEC-073 — supersedes the earlier AP=10 from PC-DEC-018. Stored in game_config.)
- Action Points reset on a **fixed daily cadence at 00:00 GMT — accrue 100 AP per elapsed day, capped at 500** (PC-DEC-073). Missed days accumulate (3 missed days → 300, capped at 500). Full mechanism: `docs/ap-daily-reset.md`.
- **Cap model:** each elapsed day adds 100 AP to the pool, clamped at the 500 cap. The no-FOMO intent is preserved — a returning player banks every missed day's allowance up to the cap — while the cap bounds hoarding.
- **Bottom dock HUD** — AP + gold live in a transparent bar at the bottom of every real screen (AP meter like `24/30`, gold counter, player name). Shipped (PC-52); confirmed: "we do wean [want] the ap/gold transparent bar at the bottom" (Spahrep 2026-09-16).

## Why AP Meters the Game

- The leaderboard tracks each player's **deepest run** (e.g., "Portal 5, fight 3") — not total AP spent or volume of runs.
- Banking AP and dumping it in bulk gives **no leaderboard advantage** → no incentive to hoard.
- The AP cap limits grind attempts; the flat leaderboard makes hoarding pointless. Together they kill both grinding and FOMO.
- **The cap makes AP "use it or lose it" only at the margin — and only near the cap.** A player at 480 AP accrues +20 (to the 500 cap) rather than +100, so the surplus above the cap is what "evaporates." That pressure keeps a cap-sitting player willing to spend AP on shop rerolls instead of hoarding. Below the cap, nobody loses AP to the clock — missed days bank forward — so there is no FOMO pressure on casuals.

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
