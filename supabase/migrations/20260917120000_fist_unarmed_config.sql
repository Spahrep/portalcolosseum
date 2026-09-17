-- PC-62: move Fist (unarmed) stats from hardcoded constants into game_config
-- NOTE: migration file only; do not apply here. Overseer will run it.
ALTER TABLE public.game_config
  ADD COLUMN fist_prepare_time INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN fist_prepare_time_range INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN fist_cooldown_time INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN fist_cooldown_time_range INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN fist_damage INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN fist_accuracy INTEGER NOT NULL DEFAULT 90;