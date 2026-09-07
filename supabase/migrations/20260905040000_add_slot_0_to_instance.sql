-- Migration: Add slot_0_attack_id to weapon_instance
-- Stores the resolved slot 0 attack on the instance for persistence
-- Mirrors the weapon_template.slot_0_attack_id FK but materializes it on each instance

BEGIN;

-- Add column with default 1 (the base "Attack" skill) to backfill existing rows
ALTER TABLE public.weapon_instance
    ADD COLUMN IF NOT EXISTS slot_0_attack_id bigint NOT NULL DEFAULT 1 REFERENCES public.attack(id);

-- Remove default after backfilling so new inserts explicitly set it
ALTER TABLE public.weapon_instance
    ALTER COLUMN slot_0_attack_id DROP DEFAULT;

-- Index for lookups by slot_0 attack
CREATE INDEX IF NOT EXISTS idx_weapon_instance_slot_0_attack ON public.weapon_instance(slot_0_attack_id);

-- Comment explaining purpose
COMMENT ON COLUMN public.weapon_instance.slot_0_attack_id IS 'FK to attack(id). The base/default attack always assigned to slot 0. Stored on instance for completeness; resolved from weapon_template.slot_0_attack_id at generation time';

COMMIT;
