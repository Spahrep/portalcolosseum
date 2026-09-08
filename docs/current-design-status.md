# Current Design Status (as of 2026-09-08)

This file captures the current state of design decisions for Portal Colosseum. It is intended as a living reference until decisions are moved into more permanent documents.

## Weapon Generation (documented in weapon-generation.md)

- Base + Delta system for stats
- All stats rolled **independently** before classification
- Normal distribution quality grading (D/E/F → S), applied **after** all stats are rolled — it's a UI label, not an input
  - S-tier ≈ 0.15% (roughly 1 in 740, often communicated as ~1 in 1000)
  - A-tier ≈ 2.1%
- Attacks roll **independently** of weapon grade (current idea, subject to change)
- Weighted attack selection via `weapon_template_attack_mapping.weight` column
- Multi-enemy attacks (Cleave, Whirlwind, etc.) do reduced damage per target

## Attack Slot System (documented in weapon-generation.md)

- **Slot 0 — Default "Attack"**: Every weapon has this; uses base stats unmodified. Stored as `slot_0_attack_id` (NOT NULL FK → attack.id) on `weapon_template` and `weapon_instance`.
- **Slots 1–4 — Additional Attacks**: Pool membership comes from the `weapon_template_attack_mapping` junction table (weapon_template → attack × slot) via FK integer IDs. Each slot has a `slot_N_chance` column (0.0–1.0) in `weapon_template` controlling activation probability. The mapping table also has a `weight` column (real, default 1.0) for weighted random selection within each slot. Max total attacks = 5 (Slot 0 + up to 4 configurable slots).

## Consumables (documented in consumables.md) — NEW 2026-09-08

- Weapons + consumables are the **only MVP item types**. Armor, materials, throwables, pouches = PMVP.
- Consumables modify one stat (HP heal / Speed / Accuracy / Damage), template-based with base ± delta like weapons
- Each potion rolls an **effect value** AND a **drink speed** (pill vs 4L jug)
- Grade (D–S) assigned after generation, same standard-deviation system as weapons (20hp potion = A, 22hp = S)
- **Use requires a hand free of cooldown** (may be holding a weapon): `pre = f(hand weapon speed, potion speed)` → effect lands → `post = f(same)` → hand free
- **Cooldowns live on hands, never weapons**; the other hand keeps attacking while one drinks
- Buffs apply to the **player** (both hands), flat values, additive stacking, separate end tics
- Pre-time uninterruptible (disruption PMVP); no throw mechanic (PMVP FF-style idea)
- Potions usable during combat, between fights, and outside the portal (town)
- Potions take a full inventory slot (no stacking); pouches PMVP

## Shops & Item Economy (documented in shops-and-economy.md) — NEW 2026-09-08

- Shops generate weapons + potions; **selling loot to shops is confirmed** (bag release valve)
- **Output-based pricing**: shop items priced by their ROLL; dropped items costed by TEMPLATE. One economy, two faucets — must be designed together.
- Same grade system for everything; price multipliers scale per category (weapons steep ~100× S, consumables shallow ~10% better = 25% more)
- **Shop tier = best portal unlocked** (town "magical aura" lore) — can't buy your way past content
- Fixed inventory refreshed every X hours (TBD)
- **Rerolls: exponential cost** (2gc base × multiplier^N, both TBD) + **1 AP resets cost to base**. Button shows next cost. Two-currency decision.
- D/E/F tiers sell for little — the gold drip

## AP Economy (documented in ap-economy.md) — UPDATED 2026-09-08

- AP regenerates X per 24h; **max holdable = 3X** (skip 2 days without falling behind a daily player)
- Leaderboard = **deepest run** only — banking AP gives no advantage; hoarding is pointless
- Sinks: **portal runs** (X AP + Y gold, deeper portals cost more) + **shop reroll resets** (1 AP)
- Gold is the secondary meter
- Wizard tent healing model TBD (AP and/or gold, hourly drip, or 1×/day full heal — utopia-game.com inspiration); potion healing outside the portal confirmed
- Ponderings: AP refund on completion (may double-punish stopping early — refund proportional to depth as possible fix)

## Item Economy Structure (2026-09-08)

- **One bell curve** → grade (D–S) for every item
- **Portal tiers = item power tiers** — each portal has its own loot pool/enemies; P1 short swords cap ~30 dmg, P3 Elvish Longswords cap ~40 (examples)
- **Three gates against grinding**: portal tier gates loot, shop tier gates purchases, entry cost taxes deep-portal farming
- **Anti-soft-lock**: portals stay farmable forever after unlock — a player must always have at least one portal they can profitably clear. God-runs are a gift, not a trap.
- PMVP crafting/enchanting makes low portals a permanent harvest ground

## Encounter System (documented in encounter-system.md)

- Zombie-dice style system for generating portal run battles
- Each portal has a dice pool (e.g., 10 dice) with colored dice (green/yellow/red)
- Color = risk profile, not monster type
- Dice drawn **without replacement** — pool shrinks over the 5 battles
- Player sees full color distribution before starting; tracks remaining dice throughout
- Die selection is random (player doesn't choose), with tension-building animation
- Die roll produces a **point budget** → spent on a monster group (1–5 monsters) via weighted selection from per-portal monster mapping table
- Max 5 monsters per battle; 5th monster absorbs remaining points
- Battles are **groups of monsters**, not single encounters — multi-enemy attacks (Cleave, Whirlwind) become core

## Portal Runs (documented in portal-runs.md) — UPDATED 2026-09-08

- 5 encounters per run
- Option to stop after each fight and keep a reduced % of loot (exact % TBD)
- Full clear = keep all loot
- **Death = kicked out, prize pool forfeited; brought items never lost**
- **No inventory access between fights** — 5-item loadout (Hand L/R, Belt Loop, Potion A/B) locked at entry
- Entry costs: X AP + Y gold, deeper portals cost more (P2 = 4×Y example)

## Loot & Prize Pool (documented in loot-prize-pool.md)

### Equipment Drops
- **Loot Point (LP) budget** system — each monster contributes LP based on monster point value + portal depth (deeper = more LP, rewarding risk)
- **Loot table** = monster-specific pool + portal-shared pool
- Each drop has independent **cost** (LP consumed) and **weight** (selection probability)
- **Algorithm**: filter affordable items → weighted random pick → subtract cost → re-filter → repeat until LP exhausted or 10-item cap
- No 100% guaranteed drops (just very high weights)
- Same item can drop multiple times (no stack cap for MVP)
- Leftover LP below cheapest item cost is voided
- **Consumables are equipment-class loot** — take LP like weapons, template-costed, same portal/monster assignment

### Gold Drops
- Separate from equipment — guaranteed drop with variable amount
- Each monster has min/max gold; all monsters in fight are **summed**
- **Box-Muller bell curve** distribution mapped into [combined_min, combined_max]
- Spread tuning deferred

### Deferred (Post-MVP)
- Stack caps on materials
- Final LP formula (monster points × portal depth)
- Gold spread tuning (sigma value)
- Exact weight/cost/min-max values per item/monster

## Open / Undocumented Points

1. **Loot Rules on Stop** — exact % of prize pool kept when stopping early; how random selection works (uniform? weighted by rarity?)
2. **Multi-Enemy Attack Balance** — how much less damage cleave/whirlwind do per target; fixed or scales with weapon quality. Higher priority since encounters are confirmed multi-monster groups.
3. **Wizard Tent Healing Model** — AP and/or gold, hourly drip, or 1×/day full heal (see ap-economy.md)
4. **Belt Loop Swap Timing** — exact formula f(weapon in hand speed, belt weapon speed); whether swapped-in weapon can attack immediately or needs a draw tic; whether counter resets on shop refresh
5. **Consumable Use Formula** — exact pre/post formula f(hand weapon speed, potion speed); duration numbers per template
6. **Shop Numbers** — refresh timer, reroll base/multiplier, price curve exact values, whether reroll counter resets on shop refresh
7. **Encounter System Open Questions** (see encounter-system.md)
   - Does the player see exact dice face values, or just colors?
   - 5th monster absorption: pick closest-cost monster, or upgrade template to match remaining budget?
   - Dice pool size and composition per portal tier (database configuration)
   - Face value calibration (actual numbers, not the example 10/20/30)
   - Point-to-loot relationship: does higher point budget yield better loot? (Note: loot now uses LP budget system, separate from encounter point budget)
8. **Starting Equipment** — same for all players, decided later; likely changes per season
9. **AP Refund on Completion** — pondering only; see ap-economy.md

---

**Next Priority**: Lock the belt-loop swap timing and consumable pre/post formula (the last timing unknowns), then the shop numbers (refresh, reroll base/multiplier). After that the item/economy design is complete enough to hand to implementation.
