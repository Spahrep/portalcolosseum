-- Shop stock attacks: weapons in the shop are COMPLETE instances.
-- Their slot attacks must be rolled and persisted at STOCK time so the
-- displayed card is exactly what the buyer receives ("display is a promise").
-- generate_weapon re-rolls attacks independently on purchase; the buy handler
-- now overwrites the fresh instance's slot attacks with these persisted ones.

-- 1. Add slot attack id columns to shop_stock
ALTER TABLE shop_stock
  ADD COLUMN IF NOT EXISTS slot_0_attack_id bigint,
  ADD COLUMN IF NOT EXISTS slot_1_attack_id bigint,
  ADD COLUMN IF NOT EXISTS slot_2_attack_id bigint,
  ADD COLUMN IF NOT EXISTS slot_3_attack_id bigint,
  ADD COLUMN IF NOT EXISTS slot_4_attack_id bigint;

COMMENT ON TABLE shop_stock IS
  'Daily shop stock. Weapon rows now carry their rolled slot attack ids (slot_N_attack_id) so a card shows the exact attacks granted on purchase.';

-- 2. Roll the slot attacks for a weapon the SAME WAY generate_weapon does
--    (identical sequential chain + get_random_attack_for_slot), so the shop
--    roll is byte-for-byte the same lottery. Returns the 5 slot attack ids.
CREATE OR REPLACE FUNCTION public.roll_shop_stock_attacks(p_template_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
 SET search_path = public, pg_temp
AS $func$
declare
    v_tmpl record;
    v_attack0 jsonb;
    v_attack1 jsonb;
    v_attack2 jsonb;
    v_attack3 jsonb;
    v_attack4 jsonb;
    v_chain boolean := true;
begin
    select * into v_tmpl from weapon_template where id = p_template_id;
    if not found then
        raise exception 'Weapon template id % not found', p_template_id;
    end if;

    -- Slot 0 is always the template's guaranteed attack
    select to_jsonb(a) into v_attack0
    from attack a where a.id = v_tmpl.slot_0_attack_id limit 1;

    -- Slots 1-4: identical sequential chain to generate_weapon
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

    return jsonb_build_object(
        'slot_0_attack', v_attack0,
        'slot_1_attack', v_attack1,
        'slot_2_attack', v_attack2,
        'slot_3_attack', v_attack3,
        'slot_4_attack', v_attack4
    );
end;
$func$;

COMMENT ON FUNCTION public.roll_shop_stock_attacks(bigint) IS
  'Rolls slot attacks for a shop weapon using the identical chain and lottery as generate_weapon, so the shop card is the exact instance granted on purchase.';