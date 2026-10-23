-- PC-DEC-074/076: sell_weapon RPC — atomic, single-round-trip sell.
-- Replaces the multi-query JS handler (which was 7 sequential DB calls -> ~3s
-- latency on cold edge functions) AND makes the double-pay guard airtight by
-- doing the delete + gold grant inside one transaction.
--
-- Returns jsonb: { ok:true, gold_gained, new_gold } or { error }.

CREATE OR REPLACE FUNCTION public.sell_weapon(
  p_user_id uuid,
  p_instance_id bigint,
  p_recovery_rate numeric DEFAULT 0.42
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_weapon weapon_instance%rowtype;
  v_tmpl weapon_template%rowtype;
  v_weapon_count integer;
  v_gold integer;
  v_sell_price integer;
BEGIN
  -- ownership (scoped to the seller)
  SELECT * INTO v_weapon
  FROM weapon_instance
  WHERE id = p_instance_id AND user_id = p_user_id;

  IF v_weapon.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_owned');
  END IF;

  -- no-sell-last-weapon: must keep at least 1 weapon
  SELECT count(*) INTO v_weapon_count
  FROM weapon_instance WHERE user_id = p_user_id;
  IF v_weapon_count <= 1 THEN
    RETURN jsonb_build_object('error', 'no_sell_last_weapon');
  END IF;

  -- can't sell a weapon equipped in an ACTIVE run
  IF EXISTS (
    SELECT 1 FROM portal_run
    WHERE user_id = p_user_id AND status = 'active'
      AND (hand_l_weapon_id = p_instance_id OR hand_r_weapon_id = p_instance_id OR belt_weapon_id = p_instance_id)
  ) THEN
    RETURN jsonb_build_object('error', 'weapon_in_active_run');
  END IF;

  -- clear this weapon's references in non-active runs so the FK doesn't block the delete
  UPDATE portal_run
     SET hand_l_weapon_id = NULL, hand_r_weapon_id = NULL, belt_weapon_id = NULL
   WHERE hand_l_weapon_id = p_instance_id OR hand_r_weapon_id = p_instance_id OR belt_weapon_id = p_instance_id;

  -- price from template base_price
  SELECT * INTO v_tmpl FROM weapon_template WHERE id = v_weapon.template_id;
  v_sell_price := round(coalesce(v_tmpl.base_price, 45) * coalesce(v_weapon.quality_multiplier, 1) * p_recovery_rate)::integer;

  -- current gold
  SELECT gold INTO v_gold FROM profiles WHERE id = p_user_id;
  IF v_gold IS NULL THEN v_gold := 0; END IF;

  -- atomic delete; a replay finds nothing and is not paid
  DELETE FROM weapon_instance WHERE id = p_instance_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_owned');
  END IF;

  UPDATE profiles SET gold = v_gold + v_sell_price WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'gold_gained', v_sell_price, 'new_gold', v_gold + v_sell_price);
END;
$func$;

COMMENT ON FUNCTION public.sell_weapon(uuid, bigint, numeric) IS
  'Atomic weapon sell: ownership + no-sell-last + active-run guards, clears run FK refs, deletes, pays gold. One transaction. PC-DEC-074/076.';