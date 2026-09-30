-- PC-99: charge X AP + Y gold when a run starts.
-- ap_cost already exists on portal_template. entry_gold_cost is the Y gold
-- fee (distinct from unlock_gold_cost). IF NOT EXISTS so a sibling migration
-- that adds the same column does not collide. Default 0 = free until set.
-- Player wallet lives on profiles so POST /runs can deduct. Defaults match
-- game_config (starting_gold 0, starting_ap 10).

ALTER TABLE public.portal_template
  ADD COLUMN IF NOT EXISTS entry_gold_cost integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.portal_template.entry_gold_cost IS
  'Gold charged to enter one run (Y in "X AP + Y gold"). 0 = free. Distinct from unlock_gold_cost.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gold integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ap integer NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.profiles.gold IS 'Player gold balance. Starting gold is 0.';
COMMENT ON COLUMN public.profiles.ap IS 'Player AP balance. Starting AP is 10.';
