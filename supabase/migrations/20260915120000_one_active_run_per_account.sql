|-- PC-50r: one active run per account (collapse duplicates + partial unique index)
|-- Enforces exactly one 'active' portal_run per user_id at the DB level.
|-- MUST run the collapse UPDATE first on any prod data that has 2-3 active runs,
|-- or the unique index creation will fail. (Spahrep 2026-09-15)
|-- Do NOT apply this migration until review + human signoff.

-- 1. Collapse duplicates: abandon all but the newest active run per user.
--    Newest = highest created_at, tie-break on id DESC.
WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.portal_run
  WHERE status = 'active'
)
UPDATE public.portal_run
SET status = 'abandoned',
    updated_at = now()
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

-- 2. Now safe to create the partial unique index (hard guarantee).
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_run_one_active_per_user
  ON public.portal_run(user_id)
  WHERE status = 'active';

COMMENT ON INDEX idx_portal_run_one_active_per_user IS
  'PC-50r: partial unique enforces one active run/account. Collapse step first for existing dups. Pairs with API guard change from 3→1 (Spahrep 2026-09-15).';