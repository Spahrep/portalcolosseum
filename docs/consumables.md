# Consumables (MVP)

**Decided:** 2026-09-08 (Spahrep + DarkJester + Hermes design conversation)
**Scope:** Weapons + consumables are the **only** item types for MVP. Armor, shields, materials, throwables, pouches, and crafting are all PMVP.

## Core Model

- Consumables modify **one stat** for now (PMVP: possibly multiple): **HP (heal), Speed, Accuracy, Damage**
- Template-based, exactly like weapons, **except effect deltas are `+` only** (see "Floor + Window" below)
- Each potion rolls **two properties**:
  1. **Effect value** — the stat it modifies (heal amount, speed bonus, etc.), rolled as floor + window
  2. **Speed** — how fast the potion drinks. A healing pill pops in your mouth in ~1 tic; a "4L jug of heal juice" takes many tics. Speed is part of the roll, not fixed per template.
- **Grade (D/E/F → S) is computed AFTER generation** from the standard deviation curve — a UX label only, same grading system as weapons.
  - Example: a 20hp heal potion might grade A while a 22hp potion grades S. Small advantages command big premiums at the top.
- Potions are **unique rolls** — each one is its own item with its own values. Potions take a **full inventory slot**, no stacking (pouches are PMVP).

## Effect Values: Floor + Window (all consumables)

- Every consumable's effect stat is generated from **four template numbers**, all `+`-only deltas:
  1. `floor_base` — the guaranteed minimum effect
  2. `floor_delta` — how much the floor can roll up
  3. `window_base` — the guaranteed bonus on top of the floor
  4. `window_delta` — how much the window can roll up
- Result: **`floor`, up to `floor + window`** — e.g. `floor_base=100, floor_delta=10, window_base=20, window_delta=10` produces anywhere from **"100+, up to 120"** (worst roll) to **"110+, up to 140"** (best roll).
- **High-variance items are just extreme rolls of the same dice — no special rule needed.** A template with `floor_base=10, floor_delta=0, window_base=0, window_delta=300` produces a "10+, up to 310" gamble potion: almost a coin flip, but the floor means it never heals 0 — a bad roll reads as "the gamble didn't pay," never "the game cheated me." The floor always protects the player's dignity. (A ± bomb would still be a hidden betrayal because exact monster HP is invisible — but a wide *window* on a floor-guaranteed item is a transparent gamble, fully visible on the label.)
- **Labels always show `X+, up to Y`** — the floor is the number on the card, the full range (however wide) is visible on the detail screen. Both must always be visible (floor front and center, range one tap away — never hidden).
- **Deltas are `+` only for ALL consumables — potions, bombs, anything consumed or thrown.** No `±` anywhere in the consumable family.
- **Why (the One-Sample Rule):** a consumable is used exactly once, at the player's most critical moment. A low roll on a single sample is a betrayal — it reads as "the game cheated me," not "the gamble didn't pay." `+`-only means the item can *never* under-deliver below its template's promise; only the upside varies. The template name becomes a guarantee ("Minor Healing = at least 100").
- **Weapons are the deliberate exception:** they roll hundreds of times per fight, so `±` is free texture — low swings average out and skill still wins. Single-use items never betray; many-sample items can swing.
- **This is what replaces the "gamble bomb" fantasy:** a "10–100 chaos bomb" as a `±` item would be a hidden betrayal (exact monster HP is invisible, so its odds aren't actually visible). But the *same fantasy* is fully available as a wide-window `+`-only consumable (e.g., "10+, up to 310") — a transparent gamble the player can read on the label. High variance lives in the **window**, never in the **floor**.

## Using a Consumable (Combat)

- Requires a hand that is **free = not on cooldown**. The hand may be holding a weapon — "free" means available to act, **not empty**.
- Sequence:
  1. Hand R free → select **Drink Potion A**
  2. `pre = f(hand weapon speed, potion speed)` — hand locked during pre-time
  3. **Effect starts** (buff begins its duration / heal applies)
  4. `post = f(hand weapon speed, potion speed)` — hand still locked, buff running
  5. Hand R free again
- **Cooldowns live on HANDS, never on weapons.** The potion's "cooldown" IS pre + post, costed by the weapon in that hand.
- The **other hand keeps attacking** the whole time — drinking locks one hand, not the turn.
- Formula shape: pre/post scale with the weapon in hand AND the potion's own speed. Exact formula TBD.
- Weapon speed does triple duty: attack rate, potion timing, and (TBD) swap timing.

## Buffs & Debuffs

- Apply to the **player**, not the hand — both hands are affected (a speed potion speeds up both hands; e.g., RH 50 + LH 90 → both scaled).
- **Flat values, additive stacking**: two speed potions both active = bonuses added. Each potion has its own **separate end tic** (no refresh mechanic).
- **Duration** applies to non-heal consumables (speed/accuracy/damage). Heals are instant once the effect lands — no duration.

## Interruption & Disruption

- Pre-time is **uninterruptible** for MVP.
- **Disruption** (striking a hand mid-drink/mid-recovery to throw off its timing) is PMVP.

## Throw Mechanic

- **No throw for now.** PMVP flavor idea (FF-style: use a healing potion on a zombie to damage it). Do not build for MVP.
- **When throwables arrive, they use the same Floor + Window model with `+`-only deltas** — same schema, same label format, one generation path for all consumables.

## Where Consumables Can Be Used

- **During combat** (one hand, per the sequence above)
- **Between fights** within a run (Potion A/B slots)
- **Outside the portal** (town) — confirmed. Healing with potions outside the portal works. (The broader town healing model — wizard tent — is TBD; see ap-economy.md.)

## Loot

- Potions drop via the LP system **exactly like weapons**: template-costed (LP cost is based on the template, not the roll), assigned to portals and monsters per the normal loot tables.
- Potions drop into the **prize pool — cannot be used mid-run**. What you bring is all you have.

## Loadout (per run)

- **Hand L, Hand R, Belt Loop, Potion A, Potion B**
- Loadout is **locked at entry** — no inventory access between fights. Your 2 potions are the entire consumable budget for all 5 fights.
- Potions usable during or between fights; belt loop (weapon swap) also usable between fights.
- Starting loadout: same for everyone, decided later, will likely change with each season.

## TBD / PMVP

- Exact pre/post formula (f(weapon speed, potion speed))
- Exact duration numbers per template
- **Shop pricing key: does price run off the floor, the window, or the rolled center?** (follow-on from Floor + Window — needs a decision when shop numbers are done)
- Multiple stats per consumable (PMVP)
- Throw mechanic (PMVP — inherits Floor + Window, `+`-only)
- Disruption (PMVP)
- Potion pouches / stacking (PMVP)
