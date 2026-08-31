# Procedural Weapon Generation System

**Source:** Jester's Ideas Log (2026-08-26)  
**Status:** Design Concept (Post-MVP consideration)  

**Note:** Several parts of the weapon generation system are provisional and subject to iteration.
**Principle:** Randomness at all stages with controlled balance via point budgets.

## Overview

Weapons are procedurally generated using a layered template system that combines:

- **Base** values (core stat anchors)
- **Delta** ranges (per-weapon variation)
- **Variance** (per-attack swing)
- **Point Budget** (global balance constraint per weapon class)

This produces a wide variety of weapons that feel distinct while remaining relatively balanced within their class. Point totals follow a bell-curve distribution (high-end weapons are rare).

## Weapon Template Structure

### Core Fields
- **Name**: Weapon type (e.g., "Sword", "Axe", "Staff")
- **Attack Slots**:
  - Slot 1: Simple Attacks (required)
  - Slot 2: Simple or Advanced Attacks (optional)
  - Slot 3: Any Attack, Simple magic (rare)
- **Stats** (see sections below)

### Example Weapon Stats
```
Base_Damage: 20
Damage_Delta: +/- 6     → effective base range 14-26
Damage_Variance: +/- 6  → individual swings can vary further (e.g. 8-32)

Base_Speed: 20
Speed_Delta: +/- 2
Speed_Variance: +/- 3
```

## Base + Delta + Variance Breakdown

### 1. Base
The foundational stat value for the weapon class. This is the "average" starting point before any randomization.

### 2. Delta
Defines the allowable deviation when the weapon is first generated. Creates the weapon's overall power band.

- Example: `Damage_Delta: +/- 6` on `Base_Damage: 20` → weapon can spawn with effective base damage anywhere from 14 to 26.
- Delta changes cost or return points in the Point Budget system.

### 3. Variance
Per-attack randomness that applies on every individual swing, independent of the weapon's base.

- Example: `Damage_Variance: +/- 6` means even a weapon with base 20 can deal anywhere from 14-26 on a normal hit (further modified by attack type).
- Provides "feel" of swinginess without affecting the weapon's identity.

**Relationship**:
`Final Damage = (Base + Delta) ± Variance + Attack Modifier`

## Point Budget System

Each weapon class is assigned a **total stat point budget** (example range: 20–40 points).

### Rules
- Individual attacks have associated point costs.
- Increasing stats via Delta costs points.
- Decreasing stats returns points (can be used to afford better attacks or other stats).
- Goal: Keep generation balanced within a class while still allowing clearly superior or inferior weapons.
- Distribution: Bell-curve — 40-point weapons are rare; most fall in the middle.

### Example Flow
1. Start with base weapon class budget (e.g. 30 points for a Sword).
2. Choose attacks → deduct their point costs.
3. Adjust Deltas → spend or gain points.
4. Final weapon power level determined by remaining/overspent points (clamped or rarity-weighted).

### Open Questions (from notes)
- Exact point costs for attacks and stat deltas?
- Should budget ranges vary by weapon type?
- Should the point total be visible to players?

## Weapon Quality Grade (Current idea, subject to change)
- Attacks are rolled independently of the weapon quality grade.
- The quality grade (S–F) is determined solely by the base stats.
- **Current idea, subject to change**

## Attack Template Example

**Quick Attack**
- Dmg Modifier: -25%
- Speed Modifier: -30%

Other attacks (Heavy, Whirlwind, etc.) would follow similar modifier + point-cost patterns.

## Future Integration Notes
- Ties into planned Crafting / Enchanting systems (post-MVP).
- Different weapon types (Sword vs Staff) may have different slot rules or stat ranges.
- Supports the "randomness at all stages" design philosophy.

---
*Document generated from Jester notes for easy reference. Cleaned and structured for maintainability.*
