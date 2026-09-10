-- ============================================================
-- Migration: Add monster HP columns + portal_run state
-- Created: 2026-09-10
-- Purpose: Engine prerequisites
--   1. monster_template: base_hp + max_hp_delta (Spahrep 2026-09-08:
--      delta rolls EVEN/uniform, rolled max is SECRET per instance)
--   2. monster_instance: rolled max_hp
--   3. portal_run: run/loadout/battle-state holder (L/R hands, belt,
--      Consume A/B, current HP, battle state)
-- Consumables deliberately SKIPPED for now (Spahrep: skip consumables)
-- ============================================================

-- ============================================================
-- 1. Monster HP
-- ============================================================

-- 1a. monster_template: base MaxHP + delta range
ALTER TABLE public.monster_template
    ADD COLUMN IF NOT EXISTS base_hp     int NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS max_hp_delta int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.monster_template.base_hp IS
  'Base MaxHP for the species. Instance rolls base_hp + uniform(0..max_hp_delta). The rolled max is SECRET — player knows species base at best (Spahrep 2026-09-08).';
COMMENT ON COLUMN public.monster_template.max_hp_delta IS
  'Delta range for the even/uniform HP roll. Every value in [0..delta] is equally likely (NOT a bell curve) so the secret max stays unpredictable with play (Spahrep 2026-09-08).';

-- 1b. monster_instance: the rolled (secret) MaxHP
ALTER TABLE public.monster_instance
    ADD COLUMN IF NOT EXISTS max_hp int;

COMMENT ON COLUMN public.monster_instance.max_hp IS
  'Rolled MaxHP for this instance: base_hp + uniform(0..max_hp_delta). Secret to the player — only species base is known (Spahrep 2026-09-08).';

-- ============================================================
-- 2. portal_template: number of fights per run
--    X fights, not hardcoded 5. Portal 1 stays 5 via config (default).
-- ============================================================
ALTER TABLE public.portal_template
    ADD COLUMN IF NOT EXISTS fights int NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.portal_template.fights IS
  'Number of fights in a full run of this portal. Config, not hardcoded'
  '(Spahrep 2026-09-10: portals have X fights, 5 via config for now).';

-- ============================================================
-- 3. portal_run: the run instance + battle state
--    Holds the 5-item loadout (L/R hands, belt, Consume A/B) and
--    the live battle state blob. The engine reads/writes this.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_run (
    id              bigint  primary key generated always as identity,
    user_id         uuid    not null references auth.users on delete cascade,
    portal_template_id bigint not null references public.portal_template(id),
    status          text    not null default 'active'
                            check (status in ('active', 'completed', 'abandoned', 'dead')),
    -- 5-item loadout, locked at entry (portal-runs.md)
    hand_l_weapon_id bigint  references public.weapon_instance(id),
    hand_r_weapon_id bigint  references public.weapon_instance(id),
    belt_weapon_id   bigint  references public.weapon_instance(id),
    consume_a_id     bigint  references public.weapon_instance(id),  -- placeholder: consumable_instance table later
    consume_b_id     bigint  references public.weapon_instance(id),  -- placeholder: consumable_instance table later
    -- Run / battle state
    current_battle   int     not null default 1,
    total_battles    int     not null default 5,  -- from portal_template.fights
    player_hp        int     not null default 1000,  -- starting HP (combat-system.md)
    battle_state     jsonb   not null default '{}'::jsonb,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

COMMENT ON TABLE public.portal_run IS
  'One row per portal run. Owns the locked 5-item loadout (hand L/R, belt, consume A/B)'
  'and the live battle-state JSON (participants, tic queue, monster HPs, buffs, remaining dice,'
  'loot). The combat engine reads/writes this. Consume A/B FK to weapon_instance is a PLACEHOLDER'
  'until the consumable_instance table exists (consumables skipped for now, Spahrep 2026-09-10).';
COMMENT ON COLUMN public.portal_run.battle_state IS
  'Ephemeral combat state: participants, tic queue, monster HPs, buffs w/ end tics,'
  'remaining dice, accumulated loot. JSONB for MVP; normalize later if it earns its keep.';

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_portal_run_user_id ON public.portal_run(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_run_status ON public.portal_run(status);

-- ============================================================
-- 5. RLS
--    portal_run: owner-only (like weapon_instance).
--    monster_template/instance: admin-only config + engine-generated rows
--    (same pattern as existing tables).
-- ============================================================
ALTER TABLE public.portal_run ENABLE ROW LEVEL SECURITY;

-- Owner: full control of their own runs
CREATE POLICY "Users manage own portal_run"
    ON public.portal_run FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins: full control (debug/playtest tooling)
CREATE POLICY "Admins manage portal_run"
    ON public.portal_run FOR ALL
    TO authenticated
    USING (public.is_current_user_admin())
    WITH CHECK (public.is_current_user_admin());

-- ============================================================
-- 6. updated_at trigger
-- ============================================================
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.portal_run
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
