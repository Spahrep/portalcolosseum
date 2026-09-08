# Shops & Item Economy (MVP)

**Decided:** 2026-09-08 (Spahrep + DarkJester + Hermes design conversation)

## Role of Shops

- Shops generate **weapons and potions** for purchase with gold.
- **Selling loot** (weapons + consumables) to the shop is confirmed — this is the release valve for the 20-slot bag.
- Shop upgrades (boosting quality, etc.) are PMVP.
- Player-to-player **auction houses** are PMVP (a third source of potions/weapons beyond runs and shops — mentioned in the design conversation, 2026-09-08).

## Output-Based Pricing (key principle)

- **Dropped items are costed by TEMPLATE** for LP purposes — a short sword costs the same LP whether it rolled great or terribly.
- **Shop items are priced by the ROLL** — cost is based on how good/rare the item is. Formula TBD.
- Same standard-deviation grade system (D–S) drives rarity AND price labels for both categories, but **price multipliers scale per category**:
  - **Weapons: steep curve** (S-tier ≈ 100× base — exact TBD). Status economy at the top: a max-roll sword is a durable luxury.
  - **Consumables: shallow curve** (e.g., 10% better ≈ 25% more — exact TBD). They're one-use; the flex shouldn't cost like a sword.
- **D/E/F tiers sell for very little** — they're the gold drip that keeps the economy liquid. Every run yields something sellable, even if it's pennies.
- **The shop price of a weapon IS the value of a weapon drop.** Drop tables and shop prices must be designed together — one economy, two faucets. (Diablo 3 launch lesson: if the shop out-gears drops, nobody cares about loot.)

## Shop Tiers (Magical Aura)

- Unlocking a portal grants the town a **"magical aura"** allowing shops to sell that portal's tier.
- **Shop tier = best portal unlocked.** You cannot buy your way past content — progression stays king, the shop is the consolidation tool (buy a better roll of gear you've already proven you can get).
- PMVP crafting/enchanting may send players back to farm lower portals for specific drops — low portals are a permanent resource farm, not a ladder you leave behind.

## Inventory Refresh

- Shops generate a **fixed number of items every X hours** (TBD).
- Regeneration rate and method TBD.

## Rerolls

- **Exponential reroll cost**: base (e.g., 2gc) × multiplier (e.g., ×1.5 or ×2 — both TBD). Reroll N costs `base × multiplier^N`.
- **Spend 1 AP to reset the reroll cost back to the base** — a two-currency decision: how far do you push the cost before resetting?
- The reroll button displays the **next** cost (e.g., "ReRoll(100gc)", "ReRoll(150gc)") — escalation must be visible for the tension to land.
- Open question: does the counter reset when the shop refreshes? (Leaning yes — fresh shop, fresh cheap rerolls. Confirm.)

### Reroll Design Notes

- Exponential escalation front-loads fun (first reroll is cheap, everyone clicks it) while the cost self-gates after a few rolls — no hard caps needed.
- The AP reset means AP-rich players effectively buy cheap rerolls; the exponential drains gold from AP-poor players saving for a leaderboard push. The dials target different players — intended.
- **Caveat:** don't let AP become the sink for everything. Instinct: portal runs + shop resets are the two AP sinks; wizard-tent healing leans gold (AP as a panic option only).

## Economy Summary (how it all connects)

- **One bell curve** → grade (D–S) for every item
- **Portal tiers** → item power tiers (each portal has its own loot pool; Portal 1 short swords cap ~30 damage even at S, Portal 3 Elvish Longswords cap ~40 — example)
- **Three gates against grinding**: portal tier gates loot pools (can't farm your way to better gear), shop tier gates purchases (can't buy your way past content), per-portal entry costs tax deep-portal farming
- **Anti-soft-lock**: portals stay farmable after unlocking later ones — a player must always have at least one portal they can profitably clear (see portal-runs.md)
- **AP** gates runs; **gold** gates shops. Two meters, clean split.
