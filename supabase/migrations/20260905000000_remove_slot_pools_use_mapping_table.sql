-- Migration: Remove redundant slot_N_pool columns from weapon_template
-- Created: 2026-09-05
--
-- Context: The weapon_template table has `slot_N_pool` columns that store attack
-- NAMES per slot as text/JSON strings, duplicating what the
-- `weapon_template_attack_mapping` table already does via proper foreign keys
-- (weapon_template_id -> attack_id -> slot). This migration:
--
--   1. Migrates slot 3 and slot 4 pool entries into the mapping table
--      (slots 1-2 already have mappings). Handles JSON-string pool formats.
--   2. Widens the CHECK constraint on weapon_template_attack_mapping.slot
--      from (1,2,3) to (1,2,3,4).
--   3. Drops the four slot_N_pool columns from weapon_template.
--
-- The slot_N_chance columns remain — they encode probability (0.0-1.0),
-- which the mapping table has no equivalent for. The mapping table says
-- WHICH attacks are eligible; the chance columns say HOW LIKELY the slot
-- is to activate at generation time.

BEGIN;

-- ============================================================
-- 1. Migrate slot 3 and slot 4 pool entries into the mapping table
--    Pool columns are stored inconsistently (some as text[], some as JSON text)
--    so we cast to text then to text[] at each call site
--
--    NOTE: The existing unique index is on (weapon_template_id, attack_id),
--    NOT (weapon_template_id, attack_id, slot). Use ON CONFLICT on that
--    column pair.
-- ============================================================

-- Slot 3: resolve JSON-string pools to actual attack IDs, insert into mapping table
INSERT INTO public.weapon_template_attack_mapping (weapon_template_id, attack_id, slot)
  SELECT DISTINCT wt.id, a.id, 3
  FROM public.weapon_template wt
  JOIN public.attack a ON a.name = ANY(wt.slot_3_pool::text::text[])
  WHERE wt.slot_3_pool IS NOT NULL
    AND wt.slot_3_pool::text != '{}'
  ON CONFLICT (weapon_template_id, attack_id) DO NOTHING;

-- Slot 4: (currently all empty, but handle the data in the column regardless)
INSERT INTO public.weapon_template_attack_mapping (weapon_template_id, attack_id, slot)
  SELECT DISTINCT wt.id, a.id, 4
  FROM public.weapon_template wt
  JOIN public.attack a ON a.name = ANY(wt.slot_4_pool::text::text[])
  WHERE wt.slot_4_pool IS NOT NULL
    AND wt.slot_4_pool::text != '{}'
  ON CONFLICT (weapon_template_id, attack_id) DO NOTHING;

-- ============================================================
-- 2. Widen the CHECK constraint to allow slot 4
-- ============================================================

ALTER TABLE public.weapon_template_attack_mapping
    DROP CONSTRAINT IF EXISTS weapon_template_attack_mapping_slot_check,
    ADD CONSTRAINT weapon_template_attack_mapping_slot_check
    CHECK (slot IN (1, 2, 3, 4));

-- ============================================================
-- 3. Drop the redundant pool columns from weapon_template
-- ============================================================

ALTER TABLE public.weapon_template
    DROP COLUMN IF EXISTS slot_1_pool,
    DROP COLUMN IF EXISTS slot_2_pool,
    DROP COLUMN IF EXISTS slot_3_pool,
    DROP COLUMN IF EXISTS slot_4_pool;

COMMIT;

COMMENT ON TABLE public.weapon_template IS
    'Weapon definitions with procedurally-generated stat ranges. Attack pools are defined in the weapon_template_attack_mapping table, not as columns here.';
