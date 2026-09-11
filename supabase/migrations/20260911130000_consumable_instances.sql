-- ============================================================
-- Migration: Consumable templates + instances (PC-17)
-- Created: 2026-09-11
-- Purpose: Consumables assignment + inventory only (usage deferred per locked rule)
--   - consumable_template (static)
--   - consumable_instance (player owned)
--   - Re-point portal_run.consume_a_id / consume_b_id FKs (was placeholder to weapon_instance)
-- ============================================================

-- 1. consumable_template (admin-managed static data, like weapon_template)
CREATE TABLE IF NOT EXISTS public.consumable_template (
    id          bigint primary key generated always as identity,
    name        text not null,
    effect_type text not null check (effect_type in ('heal','buff','damage')),
    potency     int not null,
    description text,
    created_at  timestamptz not null default now()
);

COMMENT ON TABLE public.consumable_template IS
  'Static consumable templates. Potency values are placeholders (PM tunes later). '
  'effect_type drives future usage logic (deferred).';

-- Seed 3 placeholder templates (values illustrative only)
INSERT INTO public.consumable_template (name, effect_type, potency, description) VALUES
('Health Potion', 'heal', 100, 'Restores 100 HP'),
('Power Tonic', 'buff', 125, 'Buffs damage by 1.25x (stored as 125)'),
('Smoke Bomb', 'damage', 25, 'Deals 25 damage to target');

-- 2. consumable_instance (player-owned rows + admin)
CREATE TABLE IF NOT EXISTS public.consumable_instance (
    id          bigint primary key generated always as identity,
    user_id     uuid not null references auth.users on delete cascade,
    template_id bigint not null references public.consumable_template(id),
    created_at  timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_consumable_instance_user_id ON public.consumable_instance(user_id);

COMMENT ON TABLE public.consumable_instance IS
  'Player-owned consumable instances. Loadout pointers (consume_a/b) live on portal_run. '
  'Usage mechanics deferred (potion needs free hand rule).';

-- 3. RLS for consumable_template (admin only, mirror weapon_template)
ALTER TABLE public.consumable_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage consumable templates"
    ON public.consumable_template FOR ALL
    TO authenticated
    USING (public.is_current_user_admin())
    WITH CHECK (public.is_current_user_admin());

-- 4. RLS for consumable_instance (player owns own rows + admin all; mirror stated intent for weapon_instance pattern)
ALTER TABLE public.consumable_instance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own consumable instances"
    ON public.consumable_instance FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage consumable instances"
    ON public.consumable_instance FOR ALL
    TO authenticated
    USING (public.is_current_user_admin())
    WITH CHECK (public.is_current_user_admin());

-- 5. Re-point portal_run consume_*_id FKs (drop old weapon_instance refs, add to consumable_instance)
--    Columns and nullability unchanged. Existing rows (nulls or old ids) will need manual cleanup post-apply if any.
ALTER TABLE public.portal_run
    DROP CONSTRAINT IF EXISTS portal_run_consume_a_id_fkey,
    DROP CONSTRAINT IF EXISTS portal_run_consume_b_id_fkey;

ALTER TABLE public.portal_run
    ADD CONSTRAINT portal_run_consume_a_id_fkey
        FOREIGN KEY (consume_a_id) REFERENCES public.consumable_instance(id),
    ADD CONSTRAINT portal_run_consume_b_id_fkey
        FOREIGN KEY (consume_b_id) REFERENCES public.consumable_instance(id);

COMMENT ON COLUMN public.portal_run.consume_a_id IS
  'Consumable loadout slot A. Was placeholder FK to weapon_instance; now points to consumable_instance (PC-17).';
COMMENT ON COLUMN public.portal_run.consume_b_id IS
  'Consumable loadout slot B. Was placeholder FK to weapon_instance; now points to consumable_instance (PC-17).';
