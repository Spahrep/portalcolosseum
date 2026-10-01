-- PC-100: replace generate_monster.
-- Copied from the latest definer (20260918120000_crit_strikes.sql): no
-- monster_instance insert, UUID id, speed_range, crit_chance uniform roll.
-- Fixes:
--   HP is symmetric uniform [base_hp - max_hp_delta, base_hp + max_hp_delta].
--   uniform_int itself stays +only [base, base+delta] (delta vocabulary). The
--   call shifts the window: uniform_int(base - delta, 2*delta).
--   Slot N is gated by slot_N_chance (including slot 4). Slot 1 is not
--   auto-granted. A failed slot stops the chain.

CREATE OR REPLACE FUNCTION generate_monster(p_template_id bigint)
RETURNS jsonb AS $func$
DECLARE
    v_tmpl record;
    v_result jsonb;

    v_damage int;
    v_speed int;
    v_accuracy int;
    v_max_hp int;
    v_hp_delta int;
    v_crit_chance int;

    v_attack0 jsonb;
    v_attack1 jsonb;
    v_attack2 jsonb;
    v_attack3 jsonb;
    v_attack4 jsonb;
    v_chain boolean := true;
BEGIN
    SELECT *
    INTO v_tmpl
    FROM monster_template
    WHERE id = p_template_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Monster template id % not found', p_template_id;
    END IF;

    SELECT to_jsonb(a)
    INTO v_attack0
    FROM attack a
    WHERE a.id = v_tmpl.slot_0_attack_id
    LIMIT 1;

    v_damage := greatest(1, normal_int(v_tmpl.base_damage, v_tmpl.damage_range));
    v_speed := greatest(1, normal_int(v_tmpl.base_speed, v_tmpl.speed_range));
    v_accuracy := greatest(0, normal_int(v_tmpl.base_accuracy, v_tmpl.accuracy_range));

    -- HP: even/uniform over [base - delta, base + delta], inclusive.
    -- uniform_int(b, d) is [b, b+d]. Passing (base-delta, 2*delta) yields
    -- 2*delta+1 equally likely values centered on base. Floor at 1 so a
    -- delta larger than base cannot spawn a dead monster.
    v_hp_delta := COALESCE(v_tmpl.max_hp_delta, 0);
    IF v_hp_delta <= 0 THEN
        v_max_hp := GREATEST(1, v_tmpl.base_hp);
    ELSE
        v_max_hp := GREATEST(1, uniform_int(v_tmpl.base_hp - v_hp_delta, v_hp_delta * 2));
    END IF;

    IF COALESCE(v_tmpl.crit_range, 0) <= 0 THEN
        v_crit_chance := GREATEST(0, COALESCE(v_tmpl.crit_base, 5));
    ELSE
        v_crit_chance := GREATEST(0, COALESCE(v_tmpl.crit_base, 5)
            + FLOOR(RANDOM() * (v_tmpl.crit_range * 2 + 1))::int
            - v_tmpl.crit_range);
    END IF;

    IF v_chain AND random() < COALESCE(v_tmpl.slot_1_chance, 0) THEN
        v_attack1 := get_random_monster_attack_for_slot(p_template_id, 1);
    ELSE
        v_chain := false;
    END IF;

    IF v_chain AND random() < COALESCE(v_tmpl.slot_2_chance, 0) THEN
        v_attack2 := get_random_monster_attack_for_slot(p_template_id, 2);
    ELSE
        v_chain := false;
    END IF;

    IF v_chain AND random() < COALESCE(v_tmpl.slot_3_chance, 0) THEN
        v_attack3 := get_random_monster_attack_for_slot(p_template_id, 3);
    ELSE
        v_chain := false;
    END IF;

    IF v_chain AND random() < COALESCE(v_tmpl.slot_4_chance, 0) THEN
        v_attack4 := get_random_monster_attack_for_slot(p_template_id, 4);
    ELSE
        v_chain := false;
    END IF;

    v_result := jsonb_build_object(
        'template_id', p_template_id,
        'damage', v_damage,
        'speed', v_speed,
        'accuracy', v_accuracy,
        'max_hp', v_max_hp,
        'crit_chance', v_crit_chance,
        'slot_0_attack', v_attack0,
        'slot_1_attack', v_attack1,
        'slot_2_attack', v_attack2,
        'slot_3_attack', v_attack3,
        'slot_4_attack', v_attack4
    );

    v_result := v_result || jsonb_build_object(
        'id', gen_random_uuid(),
        'created_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    RETURN v_result;
END;
$func$ LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp;

COMMENT ON FUNCTION generate_monster(bigint) IS
  'Returns a monster jsonb (no row persisted). HP is uniform [base_hp - max_hp_delta, base_hp + max_hp_delta]. Other stats use normal_int. Slot N is gated by slot_N_chance.';
