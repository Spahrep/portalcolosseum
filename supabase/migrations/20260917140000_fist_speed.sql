-- Add fist_speed to game_config for unarmed hand approach rows (PC-64)
ALTER TABLE public.game_config ADD COLUMN fist_speed INTEGER NOT NULL DEFAULT 6;