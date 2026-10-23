# Combat Values Design — Weapon Value → Grade → Price

**Status:** Design draft (uncommitted). Not the PRD — the math-first grounding doc
that the pricing PRD depends on. Frames the four design requirements into one
coherent value model before any pricing numbers are set.

**Owners:** Spahrep + Hermes (design discussion, PC-DEC-074 thread)
**Date:** 2026-10-19
**Applies to:** weapon value/grade/pricing + combat stat generation. Directly
informs `docs/design/weapon-pricing-design.md` and the approved shop PRD (PC-DEC-074).

---

## 0. The four requirements, restated as one question

The design discussion boiled down to a dependency chain. You asked: "do our
combat formulas and weapon-generation formulas make sense, and if not what
should they be, and is there value in the k-style formulas?" That reframes the
whole pricing problem: **price is a symptom. Value is the disease.** We cannot
price a weapon until we know what its "value" number means, and we cannot know
that until the combat/stat math produces an honest, wide spread.

The four requirements, in dependency order:

1. **Wide value spread** — combat mechanics + stat generation must produce
   enough variety that weapons can be told apart.
2. **Tier = f(value)** — grade is a *label* on the value curve, not an
   independent thing. Reachable D–S tiers fall out automatically once the
   curve is right.
3. **Premium price on better tiers** — price is a *convex* function of value
   (better tiers cost disproportionately more).
4. **D–S reachable + "High A ≈ Low S" legitimately possible** — a consequence,
   not a separate requirement, once 1–3 hold.

```
value family first → gen spread becomes whatever the curves demand → tier = f(value) → D–S reachable
```

The order matters. If you pick the shape of `value` first, generation spreads
(loot formulas, z-scores, speed rolls) become *consequences* you tune to feed
the curve — not constraints that fight it. That is the central move of this doc.

---

## 1. Where we are today (the honest audit)

Before proposing, here is the ground truth of the current engine, verified from
code (`js/combat/damage.js`, `js/combat/participants.js`, `js/combat/tic-queue.js`,
`api/combat/dev/[...path].js`, and the crit/grade docs).

### 1.1 The engine already uses K-style for monsters — the player does NOT

This is the core contradiction, and it is the single most important fact in
this whole design. **Monsters and the player run on different time systems.**

**Monsters** resolve attacks on a tick queue where the *speed* stat is a
tic-cost multiplier (K-style):

```
winding  = max(1, floor(mon.speed × prepareMultiplier))     // ticks between attacks
cooldown = max(1, floor(mon.speed × cooldownMultiplier))
attacks/sec = 1 / tic-cost
```

where each `multiplier` is a per-attack roll:
`multiplier = rollMultiplier(base, range) = max(0, base + (rng()×2 − 1) × range)`.

So monster combat power scales like **1/speed** (inverse-linear) — a K-family
ratio. Higher `mon.speed` = MORE tics = SLOWER attack. The monster side is
*already* running on the `x/(x+K)` sensible-shape family.

**The player does NOT.** The player's attack timing is flat constants
(`commitAttackAction`, `js/combat/engine.js`):

```
castTicks     = max(1, (params.castTicks     || 3) − spdBuff)
cooldownTicks = max(1, (params.cooldownTicks || 2) − spdBuff)
```

The weapon's `speed` stat does **not** enter the player's attack cycle at all —
it only affects the initial approach row (`hand_l_speed`/`hand_r_speed`) and
potion lock time. The player is on a fixed 3+2 = 5 tic cycle (minus buffs),
regardless of weapon speed.

**DECISION (2026-10-19, Spahrep): Option A — make the player K-style too.**
Player attack tics become `floor(weapon.speed × multiplier)`, mirroring monsters.
This makes `value_speed = C/(speed+K)` the *exact* engine mirror on both sides,
and makes the weapon `speed` stat mean what the player thinks it means (a real
attack-cadence driver, not dead weight). This is the coherent end-state and the
basis for everything below.

**The grade formula** does NOT use K-style. It uses a naive linear z-score:

```
zd = (damage − base_damage) / damage_range          // ∈ [−1, +1]
zs = (base_speed − speed)  / speed_range            // ∈ [−1, +1]  (speed inverted)
za = (accuracy − base_accuracy) / accuracy_range    // ∈ [−1, +1]
z  = (zd + zs + za) / 3
grade:  z≥3 S · z≥2 A · z≥1 B · z≥0 C · z≥−1 D · z≥−2 E · z<−2 F
```

Each individual stat is bounded to [−1, +1], so `z` is bounded to [−1, +1], which
means **S and A are mathematically unreachable** — the best possible grade is B.
(Same naive linear-pricing shape shows up in the loot formulas and the shop.)

### 1.2 Findings that constrain the fix

- **FINDING 1 — S/A unreachable.** `normal_int` rolls within 3σ; the grade
  divides by `range`, not by σ, and per-stat z is capped at ±1. Max grade is B.
- **FINDING 2 — Grade ≠ power.** Two weapons both labeled "C" can differ by 20%
  or more in real DPS. The label lies.
- **FINDING 3 — Crit is invisible to grade and price.** Flat 5%, multiplier 2.0,
  PC-72. A crit-heavy weapon is not scored or priced as better than a crit-light
  one, even though it plays differently (burst/risk).
- **FINDING 4 — No defense/mitigation stat anywhere.** The only "reduction" in
  the engine is `multiTargetReduction` (multi-target penalty). `Armor/(Armor+K)`
  has no stat to feed it yet — the shape is right, there's just nothing driving it.
- **FINDING 5 — Player speed is dead weight (pre-Option-A).** The player's
  weapon `speed` stat did not affect attack cadence — only approach/potion lock.
  Option A fixes this by making it a real tic-cost driver.
- **The speed stat is mispriced** even *as a label*: the engine's DPS value curve
  is `1/speed` (ratio family), but grade's `zs` treats each tick delta as equal
  (linear). The label contradicts the engine.

### 1.3 What this means in plain English

The combat engine is *honest* — it does real DPS math. The grade and pricing are
*naive* — they use a flat linear ladder that (a) can't reach high tiers, (b) lies
about real power, and (c) doesn't know crit exists. Fixing this is not "tuning
prices." It's choosing what the value number meansaitchand then making the label
and the price tell the same story the engine already tells.

---

## 2. The value model — TWO FORKS, then how they combine

We need a single number that says how good a weapon is. Both forks below share a
vital prerequisite: **honest DPS is the foundation** — nothing in the value model
ever lies about real combat output. The forks differ in *how much* designer-intent
chase-curve you layer on top of that honest number.

### FORK 1 — What does "value" *mean*?

Two philosophies. Both are legitimate; they answer different questions.

---

#### Path A — Value = honest DPS (descriptive / the mirror)

`value` literally means: "this weapon produces about this much damage per unit
time." We compute it from the real combat math.

**Concrete example with our own engine.** Take a weapon with flat stats
(damage 40, speed 4 → ≈2.5 attacks/sec, accuracy 85, crit 5%/×2.0):

```
DPS = damage × (100/speed) × (accuracy/100) × (1 + crit% × (critMult−1))
    = 40 × (100/4 × 1/100) ... careful with units:
    = 40 × (100/4) ticks? — no. Let's do it in engine terms.
```

Using the engine's actual numbers (DPS = damage × (100/speed) × (accuracy/100) × crit-term):

```
Weapon 1: damage 40, speed 4, accuracy 85, crit 5%
DPS = 40 × (100/4) × (85/100) × (1 + 0.05×(2.0−1))
    = 40 × 25 × 0.85 × 1.05
    = 892.5
```

But wait — in our tick engine, `speed` is ticks-per-attack and DPS = damage × (100/speed).
So speed 4 → (100/4) = 25 attacks per 100 ticks. That's the engine's real ratio.

Now a second weapon that the *naive linear* grade calls equal (because the three
stat z-scores roughly cancel):

```
Weapon 2: damage 45, speed 5 (slower), accuracy 78
DPS = 45 × (100/5) × (78/100) × 1.05
    = 45 × 20 × 0.78 × 1.05
    = 737.1
```

**The linear grade called these equal. Real DPS says Weapon 1 is 21% better.**
Path A fixes exactly this: `value` = 892.5 vs 737.1. The label now tells the truth.

**The catch with Path A alone (the mirror is passive):** value is a *result*,
not a *design lever*. It can only ever be as wide as the combat math makes it.
If combat yields a narrow 20% gap, "S" and "A" are only 20% apart — you can't
design the chase tension you want (Req-3) except by widening real DPS. Path A is
honest but *bounded*: it reflects the engine, it doesn't shape the economy.

---

#### Path B — Value = designer-chosen chase curve (prescriptive / the instrument)

`value` is a *decision*: "I want each tier to be worth this much more than the
one below," and we tune K/curvature/stat-spread to *make it so*. This is the
WoW/Diablo style — the value number is a target for the *desired* fun, not a
mirror of the engine.

**Concrete example.** The design team decides each tier is 2× the value of the
previous one (a doubling ladder):

```
D = 1.0 power-unit
C = 2.0
B = 4.0
A = 8.0
S = 16.0
```

Now `value` is an *intended* number — the chase curve. Stat generation, K-value,
and price all bend to hit "D≈1, C≈2, B≈4, A≈8, S≈16." This is a genuine design
instrument: you decide the excitement gap and the game conforms.

**The catch with Path B alone:** if the chosen curve drifts from real DPS, the
player feels it. If S is "supposed" to be 16× but combat only makes it 1.5×
better, the S weapon is a *lie* — the resentment disease (the opposite failure
from today). Path B needs a guardrail so the curve never disconnects from the
engine it labels.

---

#### The two forks combined — Path A as the skeleton, Path B as the seasoning

**They are not mutually exclusive. The strongest design layers both:**

```
value = honestDPS × chasePremium
```

- **honestDPS** is always true (Path A's honesty) — the number never lies.
- **chasePremium** is a modest, K-curved multiplier on top (Path B's chase) —
  adds the "better tiers feel worth chasing" tension, but *small* (say +20–40%
  worst case at the top), never enough to break honesty.

**Why this satisfies all four requirements at once:**

- **Req-1 (wide spread)** — honestDPS gives the true combat spread; chasePremium
  widens it on top. Both are continuous.
- **Req-2 (tier = f(value)) and Req-4 ("High A ≈ Low S")** — because value is one
  continuous number, "High A ≈ Low S" drops out *naturally* (they're adjacent
  points on the same curve), and every tier is reachable.
- **Req-3 (premium on better tiers)** — the chasePremium *is* the premium, and
  price is a *convex* function of value (a steeper curve still on top, §4).

**Recommendation (mine): Path A skeleton + Path B seasoning, with a small
chasePremium.** The number never lies, and the chase is real — the two goals stop
fighting.

---

### FORK 2 — The K-family: which curve turns a stat into value?

This is the "should we use the k-style formulas?" question, made concrete. Both
options below are K-family. The question is *which exact shape* — and here speed
is the star case, because it's where our naive linear formula most obviously
contradicts the engine.

The engine already tells us the answer's family: **DPS scales as `1/speed`**. So
the value contribution of speed must be a ratio/power shape, not linear. Two ways
to write it (Mach both):

---

#### Option 1 — `value_speed = C / (speed + K)`  (inverse-linear ratio, the engine mirror)

This is literally `1/(speed+K)`, the inverse of the tic-cost.

**Concrete, engine-real numbers.** Let `C = 100, K = 10`:

| speed | attacks/100ticks | value_speed = 100/(speed+10) |
|---|---|---|
| 1 | 100 | 100/11 = **9.09** |
| 2 | 50 | 100/12 = **8.33** |
| 4 | 25 | 100/14 = **7.14** |
| 8 | 12.5 | 100/18 = **5.56** |
| 16 | 6.25 | 100/26 = **3.85** |
| 32 | 3.1 | 100/42 = **2.38** |

**Read the pattern — this is the doubling-game's own insight:** going 1→2 speed
(2× faster) gains 0.76 value; going 16→32 (also 2×) gains only 1.47... wait,
that's *more* absolute — but as a *fraction* it's smaller. The key: **each tick
of speed is worth less the faster you already are.** 4→8 (4 extra ticks) moved
value 1.58; 8→16 (8 extra) only moved 1.71 — and those are *faster*, so real DPS
gain is compressed. The curve is gentle and every tier stays reachable.

| Option | Shape | Tunable knob | Matches engine? | Steepness control |
|---|---|---|---|---|
| 1. `C/(speed+K)` | inverse-linear | one constant K | YES — it *is* 1/speed | gentle; steepen by lowering K |
| 2. `k × speed^p` (p<0) | inverse-power | exponent p | YES — it is 1/speed^p | tunably steep (p=−1.5 very steep) |

---

#### Option 2 — `value_speed = k × speed^p` with p < 0 (inverse-power law)

Same family, tuned by an exponent instead of an additive Kanna.

**Concrete, `k = 100, p = −0.75`:**

| speed | 100 × speed^(−0.75) |
|---|---|
| 1 | 100 |
| 4 | 100 × 0.354 = 35.4 |
| 16 | 100 × 0.125 = 12.5 |
| 64 | 100 × 0.044 = 4.4 |

**p = −0.75 is quite steep.** 1→4 speed (4×) drops value by 65%. That's a strong
statement: "fast is dramatically more valuable." At p = −1 it's exactly 1/speed
(the pure engine mirror). At p = −1.5 it's barely reachable at the top.

| | `C/(speed+K)` | `k×speed^p` |
|---|---|---|
| Shape | inverse-linear (mild curve) | inverse-power (tunably steep) |
| Tuning | one constant K | one exponent p |
| Engine match | exact (it IS 1/speed) | exact (it IS 1/speed^p) |
| Reachable tiers | all, gentle | all if p kept mild; unreachable if p too steep |
| Risk | may be too flat at the top | can overshoot → S unreachable again |

---

#### Which to pick — my recommendation: Option 1 (`C/(speed+K)`), with a concrete K

**Recommendation: `value_speed = C / (speed + K)` with C ≈ 100 × (something),
K ≈ 10, start gentle and steepen later only if the data says so.**

Reasons:

1. **It's the exact inverse of the engine's tic-cost.** `tic = speed × multiplier`;
   `value_speed = C/(speed+K)` is the reciprocal. The symmetry is the point: one
   family on both sides of the engine (combat time vs. weapon value). No other
   choice reads as true to the engine.
2. **A single flat K is the gentlest way to keep all tiers reachable** — the exact
   bug we just fixed (S/A unreachable) is caused by a too-steep/labeled curve.
   Start with a shape that *cannot* over-overshoot.
3. **It reads true to the player's feel.** "A slow weapon's speed is precious; a
   fast weapon's next increment is less precious" — that IS the K-family pitch,
   and Option 1 states it in the cleanest form.

**If the real stat spreads still bunch up at the top after this** (all weapons
landing C/D, no A/S), we steepen to the power law (lower p) without redesign —
same family, sharper curve. Start gentle, steepen only if the data demands.

---

## 3. The full model — value = honestDPS × chasePremium, with K-speed inside

Combining the two forks into one concrete formula:

```
DPS_true = damage × (100/speed) × (accuracy/100) × (1 + crit% × (critMult − 1))

value_speed = C / (speed + K)                    // K-style, Rate the speed

chasePremium = 1 + chaseGain × (1 − 1/(tierIndex + someK))   // modest K-curve on tier

graderaw = DPS_true × chasePremium              // continuous scalar
```

Then:
```
grade = band( graderaw )   // S/A/B/C/D/E/F contiguous bands on the value axis
price = k × graderaw × rarityBump(tier)   // two-lever model, see §4
```

**Why this is coherent:**
- `DPS_true` is honest (Path A). It never lies about combat output.
- `value_speed` is K-family (Fork 2, Option 1) — matches the engine exactly, and
  gives speed the respectful, diminishing value it deserves.
- `chasePremium` is a modest K-curve (Path B's seasoning) — adds the chase without
  breaking honesty. "High A ≈ Low S" remains true because A and S are adjacent on
  one continuous value curve, arithmetic, not coincidence.
- `grade` = bands on the value axis, all reachable because the underlying value is
  a smooth curve from bad to great, not a capped ladder.
- `price` = two levers: honest value backbone + a small sub-linear rarity bump
  (Req-3), so better tiers cost more but never a fantasy cliff.

**Crit note (PC-72/PC-DEC-050):** crit is ADDED to `DPS_true` via its contribution
term — but it is NOT currently rolled as a build axis (flat 5% everywhere) and is
NOT part of the grade formula (PC-DEC-051). Two options for this doc:
- **Keep crit out of grade** (MVP, PC-DEC-051, all flat 5% — a no-op in DPS term),
  and treat it purely as seasoning in chasePremium. Simplest, matches shipped code.
- **Later: make crit a real rolled build axis** and fold it into `DPS_true` (it
  already has a term there). That's a *future* avenue because rolling crit = a
  stat-gen change; this doc notes it, doesn't force it.

---

## 4. Price = two levers: honest value backbone + sub-linear rarity bump

Price is NOT grade-linear and NOT value-linear. It is **convex** in value — better
tiers cost disproportionately more (your Req-3) — but the curvature is **gentle**,
driven by benchmark evidence (BL3, Diablo 2/3, Grim Dawn, PoE: rarity is a weak
driver, level/honest value dominates, rarity steps ~2–3× per tier, no 256×
anywhere).

```
price = k × value × rarityBump(tier)
```

- **`value`** is the honest backbone (DPS_true × chasePremium) — the fairness
  floor. A weapon that kills 2× faster costs ~2× more.
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
but no fantasy cliff. (The old `value²` table — D=1, C=4, B=16, A=64, S=256 — is
**REJECTED**: it was a fantasy-ladder artifact, not grounded in any real game.)

**"High A ≈ Low S" in price:** because the bump is sub-linear and value is
continuous, an S at the *bottom* of its band and an A at the *top* of its band
price very close (they're adjacent on the value curve). The price label, like the
grade label, tells the truth.

**Tuning:** `rarityBump` is the single knob. Start at the ladder above; if the
data says top tiers feel too cheap, nudge S up (2.2 → 2.5) — never steepen the
value backbone to compensate for a flat population (widen stat generation instead).

---

## 5. The stat-generation spread that feeds this

The value model demands a wide, honest spread. The changes to generation flow
*from* the curve (remember: value first, spread follows). Three concrete moves,
in dependency order:

1. **Widen the damage/accuracy/speed base+range so the value curve is actually
   populated across all tiers.** The current linear-z grading collapses because
   the spread is too narrow. The K-speed curve (Fork 2, Option 1) now defines how
   wide speed must be. If the top of the value range is unreachable, widen the
   stats (base_damage/damage_range etc.), not the grade bands.
2. **Roll crit as a real build axis (future, PC-DEC-050 note)** — this adds a
   genuine fourth dimension (burst vs. consistent) and widens value further.
   Currently flat 5%, not part of grade (PC-DEC-051); this doc lists it as a
   forward path, not an MVP change.
3. **Regrade = recompute grade on the value axis, not the linear z.** Because we
   changed the formula, existing weapon instances need a regrade pass (or a
   one-time backfill) so labels match real value.

Big-picture: generation must *produce whatever spread the curve demands*. We are
not tuning the curve to fit existing rolls; we are widening the rolls so the curve
is populated honestly.

---

## 6. Summary — the moves in one line each

| # | Move | What it fixes | Requirement |
|---|---|---|---|
| 1 | **Player speed → K-style** (`floor(weapon.speed × multiplier)`, mirror monsters) | player speed was dead weight; make it a real tic-cost driver | Req-1, consistent engine |
| 2 | Speed value = `C/(speed+K)` | grade's linear z contradicts 1/speed engine; make them one family | Req-1, consistent engine |
| 3 | Value = `DPS_true × chasePremium` | label must tell truth + chase must be real | Req-2, Req-3, Req-4 |
| 4 | Tier = contiguous bands on the value axis | S/A reachable, "High A ≈ Low S" is arithmetic | Req-2, Req-4 |
| 5 | Price = `k × value × rarityBump(tier)`, sub-linear ladder | premium on better tiers, no fantasy cliff | Req-3 |
| 6 | Widen stat-gen spread to feed the curve | value spread wide enough to differentiate | Req-1 |

**Dependency order (final):** value family → gen spread → tier bands → price → D–S reachable.

---

## 7. Open follow-ups (NOT blockers)

- **Implement Option A** — change `commitAttackAction` so player cast/cooldown
  tics = `floor(weapon.speed × multiplier)` instead of flat 3/2. This is the
  highest-leverage code change; everything else flows from it.
- Confirm the K-speed starting constant (this doc uses C=100, K=10 as a proposal —
  adjustable in development).
- Decide whether crit becomes a rolled build axis this pass or stays flat-5% (the
  doc leaves it as a future path; PC-DEC-051 currently keeps it out of grade).
- Regrade/backfill plan for existing weapon instances once the new formula lands.

All of these are design-tunable, not locked. **We are in development; base values
are mutable.**
