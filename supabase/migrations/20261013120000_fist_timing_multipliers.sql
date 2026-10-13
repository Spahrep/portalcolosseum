-- PC-113: Fold unarmed fist timing into the multiplier model (PC-DEC-072).
-- The fist had a special additive formula (fist_speed + rollStat(fist_prepare_time...))
-- divergent from every attack's multiplier model. Give it multiplier columns like
-- an attack row; backfill so current timing is unchanged; drop the flat columns.
--   castTicks = fist_speed * rollMultiplier(fist_prepare_time_multiplier, range)
--   cooldown  = fist_speed * rollMultiplier(fist_cooldown_time_multiplier, range)

ALTER TABLE public.game_config
  ADD COLUMN fist_prepare_time_multiplier float NOT NULL DEFAULT 1.0,
  ADD COLUMN fist_prepare_time_multiplier_range float NOT NULL DEFAULT 0,
  ADD COLUMN fist_cooldown_time_multiplier float NOT NULL DEFAULT 1.0,
  ADD COLUMN fist_cooldown_time_multiplier_range float NOT NULL DEFAULT 0;

-- Backfill to preserve current timing: old cast = speed + flat, new = speed * mult
-- => mult = (speed + flat) / speed. Defaults (speed 6, flat 6) => 2.0.
UPDATE public.game_config SET
  fist_prepare_time_multiplier = round(((fist_speed + fist_prepare_time)::numeric / NULLIF(fist_speed, 0))::numeric, 2),
  fist_cooldown_time_multiplier = round(((fist_speed + fist_cooldown_time)::numeric / NULLIF(fist_speed, 0))::numeric, 2)
WHERE fist_speed IS NOT NULL AND fist_speed > 0;

ALTER TABLE public.game_config
  DROP COLUMN IF EXISTS fist_prepare_time,
  DROP COLUMN IF EXISTS fist_prepare_time_range,
  DROP COLUMN IF EXISTS fist_cooldown_time,
  DROP COLUMN IF EXISTS fist_cooldown_time_range;

COMMENT ON COLUMN public.game_config.fist_prepare_time_multiplier IS 'Multiplier on fist_speed for unarmed windup; 1.0 = exactly fist_speed; rollMultiplier(base, range) yields the factor (PC-DEC-072)';
COMMENT ON COLUMN public.game_config.fist_cooldown_time_multiplier IS 'Multiplier on fist_speed for unarmed cooldown; 1.0 = exactly fist_speed; rollMultiplier(base, range) yields the factor (PC-DEC-072)';
