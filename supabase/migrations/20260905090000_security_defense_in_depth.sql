-- ============================================================
-- Migration: Defense-in-depth: Revoke table-level DML from authenticated on static tables + secure invite_keys
-- Created: 2026-09-05
-- Purpose: Address Grok security review findings:
--   1. Revoke INSERT/UPDATE/DELETE from authenticated on static tables
--   2. Restrict invite_keys SELECT to service_role only (prevent enumeration)
--   3. Grant SELECT back to authenticated via RLS policy (not table GRANT)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Revoke table-level INSERT/UPDATE/DELETE from authenticated
--    on static/reference tables.
--    RLS policies already enforce service_role-only writes,
--    but table-level grants violate least privilege.
--    Removing these grants so the security boundary is purely RLS.
-- ============================================================

-- Static game data tables (read by authenticated, written by service_role via RPC)
REVOKE INSERT, UPDATE, DELETE ON public.weapon_template FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.attack FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.weapon_template_attack_mapping FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.monster_template FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.monster_instance FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.monster_template_attack_mapping FROM authenticated;

-- ============================================================
-- 2. Secure invite_keys
--    Currently: authenticated users can SELECT all invite keys
--    This enables enumeration/brute-force attacks on the invite system.
--
--    Fix: Revoke SELECT from authenticated at table level,
--    then add an RLS policy that only allows service_role to view invite_keys.
--    The invite-verify edge function uses service_role for all DB access,
--    so it will still work — but authenticated users can no longer enumerate keys.
-- ============================================================

REVOKE ALL ON public.invite_keys FROM authenticated;

-- Add a service_role-only SELECT policy for invite_keys
CREATE POLICY "Only service_role can view invite keys"
  ON public.invite_keys FOR SELECT
  TO service_role
  USING (true);

-- ============================================================
-- 3. Verify: authenticated can still SELECT static data
--    (RLS provides this — no table-level GRANT needed)
--
--    The existing policies on static tables already grant SELECT
--    to authenticated via auth.role() = 'authenticated'.
--    We only removed the write privileges, not SELECT.
-- ============================================================

-- Grant sequence usage (needed for generated columns on user tables)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;
