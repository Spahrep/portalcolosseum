-- One generator per item type.
-- generate_weapon rolls (or accepts a pre-rolled spec) and optionally persists.
-- get_random_attack_for_slot excludes attack ids already taken in the chain.
-- roll_shop_stock_attacks is removed; stock calls generate_weapon with p_persist false.
-- generate_consumable_instance mirrors the same spec/persist contract.
-- Idempotent: drops both the previous and the new signatures before creating.

ALTER TABLE public.shop_stock
  ADD COLUMN IF NOT EXISTS base_price numeric;

COMMENT ON COLUMN public.shop_stock.base_price IS
  'Template base price captured when the stock row was rolled, so a reloaded card prices the same instance.';

DROP FUNCTION IF EXISTS public.roll_shop_stock_attacks(bigint);
DROP FUNCTION IF EXISTS public.generate_weapon(bigint, uuid);
DROP FUNCTION IF EXISTS public.generate_weapon(bigint, uuid, jsonb, boolean);
DROP FUNCTION IF EXISTS public.get_random_attack_for_slot(bigint, integer);
DROP FUNCTION IF EXISTS public.get_random_attack_for_slot(bigint, integer, bigint[]);
DROP FUNCTION IF EXISTS public.generate_consumable_instance(bigint);
DROP FUNCTION IF EXISTS public.generate_consumable_instance(bigint, uuid, jsonb, boolean);

CREATE OR REPLACE FUNCTION public.get_random_attack_for_slot(
    p_template_id bigint,
    p_slot integer,
    p_exclude_attack_ids bigint[] DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_total_weight double precision;
    v_roll double precision;
    v_selected_attack_id bigint;
    v_exclude bigint[] := coalesce(p_exclude_attack_ids, array[]::bigint[]);
begin
    -- Total weight of attacks in this slot that are not already taken.
    select sum(m.weight::double precision)
    into v_total_weight
    from weapon_template_attack_mapping m
    where m.weapon_template_id = p_template_id
      and m.slot = p_slot
      and not (m.attack_id = any(v_exclude));

    if v_total_weight is null or v_total_weight = 0 then
        return null;
    end if;

    v_roll := random() * v_total_weight;

    select m.attack_id
    into v_selected_attack_id
    from (
        select
            m.attack_id,
            sum(m.weight::double precision) over (
                order by m.id
                rows between unbounded preceding and current row
            ) as cumulative_weight
        from weapon_template_attack_mapping m
        where m.weapon_template_id = p_template_id
          and m.slot = p_slot
          and not (m.attack_id = any(v_exclude))
        order by m.id
    ) m
    where m.cumulative_weight > v_roll
    limit 1;

    if v_selected_attack_id is null then
        select m.attack_id
        into v_selected_attack_id
        from weapon_template_attack_mapping m
        where m.weapon_template_id = p_template_id
          and m.slot = p_slot
          and not (m.attack_id = any(v_exclude))
        order by m.id
        limit 1;
    end if;

    if v_selected_attack_id is null then
        return null;
    end if;

    return (
        select to_jsonb(a)
        from attack a
        where a.id = v_selected_attack_id
        limit 1
    );
end;
$function$;

COMMENT ON FUNCTION public.get_random_attack_for_slot(bigint, integer, bigint[]) IS
  'Weighted attack draw for one weapon slot. p_exclude_attack_ids are skipped so a weapon chain does not repeat an attack.';

CREATE OR REPLACE FUNCTION public.generate_weapon(
    p_template_id bigint,
    p_user_id uuid DEFAULT NULL,
    p_spec jsonb DEFAULT NULL,
    p_persist boolean DEFAULT true
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    v_qm_out numeric;
    v_tier text;

    v_attack0 jsonb;
    v_attack1 jsonb;
    v_attack2 jsonb;
    v_attack3 jsonb;
    v_attack4 jsonb;
    v_chain boolean := true;
    v_taken bigint[] := array[]::bigint[];
    v_pick bigint;

    v_slot0 bigint;
    v_slot1 bigint;
    v_slot2 bigint;
    v_slot3 bigint;
    v_slot4 bigint;

    v_row weapon_instance%rowtype;
begin
    select * into v_tmpl from weapon_template where id = p_template_id;

    if not found then
        raise exception 'Weapon template id % not found', p_template_id;
    end if;

    if p_spec is not null then
        -- Verbatim grant of a roll already shown. No random(), no quality recompute.
        if p_spec->>'damage' is null
           or p_spec->>'speed' is null
           or p_spec->>'accuracy' is null
           or coalesce(p_spec->>'crit_chance', p_spec->>'crit') is null
           or p_spec->>'quality_multiplier' is null
           or p_spec->>'tier' is null
           or coalesce(p_spec->>'slot_0_attack_id', p_spec#>>'{slot_0_attack,id}') is null
        then
            raise exception 'generate_weapon p_spec is missing required fields';
        end if;

        v_damage := (p_spec->>'damage')::int;
        v_speed := (p_spec->>'speed')::int;
        v_accuracy := (p_spec->>'accuracy')::int;
        v_crit_chance := coalesce((p_spec->>'crit_chance')::int, (p_spec->>'crit')::int);
        v_quality_mult := (p_spec->>'quality_multiplier')::numeric;
        v_qm_out := v_quality_mult;
        v_tier := p_spec->>'tier';

        v_slot0 := coalesce(nullif(p_spec->>'slot_0_attack_id', '')::bigint, nullif(p_spec#>>'{slot_0_attack,id}', '')::bigint);
        v_slot1 := coalesce(nullif(p_spec->>'slot_1_attack_id', '')::bigint, nullif(p_spec#>>'{slot_1_attack,id}', '')::bigint);
        v_slot2 := coalesce(nullif(p_spec->>'slot_2_attack_id', '')::bigint, nullif(p_spec#>>'{slot_2_attack,id}', '')::bigint);
        v_slot3 := coalesce(nullif(p_spec->>'slot_3_attack_id', '')::bigint, nullif(p_spec#>>'{slot_3_attack,id}', '')::bigint);
        v_slot4 := coalesce(nullif(p_spec->>'slot_4_attack_id', '')::bigint, nullif(p_spec#>>'{slot_4_attack,id}', '')::bigint);

        select to_jsonb(a) into v_attack0 from attack a where a.id = v_slot0 limit 1;
        select to_jsonb(a) into v_attack1 from attack a where a.id = v_slot1 limit 1;
        select to_jsonb(a) into v_attack2 from attack a where a.id = v_slot2 limit 1;
        select to_jsonb(a) into v_attack3 from attack a where a.id = v_slot3 limit 1;
        select to_jsonb(a) into v_attack4 from attack a where a.id = v_slot4 limit 1;
    else
        select to_jsonb(a) into v_attack0
        from attack a where a.id = v_tmpl.slot_0_attack_id limit 1;
        if v_tmpl.slot_0_attack_id is not null then
            v_taken := array_append(v_taken, v_tmpl.slot_0_attack_id);
        end if;

        -- Roll stats (unchanged distribution)
        v_damage := greatest(1, normal_int(v_tmpl.base_damage, v_tmpl.damage_range));
        v_speed := greatest(1, normal_int(v_tmpl.base_speed, v_tmpl.speed_range));
        v_accuracy := greatest(0, normal_int(v_tmpl.base_accuracy, v_tmpl.accuracy_range));

        if coalesce(v_tmpl.crit_range, 0) <= 0 then
            v_crit_chance := greatest(0, coalesce(v_tmpl.crit_base, 5));
        else
            v_crit_chance := greatest(0, coalesce(v_tmpl.crit_base, 5)
                + floor(random() * (v_tmpl.crit_range * 2 + 1))::int - v_tmpl.crit_range);
        end if;

        -- PC-DEC-076: quality-based system (tier is display only). Thresholds unchanged.
        v_power_score := v_damage::numeric
                      * (100.0 / v_speed)
                      * (v_accuracy::numeric / 100.0)
                      * (1.0 + (v_crit_chance::numeric / 100.0));

        v_base_power := v_tmpl.base_damage::numeric
                     * (100.0 / v_tmpl.base_speed)
                     * (v_tmpl.base_accuracy::numeric / 100.0)
                     * 1.05;

        v_quality_mult := power(greatest(v_power_score / v_base_power, 0.25), 0.78);
        v_qm_out := round(v_quality_mult::numeric, 4);

        v_tier := case
            when v_quality_mult >= 1.11 then 'S'
            when v_quality_mult >= 1.075 then 'A'
            when v_quality_mult >= 1.04 then 'B'
            when v_quality_mult >= 0.985 then 'C'
            when v_quality_mult >= 0.94 then 'D'
            else 'E'
        end;

        -- Slots 1-4: same chance chain, each draw excludes attacks already taken.
        if v_chain and random() < coalesce(v_tmpl.slot_1_chance, 0) then
            v_attack1 := get_random_attack_for_slot(p_template_id, 1, v_taken);
            v_pick := nullif(v_attack1->>'id', '')::bigint;
            if v_pick is not null then
                v_taken := array_append(v_taken, v_pick);
            end if;
        else
            v_chain := false;
        end if;

        if v_chain and random() < coalesce(v_tmpl.slot_2_chance, 0) then
            v_attack2 := get_random_attack_for_slot(p_template_id, 2, v_taken);
            v_pick := nullif(v_attack2->>'id', '')::bigint;
            if v_pick is not null then
                v_taken := array_append(v_taken, v_pick);
            end if;
        else
            v_chain := false;
        end if;

        if v_chain and random() < coalesce(v_tmpl.slot_3_chance, 0) then
            v_attack3 := get_random_attack_for_slot(p_template_id, 3, v_taken);
            v_pick := nullif(v_attack3->>'id', '')::bigint;
            if v_pick is not null then
                v_taken := array_append(v_taken, v_pick);
            end if;
        else
            v_chain := false;
        end if;

        if v_chain and random() < coalesce(v_tmpl.slot_4_chance, 0) then
            v_attack4 := get_random_attack_for_slot(p_template_id, 4, v_taken);
            v_pick := nullif(v_attack4->>'id', '')::bigint;
            if v_pick is not null then
                v_taken := array_append(v_taken, v_pick);
            end if;
        else
            v_chain := false;
        end if;

        v_slot0 := coalesce(nullif(v_attack0->>'id', '')::bigint, v_tmpl.slot_0_attack_id);
        v_slot1 := nullif(v_attack1->>'id', '')::bigint;
        v_slot2 := nullif(v_attack2->>'id', '')::bigint;
        v_slot3 := nullif(v_attack3->>'id', '')::bigint;
        v_slot4 := nullif(v_attack4->>'id', '')::bigint;
    end if;

    v_result := jsonb_build_object(
        'template_id', p_template_id,
        'user_id', p_user_id,
        'damage', v_damage,
        'speed', v_speed,
        'accuracy', v_accuracy,
        'crit_chance', v_crit_chance,
        'quality_multiplier', v_qm_out,
        'tier', v_tier,
        'slot_0_attack', v_attack0,
        'slot_1_attack', v_attack1,
        'slot_2_attack', v_attack2,
        'slot_3_attack', v_attack3,
        'slot_4_attack', v_attack4,
        'slot_0_attack_id', v_slot0,
        'slot_1_attack_id', v_slot1,
        'slot_2_attack_id', v_slot2,
        'slot_3_attack_id', v_slot3,
        'slot_4_attack_id', v_slot4
    );

    -- Persist only when asked and a target user exists (same gate as before, plus p_persist).
    if p_persist and p_user_id is not null then
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
            v_slot0, v_slot1, v_slot2, v_slot3, v_slot4
        )
        returning id, created_at into v_row.id, v_row.created_at;

        v_result := v_result || jsonb_build_object(
            'id', v_row.id,
            'created_at', to_char(v_row.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
    end if;

    return v_result;
end;
$function$;

COMMENT ON FUNCTION public.generate_weapon(bigint, uuid, jsonb, boolean) IS
  'Single weapon generator. Null p_spec rolls stats and a distinct attack chain. A p_spec is stored verbatim. p_persist false returns the roll without inserting.';

CREATE OR REPLACE FUNCTION public.generate_consumable_instance(
    p_template_id bigint,
    p_user_id uuid DEFAULT NULL,
    p_spec jsonb DEFAULT NULL,
    p_persist boolean DEFAULT true
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_floor_base int;
  v_floor_delta int;
  v_window_base int;
  v_window_delta int;
  v_speed_base int;
  v_speed_delta int;
  v_crit_base int;
  v_crit_range int;
  v_rolled_floor int;
  v_rolled_window int;
  v_rolled_speed int;
  v_crit_chance int;
  v_exp_ev numeric;
  v_sigma numeric;
  v_rolled_ev numeric;
  v_z numeric;
  v_grade text;
  v_qm numeric;
  v_instance_id bigint;
  v_result jsonb;
BEGIN
  SELECT floor_base, floor_delta, window_base, window_delta, speed_base, speed_delta, crit_base, crit_range
  INTO v_floor_base, v_floor_delta, v_window_base, v_window_delta, v_speed_base, v_speed_delta, v_crit_base, v_crit_range
  FROM public.consumable_template
  WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  v_exp_ev := v_floor_base + (v_floor_delta / 2.0) + ((v_window_base + v_window_delta) / 2.0 / 2.0);
  v_sigma := GREATEST((v_window_base + v_window_delta) / 2.0, 1.0);

  IF p_spec IS NOT NULL THEN
    IF p_spec->>'rolled_floor' IS NULL
       OR p_spec->>'rolled_window' IS NULL
       OR p_spec->>'rolled_speed' IS NULL
       OR p_spec->>'crit_chance' IS NULL
       OR coalesce(p_spec->>'grade', p_spec->>'tier') IS NULL
    THEN
      RAISE EXCEPTION 'generate_consumable_instance p_spec is missing required fields';
    END IF;

    v_rolled_floor := (p_spec->>'rolled_floor')::int;
    v_rolled_window := (p_spec->>'rolled_window')::int;
    v_rolled_speed := (p_spec->>'rolled_speed')::int;
    v_crit_chance := (p_spec->>'crit_chance')::int;
    v_grade := coalesce(p_spec->>'grade', p_spec->>'tier');
    IF p_spec->>'quality_multiplier' IS NOT NULL THEN
      v_qm := (p_spec->>'quality_multiplier')::numeric;
    ELSE
      v_rolled_ev := v_rolled_floor + (v_rolled_window / 2.0);
      v_qm := round(power(greatest(v_rolled_ev / greatest(v_exp_ev, 1), 0.25), 0.78)::numeric, 4);
    END IF;
  ELSE
    v_rolled_floor := v_floor_base + FLOOR(RANDOM() * (v_floor_delta + 1));
    v_rolled_window := v_window_base + FLOOR(RANDOM() * (v_window_delta + 1));
    v_rolled_speed := v_speed_base + FLOOR(RANDOM() * (v_speed_delta + 1));

    IF COALESCE(v_crit_range, 0) <= 0 THEN
      v_crit_chance := GREATEST(0, v_crit_base);
    ELSE
      v_crit_chance := GREATEST(0, v_crit_base + FLOOR(RANDOM() * (v_crit_range * 2 + 1)) - v_crit_range);
    END IF;

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

    v_qm := round(power(greatest(v_rolled_ev / greatest(v_exp_ev, 1), 0.25), 0.78)::numeric, 4);
  END IF;

  v_result := jsonb_build_object(
    'template_id', p_template_id,
    'user_id', v_user_id,
    'rolled_floor', v_rolled_floor,
    'rolled_window', v_rolled_window,
    'rolled_speed', v_rolled_speed,
    'crit_chance', v_crit_chance,
    'grade', v_grade,
    'tier', v_grade,
    'quality_multiplier', v_qm
  );

  IF p_persist THEN
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF auth.uid() IS NOT NULL AND v_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'cannot generate consumables for another user (p_user_id=% is not auth.uid()=%)',
        v_user_id, auth.uid();
    END IF;

    INSERT INTO public.consumable_instance (user_id, template_id, rolled_floor, rolled_window, rolled_speed, crit_chance, grade)
    VALUES (v_user_id, p_template_id, v_rolled_floor, v_rolled_window, v_rolled_speed, v_crit_chance, v_grade)
    RETURNING id INTO v_instance_id;

    v_result := v_result || jsonb_build_object('id', v_instance_id);
  END IF;

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.generate_consumable_instance(bigint, uuid, jsonb, boolean) IS
  'Single consumable generator. Null p_spec rolls floor/window/speed/crit and the z-grade. A p_spec is stored verbatim. p_persist false returns the roll without inserting.';

GRANT EXECUTE ON FUNCTION public.get_random_attack_for_slot(bigint, integer, bigint[]) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_weapon(bigint, uuid, jsonb, boolean) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_consumable_instance(bigint, uuid, jsonb, boolean) TO PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
