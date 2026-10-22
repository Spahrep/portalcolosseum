# Weapon Pricing & Grading System

**Status:** ✅ Accepted — signed off by Spahrep (PC-DEC-076, 2026-10-21)  
**Date:** 2026-10-21  
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
buy_price = round(template.base_price × quality_multiplier × 1.40)
```

**Vendor Sell Price:**
```js
sell_price = round(template.base_price × quality_multiplier × 0.42)
```

The 1.40× shop premium and 0.42× sell recovery create healthy spread. A god-roll S will sell back for significantly more raw gold than a poor D-roll of the same template.

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
Accepted by Spahrep 2026-10-21 (PC-DEC-076).
