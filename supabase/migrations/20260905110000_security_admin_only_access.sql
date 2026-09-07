-- ============================================================
-- Migration: Admin-based access control (service_role lockdown → admin-only)
-- Created: 2026-09-05
-- Purpose: Lock down database so that:
--   - Regular authenticated game players: NO direct DB access
--   - Admin users (Spahrep, DarkJester) and their AI agents: FULL access
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Add is_admin column to profiles FIRST (before function)
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Create admin check helper function
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  );
$$;

-- ============================================================
-- 3. Mark admins
--    Discord IDs: Spahrep=108179732821970944, DarkJester=1501167172842684506
--    Supabase auth UUIDs (set during security review):
--      DarkJester: d0cefedc-9e89-4576-b4e1-e5b203e58f6e
--      Spahrep: NOT YET REGISTERED — sign up in the app first, then run:
--        UPDATE public.profiles SET is_admin = true WHERE id = '<spahrep-auth-uuid>';
--
--    Note: UPDATE on profiles triggers handle_updated_at(), which requires
--    auth.uid(). When running via SQL API as service_role, auth.uid() is NULL.
--    Disable the trigger, run the UPDATE, then re-enable.
-- ============================================================

-- Mark DarkJester as admin (disable trigger first)
ALTER TABLE public.profiles DISABLE TRIGGER handle_updated_at;
UPDATE public.profiles SET is_admin = true WHERE id = 'd0cefedc-9e89-4576-b4e1-e5b203e58f6e';
ALTER TABLE public.profiles ENABLE TRIGGER handle_updated_at;

-- ============================================================
-- 4. Drop old service_role-only policies
-- ============================================================

DROP POLICY IF EXISTS "Only service_role can access player_inventory" ON public.player_inventory;
DROP POLICY IF EXISTS "Only service_role can access weapon_instance" ON public.weapon_instance;
DROP POLICY IF EXISTS "Only service_role can access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only service_role can access attack" ON public.attack;
DROP POLICY IF EXISTS "Only service_role can access weapon_template" ON public.weapon_template;
DROP POLICY IF EXISTS "Only service_role can access weapon_template_attack_mapping" ON public.weapon_template_attack_mapping;
DROP POLICY IF EXISTS "Only service_role can access monster_template" ON public.monster_template;
DROP POLICY IF EXISTS "Only service_role can access monster_template_attack_mapping" ON public.monster_template_attack_mapping;
DROP POLICY IF EXISTS "Only service_role can access monster_instance" ON public.monster_instance;
DROP POLICY IF EXISTS "Only service_role can view invite keys" ON public.invite_keys;
DROP POLICY IF EXISTS "Deny all access to anon users" ON public.invite_keys;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own weapon instances" ON public.weapon_instance;
DROP POLICY IF EXISTS "Users can insert their own weapon instances" ON public.weapon_instance;
DROP POLICY IF EXISTS "Users can update their own weapon instances" ON public.weapon_instance;
DROP POLICY IF EXISTS "Users can delete their own weapon instances" ON public.weapon_instance;
DROP POLICY IF EXISTS "Users can view their own inventory" ON public.player_inventory;
DROP POLICY IF EXISTS "Users can insert into their own inventory" ON public.player_inventory;
DROP POLICY IF EXISTS "Users can update their own inventory" ON public.player_inventory;
DROP POLICY IF EXISTS "Users can delete from their own inventory" ON public.player_inventory;

-- ============================================================
-- 5. Create admin-gated policies for ALL tables
--    Regular authenticated users (non-admin): no matching policy → DENIED
--    Admin users (is_admin = true): full CRUD
-- ============================================================

-- --- player_inventory ---
CREATE POLICY "Admins can manage player inventory"
  ON public.player_inventory
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- --- weapon_instance ---
CREATE POLICY "Admins can manage weapon instances"
  ON public.weapon_instance
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- --- profiles ---
CREATE POLICY "Admins can manage profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- --- Static data tables (admin-only) ---
CREATE POLICY "Admins can manage attack"
  ON public.attack FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can manage weapon_template"
  ON public.weapon_template FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can manage weapon_template_attack_mapping"
  ON public.weapon_template_attack_mapping FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can manage monster_template"
  ON public.monster_template FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can manage monster_template_attack_mapping"
  ON public.monster_template_attack_mapping FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can manage monster_instance"
  ON public.monster_instance FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- --- invite_keys ---
CREATE POLICY "Admins can manage invite_keys"
  ON public.invite_keys FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- ============================================================
-- 6. Keep RLS enabled + forced on all tables
-- ============================================================

ALTER TABLE public.player_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weapon_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attack ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weapon_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weapon_template_attack_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monster_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monster_template_attack_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monster_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.player_inventory FORCE ROW LEVEL SECURITY;
ALTER TABLE public.weapon_instance FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attack FORCE ROW LEVEL SECURITY;
ALTER TABLE public.weapon_template FORCE ROW LEVEL SECURITY;
ALTER TABLE public.weapon_template_attack_mapping FORCE ROW LEVEL SECURITY;
ALTER TABLE public.monster_template FORCE ROW LEVEL SECURITY;
ALTER TABLE public.monster_template_attack_mapping FORCE ROW LEVEL SECURITY;
ALTER TABLE public.monster_instance FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invite_keys FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 7. Grant table-level access to authenticated role.
--    This is REQUIRED so RLS policies get evaluated.
--    Without table-level grants, authenticated users can't access
--    ANY table — including admins, because RLS never fires.
--    The admin gating happens in the RLS policies, not at the
--    table-level grant layer.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

COMMIT;
