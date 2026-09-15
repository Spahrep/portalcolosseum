-- PC-48r weapon grades: add grade column to weapon_instance, backfill from template-relative composite z-score
-- Mirrors consumable_instance.grade exactly in banding logic.

ALTER TABLE public.weapon_instance
  ADD COLUMN IF NOT EXISTS grade text;

-- Backfill grade for all existing rows by computing per-stat z vs their template, composite avg, then CASE.
-- Zero-range guard: any stat with *_range = 0 gets z=0 for that component (no div0).
-- z_dmg = (damage - base_damage) / damage_range
-- z_spd = (base_speed - speed) / speed_variance   -- inverted: lower speed = better/faster
-- z_acc = (accuracy - base_accuracy) / accuracy_range
-- composite_z = (z_dmg + z_spd + z_acc) / 3
DO $$
DECLARE
  rec RECORD;
  z_dmg numeric;
  z_spd numeric;
  z_acc numeric;
  z_comp numeric;
  new_grade text;
BEGIN
  FOR rec IN
    SELECT wi.id, wi.damage, wi.speed, wi.accuracy,
           wt.base_damage, wt.damage_range, wt.base_speed, wt.speed_variance, wt.base_accuracy, wt.accuracy_range
    FROM public.weapon_instance wi
    JOIN public.weapon_template wt ON wt.id = wi.template_id
  LOOP
    z_dmg := CASE WHEN rec.damage_range = 0 THEN 0 ELSE (rec.damage - rec.base_damage)::numeric / rec.damage_range END;
    z_spd := CASE WHEN rec.speed_variance = 0 THEN 0 ELSE (rec.base_speed - rec.speed)::numeric / rec.speed_variance END;
    z_acc := CASE WHEN rec.accuracy_range = 0 THEN 0 ELSE (rec.accuracy - rec.base_accuracy)::numeric / rec.accuracy_range END;
    z_comp := (z_dmg + z_spd + z_acc) / 3.0;

    new_grade := CASE
      WHEN z_comp >= 3 THEN 'S'
      WHEN z_comp >= 2 THEN 'A'
      WHEN z_comp >= 1 THEN 'B'
      WHEN z_comp >= 0 THEN 'C'
      WHEN z_comp >= -1 THEN 'D'
      WHEN z_comp >= -2 THEN 'E'
      ELSE 'F'
    END;

    UPDATE public.weapon_instance SET grade = new_grade WHERE id = rec.id;
  END LOOP;
END $$;

-- Enforce CHECK, NOT NULL, index, comment (after backfill so no nulls)
ALTER TABLE public.weapon_instance
  ADD CONSTRAINT weapon_instance_grade_check CHECK (grade IN ('F','E','D','C','B','A','S'));

ALTER TABLE public.weapon_instance ALTER COLUMN grade SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_weapon_instance_grade ON public.weapon_instance(grade);

COMMENT ON COLUMN public.weapon_instance.grade IS 'Grade label (F-S) computed at generation time from template-relative composite z-score of the three rolled stats (damage/speed/accuracy). Stored, not derived. Mirrors consumable_instance.grade banding.';

-- Commit on this branch only. DO NOT apply the migration to any database — PM applies after review with human approval.
