-- PC-50r: one active run per account (collapse duplicates + partial unique index)
-- Enforces exactly one 'active' portal_run per user_id at the DB level.
-- MUST run the collapse DELETE first on any prod data that has 2-3 active runs,
-- or the unique index creation will fail. (Spahrep 2026-09-15)
-- Do NOT apply this migration until review + human signoff.

-- 1. PURGE extra active runs (hard delete). Keep the richest per user:
--    length(battle_state::text) DESC, id DESC tiebreak. Child rows (dice) cascade.
DELETE FROM public.portal_run r
WHERE r.status = 'active'
  AND r.id NOT IN (
    SELECT DISTINCT ON (user_id) id FROM public.portal_run
    WHERE status = 'active'
    ORDER BY user_id, length(battle_state::text) DESC, id DESC
  );

-- 2. Now safe to create the partial unique index (hard guarantee).
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_run_one_active_per_user
  ON public.portal_run(user_id)
  WHERE status = 'active';

COMMENT ON INDEX idx_portal_run_one_active_per_user IS
  'PC-50r: partial unique enforces one active run/account. Collapse step first for existing dups. Pairs with API guard change from 3→1 (Spahrep 2026-09-15).';

-- Commit on this branch only. DO NOT apply the migration to any database — PM applies after review with human approval.