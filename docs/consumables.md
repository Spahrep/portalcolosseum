# Consumables (MVP)

**Decided:** 2026-09-08 (Spahrep + DarkJester + Hermes design conversation)
**Scope:** Weapons + consumables are the **only** item types for MVP. Armor, shields, materials, throwables, pouches, and crafting are all PMVP.

## Core Model

- Consumables modify **one stat** for now (PMVP: possibly multiple): **HP (heal), Speed, Accuracy, Damage**
- Template-based, exactly like weapons: `base ± delta` rolls
- Each potion rolls **two properties**:
  1. **Effect value** — the stat it modifies (heal amount, speed bonus, etc.)
  2. **Speed** — how fast the potion drinks. A healing pill pops in your mouth in ~1 tic; a "4L jug of heal juice" takes many tics. Speed is part of the roll, not fixed per template.
- **Grade (D/E/F → S) is computed AFTER generation** from the standard deviation curve — a UX label only, same grading system as weapons.
  - Example: a 20hp heal potion might grade A while a 22hp potion grades S. Small advantages command big premiums at the top.
- Potions are **unique rolls** — each one is its own item with its own values. Potions take a **full inventory slot**, no stacking (pouches are PMVP).

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
- Multiple stats per consumable (PMVP)
- Throw mechanic (PMVP)
- Disruption (PMVP)
- Potion pouches / stacking (PMVP)
