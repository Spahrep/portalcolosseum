-- PC-50: one active run per account (partial unique index + guard)
-- Enforces exactly one 'active' portal_run per user_id.
-- Existing rows unaffected; new inserts rejected by DB or API.

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_run_one_active_per_user
  ON public.portal_run(user_id)
  WHERE status = 'active';

COMMENT ON INDEX idx_portal_run_one_active_per_user IS
  'PC-50: partial unique enforces one active run/account. Pairs with API guard change from 3→1.';