# Loot & Prize Pool

## Loot Drop System

After winning a combat, the player receives loot through two independent systems: **equipment drops** and **gold drops**.

### Equipment Drops

Equipment drops use a **Loot Point (LP) budget** system. Each combat contributes a pool of LP, which is spent on weighted random pulls from a combined loot table.

**Consumables are equipment-class loot:** potions take LP exactly like weapons, are template-costed (LP cost is based on the template, not the roll), and are assigned to portals and monsters via the same loot tables. See `consumables.md` for the consumable design and `shops-and-economy.md` for how shop pricing differs from drop costing.

#### Loot Points (LP)

- Each monster has a **`loot_value`** — the base LP it contributes when killed. This is **INDEPENDENT of `point_cost`** (the encounter budget): it decouples "how hard is the fight" from "how good is the loot" (PC-DEC-057, Spahrep 2026-09-30). A normal monster's `loot_value` roughly tracks its `point_cost`; a special monster (e.g. Metal Slime) can have a low `point_cost` (cheap/weak) but a huge `loot_value` (jackpot).
- Total LP for a fight: **`LP = Σ(monster.loot_value) × depth_mult(progress)`**.
- **`depth_mult`** is a **progress-keyed, accelerating multiplier** (fraction of the run cleared, like the stop-share curve PC-DEC-056) — so it auto-scales to any portal length and the last fight is worth the most. Deeper fights yield more LP, rewarding players for pushing further despite lower HP and higher risk. The reward grows as the risk grows — the push-your-luck carrot.
- **All values are config-driven** (`game_config` / `portal_template`) so they're tuning knobs — tone the curve up or down without a code change (Spahrep 2026-09-30).
- The depth multiplier and the stop-share curve **stack**: going further earns more (depth mult) AND keeps more (stop-share).

#### Loot Tables

Each fight draws from two pools combined into one loot table:

1. **Monster drop pool** — items specific to the monster type (e.g., Dragon → fang, scales; Glimmerling → short sword, buckler)
2. **Portal drop pool** — shared items available from any fight in that portal (e.g., medicinal herb)

#### Drop Properties

Each item in the loot table has two independent properties:

- **Cost** — how many LP the item consumes when dropped
- **Weight** — the probability of being selected on a given pull

These are independent dials. A rare legendary sword could be low weight (rarely picked) and high cost (devours budget). Common materials like scales could be high weight (almost always picked) and low cost (leaves room for more).

There are **no 100% guaranteed drops** — some items just have very high weights making them practically certain.

#### Drop Algorithm (MVP)

```
1. Calculate LP = f(monster_points, portal_depth)
2. Build loot_table = monster_pool + portal_pool
3. affordable = filter(loot_table, cost ≤ LP)
4. drops = 0
5. WHILE affordable is not empty AND drops < 10:
   a. Weighted random pick from affordable
   b. Award item to player
   c. LP -= item.cost
   d. drops += 1
   e. affordable = filter(affordable, cost ≤ LP)
6. Done — leftover LP is voided
```

Key rules:
- **Filter first, then pick** — only roll on items the player can afford. No wasted rolls.
- **10 item cap** counts actual drops only. Since we filter before picking, every pick results in a drop.
- **Re-filter after each drop** — an item affordable before may not be after LP decreases.
- **Same item can drop multiple times** — no stack cap for MVP. If scales cost 5 and LP is 100, scales could be pulled repeatedly.
- **Leftover LP is voided** — if the cheapest remaining item costs more than remaining LP, the loop ends and extra LP does nothing.

#### Deferred (Post-MVP)

- Stack caps on materials (e.g., max 3 scales per fight)
- Final LP formula
- Exact weight and cost values per item

### Gold Drops

Gold uses a separate calculation from equipment drops. Gold is a guaranteed drop with a variable amount.

#### Gold Algorithm

```
1. After winning, gather all monsters from the fight
2. combined_min = sum(monster.min_gold for each monster)
3. combined_max = sum(monster.max_gold for each monster)
4. Use Box-Muller transform to generate a normally-distributed value
5. Map into [combined_min, combined_max] using a bell curve
6. Award the gold amount
```

- Min/max values from all monsters in the fight are **summed** (more monsters = more gold)
- Box-Muller produces a **bell curve distribution** centered on the midpoint of [min, max]
- Spread can be tuned later — current implementation uses 3-sigma (99.7% of rolls fall within range, rare outliers clamped)

#### Deferred

- Gold spread tuning (sigma value)
- Exact min/max values per monster

---

## Prize Pool Mechanics

The prize pool is the meta-layer on top of individual combat loot drops.

- After every combat in a run, loot is added to a shared **prize pool**
- **Loot in the prize pool cannot be used mid-run** — what you bring in is all you have (see consumables.md). No drinking a freshly dropped potion between fights.
- **Finish the run**: Player receives the full prize pool
- **Stop early**: Player receives a reduced share of the pool, scaled by **progress** (fraction of the run cleared), not by absolute fight number — so it auto-scales to any portal length (5 fights, 8 fights, whatever). The share is an **accelerating curve**: the deeper you go, the more you keep, and the marginal reward grows as the risk grows (PC-DEC-056, Spahrep 2026-09-30).
- **Die during run**: Player is kicked out and the prize pool is forfeited. Items brought INTO the run are never lost — death only costs unbanked loot.
- **No inventory access between fights**: the 5-item loadout is locked at entry (see inventory-slots.md)

### Stop-Share Curve (PC-DEC-056, Decided by Spahrep 2026-09-30)

The stop-share is a **progress-keyed curve**, configured on `portal_template.stop_share_tiers` as a JSONB array. Each entry is `{progress, gold_pct, sel_items, rand_items}` where `progress` = fraction of the run cleared (0.2 = 20% through, 1.0 = full clear). `computeStopShare` picks the tier whose `progress` threshold the current battle meets.

**Default curve (5-fight portal shown; auto-scales to any length):**

| Progress | Gold kept | Selected items | Random items |
|----------|-----------|----------------|--------------|
| 20% (1 of 5) | 15% | 0 | 1 |
| 40% (2 of 5) | 30% | 0 | 1 |
| 60% (3 of 5) | 50% | 1 | 1 |
| 80% (4 of 5) | 70% | 1 | 2 |
| 100% (5 of 5) | 100% | full pool | — |

**Design principles:**
- **Accelerating gold curve (15/30/50/70/100).** The jumps grow as the run deepens — the last fight is worth the most. This is the "carrot": the reward for pushing one more fight grows faster than the risk (you might die and forfeit everything), which is what makes the continue/stop decision agonizing.
- **Selected items stay scarce until late (0/0/1/1/2).** "Selected" = the player picks which loot to keep (agency, protects the good stuff). Early stops = the game picks your scraps. Losing your *choice* of loot is the emotional gut-punch that makes early stops feel like a real sacrifice.
- **Random items fill the gap (0/1/1/2/2).** "Random" = the game picks for you (loss). Early stops are mostly random scraps; only deep stops let you protect your best drops.
- **Full clear = 100% always.** The final tier is the full pool — the ultimate carrot, non-negotiable.

**UX (roulette-style reveal):** the player first selects their `sel_items` weapons (existing flow), then the `rand_items` random picks are revealed with a **roulette-style sweep animation** — the same theater as battle initialization. The random selection is a *reveal*, not a silent server pick: the player watches the indicator sweep across the loot and land on what they keep. This makes the loss tangible and the win exciting.

This creates strong "push your luck" tension.

## Loot Sources & Scaling

Loot originates from individual combats via the drop system described above. The portal depth mechanic (deeper fights = more LP) reinforces the risk/reward push-your-luck identity — players are incentivized to continue deeper despite taking damage, because later fights yield better loot.

## Leaderboards & Recognition

Global leaderboards track the deepest progress:
- Format example: "#1 Bob – Portal 5, fight 4"
- **Seasons** reset competitive rankings periodically while preserving historical records
- **Badges** provide permanent account achievements (e.g., "Portal 3 Slayer", "Completed run with all red dice")
- Potential display of best-run gear and defeated monsters on leaderboard entries

## Design Philosophy

The prize pool + continue/stop choice is central to the push-your-luck identity of Portal Colosseum. Risk/reward decisions happen at every combat boundary. The loot drop system (LP budget + weighted pulls) ensures loot generation is varied and interesting, while the portal depth scaling rewards deeper runs.
