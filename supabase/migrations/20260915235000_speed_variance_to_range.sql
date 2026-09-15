-- Migration: Rename speed_variance to speed_range on weapon_template and monster_template
-- Created: 2026-09-15
-- Purpose: Unify ± spread vocabulary to "range" (consistent with damage_range, accuracy_range, prepare_time_range, cooldown_time_range).
--   speed_variance was the last remaining "variance" for a ± field.

alter table public.weapon_template rename column speed_variance to speed_range;
alter table public.monster_template rename column speed_variance to speed_range;

-- Recreate generate_monster to update internal reference (Postgres does not auto-rewrite function bodies on column rename)
CREATE OR REPLACE FUNCTION generate_monster(p_template_id bigint)
RETURNS jsonb AS $func$
DECLARE
    v_tmpl record;
    v_result jsonb;

    v_damage int;
    v_speed int;
    v_accuracy int;
    v_max_hp int;

    v_attack0 jsonb;
    v_attack1 jsonb;
    v_attack2 jsonb;
    v_attack3 jsonb;
    v_attack4 jsonb;

    v_row monster_instance%rowtype;
BEGIN
    -- Fetch template (now includes base_hp + max_hp_delta from prior migration)
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

    -- Roll stats using normal distribution (Box-Muller) for non-HP stats
    v_damage := normal_int(v_tmpl.base_damage, v_tmpl.damage_range);
    v_speed := normal_int(v_tmpl.base_speed, v_tmpl.speed_range);
    v_accuracy := normal_int(v_tmpl.base_accuracy, v_tmpl.accuracy_range);

    -- HP: even/uniform distribution (requirement)
    v_max_hp := uniform_int(v_tmpl.base_hp, v_tmpl.max_hp_delta);

    -- Slot 1: Always granted, weighted random from mapping table
    v_attack1 := get_random_monster_attack_for_slot(p_template_id, 1);

    -- Slot 2: conditional chain
    IF random() < COALESCE(v_tmpl.slot_1_chance, 0) THEN
        v_attack2 := get_random_monster_attack_for_slot(p_template_id, 2);
    END IF;

    IF v_attack2 IS NOT NULL AND random() < COALESCE(v_tmpl.slot_2_chance, 0) THEN
        v_attack3 := get_random_monster_attack_for_slot(p_template_id, 3);
    END IF;

    IF v_attack3 IS NOT NULL AND random() < COALESCE(v_tmpl.slot_3_chance, 0) THEN
        v_attack4 := get_random_monster_attack_for_slot(p_template_id, 4);
    END IF;

    -- Build result as JSON (include max_hp)
    v_result := jsonb_build_object(
        'template_id', p_template_id,
        'damage', v_damage,
        'speed', v_speed,
        'accuracy', v_accuracy,
        'max_hp', v_max_hp,
        'slot_0_attack', v_attack0,
        'slot_1_attack', v_attack1,
        'slot_2_attack', v_attack2,
        'slot_3_attack', v_attack3,
        'slot_4_attack', v_attack4
    );

    -- Persist to monster_instance (now includes max_hp)
    INSERT INTO monster_instance (
        template_id, damage, speed, accuracy, max_hp,
        slot_0_attack_id, slot_1_attack_id, slot_2_attack_id, slot_3_attack_id, slot_4_attack_id
    )
    VALUES (
        p_template_id,
        v_damage,
        v_speed,
        v_accuracy,
        v_max_hp,
        nullif(v_attack0->>'id', '')::bigint,
        nullif(v_attack1->>'id', '')::bigint,
        nullif(v_attack2->>'id', '')::bigint,
        nullif(v_attack3->>'id', '')::bigint,
        nullif(v_attack4->>'id', '')::bigint
    )
    RETURNING id, created_at
    INTO v_row.id, v_row.created_at;

    -- Merge persist-only fields into the result object
    v_result := v_result || jsonb_build_object(
        'id', v_row.id,
        'created_at', to_char(v_row.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    RETURN v_result;
END;
$func$ LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp;

COMMENT ON FUNCTION generate_monster(bigint) IS 'Generates monster_instance row + returns JSON. HP uses uniform_int for even distribution (Spahrep 2026-09-08). Other stats use normal_int.';

comment on column public.weapon_template.speed_range is '± roll range around base_speed (normal_int(base_speed, speed_range)); renamed from speed_variance 2026-09-15 for vocabulary consistency';
comment on column public.monster_template.speed_range is '± roll range around base_speed (normal_int(base_speed, speed_range)); renamed from speed_variance 2026-09-15 for vocabulary consistency';
