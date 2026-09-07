-- Migration: Add weight column to weapon_template_attack_mapping
-- Adds a weight value for weighted random selection of attacks per slot
-- Higher weight = more likely to be chosen from the eligible pool

BEGIN;

-- Add weight column with default of 1.0 (equal weighting for backward compatibility)
ALTER TABLE public.weapon_template_attack_mapping
    ADD COLUMN IF NOT EXISTS weight real NOT NULL DEFAULT 1.0;

-- Add comment
COMMENT ON COLUMN public.weapon_template_attack_mapping.weight IS 'Relative weight for random selection. Higher = more likely chosen from eligible pool. Default 1.0.';

-- Add index for slot-based queries
CREATE INDEX IF NOT EXISTS idx_wtam_slot ON public.weapon_template_attack_mapping(slot);

COMMIT;
