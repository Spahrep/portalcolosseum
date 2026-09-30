-- PC-100: check normal_int into migrations.
-- Call sites pass (base, range), not (mean, stddev). stddev = range/3 so the
-- ±3σ clamp is base ± range (combat-system.md: damage/speed/accuracy bell).
-- Idempotent: CREATE OR REPLACE the (int, int) signature callers already use.
-- Do not apply here — PM applies after review.
--
-- Apply fix (2026-09-30): the live DB already has normal_int(integer,integer)
-- whose second parameter is named `range` (reserved). CREATE OR REPLACE cannot
-- rename an existing parameter (42P13), so DROP first. CASCADE also drops the
-- old generate_weapon/generate_monster that depend on it; they are recreated
-- by the later migrations in this batch (20260930120100 / 20260930120200).

DROP FUNCTION IF EXISTS public.normal_int(integer, integer) CASCADE;

CREATE OR REPLACE FUNCTION public.normal_int(base integer, p_range integer)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $func$
DECLARE
    v_u1 double precision;
    v_u2 double precision;
    v_z0 double precision;
    v_stddev double precision;
    v_mean double precision;
    v_low double precision;
    v_high double precision;
    v_result double precision;
BEGIN
    IF base IS NULL OR p_range IS NULL THEN
        RAISE EXCEPTION 'normal_int: base and range must not be null';
    END IF;

    IF p_range = 0 THEN
        RETURN base;
    END IF;

    IF p_range < 0 THEN
        p_range := abs(p_range);
    END IF;

    v_mean := base::double precision;
    v_stddev := p_range::double precision / 3.0;
    v_low := v_mean - p_range::double precision;
    v_high := v_mean + p_range::double precision;

    -- Box-Muller. random() is [0, 1); guard the ln(0) edge.
    v_u1 := random();
    WHILE v_u1 = 0.0 LOOP
        v_u1 := random();
    END LOOP;
    v_u2 := random();

    v_z0 := sqrt(-2.0 * ln(v_u1)) * cos(2.0 * pi() * v_u2);
    v_result := v_mean + v_stddev * v_z0;
    v_result := GREATEST(v_low, LEAST(v_high, v_result));

    -- numeric round, then int. round(float8)::int can truncate a
    -- 1.9999999999999998 float and land one below the true nearest int.
    RETURN round(v_result::numeric)::integer;
END;
$func$;

COMMENT ON FUNCTION public.normal_int(integer, integer) IS
  'Box-Muller integer roll. Second arg is the ± range (not stddev). stddev = range/3 so ±3σ clamps to base ± range. range 0 returns base.';

-- Invoker-rights generators (generate_weapon / generate_monster) call this.
GRANT EXECUTE ON FUNCTION public.normal_int(integer, integer) TO authenticated, service_role;
