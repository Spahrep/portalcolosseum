-- PC-DEC-076: Weapon pricing & grading model accepted
-- Adds base_price to templates and quality_multiplier + tier to instances.
-- Quality_multiplier drives all pricing. Tier is display label only.
-- S-tier capped at ~1.5% (max 5%).

-- 1. Base price per template
ALTER TABLE public.weapon_template
  ADD COLUMN base_price numeric NOT NULL DEFAULT 45;

COMMENT ON COLUMN public.weapon_template.base_price IS 'Base price for average roll on this template. Actual buy/sell uses quality_multiplier on top of this.';

-- 2. Computed quality fields on each instance
ALTER TABLE public.weapon_instance
  ADD COLUMN quality_multiplier numeric,
  ADD COLUMN tier text CHECK (tier IN ('S','A','B','C','D','E','F'));

COMMENT ON COLUMN public.weapon_instance.quality_multiplier IS 'Computed from power_score. Drives buy_price and sell_price.';
COMMENT ON COLUMN public.weapon_instance.tier IS 'Aesthetic label only (S = top ~1.5%). Computed at generation time.';

-- Backfill existing instances with neutral values
UPDATE public.weapon_instance
   SET quality_multiplier = 1.0,
       tier = 'C'
 WHERE quality_multiplier IS NULL;