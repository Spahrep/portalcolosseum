# Loot & Prize Pool

## Loot Drop System

After winning a combat, the player receives loot through two independent systems: **equipment drops** and **gold drops**.

### Equipment Drops

Equipment drops use a **Loot Point (LP) budget** system. Each combat contributes a pool of LP, which is spent on weighted random pulls from a combined loot table.

**Consumables are equipment-class loot:** potions take LP exactly like weapons, are template-costed (LP cost is based on the template, not the roll), and are assigned to portals and monsters via the same loot tables. See `consumables.md` for the consumable design and `shops-and-economy.md` for how shop pricing differs from drop costing.

#### Loot Points (LP)

- Each monster has a base **Loot Point value** (e.g., Dragon = 100, Glimmerling = 5)
- Total LP for a fight is calculated by: `LP = f(monster_point_value, portal_depth)`
- **Portal depth** = how far into the portal this fight is (1st fight vs last fight). Deeper fights yield more LP, rewarding players for pushing further despite lower HP and higher risk
- Exact LP formula to be determined later

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
- **Stop early**: Player receives a reduced share of the pool (exact % TBD)
- **Die during run**: Player is kicked out and the prize pool is forfeited. Items brought INTO the run are never lost — death only costs unbanked loot.
- **No inventory access between fights**: the 5-item loadout is locked at entry (see inventory-slots.md)

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
