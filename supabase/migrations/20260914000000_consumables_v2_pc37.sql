-- ============================================================
-- Migration: Consumables schema v2 (PC-37)
-- Created: 2026-09-14
-- Purpose: Replace single potency with floor/window + speed design per docs/consumables.md
--   - consumable_template: floor_base, floor_delta, window_base, window_delta, speed_base, speed_delta, effect_type
--   - consumable_instance: rolled_floor, rolled_window, rolled_speed, grade, template_id, user_id
|--   - Add Postgres RPC generate_consumable_instance(template_id)
|--   - Ensure RLS, ownership, portal_run FKs remain valid
|--   - Follows weapon_instance patterns + loot tables + api/combat
|-- ============================================================

|-- 1. Update consumable_template (drop potency, add floor/window/speed params)
-- Fix effect_type CHECK collision from PC-17 migration (old constraint blocks 'speed'/'accuracy' inserts)
ALTER TABLE public.consumable_template DROP CONSTRAINT IF EXISTS consumable_template_effect_type_check;
ALTER TABLE public.consumable_template
  DROP COLUMN IF EXISTS potency;

ALTER TABLE public.consumable_template
  ADD COLUMN IF NOT EXISTS floor_base int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS floor_delta int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS window_base int NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS window_delta int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS speed_base int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS speed_delta int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effect_type text NOT NULL DEFAULT 'heal',
  ADD COLUMN IF NOT EXISTS duration_ticks int;  -- NULL for heals (instant); set for speed/accuracy/damage templates

-- Re-add the correctly-named constraint (inline CHECK on ADD COLUMN IF NOT EXISTS is a no-op for existing column)
ALTER TABLE public.consumable_template ADD CONSTRAINT consumable_template_effect_type_check CHECK (effect_type IN ('heal','speed','accuracy','damage'));

COMMENT ON TABLE public.consumable_template IS
  'Static consumable templates. Effect value = floor_base + floor_delta*rand + window_base + window_delta*rand. Speed rolled per instance. +only deltas per locked design.';

-- Update seed data to v2 values (floor/window/speed) per locked design (4 templates: heal/speed/accuracy/damage)
-- Health Potion: heal (instant, no duration)
UPDATE public.consumable_template SET
  floor_base = 90, floor_delta = 10, window_base = 20, window_delta = 10, speed_base = 2, speed_delta = 1, effect_type = 'heal', duration_ticks = NULL
WHERE name = 'Health Potion';

-- Power Tonic → Damage Tonic (damage effect, flat damage with duration; retired invalid value)
UPDATE public.consumable_template SET
  name = 'Damage Tonic',
  floor_base = 5, floor_delta = 2, window_base = 3, window_delta = 2, speed_base = 1, speed_delta = 1, effect_type = 'damage', duration_ticks = 8
WHERE name = 'Power Tonic';

-- Retired throwable (PMVP, not in MVP); if row exists, repurpose or delete handled by name change above

-- New: Swift Tonic (speed effect)
INSERT INTO public.consumable_template (name, description, floor_base, floor_delta, window_base, window_delta, speed_base, speed_delta, effect_type, duration_ticks)
VALUES ('Swift Tonic', 'Temporarily increases attack speed.', 2, 1, 1, 1, 1, 1, 'speed', 8)
ON CONFLICT (name) DO UPDATE SET floor_base=EXCLUDED.floor_base, floor_delta=EXCLUDED.floor_delta, window_base=EXCLUDED.window_base, window_delta=EXCLUDED.window_delta, speed_base=EXCLUDED.speed_base, speed_delta=EXCLUDED.speed_delta, effect_type=EXCLUDED.effect_type, duration_ticks=EXCLUDED.duration_ticks;

-- New: Accuracy Tonic (accuracy effect)
INSERT INTO public.consumable_template (name, description, floor_base, floor_delta, window_base, window_delta, speed_base, speed_delta, effect_type, duration_ticks)
VALUES ('Accuracy Tonic', 'Temporarily increases accuracy.', 10, 5, 5, 5, 1, 1, 'accuracy', 8)
ON CONFLICT (name) DO UPDATE SET floor_base=EXCLUDED.floor_base, floor_delta=EXCLUDED.floor_delta, window_base=EXCLUDED.window_base, window_delta=EXCLUDED.window_delta, speed_base=EXCLUDED.speed_base, speed_delta=EXCLUDED.speed_delta, effect_type=EXCLUDED.effect_type, duration_ticks=EXCLUDED.duration_ticks;

-- 2. Update consumable_instance (add rolled stats, grade, speed; drop old if any)
ALTER TABLE public.consumable_instance
  ADD COLUMN IF NOT EXISTS rolled_floor int,
  ADD COLUMN IF NOT EXISTS rolled_window int,
  ADD COLUMN IF NOT EXISTS rolled_speed int,
  ADD COLUMN IF NOT EXISTS grade text CHECK (grade IN ('F','E','D','C','B','A','S'));

-- +only guarantee at data layer (defensive)
ALTER TABLE public.consumable_instance
  ADD CONSTRAINT IF NOT EXISTS chk_rolled_window_nonneg CHECK (rolled_window >= 0);

COMMENT ON TABLE public.consumable_instance IS
  'Player-owned consumable instances. Rolled per template floor/window/speed. Grade computed post-generation from EV = floor + window/2. Loadout via portal_run.consume_a/b.';

-- Backfill placeholder instances if any (for existing rows)
UPDATE public.consumable_instance SET
  rolled_floor = 100, rolled_window = 30, rolled_speed = 3, grade = 'B'
WHERE rolled_floor IS NULL;

-- Make rolled columns NOT NULL after backfill
ALTER TABLE public.consumable_instance
  ALTER COLUMN rolled_floor SET NOT NULL,
  ALTER COLUMN rolled_window SET NOT NULL,
  ALTER COLUMN rolled_speed SET NOT NULL,
  ALTER COLUMN grade SET NOT NULL;

-- 3. Create generate_consumable_instance RPC (Postgres function, analogous to weapon generation)
-- SECURITY: drop caller-supplied user_id; use auth.uid() (reject unauth). Mirrors generate_monster pattern.
CREATE OR REPLACE FUNCTION public.generate_consumable_instance(
  p_template_id bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_floor_base int;
  v_floor_delta int;
  v_window_base int;
  v_window_delta int;
  v_speed_base int;
  v_speed_delta int;
  v_duration_ticks int;
  v_rolled_floor int;
  v_rolled_window int;
  v_rolled_speed int;
  v_exp_ev numeric;
  v_sigma numeric;
  v_rolled_ev numeric;
  v_z numeric;
  v_grade text;
  v_instance_id bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ownership / existence check on template (admin rows are public)
  SELECT floor_base, floor_delta, window_base, window_delta, speed_base, speed_delta, duration_ticks
  INTO v_floor_base, v_floor_delta, v_window_base, v_window_delta, v_speed_base, v_speed_delta, v_duration_ticks
  FROM public.consumable_template
  WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- Roll using simple uniform for MVP (normal dist in future like weapons)
  v_rolled_floor := v_floor_base + floor(random() * (v_floor_delta + 1));
  v_rolled_window := v_window_base + floor(random() * (v_window_delta + 1));
  v_rolled_speed := v_speed_base + floor(random() * (v_speed_delta + 1));

  -- Relative grade: EV relative to THIS template's expected value (not absolute cutoffs)
  -- exp_ev = floor_base + floor_delta/2 + (window_base + window_delta/2)/2
  -- sigma approximated as (window_base + window_delta)/2 (tuning knob; comment per spec)
  v_exp_ev := v_floor_base + (v_floor_delta / 2.0) + ((v_window_base + v_window_delta) / 2.0 / 2.0);
  v_sigma := GREATEST((v_window_base + v_window_delta) / 2.0, 1.0);  -- avoid /0
  v_rolled_ev := v_rolled_floor + (v_rolled_window / 2.0);
  v_z := (v_rolled_ev - v_exp_ev) / v_sigma;

  v_grade := CASE
    WHEN v_z >= 3 THEN 'S'
    WHEN v_z >= 2 THEN 'A'
    WHEN v_z >= 1 THEN 'B'
    WHEN v_z >= 0 THEN 'C'
    WHEN v_z >= -1 THEN 'D'
    WHEN v_z >= -2 THEN 'E'
    ELSE 'F'
  END;

  -- Insert instance (RLS will enforce user_id match via caller context or service role)
  INSERT INTO public.consumable_instance (user_id, template_id, rolled_floor, rolled_window, rolled_speed, grade)
  VALUES (v_user_id, p_template_id, v_rolled_floor, v_rolled_window, v_rolled_speed, v_grade)
  RETURNING id INTO v_instance_id;

  RETURN v_instance_id;
END;
$$;

COMMENT ON FUNCTION public.generate_consumable_instance(bigint) IS
  'Generates a consumable instance from template using floor/window + speed rolls. Grade is template-relative z-score (EV vs exp_ev using sigma from window spread). Returns new instance id. SECURITY DEFINER with auth.uid() enforcement. Called from loot gen / shop purchase / api/combat. Mirrors weapon_instance generation.';

-- Grant execute to authenticated (RLS inside handles ownership)
GRANT EXECUTE ON FUNCTION public.generate_consumable_instance(bigint) TO authenticated;

-- 4. Ensure portal_run consume_a/b FKs are still correct (already done in prior migration)
-- No change needed; they point to consumable_instance(id)

-- 5. RLS already enabled in prior migration; add policy for the RPC if needed (service role bypasses for loot)
-- Existing policies cover SELECT/INSERT by user_id. Generation via service role in loot path is allowed.

-- 6. Index for new columns (query perf on inventory / loadout)
CREATE INDEX IF NOT EXISTS idx_consumable_instance_grade ON public.consumable_instance(grade);
CREATE INDEX IF NOT EXISTS idx_consumable_template_effect ON public.consumable_template(effect_type);