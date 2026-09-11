-- ============================================================
-- Migration: Dice state for portal runs (normalized portal_run_dice)
-- Created: 2026-09-11
-- Purpose: Materialize per-run dice pool at creation (draw-without-replacement)
--   portal_run_dice: one row per die in the run's pool
--   color, face (rolled result), drawn_battle (NULL=pool), rolled_value (budget)
--   Ownership flows through portal_run (server-authoritative).
--   RLS mirrors the portal_run seal convention (20260910220100 seal +
--   20260910220300 restore): admin-only policy, anon revoked, FORCE RLS.
--   Players read dice state via GET /api/combat/runs/:id — never PostgREST.
-- ============================================================

-- ============================================================
-- 1. portal_run_dice table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_run_dice (
    id              bigint primary key generated always as identity,
    portal_run_id   bigint  not null references public.portal_run(id) on delete cascade,
    color           text    not null check (color in ('green','yellow','red')),
    face            int     null,  -- the rolled face value of this die (player-visible result; exact faces shown to player, decided 2026-09-11)
    drawn_battle    int     null,  -- the battle number this die was drawn for; NULL = still in the pool (draw-without-replacement)
    rolled_value    int     null,  -- the point budget this die produced for its battle (== face for single die today; separate column so future rules can diverge face from budget)
    created_at      timestamptz not null default now()
);

COMMENT ON TABLE public.portal_run_dice IS
  'One row per die in a run''s pool. Materialized at run creation from portal_template counts.'
  ' Dice are drawn without replacement (drawn_battle set on use). face = rolled result (visible);'
  ' rolled_value = budget produced (may diverge in future rules). Server-authoritative: players'
  ' read via /api/combat/runs/:id, never PostgREST (seal convention, 2026-09-11).';

COMMENT ON COLUMN public.portal_run_dice.portal_run_id IS
  'FK to the owning portal_run. Cascade delete on run removal (Spahrep 2026-09-11).';

COMMENT ON COLUMN public.portal_run_dice.color IS
  'Die color (risk profile): green=safer, yellow=mixed, red=dangerous. Check constrained (Spahrep 2026-09-11).';

COMMENT ON COLUMN public.portal_run_dice.face IS
  'Rolled face value of this die (player-visible exact result). NULL until drawn+rolled. Decided 2026-09-11.';

COMMENT ON COLUMN public.portal_run_dice.drawn_battle IS
  'Battle number this die was drawn/used for (1..total_battles). NULL = still available in pool (draw-without-replacement). Spahrep 2026-09-11.';

COMMENT ON COLUMN public.portal_run_dice.rolled_value IS
  'Point budget produced by this die for its battle. Currently == face; separate column for future divergence (e.g. multipliers). Spahrep 2026-09-11.';

COMMENT ON COLUMN public.portal_run_dice.created_at IS
  'Row creation timestamp (run creation time for pool dice). Spahrep 2026-09-11.';

-- ============================================================
-- 2. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_portal_run_dice_run ON public.portal_run_dice(portal_run_id);
CREATE INDEX IF NOT EXISTS idx_portal_run_dice_run_drawn ON public.portal_run_dice(portal_run_id, drawn_battle) WHERE drawn_battle IS NOT NULL;

-- ============================================================
-- 3. RLS — seal convention (mirrors portal_run 20260910220100/20260910220300)
--    Server-authoritative only via service_role + API.
--    NO permissive owner policy: players cannot bypass via PostgREST.
-- ============================================================
ALTER TABLE public.portal_run_dice ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies (idempotent re-run safety), then apply final set:
--   - Admin policy only (debug/playtest tooling)
--   - No owner policy (sealed; API is the only path for players)
DROP POLICY IF EXISTS "Users manage own portal_run_dice" ON public.portal_run_dice;
DROP POLICY IF EXISTS "Admins manage portal_run_dice" ON public.portal_run_dice;

CREATE POLICY "Admins manage portal_run_dice"
    ON public.portal_run_dice FOR ALL
    TO authenticated
    USING (public.is_current_user_admin())
    WITH CHECK (public.is_current_user_admin());

-- anon stays fully revoked; authenticated gets table grants so the admin policy can evaluate
REVOKE ALL ON public.portal_run_dice FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_run_dice TO authenticated;

-- Harden against future blanket grants (security convention)
ALTER TABLE public.portal_run_dice FORCE ROW LEVEL SECURITY;
