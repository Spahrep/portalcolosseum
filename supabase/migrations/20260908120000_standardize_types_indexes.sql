-- Migration: Standardize float types + drop duplicate indexes
-- Fixes type drift (real/float4 vs double precision/float8) for weight and slot_*_chance columns
-- Drops redundant indexes (keeps idx_wtam_slot on current table name; keeps unique key constraint, drops non-unique key_idx)
-- Safe: uses IF EXISTS, no data loss (widening real -> double precision)

BEGIN;

-- 1. Standardize weight columns on mapping tables to double precision (match attack.weight)
-- weapon_template_attack_mapping
ALTER TABLE public.weapon_template_attack_mapping
    ALTER COLUMN weight TYPE double precision;

-- monster_template_attack_mapping
ALTER TABLE public.monster_template_attack_mapping
    ALTER COLUMN weight TYPE double precision;

-- portal_monster_mapping (if exists)
ALTER TABLE IF EXISTS public.portal_monster_mapping
    ALTER COLUMN weight TYPE double precision;

-- portal_loot_mapping (if exists)
ALTER TABLE IF EXISTS public.portal_loot_mapping
    ALTER COLUMN weight TYPE double precision;

-- 2. Standardize slot_*_chance on monster_template to double precision (match weapon_template)
ALTER TABLE public.monster_template
    ALTER COLUMN slot_1_chance TYPE double precision,
    ALTER COLUMN slot_2_chance TYPE double precision,
    ALTER COLUMN slot_3_chance TYPE double precision,
    ALTER COLUMN slot_4_chance TYPE double precision;

-- 3. Drop redundant indexes (safe IF EXISTS)
-- Old duplicate slot index from pre-rename table; keep the newer idx_wtam_slot
DROP INDEX IF EXISTS public.idx_weapon_template_attack_slot;

-- Non-unique key_idx on invite_keys (unique constraint/key_key remains)
DROP INDEX IF EXISTS public.invite_keys_key_idx;

COMMIT;

-- Verification notes (not executed):
-- - No application code contains explicit float4/float8 casts or assumptions on these columns.
-- - Queries in monster generation already cast weight::double precision defensively.
-- - Indexes idx_wtam_slot and invite_keys unique constraint are the canonical ones retained.
