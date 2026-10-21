-- PC-DEC-076: Update generate_weapon to compute quality_multiplier and tier
-- Tier is aesthetic only. quality_multiplier drives pricing.
-- grade is kept in sync with tier so existing readers (equip UI, combat API) keep working.

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

    v_power_score numeric;
    v_base_power numeric;
    v_quality_mult numeric;
    v_tier text;

    v_attack0 jsonb;
    v_attack1 jsonb;
    v_attack2 jsonb;
    v_attack3 jsonb;
    v_attack4 jsonb;
    v_chain boolean := true;

    v_row weapon_instance%rowtype;
begin
    select * into v_tmpl from weapon_template where id = p_template_id;

    if not found then
        raise exception 'Weapon template id % not found', p_template_id;
    end if;

    select to_jsonb(a) into v_attack0
    from attack a where a.id = v_tmpl.slot_0_attack_id limit 1;

    -- Roll stats
    v_damage := greatest(1, normal_int(v_tmpl.base_damage, v_tmpl.damage_range));
    v_speed := greatest(1, normal_int(v_tmpl.base_speed, v_tmpl.speed_range));
    v_accuracy := greatest(0, normal_int(v_tmpl.base_accuracy, v_tmpl.accuracy_range));

    -- crit_chance
    if coalesce(v_tmpl.crit_range, 0) <= 0 then
        v_crit_chance := greatest(0, coalesce(v_tmpl.crit_base, 5));
    else
        v_crit_chance := greatest(0, coalesce(v_tmpl.crit_base, 5)
            + floor(random() * (v_tmpl.crit_range * 2 + 1))::int - v_tmpl.crit_range);
    end if;

    -- PC-DEC-076: quality-based system (tier is display only)
    v_power_score := v_damage::numeric
                  * (100.0 / v_speed)
                  * (v_accuracy::numeric / 100.0)
                  * (1.0 + (v_crit_chance::numeric / 100.0));  -- crit_multiplier ~2.0 → contribution ~1.0 on average

    v_base_power := v_tmpl.base_damage::numeric
                 * (100.0 / v_tmpl.base_speed)
                 * (v_tmpl.base_accuracy::numeric / 100.0)
                 * 1.05;

    v_quality_mult := power(greatest(v_power_score / v_base_power, 0.25), 0.78);

    -- Tier cutoffs calibrated to the LIVE roll distribution (2026-10-21, 20k rolls/template):
    -- actual quality_multiplier spans ~0.80-1.23 (tight, near 1.0). These cutoffs give the
    -- target rarity: S top 1.5%, A 1.5-7%, B 7-22%, C 22-60%, D 60-87%, E bottom 13%.
    -- (Design doc's example table assumed a wider 0.65-1.78 spread; real rolls are tighter.)
    v_tier := case
        when v_quality_mult >= 1.11 then 'S'
        when v_quality_mult >= 1.075 then 'A'
        when v_quality_mult >= 1.04 then 'B'
        when v_quality_mult >= 0.985 then 'C'
        when v_quality_mult >= 0.94 then 'D'
        else 'E'
    end;

    -- Attack slots (unchanged)
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
        'quality_multiplier', round(v_quality_mult::numeric, 4),
        'tier', v_tier,
        'slot_0_attack', v_attack0,
        'slot_1_attack', v_attack1,
        'slot_2_attack', v_attack2,
        'slot_3_attack', v_attack3,
        'slot_4_attack', v_attack4
    );

    if p_user_id is not null then
        if auth.uid() is not null and p_user_id is distinct from auth.uid() then
            raise exception 'cannot generate weapons for another user (p_user_id=% is not auth.uid()=%)',
                p_user_id, auth.uid();
        end if;

        insert into weapon_instance (
            user_id, template_id, damage, speed, accuracy, crit_chance,
            quality_multiplier, tier, grade,
            slot_0_attack_id, slot_1_attack_id, slot_2_attack_id, slot_3_attack_id, slot_4_attack_id
        )
        values (
            p_user_id, p_template_id, v_damage, v_speed, v_accuracy, v_crit_chance,
            v_quality_mult, v_tier, v_tier,
            coalesce(nullif(v_attack0->>'id', '')::bigint, v_tmpl.slot_0_attack_id),
            nullif(v_attack1->>'id', '')::bigint,
            nullif(v_attack2->>'id', '')::bigint,
            nullif(v_attack3->>'id', '')::bigint,
            nullif(v_attack4->>'id', '')::bigint
        )
        returning id, created_at into v_row.id, v_row.created_at;

        v_result := v_result || jsonb_build_object(
            'id', v_row.id,
            'created_at', to_char(v_row.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
    end if;

    return v_result;
end;
$func$;

COMMENT ON FUNCTION public.generate_weapon(bigint, uuid) IS
  'PC-DEC-076: Rolls weapon with power_score based quality_multiplier and tier (aesthetic only). S-tier ~1.5%. Sell price is consistent regardless of drop vs shop origin.';

-- Ensure new columns have defaults for any old rows
ALTER TABLE weapon_instance ALTER COLUMN quality_multiplier SET DEFAULT 1.0;
ALTER TABLE weapon_instance ALTER COLUMN tier SET DEFAULT 'C';