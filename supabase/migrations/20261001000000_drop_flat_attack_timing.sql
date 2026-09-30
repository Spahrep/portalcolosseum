-- PC-108: Drop flat attack timing columns (prepare_time/cooldown_time) — multipliers only
-- Timing is now purely multiplier-based: weapon/monster speed × (multiplier ± range)
-- Multiplier columns (prepare_time_multiplier etc.) remain; base_damage_multiplier untouched.

ALTER TABLE public.attack
  DROP COLUMN IF EXISTS prepare_time,
  DROP COLUMN IF EXISTS prepare_time_range,
  DROP COLUMN IF EXISTS cooldown_time,
  DROP COLUMN IF EXISTS cooldown_time_range;

COMMENT ON TABLE public.attack IS 'Attack templates. Timing uses speed * rollMultiplier(prepare_time_multiplier, prepare_time_multiplier_range) etc. Flat columns removed in PC-108.';