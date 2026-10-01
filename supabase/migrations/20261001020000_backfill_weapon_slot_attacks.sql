-- Backfill special attack slots on weapon instances created before the
-- slot-persist logic existed (all slot_1..4_attack_id are NULL).
--
-- Root cause (2026-10-01): the dev equip paths (createAndEquipWeapon and the
-- /dev/give-* inserts) only ever set slot_0_attack_id, so every weapon spawned
-- through them was born with just the base "Attack" and no specials. The
-- generate_weapon RPC (used by loot drops) rolls and persists slots correctly,
-- but nothing in the equip flow used it.
--
-- This migration re-rolls slots 1-4 on every weapon_instance that has all four
-- empty, using the SAME chain logic as generate_weapon: slot_N_chance gates
-- slot N, and a miss breaks the chain so later slots do not activate. It is
-- idempotent: instances that already have any slot set are left untouched.
--
-- Idempotent by construction: the WHERE clause only matches instances with all
-- four slots NULL, so re-running finds nothing to do.

DO $$
DECLARE
    v_inst record;
    v_chain boolean;
    v_attack jsonb;
    v_tmpl record;
BEGIN
    FOR v_inst IN
        SELECT wi.id, wi.template_id
        FROM weapon_instance wi
        WHERE wi.slot_1_attack_id IS NULL
          AND wi.slot_2_attack_id IS NULL
          AND wi.slot_3_attack_id IS NULL
          AND wi.slot_4_attack_id IS NULL
    LOOP
        SELECT * INTO v_tmpl FROM weapon_template WHERE id = v_inst.template_id;
        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        v_chain := true;

        -- Slot 1
        IF v_chain AND random() < coalesce(v_tmpl.slot_1_chance, 0) THEN
            v_attack := get_random_attack_for_slot(v_inst.template_id, 1);
            IF v_attack IS NOT NULL THEN
                UPDATE weapon_instance
                SET slot_1_attack_id = (v_attack->>'id')::bigint
                WHERE id = v_inst.id;
            END IF;
        ELSE
            v_chain := false;
        END IF;

        -- Slot 2
        IF v_chain AND random() < coalesce(v_tmpl.slot_2_chance, 0) THEN
            v_attack := get_random_attack_for_slot(v_inst.template_id, 2);
            IF v_attack IS NOT NULL THEN
                UPDATE weapon_instance
                SET slot_2_attack_id = (v_attack->>'id')::bigint
                WHERE id = v_inst.id;
            END IF;
        ELSE
            v_chain := false;
        END IF;

        -- Slot 3
        IF v_chain AND random() < coalesce(v_tmpl.slot_3_chance, 0) THEN
            v_attack := get_random_attack_for_slot(v_inst.template_id, 3);
            IF v_attack IS NOT NULL THEN
                UPDATE weapon_instance
                SET slot_3_attack_id = (v_attack->>'id')::bigint
                WHERE id = v_inst.id;
            END IF;
        ELSE
            v_chain := false;
        END IF;

        -- Slot 4
        IF v_chain AND random() < coalesce(v_tmpl.slot_4_chance, 0) THEN
            v_attack := get_random_attack_for_slot(v_inst.template_id, 4);
            IF v_attack IS NOT NULL THEN
                UPDATE weapon_instance
                SET slot_4_attack_id = (v_attack->>'id')::bigint
                WHERE id = v_inst.id;
            END IF;
        ELSE
            v_chain := false;
        END IF;
    END LOOP;
END $$;
