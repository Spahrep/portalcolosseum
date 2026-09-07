-- Migration: Add slot_0_attack_id to weapon_template
-- Adds mandatory attack slot 0 (the default "Attack" skill) to all weapon templates
-- slot_0_attack_id is a FK to attack(id), NOT NULL, defaulting to attack id 1 ("Attack") for all templates

-- Step 1: Add column with default value to backfill existing rows
ALTER TABLE public.weapon_template
    ADD COLUMN IF NOT EXISTS slot_0_attack_id BIGINT NOT NULL DEFAULT 1 REFERENCES attack(id);

-- Step 2: Remove the default (we don't want new rows to implicitly get attack_id=1)
ALTER TABLE public.weapon_template
    ALTER COLUMN slot_0_attack_id DROP DEFAULT;

-- Step 3: Add an index for query performance
CREATE INDEX IF NOT EXISTS idx_weapon_template_slot_0_attack ON public.weapon_template(slot_0_attack_id);

-- Step 4: Update table comment
COMMENT ON COLUMN public.weapon_template.slot_0_attack_id IS 'FK to attack(id). The base/default attack always assigned to slot 0 for this template (currently always the base Attack skill, id=1)';
