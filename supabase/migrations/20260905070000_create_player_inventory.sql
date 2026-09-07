-- ============================================================
-- Migration: Create player_inventory table
-- Created: 2026-09-05
-- Purpose: Player backpack — 20 slot inventory grid for weapons
-- NOTE: No portal_run schema yet — that's a future migration
--       when we've decided what columns a run needs
-- ============================================================

BEGIN;

-- ============================================================
-- 1. player_inventory: Items in a player's backpack
--    - One row per item carried (slot_index 0-19)
--    - No assignment/equip state — just "what is in the bag"
--    - Currently only weapon_instance_id is supported
--    - Gear slot assignments will live on a future portal_run table
--    - No inventory_slot_type table — only 'inventory' slot exists
--      for MVP. Add slot_type back if bank/storage/other categories
--      are needed later.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.player_inventory (
  id                 bigint       primary key generated always as identity,
  user_id            uuid         not null references auth.users on delete cascade,
  slot_index         int          not null check (slot_index >= 0 and slot_index <= 19),
  weapon_instance_id bigint       not null references public.weapon_instance(id) on delete restrict,
  created_at         timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at         timestamp with time zone default timezone('utc'::text, now()) not null
);

COMMENT ON TABLE public.player_inventory IS
  'Player backpack contents. One row per carried item (slot_index 0-19). Currently weapon_instance only. No equip/assignment state — items will be assigned to portal runs when that table is designed.';

COMMENT ON COLUMN public.player_inventory.slot_index IS
  'Position in the 20-slot inventory grid (0-19). Position 0 is the first slot, position 19 is the last.';

COMMENT ON COLUMN public.player_inventory.weapon_instance_id IS
  'The specific weapon instance carried in this slot. References weapon_instance.id.';

-- Constraint: one item per (player, slot_index) — no two items in the same backpack slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_inventory_slot
  ON public.player_inventory(user_id, slot_index);

-- Constraint: one instance of each weapon per user — can't duplicate the same weapon in two slots
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_inventory_unique_item
  ON public.player_inventory(user_id, weapon_instance_id);

-- Index for inventory grid queries
CREATE INDEX IF NOT EXISTS idx_player_inventory_grid
  ON public.player_inventory(user_id, slot_index);

-- ============================================================
-- 2. Enable RLS
-- ============================================================
ALTER TABLE public.player_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inventory"
  ON public.player_inventory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their own inventory"
  ON public.player_inventory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory"
  ON public.player_inventory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own inventory"
  ON public.player_inventory FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. Updated at trigger
-- ============================================================
CREATE TRIGGER handle_player_inventory_updated_at
  BEFORE UPDATE ON public.player_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_weapon_updated_at();

-- ============================================================
-- 4. Convenience view: player's backpack with weapon details
-- ============================================================
CREATE OR REPLACE VIEW public.player_backpack AS
  SELECT
    pi.id,
    pi.user_id,
    pi.slot_index,
    pi.weapon_instance_id,
    wi.template_id,
    t.name as template_name,
    wi.damage,
    wi.speed,
    wi.accuracy,
    pi.created_at,
    pi.updated_at
  FROM public.player_inventory pi
  JOIN public.weapon_instance wi ON wi.id = pi.weapon_instance_id
  JOIN public.weapon_template t ON t.id = wi.template_id;

COMMENT ON VIEW public.player_backpack IS
  'Convenience view: player backpack contents with weapon details joined. Use WHERE user_id = auth.uid().';

COMMIT;
