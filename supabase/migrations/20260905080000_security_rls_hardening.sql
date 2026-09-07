-- ============================================================
-- Migration: Fix RLS and revoke anon table-level privileges
-- Created: 2026-09-05
-- Purpose: Security hardening
--          1. Enable RLS on monster_instance, monster_template, monster_template_attack_mapping
--          2. Add per-user RLS policies for monster_instance
--          3. Add service_role-only policies for monster_template + monster_template_attack_mapping
--          4. Keep all existing policy behavior
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Enable RLS on monster tables (currently disabled)
-- ============================================================
-- monster_instance: this is generated environmental encounter data.
-- In the current design, monsters don't belong to individual users — they're
-- environmental. So we'll make SELECT public (like weapon_template) and
-- restrict ALL writes to service_role (like weapon_template/attack).
--
-- If monsters later become player-owned (e.g. summoned pets), we'll add
-- per-user policies then. For now: read all, write service_role only.

ALTER TABLE public.monster_instance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all monster instances"
  ON public.monster_instance FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only service_role can modify monster instances"
  ON public.monster_instance FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- monster_template: static data like weapon_template — read by authenticated, write by service_role
ALTER TABLE public.monster_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all monster templates"
  ON public.monster_template FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only service_role can modify monster templates"
  ON public.monster_template FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- monster_template_attack_mapping: junction table — same pattern as weapon_template_attack_mapping
ALTER TABLE public.monster_template_attack_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all monster template attack mappings"
  ON public.monster_template_attack_mapping FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only service_role can modify monster template attack mappings"
  ON public.monster_template_attack_mapping FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 2. Revoke table-level privileges from anon role
--    On all tables that should not be directly writable by anon
--    (RLS still applies for SELECT where appropriate)
-- ============================================================
-- Tables where anon should have NO access at all:
--   profiles, weapon_instance, player_inventory, invite_keys

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.weapon_instance FROM anon;
REVOKE ALL ON public.player_inventory FROM anon;
REVOKE ALL ON public.invite_keys FROM anon;

-- Tables where anon (or public) should have no implicit write access:
--   weapon_template, attack, weapon_template_attack_mapping, monster tables
REVOKE INSERT, UPDATE, DELETE ON public.weapon_template FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.attack FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.weapon_template_attack_mapping FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.monster_template FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.monster_instance FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.monster_template_attack_mapping FROM anon;

-- Grant SELECT on public-read tables for anon (so API layer can still serve them
-- if needed without auth, consistent with existing intent for weapon_template/attack)
-- NOTE: This may not be desired. If weapon_template/attack should require auth
-- to read, uncomment the REVOKE below instead.
-- REVOKE SELECT ON public.weapon_template FROM anon;
-- REVOKE SELECT ON public.attack FROM anon;

-- ============================================================
-- 3. Grant explicit privileges to authenticated role
--    This is what the app actually uses — supabase-js defaults to
--    "authenticated" user when a JWT is provided.
-- ============================================================

-- Public-read tables: authenticated users can SELECT
GRANT SELECT ON public.weapon_template TO authenticated;
GRANT SELECT ON public.attack TO authenticated;
GRANT SELECT ON public.monster_template TO authenticated;
GRANT SELECT ON public.monster_template_attack_mapping TO authenticated;
GRANT SELECT ON public.monster_instance TO authenticated;
GRANT SELECT ON public.invite_keys TO authenticated;
GRANT SELECT ON public.weapon_template_attack_mapping TO authenticated;

-- Per-user tables: authenticated users can CRUD their own (RLS handles ownership scoping)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weapon_instance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_inventory TO authenticated;

-- Sequences need grants for inserts to work with generated columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;
