# Weapon Pricing Curves — Design Discussion & Framework

**Status:** Design discussion (not a PRD). Grounded in live code + combat math.
**Authored:** 2026-10-19 · Spahrep + Hermes (game-design persona session)
**Scope:** How we assign a price to any weapon, the pricing curve shape, the pitfalls to
avoid, and how to make finding/pricing weapons *fun, fair, and challenging*.
**Inputs read (source of truth):**
- `api/combat/dev/[...path].js` — grade computation (lines 530–590)
- `supabase/migrations/20260918120000_crit_strikes.sql` — `normal_int` + `generate_monster`
- `supabase/migrations/20260920120000_fix_generate_weapon_auth.sql`,
  `20260930120100_fix_generate_weapon_persist.sql` — `generate_weapon` (weapon generation)
- `js/combat/damage.js`, `api/combat/[...path].js` (combat-run) — DPS/accuracy/crit resolution
- `tests/weapon-grade.test.js` — the grade contract
- `docs/prds/weapon-shop-prd.md` — the approved shop PRD (PC-DEC-074)

**Related decisions:** PC-DEC-074 (shop PRD approved); the two tuning-table [ASSUMPTION]s
it carries (buy-price multiplier curve, sell-price discount %) are the direct targets here.

---

## TL;DR

1. **The tier system, as built, cannot produce S or A weapons.** The grade uses z-scores
   divided by *range* (=3σ) instead of by *sigma*, so every real roll grades C or D. S/A/B
   are mathematically unreachable. The "S ≈ 0.15%" doc claim is wrong. **Fix is one line.**
2. **Even with grades reachable, grade ≠ combat power.** Two "C" weapons can differ 20% in
   real DPS. Pricing by grade prices the wrong thing.
3. **Recommended: price by a real combat *power score* (a multiplicative DPS formula with a
   crit term and utility/speed-breakpoint premiums), on a two-lever curve: honest value
   backbone × a small sub-linear rarity bump.** Grade becomes a *display* label, not the
   price signal. (Benchmark-driven: BL3/Diablo/Grim Dawn/PoE price near-linear-in-value
   with a modest per-tier bump — no 256× anywhere.)
4. **Add a crit dimension to power and grade** (currently flat at 5%, invisible to pricing).
5. **Make sell-price decay by grade** so good weapons are a real commitment and junk is liquid.
6. **Make the player's attack timing K-style** (Option A, 2026-10-19): player cast/cooldown
   tics = `floor(weapon.speed × multiplier)`, mirroring monsters — so weapon `speed` is a
   real attack-cadence driver and `value_speed = C/(speed+K)` is the exact engine mirror.

---

## Part 1 — Two hard findings (these change the whole conversation)

### Finding 1: S/A/B are unreachable from real generation

The grade is computed in `api/combat/dev/[...path].js` (lines 565–590):

```
zd = (damage      - base_damage  ) / damage_range
zs = (base_speed  - speed        ) / speed_range      -- speed INVERTED
za = (accuracy    - base_accuracy) / accuracy_range
z  = (zd + zs + za) / 3
S: z >= 3 · A: z >= 2 · B: z >= 1 · C: z >= 0 · D: z >= -1 · E: z >= -2 · F: z < -2
```

But weapon stats are rolled by `normal_int(base, range)` (`crit_strikes.sql`), a Box-Muller
normal where **`range` = 3σ** and the roll is *clamped to ±range*. So each stat's z-score is:

```
z_stat = (rolled - base) / range = (rolled - base) / (3σ)   -- a σ-count divided by 3
       ∈ [-1, +1]  (clamped)
```

The average of three is therefore bounded in **[−1, +1]**. The grade bands S(≥3)/A(≥2)/B(≥1)
require a z the generator can never reach. **The maximum real grade is C (z=1.0), and C itself
needs all three stats to hit +3σ simultaneously** (~2.5×10⁻⁹ — effectively never; real rolls
grade C or D, essentially always D).

I verified the distribution numerically: z_grade is approximately N(0, 0.192), so
P(B) = P(E) ≈ 1×10⁻⁷, and P(S) = P(A) = P(F) ≈ 0anna. The doc's "S ≈ 0.15%" is the
probability of *one stat* hitting +3σ — not of *grading S*. It's a units bug: the bands were
drawn as if z-scores were standard normal (3σ ≈ 0.15% tail), but the formula divides by range
(=3σ), not by σ.

**Why this matters for pricing:** the entire "excitement of finding a good weapon" chase
(S/A loot) is **dead on arrival**. Every weapon you find is a C or D — there is no treasure
to get excited about, so there is no price curve for it. You cannot price S-tier loot if
S-tier loot cannot exist classified.

**The fix (one line):** divide by the standard deviation, not the range:
`z_stat = (rolled - base) / (range/3)`. Then a +3σ roll gives z=3 (S), a +2σ gives A, etc.
The intended rarity curve (S ≈ 0.15%) becomes true. This is the single highest-leverage change.

### Finding 2: grade ≠ combat power (the fairness gap)

The grade is an **unweighted, arithmetic average of three z-scores**, but the three stats have
wildly different and **non-linear** combat weights (verified against `js/combat/damage.js` and
the combat engine):

- **Damage**: linear in DPS. DPS ∝ damage.
- **Speed**: *inverse and non-linear*. DPS ∝ 100/speed. A 2-tick speed gain is worth +12.5%
  at the slow end (18→16) but the SAME 2-tick gain is worth +25% at the fast end (10→8), and
  +125% by speed 8. The grade's `zs = (base−s)/range` treats a 2-tick change as equal value
  everywhere — it's worth ~2× more at the fast end.
- **Accuracy**: a hit probability, hence a multiplicative factor on expected damage. Near the
  cap each point is worth more (bigger fraction of remaining misses). Non-linear.

So two weapons with the **same grade** can differ by 20%+ in real DPS, and a weapon can grade
high on a low-value stat while being combat-weak. **Concretely: a "C" at base stats does
~128 DPS; a "C" with max damage does ~154 DPS — same label, 20% apart.** Price follows the
value the player actually feels (combat power), not the label.

**If you price by grade, you price the wrong thing.** This is the fairness trap. The player
instantly feels it when two "same tier" weapons differ 20% in how fast things die but cost the
same.

---

## Part 2 — The pricing framework

### Principle: price the *decision*, not the *number*

The proposed composition (weapons + attacks displayed, combat-run PRD PC-DEC-073):
the player doesn't buy a "C"; they buy "how fast does this kill the thing in front of me, and
what does it let me *do*." Price must track real combat power first (fairness floor), then
add premiums for the decisions a weapon opens up (the fun).

### 1. Base price = power score (fairness floor)

Compute a **power score** from the actual combat formula:

```
power = damage × (100/speed) × (accuracy/100) × (1 + crit/100 × (critMult − 1))
```

This is the *true* expected damage per tick — what the engine already resolves, flattened to
one number. A monotonic price-of-power is the "fair" part: a weapon that kills 2× faster costs
2× more (roughly). The player *feels* this fairness because price tracks what they experience
in combat.

**But pure-DPS pricing is boring and a trap on its own:**
- It makes DPS the single dominant stat → every weapon is "the one with the most damage."
- It collapses the loot chase into arithmetic ("buy the highest number I can afford").

So power is the *floor* of fairness, not the whole story)Skip. The fun lives in the premiums.

### 2. The fun premiums — price what a weapon *lets the player do*

The most exciting weapons in a loot game aren't the highest raw number; they're the ones that
**change how you play** (novelty/mastery, discovery, challenge). Price those:

- **Attack-slot / build value.** A weapon whose attacks carry *utility* (stun, DoT, heal,
  multi-hit, banner) is worth more than raw DPS because it changes your options, not just your
  damage. **Price the attacks, not just the stats.**
- **Speed breakpoints.** Because speed is non-linear, a weapon that crosses an "I now act
  before the enemy" threshold is a *step change*, worth more than its raw DPS delta.
- **Crit as a build axis.** Crit is currently flat at 5% everywhere and invisible to pricing
  and grade (PC-DEC-051). A high-crit weapon is a *burst/risk* profile — a different playstyle,
  not a linear upgrade. Roll it, add it to the power score, and let it push the grade. This
  adds a whole dimension of "exciting find" that's currently missing.

Design principle: **no one dominant stat.** Power must stay *multiplicative* (as the real
formula is) so a fast-but-weak and a slow-but-hard-hitting weapon are *different builds at the
same price*, not one strictly better. That's the "no dominant strategy" goal — the player
chooses between playstyles, not between numbers.

### 3. The curve shape: two levers — honest value backbone × sub-linear rarity bump

The pricing curve is **convex** in value (better tiers cost disproportionately
more — the "premium on better tiers" requirement), but the curvature is **gentle**,
driven by benchmark evidence. I checked BL3, Diablo 2/3, Grim Dawn, and PoE: in
every one, **rarity is a weak driver and honest value/level dominates the price.**
Rarity steps are ~2–3× per tier at most, and there is **no 256× anywhere** — the
old `value²` ladder (D=1, C=4, B=16, A=64, S=256) was a fantasy artifact, not
grounded in any real game.

So the curve is two levers, not one power-law:

```
price = k × value × rarityBump(tier)
```

- **`value`** is the honest backbone (the power score from §1) — the fairness
  floor. A weapon that kills 2× faster costs ~2× more. This is the "price the
  decision, not the number" floor.
- **`rarityBump(tier)`** is a small, **sub-linear** multiplier ladder that adds
  the chase without a cliff:

| tier | rarityBump |
|---|---|
| D | 1.0 |
| C | 1.15 |
| B | 1.35 |
| A | 1.7 |
| S | 2.2 |

**Read the ladder — the jumps shrink as you climb.** D→C is +15%, C→B is +17%,
B→A is +26%, A→S is +29% — but as *relative* steps, A→S is the *smallest* relative
jump of the whole ladder (2.2/1.7 = 1.29×), not a 4× stair. This is the benchmark
consensus: **A→S should NOT be massively more expensive than A.** A 5% DPS/value
improvement at the top is maybe a 1.3× cost bump, not 256×.

**Total D→S spread:** with an honest value backbone of ~2.5× (real DPS range) ×
rarityBump 2.2×, the full D→S price spread is roughly **5–10×** — a real chase,
but no fantasy cliff.

**Why not a pure power-law (`price = k × value^p`)?** The benchmark evidence
doesn't support it. Games price near-linear-in-value with a modest per-tier bump;
a pure power-law overstates the top-tier premium and re-creates the "S is a
fantasy" problem. The two-lever model keeps the convexity (better tiers cost more)
without the cliff.

**"High A ≈ Low S" in price:** because the bump is sub-linear and value is
continuous, an S at the *bottom* of its band and an A at the *top* of its band
price very close (they're adjacent on the value curve). The price label, like the
grade label, tells the truth.

**Tuning:** `rarityBump` is the single knob. Start at the ladder above; if the
data says top tiers feel too cheap, nudge S up (2.2 → 2.5) — never steepen the
value backbone to compensate for a flat population (widen stat generation instead).

**Push-back on the PRD's instinct:** the PRD's "S ≈ 100×, A ≈ 20×..." *discrete*
category multipliers are the wrong shape. A jump table makes two weapons in the same
tier cost the same even when one is 20% better (Finding 2 again), and the tier-to-tier
step is a cliff. **Keep the S/A/B/C labels for the player's excitement, but run a
continuous two-lever price underneath** — fair *within* a tier and smooth *between*
tiers. Best of both: the label is the fantasy, the price is the fairness.

### 4. Sell price: decay by grade (the commitment lever)

A flat "sell = 50% of buy" makes the shop a *rental* — the player buys, uses, resells at half,
and never commits. That kills the "is this the weapon for me?" tension. Instead, **let the
sell fraction decay with grade**:

- C-tier (or below): sell high-ish (e.g. 60–70%) — junk is liquid, clearing your belt.
- B/A: moderate (e.g. 40–50%).
- S: low (e.g. 10–20%).

Good weapons become a **real commitment** (sell them only to fund a big upgrade), junk becomes
freely disposable. This manufactures the actual fun decision: *"do I liquidate my S to chase
the new weapon, or keep it?"*

---

## Part 3 — Pitfalls to avoid (checklist)

1. **Pricing by grade instead of by power.** Prices the label, not the value. The player feels
   the unfairness the instant two "same-tier" weapons differ 20% in DPS.
2. **A single dominant stat.** If damage dominates, every weapon is "the one with the most
   damage" and there's no build choice. Keep the power score multiplicative.
3. **The "S ≈ 0.15%" fiction** (Finding 1). Don't advertise rarity the generator can't
   produce — the chase collapses. Fix the grade math (one line) first.
4. **Exponential pricing.** A wall that makes top tier feel unattainable. Use the two-lever
   model (honest value × sub-linear rarity bump).
5. **Discrete tier multipliers.** Two same-tier weapons priced identically despite 20% power
   gap = unfair and reads as a bug. Use a continuous curve.
6. **Flat sell = 50%.** Turns the shop into a rental and kills commitment. Decay the sell
   fraction by grade.
7. **Pricing weapons only, not attacks.** The attacks are half the weapon's value (build
   options, utility). Price them.
8. **Ignoring crit.** A weapon's crit profile is a real build axis. Roll it, price it, grade it.

---

## Part 4 — Concrete recommendations (in priority order)

1. **Fix the grade formula (one line, highest leverage).** Change `z_stat = (rolled−base)/range`
   to `/(range/3)` so z-scores are true sigma counts were. S/A/B become reachable at the intended
   rarities les. This unblocks the entire "fun of finding a good weapon" chase.
2. **Add crit to the power score and to the grade.** Roll crit; include it in the DPS power
   formula and in the grade z. Crit becomes a real build axis and a source of exciting finds.
3. **Price by continuous power, not by tier.** `price = k × value × rarityBump(tier)`,
   with the sub-linear bump ladder (D:1.0, C:1.15, B:1.35, A:1.7, S:2.2), plus speed-
   breakpoint and attack-utility premiums. Grade is a *display* label only.
4. **Decay sell price by grade** so good weapons are a commitment, junk is liquid.
5. **Make the player's attack timing K-style (Option A).** Change `commitAttackAction`
   so player cast/cooldown tics = `floor(weapon.speed × multiplier)`, mirroring monsters.
   This makes weapon `speed` a real attack-cadence driver and `value_speed = C/(speed+K)`
   the exact engine mirror. Highest-leverage code change; everything else flows from it.
6. **Decide the two [ASSUMPTION] tuning values** the PRD deferred — but with the power-score
   basis and two-lever curve above rather than the discrete multiplier tables:
   - buy multiplier: `k·value·rarityBump(tier)` (start k so a base C ~ template base_price).
   - sell discount: grade-decayed fraction (C≤0.7, A≈0.45, S≤0.2).

Nothing in the shop infrastructure needs changing to adopt this — the shop is already a
consumer of the weapon_instance + template patterns (PC-DEC-017/019/053) and the store screen
is already an AP-check trigger point (PC-DEC-073). The changes are all in **how we compute
grade/power and map it to price**, not in the schema.

---

## Known open questions (for Spahrep to weigh in on)

- **rarityBump ladder**: start at D:1.0, C:1.15, B:1.35, A:1.7, S:2.2. Do you want more
  "save-for-big-one" tension (nudge S up toward 2.5) or more "incremental" flow (flatten
  toward 1.5)? The ladder is the single tuning knob.
- **Do we want *any* gear-purchase decision to involve selling a committed weapon** (S-sell-low),
  or keep S non-sellable until a hard trigger? (The PRD already says no-sell-last = always ≥1.
  This is the "should the S weapon itself become a sacrifice for a bigger buy?" question.)
- **Should grade bands be re-tuned once they're reachable** (e.g. is S really ≤0.15%, or do we
  want S ≈ 0.5% so it shows up on a looting run now and then)?
- **Option A implementation scope**: change `commitAttackAction` to K-style player tics. Confirm
  the starting K-speed constant (C=100, K=10 proposed) and whether the player's approach/potion
  lock should also use the weapon speed (it already does).
