# Inventory Slots

## Initial Design

Players start with limited carrying capacity to enforce meaningful choices:

- **2 hand slots** (primary weapon configurations)
- **1-2 additional item slots**

## Intended Uses

- Consumables (potions, scrolls, etc.)
- Weapon swaps (different damage/speed profiles for different situations)
- Utility items

## Configuration Options Being Explored

- 1 consumable slot + 1 "belt loop" slot dedicated to a swap weapon
- Flexible assignment of the extra slots

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
