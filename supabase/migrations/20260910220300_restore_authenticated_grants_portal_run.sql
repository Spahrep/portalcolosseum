-- ============================================================
-- Migration: 20260910220300_restore_authenticated_grants_portal_run.sql
-- Restore table-level grants to authenticated (for admin policy to function)
-- after the over-revoking seal migration 20260910220100.
-- Non-admin authenticated still match no policy -> denied (fail-safe).
-- Follows conventions from 20260905110000_security_admin_only_access.sql
-- ============================================================

BEGIN;

-- R3: anon stays fully revoked; authenticated gets table grants so RLS policies can apply
REVOKE ALL ON public.portal_run FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_run TO authenticated;

-- Harden against future blanket grants (per security convention)
ALTER TABLE public.portal_run FORCE ROW LEVEL SECURITY;

-- No permissive policy re-added. Admin policy from prior migration remains effective for admins.
COMMENT ON TABLE public.portal_run IS 'Server-authoritative only via service_role + API. Authenticated grants restored for admin policy only; non-admins denied by RLS.';

COMMIT;
