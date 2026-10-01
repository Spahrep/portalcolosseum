-- PC-100: replace generate_weapon so loot can persist.
-- Copied from the latest definer (20260920120000_fix_generate_weapon_auth.sql)
-- with only the verified fixes:
--   (a) speed_range, not the renamed-away speed_variance
--   (b) crit_chance = uniform crit_base ± crit_range (range 0 = base; backfill default 5)
--   (c) grade computed after the roll (template-relative composite z; crit stays out, PC-DEC-051)
--   (d) slot N gated by slot_N_chance, including slot 4; slot 1 is not auto-granted
--       Chain: a failed slot stops later slots (weapon-generation.md conditional probability).
-- Service-role bypass (auth.uid() IS NULL) is preserved — the combat API admin client
-- has no auth.uid() and must still be able to persist loot.

CREATE OR REPLACE FUNCTION public.generate_weapon(p_template_id bigint, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
 SET search_path = public, pg_temp
AS $func$
declare
    v_tmpl record;
    v_result jsonb;

    v_damage int;
    v_speed int;
    v_accuracy int;
    v_crit_chance int;
    v_grade text;

    v_z_dmg numeric;
    v_z_spd numeric;
    v_z_acc numeric;
    v_z_comp numeric;

    v_attack0 jsonb;
    v_attack1 jsonb;
    v_attack2 jsonb;
    v_attack3 jsonb;
    v_attack4 jsonb;
    v_chain boolean := true;

    v_row weapon_instance%rowtype;
begin
    select *
    into v_tmpl
    from weapon_template
    where id = p_template_id;

    if not found then
        raise exception 'Weapon template id % not found', p_template_id;
    end if;

    select to_jsonb(a)
    into v_attack0
    from attack a
    where a.id = v_tmpl.slot_0_attack_id
    limit 1;

    -- Box-Muller bell, clamped to base ± range inside normal_int.
    -- Floor at 1 so a wide range cannot persist a non-positive combat stat.
    v_damage := greatest(1, normal_int(v_tmpl.base_damage, v_tmpl.damage_range));
    v_speed := greatest(1, normal_int(v_tmpl.base_speed, v_tmpl.speed_range));
    v_accuracy := greatest(0, normal_int(v_tmpl.base_accuracy, v_tmpl.accuracy_range));

    -- crit_chance: uniform base ± range; range 0 returns base exactly; clamped >= 0.
    if coalesce(v_tmpl.crit_range, 0) <= 0 then
        v_crit_chance := greatest(0, coalesce(v_tmpl.crit_base, 5));
    else
        v_crit_chance := greatest(0, coalesce(v_tmpl.crit_base, 5)
            + floor(random() * (v_tmpl.crit_range * 2 + 1))::int
            - v_tmpl.crit_range);
    end if;

    -- Grade after the roll. Crit is not an input (PC-DEC-051).
    -- z_spd is inverted: lower speed is faster, so it scores higher.
    v_z_dmg := case when coalesce(v_tmpl.damage_range, 0) <= 0 then 0
                    else (v_damage - v_tmpl.base_damage)::numeric / v_tmpl.damage_range end;
    v_z_spd := case when coalesce(v_tmpl.speed_range, 0) <= 0 then 0
                    else (v_tmpl.base_speed - v_speed)::numeric / v_tmpl.speed_range end;
    v_z_acc := case when coalesce(v_tmpl.accuracy_range, 0) <= 0 then 0
                    else (v_accuracy - v_tmpl.base_accuracy)::numeric / v_tmpl.accuracy_range end;
    v_z_comp := (v_z_dmg + v_z_spd + v_z_acc) / 3.0;

    v_grade := case
        when v_z_comp >= 3 then 'S'
        when v_z_comp >= 2 then 'A'
        when v_z_comp >= 1 then 'B'
        when v_z_comp >= 0 then 'C'
        when v_z_comp >= -1 then 'D'
        when v_z_comp >= -2 then 'E'
        else 'F'
    end;

    -- Slot 0 is always the template FK. Slots 1-4: slot_N_chance gates slot N.
    -- A miss breaks the chain so later slots do not activate.
    if v_chain and random() < coalesce(v_tmpl.slot_1_chance, 0) then
        v_attack1 := get_random_attack_for_slot(p_template_id, 1);
    else
        v_chain := false;
    end if;

    if v_chain and random() < coalesce(v_tmpl.slot_2_chance, 0) then
        v_attack2 := get_random_attack_for_slot(p_template_id, 2);
    else
        v_chain := false;
    end if;

    if v_chain and random() < coalesce(v_tmpl.slot_3_chance, 0) then
        v_attack3 := get_random_attack_for_slot(p_template_id, 3);
    else
        v_chain := false;
    end if;

    if v_chain and random() < coalesce(v_tmpl.slot_4_chance, 0) then
        v_attack4 := get_random_attack_for_slot(p_template_id, 4);
    else
        v_chain := false;
    end if;

    v_result := jsonb_build_object(
        'template_id', p_template_id,
        'user_id', p_user_id,
        'damage', v_damage,
        'speed', v_speed,
        'accuracy', v_accuracy,
        'crit_chance', v_crit_chance,
        'grade', v_grade,
        'slot_0_attack', v_attack0,
        'slot_1_attack', v_attack1,
        'slot_2_attack', v_attack2,
        'slot_3_attack', v_attack3,
        'slot_4_attack', v_attack4
    );

    -- Persist if user_id provided
    if p_user_id is not null then
        -- Allow: service_role (auth.uid() is null) OR authenticated user matching p_user_id
        if auth.uid() is not null and p_user_id is distinct from auth.uid() then
            raise exception 'cannot generate weapons for another user (p_user_id=% is not auth.uid()=%)',
                p_user_id, auth.uid();
        end if;

        insert into weapon_instance (
            user_id, template_id, damage, speed, accuracy, crit_chance, grade,
            slot_0_attack_id, slot_1_attack_id, slot_2_attack_id, slot_3_attack_id, slot_4_attack_id
        )
        values (
            p_user_id,
            p_template_id,
            v_damage,
            v_speed,
            v_accuracy,
            v_crit_chance,
            v_grade,
            coalesce(nullif(v_attack0->>'id', '')::bigint, v_tmpl.slot_0_attack_id),
            nullif(v_attack1->>'id', '')::bigint,
            nullif(v_attack2->>'id', '')::bigint,
            nullif(v_attack3->>'id', '')::bigint,
            nullif(v_attack4->>'id', '')::bigint
        )
        returning id, created_at
        into v_row.id, v_row.created_at;

        v_result := v_result || jsonb_build_object(
            'id', v_row.id,
            'created_at', to_char(v_row.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
    end if;

    return v_result;
end;
$func$;

COMMENT ON FUNCTION public.generate_weapon(bigint, uuid) IS
  'Rolls a weapon from its template (normal_int on damage/speed/accuracy, uniform crit, grade from composite z) and persists weapon_instance when p_user_id is set. Slot N is gated by slot_N_chance. service_role (auth.uid() IS NULL) may persist; an authenticated caller may only persist for themselves.';
