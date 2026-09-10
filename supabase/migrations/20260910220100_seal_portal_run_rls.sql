-- ============================================================
-- Migration: 20260910220100_seal_portal_run_rls.sql
-- Seal portal_run so only service_role (via /api/combat/*) can access.
-- Players cannot bypass via PostgREST (F1 critical).
-- REVOKE from anon/authenticated; DROP owner policy; KEEP admin policy.
-- Follows conventions from 20260905110000_security_admin_only_access.sql
-- ============================================================

-- Ensure RLS remains enabled
ALTER TABLE public.portal_run ENABLE ROW LEVEL SECURITY;

-- F1: Revoke all direct access from non-service roles (anon/authenticated)
-- (service_role bypasses RLS; API uses service-role client exclusively)
REVOKE ALL ON public.portal_run FROM anon, authenticated;

-- Drop the permissive owner policy that allowed authenticated bypass
DROP POLICY IF EXISTS "Users manage own portal_run" ON public.portal_run;

-- Admin policy is intentionally KEPT (for debug/playtest tooling)
-- CREATE POLICY "Admins manage portal_run" remains as-is from 20260910215537

-- Optional: comment for clarity
COMMENT ON TABLE public.portal_run IS 'Server-authoritative only via service_role + API. Direct player access revoked.';

-- No new permissive policy added. All reads/writes now forced through API.
