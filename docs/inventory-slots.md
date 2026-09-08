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

### Structure

**One table defines the player's backpack:**

1. **`player_inventory`** — Persistent backpack storage
   - One row per item the player is carrying
   - `user_id` (UUID → `auth.users`) — whose backpack this is
   - `slot_index` (0–19) — position in the 20-slot inventory grid
   - `weapon_instance_id` (bigint → `weapon_instance.id`) — the item carried
   - No assignment columns, no `is_equipped` flag — this is purely "what's in my bag"
   - LRBP gear assignments will live on a future `portal_run` table, referenced from here

### Why This Structure

- **Single responsibility:** `player_inventory` only tracks backpack contents. The run/loadout problem doesn't exist yet, so we don't model it.
- **No stale state:** If a run is abandoned or failed, no "unequipped" cleanup is needed — the run record just isn't used again.
- **Simple queries:** "What's in my bag?" = look at `player_inventory` rows for the player.
- **Deferred design:** The `portal_run` table (which will hold LRBP assignment columns) is deferred until you decide what columns a run needs. This table won't need to change when that happens.

### Slot Naming Reference (future — for when portal_run is added)

The five gear positions that will be assigned per-run:

| Column              | Label        | Notes                          |
|---------------------|--------------|--------------------------------|
| `hand_l_item_id`    | Hand Slot L  | Primary weapon                 |
| `hand_r_item_id`    | Hand Slot R  | Secondary weapon / shield      |
| `belt_loop_item_id` | Belt Loop    | Dedicated swap / utility slot  |
| `pouch_l_item_id`   | Belt Pouch L | Consumables / quick items      |
| `pouch_r_item_id`   | Belt Pouch R | Consumables / quick items      |

## Starting Equipment

- Same loadout for **all players**, decided later.
- Will likely **change with each season**.

## PMVP

- Potion pouches (stack multiple potions in one slot)
- 2H weapons (both hands required — affects swap rules)
- Armor/shields/materials/throwables as item types
- Inventory expansions or other space-management tools
