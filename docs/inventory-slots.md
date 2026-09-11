# Inventory Slots

**Updated:** 2026-09-08 — loadout confirmed (Hand L/R, Belt Loop, Potion A/B), locked at entry

## Initial Design

Players start with limited carrying capacity to enforce meaningful choices:

- **2 hand slots** (primary weapon configurations)
- **1-2 additional item slots**

## Confirmed Loadout (per portal run)

**Hand L, Hand R, Belt Loop, Potion A, Potion B** — five gear positions assigned when the run starts.

- **Hand L / Hand R** — weapons (or potion use; see consumables.md — a hand may drink even while holding a weapon)
- **Belt Loop** — holds a **second weapon** (not a utility item). Weapon swap mechanics are TBD:
  - Swap mid-fight is possible
  - Swap costs time: `f(weapon in hand speed, belt weapon speed)` — possibly the same timing formula as potions
  - Hands are fully independent — UNLESS a 2H weapon exists (PMVP), in which case both hands must be free for the swap
- **Potion A / Potion B** — consumables; usable during combat or between fights

**Loadout is locked at entry.** No inventory access between fights — the 5 assigned items are the only things usable in a run. This makes pre-run gear selection a high-stakes decision.

## Backpack (20 Slots)

- **20-slot inventory grid** confirmed for MVP.
- Items are never persistently "equipped" — the inventory is a backpack; the run records its own assignments (see Current Architecture below).
- Potions take a **full inventory slot each**, no stacking. (Potion pouches — e.g., a pouch holds 5 potions in one slot — are PMVP.)
- Space management is an intentional pressure. Selling loot to shops is the release valve.

## Intended Uses

- Consumables (potions, etc.)
- Weapon swaps (different damage/speed profiles for different situations)
- Utility items

## Design Goals

- Prevent inventory bloat
- Make every carried item feel valuable
- Support tactical mid-run decisions without overwhelming the player

## Relation to Combat

Limited slots interact directly with the tic-based combat system — choosing the right weapon or consumable at the right moment becomes a high-stakes decision.

---

## Current Architecture (Decided: 2026-09-05)

### Core Principle: Inventory ≠ Run Assignment

**Items are never persistently "equipped." Instead, players assign items to portal runs.**

When a portal run is started, the run records which items from the player's inventory are used in each position. The inventory itself is just a backpack — it holds items, it does not track assignments.

**Rule (Decided 2026-09-11): inventory should only ever be assigned to a player.** A run records its own loadout; it never takes ownership of inventory rows.

### Structure

**One table defines the player's backpack:**

1. **`player_inventory`** — Persistent backpack storage
   - One row per item the player is carrying
   - `user_id` (UUID → `auth.users`) — whose backpack this is
   - `slot_index` (0–19) — position in the 20-slot inventory grid
   - `weapon_instance_id` (bigint → `weapon_instance.id`) — the item carried
   - No assignment columns, no `is_equipped` flag — this is purely "what's in my bag"
   - Loadout assignments live on `portal_run` (`hand_l_weapon_id`, `hand_r_weapon_id`, `belt_weapon_id`, `consume_a_id`, `consume_b_id`) — the run records its own loadout

### Why This Structure

- **Single responsibility:** `player_inventory` only tracks backpack contents. The run/loadout lives on `portal_run`, not here.
- **No stale state:** If a run is abandoned or failed, no "unequipped" cleanup is needed — the run record just isn't used again.
- **Simple queries:** "What's in my bag?" = look at `player_inventory` rows for the player.
- **Deferred design:** consumable instances are pending a `consumable_instance` table; `consume_a_id`/`consume_b_id` are placeholders on `weapon_instance` until then.

### Slot Naming Reference (future — for when portal_run is added)

The five loadout positions assigned per run (live on `portal_run`):

| Column              | Label        | Notes                          |
|---------------------|--------------|--------------------------------|
| `hand_l_weapon_id`    | Hand Slot L  | Primary weapon                 |
| `hand_r_weapon_id`    | Hand Slot R  | Secondary weapon / shield      |
| `belt_weapon_id` | Belt Loop    | Dedicated swap / utility slot  |
| `consume_a_id`   | Consume A | Consumables / quick items      |
| `consume_b_id`   | Consume B | Consumables / quick items      |

## Starting Equipment

- Same loadout for **all players**, decided later.
- Will likely **change with each season**.

## PMVP

- Potion pouches (stack multiple potions in one slot)
- 2H weapons (both hands required — affects swap rules)
- Armor/shields/materials/throwables as item types
- Inventory expansions or other space-management tools
