# Weapon Pricing & Grading System

**Status:** ✅ Accepted — signed off by Spahrep (PC-DEC-076, 2026-10-21); price-curve refined by Spahrep (PC-DEC-079, 2026-10-26 — premium on B/A/S)  
**Date:** 2026-10-21 (updated 2026-10-26)  
**Audience:** Implementation of the weapon shop (docs/prds/weapon-shop-prd.md)

This document locks in the final model for weapon valuation and tier labeling based on the discussion between Spahrep and Hermes.

## Core Philosophy

- **Tier (S/A/B/C/D)** is purely an aesthetic label for excitement and readability.
- The real driver is a **continuous quality_multiplier** calculated from actual combat power.
- Identical weapons (same stats/rolls) will always have the same sell price, whether they dropped in the arena or were bought from the shop.
- S-tier must be rare: **≤ 5%** of all rolls (target ~1.5%).

This avoids arbitrage, creates clear upgrade paths, and makes pulling a new S feel like a big deal even if you already have one equipped.

## 1. Power Score (The Real Value)

```js
power_score = damage 
            × (100 / speed) 
            × (accuracy / 100) 
            × (1 + (crit_chance/100 × (crit_multiplier - 1)))
```

This is expected damage per tick, including crit. It uses all four stats (we now roll crit as a real variable instead of flat 5%).

Each weapon template defines its `base_power_score` (the score of a perfectly average roll on that template).

## 2. Quality Multiplier

```js
quality_multiplier = Math.pow(power_score / template.base_power_score, 0.78)
```

The exponent (0.78) keeps extreme rolls from becoming absurdly expensive while still giving strong premiums to top rolls.

## 3. Pricing Formulas

**Shop Buy Price:**
```js
buy_price = round(template.base_price × rarityFactor(qm) × 1.40)
```

**Vendor Sell Price:**
```js
sell_price = round(template.base_price × rarityFactor(qm) × 0.42)
```

`rarityFactor(qm)` is `price_factor(qm)` — a **single continuous, strictly monotonic anchor curve across the whole qm range, with no flat par floor and no tier step** (PC-DEC-079). E/D/C rise gently off ~0.78, then the curve steepens hard through B/A/S — the premium comes from the *slope*, not the tier label. Both the shop UI (`priceFactor` + `PF_ANCH` in `api/combat/shop.js`) and the SQL `public.price_factor()` use the SAME anchor table, byte-identical, so an identical weapon buys and sells on the same curve. Exact anchors (qm → factor):

| qm | factor |
|----|--------|
| 0.80 | 0.78 |
| 0.90 | 0.90 |
| 0.94 | 0.95 |
| 0.985 (C) | 1.00 |
| 1.00 | 1.03 |
| 1.04 (B entry) | 1.55 (~1.5× a C) |
| 1.055 | 1.90 |
| 1.075 (A entry) | 2.30 (~2.2×) |
| 1.09 | 2.60 |
| 1.11 (S entry) | 3.30 (~3.2×) |
| 1.15 | 3.90 |
| 1.23 (S cap) | 5.20 (~5×) |
| 1.30 | 5.80 |

Values between anchors are linear interpolation; both ends clamp (≤0.80 → 0.78, ≥1.30 → 5.80).

```sql
-- public.price_factor(p_qm), mirrored 1:1 by priceFactor in api/combat/shop.js
SELECT coalesce(
  max(y0 + (q - x0) / NULLIF(x1 - x0, 0) * (y1 - y0)), max(y0))
FROM ( SELECT
         least(greatest(p_qm, 0.80), 1.30) AS q,
         max(a.x) FILTER (WHERE a.x <= least(greatest(p_qm, 0.80), 1.30)) AS x0,
         max(a.y) FILTER (WHERE a.x <= least(greatest(p_qm, 0.80), 1.30)) AS y0,
         min(a.x) FILTER (WHERE a.x >= least(greatest(p_qm, 0.80), 1.30)) AS x1,
         min(a.y) FILTER (WHERE a.x >= least(greatest(p_qm, 0.80), 1.30)) AS y1
       FROM (VALUES (0.80,0.78),(0.90,0.90),(0.94,0.95),(0.985,1.00),(1.00,1.03),
                    (1.04,1.55),(1.055,1.90),(1.075,2.30),(1.09,2.60),(1.11,3.30),
                    (1.15,3.90),(1.23,5.20),(1.30,5.80)) AS a(x,y) ) b ;
```

The same curve feeds both buy and sell, so an identical weapon sells back for the same fraction of its buy price whether it came from a drop or the shop (PC-DEC-076: identical weapons sell identically, source-agnostic). The 1.40× shop premium and 0.42× sell recovery keep the buy/sell margin constant. A god-roll S now sells back for materially more raw gold than a poor D-roll of the same template — because it is rare, not because it is labeled S. The S band carries a firm premium over C (~3.2× at entry, ~5× at cap) per PC-DEC-079 — this replaced the earlier "flat below qm 1.02 / low-S ≈ high-A, no tier jump" intent from PC-DEC-078.

## 4. Tier Assignment (Aesthetic Label Only)

We map the `quality_multiplier` to tiers using percentile thresholds. These are tuned so the final distribution is:

- **S**: Top 1.5% of rolls
- **A**: Top 1.5–7.0%
- **B**: 7–22%
- **C**: 22–60%
- **D**: 60–87%
- **E/F**: Bottom 13%

**Calibrated cutoffs (2026-10-21, live distribution, 20k rolls/template):** the real roll spread is tighter than the example table below assumed — actual `quality_multiplier` spans ~0.80–1.23 (near 1.0), not 0.65–1.78. The cutoffs below are baked into `generate_weapon` and give the target rarity (verified: S 2.4%, A 5.8%, B 14.6%, C 38.5%, D 26.1%, E 12.6%):

| Tier | quality_multiplier cutoff |
|------|---------------------------|
| S    | ≥ 1.11                    |
| A    | ≥ 1.075                   |
| B    | ≥ 1.04                    |
| C    | ≥ 0.985                   |
| D    | ≥ 0.94                    |
| E    | < 0.94                    |

Grade is calculated *after* the instance is rolled and is for display only (shop, inventory, tooltips). `grade` column mirrors `tier` so legacy readers keep working.

## 5. Examples (Sword Template, base_price = 45g, base_power = 80)

| Roll Quality | Power Score | Quality Mult | Buy Price | Sell Price | Tier |
|--------------|-------------|--------------|-----------|------------|------|
| God roll     | 142         | 1.68         | 106g      | 32g        | S    |
| Strong       | 118         | 1.41         | 89g       | 27g        | A    |
| Average      | 82          | 1.02         | 64g       | 19g        | C    |
| Poor         | 52          | 0.71         | 45g       | 13g        | D    |

Note that the S-tier version sells back for more than double the poor D-tier version, but you still take a substantial loss vs purchase price.

## 6. Open Tuning Knobs (game_config)

- `weapon_base_price_multiplier` (the 1.40)
- `weapon_sell_recovery_rate` (the 0.42)
- `quality_exponent` (currently 0.78)
- Exact percentile cutoffs for S/A/B/C/D once we have distribution data

These let us tune economy feel without code changes.

## Recommendation

Adopt this model. Tier is cosmetic. Quality_multiplier (driven by real power) does the actual work. S-tier stays rare (<5%).

This resolves the two [ASSUMPTION] items left in the weapon shop PRD and aligns with the direction from `weapon-pricing-design.md` while incorporating Spahrep's clarified intent on sell values and rarity distribution.

**Next:** Update PRD, add to pending-decisions.md, implement grading fix + power-based pricing in weapon generation and shop.

---
Accepted by Spahrep 2026-10-21 (PC-DEC-076). Price curve superseded by continuous monotonic anchor curve per PC-DEC-079. Decided by Spahrep, 2026-10-26.
