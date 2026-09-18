-- PC-72: Crit strikes — schema + generation RPCs (SQL ONLY)
-- NOTE: migration file only; do not apply here. Overseer will run it.

-- 1. attack table: crit_factor (multiplies instance crit chance; neutral=1.0 later), crit_multiplier (damage x on crit)
ALTER TABLE public.attack
  ADD COLUMN crit_factor float NOT NULL DEFAULT 1.1,
  ADD COLUMN crit_multiplier float NOT NULL DEFAULT 2.0;

COMMENT ON COLUMN public.attack.crit_factor IS 'Multiplies the instance crit chance (basic Attack neutral point = 1.0 later)';
COMMENT ON COLUMN public.attack.crit_multiplier IS 'Damage multiplier applied on crit (e.g. 2.0 = double damage)';

-- 2. weapon_template: crit_base / crit_range (match accuracy pattern)
ALTER TABLE public.weapon_template
  ADD COLUMN crit_base int NOT NULL DEFAULT 5,
  ADD COLUMN crit_range int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.weapon_template.crit_base IS 'Base crit chance percent for weapon template (uniform roll base ± range)';
COMMENT ON COLUMN public.weapon_template.crit_range IS '± range for crit_chance roll on weapon generation (0 = exact base)';

-- 3. weapon_instance: crit_chance (rolled at generation, backfilled via DEFAULT)
ALTER TABLE public.weapon_instance
  ADD COLUMN crit_chance int NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.weapon_instance.crit_chance IS 'Rolled crit chance percent for this weapon instance (crit_base ± crit_range from template)';

-- 4. monster_template: crit_base / crit_range
ALTER TABLE public.monster_template
  ADD COLUMN crit_base int NOT NULL DEFAULT 5,
  ADD COLUMN crit_range int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.monster_template.crit_base IS 'Base crit chance percent for monster template (uniform roll base ± range)';
COMMENT ON COLUMN public.monster_template.crit_range IS '± range for crit_chance roll on monster generation (0 = exact base)';

-- 5. consumable_template: crit_base / crit_range
ALTER TABLE public.consumable_template
  ADD COLUMN crit_base int NOT NULL DEFAULT 5,
  ADD COLUMN crit_range int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.consumable_template.crit_base IS 'Base crit chance percent for consumable template (uniform roll base ± range)';
COMMENT ON COLUMN public.consumable_template.crit_range IS '± range for crit_chance roll on consumable generation (0 = exact base)';

-- 6. consumable_instance: crit_chance (backfilled via DEFAULT)
ALTER TABLE public.consumable_instance
  ADD COLUMN crit_chance int NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.consumable_instance.crit_chance IS 'Rolled crit chance percent for this consumable instance (crit_base ± crit_range from template)';

-- 7. game_config: fist + potion crit effects
ALTER TABLE public.game_config
  ADD COLUMN fist_crit_chance int NOT NULL DEFAULT 5,
  ADD COLUMN potion_crit_effect_multiplier float NOT NULL DEFAULT 1.5,
  ADD COLUMN potion_crit_duration_multiplier float NOT NULL DEFAULT 1.5;

COMMENT ON COLUMN public.game_config.fist_crit_chance IS 'Base crit chance percent for unarmed fist attacks';
COMMENT ON COLUMN public.game_config.potion_crit_effect_multiplier IS '+50% effect multiplier on potion crit (e.g. heal amount)';
COMMENT ON COLUMN public.game_config.potion_crit_duration_multiplier IS '+50% duration multiplier on potion crit (for buff/debuff potions)';

-- 8. Update generate_monster to roll and return crit_chance (mirror accuracy roll style exactly: uniform [-range,+range], range=0 returns base exactly, clamped >=0)
CREATE OR REPLACE FUNCTION generate_monster(p_template_id bigint)
RETURNS jsonb AS $func$
DECLARE
    v_tmpl record;
    v_result jsonb;

    v_damage int;
    v_speed int;
    v_accuracy int;
    v_crit_chance int;

    v_attack0 jsonb;
    v_attack1 jsonb;
    v_attack2 jsonb;
    v_attack3 jsonb;
    v_attack4 jsonb;

    v_row monster_instance%rowtype;
BEGIN
    -- Fetch template
    SELECT *
    INTO v_tmpl
    FROM monster_template
    WHERE id = p_template_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Monster template id % not found', p_template_id;
    END IF;

    -- Fetch slot 0 attack (mandatory, comes directly from template FK)
    SELECT to_jsonb(a)
    INTO v_attack0
    FROM attack a
    WHERE a.id = v_tmpl.slot_0_attack_id
    LIMIT 1;

    -- Roll stats using normal distribution (Box-Muller) for damage/speed/accuracy; uniform for crit (per PC-72)
    v_damage := normal_int(v_tmpl.base_damage, v_tmpl.damage_range);
    v_speed := normal_int(v_tmpl.base_speed, v_tmpl.speed_variance);
    v_accuracy := normal_int(v_tmpl.base_accuracy, v_tmpl.accuracy_range);

    -- crit_chance: exact mirror of accuracy uniform style from SSS migrations (range 0 returns base exactly)
    IF COALESCE(v_tmpl.crit_range, 0) <= 0 THEN
        v_crit_chance := GREATEST(0, v_tmpl.crit_base);
    ELSE
        v_crit_chance := GREATEST(0, v_tmpl.crit_base + FLOOR(RANDOM() * (v_tmpl.crit_range * 2 + 1)) - v_tmpl.crit_range);
    END IF;

    -- Slot 1-4 attacks (unchanged)
    v_attack1 := get_random_monster_attack_for_slot(p_template_id, 1);

    IF RANDOM() < COALESCE(v_tmpl.slot_1_chance, 0) THEN
        v_attack2 := get_random_monster_attack_for_slot(p_template_id, 2);
    END IF;

    IF v_attack2 IS NOT NULL AND RANDOM() < COALESCE(v_tmpl.slot_2_chance, 0) THEN
        v_attack3 := get_random_monster_attack_for_slot(p_template_id, 3);
    END IF;

    IF v_attack3 IS NOT NULL AND RANDOM() < COALESCE(v_tmpl.slot_3_chance, 0) THEN
        v_attack4 := get_random_monster_attack_for_slot(p_template_id, 4);
    END IF;

    -- Build result as JSON (include crit_chance in payload)
    v_result := jsonb_build_object(
        'template_id', p_template_id,
        'damage', v_damage,
        'speed', v_speed,
        'accuracy', v_accuracy,
        'crit_chance', v_crit_chance,
        'slot_0_attack', v_attack0,
        'slot_1_attack', v_attack1,
        'slot_2_attack', v_attack2,
        'slot_3_attack', v_attack3,
        'slot_4_attack', v_attack4
    );

    -- Persist to monster_instance (crit_chance not yet in table per this ticket; payload only)
    INSERT INTO monster_instance (
        template_id, damage, speed, accuracy,
        slot_0_attack_id, slot_1_attack_id, slot_2_attack_id, slot_3_attack_id, slot_4_attack_id
    )
    VALUES (
        p_template_id,
        v_damage,
        v_speed,
        v_accuracy,
        NULLIF(v_attack0->>'id', '')::bigint,
        NULLIF(v_attack1->>'id', '')::bigint,
        NULLIF(v_attack2->>'id', '')::bigint,
        NULLIF(v_attack3->>'id', '')::bigint,
        NULLIF(v_attack4->>'id', '')::bigint
    )
    RETURNING id, created_at
    INTO v_row.id, v_row.created_at;

    -- Merge persist-only fields into the result object
    v_result := v_result || jsonb_build_object(
        'id', v_row.id,
        'created_at', TO_CHAR(v_row.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    RETURN v_result;
END;
$func$ LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp;

-- 9. Update generate_consumable_instance to roll and persist crit_chance (same uniform style, range 0 = base exactly, clamped >=0)
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
  v_crit_base int;
  v_crit_range int;
  v_duration_ticks int;
  v_rolled_floor int;
  v_rolled_window int;
  v_rolled_speed int;
  v_crit_chance int;
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
  SELECT floor_base, floor_delta, window_base, window_delta, speed_base, speed_delta, crit_base, crit_range, duration_ticks
  INTO v_floor_base, v_floor_delta, v_window_base, v_window_delta, v_speed_base, v_speed_delta, v_crit_base, v_crit_range, v_duration_ticks
  FROM public.consumable_template
  WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- Roll using simple uniform for MVP (floor/window/speed as before; crit symmetric uniform)
  v_rolled_floor := v_floor_base + FLOOR(RANDOM() * (v_floor_delta + 1));
  v_rolled_window := v_window_base + FLOOR(RANDOM() * (v_window_delta + 1));
  v_rolled_speed := v_speed_base + FLOOR(RANDOM() * (v_speed_delta + 1));

  -- crit_chance: range 0 returns base exactly (clamped >=0)
  IF COALESCE(v_crit_range, 0) <= 0 THEN
    v_crit_chance := GREATEST(0, v_crit_base);
  ELSE
    v_crit_chance := GREATEST(0, v_crit_base + FLOOR(RANDOM() * (v_crit_range * 2 + 1)) - v_crit_range);
  END IF;

  -- Relative grade: EV relative to THIS template's expected value (not absolute cutoffs)
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

  -- Insert instance (now includes crit_chance)
  INSERT INTO public.consumable_instance (user_id, template_id, rolled_floor, rolled_window, rolled_speed, crit_chance, grade)
  VALUES (v_user_id, p_template_id, v_rolled_floor, v_rolled_window, v_rolled_speed, v_crit_chance, v_grade)
  RETURNING id INTO v_instance_id;

  RETURN v_instance_id;
END;
$$;

COMMENT ON FUNCTION public.generate_consumable_instance(bigint) IS
  'Generates a consumable instance from template using floor/window + speed + crit rolls. Grade is template-relative z-score. Returns new instance id. SECURITY DEFINER with auth.uid() enforcement. crit_chance uses uniform base±range (range=0 returns base exactly).';

-- Grant execute to authenticated (RLS inside handles ownership)
GRANT EXECUTE ON FUNCTION public.generate_consumable_instance(bigint) TO authenticated;

-- 10. Verification (run after apply by PM; results must show all 10 columns + both functions)
-- SELECT column_name FROM information_schema.columns WHERE table_name IN ('attack','weapon_template','weapon_instance','monster_template','consumable_template','consumable_instance','game_config') AND (column_name LIKE 'crit%' OR column_name IN ('potion_crit_effect_multiplier','potion_crit_duration_multiplier')) ORDER BY table_name, column_name;
-- SELECT proname FROM pg_proc WHERE proname IN ('generate_monster','generate_consumable_instance');
