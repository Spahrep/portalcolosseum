-- Fix generate_weapon to allow service_role (auth.uid() IS NULL) to create weapons.
-- The API uses the service_role admin client, but the function was blocking it
-- by checking "auth.uid() IS NULL or p_user_id IS DISTINCT FROM auth.uid()".
-- This changes it to only block when auth.uid() IS NOT NULL AND doesn't match.
CREATE OR REPLACE FUNCTION public.generate_weapon(p_template_id bigint, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
    v_tmpl record;
    v_result jsonb;

    v_damage int;
    v_speed int;
    v_accuracy int;

    v_attack0 jsonb;
    v_attack1 jsonb;
    v_attack2 jsonb;
    v_attack3 jsonb;
    v_attack4 jsonb;

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

    v_damage := normal_int(v_tmpl.base_damage, v_tmpl.damage_range);
    v_speed := normal_int(v_tmpl.base_speed, v_tmpl.speed_variance);
    v_accuracy := normal_int(v_tmpl.base_accuracy, v_tmpl.accuracy_range);

    v_attack1 := get_random_attack_for_slot(p_template_id, 1);

    if random() < coalesce(v_tmpl.slot_1_chance, 0) then
        v_attack2 := get_random_attack_for_slot(p_template_id, 2);
    end if;

    if v_attack2 is not null and random() < coalesce(v_tmpl.slot_2_chance, 0) then
        v_attack3 := get_random_attack_for_slot(p_template_id, 3);
    end if;

    if v_attack3 is not null and random() < coalesce(v_tmpl.slot_3_chance, 0) then
        v_attack4 := get_random_attack_for_slot(p_template_id, 4);
    end if;

    v_result := jsonb_build_object(
        'template_id', p_template_id,
        'user_id', p_user_id,
        'damage', v_damage,
        'speed', v_speed,
        'accuracy', v_accuracy,
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
            user_id, template_id, damage, speed, accuracy,
            slot_0_attack_id, slot_1_attack_id, slot_2_attack_id, slot_3_attack_id, slot_4_attack_id
        )
        values (
            p_user_id,
            p_template_id,
            v_damage,
            v_speed,
            v_accuracy,
            nullif(v_attack0->>'id', '')::bigint,
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
$function$;