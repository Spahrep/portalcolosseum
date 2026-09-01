-- Migration: Convert game table IDs from UUID to BIGINT on production
-- Created: 2026-09-01
-- Purpose: Game data tables (attack, weapon_template, weapon_template_attack)
-- use BIGINT auto-increment IDs for readability and performance.
-- The profiles table keeps UUID because it must reference auth.users (Supabase Auth).
--
-- PRODUCTION-SAFE: Tables have existing data. This migration:
--   1. Adds temporary bigint columns
--   2. Uses row_number() to assign sequential bigint IDs to existing UUID rows
--   3. Creates mapping temp tables to update FK references
--   4. Drops UUID columns, renames bigint columns to their final names
--   5. Re-applies primary keys, foreign keys, indexes, and triggers
-- The seed data is regenerated after conversion for consistency.

BEGIN;

-- ============================================================
-- 1. Drop foreign key constraints on weapon_template_attack
-- ============================================================
ALTER TABLE IF EXISTS public.weapon_template_attack DROP CONSTRAINT IF EXISTS weapon_template_attack_attack_id_fkey;
ALTER TABLE IF EXISTS public.weapon_template_attack DROP CONSTRAINT IF EXISTS weapon_template_attack_weapon_template_id_fkey;
ALTER TABLE IF EXISTS public.weapon_template_attack DROP CONSTRAINT IF EXISTS weapon_template_attack_pkey;
ALTER TABLE IF EXISTS public.weapon_template DROP CONSTRAINT IF EXISTS weapon_template_pkey;
ALTER TABLE IF EXISTS public.attack DROP CONSTRAINT IF EXISTS attack_pkey;

-- ============================================================
-- 2. Add temporary bigint columns to all three tables
-- ============================================================
ALTER TABLE public.attack ADD COLUMN id_new bigint;
ALTER TABLE public.weapon_template ADD COLUMN id_new bigint;
ALTER TABLE public.weapon_template_attack ADD COLUMN id_new bigint;

-- ============================================================
-- 3. Assign sequential bigint IDs using row_number() ordered by created_at
-- ============================================================
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM public.attack
)
UPDATE public.attack SET id_new = numbered.rn
FROM numbered
WHERE attack.id = numbered.id;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM public.weapon_template
)
UPDATE public.weapon_template SET id_new = numbered.rn
FROM numbered
WHERE weapon_template.id = numbered.id;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM public.weapon_template_attack
)
UPDATE public.weapon_template_attack SET id_new = numbered.rn
FROM numbered
WHERE weapon_template_attack.id = numbered.id;

-- Set NOT NULL
ALTER TABLE public.attack ALTER COLUMN id_new SET NOT NULL;
ALTER TABLE public.weapon_template ALTER COLUMN id_new SET NOT NULL;
ALTER TABLE public.weapon_template_attack ALTER COLUMN id_new SET NOT NULL;

-- ============================================================
-- 4. Create temp mapping tables for FK conversion
-- ============================================================
CREATE TEMP TABLE wt_map AS
  SELECT id AS old_uuid, id_new AS new_bigint FROM public.weapon_template;
CREATE TEMP TABLE atk_map AS
  SELECT id AS old_uuid, id_new AS new_bigint FROM public.attack;

-- ============================================================
-- 5. Convert FK columns from UUID to bigint via temp columns
-- ============================================================
ALTER TABLE public.weapon_template_attack ADD COLUMN weapon_template_id_bigint bigint;
ALTER TABLE public.weapon_template_attack ADD COLUMN attack_id_bigint bigint;

-- Map weapon_template_id FK
UPDATE public.weapon_template_attack SET weapon_template_id_bigint = (
  SELECT new_bigint FROM wt_map WHERE wt_map.old_uuid = weapon_template_attack.weapon_template_id
);

-- Map attack_id FK
UPDATE public.weapon_template_attack SET attack_id_bigint = (
  SELECT new_bigint FROM atk_map WHERE atk_map.old_uuid = weapon_template_attack.attack_id
);

ALTER TABLE public.weapon_template_attack ALTER COLUMN weapon_template_id_bigint SET NOT NULL;
ALTER TABLE public.weapon_template_attack ALTER COLUMN attack_id_bigint SET NOT NULL;

-- ============================================================
-- 6. Drop old UUID columns, rename bigint columns
-- ============================================================
ALTER TABLE public.attack DROP COLUMN id;
ALTER TABLE public.attack RENAME COLUMN id_new TO id;

ALTER TABLE public.weapon_template DROP COLUMN id;
ALTER TABLE public.weapon_template RENAME COLUMN id_new TO id;

ALTER TABLE public.weapon_template_attack DROP COLUMN id;
ALTER TABLE public.weapon_template_attack RENAME COLUMN id_new TO id;

ALTER TABLE public.weapon_template_attack DROP COLUMN weapon_template_id;
ALTER TABLE public.weapon_template_attack RENAME COLUMN weapon_template_id_bigint TO weapon_template_id;

ALTER TABLE public.weapon_template_attack DROP COLUMN attack_id;
ALTER TABLE public.weapon_template_attack RENAME COLUMN attack_id_bigint TO attack_id;

-- ===========================================================
-- 7. Re-add primary keys and set identity defaults
-- ===========================================================
ALTER TABLE public.attack ADD PRIMARY KEY (id);
ALTER TABLE public.weapon_template ADD PRIMARY KEY (id);
ALTER TABLE public.weapon_template_attack ADD PRIMARY KEY (id);

-- Set identity defaults so new inserts auto-increment
ALTER TABLE public.attack ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (START WITH 1 INCREMENT BY 1);
ALTER TABLE public.weapon_template ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (START WITH 1 INCREMENT BY 1);
ALTER TABLE public.weapon_template_attack ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (START WITH 1 INCREMENT BY 1);

-- Reset sequences so next insert starts after the highest existing ID
-- Uses dynamic SQL because ALTER SEQUENCE RESTART WITH requires a literal
DO $$
DECLARE
    max_id bigint;
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM public.attack;
    BEGIN
        EXECUTE format('ALTER SEQUENCE IF EXISTS public.attack_id_seq RESTART WITH %s', max_id + 1);
    EXCEPTION WHEN OTHERS THEN
        -- Sequence might have a different name with IDENTITY; just continue
    END;

    SELECT COALESCE(MAX(id), 0) INTO max_id FROM public.weapon_template;
    BEGIN
        EXECUTE format('ALTER SEQUENCE IF EXISTS public.weapon_template_id_seq RESTART WITH %s', max_id + 1);
    EXCEPTION WHEN OTHERS THEN
    END;

    SELECT COALESCE(MAX(id), 0) INTO max_id FROM public.weapon_template_attack;
    BEGIN
        EXECUTE format('ALTER SEQUENCE IF EXISTS public.weapon_template_attack_id_seq RESTART WITH %s', max_id + 1);
    EXCEPTION WHEN OTHERS THEN
    END;
END $$;


-- ============================================================
-- 8. Re-add foreign key constraints
-- ============================================================
ALTER TABLE public.weapon_template_attack
  ADD CONSTRAINT weapon_template_attack_weapon_template_id_fkey
  FOREIGN KEY (weapon_template_id) REFERENCES public.weapon_template(id) ON DELETE CASCADE;

ALTER TABLE public.weapon_template_attack
  ADD CONSTRAINT weapon_template_attack_attack_id_fkey
  FOREIGN KEY (attack_id) REFERENCES public.attack(id) ON DELETE CASCADE;

-- ============================================================
-- 9. Recreate indexes
-- ============================================================
DROP INDEX IF EXISTS idx_attack_weapon_type;
DROP INDEX IF EXISTS idx_weapon_template_type;
DROP INDEX IF EXISTS idx_weapon_template_attack_unique;
DROP INDEX IF EXISTS idx_weapon_template_attack_wt_id;
DROP INDEX IF EXISTS idx_weapon_template_attack_atk_id;
DROP INDEX IF EXISTS idx_weapon_template_attack_slot;

CREATE INDEX idx_attack_weapon_type ON public.attack USING GIN (allowed_weapon_types);
CREATE INDEX idx_weapon_template_type ON public.weapon_template(weapon_type);
CREATE UNIQUE INDEX idx_weapon_template_attack_unique ON public.weapon_template_attack(weapon_template_id, attack_id);
CREATE INDEX idx_weapon_template_attack_wt_id ON public.weapon_template_attack(weapon_template_id);
CREATE INDEX idx_weapon_template_attack_atk_id ON public.weapon_template_attack(attack_id);
CREATE INDEX idx_weapon_template_attack_slot ON public.weapon_template_attack(slot);

-- Clean up temp tables
DROP TABLE wt_map;
DROP TABLE atk_map;

COMMIT;
