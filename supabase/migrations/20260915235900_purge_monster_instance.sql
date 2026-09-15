-- Migration: Purge monster_instance table — monsters live only in battle_state JSON
-- Created: 2026-09-15
-- Purpose: Remove the write-only monster_instance table and its last writer (generate_monster).
--   Monsters now identified by UUID in the JSON returned to battle_state; no persisted rows.
--   Approved by Spahrep 2026-09-15.

-- Recreate generate_monster without the persist logic (Postgres does not auto-rewrite function bodies)
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

    -- Emit UUID id (no persist); created_at is now() for contract compatibility
    v_result := v_result || jsonb_build_object('id', gen_random_uuid(), 'created_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));

    RETURN v_result;
END;
$func$ LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp;

COMMENT ON FUNCTION generate_monster(bigint) IS 'Generates monster JSON (no row persisted; battle state lives in portal_run.battle_state jsonb). Purged 2026-09-15. HP uses uniform_int for even distribution (Spahrep 2026-09-08). Other stats use normal_int.';

DROP TABLE public.monster_instance;
