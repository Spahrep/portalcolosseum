-- ============================================================
-- Migration: Lock down all tables to service_role only
-- Created: 2026-09-05
-- Purpose: Per user request — only server-side (service_role)
--          should access the database. No anon or authenticated
--          client-side access to any table.
--
--          This requires the app to use Edge Functions / server-side
--          code for all DB access, using the service_role key.
--          Direct client supabase-js calls will no longer work.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Revoke ALL table-level privileges from anon and authenticated
--    on ALL tables in public schema.
--    The database should only be accessed via service_role (server-side).
-- ============================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.tablename);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', r.tablename);
    END LOOP;
END $$;

-- Also revoke on sequences (needed for generated columns)
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- ============================================================
-- 2. Replace per-user RLS policies on user-owned tables
--    with service_role-only access.
--    (anon/authenticated policies no longer needed since clients
--     won't connect directly — Edge Functions use service_role).
-- ============================================================

-- player_inventory: drop old per-user policies, add service_role-only
DROP POLICY IF EXISTS "Users can view their own inventory" ON public.player_inventory;
DROP POLICY IF EXISTS "Users can insert into their own inventory" ON public.player_inventory;
DROP POLICY IF EXISTS "Users can update their own inventory" ON public.player_inventory;
DROP POLICY IF EXISTS "Users can delete from their own inventory" ON public.player_inventory;

CREATE POLICY "Only service_role can access player_inventory"
  ON public.player_inventory
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- weapon_instance: remove old per-user policies
DROP POLICY IF EXISTS "Users can view their own weapon instances" ON public.weapon_instance;
DROP POLICY IF EXISTS "Users can insert their own weapon instances" ON public.weapon_instance;
DROP POLICY IF EXISTS "Users can update their own weapon instances" ON public.weapon_instance;
DROP POLICY IF EXISTS "Users can delete their own weapon instances" ON public.weapon_instance;

CREATE POLICY "Only service_role can access weapon_instance"
  ON public.weapon_instance
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- profiles: remove old policies (including public read)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profiles" ON public.profiles;

CREATE POLICY "Only service_role can access profiles"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 3. Replace static data table policies (SELECT → service_role only)
-- ============================================================

-- attack
DROP POLICY IF EXISTS "Authenticated users can view all attacks" ON public.attack;
DROP POLICY IF EXISTS "Only service_role can modify attacks" ON public.attack;

CREATE POLICY "Only service_role can access attack"
  ON public.attack
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- weapon_template
DROP POLICY IF EXISTS "Authenticated users can view all weapon templates" ON public.weapon_template;
DROP POLICY IF EXISTS "Only service_role can modify weapon templates" ON public.weapon_template;

CREATE POLICY "Only service_role can access weapon_template"
  ON public.weapon_template
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- weapon_template_attack_mapping
DROP POLICY IF EXISTS "Authenticated users can view weapon template attack mappings" ON public.weapon_template_attack_mapping;
DROP POLICY IF EXISTS "Only service_role can modify weapon template attack mappings" ON public.weapon_template_attack_mapping;

CREATE POLICY "Only service_role can access weapon_template_attack_mapping"
  ON public.weapon_template_attack_mapping
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- monster_template
DROP POLICY IF EXISTS "Authenticated users can view all monster templates" ON public.monster_template;
DROP POLICY IF EXISTS "Only service_role can modify monster templates" ON public.monster_template;

CREATE POLICY "Only service_role can access monster_template"
  ON public.monster_template
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- monster_template_attack_mapping
DROP POLICY IF EXISTS "Authenticated users can view all monster template attack mappings" ON public.monster_template_attack_mapping;
DROP POLICY IF EXISTS "Only service_role can modify monster template attack mappings" ON public.monster_template_attack_mapping;

CREATE POLICY "Only service_role can access monster_template_attack_mapping"
  ON public.monster_template_attack_mapping
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- monster_instance
DROP POLICY IF EXISTS "Authenticated users can view all monster instances" ON public.monster_instance;
DROP POLICY IF EXISTS "Only service_role can modify monster instances" ON public.monster_instance;

CREATE POLICY "Only service_role can access monster_instance"
  ON public.monster_instance
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. invite_keys is already service_role-only — verify
-- ============================================================
-- "Deny all access to anon users" (qual: false)
-- "Only service_role can view invite keys" (already added)

-- ============================================================
-- 5. player_backpack view — already exists, RLS applies
--    No table-level view grant needed for service_role (bypasses RLS)
-- ============================================================

COMMIT;
