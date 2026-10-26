-- PC continuous weapon price curve — sell_weapon must pay the SAME premium the
-- shop UI displays, or the shop lies. Before this migration the RPC priced with
-- raw `quality_multiplier` (C=1.0, top-A=1.088 → an ~9% gap) while shop.js used a
-- premium curve. Now both use price_factor(qm).
--
-- price_factor(qm): ONE continuous monotonic curve across the whole qm range —
-- no flat par floor, no tier step. E/D/C rise gently off ~0.78, the curve steepens
-- hard through B/A/S (B ~1.5x, A ~2.3x, S ~3.1x a C at entry), reaching ~4.8x at
-- the S cap (qm 1.23). "They are all on a curve" (Spahrep 2026-10-26).
-- Keep THIS byte-identical to `priceFactor` + `PF_ANCH` in api/combat/shop.js.

CREATE OR REPLACE FUNCTION public.price_factor(p_qm numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $pf$
  -- anchor points (qm, factor); same table as the JS PF_ANCH array
  SELECT y0 + (p_qm - x0) / (x1 - x0) * (y1 - y0)
  FROM (
    SELECT
      max(a.x) FILTER (WHERE a.x <= p_qm)            AS x0,
      max(a.y) FILTER (WHERE a.x <= p_qm)            AS y0,
      min(a.x) FILTER (WHERE a.x >= p_qm)            AS x1,
      min(a.y) FILTER (WHERE a.x >= p_qm)            AS y1
    FROM (
      VALUES
        (0.80, 0.78),
        (0.90, 0.90),
        (0.94, 0.95),
        (0.985, 1.00),
        (1.00, 1.03),
        (1.04, 1.55),
        (1.055, 1.90),
        (1.075, 2.30),
        (1.09, 2.60),
        (1.11, 3.10),
        (1.15, 3.60),
        (1.23, 4.80),
        (1.30, 5.60)
    ) AS a(x, y)
  ) b
  -- clamp below the first anchor to its leftmost value (mirrors Math.max in JS)
  WHERE p_qm >= 0.80
  UNION ALL
  SELECT 0.78 WHERE p_qm < 0.80
$pf$;

COMMENT ON FUNCTION public.price_factor(numeric) IS
  'Continuous monotonic weapon price factor across all qm: E/D/C rise gently, steepen hard through B/A/S, ~4.8x a C at the S cap. Mirrors priceFactor in api/combat/shop.js. (Spahrep 2026-10-26).';

-- Redefine sell_weapon to pay price_factor(qm) instead of raw qm.
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

  -- price from template base_price stepped by the premium curve
  SELECT * INTO v_tmpl FROM weapon_template WHERE id = v_weapon.template_id;
  v_sell_price := round(coalesce(v_tmpl.base_price, 45) * public.price_factor(coalesce(v_weapon.quality_multiplier, 1)) * p_recovery_rate)::integer;

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
  'Atomic weapon sell: ownership + no-sell-last + active-run guards, clears run FK refs, deletes, pays gold at price_factor(qm) premium curve. One transaction. (Spahrep 2026-10-26).';